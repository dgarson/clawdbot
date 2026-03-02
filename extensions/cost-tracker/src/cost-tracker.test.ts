import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  emitDiagnosticEvent,
  resetDiagnosticEventsForTest,
} from "../../../src/infra/diagnostic-events.js";
import type { PluginHookLlmApiCallEvent } from "../../../src/plugins/types.js";
import { registerCostCollector } from "./collector.js";
import { createCostTrackerStore, wireCostTrackerHooks, type CostTrackerStore } from "./store.js";

type MockHandler = (event: unknown, ctx: unknown) => void | Promise<void>;

function createMockApi(store: CostTrackerStore) {
  const handlers: Record<string, MockHandler[]> = {};
  return {
    on(name: string, handler: MockHandler) {
      handlers[name] ??= [];
      handlers[name].push(handler);
    },
    async fire(name: string, event: unknown, ctx: unknown) {
      for (const h of handlers[name] ?? []) await h(event, ctx);
    },
    handlers,
  };
}

describe("cost-tracker", () => {
  let tmpDir: string;
  let store: CostTrackerStore;
  let api: ReturnType<typeof createMockApi>;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "cost-tracker-test-"));
    store = createCostTrackerStore(tmpDir);
    api = createMockApi(store);
    resetDiagnosticEventsForTest();
    registerCostCollector(api as never, store);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("1. llm_api_call (agent source) — updates session and run totals", async () => {
    await api.fire(
      "llm_api_call",
      {
        callId: "c1",
        source: "agent",
        sessionId: "s1",
        runId: "r1",
        inputTokens: 100,
        costUsd: 0.01,
        provider: "anthropic",
        model: "claude-3",
      } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );

    const s = store.get("s1");
    expect(s?.llm.agentCalls).toBe(1);
    expect(s?.llm.totalApiCalls).toBe(1);
    expect(s?.llm.inputTokens).toBe(100);
    expect(s?.llm.totalCostUsd).toBeCloseTo(0.01);
    expect(s?.totalCostUsd).toBeCloseTo(0.01);

    const run = store.getRun("s1", "r1");
    expect(run?.llmApiCalls).toBe(1);
    expect(run?.inputTokens).toBe(100);
    expect(run?.costUsd).toBeCloseTo(0.01);
  });

  it("2. llm_api_call (compaction source) — increments compactionCalls", async () => {
    await api.fire(
      "llm_api_call",
      { callId: "c2", source: "compaction", sessionId: "s1" } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    expect(store.get("s1")?.llm.compactionCalls).toBe(1);
    expect(store.get("s1")?.llm.agentCalls).toBe(0);
  });

  it("3. llm_api_call (tool source) — increments toolCalls", async () => {
    await api.fire(
      "llm_api_call",
      {
        callId: "c3",
        source: "tool",
        purpose: "llm-task",
        sessionId: "s1",
        parentSessionKey: "parent-s1",
      } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    expect(store.get("s1")?.llm.toolCalls).toBe(1);
  });

  it("4. usage.record (TTS billing) — appends entry, updates byKind and totalCostUsd", () => {
    emitDiagnosticEvent({
      type: "usage.record",
      kind: "tts",
      sessionId: "s1",
      billing: { units: 1000, unitType: "characters", costUsd: 0.001 },
    });
    const s = store.get("s1");
    expect(s?.extensions.entries.length).toBe(1);
    expect(s?.extensions.entries[0].kind).toBe("tts");
    expect(s?.extensions.byKind["tts"]?.count).toBe(1);
    expect(s?.extensions.byKind["tts"]?.totalUnits).toBe(1000);
    expect(s?.extensions.totalCostUsd).toBeCloseTo(0.001);
    expect(s?.totalCostUsd).toBeCloseTo(0.001);
  });

  it("5. usage.record with runId — updates run extensionCostUsd", () => {
    store.updateRun("s1", "r1", (r) => {
      r.runId = "r1";
    });
    emitDiagnosticEvent({
      type: "usage.record",
      kind: "embedding",
      sessionId: "s1",
      runId: "r1",
      billing: { costUsd: 0.005 },
    });
    expect(store.getRun("s1", "r1")?.extensionCostUsd).toBeCloseTo(0.005);
  });

  it("6. model.usage reconciliation — overwrites session LLM totals", async () => {
    await api.fire(
      "llm_api_call",
      {
        callId: "c1",
        source: "agent",
        sessionId: "s1",
        costUsd: 0.01,
      } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    emitDiagnosticEvent({
      type: "model.usage",
      sessionId: "s1",
      costUsd: 0.05,
      usage: { input: 500, output: 200 },
    });
    const s = store.get("s1");
    expect(s?.llm.totalCostUsd).toBeCloseTo(0.05);
    expect(s?.llm.inputTokens).toBe(500);
    expect(s?.totalCostUsd).toBeCloseTo(0.05);
  });

  it("7. run_start initializes run state", async () => {
    await api.fire("run_start", { runId: "r1" }, { sessionId: "s1", sessionKey: "s1" });
    const run = store.getRun("s1", "r1");
    expect(run).toBeDefined();
    expect(run?.runId).toBe("r1");
    expect(run?.startedAt).toBeDefined();
  });

  it("8. byModel accumulation — same provider/model merges into one entry", async () => {
    const base = {
      callId: "x",
      source: "agent" as const,
      sessionId: "s1",
      provider: "anthropic",
      model: "claude-3",
      inputTokens: 100,
      costUsd: 0.01,
    };
    await api.fire("llm_api_call", base, { agentId: "a1", sessionId: "s1", sessionKey: "s1" });
    await api.fire(
      "llm_api_call",
      { ...base, callId: "y", inputTokens: 50, costUsd: 0.005 },
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    const s = store.get("s1");
    expect(s?.llm.byModel.length).toBe(1);
    expect(s?.llm.byModel[0].calls).toBe(2);
    expect(s?.llm.byModel[0].inputTokens).toBe(150);
    expect(s?.llm.byModel[0].costUsd).toBeCloseTo(0.015);
  });

  it("9. bounded extensions.entries — oldest dropped when > 500", () => {
    for (let i = 0; i < 502; i++) {
      emitDiagnosticEvent({
        type: "usage.record",
        kind: "tts",
        sessionId: "s1",
        billing: { costUsd: 0.001, units: i },
      });
    }
    const entries = store.get("s1")?.extensions.entries ?? [];
    expect(entries.length).toBe(500);
  });

  it("10. checkpoint round-trip — flush and restore", async () => {
    await api.fire(
      "llm_api_call",
      {
        callId: "c1",
        source: "agent",
        sessionId: "s1",
        inputTokens: 200,
        costUsd: 0.02,
      } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    await store.flush("s1");

    const store2 = createCostTrackerStore(tmpDir);
    const restored = store2.get("s1");
    expect(restored?.llm.inputTokens).toBe(200);
    expect(restored?.llm.totalCostUsd).toBeCloseTo(0.02);
    store2.close();
  });

  it("11. wireSessionLifecycleHooks — session_end triggers flush", async () => {
    wireCostTrackerHooks(api as never, store);
    store.update("s1", (s) => {
      s.llm.totalCostUsd = 5.0;
    });
    await api.fire("session_end", { sessionId: "s1" }, {});
    await new Promise((r) => setTimeout(r, 20));

    const store2 = createCostTrackerStore(tmpDir);
    expect(store2.get("s1")?.llm.totalCostUsd).toBeCloseTo(5.0);
    store2.close();
  });

  it("12. totalCostUsd = llm.totalCostUsd + extensions.totalCostUsd", async () => {
    await api.fire(
      "llm_api_call",
      {
        callId: "c1",
        source: "agent",
        sessionId: "s1",
        costUsd: 0.1,
      } satisfies PluginHookLlmApiCallEvent,
      { agentId: "a1", sessionId: "s1", sessionKey: "s1" },
    );
    emitDiagnosticEvent({
      type: "usage.record",
      kind: "tts",
      sessionId: "s1",
      billing: { costUsd: 0.05 },
    });
    const s = store.get("s1");
    expect(s?.totalCostUsd).toBeCloseTo(0.15);
    expect(s?.totalCostUsd).toBeCloseTo(
      (s?.llm.totalCostUsd ?? 0) + (s?.extensions.totalCostUsd ?? 0),
    );
  });
});

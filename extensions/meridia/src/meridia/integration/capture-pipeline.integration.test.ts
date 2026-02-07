// Integration test: Full Capture Pipeline + Fanout
// Validates: event normalization -> evaluation -> sanitization -> persistence
// -> search -> rendering -> graph fanout dispatch.

import { afterEach, describe, expect, it, vi } from "vitest";
import type { MeridiaExperienceRecord, Phenomenology } from "../types.js";
import { MeridiaSearchAdapter } from "../../meridia-search-adapter.js";
import { normalizeToolResult, type MeridiaEvent } from "../event/normalizer.js";
import { dispatchFanout, fanoutToVector } from "../fanout.js";
import { extractHeuristicPhenomenology } from "../phenomenology/heuristic.js";
import {
  setupIntegrationBackend,
  makeRecord,
  makePhenomenology,
  sanitizeRecord,
  type IntegrationBackend,
} from "./test-helpers.js";

let env: IntegrationBackend;

afterEach(async () => {
  if (env) {
    await env.cleanup();
  }
});

// Helper: build a hook event that normalizeToolResult accepts
function makeHookEvent(overrides: {
  toolName: string;
  toolCallId: string;
  isError?: boolean;
  args?: unknown;
  result?: unknown;
  sessionKey?: string;
}) {
  return {
    type: "agent",
    action: "tool:result",
    timestamp: new Date(),
    sessionKey: overrides.sessionKey ?? "test-session",
    context: {
      toolName: overrides.toolName,
      toolCallId: overrides.toolCallId,
      isError: overrides.isError ?? false,
      args: overrides.args ?? {},
      result: overrides.result ?? "ok",
      sessionKey: overrides.sessionKey ?? "test-session",
    },
  };
}

// Helper: convert MeridiaEvent to a MeridiaExperienceRecord
function eventToRecord(
  event: MeridiaEvent,
  score: number,
  phenomenology?: Phenomenology,
): MeridiaExperienceRecord {
  const payload = event.payload as { args?: unknown; result?: unknown };
  return {
    id: event.id,
    ts: event.ts,
    kind: "tool_result",
    session: event.session,
    tool: {
      name: event.tool?.name ?? "unknown",
      callId: event.tool?.callId ?? "unknown",
      isError: event.tool?.isError ?? false,
    },
    capture: {
      score,
      evaluation: { kind: "heuristic", score, reason: `${event.tool?.name}_result` },
    },
    phenomenology,
    data: { args: payload?.args, result: payload?.result },
  };
}

describe("Full Capture Pipeline Integration", () => {
  describe("event normalization -> evaluation -> record creation", () => {
    it("normalizeToolResult produces MeridiaEvent from hook event shape", () => {
      const hookEvent = makeHookEvent({ toolName: "write", toolCallId: "call-1" });
      const event = normalizeToolResult(hookEvent);

      expect(event).not.toBeNull();
      expect(event!.kind).toBe("tool_result");
      expect(event!.tool?.name).toBe("write");
      expect(event!.tool?.callId).toBe("call-1");
      expect(event!.provenance.source).toBe("hook");
    });

    it("normalizeToolResult returns null for non-tool events", () => {
      const badEvent = {
        type: "command",
        action: "new",
        timestamp: new Date(),
      };
      const event = normalizeToolResult(badEvent);
      expect(event).toBeNull();
    });

    it("extractHeuristicPhenomenology produces engaged emotions for write tool", () => {
      const event: MeridiaEvent = {
        id: "test-1",
        kind: "tool_result",
        ts: new Date().toISOString(),
        tool: { name: "write", isError: false },
        payload: {},
        provenance: { source: "hook" },
      };

      const phenom = extractHeuristicPhenomenology(event, 0.75);
      expect(phenom.emotionalSignature?.primary).toContain("focused");
      expect(phenom.emotionalSignature?.primary).toContain("engaged");
      expect(phenom.engagementQuality).toBe("engaged");
      expect(phenom.emotionalSignature?.valence).toBeGreaterThan(0);
    });

    it("extractHeuristicPhenomenology produces error-state phenomenology", () => {
      const event: MeridiaEvent = {
        id: "test-err",
        kind: "tool_result",
        ts: new Date().toISOString(),
        tool: { name: "exec", isError: true },
        payload: {},
        provenance: { source: "hook" },
      };

      const phenom = extractHeuristicPhenomenology(event, 0.6);
      expect(phenom.emotionalSignature?.primary).toContain("concerned");
      expect(phenom.engagementQuality).toBe("struggling");
      expect(phenom.emotionalSignature?.valence).toBeLessThan(0);
    });

    it("extractHeuristicPhenomenology maps read tool to curious/calm", () => {
      const event: MeridiaEvent = {
        id: "test-read",
        kind: "tool_result",
        ts: new Date().toISOString(),
        tool: { name: "read", isError: false },
        payload: {},
        provenance: { source: "hook" },
      };

      const phenom = extractHeuristicPhenomenology(event, 0.3);
      expect(phenom.emotionalSignature?.primary).toContain("curious");
      expect(phenom.emotionalSignature?.primary).toContain("calm");
      expect(phenom.engagementQuality).toBe("routine");
    });
  });

  describe("full capture flow: event -> evaluate -> sanitize -> persist -> retrieve", () => {
    it("simulate write tool:result through the full pipeline", async () => {
      env = await setupIntegrationBackend();
      const adapter = new MeridiaSearchAdapter(env.backend);

      // 1. Normalize hook event
      const hookEvent = makeHookEvent({
        toolName: "write",
        toolCallId: "call-write-1",
        args: { path: "src/main.ts", content: "console.log('hello')" },
        result: "File written successfully",
      });
      const event = normalizeToolResult(hookEvent);
      expect(event).not.toBeNull();

      // 2. Evaluate (heuristic)
      const score = 0.75;
      const phenomenology = extractHeuristicPhenomenology(event!, score);

      // 3. Build record
      const record = eventToRecord(event!, score, phenomenology);
      record.content = { topic: "file write operation", summary: "wrote to src/main.ts" };

      // 4. Sanitize
      const sanitized = sanitizeRecord(record);

      // 5. Persist
      const inserted = await env.backend.insertExperienceRecord(sanitized);
      expect(inserted).toBe(true);

      // 6. Retrieve by ID
      const result = await env.backend.getRecordById(event!.id);
      expect(result).not.toBeNull();
      expect(result!.record.tool?.name).toBe("write");
      expect(result!.record.capture.score).toBe(0.75);
      expect(result!.record.phenomenology?.engagementQuality).toBe("engaged");

      // 7. Search via adapter
      const searchResults = await adapter.search("file write");
      expect(searchResults.length).toBeGreaterThan(0);

      // 8. Render via readFile
      const { text } = await adapter.readFile({ relPath: `meridia://${event!.id}` });
      expect(text).toContain("write");
      expect(text).toContain("## Phenomenology");
    });

    it("simulate exec with API key in args — key redacted at every stage", async () => {
      env = await setupIntegrationBackend();

      const apiKey = "sk-live-abcdefghijklmnopqrstuvwxyz123456";
      const hookEvent = makeHookEvent({
        toolName: "exec",
        toolCallId: "call-exec-secret",
        args: { command: `curl -H "Authorization: Bearer ${apiKey}" https://api.example.com` },
        result: '{"status": "ok"}',
      });
      const event = normalizeToolResult(hookEvent);
      expect(event).not.toBeNull();

      const score = 0.65;
      const phenomenology = extractHeuristicPhenomenology(event!, score);
      const record = eventToRecord(event!, score, phenomenology);
      record.content = { topic: "API call via exec" };

      // Sanitize
      const sanitized = sanitizeRecord(record);

      // Verify sanitization happened before persistence
      const sanitizedStr = JSON.stringify(sanitized.data);
      expect(sanitizedStr).not.toContain(apiKey);

      // Persist
      await env.backend.insertExperienceRecord(sanitized);

      // Verify DB doesn't contain the key
      const result = await env.backend.getRecordById(event!.id);
      const storedStr = JSON.stringify(result!.record.data);
      expect(storedStr).not.toContain(apiKey);
    });

    it("simulate error tool — phenomenology reflects error state", async () => {
      env = await setupIntegrationBackend();

      const hookEvent = makeHookEvent({
        toolName: "exec",
        toolCallId: "call-err",
        isError: true,
        args: { command: "npm test" },
        result: "Error: test suite failed",
      });
      const event = normalizeToolResult(hookEvent);
      const phenomenology = extractHeuristicPhenomenology(event!, 0.6);
      const record = eventToRecord(event!, 0.6, phenomenology);
      record.content = { topic: "test failure" };

      await env.backend.insertExperienceRecord(record);

      const result = await env.backend.getRecordById(event!.id);
      expect(result!.record.phenomenology?.engagementQuality).toBe("struggling");
      expect(result!.record.phenomenology?.emotionalSignature?.primary).toContain("concerned");
    });

    it("persisted record rendered via adapter.readFile includes heuristic phenomenology", async () => {
      env = await setupIntegrationBackend();
      const adapter = new MeridiaSearchAdapter(env.backend);

      const event: MeridiaEvent = {
        id: "phenom-render-test",
        kind: "tool_result",
        ts: new Date().toISOString(),
        tool: { name: "write", isError: false },
        payload: { args: {}, result: "ok" },
        provenance: { source: "hook" },
      };
      const phenomenology = extractHeuristicPhenomenology(event, 0.8);
      const record = eventToRecord(event, 0.8, phenomenology);
      record.content = { topic: "phenomenology rendering check" };

      await env.backend.insertExperienceRecord(record);

      const { text } = await adapter.readFile({ relPath: "meridia://phenom-render-test" });
      expect(text).toContain("## Phenomenology");
      expect(text).toContain("focused");
      expect(text).toContain("deep-flow"); // significance 0.8 -> deep-flow
    });
  });

  describe("fanout dispatch", () => {
    it("fanoutToVector returns graceful error when vec unavailable", async () => {
      env = await setupIntegrationBackend();
      const record = makeRecord({ id: "fanout-vec" });

      const result = await fanoutToVector(record, undefined, env.backend);
      expect(result.target).toBe("vector");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("dispatchFanout swallows errors and logs warning", () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      // Dispatch a failing function — should not throw
      dispatchFanout(async () => {
        throw new Error("intentional test error");
      }, "test-error");

      // Give it a tick to settle
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          expect(warnSpy).toHaveBeenCalled();
          const msg = warnSpy.mock.calls[0]?.[0];
          expect(String(msg)).toContain("intentional test error");
          warnSpy.mockRestore();
          resolve();
        }, 50);
      });
    });

    it("dispatchFanout does not throw on success", () => {
      // Should complete without error
      dispatchFanout(
        async () => ({ target: "vector" as const, success: true, durationMs: 1 }),
        "test-success",
      );
      // No assertion needed — just verify no throw
    });
  });

  describe("compaction flow: multi-record grouping", () => {
    it("seed 6+ records across 2 tool types and verify grouping by tool", async () => {
      env = await setupIntegrationBackend();

      const records = [
        makeRecord({
          id: "comp-1",
          tool: { name: "write", callId: "c1", isError: false },
          content: { topic: "write op 1" },
        }),
        makeRecord({
          id: "comp-2",
          tool: { name: "write", callId: "c2", isError: false },
          content: { topic: "write op 2" },
        }),
        makeRecord({
          id: "comp-3",
          tool: { name: "write", callId: "c3", isError: false },
          content: { topic: "write op 3" },
        }),
        makeRecord({
          id: "comp-4",
          tool: { name: "exec", callId: "c4", isError: false },
          content: { topic: "exec op 1" },
        }),
        makeRecord({
          id: "comp-5",
          tool: { name: "exec", callId: "c5", isError: false },
          content: { topic: "exec op 2" },
        }),
        makeRecord({
          id: "comp-6",
          tool: { name: "exec", callId: "c6", isError: true },
          content: { topic: "exec error" },
        }),
      ];

      const inserted = await env.backend.insertExperienceRecordsBatch(records);
      expect(inserted).toBe(6);

      // Verify tool-based grouping via getRecordsByTool
      const writeRecords = await env.backend.getRecordsByTool("write");
      expect(writeRecords.length).toBe(3);

      const execRecords = await env.backend.getRecordsByTool("exec");
      expect(execRecords.length).toBe(3);

      // Verify tool stats
      const toolStats = await env.backend.getToolStats();
      const writeStats = toolStats.find((s) => s.toolName === "write");
      const execStats = toolStats.find((s) => s.toolName === "exec");
      expect(writeStats?.count).toBe(3);
      expect(execStats?.count).toBe(3);
      expect(execStats?.errorCount).toBe(1);
    });

    it("precompact records are searchable after insertion", async () => {
      env = await setupIntegrationBackend();
      const adapter = new MeridiaSearchAdapter(env.backend);

      // Simulate a precompact record (synthesized from multiple records)
      const precompact = makeRecord({
        id: "precompact-1",
        kind: "precompact",
        content: {
          topic: "session compaction summary",
          summary: "Combined 5 write operations into architectural overview",
          tags: ["compaction", "architecture"],
        },
        phenomenology: makePhenomenology(),
      });

      await env.backend.insertExperienceRecord(precompact);

      // Searchable
      const results = await adapter.search("architectural overview");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].path).toBe("meridia://precompact-1");

      // Renderable
      const { text } = await adapter.readFile({ relPath: results[0].path });
      expect(text).toContain("precompact");
      expect(text).toContain("session compaction summary");
      expect(text).toContain("## Phenomenology");
    });
  });
});

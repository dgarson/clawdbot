/**
 * Tests for observability plugin lifecycle hook wiring.
 */

import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import observabilityPlugin from "./index.js";
import * as healthEvaluator from "./src/monitor/health-evaluator.js";

// ---------------------------------------------------------------------------
// Mock plugin SDK hooks so we can safely inspect local hook wiring.
// ---------------------------------------------------------------------------

vi.mock("openclaw/plugin-sdk", () => ({
  onAgentEvent: vi.fn((listener: (evt: unknown) => void) => {
    return () => {
      void listener;
    };
  }),
}));

type HookHandler = (event: Record<string, unknown>, ctx: Record<string, unknown>) => void;

function buildMockApi() {
  const hooks = new Map<string, HookHandler[]>();

  const api = {
    pluginConfig: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    on(name: string, handler: HookHandler) {
      const list = hooks.get(name) ?? [];
      list.push(handler);
      hooks.set(name, list);
    },
    registerService: vi.fn(),
    registerGatewayMethod: vi.fn(),
    config: {},
  } as unknown as OpenClawPluginApi;

  function fireHook(
    name: string,
    event: Record<string, unknown>,
    ctx: Record<string, unknown> = {},
  ) {
    for (const h of hooks.get(name) ?? []) {
      h(event, ctx);
    }
  }

  return { api, fireHook };
}

describe("observability plugin session hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    healthEvaluator.resetHealthState();
    vi.restoreAllMocks();
  });

  it("routes session_start and session_end to observability lifecycle helpers", () => {
    const { api, fireHook } = buildMockApi();

    const startSpy = vi.spyOn(healthEvaluator, "recordSessionStart");
    const endSpy = vi.spyOn(healthEvaluator, "recordSessionEnd");

    observabilityPlugin.register(api);

    fireHook("session_start", { sessionId: "session-1" }, { agentId: "agent-main" });
    fireHook("session_end", { sessionId: "session-1" }, { agentId: "agent-main" });

    expect(startSpy).toHaveBeenCalledTimes(1);
    expect(startSpy).toHaveBeenCalledWith("agent-main");
    expect(endSpy).toHaveBeenCalledTimes(1);
    expect(endSpy).toHaveBeenCalledWith("agent-main");
  });

  it("normalizes missing agent ids to unknown for session hooks", () => {
    const { api, fireHook } = buildMockApi();

    const startSpy = vi.spyOn(healthEvaluator, "recordSessionStart");
    const endSpy = vi.spyOn(healthEvaluator, "recordSessionEnd");

    observabilityPlugin.register(api);

    fireHook("session_start", { sessionId: "session-2" }, {});
    fireHook("session_end", { sessionId: "session-2" }, {});

    expect(startSpy).toHaveBeenCalledWith("unknown");
    expect(endSpy).toHaveBeenCalledWith("unknown");
  });
});

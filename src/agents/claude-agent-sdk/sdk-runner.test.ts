/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { AgentStreamEvent } from "../stream/index.js";
import type { SdkRunnerParams } from "./sdk-runner.types.js";
import { StreamingMiddleware } from "../stream/index.js";
import { runSdkAgent } from "./sdk-runner.js";

// ---------------------------------------------------------------------------
// Mock the SDK and MCP bridge
// ---------------------------------------------------------------------------

// Mock the Claude Agent SDK loader.
vi.mock("./sdk.js", () => ({
  loadClaudeAgentSdk: vi.fn(),
}));

// Mock the tool bridge (avoid needing a real McpServer).
vi.mock("./tool-bridge.js", () => ({
  bridgeClawdbrainToolsToMcpServer: vi.fn(),
}));

// Mock internal hooks (avoid side effects in unit tests).
vi.mock("../../hooks/internal-hooks.js", () => ({
  createInternalHookEvent: vi.fn((_type, action, _key, ctx) => ({ action, ...ctx })),
  triggerInternalHook: vi.fn().mockResolvedValue(undefined),
}));

// Mock agent-events (avoid global side effects).
vi.mock("../../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
  registerAgentRunContext: vi.fn(),
  clearAgentRunContext: vi.fn(),
}));

import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { clearAgentRunContext } from "../../infra/agent-events.js";
import { loadClaudeAgentSdk } from "./sdk.js";
import { bridgeClawdbrainToolsToMcpServer } from "./tool-bridge.js";

const mockLoadSdk = vi.mocked(loadClaudeAgentSdk);
const mockBridge = vi.mocked(bridgeClawdbrainToolsToMcpServer);
const mockCreateHookEvent = vi.mocked(createInternalHookEvent);
const mockTriggerHook = vi.mocked(triggerInternalHook);
const mockClearRunContext = vi.mocked(clearAgentRunContext);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseParams(overrides?: Partial<SdkRunnerParams>): SdkRunnerParams {
  return {
    runId: "test-run-1",
    sessionId: "test-session-1",
    prompt: "Hello, agent!",
    workspaceDir: "/tmp/workspace",
    tools: [],
    ...overrides,
  };
}

function mockBridgeResult() {
  return {
    serverConfig: { type: "sdk" as const, name: "clawdbrain", instance: {} },
    allowedTools: ["mcp__clawdbrain__web_fetch"],
    toolCount: 1,
    registeredTools: ["web_fetch"],
    skippedTools: [],
  };
}

/** Create an async iterable from an array of events. */
async function* eventsFrom<T>(events: T[]): AsyncIterable<T> {
  for (const event of events) {
    yield event;
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockBridge.mockResolvedValue(mockBridgeResult());
});

describe("runSdkAgent", () => {
  describe("SDK loading failures", () => {
    it("returns error result when SDK is not installed", async () => {
      mockLoadSdk.mockRejectedValue(new Error("Cannot find module"));

      const result = await runSdkAgent(baseParams());

      expect(result.payloads).toHaveLength(1);
      expect(result.payloads[0].isError).toBe(true);
      expect(result.payloads[0].text).toContain("Claude Agent SDK is not available");
      expect(result.meta.error?.kind).toBe("sdk_unavailable");
    });
  });

  describe("MCP bridge failures", () => {
    it("returns error result when bridge fails", async () => {
      mockLoadSdk.mockResolvedValue({
        query: vi.fn().mockReturnValue(eventsFrom([])),
      });
      mockBridge.mockRejectedValue(new Error("McpServer not found"));

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].isError).toBe(true);
      expect(result.payloads[0].text).toContain("Failed to bridge Clawdbrain tools");
      expect(result.meta.error?.kind).toBe("mcp_bridge_failed");
    });
  });

  describe("successful runs", () => {
    it("extracts text from assistant events", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([{ type: "message_start" }, { text: "Hello " }, { text: "world!" }]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads).toHaveLength(1);
      expect(result.payloads[0].text).toBe("Hello\n\nworld!");
      expect(result.meta.eventCount).toBe(3);
      expect(result.meta.extractedChars).toBeGreaterThan(0);
      expect(result.meta.error).toBeUndefined();
    });

    it("prefers terminal result event text", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { text: "Partial..." },
            { type: "result", subtype: "success", result: "Final answer." },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Final answer.");
    });

    it("returns no_output error when no text extracted", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "system", data: "started" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toContain("no text output");
      expect(result.payloads[0].isError).toBe(true);
      expect(result.meta.error?.kind).toBe("no_output");
    });

    it("does not return no_output when a messaging tool successfully sent a message", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          {
            type: "tool_use",
            name: "mcp__clawdbrain__message",
            id: "t1",
            input: {
              action: "thread-reply",
              to: "C0AAP72R7L5",
              message: "Hello from tool",
            },
          },
          {
            type: "tool_result",
            id: "t1",
            is_error: false,
            content: [{ type: "text", text: "ok" }],
          },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads).toHaveLength(0);
      expect(result.meta.error).toBeUndefined();
      expect(result.didSendViaMessagingTool).toBe(true);
      expect(result.messagingToolSentTexts).toEqual(["Hello from tool"]);
    });

    it("deduplicates repeated text chunks", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { text: "Hello" },
          { text: "Hello" }, // duplicate
          { text: "World" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Hello\n\nWorld");
    });
  });

  describe("streaming middleware events", () => {
    let mw: StreamingMiddleware;
    let events: AgentStreamEvent[];
    let unsub: () => void;

    beforeEach(() => {
      mw = new StreamingMiddleware({ reasoningLevel: "off", isHeartbeat: false });
      events = [];
      unsub = mw.subscribe((event) => {
        events.push(event);
      });
    });

    afterEach(() => {
      unsub();
      mw.destroy();
    });

    it("emits partial_reply events for each text chunk", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ text: "chunk1" }, { text: "chunk2" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const partials = events.filter((e) => e.kind === "partial_reply");
      expect(partials.length).toBeGreaterThanOrEqual(2);
    });

    it("emits block_reply with final text", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(eventsFrom([{ type: "result", result: "Final text" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const blocks = events.filter((e) => e.kind === "block_reply");
      expect(blocks.length).toBeGreaterThanOrEqual(1);
      expect(blocks.some((b) => b.kind === "block_reply" && b.text.includes("Final text"))).toBe(
        true,
      );
    });

    it("emits tool_end/tool_result for tool events", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_result", text: "tool output", id: "t1" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const toolEnds = events.filter((e) => e.kind === "tool_end" || e.kind === "tool_result");
      expect(toolEnds.length).toBeGreaterThanOrEqual(1);
    });

    it("emits message_start events", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "message_start", message: { role: "assistant" } },
          { type: "result", result: "ok" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const starts = events.filter((e) => e.kind === "message_start");
      expect(starts.length).toBeGreaterThanOrEqual(1);
    });

    it("emits lifecycle events with start and end phases", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "done" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const lifecycles = events.filter((e) => e.kind === "lifecycle") as Array<{
        kind: "lifecycle";
        phase: string;
        data: Record<string, unknown>;
      }>;
      const phases = lifecycles.map((e) => e.phase);
      expect(phases).toContain("start");
      expect(phases).toContain("end");
    });

    it("emits agent_event with assistant stream when text is extracted", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ text: "hello" }, { text: "world" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const agentEvents = events.filter((e) => e.kind === "agent_event") as Array<{
        kind: "agent_event";
        stream: string;
        data: Record<string, unknown>;
      }>;
      const assistantEvents = agentEvents.filter((e) => e.stream === "assistant");
      expect(assistantEvents.length).toBeGreaterThan(0);
      expect(assistantEvents[0]?.data?.text).toBeDefined();
    });

    it("emits tool_start and tool_end events for tool lifecycle", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_execution_start", name: "exec", id: "t1" },
          { type: "tool_result", text: "tool output", id: "t1" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const toolStarts = events.filter((e) => e.kind === "tool_start");
      const toolEnds = events.filter((e) => e.kind === "tool_end");
      expect(toolStarts.length).toBeGreaterThan(0);
      expect(toolEnds.length).toBeGreaterThan(0);
    });

    it("does not break when subscriber throws", async () => {
      // Remove well-behaved subscriber, add a throwing one
      unsub();
      const throwingUnsub = mw.subscribe(() => {
        throw new Error("subscriber error");
      });

      const queryFn = vi
        .fn()
        .mockReturnValue(eventsFrom([{ text: "hello" }, { type: "result", result: "done" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams({ streamMiddleware: mw }));

      // Run should still succeed despite subscriber errors.
      expect(result.payloads[0].text).toBe("done");
      throwingUnsub();
    });

    it("completes run even with no middleware subscribers", async () => {
      // Remove the subscriber — middleware has no listeners
      unsub();

      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams({ streamMiddleware: mw }));

      expect(result.payloads[0].text).toBe("ok");
      // Re-assign unsub so afterEach doesn't double-call
      unsub = () => {};
    });
  });

  describe("Claude Code hooks", () => {
    it("passes hook callbacks to the SDK when hooksEnabled is true and emits tool events via middleware", async () => {
      const mw = new StreamingMiddleware({ reasoningLevel: "off", isHeartbeat: false });
      const events: AgentStreamEvent[] = [];
      const unsub = mw.subscribe((event) => {
        events.push(event);
      });

      const queryFn = vi.fn().mockImplementation(async (args: any) => {
        const hooks = args?.options?.hooks;
        const pre = hooks?.PreToolUse?.[0]?.hooks?.[0];
        const post = hooks?.PostToolUse?.[0]?.hooks?.[0];

        // Simulate a tool run via hooks (what Claude Code would do).
        await pre?.(
          { tool_name: "mcp__clawdbrain__exec", tool_input: { command: "echo hi" } },
          "t1",
          {},
        );
        await post?.(
          {
            tool_name: "mcp__clawdbrain__exec",
            tool_response: { content: [{ type: "text", text: "ok" }] },
          },
          "t1",
          {},
        );

        return eventsFrom([{ type: "result", result: "done" }]);
      });
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ hooksEnabled: true, streamMiddleware: mw }));

      // Check agent_event stream for tool lifecycle events
      const agentEvents = events.filter((e) => e.kind === "agent_event") as Array<{
        kind: "agent_event";
        stream: string;
        data: Record<string, unknown>;
      }>;
      const toolEvents = agentEvents.filter((e) => e.stream === "tool");
      expect(
        toolEvents.some((evt) => evt.data?.phase === "start" && evt.data?.name === "exec"),
      ).toBe(true);
      expect(
        toolEvents.some((evt) => evt.data?.phase === "result" && evt.data?.name === "exec"),
      ).toBe(true);

      // Check hook events are emitted
      const hookEvents = agentEvents
        .filter((e) => e.stream === "hook")
        .map((e) => e.data?.hookEventName);
      expect(hookEvents).toContain("PreToolUse");
      expect(hookEvents).toContain("PostToolUse");

      unsub();
      mw.destroy();
    });
  });

  describe("SDK options", () => {
    it("passes provider env to SDK options", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(
        baseParams({
          provider: {
            name: "z.AI",
            env: {
              ANTHROPIC_BASE_URL: "https://api.z.ai/api/anthropic",
              ANTHROPIC_AUTH_TOKEN: "test-key",
            },
          },
        }),
      );

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      const options = queryArgs.options as Record<string, unknown>;
      const env = options.env as Record<string, string>;
      expect(env.ANTHROPIC_BASE_URL).toBe("https://api.z.ai/api/anthropic");
      expect(env.ANTHROPIC_AUTH_TOKEN).toBe("test-key");
    });

    it("passes workspace dir as cwd", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ workspaceDir: "/my/project" }));

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      expect((queryArgs.options as Record<string, unknown>).cwd).toBe("/my/project");
    });

    it("disables built-in tools by default", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams());

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      expect((queryArgs.options as Record<string, unknown>).tools).toEqual([]);
    });

    it("enables specified built-in tools", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ builtInTools: ["Read", "Bash"] }));

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      const options = queryArgs.options as Record<string, unknown>;
      expect(options.tools).toEqual(["Read", "Bash"]);
      // Built-in tools should be merged into allowedTools.
      expect(options.allowedTools).toEqual(expect.arrayContaining(["Read", "Bash"]));
    });

    it("passes system prompt to SDK options", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ systemPrompt: "You are a test agent." }));

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      expect((queryArgs.options as Record<string, unknown>).systemPrompt).toBe(
        "You are a test agent.",
      );
    });

    it("passes maxTurns from provider config", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ provider: { maxTurns: 10 } }));

      const [queryArgs] = queryFn.mock.calls[0] as [{ options?: Record<string, unknown> }];
      expect((queryArgs.options as Record<string, unknown>).maxTurns).toBe(10);
    });
  });

  describe("query errors", () => {
    it("returns error result when query throws", async () => {
      const queryFn = vi.fn().mockImplementation(() => {
        throw new Error("Network error");
      });
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].isError).toBe(true);
      expect(result.payloads[0].text).toContain("Network error");
      expect(result.meta.error?.kind).toBe("run_failed");
    });
  });

  describe("metadata", () => {
    it("includes bridge diagnostics in meta", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.meta.bridge).toEqual({
        toolCount: 1,
        registeredTools: ["web_fetch"],
        skippedTools: [],
      });
    });

    it("includes provider name in meta", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams({ provider: { name: "z.AI" } }));

      expect(result.meta.provider).toBe("z.AI");
    });

    it("tracks duration", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.meta.durationMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("thinking/reasoning content filtering", () => {
    it("does not extract text from thinking events", async () => {
      const mw = new StreamingMiddleware({ reasoningLevel: "off", isHeartbeat: false });
      const events: AgentStreamEvent[] = [];
      const unsub = mw.subscribe((event) => {
        events.push(event);
      });

      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { type: "thinking", text: "I need to think about this" },
            { text: "Final answer" },
            { type: "result", result: "Final answer" },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams({ streamMiddleware: mw }));

      expect(result.payloads[0].text).toBe("Final answer");
      // Should only have partial_reply for actual text, not for thinking content
      const partials = events.filter((e) => e.kind === "partial_reply");
      expect(partials).toHaveLength(1);

      unsub();
      mw.destroy();
    });

    it("does not extract text from thinking_delta events", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { type: "thinking_delta", delta: "Reasoning step 1" },
            { type: "thinking_delta", delta: "Reasoning step 2" },
            { text: "Answer" },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Answer");
    });

    it("strips thinking tags from final text", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([{ text: "<thinking>Let me consider this</thinking>The answer is 42" }]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("The answer is 42");
    });

    it("strips thinking tags from result text", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          {
            type: "result",
            result: "<think>reasoning</think>Clean answer",
          },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Clean answer");
    });

    it("classifies thinking events as system, not assistant", async () => {
      const mw = new StreamingMiddleware({ reasoningLevel: "off", isHeartbeat: false });
      const events: AgentStreamEvent[] = [];
      const unsub = mw.subscribe((event) => {
        events.push(event);
      });

      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "thinking", text: "Reasoning content" },
          { type: "result", result: "ok" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      // Should not emit partial_reply or agent_event/assistant for thinking content
      const agentEvents = events.filter((e) => e.kind === "agent_event") as Array<{
        kind: "agent_event";
        stream: string;
        data: Record<string, unknown>;
      }>;
      const assistantEvents = agentEvents.filter((e) => e.stream === "assistant");
      for (const evt of assistantEvents) {
        expect(evt.data?.text).not.toContain("Reasoning");
      }

      unsub();
      mw.destroy();
    });
  });

  describe("message boundary tracking", () => {
    it("returns only last turn text when result has no result field (multi-turn)", async () => {
      // Simulates SDKResultError (max_turns, budget, etc.) where result.result is undefined.
      // Two turns with intermediate narration — only the last turn's text should be returned.
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "message_start", message: { role: "assistant" } },
          { text: "Turn 1: I will search for that." },
          { type: "tool_use", name: "search", id: "t1", input: {} },
          {
            type: "tool_result",
            id: "t1",
            is_error: false,
            content: [{ type: "text", text: "results" }],
          },
          { type: "message_start", message: { role: "assistant" } },
          { text: "Turn 2: Here is the final answer." },
          // Result without .result field (error/max_turns scenario)
          { type: "result", subtype: "error" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads).toHaveLength(1);
      expect(result.payloads[0].text).toBe("Turn 2: Here is the final answer.");
      expect(result.payloads[0].text).not.toContain("Turn 1");
    });

    it("returns only third turn text with three turns and no result", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { type: "message_start", message: { role: "assistant" } },
            { text: "Turn 1 narration" },
            { type: "message_start", message: { role: "assistant" } },
            { text: "Turn 2 narration" },
            { type: "message_start", message: { role: "assistant" } },
            { text: "Turn 3 final" },
            { type: "result", subtype: "error" },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Turn 3 final");
      expect(result.payloads[0].text).not.toContain("Turn 1");
      expect(result.payloads[0].text).not.toContain("Turn 2");
    });

    it("still prefers resultText over assistantTexts when result has .result", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { type: "message_start", message: { role: "assistant" } },
            { text: "Intermediate narration" },
            { type: "message_start", message: { role: "assistant" } },
            { text: "More narration" },
            { type: "result", subtype: "success", result: "The definitive answer." },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("The definitive answer.");
    });

    it("returns text when no message_start events (fallback path)", async () => {
      // Some SDK versions may not emit message_start — text arrives without boundary markers.
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { text: "Direct text without message_start" },
            { type: "result", subtype: "error" },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Direct text without message_start");
    });

    it("returns no_output error when only tool events and no text", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_use", name: "exec", id: "t1", input: {} },
          {
            type: "tool_result",
            id: "t1",
            is_error: false,
            content: [{ type: "text", text: "ok" }],
          },
          { type: "result", subtype: "error" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].isError).toBe(true);
      expect(result.meta.error?.kind).toBe("no_output");
    });

    it("emits message_start via middleware for every message boundary", async () => {
      const mw = new StreamingMiddleware({ reasoningLevel: "off", isHeartbeat: false });
      const events: AgentStreamEvent[] = [];
      const unsub = mw.subscribe((event) => {
        events.push(event);
      });

      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([
            { type: "message_start", message: { role: "assistant" } },
            { text: "First" },
            { type: "message_start", message: { role: "assistant" } },
            { text: "Second" },
            { type: "result", result: "done" },
          ]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      await runSdkAgent(baseParams({ streamMiddleware: mw }));

      const starts = events.filter((e) => e.kind === "message_start");
      expect(starts).toHaveLength(2);

      unsub();
      mw.destroy();
    });

    it("consolidates multi-chunk single message into one text", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "message_start", message: { role: "assistant" } },
          { text: "Part A" },
          { text: "Part B" },
          // No result.result — fallback to assistantTexts
          { type: "result", subtype: "error" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      // Both chunks should be consolidated into a single message.
      expect(result.payloads[0].text).toBe("Part A\n\nPart B");
    });
  });

  describe("compaction handoff stripping", () => {
    it("removes compaction handoff boilerplate from final text", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          {
            text: [
              "Summary line.",
              "Please continue the conversation from where we left it off without asking the user any further questions.",
              "More details that should be stripped.",
            ].join("\n"),
          },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Summary line.");
    });
  });

  describe("P6: shouldEmitToolOutput gating", () => {
    it("suppresses onToolResult when shouldEmitToolOutput is false (non-hooks)", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_result", text: "tool output", id: "t1" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onToolResult = vi.fn();
      await runSdkAgent(baseParams({ onToolResult, shouldEmitToolOutput: false }));

      expect(onToolResult).not.toHaveBeenCalled();
    });

    it("still emits tool events via onAgentEvent when shouldEmitToolOutput is false", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_result", text: "tool output", id: "t1" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onAgentEvent = vi.fn();
      await runSdkAgent(baseParams({ onAgentEvent, shouldEmitToolOutput: false }));

      // Tool events should still be emitted for diagnostics even though onToolResult is suppressed
      const toolEvents = onAgentEvent.mock.calls
        .map((c) => c[0] as { stream?: string; data?: { phase?: string } })
        .filter((evt) => evt.stream === "tool");
      expect(toolEvents.length).toBeGreaterThan(0);
    });

    it("suppresses onToolResult when shouldEmitToolOutput is false (hooks path)", async () => {
      const queryFn = vi.fn().mockImplementation(async (args: any) => {
        const hooks = args?.options?.hooks;
        const pre = hooks?.PreToolUse?.[0]?.hooks?.[0];
        const post = hooks?.PostToolUse?.[0]?.hooks?.[0];

        await pre?.(
          { tool_name: "mcp__clawdbrain__exec", tool_input: { command: "echo hi" } },
          "t1",
          {},
        );
        await post?.(
          {
            tool_name: "mcp__clawdbrain__exec",
            tool_response: { content: [{ type: "text", text: "hello" }] },
          },
          "t1",
          {},
        );

        return eventsFrom([{ type: "result", result: "done" }]);
      });
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onToolResult = vi.fn();
      await runSdkAgent(
        baseParams({ hooksEnabled: true, onToolResult, shouldEmitToolOutput: false }),
      );

      expect(onToolResult).not.toHaveBeenCalled();
    });
  });

  describe("P3: mediaUrls in callbacks", () => {
    it("extracts mediaUrls from assistant text in onPartialReply", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([{ text: "Here is the image\nMEDIA: https://example.com/img.png" }]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onPartialReply = vi.fn();
      await runSdkAgent(baseParams({ onPartialReply }));

      expect(onPartialReply).toHaveBeenCalledTimes(1);
      const call = onPartialReply.mock.calls[0][0] as { text?: string; mediaUrls?: string[] };
      expect(call.text).toBe("Here is the image");
      expect(call.mediaUrls).toContain("https://example.com/img.png");
    });

    it("extracts mediaUrls in final result payload", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(eventsFrom([{ text: "Answer\nMEDIA: https://example.com/file.mp3" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const result = await runSdkAgent(baseParams());

      expect(result.payloads[0].text).toBe("Answer");
      expect(result.payloads[0].mediaUrls).toContain("https://example.com/file.mp3");
    });

    it("extracts mediaUrls in onBlockReply", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(
          eventsFrom([{ type: "result", result: "Response\nMEDIA: https://example.com/a.jpg" }]),
        );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onBlockReply = vi.fn();
      await runSdkAgent(baseParams({ onBlockReply }));

      expect(onBlockReply).toHaveBeenCalledTimes(1);
      const call = onBlockReply.mock.calls[0][0] as { text?: string; mediaUrls?: string[] };
      expect(call.text).toBe("Response");
      expect(call.mediaUrls).toContain("https://example.com/a.jpg");
    });

    it("extracts mediaUrls from tool results in onToolResult (non-hooks)", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_result", text: "Result\nMEDIA: https://example.com/tool.png", id: "t1" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onToolResult = vi.fn();
      await runSdkAgent(baseParams({ onToolResult }));

      expect(onToolResult).toHaveBeenCalledTimes(1);
      const call = onToolResult.mock.calls[0][0] as { text?: string; mediaUrls?: string[] };
      expect(call.text).toBe("Result");
      expect(call.mediaUrls).toContain("https://example.com/tool.png");
    });

    it("emits clean text (no MEDIA tokens) in assistant events", async () => {
      const queryFn = vi
        .fn()
        .mockReturnValue(eventsFrom([{ text: "Text\nMEDIA: https://example.com/x.png" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });

      const onAgentEvent = vi.fn();
      await runSdkAgent(baseParams({ onAgentEvent }));

      const assistantEvents = onAgentEvent.mock.calls
        .map((c) => c[0] as { stream?: string; data?: { text?: string } })
        .filter((evt) => evt.stream === "assistant");
      expect(assistantEvents.length).toBeGreaterThan(0);
      // The text should be cleaned of MEDIA tokens
      for (const evt of assistantEvents) {
        expect(evt.data?.text).not.toContain("MEDIA:");
      }
    });
  });

  describe("early return context cleanup", () => {
    it("clears agent run context on SDK load failure", async () => {
      mockLoadSdk.mockRejectedValue(new Error("SDK not found"));
      mockClearRunContext.mockClear();

      await runSdkAgent(baseParams());

      expect(mockClearRunContext).toHaveBeenCalledWith("test-run-1");
    });

    it("clears agent run context on MCP bridge failure", async () => {
      mockLoadSdk.mockResolvedValue({ query: vi.fn().mockReturnValue(eventsFrom([])) });
      mockBridge.mockRejectedValue(new Error("Bridge broken"));
      mockClearRunContext.mockClear();

      await runSdkAgent(baseParams());

      expect(mockClearRunContext).toHaveBeenCalledWith("test-run-1");
    });

    it("clears agent run context on successful run (via finally block)", async () => {
      const queryFn = vi.fn().mockReturnValue(eventsFrom([{ type: "result", result: "ok" }]));
      mockLoadSdk.mockResolvedValue({ query: queryFn });
      mockClearRunContext.mockClear();

      await runSdkAgent(baseParams());

      expect(mockClearRunContext).toHaveBeenCalledWith("test-run-1");
    });
  });

  describe("compaction:end internal hook", () => {
    it("fires agent:compaction:end internal hook on compact_boundary event", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          {
            type: "system",
            subtype: "compact_boundary",
            compact_metadata: { trigger: "auto", pre_tokens: 50000 },
          },
          { type: "result", result: "ok" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });
      mockCreateHookEvent.mockClear();
      mockTriggerHook.mockClear();

      await runSdkAgent(baseParams({ sessionKey: "sk-1" }));

      // Find the compaction:end hook event
      const compactionCalls = mockCreateHookEvent.mock.calls.filter(
        (call) => call[1] === "compaction:end",
      );
      expect(compactionCalls.length).toBe(1);
      expect(compactionCalls[0][0]).toBe("agent");
      expect(compactionCalls[0][2]).toBe("sk-1");
      const ctx = compactionCalls[0][3] as Record<string, unknown>;
      expect(ctx.trigger).toBe("auto");
      expect(ctx.willRetry).toBe(false);
    });
  });

  describe("non-hooks tool:result internal hook bridging", () => {
    it("fires agent:tool:result internal hook for terminal tool events", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { type: "tool_result", text: "tool output", id: "t1", name: "exec" },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });
      mockCreateHookEvent.mockClear();

      await runSdkAgent(baseParams({ sessionKey: "sk-2" }));

      const toolResultCalls = mockCreateHookEvent.mock.calls.filter(
        (call) => call[1] === "tool:result",
      );
      expect(toolResultCalls.length).toBe(1);
      expect(toolResultCalls[0][0]).toBe("agent");
      expect(toolResultCalls[0][2]).toBe("sk-2");
      const ctx = toolResultCalls[0][3] as Record<string, unknown>;
      expect(ctx.toolName).toBeDefined();
    });

    it("includes meta and recentAssistantText in non-hooks tool:result hook", async () => {
      const queryFn = vi.fn().mockReturnValue(
        eventsFrom([
          { text: "I will run the command" },
          {
            type: "tool_result",
            text: "command output",
            id: "t1",
            name: "mcp__clawdbrain__exec",
            input: { command: "echo hi" },
          },
          { type: "result", result: "done" },
        ]),
      );
      mockLoadSdk.mockResolvedValue({ query: queryFn });
      mockCreateHookEvent.mockClear();

      await runSdkAgent(baseParams({ sessionKey: "sk-3" }));

      const toolResultCalls = mockCreateHookEvent.mock.calls.filter(
        (call) => call[1] === "tool:result",
      );
      expect(toolResultCalls.length).toBe(1);
      const ctx = toolResultCalls[0][3] as Record<string, unknown>;
      // recentAssistantText should include the assistant text from before the tool call
      expect(typeof ctx.recentAssistantText).toBe("string");
      expect((ctx.recentAssistantText as string).length).toBeGreaterThan(0);
    });
  });
});

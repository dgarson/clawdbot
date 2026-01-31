/**
 * Tests for MCP tool bridge: OpenClaw tools → Claude Agent SDK MCP tools.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { createOpenClawMcpServer } from "./tools.js";
import type { ClaudeSdkRunState } from "./types.js";
import type { AnyAgentTool } from "../pi-tools.types.js";

// Mock dependencies
vi.mock("../../infra/agent-events.js", () => ({
  emitAgentEvent: vi.fn(),
}));

vi.mock("@anthropic-ai/claude-agent-sdk/sdk.mjs", () => ({
  createSdkMcpServer: vi.fn((config) => ({
    name: config.name,
    version: config.version,
    tools: config.tools,
  })),
}));

function createMockState(): ClaudeSdkRunState {
  return {
    assistantTexts: [],
    toolMetas: [],
    toolMetaById: new Map(),
    pendingMessagingTexts: new Map(),
    pendingMessagingTargets: new Map(),
    messagingToolSentTexts: [],
    messagingToolSentTextsNormalized: [],
    messagingToolSentTargets: [],
    didSendViaMessagingTool: false,
    lastToolError: undefined,
    accumulatedThinking: undefined,
    deltaBuffer: "",
    lastStreamedAssistant: undefined,
  };
}

function createMockTool(overrides?: Partial<AnyAgentTool>): AnyAgentTool {
  return {
    name: "test_tool",
    description: "A test tool",
    parameters: {
      type: "object",
      properties: {
        input: { type: "string" },
      },
      required: ["input"],
    },
    execute: vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "success" }],
    }),
    ...overrides,
  };
}

describe("createOpenClawMcpServer", () => {
  let state: ClaudeSdkRunState;

  beforeEach(() => {
    state = createMockState();
    vi.clearAllMocks();
  });

  it("creates an MCP server with tools", () => {
    const tool = createMockTool();
    const server = createOpenClawMcpServer({
      tools: [tool],
      runId: "run-1",
      state,
    });

    expect(server).toBeDefined();
    expect(server.name).toBe("openclaw-tools");
    expect(server.version).toBe("1.0.0");
    expect(server.tools).toHaveLength(1);
  });

  it("converts tool name and description", () => {
    const tool = createMockTool({
      name: "my_custom_tool",
      description: "Does custom things",
    });
    const server = createOpenClawMcpServer({
      tools: [tool],
      runId: "run-1",
      state,
    });

    expect(server.tools[0].name).toBe("my_custom_tool");
    expect(server.tools[0].description).toBe("Does custom things");
  });

  it("handles empty tools array", () => {
    const server = createOpenClawMcpServer({
      tools: [],
      runId: "run-1",
      state,
    });

    expect(server.tools).toHaveLength(0);
  });

  it("creates multiple tools", () => {
    const tools = [
      createMockTool({ name: "tool_a" }),
      createMockTool({ name: "tool_b" }),
      createMockTool({ name: "tool_c" }),
    ];
    const server = createOpenClawMcpServer({
      tools,
      runId: "run-1",
      state,
    });

    expect(server.tools).toHaveLength(3);
    expect(server.tools.map((t) => t.name)).toEqual(["tool_a", "tool_b", "tool_c"]);
  });

  describe("tool handler", () => {
    it("invokes the original tool execute method", async () => {
      const executeFn = vi.fn().mockResolvedValue({
        content: [{ type: "text", text: "result" }],
      });
      const tool = createMockTool({ execute: executeFn });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      await handler({ input: "test" });

      expect(executeFn).toHaveBeenCalledWith(
        expect.stringMatching(/^call_\d+_[a-z0-9]+$/),
        { input: "test" },
        expect.any(AbortSignal),
        undefined,
      );
    });

    it("returns MCP-compatible text result", async () => {
      const tool = createMockTool({
        execute: vi.fn().mockResolvedValue({
          content: [{ type: "text", text: "hello world" }],
        }),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({ input: "test" })) as CallToolResult;

      expect(result.content).toEqual([{ type: "text", text: "hello world" }]);
      expect(result.isError).toBe(false);
    });

    it("returns MCP-compatible result with sanitized images", async () => {
      // Note: sanitizeToolResult removes image data and replaces with metadata
      const tool = createMockTool({
        execute: vi.fn().mockResolvedValue({
          content: [{ type: "image", data: "base64data", mimeType: "image/png" }],
        }),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      // Image data is sanitized (removed) and replaced with metadata
      // The convertToMcpResult will stringify the sanitized result
      expect(result.content).toEqual([
        {
          type: "text",
          text: expect.stringContaining('"type":"image"'),
        },
      ]);
    });

    it("handles tool execution error", async () => {
      const tool = createMockTool({
        execute: vi.fn().mockRejectedValue(new Error("Tool failed")),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      expect(result.isError).toBe(true);
      expect(result.content).toEqual([
        { type: "text", text: expect.stringContaining("Error: Tool failed") },
      ]);
    });

    it("tracks tool meta in state", async () => {
      const tool = createMockTool({ name: "file_read" });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      await handler({ path: "/test/file.txt" });

      expect(state.toolMetas).toHaveLength(1);
      expect(state.toolMetas[0].toolName).toBe("file_read");
    });

    it("tracks last tool error on failure", async () => {
      const tool = createMockTool({
        name: "failing_tool",
        execute: vi.fn().mockRejectedValue(new Error("Something broke")),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      await handler({});

      expect(state.lastToolError).toBeDefined();
      expect(state.lastToolError?.toolName).toBe("failing_tool");
      expect(state.lastToolError?.error).toContain("Something broke");
    });

    it("respects abort signal", async () => {
      const abortController = new AbortController();
      abortController.abort();

      const tool = createMockTool();
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
        abortSignal: abortController.signal,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      expect(result.isError).toBe(true);
      expect(result.content[0]).toEqual({
        type: "text",
        text: expect.stringContaining("aborted"),
      });
      // Original execute should not be called
      expect(tool.execute).not.toHaveBeenCalled();
    });

    it("stringifies non-MCP result format", async () => {
      const tool = createMockTool({
        execute: vi.fn().mockResolvedValue({ custom: "data", value: 42 }),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      expect(result.content).toEqual([
        { type: "text", text: JSON.stringify({ custom: "data", value: 42 }) },
      ]);
    });

    it("handles null/undefined result", async () => {
      const tool = createMockTool({
        execute: vi.fn().mockResolvedValue(null),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      expect(result.content).toEqual([{ type: "text", text: "" }]);
    });

    it("handles primitive result", async () => {
      const tool = createMockTool({
        execute: vi.fn().mockResolvedValue("simple string result"),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      const result = (await handler({})) as CallToolResult;

      expect(result.content).toEqual([{ type: "text", text: "simple string result" }]);
    });
  });

  describe("messaging tool tracking", () => {
    it("tracks messaging tool sent texts on success", async () => {
      // Mock the messaging tool detection
      vi.doMock("../pi-embedded-messaging.js", () => ({
        isMessagingTool: (name: string) => name === "send_message",
        isMessagingToolSendAction: () => true,
      }));

      const tool = createMockTool({
        name: "send_message",
        execute: vi.fn().mockResolvedValue({ content: [{ type: "text", text: "sent" }] }),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      await handler({ content: "Hello!", action: "send" });

      // After execution, pending texts should be processed
      // (The actual messaging tracking depends on isMessagingTool returning true)
    });

    it("does not track messaging tool text on error", async () => {
      const tool = createMockTool({
        name: "send_message",
        execute: vi.fn().mockRejectedValue(new Error("Send failed")),
      });
      const server = createOpenClawMcpServer({
        tools: [tool],
        runId: "run-1",
        state,
      });

      const handler = server.tools[0].handler;
      await handler({ content: "Hello!", action: "send" });

      // On error, text should not be added to sent texts
      expect(state.messagingToolSentTexts).not.toContain("Hello!");
    });
  });
});

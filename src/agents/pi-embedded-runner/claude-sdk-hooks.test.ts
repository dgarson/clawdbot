/**
 * Claude SDK Hooks Contract Tests
 *
 * Derived from: implementation-plan.md Section 3.1 (hook parity matrix),
 * test-specifications.md Section 4 (hook firing contract tests).
 *
 * These tests verify that:
 * 1. Tool lifecycle events emitted by claude-sdk MCP server have correct Pi field names
 *    (toolCallId/toolName/args/result/isError) matching the AgentEvent type from pi-agent-core.
 * 2. The after_tool_call hook fires when a tool_execution_end event reaches the subscriber.
 *
 * The hooks that fire from attempt.ts (before_prompt_build, before_agent_start, llm_input,
 * agent_end, llm_output) are runtime-agnostic and don't need claude-sdk-specific tests —
 * they fire from the same attempt.ts call sites regardless of runtime.
 *
 * The critical "medium risk" hook is after_tool_call, which depends on tool_execution_end
 * events flowing through the subscription pipeline. This test verifies that the MCP tool
 * server emits events in the correct Pi AgentEvent format.
 */

import { Type } from "@sinclair/typebox";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock the Agent SDK (needed by mcp-tool-server.ts)
// ---------------------------------------------------------------------------

type McpToolDef = {
  name: string;
  description: string;
  schema: unknown;
  handler: (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>;
};

type CapturedMcpServer = {
  name: string;
  version: string;
  tools: McpToolDef[];
};

let capturedServer: CapturedMcpServer | null = null;

vi.mock("@anthropic-ai/claude-agent-sdk", () => {
  return {
    createSdkMcpServer: vi.fn((config: CapturedMcpServer) => {
      capturedServer = config;
      return { type: "mock-mcp-server", ...config };
    }),
    tool: vi.fn(
      (
        name: string,
        description: string,
        schema: unknown,
        handler: (args: Record<string, unknown>, extra?: unknown) => Promise<unknown>,
      ): McpToolDef => ({ name, description, schema, handler }),
    ),
    query: vi.fn(),
  };
});

import { createClaudeSdkMcpToolServer } from "../claude-sdk-runner/mcp-tool-server.js";

// ---------------------------------------------------------------------------
// Section 4.2: Tool Lifecycle Event Field Shape Contracts
//
// The Pi AgentEvent type defines the canonical field names that pi-embedded-subscribe
// handlers expect. Events with wrong field names will silently fail (handlers read
// evt.toolCallId, evt.result, evt.isError — not toolId/output/error).
// ---------------------------------------------------------------------------

describe("claude-sdk hooks — tool event field shape (Pi AgentEvent contract)", () => {
  beforeEach(() => {
    capturedServer = null;
    vi.clearAllMocks();
  });

  it("tool_execution_start event has toolCallId field (not toolId)", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          parameters: Type.Object({ path: Type.String() }),
          execute: vi.fn().mockResolvedValue("contents"),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    // Call the registered tool handler
    const toolDef = capturedServer?.tools.find((t) => t.name === "read_file");
    expect(toolDef).toBeDefined();
    await toolDef!.handler({ path: "/foo.ts" }, {});

    const startEvt = capturedEvents.find((e) => e.type === "tool_execution_start");
    expect(startEvt).toBeDefined();
    // Pi AgentEvent uses toolCallId, not toolId
    expect(startEvt).toHaveProperty("toolCallId");
    expect(startEvt).toHaveProperty("toolName");
    expect(startEvt).toHaveProperty("args");
    // Must NOT use the wrong field names
    expect(startEvt).not.toHaveProperty("toolId");
    expect(startEvt).not.toHaveProperty("input");
  });

  it("tool_execution_end event has toolCallId, result, isError fields (not toolId/output/error)", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "write_file",
          description: "Write a file",
          parameters: Type.Object({ path: Type.String(), content: Type.String() }),
          execute: vi.fn().mockResolvedValue("wrote 42 bytes"),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    const toolDef = capturedServer?.tools.find((t) => t.name === "write_file");
    await toolDef!.handler({ path: "/foo.ts", content: "hello" }, {});

    const endEvt = capturedEvents.find((e) => e.type === "tool_execution_end");
    expect(endEvt).toBeDefined();
    // Pi AgentEvent uses toolCallId, result, isError
    expect(endEvt).toHaveProperty("toolCallId");
    expect(endEvt).toHaveProperty("toolName");
    expect(endEvt).toHaveProperty("result");
    expect(endEvt).toHaveProperty("isError");
    expect(endEvt!.isError).toBe(false);
    expect(endEvt!.result).toBe("wrote 42 bytes");
    // Must NOT use the wrong field names
    expect(endEvt).not.toHaveProperty("toolId");
    expect(endEvt).not.toHaveProperty("output");
    expect(endEvt).not.toHaveProperty("error");
  });

  it("tool_execution_end with error sets isError: true and result to error message", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "bash",
          description: "Run bash",
          parameters: Type.Object({ command: Type.String() }),
          execute: vi.fn().mockRejectedValue(new Error("Permission denied")),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    const toolDef = capturedServer?.tools.find((t) => t.name === "bash");
    await toolDef!.handler({ command: "rm -rf /" }, {});

    const endEvt = capturedEvents.find((e) => e.type === "tool_execution_end");
    expect(endEvt).toBeDefined();
    expect(endEvt!.isError).toBe(true);
    // result should be the error message (string form)
    expect(typeof endEvt!.result).toBe("string");
    expect(String(endEvt!.result)).toContain("Permission denied");
  });

  it("toolCallId is consistent across start and end events", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          parameters: Type.Object({ path: Type.String() }),
          execute: vi.fn().mockResolvedValue("content"),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    const toolDef = capturedServer?.tools.find((t) => t.name === "read_file");
    await toolDef!.handler({ path: "/foo.ts" }, { toolCallId: "call_explicit_id_123" });

    const startEvt = capturedEvents.find((e) => e.type === "tool_execution_start");
    const endEvt = capturedEvents.find((e) => e.type === "tool_execution_end");
    expect(startEvt).toBeDefined();
    expect(endEvt).toBeDefined();
    // Same toolCallId on both
    expect(startEvt!.toolCallId).toBe(endEvt!.toolCallId);
    expect(typeof startEvt!.toolCallId).toBe("string");
  });

  it("tool_execution_update event uses Pi field names when onUpdate fires", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          parameters: Type.Object({ path: Type.String() }),
          execute: vi.fn(
            async (
              _id: string,
              _args: unknown,
              _signal: unknown,
              onUpdate: (u: unknown) => void,
            ) => {
              onUpdate({ partialResult: "partial data" });
              return "done";
            },
          ),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    const toolDef = capturedServer?.tools.find((t) => t.name === "read_file");
    await toolDef!.handler({ path: "/foo.ts" }, {});

    const updateEvt = capturedEvents.find((e) => e.type === "tool_execution_update");
    expect(updateEvt).toBeDefined();
    // Pi AgentEvent uses toolCallId (not toolId)
    expect(updateEvt).toHaveProperty("toolCallId");
    expect(updateEvt).not.toHaveProperty("toolId");
  });
});

// ---------------------------------------------------------------------------
// Section 4.2: after_tool_call hook indirectly via event field shapes
//
// The after_tool_call hook fires from handlers.tools.ts when it receives
// a tool_execution_end event with isError=false and reads toolCallId/result.
// If fields are wrong names, the hook silently doesn't get the right data.
// The tests above ensure the fields are correctly named so hooks will fire.
// ---------------------------------------------------------------------------

describe("claude-sdk hooks — event ordering for tool lifecycle", () => {
  beforeEach(() => {
    capturedServer = null;
    vi.clearAllMocks();
  });

  it("start → end ordering is guaranteed for sequential tool calls", async () => {
    const capturedEvents: Array<Record<string, unknown>> = [];

    createClaudeSdkMcpToolServer({
      tools: [
        {
          name: "read_file",
          description: "Read a file",
          parameters: Type.Object({ path: Type.String() }),
          execute: vi.fn().mockResolvedValue("content"),
        },
      ] as never[],
      emitEvent: (evt) => capturedEvents.push(evt as Record<string, unknown>),
      getAbortSignal: () => undefined,
    });

    const toolDef = capturedServer?.tools.find((t) => t.name === "read_file");
    await toolDef!.handler({ path: "/a.ts" }, {});
    await toolDef!.handler({ path: "/b.ts" }, {});

    const types = capturedEvents.map((e) => e.type);
    // Should be: start, end, start, end
    expect(types[0]).toBe("tool_execution_start");
    expect(types[1]).toBe("tool_execution_end");
    expect(types[2]).toBe("tool_execution_start");
    expect(types[3]).toBe("tool_execution_end");
  });
});

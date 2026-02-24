import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";
import { toToolDefinitions } from "./pi-tool-definition-adapter.js";

type ToolExecute = ReturnType<typeof toToolDefinitions>[number]["execute"];
const extensionContext = {} as Parameters<ToolExecute>[4];

async function executeThrowingTool(name: string, callId: string) {
  const tool = {
    name,
    label: name === "bash" ? "Bash" : "Boom",
    description: "throws",
    parameters: Type.Object({}),
    execute: async () => {
      throw new Error("nope");
    },
  } satisfies AgentTool;

  const defs = toToolDefinitions([tool]);
  const def = defs[0];
  if (!def) {
    throw new Error("missing tool definition");
  }
  return await def.execute(callId, {}, undefined, undefined, extensionContext);
}

describe("pi tool definition adapter", () => {
  it("wraps tool errors into a tool result", async () => {
    const result = await executeThrowingTool("boom", "call1");

    expect(result.details).toMatchObject({
      status: "error",
      tool: "boom",
    });
    expect(result.details).toMatchObject({ error: "nope" });
    expect(JSON.stringify(result.details)).not.toContain("\n    at ");
  });

  it("normalizes exec tool aliases in error results", async () => {
    const result = await executeThrowingTool("bash", "call2");

    expect(result.details).toMatchObject({
      status: "error",
      tool: "exec",
      error: "nope",
    });
  });

  it("repairs malformed JSON arguments for non-anthropic providers", async () => {
    let capturedArgs: unknown;
    const tool = {
      name: "read",
      label: "Read",
      description: "reads",
      parameters: Type.Object(
        {
          path: Type.String(),
          limit: Type.Optional(Type.Number()),
        },
        { additionalProperties: false },
      ),
      execute: async (_id: string, args: unknown) => {
        capturedArgs = args;
        return {
          content: [{ type: "text", text: "ok" }] as const,
          details: args,
        };
      },
    } satisfies AgentTool;

    const defs = toToolDefinitions([tool], {
      provider: "openai",
      model: "gpt-4.1",
    });

    const result = await defs[0].execute(
      "call-1",
      '{"paht":"/tmp/file.txt", "limit":"3"}',
      undefined,
      undefined,
      extensionContext,
    );

    expect(capturedArgs).toMatchObject({
      path: "/tmp/file.txt",
      limit: 3,
    });
    expect(result).toMatchObject({
      content: [{ type: "text", text: "ok" }],
    });
  });

  it("skips validation/repair for Anthropic provider", async () => {
    let capturedArgs: unknown;
    const tool = {
      name: "read",
      label: "Read",
      description: "reads",
      parameters: Type.Object(
        {
          path: Type.String(),
        },
        { additionalProperties: false },
      ),
      execute: async (_id: string, args: unknown) => {
        capturedArgs = args;
        return {
          content: [{ type: "text", text: "ok" }] as const,
          details: { received: args },
        };
      },
    } satisfies AgentTool;

    const defs = toToolDefinitions([tool], {
      provider: "anthropic",
      model: "claude-4-opus",
    });

    const malformed = '{"paht":"/tmp/file.txt"';
    const result = await defs[0].execute(
      "call-2",
      malformed,
      undefined,
      undefined,
      extensionContext,
    );

    expect(capturedArgs).toBe(malformed);
    expect(result.content).toEqual([{ type: "text", text: "ok" }]);
  });

  it("deduplicates duplicate tool call ids", async () => {
    const ids: string[] = [];
    const tool = {
      name: "noop",
      label: "Noop",
      description: "noop",
      parameters: Type.Object({}, { additionalProperties: false }),
      execute: async (id: string) => {
        ids.push(id);
        return {
          content: [{ type: "text", text: "ok" }] as const,
          details: { id },
        };
      },
    } satisfies AgentTool;

    const defs = toToolDefinitions([tool], { provider: "openai" });

    await defs[0].execute("same-id", {}, undefined, undefined, extensionContext);
    await defs[0].execute("same-id", {}, undefined, undefined, extensionContext);

    expect(ids).toEqual(["sameid", "sameid_2"]);
  });
});

import type { StreamFn } from "@mariozechner/pi-agent-core";
import type { Context, Model, SimpleStreamOptions } from "@mariozechner/pi-ai";
import { describe, expect, it, vi } from "vitest";
import { applyExtraParamsToAgent } from "./extra-params.js";

// Mock streamSimple for testing
vi.mock("@mariozechner/pi-ai", () => ({
  streamSimple: vi.fn(() => ({
    push: vi.fn(),
    result: vi.fn(),
  })),
}));

type CodexToolChoiceCase = {
  applyProvider: string;
  applyModelId: string;
  model: Model<"openai-codex-responses">;
  cfg?: Parameters<typeof applyExtraParamsToAgent>[1];
  options?: SimpleStreamOptions;
};

function runCodexToolChoiceCase(params: CodexToolChoiceCase) {
  const payload: Record<string, unknown> = {
    model: params.model.id,
    messages: [],
    tool_choice: "auto", // This is what the pi-ai provider hardcodes
  };
  const baseStreamFn: StreamFn = (_model, _context, options) => {
    options?.onPayload?.(payload);
    return {} as ReturnType<StreamFn>;
  };
  const agent = { streamFn: baseStreamFn };

  applyExtraParamsToAgent(agent, params.cfg, params.applyProvider, params.applyModelId);

  const context: Context = { messages: [] };
  void agent.streamFn?.(params.model, context, params.options ?? {});

  return payload;
}

describe("extra-params: Codex tool_choice support", () => {
  it("forwards tool_choice from options to payload for openai-codex provider", () => {
    const payload = runCodexToolChoiceCase({
      applyProvider: "openai-codex",
      applyModelId: "gpt-5.1-codex",
      model: {
        api: "openai-codex-responses",
        provider: "openai-codex",
        id: "gpt-5.1-codex",
      } as Model<"openai-codex-responses">,
      options: {
        toolChoice: "required",
      },
    });

    // The wrapper should override the hardcoded "auto" with "required"
    expect(payload.tool_choice).toBe("required");
  });

  it("does not override tool_choice when not provided in options", () => {
    const payload = runCodexToolChoiceCase({
      applyProvider: "openai-codex",
      applyModelId: "gpt-5.1-codex",
      model: {
        api: "openai-codex-responses",
        provider: "openai-codex",
        id: "gpt-5.1-codex",
      } as Model<"openai-codex-responses">,
      options: {}, // No toolChoice provided
    });

    // Should remain as "auto" (the hardcoded value from the provider)
    expect(payload.tool_choice).toBe("auto");
  });

  it("does not apply tool_choice wrapper for non-codex providers", () => {
    const payload = runCodexToolChoiceCase({
      applyProvider: "openai",
      applyModelId: "gpt-4.1",
      model: {
        api: "openai-responses",
        provider: "openai",
        id: "gpt-4.1",
      } as unknown as Model<"openai-codex-responses">,
      options: {
        toolChoice: "required",
      },
    });

    // The openai provider should NOT have the wrapper, so tool_choice stays "auto"
    // (this test verifies the wrapper is only applied to openai-codex)
    expect(payload.tool_choice).toBe("auto");
  });

  it("supports tool_choice as object with function name", () => {
    const payload = runCodexToolChoiceCase({
      applyProvider: "openai-codex",
      applyModelId: "gpt-5.1-codex",
      model: {
        api: "openai-codex-responses",
        provider: "openai-codex",
        id: "gpt-5.1-codex",
      } as Model<"openai-codex-responses">,
      options: {
        toolChoice: { type: "function", function: { name: "my_tool" } },
      },
    });

    expect(payload.tool_choice).toEqual({ type: "function", function: { name: "my_tool" } });
  });
});

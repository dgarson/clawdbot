import type { Api, Model } from "@mariozechner/pi-ai";

const DEFAULT_CONTEXT_WINDOW = 200_000;

/**
 * Creates a stub Model<Api> for the claude-max provider.
 * The Claude SDK subprocess handles actual model resolution;
 * this stub carries the model ID and context window through the pipeline.
 */
export function createClaudeMaxStubModel(modelId: string): Model<Api> {
  return {
    provider: "claude-max",
    id: modelId,
    name: modelId,
    // Use "anthropic" as the API sentinel — the Claude SDK subprocess owns transport.
    api: "anthropic" as Api,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_CONTEXT_WINDOW,
    baseUrl: "",
    reasoning: true,
    input: ["text", "image"],
    // Costs are zero: Claude SDK tracks usage server-side; the stub model is a pipeline placeholder.
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  };
}

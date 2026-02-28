import { estimateTokens } from "../../src/agents/claude-sdk-runner/context/budget.js";

export const SCRATCHPAD_ENTRY_KEY = "openclaw:scratchpad";

export type ScratchpadState = {
  scratchpad?: string;
  appendCustomEntry: (key: string, value: unknown) => void;
};

export type ScratchpadToolOptions = {
  state: ScratchpadState;
  maxTokens?: number;
};

export function buildScratchpadTool(opts: ScratchpadToolOptions) {
  const { state, maxTokens = 2000 } = opts;

  return {
    name: "session.scratchpad",
    description:
      "Persist important working state (plans, findings, decisions) that survives context compaction. Content is prepended to each message you receive. Use mode 'replace' to overwrite or 'append' to add.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "The scratchpad content to save" },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description:
            "replace: overwrite entire scratchpad. append: add to existing. Default: replace.",
        },
      },
      required: ["content"],
    },

    execute(_id: string, params: Record<string, unknown>): string {
      const content = typeof params.content === "string" ? params.content : "";
      const mode = params.mode === "append" ? "append" : "replace";

      let updated: string;
      let warning = "";

      if (mode === "replace") {
        const tokens = estimateTokens(content);
        if (tokens > maxTokens) {
          // Truncate to budget
          updated = content.slice(0, maxTokens * 4);
          warning = ` (truncated from ${tokens} to ${maxTokens} tokens)`;
        } else {
          updated = content;
        }
        state.scratchpad = updated;
      } else {
        // append mode
        const existing = state.scratchpad ?? "";
        const combined = existing ? `${existing}\n${content}` : content;
        const tokens = estimateTokens(combined);
        if (tokens > maxTokens) {
          return `Scratchpad append rejected: combined content would be ${tokens} tokens (budget: ${maxTokens}). Scratchpad unchanged.`;
        }
        state.scratchpad = combined;
        updated = combined;
      }

      try {
        state.appendCustomEntry(SCRATCHPAD_ENTRY_KEY, state.scratchpad);
      } catch {
        // non-fatal
      }

      const savedTokens = estimateTokens(state.scratchpad ?? "");
      return `Scratchpad saved (${mode}): ${savedTokens} tokens used of ${maxTokens} budget.${warning}`;
    },
  };
}

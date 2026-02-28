export const SCRATCHPAD_ENTRY_KEY = "openclaw:scratchpad";

export type ScratchpadState = {
  scratchpad?: string;
  appendCustomEntry: (key: string, value: unknown) => void;
};

export type ScratchpadToolOptions = {
  state: ScratchpadState;
  maxChars?: number;
};

export function buildScratchpadTool(opts: ScratchpadToolOptions) {
  const { state, maxChars = 8000 } = opts;

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
        const chars = content.length;
        if (chars > maxChars) {
          // Truncate to budget
          updated = content.slice(0, maxChars);
          warning = ` (truncated from ${chars} to ${maxChars} characters)`;
        } else {
          updated = content;
        }
        state.scratchpad = updated;
      } else {
        // append mode
        const existing = state.scratchpad ?? "";
        const combined = existing ? `${existing}\n${content}` : content;
        const chars = combined.length;
        if (chars > maxChars) {
          return `Scratchpad append rejected: combined content would be ${chars} characters (budget: ${maxChars}). Scratchpad unchanged.`;
        }
        state.scratchpad = combined;
        updated = combined;
      }

      try {
        state.appendCustomEntry(SCRATCHPAD_ENTRY_KEY, state.scratchpad);
      } catch {
        // non-fatal
      }

      const savedChars = (state.scratchpad ?? "").length;
      return `Scratchpad saved (${mode}): ${savedChars} characters used of ${maxChars} budget.${warning}`;
    },
  };
}

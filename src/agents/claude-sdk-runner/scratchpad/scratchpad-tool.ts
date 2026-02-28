// Backwards-compat key kept for loading old sessions.
export const SCRATCHPAD_ENTRY_KEY = "openclaw:scratchpad";

// Separate persistence keys — each space is written independently.
export const SCRATCHPAD_NOTES_KEY = "openclaw:scratchpad:notes";
export const SCRATCHPAD_PLAN_KEY = "openclaw:scratchpad:plan";
export const SCRATCHPAD_REFS_KEY = "openclaw:scratchpad:refs";

export type ScratchpadState = {
  notes?: string;
  plan?: string;
  refs: string[];
  appendCustomEntry: (key: string, value: unknown) => void;
};

export type ScratchpadToolOptions = {
  state: ScratchpadState;
  /** Max chars for notes space (default: 4000) */
  maxNotes?: number;
  /** Max chars for plan space (default: 2000) */
  maxPlan?: number;
  /** Max item count for refs space (default: 50) */
  maxRefs?: number;
};

// Persist a single space; non-fatal on failure.
function persist(state: ScratchpadState, key: string, value: unknown): void {
  try {
    state.appendCustomEntry(key, value);
  } catch {
    // non-fatal
  }
}

export function buildScratchpadTool(opts: ScratchpadToolOptions) {
  const { state, maxNotes = 4000, maxPlan = 2000, maxRefs = 50 } = opts;

  return {
    name: "session.scratchpad",
    description:
      "Persist working state across context compaction using three separate spaces: notes (findings/decisions), plan (ordered steps), refs (file paths, URLs, identifiers). Content is prepended to every message you receive.",
    parameters: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["set_notes", "append_notes", "set_plan", "refs.add", "refs.remove", "refs.set"],
          description:
            "set_notes: replace notes. append_notes: add to notes. set_plan: replace plan. refs.add: add one ref. refs.remove: remove one ref. refs.set: replace all refs.",
        },
        content: {
          type: "string",
          description: "Used by set_notes, append_notes, set_plan.",
        },
        ref: {
          type: "string",
          description: "Used by refs.add and refs.remove.",
        },
        items: {
          type: "array",
          items: { type: "string" },
          description: "Used by refs.set to replace all refs.",
        },
      },
      required: ["action"],
    },

    execute(_id: string, params: Record<string, unknown>): string {
      const action = typeof params.action === "string" ? params.action : "";

      switch (action) {
        case "set_notes": {
          const raw = typeof params.content === "string" ? params.content : "";
          let warning = "";
          let saved = raw;
          if (raw.length > maxNotes) {
            saved = raw.slice(0, maxNotes);
            warning = ` (truncated from ${raw.length} to ${maxNotes} chars)`;
          }
          state.notes = saved;
          persist(state, SCRATCHPAD_NOTES_KEY, saved);
          return `notes set: ${saved.length}/${maxNotes} chars used.${warning}`;
        }

        case "append_notes": {
          const raw = typeof params.content === "string" ? params.content : "";
          const existing = state.notes ?? "";
          const combined = existing ? `${existing}\n${raw}` : raw;
          if (combined.length > maxNotes) {
            return `append_notes rejected: combined would be ${combined.length} chars (budget: ${maxNotes}). Use set_notes to overwrite with a summary.`;
          }
          state.notes = combined;
          persist(state, SCRATCHPAD_NOTES_KEY, combined);
          return `notes appended: ${combined.length}/${maxNotes} chars used.`;
        }

        case "set_plan": {
          const raw = typeof params.content === "string" ? params.content : "";
          let warning = "";
          let saved = raw;
          if (raw.length > maxPlan) {
            saved = raw.slice(0, maxPlan);
            warning = ` (truncated from ${raw.length} to ${maxPlan} chars)`;
          }
          state.plan = saved;
          persist(state, SCRATCHPAD_PLAN_KEY, saved);
          return `plan set: ${saved.length}/${maxPlan} chars used.${warning}`;
        }

        case "refs.add": {
          const ref = typeof params.ref === "string" ? params.ref : "";
          if (!ref) {
            return "refs.add: ref must be a non-empty string.";
          }
          // Drop oldest item when at capacity — atomic, never splits a value.
          if (state.refs.length >= maxRefs) {
            state.refs.shift();
          }
          state.refs.push(ref);
          persist(state, SCRATCHPAD_REFS_KEY, state.refs);
          return `refs.add: added "${ref}". ${state.refs.length}/${maxRefs} refs used.`;
        }

        case "refs.remove": {
          const ref = typeof params.ref === "string" ? params.ref : "";
          if (!ref) {
            return "refs.remove: ref must be a non-empty string.";
          }
          const idx = state.refs.indexOf(ref);
          if (idx === -1) {
            return `refs.remove: "${ref}" not found.`;
          }
          state.refs.splice(idx, 1);
          persist(state, SCRATCHPAD_REFS_KEY, state.refs);
          return `refs.remove: removed "${ref}". ${state.refs.length}/${maxRefs} refs used.`;
        }

        case "refs.set": {
          const raw = Array.isArray(params.items)
            ? (params.items as unknown[]).filter((x): x is string => typeof x === "string")
            : [];
          // Silently cap to maxRefs — keep the first N entries if caller overshoots.
          const capped = raw.slice(0, maxRefs);
          state.refs = capped;
          persist(state, SCRATCHPAD_REFS_KEY, capped);
          return `refs.set: ${capped.length}/${maxRefs} refs stored.`;
        }

        default:
          return `Unknown action "${action}". Valid actions: set_notes, append_notes, set_plan, refs.add, refs.remove, refs.set.`;
      }
    },
  };
}

import { z } from "zod";

export const DelegationRequestSchema = z.object({
  specialist: z.enum(["research", "scheduler", "policy"]).default("research"),
  goal: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  deadline_ms: z.number().int().positive().optional(),
});

export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;

export type SpecialistType = DelegationRequest["specialist"];

export const ForegroundEnvelopeSchema = z.object({
  action: z.enum(["respond_now", "delegate"]).default("respond_now"),
  immediate_text: z.string().min(1).default("One moment while I check that."),
  delegations: z.array(DelegationRequestSchema).default([]),
});

export type ForegroundEnvelope = z.infer<typeof ForegroundEnvelopeSchema>;

export const SubagentResultSchema = z.object({
  summary: z.string().min(1),
  confidence: z.number().min(0).max(1).default(0.5),
  needs_followup: z.boolean().default(false),
  followup_question: z.string().nullable().default(null),
  artifacts: z.array(z.unknown()).default([]),
});

export type SubagentResult = z.infer<typeof SubagentResultSchema>;

const FOREGROUND_ALIASES: Record<string, string[]> = {
  action: ["action", "mode", "type"],
  immediate_text: ["immediate_text", "immediateText", "response", "text", "message"],
  delegations: ["delegations", "tasks", "jobs"],
};

const SUBAGENT_ALIASES: Record<keyof SubagentResult, string[]> = {
  summary: ["summary", "result", "answer", "spoken_summary", "spokenSummary", "response", "output"],
  confidence: ["confidence", "score", "certainty", "conf"],
  needs_followup: [
    "needs_followup",
    "needsFollowup",
    "follow_up_required",
    "followUpRequired",
    "needs_follow_up",
    "requiresFollowup",
  ],
  followup_question: [
    "followup_question",
    "followupQuestion",
    "question",
    "follow_up_question",
    "followUpQuestion",
    "next_question",
  ],
  artifacts: ["artifacts", "sources", "tool_artifacts", "attachments", "data", "results"],
};

/**
 * Specialist-specific prompt fragments. Returned as the system-level instruction
 * block so the sub-agent understands its role and constraints.
 */
export const SPECIALIST_PROMPTS: Record<SpecialistType, string> = {
  research: [
    "You are a research specialist. Your task is to investigate, gather information,",
    "search memory, and synthesize findings into a concise spoken summary.",
    "Focus on accuracy and cite key facts. If information is uncertain, say so.",
  ].join(" "),
  scheduler: [
    "You are a scheduling specialist. Your task is to handle calendar lookups,",
    "time-based queries, reminders, and availability checks.",
    "Be precise with dates, times, and time zones. Summarize the result clearly.",
  ].join(" "),
  policy: [
    "You are a policy specialist. Your task is to check rules, compliance,",
    "permissions, and guidelines relevant to the caller's question.",
    "Be definitive where possible and flag ambiguities.",
  ].join(" "),
};

// ---------------------------------------------------------------------------
// JSON extraction helpers
// ---------------------------------------------------------------------------

/**
 * Strip markdown code fences (```json ... ``` or ``` ... ```) from LLM output.
 */
function stripMarkdownFences(raw: string): string {
  const trimmed = raw.trim();
  // Match ```json\n...\n``` or ```\n...\n```
  const fenceMatch = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  if (fenceMatch?.[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

/**
 * Remove trailing commas before } or ] which are common LLM JSON errors.
 *
 * Unlike a naive regex, this walks character-by-character so commas inside
 * JSON string literals are never touched.  It handles escaped characters
 * (e.g. `\"`) inside strings correctly.
 */
function stripTrailingCommas(raw: string): string {
  const out: string[] = [];
  let inString = false;
  let i = 0;

  while (i < raw.length) {
    const ch = raw[i];

    // Inside a JSON string literal — emit characters verbatim and respect
    // backslash escapes so that `\"` does not close the string.
    if (inString) {
      out.push(ch);
      if (ch === "\\") {
        // Emit the escaped character as-is and skip past it.
        i += 1;
        if (i < raw.length) {
          out.push(raw[i]);
        }
      } else if (ch === '"') {
        inString = false;
      }
      i += 1;
      continue;
    }

    // Outside strings.
    if (ch === '"') {
      inString = true;
      out.push(ch);
      i += 1;
      continue;
    }

    // When we hit a comma, look ahead past any whitespace.  If the next
    // non-whitespace character is `}` or `]`, this is a trailing comma —
    // drop it (but keep the whitespace that follows, if any).
    if (ch === ",") {
      let j = i + 1;
      while (
        j < raw.length &&
        (raw[j] === " " || raw[j] === "\t" || raw[j] === "\n" || raw[j] === "\r")
      ) {
        j += 1;
      }
      if (j < raw.length && (raw[j] === "}" || raw[j] === "]")) {
        // Skip the trailing comma; don't push it.
        i += 1;
        continue;
      }
    }

    out.push(ch);
    i += 1;
  }

  return out.join("");
}

/**
 * Remove single-line // comments from JSON-like strings.
 *
 * Like `stripTrailingCommas`, this is string-aware: `//` sequences inside
 * JSON string values are left untouched.
 */
function stripJsonComments(raw: string): string {
  const lines = raw.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    let inString = false;
    let commentStart = -1;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inString) {
        if (ch === "\\") {
          i += 1; // skip escaped char
        } else if (ch === '"') {
          inString = false;
        }
        continue;
      }
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === "/" && i + 1 < line.length && line[i + 1] === "/") {
        commentStart = i;
        break;
      }
    }

    if (commentStart !== -1) {
      const before = line.slice(0, commentStart).trimEnd();
      if (before) {
        result.push(before);
      }
      // Drop comment-only lines entirely.
    } else {
      result.push(line);
    }
  }

  return result.join("\n");
}

/**
 * Attempt to extract a JSON object from raw text using multiple strategies:
 * 1. Direct parse of full text
 * 2. Strip markdown fences, then parse
 * 3. Find first { ... } substring, then parse
 * 4. Repair common issues (trailing commas, comments), then parse
 */
export function extractFirstJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strategy 1: direct parse
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }

  // Strategy 2: strip markdown fences
  const unfenced = stripMarkdownFences(trimmed);
  if (unfenced !== trimmed) {
    try {
      const parsed = JSON.parse(unfenced);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      // fall through
    }
  }

  // Strategy 3: extract first { ... } substring
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start !== -1 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      return JSON.parse(candidate);
    } catch {
      // Strategy 4: repair trailing commas and comments, then retry
      const repaired = stripTrailingCommas(stripJsonComments(candidate));
      try {
        return JSON.parse(repaired);
      } catch {
        // fall through
      }
    }
  }

  return null;
}

function pickAlias<T extends string>(input: Record<string, unknown>, aliases: T[]): unknown {
  for (const key of aliases) {
    if (key in input) {
      return input[key];
    }
  }
  // Case-insensitive fallback: check lowercased keys
  const lowerMap = new Map<string, unknown>();
  for (const [k, v] of Object.entries(input)) {
    lowerMap.set(k.toLowerCase(), v);
  }
  for (const key of aliases) {
    const val = lowerMap.get(key.toLowerCase());
    if (val !== undefined) return val;
  }
  return undefined;
}

export function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const lower = value.toLowerCase().trim();
    if (["true", "yes", "y", "1"].includes(lower)) return true;
    if (["false", "no", "n", "0"].includes(lower)) return false;
  }
  return undefined;
}

export function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

export function normalizeForegroundEnvelope(raw: string): ForegroundEnvelope {
  const parsed = extractFirstJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return { action: "respond_now", immediate_text: raw.trim(), delegations: [] };
  }

  const src = parsed as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    action: pickAlias(src, FOREGROUND_ALIASES.action),
    immediate_text: pickAlias(src, FOREGROUND_ALIASES.immediate_text),
    delegations: pickAlias(src, FOREGROUND_ALIASES.delegations),
  };

  const result = ForegroundEnvelopeSchema.safeParse(normalized);
  if (result.success) return result.data;

  const fallback =
    typeof normalized.immediate_text === "string" ? normalized.immediate_text : raw.trim();
  return {
    action: "respond_now",
    immediate_text: fallback || "One moment while I check that.",
    delegations: [],
  };
}

export function normalizeSubagentResult(raw: string): SubagentResult | null {
  const parsed = extractFirstJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return null;
  }

  const src = parsed as Record<string, unknown>;
  const normalized: Record<string, unknown> = {
    summary: pickAlias(src, SUBAGENT_ALIASES.summary),
    confidence: parseNumber(pickAlias(src, SUBAGENT_ALIASES.confidence)),
    needs_followup: parseBoolean(pickAlias(src, SUBAGENT_ALIASES.needs_followup)),
    followup_question: pickAlias(src, SUBAGENT_ALIASES.followup_question),
    artifacts: pickAlias(src, SUBAGENT_ALIASES.artifacts),
  };

  const result = SubagentResultSchema.safeParse(normalized);
  return result.success ? result.data : null;
}

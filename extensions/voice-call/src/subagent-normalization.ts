import { z } from "zod";

export const DelegationRequestSchema = z.object({
  specialist: z.enum(["research", "scheduler", "policy"]).default("research"),
  goal: z.string().min(1),
  input: z.record(z.string(), z.unknown()).optional(),
  deadline_ms: z.number().int().positive().optional(),
});

export type DelegationRequest = z.infer<typeof DelegationRequestSchema>;

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
  summary: ["summary", "result", "answer", "spoken_summary"],
  confidence: ["confidence", "score", "certainty"],
  needs_followup: ["needs_followup", "needsFollowup", "follow_up_required"],
  followup_question: ["followup_question", "followupQuestion", "question"],
  artifacts: ["artifacts", "sources", "tool_artifacts", "attachments"],
};

function extractFirstJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // fall through
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }

  const candidate = trimmed.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function pickAlias<T extends string>(input: Record<string, unknown>, aliases: T[]): unknown {
  for (const key of aliases) {
    if (key in input) {
      return input[key];
    }
  }
  return undefined;
}

function parseBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    if (["true", "yes", "y", "1"].includes(lower)) return true;
    if (["false", "no", "n", "0"].includes(lower)) return false;
  }
  return undefined;
}

function parseNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
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

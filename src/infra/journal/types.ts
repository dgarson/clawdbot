export type ToolJournalEntry = {
  ts: string;
  phase: "start" | "update" | "result";
  runId: string;
  seq: number;
  sessionKey?: string;
  toolName: string;
  toolCallId: string;
  args?: unknown;
  result?: unknown;
  partialResult?: unknown;
  isError?: boolean;
  meta?: string;
  durationMs?: number;
};

/** Default tool filter: runtime + mutation tools */
export const DEFAULT_JOURNAL_TOOLS = ["exec", "process", "edit", "write", "apply_patch"];

export type JournalConfig = {
  enabled?: boolean;
  file?: string;
  maxResultChars?: number;
  redactSensitive?: boolean;
  toolFilter?: string[];
  retentionHours?: number;
};

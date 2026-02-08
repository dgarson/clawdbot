import { truncateUtf16Safe } from "../utils.js";

export const SESSION_LABEL_MAX_LENGTH = 96;

export type ParsedSessionLabel = { ok: true; label: string } | { ok: false; error: string };

export function parseSessionLabel(raw: unknown): ParsedSessionLabel {
  if (typeof raw !== "string") {
    return { ok: false, error: "invalid label: must be a string" };
  }
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, error: "invalid label: empty" };
  }
  if (trimmed.length > SESSION_LABEL_MAX_LENGTH) {
    return {
      ok: false,
      error: `invalid label: too long (max ${SESSION_LABEL_MAX_LENGTH})`,
    };
  }
  return { ok: true, label: trimmed };
}

export function truncateSessionLabel(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  if (trimmed.length <= SESSION_LABEL_MAX_LENGTH) {
    return trimmed;
  }
  const maxLen = Math.max(1, SESSION_LABEL_MAX_LENGTH - 1);
  return `${truncateUtf16Safe(trimmed, maxLen).trimEnd()}…`;
}

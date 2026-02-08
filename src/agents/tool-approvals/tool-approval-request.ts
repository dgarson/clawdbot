// ---------------------------------------------------------------------------
// Param summary + redaction for approval request payloads
// ---------------------------------------------------------------------------

const MAX_SUMMARY_CHARS = 1000;

/** Keys whose values should be redacted in approval request summaries. */
const REDACT_KEY_PATTERNS = [
  /token/i,
  /password/i,
  /secret/i,
  /api[_-]?key/i,
  /auth/i,
  /cookie/i,
  /credential/i,
  /private[_-]?key/i,
  /access[_-]?key/i,
  /session[_-]?id/i,
  /bearer/i,
];

const REDACTED_VALUE = "[REDACTED]";

function shouldRedactKey(key: string): boolean {
  return REDACT_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

/**
 * Recursively redact sensitive values from params.
 * Returns a new value with sensitive fields replaced.
 */
function redactSensitiveValues(value: unknown, depth = 0): unknown {
  if (depth > 5) {
    return Array.isArray(value) ? ["..."] : { "...": "max depth" };
  }

  if (Array.isArray(value)) {
    return value.map((item) => redactSensitiveValues(item, depth + 1));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const result: Record<string, unknown> = {};
  // Sort keys for deterministic output
  const keys = Object.keys(value).toSorted();
  for (const key of keys) {
    const nextValue = (value as Record<string, unknown>)[key];
    if (shouldRedactKey(key)) {
      result[key] = REDACTED_VALUE;
    } else {
      result[key] = redactSensitiveValues(nextValue, depth + 1);
    }
  }
  return result;
}

/**
 * Create a bounded, redacted, deterministic summary of tool params
 * suitable for inclusion in approval request payloads.
 */
export function summarizeToolParams(
  params: Record<string, unknown>,
  maxChars = MAX_SUMMARY_CHARS,
): string {
  const redacted = redactSensitiveValues(params);
  // Use stable key ordering (already sorted in redactSensitiveValues)
  let json = JSON.stringify(redacted);
  if (json.length > maxChars) {
    json = json.slice(0, maxChars - 3) + "...";
  }
  return json;
}

export const __testing = {
  shouldRedactKey,
  redactSensitiveValues,
};

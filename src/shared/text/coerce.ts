export function toPrimitiveString(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value.toString();
  }
  return undefined;
}

export function toPrimitiveStringOr(value: unknown, fallback: string): string {
  return toPrimitiveString(value) ?? fallback;
}

export function toStringIfString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function toNonEmptyTrimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toErrorMessage(value: unknown): string | undefined {
  if (value instanceof Error) {
    return value.message;
  }
  return toPrimitiveString(value);
}

export function formatUnknownError(value: unknown): string {
  const message = toErrorMessage(value);
  if (message !== undefined) {
    return message;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

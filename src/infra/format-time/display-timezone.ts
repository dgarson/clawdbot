import { formatUtcTimestamp, formatZonedTimestamp, resolveTimezone } from "./format-datetime.js";

export type DisplayTimezone =
  | { mode: "utc" }
  | { mode: "local" }
  | { mode: "iana"; timeZone: string };

export function resolveDisplayTimezone(
  value?: string | null,
  fallback: "local" | "utc" = "local",
): DisplayTimezone {
  const trimmed = value?.trim();
  if (!trimmed) {
    return { mode: fallback };
  }
  const lowered = trimmed.toLowerCase();
  if (lowered === "utc" || lowered === "gmt") {
    return { mode: "utc" };
  }
  if (lowered === "local" || lowered === "host") {
    return { mode: "local" };
  }
  const explicit = resolveTimezone(trimmed);
  if (explicit) {
    return { mode: "iana", timeZone: explicit };
  }
  return { mode: fallback };
}

export function formatDisplayTimestamp(
  date: Date | number,
  zone: DisplayTimezone,
  options?: { displaySeconds?: boolean },
): string | undefined {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }
  if (zone.mode === "utc") {
    return formatUtcTimestamp(value, { displaySeconds: options?.displaySeconds });
  }
  if (zone.mode === "local") {
    return formatZonedTimestamp(value, { displaySeconds: options?.displaySeconds });
  }
  return formatZonedTimestamp(value, {
    timeZone: zone.timeZone,
    displaySeconds: options?.displaySeconds,
  });
}

export function formatDisplayClockTime(
  date: Date | number,
  zone: DisplayTimezone,
  options?: { displaySeconds?: boolean },
): string | undefined {
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) {
    return undefined;
  }
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      ...(zone.mode === "utc"
        ? { timeZone: "UTC" }
        : zone.mode === "iana"
          ? { timeZone: zone.timeZone }
          : {}),
      hour: "2-digit",
      minute: "2-digit",
      ...(options?.displaySeconds ? { second: "2-digit" } : {}),
      hourCycle: "h23",
    }).formatToParts(value);
    const pick = (type: string) => parts.find((part) => part.type === type)?.value;
    const hh = pick("hour");
    const mm = pick("minute");
    const ss = options?.displaySeconds ? pick("second") : undefined;
    if (!hh || !mm) {
      return undefined;
    }
    if (options?.displaySeconds) {
      if (!ss) {
        return undefined;
      }
      return `${hh}:${mm}:${ss}`;
    }
    return `${hh}:${mm}`;
  } catch {
    return undefined;
  }
}

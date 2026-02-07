/**
 * Shared formatting utilities used across the agent dashboard,
 * activity timeline, and detail panels.
 *
 * Consolidates previously duplicated helpers into a single source of truth.
 */

/** Format a token count with human-readable suffix (e.g. 1.2k, 3.45M) */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1_000) return String(tokens);
  if (tokens < 1_000_000) return `${(tokens / 1_000).toFixed(1)}k`;
  return `${(tokens / 1_000_000).toFixed(2)}M`;
}

/** Format a timestamp as a relative time string (e.g. "Just now", "5m ago") */
export function formatRelativeTime(timestampMs: number | null): string {
  if (!timestampMs) return "\u2014";
  const delta = Date.now() - timestampMs;
  if (delta < 5_000) return "Just now";
  if (delta < 60_000) return `${Math.floor(delta / 1000)}s ago`;
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return `${Math.floor(delta / 86_400_000)}d ago`;
}

/** Format an ISO timestamp string as relative time */
export function formatRelativeTimeFromISO(timestamp: string, nowMs?: number): string {
  const date = new Date(timestamp);
  const now = nowMs ?? Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

/** Format a duration in ms to human-readable (e.g. "32s", "5m 12s", "2h 15m") */
export function formatDuration(ms: number): string {
  if (ms < 60_000) return `${Math.floor(ms / 1000)}s`;
  if (ms < 3_600_000) {
    const mins = Math.floor(ms / 60_000);
    const secs = Math.floor((ms % 60_000) / 1000);
    return `${mins}m ${String(secs).padStart(2, "0")}s`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  return `${hours}h ${mins}m`;
}

/** Format a cost in USD */
export function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

/** Format a cost with up to 4 decimal places using Intl */
export function formatCostPrecise(costUsd: number | undefined): string {
  if (costUsd === undefined) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(costUsd);
}

/** Shorten a session key by stripping the "agent:<id>:" prefix */
export function shortenSessionKey(key: string): string {
  const parts = key.split(":");
  if (parts.length > 2 && parts[0] === "agent") {
    return parts.slice(2).join(":");
  }
  return key;
}

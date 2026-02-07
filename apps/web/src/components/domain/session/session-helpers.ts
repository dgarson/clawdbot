import type { GatewaySessionRow } from "@/lib/api/sessions";

/**
 * Format relative time from timestamp.
 */
export function formatRelativeTime(timestamp?: number): string {
  if (!timestamp) {return "";}

  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) {return "Just now";}
  if (diffMins < 60) {return `${diffMins}m ago`;}
  if (diffHours < 24) {return `${diffHours}h ago`;}
  if (diffDays < 7) {return `${diffDays}d ago`;}
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get display label for a session.
 */
export function getSessionLabel(session: GatewaySessionRow): string {
  if (session.label) {return session.label;}
  if (session.derivedTitle) {return session.derivedTitle;}
  const parts = session.key.split(":");
  return parts[parts.length - 1] || "Session";
}

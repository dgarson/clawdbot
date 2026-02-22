/**
 * Security feature configuration
 *
 * Constants and configuration for the security feature module.
 */

/** LocalStorage key for session ID */
export const SECURITY_SESSION_KEY = "clawdbrain:security:sessionId";

/** LocalStorage key for session expiry */
export const SECURITY_SESSION_EXPIRY_KEY = "clawdbrain:security:sessionExpiry";

/** Default session duration (24 hours in ms) */
export const DEFAULT_SESSION_DURATION_MS = 24 * 60 * 60 * 1000;

/** Maximum failed unlock attempts before lockout */
export const MAX_UNLOCK_ATTEMPTS = 5;

/** Lockout duration after max attempts (5 minutes in ms) */
export const LOCKOUT_DURATION_MS = 5 * 60 * 1000;

/** Paths that should bypass unlock check */
export const UNLOCK_SKIP_PATHS = [
  "/unlock",
  "/onboarding",
  "/health",
  "/debug",
] as const;

/** Stale time for security state queries (30 seconds) */
export const SECURITY_STATE_STALE_TIME = 30 * 1000;

/** Stale time for unlock history queries (1 minute) */
export const UNLOCK_HISTORY_STALE_TIME = 60 * 1000;

/** Stale time for token list queries (30 seconds) */
export const TOKENS_STALE_TIME = 30 * 1000;

/** Stale time for audit log queries (30 seconds) */
export const AUDIT_LOG_STALE_TIME = 30 * 1000;

/** Number of recovery codes generated */
export const RECOVERY_CODE_COUNT = 8;

/** Length of recovery codes */
export const RECOVERY_CODE_LENGTH = 8;

/** Token prefix */
export const TOKEN_PREFIX = "clb_";

/** Token prefix display length */
export const TOKEN_PREFIX_DISPLAY_LENGTH = 8;

/** Maximum token expiry in days */
export const MAX_TOKEN_EXPIRY_DAYS = 365;

/** Audit log retention in days */
export const AUDIT_LOG_RETENTION_DAYS = 90;

/** Maximum audit events per query */
export const MAX_AUDIT_EVENTS_PER_QUERY = 1000;

/** Maximum unlock history entries stored */
export const MAX_UNLOCK_HISTORY_ENTRIES = 100;

/**
 * Check if a path should bypass unlock protection.
 */
export function shouldSkipUnlock(pathname: string): boolean {
  return UNLOCK_SKIP_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Get session from localStorage.
 */
export function getStoredSession(): { id: string; expiry: number } | null {
  if (typeof window === "undefined") {return null;}

  const id = localStorage.getItem(SECURITY_SESSION_KEY);
  const expiryStr = localStorage.getItem(SECURITY_SESSION_EXPIRY_KEY);

  if (!id || !expiryStr) {return null;}

  const expiry = parseInt(expiryStr, 10);
  if (isNaN(expiry)) {return null;}

  return { id, expiry };
}

/**
 * Store session in localStorage.
 */
export function storeSession(id: string, expiry: number): void {
  if (typeof window === "undefined") {return;}

  localStorage.setItem(SECURITY_SESSION_KEY, id);
  localStorage.setItem(SECURITY_SESSION_EXPIRY_KEY, expiry.toString());
}

/**
 * Clear session from localStorage.
 */
export function clearStoredSession(): void {
  if (typeof window === "undefined") {return;}

  localStorage.removeItem(SECURITY_SESSION_KEY);
  localStorage.removeItem(SECURITY_SESSION_EXPIRY_KEY);
}

/**
 * Check if stored session is still valid.
 */
export function isStoredSessionValid(): boolean {
  const session = getStoredSession();
  if (!session) {return false;}

  return session.expiry > Date.now();
}

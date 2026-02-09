/**
 * Device Auth Token Storage
 *
 * Stores and retrieves device authentication tokens by device ID and role.
 * Tokens are persisted in localStorage and used for automatic re-authentication.
 */

export interface DeviceAuthEntry {
  token: string;
  role: string;
  scopes: string[];
  updatedAtMs: number;
}

interface DeviceAuthStore {
  version: 1;
  deviceId: string;
  tokens: Record<string, DeviceAuthEntry>;
}

const STORAGE_KEY = "clawdbrain-device-auth-v1";
const SHARED_TOKEN_KEY = "clawdbrain-gateway-token";
const SHARED_PASSWORD_KEY = "clawdbrain-gateway-password";
const GATEWAY_URL_KEY = "clawdbrain-gateway-url";
const DEFAULT_GATEWAY_URL = "ws://127.0.0.1:18789";

function normalizeRole(role: string): string {
  return role.trim();
}

function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) {return [];}
  const out = new Set<string>();
  for (const scope of scopes) {
    const trimmed = scope.trim();
    if (trimmed) {out.add(trimmed);}
  }
  return [...out].toSorted();
}

function readStore(): DeviceAuthStore | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {return null;}
    const parsed = JSON.parse(raw) as DeviceAuthStore;
    if (!parsed || parsed.version !== 1) {return null;}
    if (!parsed.deviceId || typeof parsed.deviceId !== "string") {return null;}
    if (!parsed.tokens || typeof parsed.tokens !== "object") {return null;}
    return parsed;
  } catch {
    return null;
  }
}

function writeStore(store: DeviceAuthStore): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // best-effort
  }
}

/**
 * Loads a device auth token for the given device ID and role.
 * Returns null if no token is stored or if the device ID doesn't match.
 */
export function loadDeviceAuthToken(params: {
  deviceId: string;
  role: string;
}): DeviceAuthEntry | null {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) {return null;}
  const role = normalizeRole(params.role);
  const entry = store.tokens[role];
  if (!entry || typeof entry.token !== "string") {return null;}
  return entry;
}

/**
 * Stores a device auth token for the given device ID and role.
 * Returns the stored entry.
 */
export function storeDeviceAuthToken(params: {
  deviceId: string;
  role: string;
  token: string;
  scopes?: string[];
}): DeviceAuthEntry {
  const role = normalizeRole(params.role);
  const next: DeviceAuthStore = {
    version: 1,
    deviceId: params.deviceId,
    tokens: {},
  };
  const existing = readStore();
  if (existing && existing.deviceId === params.deviceId) {
    next.tokens = { ...existing.tokens };
  }
  const entry: DeviceAuthEntry = {
    token: params.token,
    role,
    scopes: normalizeScopes(params.scopes),
    updatedAtMs: Date.now(),
  };
  next.tokens[role] = entry;
  writeStore(next);
  return entry;
}

/**
 * Clears a device auth token for the given device ID and role.
 */
export function clearDeviceAuthToken(params: { deviceId: string; role: string }): void {
  const store = readStore();
  if (!store || store.deviceId !== params.deviceId) {return;}
  const role = normalizeRole(params.role);
  if (!store.tokens[role]) {return;}
  const next = { ...store, tokens: { ...store.tokens } };
  delete next.tokens[role];
  writeStore(next);
}

/**
 * Clears all device auth tokens.
 */
export function clearAllDeviceAuthTokens(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // best-effort
  }
}

// =====================================================================
// Shared Token Storage (user-entered tokens not tied to device identity)
// =====================================================================

/**
 * Loads the shared gateway token (user-entered, not device-specific).
 */
export function loadSharedGatewayToken(): string | null {
  try {
    return window.localStorage.getItem(SHARED_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores a shared gateway token.
 */
export function storeSharedGatewayToken(token: string): void {
  try {
    window.localStorage.setItem(SHARED_TOKEN_KEY, token);
  } catch {
    // best-effort
  }
}

/**
 * Clears the shared gateway token.
 */
export function clearSharedGatewayToken(): void {
  try {
    window.localStorage.removeItem(SHARED_TOKEN_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Loads the shared gateway password (user-entered, not device-specific).
 */
export function loadSharedGatewayPassword(): string | null {
  try {
    return window.localStorage.getItem(SHARED_PASSWORD_KEY);
  } catch {
    return null;
  }
}

/**
 * Stores a shared gateway password.
 */
export function storeSharedGatewayPassword(password: string): void {
  try {
    window.localStorage.setItem(SHARED_PASSWORD_KEY, password);
  } catch {
    // best-effort
  }
}

/**
 * Clears the shared gateway password.
 */
export function clearSharedGatewayPassword(): void {
  try {
    window.localStorage.removeItem(SHARED_PASSWORD_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Loads the configured gateway URL, falling back to localhost.
 */
export function loadStoredGatewayUrl(): string {
  try {
    const raw = window.localStorage.getItem(GATEWAY_URL_KEY)?.trim();
    return raw || DEFAULT_GATEWAY_URL;
  } catch {
    return DEFAULT_GATEWAY_URL;
  }
}

/**
 * Convert a stored gateway URL (ws/wss) into an HTTP base URL for REST endpoints.
 */
export function toGatewayHttpBaseUrl(gatewayUrl: string): string {
  if (!gatewayUrl) {
    return "";
  }
  try {
    const parsed = new URL(gatewayUrl);
    if (parsed.protocol === "wss:") {
      parsed.protocol = "https:";
    } else if (parsed.protocol === "ws:") {
      parsed.protocol = "http:";
    }
    parsed.pathname = "";
    parsed.search = "";
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return gatewayUrl.replace(/\/$/, "");
  }
}

/**
 * Stores the configured gateway URL.
 */
export function storeGatewayUrl(url: string): void {
  const normalized = url.trim();
  if (!normalized) {
    clearStoredGatewayUrl();
    return;
  }
  try {
    window.localStorage.setItem(GATEWAY_URL_KEY, normalized);
  } catch {
    // best-effort
  }
}

/**
 * Clears the configured gateway URL.
 */
export function clearStoredGatewayUrl(): void {
  try {
    window.localStorage.removeItem(GATEWAY_URL_KEY);
  } catch {
    // best-effort
  }
}

/**
 * Load persisted gateway connection settings.
 */
export function loadStoredGatewayConnectionSettings(): {
  gatewayUrl: string;
  token?: string;
  password?: string;
} {
  return {
    gatewayUrl: loadStoredGatewayUrl(),
    token: loadSharedGatewayToken() ?? undefined,
    password: loadSharedGatewayPassword() ?? undefined,
  };
}

/**
 * Persist gateway URL/auth from query params and remove sensitive values from the URL.
 * Supported params: token, password, gatewayUrl
 */
export function persistGatewayConnectionFromUrl(): {
  hadUrlCredentials: boolean;
  gatewayUrl: string;
  token?: string;
  password?: string;
} {
  if (typeof window === "undefined") {
    return {
      hadUrlCredentials: false,
      ...loadStoredGatewayConnectionSettings(),
    };
  }

  const currentUrl = new URL(window.location.href);
  const params = currentUrl.searchParams;

  const tokenParam = params.get("token");
  const passwordParam = params.get("password");
  const gatewayUrlParam = params.get("gatewayUrl");

  const hadUrlCredentials = tokenParam !== null || passwordParam !== null || gatewayUrlParam !== null;

  if (tokenParam !== null) {
    const normalized = tokenParam.trim();
    if (normalized) {
      storeSharedGatewayToken(normalized);
    } else {
      clearSharedGatewayToken();
    }
    params.delete("token");
  }

  if (passwordParam !== null) {
    if (passwordParam) {
      storeSharedGatewayPassword(passwordParam);
    } else {
      clearSharedGatewayPassword();
    }
    params.delete("password");
  }

  if (gatewayUrlParam !== null) {
    const normalized = gatewayUrlParam.trim();
    if (normalized) {
      storeGatewayUrl(normalized);
    } else {
      clearStoredGatewayUrl();
    }
    params.delete("gatewayUrl");
  }

  if (hadUrlCredentials) {
    const nextSearch = params.toString();
    const nextUrl = `${currentUrl.pathname}${nextSearch ? `?${nextSearch}` : ""}${currentUrl.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }

  return {
    hadUrlCredentials,
    ...loadStoredGatewayConnectionSettings(),
  };
}

// =====================================================================
// Auth Preference Storage
// =====================================================================

const AUTH_METHOD_KEY = "clawdbrain-auth-method";

export type AuthMethod = "token" | "password";

/**
 * Loads the user's preferred auth method.
 */
export function loadAuthMethodPreference(): AuthMethod {
  try {
    const stored = window.localStorage.getItem(AUTH_METHOD_KEY);
    if (stored === "password") {return "password";}
    return "token"; // default
  } catch {
    return "token";
  }
}

/**
 * Stores the user's preferred auth method.
 */
export function storeAuthMethodPreference(method: AuthMethod): void {
  try {
    window.localStorage.setItem(AUTH_METHOD_KEY, method);
  } catch {
    // best-effort
  }
}

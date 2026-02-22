/**
 * OpenClaw SDK - Core Types
 *
 * Typed client library for interacting with OpenClaw gateways.
 */

/**
 * Client configuration options
 */
export interface OpenClawClientConfig {
  /** Base URL of the gateway (default: http://127.0.0.1:3939) */
  baseUrl?: string;
  /** API key for authentication */
  apiKey?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Custom user agent string */
  userAgent?: string;
  /** Logger instance */
  logger?: OpenClawLogger;
  /** Sandbox runtime integration */
  sandbox?: {
    runtime: unknown; // LocalSandboxRuntime - imported dynamically to avoid circular deps
  };
}

/**
 * Logger interface
 */
export interface OpenClawLogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

/**
 * Health check result
 */
export interface HealthResult {
  ok: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  version?: string;
  timestamp: string;
}

/**
 * Tool invocation request
 */
export interface ToolInvokeRequest {
  name: string;
  input: Record<string, unknown>;
  timeoutMs?: number;
}

/**
 * Tool invocation result
 */
export interface ToolInvokeResult<T = unknown> {
  ok: true;
  data: T;
  requestId?: string;
  durationMs?: number;
}

export interface ToolInvokeError {
  ok: false;
  error: {
    code: string;
    message: string;
    statusCode?: number;
    requestId?: string;
  };
}

export type ToolInvokeResponse<T = unknown> = ToolInvokeResult<T> | ToolInvokeError;

/**
 * Session management types
 */
export interface SessionCreateRequest {
  agentId?: string;
  context?: Record<string, unknown>;
}

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
}

/**
 * Resource types
 */
export interface ResourceListRequest {
  type?: string;
  limit?: number;
}

export interface ResourceItem {
  id: string;
  type: string;
  name: string;
  createdAt: string;
}

/**
 * Error types
 */
export class OpenClawError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public requestId?: string,
  ) {
    super(message);
    this.name = "OpenClawError";
  }
}

export class ValidationError extends OpenClawError {
  constructor(message: string, requestId?: string) {
    super(message, "VALIDATION_ERROR", 400, requestId);
    this.name = "ValidationError";
  }
}

export class TransportError extends OpenClawError {
  constructor(message: string, statusCode?: number, requestId?: string) {
    super(message, "TRANSPORT_ERROR", statusCode, requestId);
    this.name = "TransportError";
  }
}

export class AuthError extends OpenClawError {
  constructor(message: string, requestId?: string) {
    super(message, "AUTH_ERROR", 401, requestId);
    this.name = "AuthError";
  }
}

export class ToolRuntimeError extends OpenClawError {
  constructor(message: string, statusCode?: number, requestId?: string) {
    super(message, "TOOL_RUNTIME_ERROR", statusCode, requestId);
    this.name = "ToolRuntimeError";
  }
}

export class SandboxUnavailableError extends OpenClawError {
  constructor(message: string, requestId?: string) {
    super(message, "SANDBOX_UNAVAILABLE", 503, requestId);
    this.name = "SandboxUnavailableError";
  }
}

/**
 * Result envelope helpers
 */
export function ok<T>(data: T): { ok: true; data: T } {
  return { ok: true, data };
}

export function err<T>(error: T): { ok: false; error: T } {
  return { ok: false, error };
}

/**
 * Default client configuration
 */
export const DEFAULT_CLIENT_CONFIG: Required<OpenClawClientConfig> = {
  baseUrl: "http://127.0.0.1:3939",
  apiKey: "",
  timeoutMs: 30000,
  userAgent: "openclaw-sdk/0.0.1",
  logger: console,
  sandbox: { runtime: null as unknown },
};

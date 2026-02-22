import { OpenClawError } from "./errors.js";

export type OpenClawLogger = {
  debug: (message: string, ...args: unknown[]) => void;
  info: (message: string, ...args: unknown[]) => void;
  warn: (message: string, ...args: unknown[]) => void;
  error: (message: string, ...args: unknown[]) => void;
};

export type OpenClawLogLevel = "debug" | "info" | "warn" | "error";

export const DFLT_BASE_URL = "http://127.0.0.1:3939";

export type RuntimeState = "idle" | "starting" | "ready" | "busy" | "terminating" | "failed";

export interface RuntimeStatus {
  state: RuntimeState;
  startedAt?: string;
  readyAt?: string;
  stoppedAt?: string;
  command?: string;
  mode?: "memory" | "persist";
  rootDir: string;
  runtime?: {
    pid?: number;
    exitCode?: number;
    lastError?: string;
  };
}

export interface RuntimeExecRequest<TInput = unknown> {
  input: TInput;
  timeoutMs?: number;
  metadata?: Record<string, string>;
  tool?: string;
  executionId?: string;
}

export type RuntimeExecResponse<TOutput = unknown> = {
  output: TOutput;
  elapsedMs: number;
};

export interface OpenClawClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
  userAgent?: string;
  logger?: OpenClawLogger;
  sandbox?: {
    runtime?: LocalSandboxRuntime;
  };
  transport?: OpenClawTransport;
}

export type Result<T, TError extends OpenClawError = OpenClawError> =
  | { ok: true; data: T }
  | { ok: false; error: TError };

export interface HealthResult {
  ok: boolean;
  version?: string;
  status: "ready" | "degraded" | "healthy" | "unhealthy";
  now?: string;
  timestamp?: string;
}

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}

export interface ToolListRequest {
  cursor?: string;
  limit?: number;
}

export interface ToolInvocationRequest<TInput = unknown> {
  name: string;
  input?: TInput;
  sessionId?: string;
  timeoutMs?: number;
}

export interface ToolInvocationResult<TOutput = unknown> {
  requestId: string;
  name: string;
  output: TOutput;
}

export interface ToolStreamEvent<TOutput = unknown> {
  kind: "result";
  payload: ToolInvocationResult<TOutput>;
}

export interface ToolListResult {
  tools: ToolDescriptor[];
  nextCursor?: string;
}

export interface SessionRecord {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionCreateRequest {
  name?: string;
  agentId?: string;
  context?: Record<string, unknown>;
}

export interface ResourceRecord {
  id: string;
  type: string;
  name: string;
  uri: string;
}

export interface LocalSandboxRuntime {
  start(): Promise<void>;
  stop(options?: { force?: boolean }): Promise<void>;
  status(): Promise<RuntimeStatus>;
  exec<TInput = unknown, TOutput = unknown>(
    payload: RuntimeExecRequest<TInput>,
  ): Promise<RuntimeExecResponse<TOutput>>;
}

export interface ToolClient {
  list(request?: ToolListRequest): Promise<Result<ToolListResult>>;
  invoke<TInput = unknown, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>,
  ): Promise<Result<ToolInvocationResult<TOutput>>>;
  stream<TInput = unknown, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>,
  ): Promise<Result<AsyncIterable<ToolStreamEvent<TOutput>>>>;
}

export interface SessionClient {
  list(): Promise<Result<SessionRecord[]>>;
  create(request: SessionCreateRequest): Promise<Result<SessionRecord>>;
}

export interface ResourceClient {
  list(): Promise<Result<ResourceRecord[]>>;
  get(id: string): Promise<Result<ResourceRecord>>;
}

export interface SandboxController {
  start(): Promise<Result<void>>;
  stop(): Promise<Result<void>>;
  status(): Promise<Result<RuntimeStatus>>;
  exec<TInput = unknown, TOutput = unknown>(
    request: RuntimeExecRequest<TInput>,
  ): Promise<Result<RuntimeExecResponse<TOutput>>>;
}

export interface OpenClawClient {
  tools: ToolClient;
  sessions: SessionClient;
  resources: ResourceClient;
  sandbox: SandboxController;
  health(): Promise<Result<HealthResult>>;
  close(): Promise<void>;
  withRetries<T>(operation: () => Promise<T>, options?: RetryOptions): Promise<T>;
}

export interface RetryOptions {
  attempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

export interface OpenClawHttpRequest<TBody = unknown> {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string>;
  headers?: Record<string, string>;
  body?: TBody;
}

export interface OpenClawHttpResponse<TBody = unknown> {
  status: number;
  body?: TBody;
  headers: Record<string, string>;
}

export interface OpenClawTransport {
  request<TBody = unknown, TResponse = unknown>(
    request: OpenClawHttpRequest<TBody>,
  ): Promise<OpenClawHttpResponse<TResponse>>;
}

export interface EnvValidatedClientConfig extends OpenClawClientConfig {
  baseUrl: string;
  timeoutMs: number;
  userAgent: string;
}

export const DEFAULT_TIMEOUT_MS = 10_000;

export interface QuickstartRuntimeError {
  message: string;
  cause?: string;
}

// Backward-compatible legacy request/response aliases used by earlier SDK scaffolding.
export interface ToolInvokeRequest<TInput = Record<string, unknown>> {
  name: string;
  input: TInput;
  timeoutMs?: number;
}

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

export interface SessionResponse {
  sessionId: string;
  createdAt: string;
}

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

export const ok = <T>(data: T): { ok: true; data: T } => {
  return { ok: true, data };
};

export const err = <T>(error: T): { ok: false; error: T } => {
  return { ok: false, error };
};

export const DEFAULT_CLIENT_CONFIG: Required<
  Pick<OpenClawClientConfig, "baseUrl" | "apiKey" | "timeoutMs" | "userAgent" | "logger" | "sandbox">
> = {
  baseUrl: DFLT_BASE_URL,
  apiKey: "",
  timeoutMs: 30_000,
  userAgent: "openclaw-sdk/0.0.1",
  logger: console,
  sandbox: {},
};

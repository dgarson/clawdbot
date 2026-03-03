/**
 * Local Sandbox Runtime - Core Types
 */

import type { RuntimeState } from "./state-machine.js";

/**
 * Configuration for local sandbox runtime
 */
export interface LocalSandboxOptions {
  /** Project root directory */
  rootDir: string;
  /** Runtime command to execute (default: openclaw-runtime) */
  command?: string;
  /** Runtime mode: memory (ephemeral) or persist (debug) */
  mode?: "memory" | "persist";
  /** Startup timeout in milliseconds */
  timeoutMs?: number;
  /** Additional environment variables */
  env?: Record<string, string>;
  /** Volume mounts (for future Docker support) */
  mounts?: Array<{
    from: string;
    to: string;
    readOnly: boolean;
  }>;
}

/**
 * Runtime status snapshot
 */
export interface RuntimeStatus {
  state: RuntimeState;
  /** Process ID if running */
  pid?: number;
  /** Start timestamp */
  startedAt?: Date;
  /** Last error if in failed state */
  lastError?: string;
  /** Number of completed executions */
  executionCount: number;
  /** Whether restart is available (from failed state) */
  canRestart: boolean;
}

/**
 * Execution request payload
 */
export interface RuntimeExecRequest<TInput = unknown> {
  /** Tool name to invoke */
  tool: string;
  /** Input payload */
  input: TInput;
  /** Optional execution ID for tracking */
  executionId?: string;
  /** Timeout for this specific execution */
  timeoutMs?: number;
}

/**
 * Execution result envelope
 */
export interface RuntimeExecResult<TOutput = unknown> {
  ok: true;
  data: TOutput;
  executionId: string;
  durationMs: number;
}

export interface RuntimeExecError {
  ok: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  executionId: string;
  durationMs: number;
}

export type RuntimeExecResponse<TOutput = unknown> = RuntimeExecResult<TOutput> | RuntimeExecError;

/**
 * Runtime event types
 */
export type RuntimeEventType =
  | "state_changed"
  | "ready"
  | "execution_start"
  | "execution_complete"
  | "execution_error"
  | "error"
  | "stdout"
  | "stderr"
  | "stopped";

/**
 * Runtime event
 */
export interface RuntimeEvent {
  type: RuntimeEventType;
  timestamp: Date;
  payload?: unknown;
  executionId?: string;
}

/**
 * Event handler type
 */
export type EventHandler = (event: RuntimeEvent) => void;

/**
 * Sandbox lifecycle callbacks
 */
export interface SandboxLifecycleCallbacks {
  onStateChange?: (from: RuntimeState, to: RuntimeState) => void;
  onReady?: () => void;
  onError?: (error: Error) => void;
  onExecutionStart?: (executionId: string, tool: string) => void;
  onExecutionComplete?: (executionId: string, result: RuntimeExecResult) => void;
  onExecutionError?: (executionId: string, error: RuntimeExecError) => void;
}

/**
 * Default configuration values
 */
export const DEFAULT_SANDBOX_OPTIONS: Required<LocalSandboxOptions> = {
  rootDir: process.cwd(),
  command: "openclaw-runtime",
  mode: "memory",
  timeoutMs: 30000,
  env: {},
  mounts: [],
};

export const DEFAULT_STARTUP_TIMEOUT_MS = 30000;
export const DEFAULT_EXECUTION_TIMEOUT_MS = 60000;

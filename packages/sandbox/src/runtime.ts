/**
 * Local Sandbox Runtime - Core Implementation
 */

import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { type RuntimeState, isValidTransition, getStateDescription } from "./state-machine.js";
import {
  type LocalSandboxOptions,
  type RuntimeStatus,
  type RuntimeExecRequest,
  type RuntimeExecResponse,
  type RuntimeEvent,
  type EventHandler,
  type SandboxLifecycleCallbacks,
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_STARTUP_TIMEOUT_MS,
  DEFAULT_EXECUTION_TIMEOUT_MS,
} from "./types.js";

/**
 * Local Sandbox Runtime
 *
 * Implements the state machine for sandbox lifecycle management:
 * idle -> starting -> ready -> busy -> (ready | terminating)
 *                                   ↘
 *                                    failed -> ready_retry | terminal
 */
export class LocalSandboxRuntime {
  private state: RuntimeState = "idle";
  private process: ChildProcess | null = null;
  private options: Required<LocalSandboxOptions>;
  private eventHandlers: Set<EventHandler> = new Set();
  private callbacks: SandboxLifecycleCallbacks;
  private executionCount = 0;
  private lastError: string | null = null;
  private startedAt: Date | null = null;
  private pendingExec: {
    resolve: (result: RuntimeExecResponse) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
  } | null = null;

  constructor(options: LocalSandboxOptions, callbacks: SandboxLifecycleCallbacks = {}) {
    this.options = {
      ...DEFAULT_SANDBOX_OPTIONS,
      ...options,
    };
    this.callbacks = callbacks;
  }

  /**
   * Get current runtime status
   */
  async status(): Promise<RuntimeStatus> {
    return {
      state: this.state,
      pid: this.process?.pid,
      startedAt: this.startedAt ?? undefined,
      lastError: this.lastError ?? undefined,
      executionCount: this.executionCount,
      canRestart: this.state === "failed",
    };
  }

  /**
   * Get current state
   */
  getState(): RuntimeState {
    return this.state;
  }

  /**
   * Start the sandbox runtime
   */
  async start(): Promise<void> {
    if (!isValidTransition(this.state, "starting")) {
      throw new Error(`Cannot start from state: ${this.state}. ${getStateDescription(this.state)}`);
    }

    this.transitionTo("starting");
    this.lastError = null;

    try {
      await this.launchProcess();
      this.transitionTo("ready");
      this.startedAt = new Date();
      this.callbacks.onReady?.();

      this.emit({
        type: "ready",
        timestamp: new Date(),
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.lastError = errorMessage;
      this.transitionTo("failed");
      this.callbacks.onError?.(error instanceof Error ? error : new Error(errorMessage));

      throw error;
    }
  }

  /**
   * Stop the sandbox runtime
   */
  async stop(): Promise<void> {
    if (!isValidTransition(this.state, "terminating")) {
      if (this.state === "idle") {
        return; // Already stopped
      }
      throw new Error(`Cannot stop from state: ${this.state}. ${getStateDescription(this.state)}`);
    }

    this.transitionTo("terminating");

    // Wait for any pending execution to complete
    if (this.pendingExec) {
      // Give it a moment to complete naturally
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    await this.terminateProcess();

    this.transitionTo("idle");
    this.startedAt = null;

    this.emit({
      type: "stopped",
      timestamp: new Date(),
    });
  }

  /**
   * Execute a tool in the sandbox
   */
  async exec<TInput, TOutput>(
    payload: RuntimeExecRequest<TInput>,
  ): Promise<RuntimeExecResponse<TOutput>> {
    if (!isValidTransition(this.state, "busy")) {
      throw new Error(
        `Cannot execute from state: ${this.state}. ${getStateDescription(this.state)}`,
      );
    }

    const executionId = payload.executionId ?? randomUUID();
    const startTime = Date.now();

    this.transitionTo("busy");

    this.emit({
      type: "execution_start",
      timestamp: new Date(),
      executionId,
      payload: { tool: payload.tool },
    });

    this.callbacks.onExecutionStart?.(executionId, payload.tool);

    // Set up execution timeout
    const timeoutMs = payload.timeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        const errorResult: RuntimeExecResponse<TOutput> = {
          ok: false,
          error: {
            code: "EXECUTION_TIMEOUT",
            message: `Execution timed out after ${timeoutMs}ms`,
          },
          executionId,
          durationMs: Date.now() - startTime,
        };

        this.handleExecutionError(executionId, errorResult, Date.now() - startTime);
        resolve(errorResult);
      }, timeoutMs);

      this.pendingExec = {
        resolve: (_result) => {
          clearTimeout(timeout);
          this.pendingExec = null;
        },
        reject: (_error) => {
          clearTimeout(timeout);
          this.pendingExec = null;
        },
        timeout,
      };

      // For now, implement a mock execution that returns a placeholder
      // In phase 2, this will actually communicate with the sandbox process
      const mockResult: RuntimeExecResponse<TOutput> = {
        ok: true,
        data: { result: "mock-output" } as TOutput,
        executionId,
        durationMs: Date.now() - startTime,
      };

      this.executionCount++;
      this.transitionTo("ready");

      this.emit({
        type: "execution_complete",
        timestamp: new Date(),
        executionId,
        payload: mockResult,
      });

      this.callbacks.onExecutionComplete?.(executionId, mockResult);

      if (this.pendingExec) {
        this.pendingExec.resolve(mockResult);
      }

      resolve(mockResult);
    });
  }

  /**
   * Subscribe to runtime events
   */
  streamEvents(handler: EventHandler): () => void {
    this.eventHandlers.add(handler);

    // Return unsubscribe function
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Attempt to restart from failed state
   */
  async restart(): Promise<void> {
    if (this.state !== "failed") {
      throw new Error(`Cannot restart from state: ${this.state}`);
    }

    await this.stop();
    await this.start();
  }

  /**
   * Close the runtime and clean up resources
   */
  async close(): Promise<void> {
    await this.stop();
    this.eventHandlers.clear();
  }

  // Private methods

  private transitionTo(newState: RuntimeState): void {
    const oldState = this.state;

    if (oldState === newState) {
      return;
    }

    if (!isValidTransition(oldState, newState)) {
      throw new Error(
        `Invalid state transition: ${oldState} -> ${newState}. ${getStateDescription(oldState)}`,
      );
    }

    this.state = newState;

    this.emit({
      type: "state_changed",
      timestamp: new Date(),
      payload: { from: oldState, to: newState },
    });

    this.callbacks.onStateChange?.(oldState, newState);
  }

  private async launchProcess(): Promise<void> {
    const timeoutMs = this.options.timeoutMs ?? DEFAULT_STARTUP_TIMEOUT_MS;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        void this.terminateProcess();
        reject(new Error(`Startup timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      try {
        // For phase 1, we create a mock process that stays alive
        // In phase 2, this will actually spawn the sandbox runtime
        this.process = spawn("sleep", ["infinity"], {
          cwd: this.options.rootDir,
          env: { ...process.env, ...this.options.env },
          stdio: ["ignore", "pipe", "pipe"],
        });

        this.process.on("error", (error) => {
          clearTimeout(timeout);
          void this.terminateProcess();
          reject(error);
        });

        this.process.stdout?.on("data", (data) => {
          this.emit({
            type: "stdout",
            timestamp: new Date(),
            payload: data.toString(),
          });
        });

        this.process.stderr?.on("data", (data) => {
          this.emit({
            type: "stderr",
            timestamp: new Date(),
            payload: data.toString(),
          });
        });

        // Resolve immediately for mock implementation
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  private async terminateProcess(): Promise<void> {
    if (this.process) {
      this.process.kill("SIGTERM");

      // Wait for process to exit
      await new Promise<void>((resolve) => {
        if (this.process?.killed || !this.process.pid) {
          resolve();
          return;
        }

        setTimeout(() => {
          if (this.process && !this.process.killed) {
            this.process.kill("SIGKILL");
          }
          resolve();
        }, 5000);
      });

      this.process = null;
    }
  }

  private handleExecutionError<TOutput>(
    executionId: string,
    error: RuntimeExecResponse<TOutput>,
    _durationMs: number,
  ): void {
    this.transitionTo("failed");
    this.lastError = !error.ok ? error.error.message : "Unknown error";

    this.emit({
      type: "execution_error",
      timestamp: new Date(),
      executionId,
      payload: error,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.callbacks.onExecutionError?.(executionId, error as any);
  }

  private emit(event: RuntimeEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Event handler error:", error);
      }
    }
  }
}

/**
 * Create a local sandbox runtime instance
 */
export function createLocalSandbox(
  options: LocalSandboxOptions,
  callbacks?: SandboxLifecycleCallbacks,
): LocalSandboxRuntime {
  return new LocalSandboxRuntime(options, callbacks);
}

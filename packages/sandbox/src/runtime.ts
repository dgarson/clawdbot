import {
  type RuntimeExecRequest,
  type RuntimeExecResponse,
  type RuntimeState,
  type RuntimeStatus,
  SandboxUnavailableError,
} from "@openclaw/sdk";
import {
  ProcessManager,
  type LocalSandboxOptions as ProcessManagerOptions,
} from "./process-manager.js";
import { buildEvent, type SandboxEvent } from "./protocol.js";
import { isWorkspaceReadable, normalizeWorkspaceRoot } from "./workspace.js";

type State = RuntimeState;

export interface MountPoint {
  from: string;
  to: string;
  readOnly: boolean;
}

export interface LocalSandboxOptions {
  rootDir: string;
  command?: string;
  mode?: "memory" | "persist";
  timeoutMs?: number;
  env?: Record<string, string>;
  mounts?: MountPoint[];
}

export interface LocalSandboxRuntime {
  start(): Promise<void>;
  stop(options?: { force?: boolean }): Promise<void>;
  status(): Promise<RuntimeStatus>;
  exec<TInput = unknown, TOutput = unknown>(
    payload: RuntimeExecRequest<TInput>,
  ): Promise<RuntimeExecResponse<TOutput>>;
  streamEvents(handler: (event: SandboxEvent) => void): () => void;
}

const defaultOptions = (
  input: LocalSandboxOptions,
): Required<Pick<LocalSandboxOptions, "command" | "mode" | "timeoutMs" | "env" | "mounts">> => {
  const command = input.command?.trim() || "openclaw-runtime";
  return {
    command,
    mode: input.mode || "memory",
    timeoutMs: input.timeoutMs ?? 5_000,
    env: { ...input.env },
    mounts: input.mounts ?? [],
  };
};

export const createLocalSandbox = (input: LocalSandboxOptions): LocalSandboxRuntime => {
  if (!isWorkspaceReadable(input.rootDir)) {
    throw new Error("rootDir is required");
  }

  const resolved = defaultOptions(input);
  const rootDir = normalizeWorkspaceRoot(input.rootDir);
  const status: RuntimeStatus = {
    state: "idle",
    command: resolved.command,
    mode: resolved.mode,
    rootDir,
  };

  const processor = new ProcessManager({
    rootDir,
    command: resolved.command,
    timeoutMs: resolved.timeoutMs,
    mode: resolved.mode,
    env: resolved.env,
  } as ProcessManagerOptions);
  const listeners = new Set<(event: SandboxEvent) => void>();
  const emit = (event: SandboxEvent): void => {
    for (const listener of listeners.values()) {
      listener(event);
    }
  };

  const transition = (nextState: State): void => {
    status.state = nextState;
    if (nextState === "ready") {
      status.readyAt = new Date().toISOString();
    }
    if (nextState === "idle") {
      status.stoppedAt = new Date().toISOString();
    }
  };

  const setTerminalError = (message: string): void => {
    status.state = "failed";
    status.runtime = {
      ...status.runtime,
      lastError: message,
    };
  };

  const withState = async <T>(nextState: State, cb: () => Promise<T>): Promise<T> => {
    transition(nextState);
    emit(
      buildEvent(
        nextState === "ready" || nextState === "starting"
          ? "started"
          : nextState === "terminating"
            ? "stopped"
            : "idle",
      ),
    );

    try {
      const result = await cb();
      if (nextState !== "failed") {
        transition(nextState === "starting" ? "ready" : nextState);
      }
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      setTerminalError(message);
      emit(buildEvent("error", message));
      throw new SandboxUnavailableError(message);
    }
  };

  const setRuntimeState = (updater: (runtimeState: State) => State): void => {
    transition(updater(status.state));
  };

  const runtime: LocalSandboxRuntime = {
    start: async () => {
      if (status.state === "ready") {
        return;
      }

      if (status.state === "starting") {
        return;
      }

      await withState("starting", async () => {
        await processor.start();
        processor.status(status);
      });
    },

    stop: async ({ force } = {}) => {
      if (status.state === "idle") {
        return;
      }

      transition("terminating");
      await processor.stop(force);
      setRuntimeState(() => "idle");
      emit(buildEvent("stopped", "sandbox stopped"));
    },

    status: async () => {
      processor.status(status);
      return { ...status };
    },

    exec: async <TInput = unknown, TOutput = unknown>(
      payload: RuntimeExecRequest<TInput>,
    ): Promise<RuntimeExecResponse<TOutput>> => {
      if (status.state !== "ready") {
        throw new SandboxUnavailableError("sandbox not ready");
      }

      transition("busy");
      emit(buildEvent("busy", "execution started"));
      try {
        const output = await processor.exec<TInput, TOutput>(payload);
        return output;
      } finally {
        transition("ready");
        emit(buildEvent("idle", "execution complete"));
      }
    },

    streamEvents: (handler) => {
      listeners.add(handler);

      return () => {
        listeners.delete(handler);
      };
    },
  };

  return runtime;
};

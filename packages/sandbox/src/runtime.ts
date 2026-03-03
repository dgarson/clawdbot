import { watch as watchFile, type FSWatcher } from "node:fs";
import { resolve } from "node:path";
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
  watch?: boolean;
  watchPaths?: string[];
  watchDebounceMs?: number;
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

type WatchControl = {
  enabled: boolean;
  paths: string[];
  debounceMs: number;
};

const DEFAULT_HOT_RELOAD_OPTIONS: Pick<LocalSandboxOptions, "watch" | "watchDebounceMs"> = {
  watch: false,
  watchDebounceMs: 120,
};

const defaultOptions = (
  input: LocalSandboxOptions,
): Required<
  Pick<
    LocalSandboxOptions,
    "command" | "mode" | "timeoutMs" | "env" | "mounts" | "watch" | "watchDebounceMs"
  >
> => {
  const command = input.command?.trim() || "openclaw-runtime";
  return {
    command,
    mode: input.mode || "memory",
    timeoutMs: input.timeoutMs ?? 5_000,
    env: { ...input.env },
    mounts: input.mounts ?? [],
    watch: input.watch ?? DEFAULT_HOT_RELOAD_OPTIONS.watch,
    watchDebounceMs: input.watchDebounceMs ?? DEFAULT_HOT_RELOAD_OPTIONS.watchDebounceMs,
  };
};

const shouldIgnoreWatchFilename = (filename: string): boolean => {
  const normalized = filename.toLowerCase().replaceAll("\\", "/");

  return (
    normalized.includes("/.git/") ||
    normalized.startsWith(".git") ||
    normalized.includes("/node_modules/") ||
    normalized.startsWith(".openclaw")
  );
};

export const createLocalSandbox = (input: LocalSandboxOptions): LocalSandboxRuntime => {
  if (!isWorkspaceReadable(input.rootDir)) {
    throw new Error("rootDir is required");
  }

  const resolved = defaultOptions(input);
  const watchConfig: WatchControl = {
    enabled: resolved.watch,
    debounceMs: resolved.watchDebounceMs,
    paths: input.watchPaths ?? ["."],
  };

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

  const watchers = new Set<FSWatcher>();
  const listeners = new Set<(event: SandboxEvent) => void>();
  let watchTimer: ReturnType<typeof setTimeout> | undefined;
  let isReloading = false;

  const emit = (event: SandboxEvent): void => {
    for (const listener of listeners.values()) {
      listener(event);
    }
  };

  const transition = (nextState: State): void => {
    status.state = nextState;
    if (nextState === "ready") {
      status.readyAt = new Date().toISOString();
      status.runtime = { ...status.runtime };
    }

    if (nextState === "idle") {
      status.stoppedAt = new Date().toISOString();
      status.runtime = { ...status.runtime, pid: undefined };
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

  const closeWatchers = (): void => {
    for (const watcher of watchers.values()) {
      watcher.close();
    }
    watchers.clear();

    if (watchTimer !== undefined) {
      clearTimeout(watchTimer);
      watchTimer = undefined;
    }
  };

  const stopWatchers = (): void => {
    closeWatchers();
  };

  const startWatchers = (): void => {
    if (!watchConfig.enabled || watchers.size > 0 || status.state !== "ready") {
      return;
    }

    for (const rawPath of watchConfig.paths) {
      const absolutePath = resolve(rootDir, rawPath);
      try {
        const watcher = watchFile(absolutePath, { recursive: true }, (eventType, filename) => {
          const filenameText = filename ? filename.toString() : "";
          if (filenameText && shouldIgnoreWatchFilename(filenameText)) {
            return;
          }

          if (watchTimer !== undefined) {
            clearTimeout(watchTimer);
          }

          watchTimer = setTimeout(() => {
            void reloadRuntime();
          }, watchConfig.debounceMs);

          emit(buildEvent("busy", `${eventType} changed ${filenameText || "<unknown>"}`));
        });

        watchers.add(watcher);
      } catch {
        // Ignore watch failures on unsupported filesystems.
      }
    }
  };

  const stopInternal = async ({
    force,
    keepWatchers,
  }: {
    force?: boolean;
    keepWatchers?: boolean;
  }): Promise<void> => {
    if (status.state === "idle") {
      return;
    }

    transition("terminating");
    await processor.stop(force);
    transition("idle");
    emit(buildEvent("stopped", "sandbox stopped"));

    if (!keepWatchers) {
      stopWatchers();
    }
  };

  const reloadRuntime = async (): Promise<void> => {
    if (!watchConfig.enabled || isReloading || status.state !== "ready") {
      return;
    }

    isReloading = true;
    try {
      await stopInternal({ force: true, keepWatchers: true });
      await startInternal();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to reload sandbox";
      setTerminalError(message);
      emit(buildEvent("error", message));
      throw error;
    } finally {
      isReloading = false;
    }
  };

  const startInternal = async (): Promise<void> => {
    if (status.state === "ready" || status.state === "starting") {
      return;
    }

    await withState("starting", async () => {
      await processor.start();
      processor.status(status);
      startWatchers();
    });
  };

  const runtime: LocalSandboxRuntime = {
    start: async () => {
      await startInternal();
    },

    stop: async ({ force } = {}) => {
      await stopInternal({ force, keepWatchers: false });
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

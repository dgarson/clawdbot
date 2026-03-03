import { promises as fs } from "node:fs";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import {
  type RuntimeExecRequest,
  type RuntimeExecResponse,
  type RuntimeStatus,
} from "@openclaw/sdk";

type RuntimeProcessState = "idle" | "starting" | "ready" | "stopped";

export interface LocalSandboxOptions {
  rootDir: string;
  command: string;
  timeoutMs: number;
  mode: "memory" | "persist";
  env?: Record<string, string>;
}

interface ManagedProcess {
  state: RuntimeProcessState;
  startedAt?: string;
}

export class ProcessManager {
  private readonly state: ManagedProcess;

  public constructor(private readonly options: LocalSandboxOptions) {
    this.state = {
      state: "idle",
    };
  }

  public async ensureRootDir(): Promise<void> {
    const directory = resolve(this.options.rootDir);
    await mkdir(directory, { recursive: true });
  }

  public async start(): Promise<void> {
    if (this.state.state === "ready" || this.state.state === "starting") {
      return;
    }

    await this.ensureRootDir();
    this.state.state = "starting";

    const marker = resolve(this.options.rootDir, `.openclaw-runtime-${Date.now()}`);
    await fs.writeFile(marker, "started", "utf8");

    this.state.startedAt = new Date().toISOString();
    this.state.state = "ready";
  }

  public async stop(force = false): Promise<void> {
    if (this.state.state !== "ready" && this.state.state !== "starting") {
      return;
    }

    if (!force) {
      await new Promise((resolvePromise) => {
        setTimeout(resolvePromise, 5);
      });
    }

    this.state.state = "stopped";
  }

  public status(runtimeStatus: RuntimeStatus): void {
    runtimeStatus.runtime = {
      ...runtimeStatus.runtime,
      pid: this.state.state === "ready" ? 9999 : undefined,
    };

    switch (this.state.state) {
      case "ready":
        runtimeStatus.state = "ready";
        runtimeStatus.startedAt = this.state.startedAt ?? runtimeStatus.startedAt;
        break;
      case "starting":
        runtimeStatus.state = "starting";
        break;
      default:
        runtimeStatus.state = "idle";
        break;
    }
  }

  public async exec<TInput, TOutput>(
    payload: RuntimeExecRequest<TInput>,
  ): Promise<RuntimeExecResponse<TOutput>> {
    if (this.state.state !== "ready") {
      throw new Error("runtime-not-ready");
    }

    const startedAt = Date.now();
    const output = {
      output: payload.input as unknown as TOutput,
      elapsedMs: 0,
    };

    output.elapsedMs = Date.now() - startedAt;
    return output;
  }
}

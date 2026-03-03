import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SandboxUnavailableError } from "@openclaw/sdk";
import { beforeEach, describe, expect, it } from "vitest";
import { createLocalSandbox } from "./index.js";
import { isWorkspaceReadable } from "./workspace.js";

const createWorkspace = async (): Promise<string> => {
  return mkdtemp(join(tmpdir(), "openclaw-sandbox-"));
};

const waitFor = (ms: number): Promise<void> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

describe("Local sandbox runtime", () => {
  let baseDir: string;

  beforeEach(async () => {
    baseDir = await createWorkspace();
  });

  it("starts, reports status, and executes payload", async () => {
    const runtime = createLocalSandbox({
      rootDir: baseDir,
      command: "node",
    });

    await runtime.start();
    const started = await runtime.status();
    expect(started.state).toBe("ready");

    const result = await runtime.exec<{ value: string }, { value: string }>({
      input: { value: "hello" },
    });

    expect(result.output.value).toBe("hello");
    expect(result.elapsedMs).toBeTypeOf("number");

    await runtime.stop();
    const stopped = await runtime.status();
    expect(stopped.state).toBe("idle");
  });

  it("prevents execution before startup", async () => {
    const runtime = createLocalSandbox({
      rootDir: baseDir,
      command: "node",
    });

    const result = runtime.exec<{ value: string }, { value: string }>({
      input: { value: "early" },
    });

    await expect(result).rejects.toBeInstanceOf(SandboxUnavailableError);
  });

  it("emits lifecycle events while executing", async () => {
    const runtime = createLocalSandbox({
      rootDir: baseDir,
      command: "node",
    });

    const events: string[] = [];
    const unsubscribe = runtime.streamEvents((event) => {
      events.push(event.kind);
    });

    await runtime.start();
    await runtime.exec({ input: { value: "hello" } });
    await runtime.stop();

    expect(events).toContain("started");
    expect(events).toContain("busy");
    expect(events).toContain("idle");
    expect(events).toContain("stopped");

    unsubscribe();
  });

  it("reloads automatically when watched files change", async () => {
    const events: string[] = [];
    const runtime = createLocalSandbox({
      rootDir: baseDir,
      command: "node",
      watch: true,
      watchDebounceMs: 25,
      watchPaths: [baseDir],
    });

    const unsubscribe = runtime.streamEvents((event) => {
      events.push(event.kind);
    });

    await runtime.start();
    await writeFile(join(baseDir, "agent.ts"), "export const hello = () => 'world';");
    await waitFor(120);

    const afterReload = await runtime.status();
    expect(afterReload.state).toBe("ready");
    expect(events).toContain("started");
    expect(events.filter((event) => event === "stopped").length).toBeGreaterThanOrEqual(1);

    await runtime.stop();
    unsubscribe();
  });

  it("rejects invalid workspace roots", () => {
    expect(isWorkspaceReadable("")).toBe(false);
    expect(isWorkspaceReadable("   ")).toBe(false);
  });

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true });
  });
});

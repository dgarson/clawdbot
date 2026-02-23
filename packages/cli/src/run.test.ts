import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { LocalSandboxRuntime, RuntimeStatus } from "@openclaw/sandbox";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { run } from "./run.js";

describe("CLI run command", () => {
  let sandboxRoot: string;

  beforeEach(async () => {
    sandboxRoot = await mkdtemp(join(tmpdir(), "openclaw-cli-sandbox-"));
  });

  it("prints usage when no command is provided", async () => {
    const result = await run([]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Usage:");
  });

  it("runs sdk doctor against a reachable failure path", async () => {
    const result = await run([
      "sdk",
      "doctor",
      "--base-url",
      "http://127.0.0.1:59999",
      "--timeout-ms",
      "250",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("sdk doctor failed");
  });

  it("validates sandbox exec input JSON", async () => {
    const missingResult = await run(["sandbox", "exec", "--root", sandboxRoot]);
    expect(missingResult.exitCode).toBe(1);
    expect(missingResult.output).toContain("--input is required");

    const invalidJsonResult = await run([
      "sandbox",
      "exec",
      "--root",
      sandboxRoot,
      "--input",
      "not-json",
    ]);
    expect(invalidJsonResult.exitCode).toBe(1);
    expect(invalidJsonResult.output).toContain("Invalid --input JSON");
  });

  it("supports full local runtime verification flow", async () => {
    const result = await run(["sandbox", "verify", "--root", sandboxRoot]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toBe("sandbox verify passed");
  });

  it("executes sandbox tool calls with JSON payload", async () => {
    const result = await run([
      "sandbox",
      "exec",
      "--root",
      sandboxRoot,
      "--input",
      '{"value":"hello-cli"}',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('"hello-cli"');
  });

  it("returns an error for invalid timeout arguments", async () => {
    const result = await run([
      "sandbox",
      "start",
      "--root",
      sandboxRoot,
      "--timeout-ms",
      "not-a-number",
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("Invalid --timeout-ms value");
  });

  it("rejects empty --root values", async () => {
    const result = await run(["sandbox", "status", "--root", "   "]);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("--root value cannot be empty");
  });

  it("cleans up sandbox after sandbox verify", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const runtime = createMockRuntime({
      stop,
    });

    const result = await run(["sandbox", "verify", "--root", sandboxRoot], {
      createClient: vi.fn(),
      createLocalSandbox: vi.fn(() => runtime),
    });

    expect(result.exitCode).toBe(0);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledWith({ force: true });
  });

  it("cleans up sandbox even when execution fails", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const runtime = createMockRuntime({
      exec: vi.fn().mockRejectedValue(new Error("exec failed")),
      stop,
    });

    const result = await run(
      ["sandbox", "exec", "--root", sandboxRoot, "--input", '{"value":"bad"}'],
      {
        createClient: vi.fn(),
        createLocalSandbox: vi.fn(() => runtime),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("exec failed");
    expect(stop).toHaveBeenCalledWith({ force: true });
  });

  it("returns cleanup error when sandbox stop fails after a successful command", async () => {
    const stop = vi.fn().mockRejectedValue(new Error("cleanup failed"));
    const runtime = createMockRuntime({
      stop,
    });

    const result = await run(["sandbox", "verify", "--root", sandboxRoot], {
      createClient: vi.fn(),
      createLocalSandbox: vi.fn(() => runtime),
    });

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("sandbox cleanup failed: cleanup failed");
  });

  afterEach(async () => {
    await rm(sandboxRoot, { recursive: true, force: true });
  });
});

type ExecResult = { output: unknown; elapsedMs: number };

const createMockRuntime = (
  overrides: Partial<{
    status: Mock<() => Promise<RuntimeStatus>>;
    start: Mock<() => Promise<void>>;
    stop: Mock<() => Promise<void>>;
    exec: Mock<(input: { input: unknown }) => Promise<ExecResult>>;
    streamEvents: Mock<() => () => void>;
  }> = {},
): LocalSandboxRuntime => {
  const status =
    overrides.status ??
    vi.fn().mockResolvedValue({
      state: "ready",
      rootDir: "/tmp/test-root",
      command: "openclaw-runtime",
      mode: "memory",
    } satisfies RuntimeStatus);

  const start = overrides.start ?? vi.fn().mockResolvedValue(undefined);
  const stop = overrides.stop ?? vi.fn().mockResolvedValue(undefined);
  const exec =
    overrides.exec ??
    vi.fn().mockImplementation(async (payload: { input: unknown }) => ({
      output: payload.input,
      elapsedMs: 0,
    }));
  const streamEvents = overrides.streamEvents ?? vi.fn().mockReturnValue(() => undefined);

  return {
    start,
    stop,
    status,
    exec,
    streamEvents,
  };
};

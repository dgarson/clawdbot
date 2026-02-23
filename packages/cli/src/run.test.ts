import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { createClient as createSdkClient } from "@openclaw/sdk";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { run } from "./run.js";
import {
  createMockPolicyGates,
  createMockRuntime,
  createMockSessions,
  createMockTools,
} from "./test-fixtures.js";

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

  it("trims whitespace from --root and normalizes workspace lookup", async () => {
    const runtime = createMockRuntime();
    const createLocalSandbox = vi.fn().mockReturnValue(runtime);

    const result = await run(["sandbox", "status", "--root", ` ${sandboxRoot} `], {
      createClient: vi.fn(),
      createLocalSandbox,
    });

    expect(result.exitCode).toBe(0);
    expect(createLocalSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDir: sandboxRoot,
      }),
    );
  });

  it("enables watch flag during sandbox start", async () => {
    const runtime = createMockRuntime();
    const createLocalSandbox = vi.fn().mockReturnValue(runtime);

    const result = await run(["sandbox", "start", "--root", sandboxRoot, "--watch"], {
      createClient: vi.fn(),
      createLocalSandbox,
    });

    expect(result.exitCode).toBe(0);
    expect(createLocalSandbox).toHaveBeenCalledWith(
      expect.objectContaining({
        rootDir: sandboxRoot,
        watch: true,
      }),
    );
    expect(runtime.start).toHaveBeenCalledTimes(1);
  });

  it("creates a plugin scaffold from one command", async () => {
    const result = await run([
      "new",
      "plugin",
      "quickstart-plugin",
      "--root",
      sandboxRoot,
      "--description",
      "Demo plugin for local testing",
    ]);

    expect(result.exitCode).toBe(0);
    const pluginDir = join(sandboxRoot, "quickstart-plugin");
    const manifestPath = join(pluginDir, "openclaw.plugin.json");
    const readmePath = join(pluginDir, "README.md");

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const readme = await readFile(readmePath, "utf8");

    expect(manifest.kind).toBe("plugin");
    expect(manifest.name).toBe("quickstart-plugin");
    expect(readme).toContain("Demo plugin for local testing");
    expect(result.output).toContain(pluginDir);
  });

  it("errors when scaffold target already exists without --force", async () => {
    const first = await run(["new", "plugin", "safe-plugin", "--root", sandboxRoot]);
    expect(first.exitCode).toBe(0);

    const second = await run(["new", "plugin", "safe-plugin", "--root", sandboxRoot]);
    expect(second.exitCode).toBe(1);
    expect(second.output).toContain("target directory already exists");
  });

  it("creates an agent scaffold from one command", async () => {
    const result = await run([
      "new",
      "agent",
      "assistant-agent",
      "--root",
      sandboxRoot,
      "--description",
      "Agent scaffold test",
    ]);

    const agentDir = join(sandboxRoot, "assistant-agent");

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain(agentDir);
    expect(await readFile(join(agentDir, "openclaw.agent.json"), "utf8")).toContain(
      '"kind": "agent"',
    );
  });

  it("supports a full SDK + sandbox quickstart flow", async () => {
    const createClient = vi.fn().mockReturnValue({
      health: vi.fn().mockResolvedValue({
        ok: true,
        data: { ok: true, status: "ready", version: "0.0.0", now: "test" },
      }),
    } as unknown as ReturnType<typeof createSdkClient>);

    const sandbox = createMockRuntime();
    const createLocalSandbox = vi.fn().mockReturnValue(sandbox);

    const plugin = await run(
      [
        "new",
        "plugin",
        "quickstart-plugin",
        "--root",
        sandboxRoot,
        "--description",
        "SDK sandbox quickstart plugin",
      ],
      {
        createClient,
        createLocalSandbox,
      },
    );
    expect(plugin.exitCode).toBe(0);

    const agent = await run(
      [
        "new",
        "agent",
        "quickstart-agent",
        "--root",
        sandboxRoot,
        "--description",
        "SDK sandbox quickstart agent",
      ],
      {
        createClient,
        createLocalSandbox,
      },
    );
    expect(agent.exitCode).toBe(0);

    const doctor = await run(["sdk", "doctor"], {
      createClient,
      createLocalSandbox,
    });
    expect(doctor.exitCode).toBe(0);
    expect(doctor.output).toContain("sdk doctor: ready 0.0.0");

    const verify = await run(["sandbox", "verify", "--root", sandboxRoot], {
      createClient,
      createLocalSandbox,
    });
    expect(verify.exitCode).toBe(0);
    expect(verify.output).toBe("sandbox verify passed");

    const exec = await run(
      ["sandbox", "exec", "--root", sandboxRoot, "--input", '{"value":"from quickstart"}'],
      {
        createClient,
        createLocalSandbox,
      },
    );
    expect(exec.exitCode).toBe(0);
    expect(exec.output).toContain('{"value":"from quickstart"}');
    expect(createClient).toHaveBeenCalledTimes(1);
    expect(createLocalSandbox).toHaveBeenCalledTimes(2);
  });

  it("returns fixture-ready session and tool collections", () => {
    expect(createMockSessions(2)).toHaveLength(2);
    expect(createMockTools(2)).toHaveLength(2);
    expect(createMockPolicyGates(2)).toHaveLength(2);
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

  it("skips cleanup when keep-alive is requested for verify", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const runtime = createMockRuntime({
      stop,
    });

    const result = await run(["sandbox", "verify", "--root", sandboxRoot, "--keep-alive"], {
      createClient: vi.fn(),
      createLocalSandbox: vi.fn(() => runtime),
    });

    expect(result.exitCode).toBe(0);
    expect(stop).toHaveBeenCalledTimes(0);
  });

  it("skips cleanup when keep-alive is requested for exec", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const runtime = createMockRuntime({
      stop,
    });

    const result = await run(
      ["sandbox", "exec", "--root", sandboxRoot, "--input", '{"value":"hot"}', "--keep-alive"],
      {
        createClient: vi.fn(),
        createLocalSandbox: vi.fn(() => runtime),
      },
    );

    expect(result.exitCode).toBe(0);
    expect(stop).toHaveBeenCalledTimes(0);
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

  it("lets keep-alive override cleanup even when execution fails", async () => {
    const stop = vi.fn().mockResolvedValue(undefined);
    const runtime = createMockRuntime({
      exec: vi.fn().mockRejectedValue(new Error("exec failed")),
      stop,
    });

    const result = await run(
      ["sandbox", "exec", "--root", sandboxRoot, "--input", '{"value":"bad"}', "--keep-alive"],
      {
        createClient: vi.fn(),
        createLocalSandbox: vi.fn(() => runtime),
      },
    );

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain("exec failed");
    expect(stop).toHaveBeenCalledTimes(0);
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

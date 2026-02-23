import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
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

  it("returns an error for invalid sandbox timeout arguments", async () => {
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

  afterEach(async () => {
    await rm(sandboxRoot, { recursive: true, force: true });
  });
});

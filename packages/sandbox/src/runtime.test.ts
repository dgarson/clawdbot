import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createLocalSandbox } from "./index.js";

describe("Local sandbox runtime", () => {
  it("starts, reports status, and executes payload", async () => {
    const baseDir = await mkdtemp(join(tmpdir(), "openclaw-sandbox-"));

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
    expect(["idle", "terminating", "stopped"]).toContain(stopped.state);

    await rm(baseDir, { recursive: true, force: true });
  });
});

import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  appendChangeAuditRecord,
  readFileAuditSnapshot,
  resolveChangeAuditLogPath,
} from "./change-audit.js";

describe("change-audit", () => {
  let tmpRoot: string | undefined;

  afterEach(async () => {
    if (tmpRoot) {
      await rm(tmpRoot, { recursive: true, force: true });
      tmpRoot = undefined;
    }
  });

  it("writes JSONL records into state logs", async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "openclaw-audit-"));
    const env = { ...process.env, OPENCLAW_STATE_DIR: tmpRoot };

    await appendChangeAuditRecord(
      {
        source: "test",
        eventType: "unit",
        op: "write",
        result: "ok",
      },
      env,
    );

    const logPath = resolveChangeAuditLogPath(env);
    const content = await readFile(logPath, "utf-8");
    const lines = content.trim().split("\n");
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]) as { source: string; eventType: string; ts?: string };
    expect(parsed.source).toBe("test");
    expect(parsed.eventType).toBe("unit");
    expect(typeof parsed.ts).toBe("string");
  });

  it("captures file snapshots with hash", async () => {
    tmpRoot = await mkdtemp(path.join(os.tmpdir(), "openclaw-audit-file-"));
    const filePath = path.join(tmpRoot, "sample.txt");
    await writeFile(filePath, "hello", "utf-8");

    const snapshot = await readFileAuditSnapshot(filePath);
    expect(snapshot.exists).toBe(true);
    expect(snapshot.bytes).toBe(5);
    expect(typeof snapshot.hash).toBe("string");
    expect(snapshot.hash?.length).toBeGreaterThan(0);
  });
});

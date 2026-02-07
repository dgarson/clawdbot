import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { MeridiaExperienceRecord } from "../../types.js";
import { createSqliteBackend, resolveMeridiaDbPath } from "./sqlite.js";
import { createBackend } from "./index.js";

const originalStateDir = process.env.OPENCLAW_STATE_DIR;

afterEach(() => {
  if (originalStateDir === undefined) {
    delete process.env.OPENCLAW_STATE_DIR;
  } else {
    process.env.OPENCLAW_STATE_DIR = originalStateDir;
  }
});

describe("meridia sqlite backend", () => {
  it("wipes unsupported data for default meridia dir", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const meridiaDir = path.join(stateDir, "meridia");
    fs.mkdirSync(meridiaDir, { recursive: true });
    fs.writeFileSync(path.join(meridiaDir, "legacy.txt"), "legacy");

    const dbPath = resolveMeridiaDbPath({ cfg: {} });
    const backend = createSqliteBackend({ cfg: {}, dbPath });
    const stats = backend.getStats();
    backend.close();

    expect(stats.schemaVersion).toBe("1");
    expect(fs.existsSync(path.join(meridiaDir, "legacy.txt"))).toBe(false);
  });

  it("refuses to wipe non-default meridia dirs", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const meridiaDir = path.join(stateDir, "custom-meridia");
    fs.mkdirSync(meridiaDir, { recursive: true });
    fs.writeFileSync(path.join(meridiaDir, "legacy.txt"), "legacy");

    const dbPath = path.join(meridiaDir, "meridia.sqlite");
    expect(() => createSqliteBackend({ cfg: {}, dbPath })).toThrow(/openclaw meridia reset/);
  });

  it("inserts and searches records", () => {
    const stateDir = fs.mkdtempSync(path.join(os.tmpdir(), "openclaw-meridia-"));
    process.env.OPENCLAW_STATE_DIR = stateDir;

    const backend = createBackend({ cfg: {} });
    const record: MeridiaExperienceRecord = {
      id: "rec-1",
      ts: new Date().toISOString(),
      kind: "manual",
      session: { key: "s1" },
      tool: { name: "experience_capture", callId: "t1", isError: false },
      capture: {
        score: 0.9,
        evaluation: { kind: "heuristic", score: 0.9, reason: "manual" },
      },
      content: { topic: "debugging breakthrough", tags: ["debugging"] },
      data: { args: { foo: "bar" } },
    };

    const inserted = backend.insertExperienceRecord(record);
    expect(inserted).toBe(true);

    const results = backend.searchRecords("breakthrough", { limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.record.id).toBe("rec-1");

    const stats = backend.getStats();
    expect(stats.recordCount).toBe(1);
    expect(stats.sessionCount).toBe(1);
    expect(stats.schemaVersion).toBe("1");

    const toolStats = backend.getToolStats();
    expect(toolStats.length).toBeGreaterThan(0);
    expect(toolStats[0]?.toolName).toBe("experience_capture");
  });
});

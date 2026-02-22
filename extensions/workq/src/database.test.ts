import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { WorkqDatabase } from "./database.js";

type Fixture = {
  dir: string;
  dbPath: string;
  dbs: WorkqDatabase[];
};

const fixtures: Fixture[] = [];

function makeFixture(sharedDbPath?: string): Fixture {
  const dir = sharedDbPath
    ? path.dirname(sharedDbPath)
    : mkdtempSync(path.join(os.tmpdir(), "workq-db-test-"));
  const dbPath = sharedDbPath ?? path.join(dir, "workq.sqlite");

  const fixture: Fixture = {
    dir,
    dbPath,
    dbs: [],
  };
  fixtures.push(fixture);
  return fixture;
}

function addDb(fixture: Fixture): WorkqDatabase {
  const db = new WorkqDatabase(fixture.dbPath);
  fixture.dbs.push(db);
  return db;
}

afterEach(() => {
  while (fixtures.length) {
    const fixture = fixtures.pop();
    if (!fixture) {
      continue;
    }

    for (const db of fixture.dbs) {
      try {
        db.close();
      } catch {
        // ignore close failures in cleanup
      }
    }

    rmSync(fixture.dir, { recursive: true, force: true });
  }
});

describe("WorkqDatabase", () => {
  it("claims a new item with normalized metadata and a claimed log", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    const result = db.claim({
      issueRef: "ISS-001",
      agentId: "agent-alpha",
      title: "  Add tests  ",
      squad: "platform",
      worktreePath: fixture.dir,
      files: ["src/new.ts"],
      scope: ["api", "api", " db "],
      tags: ["tests", "tests", " sqlite "],
    });

    expect(result.status).toBe("claimed");
    if (result.status !== "claimed") {
      return;
    }

    expect(result.item.issueRef).toBe("ISS-001");
    expect(result.item.agentId).toBe("agent-alpha");
    expect(result.item.status).toBe("claimed");
    expect(result.item.scope).toEqual(["api", "db"]);
    expect(result.item.tags).toEqual(["sqlite", "tests"]);
    expect(result.item.files).toEqual([path.resolve(fixture.dir, "src/new.ts")]);

    const log = db.getLog("ISS-001", 10);
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe("claimed");
    expect(log[0]?.agentId).toBe("agent-alpha");
  });

  it("returns conflict when a different agent attempts to claim active work", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-002", agentId: "agent-alpha" });
    const second = db.claim({ issueRef: "ISS-002", agentId: "agent-beta" });

    expect(second).toMatchObject({
      status: "conflict",
      issueRef: "ISS-002",
      claimedBy: "agent-alpha",
      currentStatus: "claimed",
    });

    const current = db.get("ISS-002");
    expect(current?.agentId).toBe("agent-alpha");
  });

  it("reclaims dropped work for a new owner and logs reclaim detail", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-003", agentId: "agent-alpha", title: "first pass" });
    db.release({ issueRef: "ISS-003", agentId: "agent-alpha", reason: "context switch" });

    const reclaimed = db.claim({
      issueRef: "ISS-003",
      agentId: "agent-beta",
      title: "second pass",
    });

    expect(reclaimed.status).toBe("claimed");
    expect(db.get("ISS-003")?.agentId).toBe("agent-beta");
    expect(db.get("ISS-003")?.status).toBe("claimed");

    const claimedLogs = db.getLog("ISS-003", 10).filter((entry) => entry.action === "claimed");

    expect(claimedLogs).toHaveLength(2);
    expect(claimedLogs[0]?.detail).toContain('"reclaimedFrom":"dropped"');
    expect(claimedLogs[0]?.detail).toContain('"previousAgentId":"agent-alpha"');
  });

  it("requires in-review before done", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-004", agentId: "agent-alpha" });

    expect(() =>
      db.done({
        issueRef: "ISS-004",
        agentId: "agent-alpha",
        prUrl: "https://example.com/pr/4",
      }),
    ).toThrow(/expected in-review/);

    db.status({ issueRef: "ISS-004", agentId: "agent-alpha", status: "in-progress" });
    db.status({ issueRef: "ISS-004", agentId: "agent-alpha", status: "in-review" });

    const done = db.done({
      issueRef: "ISS-004",
      agentId: "agent-alpha",
      prUrl: "https://example.com/pr/4",
      summary: "ready",
    });

    expect(done).toEqual({
      status: "done",
      issueRef: "ISS-004",
      prUrl: "https://example.com/pr/4",
    });
    expect(db.get("ISS-004")?.status).toBe("done");
  });

  it("supports files set/add/remove/check modes", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-FILES-1", agentId: "agent-alpha", worktreePath: fixture.dir });
    db.claim({ issueRef: "ISS-FILES-2", agentId: "agent-beta", worktreePath: fixture.dir });

    db.files({
      mode: "set",
      issueRef: "ISS-FILES-2",
      agentId: "agent-beta",
      paths: ["src/feature/conflict.ts"],
    });

    const setResult = db.files({
      mode: "set",
      issueRef: "ISS-FILES-1",
      agentId: "agent-alpha",
      paths: ["src/a.ts", "src/b.ts"],
    });
    expect(setResult.mode).toBe("set");
    expect(setResult.files).toHaveLength(2);
    expect(setResult.added).toHaveLength(2);
    expect(setResult.removed).toEqual([]);

    const addResult = db.files({
      mode: "add",
      issueRef: "ISS-FILES-1",
      agentId: "agent-alpha",
      paths: ["src/c.ts", "src/a.ts"],
    });
    expect(addResult.mode).toBe("add");
    expect(addResult.files).toHaveLength(3);
    expect(addResult.added).toEqual([path.resolve(fixture.dir, "src/c.ts")]);

    const removeResult = db.files({
      mode: "remove",
      issueRef: "ISS-FILES-1",
      agentId: "agent-alpha",
      paths: ["src/b.ts"],
    });
    expect(removeResult.mode).toBe("remove");
    expect(removeResult.files).toHaveLength(2);
    expect(removeResult.removed).toEqual([path.resolve(fixture.dir, "src/b.ts")]);

    const checkResult = db.files({
      mode: "check",
      path: path.resolve(fixture.dir, "src/feature"),
      excludeAgentId: "agent-alpha",
    });

    expect(checkResult.mode).toBe("check");
    expect(checkResult.hasConflicts).toBe(true);
    expect(checkResult.conflicts).toEqual([
      expect.objectContaining({
        issueRef: "ISS-FILES-2",
        agentId: "agent-beta",
      }),
    ]);
  });

  it("inserts note logs through log()", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-LOG", agentId: "agent-alpha" });
    const result = db.log({
      issueRef: "ISS-LOG",
      agentId: "agent-alpha",
      note: "captured decision",
    });

    expect(result.status).toBe("logged");
    expect(result.logId).toBeGreaterThan(0);

    const log = db.getLog("ISS-LOG", 10);
    expect(log.find((entry) => entry.action === "note")?.detail).toBe("captured decision");
  });

  it("supports query filters and pagination basics", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({
      issueRef: "ISS-Q1",
      agentId: "agent-a",
      squad: "platform",
      priority: "high",
      scope: ["core"],
    });
    db.status({ issueRef: "ISS-Q1", agentId: "agent-a", status: "in-progress" });

    db.claim({
      issueRef: "ISS-Q2",
      agentId: "agent-a",
      squad: "platform",
      priority: "low",
      scope: ["ui"],
    });
    db.release({ issueRef: "ISS-Q2", agentId: "agent-a" });

    db.claim({
      issueRef: "ISS-Q3",
      agentId: "agent-b",
      squad: "infra",
      priority: "critical",
      scope: ["core"],
    });
    db.status({ issueRef: "ISS-Q3", agentId: "agent-b", status: "in-progress" });
    db.status({ issueRef: "ISS-Q3", agentId: "agent-b", status: "in-review" });
    db.done({ issueRef: "ISS-Q3", agentId: "agent-b", prUrl: "https://example.com/pr/3" });

    db.claim({
      issueRef: "ISS-Q4",
      agentId: "agent-c",
      squad: "infra",
      priority: "medium",
      scope: ["core"],
    });

    const active = db.query();
    expect(active.total).toBe(2);
    expect(active.items.every((item) => item.status !== "done" && item.status !== "dropped")).toBe(
      true,
    );

    const platform = db.query({ squad: "platform", activeOnly: false });
    expect(platform.total).toBe(2);

    const byScope = db.query({ scope: "core", activeOnly: false });
    expect(byScope.total).toBe(3);

    const doneOrDropped = db.query({
      status: ["done", "dropped"],
      activeOnly: false,
    });
    expect(doneOrDropped.total).toBe(2);

    const paged = db.query({ activeOnly: false, limit: 1, offset: 1 });
    expect(paged.total).toBe(4);
    expect(paged.items).toHaveLength(1);
  });

  it("enforces owner checks across mutating operations", () => {
    const fixture = makeFixture();
    const db = addDb(fixture);

    db.claim({ issueRef: "ISS-OWN", agentId: "owner", worktreePath: fixture.dir });
    db.status({ issueRef: "ISS-OWN", agentId: "owner", status: "in-progress" });
    db.status({ issueRef: "ISS-OWN", agentId: "owner", status: "in-review" });

    expect(() =>
      db.status({ issueRef: "ISS-OWN", agentId: "intruder", status: "in-progress" }),
    ).toThrow(/Not your work item/);

    expect(() =>
      db.files({
        mode: "add",
        issueRef: "ISS-OWN",
        agentId: "intruder",
        paths: ["src/hack.ts"],
      }),
    ).toThrow(/Not your work item/);

    expect(() => db.log({ issueRef: "ISS-OWN", agentId: "intruder", note: "nope" })).toThrow(
      /Not your work item/,
    );

    expect(() => db.release({ issueRef: "ISS-OWN", agentId: "intruder", reason: "nope" })).toThrow(
      /Not your work item/,
    );

    expect(() =>
      db.done({
        issueRef: "ISS-OWN",
        agentId: "intruder",
        prUrl: "https://example.com/pr/hack",
      }),
    ).toThrow(/Not your work item/);
  });

  it("handles write contention on file-backed WAL DBs and keeps state atomic", () => {
    const base = makeFixture();
    const db1 = addDb(base);
    const db2 = addDb(base);

    const internal1 = db1 as unknown as { db: { exec: (sql: string) => void } };
    const internal2 = db2 as unknown as { db: { exec: (sql: string) => void } };

    // Keep busy waits short so retries are deterministic + fast.
    internal2.db.exec("PRAGMA busy_timeout = 1;");

    internal1.db.exec("BEGIN IMMEDIATE");
    try {
      expect(() => db2.claim({ issueRef: "ISS-LOCK", agentId: "agent-contender" })).toThrow(
        /Database busy, try again/,
      );
    } finally {
      internal1.db.exec("COMMIT");
    }

    // No partial write should exist after failed claim attempt.
    expect(db2.get("ISS-LOCK")).toBeNull();
    expect(db2.getLog("ISS-LOCK", 10)).toEqual([]);

    const claimed = db2.claim({ issueRef: "ISS-LOCK", agentId: "agent-contender" });
    expect(claimed.status).toBe("claimed");

    const fromOtherHandle = db1.get("ISS-LOCK");
    expect(fromOtherHandle?.agentId).toBe("agent-contender");

    const claimedLogs = db1.getLog("ISS-LOCK", 10).filter((entry) => entry.action === "claimed");
    expect(claimedLogs).toHaveLength(1);
  });
});

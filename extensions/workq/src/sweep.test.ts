import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SweepCandidate, WorkqDatabaseApi } from "./types.js";

const execSyncMock = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execSync: execSyncMock }));

import { runWorkqSweep } from "./sweep.js";

function makeCandidate(issueRef: string, status: "claimed" | "in-progress"): SweepCandidate {
  return {
    id: 1,
    issueRef,
    title: null,
    agentId: "agent-1",
    squad: null,
    status,
    branch: null,
    worktreePath: null,
    prUrl: null,
    blockedReason: null,
    priority: "high",
    scope: [],
    tags: [],
    files: [],
    claimedAt: "2026-02-21 00:00:00",
    updatedAt: "2026-02-21 00:00:00",
    claimedSessionKey: "agent:tim:test",
    isStale: true,
    staleMinutes: 180,
  };
}

function createDb(): WorkqDatabaseApi {
  return {
    claim: vi.fn(),
    release: vi.fn(),
    status: vi.fn(),
    query: vi.fn(),
    files: vi.fn(),
    log: vi.fn(),
    done: vi.fn(),
    get: vi.fn(),
    getLog: vi.fn(),
    findStaleActiveItems: vi.fn(),
    autoReleaseBySession: vi.fn(),
    systemMoveToInReview: vi.fn(),
    systemMarkDone: vi.fn(),
    systemReleaseToUnclaimed: vi.fn(),
    systemAnnotate: vi.fn(),
  } as unknown as WorkqDatabaseApi;
}

describe("runWorkqSweep", () => {
  beforeEach(() => {
    execSyncMock.mockReset();
  });

  it("auto-advances to in-review when evidence exists", () => {
    const db = createDb() as any;
    db.findStaleActiveItems.mockReturnValue([
      makeCandidate("openclaw/openclaw#bs-tim-5", "in-progress"),
    ]);
    execSyncMock.mockReturnValue(
      "abc123\x1ffix: reliability\nrefs workq:openclaw/openclaw#bs-tim-5\x1e",
    );

    const result = runWorkqSweep(db, {
      staleAfterMinutes: 120,
      autoDone: false,
      autoRelease: false,
      mode: "apply",
    });

    expect(result.counts["auto-in-review"]).toBe(1);
    expect(db.systemMoveToInReview).toHaveBeenCalledWith(
      expect.objectContaining({ issueRef: "openclaw/openclaw#bs-tim-5" }),
    );
  });

  it("auto-marks done when closes footer exists and --auto-done enabled", () => {
    const db = createDb() as any;
    db.findStaleActiveItems.mockReturnValue([
      makeCandidate("openclaw/openclaw#bs-tim-2", "claimed"),
    ]);
    execSyncMock.mockReturnValue(
      "beef456\x1ffeat: hitl\n\ncloses workq:openclaw/openclaw#bs-tim-2\x1e",
    );

    const result = runWorkqSweep(db, {
      staleAfterMinutes: 120,
      autoDone: true,
      autoRelease: false,
      mode: "apply",
    });

    expect(result.counts["auto-done"]).toBe(1);
    expect(db.systemMarkDone).toHaveBeenCalledWith(
      expect.objectContaining({ issueRef: "openclaw/openclaw#bs-tim-2" }),
    );
  });

  it("auto-releases when no evidence and --auto-release enabled", () => {
    const db = createDb() as any;
    db.findStaleActiveItems.mockReturnValue([
      makeCandidate("openclaw/openclaw#bs-tim-1", "in-progress"),
    ]);
    execSyncMock.mockReturnValue("deadbeef\x1fdocs: update readme\x1e");

    const result = runWorkqSweep(db, {
      staleAfterMinutes: 120,
      autoDone: false,
      autoRelease: true,
      mode: "apply",
    });

    expect(result.counts["auto-release"]).toBe(1);
    expect(db.systemReleaseToUnclaimed).toHaveBeenCalledWith(
      expect.objectContaining({ issueRef: "openclaw/openclaw#bs-tim-1" }),
    );
  });
});

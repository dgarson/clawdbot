import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkqDatabase } from "./database.js";
import { registerWorkqTools } from "./tools.js";
import type { WorkItem, WorkqDatabaseApi } from "./types.js";

type ToolDef = {
  name: string;
  execute: (toolCallId: string, params: unknown) => Promise<unknown>;
};

const tempDirs = new Set<string>();
const dbs: WorkqDatabase[] = [];

afterEach(() => {
  for (const db of dbs.splice(0, dbs.length)) {
    try {
      db.close();
    } catch {
      // no-op cleanup
    }
  }

  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
  tempDirs.clear();
});

function makeApiCapture(db: WorkqDatabaseApi, staleThresholdHours = 24) {
  const registerTool = vi.fn();
  const api = {
    registerTool,
  } as unknown as { registerTool: typeof registerTool };

  registerWorkqTools(api as never, db, staleThresholdHours);

  const [factory, options] = registerTool.mock.calls[0] as [
    (ctx: { agentId?: string | null }) => ToolDef[],
    { optional: boolean; names: string[] },
  ];

  return {
    factory,
    options,
    registerTool,
  };
}

function findTool(tools: ToolDef[], name: string): ToolDef {
  const tool = tools.find((entry) => entry.name === name);
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return tool;
}

function extractPayload(result: unknown): Record<string, unknown> {
  const asRecord = result as Record<string, unknown>;
  if (asRecord?.details && typeof asRecord.details === "object") {
    return asRecord.details as Record<string, unknown>;
  }

  const first = Array.isArray(asRecord?.content)
    ? (asRecord.content[0] as { text?: string } | undefined)
    : undefined;
  if (typeof first?.text === "string") {
    return JSON.parse(first.text) as Record<string, unknown>;
  }

  return asRecord;
}

function makeItem(issueRef: string, agentId: string): WorkItem {
  return {
    id: 1,
    issueRef,
    title: "title",
    agentId,
    squad: "platform",
    status: "claimed",
    branch: null,
    worktreePath: null,
    prUrl: null,
    blockedReason: null,
    priority: "medium",
    scope: [],
    tags: [],
    files: [],
    claimedAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    claimedSessionKey: null,
    isStale: false,
  };
}

describe("registerWorkqTools", () => {
  it("registers all 8 tool names as optional", () => {
    const db: WorkqDatabaseApi = {
      claim: vi.fn(),
      release: vi.fn(),
      status: vi.fn(),
      query: vi.fn(() => ({ items: [], total: 0 })),
      files: vi.fn(() => ({ mode: "check", conflicts: [], hasConflicts: false })),
      log: vi.fn(),
      done: vi.fn(),
      get: vi.fn(() => null),
      getLog: vi.fn(() => []),
      findStaleActiveItems: vi.fn(() => []),
      autoReleaseBySession: vi.fn(() => ({ releasedIssueRefs: [] })),
      systemMoveToInReview: vi.fn(),
      systemMarkDone: vi.fn(),
      systemReleaseToUnclaimed: vi.fn(),
      systemAnnotate: vi.fn(),
    };

    const { factory, options } = makeApiCapture(db);
    const tools = factory({ agentId: "agent-a" });

    const names = tools.map((tool) => tool.name).sort();
    expect(names).toEqual([
      "workq_claim",
      "workq_done",
      "workq_export",
      "workq_files",
      "workq_log",
      "workq_query",
      "workq_release",
      "workq_status",
    ]);

    expect(options).toEqual({
      optional: true,
      names: [
        "workq_claim",
        "workq_release",
        "workq_status",
        "workq_query",
        "workq_files",
        "workq_log",
        "workq_done",
        "workq_export",
      ],
    });
  });

  it("binds ownership to ctx.agentId and ignores spoofed params", async () => {
    const db: WorkqDatabaseApi = {
      claim: vi.fn(() => ({
        status: "conflict",
        issueRef: "ISS-AGENT",
        claimedBy: "owner",
        claimedAt: "2026-01-01 00:00:00",
        currentStatus: "claimed",
      })),
      release: vi.fn(),
      status: vi.fn(),
      query: vi.fn(() => ({ items: [], total: 0 })),
      files: vi.fn(() => ({ mode: "check", conflicts: [], hasConflicts: false })),
      log: vi.fn(),
      done: vi.fn(),
      get: vi.fn(() => null),
      getLog: vi.fn(() => []),
      findStaleActiveItems: vi.fn(() => []),
      autoReleaseBySession: vi.fn(() => ({ releasedIssueRefs: [] })),
      systemMoveToInReview: vi.fn(),
      systemMarkDone: vi.fn(),
      systemReleaseToUnclaimed: vi.fn(),
      systemAnnotate: vi.fn(),
    };

    const { factory } = makeApiCapture(db);
    const claimTool = findTool(factory({ agentId: "ctx-agent" }), "workq_claim");

    await claimTool.execute("tc-1", {
      issue_ref: "ISS-AGENT",
      agent_id: "spoofed-agent",
    });

    expect(db.claim).toHaveBeenCalledWith(
      expect.objectContaining({
        issueRef: "ISS-AGENT",
        agentId: "ctx-agent",
      }),
    );
  });

  it("returns claim conflict payload with expected shape", async () => {
    const db: WorkqDatabaseApi = {
      claim: vi.fn(() => ({
        status: "conflict",
        issueRef: "ISS-CONFLICT",
        claimedBy: "agent-1",
        claimedAt: "2026-01-01 00:00:00",
        currentStatus: "in-progress",
      })),
      release: vi.fn(),
      status: vi.fn(),
      query: vi.fn(() => ({ items: [], total: 0 })),
      files: vi.fn(() => ({ mode: "check", conflicts: [], hasConflicts: false })),
      log: vi.fn(),
      done: vi.fn(),
      get: vi.fn(() => null),
      getLog: vi.fn(() => []),
      findStaleActiveItems: vi.fn(() => []),
      autoReleaseBySession: vi.fn(() => ({ releasedIssueRefs: [] })),
      systemMoveToInReview: vi.fn(),
      systemMarkDone: vi.fn(),
      systemReleaseToUnclaimed: vi.fn(),
      systemAnnotate: vi.fn(),
    };

    const { factory } = makeApiCapture(db);
    const claimTool = findTool(factory({ agentId: "ctx-agent" }), "workq_claim");

    const result = await claimTool.execute("tc-2", { issue_ref: "ISS-CONFLICT" });
    const payload = extractPayload(result);

    expect(payload).toEqual({
      status: "conflict",
      issue_ref: "ISS-CONFLICT",
      claimed_by: "agent-1",
      claimed_at: "2026-01-01 00:00:00",
      current_status: "in-progress",
    });
  });

  it("covers files modes at tool layer (check/set/add/remove)", async () => {
    const db: WorkqDatabaseApi = {
      claim: vi.fn(),
      release: vi.fn(),
      status: vi.fn(),
      query: vi.fn(() => ({ items: [], total: 0 })),
      files: vi.fn((input) => {
        if (input.mode === "check") {
          return {
            mode: "check",
            hasConflicts: true,
            conflicts: [
              {
                issueRef: "ISS-X",
                agentId: "agent-x",
                status: "in-progress",
                matchingFiles: ["/tmp/work/src/a.ts"],
              },
            ],
          };
        }

        if (input.mode === "set") {
          return {
            mode: "set",
            hasConflicts: false,
            conflicts: [],
            files: ["/tmp/work/src/a.ts"],
            added: ["/tmp/work/src/a.ts"],
            removed: [],
          };
        }

        if (input.mode === "add") {
          return {
            mode: "add",
            hasConflicts: false,
            conflicts: [],
            files: ["/tmp/work/src/a.ts", "/tmp/work/src/b.ts"],
            added: ["/tmp/work/src/b.ts"],
            removed: [],
          };
        }

        return {
          mode: "remove",
          hasConflicts: false,
          conflicts: [],
          files: ["/tmp/work/src/b.ts"],
          added: [],
          removed: ["/tmp/work/src/a.ts"],
        };
      }),
      log: vi.fn(),
      done: vi.fn(),
      get: vi.fn(() => makeItem("ISS-FILES", "ctx-agent")),
      getLog: vi.fn(() => []),
      findStaleActiveItems: vi.fn(() => []),
      autoReleaseBySession: vi.fn(() => ({ releasedIssueRefs: [] })),
      systemMoveToInReview: vi.fn(),
      systemMarkDone: vi.fn(),
      systemReleaseToUnclaimed: vi.fn(),
      systemAnnotate: vi.fn(),
    };

    const { factory } = makeApiCapture(db);
    const filesTool = findTool(factory({ agentId: "ctx-agent" }), "workq_files");

    const checkPayload = extractPayload(
      await filesTool.execute("tc-files-check", {
        mode: "check",
        path: "/tmp/work/src/a.ts",
        exclude_self: true,
      }),
    );
    expect(checkPayload).toMatchObject({
      mode: "check",
      has_conflicts: true,
      conflicts: [
        {
          issue_ref: "ISS-X",
          agent_id: "agent-x",
          status: "in-progress",
          matching_files: ["/tmp/work/src/a.ts"],
        },
      ],
    });

    const setPayload = extractPayload(
      await filesTool.execute("tc-files-set", {
        mode: "set",
        issue_ref: "ISS-FILES",
        paths: ["src/a.ts"],
      }),
    );
    expect(setPayload).toMatchObject({
      mode: "set",
      has_conflicts: false,
      files: ["/tmp/work/src/a.ts"],
      added: ["/tmp/work/src/a.ts"],
      removed: [],
    });

    const addPayload = extractPayload(
      await filesTool.execute("tc-files-add", {
        mode: "add",
        issue_ref: "ISS-FILES",
        paths: ["src/b.ts"],
      }),
    );
    expect(addPayload).toMatchObject({
      mode: "add",
      files: ["/tmp/work/src/a.ts", "/tmp/work/src/b.ts"],
      added: ["/tmp/work/src/b.ts"],
    });

    const removePayload = extractPayload(
      await filesTool.execute("tc-files-remove", {
        mode: "remove",
        issue_ref: "ISS-FILES",
        paths: ["src/a.ts"],
      }),
    );
    expect(removePayload).toMatchObject({
      mode: "remove",
      files: ["/tmp/work/src/b.ts"],
      removed: ["/tmp/work/src/a.ts"],
    });

    expect(db.files).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        mode: "check",
        path: "/tmp/work/src/a.ts",
        excludeAgentId: "ctx-agent",
      }),
    );

    expect(db.files).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        mode: "set",
        issueRef: "ISS-FILES",
        agentId: "ctx-agent",
      }),
    );

    expect(db.files).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({
        mode: "add",
        issueRef: "ISS-FILES",
        agentId: "ctx-agent",
      }),
    );

    expect(db.files).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({
        mode: "remove",
        issueRef: "ISS-FILES",
        agentId: "ctx-agent",
      }),
    );
  });

  it("returns export content + state from workq_export", async () => {
    const dir = mkdtempSync(path.join(os.tmpdir(), "workq-tools-export-"));
    tempDirs.add(dir);

    const db = new WorkqDatabase(path.join(dir, "workq.sqlite"));
    dbs.push(db);

    db.claim({
      issueRef: "ISS-EXPORT",
      agentId: "agent-export",
      title: "Export me",
      squad: "platform",
      scope: ["core"],
      tags: ["testing"],
    });
    db.log({ issueRef: "ISS-EXPORT", agentId: "agent-export", note: "note for export" });

    const { factory } = makeApiCapture(db, 24);
    const exportTool = findTool(factory({ agentId: "agent-export" }), "workq_export");

    const payload = extractPayload(
      await exportTool.execute("tc-export", {
        format: "json",
        include_done: true,
        include_log: true,
      }),
    );

    expect(payload.format).toBe("json");
    expect(typeof payload.generated_at).toBe("string");
    expect(typeof payload.content).toBe("string");

    const state = payload.state as {
      counts?: { total?: number };
      items?: Array<{ issueRef?: string }>;
    };

    expect(state.counts?.total).toBeGreaterThanOrEqual(1);
    expect(state.items?.some((item) => item.issueRef === "ISS-EXPORT")).toBe(true);
    expect(String(payload.content)).toContain("ISS-EXPORT");
  });
});

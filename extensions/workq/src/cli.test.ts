import { Command } from "commander";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerWorkqCli } from "./cli.js";
import type { WorkItem } from "./types.js";

function makeItem(overrides: Partial<WorkItem> = {}): WorkItem {
  return {
    id: 1,
    issueRef: "acme/repo#1",
    title: "Example task",
    agentId: "agent-1",
    squad: "core",
    status: "claimed",
    branch: null,
    worktreePath: null,
    prUrl: null,
    blockedReason: null,
    priority: "high",
    scope: [],
    tags: [],
    files: [],
    claimedAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
    claimedSessionKey: null,
    isStale: false,
    ...overrides,
  };
}

function createDbMock() {
  return {
    claim: vi.fn(() => ({ status: "claimed", item: makeItem() })),
    release: vi.fn(() => ({ status: "dropped", issueRef: "acme/repo#1" })),
    status: vi.fn(() => ({
      status: "updated",
      issueRef: "acme/repo#1",
      from: "claimed",
      to: "blocked",
    })),
    query: vi.fn(() => ({ items: [], total: 0 })),
    files: vi.fn(() => ({ mode: "check", conflicts: [], hasConflicts: false })),
    log: vi.fn(() => ({ status: "logged", issueRef: "acme/repo#1", logId: 1 })),
    done: vi.fn(() => ({
      status: "done",
      issueRef: "acme/repo#1",
      prUrl: "https://example.com/pr/1",
    })),
    get: vi.fn(() => null),
    getLog: vi.fn(() => []),
    findStaleActiveItems: vi.fn(() => []),
    autoReleaseBySession: vi.fn(() => ({ releasedIssueRefs: [] })),
    systemMoveToInReview: vi.fn(),
    systemMarkDone: vi.fn(),
    systemReleaseToUnclaimed: vi.fn(),
    systemAnnotate: vi.fn(),
  };
}

function setup(staleThresholdHours = 24) {
  const registrations: Array<{ build: (ctx: { program: Command }) => void; meta: unknown }> = [];
  const api = {
    registerCli: vi.fn((build: (ctx: { program: Command }) => void, meta: unknown) => {
      registrations.push({ build, meta });
    }),
  };

  const db = createDbMock();
  registerWorkqCli(api as never, db as never, staleThresholdHours);

  expect(registrations).toHaveLength(1);

  const program = new Command();
  program.exitOverride();
  registrations[0].build({ program });

  return { api, db, program, registration: registrations[0] };
}

async function run(program: Command, args: string[]) {
  process.exitCode = 0;
  await program.parseAsync(["node", "workq-test", ...args]);
}

describe("registerWorkqCli", () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.exitCode = 0;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = 0;
  });

  it("registers a workq command tree with expected key subcommands", () => {
    const { api, program, registration } = setup();

    expect(api.registerCli).toHaveBeenCalledTimes(1);
    expect(registration.meta).toEqual({ commands: ["workq"] });

    const workq = program.commands.find((cmd) => cmd.name() === "workq");
    expect(workq).toBeDefined();

    const subcommands = workq!.commands.map((cmd) => cmd.name());
    expect(subcommands).toEqual(
      expect.arrayContaining(["list", "claim", "status", "release", "done", "files", "export"]),
    );

    const files = workq!.commands.find((cmd) => cmd.name() === "files");
    expect(files).toBeDefined();
    expect(files!.commands.map((cmd) => cmd.name())).toEqual(
      expect.arrayContaining(["check", "set"]),
    );
  });

  it("invokes db.query for list with parsed filters", async () => {
    const { db, program } = setup();

    await run(program, [
      "workq",
      "list",
      "--squad",
      "platform",
      "--status",
      "claimed,blocked",
      "--agent",
      "agent-7",
      "--priority",
      "critical,high",
      "--scope",
      "gateway",
      "--updated-after",
      "2026-01-02T03:04:05Z",
      "--updated-before",
      "2026-01-03T00:00:00Z",
      "--limit",
      "10",
      "--offset",
      "20",
      "--all",
    ]);

    expect(db.query).toHaveBeenCalledWith({
      squad: "platform",
      status: ["claimed", "blocked"],
      agentId: "agent-7",
      priority: ["critical", "high"],
      scope: "gateway",
      activeOnly: false,
      updatedAfter: "2026-01-02 03:04:05",
      updatedBefore: "2026-01-03 00:00:00",
      limit: 10,
      offset: 20,
      staleThresholdHours: 24,
    });
  });

  it("invokes db.claim for claim flow", async () => {
    const { db, program } = setup();

    await run(program, [
      "workq",
      "claim",
      "acme/repo#42",
      "--agent",
      "agent-9",
      "--squad",
      "core",
      "--title",
      "Fix race condition",
      "--priority",
      "critical",
      "--scope",
      "db,cli",
      "--files",
      "src/db.ts,src/cli.ts",
      "--branch",
      "feat/workq-42",
      "--worktree",
      "/tmp/workq-42",
      "--reopen",
    ]);

    expect(db.claim).toHaveBeenCalledWith({
      issueRef: "acme/repo#42",
      agentId: "agent-9",
      squad: "core",
      title: "Fix race condition",
      priority: "critical",
      scope: ["db", "cli"],
      files: ["src/db.ts", "src/cli.ts"],
      branch: "feat/workq-42",
      worktreePath: "/tmp/workq-42",
      reopen: true,
    });
  });

  it("invokes db.status for status --set flow", async () => {
    const { db, program } = setup();

    await run(program, [
      "workq",
      "status",
      "acme/repo#7",
      "--set",
      "blocked",
      "--reason",
      "waiting on API contract",
      "--pr",
      "https://example.com/pr/7",
      "--agent",
      "agent-7",
    ]);

    expect(db.status).toHaveBeenCalledWith({
      issueRef: "acme/repo#7",
      agentId: "agent-7",
      status: "blocked",
      reason: "waiting on API contract",
      prUrl: "https://example.com/pr/7",
    });
  });

  it("invokes db.release for release flow", async () => {
    const { db, program } = setup();

    await run(program, [
      "workq",
      "release",
      "acme/repo#8",
      "--agent",
      "agent-8",
      "--reason",
      "handoff",
    ]);

    expect(db.release).toHaveBeenCalledWith({
      issueRef: "acme/repo#8",
      agentId: "agent-8",
      reason: "handoff",
    });
  });

  it("invokes db.done for done flow", async () => {
    const { db, program } = setup();

    await run(program, [
      "workq",
      "done",
      "acme/repo#9",
      "--agent",
      "agent-9",
      "--pr",
      "https://example.com/pr/9",
      "--summary",
      "shipped",
    ]);

    expect(db.done).toHaveBeenCalledWith({
      issueRef: "acme/repo#9",
      agentId: "agent-9",
      prUrl: "https://example.com/pr/9",
      summary: "shipped",
    });
  });

  it("invokes db.files for files check and set flows", async () => {
    const check = setup();
    check.db.files.mockReturnValue({ mode: "check", conflicts: [], hasConflicts: false });

    await run(check.program, [
      "workq",
      "files",
      "check",
      "--path",
      "src/cli.ts",
      "--exclude-self",
      "--agent",
      "agent-3",
    ]);

    expect(check.db.files).toHaveBeenCalledWith({
      mode: "check",
      path: "src/cli.ts",
      excludeAgentId: "agent-3",
    });

    const set = setup();
    set.db.files.mockReturnValue({
      mode: "set",
      conflicts: [],
      hasConflicts: false,
      files: ["src/cli.ts", "src/types.ts"],
      added: ["src/types.ts"],
      removed: [],
    });

    await run(set.program, [
      "workq",
      "files",
      "set",
      "acme/repo#10",
      "--paths",
      "src/cli.ts,src/types.ts",
      "--agent",
      "agent-3",
    ]);

    expect(set.db.files).toHaveBeenCalledWith({
      mode: "set",
      issueRef: "acme/repo#10",
      paths: ["src/cli.ts", "src/types.ts"],
      agentId: "agent-3",
    });
  });

  it("supports export in json format", async () => {
    const { db, program } = setup();

    await run(program, ["workq", "export", "--format", "json"]);

    expect(db.query).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true, limit: 200, offset: 0, staleThresholdHours: 24 }),
    );

    const rendered = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(() => JSON.parse(rendered)).not.toThrow();
  });

  it("supports export in markdown format", async () => {
    const { db, program } = setup();

    await run(program, ["workq", "export", "--format", "markdown"]);

    expect(db.query).toHaveBeenCalledWith(
      expect.objectContaining({ activeOnly: true, limit: 200, offset: 0, staleThresholdHours: 24 }),
    );

    const rendered = String(logSpy.mock.calls.at(-1)?.[0] ?? "");
    expect(rendered).toContain("# WorkQ Export");
  });

  it("sets non-zero exitCode and prints error for validation failures", async () => {
    const { program } = setup();

    await run(program, ["workq", "list", "--limit", "0"]);

    expect(process.exitCode).toBe(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("[workq] --limit must be >= 1"));
  });
});

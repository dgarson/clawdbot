import { beforeEach, describe, expect, it, vi } from "vitest";

const mocked = vi.hoisted(() => {
  const dbClose = vi.fn();
  const dbClaim = vi.fn();
  const dbRelease = vi.fn();
  const dbQuery = vi.fn();
  const dbStatus = vi.fn();
  const dbDone = vi.fn();
  const dbFiles = vi.fn();
  const dbLog = vi.fn();

  const WorkqDatabase = vi.fn(() => ({
    close: dbClose,
    claim: dbClaim,
    release: dbRelease,
    query: dbQuery,
    status: dbStatus,
    done: dbDone,
    files: dbFiles,
    log: dbLog,
  }));

  const registerWorkqTools = vi.fn();
  const registerWorkqCli = vi.fn();

  return {
    dbClose,
    dbClaim,
    dbRelease,
    dbQuery,
    dbStatus,
    dbDone,
    dbFiles,
    dbLog,
    WorkqDatabase,
    registerWorkqTools,
    registerWorkqCli,
  };
});

vi.mock("./src/database.js", () => ({
  WorkqDatabase: mocked.WorkqDatabase,
}));

vi.mock("./src/tools.js", () => ({
  registerWorkqTools: mocked.registerWorkqTools,
}));

vi.mock("./src/cli.js", () => ({
  registerWorkqCli: mocked.registerWorkqCli,
}));

import register from "./index.js";

type GatewayHandler = (ctx: {
  params?: Record<string, unknown>;
  respond: (ok: boolean, payload?: unknown) => void;
}) => Promise<void>;

describe("workq index integration", () => {
  beforeEach(() => {
    mocked.dbClose.mockReset();
    mocked.dbClaim.mockReset();
    mocked.dbRelease.mockReset();
    mocked.dbQuery.mockReset();
    mocked.dbStatus.mockReset();
    mocked.dbDone.mockReset();
    mocked.dbFiles.mockReset();
    mocked.dbLog.mockReset();
    mocked.WorkqDatabase.mockClear();
    mocked.registerWorkqTools.mockClear();
    mocked.registerWorkqCli.mockClear();
  });

  it("wires tools, cli, service, and gateway methods", () => {
    const registerService = vi.fn();
    const registerGatewayMethod = vi.fn();
    const logger = { info: vi.fn() };

    const api = {
      pluginConfig: {
        dbPath: "~/custom/workq.db",
        staleThresholdHours: 24,
      },
      resolvePath: vi.fn(() => "/tmp/custom/workq.db"),
      logger,
      registerService,
      registerGatewayMethod,
    };

    register(api as never);

    expect(api.resolvePath).toHaveBeenCalledWith("~/custom/workq.db");
    expect(mocked.WorkqDatabase).toHaveBeenCalledWith("/tmp/custom/workq.db");
    const dbInstance = mocked.WorkqDatabase.mock.results[0]?.value;

    expect(mocked.registerWorkqTools).toHaveBeenCalledWith(api, dbInstance, 24);
    expect(mocked.registerWorkqCli).toHaveBeenCalledWith(api, dbInstance, 24);

    expect(registerGatewayMethod).toHaveBeenCalledTimes(7);
    expect(registerGatewayMethod.mock.calls.map((call) => call[0])).toEqual(
      expect.arrayContaining([
        "workq.claim",
        "workq.release",
        "workq.query",
        "workq.status",
        "workq.done",
        "workq.files",
        "workq.log",
      ]),
    );

    expect(registerService).toHaveBeenCalledTimes(1);
    const service = registerService.mock.calls[0]?.[0] as {
      start: () => void;
      stop: () => void;
      id: string;
    };
    expect(service.id).toBe("workq");

    service.start();
    expect(logger.info).toHaveBeenCalledWith("[workq] Ready — db: /tmp/custom/workq.db");

    service.stop();
    expect(mocked.dbClose).toHaveBeenCalledTimes(1);
  });

  it("routes gateway handler args to matching db calls", async () => {
    const registerGatewayMethod = vi.fn();
    const api = {
      pluginConfig: {},
      resolvePath: vi.fn(() => "/tmp/workq.db"),
      logger: { info: vi.fn() },
      registerService: vi.fn(),
      registerGatewayMethod,
    };

    register(api as never);

    const handlers = new Map<string, GatewayHandler>(
      registerGatewayMethod.mock.calls.map(([name, handler]) => [name, handler as GatewayHandler]),
    );

    mocked.dbClaim.mockReturnValue({ status: "claimed" });
    const claimRespond = vi.fn();
    await handlers.get("workq.claim")?.({
      params: {
        issue_ref: "repo/1",
        agent_id: "agent-1",
        files: ["a.ts", "a.ts", "b.ts"],
        scope: ["api"],
        tags: ["infra"],
      },
      respond: claimRespond,
    });
    expect(mocked.dbClaim).toHaveBeenCalledWith({
      issueRef: "repo/1",
      agentId: "agent-1",
      title: undefined,
      squad: undefined,
      files: ["a.ts", "b.ts"],
      branch: undefined,
      worktreePath: undefined,
      priority: undefined,
      scope: ["api"],
      tags: ["infra"],
      reopen: undefined,
    });
    expect(claimRespond).toHaveBeenCalledWith(true, { status: "claimed" });

    mocked.dbRelease.mockReturnValue({ status: "dropped" });
    const releaseRespond = vi.fn();
    await handlers.get("workq.release")?.({
      params: { issue_ref: "repo/1", agent_id: "agent-1" },
      respond: releaseRespond,
    });
    expect(mocked.dbRelease).toHaveBeenCalledWith({
      issueRef: "repo/1",
      agentId: "agent-1",
      reason: undefined,
    });
    expect(releaseRespond).toHaveBeenCalledWith(true, { status: "dropped" });

    mocked.dbQuery.mockReturnValue({ items: [], total: 0 });
    const queryRespond = vi.fn();
    await handlers.get("workq.query")?.({
      params: {
        status: ["claimed", "in-progress"],
        priority: "high",
        active_only: true,
        limit: 10,
      },
      respond: queryRespond,
    });
    expect(mocked.dbQuery).toHaveBeenCalledWith({
      squad: undefined,
      agentId: undefined,
      status: ["claimed", "in-progress"],
      priority: "high",
      scope: undefined,
      issueRef: undefined,
      activeOnly: true,
      updatedAfter: undefined,
      updatedBefore: undefined,
      limit: 10,
      offset: undefined,
      staleThresholdHours: 24,
    });
    expect(queryRespond).toHaveBeenCalledWith(true, { items: [], total: 0 });

    mocked.dbStatus.mockReturnValue({
      status: "updated",
      issueRef: "repo/1",
      from: "claimed",
      to: "in-progress",
    });
    const statusRespond = vi.fn();
    await handlers.get("workq.status")?.({
      params: {
        issue_ref: "repo/1",
        agent_id: "agent-1",
        status: "in-progress",
      },
      respond: statusRespond,
    });
    expect(mocked.dbStatus).toHaveBeenCalledWith({
      issueRef: "repo/1",
      agentId: "agent-1",
      status: "in-progress",
      reason: undefined,
      prUrl: undefined,
    });
    expect(statusRespond).toHaveBeenCalledWith(true, {
      status: "updated",
      issueRef: "repo/1",
      from: "claimed",
      to: "in-progress",
    });

    mocked.dbDone.mockReturnValue({
      status: "done",
      issueRef: "repo/1",
      prUrl: "https://example.com/pr",
    });
    const doneRespond = vi.fn();
    await handlers.get("workq.done")?.({
      params: {
        issue_ref: "repo/1",
        agent_id: "agent-1",
        pr_url: "https://example.com/pr",
      },
      respond: doneRespond,
    });
    expect(mocked.dbDone).toHaveBeenCalledWith({
      issueRef: "repo/1",
      agentId: "agent-1",
      prUrl: "https://example.com/pr",
      summary: undefined,
    });
    expect(doneRespond).toHaveBeenCalledWith(true, {
      status: "done",
      issueRef: "repo/1",
      prUrl: "https://example.com/pr",
    });

    mocked.dbFiles.mockReturnValue({ mode: "check", conflicts: [], hasConflicts: false });
    const filesRespond = vi.fn();
    await handlers.get("workq.files")?.({
      params: { mode: "add", issue_ref: "repo/1", paths: ["a.ts", "a.ts"], agent_id: "agent-1" },
      respond: filesRespond,
    });
    expect(mocked.dbFiles).toHaveBeenCalledWith({
      mode: "add",
      issueRef: "repo/1",
      path: undefined,
      paths: ["a.ts"],
      agentId: "agent-1",
      excludeAgentId: undefined,
    });
    expect(filesRespond).toHaveBeenCalledWith(true, {
      mode: "check",
      conflicts: [],
      hasConflicts: false,
    });

    mocked.dbLog.mockReturnValue({ status: "logged", issueRef: "repo/1", logId: 3 });
    const logRespond = vi.fn();
    await handlers.get("workq.log")?.({
      params: {
        issue_ref: "repo/1",
        agent_id: "agent-1",
        note: "work done",
      },
      respond: logRespond,
    });
    expect(mocked.dbLog).toHaveBeenCalledWith({
      issueRef: "repo/1",
      agentId: "agent-1",
      note: "work done",
    });
    expect(logRespond).toHaveBeenCalledWith(true, {
      status: "logged",
      issueRef: "repo/1",
      logId: 3,
    });
  });

  it("returns error payloads when database methods throw", async () => {
    const registerGatewayMethod = vi.fn();
    const api = {
      pluginConfig: {},
      resolvePath: vi.fn(() => "/tmp/workq.db"),
      logger: { info: vi.fn() },
      registerService: vi.fn(),
      registerGatewayMethod,
    };

    register(api as never);

    const handlers = new Map<string, GatewayHandler>(
      registerGatewayMethod.mock.calls.map(([name, handler]) => [name, handler as GatewayHandler]),
    );

    mocked.dbClaim.mockImplementation(() => {
      throw new Error("claim failed");
    });

    const respond = vi.fn();
    await handlers.get("workq.claim")?.({
      params: { issue_ref: "repo/1", agent_id: "agent-1" },
      respond,
    });

    expect(respond).toHaveBeenCalledWith(false, { error: "claim failed" });
  });

  it("does not initialize when disabled", () => {
    const api = {
      pluginConfig: { enabled: false },
      resolvePath: vi.fn(),
      logger: { info: vi.fn() },
      registerService: vi.fn(),
      registerGatewayMethod: vi.fn(),
    };

    register(api as never);

    expect(mocked.WorkqDatabase).not.toHaveBeenCalled();
    expect(mocked.registerWorkqTools).not.toHaveBeenCalled();
    expect(mocked.registerWorkqCli).not.toHaveBeenCalled();
    expect(api.registerGatewayMethod).not.toHaveBeenCalled();
    expect(api.registerService).not.toHaveBeenCalled();
    expect(api.logger.info).toHaveBeenCalledWith("[workq] Disabled by config");
  });
});

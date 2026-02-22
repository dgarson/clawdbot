import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerWorkqCli } from "./src/cli.js";
import { WorkqDatabase } from "./src/database.js";
import { runWorkqSweep } from "./src/sweep.js";
import { registerWorkqTools } from "./src/tools.js";
import type {
  ClaimInput,
  DoneInput,
  FilesInput,
  FilesMode,
  LogInput,
  QueryFilters,
  ReleaseInput,
  StatusInput,
} from "./src/types.js";

// Process-level DB registry so multiple loadOpenClawPlugins calls (per-workspaceDir)
// share a single WorkqDatabase connection rather than opening one per cache miss.
// Symbol.for() keys survive jiti's per-call module isolation.
const _WORKQ_DB_KEY = Symbol.for("openclaw.workq.db.v1");

type _WorkqDbMap = Map<string, WorkqDatabase>;

function _getWorkqDbMap(): _WorkqDbMap {
  const g = globalThis as unknown as { [k: symbol]: unknown };
  if (!g[_WORKQ_DB_KEY]) {
    g[_WORKQ_DB_KEY] = new Map<string, WorkqDatabase>();
  }
  return g[_WORKQ_DB_KEY] as _WorkqDbMap;
}

function _acquireDb(resolvedPath: string): WorkqDatabase {
  const map = _getWorkqDbMap();
  const existing = map.get(resolvedPath);
  if (existing) {
    return existing;
  }
  const db = new WorkqDatabase(resolvedPath);
  map.set(resolvedPath, db);
  return db;
}

function _releaseDb(resolvedPath: string): void {
  const map = _getWorkqDbMap();
  const db = map.get(resolvedPath);
  if (!db) {
    return;
  }
  db.close();
  map.delete(resolvedPath);
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.trunc(value);
}

function asBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const values = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0);
  return [...new Set(values)];
}

function asStringOrList(value: unknown): string | string[] | undefined {
  if (Array.isArray(value)) {
    const list = asStringArray(value);
    return list.length ? list : undefined;
  }
  return asString(value);
}

function asErrorPayload(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) };
}

export default function register(api: OpenClawPluginApi) {
  const config = (api.pluginConfig ?? {}) as {
    enabled?: boolean;
    dbPath?: string;
    staleThresholdHours?: number;
    sweepIntervalMinutes?: number;
    sweepStaleAfterMinutes?: number;
    sweepAutoDone?: boolean;
    sweepAutoRelease?: boolean;
  };

  if (config.enabled === false) {
    api.logger.info("[workq] Disabled by config");
    return;
  }

  const dbPath = api.resolvePath(config.dbPath ?? "~/.openclaw/workq/workq.db");
  const resolvedDbPath = path.resolve(dbPath);
  const staleHours = Math.max(1, Math.floor(config.staleThresholdHours ?? 24));
  const sweepIntervalMinutes = Math.max(1, Math.floor(config.sweepIntervalMinutes ?? 60));
  const sweepStaleAfterMinutes = Math.max(1, Math.floor(config.sweepStaleAfterMinutes ?? 120));
  const sweepAutoDone = config.sweepAutoDone === true;
  const sweepAutoRelease = config.sweepAutoRelease !== false;

  // Reuse the process-level shared connection for this dbPath (see _acquireDb above).
  // This prevents multiple DatabaseSync connections when loadOpenClawPlugins is called
  // for different workspaceDirs (each would otherwise call register() and open a new DB).
  const db = _acquireDb(resolvedDbPath);
  registerWorkqTools(api, db, staleHours);
  registerWorkqCli(api, db, staleHours);

  api.registerGatewayMethod("workq.claim", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: ClaimInput = {
        issueRef: asString(input.issue_ref) ?? "",
        agentId: asString(input.agent_id) ?? "",
        title: asString(input.title),
        squad: asString(input.squad),
        files: asStringArray(input.files),
        branch: asString(input.branch),
        worktreePath: asString(input.worktree_path),
        priority: asString(input.priority) as ClaimInput["priority"],
        scope: asStringArray(input.scope),
        tags: asStringArray(input.tags),
        reopen: asBoolean(input.reopen),
        sessionKey: asString(input.session_key),
      };
      respond(true, db.claim(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.release", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: ReleaseInput = {
        issueRef: asString(input.issue_ref) ?? "",
        agentId: asString(input.agent_id) ?? "",
        reason: asString(input.reason),
      };
      respond(true, db.release(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.query", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: QueryFilters = {
        squad: asString(input.squad),
        agentId: asString(input.agent_id),
        status: asStringOrList(input.status),
        priority: asStringOrList(input.priority),
        scope: asString(input.scope),
        issueRef: asString(input.issue_ref),
        activeOnly: asBoolean(input.active_only),
        updatedAfter: asString(input.updated_after),
        updatedBefore: asString(input.updated_before),
        limit: asNumber(input.limit),
        offset: asNumber(input.offset),
        staleThresholdHours: staleHours,
      };
      respond(true, db.query(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.status", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: StatusInput = {
        issueRef: asString(input.issue_ref) ?? "",
        agentId: asString(input.agent_id) ?? "",
        status: asString(input.status) as StatusInput["status"],
        reason: asString(input.reason),
        prUrl: asString(input.pr_url),
      };
      respond(true, db.status(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.done", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: DoneInput = {
        issueRef: asString(input.issue_ref) ?? "",
        agentId: asString(input.agent_id) ?? "",
        prUrl: asString(input.pr_url) ?? "",
        summary: asString(input.summary),
      };
      respond(true, db.done(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.files", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: FilesInput = {
        mode: (asString(input.mode) as FilesMode) ?? "check",
        issueRef: asString(input.issue_ref),
        path: asString(input.path),
        paths: asStringArray(input.paths),
        agentId: asString(input.agent_id),
        excludeAgentId: asBoolean(input.exclude_self)
          ? (asString(input.agent_id) ?? undefined)
          : asString(input.exclude_agent_id),
      };
      respond(true, db.files(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.registerGatewayMethod("workq.log", async ({ params, respond }) => {
    try {
      const input = asRecord(params);
      const payload: LogInput = {
        issueRef: asString(input.issue_ref) ?? "",
        agentId: asString(input.agent_id) ?? "",
        note: asString(input.note) ?? "",
      };
      respond(true, db.log(payload));
    } catch (error) {
      respond(false, asErrorPayload(error));
    }
  });

  api.on("agent_end", async (_event, ctx) => {
    const sessionKey = asString(ctx?.sessionKey);
    if (!sessionKey) {
      return;
    }

    try {
      const result = db.autoReleaseBySession({
        sessionKey,
        actorId: "system:agent_end_hook",
        reason: "auto-released: session ended without workq_done",
      });
      if (result.releasedIssueRefs.length > 0) {
        api.logger.warn(
          `[workq] agent_end auto-release session=${sessionKey} released=${result.releasedIssueRefs.join(",")}`,
        );
      }
    } catch (error) {
      api.logger.warn(`[workq] agent_end auto-release failed: ${String(error)}`);
    }
  });

  api.on("session_end", async (_event, ctx) => {
    const sessionKey = asString(ctx?.sessionId);
    if (!sessionKey) {
      return;
    }

    // session_end context exposes sessionId, while claims are keyed by sessionKey.
    // Keep a best-effort no-op hook for now; agent_end handles deterministic release.
    api.logger.debug?.(`[workq] session_end observed sessionId=${sessionKey}`);
  });

  let sweepTimer: ReturnType<typeof setInterval> | null = null;

  const runScheduledSweep = () => {
    try {
      const result = runWorkqSweep(db, {
        staleAfterMinutes: sweepStaleAfterMinutes,
        autoDone: sweepAutoDone,
        autoRelease: sweepAutoRelease,
        mode: "apply",
        actorId: "system:workq-sweep-cron",
      });

      const changed =
        result.counts["auto-done"] +
        result.counts["auto-in-review"] +
        result.counts["auto-release"] +
        result.counts["annotate-stale"];

      if (changed > 0) {
        api.logger.warn(
          `[workq] sweep reconciled=${changed} candidates=${result.totalCandidates} ` +
            `(done=${result.counts["auto-done"]}, review=${result.counts["auto-in-review"]}, release=${result.counts["auto-release"]})`,
        );
      }
    } catch (error) {
      api.logger.warn(`[workq] scheduled sweep failed: ${String(error)}`);
    }
  };

  api.registerService({
    id: "workq",
    start: () => {
      api.logger.info(`[workq] Ready — db: ${dbPath}`);
      sweepTimer = setInterval(runScheduledSweep, sweepIntervalMinutes * 60_000);
    },
    stop: () => {
      if (sweepTimer) {
        clearInterval(sweepTimer);
        sweepTimer = null;
      }
      _releaseDb(resolvedDbPath);
    },
  });
}

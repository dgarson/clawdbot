import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { registerWorkqCli } from "./src/cli.js";
import { WorkqDatabase } from "./src/database.js";
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
  WorkItemPriority,
  WorkItemStatus,
} from "./src/types.js";

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
    maxConcurrentPerSession?: number;
  };

  if (config.enabled === false) {
    api.logger.info("[workq] Disabled by config");
    return;
  }

  const dbPath = api.resolvePath(config.dbPath ?? "~/.openclaw/workq/workq.db");
  const staleHours = Math.max(1, Math.floor(config.staleThresholdHours ?? 24));

  const db = new WorkqDatabase(dbPath);
  registerWorkqTools(api, db, staleHours);
  registerWorkqCli(api, db, staleHours);

  // Auto-release any active workq items when an agent session ends without finishing them.
  // This is the recovery path for stuck or crashed sessions.
  api.on("agent_end", async (_event, ctx) => {
    const sessionKey = ctx.sessionKey;
    if (!sessionKey) {
      return;
    }
    const result = db.autoReleaseBySession({
      sessionKey,
      actorId: "system:agent_end_hook",
      reason: "auto-released: session ended without workq_done or workq_release",
    });
    if (result.released > 0) {
      api.logger.info(
        `[workq] auto-released ${result.released} item(s) for session ${sessionKey}: ${result.issueRefs.join(", ")}`,
      );
    }
  });

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
        status: asStringOrList(input.status) as WorkItemStatus | WorkItemStatus[] | undefined,
        priority: asStringOrList(input.priority) as
          | WorkItemPriority
          | WorkItemPriority[]
          | undefined,
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

  api.registerService({
    id: "workq",
    start: () => {
      api.logger.info(`[workq] Ready — db: ${dbPath}`);
    },
    stop: () => {
      db.close();
    },
  });
}

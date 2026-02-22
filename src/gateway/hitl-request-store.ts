import type { DatabaseSync } from "node:sqlite";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { requireNodeSqlite } from "../memory/sqlite.js";

export type HitlDecisionType = "explicit" | "escalation" | "timeout-fallback";
export type HitlDecisionResult = "approve" | "deny";
export type HitlRequestStatus =
  | "pending"
  | "approved"
  | "denied"
  | "expired"
  | "escalated"
  | "executing"
  | "completed"
  | "failed";

export type HitlRequestRow = {
  id: string;
  tool: string;
  arguments: Record<string, unknown> | null;
  requesterSession: string;
  requesterRole: string;
  policyId: string;
  status: HitlRequestStatus;
  expiresAtMs: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type HitlDecisionRow = {
  id: string;
  requestId: string;
  actorSession: string;
  actorRole: string;
  decision: HitlDecisionResult;
  reason: string | null;
  decidedAtMs: number;
  type: HitlDecisionType;
};

export type HitlAuditRow = {
  id: string;
  requestId: string;
  event: string;
  actorSession: string | null;
  actorRole: string | null;
  data: Record<string, unknown> | null;
  timestampMs: number;
  hash: string;
};

export type CreateHitlRequestParams = {
  id?: string;
  tool: string;
  arguments?: Record<string, unknown> | null;
  requesterSession: string;
  requesterRole: string;
  policyId: string;
  status?: HitlRequestStatus;
  expiresAtMs: number;
  createdAtMs?: number;
  updatedAtMs?: number;
};

export type RecordHitlDecisionParams = {
  id?: string;
  requestId: string;
  actorSession: string;
  actorRole: string;
  decision: HitlDecisionResult;
  reason?: string | null;
  decidedAtMs?: number;
  type?: HitlDecisionType;
};

export type RecordHitlAuditParams = {
  id?: string;
  requestId: string;
  event: string;
  actorSession?: string | null;
  actorRole?: string | null;
  data?: Record<string, unknown> | null;
  timestampMs?: number;
  hash?: string;
};

export type HitlRequestStoreOptions = {
  dbPath?: string;
  db?: DatabaseSync;
  now?: () => number;
};

export function resolveDefaultHitlRequestStorePath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(resolveStateDir(env), "hitl-requests.sqlite");
}

function stringifyJson(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  return JSON.stringify(value);
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function normalizeRole(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("role is required");
  }
  return trimmed;
}

function normalizeRequiredField(name: string, value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${name} is required`);
  }
  return trimmed;
}

function assertFiniteMs(name: string, value: number) {
  if (!Number.isFinite(value)) {
    throw new Error(`${name} must be a finite number`);
  }
}

function computeAuditHash(input: {
  requestId: string;
  event: string;
  actorSession: string | null;
  actorRole: string | null;
  data: Record<string, unknown> | null;
  timestampMs: number;
}): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        requestId: input.requestId,
        event: input.event,
        actorSession: input.actorSession,
        actorRole: input.actorRole,
        data: input.data,
        timestampMs: input.timestampMs,
      }),
    )
    .digest("hex");
}

function mapRequestRow(
  row:
    | {
        id: string;
        tool: string;
        arguments: string | null;
        requester_session: string;
        requester_role: string;
        policy_id: string;
        status: string;
        expires_at_ms: number;
        created_at_ms: number;
        updated_at_ms: number;
      }
    | undefined,
): HitlRequestRow | null {
  if (!row) {
    return null;
  }
  return {
    id: row.id,
    tool: row.tool,
    arguments: parseJsonObject(row.arguments),
    requesterSession: row.requester_session,
    requesterRole: row.requester_role,
    policyId: row.policy_id,
    status: row.status as HitlRequestStatus,
    expiresAtMs: row.expires_at_ms,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function mapDecisionRow(row: {
  id: string;
  request_id: string;
  actor_session: string;
  actor_role: string;
  decision: string;
  reason: string | null;
  decided_at_ms: number;
  type: string;
}): HitlDecisionRow {
  return {
    id: row.id,
    requestId: row.request_id,
    actorSession: row.actor_session,
    actorRole: row.actor_role,
    decision: row.decision as HitlDecisionResult,
    reason: row.reason,
    decidedAtMs: row.decided_at_ms,
    type: row.type as HitlDecisionType,
  };
}

function mapAuditRow(row: {
  id: string;
  request_id: string;
  event: string;
  actor_session: string | null;
  actor_role: string | null;
  data: string | null;
  timestamp_ms: number;
  hash: string;
}): HitlAuditRow {
  return {
    id: row.id,
    requestId: row.request_id,
    event: row.event,
    actorSession: row.actor_session,
    actorRole: row.actor_role,
    data: parseJsonObject(row.data),
    timestampMs: row.timestamp_ms,
    hash: row.hash,
  };
}

export class HitlRequestStore {
  private readonly db: DatabaseSync;
  private readonly ownDb: boolean;
  private readonly now: () => number;

  constructor(options: HitlRequestStoreOptions = {}) {
    this.now = options.now ?? Date.now;
    if (options.db) {
      this.db = options.db;
      this.ownDb = false;
    } else {
      const dbPath = options.dbPath ?? resolveDefaultHitlRequestStorePath();
      fs.mkdirSync(path.dirname(dbPath), { recursive: true });
      const { DatabaseSync } = requireNodeSqlite();
      this.db = new DatabaseSync(dbPath);
      this.ownDb = true;
    }
    this.initializeSchema();
  }

  private initializeSchema() {
    this.db.exec("PRAGMA foreign_keys = ON");
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitl_requests (
        id TEXT PRIMARY KEY,
        tool TEXT NOT NULL,
        arguments TEXT,
        requester_session TEXT NOT NULL,
        requester_role TEXT NOT NULL,
        policy_id TEXT NOT NULL,
        status TEXT NOT NULL,
        expires_at_ms INTEGER NOT NULL,
        created_at_ms INTEGER NOT NULL,
        updated_at_ms INTEGER NOT NULL
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitl_decisions (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        actor_session TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        decision TEXT NOT NULL,
        reason TEXT,
        decided_at_ms INTEGER NOT NULL,
        type TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES hitl_requests(id)
      );
    `);
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS hitl_audit (
        id TEXT PRIMARY KEY,
        request_id TEXT NOT NULL,
        event TEXT NOT NULL,
        actor_session TEXT,
        actor_role TEXT,
        data TEXT,
        timestamp_ms INTEGER NOT NULL,
        hash TEXT NOT NULL,
        FOREIGN KEY (request_id) REFERENCES hitl_requests(id)
      );
    `);
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hitl_requests_status ON hitl_requests(status, created_at_ms)",
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hitl_decisions_request ON hitl_decisions(request_id, decided_at_ms)",
    );
    this.db.exec(
      "CREATE INDEX IF NOT EXISTS idx_hitl_audit_request ON hitl_audit(request_id, timestamp_ms)",
    );
  }

  close() {
    if (this.ownDb) {
      this.db.close();
    }
  }

  createRequest(params: CreateHitlRequestParams): HitlRequestRow {
    const id = params.id?.trim() || randomUUID();
    const tool = normalizeRequiredField("tool", params.tool);
    const requesterSession = normalizeRequiredField("requesterSession", params.requesterSession);
    const requesterRole = normalizeRole(params.requesterRole);
    const policyId = normalizeRequiredField("policyId", params.policyId);
    const status = params.status ?? "pending";
    const createdAtMs = params.createdAtMs ?? this.now();
    const updatedAtMs = params.updatedAtMs ?? createdAtMs;
    assertFiniteMs("expiresAtMs", params.expiresAtMs);
    assertFiniteMs("createdAtMs", createdAtMs);
    assertFiniteMs("updatedAtMs", updatedAtMs);

    this.db
      .prepare(
        `INSERT INTO hitl_requests (
          id, tool, arguments, requester_session, requester_role,
          policy_id, status, expires_at_ms, created_at_ms, updated_at_ms
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        tool,
        stringifyJson(params.arguments ?? null),
        requesterSession,
        requesterRole,
        policyId,
        status,
        params.expiresAtMs,
        createdAtMs,
        updatedAtMs,
      );

    return this.getRequest(id)!;
  }

  getRequest(requestId: string): HitlRequestRow | null {
    const id = normalizeRequiredField("requestId", requestId);
    const row = this.db
      .prepare(
        `SELECT
          id,
          tool,
          arguments,
          requester_session,
          requester_role,
          policy_id,
          status,
          expires_at_ms,
          created_at_ms,
          updated_at_ms
         FROM hitl_requests
         WHERE id = ?`,
      )
      .get(id) as
      | {
          id: string;
          tool: string;
          arguments: string | null;
          requester_session: string;
          requester_role: string;
          policy_id: string;
          status: string;
          expires_at_ms: number;
          created_at_ms: number;
          updated_at_ms: number;
        }
      | undefined;
    return mapRequestRow(row);
  }

  updateRequestStatus(params: {
    requestId: string;
    status: HitlRequestStatus;
    updatedAtMs?: number;
  }): HitlRequestRow | null {
    const requestId = normalizeRequiredField("requestId", params.requestId);
    const updatedAtMs = params.updatedAtMs ?? this.now();
    assertFiniteMs("updatedAtMs", updatedAtMs);
    this.db
      .prepare(`UPDATE hitl_requests SET status = ?, updated_at_ms = ? WHERE id = ?`)
      .run(params.status, updatedAtMs, requestId);
    return this.getRequest(requestId);
  }

  listRequests(params: { status?: HitlRequestStatus; limit?: number } = {}): HitlRequestRow[] {
    const limit = Math.max(1, Math.min(500, Math.floor(params.limit ?? 100)));
    if (params.status) {
      const rows = this.db
        .prepare(
          `SELECT
            id,
            tool,
            arguments,
            requester_session,
            requester_role,
            policy_id,
            status,
            expires_at_ms,
            created_at_ms,
            updated_at_ms
           FROM hitl_requests
           WHERE status = ?
           ORDER BY created_at_ms DESC
           LIMIT ?`,
        )
        .all(params.status, limit) as Array<{
        id: string;
        tool: string;
        arguments: string | null;
        requester_session: string;
        requester_role: string;
        policy_id: string;
        status: string;
        expires_at_ms: number;
        created_at_ms: number;
        updated_at_ms: number;
      }>;
      return rows.map((row) => mapRequestRow(row)).filter((row): row is HitlRequestRow => !!row);
    }

    const rows = this.db
      .prepare(
        `SELECT
          id,
          tool,
          arguments,
          requester_session,
          requester_role,
          policy_id,
          status,
          expires_at_ms,
          created_at_ms,
          updated_at_ms
         FROM hitl_requests
         ORDER BY created_at_ms DESC
         LIMIT ?`,
      )
      .all(limit) as Array<{
      id: string;
      tool: string;
      arguments: string | null;
      requester_session: string;
      requester_role: string;
      policy_id: string;
      status: string;
      expires_at_ms: number;
      created_at_ms: number;
      updated_at_ms: number;
    }>;

    return rows.map((row) => mapRequestRow(row)).filter((row): row is HitlRequestRow => !!row);
  }

  recordDecision(params: RecordHitlDecisionParams): HitlDecisionRow {
    const id = params.id?.trim() || randomUUID();
    const requestId = normalizeRequiredField("requestId", params.requestId);
    const actorSession = normalizeRequiredField("actorSession", params.actorSession);
    const actorRole = normalizeRole(params.actorRole);
    const decidedAtMs = params.decidedAtMs ?? this.now();
    assertFiniteMs("decidedAtMs", decidedAtMs);
    const type = params.type ?? "explicit";

    this.db
      .prepare(
        `INSERT INTO hitl_decisions (
          id, request_id, actor_session, actor_role, decision, reason, decided_at_ms, type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        requestId,
        actorSession,
        actorRole,
        params.decision,
        params.reason ?? null,
        decidedAtMs,
        type,
      );

    const row = this.db
      .prepare(
        `SELECT
          id, request_id, actor_session, actor_role, decision, reason, decided_at_ms, type
         FROM hitl_decisions
         WHERE id = ?`,
      )
      .get(id) as {
      id: string;
      request_id: string;
      actor_session: string;
      actor_role: string;
      decision: string;
      reason: string | null;
      decided_at_ms: number;
      type: string;
    };

    return mapDecisionRow(row);
  }

  listDecisions(requestId: string): HitlDecisionRow[] {
    const id = normalizeRequiredField("requestId", requestId);
    const rows = this.db
      .prepare(
        `SELECT
          id, request_id, actor_session, actor_role, decision, reason, decided_at_ms, type
         FROM hitl_decisions
         WHERE request_id = ?
         ORDER BY decided_at_ms ASC`,
      )
      .all(id) as Array<{
      id: string;
      request_id: string;
      actor_session: string;
      actor_role: string;
      decision: string;
      reason: string | null;
      decided_at_ms: number;
      type: string;
    }>;
    return rows.map((row) => mapDecisionRow(row));
  }

  recordAudit(params: RecordHitlAuditParams): HitlAuditRow {
    const id = params.id?.trim() || randomUUID();
    const requestId = normalizeRequiredField("requestId", params.requestId);
    const event = normalizeRequiredField("event", params.event);
    const timestampMs = params.timestampMs ?? this.now();
    assertFiniteMs("timestampMs", timestampMs);
    const actorSession = params.actorSession?.trim() || null;
    const actorRole = params.actorRole?.trim() || null;
    const data = params.data ?? null;
    const hash =
      params.hash?.trim() ||
      computeAuditHash({ requestId, event, actorSession, actorRole, data, timestampMs });

    this.db
      .prepare(
        `INSERT INTO hitl_audit (
          id, request_id, event, actor_session, actor_role, data, timestamp_ms, hash
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, requestId, event, actorSession, actorRole, stringifyJson(data), timestampMs, hash);

    const row = this.db
      .prepare(
        `SELECT
          id, request_id, event, actor_session, actor_role, data, timestamp_ms, hash
         FROM hitl_audit
         WHERE id = ?`,
      )
      .get(id) as {
      id: string;
      request_id: string;
      event: string;
      actor_session: string | null;
      actor_role: string | null;
      data: string | null;
      timestamp_ms: number;
      hash: string;
    };

    return mapAuditRow(row);
  }

  listAudit(requestId: string): HitlAuditRow[] {
    const id = normalizeRequiredField("requestId", requestId);
    const rows = this.db
      .prepare(
        `SELECT
          id, request_id, event, actor_session, actor_role, data, timestamp_ms, hash
         FROM hitl_audit
         WHERE request_id = ?
         ORDER BY timestamp_ms ASC`,
      )
      .all(id) as Array<{
      id: string;
      request_id: string;
      event: string;
      actor_session: string | null;
      actor_role: string | null;
      data: string | null;
      timestamp_ms: number;
      hash: string;
    }>;
    return rows.map((row) => mapAuditRow(row));
  }

  getRequestWithTimeline(requestId: string): {
    request: HitlRequestRow;
    decisions: HitlDecisionRow[];
    audit: HitlAuditRow[];
  } | null {
    const request = this.getRequest(requestId);
    if (!request) {
      return null;
    }
    return {
      request,
      decisions: this.listDecisions(requestId),
      audit: this.listAudit(requestId),
    };
  }
}

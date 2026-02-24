import { randomInt } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import {
  canonicalizeAbsolutePath,
  canonicalizeAbsolutePaths,
  pathsOverlap,
} from "./file-matcher.js";
import { assertValidTransition } from "./state-machine.js";
import {
  WORK_ITEM_ACTIVE_STATUSES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  WORK_LOG_ACTIONS,
  type ClaimInput,
  type ClaimResult,
  type DoneInput,
  type FileConflict,
  type FilesInput,
  type FilesMode,
  type FilesResult,
  type LogInput,
  type QueryFilters,
  type QueryResult,
  type ReleaseInput,
  type StatusInput,
  type SweepCandidate,
  type SweepTransitionResult,
  type WorkItem,
  type WorkItemPriority,
  type WorkItemRow,
  type WorkItemStatus,
  type WorkLogAction,
  type WorkLogEntry,
  type WorkqDatabaseApi,
} from "./types.js";

const require = createRequire(import.meta.url);
const SLEEP_ARRAY = new Int32Array(new SharedArrayBuffer(4));

function requireNodeSqlite(): typeof import("node:sqlite") {
  try {
    return require("node:sqlite") as typeof import("node:sqlite");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`node:sqlite is unavailable in this runtime. ${message}`, { cause: error });
  }
}

function sleepSync(ms: number): void {
  Atomics.wait(SLEEP_ARRAY, 0, 0, ms);
}

function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("SQLITE_BUSY") || message.includes("database is locked");
}

function sqliteUtcToEpochMs(value: string): number {
  const normalized = `${value.replace(" ", "T")}Z`;
  return Date.parse(normalized);
}

function normalizeText(value?: string | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeStringArray(values?: string[]): string[] {
  if (!Array.isArray(values)) {
    return [];
  }
  const deduped = new Set<string>();
  for (const value of values) {
    const normalized = normalizeText(value);
    if (normalized) {
      deduped.add(normalized);
    }
  }
  return [...deduped].sort();
}

function parseJsonStringArray(raw: string | null, fallback: string[] = []): string[] {
  if (!raw) {
    return [...fallback];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [...fallback];
    }
    return normalizeStringArray(
      parsed.filter((entry): entry is string => typeof entry === "string"),
    );
  } catch {
    return [...fallback];
  }
}

function toNullable(value?: string): string | null {
  const normalized = normalizeText(value);
  return normalized ?? null;
}

function statusListSql(alias: string): string {
  const placeholders = WORK_ITEM_ACTIVE_STATUSES.map(() => "?").join(", ");
  return `${alias}.status IN (${placeholders})`;
}

const SYSTEM_UNCLAIMED_AGENT_ID = "system:unclaimed";

export class WorkqDatabase implements WorkqDatabaseApi {
  private readonly db: DatabaseSync;
  readonly dbPath: string;

  constructor(dbPath: string) {
    this.dbPath = resolveUserPath(dbPath);
    mkdirSync(path.dirname(this.dbPath), { recursive: true });

    const { DatabaseSync } = requireNodeSqlite();
    this.db = new DatabaseSync(this.dbPath);

    this.initialize();
  }

  close(): void {
    this.db.close();
  }

  claim(input: ClaimInput): ClaimResult {
    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);

    if (!issueRef) {
      throw new Error("issueRef is required");
    }
    if (!agentId) {
      throw new Error("agentId is required");
    }

    const priority = this.normalizePriority(input.priority);
    const scope = normalizeStringArray(input.scope);
    const tags = normalizeStringArray(input.tags);
    const files = input.files
      ? canonicalizeAbsolutePaths(input.files, input.worktreePath ?? process.cwd())
      : [];

    return this.withWriteTransaction(() => {
      const existing = this.getRow(issueRef);

      if (!existing) {
        this.db
          .prepare(
            `INSERT INTO work_items (
              issue_ref, title, agent_id, squad, status, branch, worktree_path,
              blocked_reason, priority, scope_json, tags_json, claimed_session_key
            ) VALUES (?, ?, ?, ?, 'claimed', ?, ?, NULL, ?, ?, ?, ?)`,
          )
          .run(
            issueRef,
            toNullable(input.title),
            agentId,
            toNullable(input.squad),
            toNullable(input.branch),
            toNullable(input.worktreePath),
            priority,
            JSON.stringify(scope),
            JSON.stringify(tags),
            toNullable(input.sessionKey),
          );

        this.replaceIssueFiles(issueRef, files);
        this.insertLog(issueRef, agentId, "claimed", null);

        return {
          status: "claimed",
          item: this.getOrThrow(issueRef),
        };
      }

      if (existing.status === "dropped" || (existing.status === "done" && input.reopen === true)) {
        const nextPriority = this.normalizePriority(input.priority ?? existing.priority);
        const nextScopeJson = input.scope ? JSON.stringify(scope) : existing.scope_json;
        const nextTagsJson = input.tags ? JSON.stringify(tags) : existing.tags_json;

        this.db
          .prepare(
            `UPDATE work_items
             SET title = COALESCE(?, title),
                 squad = COALESCE(?, squad),
                 agent_id = ?,
                 status = 'claimed',
                 branch = COALESCE(?, branch),
                 worktree_path = COALESCE(?, worktree_path),
                 blocked_reason = NULL,
                 pr_url = CASE WHEN ? = 1 THEN NULL ELSE pr_url END,
                 priority = ?,
                 scope_json = ?,
                 tags_json = ?,
                 claimed_session_key = ?,
                 updated_at = datetime('now', 'utc')
             WHERE issue_ref = ?`,
          )
          .run(
            toNullable(input.title),
            toNullable(input.squad),
            agentId,
            toNullable(input.branch),
            toNullable(input.worktreePath),
            existing.status === "done" ? 1 : 0,
            nextPriority,
            nextScopeJson,
            nextTagsJson,
            toNullable(input.sessionKey),
            issueRef,
          );

        if (input.files) {
          this.replaceIssueFiles(issueRef, files);
        }

        const detail = JSON.stringify({
          reclaimedFrom: existing.status,
          previousAgentId: existing.agent_id,
        });
        this.insertLog(issueRef, agentId, "claimed", detail);

        return {
          status: "claimed",
          item: this.getOrThrow(issueRef),
        };
      }

      if (existing.status === "done" && input.reopen !== true) {
        return {
          status: "conflict",
          issueRef,
          claimedBy: existing.agent_id,
          claimedAt: existing.claimed_at,
          currentStatus: existing.status,
        };
      }

      if (existing.agent_id === agentId && this.isActiveStatus(existing.status)) {
        return {
          status: "already_yours",
          item: this.getOrThrow(issueRef),
        };
      }

      if (existing.agent_id === SYSTEM_UNCLAIMED_AGENT_ID && this.isActiveStatus(existing.status)) {
        this.db
          .prepare(
            `UPDATE work_items
             SET agent_id = ?,
                 status = 'claimed',
                 blocked_reason = NULL,
                 claimed_session_key = ?,
                 updated_at = datetime('now', 'utc')
             WHERE issue_ref = ?`,
          )
          .run(agentId, toNullable(input.sessionKey), issueRef);

        this.insertLog(
          issueRef,
          agentId,
          "reassigned",
          JSON.stringify({ reassignedFrom: SYSTEM_UNCLAIMED_AGENT_ID }),
        );

        return {
          status: "claimed",
          item: this.getOrThrow(issueRef),
        };
      }

      return {
        status: "conflict",
        issueRef,
        claimedBy: existing.agent_id,
        claimedAt: existing.claimed_at,
        currentStatus: existing.status,
      };
    });
  }

  release(input: ReleaseInput): { status: "dropped"; issueRef: string } {
    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);

    if (!issueRef || !agentId) {
      throw new Error("issueRef and agentId are required");
    }

    return this.withWriteTransaction(() => {
      const row = this.getRowOrThrow(issueRef);
      this.assertOwnedBy(row, agentId);

      if (!this.isActiveStatus(row.status)) {
        throw new Error(`Cannot release issue in terminal status: ${row.status}`);
      }

      this.db
        .prepare(
          `UPDATE work_items
           SET status = 'dropped',
               blocked_reason = NULL,
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(issueRef);

      this.insertLog(issueRef, agentId, "dropped", toNullable(input.reason));

      return { status: "dropped", issueRef };
    });
  }

  status(input: StatusInput): {
    status: "updated";
    issueRef: string;
    from: WorkItemStatus;
    to: WorkItemStatus;
  } {
    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);

    if (!issueRef || !agentId) {
      throw new Error("issueRef and agentId are required");
    }

    return this.withWriteTransaction(() => {
      const row = this.getRowOrThrow(issueRef);
      this.assertOwnedBy(row, agentId);

      if (input.status === "blocked") {
        const reason = normalizeText(input.reason);
        if (!reason) {
          throw new Error("reason is required when setting status=blocked");
        }
      }

      assertValidTransition(row.status, input.status);

      const nextBlockedReason = input.status === "blocked" ? toNullable(input.reason) : null;

      this.db
        .prepare(
          `UPDATE work_items
           SET status = ?,
               blocked_reason = ?,
               pr_url = COALESCE(?, pr_url),
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(input.status, nextBlockedReason, toNullable(input.prUrl), issueRef);

      this.insertLog(
        issueRef,
        agentId,
        "status_change",
        JSON.stringify({ from: row.status, to: input.status, reason: toNullable(input.reason) }),
      );

      if (normalizeText(input.prUrl)) {
        this.insertLog(issueRef, agentId, "pr_linked", toNullable(input.prUrl));
      }

      return {
        status: "updated",
        issueRef,
        from: row.status,
        to: input.status,
      };
    });
  }

  done(input: DoneInput): { status: "done"; issueRef: string; prUrl: string } {
    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);
    const prUrl = normalizeText(input.prUrl);

    if (!issueRef || !agentId || !prUrl) {
      throw new Error("issueRef, agentId, and prUrl are required");
    }

    return this.withWriteTransaction(() => {
      const row = this.getRowOrThrow(issueRef);
      this.assertOwnedBy(row, agentId);

      if (row.status !== "in-review") {
        throw new Error(`Cannot mark done from status ${row.status}; expected in-review`);
      }

      this.db
        .prepare(
          `UPDATE work_items
           SET status = 'done',
               blocked_reason = NULL,
               pr_url = ?,
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(prUrl, issueRef);

      this.insertLog(
        issueRef,
        agentId,
        "completed",
        JSON.stringify({ prUrl, summary: toNullable(input.summary) }),
      );

      return { status: "done", issueRef, prUrl };
    });
  }

  files(input: FilesInput): FilesResult {
    const mode = (input.mode ?? "check") as FilesMode;

    if (mode === "check") {
      const targetPath = normalizeText(input.path);
      if (!targetPath) {
        throw new Error("path is required for files mode=check");
      }
      const canonical = canonicalizeAbsolutePath(targetPath);
      const conflicts = this.collectConflicts(
        [canonical],
        normalizeText(input.excludeAgentId) ?? null,
      );
      return {
        mode,
        conflicts,
        hasConflicts: conflicts.length > 0,
      };
    }

    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);

    if (!issueRef || !agentId) {
      throw new Error("issueRef and agentId are required for files mode=set|add|remove");
    }

    return this.withWriteTransaction(() => {
      const row = this.getRowOrThrow(issueRef);
      this.assertOwnedBy(row, agentId);

      if (!this.isActiveStatus(row.status)) {
        throw new Error(`Cannot modify files for terminal status: ${row.status}`);
      }

      const canonicalPaths = canonicalizeAbsolutePaths(
        input.paths ?? [],
        row.worktree_path ?? process.cwd(),
      );

      const before = this.listIssueFiles(issueRef);

      if (mode === "set") {
        this.replaceIssueFiles(issueRef, canonicalPaths);
      } else if (mode === "add") {
        this.insertIssueFiles(issueRef, canonicalPaths);
      } else if (mode === "remove") {
        this.removeIssueFiles(issueRef, canonicalPaths);
      } else {
        throw new Error(`Unsupported files mode: ${mode}`);
      }

      const after = this.listIssueFiles(issueRef);
      const added = after.filter((entry) => !before.includes(entry));
      const removed = before.filter((entry) => !after.includes(entry));

      if (added.length || removed.length) {
        this.touchWorkItem(issueRef);
        this.insertLog(issueRef, agentId, "file_update", JSON.stringify({ mode, added, removed }));
      }

      const conflicts = this.collectConflicts(after, agentId);
      return {
        mode,
        files: after,
        added,
        removed,
        conflicts,
        hasConflicts: conflicts.length > 0,
      };
    });
  }

  log(input: LogInput): { status: "logged"; issueRef: string; logId: number } {
    const issueRef = normalizeText(input.issueRef);
    const agentId = normalizeText(input.agentId);
    const note = normalizeText(input.note);

    if (!issueRef || !agentId || !note) {
      throw new Error("issueRef, agentId, and note are required");
    }

    return this.withWriteTransaction(() => {
      const row = this.getRowOrThrow(issueRef);
      this.assertOwnedBy(row, agentId);

      this.touchWorkItem(issueRef);
      const logId = this.insertLog(issueRef, agentId, "note", note);

      return {
        status: "logged",
        issueRef,
        logId,
      };
    });
  }

  query(filters: QueryFilters = {}): QueryResult {
    const where: string[] = [];
    const params: Array<string | number> = [];

    if (filters.issueRef) {
      where.push("w.issue_ref = ?");
      params.push(filters.issueRef.trim());
    }

    if (filters.squad) {
      where.push("w.squad = ?");
      params.push(filters.squad.trim());
    }

    if (filters.agentId) {
      where.push("w.agent_id = ?");
      params.push(filters.agentId.trim());
    }

    if (filters.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
      if (statuses.length > 0) {
        where.push(`w.status IN (${statuses.map(() => "?").join(", ")})`);
        params.push(...statuses);
      }
    }

    if (filters.priority) {
      const priorities = Array.isArray(filters.priority) ? filters.priority : [filters.priority];
      if (priorities.length > 0) {
        where.push(`w.priority IN (${priorities.map(() => "?").join(", ")})`);
        params.push(...priorities);
      }
    }

    if (filters.scope) {
      where.push("EXISTS (SELECT 1 FROM json_each(w.scope_json) WHERE value = ?)");
      params.push(filters.scope.trim());
    }

    if (filters.activeOnly ?? true) {
      where.push("w.status NOT IN ('done', 'dropped')");
    }

    if (filters.updatedAfter) {
      where.push("w.updated_at >= ?");
      params.push(filters.updatedAfter);
    }

    if (filters.updatedBefore) {
      where.push("w.updated_at <= ?");
      params.push(filters.updatedBefore);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Math.max(1, Math.min(200, Math.floor(filters.limit ?? 50)));
    const offset = Math.max(0, Math.floor(filters.offset ?? 0));

    const total =
      (
        this.db
          .prepare(`SELECT COUNT(*) as count FROM work_items w ${whereSql}`)
          .get(...params) as { count?: number }
      ).count ?? 0;

    const rows = this.db
      .prepare(
        `SELECT w.* FROM work_items w ${whereSql} ORDER BY w.updated_at DESC LIMIT ? OFFSET ?`,
      )
      .all(...params, limit, offset) as unknown as WorkItemRow[];

    const filesByIssue = this.fetchFilesByIssue(rows.map((row) => row.issue_ref));
    const staleThresholdHours = Math.max(1, Math.floor(filters.staleThresholdHours ?? 24));

    return {
      items: rows.map((row) =>
        this.toItem(row, filesByIssue.get(row.issue_ref) ?? [], staleThresholdHours),
      ),
      total,
    };
  }

  get(issueRef: string, staleThresholdHours = 24): WorkItem | null {
    const normalizedIssueRef = normalizeText(issueRef);
    if (!normalizedIssueRef) {
      throw new Error("issueRef is required");
    }

    const row = this.getRow(normalizedIssueRef);
    if (!row) {
      return null;
    }

    const files = this.listIssueFiles(normalizedIssueRef);
    return this.toItem(row, files, staleThresholdHours);
  }

  getById(id: number, staleThresholdHours = 24): WorkItem | null {
    const row =
      (this.db
        .prepare(`SELECT * FROM work_items WHERE id = ?`)
        .get(id) as unknown as WorkItemRow) ?? null;
    if (!row) {
      return null;
    }
    const files = this.listIssueFiles(row.issue_ref);
    return this.toItem(row, files, staleThresholdHours);
  }

  getLog(issueRef: string, limit = 20): WorkLogEntry[] {
    const normalizedIssueRef = normalizeText(issueRef);
    if (!normalizedIssueRef) {
      throw new Error("issueRef is required");
    }

    const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));

    const rows = this.db
      .prepare(
        `SELECT id, issue_ref, agent_id, action, detail, created_at
         FROM work_log
         WHERE issue_ref = ?
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(normalizedIssueRef, boundedLimit) as Array<{
      id: number;
      issue_ref: string;
      agent_id: string;
      action: WorkLogAction;
      detail: string | null;
      created_at: string;
    }>;

    return rows.map((row) => ({
      id: row.id,
      issueRef: row.issue_ref,
      agentId: row.agent_id,
      action: row.action,
      detail: row.detail,
      createdAt: row.created_at,
    }));
  }

  findStaleActiveItems(staleAfterMinutes: number): SweepCandidate[] {
    const thresholdMinutes = Math.max(1, Math.floor(staleAfterMinutes));
    const rows = this.db
      .prepare(
        `SELECT w.*
         FROM work_items w
         WHERE w.status IN ('claimed', 'in-progress')
           AND w.updated_at <= datetime('now', 'utc', '-' || ? || ' minutes')
         ORDER BY w.updated_at ASC`,
      )
      .all(thresholdMinutes) as unknown as WorkItemRow[];

    const filesByIssue = this.fetchFilesByIssue(rows.map((row) => row.issue_ref));

    return rows.map((row) => {
      const item = this.toItem(row, filesByIssue.get(row.issue_ref) ?? [], 24);
      const staleMs = Date.now() - sqliteUtcToEpochMs(row.updated_at);
      return {
        ...item,
        staleMinutes: Math.max(0, Math.floor(staleMs / 60000)),
      };
    });
  }

  autoReleaseBySession(input: { sessionKey: string; actorId: string; reason: string }): {
    releasedIssueRefs: string[];
  } {
    const sessionKey = normalizeText(input.sessionKey);
    const actorId = normalizeText(input.actorId);
    const reason = normalizeText(input.reason);

    if (!sessionKey || !actorId || !reason) {
      throw new Error("sessionKey, actorId, and reason are required");
    }

    return this.withWriteTransaction(() => {
      const rows = this.db
        .prepare(
          `SELECT issue_ref, status, agent_id
           FROM work_items
           WHERE claimed_session_key = ?
             AND status IN ('claimed', 'in-progress')`,
        )
        .all(sessionKey) as Array<{ issue_ref: string; status: WorkItemStatus; agent_id: string }>;

      const releasedIssueRefs: string[] = [];
      for (const row of rows) {
        this.db
          .prepare(
            `UPDATE work_items
             SET status = 'claimed',
                 agent_id = ?,
                 blocked_reason = NULL,
                 claimed_session_key = NULL,
                 updated_at = datetime('now', 'utc')
             WHERE issue_ref = ?`,
          )
          .run(SYSTEM_UNCLAIMED_AGENT_ID, row.issue_ref);

        this.insertLog(
          row.issue_ref,
          actorId,
          "reassigned",
          JSON.stringify({
            reason,
            releasedFromAgentId: row.agent_id,
            releasedFromStatus: row.status,
            releasedSessionKey: sessionKey,
          }),
        );

        releasedIssueRefs.push(row.issue_ref);
      }

      return { releasedIssueRefs };
    });
  }

  systemMoveToInReview(input: {
    issueRef: string;
    actorId: string;
    reason: string;
  }): SweepTransitionResult {
    return this.withWriteTransaction(() => {
      const issueRef = normalizeText(input.issueRef);
      const actorId = normalizeText(input.actorId);
      const reason = normalizeText(input.reason);

      if (!issueRef || !actorId || !reason) {
        throw new Error("issueRef, actorId, and reason are required");
      }

      const row = this.getRowOrThrow(issueRef);
      const from = row.status;
      if (from === "done" || from === "dropped") {
        throw new Error(`Cannot auto-advance terminal issue: ${issueRef}`);
      }

      this.db
        .prepare(
          `UPDATE work_items
           SET status = 'in-review',
               blocked_reason = NULL,
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(issueRef);

      this.insertLog(
        issueRef,
        actorId,
        "status_change",
        JSON.stringify({ from, to: "in-review", reason }),
      );
      return { issueRef, from, to: "in-review" };
    });
  }

  systemMarkDone(input: {
    issueRef: string;
    actorId: string;
    summary: string;
    prUrl?: string;
  }): SweepTransitionResult {
    return this.withWriteTransaction(() => {
      const issueRef = normalizeText(input.issueRef);
      const actorId = normalizeText(input.actorId);
      const summary = normalizeText(input.summary);
      const prUrl = normalizeText(input.prUrl);

      if (!issueRef || !actorId || !summary) {
        throw new Error("issueRef, actorId, and summary are required");
      }

      const row = this.getRowOrThrow(issueRef);
      const from = row.status;
      if (from === "dropped" || from === "done") {
        throw new Error(`Cannot auto-close terminal issue: ${issueRef}`);
      }

      this.db
        .prepare(
          `UPDATE work_items
           SET status = 'done',
               blocked_reason = NULL,
               pr_url = COALESCE(?, pr_url),
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(toNullable(prUrl ?? undefined), issueRef);

      this.insertLog(
        issueRef,
        actorId,
        "completed",
        JSON.stringify({ summary, prUrl: prUrl ?? null, autoClosed: true }),
      );
      return { issueRef, from, to: "done" };
    });
  }

  systemReleaseToUnclaimed(input: {
    issueRef: string;
    actorId: string;
    reason: string;
  }): SweepTransitionResult {
    return this.withWriteTransaction(() => {
      const issueRef = normalizeText(input.issueRef);
      const actorId = normalizeText(input.actorId);
      const reason = normalizeText(input.reason);

      if (!issueRef || !actorId || !reason) {
        throw new Error("issueRef, actorId, and reason are required");
      }

      const row = this.getRowOrThrow(issueRef);
      const from = row.status;
      if (from !== "claimed" && from !== "in-progress") {
        throw new Error(`Auto-release only supports claimed/in-progress. Got: ${from}`);
      }

      this.db
        .prepare(
          `UPDATE work_items
           SET status = 'claimed',
               agent_id = ?,
               blocked_reason = NULL,
               claimed_session_key = NULL,
               updated_at = datetime('now', 'utc')
           WHERE issue_ref = ?`,
        )
        .run(SYSTEM_UNCLAIMED_AGENT_ID, issueRef);

      this.insertLog(
        issueRef,
        actorId,
        "reassigned",
        JSON.stringify({
          reason,
          releasedFromAgentId: row.agent_id,
          releasedFromStatus: row.status,
        }),
      );

      return { issueRef, from, to: "claimed" };
    });
  }

  systemAnnotate(input: { issueRef: string; actorId: string; note: string }): {
    issueRef: string;
    annotated: true;
  } {
    return this.withWriteTransaction(() => {
      const issueRef = normalizeText(input.issueRef);
      const actorId = normalizeText(input.actorId);
      const note = normalizeText(input.note);

      if (!issueRef || !actorId || !note) {
        throw new Error("issueRef, actorId, and note are required");
      }

      this.getRowOrThrow(issueRef);
      this.insertLog(issueRef, actorId, "note", note);
      return { issueRef, annotated: true };
    });
  }

  private initialize(): void {
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA synchronous = NORMAL;");
    this.db.exec("PRAGMA busy_timeout = 3000;");

    const statusCheck = WORK_ITEM_STATUSES.map((status) => `'${status}'`).join(", ");
    const actionCheck = WORK_LOG_ACTIONS.map((action) => `'${action}'`).join(", ");
    const priorityCheck = WORK_ITEM_PRIORITIES.map((priority) => `'${priority}'`).join(", ");

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_items (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_ref     TEXT NOT NULL UNIQUE,
        title         TEXT,
        agent_id      TEXT NOT NULL,
        squad         TEXT,
        status        TEXT NOT NULL DEFAULT 'claimed' CHECK(status IN (${statusCheck})),
        branch        TEXT,
        worktree_path TEXT,
        pr_url        TEXT,
        blocked_reason TEXT,
        priority      TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN (${priorityCheck})),
        scope_json    TEXT NOT NULL DEFAULT '[]',
        tags_json     TEXT NOT NULL DEFAULT '[]',
        claimed_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        claimed_session_key TEXT
      );

      CREATE TABLE IF NOT EXISTS work_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_ref   TEXT NOT NULL,
        agent_id    TEXT NOT NULL,
        action      TEXT NOT NULL CHECK(action IN (${actionCheck})),
        detail      TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        FOREIGN KEY (issue_ref) REFERENCES work_items(issue_ref) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS work_item_files (
        issue_ref   TEXT NOT NULL,
        file_path   TEXT NOT NULL,
        created_at  TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
        PRIMARY KEY (issue_ref, file_path),
        FOREIGN KEY (issue_ref) REFERENCES work_items(issue_ref) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS workq_meta (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      INSERT OR IGNORE INTO workq_meta (key, value) VALUES ('schema_version', '0');

      CREATE INDEX IF NOT EXISTS idx_work_items_agent ON work_items(agent_id);
      CREATE INDEX IF NOT EXISTS idx_work_items_squad ON work_items(squad);
      CREATE INDEX IF NOT EXISTS idx_work_items_status ON work_items(status);
      CREATE INDEX IF NOT EXISTS idx_work_items_priority ON work_items(priority);
      CREATE INDEX IF NOT EXISTS idx_work_items_priority_status ON work_items(priority, status);
      CREATE INDEX IF NOT EXISTS idx_work_items_status_updated ON work_items(status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_work_items_squad_status_updated
        ON work_items(squad, status, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_work_item_files_path ON work_item_files(file_path);
      CREATE INDEX IF NOT EXISTS idx_work_log_issue ON work_log(issue_ref);
      CREATE INDEX IF NOT EXISTS idx_work_log_agent ON work_log(agent_id);
      CREATE INDEX IF NOT EXISTS idx_work_log_created ON work_log(created_at);
    `);

    this.runMigrations();
    this.repairSystemUnclaimedStatusRows();

    try {
      this.db.exec("PRAGMA wal_checkpoint(PASSIVE);");
    } catch {
      // no-op: checkpoint is best-effort
    }
  }

  private repairSystemUnclaimedStatusRows(): void {
    this.db
      .prepare(
        `UPDATE work_items
         SET status = 'claimed',
             agent_id = CASE
               WHEN agent_id = 'claimed' THEN ?
               ELSE agent_id
             END,
             updated_at = datetime('now', 'utc')
         WHERE status = ?`,
      )
      .run(SYSTEM_UNCLAIMED_AGENT_ID, SYSTEM_UNCLAIMED_AGENT_ID);
  }

  /**
   * Versioned schema migrations, applied in order on startup.
   *
   * Rules:
   * - Each migration MUST be idempotent (use IF NOT EXISTS / try-catch for DDL that may already be applied).
   * - Append new migrations; never edit existing ones.
   * - schema_version in workq_meta tracks the highest applied version.
   * - Existing databases that were created before the migration system had schema_version='1' set by the
   *   old initializer, so the first migration that needs to run on those databases must use version >= 2.
   */
  private static readonly MIGRATIONS: Array<{
    version: number;
    description: string;
    up: (db: DatabaseSync) => void;
  }> = [
    {
      version: 2,
      description: "add claimed_session_key column and index",
      up(db) {
        // ALTER TABLE is not idempotent natively; suppress the "duplicate column" error.
        try {
          db.exec(`ALTER TABLE work_items ADD COLUMN claimed_session_key TEXT`);
        } catch {
          // column already exists — safe to continue
        }
        db.exec(
          `CREATE INDEX IF NOT EXISTS idx_work_items_claimed_session_key ON work_items(claimed_session_key)`,
        );
      },
    },
  ];

  private runMigrations(): void {
    const row = this.db
      .prepare(`SELECT value FROM workq_meta WHERE key = 'schema_version'`)
      .get() as { value: string } | undefined;
    const currentVersion = row ? parseInt(row.value, 10) : 0;

    for (const migration of WorkqDatabase.MIGRATIONS) {
      if (migration.version <= currentVersion) continue;

      this.db.exec("BEGIN");
      try {
        migration.up(this.db);
        this.db
          .prepare(`INSERT OR REPLACE INTO workq_meta (key, value) VALUES ('schema_version', ?)`)
          .run(String(migration.version));
        this.db.exec("COMMIT");
      } catch (err) {
        this.db.exec("ROLLBACK");
        throw new Error(
          `Schema migration v${migration.version} (${migration.description}) failed: ${err instanceof Error ? err.message : String(err)}`,
          { cause: err },
        );
      }
    }
  }

  private withWriteTransaction<T>(operation: () => T): T {
    const retries: Array<[number, number]> = [
      [100, 200],
      [400, 700],
      [1200, 2000],
    ];

    for (let attempt = 0; attempt <= retries.length; attempt += 1) {
      try {
        this.db.exec("BEGIN IMMEDIATE");
        const result = operation();
        this.db.exec("COMMIT");
        return result;
      } catch (error) {
        this.safeRollback();

        if (isBusyError(error)) {
          if (attempt < retries.length) {
            const [minMs, maxMs] = retries[attempt];
            sleepSync(randomInt(minMs, maxMs + 1));
            continue;
          }
          throw new Error("Database busy, try again", { cause: error });
        }

        throw error;
      }
    }

    throw new Error("Database busy, try again");
  }

  private safeRollback(): void {
    try {
      this.db.exec("ROLLBACK");
    } catch {
      // ignore rollback failures when there is no active transaction
    }
  }

  private normalizePriority(priority?: WorkItemPriority): WorkItemPriority {
    if (!priority) {
      return "medium";
    }
    if (!WORK_ITEM_PRIORITIES.includes(priority)) {
      throw new Error(`Invalid priority: ${priority}`);
    }
    return priority;
  }

  private getRow(issueRef: string): WorkItemRow | null {
    return (
      (this.db
        .prepare(`SELECT * FROM work_items WHERE issue_ref = ?`)
        .get(issueRef) as unknown as WorkItemRow) ?? null
    );
  }

  private getRowOrThrow(issueRef: string): WorkItemRow {
    const row = this.getRow(issueRef);
    if (!row) {
      throw new Error(`Work item not found: ${issueRef}`);
    }
    return row;
  }

  private getOrThrow(issueRef: string): WorkItem {
    const item = this.get(issueRef);
    if (!item) {
      throw new Error(`Work item not found: ${issueRef}`);
    }
    return item;
  }

  private assertOwnedBy(row: WorkItemRow, agentId: string): void {
    if (row.agent_id !== agentId) {
      throw new Error(`Not your work item. Owned by: ${row.agent_id}`);
    }
  }

  private isActiveStatus(status: WorkItemStatus): boolean {
    return WORK_ITEM_ACTIVE_STATUSES.includes(status as (typeof WORK_ITEM_ACTIVE_STATUSES)[number]);
  }

  private touchWorkItem(issueRef: string): void {
    this.db
      .prepare(`UPDATE work_items SET updated_at = datetime('now', 'utc') WHERE issue_ref = ?`)
      .run(issueRef);
  }

  private insertLog(
    issueRef: string,
    agentId: string,
    action: WorkLogAction,
    detail: string | null,
  ): number {
    const result = this.db
      .prepare(`INSERT INTO work_log (issue_ref, agent_id, action, detail) VALUES (?, ?, ?, ?)`)
      .run(issueRef, agentId, action, detail);
    return Number(result.lastInsertRowid ?? 0);
  }

  private listIssueFiles(issueRef: string): string[] {
    const rows = this.db
      .prepare(`SELECT file_path FROM work_item_files WHERE issue_ref = ? ORDER BY file_path ASC`)
      .all(issueRef) as Array<{ file_path: string }>;
    return rows.map((row) => row.file_path);
  }

  private insertIssueFiles(issueRef: string, files: string[]): void {
    if (!files.length) {
      return;
    }
    const insert = this.db.prepare(
      `INSERT OR IGNORE INTO work_item_files (issue_ref, file_path) VALUES (?, ?)`,
    );
    for (const file of files) {
      insert.run(issueRef, file);
    }
  }

  private removeIssueFiles(issueRef: string, files: string[]): void {
    if (!files.length) {
      return;
    }
    const remove = this.db.prepare(
      `DELETE FROM work_item_files WHERE issue_ref = ? AND file_path = ?`,
    );
    for (const file of files) {
      remove.run(issueRef, file);
    }
  }

  private replaceIssueFiles(issueRef: string, files: string[]): void {
    this.db.prepare(`DELETE FROM work_item_files WHERE issue_ref = ?`).run(issueRef);
    this.insertIssueFiles(issueRef, files);
  }

  private fetchFilesByIssue(issueRefs: string[]): Map<string, string[]> {
    const uniqueIssueRefs = [...new Set(issueRefs)];
    if (!uniqueIssueRefs.length) {
      return new Map();
    }

    const placeholders = uniqueIssueRefs.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `SELECT issue_ref, file_path FROM work_item_files WHERE issue_ref IN (${placeholders}) ORDER BY issue_ref, file_path`,
      )
      .all(...uniqueIssueRefs) as Array<{ issue_ref: string; file_path: string }>;

    const map = new Map<string, string[]>();
    for (const row of rows) {
      const list = map.get(row.issue_ref) ?? [];
      list.push(row.file_path);
      map.set(row.issue_ref, list);
    }

    return map;
  }

  private collectConflicts(queryPaths: string[], excludeAgentId: string | null): FileConflict[] {
    if (!queryPaths.length) {
      return [];
    }

    const canonicalQueries = canonicalizeAbsolutePaths(queryPaths);
    const where = [statusListSql("w")];
    const params: Array<string | number> = [...WORK_ITEM_ACTIVE_STATUSES];

    if (excludeAgentId) {
      where.push("w.agent_id != ?");
      params.push(excludeAgentId);
    }

    const rows = this.db
      .prepare(
        `SELECT w.issue_ref, w.agent_id, w.status, f.file_path
         FROM work_items w
         JOIN work_item_files f ON f.issue_ref = w.issue_ref
         WHERE ${where.join(" AND ")}
         ORDER BY w.issue_ref, f.file_path`,
      )
      .all(...params) as Array<{
      issue_ref: string;
      agent_id: string;
      status: WorkItemStatus;
      file_path: string;
    }>;

    const grouped = new Map<string, { agentId: string; status: WorkItemStatus; files: string[] }>();

    for (const row of rows) {
      const entry = grouped.get(row.issue_ref) ?? {
        agentId: row.agent_id,
        status: row.status,
        files: [],
      };
      entry.files.push(row.file_path);
      grouped.set(row.issue_ref, entry);
    }

    const conflicts: FileConflict[] = [];

    for (const [issueRef, value] of grouped.entries()) {
      const matching = value.files.filter((candidate) =>
        canonicalQueries.some((query) => pathsOverlap(query, candidate)),
      );

      if (matching.length === 0) {
        continue;
      }

      conflicts.push({
        issueRef,
        agentId: value.agentId,
        status: value.status,
        matchingFiles: [...new Set(matching)].sort(),
      });
    }

    conflicts.sort((a, b) => a.issueRef.localeCompare(b.issueRef));
    return conflicts;
  }

  private toItem(row: WorkItemRow, files: string[], staleThresholdHours: number): WorkItem {
    const staleThresholdMs = staleThresholdHours * 60 * 60 * 1000;
    const updatedMs = sqliteUtcToEpochMs(row.updated_at);
    const isTerminal = row.status === "done" || row.status === "dropped";

    return {
      id: row.id,
      issueRef: row.issue_ref,
      title: row.title,
      agentId: row.agent_id,
      squad: row.squad,
      status: row.status,
      branch: row.branch,
      worktreePath: row.worktree_path,
      prUrl: row.pr_url,
      blockedReason: row.blocked_reason,
      priority: row.priority,
      scope: parseJsonStringArray(row.scope_json),
      tags: parseJsonStringArray(row.tags_json),
      files,
      claimedAt: row.claimed_at,
      updatedAt: row.updated_at,
      claimedSessionKey: row.claimed_session_key,
      isStale:
        !isTerminal && Number.isFinite(updatedMs) && Date.now() - updatedMs > staleThresholdMs,
    };
  }
}

function resolveUserPath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error("dbPath is required");
  }
  if (trimmed === "~" || trimmed.startsWith("~/")) {
    const home = process.env.HOME;
    if (!home) {
      throw new Error("Cannot resolve '~' because HOME is unset");
    }
    return path.resolve(path.join(home, trimmed.slice(2)));
  }
  return path.resolve(trimmed);
}

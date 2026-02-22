import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { exportWorkqState } from "./export.js";
import { getValidTransitions } from "./state-machine.js";
import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  type FileConflict,
  type WorkItem,
  type WorkItemStatus,
  type WorkqDatabaseApi,
} from "./types.js";

const TOOL_NAMES = [
  "workq_claim",
  "workq_release",
  "workq_status",
  "workq_query",
  "workq_files",
  "workq_log",
  "workq_done",
  "workq_export",
] as const;

const PRIORITY_VALUES = [...WORK_ITEM_PRIORITIES] as string[];
const STATUS_VALUES = [...WORK_ITEM_STATUSES] as string[];

const PRIORITY_SCHEMA = Type.Union([
  Type.Literal("critical"),
  Type.Literal("high"),
  Type.Literal("medium"),
  Type.Literal("low"),
]);

const STATUS_SCHEMA = Type.Union([
  Type.Literal("claimed"),
  Type.Literal("in-progress"),
  Type.Literal("blocked"),
  Type.Literal("in-review"),
  Type.Literal("done"),
  Type.Literal("dropped"),
]);

interface ToolContextLike {
  agentId?: string | null;
}

interface ScopeOverlapWarning {
  issue_ref: string;
  agent_id: string;
  overlapping_scopes: string[];
}

interface ClaimWarnings {
  file_conflicts?: Array<{ issue_ref: string; agent_id: string; matching_files: string[] }>;
  scope_overlaps?: ScopeOverlapWarning[];
}

export function registerWorkqTools(
  api: OpenClawPluginApi,
  db: WorkqDatabaseApi,
  staleThresholdHours: number,
): void {
  const staleHours = Math.max(1, Math.floor(staleThresholdHours || 24));

  api.registerTool(
    (ctx: ToolContextLike) => {
      const boundAgentId = normalizeText(ctx?.agentId) ?? null;

      return [
        {
          name: "workq_claim",
          description: "Claim a work item for the current agent.",
          parameters: Type.Object(
            {
              issue_ref: Type.String({
                description: "Issue reference (owner/repo#123 or free-form id)",
              }),
              title: Type.Optional(Type.String()),
              squad: Type.Optional(Type.String()),
              files: Type.Optional(Type.Array(Type.String())),
              branch: Type.Optional(Type.String()),
              worktree_path: Type.Optional(Type.String()),
              priority: Type.Optional(PRIORITY_SCHEMA),
              scope: Type.Optional(Type.Array(Type.String())),
              tags: Type.Optional(Type.Array(Type.String())),
              reopen: Type.Optional(Type.Boolean()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            try {
              const agentId = requireAgentId(boundAgentId);
              const params = asRecord(rawParams);
              const issueRef = requiredString(params, "issue_ref");

              const result = db.claim({
                issueRef,
                agentId,
                title: optionalString(params, "title") ?? undefined,
                squad: optionalString(params, "squad") ?? undefined,
                files: optionalStringArray(params, "files") ?? undefined,
                branch: optionalString(params, "branch") ?? undefined,
                worktreePath: optionalString(params, "worktree_path") ?? undefined,
                priority: optionalEnum(params, "priority", PRIORITY_VALUES) as
                  | "critical"
                  | "high"
                  | "medium"
                  | "low"
                  | undefined,
                scope: optionalStringArray(params, "scope") ?? undefined,
                tags: optionalStringArray(params, "tags") ?? undefined,
                reopen: optionalBoolean(params, "reopen"),
              });

              if (result.status === "conflict") {
                return jsonResult({
                  status: "conflict",
                  issue_ref: result.issueRef,
                  claimed_by: result.claimedBy,
                  claimed_at: result.claimedAt,
                  current_status: result.currentStatus,
                });
              }

              const warnings = collectClaimWarnings(db, result.item, agentId, staleHours);

              if (result.status === "already_yours") {
                return jsonResult({
                  status: "already_yours",
                  issue_ref: result.item.issueRef,
                  ...(warnings ? { warnings } : {}),
                });
              }

              return jsonResult({
                status: "claimed",
                issue_ref: result.item.issueRef,
                agent_id: result.item.agentId,
                ...(warnings ? { warnings } : {}),
              });
            } catch (error) {
              return jsonResult(errorPayload(error));
            }
          },
        },

        {
          name: "workq_release",
          description: "Drop a claimed work item.",
          parameters: Type.Object(
            {
              issue_ref: Type.String(),
              reason: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            const params = asRecord(rawParams);
            const issueRef = optionalString(params, "issue_ref") ?? "";
            const before = safeGet(db, issueRef, staleHours);

            try {
              const agentId = requireAgentId(boundAgentId);
              const result = db.release({
                issueRef: requiredString(params, "issue_ref"),
                agentId,
                reason: optionalString(params, "reason") ?? undefined,
              });
              return jsonResult({ status: result.status, issue_ref: result.issueRef });
            } catch (error) {
              return jsonResult(transitionAwareErrorPayload(error, before?.status));
            }
          },
        },

        {
          name: "workq_status",
          description: "Update work item status.",
          parameters: Type.Object(
            {
              issue_ref: Type.String(),
              status: STATUS_SCHEMA,
              reason: Type.Optional(Type.String()),
              pr_url: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            const params = asRecord(rawParams);
            const issueRef = optionalString(params, "issue_ref") ?? "";
            const targetStatus = optionalEnum(params, "status", STATUS_VALUES) as
              | WorkItemStatus
              | undefined;
            const before = safeGet(db, issueRef, staleHours);

            try {
              const agentId = requireAgentId(boundAgentId);
              const result = db.status({
                issueRef: requiredString(params, "issue_ref"),
                agentId,
                status: requiredEnum(params, "status", STATUS_VALUES) as WorkItemStatus,
                reason: optionalString(params, "reason") ?? undefined,
                prUrl: optionalString(params, "pr_url") ?? undefined,
              });

              return jsonResult({
                status: result.status,
                issue_ref: result.issueRef,
                from: result.from,
                to: result.to,
              });
            } catch (error) {
              return jsonResult(transitionAwareErrorPayload(error, before?.status, targetStatus));
            }
          },
        },

        {
          name: "workq_query",
          description: "Query work queue items.",
          parameters: Type.Object(
            {
              squad: Type.Optional(Type.String()),
              agent_id: Type.Optional(Type.String()),
              status: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
              priority: Type.Optional(Type.Union([Type.String(), Type.Array(Type.String())])),
              scope: Type.Optional(Type.String()),
              issue_ref: Type.Optional(Type.String()),
              active_only: Type.Optional(Type.Boolean()),
              updated_after: Type.Optional(Type.String()),
              updated_before: Type.Optional(Type.String()),
              limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 200 })),
              offset: Type.Optional(Type.Integer({ minimum: 0 })),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            try {
              const agentId = requireAgentId(boundAgentId);
              const params = asRecord(rawParams);

              const statusFilter = optionalEnumOrEnumList(params, "status", STATUS_VALUES) as
                | WorkItemStatus
                | WorkItemStatus[]
                | undefined;

              const priorityFilter = optionalEnumOrEnumList(params, "priority", PRIORITY_VALUES) as
                | "critical"
                | "high"
                | "medium"
                | "low"
                | Array<"critical" | "high" | "medium" | "low">
                | undefined;

              const explicitAgentFilter = optionalString(params, "agent_id") ?? undefined;

              const hasFilterBeyondPaging = Boolean(
                explicitAgentFilter ||
                optionalString(params, "squad") ||
                statusFilter ||
                priorityFilter ||
                optionalString(params, "scope") ||
                optionalString(params, "issue_ref") ||
                optionalString(params, "updated_after") ||
                optionalString(params, "updated_before"),
              );

              const effectiveAgentId =
                explicitAgentFilter ?? (hasFilterBeyondPaging ? undefined : agentId);

              const result = db.query({
                squad: optionalString(params, "squad") ?? undefined,
                agentId: effectiveAgentId,
                status: statusFilter,
                priority: priorityFilter,
                scope: optionalString(params, "scope") ?? undefined,
                issueRef: optionalString(params, "issue_ref") ?? undefined,
                activeOnly: optionalBoolean(params, "active_only"),
                updatedAfter: optionalString(params, "updated_after") ?? undefined,
                updatedBefore: optionalString(params, "updated_before") ?? undefined,
                limit: optionalNumber(params, "limit") ?? undefined,
                offset: optionalNumber(params, "offset") ?? undefined,
                staleThresholdHours: staleHours,
              });

              return jsonResult({
                items: result.items.map(toApiItem),
                total: result.total,
              });
            } catch (error) {
              return jsonResult(errorPayload(error));
            }
          },
        },

        {
          name: "workq_files",
          description: "Check or mutate tracked work item files.",
          parameters: Type.Object(
            {
              mode: Type.Optional(
                Type.Union([
                  Type.Literal("check"),
                  Type.Literal("set"),
                  Type.Literal("add"),
                  Type.Literal("remove"),
                ]),
              ),
              issue_ref: Type.Optional(Type.String()),
              path: Type.Optional(Type.String()),
              paths: Type.Optional(Type.Array(Type.String())),
              exclude_self: Type.Optional(Type.Boolean()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            const params = asRecord(rawParams);
            const issueRef = optionalString(params, "issue_ref") ?? "";
            const before = safeGet(db, issueRef, staleHours);

            try {
              const agentId = requireAgentId(boundAgentId);
              const mode = (optionalString(params, "mode") ?? "check") as
                | "check"
                | "set"
                | "add"
                | "remove";

              if (!["check", "set", "add", "remove"].includes(mode)) {
                throw new Error("mode must be one of: check, set, add, remove");
              }

              const result =
                mode === "check"
                  ? db.files({
                      mode: "check",
                      path: requiredString(params, "path"),
                      excludeAgentId: optionalBoolean(params, "exclude_self") ? agentId : undefined,
                    })
                  : db.files({
                      mode,
                      issueRef: requiredString(params, "issue_ref"),
                      paths: requiredStringArray(params, "paths"),
                      agentId,
                    });

              return jsonResult({
                mode: result.mode,
                conflicts: result.conflicts.map(toApiConflict),
                has_conflicts: result.hasConflicts,
                ...(result.files ? { files: result.files } : {}),
                ...(result.added ? { added: result.added } : {}),
                ...(result.removed ? { removed: result.removed } : {}),
              });
            } catch (error) {
              return jsonResult(transitionAwareErrorPayload(error, before?.status));
            }
          },
        },

        {
          name: "workq_log",
          description: "Append a decision note to a work item.",
          parameters: Type.Object(
            {
              issue_ref: Type.String(),
              note: Type.String(),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            try {
              const agentId = requireAgentId(boundAgentId);
              const params = asRecord(rawParams);
              const result = db.log({
                issueRef: requiredString(params, "issue_ref"),
                agentId,
                note: requiredString(params, "note"),
              });

              return jsonResult({
                status: result.status,
                issue_ref: result.issueRef,
                log_id: result.logId,
              });
            } catch (error) {
              return jsonResult(errorPayload(error));
            }
          },
        },

        {
          name: "workq_done",
          description: "Mark a work item as done and attach a PR URL.",
          parameters: Type.Object(
            {
              issue_ref: Type.String(),
              pr_url: Type.String(),
              summary: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            const params = asRecord(rawParams);
            const issueRef = optionalString(params, "issue_ref") ?? "";
            const before = safeGet(db, issueRef, staleHours);

            try {
              const agentId = requireAgentId(boundAgentId);
              const result = db.done({
                issueRef: requiredString(params, "issue_ref"),
                agentId,
                prUrl: requiredString(params, "pr_url"),
                summary: optionalString(params, "summary") ?? undefined,
              });

              return jsonResult({
                status: result.status,
                issue_ref: result.issueRef,
                pr_url: result.prUrl,
              });
            } catch (error) {
              return jsonResult(transitionAwareErrorPayload(error, before?.status, "done"));
            }
          },
        },

        {
          name: "workq_export",
          description: "Export work queue state as markdown or JSON.",
          parameters: Type.Object(
            {
              format: Type.Optional(Type.Union([Type.Literal("markdown"), Type.Literal("json")])),
              include_done: Type.Optional(Type.Boolean()),
              include_log: Type.Optional(Type.Boolean()),
              squad: Type.Optional(Type.String()),
            },
            { additionalProperties: false },
          ),
          async execute(_toolCallId: string, rawParams: unknown) {
            try {
              const params = asRecord(rawParams);
              const format = (optionalString(params, "format") ?? "markdown") as
                | "markdown"
                | "json";

              if (!["markdown", "json"].includes(format)) {
                throw new Error("format must be one of: markdown, json");
              }

              const includeDone = optionalBoolean(params, "include_done") ?? false;
              const includeLog = optionalBoolean(params, "include_log") ?? false;
              const squad = optionalString(params, "squad") ?? undefined;

              const exportResult = exportWorkqState(db, {
                format,
                includeDone,
                includeLog,
                squad,
                staleThresholdHours: staleHours,
              });

              return jsonResult({
                format: exportResult.format,
                generated_at: exportResult.generatedAt,
                content: exportResult.content,
                state: exportResult.state,
              });
            } catch (error) {
              return jsonResult(errorPayload(error));
            }
          },
        },
      ];
    },
    {
      optional: true,
      names: [...TOOL_NAMES],
    },
  );
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
    details: payload,
  };
}

function errorPayload(error: unknown): { status: "error"; message: string } {
  return {
    status: "error",
    message: error instanceof Error ? error.message : String(error),
  };
}

function transitionAwareErrorPayload(
  error: unknown,
  currentStatus?: WorkItemStatus,
  requestedStatus?: WorkItemStatus,
): Record<string, unknown> {
  const payload: Record<string, unknown> = errorPayload(error);
  const message = String(payload.message ?? "");

  const shouldAttachTransitions =
    Boolean(currentStatus) &&
    (message.includes("Invalid status transition") ||
      message.includes("Cannot mark done from status") ||
      message.includes("terminal status"));

  if (currentStatus && shouldAttachTransitions) {
    payload.current_status = currentStatus;
    payload.valid_transitions = getValidTransitions(currentStatus);
    if (requestedStatus) {
      payload.requested_status = requestedStatus;
    }
  }

  return payload;
}

function collectClaimWarnings(
  db: WorkqDatabaseApi,
  item: WorkItem,
  agentId: string,
  staleThresholdHours: number,
): ClaimWarnings | undefined {
  const fileConflicts = collectFileConflictWarnings(db, item, agentId);
  const scopeOverlaps = collectScopeOverlapWarnings(db, item, agentId, staleThresholdHours);

  const warnings: ClaimWarnings = {};
  if (fileConflicts.length) {
    warnings.file_conflicts = fileConflicts;
  }
  if (scopeOverlaps.length) {
    warnings.scope_overlaps = scopeOverlaps;
  }

  return warnings.file_conflicts || warnings.scope_overlaps ? warnings : undefined;
}

function collectFileConflictWarnings(
  db: WorkqDatabaseApi,
  item: WorkItem,
  agentId: string,
): Array<{ issue_ref: string; agent_id: string; matching_files: string[] }> {
  if (!item.files.length) {
    return [];
  }

  const grouped = new Map<string, { agentId: string; matchingFiles: Set<string> }>();

  for (const filePath of item.files) {
    const result = db.files({
      mode: "check",
      path: filePath,
      excludeAgentId: agentId,
    });

    for (const conflict of result.conflicts) {
      if (conflict.issueRef === item.issueRef) {
        continue;
      }

      const existing = grouped.get(conflict.issueRef) ?? {
        agentId: conflict.agentId,
        matchingFiles: new Set<string>(),
      };

      for (const match of conflict.matchingFiles) {
        existing.matchingFiles.add(match);
      }

      grouped.set(conflict.issueRef, existing);
    }
  }

  return [...grouped.entries()]
    .map(([issueRef, value]) => ({
      issue_ref: issueRef,
      agent_id: value.agentId,
      matching_files: [...value.matchingFiles].sort(),
    }))
    .sort((a, b) => a.issue_ref.localeCompare(b.issue_ref));
}

function collectScopeOverlapWarnings(
  db: WorkqDatabaseApi,
  item: WorkItem,
  agentId: string,
  staleThresholdHours: number,
): ScopeOverlapWarning[] {
  if (!item.scope.length) {
    return [];
  }

  const grouped = new Map<string, { agentId: string; scopes: Set<string> }>();

  for (const scope of item.scope) {
    const scopedItems = queryAllByScope(db, scope, staleThresholdHours);
    for (const candidate of scopedItems) {
      if (candidate.issueRef === item.issueRef || candidate.agentId === agentId) {
        continue;
      }

      const existing = grouped.get(candidate.issueRef) ?? {
        agentId: candidate.agentId,
        scopes: new Set<string>(),
      };
      existing.scopes.add(scope);
      grouped.set(candidate.issueRef, existing);
    }
  }

  return [...grouped.entries()]
    .map(([issueRef, value]) => ({
      issue_ref: issueRef,
      agent_id: value.agentId,
      overlapping_scopes: [...value.scopes].sort(),
    }))
    .sort((a, b) => a.issue_ref.localeCompare(b.issue_ref));
}

function queryAllByScope(
  db: WorkqDatabaseApi,
  scope: string,
  staleThresholdHours: number,
): WorkItem[] {
  const pageSize = 200;
  const items: WorkItem[] = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (items.length < total) {
    const page = db.query({
      scope,
      activeOnly: true,
      staleThresholdHours,
      limit: pageSize,
      offset,
    });

    total = page.total;
    if (!page.items.length) {
      break;
    }

    items.push(...page.items);
    offset += page.items.length;
  }

  return items;
}

function safeGet(db: WorkqDatabaseApi, issueRef: string, staleHours: number): WorkItem | null {
  const normalized = normalizeText(issueRef);
  if (!normalized) {
    return null;
  }
  try {
    return db.get(normalized, staleHours);
  } catch {
    return null;
  }
}

function toApiItem(item: WorkItem) {
  return {
    issue_ref: item.issueRef,
    title: item.title,
    agent_id: item.agentId,
    squad: item.squad,
    status: item.status,
    priority: item.priority,
    scope: item.scope,
    tags: item.tags,
    files: item.files,
    branch: item.branch,
    pr_url: item.prUrl,
    blocked_reason: item.blockedReason,
    claimed_at: item.claimedAt,
    updated_at: item.updatedAt,
    is_stale: item.isStale,
  };
}

function toApiConflict(conflict: FileConflict) {
  return {
    issue_ref: conflict.issueRef,
    agent_id: conflict.agentId,
    status: conflict.status,
    matching_files: conflict.matchingFiles,
  };
}

function requireAgentId(value: string | null): string {
  const normalized = normalizeText(value);
  if (!normalized) {
    throw new Error("agent identity unavailable in tool context");
  }
  return normalized;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function requiredString(obj: Record<string, unknown>, key: string): string {
  const value = optionalString(obj, key);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalString(obj: Record<string, unknown>, key: string): string | null {
  return normalizeText(obj[key]);
}

function requiredStringArray(obj: Record<string, unknown>, key: string): string[] {
  const values = optionalStringArray(obj, key);
  if (!values || values.length === 0) {
    throw new Error(`${key} is required`);
  }
  return values;
}

function optionalStringArray(obj: Record<string, unknown>, key: string): string[] | null {
  const raw = obj[key];
  if (!Array.isArray(raw)) {
    return null;
  }
  const normalized = raw
    .map((entry) => normalizeText(entry))
    .filter((entry): entry is string => typeof entry === "string");

  if (!normalized.length) {
    return [];
  }

  return [...new Set(normalized)];
}

function optionalBoolean(obj: Record<string, unknown>, key: string): boolean | undefined {
  const raw = obj[key];
  if (typeof raw !== "boolean") {
    return undefined;
  }
  return raw;
}

function optionalNumber(obj: Record<string, unknown>, key: string): number | undefined {
  const raw = obj[key];
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    return undefined;
  }
  return raw;
}

function optionalEnum(
  obj: Record<string, unknown>,
  key: string,
  allowed: string[],
): string | undefined {
  const value = optionalString(obj, key);
  if (!value) {
    return undefined;
  }
  if (!allowed.includes(value)) {
    throw new Error(`${key} must be one of: ${allowed.join(", ")}`);
  }
  return value;
}

function requiredEnum(obj: Record<string, unknown>, key: string, allowed: string[]): string {
  const value = optionalEnum(obj, key, allowed);
  if (!value) {
    throw new Error(`${key} is required`);
  }
  return value;
}

function optionalEnumOrEnumList(
  obj: Record<string, unknown>,
  key: string,
  allowed: string[],
): string | string[] | undefined {
  const raw = obj[key];
  if (raw === undefined || raw === null) {
    return undefined;
  }

  if (typeof raw === "string") {
    return optionalEnum(obj, key, allowed);
  }

  if (Array.isArray(raw)) {
    const values = raw
      .map((entry) => normalizeText(entry))
      .filter((entry): entry is string => typeof entry === "string");

    if (!values.length) {
      return undefined;
    }

    const uniqueValues = [...new Set(values)];
    const invalid = uniqueValues.find((value) => !allowed.includes(value));
    if (invalid) {
      throw new Error(`${key} contains invalid value: ${invalid}`);
    }

    return uniqueValues;
  }

  throw new Error(`${key} must be a string or array of strings`);
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

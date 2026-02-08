import { Type } from "@sinclair/typebox";
import { loadConfig, type OpenClawConfig } from "../../config/config.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import { getDefaultWorkQueueStore, readRefs, validateRef } from "../../work-queue/index.js";
import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_REF_KINDS,
  WORK_ITEM_STATUSES,
  type WorkItemPatch,
  type WorkItemPriority,
  type WorkItemRef,
  type WorkItemStatus,
} from "../../work-queue/types.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { optionalStringEnum, stringEnum } from "../schema/typebox.js";
import {
  type AnyAgentTool,
  jsonResult,
  readNumberParam,
  readStringArrayParam,
  readStringParam,
} from "./common.js";

const WORK_ITEM_ACTIONS = [
  "add",
  "claim",
  "update",
  "list",
  "get",
  "complete",
  "fail",
  "block",
  "unblock",
  "cancel",
  "reassign",
] as const;

const attachRefs = <T extends { payload?: Record<string, unknown> }>(item: T): T => {
  const refs = readRefs(item.payload);
  return refs.length > 0 ? ({ ...item, refs } as T) : item;
};

const parseRefsParam = (params: Record<string, unknown>): WorkItemRef[] | undefined => {
  if (!Object.prototype.hasOwnProperty.call(params, "refs")) {
    return undefined;
  }
  const refs = (params as { refs?: unknown }).refs;
  if (refs === undefined) {
    return undefined;
  }
  if (!Array.isArray(refs)) {
    throw new Error("refs must be an array");
  }
  for (const ref of refs) {
    if (!validateRef(ref as WorkItemRef)) {
      throw new Error(`Invalid ref: ${JSON.stringify(ref)}`);
    }
  }
  return refs as WorkItemRef[];
};

const mergePayloadRefs = (
  payload: Record<string, unknown> | undefined,
  refs: WorkItemRef[] | undefined,
): Record<string, unknown> | undefined => {
  if (!refs) {
    return payload;
  }
  return { ...(payload ?? {}), refs };
};

const WorkItemToolSchema = Type.Object({
  action: stringEnum(WORK_ITEM_ACTIONS),
  itemId: Type.Optional(Type.String()),
  queueId: Type.Optional(Type.String()),
  agentId: Type.Optional(Type.String()),
  title: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  payload: Type.Optional(Type.Object({}, { additionalProperties: true })),
  refs: Type.Optional(
    Type.Array(
      Type.Object({
        kind: stringEnum(WORK_ITEM_REF_KINDS),
        id: Type.String(),
        label: Type.Optional(Type.String()),
        uri: Type.Optional(Type.String()),
      }),
    ),
  ),
  priority: optionalStringEnum(WORK_ITEM_PRIORITIES),
  parentItemId: Type.Optional(Type.String()),
  dependsOn: Type.Optional(Type.Array(Type.String())),
  blockedBy: Type.Optional(Type.Array(Type.String())),
  workstream: Type.Optional(Type.String()),
  tags: Type.Optional(Type.Array(Type.String())),
  status: optionalStringEnum(WORK_ITEM_STATUSES),
  statusReason: Type.Optional(Type.String()),
  result: Type.Optional(Type.Object({}, { additionalProperties: true })),
  error: Type.Optional(Type.Object({}, { additionalProperties: true })),
  statuses: Type.Optional(Type.Array(stringEnum(WORK_ITEM_STATUSES))),
  priorities: Type.Optional(Type.Array(stringEnum(WORK_ITEM_PRIORITIES))),
  assignedTo: Type.Optional(Type.String()),
  createdBy: Type.Optional(Type.String()),
  limit: Type.Optional(Type.Number({ minimum: 1, maximum: 200 })),
  offset: Type.Optional(Type.Number({ minimum: 0 })),
  orderBy: optionalStringEnum(["createdAt", "updatedAt", "priority"] as const),
  orderDir: optionalStringEnum(["asc", "desc"] as const),
  includeCompleted: Type.Optional(Type.Boolean()),
});

type WorkItemToolOptions = {
  agentSessionKey?: string;
  config?: OpenClawConfig;
};

function resolveAgentId(options: WorkItemToolOptions, agentId?: string) {
  const raw = agentId?.trim();
  if (raw) {
    return raw;
  }
  return resolveSessionAgentId({ sessionKey: options.agentSessionKey, config: options.config });
}

function coerceStatuses(
  statuses?: string[],
  status?: string,
  includeCompleted?: boolean,
): WorkItemStatus[] | undefined {
  if (statuses && statuses.length > 0) {
    return statuses as WorkItemStatus[];
  }
  if (status) {
    return [status as WorkItemStatus];
  }
  if (includeCompleted === false) {
    return ["pending", "in_progress", "blocked"];
  }
  return undefined;
}

/** Build a map of normalised agentId → human-readable name from config. */
function buildAgentNameMap(cfg: OpenClawConfig): Map<string, string> {
  const map = new Map<string, string>();
  const agents = Array.isArray(cfg.agents?.list) ? cfg.agents.list : [];
  for (const entry of agents) {
    const name = entry?.name?.trim();
    if (name) {
      map.set(normalizeAgentId(entry.id), name);
    }
  }
  return map;
}

export function createWorkItemTool(options: WorkItemToolOptions = {}): AnyAgentTool {
  return {
    name: "work_item",
    label: "Work Item",
    description: `Manage work items in agent queues. Items persist after completion for history.
Items support DAG dependencies (dependsOn) — claim skips items with unsatisfied deps.
Use workstream to group related items across queues (workstream is shared context, not a queue id).
To attach cross-entity references, pass refs: [{kind, id, label?, uri?}] so the system can index and link them.

Actions:
- add: Create a new work item (supports dependsOn, workstream, optional assignedTo, refs)
- claim: Atomically claim the next DAG-ready item (optional workstream filter)
- update: Update item fields (title, description, priority, tags, workstream, assignedTo, refs)
- list: Query items with filters (status, priority, tags, workstream, date range)
- get: Get a single item by ID with full details
- complete: Mark item as completed with optional result
- fail: Mark item as failed with error details
- block: Mark item as blocked with reason
- unblock: Clear block, return to pending
- cancel: Cancel a pending or blocked item
- reassign: Move item to a different queue/agent`,
    parameters: WorkItemToolSchema,
    async execute(_toolCallId, params) {
      const action = readStringParam(params, "action", { required: true });
      const store = await getDefaultWorkQueueStore();
      const itemId = readStringParam(params, "itemId");
      const queueId = readStringParam(params, "queueId");
      const rawAgentId = readStringParam(params, "agentId");
      const agentId = resolveAgentId(options, rawAgentId);
      const title = readStringParam(params, "title");
      const description = readStringParam(params, "description");
      const priority = readStringParam(params, "priority") as WorkItemPriority | undefined;
      const parentItemId = readStringParam(params, "parentItemId");
      const workstream = readStringParam(params, "workstream");
      const dependsOn = readStringArrayParam(params, "dependsOn");
      const blockedBy = readStringArrayParam(params, "blockedBy");
      const tags = readStringArrayParam(params, "tags");
      const statusReason = readStringParam(params, "statusReason");
      const status = readStringParam(params, "status") as WorkItemStatus | undefined;
      const assignedToAgentId = readStringParam(params, "assignedTo");
      const hasAssignedToParam = Object.prototype.hasOwnProperty.call(params, "assignedTo");
      const result = (params as { result?: Record<string, unknown> }).result;
      const error = (params as { error?: Record<string, unknown> }).error as
        | import("../../work-queue/types.js").WorkItemError
        | undefined;
      const payload = (params as { payload?: Record<string, unknown> }).payload;
      const refs = parseRefsParam(params);

      switch (action) {
        case "add": {
          if (!title) {
            throw new Error("title required");
          }
          const createdBy = {
            sessionKey: options.agentSessionKey,
            agentId,
          };
          const item = await store.createItem({
            queueId,
            agentId,
            title,
            description,
            payload: mergePayloadRefs(payload, refs),
            priority,
            workstream,
            parentItemId,
            dependsOn,
            blockedBy,
            tags,
            createdBy,
            ...(hasAssignedToParam
              ? { assignedTo: assignedToAgentId ? { agentId: assignedToAgentId } : undefined }
              : {}),
            status: status ?? "pending",
            statusReason,
          });
          return jsonResult({ item });
        }
        case "claim": {
          const assignTo = { sessionKey: options.agentSessionKey, agentId };
          const claimed = await store.claimNextItem({ queueId, agentId, assignTo, workstream });
          return jsonResult({ item: claimed });
        }
        case "update": {
          if (!itemId) {
            throw new Error("itemId required");
          }

          const hasParam = (key: string) => Object.prototype.hasOwnProperty.call(params, key);
          const patch: WorkItemPatch = {};

          if (hasParam("title")) patch.title = title;
          if (hasParam("description")) patch.description = description;
          if (hasParam("payload") || refs) {
            if (!hasParam("payload") && refs) {
              const existing = await store.getItem(itemId);
              patch.payload = mergePayloadRefs(existing?.payload, refs);
            } else {
              patch.payload = mergePayloadRefs(payload, refs);
            }
          }
          if (hasParam("priority")) patch.priority = priority;
          if (hasParam("workstream")) patch.workstream = workstream;
          if (hasParam("tags")) patch.tags = tags;
          if (hasParam("status")) patch.status = status;
          if (hasParam("statusReason")) patch.statusReason = statusReason;
          if (hasParam("dependsOn")) patch.dependsOn = dependsOn;
          if (hasParam("blockedBy")) patch.blockedBy = blockedBy;
          if (hasParam("parentItemId")) patch.parentItemId = parentItemId;
          if (hasAssignedToParam) {
            patch.assignedTo = assignedToAgentId ? { agentId: assignedToAgentId } : undefined;
          }

          if (Object.keys(patch).length === 0) {
            throw new Error("No update fields provided");
          }

          const updated = await store.updateItem(itemId, patch);
          return jsonResult({ item: updated });
        }
        case "list": {
          const statuses = readStringArrayParam(params, "statuses");
          const priorities = readStringArrayParam(params, "priorities");
          const createdBy = readStringParam(params, "createdBy");
          const includeCompleted =
            typeof params.includeCompleted === "boolean" ? params.includeCompleted : false;
          const limit = readNumberParam(params, "limit", { integer: true });
          const offset = readNumberParam(params, "offset", { integer: true });
          const orderBy = readStringParam(params, "orderBy") as
            | "createdAt"
            | "updatedAt"
            | "priority"
            | undefined;
          const orderDir = readStringParam(params, "orderDir") as "asc" | "desc" | undefined;
          const filteredStatuses = coerceStatuses(statuses, status, includeCompleted);
          const items = await store.listItems({
            queueId,
            status: filteredStatuses,
            priority: priorities ? (priorities as WorkItemPriority[]) : undefined,
            workstream,
            tags,
            assignedTo: assignedToAgentId,
            createdBy,
            parentItemId,
            limit: limit ?? undefined,
            offset: offset ?? undefined,
            orderBy,
            orderDir,
          });

          // Resolve agent names for assignedTo so callers see human-readable names.
          const cfg = options.config ?? loadConfig();
          const nameMap = buildAgentNameMap(cfg);
          const enriched = items.map((item) => {
            const aid = item.assignedTo?.agentId;
            const agentName = aid ? nameMap.get(normalizeAgentId(aid)) : undefined;
            return agentName ? { ...item, agentName } : item;
          });
          return jsonResult({ items: enriched.map((item) => attachRefs(item)) });
        }
        case "get": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const item = await store.getItem(itemId);
          return jsonResult({ item: item ? attachRefs(item) : item });
        }
        case "complete": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const now = new Date().toISOString();
          const updated = await store.updateItem(itemId, {
            status: "completed",
            statusReason,
            result,
            completedAt: now,
          });
          return jsonResult({ item: updated });
        }
        case "fail": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const now = new Date().toISOString();
          const updated = await store.updateItem(itemId, {
            status: "failed",
            statusReason,
            error,
            completedAt: now,
          });
          return jsonResult({ item: updated });
        }
        case "block": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const updated = await store.updateItem(itemId, {
            status: "blocked",
            statusReason,
          });
          return jsonResult({ item: updated });
        }
        case "unblock": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const updated = await store.updateItem(itemId, {
            status: "pending",
            statusReason,
          });
          return jsonResult({ item: updated });
        }
        case "cancel": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          const now = new Date().toISOString();
          const updated = await store.updateItem(itemId, {
            status: "cancelled",
            statusReason,
            completedAt: now,
          });
          return jsonResult({ item: updated });
        }
        case "reassign": {
          if (!itemId) {
            throw new Error("itemId required");
          }
          if (!queueId && !rawAgentId) {
            throw new Error("queueId or agentId required");
          }
          const targetQueueId = queueId
            ? (await store.getQueue(queueId))?.id
            : (await store.ensureQueueForAgent(resolveAgentId(options, rawAgentId)))?.id;
          if (!targetQueueId) {
            throw new Error(`Queue not found: ${queueId}`);
          }
          const updated = await store.updateItem(itemId, {
            queueId: targetQueueId,
          });
          return jsonResult({ item: updated });
        }
        default:
          throw new Error(`Unknown action: ${action}`);
      }
    },
  };
}

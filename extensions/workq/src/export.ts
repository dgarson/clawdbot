import {
  WORK_ITEM_ACTIVE_STATUSES,
  WORK_ITEM_STATUSES,
  type QueryFilters,
  type WorkItem,
  type WorkItemStatus,
  type WorkLogEntry,
  type WorkqDatabaseApi,
} from "./types.js";

export type WorkqExportFormat = "markdown" | "json";

export interface WorkqExportOptions {
  format?: WorkqExportFormat;
  includeDone?: boolean;
  include_done?: boolean;
  includeLog?: boolean;
  include_log?: boolean;
  squad?: string;
  staleThresholdHours?: number;
  logLimitPerItem?: number;
  generatedAt?: string | Date;
}

export interface WorkqExportFilters {
  includeDone: boolean;
  includeLog: boolean;
  squad: string | null;
}

export interface WorkqExportCounts {
  total: number;
  byStatus: Record<WorkItemStatus, number>;
  bySquad: Record<string, number>;
}

export interface WorkqExportState {
  generatedAt: string;
  filters: WorkqExportFilters;
  counts: WorkqExportCounts;
  items: WorkItem[];
  logByIssue?: Record<string, WorkLogEntry[]>;
}

export interface WorkqExportResult {
  format: WorkqExportFormat;
  generatedAt: string;
  content: string;
  state: WorkqExportState;
}

const UNASSIGNED_SQUAD_KEY = "unassigned";
const STATUS_ORDER = WORK_ITEM_STATUSES;

const STATUS_ICON: Record<WorkItemStatus, string> = {
  claimed: "🟣",
  "in-progress": "🟡",
  blocked: "🔴",
  "in-review": "🔵",
  done: "✅",
  dropped: "⚪",
};

/**
 * Fetches exportable queue state from the database and renders it as markdown or JSON.
 */
export function exportWorkqState(
  db: Pick<WorkqDatabaseApi, "query" | "getLog">,
  options: WorkqExportOptions = {},
): WorkqExportResult {
  const normalized = normalizeOptions(options);
  const generatedAt = normalizeGeneratedAt(options.generatedAt);

  const items = fetchAllItems(db, {
    squad: normalized.squad ?? undefined,
    activeOnly: !normalized.includeDone,
    staleThresholdHours: options.staleThresholdHours,
  });

  const sortedItems = [...items].sort(compareItemsForExport);
  const logByIssue = normalized.includeLog
    ? buildLogByIssue(db, sortedItems, options.logLimitPerItem)
    : undefined;

  const state: WorkqExportState = {
    generatedAt,
    filters: {
      includeDone: normalized.includeDone,
      includeLog: normalized.includeLog,
      squad: normalized.squad,
    },
    counts: buildCounts(sortedItems),
    items: sortedItems,
    ...(logByIssue ? { logByIssue } : {}),
  };

  const format = options.format ?? "markdown";
  const content = format === "json" ? formatWorkqJson(state) : formatWorkqMarkdown(state);

  return {
    format,
    generatedAt,
    content,
    state,
  };
}

/**
 * Renders a machine-friendly, stable JSON export string.
 */
export function formatWorkqJson(state: WorkqExportState): string {
  return `${JSON.stringify(state, null, 2)}\n`;
}

/**
 * Renders a human-readable markdown snapshot of workq state.
 */
export function formatWorkqMarkdown(state: WorkqExportState): string {
  const lines: string[] = [];

  lines.push("# WorkQ Export");
  lines.push("");
  lines.push(`- generated_at: ${state.generatedAt}`);
  lines.push(`- include_done: ${state.filters.includeDone}`);
  lines.push(`- include_log: ${state.filters.includeLog}`);
  lines.push(`- squad: ${state.filters.squad ?? "all"}`);
  lines.push(`- total_items: ${state.counts.total}`);

  if (!state.items.length) {
    lines.push("");
    lines.push("_No matching work items._");
    return `${lines.join("\n")}\n`;
  }

  const squadOrder = getSquadOrder(state.items);

  for (const squadKey of squadOrder) {
    const squadItems = state.items.filter((item) => normalizeSquadKey(item.squad) === squadKey);
    lines.push("");
    lines.push(`## Squad: ${displaySquadName(squadKey)}`);

    const statusesToRender = state.filters.includeDone ? STATUS_ORDER : WORK_ITEM_ACTIVE_STATUSES;

    for (const status of statusesToRender) {
      const statusItems = squadItems.filter((item) => item.status === status);
      if (!statusItems.length) {
        continue;
      }

      lines.push("");
      lines.push(`### ${status} (${statusItems.length})`);

      for (const item of statusItems) {
        const title = item.title?.trim() || "(untitled)";
        const staleLabel = item.isStale ? " · stale" : "";
        lines.push(
          `- ${STATUS_ICON[item.status]} **${item.issueRef}** ${escapeInlineMarkdown(title)} — ${item.agentId} (${item.status}${staleLabel})`,
        );

        const metadata = [
          `priority=${item.priority}`,
          `updated=${item.updatedAt}`,
          `files=${item.files.length}`,
        ];

        if (item.branch) {
          metadata.push(`branch=${item.branch}`);
        }
        if (item.prUrl) {
          metadata.push(`pr=${item.prUrl}`);
        }

        lines.push(`  - ${metadata.join(" · ")}`);

        if (item.blockedReason) {
          lines.push(`  - blocked_reason: ${escapeInlineMarkdown(item.blockedReason)}`);
        }

        if (item.scope.length) {
          lines.push(`  - scope: ${item.scope.join(", ")}`);
        }

        if (item.tags.length) {
          lines.push(`  - tags: ${item.tags.join(", ")}`);
        }
      }
    }
  }

  if (state.filters.includeLog) {
    lines.push("");
    lines.push("## Activity Log");

    const issueRefs = [...new Set(state.items.map((item) => item.issueRef))].sort((a, b) =>
      a.localeCompare(b),
    );

    if (!issueRefs.length) {
      lines.push("");
      lines.push("_No activity log entries._");
    }

    for (const issueRef of issueRefs) {
      const entries = state.logByIssue?.[issueRef] ?? [];
      lines.push("");
      lines.push(`### ${issueRef} (${entries.length})`);

      if (!entries.length) {
        lines.push("- _No log entries_");
        continue;
      }

      for (const entry of entries) {
        const detail = entry.detail ? ` · ${entry.detail}` : "";
        lines.push(
          `- ${entry.createdAt} · ${entry.agentId} · ${entry.action}${escapeInlineMarkdown(detail)}`,
        );
      }
    }
  }

  return `${lines.join("\n")}\n`;
}

function normalizeOptions(options: WorkqExportOptions): WorkqExportFilters {
  const includeDone = options.include_done ?? options.includeDone ?? false;
  const includeLog = options.include_log ?? options.includeLog ?? false;
  const squad = options.squad?.trim() || null;

  return {
    includeDone,
    includeLog,
    squad,
  };
}

function normalizeGeneratedAt(value?: string | Date): string {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed).toISOString();
    }
  }
  return new Date().toISOString();
}

function fetchAllItems(
  db: Pick<WorkqDatabaseApi, "query">,
  baseFilters: Pick<QueryFilters, "squad" | "activeOnly" | "staleThresholdHours">,
): WorkItem[] {
  const allItems: WorkItem[] = [];
  const pageSize = 200;
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (allItems.length < total) {
    const result = db.query({
      ...baseFilters,
      limit: pageSize,
      offset,
    });

    total = result.total;
    if (result.items.length === 0) {
      break;
    }

    allItems.push(...result.items);
    offset += result.items.length;
  }

  return allItems;
}

function buildCounts(items: WorkItem[]): WorkqExportCounts {
  const byStatus = {} as Record<WorkItemStatus, number>;
  for (const status of STATUS_ORDER) {
    byStatus[status] = 0;
  }

  const bySquadMap = new Map<string, number>();

  for (const item of items) {
    byStatus[item.status] += 1;

    const squadKey = normalizeSquadKey(item.squad);
    bySquadMap.set(squadKey, (bySquadMap.get(squadKey) ?? 0) + 1);
  }

  const bySquad: Record<string, number> = {};
  const sortedSquadKeys = [...bySquadMap.keys()].sort(compareSquadKeys);
  for (const squadKey of sortedSquadKeys) {
    bySquad[squadKey] = bySquadMap.get(squadKey) ?? 0;
  }

  return {
    total: items.length,
    byStatus,
    bySquad,
  };
}

function buildLogByIssue(
  db: Pick<WorkqDatabaseApi, "getLog">,
  items: WorkItem[],
  requestedLimit?: number,
): Record<string, WorkLogEntry[]> {
  const limit = Math.max(1, Math.min(500, Math.floor(requestedLimit ?? 50)));
  const issueRefs = [...new Set(items.map((item) => item.issueRef))].sort((a, b) =>
    a.localeCompare(b),
  );

  const logByIssue: Record<string, WorkLogEntry[]> = {};

  for (const issueRef of issueRefs) {
    const entries = db
      .getLog(issueRef, limit)
      .slice()
      .sort((a, b) => a.id - b.id);
    logByIssue[issueRef] = entries;
  }

  return logByIssue;
}

function compareItemsForExport(a: WorkItem, b: WorkItem): number {
  const squadCompare = compareSquadKeys(normalizeSquadKey(a.squad), normalizeSquadKey(b.squad));
  if (squadCompare !== 0) {
    return squadCompare;
  }

  const statusCompare = compareStatus(a.status, b.status);
  if (statusCompare !== 0) {
    return statusCompare;
  }

  const issueCompare = a.issueRef.localeCompare(b.issueRef);
  if (issueCompare !== 0) {
    return issueCompare;
  }

  return a.agentId.localeCompare(b.agentId);
}

function compareStatus(a: WorkItemStatus, b: WorkItemStatus): number {
  return statusIndex(a) - statusIndex(b);
}

function statusIndex(status: WorkItemStatus): number {
  const index = STATUS_ORDER.indexOf(status);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function normalizeSquadKey(value: string | null): string {
  const squad = value?.trim();
  return squad && squad.length ? squad : UNASSIGNED_SQUAD_KEY;
}

function displaySquadName(squadKey: string): string {
  return squadKey === UNASSIGNED_SQUAD_KEY ? "unassigned" : squadKey;
}

function compareSquadKeys(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a === UNASSIGNED_SQUAD_KEY) {
    return 1;
  }
  if (b === UNASSIGNED_SQUAD_KEY) {
    return -1;
  }
  return a.localeCompare(b);
}

function getSquadOrder(items: WorkItem[]): string[] {
  return [...new Set(items.map((item) => normalizeSquadKey(item.squad)))].sort(compareSquadKeys);
}

function escapeInlineMarkdown(value: string): string {
  return value.replace(/[\\`*_{}[\]()#+!|]/g, "\\$&");
}

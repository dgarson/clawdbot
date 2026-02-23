import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { exportWorkqState } from "./export.js";
import {
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_STATUSES,
  type WorkItem,
  type WorkItemPriority,
  type WorkItemStatus,
  type WorkqDatabaseApi,
} from "./types.js";

type JsonOutput = { json?: boolean };

type ListOptions = JsonOutput & {
  squad?: string;
  status?: string;
  agent?: string;
  priority?: string;
  scope?: string;
  updatedAfter?: string;
  updatedBefore?: string;
  limit?: string;
  offset?: string;
  all?: boolean;
};

type ClaimOptions = JsonOutput & {
  agent?: string;
  squad?: string;
  title?: string;
  priority?: string;
  scope?: string;
  files?: string;
  branch?: string;
  worktree?: string;
  reopen?: boolean;
};

type StatusOptions = JsonOutput & {
  set?: string;
  reason?: string;
  pr?: string;
  agent?: string;
};

type ExportOptions = {
  format?: string;
  all?: boolean;
  log?: boolean;
  output?: string;
};

type LogOptions = JsonOutput & {
  limit?: string;
};

type ReleaseOptions = JsonOutput & {
  agent?: string;
  reason?: string;
};

type DoneOptions = JsonOutput & {
  agent?: string;
  pr?: string;
  summary?: string;
};

type FilesCheckOptions = JsonOutput & {
  path?: string;
  excludeSelf?: boolean;
  agent?: string;
};

type FilesSetOptions = JsonOutput & {
  paths?: string;
  agent?: string;
};

type StaleOptions = JsonOutput & {
  hours?: string;
  squad?: string;
  agent?: string;
  limit?: string;
  offset?: string;
};

export function registerWorkqCli(
  api: OpenClawPluginApi,
  db: WorkqDatabaseApi,
  staleThresholdHours: number,
): void {
  api.registerCli(
    ({ program }) => {
      const workq = program.command("workq").description("Work queue coordination commands");

      workq
        .command("list")
        .description("List work queue items")
        .option("--squad <name>", "Filter by squad")
        .option(
          "--status <status>",
          `Filter by status (single or csv): ${WORK_ITEM_STATUSES.join(", ")}`,
        )
        .option("--agent <id>", "Filter by agent")
        .option(
          "--priority <level>",
          `Filter by priority (single or csv): ${WORK_ITEM_PRIORITIES.join(", ")}`,
        )
        .option("--scope <scope>", "Filter by module scope")
        .option("--updated-after <iso>", "Filter by updated_at >= ISO timestamp")
        .option("--updated-before <iso>", "Filter by updated_at <= ISO timestamp")
        .option("--limit <n>", "Page size (1-200)", "50")
        .option("--offset <n>", "Page offset (>=0)", "0")
        .option("--all", "Include done and dropped items")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors(async (options: ListOptions) => {
            const updatedAfter = parseIsoToSqliteUtc(options.updatedAfter, "--updated-after");
            const updatedBefore = parseIsoToSqliteUtc(options.updatedBefore, "--updated-before");
            assertDateRange(updatedAfter, updatedBefore);

            const statuses = parseEnumCsv<WorkItemStatus>(
              options.status,
              WORK_ITEM_STATUSES,
              "--status",
            );
            const priorities = parseEnumCsv<WorkItemPriority>(
              options.priority,
              WORK_ITEM_PRIORITIES,
              "--priority",
            );

            const result = db.query({
              squad: normalizeOptional(options.squad),
              status: statuses,
              agentId: normalizeOptional(options.agent),
              priority: priorities,
              scope: normalizeOptional(options.scope),
              activeOnly: !Boolean(options.all),
              updatedAfter,
              updatedBefore,
              limit: parseInteger(options.limit, "--limit", { min: 1, max: 200, defaultValue: 50 }),
              offset: parseInteger(options.offset, "--offset", { min: 0, defaultValue: 0 }),
              staleThresholdHours,
            });

            if (options.json) {
              printJson({
                filters: {
                  squad: normalizeOptional(options.squad) ?? null,
                  status: statuses ?? null,
                  agent: normalizeOptional(options.agent) ?? null,
                  priority: priorities ?? null,
                  scope: normalizeOptional(options.scope) ?? null,
                  activeOnly: !Boolean(options.all),
                  updatedAfter: updatedAfter ?? null,
                  updatedBefore: updatedBefore ?? null,
                },
                ...result,
              });
              return;
            }

            printListHuman(result.items, result.total);
          }),
        );

      workq
        .command("claim")
        .description("Claim an issue for work")
        .argument("<issue_ref>", "Issue reference, e.g. owner/repo#123")
        .option("--agent <id>", "Agent id claiming the work")
        .option("--squad <name>", "Squad assignment")
        .option("--title <text>", "Work item title")
        .option("--priority <level>", `Priority: ${WORK_ITEM_PRIORITIES.join("/")}`)
        .option("--scope <items>", "Comma-separated scopes, e.g. auth,gateway")
        .option("--files <paths>", "Comma-separated file paths")
        .option("--branch <name>", "Git branch name")
        .option("--worktree <path>", "Worktree path")
        .option("--reopen", "Allow reclaiming an item in done status")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((issueRef: string, options: ClaimOptions) => {
            const agentId = resolveAgentId(options.agent, { required: true });
            const priority = parseEnumOne<WorkItemPriority>(
              options.priority,
              WORK_ITEM_PRIORITIES,
              "--priority",
            );

            const result = db.claim({
              issueRef: requireText(issueRef, "issue_ref"),
              agentId,
              squad: normalizeOptional(options.squad),
              title: normalizeOptional(options.title),
              priority,
              scope: parseCsvList(options.scope, "--scope"),
              files: parseCsvList(options.files, "--files"),
              branch: normalizeOptional(options.branch),
              worktreePath: normalizeOptional(options.worktree),
              reopen: Boolean(options.reopen),
            });

            if (options.json) {
              printJson(result);
              return;
            }

            if (result.status === "claimed") {
              console.log(
                `Claimed ${result.item.issueRef} as ${result.item.agentId} (${result.item.status}).`,
              );
              return;
            }

            if (result.status === "already_yours") {
              console.log(`Already yours: ${result.item.issueRef} (${result.item.status}).`);
              return;
            }

            if (result.status === "limit_exceeded") {
              console.log(
                [
                  `Limit exceeded: session already holds active item ${result.activeIssueRef}`,
                  `active_count=${result.activeCount} max_allowed=${result.maxAllowed}`,
                  "Release or complete your current item before claiming a new one.",
                ].join("\n"),
              );
              return;
            }

            console.log(
              [
                `Conflict: ${result.issueRef} is owned by ${result.claimedBy}`,
                `status=${result.currentStatus} claimed_at=${result.claimedAt}`,
                "Use `openclaw workq status <issue_ref>` for details.",
              ].join("\n"),
            );
          }),
        );

      workq
        .command("status")
        .description("Show queue summary, issue details, or set status")
        .argument("[issue_ref]", "Issue reference")
        .option("--set <status>", `Target status: ${WORK_ITEM_STATUSES.join("/")}`)
        .option("--reason <text>", "Reason (required for blocked)")
        .option("--pr <url>", "Attach PR URL")
        .option("--agent <id>", "Agent id performing status update")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors(async (issueRef: string | undefined, options: StatusOptions) => {
            const setStatus = parseEnumOne<WorkItemStatus>(
              options.set,
              WORK_ITEM_STATUSES,
              "--set",
            );

            if (
              !setStatus &&
              (normalizeOptional(options.reason) || normalizeOptional(options.pr))
            ) {
              throw new Error("--reason and --pr require --set <status>");
            }

            if (setStatus) {
              const targetIssueRef = requireText(issueRef, "issue_ref");
              const agentId = resolveAgentId(options.agent, { required: true });

              if (setStatus === "blocked" && !normalizeOptional(options.reason)) {
                throw new Error("--reason is required when --set blocked");
              }

              const result = db.status({
                issueRef: targetIssueRef,
                agentId,
                status: setStatus,
                reason: normalizeOptional(options.reason),
                prUrl: normalizeOptional(options.pr),
              });

              if (options.json) {
                printJson(result);
                return;
              }

              console.log(`Updated ${result.issueRef}: ${result.from} -> ${result.to}`);
              return;
            }

            if (issueRef) {
              const item = db.get(issueRef, staleThresholdHours);
              if (!item) {
                throw new Error(`Work item not found: ${issueRef}`);
              }

              if (options.json) {
                printJson(item);
                return;
              }

              printItemDetailHuman(item);
              return;
            }

            const items = await queryAllItems(db, {
              activeOnly: false,
              staleThresholdHours,
            });

            const summary = summarizeItems(items);
            if (options.json) {
              printJson(summary);
              return;
            }

            printSummaryHuman(summary);
          }),
        );

      workq
        .command("export")
        .description("Export work queue state")
        .option("--format <format>", "md|markdown|json", "md")
        .option("--all", "Include done and dropped items")
        .option("--log", "Include activity logs")
        .option("--output <file>", "Write output to file")
        .action(
          withCliErrors(async (options: ExportOptions) => {
            const format = normalizeExportFormat(options.format ?? "md");
            const exportResult = exportWorkqState(db, {
              format,
              includeDone: Boolean(options.all),
              includeLog: Boolean(options.log),
              staleThresholdHours,
            });

            if (options.output) {
              const target = path.resolve(options.output);
              mkdirSync(path.dirname(target), { recursive: true });
              writeFileSync(target, exportResult.content, "utf8");
              console.log(`Export written to ${target}`);
              return;
            }

            console.log(exportResult.content);
          }),
        );

      workq
        .command("log")
        .description("Show activity log for an issue")
        .argument("<issue_ref>", "Issue reference")
        .option("--limit <n>", "Max entries (1-500)", "20")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((issueRef: string, options: LogOptions) => {
            const normalizedIssueRef = requireText(issueRef, "issue_ref");
            const limit = parseInteger(options.limit, "--limit", {
              min: 1,
              max: 500,
              defaultValue: 20,
            });

            const entries = db.getLog(normalizedIssueRef, limit);

            if (options.json) {
              printJson({ issueRef: normalizedIssueRef, entries });
              return;
            }

            if (!entries.length) {
              console.log(`No log entries for ${normalizedIssueRef}.`);
              return;
            }

            console.log(`Log for ${normalizedIssueRef} (${entries.length} entries):`);
            for (const entry of entries) {
              const detail = normalizeOptional(entry.detail) ?? "-";
              console.log(
                `- #${entry.id} ${entry.createdAt} ${entry.agentId} ${entry.action} ${detail}`,
              );
            }
          }),
        );

      workq
        .command("release")
        .description("Release (drop) an active work item")
        .argument("<issue_ref>", "Issue reference")
        .requiredOption("--reason <text>", "Reason for releasing (required)")
        .option("--agent <id>", "Owning agent id")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((issueRef: string, options: ReleaseOptions) => {
            const result = db.release({
              issueRef: requireText(issueRef, "issue_ref"),
              agentId: resolveAgentId(options.agent, { required: true }),
              reason: normalizeOptional(options.reason),
            });

            if (options.json) {
              printJson(result);
              return;
            }

            console.log(`Released ${result.issueRef} (status=dropped). Reason: ${options.reason}`);
          }),
        );

      workq
        .command("done")
        .description("Mark a work item done")
        .argument("<issue_ref>", "Issue reference")
        .requiredOption("--pr <url>", "Pull request URL")
        .option("--summary <text>", "Completion summary")
        .option("--agent <id>", "Owning agent id")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((issueRef: string, options: DoneOptions) => {
            const prUrl = requireUrl(options.pr, "--pr");
            const result = db.done({
              issueRef: requireText(issueRef, "issue_ref"),
              agentId: resolveAgentId(options.agent, { required: true }),
              prUrl,
              summary: normalizeOptional(options.summary),
            });

            if (options.json) {
              printJson(result);
              return;
            }

            console.log(`Marked done: ${result.issueRef} (${result.prUrl})`);
          }),
        );

      const files = workq
        .command("files")
        .description("File overlap checks and file ownership sets");

      files
        .command("check")
        .description("Check for conflicts with a path")
        .requiredOption("--path <path>", "File or directory path")
        .option("--exclude-self", "Exclude your own active work from conflict results")
        .option("--agent <id>", "Agent id (required with --exclude-self if not in env)")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((options: FilesCheckOptions) => {
            const excludeAgentId = options.excludeSelf
              ? resolveAgentId(options.agent, { required: true })
              : undefined;

            const result = db.files({
              mode: "check",
              path: requireText(options.path, "--path"),
              excludeAgentId,
            });

            if (options.json) {
              printJson(result);
              return;
            }

            if (!result.conflicts.length) {
              console.log("No active file conflicts found.");
              return;
            }

            console.log(`Found ${result.conflicts.length} conflicting work item(s):`);
            for (const conflict of result.conflicts) {
              console.log(
                `- ${conflict.issueRef} owner=${conflict.agentId} status=${conflict.status} files=${conflict.matchingFiles.join(", ")}`,
              );
            }
          }),
        );

      files
        .command("set")
        .description("Replace tracked files for an issue")
        .argument("<issue_ref>", "Issue reference")
        .requiredOption("--paths <csv>", "Comma-separated file paths")
        .option("--agent <id>", "Owning agent id")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors((issueRef: string, options: FilesSetOptions) => {
            const paths = parseCsvList(options.paths, "--paths");
            if (!paths || paths.length === 0) {
              throw new Error("--paths must include at least one path");
            }

            const result = db.files({
              mode: "set",
              issueRef: requireText(issueRef, "issue_ref"),
              paths,
              agentId: resolveAgentId(options.agent, { required: true }),
            });

            if (options.json) {
              printJson(result);
              return;
            }

            console.log(
              `Updated file set (${result.files?.length ?? 0} files, +${result.added?.length ?? 0}/-${result.removed?.length ?? 0}).`,
            );
            if (result.conflicts.length) {
              console.log(`Conflicts: ${result.conflicts.length} active item(s).`);
            }
          }),
        );

      workq
        .command("stale")
        .description("List stale active items")
        .option("--hours <n>", "Stale threshold in hours", String(staleThresholdHours))
        .option("--squad <name>", "Filter by squad")
        .option("--agent <id>", "Filter by agent")
        .option("--limit <n>", "Page size (1-200)", "50")
        .option("--offset <n>", "Page offset (>=0)", "0")
        .option("--json", "Output as JSON")
        .action(
          withCliErrors(async (options: StaleOptions) => {
            const hours = parseInteger(options.hours, "--hours", {
              min: 1,
              defaultValue: staleThresholdHours,
            });
            const limit = parseInteger(options.limit, "--limit", {
              min: 1,
              max: 200,
              defaultValue: 50,
            });
            const offset = parseInteger(options.offset, "--offset", { min: 0, defaultValue: 0 });

            const activeItems = await queryAllItems(db, {
              activeOnly: true,
              squad: normalizeOptional(options.squad),
              agentId: normalizeOptional(options.agent),
              staleThresholdHours: hours,
            });

            const staleItems = activeItems.filter((item) => item.isStale);
            const paged = staleItems.slice(offset, offset + limit);

            if (options.json) {
              printJson({
                thresholdHours: hours,
                total: staleItems.length,
                limit,
                offset,
                items: paged,
              });
              return;
            }

            if (!paged.length) {
              console.log(`No stale items found (threshold=${hours}h).`);
              return;
            }

            console.log(
              `Stale items (threshold=${hours}h): showing ${paged.length} of ${staleItems.length}`,
            );
            for (const item of paged) {
              console.log(
                `- ${item.issueRef} status=${item.status} agent=${item.agentId} updated_at=${item.updatedAt}`,
              );
            }
          }),
        );
    },
    { commands: ["workq"] },
  );
}

function withCliErrors<T extends unknown[]>(handler: (...args: T) => void | Promise<void>) {
  return async (...args: T): Promise<void> => {
    try {
      await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[workq] ${message}`);
      process.exitCode = 1;
    }
  };
}

function printJson(payload: unknown): void {
  console.log(JSON.stringify(payload, null, 2));
}

function requireText(value: string | undefined, label: string): string {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    throw new Error(`${label} is required`);
  }
  return normalized;
}

function normalizeOptional(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length ? trimmed : undefined;
}

function parseCsvList(value: string | undefined, flagName: string): string[] | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  const values = normalized
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (!values.length) {
    throw new Error(`${flagName} must contain at least one value`);
  }

  return [...new Set(values)];
}

function parseEnumOne<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  flagName: string,
): T | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  if (!allowed.includes(normalized as T)) {
    throw new Error(`${flagName} must be one of: ${allowed.join(", ")}`);
  }

  return normalized as T;
}

function parseEnumCsv<T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  flagName: string,
): T | T[] | undefined {
  const parts = parseCsvList(value, flagName);
  if (!parts) {
    return undefined;
  }

  const invalid = parts.filter((part) => !allowed.includes(part as T));
  if (invalid.length) {
    throw new Error(
      `${flagName} has invalid value(s): ${invalid.join(", ")}. Allowed: ${allowed.join(", ")}`,
    );
  }

  return parts.length === 1 ? (parts[0] as T) : (parts as T[]);
}

function parseInteger(
  value: string | undefined,
  flagName: string,
  options: { min?: number; max?: number; defaultValue: number },
): number {
  const normalized = normalizeOptional(value);
  const numeric = normalized ? Number(normalized) : options.defaultValue;

  if (!Number.isInteger(numeric)) {
    throw new Error(`${flagName} must be an integer`);
  }

  if (typeof options.min === "number" && numeric < options.min) {
    throw new Error(`${flagName} must be >= ${options.min}`);
  }

  if (typeof options.max === "number" && numeric > options.max) {
    throw new Error(`${flagName} must be <= ${options.max}`);
  }

  return numeric;
}

function parseIsoToSqliteUtc(value: string | undefined, flagName: string): string | undefined {
  const normalized = normalizeOptional(value);
  if (!normalized) {
    return undefined;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${flagName} must be a valid ISO timestamp`);
  }

  return toSqliteUtc(parsed);
}

function assertDateRange(after: string | undefined, before: string | undefined): void {
  if (!after || !before) {
    return;
  }

  if (after > before) {
    throw new Error("--updated-after must be before or equal to --updated-before");
  }
}

function toSqliteUtc(date: Date): string {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");
  const ss = String(date.getUTCSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

function resolveAgentId(optionValue: string | undefined, options: { required: true }): string;
function resolveAgentId(
  optionValue: string | undefined,
  options: { required: false },
): string | undefined;
function resolveAgentId(
  optionValue: string | undefined,
  options: { required: boolean },
): string | undefined {
  const explicit = normalizeOptional(optionValue);
  if (explicit) {
    return explicit;
  }

  const inferred =
    normalizeOptional(process.env.OPENCLAW_AGENT_ID) ??
    normalizeOptional(process.env.OPENCLAW_SESSION_AGENT_ID) ??
    normalizeOptional(process.env.OPENCLAW_ACTOR_ID) ??
    normalizeOptional(process.env.USER) ??
    normalizeOptional(process.env.USERNAME);

  if (!inferred && options.required) {
    throw new Error(
      "Agent id is required. Pass --agent <id> or set OPENCLAW_AGENT_ID in your environment.",
    );
  }

  return inferred;
}

function requireUrl(urlValue: string | undefined, flagName: string): string {
  const value = requireText(urlValue, flagName);
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("invalid protocol");
    }
  } catch {
    throw new Error(`${flagName} must be a valid http(s) URL`);
  }

  return value;
}

async function queryAllItems(
  db: WorkqDatabaseApi,
  filters: {
    activeOnly: boolean;
    staleThresholdHours: number;
    squad?: string;
    agentId?: string;
  },
): Promise<WorkItem[]> {
  const pageSize = 200;
  let offset = 0;
  const items: WorkItem[] = [];

  for (;;) {
    const page = db.query({
      ...filters,
      limit: pageSize,
      offset,
    });

    items.push(...page.items);
    offset += page.items.length;

    if (items.length >= page.total || page.items.length === 0) {
      break;
    }
  }

  return items;
}

function summarizeItems(items: WorkItem[]): {
  total: number;
  active: number;
  byStatus: Record<string, number>;
  bySquad: Record<string, number>;
} {
  const byStatus: Record<string, number> = Object.fromEntries(
    WORK_ITEM_STATUSES.map((status) => [status, 0]),
  );
  const bySquad: Record<string, number> = {};
  let active = 0;

  for (const item of items) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    const squad = item.squad ?? "unspecified";
    bySquad[squad] = (bySquad[squad] ?? 0) + 1;
    if (item.status !== "done" && item.status !== "dropped") {
      active += 1;
    }
  }

  return {
    total: items.length,
    active,
    byStatus,
    bySquad,
  };
}

function printSummaryHuman(summary: {
  total: number;
  active: number;
  byStatus: Record<string, number>;
  bySquad: Record<string, number>;
}): void {
  console.log(`Total items: ${summary.total}`);
  console.log(`Active items: ${summary.active}`);
  console.log("By status:");
  for (const status of WORK_ITEM_STATUSES) {
    console.log(`- ${status}: ${summary.byStatus[status] ?? 0}`);
  }
  console.log("By squad:");
  const squads = Object.keys(summary.bySquad).sort();
  if (!squads.length) {
    console.log("- (none)");
    return;
  }
  for (const squad of squads) {
    console.log(`- ${squad}: ${summary.bySquad[squad]}`);
  }
}

function printListHuman(items: WorkItem[], total: number): void {
  if (!items.length) {
    console.log("No work items found.");
    return;
  }

  console.log(`Showing ${items.length} of ${total} item(s):`);
  for (const item of items) {
    const title = item.title ? ` — ${item.title}` : "";
    const stale = item.isStale ? " [STALE]" : "";
    const droppedSuffix =
      item.status === "dropped" && item.droppedReason
        ? ` | reason=${item.droppedReason}`
        : item.status === "dropped"
          ? " | reason=(none)"
          : "";
    console.log(
      `- ${item.issueRef}${title} | status=${item.status}${stale} | priority=${item.priority} | agent=${item.agentId} | squad=${item.squad ?? "-"} | updated=${item.updatedAt}${droppedSuffix}`,
    );
  }
}

function printItemDetailHuman(item: WorkItem): void {
  console.log(`Issue: ${item.issueRef}`);
  console.log(`Title: ${item.title ?? "-"}`);
  console.log(`Status: ${item.status}${item.isStale ? " (stale)" : ""}`);
  console.log(`Agent: ${item.agentId}`);
  console.log(`Squad: ${item.squad ?? "-"}`);
  console.log(`Priority: ${item.priority}`);
  console.log(`Scope: ${item.scope.length ? item.scope.join(", ") : "-"}`);
  console.log(`Tags: ${item.tags.length ? item.tags.join(", ") : "-"}`);
  console.log(`Branch: ${item.branch ?? "-"}`);
  console.log(`Worktree: ${item.worktreePath ?? "-"}`);
  console.log(`PR: ${item.prUrl ?? "-"}`);
  console.log(`Blocked reason: ${item.blockedReason ?? "-"}`);
  console.log(`Dropped reason: ${item.droppedReason ?? "-"}`);
  console.log(`Files: ${item.files.length ? item.files.join(", ") : "-"}`);
  console.log(`Claimed at: ${item.claimedAt}`);
  console.log(`Updated at: ${item.updatedAt}`);
}

function normalizeExportFormat(formatRaw: string): "markdown" | "json" {
  const normalized = formatRaw.trim().toLowerCase();
  if (normalized === "json") {
    return "json";
  }
  if (normalized === "md" || normalized === "markdown") {
    return "markdown";
  }
  throw new Error("--format must be one of: md, markdown, json");
}

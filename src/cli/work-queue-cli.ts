import type { Command } from "commander";
import { resolveDefaultAgentId } from "../agents/agent-scope.js";
import { loadConfig } from "../config/config.js";
import { defaultRuntime } from "../runtime.js";
import { renderTable } from "../terminal/table.js";
import { theme } from "../terminal/theme.js";
import {
  getDefaultWorkQueueStore,
  formatRef,
  readRefs,
  type WorkItem,
  type WorkItemStatus,
  type WorkItemPriority,
  SqliteWorkQueueBackend,
} from "../work-queue/index.js";
import { DEFAULT_POLL_INTERVAL_MS } from "../work-queue/worker-defaults.js";
import {
  WorkstreamNotesStore,
  SqliteWorkstreamNotesBackend,
  type WorkstreamNoteKind,
  WORKSTREAM_NOTE_KINDS,
} from "../work-queue/workstream-notes.js";

function tableWidth(): number {
  return Math.max(60, (process.stdout.columns ?? 120) - 1);
}

function shortId(id: string): string {
  return id.length > 12 ? id.slice(0, 12) : id;
}

function statusColor(status: WorkItemStatus): string {
  switch (status) {
    case "completed":
      return theme.success(status);
    case "failed":
      return theme.error(status);
    case "in_progress":
      return theme.info(status);
    case "blocked":
      return theme.warn(status);
    case "cancelled":
      return theme.muted(status);
    default:
      return status;
  }
}

function refsSummary(payload?: WorkItem["payload"]): string {
  const refs = readRefs(payload);
  if (refs.length === 0) return "";
  const first = formatRef(refs[0]);
  if (refs.length === 1) return first;
  return `${first} (+${refs.length - 1})`;
}

function refsList(payload?: WorkItem["payload"]): string[] {
  const refs = readRefs(payload);
  return refs.map((ref) => {
    const label = ref.label ? ` (${ref.label})` : "";
    return `${formatRef(ref)}${label}`;
  });
}

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(Math.max(0, ms) / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const totalMinutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (totalMinutes < 60) {
    return `${totalMinutes}m ${seconds}s`;
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function renderTree(items: WorkItem[], workstream: string): void {
  defaultRuntime.log(theme.heading(`Workstream DAG: ${workstream}`));
  defaultRuntime.log("");

  // Build adjacency maps.
  const children = new Map<string, string[]>(); // id -> [dependent ids]
  const parents = new Map<string, string[]>(); // id -> [dependency ids]
  const itemMap = new Map(items.map((i) => [i.id, i]));

  for (const item of items) {
    parents.set(item.id, item.dependsOn ?? []);
    for (const depId of item.dependsOn ?? []) {
      if (!children.has(depId)) children.set(depId, []);
      children.get(depId)!.push(item.id);
    }
  }

  // Find roots (items with no dependencies).
  const roots = items.filter((i) => !i.dependsOn || i.dependsOn.length === 0);

  if (roots.length === 0) {
    defaultRuntime.log(theme.warn("No root items (all have dependencies)"));
    return;
  }

  const visited = new Set<string>();

  const printNode = (itemId: string, prefix: string, isLast: boolean): void => {
    if (visited.has(itemId)) {
      // Avoid infinite loops if cycles somehow exist.
      return;
    }
    visited.add(itemId);

    const item = itemMap.get(itemId);
    if (!item) return;

    const connector = isLast ? "└─" : "├─";
    const statusStr = statusColor(item.status);
    const retryStr = item.retryCount ? ` [retry ${item.retryCount}]` : "";
    defaultRuntime.log(
      `${prefix}${connector} ${statusStr} ${shortId(item.id)} ${item.title}${retryStr}`,
    );

    const childIds = children.get(itemId) ?? [];
    const childPrefix = prefix + (isLast ? "   " : "│  ");

    childIds.forEach((childId, idx) => {
      printNode(childId, childPrefix, idx === childIds.length - 1);
    });
  };

  // Render each root and its descendants.
  roots.forEach((root, idx) => {
    printNode(root.id, "", idx === roots.length - 1);
  });

  defaultRuntime.log("");
  defaultRuntime.log(theme.muted(`Total: ${items.length} item(s)`));
}

function renderDot(items: WorkItem[], workstream: string): void {
  defaultRuntime.log(`digraph "${workstream}" {`);
  defaultRuntime.log("  rankdir=TB;");
  defaultRuntime.log("  node [shape=box, style=rounded];");
  defaultRuntime.log("");

  for (const item of items) {
    const label = `${item.title}\\n(${item.status})`;
    const color =
      item.status === "completed"
        ? "green"
        : item.status === "failed"
          ? "red"
          : item.status === "in_progress"
            ? "blue"
            : "gray";
    defaultRuntime.log(`  "${item.id}" [label="${label}", color=${color}];`);
  }

  defaultRuntime.log("");

  for (const item of items) {
    for (const depId of item.dependsOn ?? []) {
      // Arrow points from dependency to dependent.
      defaultRuntime.log(`  "${depId}" -> "${item.id}";`);
    }
  }

  defaultRuntime.log("}");
}

export function registerWorkQueueCli(program: Command) {
  const workQueue = program.command("work-queue").description("Manage and inspect work queues");

  // --- list (queues) ---
  workQueue
    .command("list")
    .description("List work queues")
    .option("--agent <agentId>", "Filter by agent ID")
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const queues = await store.listQueues({ agentId: opts.agent });
      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ queues }, null, 2));
        return;
      }
      if (queues.length === 0) {
        defaultRuntime.log(theme.muted("No work queues found."));
        return;
      }
      defaultRuntime.log(
        renderTable({
          width: tableWidth(),
          columns: [
            { key: "ID", header: "ID", minWidth: 12 },
            { key: "Agent", header: "Agent", minWidth: 10 },
            { key: "Name", header: "Name", minWidth: 16, flex: true },
            { key: "Concurrency", header: "Concurrency", minWidth: 11 },
            { key: "Priority", header: "Priority", minWidth: 8 },
            { key: "Updated", header: "Updated", minWidth: 18 },
          ],
          rows: queues.map((queue) => ({
            ID: queue.id,
            Agent: queue.agentId,
            Name: queue.name,
            Concurrency: String(queue.concurrencyLimit),
            Priority: queue.defaultPriority,
            Updated: queue.updatedAt,
          })),
        }).trimEnd(),
      );
    });

  // --- stats ---
  workQueue
    .command("stats")
    .description("Show work queue stats")
    .option("--queue <queueId>", "Queue ID")
    .option("--agent <agentId>", "Agent ID")
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const cfg = loadConfig();
      const agentId = opts.agent ?? resolveDefaultAgentId(cfg);
      const queue = opts.queue
        ? await store.getQueue(opts.queue)
        : await store.getQueueByAgentId(agentId);
      if (!queue) {
        throw new Error("Queue not found");
      }
      const stats = await store.getQueueStats(queue.id);
      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ queue, stats }, null, 2));
        return;
      }
      defaultRuntime.log(`${theme.heading("Work queue stats")} ${theme.muted(queue.id)}`);
      defaultRuntime.log(
        renderTable({
          width: tableWidth(),
          columns: [
            { key: "Status", header: "Status", minWidth: 10 },
            { key: "Count", header: "Count", minWidth: 6 },
          ],
          rows: [
            { Status: "pending", Count: String(stats.pending) },
            { Status: "in_progress", Count: String(stats.inProgress) },
            { Status: "blocked", Count: String(stats.blocked) },
            { Status: "completed", Count: String(stats.completed) },
            { Status: "failed", Count: String(stats.failed) },
            { Status: "cancelled", Count: String(stats.cancelled) },
            { Status: "total", Count: String(stats.total) },
          ],
        }).trimEnd(),
      );
    });

  // --- items ---
  workQueue
    .command("items")
    .description("List work items with filters")
    .option("--queue <queueId>", "Filter by queue ID")
    .option("--agent <agentId>", "Filter by agent ID (resolves to queue)")
    .option(
      "--status <status>",
      "Filter by status (pending, in_progress, blocked, completed, failed, cancelled)",
    )
    .option("--workstream <ws>", "Filter by workstream")
    .option("--priority <priority>", "Filter by priority (critical, high, medium, low)")
    .option("--limit <n>", "Max items to show", "50")
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const queueId = opts.queue ?? opts.agent ?? undefined;

      const items = await store.listItems({
        queueId,
        status: opts.status as WorkItemStatus | undefined,
        workstream: opts.workstream,
        priority: opts.priority as WorkItemPriority | undefined,
        limit: Number.parseInt(opts.limit, 10),
        orderBy: "priority",
        orderDir: "asc",
      });

      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ items }, null, 2));
        return;
      }
      if (items.length === 0) {
        defaultRuntime.log(theme.muted("No work items found."));
        return;
      }
      defaultRuntime.log(
        renderTable({
          width: tableWidth(),
          columns: [
            { key: "ID", header: "ID", minWidth: 12 },
            { key: "Title", header: "Title", minWidth: 20, flex: true },
            { key: "Status", header: "Status", minWidth: 11 },
            { key: "Priority", header: "Pri", minWidth: 8 },
            { key: "Workstream", header: "Workstream", minWidth: 10 },
            { key: "Deps", header: "Deps", minWidth: 4 },
            { key: "Refs", header: "Refs", minWidth: 18 },
            { key: "Updated", header: "Updated", minWidth: 18 },
          ],
          rows: items.map((item) => ({
            ID: shortId(item.id),
            Title: item.title,
            Status: statusColor(item.status),
            Priority: item.priority,
            Workstream: item.workstream ?? "",
            Deps: item.dependsOn?.length ? String(item.dependsOn.length) : "",
            Refs: refsSummary(item.payload),
            Updated: item.updatedAt,
          })),
        }).trimEnd(),
      );
    });

  // --- show <itemId> ---
  workQueue
    .command("show <itemId>")
    .description("Show full details of a work item")
    .option("--json", "Print JSON", false)
    .action(async (itemId: string, opts) => {
      const store = await getDefaultWorkQueueStore();
      const item = await store.getItem(itemId);
      if (!item) {
        defaultRuntime.log(theme.error(`Work item not found: ${itemId}`));
        return;
      }
      const executions = await store.listExecutions(item.id, { limit: 10 });
      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ item, executions }, null, 2));
        return;
      }
      defaultRuntime.log(`${theme.heading("Work Item")} ${theme.muted(item.id)}`);
      defaultRuntime.log(`  Title:       ${item.title}`);
      defaultRuntime.log(`  Status:      ${statusColor(item.status)}`);
      defaultRuntime.log(`  Priority:    ${item.priority}`);
      defaultRuntime.log(`  Queue:       ${item.queueId}`);
      if (item.workstream) defaultRuntime.log(`  Workstream:  ${item.workstream}`);
      if (item.description) defaultRuntime.log(`  Description: ${item.description}`);
      if (item.statusReason) defaultRuntime.log(`  Reason:      ${item.statusReason}`);
      if (item.assignedTo) {
        defaultRuntime.log(
          `  Assigned To: ${item.assignedTo.agentId ?? ""} ${item.assignedTo.sessionKey ? `(${item.assignedTo.sessionKey})` : ""}`,
        );
      }
      if (item.dependsOn?.length) {
        defaultRuntime.log(`  Depends On:  ${item.dependsOn.join(", ")}`);
      }
      if (item.blockedBy?.length) {
        defaultRuntime.log(`  Blocked By:  ${item.blockedBy.join(", ")}`);
      }
      if (item.tags?.length) defaultRuntime.log(`  Tags:        ${item.tags.join(", ")}`);
      const refs = refsList(item.payload);
      if (refs.length > 0) {
        defaultRuntime.log("  Refs:");
        for (const ref of refs) {
          defaultRuntime.log(`    ${ref}`);
        }
      }
      defaultRuntime.log(`  Created:     ${item.createdAt}`);
      defaultRuntime.log(`  Updated:     ${item.updatedAt}`);
      if (item.startedAt) defaultRuntime.log(`  Started:     ${item.startedAt}`);
      if (item.completedAt) defaultRuntime.log(`  Completed:   ${item.completedAt}`);
      if (item.result) {
        defaultRuntime.log(`  Result:`);
        if (item.result.summary) defaultRuntime.log(`    Summary: ${item.result.summary}`);
        if (item.result.outputs) {
          defaultRuntime.log(`    Outputs: ${JSON.stringify(item.result.outputs, null, 2)}`);
        }
      }
      if (item.error) {
        defaultRuntime.log(`  Error:`);
        defaultRuntime.log(`    Message: ${item.error.message}`);
        if (item.error.code) defaultRuntime.log(`    Code: ${item.error.code}`);
        if (item.error.recoverable !== undefined) {
          defaultRuntime.log(`    Recoverable: ${item.error.recoverable}`);
        }
      }
      if (item.payload && Object.keys(item.payload).length > 0) {
        defaultRuntime.log(`  Payload: ${JSON.stringify(item.payload, null, 2)}`);
      }
      if (executions.length > 0) {
        defaultRuntime.log(`  Executions:`);
        for (const exec of executions) {
          defaultRuntime.log(
            `    #${exec.attemptNumber} ${exec.outcome} ${exec.sessionKey} (${exec.durationMs}ms)`,
          );
        }
      }
    });

  // --- deps <itemId> ---
  workQueue
    .command("deps <itemId>")
    .description("Show dependency graph for a work item")
    .option("--json", "Print JSON", false)
    .action(async (itemId: string, opts) => {
      const store = await getDefaultWorkQueueStore();
      const item = await store.getItem(itemId);
      if (!item) {
        defaultRuntime.log(theme.error(`Work item not found: ${itemId}`));
        return;
      }

      // Resolve upstream dependencies.
      const upstream: Array<{ id: string; title: string; status: WorkItemStatus }> = [];
      if (item.dependsOn?.length) {
        for (const depId of item.dependsOn) {
          const dep = await store.getItem(depId);
          upstream.push({
            id: depId,
            title: dep?.title ?? "(not found)",
            status: dep?.status ?? "pending",
          });
        }
      }

      // Find downstream dependents (items that depend on this item).
      const allItems = await store.listItems({ limit: 500 });
      const downstream = allItems
        .filter((i) => i.dependsOn?.includes(itemId))
        .map((i) => ({ id: i.id, title: i.title, status: i.status }));

      if (opts.json) {
        defaultRuntime.log(
          JSON.stringify(
            { item: { id: item.id, title: item.title, status: item.status }, upstream, downstream },
            null,
            2,
          ),
        );
        return;
      }

      defaultRuntime.log(
        `${theme.heading("Dependency Graph")} ${theme.muted(shortId(item.id))}: ${item.title}`,
      );
      defaultRuntime.log("");

      if (upstream.length > 0) {
        defaultRuntime.log("  Depends On (upstream):");
        for (const dep of upstream) {
          defaultRuntime.log(`    ${statusColor(dep.status)} ${shortId(dep.id)} ${dep.title}`);
        }
      } else {
        defaultRuntime.log(theme.muted("  No upstream dependencies"));
      }

      defaultRuntime.log("");

      if (downstream.length > 0) {
        defaultRuntime.log("  Depended On By (downstream):");
        for (const dep of downstream) {
          defaultRuntime.log(`    ${statusColor(dep.status)} ${shortId(dep.id)} ${dep.title}`);
        }
      } else {
        defaultRuntime.log(theme.muted("  No downstream dependents"));
      }
    });

  // --- graph ---
  workQueue
    .command("graph")
    .description("Visualize dependency graph for a workstream")
    .requiredOption("--workstream <ws>", "Workstream name")
    .option("--json", "Print JSON graph data", false)
    .option("--format <fmt>", "Output format (tree|dot)", "tree")
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const items = await store.listItems({
        workstream: opts.workstream,
        limit: 500,
      });

      if (items.length === 0) {
        defaultRuntime.log(theme.muted(`No items in workstream "${opts.workstream}"`));
        return;
      }

      if (opts.json) {
        // Return structured graph data for programmatic use.
        const graph = {
          workstream: opts.workstream,
          nodes: items.map((i) => ({ id: i.id, title: i.title, status: i.status })),
          edges: items.flatMap((i) =>
            (i.dependsOn ?? []).map((depId) => ({ from: i.id, to: depId })),
          ),
        };
        defaultRuntime.log(JSON.stringify(graph, null, 2));
        return;
      }

      if (opts.format === "dot") {
        // Graphviz DOT format for external rendering.
        renderDot(items, opts.workstream);
        return;
      }

      // Default: ASCII tree.
      renderTree(items, opts.workstream);
    });

  // --- notes ---
  workQueue
    .command("notes")
    .description("List workstream notes")
    .requiredOption("--workstream <ws>", "Workstream name (required)")
    .option("--kind <kind>", `Filter by kind (${WORKSTREAM_NOTE_KINDS.join(", ")})`)
    .option("--limit <n>", "Max notes", "20")
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const notesStore = await resolveNotesStore();
      if (!notesStore) {
        defaultRuntime.log(theme.error("Workstream notes not available (no work queue DB)"));
        return;
      }
      const notes = notesStore.list(opts.workstream, {
        kind: opts.kind as WorkstreamNoteKind | undefined,
        limit: Number.parseInt(opts.limit, 10),
      });

      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ notes }, null, 2));
        return;
      }
      if (notes.length === 0) {
        defaultRuntime.log(theme.muted(`No notes for workstream "${opts.workstream}"`));
        return;
      }
      defaultRuntime.log(`${theme.heading("Workstream Notes")} ${theme.muted(opts.workstream)}`);
      defaultRuntime.log(notesStore.summarize(notes));
    });

  // --- workers ---
  workQueue
    .command("workers")
    .description("Show running worker status")
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const cfg = loadConfig();
      const agents = cfg.agents?.list ?? [];
      const workerAgents = agents.filter((a) => a.worker?.enabled);

      // Query runtime state from the work queue DB.
      let store: Awaited<ReturnType<typeof getDefaultWorkQueueStore>> | null = null;
      const activeItems = new Map<string, { id: string; title: string; startedAt?: string }>();
      try {
        store = await getDefaultWorkQueueStore();
        for (const a of workerAgents) {
          const queueId = a.worker?.queueId ?? a.id;
          const items = await store.listItems({
            queueId,
            status: "in_progress",
            assignedTo: a.id,
            limit: 1,
          });
          if (items.length > 0) {
            const item = items[0]!;
            activeItems.set(a.id, {
              id: item.id,
              title: item.title,
              startedAt: item.startedAt,
            });
          }
        }
      } catch {
        // DB may not exist yet; proceed with config-only data.
      }

      if (opts.json) {
        defaultRuntime.log(
          JSON.stringify(
            {
              workers: workerAgents.map((a) => {
                const active = activeItems.get(a.id) ?? null;
                return {
                  agentId: a.id,
                  queueId: a.worker?.queueId ?? a.id,
                  workstreams: a.worker?.workstreams ?? [],
                  flexible: a.worker?.flexible ?? false,
                  pollIntervalMs: a.worker?.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS,
                  model: a.worker?.model,
                  contextExtractor: a.worker?.contextExtractor ?? "transcript",
                  workflowEnabled: a.worker?.workflow?.enabled ?? false,
                  currentItem: active,
                };
              }),
            },
            null,
            2,
          ),
        );
        if (store) await store.close();
        return;
      }

      if (workerAgents.length === 0) {
        defaultRuntime.log(theme.muted("No worker agents configured."));
        defaultRuntime.log(theme.muted("Enable with: agents.list[].worker.enabled = true"));
        if (store) await store.close();
        return;
      }

      defaultRuntime.log(theme.heading("Configured Workers"));
      defaultRuntime.log(
        renderTable({
          width: tableWidth(),
          columns: [
            { key: "Agent", header: "Agent", minWidth: 12 },
            { key: "Queue", header: "Queue", minWidth: 12 },
            { key: "Mode", header: "Mode", minWidth: 8 },
            { key: "Workstreams", header: "Workstreams", minWidth: 12 },
            { key: "Model", header: "Model", minWidth: 10 },
            { key: "CurrentItem", header: "Current Item", minWidth: 16, flex: true },
            { key: "Elapsed", header: "Elapsed", minWidth: 8 },
          ],
          rows: workerAgents.map((a) => {
            const active = activeItems.get(a.id);
            let elapsed = "-";
            if (active?.startedAt) {
              elapsed = formatElapsed(Date.now() - new Date(active.startedAt).getTime());
            }
            return {
              Agent: a.id,
              Queue: a.worker?.queueId ?? a.id,
              Mode: a.worker?.workflow?.enabled ? "workflow" : "classic",
              Workstreams: a.worker?.workstreams?.join(", ") || "(all)",
              Model: a.worker?.model ?? "(default)",
              CurrentItem: active ? active.title : theme.muted("(idle)"),
              Elapsed: active ? elapsed : "-",
            };
          }),
        }).trimEnd(),
      );
      if (store) await store.close();
    });

  // --- retry <itemId> ---
  workQueue
    .command("retry <itemId>")
    .description("Reset a failed or cancelled work item back to pending")
    .action(async (itemId: string) => {
      const store = await getDefaultWorkQueueStore();
      const item = await store.getItem(itemId);
      if (!item) {
        defaultRuntime.log(theme.error(`Work item not found: ${itemId}`));
        return;
      }
      if (item.status !== "failed" && item.status !== "cancelled") {
        defaultRuntime.log(
          theme.error(
            `Cannot retry item with status "${item.status}" (must be failed or cancelled)`,
          ),
        );
        return;
      }
      await store.updateItem(itemId, {
        status: "pending",
        statusReason: `Retried (was ${item.status})`,
        assignedTo: undefined,
        startedAt: undefined,
        completedAt: undefined,
        error: undefined,
      });
      defaultRuntime.log(theme.success(`Reset item ${shortId(itemId)} to pending`));
    });

  // --- drain <queueId> ---
  workQueue
    .command("drain")
    .description("Cancel all pending items in a queue")
    .requiredOption("--queue <queueId>", "Queue ID")
    .option("--confirm", "Skip confirmation prompt", false)
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const pending = await store.listItems({
        queueId: opts.queue,
        status: "pending",
      });
      if (pending.length === 0) {
        defaultRuntime.log(theme.muted("No pending items to drain."));
        return;
      }
      if (!opts.confirm) {
        defaultRuntime.log(
          theme.warn(
            `This will cancel ${pending.length} pending item(s) in queue "${opts.queue}".`,
          ),
        );
        defaultRuntime.log(theme.muted("Run with --confirm to proceed."));
        return;
      }
      const now = new Date().toISOString();
      let cancelled = 0;
      for (const item of pending) {
        await store.updateItem(item.id, {
          status: "cancelled",
          statusReason: "Drained via CLI",
          completedAt: now,
        });
        cancelled++;
      }
      defaultRuntime.log(theme.success(`Cancelled ${cancelled} pending item(s)`));
    });

  // --- refs-reindex ---
  workQueue
    .command("refs-reindex")
    .description("Rebuild work item refs from payloads")
    .option("--queue <queueId>", "Filter by queue ID")
    .option("--workstream <ws>", "Filter by workstream")
    .option(
      "--item <itemId>",
      "Filter by item ID (repeatable)",
      (val, prev) => {
        prev.push(val);
        return prev;
      },
      [] as string[],
    )
    .option("--limit <n>", "Max items to process", "0")
    .option("--mode <mode>", "Mode: sync (replace) or append", "sync")
    .option("--dry-run", "Report changes without writing", false)
    .option("--json", "Print JSON", false)
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const backend = store.backend;
      if (!(backend instanceof SqliteWorkQueueBackend)) {
        defaultRuntime.log(theme.error("Ref reindexing is only supported by the SQLite backend."));
        return;
      }

      const limitRaw = Number.parseInt(opts.limit, 10);
      const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
      const mode = opts.mode === "append" ? "append" : "sync";

      const stats = await backend.rebuildRefs({
        queueId: opts.queue,
        workstream: opts.workstream,
        itemIds: opts.item.length > 0 ? opts.item : undefined,
        limit,
        mode,
        dryRun: Boolean(opts.dryRun),
      });

      if (opts.json) {
        defaultRuntime.log(JSON.stringify({ mode, dryRun: Boolean(opts.dryRun), stats }, null, 2));
        return;
      }

      defaultRuntime.log(theme.heading("Work item refs reindex"));
      defaultRuntime.log(`  Mode:     ${mode}`);
      defaultRuntime.log(`  Dry run:  ${opts.dryRun ? "yes" : "no"}`);
      defaultRuntime.log(`  Scanned:  ${stats.scanned}`);
      defaultRuntime.log(`  Updated:  ${stats.updated}`);
      defaultRuntime.log(`  Inserted: ${stats.inserted}`);
      defaultRuntime.log(`  Deleted:  ${stats.deleted}`);
      if (stats.skippedInvalidJson > 0) {
        defaultRuntime.log(`  Skipped invalid JSON: ${stats.skippedInvalidJson}`);
      }
      if (stats.skippedEmpty > 0) {
        defaultRuntime.log(`  Skipped empty payloads: ${stats.skippedEmpty}`);
      }
      if (opts.dryRun) {
        defaultRuntime.log(theme.muted("Dry run complete. Re-run without --dry-run to apply."));
      }
    });

  // --- tail ---
  workQueue
    .command("tail")
    .description("Follow worker activity (poll for status changes)")
    .option("--workstream <ws>", "Filter by workstream")
    .option("--queue <queueId>", "Filter by queue")
    .option("--interval <ms>", "Poll interval in ms", "2000")
    .action(async (opts) => {
      const store = await getDefaultWorkQueueStore();
      const pollMs = Number.parseInt(opts.interval, 10);
      let lastSeen = new Map<string, string>(); // id -> status

      defaultRuntime.log(
        theme.heading("Tailing work queue activity...") + " " + theme.muted("(Ctrl+C to stop)"),
      );
      defaultRuntime.log("");

      const poll = async () => {
        const items = await store.listItems({
          queueId: opts.queue,
          workstream: opts.workstream,
          limit: 100,
          orderBy: "updatedAt",
          orderDir: "desc",
        });

        for (const item of items) {
          const prevStatus = lastSeen.get(item.id);
          if (prevStatus === undefined) {
            // First time seeing this item — only show if it's active.
            if (item.status === "in_progress") {
              logEvent("active", item);
            }
          } else if (prevStatus !== item.status) {
            logEvent(item.status, item);
          }
          lastSeen.set(item.id, item.status);
        }
      };

      const logEvent = (_event: string, item: WorkItem) => {
        const ts = new Date().toISOString().slice(11, 19);
        const ws = item.workstream ? ` [${item.workstream}]` : "";
        defaultRuntime.log(
          `${theme.muted(ts)} ${statusColor(item.status)} ${shortId(item.id)} ${item.title}${ws}`,
        );
      };

      // Initial scan.
      const allItems = await store.listItems({
        queueId: opts.queue,
        workstream: opts.workstream,
        limit: 200,
      });
      for (const item of allItems) {
        lastSeen.set(item.id, item.status);
      }
      defaultRuntime.log(theme.muted(`Tracking ${lastSeen.size} item(s)...`));
      defaultRuntime.log("");

      // Poll loop.
      const interval = setInterval(() => {
        poll().catch((err: unknown) => {
          defaultRuntime.log(theme.error(`Poll error: ${String(err)}`));
        });
      }, pollMs);

      // Handle SIGINT.
      process.on("SIGINT", () => {
        clearInterval(interval);
        defaultRuntime.log(theme.muted("\nStopped tailing."));
        process.exit(0);
      });

      // Keep process alive.
      await new Promise(() => {});
    });
}

async function resolveNotesStore(): Promise<WorkstreamNotesStore | null> {
  try {
    const store = await getDefaultWorkQueueStore();
    const backend = store.backend;
    if (backend && "getDb" in backend) {
      const db = (backend as SqliteWorkQueueBackend).getDb();
      if (db) {
        return new WorkstreamNotesStore(new SqliteWorkstreamNotesBackend(db));
      }
    }
  } catch {
    return null;
  }
  return null;
}

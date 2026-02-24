import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type NodeKind = "source" | "transform" | "sink" | "storage";

interface LineageNode {
  id: string;
  name: string;
  kind: NodeKind;
  system: string;
  description: string;
  owner: string;
  tags: string[];
  recordCount: number;
  lastUpdated: string;
  upstreamIds: string[];
}

interface LineageRun {
  id: string;
  pipelineName: string;
  startedAt: string;
  duration: string;
  status: "success" | "failed" | "running" | "partial";
  rowsProcessed: number;
  nodesVisited: string[];
}

interface DatasetImpact {
  datasetId: string;
  datasetName: string;
  downstreamCount: number;
  upstreamCount: number;
  criticalPath: boolean;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const nodes: LineageNode[] = [
  {
    id: "src-postgres",
    name: "Production Postgres",
    kind: "source",
    system: "PostgreSQL 15",
    description: "Primary operational database containing user, session, and billing records.",
    owner: "platform-core",
    tags: ["pii", "operational", "tier-1"],
    recordCount: 4_280_000,
    lastUpdated: "2026-02-22T06:01:00Z",
    upstreamIds: [],
  },
  {
    id: "src-kafka",
    name: "Event Stream (Kafka)",
    kind: "source",
    system: "Apache Kafka 3.6",
    description: "Real-time event stream: clicks, page views, API calls.",
    owner: "platform-core",
    tags: ["events", "real-time"],
    recordCount: 182_000_000,
    lastUpdated: "2026-02-22T06:10:00Z",
    upstreamIds: [],
  },
  {
    id: "src-s3-raw",
    name: "S3 Raw Ingest",
    kind: "source",
    system: "AWS S3",
    description: "Raw file drops: CSV exports, webhook payloads, third-party feeds.",
    owner: "data-eng",
    tags: ["raw", "batch"],
    recordCount: 22_000_000,
    lastUpdated: "2026-02-21T23:00:00Z",
    upstreamIds: [],
  },
  {
    id: "tf-clean",
    name: "Data Cleaning",
    kind: "transform",
    system: "Apache Spark 3.5",
    description: "Deduplication, null handling, type coercion, PII masking.",
    owner: "data-eng",
    tags: ["etl", "pii-mask"],
    recordCount: 4_155_000,
    lastUpdated: "2026-02-22T06:05:00Z",
    upstreamIds: ["src-postgres", "src-s3-raw"],
  },
  {
    id: "tf-enrich",
    name: "Event Enrichment",
    kind: "transform",
    system: "Apache Spark 3.5",
    description: "Joins event stream with user dimension, adds geo/device attributes.",
    owner: "data-eng",
    tags: ["enrichment", "join"],
    recordCount: 178_000_000,
    lastUpdated: "2026-02-22T06:12:00Z",
    upstreamIds: ["src-kafka", "tf-clean"],
  },
  {
    id: "tf-aggregate",
    name: "Metric Aggregation",
    kind: "transform",
    system: "dbt",
    description: "Rolls up enriched events into hourly and daily metric tables.",
    owner: "analytics",
    tags: ["metrics", "aggregation"],
    recordCount: 8_400_000,
    lastUpdated: "2026-02-22T06:20:00Z",
    upstreamIds: ["tf-enrich"],
  },
  {
    id: "tf-ml-features",
    name: "ML Feature Store",
    kind: "transform",
    system: "Feast + Spark",
    description: "Computes user-level features: engagement score, churn risk, LTV.",
    owner: "ml-team",
    tags: ["ml", "features", "real-time"],
    recordCount: 1_200_000,
    lastUpdated: "2026-02-22T06:15:00Z",
    upstreamIds: ["tf-enrich", "tf-aggregate"],
  },
  {
    id: "store-warehouse",
    name: "Data Warehouse (Snowflake)",
    kind: "storage",
    system: "Snowflake",
    description: "Central analytical warehouse. Source of truth for BI and ad-hoc analysis.",
    owner: "data-eng",
    tags: ["warehouse", "analytical"],
    recordCount: 240_000_000,
    lastUpdated: "2026-02-22T06:25:00Z",
    upstreamIds: ["tf-clean", "tf-aggregate"],
  },
  {
    id: "store-feature-db",
    name: "Feature Store DB",
    kind: "storage",
    system: "Redis + Parquet",
    description: "Online and offline feature store for ML serving.",
    owner: "ml-team",
    tags: ["ml", "features"],
    recordCount: 1_200_000,
    lastUpdated: "2026-02-22T06:16:00Z",
    upstreamIds: ["tf-ml-features"],
  },
  {
    id: "sink-bi",
    name: "BI Dashboard Layer",
    kind: "sink",
    system: "Looker",
    description: "Business intelligence dashboards served to stakeholders.",
    owner: "analytics",
    tags: ["bi", "reporting"],
    recordCount: 8_400_000,
    lastUpdated: "2026-02-22T06:30:00Z",
    upstreamIds: ["store-warehouse"],
  },
  {
    id: "sink-ml-serving",
    name: "ML Model Serving",
    kind: "sink",
    system: "KServe",
    description: "Online model serving endpoints powered by feature store.",
    owner: "ml-team",
    tags: ["ml", "serving"],
    recordCount: 0,
    lastUpdated: "2026-02-22T06:00:00Z",
    upstreamIds: ["store-feature-db"],
  },
  {
    id: "sink-reverse-etl",
    name: "Reverse ETL → CRM",
    kind: "sink",
    system: "Census",
    description: "Syncs enriched user segments back to Salesforce and HubSpot.",
    owner: "growth",
    tags: ["crm", "reverse-etl"],
    recordCount: 620_000,
    lastUpdated: "2026-02-22T05:00:00Z",
    upstreamIds: ["store-warehouse"],
  },
];

const runs: LineageRun[] = [
  {
    id: "run-001",
    pipelineName: "daily-etl-full",
    startedAt: "2026-02-22T04:00:00Z",
    duration: "1h 22m",
    status: "success",
    rowsProcessed: 4_155_000,
    nodesVisited: ["src-postgres", "src-s3-raw", "tf-clean", "tf-aggregate", "store-warehouse"],
  },
  {
    id: "run-002",
    pipelineName: "event-enrichment-stream",
    startedAt: "2026-02-22T06:00:00Z",
    duration: "14m",
    status: "running",
    rowsProcessed: 94_000_000,
    nodesVisited: ["src-kafka", "tf-clean", "tf-enrich"],
  },
  {
    id: "run-003",
    pipelineName: "ml-feature-refresh",
    startedAt: "2026-02-22T05:45:00Z",
    duration: "28m",
    status: "success",
    rowsProcessed: 1_200_000,
    nodesVisited: ["tf-enrich", "tf-aggregate", "tf-ml-features", "store-feature-db"],
  },
  {
    id: "run-004",
    pipelineName: "reverse-etl-crm-sync",
    startedAt: "2026-02-22T05:00:00Z",
    duration: "11m",
    status: "partial",
    rowsProcessed: 612_000,
    nodesVisited: ["store-warehouse", "sink-reverse-etl"],
  },
  {
    id: "run-005",
    pipelineName: "bi-snapshot-refresh",
    startedAt: "2026-02-21T22:00:00Z",
    duration: "8m",
    status: "failed",
    rowsProcessed: 0,
    nodesVisited: ["store-warehouse", "sink-bi"],
  },
  {
    id: "run-006",
    pipelineName: "daily-etl-full",
    startedAt: "2026-02-21T04:00:00Z",
    duration: "1h 18m",
    status: "success",
    rowsProcessed: 4_102_000,
    nodesVisited: ["src-postgres", "src-s3-raw", "tf-clean", "tf-aggregate", "store-warehouse"],
  },
];

const impacts: DatasetImpact[] = [
  { datasetId: "src-postgres", datasetName: "Production Postgres", downstreamCount: 7, upstreamCount: 0, criticalPath: true },
  { datasetId: "src-kafka", datasetName: "Event Stream (Kafka)", downstreamCount: 6, upstreamCount: 0, criticalPath: true },
  { datasetId: "tf-enrich", datasetName: "Event Enrichment", downstreamCount: 5, upstreamCount: 2, criticalPath: true },
  { datasetId: "tf-aggregate", datasetName: "Metric Aggregation", downstreamCount: 4, upstreamCount: 1, criticalPath: true },
  { datasetId: "store-warehouse", datasetName: "Data Warehouse", downstreamCount: 3, upstreamCount: 2, criticalPath: true },
  { datasetId: "tf-ml-features", datasetName: "ML Feature Store", downstreamCount: 2, upstreamCount: 2, criticalPath: false },
  { datasetId: "store-feature-db", datasetName: "Feature Store DB", downstreamCount: 1, upstreamCount: 1, criticalPath: false },
  { datasetId: "tf-clean", datasetName: "Data Cleaning", downstreamCount: 3, upstreamCount: 2, criticalPath: true },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function kindColor(kind: NodeKind): string {
  const map: Record<NodeKind, string> = {
    source:    "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    transform: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    sink:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
    storage:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return map[kind];
}

function kindIcon(kind: NodeKind): string {
  const map: Record<NodeKind, string> = {
    source:    "⬆",
    transform: "⚙",
    sink:      "⬇",
    storage:   "🗄",
  };
  return map[kind];
}

function statusColor(status: LineageRun["status"]): string {
  const map: Record<LineageRun["status"], string> = {
    success: "text-emerald-400",
    failed:  "text-rose-400",
    running: "text-indigo-400",
    partial: "text-amber-400",
  };
  return map[status];
}

function statusDot(status: LineageRun["status"]): string {
  const map: Record<LineageRun["status"], string> = {
    success: "bg-emerald-400",
    failed:  "bg-rose-400",
    running: "bg-indigo-400 animate-pulse",
    partial: "bg-amber-400",
  };
  return map[status];
}

function fmt(n: number): string {
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(1) + "M";}
  if (n >= 1_000) {return (n / 1_000).toFixed(0) + "K";}
  return String(n);
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function GraphTab() {
  const [selected, setSelected] = useState<LineageNode | null>(null);
  const [filterKind, setFilterKind] = useState<NodeKind | "all">("all");

  const visible = filterKind === "all" ? nodes : nodes.filter((n) => n.kind === filterKind);

  const groups: Record<NodeKind, LineageNode[]> = {
    source:    nodes.filter((n) => n.kind === "source"),
    transform: nodes.filter((n) => n.kind === "transform"),
    storage:   nodes.filter((n) => n.kind === "storage"),
    sink:      nodes.filter((n) => n.kind === "sink"),
  };

  return (
    <div className="flex gap-6">
      {/* Graph area — left-to-right columns */}
      <div className="flex-1">
        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(["all", "source", "transform", "storage", "sink"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setFilterKind(k)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize",
                filterKind === k
                  ? "bg-indigo-600 text-[var(--color-text-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {k}
            </button>
          ))}
        </div>

        <div className="flex gap-4 overflow-x-auto pb-2">
          {(["source", "transform", "storage", "sink"] as const).map((col) => {
            const colNodes = groups[col].filter((n) => filterKind === "all" || n.kind === filterKind);
            if (colNodes.length === 0) {return null;}
            return (
              <div key={col} className="shrink-0 w-44 space-y-2">
                <div className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center mb-3">
                  {col}
                </div>
                {colNodes.map((node) => {
                  const isSelected = selected?.id === node.id;
                  return (
                    <button
                      key={node.id}
                      onClick={() => setSelected(isSelected ? null : node)}
                      className={cn(
                        "w-full text-left rounded-xl border p-3 transition-all",
                        isSelected
                          ? "border-indigo-500 bg-indigo-500/10"
                          : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)]"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-sm">{kindIcon(node.kind)}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", kindColor(node.kind))}>
                          {node.kind}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)] leading-tight">{node.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-1">{node.system}</div>
                      <div className="text-xs text-[var(--color-text-secondary)] mt-1">{fmt(node.recordCount)} rows</div>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail panel */}
      <div className="w-72 shrink-0">
        {!selected ? (
          <div className="flex items-center justify-center h-40 text-[var(--color-text-muted)] text-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]">
            Click a node to inspect
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5 space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={cn("text-xs px-2 py-0.5 rounded border capitalize", kindColor(selected.kind))}>
                  {selected.kind}
                </span>
              </div>
              <h3 className="text-[var(--color-text-primary)] font-semibold">{selected.name}</h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">{selected.system}</p>
            </div>
            <p className="text-sm text-[var(--color-text-primary)]">{selected.description}</p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Owner</span>
                <span className="text-[var(--color-text-primary)]">{selected.owner}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Records</span>
                <span className="text-[var(--color-text-primary)]">{fmt(selected.recordCount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Last updated</span>
                <span className="text-[var(--color-text-primary)]">{selected.lastUpdated.slice(11, 16)} UTC</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-text-muted)]">Upstream</span>
                <span className="text-[var(--color-text-primary)]">{selected.upstreamIds.length} nodes</span>
              </div>
            </div>
            {selected.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selected.tags.map((t) => (
                  <span key={t} className="text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded px-2 py-0.5">{t}</span>
                ))}
              </div>
            )}
            {selected.upstreamIds.length > 0 && (
              <div>
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Upstream nodes</div>
                <div className="space-y-1">
                  {selected.upstreamIds.map((uid) => {
                    const up = nodes.find((n) => n.id === uid);
                    return up ? (
                      <div key={uid} className="flex items-center gap-2">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", kindColor(up.kind))}>
                          {up.kind}
                        </span>
                        <span className="text-xs text-[var(--color-text-primary)]">{up.name}</span>
                      </div>
                    ) : null;
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RunsTab() {
  const [selected, setSelected] = useState<LineageRun | null>(null);

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <div
          key={run.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            selected?.id === run.id ? "border-indigo-500 bg-indigo-500/5" : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)]"
          )}
          onClick={() => setSelected(selected?.id === run.id ? null : run)}
        >
          <div className="flex items-center gap-3">
            <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(run.status))} />
            <span className="font-medium text-[var(--color-text-primary)] text-sm">{run.pipelineName}</span>
            <span className={cn("text-xs font-semibold ml-auto capitalize", statusColor(run.status))}>{run.status}</span>
          </div>
          <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
            <span>{run.startedAt.slice(0, 16).replace("T", " ")}</span>
            <span>⏱ {run.duration}</span>
            <span>📦 {fmt(run.rowsProcessed)} rows</span>
            <span>🔗 {run.nodesVisited.length} nodes</span>
          </div>

          {selected?.id === run.id && (
            <div className="mt-4 border-t border-[var(--color-border)] pt-4">
              <div className="text-xs text-[var(--color-text-muted)] mb-2">Nodes visited (in order)</div>
              <div className="flex flex-wrap gap-2">
                {run.nodesVisited.map((nid, i) => {
                  const node = nodes.find((n) => n.id === nid);
                  return (
                    <div key={nid} className="flex items-center gap-1">
                      {i > 0 && <span className="text-[var(--color-text-muted)] text-xs">→</span>}
                      <span className={cn("text-xs px-2 py-0.5 rounded border", node ? kindColor(node.kind) : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)]")}>
                        {node?.name ?? nid}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ImpactTab() {
  const sorted = [...impacts].toSorted((a, b) => b.downstreamCount - a.downstreamCount);
  const maxDown = Math.max(...sorted.map((i) => i.downstreamCount));

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--color-text-secondary)] mb-4">
        Downstream impact scores — how many nodes depend on each dataset. Critical path datasets affect the most downstream consumers.
      </p>
      {sorted.map((item) => (
        <div key={item.datasetId} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="font-medium text-[var(--color-text-primary)] text-sm">{item.datasetName}</span>
            {item.criticalPath && (
              <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded px-2 py-0.5">
                Critical Path
              </span>
            )}
            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
              {item.upstreamCount} up · {item.downstreamCount} down
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-muted)] w-24">Downstream</span>
            <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
              <div
                className={cn("h-2 rounded-full", item.criticalPath ? "bg-rose-500" : "bg-indigo-500")}
                style={{ width: (item.downstreamCount / maxDown * 100) + "%" }}
              />
            </div>
            <span className="text-xs font-bold text-[var(--color-text-primary)] w-6 text-right">{item.downstreamCount}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function QualityTab() {
  const stats = [
    { label: "Nodes Tracked", value: nodes.length.toString(), sub: "across 4 types", color: "text-[var(--color-text-primary)]" },
    { label: "Active Pipelines", value: "6", sub: "3 scheduled, 3 streaming", color: "text-[var(--color-text-primary)]" },
    { label: "Last Full Run", value: "1h 22m", sub: "completed 06:25 UTC", color: "text-emerald-400" },
    { label: "Failed Runs (24h)", value: "1", sub: "bi-snapshot-refresh", color: "text-rose-400" },
    { label: "Total Records", value: fmt(nodes.reduce((a, n) => a + n.recordCount, 0)), sub: "across all nodes", color: "text-[var(--color-text-primary)]" },
    { label: "Critical Path Nodes", value: impacts.filter((i) => i.criticalPath).length.toString(), sub: "require priority SLA", color: "text-amber-400" },
  ];

  const ownerGroups: Record<string, number> = {};
  nodes.forEach((n) => {
    ownerGroups[n.owner] = (ownerGroups[n.owner] ?? 0) + 1;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <div className={cn("text-2xl font-bold mb-1", s.color)}>{s.value}</div>
            <div className="text-sm font-medium text-[var(--color-text-primary)]">{s.label}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Ownership Breakdown</h3>
        <div className="space-y-3">
          {Object.entries(ownerGroups).map(([owner, count]) => (
            <div key={owner} className="flex items-center gap-3">
              <span className="w-28 text-xs text-[var(--color-text-secondary)] shrink-0">{owner}</span>
              <div className="flex-1 bg-[var(--color-surface-2)] rounded-full h-2">
                <div className="h-2 rounded-full bg-indigo-500" style={{ width: (count / nodes.length * 100) + "%" }} />
              </div>
              <span className="text-xs text-[var(--color-text-primary)] w-6 text-right">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Pipeline Run History (last 6)</h3>
        <div className="space-y-2">
          {runs.map((run) => (
            <div key={run.id} className="flex items-center gap-3 text-xs">
              <span className={cn("w-2 h-2 rounded-full shrink-0", statusDot(run.status))} />
              <span className="text-[var(--color-text-primary)] w-44 truncate">{run.pipelineName}</span>
              <span className="text-[var(--color-text-muted)]">{run.startedAt.slice(5, 16).replace("T", " ")}</span>
              <span className={cn("ml-auto capitalize", statusColor(run.status))}>{run.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Graph", "Runs", "Impact", "Quality"] as const;
type Tab = typeof TABS[number];

export default function DataLineageViewer() {
  const [tab, setTab] = useState<Tab>("Graph");

  const sources = nodes.filter((n) => n.kind === "source").length;
  const transforms = nodes.filter((n) => n.kind === "transform").length;
  const running = runs.filter((r) => r.status === "running").length;
  const failed24h = runs.filter((r) => r.status === "failed").length;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Data Lineage Viewer</h1>
        <p className="text-[var(--color-text-secondary)] text-sm">
          End-to-end data flow visualization — {nodes.length} nodes, {sources} sources → {transforms} transforms → sinks
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Pipeline Nodes", value: nodes.length, color: "text-[var(--color-text-primary)]" },
          { label: "Active Runs", value: running, color: "text-indigo-400" },
          { label: "Failed (24h)", value: failed24h, color: failed24h > 0 ? "text-rose-400" : "text-emerald-400" },
          { label: "Critical Path", value: impacts.filter((i) => i.criticalPath).length, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
            <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-sm text-[var(--color-text-secondary)] mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Graph" && <GraphTab />}
      {tab === "Runs" && <RunsTab />}
      {tab === "Impact" && <ImpactTab />}
      {tab === "Quality" && <QualityTab />}
    </div>
  );
}

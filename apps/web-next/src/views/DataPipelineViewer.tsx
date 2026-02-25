import React, { useState } from "react";
import { GitBranch } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

type StageStatus = "idle" | "running" | "success" | "failed" | "skipped";
type PipelineStatus = "idle" | "running" | "success" | "failed" | "scheduled";

interface PipelineStage {
  id: string;
  name: string;
  kind: "extract" | "transform" | "load" | "validate" | "notify";
  status: StageStatus;
  durationMs?: number;
  records?: number;
  errorMessage?: string;
}

interface PipelineRun {
  id: string;
  startedAt: string;
  finishedAt?: string;
  status: PipelineStatus;
  recordsIn: number;
  recordsOut: number;
  durationMs?: number;
  triggeredBy: string;
}

interface Pipeline {
  id: string;
  name: string;
  description: string;
  schedule: string;
  status: PipelineStatus;
  lastRunAt: string;
  nextRunAt: string;
  stages: PipelineStage[];
  runs: PipelineRun[];
}

const PIPELINES: Pipeline[] = [
  {
    id: "p-001",
    name: "Agent Session Export",
    description: "Extracts session data, transforms to analytics schema, loads to warehouse",
    schedule: "0 3 * * *",
    status: "success",
    lastRunAt: "2026-02-22 03:00:01",
    nextRunAt: "2026-02-23 03:00:00",
    stages: [
      { id: "s1", name: "Extract Sessions", kind: "extract", status: "success", durationMs: 1240, records: 2840 },
      { id: "s2", name: "Validate Schema", kind: "validate", status: "success", durationMs: 320, records: 2840 },
      { id: "s3", name: "Enrich Metadata", kind: "transform", status: "success", durationMs: 2100, records: 2836 },
      { id: "s4", name: "Aggregate KPIs", kind: "transform", status: "success", durationMs: 880, records: 48 },
      { id: "s5", name: "Load to BigQuery", kind: "load", status: "success", durationMs: 4200, records: 2836 },
      { id: "s6", name: "Notify Stephan", kind: "notify", status: "success", durationMs: 110 },
    ],
    runs: [
      { id: "r1", startedAt: "2026-02-22 03:00:01", finishedAt: "2026-02-22 03:02:19", status: "success", recordsIn: 2840, recordsOut: 2836, durationMs: 138000, triggeredBy: "cron" },
      { id: "r2", startedAt: "2026-02-21 03:00:00", finishedAt: "2026-02-21 03:01:55", status: "success", recordsIn: 3102, recordsOut: 3100, durationMs: 115000, triggeredBy: "cron" },
      { id: "r3", startedAt: "2026-02-20 03:00:00", finishedAt: "2026-02-20 03:03:44", status: "failed", recordsIn: 2995, recordsOut: 0, durationMs: 224000, triggeredBy: "cron" },
      { id: "r4", startedAt: "2026-02-20 10:15:22", finishedAt: "2026-02-20 10:17:30", status: "success", recordsIn: 2995, recordsOut: 2991, durationMs: 128000, triggeredBy: "manual:tim" },
    ],
  },
  {
    id: "p-002",
    name: "Token Cost Reconciliation",
    description: "Pulls raw token usage, maps to billing tiers, reconciles against provider invoices",
    schedule: "0 * * * *",
    status: "running",
    lastRunAt: "2026-02-22 02:00:00",
    nextRunAt: "2026-02-22 03:00:00",
    stages: [
      { id: "s1", name: "Fetch Usage API", kind: "extract", status: "success", durationMs: 820, records: 14200 },
      { id: "s2", name: "Parse Provider Data", kind: "transform", status: "running", records: 8440 },
      { id: "s3", name: "Apply Tier Pricing", kind: "transform", status: "idle" },
      { id: "s4", name: "Load to Ledger", kind: "load", status: "idle" },
      { id: "s5", name: "Billing Alert Check", kind: "validate", status: "idle" },
    ],
    runs: [
      { id: "r1", startedAt: "2026-02-22 02:00:00", status: "running", recordsIn: 14200, recordsOut: 0, triggeredBy: "cron" },
      { id: "r2", startedAt: "2026-02-22 01:00:01", finishedAt: "2026-02-22 01:01:12", status: "success", recordsIn: 12800, recordsOut: 12800, durationMs: 71000, triggeredBy: "cron" },
      { id: "r3", startedAt: "2026-02-22 00:00:01", finishedAt: "2026-02-22 00:01:05", status: "success", recordsIn: 11200, recordsOut: 11200, durationMs: 64000, triggeredBy: "cron" },
    ],
  },
  {
    id: "p-003",
    name: "Knowledge Base Sync",
    description: "Pulls docs from GitHub, embeds via OpenAI, upserts into vector store",
    schedule: "0 */6 * * *",
    status: "failed",
    lastRunAt: "2026-02-22 00:00:05",
    nextRunAt: "2026-02-22 06:00:00",
    stages: [
      { id: "s1", name: "Clone Repo", kind: "extract", status: "success", durationMs: 3200, records: 284 },
      { id: "s2", name: "Diff Changed Files", kind: "transform", status: "success", durationMs: 420, records: 18 },
      { id: "s3", name: "Generate Embeddings", kind: "transform", status: "failed", durationMs: 4800, records: 0, errorMessage: "OpenAI API rate limit: 429 Too Many Requests after 14 retries" },
      { id: "s4", name: "Upsert Vector Store", kind: "load", status: "skipped" },
      { id: "s5", name: "Purge Stale Docs", kind: "transform", status: "skipped" },
    ],
    runs: [
      { id: "r1", startedAt: "2026-02-22 00:00:05", finishedAt: "2026-02-22 00:08:25", status: "failed", recordsIn: 284, recordsOut: 0, durationMs: 500000, triggeredBy: "cron" },
      { id: "r2", startedAt: "2026-02-21 18:00:01", finishedAt: "2026-02-21 18:06:20", status: "success", recordsIn: 276, recordsOut: 276, durationMs: 379000, triggeredBy: "cron" },
    ],
  },
  {
    id: "p-004",
    name: "Slack Digest Generator",
    description: "Aggregates daily agent activity and posts a digest to #cb-standup",
    schedule: "0 9 * * 1-5",
    status: "scheduled",
    lastRunAt: "2026-02-21 09:00:02",
    nextRunAt: "2026-02-22 09:00:00",
    stages: [
      { id: "s1", name: "Fetch Agent Events", kind: "extract", status: "idle" },
      { id: "s2", name: "Summarize with LLM", kind: "transform", status: "idle" },
      { id: "s3", name: "Format Slack Message", kind: "transform", status: "idle" },
      { id: "s4", name: "Post to #cb-standup", kind: "notify", status: "idle" },
    ],
    runs: [
      { id: "r1", startedAt: "2026-02-21 09:00:02", finishedAt: "2026-02-21 09:00:48", status: "success", recordsIn: 142, recordsOut: 1, durationMs: 46000, triggeredBy: "cron" },
      { id: "r2", startedAt: "2026-02-20 09:00:01", finishedAt: "2026-02-20 09:00:52", status: "success", recordsIn: 98, recordsOut: 1, durationMs: 51000, triggeredBy: "cron" },
    ],
  },
  {
    id: "p-005",
    name: "Audit Log Archiver",
    description: "Compresses and archives audit logs older than 30 days to cold storage",
    schedule: "0 0 1 * *",
    status: "idle",
    lastRunAt: "2026-02-01 00:00:01",
    nextRunAt: "2026-03-01 00:00:00",
    stages: [
      { id: "s1", name: "Query Old Logs", kind: "extract", status: "idle" },
      { id: "s2", name: "Compress Gzip", kind: "transform", status: "idle" },
      { id: "s3", name: "Upload to S3", kind: "load", status: "idle" },
      { id: "s4", name: "Prune DB", kind: "transform", status: "idle" },
    ],
    runs: [
      { id: "r1", startedAt: "2026-02-01 00:00:01", finishedAt: "2026-02-01 00:12:30", status: "success", recordsIn: 48000, recordsOut: 48000, durationMs: 750000, triggeredBy: "cron" },
    ],
  },
];

const STAGE_COLORS: Record<PipelineStage["kind"], string> = {
  extract: "bg-sky-500",
  transform: "bg-primary",
  load: "bg-emerald-500",
  validate: "bg-amber-500",
  notify: "bg-primary",
};

const STAGE_STATUS_STYLES: Record<StageStatus, string> = {
  idle: "opacity-30",
  running: "opacity-100 animate-pulse",
  success: "opacity-100",
  failed: "opacity-100",
  skipped: "opacity-20",
};

const PIPELINE_STATUS_BADGE: Record<PipelineStatus, string> = {
  idle: "bg-surface-3 text-fg-primary",
  running: "bg-primary/20 text-primary ring-1 ring-indigo-500/30",
  success: "bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20",
  failed: "bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20",
  scheduled: "bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20",
};

const RUN_STATUS_COLORS: Record<PipelineRun["status"], string> = {
  idle: "text-fg-secondary",
  running: "text-primary",
  success: "text-emerald-400",
  failed: "text-rose-400",
  scheduled: "text-amber-400",
};

function formatDuration(ms: number): string {
  if (ms >= 60000) {return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;}
  return `${(ms / 1000).toFixed(1)}s`;
}

function PipelineDAG({ stages }: { stages: PipelineStage[] }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto py-2">
      {stages.map((stage, i) => (
        <React.Fragment key={stage.id}>
          {/* Stage node */}
          <div className="shrink-0 flex flex-col items-center gap-1.5 min-w-[80px]">
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center text-fg-primary text-lg shadow",
                STAGE_COLORS[stage.kind],
                STAGE_STATUS_STYLES[stage.status],
                stage.status === "failed" && "ring-2 ring-rose-500"
              )}
            >
              {stage.kind === "extract" && "⬇"}
              {stage.kind === "transform" && "⚙"}
              {stage.kind === "load" && "⬆"}
              {stage.kind === "validate" && "✓"}
              {stage.kind === "notify" && "📣"}
            </div>
            <span className="text-xs text-fg-secondary text-center leading-tight max-w-[72px]">{stage.name}</span>
            {stage.durationMs && (
              <span className="text-xs text-fg-muted">{formatDuration(stage.durationMs)}</span>
            )}
            {stage.records !== undefined && (
              <span className="text-xs text-fg-muted">{stage.records.toLocaleString()} rec</span>
            )}
          </div>
          {/* Arrow connector */}
          {i < stages.length - 1 && (
            <div className={cn(
              "h-0.5 w-8 shrink-0",
              stages[i + 1].status === "idle" || stages[i + 1].status === "skipped"
                ? "bg-surface-3"
                : "bg-surface-3"
            )} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function DataPipelineViewer() {
  const [selectedId, setSelectedId] = useState<string>("p-001");
  const [tab, setTab] = useState<"overview" | "runs">("overview");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredPipelines = PIPELINES.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  );

  const selected = PIPELINES.find((p) => p.id === selectedId) ?? PIPELINES[0];
  const failedStage = selected.stages.find((s) => s.status === "failed");

  return (
    <div className="h-full flex flex-col bg-surface-0 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 border-b border-tok-border px-3 sm:px-4 md:px-6 py-3 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
        <div>
          <h1 className="text-lg font-semibold text-fg-primary">Data Pipeline Viewer</h1>
          <p className="text-xs text-fg-muted mt-0.5">{PIPELINES.length} pipelines — ETL, sync, digest</p>
        </div>
        {/* Status filter chips */}
        <div className="flex gap-1.5">
          {(["all", "running", "success", "failed", "scheduled", "idle"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                statusFilter === s
                  ? "bg-primary text-fg-primary"
                  : "bg-surface-2 text-fg-secondary hover:text-fg-primary"
              )}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Pipeline list */}
        <ul className="w-72 shrink-0 border-r border-tok-border overflow-y-auto divide-y divide-tok-border" role="listbox" aria-label="Pipelines">
          {filteredPipelines.length === 0 ? (
            <li className="p-4">
              <ContextualEmptyState icon={GitBranch} title="No pipelines match" description="Try adjusting the status filter." />
            </li>
          ) : filteredPipelines.map((pipeline) => (
            <li key={pipeline.id}>
              <button
                role="option"
                aria-selected={pipeline.id === selectedId}
                onClick={() => setSelectedId(pipeline.id)}
                className={cn(
                  "w-full text-left px-4 py-3 hover:bg-surface-2/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500",
                  pipeline.id === selectedId && "bg-surface-2 border-l-2 border-primary"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-fg-primary leading-tight">{pipeline.name}</span>
                  <span className={cn("shrink-0 text-xs px-1.5 py-0.5 rounded font-medium", PIPELINE_STATUS_BADGE[pipeline.status])}>
                    {pipeline.status}
                  </span>
                </div>
                <div className="mt-1 text-xs text-fg-muted truncate">{pipeline.description}</div>
                <div className="mt-1 flex items-center gap-2 text-xs text-fg-muted">
                  <span className="font-mono">{pipeline.schedule}</span>
                  <span>·</span>
                  <span>{pipeline.stages.length} stages</span>
                </div>
              </button>
            </li>
          ))}
        </ul>

        {/* Pipeline detail */}
        <div className="flex-1 overflow-y-auto">
          {/* Pipeline header */}
          <div className="p-5 border-b border-tok-border">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-fg-primary">{selected.name}</h2>
                <p className="text-sm text-fg-secondary mt-0.5">{selected.description}</p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button className="px-3 py-1.5 bg-primary hover:bg-primary text-fg-primary text-xs font-medium rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400">
                  Run Now
                </button>
                <span className={cn("text-xs px-2 py-1 rounded font-medium", PIPELINE_STATUS_BADGE[selected.status])}>
                  {selected.status}
                </span>
              </div>
            </div>

            {/* Schedule info */}
            <div className="mt-4 flex gap-6 text-xs text-fg-muted">
              <div>
                <span className="text-fg-muted">Schedule</span>
                <span className="ml-2 font-mono text-fg-primary">{selected.schedule}</span>
              </div>
              <div>
                <span className="text-fg-muted">Last run</span>
                <span className="ml-2 text-fg-primary">{selected.lastRunAt}</span>
              </div>
              <div>
                <span className="text-fg-muted">Next run</span>
                <span className="ml-2 text-fg-primary">{selected.nextRunAt}</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-tok-border px-5">
            <div className="flex gap-0" role="tablist">
              {(["overview", "runs"] as const).map((t) => (
                <button
                  key={t}
                  role="tab"
                  aria-selected={tab === t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2.5 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                    tab === t
                      ? "border-primary text-primary"
                      : "border-transparent text-fg-muted hover:text-fg-primary"
                  )}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5 space-y-5">
            {tab === "overview" && (
              <>
                {/* DAG */}
                <div className="bg-surface-1 rounded-lg border border-tok-border p-4">
                  <div className="text-xs font-medium text-fg-secondary mb-3 uppercase tracking-wide">Pipeline DAG</div>
                  <PipelineDAG stages={selected.stages} />
                </div>

                {/* Error if failed */}
                {failedStage && (
                  <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-4">
                    <div className="text-xs font-semibold text-rose-400 mb-1">Stage Failed: {failedStage.name}</div>
                    <p className="text-xs text-rose-300/80">{failedStage.errorMessage}</p>
                  </div>
                )}

                {/* Stage detail table */}
                <div className="bg-surface-1 rounded-lg border border-tok-border overflow-hidden">
                  <div className="px-4 py-3 border-b border-tok-border text-xs font-medium text-fg-secondary uppercase tracking-wide">
                    Stage Details
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-tok-border">
                        <th className="text-left px-4 py-2 text-fg-muted font-medium">Stage</th>
                        <th className="text-left px-4 py-2 text-fg-muted font-medium">Kind</th>
                        <th className="text-right px-4 py-2 text-fg-muted font-medium">Records</th>
                        <th className="text-right px-4 py-2 text-fg-muted font-medium">Duration</th>
                        <th className="text-right px-4 py-2 text-fg-muted font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tok-border">
                      {selected.stages.map((stage) => (
                        <tr key={stage.id} className="hover:bg-surface-2/30">
                          <td className="px-4 py-2 text-fg-primary">{stage.name}</td>
                          <td className="px-4 py-2">
                            <span className={cn("px-1.5 py-0.5 rounded text-fg-primary text-xs", STAGE_COLORS[stage.kind])}>
                              {stage.kind}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-right text-fg-secondary">
                            {stage.records !== undefined ? stage.records.toLocaleString() : "—"}
                          </td>
                          <td className="px-4 py-2 text-right text-fg-secondary">
                            {stage.durationMs !== undefined ? formatDuration(stage.durationMs) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <span className={cn(
                              "font-medium",
                              stage.status === "success" ? "text-emerald-400" :
                              stage.status === "failed" ? "text-rose-400" :
                              stage.status === "running" ? "text-primary" :
                              stage.status === "skipped" ? "text-fg-muted" :
                              "text-fg-muted"
                            )}>
                              {stage.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "runs" && (
              <div className="bg-surface-1 rounded-lg border border-tok-border overflow-hidden">
                <div className="px-4 py-3 border-b border-tok-border text-xs font-medium text-fg-secondary uppercase tracking-wide">
                  Run History
                </div>
                <div className="divide-y divide-tok-border">
                  {selected.runs.map((run) => (
                    <div key={run.id} className="px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-semibold", RUN_STATUS_COLORS[run.status])}>
                            {run.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-fg-muted">by {run.triggeredBy}</span>
                        </div>
                        <div className="text-xs text-fg-secondary mt-0.5">{run.startedAt}</div>
                        {run.finishedAt && (
                          <div className="text-xs text-fg-muted">{run.finishedAt}</div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-fg-primary">
                          {run.recordsIn.toLocaleString()} → {run.recordsOut.toLocaleString()}
                        </div>
                        <div className="text-xs text-fg-muted mt-0.5">
                          {run.durationMs ? formatDuration(run.durationMs) : "running…"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

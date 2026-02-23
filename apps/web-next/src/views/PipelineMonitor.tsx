import React, { useState } from "react";
import { cn } from "../lib/utils";

type PipelineStatus = "running" | "success" | "failed" | "cancelled" | "pending" | "skipped";
type TriggerType = "push" | "pr" | "schedule" | "manual" | "tag";

interface JobStep {
  id: string;
  name: string;
  status: PipelineStatus;
  durationMs: number;
  startedAt: string;
  logs: string[];
}

interface PipelineJob {
  id: string;
  name: string;
  status: PipelineStatus;
  runner: string;
  durationMs: number;
  startedAt: string;
  steps: JobStep[];
  artifacts?: string[];
}

interface PipelineStage {
  id: string;
  name: string;
  jobs: PipelineJob[];
  status: PipelineStatus;
}

interface PipelineRun {
  id: string;
  name: string;
  branch: string;
  commit: string;
  commitMsg: string;
  author: string;
  trigger: TriggerType;
  status: PipelineStatus;
  stages: PipelineStage[];
  startedAt: string;
  duration: number; // ms
  repo: string;
}

const PIPELINE_RUNS: PipelineRun[] = [
  {
    id: "run-2847",
    name: "CI/CD Pipeline",
    branch: "feat/onboarding-flow-redesign",
    commit: "d9ec085",
    commitMsg: "Views #115-117: FunnelAnalytics, SprintBoard, CostForecast",
    author: "Luis",
    trigger: "push",
    status: "success",
    startedAt: "2026-02-22T03:30:00Z",
    duration: 127000,
    repo: "dgarson/clawdbot",
    stages: [
      {
        id: "s1",
        name: "Setup",
        status: "success",
        jobs: [
          {
            id: "j1",
            name: "checkout",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 3200,
            startedAt: "2026-02-22T03:30:02Z",
            steps: [
              { id: "s1", name: "Checkout code", status: "success", durationMs: 2100, startedAt: "2026-02-22T03:30:02Z", logs: ["Cloning into '/home/runner/work/clawdbot'...", "Checked out commit d9ec085"] },
              { id: "s2", name: "Setup Node.js 22", status: "success", durationMs: 1100, startedAt: "2026-02-22T03:30:04Z", logs: ["node --version: v22.22.0", "pnpm --version: 10.4.1"] },
            ],
          },
          {
            id: "j2",
            name: "install",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 18400,
            startedAt: "2026-02-22T03:30:05Z",
            steps: [
              { id: "s1", name: "Restore pnpm cache", status: "success", durationMs: 4200, startedAt: "2026-02-22T03:30:05Z", logs: ["Cache hit: node_modules (key: pnpm-lock-hash-abc123)"] },
              { id: "s2", name: "pnpm install", status: "success", durationMs: 14200, startedAt: "2026-02-22T03:30:09Z", logs: ["Packages: +847 =0 -0", "Progress: resolved 847, reused 841, downloaded 6, added 6, done"] },
            ],
          },
        ],
      },
      {
        id: "s2",
        name: "Quality",
        status: "success",
        jobs: [
          {
            id: "j3",
            name: "type-check",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 22100,
            startedAt: "2026-02-22T03:30:25Z",
            steps: [
              { id: "s1", name: "tsc --noEmit", status: "success", durationMs: 22100, startedAt: "2026-02-22T03:30:25Z", logs: ["tsconfig.json: strict mode enabled", "✓ Type checking passed — 0 errors"] },
            ],
          },
          {
            id: "j4",
            name: "lint",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 8300,
            startedAt: "2026-02-22T03:30:25Z",
            steps: [
              { id: "s1", name: "eslint", status: "success", durationMs: 8300, startedAt: "2026-02-22T03:30:25Z", logs: ["✓ 0 errors, 0 warnings"] },
            ],
          },
          {
            id: "j5",
            name: "test",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 31200,
            startedAt: "2026-02-22T03:30:25Z",
            steps: [
              { id: "s1", name: "vitest run", status: "success", durationMs: 31200, startedAt: "2026-02-22T03:30:25Z", logs: ["✓ 142 tests passed", "✓ 0 tests failed", "Coverage: 84.2%"] },
            ],
          },
        ],
      },
      {
        id: "s3",
        name: "Build",
        status: "success",
        jobs: [
          {
            id: "j6",
            name: "build-web",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 38700,
            startedAt: "2026-02-22T03:31:30Z",
            steps: [
              { id: "s1", name: "pnpm build", status: "success", durationMs: 35200, startedAt: "2026-02-22T03:31:30Z", logs: ["✓ built in 2.15s", "dist/assets/index.js: 274.36kB (gzip: 83.82kB)", "117 lazy chunks emitted"] },
              { id: "s2", name: "Upload artifacts", status: "success", durationMs: 3500, startedAt: "2026-02-22T03:32:05Z", logs: ["Uploaded: dist/ (47.3MB)"] },
            ],
            artifacts: ["dist/", "dist/index.html"],
          },
        ],
      },
      {
        id: "s4",
        name: "Deploy",
        status: "success",
        jobs: [
          {
            id: "j7",
            name: "deploy-preview",
            status: "success",
            runner: "ubuntu-22.04",
            durationMs: 14800,
            startedAt: "2026-02-22T03:32:30Z",
            steps: [
              { id: "s1", name: "Deploy to Cloudflare Pages", status: "success", durationMs: 14800, startedAt: "2026-02-22T03:32:30Z", logs: ["Uploading 253 files...", "✓ Deployment live: https://feat-onboarding--clawdbot.pages.dev"] },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "run-2846",
    name: "CI/CD Pipeline",
    branch: "feat/onboarding-flow-redesign",
    commit: "b7f3026",
    commitMsg: "Views #113-114: ContextBrowser, GitHubIntegration",
    author: "Luis",
    trigger: "push",
    status: "success",
    startedAt: "2026-02-22T03:10:00Z",
    duration: 118000,
    repo: "dgarson/clawdbot",
    stages: [
      { id: "s1", name: "Setup",   status: "success", jobs: [] },
      { id: "s2", name: "Quality", status: "success", jobs: [] },
      { id: "s3", name: "Build",   status: "success", jobs: [] },
      { id: "s4", name: "Deploy",  status: "success", jobs: [] },
    ],
  },
  {
    id: "run-2845",
    name: "CI/CD Pipeline",
    branch: "feat/onboarding-flow-redesign",
    commit: "b031bcb",
    commitMsg: "Views #111-112: ErrorBudgetTracker, MultiModelComparator",
    author: "Luis",
    trigger: "push",
    status: "failed",
    startedAt: "2026-02-22T02:50:00Z",
    duration: 87000,
    repo: "dgarson/clawdbot",
    stages: [
      { id: "s1", name: "Setup",   status: "success", jobs: [] },
      { id: "s2", name: "Quality", status: "failed",  jobs: [] },
      { id: "s3", name: "Build",   status: "skipped", jobs: [] },
      { id: "s4", name: "Deploy",  status: "skipped", jobs: [] },
    ],
  },
  {
    id: "run-2844",
    name: "Nightly Security Scan",
    branch: "dgarson/fork",
    commit: "a3d92b1",
    commitMsg: "Merge feat/access-control into dgarson/fork",
    author: "scheduler",
    trigger: "schedule",
    status: "success",
    startedAt: "2026-02-22T00:00:00Z",
    duration: 420000,
    repo: "dgarson/clawdbot",
    stages: [
      { id: "s1", name: "SAST",        status: "success", jobs: [] },
      { id: "s2", name: "Dependency",  status: "success", jobs: [] },
      { id: "s3", name: "Container",   status: "success", jobs: [] },
      { id: "s4", name: "Report",      status: "success", jobs: [] },
    ],
  },
  {
    id: "run-2843",
    name: "CI/CD Pipeline",
    branch: "piper/chat-room-view",
    commit: "f1a4c92",
    commitMsg: "ChatRoomView: add thread panel and emoji reactions",
    author: "Piper",
    trigger: "pr",
    status: "cancelled",
    startedAt: "2026-02-22T01:20:00Z",
    duration: 45000,
    repo: "dgarson/clawdbot",
    stages: [
      { id: "s1", name: "Setup",   status: "success",   jobs: [] },
      { id: "s2", name: "Quality", status: "cancelled", jobs: [] },
      { id: "s3", name: "Build",   status: "skipped",   jobs: [] },
      { id: "s4", name: "Deploy",  status: "skipped",   jobs: [] },
    ],
  },
];

const STATUS_CONFIG: Record<PipelineStatus, { label: string; color: string; icon: string; bg: string }> = {
  running:   { label: "Running",   color: "text-sky-400",     icon: "🔄", bg: "bg-sky-900/30 border-sky-800" },
  success:   { label: "Success",   color: "text-emerald-400", icon: "✅", bg: "bg-emerald-900/30 border-emerald-800" },
  failed:    { label: "Failed",    color: "text-rose-400",    icon: "❌", bg: "bg-rose-900/30 border-rose-800" },
  cancelled: { label: "Cancelled", color: "text-zinc-400",    icon: "⊘", bg: "bg-zinc-800/50 border-zinc-700" },
  pending:   { label: "Pending",   color: "text-amber-400",   icon: "⏳", bg: "bg-amber-900/30 border-amber-800" },
  skipped:   { label: "Skipped",   color: "text-zinc-500",    icon: "⊙", bg: "bg-zinc-900/50 border-zinc-800" },
};

const TRIGGER_CONFIG: Record<TriggerType, { label: string; icon: string }> = {
  push:     { label: "Push",     icon: "⬆️" },
  pr:       { label: "PR",       icon: "🔀" },
  schedule: { label: "Schedule", icon: "🕐" },
  manual:   { label: "Manual",   icon: "👆" },
  tag:      { label: "Tag",      icon: "🏷️" },
};

function formatDuration(ms: number): string {
  if (ms < 60000) {return `${Math.round(ms / 1000)}s`;}
  const mins = Math.floor(ms / 60000);
  const secs = Math.round((ms % 60000) / 1000);
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
}

export default function PipelineMonitor() {
  const [selectedRun, setSelectedRun] = useState<PipelineRun>(PIPELINE_RUNS[0]);
  const [selectedJob, setSelectedJob] = useState<PipelineJob | null>(null);
  const [selectedStep, setSelectedStep] = useState<JobStep | null>(null);
  const [view, setView] = useState<"runs" | "details">("runs");

  const successCount = PIPELINE_RUNS.filter(r => r.status === "success").length;
  const failedCount = PIPELINE_RUNS.filter(r => r.status === "failed").length;
  const avgDuration = Math.round(PIPELINE_RUNS.filter(r => r.status === "success").reduce((a, r) => a + r.duration, 0) / successCount);

  const openDetail = (run: PipelineRun) => {
    setSelectedRun(run);
    setSelectedJob(null);
    setSelectedStep(null);
    setView("details");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Pipeline Monitor</h1>
            <p className="text-zinc-400 text-sm mt-1">CI/CD pipeline runs for dgarson/clawdbot</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setView("runs")}
              className={cn("px-3 py-1.5 text-sm rounded-lg border transition-colors",
                view === "runs" ? "bg-zinc-800 border-zinc-700 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              📋 All Runs
            </button>
            <button
              onClick={() => setView("details")}
              className={cn("px-3 py-1.5 text-sm rounded-lg border transition-colors",
                view === "details" ? "bg-zinc-800 border-zinc-700 text-white" : "border-zinc-800 text-zinc-400 hover:text-white"
              )}
            >
              🔍 Run Detail
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Runs",    value: PIPELINE_RUNS.length, color: "text-white" },
            { label: "Successful",    value: successCount, color: "text-emerald-400" },
            { label: "Failed",        value: failedCount,  color: "text-rose-400" },
            { label: "Avg Duration",  value: formatDuration(avgDuration), color: "text-sky-400" },
          ].map(s => (
            <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
              <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Runs List */}
      {view === "runs" && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                {["Status", "Run", "Branch", "Commit", "Trigger", "Author", "Duration", "Started"].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PIPELINE_RUNS.map(run => (
                <tr
                  key={run.id}
                  onClick={() => openDetail(run)}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span>{STATUS_CONFIG[run.status].icon}</span>
                      <span className={cn("text-xs font-medium", STATUS_CONFIG[run.status].color)}>
                        {STATUS_CONFIG[run.status].label}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-zinc-400">{run.id}</div>
                    <div className="text-xs text-zinc-300">{run.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-sky-400 truncate max-w-36 block">{run.branch}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-mono text-xs text-amber-400">{run.commit}</div>
                    <div className="text-xs text-zinc-500 max-w-36 truncate">{run.commitMsg}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs">{TRIGGER_CONFIG[run.trigger].icon} {TRIGGER_CONFIG[run.trigger].label}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{run.author}</td>
                  <td className="px-4 py-3 text-xs text-zinc-400">{formatDuration(run.duration)}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500">{new Date(run.startedAt).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Run Detail */}
      {view === "details" && (
        <div className="space-y-4">
          {/* Run header */}
          <div className={cn("border rounded-lg p-4", STATUS_CONFIG[selectedRun.status].bg)}>
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">{STATUS_CONFIG[selectedRun.status].icon}</span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-400">{selectedRun.id}</span>
                      <span className={cn("text-sm font-semibold", STATUS_CONFIG[selectedRun.status].color)}>
                        {STATUS_CONFIG[selectedRun.status].label}
                      </span>
                    </div>
                    <div className="text-white font-medium">{selectedRun.commitMsg}</div>
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-zinc-400">
                  <span>🌿 {selectedRun.branch}</span>
                  <span>📝 {selectedRun.commit}</span>
                  <span>👤 {selectedRun.author}</span>
                  <span>{TRIGGER_CONFIG[selectedRun.trigger].icon} {TRIGGER_CONFIG[selectedRun.trigger].label}</span>
                  <span>⏱️ {formatDuration(selectedRun.duration)}</span>
                  <span>🕐 {new Date(selectedRun.startedAt).toLocaleString()}</span>
                </div>
              </div>
              <div className="flex gap-2">
                {PIPELINE_RUNS.map(r => (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedRun(r); setSelectedJob(null); setSelectedStep(null); }}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-mono transition-colors",
                      selectedRun.id === r.id ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-white"
                    )}
                  >
                    {r.id}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Stage pipeline visualization */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-4">Pipeline Stages</div>
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
              {selectedRun.stages.map((stage, i) => (
                <React.Fragment key={stage.id}>
                  <div className={cn("rounded-lg border p-3 min-w-32 text-center", STATUS_CONFIG[stage.status].bg)}>
                    <div className="text-lg mb-1">{STATUS_CONFIG[stage.status].icon}</div>
                    <div className="text-sm font-medium text-white">{stage.name}</div>
                    <div className={cn("text-xs mt-0.5", STATUS_CONFIG[stage.status].color)}>
                      {STATUS_CONFIG[stage.status].label}
                    </div>
                    {stage.jobs.length > 0 && (
                      <div className="text-xs text-zinc-500 mt-1">{stage.jobs.length} job{stage.jobs.length !== 1 ? "s" : ""}</div>
                    )}
                  </div>
                  {i < selectedRun.stages.length - 1 && (
                    <div className="text-zinc-600 text-lg">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Jobs and logs for detailed run */}
          {selectedRun.stages.some(s => s.jobs.length > 0) && (
            <div className="grid grid-cols-12 gap-4">
              {/* Job list */}
              <div className="col-span-4">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Jobs</div>
                <div className="space-y-2">
                  {selectedRun.stages.flatMap(stage =>
                    stage.jobs.map(job => (
                      <div
                        key={job.id}
                        onClick={() => { setSelectedJob(job); setSelectedStep(null); }}
                        className={cn(
                          "bg-zinc-900 border rounded-lg p-3 cursor-pointer transition-colors",
                          selectedJob?.id === job.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                        )}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span>{STATUS_CONFIG[job.status].icon}</span>
                          <span className="text-sm font-medium text-white">{job.name}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-zinc-500">
                          <span>🖥️ {job.runner}</span>
                          <span>⏱️ {formatDuration(job.durationMs)}</span>
                        </div>
                        {job.artifacts && (
                          <div className="mt-1">
                            {job.artifacts.map(a => (
                              <span key={a} className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 mr-1">📦 {a}</span>
                            ))}
                          </div>
                        )}
                        {/* Steps */}
                        {selectedJob?.id === job.id && (
                          <div className="mt-3 space-y-1">
                            {job.steps.map(step => (
                              <div
                                key={step.id}
                                onClick={e => { e.stopPropagation(); setSelectedStep(selectedStep?.id === step.id ? null : step); }}
                                className="flex items-center gap-2 text-xs text-zinc-400 hover:text-white cursor-pointer pl-2 py-1 rounded hover:bg-zinc-800"
                              >
                                <span>{STATUS_CONFIG[step.status].icon}</span>
                                <span className="flex-1">{step.name}</span>
                                <span className="text-zinc-600">{formatDuration(step.durationMs)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Log viewer */}
              <div className="col-span-8">
                <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                  {selectedStep ? `Logs: ${selectedStep.name}` : selectedJob ? `Select a step to view logs` : "Select a job"}
                </div>
                {selectedStep ? (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs text-emerald-300 space-y-1 min-h-48">
                    <div className="text-zinc-600 mb-2">
                      ▶ {selectedStep.name} — {new Date(selectedStep.startedAt).toLocaleTimeString()} — {formatDuration(selectedStep.durationMs)}
                    </div>
                    {selectedStep.logs.map((line, i) => (
                      <div key={i} className="text-zinc-300">
                        <span className="text-zinc-600 select-none mr-2">{String(i + 1).padStart(3, " ")} │</span>
                        {line}
                      </div>
                    ))}
                    <div className="text-zinc-600 mt-2">
                      ✓ Exit code: 0 — Finished: {formatDuration(selectedStep.durationMs)}
                    </div>
                  </div>
                ) : selectedJob ? (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-500 min-h-48 flex items-center justify-center">
                    Click a step above to view its logs
                  </div>
                ) : (
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg p-4 text-sm text-zinc-500 min-h-48 flex items-center justify-center">
                    Select a job from the list to inspect its steps and logs
                  </div>
                )}

                {/* Job summary when job selected but no step */}
                {selectedJob && !selectedStep && (
                  <div className="mt-3 bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                    <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Job Summary</div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <div className="text-zinc-500">Status</div>
                        <div className={cn("font-medium mt-0.5", STATUS_CONFIG[selectedJob.status].color)}>
                          {STATUS_CONFIG[selectedJob.status].icon} {STATUS_CONFIG[selectedJob.status].label}
                        </div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Runner</div>
                        <div className="font-mono text-zinc-300 mt-0.5">{selectedJob.runner}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Duration</div>
                        <div className="text-zinc-300 mt-0.5">{formatDuration(selectedJob.durationMs)}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Steps</div>
                        <div className="text-zinc-300 mt-0.5">{selectedJob.steps.length} steps</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Started</div>
                        <div className="text-zinc-300 mt-0.5">{new Date(selectedJob.startedAt).toLocaleTimeString()}</div>
                      </div>
                      {selectedJob.artifacts && (
                        <div>
                          <div className="text-zinc-500">Artifacts</div>
                          <div className="text-zinc-300 mt-0.5">{selectedJob.artifacts.length} uploaded</div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

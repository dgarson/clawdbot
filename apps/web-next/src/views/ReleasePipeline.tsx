import React, { useState, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

type StageStatus = "pending" | "running" | "passed" | "failed" | "skipped" | "blocked";
type ReleaseStatus = "draft" | "deploying" | "live" | "rolled-back" | "failed";
type Environment = "development" | "staging" | "production";

interface PipelineStage {
  id: string;
  name: string;
  status: StageStatus;
  duration?: number; // seconds
  startedAt?: string;
  completedAt?: string;
  logs?: string[]; // last 3-5 log lines
}

interface Release {
  id: string;
  version: string;
  name: string;
  status: ReleaseStatus;
  environment: Environment;
  branch: string;
  commit: string;
  author: string;
  createdAt: string;
  deployedAt?: string;
  stages: PipelineStage[];
  notes: string;
}

const RELEASES: Release[] = [
  {
    id: "1",
    version: "2.4.2",
    name: "Regular Release",
    status: "live",
    environment: "production",
    branch: "main",
    commit: "a1b2c3d",
    author: "luis",
    createdAt: "2026-02-20T10:00:00Z",
    deployedAt: "2026-02-20T10:45:00Z",
    notes: "Stable release including new dashboard features.",
    stages: [
      { id: "s1", name: "Build", status: "passed", duration: 120, logs: ["Build started", "Installing dependencies", "Build successful"] },
      { id: "s2", name: "Test", status: "passed", duration: 450, logs: ["Running unit tests", "All tests passed"] },
      { id: "s3", name: "Type Check", status: "passed", duration: 60, logs: ["Checking types", "No issues found"] },
      { id: "s4", name: "Deploy", status: "passed", duration: 180, logs: ["Deploying to prod", "Deployment successful"] },
      { id: "s5", name: "Health Check", status: "passed", duration: 30, logs: ["Checking health", "Healthy"] },
      { id: "s6", name: "Smoke Test", status: "passed", duration: 120, logs: ["Running smoke tests", "Tests passed"] },
    ],
  },
  {
    id: "2",
    version: "2.4.2-rc1",
    name: "Release Candidate 1",
    status: "live",
    environment: "staging",
    branch: "release/2.4.2",
    commit: "e5f6g7h",
    author: "piper",
    createdAt: "2026-02-19T14:00:00Z",
    deployedAt: "2026-02-19T14:30:00Z",
    notes: "Release candidate for v2.4.2.",
    stages: [
      { id: "s1", name: "Build", status: "passed", duration: 115 },
      { id: "s2", name: "Test", status: "passed", duration: 440 },
      { id: "s3", name: "Type Check", status: "passed", duration: 55 },
      { id: "s4", name: "Deploy", status: "passed", duration: 150 },
    ],
  },
  {
    id: "3",
    version: "2.4.1-hotfix",
    name: "Critical Hotfix",
    status: "rolled-back",
    environment: "production",
    branch: "hotfix/login-fix",
    commit: "i9j0k1l",
    author: "quinn",
    createdAt: "2026-02-18T09:00:00Z",
    deployedAt: "2026-02-18T09:40:00Z",
    notes: "Failed smoke test due to environmental config issue.",
    stages: [
      { id: "s1", name: "Build", status: "passed", duration: 100 },
      { id: "s2", name: "Test", status: "passed", duration: 400 },
      { id: "s3", name: "Type Check", status: "passed", duration: 50 },
      { id: "s4", name: "Deploy", status: "passed", duration: 170 },
      { id: "s5", name: "Health Check", status: "passed", duration: 30 },
      { id: "s6", name: "Smoke Test", status: "failed", duration: 45, logs: ["Running smoke tests", "Critical failure in Auth module", "Rolling back"] },
    ],
  },
  {
    id: "4",
    version: "2.4.3-dev",
    name: "Development Update",
    status: "deploying",
    environment: "staging",
    branch: "develop",
    commit: "m2n3o4p",
    author: "sam",
    createdAt: "2026-02-21T23:00:00Z",
    notes: "Integrating new animation library components.",
    stages: [
      { id: "s1", name: "Build", status: "passed", duration: 130 },
      { id: "s2", name: "Test", status: "running", startedAt: "2026-02-22T01:50:00Z", logs: ["Running integration tests...", "Coverage 88%"] },
      { id: "s3", name: "Type Check", status: "pending" },
      { id: "s4", name: "Deploy", status: "pending" },
    ],
  },
  {
    id: "5",
    version: "2.5.0-alpha",
    name: "Alpha Preview",
    status: "draft",
    environment: "development",
    branch: "feature/next-gen",
    commit: "q5r6s7t",
    author: "wes",
    createdAt: "2026-02-22T00:30:00Z",
    notes: "Initial draft for next major version.",
    stages: [
      { id: "s1", name: "Build", status: "pending" },
      { id: "s2", name: "Test", status: "pending" },
    ],
  },
];

const STATUS_ICONS: Record<StageStatus, string> = {
  pending: "⏳",
  running: "🔄",
  passed: "✅",
  failed: "❌",
  skipped: "⏭️",
  blocked: "🚫",
};

const ENV_COLORS: Record<Environment, string> = {
  development: "text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]",
  staging: "text-amber-400 bg-amber-400/10",
  production: "text-emerald-400 bg-emerald-400/10",
};

const RELEASE_STATUS_COLORS: Record<ReleaseStatus, string> = {
  draft: "text-[var(--color-text-muted)] bg-[var(--color-surface-2)]",
  deploying: "text-primary bg-primary/10",
  live: "text-emerald-400 bg-emerald-400/10",
  "rolled-back": "text-rose-400 bg-rose-400/10",
  failed: "text-rose-400 bg-rose-400/10",
};

export default function ReleasePipeline() {
  const [selectedId, setSelectedId] = useState<string>(RELEASES[0].id);
  const [expandedStageId, setExpandedStageId] = useState<string | null>(null);

  const selectedRelease = useMemo(
    () => RELEASES.find((r) => r.id === selectedId) || RELEASES[0],
    [selectedId]
  );

  const toggleStage = useCallback((id: string) => {
    setExpandedStageId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex h-full w-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Left Panel: Release List */}
      <aside 
        className="w-80 border-r border-[var(--color-border)] flex flex-col overflow-y-auto"
        role="complementary"
        aria-label="Releases list"
      >
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold">Releases</h2>
        </div>
        <nav>
          <ul>
            {RELEASES.map((release) => (
              <li key={release.id}>
                <button
                  onClick={() => setSelectedId(release.id)}
                  aria-pressed={selectedId === release.id}
                  className={cn(
                    "w-full text-left p-4 border-b border-[var(--color-border)]/50 transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                    selectedId === release.id ? "bg-[var(--color-surface-1)]" : "hover:bg-[var(--color-surface-1)]/50"
                  )}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono font-bold text-sm">{release.version}</span>
                    <span className={cn("text-[10px] uppercase px-1.5 py-0.5 rounded font-bold tracking-wider", ENV_COLORS[release.environment])}>
                      {release.environment}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2 h-2 rounded-full", 
                      release.status === 'live' ? 'bg-emerald-400' : 
                      release.status === 'deploying' ? 'bg-primary animate-pulse' : 
                      'bg-[var(--color-surface-3)]'
                    )} />
                    <span className="text-xs text-[var(--color-text-secondary)] capitalize">{release.status.replace("-", " ")}</span>
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--color-text-muted)]">
                    <span className="font-mono">{release.commit}</span>
                    <span>{release.author}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Right Panel: Release Detail */}
      <main 
        className="flex-1 overflow-y-auto p-8"
        role="main"
        aria-label={`Release details for ${selectedRelease.version}`}
      >
        {/* Header */}
        <header className="mb-8 border-b border-[var(--color-border)] pb-8">
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-3xl font-bold tracking-tight">{selectedRelease.version}</h1>
                <span className={cn("px-2 py-1 rounded text-xs font-bold uppercase tracking-widest", RELEASE_STATUS_COLORS[selectedRelease.status])}>
                  {selectedRelease.status}
                </span>
                <span className={cn("px-2 py-1 rounded text-xs font-bold uppercase tracking-widest border border-[var(--color-border)]", ENV_COLORS[selectedRelease.environment])}>
                  {selectedRelease.environment}
                </span>
              </div>
              <p className="text-[var(--color-text-secondary)]">{selectedRelease.name}</p>
            </div>
            
            <div className="flex gap-3">
              {selectedRelease.status === "live" && selectedRelease.environment === "production" && (
                <button className="px-4 py-2 bg-rose-600/20 text-rose-400 border border-rose-600/30 rounded text-sm font-bold hover:bg-rose-600/30 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all">
                  Rollback
                </button>
              )}
              {selectedRelease.environment === "staging" && (
                <button className="px-4 py-2 bg-primary text-[var(--color-text-primary)] rounded text-sm font-bold hover:bg-primary focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all">
                  Promote to Prod
                </button>
              )}
              {selectedRelease.status === "failed" && (
                <button className="px-4 py-2 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded text-sm font-bold hover:bg-[var(--color-surface-3)] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none transition-all">
                  Re-deploy
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-4 gap-8 text-sm">
            <div>
              <span className="block text-[var(--color-text-muted)] mb-1">Branch</span>
              <span className="font-mono text-primary">{selectedRelease.branch}</span>
            </div>
            <div>
              <span className="block text-[var(--color-text-muted)] mb-1">Commit</span>
              <span className="font-mono">{selectedRelease.commit}</span>
            </div>
            <div>
              <span className="block text-[var(--color-text-muted)] mb-1">Author</span>
              <span>{selectedRelease.author}</span>
            </div>
            <div>
              <span className="block text-[var(--color-text-muted)] mb-1">Deployed At</span>
              <span className="text-[var(--color-text-primary)]">{selectedRelease.deployedAt ? new Date(selectedRelease.deployedAt).toLocaleString() : "—"}</span>
            </div>
          </div>
        </header>

        {/* Pipeline Visualization */}
        <section className="mb-12" aria-labelledby="pipeline-heading">
          <h2 id="pipeline-heading" className="text-lg font-bold mb-6 flex items-center gap-2">
            Pipeline <span className="text-xs font-normal text-[var(--color-text-muted)]">({selectedRelease.stages.length} stages)</span>
          </h2>
          
          <div className="flex flex-wrap gap-4">
            {selectedRelease.stages.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <div className="flex flex-col items-center group relative min-w-[140px]">
                  <button
                    onClick={() => toggleStage(stage.id)}
                    aria-expanded={expandedStageId === stage.id}
                    aria-controls={`logs-${stage.id}`}
                    aria-label={`Stage: ${stage.name}, status: ${stage.status}`}
                    className={cn(
                      "w-full p-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-left transition-all hover:border-[var(--color-border)] focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                      stage.status === "running" && "border-primary/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]",
                      expandedStageId === stage.id && "bg-[var(--color-surface-2)]/50 border-[var(--color-surface-3)]"
                    )}
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className={cn("text-xl", stage.status === "running" && "animate-spin-slow")}>
                        {STATUS_ICONS[stage.status]}
                      </span>
                      {stage.duration && (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{stage.duration}s</span>
                      )}
                    </div>
                    <h3 className="text-sm font-bold truncate">{stage.name}</h3>
                    <p className={cn(
                      "text-[10px] uppercase font-bold tracking-tighter mt-1",
                      stage.status === "passed" && "text-emerald-400",
                      stage.status === "failed" && "text-rose-400",
                      stage.status === "running" && "text-primary",
                      stage.status === "pending" && "text-[var(--color-text-muted)]"
                    )}>
                      {stage.status}
                    </p>
                  </button>

                  {/* Connecting Line (hidden on last item and when wrapped, but simplified for this view) */}
                  {idx < selectedRelease.stages.length - 1 && (
                    <div className="hidden lg:block absolute -right-3 top-[34px] w-2 h-px bg-[var(--color-surface-2)]" />
                  )}
                </div>
              </React.Fragment>
            ))}
          </div>

          {/* Logs View (Expanded) */}
          {expandedStageId && (
            <div 
              id={`logs-${expandedStageId}`}
              className="mt-6 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg p-6 font-mono text-xs"
              role="region"
              aria-label="Stage logs"
            >
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[var(--color-text-secondary)] font-bold uppercase tracking-widest text-[10px]">
                  Logs: {selectedRelease.stages.find(s => s.id === expandedStageId)?.name}
                </h4>
                <button 
                  onClick={() => setExpandedStageId(null)}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:ring-1 focus-visible:ring-indigo-500"
                >
                  Close
                </button>
              </div>
              <div className="space-y-2">
                {selectedRelease.stages.find(s => s.id === expandedStageId)?.logs?.map((log, i) => (
                  <div key={i} className="flex gap-4">
                    <span className="text-[var(--color-text-muted)]">[{i + 1}]</span>
                    <span className={cn(
                      log.toLowerCase().includes('error') || log.toLowerCase().includes('failure') ? "text-rose-400" : "text-[var(--color-text-primary)]"
                    )}>
                      {log}
                    </span>
                  </div>
                )) || <div className="text-[var(--color-text-muted)] italic">No logs available for this stage.</div>}
              </div>
            </div>
          )}
        </section>

        {/* Release Notes */}
        <section aria-labelledby="notes-heading">
          <h2 id="notes-heading" className="text-lg font-bold mb-4">Release Notes</h2>
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-6">
            <p className="text-[var(--color-text-primary)] leading-relaxed italic">
              "{selectedRelease.notes}"
            </p>
          </div>
        </section>
      </main>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

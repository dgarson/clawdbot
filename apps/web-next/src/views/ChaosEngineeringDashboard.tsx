import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────

type ExperimentStatus = "idle" | "running" | "paused" | "completed" | "failed";
type Severity = "critical" | "high" | "medium" | "low";
type RemediationStatus = "open" | "in-progress" | "fixed";
type TabId = "experiments" | "active" | "findings" | "schedule";

interface SteadyStateCheck {
  check: string;
  passed: boolean;
}

interface Experiment {
  id: string;
  name: string;
  type: string;
  status: ExperimentStatus;
  targetService: string;
  blastRadius: string;
  lastRun: string;
  hypothesis: string;
  steadyState: SteadyStateCheck[];
  rollbackSteps: string[];
}

interface ActiveRun {
  id: string;
  experimentName: string;
  injectionType: string;
  targetServices: string[];
  durationTotal: number;
  durationRemaining: number;
  affectedPercent: number;
  errorRateDelta: number;
  latencyDelta: number;
}

interface Finding {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  affectedService: string;
  discoveryDate: string;
  remediationStatus: RemediationStatus;
  linkedExperiment: string;
}

interface ScheduledRun {
  id: string;
  experimentName: string;
  scheduledAt: string;
  estimatedDuration: string;
  approverRequired: boolean;
  preApproved: boolean;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────

const EXPERIMENTS: Experiment[] = [
  {
    id: "exp-001",
    name: "CPU Spike — Auth Service",
    type: "CPU Stress",
    status: "completed",
    targetService: "auth-service",
    blastRadius: "25%",
    lastRun: "2026-02-20",
    hypothesis:
      "Auth service maintains <200ms p99 latency under 90% CPU saturation sustained for 5 minutes.",
    steadyState: [
      { check: "p99 latency < 200ms", passed: true },
      { check: "Error rate < 0.1%", passed: true },
      { check: "Health endpoint returns 200", passed: true },
    ],
    rollbackSteps: [
      "Remove CPU stress injection via Gremlin API",
      "Monitor CPU utilization for 2 minutes",
      "Verify health endpoint returns 200",
      "Check PagerDuty for active incidents",
    ],
  },
  {
    id: "exp-002",
    name: "Network Latency — Payment Gateway",
    type: "Network Latency",
    status: "running",
    targetService: "payment-gateway",
    blastRadius: "10%",
    lastRun: "2026-02-22",
    hypothesis:
      "Payment service gracefully degrades with +500ms added latency to downstream processor.",
    steadyState: [
      { check: "Transaction success rate > 99%", passed: true },
      { check: "Timeout circuit breaker fires within 30s", passed: false },
      { check: "Queue depth < 500", passed: true },
    ],
    rollbackSteps: [
      "Remove network latency injection",
      "Flush pending transaction queue",
      "Verify circuit breaker reset to closed state",
    ],
  },
  {
    id: "exp-003",
    name: "Pod Kill — Recommendation Engine",
    type: "Pod Kill",
    status: "idle",
    targetService: "recommendation-engine",
    blastRadius: "50%",
    lastRun: "2026-02-18",
    hypothesis:
      "Recommendation service recovers within 30s when 50% of pods are killed via SIGKILL.",
    steadyState: [
      { check: "Recovery time < 30s", passed: true },
      { check: "No data loss in recommendation cache", passed: true },
      { check: "Fallback recommendations served during outage", passed: true },
    ],
    rollbackSteps: [
      "Force pod restart via kubectl rollout restart",
      "Verify replica count restored to desired state",
      "Check HPA scaling behavior and event log",
    ],
  },
  {
    id: "exp-004",
    name: "Disk I/O Saturation — Primary DB",
    type: "Disk I/O",
    status: "failed",
    targetService: "postgres-primary",
    blastRadius: "100%",
    lastRun: "2026-02-15",
    hypothesis:
      "Database maintains read performance under disk I/O saturation by routing reads to replicas.",
    steadyState: [
      { check: "Read query p95 < 100ms", passed: false },
      { check: "Writes succeed via WAL", passed: true },
      { check: "Replica lag < 5s", passed: false },
    ],
    rollbackSteps: [
      "Remove I/O throttle immediately",
      "Failover reads to replica if lag persists",
      "Notify DBA team via PagerDuty",
      "Check WAL archive status and replay position",
    ],
  },
  {
    id: "exp-005",
    name: "Memory Pressure — API Gateway",
    type: "Memory Stress",
    status: "paused",
    targetService: "api-gateway",
    blastRadius: "15%",
    lastRun: "2026-02-21",
    hypothesis:
      "API gateway handles OOM pressure gracefully without dropping in-flight requests.",
    steadyState: [
      { check: "In-flight request success > 99.5%", passed: true },
      { check: "OOM killer not triggered", passed: true },
      { check: "Container memory limit not exceeded", passed: false },
    ],
    rollbackSteps: [
      "Stop memory stress injection",
      "Monitor GC metrics for 5 minutes",
      "Restart pods if OOM killer triggered",
    ],
  },
  {
    id: "exp-006",
    name: "DNS Failure — Service Mesh",
    type: "DNS Failure",
    status: "idle",
    targetService: "service-mesh",
    blastRadius: "20%",
    lastRun: "2026-02-10",
    hypothesis:
      "Services fall back to cached DNS entries and maintain connectivity during a 60s DNS blackout.",
    steadyState: [
      { check: "Service discovery latency < 500ms", passed: true },
      { check: "No service unavailable errors during blackout", passed: true },
      { check: "mTLS certificates remain valid", passed: true },
    ],
    rollbackSteps: [
      "Restore DNS resolution",
      "Flush DNS cache on all nodes",
      "Verify full service mesh connectivity matrix",
    ],
  },
  {
    id: "exp-007",
    name: "Packet Loss — User Service",
    type: "Network Chaos",
    status: "completed",
    targetService: "user-service",
    blastRadius: "30%",
    lastRun: "2026-02-17",
    hypothesis:
      "User service handles 10% packet loss with retry logic without causing retry storms.",
    steadyState: [
      { check: "Login success rate > 98%", passed: true },
      { check: "Session creation latency < 500ms", passed: true },
      { check: "No retry storm observed in downstream services", passed: true },
    ],
    rollbackSteps: [
      "Remove packet loss injection via tc qdisc",
      "Monitor retry counters for backpressure",
      "Check downstream services for queue depth",
    ],
  },
  {
    id: "exp-008",
    name: "Container Freeze — Notifications",
    type: "Process Pause",
    status: "idle",
    targetService: "notification-service",
    blastRadius: "25%",
    lastRun: "2026-02-12",
    hypothesis:
      "Notification delivery queue drains correctly when worker pods are frozen for 2 minutes.",
    steadyState: [
      { check: "Queue depth recovers to < 1000 within 5min", passed: true },
      { check: "No duplicate notifications sent post-resume", passed: true },
      { check: "Dead letter queue remains empty", passed: false },
    ],
    rollbackSteps: [
      "Unfreeze containers via SIGCONT",
      "Drain DLQ manually if > 100 messages",
      "Verify idempotency keys prevent duplicates",
    ],
  },
];

const ACTIVE_RUNS: ActiveRun[] = [
  {
    id: "run-001",
    experimentName: "Network Latency — Payment Gateway",
    injectionType: "Network Latency (+500ms)",
    targetServices: ["payment-gateway", "payment-processor"],
    durationTotal: 600,
    durationRemaining: 342,
    affectedPercent: 10,
    errorRateDelta: 0.3,
    latencyDelta: 487,
  },
  {
    id: "run-002",
    experimentName: "Memory Pressure — API Gateway",
    injectionType: "Memory Stress (80% fill rate)",
    targetServices: ["api-gateway"],
    durationTotal: 300,
    durationRemaining: 89,
    affectedPercent: 15,
    errorRateDelta: -0.1,
    latencyDelta: 23,
  },
];

const FINDINGS: Finding[] = [
  {
    id: "find-001",
    severity: "critical",
    title: "Circuit Breaker Not Configured for Payment Processor",
    description:
      "Under 500ms latency injection, payment service failed to trip circuit breaker within SLO. Requests queued indefinitely, causing cascading timeout failures across 3 downstream services.",
    affectedService: "payment-gateway",
    discoveryDate: "2026-02-22",
    remediationStatus: "in-progress",
    linkedExperiment: "exp-002",
  },
  {
    id: "find-002",
    severity: "critical",
    title: "No Graceful Shutdown on SIGTERM in User Service",
    description:
      "User service does not drain in-flight requests on SIGTERM. During the pod kill experiment, 3% of active sessions were dropped without a proper error response to clients.",
    affectedService: "user-service",
    discoveryDate: "2026-02-17",
    remediationStatus: "in-progress",
    linkedExperiment: "exp-007",
  },
  {
    id: "find-003",
    severity: "high",
    title: "Database Read Replica Lag Exceeds 5s Under I/O Pressure",
    description:
      "Disk I/O saturation caused replica lag to reach 47 seconds, violating the SLO threshold. Read traffic was not automatically rerouted to the primary, resulting in stale reads.",
    affectedService: "postgres-primary",
    discoveryDate: "2026-02-15",
    remediationStatus: "open",
    linkedExperiment: "exp-004",
  },
  {
    id: "find-004",
    severity: "high",
    title: "API Gateway Memory Limit Configured Too Low",
    description:
      "Container memory limit triggered OOM conditions at 78% memory pressure. Limit needs to increase from 512Mi to 1Gi with proper JVM heap tuning (-Xmx768m).",
    affectedService: "api-gateway",
    discoveryDate: "2026-02-21",
    remediationStatus: "in-progress",
    linkedExperiment: "exp-005",
  },
  {
    id: "find-005",
    severity: "medium",
    title: "Recommendation Engine Recovery Time Exceeds SLO in Prod",
    description:
      "While pods recovered within 30s in staging, production HPA scale-up took 48s due to resource quota limits on the namespace. Quota adjustment required.",
    affectedService: "recommendation-engine",
    discoveryDate: "2026-02-18",
    remediationStatus: "fixed",
    linkedExperiment: "exp-003",
  },
  {
    id: "find-006",
    severity: "medium",
    title: "Dead Letter Queue Grows Unbounded During Worker Freeze",
    description:
      "Notification service DLQ accumulated 8,400 messages during a 2-minute container freeze with no automatic reprocessing configured. Manual intervention was required.",
    affectedService: "notification-service",
    discoveryDate: "2026-02-12",
    remediationStatus: "open",
    linkedExperiment: "exp-008",
  },
  {
    id: "find-007",
    severity: "low",
    title: "Auth Service CPU Throttling Pushes p99 to 187ms",
    description:
      "Under 90% CPU saturation, auth service p99 climbed to 187ms — within SLO but dangerously close. Adding a second replica to the autoscaling minimum is recommended.",
    affectedService: "auth-service",
    discoveryDate: "2026-02-20",
    remediationStatus: "fixed",
    linkedExperiment: "exp-001",
  },
];

const SCHEDULED_RUNS: ScheduledRun[] = [
  {
    id: "sched-001",
    experimentName: "CPU Spike — Auth Service",
    scheduledAt: "2026-02-24T02:00:00Z",
    estimatedDuration: "10 min",
    approverRequired: false,
    preApproved: true,
  },
  {
    id: "sched-002",
    experimentName: "Pod Kill — Recommendation Engine",
    scheduledAt: "2026-02-24T14:00:00Z",
    estimatedDuration: "15 min",
    approverRequired: true,
    preApproved: false,
  },
  {
    id: "sched-003",
    experimentName: "DNS Failure — Service Mesh",
    scheduledAt: "2026-02-25T03:00:00Z",
    estimatedDuration: "20 min",
    approverRequired: true,
    preApproved: true,
  },
  {
    id: "sched-004",
    experimentName: "Disk I/O Saturation — Primary DB",
    scheduledAt: "2026-02-25T22:00:00Z",
    estimatedDuration: "30 min",
    approverRequired: true,
    preApproved: false,
  },
  {
    id: "sched-005",
    experimentName: "Packet Loss — User Service",
    scheduledAt: "2026-02-26T08:00:00Z",
    estimatedDuration: "10 min",
    approverRequired: false,
    preApproved: true,
  },
  {
    id: "sched-006",
    experimentName: "Container Freeze — Notifications",
    scheduledAt: "2026-02-27T01:00:00Z",
    estimatedDuration: "5 min",
    approverRequired: false,
    preApproved: true,
  },
  {
    id: "sched-007",
    experimentName: "Memory Pressure — API Gateway",
    scheduledAt: "2026-02-27T14:00:00Z",
    estimatedDuration: "10 min",
    approverRequired: true,
    preApproved: false,
  },
  {
    id: "sched-008",
    experimentName: "Network Latency — Payment Gateway",
    scheduledAt: "2026-02-28T03:00:00Z",
    estimatedDuration: "15 min",
    approverRequired: true,
    preApproved: true,
  },
  {
    id: "sched-009",
    experimentName: "CPU Spike — Auth Service",
    scheduledAt: "2026-03-01T02:00:00Z",
    estimatedDuration: "10 min",
    approverRequired: false,
    preApproved: true,
  },
  {
    id: "sched-010",
    experimentName: "Pod Kill — Recommendation Engine",
    scheduledAt: "2026-03-03T14:00:00Z",
    estimatedDuration: "15 min",
    approverRequired: true,
    preApproved: false,
  },
];

// ─── Helpers ───────────────────────────────────────────────────────────────

function statusColor(status: ExperimentStatus): string {
  switch (status) {
    case "running":   return "text-primary bg-primary/10 border-primary/30";
    case "paused":    return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "completed": return "text-emerald-400 bg-emerald-500/10 border-emerald-500/30";
    case "failed":    return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    default:          return "text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-[var(--color-border)]";
  }
}

function severityBadge(severity: Severity): string {
  switch (severity) {
    case "critical": return "text-rose-400 bg-rose-500/10 border-rose-500/30";
    case "high":     return "text-amber-400 bg-amber-500/10 border-amber-500/30";
    case "medium":   return "text-yellow-400 bg-yellow-500/10 border-yellow-500/30";
    default:         return "text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-[var(--color-border)]";
  }
}

function severityText(severity: Severity): string {
  switch (severity) {
    case "critical": return "text-rose-400";
    case "high":     return "text-amber-400";
    case "medium":   return "text-yellow-400";
    default:         return "text-[var(--color-text-secondary)]";
  }
}

function remediationColor(status: RemediationStatus): string {
  switch (status) {
    case "fixed":       return "text-emerald-400";
    case "in-progress": return "text-amber-400";
    default:            return "text-rose-400";
  }
}

function remediationLabel(status: RemediationStatus): string {
  switch (status) {
    case "fixed":       return "Fixed";
    case "in-progress": return "In Progress";
    default:            return "Open";
  }
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s < 10 ? "0" : ""}${s}s`;
}

// ─── Root Component ────────────────────────────────────────────────────────

export default function ChaosEngineeringDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("experiments");
  const [selectedExp, setSelectedExp] = useState<Experiment | null>(null);

  const tabs: { id: TabId; label: string; count: number }[] = [
    { id: "experiments", label: "Experiments", count: EXPERIMENTS.length },
    { id: "active",      label: "Active Runs",  count: ACTIVE_RUNS.length },
    { id: "findings",    label: "Findings",     count: FINDINGS.length },
    { id: "schedule",    label: "Schedule",     count: SCHEDULED_RUNS.length },
  ];

  function handleTabChange(id: TabId) {
    setActiveTab(id);
    setSelectedExp(null);
  }

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* ── Header ── */}
      <div className="border-b border-[var(--color-border)] px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Chaos Engineering</h1>
            <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
              Controlled failure injection to build system resilience
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-sm text-emerald-400">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              {ACTIVE_RUNS.length} active
            </span>
            <button className="bg-primary hover:bg-primary transition-colors px-4 py-2 rounded-lg text-sm font-medium">
              + New Experiment
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2",
                activeTab === tab.id
                  ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]"
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "text-xs px-1.5 py-0.5 rounded-full",
                  activeTab === tab.id
                    ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
                    : "bg-[var(--color-surface-1)] text-[var(--color-text-muted)]"
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div className="p-6">
        {activeTab === "experiments" && (
          <ExperimentsTab
            experiments={EXPERIMENTS}
            selected={selectedExp}
            onSelect={setSelectedExp}
          />
        )}
        {activeTab === "active"      && <ActiveRunsTab runs={ACTIVE_RUNS} />}
        {activeTab === "findings"    && <FindingsTab findings={FINDINGS} />}
        {activeTab === "schedule"    && <ScheduleTab runs={SCHEDULED_RUNS} />}
      </div>
    </div>
  );
}

// ─── Experiments Tab ───────────────────────────────────────────────────────

function ExperimentsTab({
  experiments,
  selected,
  onSelect,
}: {
  experiments: Experiment[];
  selected: Experiment | null;
  onSelect: (e: Experiment | null) => void;
}) {
  return (
    <div className={cn("grid gap-4", selected ? "grid-cols-[1fr_440px]" : "grid-cols-1")}>
      {/* List */}
      <div className="space-y-2">
        {experiments.map((exp) => (
          <button
            key={exp.id}
            onClick={() => onSelect(selected?.id === exp.id ? null : exp)}
            className={cn(
              "w-full text-left bg-[var(--color-surface-1)] border rounded-xl p-4 transition-all",
              selected?.id === exp.id
                ? "border-primary/50 ring-1 ring-indigo-500/20"
                : "border-[var(--color-border)] hover:border-[var(--color-border)]"
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[var(--color-text-primary)] text-sm">{exp.name}</span>
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border font-medium capitalize",
                      statusColor(exp.status)
                    )}
                  >
                    {exp.status}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1.5 text-xs text-[var(--color-text-muted)] flex-wrap">
                  <span>Type: <span className="text-[var(--color-text-secondary)]">{exp.type}</span></span>
                  <span>Target: <span className="text-[var(--color-text-secondary)]">{exp.targetService}</span></span>
                  <span>Blast radius: <span className="text-[var(--color-text-secondary)]">{exp.blastRadius}</span></span>
                  <span>Last run: <span className="text-[var(--color-text-secondary)]">{exp.lastRun}</span></span>
                </div>
              </div>
              <span className="text-[var(--color-text-muted)] text-sm shrink-0">›</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Panel */}
      {selected && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 space-y-5 h-fit sticky top-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="font-semibold text-[var(--color-text-primary)] leading-snug">{selected.name}</h2>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{selected.id}</p>
            </div>
            <button
              onClick={() => onSelect(null)}
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xl leading-none transition-colors"
            >
              ×
            </button>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-2">
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium capitalize", statusColor(selected.status))}>
              {selected.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]">
              {selected.type}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border border-[var(--color-border)] text-[var(--color-text-secondary)] bg-[var(--color-surface-2)]">
              Blast {selected.blastRadius}
            </span>
          </div>

          {/* Hypothesis */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-1.5">
              Hypothesis
            </p>
            <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">{selected.hypothesis}</p>
          </div>

          {/* Steady State */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Steady State Verifications
            </p>
            <div className="space-y-2">
              {selected.steadyState.map((chk, i) => (
                <div key={i} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "shrink-0 font-bold",
                      chk.passed ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {chk.passed ? "✓" : "✗"}
                  </span>
                  <span
                    className={cn(
                      chk.passed
                        ? "text-[var(--color-text-primary)]"
                        : "text-[var(--color-text-muted)] line-through decoration-rose-500/40"
                    )}
                  >
                    {chk.check}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Rollback */}
          <div>
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Rollback Steps
            </p>
            <ol className="space-y-1.5">
              {selected.rollbackSteps.map((step, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--color-text-secondary)]">
                  <span className="text-[var(--color-text-muted)] shrink-0 tabular-nums w-4">{i + 1}.</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button className="flex-1 bg-primary hover:bg-primary transition-colors px-4 py-2.5 rounded-lg text-sm font-medium">
              Run Experiment
            </button>
            <button className="px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] transition-colors text-[var(--color-text-primary)]">
              Edit
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Active Runs Tab ───────────────────────────────────────────────────────

function ActiveRunsTab({ runs }: { runs: ActiveRun[] }) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[var(--color-text-muted)]">
        <p className="text-lg font-medium text-[var(--color-text-secondary)]">No active runs</p>
        <p className="text-sm mt-1">All systems nominal. No experiments currently injecting failures.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {runs.map((run) => {
        const elapsed = run.durationTotal - run.durationRemaining;
        const progress = Math.round((elapsed / run.durationTotal) * 100);

        const latencyRows = [
          { label: "p50", baseline: 45,  delta: Math.round(run.latencyDelta * 0.3), max: 700 },
          { label: "p95", baseline: 120, delta: Math.round(run.latencyDelta * 0.7), max: 700 },
          { label: "p99", baseline: 180, delta: run.latencyDelta,                   max: 700 },
        ];

        return (
          <div key={run.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-pulse" />
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{run.experimentName}</h3>
                </div>
                <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">{run.injectionType}</p>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors">
                  Pause
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-400 hover:bg-rose-500/20 transition-colors">
                  Stop
                </button>
              </div>
            </div>

            {/* Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mb-1.5">
                <span>
                  Remaining:{" "}
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatDuration(run.durationRemaining)}
                  </span>
                </span>
                <span>{progress}% elapsed</span>
              </div>
              <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Metric cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-4">
              <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Target Services</p>
                <p className="text-xs text-[var(--color-text-primary)] font-medium leading-snug">
                  {run.targetServices.join(", ")}
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Affected Instances</p>
                <p className="text-sm text-[var(--color-text-primary)] font-semibold">{run.affectedPercent}%</p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Error Rate Δ</p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    run.errorRateDelta > 0.2
                      ? "text-rose-400"
                      : run.errorRateDelta > 0
                      ? "text-amber-400"
                      : "text-emerald-400"
                  )}
                >
                  {run.errorRateDelta > 0 ? "+" : ""}{run.errorRateDelta}%
                </p>
              </div>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">Latency Δ</p>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    run.latencyDelta > 200 ? "text-rose-400" : run.latencyDelta > 50 ? "text-amber-400" : "text-emerald-400"
                  )}
                >
                  +{run.latencyDelta}ms
                </p>
              </div>
            </div>

            {/* Latency bar chart */}
            <div className="pt-4 border-t border-[var(--color-border)]">
              <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Latency Impact — Baseline vs. Current
              </p>
              <div className="space-y-2.5">
                {latencyRows.map((row) => {
                  const current = row.baseline + row.delta;
                  const baseW = Math.round((row.baseline / row.max) * 100);
                  const currW = Math.min(Math.round((current / row.max) * 100), 100);
                  return (
                    <div key={row.label} className="flex items-center gap-3">
                      <span className="text-xs text-[var(--color-text-muted)] w-7 shrink-0">{row.label}</span>
                      <div className="flex-1 h-5 bg-[var(--color-surface-2)] rounded overflow-hidden relative">
                        {/* baseline */}
                        <div
                          className="absolute inset-y-0 left-0 bg-[var(--color-surface-3)] rounded"
                          style={{ width: `${baseW}%` }}
                        />
                        {/* current overlay */}
                        <div
                          className={cn(
                            "absolute inset-y-0 left-0 rounded",
                            row.delta > 200 ? "bg-rose-500/60" : row.delta > 50 ? "bg-amber-500/60" : "bg-primary/60"
                          )}
                          style={{ width: `${currW}%` }}
                        />
                      </div>
                      <span className="text-xs text-[var(--color-text-secondary)] w-28 text-right shrink-0 tabular-nums">
                        {row.baseline}ms → {current}ms
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-2.5 rounded bg-[var(--color-surface-3)]" /> Baseline
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-2.5 rounded bg-primary/60" /> Current
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Findings Tab ──────────────────────────────────────────────────────────

function FindingsTab({ findings }: { findings: Finding[] }) {
  const [filter, setFilter] = useState<Severity | "all">("all");

  const severities: Severity[] = ["critical", "high", "medium", "low"];

  const counts: Record<Severity, number> = {
    critical: findings.filter((f) => f.severity === "critical").length,
    high:     findings.filter((f) => f.severity === "high").length,
    medium:   findings.filter((f) => f.severity === "medium").length,
    low:      findings.filter((f) => f.severity === "low").length,
  };

  const filtered =
    filter === "all" ? findings : findings.filter((f) => f.severity === filter);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3">
        {severities.map((sev) => (
          <button
            key={sev}
            onClick={() => setFilter(filter === sev ? "all" : sev)}
            className={cn(
              "bg-[var(--color-surface-1)] border rounded-xl p-4 text-left transition-all",
              filter === sev
                ? "border-[var(--color-surface-3)] ring-1 ring-zinc-600"
                : "border-[var(--color-border)] hover:border-[var(--color-border)]"
            )}
          >
            <p className={cn("text-3xl font-bold tabular-nums", severityText(sev))}>
              {counts[sev]}
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-1 capitalize">{sev}</p>
          </button>
        ))}
      </div>

      {/* Filter pills */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">Filter:</span>
        {(["all", ...severities] as (Severity | "all")[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium transition-colors capitalize",
              filter === f
                ? "bg-primary text-[var(--color-text-primary)]"
                : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]"
            )}
          >
            {f === "all" ? "All" : f}
          </button>
        ))}
      </div>

      {/* Findings list */}
      <div className="space-y-3">
        {filtered.map((finding) => (
          <div
            key={finding.id}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5"
          >
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span
                className={cn(
                  "text-xs px-2 py-0.5 rounded-full border font-medium capitalize",
                  severityBadge(finding.severity)
                )}
              >
                {finding.severity}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  remediationColor(finding.remediationStatus)
                )}
              >
                {remediationLabel(finding.remediationStatus)}
              </span>
            </div>
            <h3 className="font-medium text-[var(--color-text-primary)] text-sm mb-1.5">{finding.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{finding.description}</p>
            <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)] flex-wrap">
              <span>
                Service: <span className="text-[var(--color-text-secondary)]">{finding.affectedService}</span>
              </span>
              <span>
                Discovered: <span className="text-[var(--color-text-secondary)]">{finding.discoveryDate}</span>
              </span>
              <span>
                Experiment:{" "}
                <span className="text-primary font-mono">{finding.linkedExperiment}</span>
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)] text-sm">
            No findings matching this filter.
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Schedule Tab ──────────────────────────────────────────────────────────

function ScheduleTab({ runs }: { runs: ScheduledRun[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Next <span className="text-[var(--color-text-primary)] font-medium">{runs.length}</span> scheduled experiments
        </p>
        <button className="bg-primary hover:bg-primary transition-colors px-3 py-1.5 rounded-lg text-xs font-medium">
          + Schedule Experiment
        </button>
      </div>

      <div className="space-y-2">
        {runs.map((run, index) => {
          const dt = new Date(run.scheduledAt);
          const month = dt.toLocaleDateString("en-US", { month: "short" });
          const day = dt.getDate();
          const weekday = dt.toLocaleDateString("en-US", { weekday: "short" });
          const time = dt.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });

          return (
            <div
              key={run.id}
              className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex items-center gap-4 hover:border-[var(--color-border)] transition-colors"
            >
              {/* Date badge */}
              <div className="w-14 shrink-0 text-center bg-[var(--color-surface-2)] rounded-lg py-2 px-1">
                <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">{month}</p>
                <p className="text-2xl font-bold text-[var(--color-text-primary)] leading-tight">{day}</p>
                <p className="text-xs text-[var(--color-text-muted)] uppercase">{weekday}</p>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-text-muted)] tabular-nums font-mono">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-medium text-[var(--color-text-primary)] text-sm truncate">
                    {run.experimentName}
                  </h3>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-[var(--color-text-muted)] flex-wrap">
                  <span className="text-[var(--color-text-secondary)] font-medium">{time} UTC</span>
                  <span>·</span>
                  <span>Est. {run.estimatedDuration}</span>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex items-center gap-2 shrink-0">
                {run.approverRequired ? (
                  <span
                    className={cn(
                      "text-xs px-2 py-0.5 rounded-full border font-medium",
                      run.preApproved
                        ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
                        : "text-amber-400 bg-amber-500/10 border-amber-500/30"
                    )}
                  >
                    {run.preApproved ? "Approved" : "Awaiting Approval"}
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full border font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-2)] border-[var(--color-border)]">
                    Auto-run
                  </span>
                )}
                <button className="text-[var(--color-text-muted)] hover:text-rose-400 transition-colors text-sm">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

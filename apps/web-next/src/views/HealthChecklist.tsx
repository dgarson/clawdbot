import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = "pass" | "fail" | "warn" | "skip" | "pending";
type CheckCategory = "security" | "performance" | "reliability" | "config" | "compliance" | "deployment";
type CheckSeverity = "critical" | "high" | "medium" | "low" | "info";

interface HealthCheck {
  id: string;
  name: string;
  description: string;
  category: CheckCategory;
  severity: CheckSeverity;
  status: CheckStatus;
  message: string;
  remediation: string;
  docUrl: string;
  lastChecked: string;
  durationMs: number;
  automated: boolean;
  tags: string[];
}

interface CheckSuite {
  id: string;
  name: string;
  description: string;
  checks: HealthCheck[];
  lastRun: string;
  runDurationMs: number;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const SUITES: CheckSuite[] = [
  {
    id: "security",
    name: "Security Checks",
    description: "Validates secrets, access controls, and vulnerability status",
    lastRun: "2026-02-22T02:10:00Z",
    runDurationMs: 2840,
    checks: [
      { id: "sec-1", name: "Secret Scan", description: "No hardcoded secrets in codebase", category: "security", severity: "critical", status: "pass", message: "0 secrets detected in 890 files scanned", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 1200, automated: true, tags: ["secrets", "git"] },
      { id: "sec-2", name: "Dependency Audit", description: "No critical/high CVEs in dependencies", category: "security", severity: "high", status: "pass", message: "0 critical, 0 high vulnerabilities found in pnpm audit", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 840, automated: true, tags: ["deps", "cve"] },
      { id: "sec-3", name: "Auth Token Rotation", description: "API keys rotated within 90 days", category: "security", severity: "medium", status: "warn", message: "2 tokens last rotated >60 days ago", remediation: "Rotate tokens for: openai-prod, anthropic-dev within 30 days", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 320, automated: true, tags: ["auth", "rotation"] },
      { id: "sec-4", name: "Network Exposure", description: "No internal services exposed to public internet", category: "security", severity: "critical", status: "pass", message: "All services behind VPC. No unexpected public endpoints.", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 480, automated: true, tags: ["network", "exposure"] },
    ],
  },
  {
    id: "performance",
    name: "Performance Checks",
    description: "Validates response times, resource usage, and efficiency",
    lastRun: "2026-02-22T02:10:00Z",
    runDurationMs: 1920,
    checks: [
      { id: "perf-1", name: "P95 Latency", description: "P95 request latency < 5000ms", category: "performance", severity: "high", status: "pass", message: "P95 latency: 2340ms (target: <5000ms)", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 480, automated: true, tags: ["latency", "p95"] },
      { id: "perf-2", name: "Token Efficiency", description: "Token-to-output ratio > 60%", category: "performance", severity: "medium", status: "warn", message: "Current efficiency: 78% (target: 80%)", remediation: "Enable context pruning and implement prompt caching", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 240, automated: true, tags: ["tokens", "efficiency"] },
      { id: "perf-3", name: "Build Time", description: "pnpm build completes < 30s", category: "performance", severity: "low", status: "pass", message: "Build time: 1.94s ✓", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 1940, automated: true, tags: ["build", "ci"] },
      { id: "perf-4", name: "Bundle Size", description: "Each lazy chunk < 50KB gzip", category: "performance", severity: "medium", status: "pass", message: "Largest chunk: 22.91 KB gzip (PluginManager). All 95 chunks within budget.", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 840, automated: true, tags: ["bundle", "size"] },
    ],
  },
  {
    id: "reliability",
    name: "Reliability Checks",
    description: "Validates uptime, error rates, and incident response",
    lastRun: "2026-02-22T02:10:00Z",
    runDurationMs: 1240,
    checks: [
      { id: "rel-1", name: "Gateway Health", description: "OpenClaw gateway responds to health check", category: "reliability", severity: "critical", status: "pass", message: "Gateway healthy: 200 OK in 42ms", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 42, automated: true, tags: ["gateway", "health"] },
      { id: "rel-2", name: "Session Store", description: "Session store read/write latency < 100ms", category: "reliability", severity: "high", status: "pass", message: "Session store: write 18ms, read 12ms ✓", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 30, automated: true, tags: ["sessions", "storage"] },
      { id: "rel-3", name: "Error Rate", description: "Global error rate < 2%", category: "reliability", severity: "high", status: "pass", message: "Error rate: 1.4% (target: <2%)", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 120, automated: true, tags: ["errors", "rate"] },
      { id: "rel-4", name: "Backup Verify", description: "Daily backup snapshot readable", category: "reliability", severity: "high", status: "warn", message: "Last verified: 36h ago (target: <24h)", remediation: "Run `openclaw backup verify` to validate latest snapshot", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 280, automated: false, tags: ["backup", "data"] },
    ],
  },
  {
    id: "config",
    name: "Configuration Checks",
    description: "Validates agent configs, environment variables, and YAML files",
    lastRun: "2026-02-22T02:10:00Z",
    runDurationMs: 840,
    checks: [
      { id: "cfg-1", name: "AGENTS.md Schema", description: "All AGENTS.md files parse without error", category: "config", severity: "high", status: "pass", message: "12 AGENTS.md files validated ✓", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 180, automated: true, tags: ["agents", "schema"] },
      { id: "cfg-2", name: "Env Variables", description: "All required environment variables set", category: "config", severity: "critical", status: "pass", message: "18/18 required env vars present", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 45, automated: true, tags: ["env", "config"] },
      { id: "cfg-3", name: "Cron Schedule", description: "All cron jobs have valid schedules", category: "config", severity: "medium", status: "fail", message: "1 invalid cron expression in cron.yaml: '0 * * *' (missing field)", remediation: "Fix line 42 in cron.yaml: change '0 * * *' to '0 * * * *'", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 120, automated: true, tags: ["cron", "yaml"] },
      { id: "cfg-4", name: "Tool Policy", description: "tool-policy.json validates against schema", category: "config", severity: "high", status: "pass", message: "tool-policy.json: valid JSON, schema compliant", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 95, automated: true, tags: ["tools", "policy"] },
    ],
  },
  {
    id: "compliance",
    name: "Compliance Checks",
    description: "Validates audit logging, data retention, and privacy policies",
    lastRun: "2026-02-22T02:10:00Z",
    runDurationMs: 640,
    checks: [
      { id: "comp-1", name: "Audit Trail Complete", description: "100% of agent actions logged to audit log", category: "compliance", severity: "critical", status: "pass", message: "Audit coverage: 100% ✓", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 280, automated: true, tags: ["audit", "logging"] },
      { id: "comp-2", name: "Data Retention", description: "Session data not retained beyond 90 days", category: "compliance", severity: "high", status: "pass", message: "Oldest retained session: 42 days (limit: 90 days)", remediation: "", docUrl: "#", lastChecked: "2026-02-22T02:10:00Z", durationMs: 160, automated: true, tags: ["retention", "data"] },
      { id: "comp-3", name: "PII Check", description: "No PII in log output", category: "compliance", severity: "high", status: "skip", message: "Skipped: requires manual review. Schedule quarterly.", remediation: "Manually review log samples for PII exposure", docUrl: "#", lastChecked: "2026-02-21T00:00:00Z", durationMs: 0, automated: false, tags: ["pii", "logs"] },
    ],
  },
];

const STATUS_CONFIG: Record<CheckStatus, { label: string; color: string; bg: string; border: string; emoji: string }> = {
  pass: { label: "Pass", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50", emoji: "✓" },
  fail: { label: "Fail", color: "text-rose-400", bg: "bg-rose-900/20", border: "border-rose-700/50", emoji: "✗" },
  warn: { label: "Warn", color: "text-amber-400", bg: "bg-amber-900/20", border: "border-amber-700/50", emoji: "⚠" },
  skip: { label: "Skip", color: "text-[var(--color-text-muted)]", bg: "bg-[var(--color-surface-2)]/40", border: "border-[var(--color-border)]", emoji: "○" },
  pending: { label: "Pending", color: "text-blue-400", bg: "bg-blue-900/20", border: "border-blue-700/50", emoji: "…" },
};

const SEVERITY_CONFIG: Record<CheckSeverity, { label: string; color: string }> = {
  critical: { label: "Critical", color: "text-rose-400" },
  high: { label: "High", color: "text-orange-400" },
  medium: { label: "Medium", color: "text-amber-400" },
  low: { label: "Low", color: "text-blue-400" },
  info: { label: "Info", color: "text-[var(--color-text-secondary)]" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function HealthChecklist() {
  const [selectedSuite, setSelectedSuite] = useState<CheckSuite | null>(null);
  const [selectedCheck, setSelectedCheck] = useState<HealthCheck | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [filterStatus, setFilterStatus] = useState<CheckStatus | "all">("all");

  const allChecks = SUITES.flatMap((s) => s.checks);
  const passCount = allChecks.filter((c) => c.status === "pass").length;
  const failCount = allChecks.filter((c) => c.status === "fail").length;
  const warnCount = allChecks.filter((c) => c.status === "warn").length;
  const skipCount = allChecks.filter((c) => c.status === "skip").length;
  const healthScore = Math.round((passCount / (allChecks.length - skipCount)) * 100);

  function runChecks() {
    setIsRunning(true);
    setTimeout(() => setIsRunning(false), 2000);
  }

  const displaySuites = selectedSuite ? [selectedSuite] : SUITES;

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Health Checklist</h1>
              <p className="text-sm text-[var(--color-text-secondary)]">System readiness across {SUITES.length} domains</p>
            </div>
            {/* Health score */}
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl border",
              healthScore >= 90 ? "bg-emerald-900/20 border-emerald-700/50" : healthScore >= 75 ? "bg-amber-900/20 border-amber-700/50" : "bg-rose-900/20 border-rose-700/50"
            )}>
              <span className="text-2xl">{healthScore >= 90 ? "✅" : healthScore >= 75 ? "⚠️" : "🚨"}</span>
              <div>
                <div className="text-xs text-[var(--color-text-muted)]">Health Score</div>
                <div className={cn("text-xl font-black", healthScore >= 90 ? "text-emerald-400" : healthScore >= 75 ? "text-amber-400" : "text-rose-400")}>
                  {healthScore}%
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setSelectedSuite(null); setSelectedCheck(null); }}
              className={cn("px-3 py-1.5 rounded text-sm", !selectedSuite ? "bg-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
            >
              All Suites
            </button>
            <button
              onClick={runChecks}
              disabled={isRunning}
              className={cn("px-4 py-1.5 rounded text-sm", isRunning ? "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]" : "bg-primary hover:bg-primary text-[var(--color-text-primary)]")}
            >
              {isRunning ? "⟳ Running…" : "▶ Run All"}
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-5 gap-3 mb-3">
          {[
            { label: "Pass", value: passCount, color: "text-emerald-400", status: "pass" as CheckStatus },
            { label: "Fail", value: failCount, color: "text-rose-400", status: "fail" as CheckStatus },
            { label: "Warn", value: warnCount, color: "text-amber-400", status: "warn" as CheckStatus },
            { label: "Skip", value: skipCount, color: "text-[var(--color-text-muted)]", status: "skip" as CheckStatus },
            { label: "Total", value: allChecks.length, color: "text-[var(--color-text-primary)]", status: "all" as CheckStatus | "all" },
          ].map((s) => (
            <button
              key={s.label}
              onClick={() => setFilterStatus(filterStatus === s.status ? "all" : s.status)}
              className={cn(
                "p-3 rounded-lg border text-left transition-all",
                filterStatus === s.status ? "bg-indigo-900/30 border-primary/50" : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
              )}
            >
              <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </button>
          ))}
        </div>

        {/* Suite tabs */}
        <div className="flex gap-1">
          {SUITES.map((suite) => {
            const suiteChecks = suite.checks;
            const hasIssue = suiteChecks.some((c) => c.status === "fail");
            const hasWarn = suiteChecks.some((c) => c.status === "warn");
            return (
              <button
                key={suite.id}
                onClick={() => setSelectedSuite(selectedSuite?.id === suite.id ? null : suite)}
                className={cn(
                  "px-3 py-1.5 rounded text-xs",
                  selectedSuite?.id === suite.id ? "bg-primary text-[var(--color-text-primary)]" :
                  hasIssue ? "bg-rose-900/30 text-rose-400 border border-rose-700/50" :
                  hasWarn ? "bg-amber-900/30 text-amber-400 border border-amber-700/50" :
                  "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {suite.name.replace(" Checks", "")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Check list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {displaySuites.map((suite) => {
            const suiteFiltered = suite.checks.filter((c) => filterStatus === "all" || c.status === filterStatus);
            if (suiteFiltered.length === 0) {return null;}
            const suitePass = suite.checks.filter((c) => c.status === "pass").length;
            const suiteTotal = suite.checks.filter((c) => c.status !== "skip").length;
            return (
              <div key={suite.id}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{suite.name}</h3>
                    <p className="text-xs text-[var(--color-text-muted)]">{suite.description}</p>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{suitePass}/{suiteTotal} passing · {suite.runDurationMs}ms</div>
                </div>
                <div className="space-y-1.5">
                  {suiteFiltered.map((check) => {
                    const sc = STATUS_CONFIG[check.status];
                    const sv = SEVERITY_CONFIG[check.severity];
                    const isSelected = selectedCheck?.id === check.id;
                    return (
                      <button
                        key={check.id}
                        onClick={() => setSelectedCheck(isSelected ? null : check)}
                        className={cn(
                          "w-full text-left px-4 py-3 rounded-xl border flex items-start gap-4 transition-all",
                          isSelected ? "bg-indigo-900/20 border-primary/50" :
                          check.status === "fail" ? "bg-rose-900/10 border-rose-800/50" :
                          check.status === "warn" ? "bg-amber-900/10 border-amber-800/50" :
                          "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                        )}
                      >
                        {/* Status icon */}
                        <div className={cn("flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center border text-sm font-bold", sc.bg, sc.border, sc.color)}>
                          {sc.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">{check.name}</span>
                            <span className={cn("text-[10px]", sv.color)}>{sv.label}</span>
                            {!check.automated && <span className="text-[10px] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] px-1.5 py-0.5 rounded">Manual</span>}
                          </div>
                          <div className="text-xs text-[var(--color-text-secondary)]">{check.message}</div>
                          {isSelected && check.remediation && (
                            <div className="mt-2 text-xs text-amber-300 bg-amber-900/20 border border-amber-700/40 rounded px-3 py-2">
                              <span className="font-medium">Fix: </span>{check.remediation}
                            </div>
                          )}
                        </div>
                        <div className="flex-shrink-0 text-right">
                          <div className={cn("text-xs font-medium", sc.color)}>{sc.label}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{check.durationMs > 0 ? `${check.durationMs}ms` : "—"}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ── Types ──────────────────────────────────────────────────────────────────

type Severity = "critical" | "error" | "warning" | "info";
type ErrorStatus = "unresolved" | "resolved" | "ignored" | "regressed";

interface ErrorEvent {
  id: string;
  title: string;
  message: string;
  severity: Severity;
  status: ErrorStatus;
  count24h: number;
  countTotal: number;
  firstSeen: string;
  lastSeen: string;
  environment: "production" | "staging" | "development";
  service: string;
  stack: string;
  assignee: string | null;
  tags: string[];
}

interface DailyCount {
  date: string;
  critical: number;
  error: number;
  warning: number;
}

interface Release {
  version: string;
  deployedAt: string;
  errorDelta: number;
  newErrors: number;
  resolvedErrors: number;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const errors: ErrorEvent[] = [
  {
    id: "ERR-001", title: "TypeError: Cannot read properties of undefined", message: "Cannot read properties of undefined (reading 'userId')",
    severity: "critical", status: "unresolved", count24h: 842, countTotal: 12480,
    firstSeen: "2025-11-14", lastSeen: "2026-02-22T06:10:00Z",
    environment: "production", service: "api-gateway", assignee: "alice@openclawapp.com",
    stack: "at getUserProfile (routes/users.ts:142)\n  at async handleRequest (middleware/auth.ts:88)",
    tags: ["auth", "regression", "high-impact"],
  },
  {
    id: "ERR-002", title: "UnhandledPromiseRejection: Failed to connect to Redis", message: "connect ECONNREFUSED 127.0.0.1:6379",
    severity: "critical", status: "unresolved", count24h: 214, countTotal: 3200,
    firstSeen: "2026-02-18", lastSeen: "2026-02-22T06:08:00Z",
    environment: "production", service: "session-manager", assignee: null,
    stack: "at RedisClient.connect (lib/cache/redis.ts:44)\n  at SessionManager.init (services/session.ts:22)",
    tags: ["redis", "infrastructure", "cache"],
  },
  {
    id: "ERR-003", title: "ValidationError: Invalid email format", message: "Validation failed: email must be a valid email address",
    severity: "error", status: "unresolved", count24h: 620, countTotal: 18400,
    firstSeen: "2024-08-01", lastSeen: "2026-02-22T06:12:00Z",
    environment: "production", service: "auth-service", assignee: "bob@openclawapp.com",
    stack: "at validatePayload (lib/validators/user.ts:38)\n  at POST /v1/auth/register (routes/auth.ts:24)",
    tags: ["validation", "user-input"],
  },
  {
    id: "ERR-004", title: "RateLimitError: Too many requests from IP", message: "Rate limit exceeded: 429 Too Many Requests",
    severity: "warning", status: "unresolved", count24h: 2840, countTotal: 142000,
    firstSeen: "2024-06-01", lastSeen: "2026-02-22T06:14:00Z",
    environment: "production", service: "api-gateway", assignee: null,
    stack: "at checkRateLimit (middleware/ratelimit.ts:62)\n  at applyMiddleware (core/app.ts:115)",
    tags: ["rate-limit", "security"],
  },
  {
    id: "ERR-005", title: "DatabaseError: Connection pool exhausted", message: "No available connections in pool (max: 20, used: 20)",
    severity: "critical", status: "regressed", count24h: 84, countTotal: 1200,
    firstSeen: "2026-02-20", lastSeen: "2026-02-22T06:00:00Z",
    environment: "production", service: "data-service", assignee: "carol@openclawapp.com",
    stack: "at getConnection (lib/db/pool.ts:88)\n  at executeQuery (lib/db/index.ts:34)",
    tags: ["database", "postgres", "performance"],
  },
  {
    id: "ERR-006", title: "TypeError: fetch is not a function", message: "fetch is not a function in SSR context",
    severity: "error", status: "resolved", count24h: 0, countTotal: 4200,
    firstSeen: "2025-09-01", lastSeen: "2026-02-15T10:00:00Z",
    environment: "production", service: "web-renderer", assignee: "dave@openclawapp.com",
    stack: "at fetchServerData (pages/_app.tsx:48)\n  at ServerRenderer.render (renderer/ssr.ts:120)",
    tags: ["ssr", "node"],
  },
  {
    id: "ERR-007", title: "ChunkLoadError: Loading chunk 42 failed", message: "Loading chunk 42 failed. (timeout: 127.0.0.1/static/js/42.abc.chunk.js)",
    severity: "warning", status: "unresolved", count24h: 180, countTotal: 8400,
    firstSeen: "2025-12-01", lastSeen: "2026-02-22T05:55:00Z",
    environment: "production", service: "frontend", assignee: null,
    stack: "at webpackJsonpCallback (webpack.js:1)\n  at browser (entry.js:1)",
    tags: ["webpack", "cdn", "browser"],
  },
  {
    id: "ERR-008", title: "JWT expired: token has expired", message: "JsonWebTokenError: jwt expired",
    severity: "info", status: "ignored", count24h: 12400, countTotal: 480000,
    firstSeen: "2023-06-01", lastSeen: "2026-02-22T06:14:00Z",
    environment: "production", service: "auth-service", assignee: null,
    stack: "at verify (jsonwebtoken/index.js:61)\n  at verifyToken (middleware/auth.ts:22)",
    tags: ["auth", "jwt", "expected"],
  },
];

const dailyCounts: DailyCount[] = [
  { date: "Feb 15", critical: 120, error: 580, warning: 2200 },
  { date: "Feb 16", critical: 98, error: 540, warning: 1900 },
  { date: "Feb 17", critical: 140, error: 620, warning: 2400 },
  { date: "Feb 18", critical: 280, error: 820, warning: 2800 },
  { date: "Feb 19", critical: 320, error: 940, warning: 3100 },
  { date: "Feb 20", critical: 240, error: 780, warning: 2600 },
  { date: "Feb 21", critical: 188, error: 660, warning: 2400 },
  { date: "Feb 22", critical: 142, error: 480, warning: 2100 },
];

const releases: Release[] = [
  { version: "v2.14.1", deployedAt: "2026-02-22 04:00", errorDelta: -12, newErrors: 1, resolvedErrors: 13 },
  { version: "v2.14.0", deployedAt: "2026-02-20 16:00", errorDelta: +28, newErrors: 31, resolvedErrors: 3 },
  { version: "v2.13.2", deployedAt: "2026-02-18 10:00", errorDelta: -5, newErrors: 2, resolvedErrors: 7 },
  { version: "v2.13.1", deployedAt: "2026-02-15 14:00", errorDelta: +8, newErrors: 9, resolvedErrors: 1 },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function severityColor(s: Severity): string {
  const map: Record<Severity, string> = {
    critical: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    error:    "bg-red-500/20 text-red-400 border-red-500/30",
    warning:  "bg-amber-500/20 text-amber-400 border-amber-500/30",
    info:     "bg-surface-3/40 text-fg-secondary border-tok-border",
  };
  return map[s];
}

function severityDot(s: Severity): string {
  const map: Record<Severity, string> = {
    critical: "bg-rose-500",
    error:    "bg-red-500",
    warning:  "bg-amber-500",
    info:     "bg-surface-3",
  };
  return map[s];
}

function statusColor(s: ErrorStatus): string {
  const map: Record<ErrorStatus, string> = {
    unresolved: "text-rose-400",
    resolved:   "text-emerald-400",
    ignored:    "text-fg-muted",
    regressed:  "text-amber-400",
  };
  return map[s];
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function IssuesTab() {
  const [filter, setFilter] = useState<Severity | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ErrorStatus | "all">("all");
  const [selected, setSelected] = useState<ErrorEvent | null>(null);

  const visible = errors.filter((e) => {
    if (filter !== "all" && e.severity !== filter) {return false;}
    if (statusFilter !== "all" && e.status !== statusFilter) {return false;}
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1">
          {(["all", "critical", "error", "warning", "info"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                filter === f ? "bg-indigo-600 text-fg-primary" : "bg-surface-2 text-fg-secondary hover:text-fg-primary"
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="flex gap-1 ml-auto">
          {(["all", "unresolved", "regressed"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
                statusFilter === s ? "bg-indigo-600 text-fg-primary" : "bg-surface-2 text-fg-secondary hover:text-fg-primary"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {visible.length === 0 ? (
          <ContextualEmptyState
            icon={AlertTriangle}
            title="No errors match your filters"
            description="Try adjusting the severity or status filters to see more results."
            size="sm"
          />
        ) : visible.map((err) => (
          <div
            key={err.id}
            className={cn(
              "rounded-xl border p-4 cursor-pointer transition-all",
              selected?.id === err.id ? "border-indigo-500 bg-indigo-500/5" : "border-tok-border bg-surface-1 hover:border-tok-border"
            )}
            onClick={() => setSelected(selected?.id === err.id ? null : err)}
          >
            <div className="flex items-start gap-3">
              <span className={cn("w-2 h-2 rounded-full mt-1.5 shrink-0", severityDot(err.severity))} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-fg-primary text-sm">{err.title}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded border", severityColor(err.severity))}>{err.severity}</span>
                  <span className={cn("text-xs capitalize", statusColor(err.status))}>{err.status}</span>
                </div>
                <p className="text-xs text-fg-muted mt-0.5 font-mono truncate">{err.message}</p>
                <div className="flex gap-3 mt-1 text-xs text-fg-muted">
                  <span>{err.service}</span>
                  <span>{err.environment}</span>
                  <span>Last: {err.lastSeen.slice(0, 10)}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold text-fg-primary">{err.count24h.toLocaleString()}</div>
                <div className="text-xs text-fg-muted">24h events</div>
              </div>
            </div>

            {selected?.id === err.id && (
              <div className="mt-4 border-t border-tok-border pt-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <div className="text-fg-muted">First seen</div>
                    <div className="text-fg-primary">{err.firstSeen}</div>
                  </div>
                  <div>
                    <div className="text-fg-muted">Total events</div>
                    <div className="text-fg-primary">{err.countTotal.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-fg-muted">Assignee</div>
                    <div className="text-fg-primary">{err.assignee ?? "unassigned"}</div>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-fg-muted mb-1">Stack trace</div>
                  <pre className="bg-surface-0 border border-tok-border rounded px-3 py-2 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">{err.stack}</pre>
                </div>
                <div className="flex flex-wrap gap-1">
                  {err.tags.map((t) => (
                    <span key={t} className="text-xs bg-surface-2 text-fg-secondary rounded px-2 py-0.5">{t}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TrendsTab() {
  const maxBar = Math.max(...dailyCounts.map((d) => d.critical + d.error + d.warning));

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Error Volume (last 8 days)</h3>
        <div className="flex items-end gap-2 h-40">
          {dailyCounts.map((d) => {
            const total = d.critical + d.error + d.warning;
            const pCrit = (d.critical / total * 100);
            const pErr = (d.error / total * 100);
            const pWarn = (d.warning / total * 100);
            const barH = (total / maxBar * 100);
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full rounded-t overflow-hidden flex flex-col justify-end" style={{ height: "120px" }}>
                  <div className="w-full flex flex-col" style={{ height: barH + "%" }}>
                    <div className="bg-rose-500" style={{ height: pCrit + "%" }} />
                    <div className="bg-red-400" style={{ height: pErr + "%" }} />
                    <div className="bg-amber-400" style={{ height: pWarn + "%" }} />
                  </div>
                </div>
                <span className="text-xs text-fg-muted">{d.date.slice(4)}</span>
              </div>
            );
          })}
        </div>
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-rose-500" /><span className="text-fg-secondary">Critical</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-400" /><span className="text-fg-secondary">Error</span></div>
          <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-400" /><span className="text-fg-secondary">Warning</span></div>
        </div>
      </div>

      <div className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h3 className="text-sm font-semibold text-fg-primary mb-4">Release Impact</h3>
        <div className="space-y-3">
          {releases.map((r) => (
            <div key={r.version} className="flex items-center gap-4 text-sm">
              <span className="font-mono text-indigo-400 w-20">{r.version}</span>
              <span className="text-fg-muted text-xs">{r.deployedAt}</span>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-emerald-400">+{r.resolvedErrors} resolved</span>
                <span className="text-xs text-rose-400">+{r.newErrors} new</span>
                <span className={cn("text-xs font-bold", r.errorDelta < 0 ? "text-emerald-400" : "text-rose-400")}>
                  {r.errorDelta > 0 ? "+" : ""}{r.errorDelta}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertsTab() {
  const alertRules = [
    { name: "Critical spike", condition: "critical errors > 50/min", status: "active", lastFired: "2026-02-22T06:02:00Z" },
    { name: "New error in prod", condition: "new error in production", status: "active", lastFired: "2026-02-22T06:00:00Z" },
    { name: "Error rate increase", condition: "error rate +50% vs previous hour", status: "muted", lastFired: "2026-02-21T18:00:00Z" },
    { name: "P0 service down", condition: "api-gateway critical errors > 200/min", status: "active", lastFired: "2026-02-20T14:00:00Z" },
    { name: "Release regression", condition: "new errors after deploy > 5", status: "active", lastFired: "2026-02-20T16:10:00Z" },
  ];

  return (
    <div className="space-y-3">
      {alertRules.map((rule) => (
        <div key={rule.name} className="rounded-xl border border-tok-border bg-surface-1 p-4 flex items-center gap-4">
          <div className={cn("w-2 h-2 rounded-full shrink-0", rule.status === "active" ? "bg-emerald-400" : "bg-surface-3")} />
          <div className="flex-1">
            <div className="text-sm font-medium text-fg-primary">{rule.name}</div>
            <div className="text-xs text-fg-muted mt-0.5 font-mono">{rule.condition}</div>
          </div>
          <div className="text-right text-xs">
            <div className={cn(rule.status === "active" ? "text-emerald-400" : "text-fg-muted")}>{rule.status}</div>
            <div className="text-fg-muted mt-0.5">Last: {rule.lastFired.slice(5, 16).replace("T", " ")}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Issues", "Trends", "Alerts"] as const;
type Tab = typeof TABS[number];

export default function ErrorTrackingDashboard() {
  const [tab, setTab] = useState<Tab>("Issues");

  const unresolved = errors.filter((e) => e.status === "unresolved" || e.status === "regressed").length;
  const critical24h = errors.filter((e) => e.severity === "critical").reduce((a, e) => a + e.count24h, 0);
  const total24h = errors.reduce((a, e) => a + e.count24h, 0);

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Error Tracking</h1>
        <p className="text-fg-secondary text-sm">
          Real-time error monitoring across all services
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Unresolved Issues", value: unresolved, color: "text-rose-400" },
          { label: "Critical (24h)", value: critical24h.toLocaleString(), color: "text-rose-400" },
          { label: "Total Events (24h)", value: total24h.toLocaleString(), color: "text-fg-primary" },
          { label: "Services Affected", value: new Set(errors.filter((e) => e.status !== "resolved").map((e) => e.service)).size, color: "text-amber-400" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-tok-border bg-surface-1 p-4">
            <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-sm text-fg-secondary mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-tok-border">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-fg-secondary hover:text-fg-primary"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Issues" && <IssuesTab />}
      {tab === "Trends" && <TrendsTab />}
      {tab === "Alerts" && <AlertsTab />}
    </div>
  );
}

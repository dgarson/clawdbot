import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * ObservabilityDashboard
 * A unified observability platform for the Horizon UI dashboard.
 * Includes Overview, Logs, Traces, and Alerts.
 *
 * Requirements:
 * - Tabs: Overview, Logs, Traces, Alerts
 * - Design: Dark theme (zinc-950/900), Indigo accents.
 * - Accessibility: Keyboard navigable, semantic structure.
 * - Constraints: No external icons, single file, strict imports, rich sample data.
 */

// --- Types ---

type TabType = "Overview" | "Logs" | "Traces" | "Alerts";

interface KPICardProps {
  label: string;
  value: string;
  trend: string;
  trendType: "success" | "error" | "neutral";
}

interface ServiceHealth {
  name: string;
  health: number; // 0-100
  status: "healthy" | "degraded" | "critical";
}

interface Incident {
  id: string;
  title: string;
  severity: "critical" | "high" | "medium";
  status: "open" | "resolved";
  timestamp: string;
}

interface LogEntry {
  id: string;
  timestamp: string;
  level: "ERROR" | "WARN" | "INFO" | "DEBUG";
  service: string;
  message: string;
  details: Record<string, unknown>;
}

interface Span {
  id: string;
  name: string;
  service: string;
  durationMs: number;
  offsetMs: number;
  status: "success" | "error";
  children?: Span[];
}

interface Trace {
  id: string;
  traceId: string;
  rootSpan: string;
  durationMs: number;
  status: "success" | "error";
  serviceCount: number;
  spans: Span[];
}

interface Alert {
  id: string;
  name: string;
  severity: "critical" | "high" | "medium" | "low";
  condition: string;
  triggeredAt: string;
  status: "firing" | "resolved";
}

// --- Sample Data ---

const SERVICES: string[] = ["API Gateway", "Auth Service", "Worker Queue", "Database Connector", "Billing Engine"];

const SERVICE_HEALTH_DATA: ServiceHealth[] = [
  { name: "API Gateway", health: 98, status: "healthy" },
  { name: "Auth Service", health: 94, status: "healthy" },
  { name: "Worker Queue", health: 42, status: "critical" },
];

const INCIDENTS_DATA: Incident[] = [
  { id: "inc-1", title: "High error rate in Worker Queue", severity: "critical", status: "open", timestamp: "10 mins ago" },
  { id: "inc-2", title: "Latency spike in API Gateway", severity: "high", status: "open", timestamp: "24 mins ago" },
  { id: "inc-3", title: "Database connection timeouts", severity: "medium", status: "resolved", timestamp: "2 hours ago" },
];

const LOGS_DATA: LogEntry[] = [
  { id: "l1", timestamp: "2026-02-22T04:30:01Z", level: "ERROR", service: "Worker Queue", message: "Failed to process job #8821: Timeout after 30s", details: { jobId: 8821, retryCount: 3, error: "ECONNRESET" } },
  { id: "l2", timestamp: "2026-02-22T04:30:05Z", level: "INFO", service: "API Gateway", message: "GET /api/v1/user/profile 200 OK (45ms)", details: { method: "GET", path: "/api/v1/user/profile", status: 200, latency: 45 } },
  { id: "l3", timestamp: "2026-02-22T04:30:12Z", level: "WARN", service: "Auth Service", message: "JWT validation failed for user_441", details: { userId: "user_441", reason: "Expired token" } },
  { id: "l4", timestamp: "2026-02-22T04:30:15Z", level: "DEBUG", service: "Billing Engine", message: "Recalculating invoice for cycle Feb-2026", details: { invoiceId: "inv_feb_99", steps: ["fetch_usage", "apply_discounts"] } },
  { id: "l5", timestamp: "2026-02-22T04:30:20Z", level: "INFO", service: "Worker Queue", message: "Scaling worker pool to 12 nodes", details: { minNodes: 4, maxNodes: 20, current: 12 } },
  { id: "l6", timestamp: "2026-02-22T04:30:25Z", level: "ERROR", service: "Worker Queue", message: "OOM Kill detected on node worker-4", details: { node: "worker-4", memoryUsage: "4096MB" } },
  { id: "l7", timestamp: "2026-02-22T04:30:30Z", level: "INFO", service: "API Gateway", message: "POST /api/v1/orders 201 Created (120ms)", details: { method: "POST", path: "/api/v1/orders", status: 201 } },
  { id: "l8", timestamp: "2026-02-22T04:30:45Z", level: "WARN", service: "Database Connector", message: "Slow query detected: SELECT * FROM transactions", details: { duration: "1.2s", table: "transactions" } },
  { id: "l9", timestamp: "2026-02-22T04:31:02Z", level: "DEBUG", service: "Auth Service", message: "Refresh token rotated for user_12", details: { userId: "user_12" } },
  { id: "l10", timestamp: "2026-02-22T04:31:10Z", level: "INFO", service: "Worker Queue", message: "Job #8822 started", details: { jobId: 8822, queue: "priority" } },
  { id: "l11", timestamp: "2026-02-22T04:31:15Z", level: "ERROR", service: "API Gateway", message: "502 Bad Gateway upstream 'Auth Service'", details: { upstream: "Auth Service", retryable: true } },
  { id: "l12", timestamp: "2026-02-22T04:31:22Z", level: "INFO", service: "Billing Engine", message: "Payment processed for sub_991", details: { subId: "sub_991", amount: 29.99 } },
  { id: "l13", timestamp: "2026-02-22T04:31:30Z", level: "WARN", service: "Worker Queue", message: "Queue depth exceeding threshold (80%)", details: { currentDepth: 4500, threshold: 4000 } },
  { id: "l14", timestamp: "2026-02-22T04:31:40Z", level: "DEBUG", service: "API Gateway", message: "Request ID ctx_8829 headers parsed", details: { requestId: "ctx_8829" } },
  { id: "l15", timestamp: "2026-02-22T04:31:55Z", level: "INFO", service: "Auth Service", message: "User logout: user_441", details: { userId: "user_441" } },
  { id: "l16", timestamp: "2026-02-22T04:32:05Z", level: "ERROR", service: "Database Connector", message: "Connection pool exhausted", details: { poolSize: 50, active: 50, waiting: 12 } },
  { id: "l17", timestamp: "2026-02-22T04:32:15Z", level: "INFO", service: "Worker Queue", message: "Job #8822 completed successfully", details: { jobId: 8822, duration: "65s" } },
  { id: "l18", timestamp: "2026-02-22T04:32:30Z", level: "WARN", service: "API Gateway", message: "Rate limit approach for IP 192.168.1.1", details: { ip: "192.168.1.1", limit: 1000, current: 950 } },
  { id: "l19", timestamp: "2026-02-22T04:32:45Z", level: "DEBUG", service: "Billing Engine", message: "Caching tax rules for US-CO", details: { region: "US-CO" } },
  { id: "l20", timestamp: "2026-02-22T04:33:00Z", level: "INFO", service: "API Gateway", message: "System health check passed", details: { status: "OK" } },
];

const TRACES_DATA: Trace[] = [
  {
    id: "t1",
    traceId: "5f3a1b2c",
    rootSpan: "POST /checkout",
    durationMs: 450,
    status: "success",
    serviceCount: 4,
    spans: [
      { id: "s1", name: "POST /checkout", service: "API Gateway", durationMs: 450, offsetMs: 0, status: "success", children: [
        { id: "s2", name: "Validate Session", service: "Auth Service", durationMs: 40, offsetMs: 10, status: "success" },
        { id: "s3", name: "Process Payment", service: "Billing Engine", durationMs: 320, offsetMs: 60, status: "success", children: [
          { id: "s4", name: "Authorize Card", service: "External", durationMs: 200, offsetMs: 80, status: "success" }
        ]},
        { id: "s5", name: "Enqueue Confirmation", service: "Worker Queue", durationMs: 30, offsetMs: 400, status: "success" }
      ]}
    ]
  },
  {
    id: "t2",
    traceId: "9d8e7f6a",
    rootSpan: "GET /user/data",
    durationMs: 1200,
    status: "error",
    serviceCount: 3,
    spans: [
      { id: "s6", name: "GET /user/data", service: "API Gateway", durationMs: 1200, offsetMs: 0, status: "error", children: [
        { id: "s7", name: "Fetch User", service: "Auth Service", durationMs: 1150, offsetMs: 20, status: "error", children: [
          { id: "s8", name: "DB Query: User", service: "Database Connector", durationMs: 1100, offsetMs: 50, status: "error" }
        ]}
      ]}
    ]
  },
  { id: "t3", traceId: "1a2b3c4d", rootSpan: "PUT /settings", durationMs: 85, status: "success", serviceCount: 2, spans: [] },
  { id: "t4", traceId: "2b3c4d5e", rootSpan: "GET /health", durationMs: 12, status: "success", serviceCount: 1, spans: [] },
  { id: "t5", traceId: "3c4d5e6f", rootSpan: "POST /login", durationMs: 210, status: "success", serviceCount: 2, spans: [] },
  { id: "t6", traceId: "4d5e6f7g", rootSpan: "DELETE /item/42", durationMs: 540, status: "error", serviceCount: 3, spans: [] },
  { id: "t7", traceId: "5e6f7g8h", rootSpan: "GET /dashboard", durationMs: 890, status: "success", serviceCount: 5, spans: [] },
  { id: "t8", traceId: "6f7g8h9i", rootSpan: "POST /upload", durationMs: 3200, status: "success", serviceCount: 2, spans: [] },
];

const ALERTS_DATA: Alert[] = [
  { id: "a1", name: "WorkerQueueBacklog", severity: "critical", condition: "depth > 4000", triggeredAt: "2026-02-22T04:15:00Z", status: "firing" },
  { id: "a2", name: "HighErrorRateAPI", severity: "high", condition: "errors > 5%", triggeredAt: "2026-02-22T04:22:00Z", status: "firing" },
  { id: "a3", name: "LatencyP99Auth", severity: "medium", condition: "p99 > 500ms", triggeredAt: "2026-02-21T23:45:00Z", status: "resolved" },
  { id: "a4", name: "DiskSpaceLow", severity: "low", condition: "disk_usage > 85%", triggeredAt: "2026-02-22T01:10:00Z", status: "firing" },
];

// --- Sub-Components ---

const KPICard = ({ label, value, trend, trendType }: KPICardProps) => (
  <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] p-5 rounded-lg">
    <div className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">{label}</div>
    <div className="flex items-end justify-between">
      <div className="text-2xl font-bold text-[var(--color-text-primary)]">{value}</div>
      <div className={cn(
        "text-xs font-semibold px-2 py-0.5 rounded-full",
        trendType === "success" ? "bg-emerald-400/10 text-emerald-400" :
        trendType === "error" ? "bg-rose-400/10 text-rose-400" :
        "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
      )}>
        {trend}
      </div>
    </div>
  </div>
);

const ServiceHealthBar = ({ name, health, status }: ServiceHealth) => (
  <div className="space-y-2">
    <div className="flex justify-between text-sm">
      <span className="text-[var(--color-text-primary)]">{name}</span>
      <span className={cn(
        "font-medium",
        status === "healthy" ? "text-emerald-400" :
        status === "degraded" ? "text-amber-400" :
        "text-rose-400"
      )}>{health}%</span>
    </div>
    <div className="h-2 w-full bg-[var(--color-surface-2)] rounded-full overflow-hidden">
      <div 
        className={cn(
          "h-full transition-all duration-500",
          status === "healthy" ? "bg-emerald-400" :
          status === "degraded" ? "bg-amber-400" :
          "bg-rose-400"
        )}
        style={{ width: `${health}%` }}
      />
    </div>
  </div>
);

const Badge = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded", className)}>
    {children}
  </span>
);

const TraceSpan = ({ span, depth = 0, totalDuration }: { span: Span, depth?: number, totalDuration: number }) => {
  const [expanded, setExpanded] = useState<boolean>(false);
  const left = (span.offsetMs / totalDuration) * 100;
  const width = Math.max((span.durationMs / totalDuration) * 100, 0.5);

  const colors: Record<string, string> = {
    "API Gateway": "bg-indigo-500",
    "Auth Service": "bg-emerald-500",
    "Billing Engine": "bg-amber-500",
    "Worker Queue": "bg-rose-500",
    "External": "bg-[var(--color-surface-3)]",
    "Database Connector": "bg-cyan-500",
  };

  return (
    <div className="w-full">
      <div 
        className="flex items-center group cursor-pointer py-1.5 hover:bg-[var(--color-surface-2)]/50 rounded px-2"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-48 flex-shrink-0 flex items-center gap-2" style={{ paddingLeft: `${depth * 12}px` }}>
          <span className="text-[var(--color-text-muted)] text-[10px] w-4">{span.children && span.children.length > 0 ? (expanded ? "▼" : "▶") : ""}</span>
          <span className="text-[var(--color-text-primary)] text-xs truncate font-mono">{span.name}</span>
        </div>
        <div className="flex-grow h-4 relative bg-[var(--color-surface-1)]/50 rounded-sm">
          <div 
            className={cn("absolute h-full rounded-sm opacity-80 group-hover:opacity-100 transition-opacity", colors[span.service] || "bg-indigo-500")}
            style={{ left: `${left}%`, width: `${width}%` }}
          />
          <span className="absolute text-[9px] text-[var(--color-text-secondary)] font-mono" style={{ left: `${left + width + 0.5}%` }}>
            {span.durationMs}ms
          </span>
        </div>
        <div className="w-32 text-right text-[10px] text-[var(--color-text-muted)] font-mono flex-shrink-0">
          {span.service}
        </div>
      </div>
      {expanded && span.children && span.children.map(child => (
        <TraceSpan key={child.id} span={child} depth={depth + 1} totalDuration={totalDuration} />
      ))}
    </div>
  );
};

// --- Main View ---

export default function ObservabilityDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  
  // Logs State
  const [logLevelFilter, setLogLevelFilter] = useState<string>("ALL");
  const [logServiceFilter, setLogServiceFilter] = useState<string>("ALL");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Traces State
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);

  const filteredLogs = LOGS_DATA.filter(log => {
    const levelMatch = logLevelFilter === "ALL" || log.level === logLevelFilter;
    const serviceMatch = logServiceFilter === "ALL" || log.service === logServiceFilter;
    return levelMatch && serviceMatch;
  });

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="border-b border-[var(--color-border)] px-8 py-4 flex items-center justify-between sticky top-0 bg-[var(--color-surface-0)]/80 backdrop-blur-md z-30">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-indigo-600 rounded flex items-center justify-center font-bold text-[var(--color-text-primary)] italic">H</div>
          <h1 className="text-lg font-semibold tracking-tight">Horizon Observability</h1>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-[var(--color-text-secondary)] uppercase tracking-widest font-medium">System Live</span>
          </div>
          <div className="text-xs text-[var(--color-text-muted)] font-mono">2026-02-22 04:45:12 MST</div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="px-8 border-b border-[var(--color-border)] bg-[var(--color-surface-0)] sticky top-[65px] z-20">
        <div className="flex gap-8">
          {(["Overview", "Logs", "Traces", "Alerts"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "py-4 text-sm font-medium border-b-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
                activeTab === tab 
                  ? "border-indigo-500 text-indigo-400" 
                  : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-8 max-w-7xl mx-auto w-full">
        
        {/* --- OVERVIEW TAB --- */}
        {activeTab === "Overview" && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <KPICard label="Error Rate" value="0.12%" trend="-0.04%" trendType="success" />
              <KPICard label="P99 Latency" value="240ms" trend="+12ms" trendType="error" />
              <KPICard label="Throughput" value="1.2k req/s" trend="+5%" trendType="success" />
              <KPICard label="Uptime" value="99.99%" trend="Stable" trendType="neutral" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Service Health */}
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
                  <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-6 flex items-center gap-2">
                    Service Health
                  </h3>
                  <div className="space-y-6">
                    {SERVICE_HEALTH_DATA.map(svc => (
                      <ServiceHealthBar key={svc.name} {...svc} />
                    ))}
                  </div>
                </div>

                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6">
                  <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider mb-4">
                    Alert Summary
                  </h3>
                  <div className="flex items-center justify-between p-3 bg-[var(--color-surface-0)] rounded border border-[var(--color-border)]">
                    <span className="text-xs text-[var(--color-text-secondary)]">Firing Alerts</span>
                    <span className="text-rose-400 font-bold">3</span>
                  </div>
                </div>
              </div>

              {/* Recent Incidents */}
              <div className="lg:col-span-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
                <div className="px-6 py-4 border-b border-[var(--color-border)] flex justify-between items-center">
                  <h3 className="text-sm font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">Recent Incidents</h3>
                  <button className="text-xs text-indigo-400 hover:text-indigo-300 font-medium">View History</button>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {INCIDENTS_DATA.map((inc) => (
                    <div key={inc.id} className="px-6 py-4 flex items-center justify-between hover:bg-[var(--color-surface-2)]/30 transition-colors">
                      <div className="flex gap-4 items-start">
                        <div className={cn(
                          "w-2 h-2 mt-1.5 rounded-full shrink-0",
                          inc.severity === "critical" ? "bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" :
                          inc.severity === "high" ? "bg-amber-500" : "bg-indigo-500"
                        )} />
                        <div>
                          <p className="text-sm font-medium text-[var(--color-text-primary)]">{inc.title}</p>
                          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{inc.timestamp} • {inc.severity.toUpperCase()} SEVERITY</p>
                        </div>
                      </div>
                      <Badge className={inc.status === "open" ? "bg-rose-500/10 text-rose-400" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"}>
                        {inc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- LOGS TAB --- */}
        {activeTab === "Logs" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Filters */}
            <div className="flex flex-wrap gap-4 items-center bg-[var(--color-surface-1)] p-4 border border-[var(--color-border)] rounded-lg">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Level</span>
                <div className="flex bg-[var(--color-surface-0)] p-1 rounded border border-[var(--color-border)]">
                  {["ALL", "ERROR", "WARN", "INFO", "DEBUG"].map(lvl => (
                    <button
                      key={lvl}
                      onClick={() => setLogLevelFilter(lvl)}
                      className={cn(
                        "px-3 py-1 text-[10px] font-bold rounded transition-colors",
                        logLevelFilter === lvl ? "bg-indigo-600 text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                      )}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-[var(--color-text-muted)] uppercase">Service</span>
                <select 
                  value={logServiceFilter}
                  onChange={(e) => setLogServiceFilter(e.target.value)}
                  className="bg-[var(--color-surface-0)] text-[var(--color-text-primary)] text-xs border border-[var(--color-border)] rounded px-2 py-1 outline-none focus:border-indigo-500"
                >
                  <option value="ALL">All Services</option>
                  {SERVICES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="ml-auto text-[10px] text-[var(--color-text-muted)] font-mono">
                Showing {filteredLogs.length} entries
              </div>
            </div>

            {/* Log List */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="grid grid-cols-[160px_80px_140px_1fr] px-4 py-2 bg-[var(--color-surface-0)] border-b border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                <div>Timestamp</div>
                <div>Level</div>
                <div>Service</div>
                <div>Message</div>
              </div>
              <div className="divide-y divide-[var(--color-border)]/50 h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700">
                {filteredLogs.map((log) => (
                  <div key={log.id}>
                    <div 
                      onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                      className={cn(
                        "grid grid-cols-[160px_80px_140px_1fr] px-4 py-2.5 text-xs font-mono cursor-pointer transition-colors group",
                        expandedLogId === log.id ? "bg-indigo-500/5" : "hover:bg-[var(--color-surface-2)]/40"
                      )}
                    >
                      <div className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]">{log.timestamp.split("T")[1].replace("Z", "")}</div>
                      <div>
                        <Badge className={cn(
                          log.level === "ERROR" ? "bg-rose-400/10 text-rose-400" :
                          log.level === "WARN" ? "bg-amber-400/10 text-amber-400" :
                          log.level === "INFO" ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" :
                          "bg-indigo-400/10 text-indigo-400"
                        )}>
                          {log.level}
                        </Badge>
                      </div>
                      <div className="text-[var(--color-text-primary)] truncate pr-4">{log.service}</div>
                      <div className="text-[var(--color-text-primary)] truncate flex items-center gap-2">
                        {log.message}
                        <span className="text-[10px] text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity">Click to expand</span>
                      </div>
                    </div>
                    {expandedLogId === log.id && (
                      <div className="p-4 bg-[var(--color-surface-0)] border-y border-[var(--color-border)]">
                        <pre className="text-[11px] text-indigo-300 bg-indigo-500/5 p-3 rounded border border-indigo-500/20 overflow-x-auto">
                          {JSON.stringify({ ...log.details, _id: log.id, _timestamp: log.timestamp }, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- TRACES TAB --- */}
        {activeTab === "Traces" && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="grid grid-cols-[120px_1fr_100px_80px_100px] px-4 py-3 bg-[var(--color-surface-0)] border-b border-[var(--color-border)] text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">
                <div>Trace ID</div>
                <div>Root Span</div>
                <div>Duration</div>
                <div>Status</div>
                <div className="text-right">Services</div>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {TRACES_DATA.map((trace) => (
                  <div key={trace.id}>
                    <div 
                      onClick={() => setExpandedTraceId(expandedTraceId === trace.id ? null : trace.id)}
                      className={cn(
                        "grid grid-cols-[120px_1fr_100px_80px_100px] px-4 py-4 items-center cursor-pointer hover:bg-[var(--color-surface-2)]/40 transition-colors",
                        expandedTraceId === trace.id ? "bg-[var(--color-surface-2)]/40" : ""
                      )}
                    >
                      <div className="text-xs font-mono text-[var(--color-text-muted)]">{trace.traceId}</div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">{trace.rootSpan}</div>
                      <div className="text-xs font-mono text-[var(--color-text-secondary)]">{trace.durationMs}ms</div>
                      <div>
                        <Badge className={trace.status === "success" ? "bg-emerald-400/10 text-emerald-400" : "bg-rose-400/10 text-rose-400"}>
                          {trace.status}
                        </Badge>
                      </div>
                      <div className="text-right text-xs text-[var(--color-text-muted)]">{trace.serviceCount} services</div>
                    </div>
                    {expandedTraceId === trace.id && (
                      <div className="p-6 bg-[var(--color-surface-0)] border-t border-[var(--color-border)]">
                        <div className="mb-6 flex justify-between items-center">
                          <h4 className="text-xs font-bold text-[var(--color-text-muted)] uppercase tracking-widest">Span Waterfall</h4>
                          <div className="flex gap-4">
                            {SERVICES.map(s => (
                              <div key={s} className="flex items-center gap-1.5">
                                <span className={cn("w-2 h-2 rounded-full", 
                                  s === "API Gateway" ? "bg-indigo-500" :
                                  s === "Auth Service" ? "bg-emerald-500" :
                                  s === "Worker Queue" ? "bg-rose-500" :
                                  s === "Billing Engine" ? "bg-amber-500" : "bg-[var(--color-surface-3)]"
                                )} />
                                <span className="text-[10px] text-[var(--color-text-secondary)]">{s}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="space-y-1">
                          {trace.spans.length > 0 ? (
                            trace.spans.map(span => (
                              <TraceSpan key={span.id} span={span} totalDuration={trace.durationMs} />
                            ))
                          ) : (
                            <div className="py-8 text-center text-[var(--color-text-muted)] text-xs italic">
                              Full span data not available for this trace in simulation mode.
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* --- ALERTS TAB --- */}
        {activeTab === "Alerts" && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 gap-4">
              {ALERTS_DATA.map((alert) => (
                <div key={alert.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden group">
                  <div className="flex items-center">
                    <div className={cn(
                      "w-1.5 self-stretch",
                      alert.severity === "critical" ? "bg-rose-500" :
                      alert.severity === "high" ? "bg-amber-500" :
                      alert.severity === "medium" ? "bg-indigo-500" : "bg-[var(--color-surface-3)]"
                    )} />
                    <div className="flex-grow p-5 flex flex-wrap gap-6 items-center justify-between">
                      <div className="min-w-[240px]">
                        <div className="flex items-center gap-3 mb-1">
                          <h4 className="font-bold text-[var(--color-text-primary)]">{alert.name}</h4>
                          <Badge className={cn(
                            alert.severity === "critical" ? "bg-rose-500/10 text-rose-500" :
                            alert.severity === "high" ? "bg-amber-500/10 text-amber-500" :
                            "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                          )}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <p className="text-xs text-[var(--color-text-muted)] font-mono">{alert.condition}</p>
                      </div>
                      
                      <div className="flex-grow max-w-md">
                        <div className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-widest mb-1">Triggered At</div>
                        <div className="text-xs text-[var(--color-text-primary)] font-mono">{alert.triggeredAt.replace("T", " ").replace("Z", "")}</div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div>
                          <div className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold tracking-widest mb-1">Status</div>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              alert.status === "firing" ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                            )} />
                            <span className={cn(
                              "text-xs font-bold uppercase",
                              alert.status === "firing" ? "text-rose-400" : "text-emerald-400"
                            )}>{alert.status}</span>
                          </div>
                        </div>
                        <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs font-bold py-2 px-4 rounded transition-colors border border-[var(--color-border)]">
                          {alert.status === "firing" ? "Acknowledge" : "View Resolution"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Empty State / Footer Info */}
            <div className="mt-8 p-8 border-2 border-dashed border-[var(--color-border)] rounded-xl flex flex-col items-center justify-center text-[var(--color-text-muted)]">
              <div className="text-2xl mb-2">🛡️</div>
              <p className="text-sm font-medium">Monitoring 122 active rules</p>
              <p className="text-[10px] uppercase tracking-tighter mt-1">Last scan completed 4s ago</p>
            </div>
          </div>
        )}

      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-[var(--color-border)] px-8 py-6 flex justify-between items-center text-[var(--color-text-muted)]">
        <div className="text-[10px] uppercase tracking-widest font-medium">
          Horizon Platform v2.4.0-stable
        </div>
        <div className="flex gap-6 text-xs">
          <a href="#" className="hover:text-indigo-400 transition-colors">Documentation</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">API Reference</a>
          <a href="#" className="hover:text-indigo-400 transition-colors">Support</a>
        </div>
      </footer>
    </div>
  );
}

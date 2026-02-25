import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { cn } from "../lib/utils";
import { AlertFilterPillGroup } from "../components/alerts/AlertFilters";
import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  DollarSign,
  FileText,
  Flame,
  Globe,
  Hash,
  Layers,
  Monitor,
  Pause,
  Play,
  Power,
  RefreshCw,
  Shield,
  Users,
  VolumeX,
  Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface OperatorDashboardProps {
  onNavigate?: (viewId: string) => void;
}

type SessionStatus = "RUNNING" | "WAITING" | "ERROR";

interface AgentSession {
  id: string;
  agentName: string;
  agentEmoji: string;
  status: SessionStatus;
  currentTool: string;
  tokensIn: number;
  tokensOut: number;
  startedAt: number; // timestamp ms
  model: string;
  task: string;
}

type ToolCallStatus = "running" | "complete" | "error";
type ToolType = "exec" | "read" | "write" | "message" | "browser";

interface ToolCall {
  id: string;
  toolName: string;
  toolType: ToolType;
  agentName: string;
  agentEmoji: string;
  status: ToolCallStatus;
  elapsedMs: number;
  maxMs: number;
  timestamp: number;
}

type AlertSeverity = "critical" | "error" | "warning" | "info";

interface Alert {
  id: string;
  severity: AlertSeverity;
  agentName: string;
  agentEmoji: string;
  message: string;
  timestamp: number;
  acknowledged: boolean;
  muted: boolean;
}

type ProviderHealth = "healthy" | "degraded" | "down";

interface ModelProvider {
  name: string;
  icon: string;
  requestsPerMin: number;
  avgLatencyMs: number;
  errorRate: number;
  quotaUsed: number;
  quotaTotal: number;
  health: ProviderHealth;
  rateLimitProximity: number; // 0-100
}

interface NavCard {
  id: string;
  label: string;
  stat: string;
  icon: React.ReactNode;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_SESSIONS: AgentSession[] = [
  {
    id: "s1",
    agentName: "Luis",
    agentEmoji: "\u{1F3A8}",
    status: "RUNNING",
    currentTool: "write_file",
    tokensIn: 24800,
    tokensOut: 18200,
    startedAt: Date.now() - 1_423_000,
    model: "claude-sonnet-4-6",
    task: "Building OperatorDashboard view with live metrics",
  },
  {
    id: "s2",
    agentName: "Quinn",
    agentEmoji: "\u{1F30A}",
    status: "RUNNING",
    currentTool: "exec_command",
    tokensIn: 12400,
    tokensOut: 8900,
    startedAt: Date.now() - 842_000,
    model: "claude-sonnet-4-6",
    task: "Running integration test suite for Toast component",
  },
  {
    id: "s3",
    agentName: "Xavier",
    agentEmoji: "\u{1F3AF}",
    status: "WAITING",
    currentTool: "—",
    tokensIn: 68200,
    tokensOut: 42100,
    startedAt: Date.now() - 3_612_000,
    model: "claude-opus-4-6",
    task: "Awaiting architecture review approval",
  },
  {
    id: "s4",
    agentName: "Stephan",
    agentEmoji: "\u{1F6E0}\u{FE0F}",
    status: "RUNNING",
    currentTool: "read_file",
    tokensIn: 9100,
    tokensOut: 6200,
    startedAt: Date.now() - 512_000,
    model: "claude-haiku-4-6",
    task: "Scanning codebase for deprecated API usage",
  },
  {
    id: "s5",
    agentName: "Reed",
    agentEmoji: "\u267F",
    status: "ERROR",
    currentTool: "browser_navigate",
    tokensIn: 4200,
    tokensOut: 1800,
    startedAt: Date.now() - 298_000,
    model: "gemini-flash-3",
    task: "A11y audit failed — lighthouse timeout",
  },
  {
    id: "s6",
    agentName: "Piper",
    agentEmoji: "\u{1F9E9}",
    status: "RUNNING",
    currentTool: "write_file",
    tokensIn: 15600,
    tokensOut: 11400,
    startedAt: Date.now() - 1_080_000,
    model: "claude-sonnet-4-6",
    task: "Generating component variants for design system",
  },
  {
    id: "s7",
    agentName: "Wes",
    agentEmoji: "\u{1F4E1}",
    status: "RUNNING",
    currentTool: "exec_command",
    tokensIn: 7800,
    tokensOut: 5500,
    startedAt: Date.now() - 620_000,
    model: "claude-haiku-4-6",
    task: "Deploying staging environment to fly.io",
  },
];

const TOOL_TYPES: ToolType[] = ["exec", "read", "write", "message", "browser"];
const TOOL_NAMES: Record<ToolType, string[]> = {
  exec: ["exec_command", "run_tests", "build_project", "lint_check"],
  read: ["read_file", "glob_search", "grep_search", "list_dir"],
  write: ["write_file", "edit_file", "create_file", "patch_file"],
  message: ["send_message", "agent_reply", "broadcast", "request_approval"],
  browser: ["browser_navigate", "browser_click", "browser_screenshot", "browser_eval"],
};

function makeToolCall(id: string, timestamp: number): ToolCall {
  const agent = INITIAL_SESSIONS[Math.floor(Math.random() * INITIAL_SESSIONS.length)];
  const toolType = TOOL_TYPES[Math.floor(Math.random() * TOOL_TYPES.length)];
  const names = TOOL_NAMES[toolType];
  const toolName = names[Math.floor(Math.random() * names.length)];
  const maxMs = 500 + Math.floor(Math.random() * 4500);
  const statuses: ToolCallStatus[] = ["complete", "complete", "complete", "complete", "running", "error"];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const elapsedMs = status === "running" ? Math.floor(Math.random() * maxMs) : status === "error" ? maxMs : Math.floor(Math.random() * maxMs * 0.9);

  return {
    id,
    toolName,
    toolType,
    agentName: agent.agentName,
    agentEmoji: agent.agentEmoji,
    status,
    elapsedMs,
    maxMs,
    timestamp,
  };
}

const INITIAL_TOOL_CALLS: ToolCall[] = Array.from({ length: 12 }, (_, i) =>
  makeToolCall(`tc-init-${i}`, Date.now() - (12 - i) * 2800)
);

const INITIAL_ALERTS: Alert[] = [
  {
    id: "a1",
    severity: "critical",
    agentName: "Reed",
    agentEmoji: "\u267F",
    message: "Agent crashed: browser_navigate timeout after 30s — session terminated",
    timestamp: Date.now() - 45_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a2",
    severity: "error",
    agentName: "Quinn",
    agentEmoji: "\u{1F30A}",
    message: "Test suite failed: 3 of 48 assertions failed in Toast.test.tsx",
    timestamp: Date.now() - 120_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a3",
    severity: "warning",
    agentName: "Xavier",
    agentEmoji: "\u{1F3AF}",
    message: "Token budget at 82% — approaching daily limit ($82.40 of $100.00)",
    timestamp: Date.now() - 300_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a4",
    severity: "warning",
    agentName: "Stephan",
    agentEmoji: "\u{1F6E0}\u{FE0F}",
    message: "Deprecated API calls detected in 14 files — migration recommended",
    timestamp: Date.now() - 480_000,
    acknowledged: true,
    muted: false,
  },
  {
    id: "a5",
    severity: "info",
    agentName: "Luis",
    agentEmoji: "\u{1F3A8}",
    message: "OperatorDashboard.tsx build succeeded — 0 TypeScript errors",
    timestamp: Date.now() - 60_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a6",
    severity: "info",
    agentName: "Piper",
    agentEmoji: "\u{1F9E9}",
    message: "Design tokens synced — 42 new variants generated",
    timestamp: Date.now() - 180_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a7",
    severity: "error",
    agentName: "Wes",
    agentEmoji: "\u{1F4E1}",
    message: "Staging deploy failed: health check timeout on /api/health endpoint",
    timestamp: Date.now() - 90_000,
    acknowledged: false,
    muted: false,
  },
  {
    id: "a8",
    severity: "warning",
    agentName: "Luis",
    agentEmoji: "\u{1F3A8}",
    message: "Anthropic API latency spike: avg 2.4s (threshold: 1.5s)",
    timestamp: Date.now() - 600_000,
    acknowledged: true,
    muted: false,
  },
];

const INITIAL_PROVIDERS: ModelProvider[] = [
  {
    name: "Anthropic",
    icon: "\u{1F7E3}",
    requestsPerMin: 34,
    avgLatencyMs: 1240,
    errorRate: 0.8,
    quotaUsed: 72,
    quotaTotal: 100,
    health: "healthy",
    rateLimitProximity: 68,
  },
  {
    name: "OpenAI",
    icon: "\u{1F7E2}",
    requestsPerMin: 12,
    avgLatencyMs: 890,
    errorRate: 0.2,
    quotaUsed: 31,
    quotaTotal: 100,
    health: "healthy",
    rateLimitProximity: 24,
  },
  {
    name: "Google",
    icon: "\u{1F535}",
    requestsPerMin: 8,
    avgLatencyMs: 1680,
    errorRate: 3.2,
    quotaUsed: 45,
    quotaTotal: 100,
    health: "degraded",
    rateLimitProximity: 42,
  },
  {
    name: "Local",
    icon: "\u{1F7E0}",
    requestsPerMin: 2,
    avgLatencyMs: 320,
    errorRate: 0,
    quotaUsed: 8,
    quotaTotal: 100,
    health: "healthy",
    rateLimitProximity: 5,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tokenColorClass(total: number): string {
  if (total === 0) return 'text-red-400';
  if (total >= 160000) return 'text-red-400';
  if (total >= 100000) return 'text-orange-400';
  if (total >= 50000) return 'text-amber-400';
  if (total >= 10000) return 'text-blue-400';
  return 'text-green-400';
}

function costColorClass(cost: number): string {
  if (cost > 5) return 'text-red-400';
  if (cost > 2) return 'text-orange-400';
  if (cost > 1) return 'text-amber-400';
  if (cost > 0.5) return 'text-blue-400';
  if (cost > 0.2) return 'text-[var(--color-text-primary)]';
  return 'text-green-400';
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatTimestamp(ts: number): string {
  const diff = (Date.now() - ts) / 1000;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function formatCurrency(n: number): string {
  return `$${n.toFixed(2)}`;
}

const SESSION_STATUS_CONFIG: Record<SessionStatus, { label: string; dotClass: string; textClass: string }> = {
  RUNNING: { label: "RUNNING", dotClass: "bg-emerald-400", textClass: "text-emerald-400" },
  WAITING: { label: "WAITING", dotClass: "bg-amber-400", textClass: "text-amber-400" },
  ERROR: { label: "ERROR", dotClass: "bg-red-400", textClass: "text-red-400" },
};

const TOOL_TYPE_COLORS: Record<ToolType, { bar: string; text: string; label: string }> = {
  exec: { bar: "bg-amber-500", text: "text-amber-400", label: "Exec" },
  read: { bar: "bg-blue-500", text: "text-blue-400", label: "Read" },
  write: { bar: "bg-emerald-500", text: "text-emerald-400", label: "Write" },
  message: { bar: "bg-primary", text: "text-primary", label: "Message" },
  browser: { bar: "bg-cyan-500", text: "text-cyan-400", label: "Browser" },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { badge: string; border: string; bg: string; label: string }> = {
  critical: { badge: "bg-red-600 text-[var(--color-text-primary)]", border: "border-red-500/40", bg: "bg-red-500/5", label: "CRITICAL" },
  error: { badge: "bg-orange-600 text-[var(--color-text-primary)]", border: "border-orange-500/40", bg: "bg-orange-500/5", label: "ERROR" },
  warning: { badge: "bg-yellow-600 text-[var(--color-text-primary)]", border: "border-yellow-500/40", bg: "bg-yellow-500/5", label: "WARN" },
  info: { badge: "bg-blue-600 text-[var(--color-text-primary)]", border: "border-blue-500/40", bg: "bg-blue-500/5", label: "INFO" },
};

const HEALTH_CONFIG: Record<ProviderHealth, { dot: string; text: string; label: string }> = {
  healthy: { dot: "bg-emerald-400", text: "text-emerald-400", label: "Healthy" },
  degraded: { dot: "bg-amber-400", text: "text-amber-400", label: "Degraded" },
  down: { dot: "bg-red-400", text: "text-red-400", label: "Down" },
};

// ─── Sub-Components ───────────────────────────────────────────────────────────

function SectionCard({
  title,
  icon,
  children,
  className,
  headerRight,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  headerRight?: React.ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/80 overflow-hidden flex flex-col", className)}>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/60 flex-shrink-0">
        <div className="flex items-center gap-2">
          {icon}
          <h3 className="text-xs font-semibold text-[var(--color-text-primary)] uppercase tracking-widest">{title}</h3>
        </div>
        {headerRight}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

/** Circular gauge for budget usage */
function BudgetGauge({ spent, total }: { spent: number; total: number }) {
  const pct = Math.min((spent / total) * 100, 100);
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (pct / 100) * circumference;

  const gaugeColor = pct >= 85 ? "stroke-red-500" : pct >= 60 ? "stroke-amber-500" : "stroke-emerald-500";
  const textColor = pct >= 85 ? "text-red-400" : pct >= 60 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-[var(--color-surface-2)]"
            strokeWidth="8"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            fill="none"
            className={gaugeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-lg font-bold font-mono", textColor)}>{pct.toFixed(0)}%</span>
          <span className="text-[10px] text-[var(--color-text-muted)]">used</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <div className={cn("text-sm font-mono select-none", costColorClass(spent))}>{formatCurrency(spent)}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">of {formatCurrency(total)}</div>
      </div>
    </div>
  );
}

/** Text-based bar chart for spend by model */
function ModelSpendChart({ data }: { data: { model: string; spend: number }[] }) {
  const maxSpend = Math.max(...data.map((d) => d.spend), 1);
  return (
    <div className="space-y-2">
      {data.map((d) => {
        const pct = (d.spend / maxSpend) * 100;
        return (
          <div key={d.model} className="flex items-center gap-2 text-xs">
            <span className="w-20 text-[var(--color-text-secondary)] truncate font-mono text-[11px]">{d.model}</span>
            <div className="flex-1 h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={cn("w-14 text-right font-mono text-[11px] select-none", costColorClass(d.spend))}>{formatCurrency(d.spend)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OperatorDashboard({ onNavigate }: OperatorDashboardProps) {
  // State
  const [sessions, setSessions] = useState<AgentSession[]>(INITIAL_SESSIONS);
  const [toolCalls, setToolCalls] = useState<ToolCall[]>(INITIAL_TOOL_CALLS);
  const [alerts, setAlerts] = useState<Alert[]>(INITIAL_ALERTS);
  const [providers] = useState<ModelProvider[]>(INITIAL_PROVIDERS);
  const [now, setNow] = useState(Date.now());
  const [clockTime, setClockTime] = useState(new Date());
  const [paused, setPaused] = useState(false);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);
  const [alertFilter, setAlertFilter] = useState<"all" | "errors" | "warnings">("all");
  const toolCallRef = useRef<HTMLDivElement>(null);
  const toolCallCounter = useRef(INITIAL_TOOL_CALLS.length);

  // Derived metrics
  const activeSessions = sessions.filter((s) => s.status === "RUNNING").length;
  const activeAgents = new Set(sessions.map((s) => s.agentName)).size;
  const errorCount = sessions.filter((s) => s.status === "ERROR").length + alerts.filter((a) => a.severity === "critical" || a.severity === "error").length;
  const totalTokensToday = sessions.reduce((sum, s) => sum + s.tokensIn + s.tokensOut, 0);

  const budgetSpent = 42.18;
  const budgetTotal = 100.0;
  const budgetPct = (budgetSpent / budgetTotal) * 100;

  const modelSpendData = useMemo(
    () => [
      { model: "opus-4", spend: 18.42 },
      { model: "sonnet-4", spend: 14.86 },
      { model: "haiku-4", spend: 5.90 },
      { model: "gemini-fl", spend: 2.14 },
      { model: "local", spend: 0.86 },
    ],
    []
  );

  const tokensPerMin = useMemo(() => {
    const totalTok = sessions.reduce((s, sess) => s + sess.tokensIn + sess.tokensOut, 0);
    const avgDurationMin = sessions.reduce((s, sess) => s + (now - sess.startedAt), 0) / sessions.length / 60_000;
    return avgDurationMin > 0 ? Math.round(totalTok / avgDurationMin) : 0;
  }, [sessions, now]);

  const dollarsPerHour = ((budgetSpent / ((now - Math.min(...sessions.map((s) => s.startedAt))) / 3_600_000)) || 0).toFixed(2);

  const navCards: NavCard[] = useMemo(
    () => [
      { id: "logs", label: "Logs", stat: "2.4K entries", icon: <FileText className="w-4 h-4 text-[var(--color-text-secondary)]" /> },
      { id: "sessions", label: "Sessions", stat: `${sessions.length} active`, icon: <Layers className="w-4 h-4 text-primary" /> },
      { id: "approvals", label: "Approvals", stat: "3 pending", icon: <CheckCircle2 className="w-4 h-4 text-amber-400" /> },
      { id: "alerts", label: "Alerts", stat: `${alerts.filter((a) => !a.acknowledged).length} unread`, icon: <Bell className="w-4 h-4 text-red-400" /> },
      { id: "budget", label: "Token Budget", stat: `${budgetPct.toFixed(0)}% used`, icon: <DollarSign className="w-4 h-4 text-emerald-400" /> },
      { id: "health", label: "System Health", stat: "All nominal", icon: <Shield className="w-4 h-4 text-cyan-400" /> },
    ],
    [sessions.length, alerts, budgetPct]
  );

  // Filtered alerts
  const filteredAlerts = useMemo(() => {
    let list = alerts.filter((a) => !a.muted);
    if (alertFilter === "errors") list = list.filter((a) => a.severity === "critical" || a.severity === "error");
    if (alertFilter === "warnings") list = list.filter((a) => a.severity === "warning");
    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [alerts, alertFilter]);

  // Real-time clock tick (1s)
  useEffect(() => {
    const interval = setInterval(() => {
      setClockTime(new Date());
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Simulated tool call arrivals (every 2.5s)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      toolCallCounter.current += 1;
      const newCall = makeToolCall(`tc-live-${toolCallCounter.current}`, Date.now());
      // Force some of the new calls to be "running" for visual effect
      if (toolCallCounter.current % 3 === 0) {
        newCall.status = "running";
        newCall.elapsedMs = Math.floor(Math.random() * newCall.maxMs * 0.5);
      }
      setToolCalls((prev) => [...prev.slice(-19), newCall]);

      // Auto-scroll waterfall
      if (toolCallRef.current) {
        requestAnimationFrame(() => {
          if (toolCallRef.current) {
            toolCallRef.current.scrollTop = toolCallRef.current.scrollHeight;
          }
        });
      }
    }, 2500);
    return () => clearInterval(interval);
  }, [paused]);

  // Simulated session duration update and token increment (every 2s)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setSessions((prev) =>
        prev.map((s) => {
          if (s.status !== "RUNNING") return s;
          const tokInDelta = Math.floor(Math.random() * 200);
          const tokOutDelta = Math.floor(Math.random() * 150);
          return { ...s, tokensIn: s.tokensIn + tokInDelta, tokensOut: s.tokensOut + tokOutDelta };
        })
      );
    }, 2000);
    return () => clearInterval(interval);
  }, [paused]);

  // Simulated running tool call elapsed tick (every 500ms)
  useEffect(() => {
    if (paused) return;
    const interval = setInterval(() => {
      setToolCalls((prev) =>
        prev.map((tc) => {
          if (tc.status !== "running") return tc;
          const newElapsed = tc.elapsedMs + 500;
          if (newElapsed >= tc.maxMs) {
            return { ...tc, elapsedMs: tc.maxMs, status: Math.random() > 0.15 ? "complete" : "error" };
          }
          return { ...tc, elapsedMs: newElapsed };
        })
      );
    }, 500);
    return () => clearInterval(interval);
  }, [paused]);

  // Simulated new alerts (every 15s)
  useEffect(() => {
    if (paused) return;
    const alertMessages: { severity: AlertSeverity; msg: string; agent: AgentSession }[] = [
      { severity: "info", msg: "Build completed in 4.2s — no errors", agent: INITIAL_SESSIONS[0] },
      { severity: "warning", msg: "Anthropic rate limit at 78% — throttle recommended", agent: INITIAL_SESSIONS[2] },
      { severity: "info", msg: "Session checkpoint saved successfully", agent: INITIAL_SESSIONS[5] },
      { severity: "warning", msg: "Memory usage above 80% for agent process", agent: INITIAL_SESSIONS[6] },
      { severity: "error", msg: "Failed to write output file — permission denied", agent: INITIAL_SESSIONS[3] },
    ];

    const interval = setInterval(() => {
      const pick = alertMessages[Math.floor(Math.random() * alertMessages.length)];
      const newAlert: Alert = {
        id: `alert-live-${Date.now()}`,
        severity: pick.severity,
        agentName: pick.agent.agentName,
        agentEmoji: pick.agent.agentEmoji,
        message: pick.msg,
        timestamp: Date.now(),
        acknowledged: false,
        muted: false,
      };
      setAlerts((prev) => [newAlert, ...prev].slice(0, 50));
    }, 15_000);
    return () => clearInterval(interval);
  }, [paused]);

  // Handlers
  const handleAcknowledge = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)));
  }, []);

  const handleMute = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, muted: true } : a)));
  }, []);

  const handlePauseAll = useCallback(() => {
    setPaused(true);
    setSessions((prev) =>
      prev.map((s) => (s.status === "RUNNING" ? { ...s, status: "WAITING" as SessionStatus, currentTool: "—" } : s))
    );
  }, []);

  const handleResumeAll = useCallback(() => {
    setPaused(false);
    setSessions((prev) =>
      prev.map((s, i) => {
        if (s.status === "WAITING" && INITIAL_SESSIONS[i]?.status === "RUNNING") {
          return { ...s, status: "RUNNING" as SessionStatus, currentTool: INITIAL_SESSIONS[i].currentTool };
        }
        return s;
      })
    );
  }, []);

  const handleEmergencyStop = useCallback(() => {
    setPaused(true);
    setSessions((prev) => prev.map((s) => ({ ...s, status: "ERROR" as SessionStatus, currentTool: "—" })));
    const stopAlert: Alert = {
      id: `alert-stop-${Date.now()}`,
      severity: "critical",
      agentName: "System",
      agentEmoji: "\u{1F6A8}",
      message: "EMERGENCY STOP triggered — all agent sessions terminated by operator",
      timestamp: Date.now(),
      acknowledged: false,
      muted: false,
    };
    setAlerts((prev) => [stopAlert, ...prev]);
  }, []);

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* ═══ Top Status Bar ═══ */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/60">
        <div className="flex items-center justify-between flex-wrap gap-3">
          {/* Left: Metrics */}
          <div className="flex items-center gap-1 flex-wrap">
            <div className="flex items-center gap-2 mr-3">
              <Monitor className="w-5 h-5 text-primary" aria-hidden="true" />
              <h1 className="text-sm font-bold tracking-tight whitespace-nowrap">Operator Command Center</h1>
            </div>

            {/* Status pills */}
            <div className="flex items-center gap-3 flex-wrap">
              <StatusPill
                icon={<Layers className="w-3 h-3" />}
                label="Sessions"
                value={String(activeSessions)}
                colorClass="text-emerald-400"
              />
              <StatusPill
                icon={<Users className="w-3 h-3" />}
                label="Agents"
                value={String(activeAgents)}
                colorClass="text-primary"
              />
              <StatusPill
                icon={<AlertTriangle className="w-3 h-3" />}
                label="Errors"
                value={String(errorCount)}
                colorClass={errorCount > 0 ? "text-red-400" : "text-[var(--color-text-muted)]"}
              />
              <StatusPill
                icon={<Hash className="w-3 h-3" />}
                label="Tokens"
                value={formatTokens(totalTokensToday)}
                colorClass={tokenColorClass(totalTokensToday)}
              />
              <StatusPill
                icon={<Flame className="w-3 h-3" />}
                label="Burn"
                value={`${budgetPct.toFixed(0)}%`}
                colorClass={budgetPct >= 85 ? "text-red-400" : budgetPct >= 60 ? "text-amber-400" : "text-emerald-400"}
              />
            </div>
          </div>

          {/* Right: Clock + Actions */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
              <Clock className="w-3 h-3" aria-hidden="true" />
              <span className="font-mono">{formatClock(clockTime)}</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handlePauseAll}
                disabled={paused}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  paused
                    ? "border-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed"
                    : "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20"
                )}
              >
                <Pause className="w-3 h-3" aria-hidden="true" />
                Pause All
              </button>
              <button
                type="button"
                onClick={handleResumeAll}
                disabled={!paused}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all",
                  !paused
                    ? "border-[var(--color-surface-3)] text-[var(--color-text-muted)] cursor-not-allowed"
                    : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20"
                )}
              >
                <Play className="w-3 h-3" aria-hidden="true" />
                Resume
              </button>
              <button
                type="button"
                onClick={handleEmergencyStop}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-red-500/40 text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-all"
              >
                <Power className="w-3 h-3" aria-hidden="true" />
                Emergency Stop
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ Main Grid ═══ */}
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.9fr)] gap-4 h-full" style={{ gridAutoRows: "min-content" }}>
          {/* ─── Left Column, Top: Live Sessions Panel ─── */}
          <SectionCard
            title="Live Sessions"
            icon={<Activity className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
            className="lg:row-span-1"
            headerRight={
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <span className={cn("w-1.5 h-1.5 bg-emerald-400 rounded-full", !paused && "animate-pulse")} />
                {paused ? "PAUSED" : "LIVE"}
              </span>
            }
          >
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[minmax(100px,1.2fr)_80px_100px_100px_70px] gap-2 px-4 py-2 border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-semibold sticky top-0 bg-[var(--color-surface-1)]/95 z-10">
                <span>Agent</span>
                <span>Status</span>
                <span>Current Tool</span>
                <span>Tokens (I/O)</span>
                <span>Duration</span>
              </div>
              {/* Rows */}
              {sessions.map((session) => {
                const statusCfg = SESSION_STATUS_CONFIG[session.status];
                const duration = now - session.startedAt;
                const isExpanded = expandedSession === session.id;

                return (
                  <div key={session.id} className="border-b border-[var(--color-border)]/50 last:border-b-0">
                    <button
                      type="button"
                      onClick={() => setExpandedSession(isExpanded ? null : session.id)}
                      className="w-full grid grid-cols-[minmax(100px,1.2fr)_80px_100px_100px_70px] gap-2 px-4 py-2.5 text-xs hover:bg-[var(--color-surface-2)]/40 transition-colors text-left items-center"
                    >
                      <span className="flex items-center gap-2 truncate">
                        <span className="text-base" aria-hidden="true">{session.agentEmoji}</span>
                        <span className="font-medium text-[var(--color-text-primary)] truncate">{session.agentName}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusCfg.dotClass, session.status === "RUNNING" && !paused && "animate-pulse")} />
                        <span className={cn("font-mono text-[10px] font-semibold", statusCfg.textClass)}>{statusCfg.label}</span>
                      </span>
                      <span className="font-mono text-[var(--color-text-secondary)] truncate text-[11px]">{session.currentTool}</span>
                      <span className={cn("font-mono text-[11px] select-none", tokenColorClass(session.tokensIn + session.tokensOut))}>
                        {formatTokens(session.tokensIn)}/{formatTokens(session.tokensOut)}
                      </span>
                      <span className="font-mono text-[var(--color-text-secondary)] text-[11px]">{formatDuration(duration)}</span>
                    </button>
                    {isExpanded && (
                      <div className="px-4 pb-3 pt-1">
                        <div className="bg-[var(--color-surface-2)]/60 rounded-lg p-3 space-y-1.5 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--color-text-muted)] w-14">Model:</span>
                            <span className="font-mono text-violet-300">{session.model}</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-[var(--color-text-muted)] w-14">Task:</span>
                            <span className="text-[var(--color-text-primary)]">{session.task}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[var(--color-text-muted)] w-14">Started:</span>
                            <span className="text-[var(--color-text-secondary)] font-mono">{formatTimestamp(session.startedAt)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ─── Right Column, Top: Budget & Cost Panel ─── */}
          <SectionCard
            title="Budget & Cost"
            icon={<DollarSign className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />}
            className="lg:row-span-1"
          >
            <div className="p-3 space-y-4">
              <div className="flex items-start gap-4">
                {/* Gauge */}
                <BudgetGauge spent={budgetSpent} total={budgetTotal} />
                {/* Spend by model */}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-bold mb-2">Spend by Model</div>
                  <ModelSpendChart data={modelSpendData} />
                </div>
              </div>

              {/* Burn rate */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-2.5 border border-[var(--color-border)]">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">Tokens/min</div>
                  <div className={cn("text-lg font-bold font-mono select-none", tokenColorClass(tokensPerMin))}>{tokensPerMin.toLocaleString()}</div>
                </div>
                <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-2.5 border border-[var(--color-border)]">
                  <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest mb-1">$/hr</div>
                  <div className={cn("text-lg font-bold font-mono select-none", costColorClass(Number(dollarsPerHour)))}>${dollarsPerHour}</div>
                </div>
              </div>

              {/* Threshold bar */}
              <div>
                <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-widest font-bold mb-2">Daily Budget Threshold</div>
                <div className="relative h-4 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  {/* Green zone < 60% */}
                  <div className="absolute inset-y-0 left-0 w-[60%] bg-emerald-900/40 border-r border-emerald-500/30" />
                  {/* Yellow zone 60-85% */}
                  <div className="absolute inset-y-0 left-[60%] w-[25%] bg-amber-900/30 border-r border-amber-500/30" />
                  {/* Red zone > 85% */}
                  <div className="absolute inset-y-0 left-[85%] w-[15%] bg-red-900/30" />
                  {/* Current position */}
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full transition-all",
                      budgetPct >= 85 ? "bg-red-500" : budgetPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                    )}
                    style={{ width: `${Math.min(budgetPct, 100)}%`, opacity: 0.7 }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[9px] text-[var(--color-text-muted)] font-mono">
                  <span>$0</span>
                  <span className="text-emerald-600">60%</span>
                  <span className="text-amber-600">85%</span>
                  <span>${budgetTotal.toFixed(0)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* ─── Left Column, Bottom: Tool Call Waterfall ─── */}
          <SectionCard
            title="Tool Call Waterfall"
            icon={<Zap className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />}
            className="lg:row-span-1"
            headerRight={
              <div className="flex items-center gap-2">
                {TOOL_TYPES.map((t) => (
                  <span key={t} className={cn("text-[9px] font-mono flex items-center gap-1", TOOL_TYPE_COLORS[t].text)}>
                    <span className={cn("w-1.5 h-1.5 rounded-sm", TOOL_TYPE_COLORS[t].bar)} />
                    {TOOL_TYPE_COLORS[t].label}
                  </span>
                ))}
              </div>
            }
          >
            <div ref={toolCallRef} className="overflow-auto max-h-[280px] p-3 space-y-1.5">
              {toolCalls.map((tc) => {
                const typeConfig = TOOL_TYPE_COLORS[tc.toolType];
                const pct = tc.maxMs > 0 ? (tc.elapsedMs / tc.maxMs) * 100 : 0;
                return (
                  <div key={tc.id} className="flex items-center gap-2 text-[11px]">
                    <span className="w-4 text-base flex-shrink-0" aria-hidden="true">{tc.agentEmoji}</span>
                    <span className="w-16 text-[var(--color-text-muted)] truncate">{tc.agentName}</span>
                    <span className={cn("w-28 font-mono truncate", typeConfig.text)}>{tc.toolName}</span>
                    <div className="flex-1 h-4 bg-[var(--color-surface-2)] rounded overflow-hidden relative">
                      <div
                        className={cn(
                          "h-full rounded transition-all",
                          tc.status === "error" ? "bg-red-500" : typeConfig.bar,
                          tc.status === "running" && "animate-pulse"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%`, opacity: tc.status === "complete" ? 0.6 : 0.9 }}
                      />
                      {tc.status === "running" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-[9px] text-[var(--color-text-primary)] font-mono font-bold drop-shadow">{tc.elapsedMs}ms</span>
                        </div>
                      )}
                    </div>
                    <span className="w-12 text-right font-mono text-[var(--color-text-muted)] text-[10px]">{tc.elapsedMs}ms</span>
                    <span className="w-4 flex-shrink-0">
                      {tc.status === "complete" && <CheckCircle2 className="w-3 h-3 text-emerald-500" aria-hidden="true" />}
                      {tc.status === "error" && <AlertTriangle className="w-3 h-3 text-red-500" aria-hidden="true" />}
                      {tc.status === "running" && <RefreshCw className="w-3 h-3 text-amber-400 animate-spin" aria-hidden="true" />}
                    </span>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ─── Right Column, Middle: Alert Feed ─── */}
          <SectionCard
            title="Alert Feed"
            icon={<Bell className="w-3.5 h-3.5 text-red-400" aria-hidden="true" />}
            className="lg:row-span-1"
            headerRight={
              <div className="min-w-[260px]">
                <AlertFilterPillGroup
                  label="Feed"
                  value={alertFilter}
                  onChange={(next) => setAlertFilter(next as "all" | "errors" | "warnings")}
                  options={[
                    { value: "all", label: "All" },
                    { value: "errors", label: "Errors" },
                    { value: "warnings", label: "Warnings" },
                  ]}
                />
              </div>
            }
          >
            <div className="overflow-auto max-h-[280px]" role="log" aria-label="Alert feed" aria-live="polite">
              {filteredAlerts.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-muted)] text-xs">
                  <CheckCircle2 className="w-6 h-6 mb-2 opacity-40" />
                  No alerts matching filter
                </div>
              )}
              {filteredAlerts.map((alert) => {
                const sevCfg = SEVERITY_CONFIG[alert.severity];
                return (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-2.5 border-b border-[var(--color-border)]/50 transition-colors",
                      alert.acknowledged ? "opacity-50" : sevCfg.bg
                    )}
                  >
                    <span className="text-base flex-shrink-0 mt-0.5" aria-hidden="true">{alert.agentEmoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className={cn("px-1.5 py-0.5 text-[9px] font-bold rounded", sevCfg.badge)}>{sevCfg.label}</span>
                        <span className="text-xs font-medium text-[var(--color-text-primary)]">{alert.agentName}</span>
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">{formatTimestamp(alert.timestamp)}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{alert.message}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                      {!alert.acknowledged && (
                        <button
                          type="button"
                          onClick={() => handleAcknowledge(alert.id)}
                          className="px-1.5 py-0.5 text-[9px] font-semibold text-[var(--color-text-secondary)] border border-[var(--color-surface-3)] rounded hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                          title="Acknowledge"
                        >
                          ACK
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleMute(alert.id)}
                        className="p-0.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                        title="Mute"
                      >
                        <VolumeX className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </SectionCard>

          {/* ─── Full Width: Model Provider Utilization ─── */}
          <SectionCard
            title="Model Provider Utilization"
            icon={<Globe className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />}
            className="lg:col-span-2"
          >
            <div className="overflow-auto">
              <div className="grid grid-cols-[repeat(4,1fr)] divide-x divide-[var(--color-border)] min-w-[640px]">
                {providers.map((provider) => {
                  const healthCfg = HEALTH_CONFIG[provider.health];
                  const quotaPct = provider.quotaTotal > 0 ? (provider.quotaUsed / provider.quotaTotal) * 100 : 0;
                  const rlColor =
                    provider.rateLimitProximity >= 80
                      ? "text-red-400"
                      : provider.rateLimitProximity >= 50
                        ? "text-amber-400"
                        : "text-emerald-400";

                  return (
                    <div key={provider.name} className="p-4 space-y-3">
                      {/* Provider header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{provider.icon}</span>
                          <span className="text-sm font-semibold text-[var(--color-text-primary)]">{provider.name}</span>
                        </div>
                        <span className="flex items-center gap-1">
                          <span className={cn("w-2 h-2 rounded-full", healthCfg.dot)} />
                          <span className={cn("text-[10px] font-semibold", healthCfg.text)}>{healthCfg.label}</span>
                        </span>
                      </div>

                      {/* Stats */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--color-text-muted)]">Requests/min</span>
                          <span className="font-mono text-[var(--color-text-primary)]">{provider.requestsPerMin}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--color-text-muted)]">Avg Latency</span>
                          <span className="font-mono text-[var(--color-text-primary)]">{provider.avgLatencyMs}ms</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                          <span className="text-[var(--color-text-muted)]">Error Rate</span>
                          <span className={cn("font-mono", provider.errorRate > 2 ? "text-red-400" : provider.errorRate > 0 ? "text-amber-400" : "text-emerald-400")}>
                            {provider.errorRate}%
                          </span>
                        </div>

                        {/* Quota bar */}
                        <div>
                          <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                            <span>Quota</span>
                            <span className="font-mono">{quotaPct.toFixed(0)}%</span>
                          </div>
                          <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all",
                                quotaPct >= 85 ? "bg-red-500" : quotaPct >= 60 ? "bg-amber-500" : "bg-emerald-500"
                              )}
                              style={{ width: `${quotaPct}%` }}
                            />
                          </div>
                        </div>

                        {/* Rate limit proximity */}
                        {provider.rateLimitProximity >= 40 && (
                          <div className={cn("flex items-center gap-1.5 text-[10px] font-semibold", rlColor)}>
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                            Rate limit: {provider.rateLimitProximity}% proximity
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </SectionCard>

          {/* ─── Full Width: Quick Navigation Cards ─── */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {navCards.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  onClick={() => onNavigate?.(card.id)}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/60 hover:bg-[var(--color-surface-2)]/80 hover:border-[var(--color-surface-3)] transition-all group text-center"
                >
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center group-hover:bg-[var(--color-surface-3)] transition-colors">
                    {card.icon}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[var(--color-text-primary)] group-hover:text-[var(--color-text-primary)] transition-colors">{card.label}</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-0.5">{card.stat}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Helper Components ─────────────────────────────────────────────────

function StatusPill({
  icon,
  label,
  value,
  colorClass,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  colorClass: string;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[11px]">
      <span className={cn("opacity-70", colorClass)}>{icon}</span>
      <span className="text-[var(--color-text-muted)]">{label}</span>
      <span className={cn("font-mono font-bold", colorClass)}>{value}</span>
    </div>
  );
}

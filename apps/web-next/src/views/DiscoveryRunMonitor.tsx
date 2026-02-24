import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "failed" | "pending" | "completed";
type WaveStatus = "upcoming" | "active" | "completed";

interface DiscoveryAgent {
  id: string;
  name: string;
  domain: string;
  status: AgentStatus;
  wave: 1 | 2 | 3;
  tokensUsed: number;
  tokenLimit: number;
  findingsCount: number;
  lastHeartbeat: string | null;
  model: string;
  errorRate: number;
  hasToolAccess: boolean;
}

interface DiscoveryWave {
  id: 1 | 2 | 3;
  label: string;
  scheduledAt: string; // MST ISO
  status: WaveStatus;
  agentCount: number;
  completedAgents: number;
  cronJobs: number;
}

interface SystemFlag {
  id: string;
  label: string;
  severity: "critical" | "warning" | "ok";
  detail: string;
  resolved: boolean;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_WAVES: DiscoveryWave[] = [
  { id: 1, label: "Wave 1 — Morning", scheduledAt: "2026-02-23T17:00:00Z", status: "upcoming", agentCount: 5, completedAgents: 0, cronJobs: 6 },
  { id: 2, label: "Wave 2 — Afternoon", scheduledAt: "2026-02-23T21:00:00Z", status: "upcoming", agentCount: 5, completedAgents: 0, cronJobs: 6 },
  { id: 3, label: "Wave 3 — Evening", scheduledAt: "2026-02-24T02:00:00Z", status: "upcoming", agentCount: 5, completedAgents: 0, cronJobs: 5 },
];

const MOCK_AGENTS: DiscoveryAgent[] = [
  { id: "disc-01", name: "Atlas", domain: "AI Infrastructure", status: "pending", wave: 1, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-02", name: "Beacon", domain: "Developer Tooling", status: "pending", wave: 1, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
  { id: "disc-03", name: "Carta", domain: "Workflow Automation", status: "pending", wave: 1, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "grok-4", errorRate: 0, hasToolAccess: false },
  { id: "disc-04", name: "Delphi", domain: "Observability & Monitoring", status: "pending", wave: 1, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-05", name: "Echo", domain: "Security & Compliance", status: "pending", wave: 1, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
  { id: "disc-06", name: "Fenix", domain: "Data Platforms", status: "pending", wave: 2, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-07", name: "Gust", domain: "Cost Optimization", status: "pending", wave: 2, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "grok-4", errorRate: 0, hasToolAccess: false },
  { id: "disc-08", name: "Helix", domain: "ML/AI Platform", status: "pending", wave: 2, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
  { id: "disc-09", name: "Iris", domain: "Product Analytics", status: "pending", wave: 2, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-10", name: "Jade", domain: "API Design", status: "pending", wave: 2, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
  { id: "disc-11", name: "Kilo", domain: "Enterprise Sales", status: "pending", wave: 3, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-12", name: "Luna", domain: "Open Source Ecosystem", status: "pending", wave: 3, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "grok-4", errorRate: 0, hasToolAccess: false },
  { id: "disc-13", name: "Mosaic", domain: "No-Code / Low-Code", status: "pending", wave: 3, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
  { id: "disc-14", name: "Nova", domain: "Developer Experience", status: "pending", wave: 3, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "claude-sonnet-4-6", errorRate: 0, hasToolAccess: false },
  { id: "disc-15", name: "Orbit", domain: "Integration Platforms", status: "pending", wave: 3, tokensUsed: 0, tokenLimit: 200_000, findingsCount: 0, lastHeartbeat: null, model: "minimax-2.5", errorRate: 0, hasToolAccess: false },
];

const MOCK_FLAGS: SystemFlag[] = [
  {
    id: "brave-api-key",
    label: "Brave Search API Key",
    severity: "critical",
    detail: "Not configured — all 15 discovery agents will run blind (web search disabled). Must be set before Wave 1 fires at 10:00 AM MST.",
    resolved: false,
  },
  {
    id: "tool-reliability-pr",
    label: "Tool Reliability Layer (PR #68)",
    severity: "warning",
    detail: "Non-Anthropic tool-call validation not yet merged. MiniMax M2.5 / Grok 4 agents may hit unhandled errors. Merge before Wave 1.",
    resolved: false,
  },
  {
    id: "cost-tracking",
    label: "Per-Agent Cost Tracking",
    severity: "warning",
    detail: "No per-agent cost/SLO baselines. First run will produce spend data but no automated alerts if an agent overruns.",
    resolved: false,
  },
  {
    id: "digest-script",
    label: "Discovery Post-Run Digest",
    severity: "ok",
    detail: "scripts/discovery-digest.ts + cron doc in flight (Drew). Will aggregate findings after each wave and post to Slack.",
    resolved: false,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCountdown(targetIso: string): string {
  const now = Date.now();
  const target = new Date(targetIso).getTime();
  const diff = target - now;
  if (diff <= 0) return "NOW";
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1_000);
  if (h > 23) {
    const days = Math.floor(h / 24);
    const hrs = h % 24;
    return `${days}d ${hrs}h ${m}m`;
  }
  return `${h}h ${m}m ${s}s`;
}

function statusColor(status: AgentStatus): string {
  return {
    active: "text-emerald-400",
    idle: "text-zinc-400",
    failed: "text-red-400",
    pending: "text-amber-400",
    completed: "text-sky-400",
  }[status];
}

function statusDot(status: AgentStatus): string {
  return {
    active: "bg-emerald-400 animate-pulse",
    idle: "bg-zinc-500",
    failed: "bg-red-500",
    pending: "bg-amber-400",
    completed: "bg-sky-400",
  }[status];
}

function waveStatusBadge(status: WaveStatus): string {
  return {
    upcoming: "bg-zinc-700 text-zinc-300",
    active: "bg-emerald-900 text-emerald-300",
    completed: "bg-sky-900 text-sky-300",
  }[status];
}

function severityColor(s: SystemFlag["severity"]): string {
  return { critical: "text-red-400", warning: "text-amber-400", ok: "text-emerald-400" }[s];
}
function severityBg(s: SystemFlag["severity"]): string {
  return { critical: "bg-red-950 border-red-800", warning: "bg-amber-950 border-amber-800", ok: "bg-emerald-950 border-emerald-800" }[s];
}
function severityIcon(s: SystemFlag["severity"]): string {
  return { critical: "⛔", warning: "⚠️", ok: "✅" }[s];
}

// ─── Component ────────────────────────────────────────────────────────────────

const DiscoveryRunMonitor: React.FC = () => {
  const [agents] = useState<DiscoveryAgent[]>(MOCK_AGENTS);
  const [waves] = useState<DiscoveryWave[]>(MOCK_WAVES);
  const [flags] = useState<SystemFlag[]>(MOCK_FLAGS);
  const [tick, setTick] = useState(0);
  const [selectedWave, setSelectedWave] = useState<1 | 2 | 3 | "all">("all");
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  // Tick every second for countdown
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1_000);
    return () => clearInterval(id);
  }, []);

  const filteredAgents = useCallback(() => {
    if (selectedWave === "all") return agents;
    return agents.filter((a) => a.wave === selectedWave);
  }, [agents, selectedWave]);

  const totalFindings = agents.reduce((acc, a) => acc + a.findingsCount, 0);
  const criticalFlags = flags.filter((f) => f.severity === "critical" && !f.resolved).length;
  const warningFlags = flags.filter((f) => f.severity === "warning" && !f.resolved).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 font-mono">
      {/* ── Header ── */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔭</span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Discovery Run Monitor</h1>
            <span className="px-2 py-0.5 text-xs rounded-full bg-amber-900 text-amber-300 border border-amber-700">
              First Run — Feb 23, 2026
            </span>
          </div>
          <p className="text-sm text-zinc-400 ml-12">
            15 agents · 3 waves · 17 cron jobs · dgarson/clawdbot
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Wave 1 fires in</div>
          <div className="text-3xl font-bold text-amber-400 tabular-nums">
            {formatCountdown(MOCK_WAVES[0].scheduledAt)}
          </div>
        </div>
      </div>

      {/* ── System Flags ── */}
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">
          Pre-Flight Checklist
          {criticalFlags > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-red-900 text-red-300 rounded text-xs">
              {criticalFlags} CRITICAL
            </span>
          )}
          {warningFlags > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-amber-900 text-amber-300 rounded text-xs">
              {warningFlags} WARN
            </span>
          )}
        </h2>
        <div className="grid grid-cols-1 gap-2">
          {flags.map((flag) => (
            <div
              key={flag.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border text-sm",
                severityBg(flag.severity)
              )}
            >
              <span className="text-base leading-5 flex-shrink-0">{severityIcon(flag.severity)}</span>
              <div className="flex-1 min-w-0">
                <div className={cn("font-semibold mb-0.5", severityColor(flag.severity))}>
                  {flag.label}
                </div>
                <div className="text-zinc-400 text-xs leading-relaxed">{flag.detail}</div>
              </div>
              {flag.resolved && (
                <span className="px-2 py-0.5 bg-emerald-900 text-emerald-300 text-xs rounded flex-shrink-0">
                  RESOLVED
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Summary Stats ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Agents", value: "15", sub: "provisioned", color: "text-white" },
          { label: "Total Waves", value: "3", sub: "10AM · 2PM · 7PM MST", color: "text-sky-400" },
          { label: "Cron Jobs", value: "17", sub: "staggered", color: "text-violet-400" },
          { label: "Findings", value: totalFindings.toString(), sub: "accumulated", color: "text-emerald-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="text-xs uppercase tracking-widest text-zinc-500 mb-2">{stat.label}</div>
            <div className={cn("text-3xl font-bold tabular-nums", stat.color)}>{stat.value}</div>
            <div className="text-xs text-zinc-500 mt-1">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Wave Cards ── */}
      <div className="mb-6">
        <h2 className="text-xs uppercase tracking-widest text-zinc-500 mb-3">Waves</h2>
        <div className="grid grid-cols-3 gap-4">
          {waves.map((wave) => (
            <button
              key={wave.id}
              onClick={() => setSelectedWave(selectedWave === wave.id ? "all" : wave.id)}
              className={cn(
                "bg-zinc-900 border rounded-xl p-4 text-left transition-all",
                selectedWave === wave.id
                  ? "border-sky-500 ring-1 ring-sky-500/30"
                  : "border-zinc-800 hover:border-zinc-600"
              )}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm text-white">{wave.label}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", waveStatusBadge(wave.status))}>
                  {wave.status.toUpperCase()}
                </span>
              </div>
              <div className="text-xs text-zinc-400 mb-3">
                {new Date(wave.scheduledAt).toLocaleString("en-US", {
                  timeZone: "America/Denver",
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                  hour12: true,
                  timeZoneName: "short",
                })}
              </div>
              <div className="flex items-center gap-4 text-xs text-zinc-400">
                <span>👤 {wave.agentCount} agents</span>
                <span>⏰ {wave.cronJobs} crons</span>
              </div>
              {wave.status !== "upcoming" && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Progress</span>
                    <span>{wave.completedAgents}/{wave.agentCount}</span>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all"
                      style={{ width: `${(wave.completedAgents / wave.agentCount) * 100}%` }}
                    />
                  </div>
                </div>
              )}
              {wave.status === "upcoming" && (
                <div className="mt-3 text-xs text-amber-400 tabular-nums">
                  T− {formatCountdown(wave.scheduledAt)}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Agent Table ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs uppercase tracking-widest text-zinc-500">
            Agents
            {selectedWave !== "all" && (
              <span className="ml-2 text-sky-400">Wave {selectedWave}</span>
            )}
          </h2>
          <button
            onClick={() => setSelectedWave("all")}
            className={cn(
              "text-xs px-2 py-1 rounded transition-colors",
              selectedWave === "all"
                ? "bg-sky-900 text-sky-300"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            Show all
          </button>
        </div>

        <div className="space-y-2">
          {filteredAgents().map((agent) => (
            <div
              key={agent.id}
              className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden"
            >
              {/* Row */}
              <button
                className="w-full flex items-center gap-4 px-4 py-3 hover:bg-zinc-800/50 transition-colors text-left"
                onClick={() => setExpandedAgent(expandedAgent === agent.id ? null : agent.id)}
              >
                {/* Status dot */}
                <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDot(agent.status))} />

                {/* Name + domain */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-white">{agent.name}</span>
                    <span className="text-xs text-zinc-500">W{agent.wave}</span>
                    {!agent.hasToolAccess && (
                      <span className="text-xs px-1.5 py-0.5 bg-red-950 text-red-400 border border-red-800 rounded">
                        NO SEARCH
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 mt-0.5">{agent.domain}</div>
                </div>

                {/* Model */}
                <div className="text-xs text-zinc-500 hidden sm:block w-36 text-right truncate">
                  {agent.model}
                </div>

                {/* Token usage */}
                <div className="text-right w-32 hidden md:block">
                  <div className="text-xs text-zinc-400 mb-1">
                    {agent.tokensUsed.toLocaleString()} / {(agent.tokenLimit / 1000).toFixed(0)}k
                  </div>
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-violet-500 rounded-full"
                      style={{ width: `${Math.min((agent.tokensUsed / agent.tokenLimit) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Findings */}
                <div className="text-right w-20">
                  <div className="text-sm font-semibold text-emerald-400">{agent.findingsCount}</div>
                  <div className="text-xs text-zinc-500">findings</div>
                </div>

                {/* Status */}
                <div className={cn("text-xs font-medium w-20 text-right", statusColor(agent.status))}>
                  {agent.status.toUpperCase()}
                </div>

                {/* Expand chevron */}
                <span className="text-zinc-600 text-xs ml-1">
                  {expandedAgent === agent.id ? "▲" : "▼"}
                </span>
              </button>

              {/* Expanded detail */}
              {expandedAgent === agent.id && (
                <div className="border-t border-zinc-800 px-4 py-3 text-xs text-zinc-400 grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Agent ID</div>
                    <div className="font-mono text-zinc-300">{agent.id}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Model</div>
                    <div className="text-zinc-300">{agent.model}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Error Rate</div>
                    <div className={agent.errorRate > 0.02 ? "text-red-400" : "text-emerald-400"}>
                      {(agent.errorRate * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Last Heartbeat</div>
                    <div className="text-zinc-300">{agent.lastHeartbeat ?? "—"}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Web Search</div>
                    <div className={agent.hasToolAccess ? "text-emerald-400" : "text-red-400"}>
                      {agent.hasToolAccess ? "✓ Enabled" : "✗ Disabled (Brave key missing)"}
                    </div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Token Budget</div>
                    <div className="text-zinc-300">{(agent.tokenLimit / 1_000).toFixed(0)}k tokens</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Wave</div>
                    <div className="text-zinc-300">Wave {agent.wave}</div>
                  </div>
                  <div>
                    <div className="text-zinc-600 uppercase tracking-wider mb-1">Domain</div>
                    <div className="text-zinc-300">{agent.domain}</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ── */}
      <div className="mt-8 pt-4 border-t border-zinc-800 text-xs text-zinc-600 flex justify-between">
        <span>DiscoveryRunMonitor v1.0 — OpenClaw Horizon UI</span>
        <span className="tabular-nums">Live · tick={tick}</span>
      </div>
    </div>
  );
};

export default DiscoveryRunMonitor;

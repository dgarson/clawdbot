import React, { useState, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { Activity, Zap, Clock, MessageSquare, AlertTriangle, CheckCircle2, Circle, TrendingUp, Radio } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "error" | "sleeping" | "busy";

interface PulseAgent {
  id: string;
  name: string;
  emoji: string;
  status: AgentStatus;
  role: string;
  lastActivity: string;
  currentTask: string | null;
  messagesPerMin: number;
  tokensUsed: number;
  uptime: number; // seconds
  errorRate: number; // 0–1
  heartbeats: number[]; // last 20 activity values 0–100
  parent: string | null;
  children: string[];
  model: string;
}

interface ActivityEvent {
  id: string;
  agentId: string;
  agentName: string;
  agentEmoji: string;
  type: "message" | "tool_call" | "completion" | "error" | "spawn" | "heartbeat";
  description: string;
  timestamp: Date;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_AGENTS: PulseAgent[] = [
  {
    id: "xavier",
    name: "Xavier",
    emoji: "🎯",
    status: "active",
    role: "CTO",
    lastActivity: "2s ago",
    currentTask: "Reviewing architecture decisions",
    messagesPerMin: 2.4,
    tokensUsed: 142800,
    uptime: 14400,
    errorRate: 0.01,
    heartbeats: [20, 35, 45, 60, 55, 70, 80, 65, 75, 90, 85, 70, 60, 75, 80, 95, 88, 72, 65, 80],
    parent: null,
    children: ["luis", "roman", "claire"],
    model: "claude-opus-4-6",
  },
  {
    id: "luis",
    name: "Luis",
    emoji: "🎨",
    status: "busy",
    role: "Principal UX Engineer",
    lastActivity: "now",
    currentTask: "Building AgentPulseMonitor view",
    messagesPerMin: 5.1,
    tokensUsed: 89200,
    uptime: 7200,
    errorRate: 0,
    heartbeats: [60, 70, 80, 75, 85, 90, 95, 88, 92, 85, 90, 95, 98, 92, 88, 95, 100, 96, 94, 98],
    parent: "xavier",
    children: ["piper", "quinn", "reed"],
    model: "claude-sonnet-4-6",
  },
  {
    id: "roman",
    name: "Roman",
    emoji: "⚙️",
    status: "active",
    role: "Platform Core Lead",
    lastActivity: "18s ago",
    currentTask: "Optimizing Gateway RPC layer",
    messagesPerMin: 1.8,
    tokensUsed: 63400,
    uptime: 10800,
    errorRate: 0.02,
    heartbeats: [40, 50, 45, 60, 55, 65, 70, 60, 55, 70, 65, 72, 68, 75, 80, 70, 65, 78, 72, 68],
    parent: "xavier",
    children: ["sam"],
    model: "claude-sonnet-4-6",
  },
  {
    id: "claire",
    name: "Claire",
    emoji: "🔌",
    status: "idle",
    role: "Feature Dev Lead",
    lastActivity: "4m ago",
    currentTask: null,
    messagesPerMin: 0.2,
    tokensUsed: 41100,
    uptime: 10800,
    errorRate: 0,
    heartbeats: [30, 20, 25, 15, 20, 10, 5, 8, 12, 8, 5, 10, 8, 5, 3, 8, 5, 3, 5, 2],
    parent: "xavier",
    children: [],
    model: "claude-sonnet-4-6",
  },
  {
    id: "piper",
    name: "Piper",
    emoji: "🧩",
    status: "sleeping",
    role: "Component Architecture",
    lastActivity: "12m ago",
    currentTask: null,
    messagesPerMin: 0,
    tokensUsed: 22800,
    uptime: 3600,
    errorRate: 0,
    heartbeats: [80, 75, 60, 45, 30, 20, 10, 5, 8, 3, 2, 1, 0, 0, 1, 0, 0, 0, 0, 0],
    parent: "luis",
    children: [],
    model: "gemini-flash-3",
  },
  {
    id: "quinn",
    name: "Quinn",
    emoji: "🌊",
    status: "active",
    role: "State & Flows",
    lastActivity: "44s ago",
    currentTask: "Writing Toast component tests",
    messagesPerMin: 1.2,
    tokensUsed: 18900,
    uptime: 3600,
    errorRate: 0,
    heartbeats: [10, 20, 30, 45, 55, 60, 70, 65, 75, 80, 72, 78, 80, 75, 70, 72, 68, 74, 70, 65],
    parent: "luis",
    children: [],
    model: "gemini-flash-3",
  },
  {
    id: "reed",
    name: "Reed",
    emoji: "♿",
    status: "error",
    role: "Accessibility",
    lastActivity: "2m ago",
    currentTask: null,
    messagesPerMin: 0,
    tokensUsed: 8400,
    uptime: 1800,
    errorRate: 0.45,
    heartbeats: [65, 70, 75, 80, 82, 78, 85, 30, 10, 0, 5, 0, 0, 5, 3, 0, 0, 0, 0, 0],
    parent: "luis",
    children: [],
    model: "gemini-flash-3",
  },
  {
    id: "sam",
    name: "Sam",
    emoji: "🔗",
    status: "active",
    role: "API Integration",
    lastActivity: "8s ago",
    currentTask: "Testing WebSocket reconnect logic",
    messagesPerMin: 3.2,
    tokensUsed: 31200,
    uptime: 7200,
    errorRate: 0.03,
    heartbeats: [50, 60, 65, 70, 75, 80, 72, 78, 82, 80, 75, 80, 78, 82, 85, 80, 78, 82, 80, 76],
    parent: "roman",
    children: [],
    model: "claude-haiku-4-6",
  },
];

const MOCK_EVENTS: ActivityEvent[] = [
  { id: "e1", agentId: "luis", agentName: "Luis", agentEmoji: "🎨", type: "completion", description: "Built AgentPulseMonitor view — 0 TS errors", timestamp: new Date(Date.now() - 5000) },
  { id: "e2", agentId: "quinn", agentName: "Quinn", agentEmoji: "🌊", type: "tool_call", description: "Running vitest on Toast.tsx", timestamp: new Date(Date.now() - 48000) },
  { id: "e3", agentId: "sam", agentName: "Sam", agentEmoji: "🔗", type: "message", description: "Gateway ping/pong latency: 12ms", timestamp: new Date(Date.now() - 12000) },
  { id: "e4", agentId: "reed", agentName: "Reed", agentEmoji: "♿", type: "error", description: "Model token limit exceeded — task aborted", timestamp: new Date(Date.now() - 120000) },
  { id: "e5", agentId: "roman", agentName: "Roman", agentEmoji: "⚙️", type: "tool_call", description: "Profiling RPC handler latency", timestamp: new Date(Date.now() - 25000) },
  { id: "e6", agentId: "xavier", agentName: "Xavier", agentEmoji: "🎯", type: "message", description: "LGTM on PR #44 — tagging Tim for final review", timestamp: new Date(Date.now() - 8000) },
  { id: "e7", agentId: "piper", agentName: "Piper", agentEmoji: "🧩", type: "completion", description: "CommandPalette.tsx done — entered sleep mode", timestamp: new Date(Date.now() - 780000) },
  { id: "e8", agentId: "claire", agentName: "Claire", agentEmoji: "🔌", type: "heartbeat", description: "Heartbeat check — queue empty, standing by", timestamp: new Date(Date.now() - 240000) },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; bg: string; pulse: boolean; dot: string }> = {
  active:   { label: "Active",   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", pulse: true,  dot: "bg-emerald-400" },
  busy:     { label: "Busy",     color: "text-violet-400",  bg: "bg-violet-500/10 border-violet-500/30",   pulse: true,  dot: "bg-violet-400" },
  idle:     { label: "Idle",     color: "text-gray-400",    bg: "bg-gray-800/50 border-gray-700/30",       pulse: false, dot: "bg-gray-500" },
  sleeping: { label: "Sleeping", color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       pulse: false, dot: "bg-blue-400" },
  error:    { label: "Error",    color: "text-red-400",     bg: "bg-red-500/10 border-red-500/30",         pulse: true,  dot: "bg-red-400" },
};

const EVENT_ICONS: Record<ActivityEvent["type"], React.ReactNode> = {
  message:    <MessageSquare className="w-3 h-3 text-blue-400" aria-hidden="true" />,
  tool_call:  <Zap className="w-3 h-3 text-amber-400" aria-hidden="true" />,
  completion: <CheckCircle2 className="w-3 h-3 text-emerald-400" aria-hidden="true" />,
  error:      <AlertTriangle className="w-3 h-3 text-red-400" aria-hidden="true" />,
  spawn:      <Radio className="w-3 h-3 text-violet-400" aria-hidden="true" />,
  heartbeat:  <Activity className="w-3 h-3 text-gray-400" aria-hidden="true" />,
};

function formatUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) {return `${h}h ${m}m`;}
  return `${m}m`;
}

function formatTokens(n: number): string {
  if (n >= 1000000) {return `${(n / 1000000).toFixed(1)}M`;}
  if (n >= 1000) {return `${(n / 1000).toFixed(0)}K`;}
  return String(n);
}

function formatTimestamp(d: Date): string {
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) {return `${Math.floor(diff)}s ago`;}
  if (diff < 3600) {return `${Math.floor(diff / 60)}m ago`;}
  return `${Math.floor(diff / 3600)}h ago`;
}

// ─── Mini Sparkline ───────────────────────────────────────────────────────────

function Sparkline({ data, color = "#8b5cf6" }: { data: number[]; color?: string }) {
  const w = 80;
  const h = 24;
  const max = Math.max(...data, 1);
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={w} height={h} aria-hidden="true" className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.8"
      />
    </svg>
  );
}

// ─── Agent Card ───────────────────────────────────────────────────────────────

function AgentCard({ agent, selected, onClick }: { agent: PulseAgent; selected: boolean; onClick: () => void }) {
  const cfg = STATUS_CONFIG[agent.status];

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${agent.name} — ${cfg.label}${agent.currentTask ? `: ${agent.currentTask}` : ""}`}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
        selected
          ? "bg-violet-600/10 border-violet-500/50 shadow-lg shadow-violet-500/10"
          : cn("hover:border-gray-700", cfg.bg),
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="relative flex-shrink-0">
            <span className="text-2xl">{agent.emoji}</span>
            {/* Status dot */}
            <span
              className={cn(
                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-gray-950",
                cfg.dot,
                cfg.pulse && "animate-pulse",
              )}
            />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm truncate">{agent.name}</div>
            <div className="text-[10px] text-gray-500 truncate">{agent.role}</div>
          </div>
        </div>
        <span className={cn("text-[10px] font-semibold tracking-wide uppercase px-1.5 py-0.5 rounded flex-shrink-0", cfg.color)}>
          {cfg.label}
        </span>
      </div>

      {/* Current task */}
      <div className="text-xs text-gray-400 truncate mb-3 min-h-[1rem]">
        {agent.currentTask ?? <span className="text-gray-600 italic">No active task</span>}
      </div>

      {/* Sparkline + stats row */}
      <div className="flex items-center justify-between gap-2">
        <Sparkline
          data={agent.heartbeats}
          color={agent.status === "error" ? "#f87171" : agent.status === "busy" ? "#a78bfa" : "#34d399"}
        />
        <div className="text-right flex-shrink-0">
          <div className="text-xs font-mono text-gray-300">{formatTokens(agent.tokensUsed)}</div>
          <div className="text-[10px] text-gray-600">{formatUptime(agent.uptime)} up</div>
        </div>
      </div>

      {/* Model badge */}
      <div className="mt-2 text-[9px] font-mono text-gray-600 truncate">{agent.model}</div>
    </button>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function AgentDetailPanel({ agent, allAgents }: { agent: PulseAgent; allAgents: PulseAgent[] }) {
  const cfg = STATUS_CONFIG[agent.status];
  const parentAgent = agent.parent ? allAgents.find(a => a.id === agent.parent) : null;
  const childAgents = agent.children.map(id => allAgents.find(a => a.id === id)).filter(Boolean) as PulseAgent[];

  return (
    <div className="space-y-6" aria-label={`Details for ${agent.name}`}>
      {/* Identity */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-16 h-16 bg-gray-800 rounded-2xl flex items-center justify-center text-3xl">
            {agent.emoji}
          </div>
          <span className={cn("absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-gray-950", cfg.dot, cfg.pulse && "animate-pulse")} />
        </div>
        <div>
          <h2 className="text-xl font-bold">{agent.name}</h2>
          <div className="text-sm text-gray-400">{agent.role}</div>
          <div className={cn("text-xs font-semibold mt-1", cfg.color)}>{cfg.label}</div>
        </div>
      </div>

      {/* Current task */}
      {agent.currentTask && (
        <div className="p-3 rounded-xl bg-gray-800/50 border border-gray-700/50">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Current Task</div>
          <div className="text-sm text-gray-200">{agent.currentTask}</div>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Tokens Used",    value: formatTokens(agent.tokensUsed),             icon: <TrendingUp className="w-4 h-4 text-violet-400" aria-hidden="true" /> },
          { label: "Uptime",         value: formatUptime(agent.uptime),                  icon: <Clock className="w-4 h-4 text-emerald-400" aria-hidden="true" /> },
          { label: "Msg / min",      value: agent.messagesPerMin.toFixed(1),             icon: <MessageSquare className="w-4 h-4 text-blue-400" aria-hidden="true" /> },
          { label: "Error Rate",     value: `${(agent.errorRate * 100).toFixed(0)}%`,    icon: <AlertTriangle className="w-4 h-4 text-amber-400" aria-hidden="true" /> },
        ].map(stat => (
          <div key={stat.label} className="p-3 bg-gray-800/40 rounded-xl border border-gray-800">
            <div className="flex items-center gap-1.5 mb-1">{stat.icon}<div className="text-[10px] text-gray-500 uppercase tracking-wider">{stat.label}</div></div>
            <div className="text-lg font-bold font-mono text-gray-100">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Activity graph */}
      <div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Activity (last 20 ticks)</div>
        <div className="h-16 bg-gray-900 rounded-xl border border-gray-800 flex items-end gap-0.5 px-3 py-2 overflow-hidden">
          {agent.heartbeats.map((v, i) => (
            <div
              key={i}
              className="flex-1 rounded-sm transition-all"
              style={{
                height: `${Math.max(2, v)}%`,
                backgroundColor: agent.status === "error" ? "#f87171" : agent.status === "busy" ? "#a78bfa" : "#34d399",
                opacity: 0.4 + (i / agent.heartbeats.length) * 0.6,
              }}
            />
          ))}
        </div>
      </div>

      {/* Relationships */}
      {(parentAgent || childAgents.length > 0) && (
        <div>
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-2">Relationships</div>
          <div className="space-y-2">
            {parentAgent && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-500 text-xs">Reports to</span>
                <span className="text-lg">{parentAgent.emoji}</span>
                <span className="text-gray-300">{parentAgent.name}</span>
                <span className="text-xs text-gray-600">{parentAgent.role}</span>
              </div>
            )}
            {childAgents.length > 0 && (
              <div className="flex items-start gap-2 text-sm">
                <span className="text-gray-500 text-xs mt-0.5">Manages</span>
                <div className="flex flex-wrap gap-1.5">
                  {childAgents.map(c => (
                    <span key={c.id} className="flex items-center gap-1 px-2 py-0.5 bg-gray-800 rounded-full text-xs">
                      <span>{c.emoji}</span>
                      <span className="text-gray-300">{c.name}</span>
                      <span className={cn("w-1.5 h-1.5 rounded-full", STATUS_CONFIG[c.status].dot)} />
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Model */}
      <div className="p-3 bg-gray-900 rounded-xl border border-gray-800">
        <div className="text-[10px] text-gray-500 uppercase tracking-widest font-bold mb-1">Model</div>
        <div className="font-mono text-sm text-violet-300">{agent.model}</div>
      </div>

      <div className="text-[10px] text-gray-600">Last activity: {agent.lastActivity}</div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

export default function AgentPulseMonitor() {
  const [agents] = useState<PulseAgent[]>(MOCK_AGENTS);
  const [events, setEvents] = useState<ActivityEvent[]>(MOCK_EVENTS);
  const [selectedAgent, setSelectedAgent] = useState<PulseAgent | null>(agents[1] ?? null); // Luis selected by default
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [liveMode, setLiveMode] = useState(true);

  // Simulate live event stream
  useEffect(() => {
    if (!liveMode) {return;}

    const descriptions: Record<string, string[]> = {
      luis:  ["Committing a11y fixes", "Building new view", "Spawning sub-agent", "Running tsc --noEmit", "Reviewing PR diff"],
      quinn: ["Test passed", "Writing snapshot test", "Reviewing component API"],
      sam:   ["API handshake complete", "Retry #2 succeeded", "Latency: 8ms"],
      roman: ["Profiling hot path", "RPC benchmark: 420μs", "Cache hit ratio: 94%"],
      xavier: ["LGTM", "Routing to Tim", "Architecture note added"],
    };

    const interval = setInterval(() => {
      const agentIds = Object.keys(descriptions);
      const agentId = agentIds[Math.floor(Math.random() * agentIds.length)];
      const agent = agents.find(a => a.id === agentId);
      if (!agent) {return;}
      const descs = descriptions[agentId];
      const desc = descs[Math.floor(Math.random() * descs.length)];
      const types: ActivityEvent["type"][] = ["message", "tool_call", "completion"];
      const type = types[Math.floor(Math.random() * types.length)];

      setEvents(prev => [
        {
          id: `live-${Date.now()}`,
          agentId,
          agentName: agent.name,
          agentEmoji: agent.emoji,
          type,
          description: desc,
          timestamp: new Date(),
        },
        ...prev.slice(0, 49),
      ]);
    }, 3200);

    return () => clearInterval(interval);
  }, [liveMode, agents]);

  const filteredAgents = statusFilter === "all" ? agents : agents.filter(a => a.status === statusFilter);

  const statusCounts = agents.reduce<Record<string, number>>((acc, a) => {
    acc[a.status] = (acc[a.status] ?? 0) + 1;
    return acc;
  }, {});

  const handleSelectAgent = useCallback((agent: PulseAgent) => {
    setSelectedAgent(prev => prev?.id === agent.id ? null : agent);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-gray-800">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2.5 mb-1">
              <Activity className="w-5 h-5 text-violet-400" aria-hidden="true" />
              <h1 className="text-xl font-bold">Agent Pulse Monitor</h1>
              {liveMode && (
                <span className="flex items-center gap-1.5 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  LIVE
                </span>
              )}
            </div>
            <p className="text-sm text-gray-400">Mission control — real-time agent activity and health</p>
          </div>

          {/* Status summary + live toggle */}
          <div className="flex items-center gap-3 flex-wrap">
            {(["active", "busy", "idle", "sleeping", "error"] as AgentStatus[]).map(s => {
              const count = statusCounts[s] ?? 0;
              if (count === 0) {return null;}
              const cfg = STATUS_CONFIG[s];
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStatusFilter(prev => prev === s ? "all" : s)}
                  aria-pressed={statusFilter === s}
                  className={cn(
                    "flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                    statusFilter === s ? cn("font-bold", cfg.color, cfg.bg) : "text-gray-500 border-gray-800 hover:border-gray-700",
                  )}
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
                  {count} {cfg.label}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setLiveMode(m => !m)}
              aria-pressed={liveMode}
              className={cn(
                "flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                liveMode
                  ? "bg-violet-600/20 border-violet-500/40 text-violet-300 hover:bg-violet-600/30"
                  : "border-gray-700 text-gray-400 hover:border-gray-600",
              )}
            >
              <Radio className="w-3 h-3" aria-hidden="true" />
              {liveMode ? "Live" : "Paused"}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left: Agent grid */}
        <div className="w-64 lg:w-72 xl:w-80 flex-shrink-0 flex flex-col border-r border-gray-800 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-3 space-y-2" role="list" aria-label="Agent list">
            {filteredAgents.map(agent => (
              <div key={agent.id} role="listitem">
                <AgentCard
                  agent={agent}
                  selected={selectedAgent?.id === agent.id}
                  onClick={() => handleSelectAgent(agent)}
                />
              </div>
            ))}
            {filteredAgents.length === 0 && (
              <div className="text-center py-12 text-gray-600 text-sm">
                <Circle className="w-8 h-8 mx-auto mb-2 opacity-30" aria-hidden="true" />
                No agents with status "{statusFilter}"
              </div>
            )}
          </div>
        </div>

        {/* Center: Activity feed */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-3 border-b border-gray-800 flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Activity Feed</h2>
            <span className="text-[10px] text-gray-600">{events.length} events</span>
          </div>
          <div
            className="flex-1 overflow-y-auto p-4 space-y-1"
            role="log"
            aria-label="Agent activity feed"
            aria-live="polite"
            aria-atomic="false"
          >
            {events.map(ev => (
              <button
                key={ev.id}
                type="button"
                onClick={() => {
                  const agent = agents.find(a => a.id === ev.agentId);
                  if (agent) {handleSelectAgent(agent);}
                }}
                className="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-gray-800/50 transition-colors group text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                aria-label={`${ev.agentName}: ${ev.description}`}
              >
                <span className="mt-0.5 flex-shrink-0">{EVENT_ICONS[ev.type]}</span>
                <span className="text-lg flex-shrink-0 leading-none mt-0.5" aria-hidden="true">{ev.agentEmoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-gray-300 group-hover:text-white transition-colors">{ev.agentName}</span>
                    <span className="text-xs text-gray-500 truncate flex-1">{ev.description}</span>
                  </div>
                </div>
                <span className="text-[10px] text-gray-600 flex-shrink-0 font-mono">{formatTimestamp(ev.timestamp)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Detail panel */}
        {selectedAgent && (
          <div
            className="w-72 xl:w-80 flex-shrink-0 border-l border-gray-800 overflow-y-auto p-5"
            aria-label={`${selectedAgent.name} details`}
          >
            <AgentDetailPanel agent={selectedAgent} allAgents={agents} />
          </div>
        )}
      </div>
    </div>
  );
}

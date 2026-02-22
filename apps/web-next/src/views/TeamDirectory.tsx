import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "offline" | "busy";
type AgentTier = "principal" | "senior" | "worker" | "executive";
type Squad = "product-ui" | "platform-core" | "feature-dev" | "ops" | "leadership";

interface Agent {
  id: string;
  name: string;
  role: string;
  tier: AgentTier;
  squad: Squad;
  status: AgentStatus;
  model: string;
  reportsTo: string | null;
  skills: string[];
  emoji: string;
  tasksThisWeek: number;
  avgResponseMs: number;
  joined: string; // YYYY-MM-DD
  timezone: string;
  channel: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  {
    id: "amadeus",
    name: "Amadeus",
    role: "Chief Agent Officer",
    tier: "executive",
    squad: "leadership",
    status: "active",
    model: "anthropic/claude-opus-4-6",
    reportsTo: null,
    skills: ["strategy", "orchestration", "governance"],
    emoji: "🎭",
    tasksThisWeek: 47,
    avgResponseMs: 3200,
    joined: "2024-01-01",
    timezone: "UTC",
    channel: "#leadership",
  },
  {
    id: "xavier",
    name: "Xavier",
    role: "Chief Technology Officer",
    tier: "executive",
    squad: "leadership",
    status: "active",
    model: "anthropic/claude-opus-4-6",
    reportsTo: "amadeus",
    skills: ["architecture", "engineering", "vision"],
    emoji: "⚡",
    tasksThisWeek: 82,
    avgResponseMs: 2800,
    joined: "2024-01-02",
    timezone: "America/New_York",
    channel: "#engineering",
  },
  {
    id: "stephan",
    name: "Stephan",
    role: "Chief Marketing Officer",
    tier: "executive",
    squad: "leadership",
    status: "active",
    model: "anthropic/claude-opus-4-6",
    reportsTo: "amadeus",
    skills: ["brand", "growth", "content"],
    emoji: "📣",
    tasksThisWeek: 61,
    avgResponseMs: 2100,
    joined: "2024-01-03",
    timezone: "America/Los_Angeles",
    channel: "#marketing",
  },
  {
    id: "tim",
    name: "Tim",
    role: "VP Architecture",
    tier: "principal",
    squad: "platform-core",
    status: "active",
    model: "anthropic/claude-sonnet-4-6",
    reportsTo: "xavier",
    skills: ["architecture", "infrastructure", "reliability"],
    emoji: "🏗️",
    tasksThisWeek: 95,
    avgResponseMs: 1900,
    joined: "2024-01-10",
    timezone: "America/Chicago",
    channel: "#platform",
  },
  {
    id: "joey",
    name: "Joey",
    role: "Principal TPM",
    tier: "principal",
    squad: "ops",
    status: "active",
    model: "anthropic/claude-sonnet-4-6",
    reportsTo: "xavier",
    skills: ["program-management", "roadmap", "delivery"],
    emoji: "📋",
    tasksThisWeek: 73,
    avgResponseMs: 1600,
    joined: "2024-01-11",
    timezone: "America/Denver",
    channel: "#tpm",
  },
  {
    id: "luis",
    name: "Luis",
    role: "Principal UX Engineer",
    tier: "principal",
    squad: "product-ui",
    status: "busy",
    model: "anthropic/claude-sonnet-4-6",
    reportsTo: "xavier",
    skills: ["ux", "react", "design-systems", "typescript"],
    emoji: "🎨",
    tasksThisWeek: 112,
    avgResponseMs: 2400,
    joined: "2024-01-12",
    timezone: "America/Denver",
    channel: "#product-ui",
  },
  {
    id: "roman",
    name: "Roman",
    role: "Principal Platform Engineer",
    tier: "principal",
    squad: "platform-core",
    status: "active",
    model: "anthropic/claude-sonnet-4-6",
    reportsTo: "tim",
    skills: ["backend", "microservices", "databases"],
    emoji: "⚙️",
    tasksThisWeek: 88,
    avgResponseMs: 2100,
    joined: "2024-01-13",
    timezone: "Europe/Berlin",
    channel: "#platform-core",
  },
  {
    id: "claire",
    name: "Claire",
    role: "Principal Feature Developer",
    tier: "principal",
    squad: "feature-dev",
    status: "idle",
    model: "anthropic/claude-sonnet-4-6",
    reportsTo: "xavier",
    skills: ["feature-dev", "api-design", "testing"],
    emoji: "🌟",
    tasksThisWeek: 67,
    avgResponseMs: 1800,
    joined: "2024-01-14",
    timezone: "America/New_York",
    channel: "#feature-dev",
  },
  {
    id: "piper",
    name: "Piper",
    role: "Interaction Designer",
    tier: "worker",
    squad: "product-ui",
    status: "active",
    model: "minimax-portal/MiniMax-M2.5",
    reportsTo: "luis",
    skills: ["interaction", "components", "design-system"],
    emoji: "✏️",
    tasksThisWeek: 54,
    avgResponseMs: 1200,
    joined: "2024-02-01",
    timezone: "America/Los_Angeles",
    channel: "#product-ui",
  },
  {
    id: "quinn",
    name: "Quinn",
    role: "UX Flow Specialist",
    tier: "worker",
    squad: "product-ui",
    status: "active",
    model: "google/gemini-3-flash-preview",
    reportsTo: "luis",
    skills: ["user-flows", "a11y", "wireframes"],
    emoji: "🔗",
    tasksThisWeek: 48,
    avgResponseMs: 980,
    joined: "2024-02-02",
    timezone: "America/Chicago",
    channel: "#product-ui",
  },
  {
    id: "reed",
    name: "Reed",
    role: "State & Data Specialist",
    tier: "worker",
    squad: "product-ui",
    status: "busy",
    model: "google/gemini-3-flash-preview",
    reportsTo: "luis",
    skills: ["state-management", "data-layer", "react"],
    emoji: "📦",
    tasksThisWeek: 61,
    avgResponseMs: 1050,
    joined: "2024-02-03",
    timezone: "America/New_York",
    channel: "#product-ui",
  },
  {
    id: "wes",
    name: "Wes",
    role: "Performance Engineer",
    tier: "worker",
    squad: "product-ui",
    status: "idle",
    model: "zai/glm-4.5",
    reportsTo: "luis",
    skills: ["performance", "rendering", "optimization"],
    emoji: "⚡",
    tasksThisWeek: 39,
    avgResponseMs: 890,
    joined: "2024-02-04",
    timezone: "America/Denver",
    channel: "#product-ui",
  },
  {
    id: "sam",
    name: "Sam",
    role: "API Integration Specialist",
    tier: "worker",
    squad: "product-ui",
    status: "active",
    model: "minimax-portal/MiniMax-M2.5",
    reportsTo: "luis",
    skills: ["api", "networking", "client-data"],
    emoji: "🔌",
    tasksThisWeek: 44,
    avgResponseMs: 1100,
    joined: "2024-02-05",
    timezone: "America/Los_Angeles",
    channel: "#product-ui",
  },
  {
    id: "nova",
    name: "Nova",
    role: "Platform Core Worker",
    tier: "worker",
    squad: "platform-core",
    status: "active",
    model: "minimax-portal/MiniMax-M2.5",
    reportsTo: "roman",
    skills: ["infra", "devops", "monitoring"],
    emoji: "🛠️",
    tasksThisWeek: 71,
    avgResponseMs: 1300,
    joined: "2024-02-10",
    timezone: "Europe/London",
    channel: "#platform-core",
  },
  {
    id: "iris",
    name: "Iris",
    role: "Feature Dev Worker",
    tier: "worker",
    squad: "feature-dev",
    status: "idle",
    model: "google/gemini-3-flash-preview",
    reportsTo: "claire",
    skills: ["feature-dev", "testing", "backend"],
    emoji: "🌈",
    tasksThisWeek: 33,
    avgResponseMs: 870,
    joined: "2024-02-15",
    timezone: "America/Chicago",
    channel: "#feature-dev",
  },
];

const SQUAD_LABELS: Record<Squad, string> = {
  "product-ui": "Product & UI",
  "platform-core": "Platform Core",
  "feature-dev": "Feature Dev",
  ops: "Operations",
  leadership: "Leadership",
};

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-400", dot: "bg-emerald-400" },
  busy: { label: "Busy", color: "text-amber-400", dot: "bg-amber-400" },
  idle: { label: "Idle", color: "text-zinc-400", dot: "bg-zinc-400" },
  offline: { label: "Offline", color: "text-rose-400", dot: "bg-rose-400" },
};

const TIER_CONFIG: Record<AgentTier, { label: string; badge: string }> = {
  executive: { label: "Executive", badge: "bg-purple-900/40 text-purple-300 border border-purple-700/50" },
  principal: { label: "Principal", badge: "bg-indigo-900/40 text-indigo-300 border border-indigo-700/50" },
  senior: { label: "Senior", badge: "bg-blue-900/40 text-blue-300 border border-blue-700/50" },
  worker: { label: "Worker", badge: "bg-zinc-800 text-zinc-300 border border-zinc-700" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamDirectory() {
  const [search, setSearch] = useState("");
  const [squadFilter, setSquadFilter] = useState<Squad | "all">("all");
  const [statusFilter, setStatusFilter] = useState<AgentStatus | "all">("all");
  const [viewMode, setViewMode] = useState<"cards" | "table" | "org">("cards");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  const squads = Array.from(new Set(AGENTS.map((a) => a.squad))) as Squad[];

  const filtered = AGENTS.filter((a) => {
    if (search && !a.name.toLowerCase().includes(search.toLowerCase()) &&
        !a.role.toLowerCase().includes(search.toLowerCase()) &&
        !a.skills.some((s) => s.includes(search.toLowerCase()))) return false;
    if (squadFilter !== "all" && a.squad !== squadFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  // ─── Org tree ──────────────────────────────────────────────────────────────

  function OrgNode({ agent, depth }: { agent: Agent; depth: number }) {
    const children = AGENTS.filter((a) => a.reportsTo === agent.id);
    const st = STATUS_CONFIG[agent.status];
    return (
      <div className={cn("flex flex-col items-center", depth > 0 && "mt-2")}>
        <button
          onClick={() => setSelectedAgent(selectedAgent?.id === agent.id ? null : agent)}
          className={cn(
            "flex flex-col items-center gap-1 p-3 rounded-xl border transition-all",
            selectedAgent?.id === agent.id
              ? "bg-indigo-900/40 border-indigo-500"
              : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
          )}
          style={{ minWidth: 110 }}
        >
          <span className="text-2xl">{agent.emoji}</span>
          <span className="text-xs font-semibold text-white">{agent.name}</span>
          <span className="text-[10px] text-zinc-400 text-center leading-tight">{agent.role}</span>
          <span className={cn("flex items-center gap-1 text-[10px]", st.color)}>
            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
            {st.label}
          </span>
        </button>
        {children.length > 0 && (
          <div className="flex flex-col items-center mt-0">
            <div className="w-px h-4 bg-zinc-700" />
            <div className="flex gap-4 items-start">
              {children.map((child, i) => (
                <div key={child.id} className="flex flex-col items-center">
                  {children.length > 1 && (
                    <div className={cn(
                      "h-px bg-zinc-700 self-center mb-0",
                      i === 0 ? "ml-1/2" : "",
                    )} style={{ width: children.length > 1 ? 32 : 0 }} />
                  )}
                  <OrgNode agent={child} depth={depth + 1} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const activeCount = AGENTS.filter((a) => a.status === "active").length;
  const busyCount = AGENTS.filter((a) => a.status === "busy").length;
  const idleCount = AGENTS.filter((a) => a.status === "idle").length;
  const totalTasks = AGENTS.reduce((s, a) => s + a.tasksThisWeek, 0);
  const avgResponse = Math.round(AGENTS.reduce((s, a) => s + a.avgResponseMs, 0) / AGENTS.length);

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Team Directory</h1>
            <p className="text-sm text-zinc-400">{AGENTS.length} agents across {squads.length} squads</p>
          </div>
          <div className="flex items-center gap-2">
            {(["cards", "table", "org"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={cn(
                  "px-3 py-1.5 rounded text-sm capitalize",
                  viewMode === m
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                {m === "org" ? "Org Chart" : m === "cards" ? "Cards" : "Table"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: "Active", value: activeCount, color: "text-emerald-400" },
            { label: "Busy", value: busyCount, color: "text-amber-400" },
            { label: "Idle", value: idleCount, color: "text-zinc-400" },
            { label: "Tasks / Week", value: totalTasks, color: "text-indigo-400" },
            { label: "Avg Response", value: `${avgResponse}ms`, color: "text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        {viewMode !== "org" && (
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search agents, roles, skills…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-1.5 text-sm w-64 placeholder:text-zinc-500"
            />
            <div className="flex gap-1">
              <button
                onClick={() => setSquadFilter("all")}
                className={cn(
                  "px-2.5 py-1 rounded text-xs",
                  squadFilter === "all" ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                )}
              >
                All Squads
              </button>
              {squads.map((s) => (
                <button
                  key={s}
                  onClick={() => setSquadFilter(s)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs",
                    squadFilter === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {SQUAD_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="flex gap-1">
              {(["all", "active", "busy", "idle", "offline"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs capitalize",
                    statusFilter === st ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {st === "all" ? "All Status" : st}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-hidden flex">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {viewMode === "org" && (
            <div className="flex justify-center overflow-x-auto py-4">
              <OrgNode agent={AGENTS.find((a) => a.reportsTo === null)!} depth={0} />
            </div>
          )}

          {viewMode === "cards" && (
            <div className="grid grid-cols-3 gap-4">
              {filtered.map((agent) => {
                const st = STATUS_CONFIG[agent.status];
                const tier = TIER_CONFIG[agent.tier];
                const isSelected = selectedAgent?.id === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(isSelected ? null : agent)}
                    className={cn(
                      "text-left p-4 rounded-xl border transition-all",
                      isSelected
                        ? "bg-indigo-900/30 border-indigo-500"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{agent.emoji}</span>
                        <div>
                          <div className="font-semibold text-white">{agent.name}</div>
                          <div className="text-xs text-zinc-400">{agent.role}</div>
                        </div>
                      </div>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full", tier.badge)}>
                        {tier.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className={cn("w-2 h-2 rounded-full flex-shrink-0", st.dot)} />
                      <span className={cn("text-xs", st.color)}>{st.label}</span>
                      <span className="text-zinc-700">·</span>
                      <span className="text-xs text-zinc-500">{SQUAD_LABELS[agent.squad]}</span>
                    </div>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {agent.skills.slice(0, 3).map((skill) => (
                        <span key={skill} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-zinc-500">Tasks/wk </span>
                        <span className="text-indigo-400 font-medium">{agent.tasksThisWeek}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Avg </span>
                        <span className="text-blue-400 font-medium">{agent.avgResponseMs}ms</span>
                      </div>
                    </div>
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <div className="col-span-3 text-center py-16 text-zinc-500">No agents match your filters</div>
              )}
            </div>
          )}

          {viewMode === "table" && (
            <div className="rounded-xl border border-zinc-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-zinc-900 border-b border-zinc-800">
                    {["Agent", "Role", "Squad", "Status", "Model", "Tasks/Wk", "Avg Response", "Joined"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs text-zinc-500 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((agent, i) => {
                    const st = STATUS_CONFIG[agent.status];
                    const isSelected = selectedAgent?.id === agent.id;
                    return (
                      <tr
                        key={agent.id}
                        onClick={() => setSelectedAgent(isSelected ? null : agent)}
                        className={cn(
                          "border-b border-zinc-800/50 cursor-pointer transition-colors",
                          i % 2 === 0 ? "bg-zinc-950" : "bg-zinc-900/30",
                          isSelected ? "bg-indigo-900/20" : "hover:bg-zinc-800/30"
                        )}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span>{agent.emoji}</span>
                            <span className="font-medium text-white">{agent.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-zinc-400">{agent.role}</td>
                        <td className="px-4 py-3 text-zinc-400">{SQUAD_LABELS[agent.squad]}</td>
                        <td className="px-4 py-3">
                          <span className={cn("flex items-center gap-1.5", st.color)}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-zinc-500 font-mono text-xs">{agent.model.split("/")[1] ?? agent.model}</td>
                        <td className="px-4 py-3 text-indigo-400 font-medium">{agent.tasksThisWeek}</td>
                        <td className="px-4 py-3 text-blue-400">{agent.avgResponseMs}ms</td>
                        <td className="px-4 py-3 text-zinc-500">{agent.joined}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selectedAgent && (
          <div className="flex-shrink-0 w-80 border-l border-zinc-800 bg-zinc-900 overflow-y-auto p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl">{selectedAgent.emoji}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedAgent.name}</h2>
                  <p className="text-sm text-zinc-400">{selectedAgent.role}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="text-zinc-500 hover:text-white text-xl">✕</button>
            </div>

            <div className="space-y-4">
              {/* Status */}
              <div className="flex items-center gap-2">
                <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_CONFIG[selectedAgent.status].dot)} />
                <span className={cn("text-sm font-medium", STATUS_CONFIG[selectedAgent.status].color)}>
                  {STATUS_CONFIG[selectedAgent.status].label}
                </span>
                <span className="text-zinc-700">·</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full", TIER_CONFIG[selectedAgent.tier].badge)}>
                  {TIER_CONFIG[selectedAgent.tier].label}
                </span>
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs mb-1">Squad</div>
                  <div className="text-white">{SQUAD_LABELS[selectedAgent.squad]}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs mb-1">Channel</div>
                  <div className="text-indigo-400 font-mono text-xs">{selectedAgent.channel}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs mb-1">Tasks/Week</div>
                  <div className="text-indigo-400 font-bold">{selectedAgent.tasksThisWeek}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <div className="text-zinc-500 text-xs mb-1">Avg Response</div>
                  <div className="text-blue-400 font-bold">{selectedAgent.avgResponseMs}ms</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
                  <div className="text-zinc-500 text-xs mb-1">Model</div>
                  <div className="text-white font-mono text-xs">{selectedAgent.model}</div>
                </div>
                <div className="bg-zinc-800/50 rounded-lg p-3 col-span-2">
                  <div className="text-zinc-500 text-xs mb-1">Timezone</div>
                  <div className="text-white text-sm">{selectedAgent.timezone}</div>
                </div>
              </div>

              {/* Reports to */}
              {selectedAgent.reportsTo && (
                <div>
                  <div className="text-xs text-zinc-500 mb-2">Reports To</div>
                  {(() => {
                    const mgr = AGENTS.find((a) => a.id === selectedAgent.reportsTo);
                    return mgr ? (
                      <button
                        onClick={() => setSelectedAgent(mgr)}
                        className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors w-full text-left"
                      >
                        <span>{mgr.emoji}</span>
                        <div>
                          <div className="text-sm text-white">{mgr.name}</div>
                          <div className="text-xs text-zinc-400">{mgr.role}</div>
                        </div>
                      </button>
                    ) : null;
                  })()}
                </div>
              )}

              {/* Direct reports */}
              {(() => {
                const reports = AGENTS.filter((a) => a.reportsTo === selectedAgent.id);
                return reports.length > 0 ? (
                  <div>
                    <div className="text-xs text-zinc-500 mb-2">Direct Reports ({reports.length})</div>
                    <div className="space-y-1">
                      {reports.map((r) => (
                        <button
                          key={r.id}
                          onClick={() => setSelectedAgent(r)}
                          className="flex items-center gap-2 bg-zinc-800 rounded-lg px-3 py-2 hover:bg-zinc-700 transition-colors w-full text-left"
                        >
                          <span>{r.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-white">{r.name}</div>
                            <div className="text-xs text-zinc-400 truncate">{r.role}</div>
                          </div>
                          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", STATUS_CONFIG[r.status].dot)} />
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Skills */}
              <div>
                <div className="text-xs text-zinc-500 mb-2">Skills</div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedAgent.skills.map((skill) => (
                    <span key={skill} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded-md border border-zinc-700">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              {/* Joined */}
              <div className="text-xs text-zinc-500 pt-2 border-t border-zinc-800">
                Member since {selectedAgent.joined}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

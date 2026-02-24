import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "busy";
type TabId = "graph" | "matrix" | "feed" | "analytics";
type ActionType = "spawned" | "shared_context" | "delegated" | "collaborated";

interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: AgentStatus;
  squad: string;
}

interface CollaborationStat {
  agentId: string;
  sessions: number;
  messages: number;
  tasks: number;
}

interface ActivityEvent {
  id: string;
  timestamp: string;
  agentFrom: string;
  agentTo: string;
  action: ActionType;
  description: string;
  sessionId: string;
}

interface NodePosition {
  x: number;
  y: number;
}

// ─── Static Data ───────────────────────────────────────────────────────────────

const AGENTS: Agent[] = [
  { id: "luis",  name: "Luis",  emoji: "🎨", role: "Principal UX Engineer",  status: "active", squad: "Product & UI" },
  { id: "piper", name: "Piper", emoji: "🔧", role: "Component Architecture",  status: "active", squad: "Product & UI" },
  { id: "quinn", name: "Quinn", emoji: "⚡", role: "State Management",        status: "busy",   squad: "Product & UI" },
  { id: "reed",  name: "Reed",  emoji: "♿", role: "Accessibility",           status: "active", squad: "Product & UI" },
  { id: "wes",   name: "Wes",   emoji: "🚀", role: "Performance",             status: "idle",   squad: "Product & UI" },
  { id: "sam",   name: "Sam",   emoji: "🌐", role: "Animation",               status: "active", squad: "Product & UI" },
  { id: "xavier",name: "Xavier",emoji: "🏗️", role: "CTO",                     status: "active", squad: "Leadership"   },
  { id: "tim",   name: "Tim",   emoji: "⚙️", role: "VP Architecture",         status: "busy",   squad: "Platform"     },
];

// Interaction counts [row=from][col=to] — agents in order above
const MATRIX_DATA: number[][] = [
  [0,  47, 38, 29, 31, 22, 55, 18],
  [47,  0, 34, 41, 28, 19, 22, 12],
  [38, 34,  0, 25, 33, 27, 15,  9],
  [29, 41, 25,  0, 22, 18, 11,  7],
  [31, 28, 33, 22,  0, 24, 14,  8],
  [22, 19, 27, 18, 24,  0, 10,  6],
  [55, 22, 15, 11, 14, 10,  0, 42],
  [18, 12,  9,  7,  8,  6, 42,  0],
];

const ACTIVITY_EVENTS: ActivityEvent[] = [
  { id: "1",  timestamp: "2 min ago",  agentFrom: "luis",  agentTo: "quinn",  action: "spawned",       description: "Spawned subagent for AgentCollaborationGraph component build", sessionId: "sess_a1b2c3" },
  { id: "2",  timestamp: "8 min ago",  agentFrom: "xavier",agentTo: "luis",   action: "delegated",     description: "Delegated Horizon dashboard view suite to Product & UI squad",  sessionId: "sess_d4e5f6" },
  { id: "3",  timestamp: "15 min ago", agentFrom: "piper", agentTo: "reed",   action: "shared_context",description: "Shared design system tokens and component spec documents",        sessionId: "sess_g7h8i9" },
  { id: "4",  timestamp: "22 min ago", agentFrom: "luis",  agentTo: "piper",  action: "collaborated",  description: "Co-reviewed NavigationSidebar component architecture patterns",   sessionId: "sess_j1k2l3" },
  { id: "5",  timestamp: "31 min ago", agentFrom: "tim",   agentTo: "xavier", action: "shared_context",description: "Shared frontend architecture constraints for dashboard layer",    sessionId: "sess_m4n5o6" },
  { id: "6",  timestamp: "45 min ago", agentFrom: "quinn", agentTo: "wes",    action: "collaborated",  description: "Optimized state management patterns for performance-heavy views", sessionId: "sess_p7q8r9" },
  { id: "7",  timestamp: "1 hr ago",   agentFrom: "sam",   agentTo: "piper",  action: "delegated",     description: "Delegated animation token definitions to component system layer",  sessionId: "sess_s1t2u3" },
  { id: "8",  timestamp: "1.5 hr ago", agentFrom: "xavier",agentTo: "tim",    action: "spawned",       description: "Spawned architecture review subagent for megabranch merge prep",  sessionId: "sess_v4w5x6" },
  { id: "9",  timestamp: "2 hr ago",   agentFrom: "reed",  agentTo: "quinn",  action: "shared_context",description: "Shared accessibility audit results for interactive state components", sessionId: "sess_y7z8a9" },
  { id: "10", timestamp: "2.5 hr ago", agentFrom: "wes",   agentTo: "luis",   action: "collaborated",  description: "Performance profiling review for dashboard render bottlenecks",    sessionId: "sess_b1c2d3" },
  { id: "11", timestamp: "3 hr ago",   agentFrom: "luis",  agentTo: "xavier", action: "delegated",     description: "Escalated product direction question for onboarding flow redesign",sessionId: "sess_e4f5g6" },
  { id: "12", timestamp: "4 hr ago",   agentFrom: "piper", agentTo: "wes",    action: "spawned",       description: "Spawned performance audit subagent for component library bundle",  sessionId: "sess_h7i8j9" },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getAgent(id: string): Agent {
  return AGENTS.find(a => a.id === id) ?? AGENTS[0];
}

function statusDotClass(status: AgentStatus): string {
  if (status === "active") {return "bg-emerald-400";}
  if (status === "busy")   {return "bg-amber-400";}
  return "bg-[var(--color-surface-3)]";
}

function actionBadgeClass(action: ActionType): string {
  if (action === "spawned")       {return "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30";}
  if (action === "shared_context"){return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";}
  if (action === "delegated")     {return "bg-amber-500/20 text-amber-400 border border-amber-500/30";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)]";
}

function actionLabel(action: ActionType): string {
  if (action === "spawned")        {return "Spawned";}
  if (action === "shared_context") {return "Shared Context";}
  if (action === "delegated")      {return "Delegated";}
  return "Collaborated";
}

function intensityClass(value: number, max: number): string {
  if (value === 0) {return "bg-[var(--color-surface-1)]";}
  const ratio = value / max;
  if (ratio < 0.2) {return "bg-indigo-950";}
  if (ratio < 0.4) {return "bg-indigo-900";}
  if (ratio < 0.6) {return "bg-indigo-800";}
  if (ratio < 0.8) {return "bg-indigo-700";}
  return "bg-indigo-600";
}

function getCirclePositions(count: number, radius: number, cx: number, cy: number): NodePosition[] {
  const positions: NodePosition[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    positions.push({
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
    });
  }
  return positions;
}

function getCollabStats(agentId: string): CollaborationStat[] {
  const idx = AGENTS.findIndex(a => a.id === agentId);
  if (idx < 0) {return [];}
  return AGENTS
    .map((a, i) => ({
      agentId: a.id,
      sessions: MATRIX_DATA[idx][i],
      messages: MATRIX_DATA[idx][i] * 14,
      tasks: Math.floor(MATRIX_DATA[idx][i] / 5),
    }))
    .filter(s => s.agentId !== agentId && s.sessions > 0)
    .toSorted((a, b) => b.sessions - a.sessions);
}

// ─── Connection Line ───────────────────────────────────────────────────────────

interface ConnectionLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  intensity: number;
  maxIntensity: number;
  active: boolean;
}

function ConnectionLine({ x1, y1, x2, y2, intensity, maxIntensity, active }: ConnectionLineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const ratio = intensity / maxIntensity;
  const opacity = active ? 1 : Math.max(0.12, ratio * 0.55);
  const thickness = active ? 2 : Math.max(1, Math.round(ratio * 3));
  const bgColor = active
    ? "rgba(99,102,241,1)"
    : `rgba(99,102,241,${opacity})`;

  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1,
        width: length,
        height: thickness,
        backgroundColor: bgColor,
        transformOrigin: "0 50%",
        transform: `rotate(${angle}deg)`,
        pointerEvents: "none",
        transition: "all 0.2s ease",
      }}
    />
  );
}

// ─── Agent Node ────────────────────────────────────────────────────────────────

interface AgentNodeProps {
  agent: Agent;
  x: number;
  y: number;
  selected: boolean;
  highlighted: boolean;
  onClick: () => void;
}

function AgentNode({ agent, x, y, selected, highlighted, onClick }: AgentNodeProps) {
  const nodeSize = 72;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: x - nodeSize / 2,
        top: y - nodeSize / 2,
        width: nodeSize,
        height: nodeSize,
        cursor: "pointer",
        zIndex: selected || highlighted ? 10 : 5,
      }}
      className={cn(
        "rounded-xl border transition-all duration-200 flex flex-col items-center justify-center gap-0.5",
        selected
          ? "border-indigo-500 bg-indigo-900/60 shadow-lg shadow-indigo-500/30"
          : highlighted
          ? "border-[var(--color-surface-3)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)]"
      )}
    >
      <span className="text-xl leading-none">{agent.emoji}</span>
      <span className={cn("text-xs font-semibold leading-none", selected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]")}>
        {agent.name}
      </span>
      <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", statusDotClass(agent.status))} />
    </div>
  );
}

// ─── Graph View ────────────────────────────────────────────────────────────────

function GraphView() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  const containerW = 560;
  const containerH = 420;
  const cx = containerW / 2;
  const cy = containerH / 2;
  const radius = 160;

  const positions = getCirclePositions(AGENTS.length, radius, cx, cy);
  const maxInteraction = Math.max(...MATRIX_DATA.flat().filter(v => v > 0));

  const selectedIdx = selectedAgent ? AGENTS.findIndex(a => a.id === selectedAgent) : -1;
  const stats = selectedAgent ? getCollabStats(selectedAgent) : [];

  const connections: { i: number; j: number; value: number }[] = [];
  if (selectedIdx >= 0) {
    for (let j = 0; j < AGENTS.length; j++) {
      if (j !== selectedIdx && MATRIX_DATA[selectedIdx][j] > 0) {
        connections.push({ i: selectedIdx, j, value: MATRIX_DATA[selectedIdx][j] });
      }
    }
  } else {
    for (let i = 0; i < AGENTS.length; i++) {
      for (let j = i + 1; j < AGENTS.length; j++) {
        if (MATRIX_DATA[i][j] > 0) {
          connections.push({ i, j, value: MATRIX_DATA[i][j] });
        }
      }
    }
  }

  const highlightedIds = selectedAgent
    ? new Set(stats.slice(0, 4).map(s => s.agentId))
    : new Set<string>();

  const selectedAgentObj = selectedAgent ? getAgent(selectedAgent) : null;
  const topStat = stats[0];

  return (
    <div className="flex gap-4">
      {/* Canvas */}
      <div
        className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] overflow-hidden flex-shrink-0"
        style={{ width: containerW, height: containerH }}
      >
        {connections.map(({ i, j, value }) => (
          <ConnectionLine
            key={`${i}-${j}`}
            x1={positions[i].x}
            y1={positions[i].y}
            x2={positions[j].x}
            y2={positions[j].y}
            intensity={value}
            maxIntensity={maxInteraction}
            active={selectedIdx >= 0}
          />
        ))}
        {AGENTS.map((agent, i) => (
          <AgentNode
            key={agent.id}
            agent={agent}
            x={positions[i].x}
            y={positions[i].y}
            selected={selectedAgent === agent.id}
            highlighted={highlightedIds.has(agent.id)}
            onClick={() => setSelectedAgent(selectedAgent === agent.id ? null : agent.id)}
          />
        ))}
        {!selectedAgent && (
          <div
            style={{ position: "absolute", left: cx - 48, top: cy - 20, width: 96 }}
            className="text-center pointer-events-none"
          >
            <div className="text-[var(--color-text-muted)] text-xs">Click a node</div>
            <div className="text-[var(--color-text-muted)] text-xs">to explore</div>
          </div>
        )}
      </div>

      {/* Side panel */}
      <div className="flex-1 min-w-0">
        {selectedAgentObj ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-2xl">{selectedAgentObj.emoji}</span>
                <div>
                  <div className="text-[var(--color-text-primary)] font-semibold">{selectedAgentObj.name}</div>
                  <div className="text-[var(--color-text-secondary)] text-xs">{selectedAgentObj.role}</div>
                  <div className="text-[var(--color-text-muted)] text-xs">{selectedAgentObj.squad}</div>
                </div>
                <div className={cn("ml-auto w-2 h-2 rounded-full", statusDotClass(selectedAgentObj.status))} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                  <div className="text-indigo-400 font-bold text-lg">
                    {MATRIX_DATA[selectedIdx].reduce((a, b) => a + b, 0)}
                  </div>
                  <div className="text-[var(--color-text-muted)] text-xs">Total</div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                  <div className="text-emerald-400 font-bold text-lg">
                    {MATRIX_DATA[selectedIdx].filter(v => v > 0).length}
                  </div>
                  <div className="text-[var(--color-text-muted)] text-xs">Partners</div>
                </div>
                <div className="rounded-lg bg-[var(--color-surface-2)] p-2">
                  <div className="text-amber-400 font-bold text-lg">
                    {topStat ? MATRIX_DATA[selectedIdx][AGENTS.findIndex(a => a.id === topStat.agentId)] : 0}
                  </div>
                  <div className="text-[var(--color-text-muted)] text-xs">Top collab</div>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
              <div className="text-[var(--color-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-3">
                Collaborators
              </div>
              <div className="space-y-2.5">
                {stats.slice(0, 6).map(stat => {
                  const collab = getAgent(stat.agentId);
                  const barWidth = stats[0] ? Math.round((stat.sessions / stats[0].sessions) * 100) : 0;
                  return (
                    <div key={stat.agentId} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{collab.emoji}</span>
                          <span className="text-[var(--color-text-primary)] text-xs font-medium">{collab.name}</span>
                        </div>
                        <span className="text-[var(--color-text-muted)] text-xs">{stat.sessions} sessions</span>
                      </div>
                      <div className="h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4">
              <div className="text-[var(--color-text-secondary)] text-xs font-semibold uppercase tracking-wider mb-2">
                Message Volume
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-[var(--color-text-primary)] text-2xl font-bold">
                  {MATRIX_DATA[selectedIdx].reduce((a, b) => a + b, 0) * 14}
                </span>
                <span className="text-[var(--color-text-muted)] text-xs">messages exchanged</span>
              </div>
              <div className="text-[var(--color-text-muted)] text-xs mt-1">
                {Math.floor(MATRIX_DATA[selectedIdx].reduce((a, b) => a + b, 0) / 5)} tasks delegated
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 h-full flex flex-col items-center justify-center text-center">
            <div className="text-3xl mb-3">🔗</div>
            <div className="text-[var(--color-text-secondary)] text-sm font-medium mb-1">Select an agent</div>
            <div className="text-[var(--color-text-muted)] text-xs leading-relaxed">
              Click any node to explore collaboration details, connection strengths, and session history
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Collaboration Matrix ──────────────────────────────────────────────────────

function CollaborationMatrix() {
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  const maxValue = Math.max(...MATRIX_DATA.flat().filter(v => v > 0));
  const rowTotals = MATRIX_DATA.map(row => row.reduce((a, b) => a + b, 0));
  const colTotals = AGENTS.map((_, i) => MATRIX_DATA.reduce((sum, row) => sum + row[i], 0));
  const grandTotal = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold">Collaboration Intensity Matrix</h3>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Interaction counts between agent pairs — darker cells indicate stronger collaboration
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span>Low</span>
          <div className="flex gap-0.5">
            {(["bg-indigo-950", "bg-indigo-900", "bg-indigo-800", "bg-indigo-700", "bg-indigo-600"] as string[]).map(c => (
              <div key={c} className={cn("w-5 h-3 rounded-sm", c)} />
            ))}
          </div>
          <span>High</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="w-24 h-10 text-[var(--color-text-muted)] text-xs font-normal text-right pr-2 align-bottom pb-1">
                  From ↓  To →
                </th>
                {AGENTS.map(agent => (
                  <th key={agent.id} className="w-14 h-12 text-center align-bottom pb-1">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base leading-none">{agent.emoji}</span>
                      <span className="text-[var(--color-text-secondary)] text-xs font-medium">{agent.name}</span>
                    </div>
                  </th>
                ))}
                <th className="w-14 h-12 text-center align-bottom pb-1">
                  <span className="text-[var(--color-text-secondary)] text-xs font-semibold">Total</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {AGENTS.map((rowAgent, rowIdx) => (
                <tr key={rowAgent.id}>
                  <td className="pr-2 py-0.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-sm">{rowAgent.emoji}</span>
                      <span className="text-[var(--color-text-secondary)] text-xs font-medium">{rowAgent.name}</span>
                    </div>
                  </td>
                  {AGENTS.map((colAgent, colIdx) => {
                    const val = MATRIX_DATA[rowIdx][colIdx];
                    const isHovered = hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                    const isDiag = rowIdx === colIdx;
                    return (
                      <td key={colAgent.id} className="p-0.5">
                        <div
                          className={cn(
                            "w-12 h-10 rounded flex items-center justify-center text-xs font-mono cursor-default transition-all duration-150 relative select-none",
                            isDiag
                              ? "bg-[var(--color-surface-2)]/50 text-[var(--color-text-muted)]"
                              : cn(intensityClass(val, maxValue), val > 0 ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)]"),
                            isHovered && !isDiag && val > 0 && "ring-1 ring-white/30 scale-110 z-10"
                          )}
                          onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          {isDiag ? "—" : val > 0 ? val : "·"}
                          {isHovered && !isDiag && val > 0 && (
                            <div
                              style={{ position: "absolute", bottom: "110%", left: "50%", transform: "translateX(-50%)", zIndex: 20 }}
                              className="bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-xs rounded px-2 py-1 whitespace-nowrap pointer-events-none shadow-lg border border-[var(--color-surface-3)]"
                            >
                              {rowAgent.name} → {colAgent.name}: {val} interactions
                            </div>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="p-0.5">
                    <div className="w-12 h-10 rounded bg-indigo-900/30 border border-indigo-800/30 flex items-center justify-center text-xs font-semibold text-indigo-400">
                      {rowTotals[rowIdx]}
                    </div>
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pr-2 py-0.5 text-right">
                  <span className="text-[var(--color-text-secondary)] text-xs font-semibold">Total</span>
                </td>
                {colTotals.map((total, i) => (
                  <td key={i} className="p-0.5">
                    <div className="w-12 h-10 rounded bg-indigo-900/30 border border-indigo-800/30 flex items-center justify-center text-xs font-semibold text-indigo-400">
                      {total}
                    </div>
                  </td>
                ))}
                <td className="p-0.5">
                  <div className="w-12 h-10 rounded bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center text-xs font-bold text-indigo-300">
                    {grandTotal}
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Activity Feed ─────────────────────────────────────────────────────────────

function ActivityFeed() {
  const [filter, setFilter] = useState<ActionType | "all">("all");

  const filtered = filter === "all"
    ? ACTIVITY_EVENTS
    : ACTIVITY_EVENTS.filter(e => e.action === filter);

  const filterOptions: { value: ActionType | "all"; label: string }[] = [
    { value: "all",           label: "All" },
    { value: "spawned",       label: "Spawned" },
    { value: "shared_context",label: "Shared Context" },
    { value: "delegated",     label: "Delegated" },
    { value: "collaborated",  label: "Collaborated" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold">Cross-Agent Activity Feed</h3>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Real-time collaboration events across the agent network
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap flex-shrink-0">
          {filterOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filter === opt.value
                  ? "bg-indigo-600 text-[var(--color-text-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map(event => {
          const fromAgent = getAgent(event.agentFrom);
          const toAgent   = getAgent(event.agentTo);
          return (
            <div
              key={event.id}
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 hover:border-[var(--color-border)] transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-base">
                    {fromAgent.emoji}
                  </div>
                  <span className="text-[var(--color-text-muted)] text-xs">→</span>
                  <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-base">
                    {toAgent.emoji}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[var(--color-text-primary)] text-sm font-semibold">{fromAgent.name}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", actionBadgeClass(event.action))}>
                      {actionLabel(event.action)}
                    </span>
                    <span className="text-[var(--color-text-primary)] text-sm font-semibold">{toAgent.name}</span>
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">{event.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[var(--color-text-muted)] text-xs">{event.timestamp}</span>
                    <span className="text-[var(--color-text-muted)] text-xs">·</span>
                    <span className="text-indigo-500 text-xs font-mono hover:text-indigo-400 cursor-pointer transition-colors">
                      {event.sessionId}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center">
            <div className="text-2xl mb-2">📭</div>
            <div className="text-[var(--color-text-muted)] text-sm">No events match this filter</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Analytics ─────────────────────────────────────────────────────────────────

function Analytics() {
  const agentTotals = AGENTS.map((agent, i) => ({
    agent,
    total: MATRIX_DATA[i].reduce((a, b) => a + b, 0),
    connections: MATRIX_DATA[i].filter(v => v > 0).length,
  })).toSorted((a, b) => b.total - a.total);

  const maxTotal = agentTotals[0]?.total ?? 1;

  const totalEdges = AGENTS.reduce((sum, _, i) =>
    sum + MATRIX_DATA[i].filter((v, j) => j > i && v > 0).length, 0);
  const possibleEdges = (AGENTS.length * (AGENTS.length - 1)) / 2;
  const density = Math.round((totalEdges / possibleEdges) * 100);
  const avgConnections = (
    AGENTS.reduce((sum, _, i) => sum + MATRIX_DATA[i].filter(v => v > 0).length, 0) / AGENTS.length
  ).toFixed(1);
  const hubs = agentTotals.filter(a => a.total > maxTotal * 0.6);

  const trendData = [
    { week: "W-6", value: 42  },
    { week: "W-5", value: 58  },
    { week: "W-4", value: 71  },
    { week: "W-3", value: 89  },
    { week: "W-2", value: 103 },
    { week: "W-1", value: 124 },
    { week: "Now", value: 156 },
  ];
  const maxTrend = Math.max(...trendData.map(d => d.value));

  const clusters = [
    {
      name: "Product & UI Core",
      agents: ["luis", "piper", "quinn", "reed"],
      colorClass: "bg-indigo-500/10 border-indigo-500/30 text-indigo-300",
    },
    {
      name: "UI Extension",
      agents: ["wes", "sam"],
      colorClass: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300",
    },
    {
      name: "Leadership",
      agents: ["xavier", "tim"],
      colorClass: "bg-amber-500/10 border-amber-500/30 text-amber-300",
    },
  ];

  const networkStats = [
    { label: "Network Density", value: `${density}%`,  sub: "Edge saturation",       color: "text-indigo-400" },
    { label: "Avg Connections", value: avgConnections,  sub: "Per agent",             color: "text-emerald-400" },
    { label: "Active Edges",    value: totalEdges,      sub: `of ${possibleEdges} possible`, color: "text-amber-400" },
    { label: "Hub Agents",      value: hubs.length,     sub: hubs.map(h => h.agent.name).join(", "), color: "text-rose-400" },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {/* Bar chart */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
          <h4 className="text-[var(--color-text-primary)] font-semibold text-sm">Most Collaborative Agents</h4>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5 mb-4">Total cross-agent interactions</p>
          <div className="space-y-3">
            {agentTotals.map(({ agent, total }) => {
              const barPct = Math.round((total / maxTotal) * 100);
              const barColor = barPct >= 80 ? "bg-indigo-500" : barPct >= 55 ? "bg-indigo-600" : "bg-indigo-800";
              return (
                <div key={agent.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span>{agent.emoji}</span>
                      <span className="text-[var(--color-text-primary)]">{agent.name}</span>
                    </div>
                    <span className="text-[var(--color-text-muted)] font-mono">{total}</span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-700", barColor)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Network stats */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
          <h4 className="text-[var(--color-text-primary)] font-semibold text-sm">Network Statistics</h4>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5 mb-4">Collaboration network health metrics</p>
          <div className="grid grid-cols-2 gap-3">
            {networkStats.map(stat => (
              <div key={stat.label} className="rounded-lg bg-[var(--color-surface-2)] p-3">
                <div className={cn("text-xl font-bold", stat.color)}>{stat.value}</div>
                <div className="text-[var(--color-text-primary)] text-xs font-medium mt-0.5">{stat.label}</div>
                <div className="text-[var(--color-text-muted)] text-xs mt-0.5 truncate" title={stat.sub}>{stat.sub}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Trend chart */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
          <h4 className="text-[var(--color-text-primary)] font-semibold text-sm">Collaboration Trend</h4>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5 mb-4">Weekly interaction volume (all agents)</p>
          <div className="relative h-36">
            {([0, 50, 100, 150] as number[]).map(v => (
              <div
                key={v}
                className="absolute w-full flex items-end"
                style={{ bottom: `${(v / 160) * 100}%`, left: 0 }}
              >
                <span className="text-[var(--color-text-muted)] text-xs w-7 text-right pr-1.5 flex-shrink-0 leading-none">{v}</span>
                <div className="flex-1 border-t border-[var(--color-border)]/50" />
              </div>
            ))}
            <div className="absolute inset-0 pl-8 flex items-end gap-1.5 pb-0">
              {trendData.map(d => {
                const heightPct = Math.round((d.value / maxTrend) * 100);
                const isLatest = d.week === "Now";
                return (
                  <div key={d.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end" style={{ height: "calc(100% - 20px)" }}>
                      <div
                        className={cn(
                          "w-full rounded-t transition-all duration-700",
                          isLatest ? "bg-indigo-500" : "bg-indigo-800"
                        )}
                        style={{ height: `${heightPct}%` }}
                      />
                    </div>
                    <span className="text-[var(--color-text-muted)] text-xs leading-none">{d.week}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Clusters */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-5">
          <h4 className="text-[var(--color-text-primary)] font-semibold text-sm">Team Clusters</h4>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5 mb-4">Collaboration density sub-groups</p>
          <div className="space-y-3">
            {clusters.map(cluster => {
              const clusterAgents = cluster.agents.map(id => getAgent(id));
              const intraCollab = cluster.agents.reduce((sum, id1) =>
                cluster.agents.reduce((s2, id2) => {
                  if (id1 === id2) {return s2;}
                  const i = AGENTS.findIndex(a => a.id === id1);
                  const j = AGENTS.findIndex(a => a.id === id2);
                  return s2 + (MATRIX_DATA[i]?.[j] ?? 0);
                }, sum), 0);
              return (
                <div key={cluster.name} className={cn("rounded-lg border p-3", cluster.colorClass)}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-semibold">{cluster.name}</span>
                    <span className="text-xs opacity-60">{intraCollab} intra</span>
                  </div>
                  <div className="flex gap-1.5 flex-wrap">
                    {clusterAgents.map(a => (
                      <div key={a.id} className="flex items-center gap-1 bg-black/20 rounded px-1.5 py-0.5">
                        <span className="text-xs">{a.emoji}</span>
                        <span className="text-xs opacity-90">{a.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Summary */}
            <div className="rounded-lg bg-[var(--color-surface-2)] p-3 mt-2">
              <div className="text-[var(--color-text-secondary)] text-xs font-semibold mb-2">Cross-Cluster Bridges</div>
              <div className="space-y-1">
                {[
                  { from: "luis",  to: "xavier", label: "UI ↔ Leadership liaison" },
                  { from: "tim",   to: "xavier", label: "Platform ↔ Leadership sync" },
                  { from: "quinn", to: "wes",    label: "State ↔ Performance coupling" },
                ].map(bridge => {
                  const fa = getAgent(bridge.from);
                  const ta = getAgent(bridge.to);
                  return (
                    <div key={bridge.from + bridge.to} className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span>{fa.emoji} {fa.name}</span>
                      <span className="text-[var(--color-text-muted)]">↔</span>
                      <span>{ta.emoji} {ta.name}</span>
                      <span className="text-[var(--color-text-muted)] ml-1">·</span>
                      <span className="text-[var(--color-text-muted)]">{bridge.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────

export default function AgentCollaborationGraph() {
  const [activeTab, setActiveTab] = useState<TabId>("graph");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "graph",     label: "Graph View",            icon: "🔗" },
    { id: "matrix",    label: "Collaboration Matrix",  icon: "🟦" },
    { id: "feed",      label: "Activity Feed",         icon: "📡" },
    { id: "analytics", label: "Analytics",             icon: "📊" },
  ];

  const totalInteractions = Math.round(MATRIX_DATA.flat().reduce((a, b) => a + b, 0) / 2);
  const activeAgents = AGENTS.filter(a => a.status === "active" || a.status === "busy").length;
  const totalEdges = AGENTS.reduce((sum, _, i) =>
    sum + MATRIX_DATA[i].filter((v, j) => j > i && v > 0).length, 0);

  const headerStats = [
    { label: "Interactions", value: totalInteractions, color: "text-indigo-400" },
    { label: "Online",       value: activeAgents,      color: "text-emerald-400" },
    { label: "Active Links", value: totalEdges,        color: "text-amber-400"  },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Agent Collaboration Graph</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Visualize inter-agent collaboration patterns, communication flows, and team dynamics
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {headerStats.map(stat => (
              <div
                key={stat.label}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 text-center"
              >
                <div className={cn("text-xl font-bold", stat.color)}>{stat.value}</div>
                <div className="text-[var(--color-text-muted)] text-xs">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)]">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                activeTab === tab.id
                  ? "bg-indigo-600 text-[var(--color-text-primary)] shadow-lg shadow-indigo-900/50"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
          {activeTab === "graph"     && <GraphView />}
          {activeTab === "matrix"    && <CollaborationMatrix />}
          {activeTab === "feed"      && <ActivityFeed />}
          {activeTab === "analytics" && <Analytics />}
        </div>
      </div>
    </div>
  );
}

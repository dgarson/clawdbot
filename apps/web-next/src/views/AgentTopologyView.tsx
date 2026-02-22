import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type RoleType = "orchestrator" | "worker" | "monitor" | "gateway" | "specialist";
type AgentStatus = "active" | "idle" | "error" | "spawning" | "draining";

interface AgentNode {
  id: string;
  name: string;
  roleType: RoleType;
  status: AgentStatus;
  model: string;
  squad: string;
  activeTokens: number;
  taskCount: number;
  latencyMs: number;
  errorRate: number;
  uptime: string;
}

interface AgentEdge {
  source: string;
  target: string;
  relationship: "reports-to" | "delegates-to" | "collaborates" | "monitors";
  weight: number;
}

interface PhysicsNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  agent: AgentNode;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_SIZES: Record<RoleType, number> = {
  orchestrator: 44,
  gateway: 36,
  monitor: 30,
  specialist: 26,
  worker: 24,
};

const ROLE_COLORS: Record<RoleType, string> = {
  orchestrator: "#6366f1",
  gateway: "#8b5cf6",
  monitor: "#06b6d4",
  specialist: "#f59e0b",
  worker: "#10b981",
};

const STATUS_RING: Record<AgentStatus, string> = {
  active: "#10b981",
  idle: "#6b7280",
  error: "#f43f5e",
  spawning: "#f59e0b",
  draining: "#3b82f6",
};

const EDGE_COLORS: Record<AgentEdge["relationship"], string> = {
  "reports-to": "#6366f1",
  "delegates-to": "#8b5cf6",
  collaborates: "#06b6d4",
  monitors: "#f59e0b",
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_AGENTS: AgentNode[] = [
  { id: "amadeus", name: "Amadeus", roleType: "orchestrator", status: "active", model: "claude-opus-4", squad: "Executive", activeTokens: 12400, taskCount: 3, latencyMs: 240, errorRate: 0.1, uptime: "99.9%" },
  { id: "xavier", name: "Xavier", roleType: "orchestrator", status: "active", model: "claude-sonnet-4", squad: "CTO", activeTokens: 8200, taskCount: 5, latencyMs: 190, errorRate: 0.2, uptime: "99.8%" },
  { id: "luis", name: "Luis", roleType: "specialist", status: "active", model: "claude-sonnet-4", squad: "Product & UI", activeTokens: 4500, taskCount: 8, latencyMs: 160, errorRate: 0.0, uptime: "100%" },
  { id: "tim", name: "Tim", roleType: "specialist", status: "active", model: "claude-sonnet-4", squad: "Platform Core", activeTokens: 6100, taskCount: 4, latencyMs: 175, errorRate: 0.1, uptime: "99.9%" },
  { id: "claire", name: "Claire", roleType: "specialist", status: "active", model: "claude-sonnet-4", squad: "Feature Dev", activeTokens: 5200, taskCount: 6, latencyMs: 155, errorRate: 0.0, uptime: "100%" },
  { id: "piper", name: "Piper", roleType: "worker", status: "active", model: "claude-sonnet-4", squad: "Product & UI", activeTokens: 2100, taskCount: 12, latencyMs: 130, errorRate: 0.3, uptime: "99.5%" },
  { id: "quinn", name: "Quinn", roleType: "worker", status: "idle", model: "claude-sonnet-4", squad: "Product & UI", activeTokens: 0, taskCount: 0, latencyMs: 0, errorRate: 0.0, uptime: "100%" },
  { id: "reed", name: "Reed", roleType: "worker", status: "active", model: "claude-haiku-4", squad: "Product & UI", activeTokens: 1800, taskCount: 7, latencyMs: 95, errorRate: 0.1, uptime: "99.7%" },
  { id: "wes", name: "Wes", roleType: "worker", status: "active", model: "claude-haiku-4", squad: "Product & UI", activeTokens: 2400, taskCount: 9, latencyMs: 88, errorRate: 0.2, uptime: "99.6%" },
  { id: "sam", name: "Sam", roleType: "worker", status: "spawning", model: "claude-haiku-4", squad: "Product & UI", activeTokens: 600, taskCount: 2, latencyMs: 210, errorRate: 0.5, uptime: "97.2%" },
  { id: "roman", name: "Roman", roleType: "worker", status: "active", model: "claude-sonnet-4", squad: "Platform Core", activeTokens: 3200, taskCount: 5, latencyMs: 140, errorRate: 0.1, uptime: "99.8%" },
  { id: "joey", name: "Joey", roleType: "monitor", status: "active", model: "claude-haiku-4", squad: "TPM", activeTokens: 1100, taskCount: 3, latencyMs: 110, errorRate: 0.0, uptime: "100%" },
  { id: "gateway", name: "Gateway", roleType: "gateway", status: "active", model: "system", squad: "Infra", activeTokens: 0, taskCount: 0, latencyMs: 8, errorRate: 0.01, uptime: "99.99%" },
  { id: "nate", name: "Nate", roleType: "worker", status: "error", model: "claude-haiku-4", squad: "Feature Dev", activeTokens: 0, taskCount: 0, latencyMs: 0, errorRate: 12.5, uptime: "88.0%" },
  { id: "oscar", name: "Oscar", roleType: "worker", status: "idle", model: "claude-haiku-4", squad: "Feature Dev", activeTokens: 0, taskCount: 0, latencyMs: 0, errorRate: 0.0, uptime: "100%" },
];

const MOCK_EDGES: AgentEdge[] = [
  { source: "amadeus", target: "xavier", relationship: "reports-to", weight: 3 },
  { source: "amadeus", target: "gateway", relationship: "monitors", weight: 2 },
  { source: "xavier", target: "luis", relationship: "delegates-to", weight: 2 },
  { source: "xavier", target: "tim", relationship: "delegates-to", weight: 2 },
  { source: "xavier", target: "claire", relationship: "delegates-to", weight: 2 },
  { source: "luis", target: "piper", relationship: "delegates-to", weight: 1 },
  { source: "luis", target: "quinn", relationship: "delegates-to", weight: 1 },
  { source: "luis", target: "reed", relationship: "delegates-to", weight: 1 },
  { source: "luis", target: "wes", relationship: "delegates-to", weight: 1 },
  { source: "luis", target: "sam", relationship: "delegates-to", weight: 1 },
  { source: "tim", target: "roman", relationship: "delegates-to", weight: 1 },
  { source: "claire", target: "nate", relationship: "delegates-to", weight: 1 },
  { source: "claire", target: "oscar", relationship: "delegates-to", weight: 1 },
  { source: "joey", target: "xavier", relationship: "collaborates", weight: 2 },
  { source: "joey", target: "luis", relationship: "collaborates", weight: 1 },
  { source: "gateway", target: "piper", relationship: "monitors", weight: 1 },
  { source: "piper", target: "quinn", relationship: "collaborates", weight: 1 },
];

// ─── Physics Engine ───────────────────────────────────────────────────────────

function initPositions(agents: AgentNode[], w: number, h: number): PhysicsNode[] {
  const cx = w / 2;
  const cy = h / 2;
  return agents.map((agent, i) => {
    const angle = (i / agents.length) * Math.PI * 2;
    const radius = agent.roleType === "orchestrator" ? 80
      : agent.roleType === "gateway" ? 120
      : agent.roleType === "monitor" ? 150
      : 200;
    return {
      id: agent.id,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
      agent,
    };
  });
}

function tickPhysics(
  nodes: PhysicsNode[],
  edges: AgentEdge[],
  w: number,
  h: number
): PhysicsNode[] {
  const alpha = 0.08;
  const repulsion = 9000;
  const springLen = 160;
  const springK = 0.04;
  const damping = 0.85;
  const centerPull = 0.012;

  const next = nodes.map((n) => ({ ...n, vx: n.vx, vy: n.vy }));
  const cx = w / 2;
  const cy = h / 2;

  // Repulsion
  for (let i = 0; i < next.length; i++) {
    for (let j = i + 1; j < next.length; j++) {
      const dx = next[j].x - next[i].x;
      const dy = next[j].y - next[i].y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = repulsion / (dist * dist);
      const fx = (dx / dist) * force * alpha;
      const fy = (dy / dist) * force * alpha;
      next[i].vx -= fx;
      next[i].vy -= fy;
      next[j].vx += fx;
      next[j].vy += fy;
    }
  }

  // Spring (edges)
  const nodeMap: Record<string, PhysicsNode> = {};
  next.forEach((n) => { nodeMap[n.id] = n; });
  edges.forEach((edge) => {
    const src = nodeMap[edge.source];
    const tgt = nodeMap[edge.target];
    if (!src || !tgt) return;
    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const stretch = dist - springLen * (3 - edge.weight);
    const fx = (dx / dist) * stretch * springK * alpha;
    const fy = (dy / dist) * stretch * springK * alpha;
    src.vx += fx;
    src.vy += fy;
    tgt.vx -= fx;
    tgt.vy -= fy;
  });

  // Center gravity
  next.forEach((n) => {
    n.vx += (cx - n.x) * centerPull * alpha;
    n.vy += (cy - n.y) * centerPull * alpha;
  });

  // Integrate + dampen + clamp
  return next.map((n) => ({
    ...n,
    vx: n.vx * damping,
    vy: n.vy * damping,
    x: Math.max(60, Math.min(w - 60, n.x + n.vx)),
    y: Math.max(60, Math.min(h - 60, n.y + n.vy)),
  }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EdgeLine({ edge, nodes }: { edge: AgentEdge; nodes: PhysicsNode[] }) {
  const nodeMap: Record<string, PhysicsNode> = {};
  nodes.forEach((n) => { nodeMap[n.id] = n; });
  const src = nodeMap[edge.source];
  const tgt = nodeMap[edge.target];
  if (!src || !tgt) return null;

  const midX = (src.x + tgt.x) / 2;
  const midY = (src.y + tgt.y) / 2;
  const color = EDGE_COLORS[edge.relationship];

  return (
    <g>
      <line
        x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
        stroke={color}
        strokeWidth={edge.weight}
        strokeOpacity={0.35}
        strokeDasharray={edge.relationship === "monitors" ? "4 4" : undefined}
      />
      <circle cx={midX} cy={midY} r={2} fill={color} opacity={0.6} />
    </g>
  );
}

function AgentCircle({
  node,
  selected,
  onClick,
}: {
  node: PhysicsNode;
  selected: boolean;
  onClick: (id: string) => void;
}) {
  const size = ROLE_SIZES[node.agent.roleType];
  const color = ROLE_COLORS[node.agent.roleType];
  const ringColor = STATUS_RING[node.agent.status];
  const isPulsing = node.agent.status === "active" || node.agent.status === "spawning";

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      style={{ cursor: "pointer" }}
      onClick={() => onClick(node.id)}
    >
      {/* Pulse ring for active nodes */}
      {isPulsing && (
        <circle
          r={size + 8}
          fill="none"
          stroke={ringColor}
          strokeWidth={1}
          opacity={0.25}
          className="animate-ping"
          style={{ transformOrigin: "center" }}
        />
      )}
      {/* Selection halo */}
      {selected && (
        <circle r={size + 6} fill="none" stroke="#ffffff" strokeWidth={2} opacity={0.8} />
      )}
      {/* Main circle */}
      <circle r={size} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
      {/* Status ring */}
      <circle r={size + 3} fill="none" stroke={ringColor} strokeWidth={2} strokeDasharray="3 3" />
      {/* Name label */}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size > 30 ? 11 : 9}
        fontWeight="700"
        fill="#ffffff"
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {node.agent.name}
      </text>
      {/* Role sub-label */}
      <text
        textAnchor="middle"
        y={size > 30 ? 14 : 11}
        dominantBaseline="middle"
        fontSize={8}
        fill={color}
        opacity={0.85}
        style={{ userSelect: "none", pointerEvents: "none" }}
      >
        {node.agent.roleType}
      </text>
    </g>
  );
}

function DetailPanel({ agent, onClose }: { agent: AgentNode; onClose: () => void }) {
  const color = ROLE_COLORS[agent.roleType];
  const ringColor = STATUS_RING[agent.status];

  const stats = [
    { label: "Model", value: agent.model },
    { label: "Squad", value: agent.squad },
    { label: "Active Tokens", value: agent.activeTokens.toLocaleString() },
    { label: "Task Count", value: agent.taskCount.toString() },
    { label: "Latency", value: agent.latencyMs > 0 ? `${agent.latencyMs}ms` : "—" },
    { label: "Error Rate", value: `${agent.errorRate}%` },
    { label: "Uptime", value: agent.uptime },
  ];

  return (
    <div className="absolute top-4 right-4 w-64 bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-zinc-800" style={{ borderLeftColor: color, borderLeftWidth: 3 }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: `${color}22`, border: `2px solid ${color}` }}>
            <span className="text-xs font-bold" style={{ color }}>{agent.name[0]}</span>
          </div>
          <div>
            <div className="text-sm font-bold text-white">{agent.name}</div>
            <div className="text-[10px] uppercase font-bold" style={{ color }}>{agent.roleType}</div>
          </div>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors text-xs">✕</button>
      </div>

      {/* Status badge */}
      <div className="px-4 py-2 flex items-center gap-2 border-b border-zinc-800/50">
        <div className="w-2 h-2 rounded-full" style={{ background: ringColor }} />
        <span className="text-xs font-bold uppercase" style={{ color: ringColor }}>{agent.status}</span>
      </div>

      {/* Stats */}
      <div className="p-4 flex flex-col gap-2">
        {stats.map((s) => (
          <div key={s.label} className="flex justify-between items-center">
            <span className="text-[10px] text-zinc-500 uppercase font-bold">{s.label}</span>
            <span className="text-xs text-zinc-200 font-mono">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Error rate bar */}
      {agent.errorRate > 0 && (
        <div className="px-4 pb-4">
          <div className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Error Rate</div>
          <div className="h-1.5 bg-zinc-950 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{ width: `${Math.min(100, agent.errorRate * 5)}%`, background: agent.errorRate > 5 ? "#f43f5e" : "#f59e0b" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentTopologyView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });
  const [physicsNodes, setPhysicsNodes] = useState<PhysicsNode[]>([]);
  const [running, setRunning] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AgentStatus | "all">("all");
  const [filterRole, setFilterRole] = useState<RoleType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredAgents = useMemo(() => MOCK_AGENTS.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) return false;
    if (filterRole !== "all" && a.roleType !== filterRole) return false;
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [filterStatus, filterRole, searchQuery]);

  const visibleIds = useMemo(() => new Set(filteredAgents.map((a) => a.id)), [filteredAgents]);

  // Initialize positions
  useEffect(() => {
    const { w, h } = dimensions;
    setPhysicsNodes(initPositions(filteredAgents, w, h));
  }, [filteredAgents, dimensions]);

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDimensions({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Physics loop
  useEffect(() => {
    if (!running) { cancelAnimationFrame(rafRef.current); return; }
    let frame = 0;
    const loop = () => {
      frame++;
      if (frame % 2 === 0) { // run at ~30fps
        setPhysicsNodes((prev) => tickPhysics(prev, MOCK_EDGES, dimensions.w, dimensions.h));
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, dimensions]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const selectedAgent = useMemo(() => MOCK_AGENTS.find((a) => a.id === selectedId), [selectedId]);

  // Stats
  const stats = useMemo(() => {
    const active = MOCK_AGENTS.filter((a) => a.status === "active").length;
    const errored = MOCK_AGENTS.filter((a) => a.status === "error").length;
    const totalTokens = MOCK_AGENTS.reduce((s, a) => s + a.activeTokens, 0);
    return { active, errored, totalTokens, total: MOCK_AGENTS.length };
  }, []);

  const visibleEdges = useMemo(() =>
    MOCK_EDGES.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [visibleIds]
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Agent <span className="text-indigo-400">Topology</span></h1>
          <p className="text-zinc-500 text-xs">Real-time agent network graph — {stats.total} agents</p>
        </div>
        <div className="flex items-center gap-6">
          {/* Stats pills */}
          {[
            { label: "Active", value: stats.active, color: "text-emerald-400" },
            { label: "Errors", value: stats.errored, color: "text-rose-400" },
            { label: "Tokens", value: `${(stats.totalTokens / 1000).toFixed(1)}k`, color: "text-indigo-400" },
          ].map((s) => (
            <div key={s.label} className="flex flex-col items-center">
              <span className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</span>
              <span className="text-[9px] uppercase font-bold text-zinc-600">{s.label}</span>
            </div>
          ))}

          {/* Sim toggle */}
          <button
            onClick={() => setRunning((r) => !r)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all border",
              running
                ? "bg-indigo-500/10 border-indigo-500 text-indigo-400 hover:bg-indigo-500/20"
                : "bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            {running ? "⏸ Pause" : "▶ Run"}
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
        <input
          type="text"
          placeholder="Search agents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors w-40 placeholder-zinc-600"
        />
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as AgentStatus | "all")}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="all">All Statuses</option>
          {(["active", "idle", "error", "spawning", "draining"] as AgentStatus[]).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value as RoleType | "all")}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 transition-colors"
        >
          <option value="all">All Roles</option>
          {(["orchestrator", "gateway", "monitor", "specialist", "worker"] as RoleType[]).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        {/* Legend */}
        <div className="flex items-center gap-4 ml-auto">
          {(Object.entries(EDGE_COLORS) as [AgentEdge["relationship"], string][]).map(([rel, col]) => (
            <div key={rel} className="flex items-center gap-1.5">
              <div className="w-4 h-0.5 rounded" style={{ background: col, opacity: 0.7 }} />
              <span className="text-[9px] text-zinc-500 uppercase font-bold">{rel.replace("-", " ")}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Graph canvas */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          className="absolute inset-0"
          style={{ background: "transparent" }}
        >
          {/* Grid pattern */}
          <defs>
            <pattern id="topo-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#27272a" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo-grid)" />

          {/* Edges */}
          <g>
            {visibleEdges.map((edge, i) => (
              <EdgeLine key={i} edge={edge} nodes={physicsNodes} />
            ))}
          </g>

          {/* Nodes */}
          <g>
            {physicsNodes
              .filter((n) => visibleIds.has(n.id))
              .map((node) => (
                <AgentCircle
                  key={node.id}
                  node={node}
                  selected={selectedId === node.id}
                  onClick={handleNodeClick}
                />
              ))}
          </g>
        </svg>

        {/* Detail panel */}
        {selectedAgent && (
          <DetailPanel agent={selectedAgent} onClose={() => setSelectedId(null)} />
        )}

        {/* Empty state */}
        {physicsNodes.filter((n) => visibleIds.has(n.id)).length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-zinc-600">
            <span className="text-4xl">🕸️</span>
            <span className="text-sm font-medium">No agents match your filters</span>
            <button
              onClick={() => { setFilterStatus("all"); setFilterRole("all"); setSearchQuery(""); }}
              className="text-xs text-indigo-400 hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Role size legend */}
        <div className="absolute bottom-4 left-4 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl p-3 flex flex-col gap-2">
          <span className="text-[9px] text-zinc-500 uppercase font-bold mb-1">Role → Size</span>
          {(Object.entries(ROLE_SIZES) as [RoleType, number][]).map(([role, size]) => (
            <div key={role} className="flex items-center gap-2">
              <div
                className="rounded-full border-2 flex-shrink-0"
                style={{
                  width: size / 2.5,
                  height: size / 2.5,
                  borderColor: ROLE_COLORS[role],
                  background: `${ROLE_COLORS[role]}22`
                }}
              />
              <span className="text-[9px] text-zinc-400 uppercase font-medium">{role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

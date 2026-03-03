import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";
import {
  initOptimizedPositions,
  tickOptimizedPhysics,
  renderToCanvas,
  updateFps,
  getPerformanceClass,
  type ViewportState,
} from "./AgentTopologyPhysics";

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

// ─── Detail Panel ───────────────────────────────────────────────────────────

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
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const [dimensions, setDimensions] = useState({ w: 900, h: 600 });
  const [physicsNodes, setPhysicsNodes] = useState<PhysicsNode[]>([]);
  const [running, setRunning] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AgentStatus | "all">("all");
  const [filterRole, setFilterRole] = useState<RoleType | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Viewport state for pan/zoom
  const [viewport, setViewport] = useState<ViewportState>({
    x: 0,
    y: 0,
    zoom: 1,
    width: 900,
    height: 600,
  });

  const filteredAgents = useMemo(() => MOCK_AGENTS.filter((a) => {
    if (filterStatus !== "all" && a.status !== filterStatus) {return false;}
    if (filterRole !== "all" && a.roleType !== filterRole) {return false;}
    if (searchQuery && !a.name.toLowerCase().includes(searchQuery.toLowerCase())) {return false;}
    return true;
  }), [filterStatus, filterRole, searchQuery]);

  const visibleIds = useMemo(() => new Set(filteredAgents.map((a) => a.id)), [filteredAgents]);

  const visibleEdges = useMemo(() =>
    MOCK_EDGES.filter((e) => visibleIds.has(e.source) && visibleIds.has(e.target)),
    [visibleIds]
  );

  // Initialize positions with optimized algorithm
  useEffect(() => {
    const { w, h } = dimensions;
    setPhysicsNodes(initOptimizedPositions(filteredAgents, w, h));
  }, [filteredAgents, dimensions]);

  // Observe container size
  useEffect(() => {
    if (!containerRef.current) {return;}
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) {
        setDimensions({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // FPS tracking state
  const [fps, setFps] = useState(60);
  
  // Physics loop with optimized engine
  useEffect(() => {
    if (!running) { cancelAnimationFrame(rafRef.current); return; }
    let frame = 0;
    const loop = () => {
      frame++;
      // Run physics every frame for smoother animation with optimized engine
      setPhysicsNodes((prev) => tickOptimizedPhysics(prev, MOCK_EDGES, dimensions.w, dimensions.h));
      
      // Update FPS every 30 frames
      if (frame % 30 === 0) {
        setFps(updateFps());
      }
      
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [running, dimensions]);
  
  // Update viewport dimensions when container changes
  useEffect(() => {
    setViewport(v => ({ ...v, width: dimensions.w, height: dimensions.h }));
  }, [dimensions]);
  
  // Canvas rendering with LOD and viewport culling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    
    // Set canvas size
    canvas.width = dimensions.w;
    canvas.height = dimensions.h;
    
    // Render
    renderToCanvas(ctx, physicsNodes, visibleEdges, viewport, selectedId, {
      roleSizes: ROLE_SIZES,
      roleColors: ROLE_COLORS,
      statusColors: STATUS_RING,
      edgeColors: EDGE_COLORS,
    });
  }, [physicsNodes, visibleEdges, viewport, selectedId, dimensions]);

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);
  
  // Handle canvas click for node selection
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Convert screen coords to world coords
    const worldX = x / viewport.zoom + viewport.x;
    const worldY = y / viewport.zoom + viewport.y;
    
    // Find clicked node (simple distance check)
    for (const node of physicsNodes) {
      const size = ROLE_SIZES[node.agent.roleType];
      const dx = node.x - worldX;
      const dy = node.y - worldY;
      if (dx * dx + dy * dy <= size * size) {
        setSelectedId(prev => prev === node.id ? null : node.id);
        return;
      }
    }
    
    // Click on empty space - deselect
    setSelectedId(null);
  }, [viewport, physicsNodes]);
  
  // Pan handling
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return; // Only left click for pan
    // Could implement drag-to-pan here
  }, []);
  
  // Zoom handling with wheel
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setViewport(v => ({
      ...v,
      zoom: Math.max(0.2, Math.min(3, v.zoom * delta)),
    }));
  }, []);

  const selectedAgent = useMemo(() => MOCK_AGENTS.find((a) => a.id === selectedId), [selectedId]);

  // Stats
  const stats = useMemo(() => {
    const active = MOCK_AGENTS.filter((a) => a.status === "active").length;
    const errored = MOCK_AGENTS.filter((a) => a.status === "error").length;
    const totalTokens = MOCK_AGENTS.reduce((s, a) => s + a.activeTokens, 0);
    return { active, errored, totalTokens, total: MOCK_AGENTS.length };
  }, []);

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

      {/* Graph canvas - using Canvas API for better performance with 100+ nodes */}
      <div ref={containerRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          width={dimensions.w}
          height={dimensions.h}
          className="absolute inset-0 cursor-crosshair"
          onClick={handleCanvasClick}
          onMouseDown={handleCanvasMouseDown}
          onWheel={handleWheel}
        />

        {/* Performance stats overlay */}
        <div className="absolute top-4 left-4 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-lg px-3 py-2 flex items-center gap-3">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase font-bold">FPS</span>
            <span className={cn("text-lg font-bold font-mono", getPerformanceClass(fps))}>{fps}</span>
          </div>
          <div className="w-px h-8 bg-zinc-700" />
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500 uppercase font-bold">Zoom</span>
            <span className="text-sm font-mono text-zinc-300">{Math.round(viewport.zoom * 100)}%</span>
          </div>
        </div>

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

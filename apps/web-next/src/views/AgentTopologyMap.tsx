import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '../lib/utils';
import { Skeleton } from '../components/ui/Skeleton';
import { RotateCcw, Wifi, WifiOff, Users, X, MessageSquare } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType = 'principal' | 'worker' | 'cron';
type NodeStatus = 'active' | 'idle';

interface TopoNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  model: string;
  tokenCount: number;
  lastMessage: string;
  sessionType: string;
  spawner?: string;
}

interface TopoEdge {
  source: string;
  target: string;
  dashed?: boolean;
}

interface Pos {
  x: number;
  y: number;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_NODES: TopoNode[] = [
  // 6 Principals
  {
    id: 'luis', name: 'Luis', type: 'principal', status: 'active',
    model: 'claude-sonnet-4-6', tokenCount: 48200, sessionType: 'Principal',
    lastMessage: 'Delegating AgentTopologyMap build to wes-topology subagent.',
  },
  {
    id: 'xavier', name: 'Xavier', type: 'principal', status: 'active',
    model: 'claude-opus-4', tokenCount: 92100, sessionType: 'Principal',
    lastMessage: 'Reviewing PR #72 feat/horizon-post-merge pipeline.',
  },
  {
    id: 'amadeus', name: 'Amadeus', type: 'principal', status: 'active',
    model: 'claude-opus-4', tokenCount: 121400, sessionType: 'Principal',
    lastMessage: 'Executive strategy cycle complete. Awaiting next tick.',
  },
  {
    id: 'tim', name: 'Tim', type: 'principal', status: 'idle',
    model: 'claude-sonnet-4-6', tokenCount: 31800, sessionType: 'Principal',
    lastMessage: 'Platform architecture review finished.',
  },
  {
    id: 'merlin', name: 'Merlin', type: 'principal', status: 'active',
    model: 'claude-sonnet-4-6', tokenCount: 67300, sessionType: 'Principal',
    lastMessage: 'Orchestrating multi-agent task queue.',
  },
  {
    id: 'julia', name: 'Julia', type: 'principal', status: 'active',
    model: 'claude-haiku-4', tokenCount: 18900, sessionType: 'Principal',
    lastMessage: 'Org health check scheduled. Running diagnostics.',
  },
  // 4 Workers (spawned from Luis)
  {
    id: 'reed-view-290', name: 'reed-view-290', type: 'worker', status: 'active',
    model: 'claude-sonnet-4-6', tokenCount: 12400, sessionType: 'Subagent', spawner: 'luis',
    lastMessage: 'Rendering AccessibilityAuditView, 0 TS errors.',
  },
  {
    id: 'piper-view-288', name: 'piper-view-288', type: 'worker', status: 'active',
    model: 'claude-sonnet-4-6', tokenCount: 9800, sessionType: 'Subagent', spawner: 'luis',
    lastMessage: 'InteractionTimeline component built successfully.',
  },
  {
    id: 'quinn-horizon-m1', name: 'quinn-horizon-m1', type: 'worker', status: 'idle',
    model: 'claude-haiku-4', tokenCount: 5600, sessionType: 'Subagent', spawner: 'luis',
    lastMessage: 'State management layer complete. Task done.',
  },
  {
    id: 'wes-topology', name: 'wes-topology', type: 'worker', status: 'active',
    model: 'claude-sonnet-4-6', tokenCount: 7200, sessionType: 'Subagent', spawner: 'luis',
    lastMessage: 'Writing AgentTopologyMap.tsx — Horizon M2 #313.',
  },
  // 2 Crons
  {
    id: 'cron-julia-org', name: 'Org Health Check', type: 'cron', status: 'idle',
    model: 'claude-haiku-4', tokenCount: 2100, sessionType: 'Cron', spawner: 'julia',
    lastMessage: 'Last run: 02:00 MST. Next scheduled: 03:00 MST.',
  },
  {
    id: 'cron-xavier-triage', name: 'Instruction Triage', type: 'cron', status: 'active',
    model: 'claude-haiku-4', tokenCount: 3400, sessionType: 'Cron', spawner: 'xavier',
    lastMessage: 'Processing 3 new instructions from inbox.',
  },
];

const MOCK_EDGES: TopoEdge[] = [
  { source: 'luis', target: 'reed-view-290' },
  { source: 'luis', target: 'piper-view-288' },
  { source: 'luis', target: 'quinn-horizon-m1' },
  { source: 'luis', target: 'wes-topology' },
  { source: 'julia', target: 'cron-julia-org', dashed: true },
  { source: 'xavier', target: 'cron-xavier-triage', dashed: true },
];

// ─── Layout Constants ─────────────────────────────────────────────────────────

const VB_W = 860;
const VB_H = 520;
const CX = 430;
const CY = 260;
const OUTER_R = 210;  // principal ring
const INNER_R = 115;  // cron ring
const WORKER_R = 65;  // worker offset from spawner

// ─── Position Computation (static, deterministic) ─────────────────────────────

function computePositions(): Record<string, Pos> {
  const pos: Record<string, Pos> = {};

  // Principals: 6 agents evenly distributed on outer ring, starting at 0° (right)
  const principalIds = ['luis', 'xavier', 'amadeus', 'tim', 'merlin', 'julia'];
  principalIds.forEach((id, i) => {
    const angle = (i / principalIds.length) * 2 * Math.PI;
    pos[id] = {
      x: CX + OUTER_R * Math.cos(angle),
      y: CY + OUTER_R * Math.sin(angle),
    };
  });

  // Workers: fanned around Luis. Luis is at angle=0 → (CX+OUTER_R, CY).
  // Fan 4 workers at ±50° and ±17° from the 0° outward direction.
  const luisPos = pos['luis'];
  const luisAngle = 0;
  const workerSpreads = [-50, -17, 17, 50]; // degrees from outward direction
  const workerIds = ['reed-view-290', 'piper-view-288', 'quinn-horizon-m1', 'wes-topology'];
  workerIds.forEach((id, i) => {
    const angle = luisAngle + (workerSpreads[i] * Math.PI) / 180;
    pos[id] = {
      x: luisPos.x + WORKER_R * Math.cos(angle),
      y: luisPos.y + WORKER_R * Math.sin(angle),
    };
  });

  // Crons: inner ring, radially aligned toward their spawner
  const juliaIdx = principalIds.indexOf('julia'); // 5
  const juliaAngle = (juliaIdx / principalIds.length) * 2 * Math.PI;
  pos['cron-julia-org'] = {
    x: CX + INNER_R * Math.cos(juliaAngle),
    y: CY + INNER_R * Math.sin(juliaAngle),
  };

  const xavierIdx = principalIds.indexOf('xavier'); // 1
  const xavierAngle = (xavierIdx / principalIds.length) * 2 * Math.PI;
  pos['cron-xavier-triage'] = {
    x: CX + INNER_R * Math.cos(xavierAngle),
    y: CY + INNER_R * Math.sin(xavierAngle),
  };

  return pos;
}

const NODE_POS: Record<string, Pos> = computePositions();

// ─── Node Visual Config ───────────────────────────────────────────────────────

const NODE_RADIUS: Record<NodeType, number> = { principal: 28, worker: 17, cron: 0 };
const NODE_STROKE: Record<NodeType, string> = {
  principal: '#8b5cf6',
  worker: '#3b82f6',
  cron: '#f59e0b',
};
const NODE_FILL_ALPHA = 0.15;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Legend Item ──────────────────────────────────────────────────────────────

interface LegendItemProps {
  color: string;
  label: string;
  shape?: 'circle' | 'diamond';
}

function LegendItem({ color, label, shape = 'circle' }: LegendItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      {shape === 'diamond' ? (
        <svg width="12" height="12" viewBox="-7 -7 14 14" style={{ flexShrink: 0 }}>
          <rect
            x="-4.5" y="-4.5" width="9" height="9"
            transform="rotate(45)"
            fill={color}
            opacity={0.85}
          />
        </svg>
      ) : (
        <div
          className="rounded-full flex-shrink-0"
          style={{ width: 10, height: 10, background: color, opacity: 0.85 }}
        />
      )}
      <span className="text-[10px] font-medium text-zinc-400">{label}</span>
    </div>
  );
}

// ─── Node Shape ───────────────────────────────────────────────────────────────

interface NodeShapeProps {
  node: TopoNode;
  pos: Pos;
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}

function NodeShape({
  node, pos, selected, hovered, onClick, onMouseEnter, onMouseLeave,
}: NodeShapeProps) {
  const stroke = NODE_STROKE[node.type];
  const fill = hexToRgba(stroke, NODE_FILL_ALPHA);
  const r = NODE_RADIUS[node.type];
  const active = node.status === 'active';
  const scale = hovered || selected ? 1.18 : 1;

  // Truncate long labels for small nodes
  const labelText = node.name.length > 14 ? node.name.slice(0, 13) + '…' : node.name;
  const fontSize = node.type === 'principal' ? 10 : 9;
  const fontWeight = node.type === 'principal' ? '700' : '600';
  const labelColor = node.type === 'principal' ? '#e4e4e7' : '#a1a1aa';

  // Label position below shape
  const labelY = node.type === 'cron' ? 22 : r + 13;

  return (
    // Outer group: positioned at node coordinates via SVG transform
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: 'pointer' }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Inner group: handles hover scale from node center (0,0) */}
      <g
        style={{
          transform: `scale(${scale})`,
          transformOrigin: '0px 0px',
          transition: 'transform 0.15s ease',
        }}
      >
        {/* Selected glow ring */}
        {selected && node.type !== 'cron' && (
          <circle
            r={r + 11}
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            opacity={0.55}
            filter="url(#atm-node-glow)"
          />
        )}
        {selected && node.type === 'cron' && (
          <rect
            x={-17} y={-17} width={34} height={34}
            transform="rotate(45)"
            fill="none"
            stroke={stroke}
            strokeWidth={3}
            opacity={0.55}
            filter="url(#atm-node-glow)"
          />
        )}

        {/* Active pulse ring (non-animated outer halo) */}
        {active && node.type !== 'cron' && (
          <circle r={r + 6} fill="none" stroke={stroke} strokeWidth={1} opacity={0.18} />
        )}

        {/* Main shape: circle for principal/worker, rotated rect for cron */}
        {node.type === 'cron' ? (
          <rect
            x={-11} y={-11} width={22} height={22}
            transform="rotate(45)"
            fill={fill}
            stroke={stroke}
            strokeWidth={1.5}
          />
        ) : (
          <circle
            r={r}
            fill={fill}
            stroke={stroke}
            strokeWidth={node.type === 'principal' ? 2 : 1.5}
          />
        )}

        {/* Status indicator dot (top-right of circle nodes) */}
        {node.type !== 'cron' && (
          <circle
            cx={r - 4}
            cy={-(r - 4)}
            r={4}
            fill={active ? '#10b981' : '#52525b'}
            stroke="#09090b"
            strokeWidth={1}
          />
        )}

        {/* Node name label */}
        <text
          textAnchor="middle"
          dominantBaseline="auto"
          y={labelY}
          fontSize={fontSize}
          fontWeight={fontWeight}
          fill={labelColor}
          style={{ userSelect: 'none', pointerEvents: 'none' }}
        >
          {labelText}
        </text>
      </g>
    </g>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

interface DetailPanelProps {
  node: TopoNode;
  onClose: () => void;
}

function DetailPanel({ node, onClose }: DetailPanelProps) {
  const stroke = NODE_STROKE[node.type];
  const active = node.status === 'active';

  const stats: Array<{ label: string; value: string }> = [
    { label: 'Session Type', value: node.sessionType },
    { label: 'Model', value: node.model },
    { label: 'Token Count', value: node.tokenCount.toLocaleString() },
    ...(node.spawner ? [{ label: 'Spawned By', value: node.spawner }] : []),
  ];

  return (
    <div className="w-[280px] flex-shrink-0 bg-zinc-900 border-l border-zinc-800 flex flex-col overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-zinc-800"
        style={{ borderLeftColor: stroke, borderLeftWidth: 3 }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              background: hexToRgba(stroke, 0.15),
              border: `2px solid ${stroke}`,
              color: stroke,
            }}
          >
            {node.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-white truncate">{node.name}</div>
            <div className="text-[10px] font-bold uppercase" style={{ color: stroke }}>
              {node.type}
            </div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="ml-2 flex-shrink-0 text-zinc-500 hover:text-zinc-200 transition-colors duration-150 p-1 rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        >
          <X size={14} />
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 py-2 border-b border-zinc-800/60 flex items-center gap-2">
        <div
          className={cn('w-2 h-2 rounded-full', active ? 'animate-pulse' : '')}
          style={{ background: active ? '#10b981' : '#52525b' }}
        />
        <span
          className="text-xs font-bold uppercase"
          style={{ color: active ? '#10b981' : '#71717a' }}
        >
          {node.status}
        </span>
      </div>

      {/* Stats rows */}
      <div className="p-4 flex flex-col gap-2.5">
        {stats.map(({ label, value }) => (
          <div key={label} className="flex items-start justify-between gap-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 flex-shrink-0 pt-px">
              {label}
            </span>
            <span className="text-xs text-zinc-200 font-mono text-right break-all">{value}</span>
          </div>
        ))}
      </div>

      {/* Token load bar */}
      <div className="px-4 pb-3">
        <div className="text-[10px] uppercase font-bold text-zinc-500 mb-1.5">Token Load</div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (node.tokenCount / 130000) * 100)}%`,
              background: stroke,
              opacity: 0.7,
            }}
          />
        </div>
        <div className="text-[9px] text-zinc-600 mt-1 font-mono">
          {node.tokenCount.toLocaleString()} / 130,000
        </div>
      </div>

      {/* Last message */}
      <div className="px-4 pb-4 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          <MessageSquare size={10} className="text-zinc-500" />
          <span className="text-[10px] uppercase font-bold text-zinc-500">Last Message</span>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed border-l-2 border-zinc-700 pl-2.5 italic">
          "{node.lastMessage}"
        </p>
      </div>
    </div>
  );
}

// ─── Skeleton Loading State ────────────────────────────────────────────────────

function TopologySkeleton() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">
      {/* Toolbar skeleton */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60">
        <Skeleton variant="rect" className="h-5 w-36" />
        <div className="w-px h-4 bg-zinc-700" />
        <div className="flex items-center gap-4">
          <Skeleton variant="rect" className="h-3 w-16 rounded" />
          <Skeleton variant="rect" className="h-3 w-14 rounded" />
          <Skeleton variant="rect" className="h-3 w-10 rounded" />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Skeleton variant="rect" className="h-7 w-24 rounded-full" />
          <Skeleton variant="rect" className="h-7 w-16 rounded-full" />
          <Skeleton variant="rect" className="h-7 w-24 rounded-lg" />
        </div>
      </div>
      {/* SVG canvas placeholder */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="relative w-full max-w-lg aspect-square">
          {/* Simulated ring of skeleton nodes */}
          {Array.from({ length: 6 }).map((_, i) => {
            const angle = (i / 6) * 2 * Math.PI;
            const r = 42;
            const left = `${50 + r * Math.cos(angle)}%`;
            const top = `${50 + r * Math.sin(angle)}%`;
            return (
              <div
                key={i}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left, top }}
              >
                <Skeleton variant="circle" className="w-14 h-14" />
                <Skeleton variant="text" className="h-2 w-12 mt-2 mx-auto" />
              </div>
            );
          })}
          {/* Center skeleton */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
            <Skeleton variant="circle" className="w-8 h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentTopologyMap({ isLoading = false }: { isLoading?: boolean }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [isLive, setIsLive] = useState(true);

  const selectedNode = useMemo(
    () => MOCK_NODES.find((n) => n.id === selectedId) ?? null,
    [selectedId],
  );

  const activeSessions = useMemo(
    () => MOCK_NODES.filter((n) => n.status === 'active').length,
    [],
  );

  const handleNodeClick = useCallback((id: string) => {
    setSelectedId((prev) => (prev === id ? null : id));
  }, []);

  const handleReset = useCallback(() => {
    setSelectedId(null);
    setHoveredId(null);
  }, []);

  if (isLoading) return <TopologySkeleton />;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col">

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-5 py-3 border-b border-zinc-800 bg-zinc-900/60 flex-wrap shrink-0">
        {/* Title */}
        <h1 className="text-base font-bold tracking-tight whitespace-nowrap">
          Agent <span className="text-violet-400">Topology</span>
        </h1>

        <div className="w-px h-4 bg-zinc-700 hidden sm:block" />

        {/* Legend */}
        <div className="flex items-center gap-4 flex-wrap">
          <LegendItem color="#8b5cf6" label="Principal" />
          <LegendItem color="#3b82f6" label="Worker" />
          <LegendItem color="#f59e0b" label="Cron" shape="diamond" />
          <LegendItem color="#6b7280" label="System" />
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          {/* Session count badge */}
          <div className="flex items-center gap-1.5 bg-zinc-800/80 border border-zinc-700 px-2.5 py-1 rounded-full">
            <Users size={11} className="text-zinc-400" />
            <span className="text-xs font-bold text-white">{activeSessions}</span>
            <span className="text-[10px] text-zinc-500">/ {MOCK_NODES.length} active</span>
          </div>

          {/* Live / Paused toggle */}
          <button
            onClick={() => setIsLive((p) => !p)}
            className={cn(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
              isLive
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:bg-zinc-700',
            )}
          >
            {isLive
              ? <><Wifi size={11} /> Live</>
              : <><WifiOff size={11} /> Paused</>
            }
          </button>

          {/* Reset view */}
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 transition-all duration-150 active:scale-95 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
          >
            <RotateCcw size={11} />
            Reset View
          </button>
        </div>
      </div>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden min-h-0">

        {/* SVG canvas */}
        <div className="flex-1 relative overflow-hidden">
          <svg
            viewBox={`0 0 ${VB_W} ${VB_H}`}
            width="100%"
            height="100%"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: 'block' }}
          >
            <defs>
              {/* Dot grid background */}
              <pattern id="atm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#27272a" strokeWidth="0.5" />
              </pattern>

              {/* Glow filter for selected nodes */}
              <filter id="atm-node-glow" x="-60%" y="-60%" width="220%" height="220%">
                <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
                <feFlood floodColor="#8b5cf6" floodOpacity="0.85" result="color" />
                <feComposite in="color" in2="blur" operator="in" result="shadow" />
                <feMerge>
                  <feMergeNode in="shadow" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid fill */}
            <rect width={VB_W} height={VB_H} fill="url(#atm-grid)" />

            {/* ── Edges (rendered below nodes) ─────────────────────────── */}
            <g>
              {MOCK_EDGES.map((edge, i) => {
                const src = NODE_POS[edge.source];
                const tgt = NODE_POS[edge.target];
                if (!src || !tgt) {return null;}
                return (
                  <line
                    key={i}
                    x1={src.x}
                    y1={src.y}
                    x2={tgt.x}
                    y2={tgt.y}
                    stroke={edge.dashed ? '#f59e0b' : '#6366f1'}
                    strokeWidth={1.5}
                    strokeOpacity={0.38}
                    strokeDasharray={edge.dashed ? '5 4' : undefined}
                  />
                );
              })}
            </g>

            {/* ── Nodes ────────────────────────────────────────────────── */}
            <g>
              {MOCK_NODES.map((node) => {
                const pos = NODE_POS[node.id];
                if (!pos) {return null;}
                return (
                  <NodeShape
                    key={node.id}
                    node={node}
                    pos={pos}
                    selected={selectedId === node.id}
                    hovered={hoveredId === node.id}
                    onClick={() => handleNodeClick(node.id)}
                    onMouseEnter={() => setHoveredId(node.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  />
                );
              })}
            </g>
          </svg>

          {/* Node type count overlay (bottom-left) */}
          <div className="absolute bottom-4 left-4 bg-zinc-900/80 backdrop-blur-sm border border-zinc-800 rounded-xl px-3 py-2.5 flex flex-col gap-1.5">
            <span className="text-[9px] uppercase font-bold text-zinc-500 mb-0.5">Node Types</span>
            {([
              { type: 'principal' as NodeType, label: 'Principals', color: '#8b5cf6' },
              { type: 'worker' as NodeType, label: 'Workers', color: '#3b82f6' },
              { type: 'cron' as NodeType, label: 'Crons', color: '#f59e0b' },
            ] as const).map(({ type, label, color }) => {
              const count = MOCK_NODES.filter((n) => n.type === type).length;
              return (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                  <span className="text-[10px] text-zinc-400">{label}</span>
                  <span className="text-[10px] font-bold text-zinc-300 ml-auto pl-3">{count}</span>
                </div>
              );
            })}
          </div>

          {/* Hint when nothing selected */}
          {!selectedId && (
            <div className="absolute bottom-4 right-4 text-[10px] text-zinc-600 bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2.5 py-1.5">
              Click a node to inspect
            </div>
          )}
        </div>

        {/* ── Detail panel (conditionally rendered) ───────────────────── */}
        {selectedNode && (
          <DetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
        )}
      </div>
    </div>
  );
}

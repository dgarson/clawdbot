import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { cn } from '../lib/utils';
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
      {/* WCAG fix: legend swatches are decorative — label text follows */}
      {shape === 'diamond' ? (
        <svg aria-hidden="true" width="12" height="12" viewBox="-7 -7 14 14" style={{ flexShrink: 0 }}>
          <rect
            x="-4.5" y="-4.5" width="9" height="9"
            transform="rotate(45)"
            fill={color}
            opacity={0.85}
          />
        </svg>
      ) : (
        <div
          aria-hidden="true"
          className="rounded-full flex-shrink-0"
          style={{ width: 10, height: 10, background: color, opacity: 0.85 }}
        />
      )}
      <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">{label}</span>
    </div>
  );
}

// ─── Node Shape ───────────────────────────────────────────────────────────────

interface NodeShapeProps {
  node: TopoNode;
  pos: Pos;
  selected: boolean;
  hovered: boolean;
  focused: boolean;
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

function NodeShape({
  node, pos, selected, hovered, focused, onClick, onMouseEnter, onMouseLeave, onFocus, onBlur,
}: NodeShapeProps) {
  const stroke = NODE_STROKE[node.type];
  const fill = hexToRgba(stroke, NODE_FILL_ALPHA);
  const r = NODE_RADIUS[node.type];
  const active = node.status === 'active';
  // WCAG fix: focused state triggers the same scale as hovered, giving a visible focus indicator
  const scale = hovered || selected || focused ? 1.18 : 1;

  // Truncate long labels for small nodes
  const labelText = node.name.length > 14 ? node.name.slice(0, 13) + '…' : node.name;
  const fontSize = node.type === 'principal' ? 10 : 9;
  const fontWeight = node.type === 'principal' ? '700' : '600';
  const labelColor = node.type === 'principal' ? '#e4e4e7' : '#a1a1aa';

  // Label position below shape
  const labelY = node.type === 'cron' ? 22 : r + 13;

  // WCAG fix: keyboard activation — Enter or Space selects the node
  const handleKeyDown = (e: React.KeyboardEvent<SVGGElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  // WCAG fix: accessible label describing type, status, and selection state
  const ariaLabel = `${node.name}, ${node.type}, ${active ? 'active' : 'idle'}${selected ? ', selected' : ''}`;

  return (
    // WCAG fix: tabIndex=0 + role="button" + aria-label + aria-pressed makes SVG nodes fully keyboard-accessible
    <g
      transform={`translate(${pos.x},${pos.y})`}
      style={{ cursor: 'pointer', outline: 'none' }}
      tabIndex={0}
      role="button"
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      {/* Inner group: handles hover/focus scale from node center (0,0) */}
      <g
        style={{
          transform: `scale(${scale})`,
          transformOrigin: '0px 0px',
          transition: 'transform 0.15s ease',
        }}
      >
        {/* Selected/focused glow ring */}
        {(selected || focused) && node.type !== 'cron' && (
          <circle
            r={r + 11}
            fill="none"
            stroke={focused && !selected ? '#a78bfa' : stroke}
            strokeWidth={focused && !selected ? 2 : 3}
            opacity={focused && !selected ? 0.8 : 0.55}
            filter="url(#atm-node-glow)"
          />
        )}
        {(selected || focused) && node.type === 'cron' && (
          <rect
            x={-17} y={-17} width={34} height={34}
            transform="rotate(45)"
            fill="none"
            stroke={focused && !selected ? '#a78bfa' : stroke}
            strokeWidth={focused && !selected ? 2 : 3}
            opacity={focused && !selected ? 0.8 : 0.55}
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

        {/* Status indicator dot (top-right of circle nodes) — color + position (decorative in SVG context) */}
        {node.type !== 'cron' && (
          <circle
            cx={r - 4}
            cy={-(r - 4)}
            r={4}
            fill={active ? '#10b981' : '#52525b'}
            stroke="#09090b"
            strokeWidth={1}
            aria-hidden="true"
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
          aria-hidden="true"
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
    // WCAG fix: role="complementary" + aria-label identifies this as a supplementary info region
    <aside
      role="complementary"
      aria-label={`Details for ${node.name}`}
      className="w-[280px] flex-shrink-0 bg-[var(--color-surface-1)] border-l border-[var(--color-border)] flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-4 border-b border-[var(--color-border)]"
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
            aria-hidden="true"
          >
            {node.name[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-bold text-[var(--color-text-primary)] truncate">{node.name}</div>
            <div className="text-[10px] font-bold uppercase" style={{ color: stroke }}>
              {node.type}
            </div>
          </div>
        </div>
        {/* WCAG fix: icon-only button needs aria-label; X icon is decorative */}
        <button
          onClick={onClose}
          aria-label="Close details panel"
          className="ml-2 flex-shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors p-1 rounded focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
        >
          <X aria-hidden="true" size={14} />
        </button>
      </div>

      {/* Status badge */}
      <div className="px-4 py-2 border-b border-[var(--color-border)]/60 flex items-center gap-2">
        {/* WCAG fix: status dot is decorative — status text label carries the meaning */}
        <div
          aria-hidden="true"
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
            <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] flex-shrink-0 pt-px">
              {label}
            </span>
            <span className="text-xs text-[var(--color-text-primary)] font-mono text-right break-all">{value}</span>
          </div>
        ))}
      </div>

      {/* Token load bar */}
      <div className="px-4 pb-3">
        <div className="text-[10px] uppercase font-bold text-[var(--color-text-muted)] mb-1.5">Token Load</div>
        <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden" role="progressbar" aria-valuenow={node.tokenCount} aria-valuemin={0} aria-valuemax={130000} aria-label={`Token load: ${node.tokenCount.toLocaleString()} of 130,000`}>
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, (node.tokenCount / 130000) * 100)}%`,
              background: stroke,
              opacity: 0.7,
            }}
          />
        </div>
        <div className="text-[9px] text-[var(--color-text-muted)] mt-1 font-mono">
          {node.tokenCount.toLocaleString()} / 130,000
        </div>
      </div>

      {/* Last message */}
      <div className="px-4 pb-4 flex-1">
        <div className="flex items-center gap-1.5 mb-2">
          {/* WCAG fix: decorative icon */}
          <MessageSquare aria-hidden="true" size={10} className="text-[var(--color-text-muted)]" />
          <span className="text-[10px] uppercase font-bold text-[var(--color-text-muted)]">Last Message</span>
        </div>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed border-l-2 border-[var(--color-border)] pl-2.5 italic">
          "{node.lastMessage}"
        </p>
      </div>
    </aside>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AgentTopologyMap() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);
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
    setFocusedId(null);
  }, []);

  // WCAG fix: Escape key closes the detail panel — prevents keyboard trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedNode) {
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedNode]);

  return (
    <>
      {/* WCAG fix: skip link — keyboard users can bypass toolbar */}
      <a
        href="#atm-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-700 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:text-sm focus:font-medium focus:shadow-lg"
      >
        Skip to main content
      </a>

      {/* WCAG fix: <main> landmark identifies the primary content region */}
      <main id="atm-main" className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex flex-col">

        {/* ── Toolbar ──────────────────────────────────────────────────────── */}
        <nav aria-label="Topology toolbar" className="flex items-center gap-4 px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/60 flex-wrap shrink-0">
          {/* Title */}
          <h1 className="text-base font-bold tracking-tight whitespace-nowrap">
            Agent <span className="text-primary">Topology</span>
          </h1>

          <div aria-hidden="true" className="w-px h-4 bg-[var(--color-surface-3)] hidden sm:block" />

          {/* Legend */}
          <div role="list" aria-label="Node type legend" className="flex items-center gap-4 flex-wrap">
            <div role="listitem"><LegendItem color="#8b5cf6" label="Principal" /></div>
            <div role="listitem"><LegendItem color="#3b82f6" label="Worker" /></div>
            <div role="listitem"><LegendItem color="#f59e0b" label="Cron" shape="diamond" /></div>
            <div role="listitem"><LegendItem color="#6b7280" label="System" /></div>
          </div>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Session count badge */}
            <div
              role="status"
              aria-label={`${activeSessions} of ${MOCK_NODES.length} sessions active`}
              className="flex items-center gap-1.5 bg-[var(--color-surface-2)]/80 border border-[var(--color-border)] px-2.5 py-1 rounded-full"
            >
              {/* WCAG fix: decorative icon — label on parent div */}
              <Users aria-hidden="true" size={11} className="text-[var(--color-text-secondary)]" />
              <span className="text-xs font-bold text-[var(--color-text-primary)]">{activeSessions}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">/ {MOCK_NODES.length} active</span>
            </div>

            {/* WCAG fix: Live / Paused toggle — aria-pressed conveys state; aria-label describes action */}
            <button
              onClick={() => setIsLive((p) => !p)}
              aria-pressed={isLive}
              aria-label={isLive ? 'Pause live updates' : 'Resume live updates'}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                isLive
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)]',
              )}
            >
              {/* WCAG fix: toggle icons are decorative — label text ("Live"/"Paused") carries the meaning */}
              {isLive
                ? <><Wifi aria-hidden="true" size={11} /> Live</>
                : <><WifiOff aria-hidden="true" size={11} /> Paused</>
              }
            </button>

            {/* WCAG fix: focus-visible ring on Reset View button; RotateCcw icon is decorative */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] text-[var(--color-text-primary)] transition-all focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
            >
              <RotateCcw aria-hidden="true" size={11} />
              Reset View
            </button>
          </div>
        </nav>

        {/* ── Main content ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* SVG canvas */}
          <div className="flex-1 relative overflow-hidden">
            {/*
              WCAG fix: role="application" on the SVG tells AT this is an interactive widget.
              aria-label describes the widget. Tab-focusable nodes (below) provide the actual
              keyboard interface. Users can Tab through nodes, press Enter/Space to select.
            */}
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              width="100%"
              height="100%"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: 'block' }}
              role="application"
              aria-label="Agent Topology Map — Tab to navigate nodes, Enter or Space to inspect"
            >
              <defs>
                {/* Dot grid background */}
                <pattern id="atm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#27272a" strokeWidth="0.5" />
                </pattern>

                {/* Glow filter for selected/focused nodes */}
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

              {/* Grid fill — decorative background */}
              <rect aria-hidden="true" width={VB_W} height={VB_H} fill="url(#atm-grid)" />

              {/* ── Edges (rendered below nodes) — decorative, no interaction ── */}
              <g aria-hidden="true">
                {MOCK_EDGES.map((edge, i) => {
                  const src = NODE_POS[edge.source];
                  const tgt = NODE_POS[edge.target];
                  if (!src || !tgt) return null;
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

              {/* ── Nodes — each is keyboard-focusable and activatable ──────── */}
              <g>
                {MOCK_NODES.map((node) => {
                  const pos = NODE_POS[node.id];
                  if (!pos) return null;
                  return (
                    <NodeShape
                      key={node.id}
                      node={node}
                      pos={pos}
                      selected={selectedId === node.id}
                      hovered={hoveredId === node.id}
                      focused={focusedId === node.id}
                      onClick={() => handleNodeClick(node.id)}
                      onMouseEnter={() => setHoveredId(node.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      onFocus={() => setFocusedId(node.id)}
                      onBlur={() => setFocusedId(null)}
                    />
                  );
                })}
              </g>
            </svg>

            {/* Node type count overlay (bottom-left) — decorative summary, aria-hidden; data conveyed in legend */}
            <div
              aria-hidden="true"
              className="absolute bottom-4 left-4 bg-[var(--color-surface-1)]/80 backdrop-blur-sm border border-[var(--color-border)] rounded-xl px-3 py-2.5 flex flex-col gap-1.5"
            >
              <span className="text-[9px] uppercase font-bold text-[var(--color-text-muted)] mb-0.5">Node Types</span>
              {([
                { type: 'principal' as NodeType, label: 'Principals', color: '#8b5cf6' },
                { type: 'worker' as NodeType, label: 'Workers', color: '#3b82f6' },
                { type: 'cron' as NodeType, label: 'Crons', color: '#f59e0b' },
              ] as const).map(({ type, label, color }) => {
                const count = MOCK_NODES.filter((n) => n.type === type).length;
                return (
                  <div key={type} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
                    <span className="text-[10px] text-[var(--color-text-secondary)]">{label}</span>
                    <span className="text-[10px] font-bold text-[var(--color-text-primary)] ml-auto pl-3">{count}</span>
                  </div>
                );
              })}
            </div>

            {/* Hint when nothing selected */}
            {!selectedId && (
              <div className="absolute bottom-4 right-4 text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-1)]/60 border border-[var(--color-border)]/60 rounded-lg px-2.5 py-1.5">
                Click a node to inspect
              </div>
            )}
          </div>

          {/* ── Detail panel (conditionally rendered) ───────────────────── */}
          {selectedNode && (
            <DetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
          )}
        </div>
      </main>
    </>
  );
}

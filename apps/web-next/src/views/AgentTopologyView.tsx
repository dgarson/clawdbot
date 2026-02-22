import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import { cn } from "../lib/utils";
import {
  GitBranch,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Filter,
  Search,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "offline" | "error" | "busy" | "sleeping";
type AgentRole =
  | "ceo"
  | "cto"
  | "cmo"
  | "vp"
  | "principal"
  | "lead"
  | "senior"
  | "specialist"
  | "worker";

type RelationshipType =
  | "reports-to"      // hierarchical
  | "spawned"         // subagent spawn
  | "collaborates"    // peer collaboration
  | "delegates";      // task delegation

interface TopologyAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  roleType: AgentRole;
  status: AgentStatus;
  model: string;
  squad?: string;
  currentTask?: string | null;
  messagesPerMin?: number;
  tokenUsage?: number;
}

interface TopologyEdge {
  source: string;
  target: string;
  relationship: RelationshipType;
  label?: string;
  active?: boolean;
}

// Force simulation node
interface SimNode extends SimulationNodeDatum {
  id: string;
  agent: TopologyAgent;
  fx?: number | null;
  fy?: number | null;
}

// Force simulation link
interface SimLink extends SimulationLinkDatum<SimNode> {
  relationship: RelationshipType;
  label?: string;
  active?: boolean;
}

// ─── Mock Data ──────────────────────────────────────────────────────────────

const MOCK_AGENTS: TopologyAgent[] = [
  {
    id: "david",
    name: "David",
    emoji: "👑",
    role: "CEO",
    roleType: "ceo",
    status: "active",
    model: "claude-opus-4-6",
    currentTask: "Strategic planning",
    messagesPerMin: 1.2,
    tokenUsage: 245000,
  },
  {
    id: "xavier",
    name: "Xavier",
    emoji: "🎯",
    role: "CTO",
    roleType: "cto",
    status: "active",
    model: "claude-opus-4-6",
    squad: "Engineering",
    currentTask: "Architecture review",
    messagesPerMin: 2.4,
    tokenUsage: 142800,
  },
  {
    id: "stephan",
    name: "Stephan",
    emoji: "📣",
    role: "CMO",
    roleType: "cmo",
    status: "idle",
    model: "claude-opus-4-6",
    squad: "Marketing",
    messagesPerMin: 0,
    tokenUsage: 38000,
  },
  {
    id: "tim",
    name: "Tim",
    emoji: "🏗️",
    role: "VP Architecture",
    roleType: "vp",
    status: "offline",
    model: "claude-sonnet-4-6",
    squad: "Engineering",
    tokenUsage: 95000,
  },
  {
    id: "luis",
    name: "Luis",
    emoji: "🎨",
    role: "Principal UX Engineer",
    roleType: "principal",
    status: "busy",
    model: "claude-opus-4-6",
    squad: "Product & UI",
    currentTask: "Horizon UI sprint",
    messagesPerMin: 5.1,
    tokenUsage: 189200,
  },
  {
    id: "roman",
    name: "Roman",
    emoji: "⚙️",
    role: "Platform Core Lead",
    roleType: "lead",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Platform",
    currentTask: "Gateway optimization",
    messagesPerMin: 1.8,
    tokenUsage: 112000,
  },
  {
    id: "claire",
    name: "Claire",
    emoji: "📚",
    role: "Documentation Lead",
    roleType: "lead",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Docs",
    currentTask: "API reference update",
    messagesPerMin: 0.9,
    tokenUsage: 54000,
  },
  {
    id: "piper",
    name: "Piper",
    emoji: "🖱️",
    role: "Interaction Designer",
    roleType: "specialist",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Product & UI",
    currentTask: "Micro-interactions",
    messagesPerMin: 3.2,
    tokenUsage: 67000,
  },
  {
    id: "quinn",
    name: "Quinn",
    emoji: "🔄",
    role: "State Management",
    roleType: "specialist",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Product & UI",
    currentTask: "Zustand store architecture",
    messagesPerMin: 2.8,
    tokenUsage: 58000,
  },
  {
    id: "reed",
    name: "Reed",
    emoji: "♿",
    role: "Accessibility Specialist",
    roleType: "specialist",
    status: "idle",
    model: "claude-sonnet-4-6",
    squad: "Product & UI",
    tokenUsage: 43000,
  },
  {
    id: "sam",
    name: "Sam",
    emoji: "✨",
    role: "Motion Designer",
    roleType: "specialist",
    status: "idle",
    model: "claude-sonnet-4-6",
    squad: "Product & UI",
    tokenUsage: 31000,
  },
  {
    id: "wes",
    name: "Wes",
    emoji: "🧱",
    role: "Component Architecture",
    roleType: "specialist",
    status: "busy",
    model: "claude-sonnet-4-6",
    squad: "Product & UI",
    currentTask: "Topology view",
    messagesPerMin: 4.0,
    tokenUsage: 72000,
  },
  {
    id: "harry",
    name: "Harry",
    emoji: "⚡",
    role: "Senior Engineer",
    roleType: "senior",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Platform",
    currentTask: "Plugin system",
    messagesPerMin: 3.6,
    tokenUsage: 88000,
  },
  {
    id: "amadeus",
    name: "Amadeus",
    emoji: "🎵",
    role: "A2A Protocol Engineer",
    roleType: "specialist",
    status: "active",
    model: "claude-sonnet-4-6",
    squad: "Platform",
    currentTask: "A2A SDK",
    messagesPerMin: 2.1,
    tokenUsage: 76000,
  },
  {
    id: "codex",
    name: "Codex",
    emoji: "📖",
    role: "Claude SDK Integration",
    roleType: "specialist",
    status: "sleeping",
    model: "claude-sonnet-4-6",
    squad: "Platform",
    tokenUsage: 22000,
  },
];

const MOCK_EDGES: TopologyEdge[] = [
  // CEO → C-suite
  { source: "david", target: "xavier", relationship: "reports-to", active: true },
  { source: "david", target: "stephan", relationship: "reports-to" },
  // CTO → reports
  { source: "xavier", target: "tim", relationship: "reports-to" },
  { source: "xavier", target: "luis", relationship: "reports-to", active: true },
  { source: "xavier", target: "roman", relationship: "reports-to", active: true },
  { source: "xavier", target: "claire", relationship: "reports-to" },
  // Luis → UX squad
  { source: "luis", target: "piper", relationship: "reports-to", active: true },
  { source: "luis", target: "quinn", relationship: "reports-to", active: true },
  { source: "luis", target: "reed", relationship: "reports-to" },
  { source: "luis", target: "sam", relationship: "reports-to" },
  { source: "luis", target: "wes", relationship: "reports-to", active: true },
  // Roman → Platform squad
  { source: "roman", target: "harry", relationship: "reports-to", active: true },
  { source: "roman", target: "amadeus", relationship: "reports-to", active: true },
  { source: "roman", target: "codex", relationship: "reports-to" },
  // Collaborations
  { source: "luis", target: "roman", relationship: "collaborates", label: "API contract" },
  { source: "reed", target: "wes", relationship: "collaborates", label: "a11y review" },
  { source: "piper", target: "sam", relationship: "collaborates", label: "motion patterns" },
  // Spawn / delegation
  { source: "luis", target: "wes", relationship: "spawned", label: "topology view", active: true },
  { source: "xavier", target: "amadeus", relationship: "delegates", label: "A2A audit" },
];

// ─── Constants ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<AgentStatus, string> = {
  active: "#22c55e",   // green-500
  busy: "#f59e0b",     // amber-500
  idle: "#6b7280",     // gray-500
  offline: "#4b5563",  // gray-600
  error: "#ef4444",    // red-500
  sleeping: "#8b5cf6", // violet-500
};

const ROLE_SIZES: Record<AgentRole, number> = {
  ceo: 32,
  cto: 28,
  cmo: 28,
  vp: 26,
  principal: 26,
  lead: 24,
  senior: 22,
  specialist: 20,
  worker: 18,
};

const EDGE_COLORS: Record<RelationshipType, string> = {
  "reports-to": "hsl(240 5% 35%)",
  spawned: "hsl(263 70% 50%)",
  collaborates: "hsl(200 70% 50%)",
  delegates: "hsl(38 92% 50%)",
};

const EDGE_DASH: Record<RelationshipType, string> = {
  "reports-to": "",
  spawned: "6 3",
  collaborates: "3 3",
  delegates: "8 4 2 4",
};

// ─── Custom Hook: Force Simulation ─────────────────────────────────────────

function useForceSimulation(
  agents: TopologyAgent[],
  edges: TopologyEdge[],
  width: number,
  height: number,
  layout: "force" | "hierarchical"
) {
  const [nodes, setNodes] = useState<SimNode[]>([]);
  const [links, setLinks] = useState<SimLink[]>([]);
  const simRef = useRef<ReturnType<typeof forceSimulation<SimNode>> | null>(null);
  const tickCountRef = useRef(0);

  useEffect(() => {
    if (width === 0 || height === 0) return;

    // Build node objects
    const simNodes: SimNode[] = agents.map((agent) => ({
      id: agent.id,
      agent,
      x: width / 2 + (Math.random() - 0.5) * 200,
      y: height / 2 + (Math.random() - 0.5) * 200,
    }));

    // Build link objects
    const nodeMap = new Map(simNodes.map((n) => [n.id, n]));
    const simLinks: SimLink[] = edges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        relationship: e.relationship,
        label: e.label,
        active: e.active,
      }));

    // Stop existing simulation
    simRef.current?.stop();
    tickCountRef.current = 0;

    const sim = forceSimulation<SimNode>(simNodes)
      .force(
        "link",
        forceLink<SimNode, SimLink>(simLinks)
          .id((d) => d.id)
          .distance((d) => {
            if (d.relationship === "reports-to") return 100;
            if (d.relationship === "spawned") return 80;
            return 120;
          })
          .strength((d) => {
            if (d.relationship === "reports-to") return 0.8;
            return 0.3;
          })
      )
      .force("charge", forceManyBody().strength(-400).distanceMax(400))
      .force("center", forceCenter(width / 2, height / 2).strength(0.05))
      .force("collide", forceCollide<SimNode>().radius((d) => ROLE_SIZES[d.agent.roleType] + 12))
      .force("x", forceX(width / 2).strength(0.03))
      .force("y", forceY(height / 2).strength(0.03))
      .alphaDecay(0.02)
      .velocityDecay(0.4);

    // For hierarchical layout, apply initial Y positioning by rank
    if (layout === "hierarchical") {
      const rankMap: Record<AgentRole, number> = {
        ceo: 0,
        cto: 1,
        cmo: 1,
        vp: 2,
        principal: 2,
        lead: 3,
        senior: 3,
        specialist: 4,
        worker: 5,
      };
      const tierSpacing = height / 7;
      simNodes.forEach((n) => {
        const rank = rankMap[n.agent.roleType] ?? 4;
        n.y = 60 + rank * tierSpacing;
      });
      sim.force("y", forceY<SimNode>((d) => {
        const rank = rankMap[d.agent.roleType] ?? 4;
        return 60 + rank * tierSpacing;
      }).strength(0.5));
    }

    // Batch updates: only update React state every N ticks for perf
    sim.on("tick", () => {
      tickCountRef.current++;
      if (tickCountRef.current % 2 === 0 || sim.alpha() < 0.05) {
        setNodes([...simNodes]);
        setLinks([...simLinks]);
      }
    });

    simRef.current = sim;

    return () => {
      sim.stop();
    };
  }, [agents, edges, width, height, layout]);

  const reheat = useCallback(() => {
    simRef.current?.alpha(0.8).restart();
  }, []);

  const dragStart = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.alphaTarget(0.3).restart();
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      node.fx = node.x;
      node.fy = node.y;
    }
  }, [nodes]);

  const dragMove = useCallback((nodeId: string, x: number, y: number) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      node.fx = x;
      node.fy = y;
    }
  }, [nodes]);

  const dragEnd = useCallback((nodeId: string) => {
    const sim = simRef.current;
    if (!sim) return;
    sim.alphaTarget(0);
    const node = nodes.find((n) => n.id === nodeId);
    if (node) {
      node.fx = null;
      node.fy = null;
    }
  }, [nodes]);

  return { nodes, links, reheat, dragStart, dragMove, dragEnd };
}

// ─── SVG Arrow Marker Defs ─────────────────────────────────────────────────

function ArrowDefs() {
  return (
    <defs>
      {(Object.entries(EDGE_COLORS) as [RelationshipType, string][]).map(
        ([type, color]) => (
          <marker
            key={type}
            id={`arrow-${type}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} />
          </marker>
        )
      )}
      {/* Active variant with glow */}
      {(Object.entries(EDGE_COLORS) as [RelationshipType, string][]).map(
        ([type, color]) => (
          <marker
            key={`${type}-active`}
            id={`arrow-${type}-active`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="8"
            markerHeight="8"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={color} opacity={1} />
          </marker>
        )
      )}
      {/* Glow filter */}
      <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feMerge>
          <feMergeNode in="blur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      {/* Node shadow */}
      <filter id="node-shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="black" floodOpacity="0.5" />
      </filter>
    </defs>
  );
}

// ─── Edge Component ─────────────────────────────────────────────────────────

interface EdgeProps {
  link: SimLink;
  highlighted: boolean;
  dimmed: boolean;
}

const Edge = React.memo(function Edge({ link, highlighted, dimmed }: EdgeProps) {
  const source = link.source as SimNode;
  const target = link.target as SimNode;
  if (!source.x || !source.y || !target.x || !target.y) return null;

  const color = EDGE_COLORS[link.relationship];
  const dash = EDGE_DASH[link.relationship];

  // Calculate edge endpoints offset from node centers (so arrow hits node edge)
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const sourceR = ROLE_SIZES[source.agent.roleType] + 4;
  const targetR = ROLE_SIZES[target.agent.roleType] + 4;

  const x1 = source.x + (dx / dist) * sourceR;
  const y1 = source.y + (dy / dist) * sourceR;
  const x2 = target.x - (dx / dist) * targetR;
  const y2 = target.y - (dy / dist) * targetR;

  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;

  const opacity = dimmed ? 0.1 : link.active || highlighted ? 0.9 : 0.4;
  const strokeWidth = link.active || highlighted ? 2 : 1.2;
  const markerId = `arrow-${link.relationship}${link.active ? "-active" : ""}`;

  return (
    <g className="transition-opacity duration-200" style={{ opacity }}>
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={dash}
        markerEnd={`url(#${markerId})`}
        filter={link.active && highlighted ? "url(#glow)" : undefined}
      />
      {link.label && (highlighted || link.active) && (
        <g transform={`translate(${midX}, ${midY})`}>
          <rect
            x={-link.label.length * 3.5 - 4}
            y={-9}
            width={link.label.length * 7 + 8}
            height={18}
            rx={4}
            fill="hsl(240 10% 8%)"
            stroke={color}
            strokeWidth={0.5}
            opacity={0.95}
          />
          <text
            textAnchor="middle"
            dy="4"
            className="text-[10px]"
            fill="hsl(0 0% 85%)"
            style={{ pointerEvents: "none", userSelect: "none" }}
          >
            {link.label}
          </text>
        </g>
      )}
    </g>
  );
});

// ─── Node Component ─────────────────────────────────────────────────────────

interface NodeProps {
  node: SimNode;
  highlighted: boolean;
  dimmed: boolean;
  focused: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string, x: number, y: number) => void;
  onDragEnd: (id: string) => void;
  transform: { x: number; y: number; scale: number };
}

const AgentNode = React.memo(function AgentNode({
  node,
  highlighted,
  dimmed,
  focused,
  onHover,
  onClick,
  onDragStart,
  onDragMove,
  onDragEnd,
  transform,
}: NodeProps) {
  const { agent } = node;
  const radius = ROLE_SIZES[agent.roleType];
  const statusColor = STATUS_COLORS[agent.status];
  const isDragging = useRef(false);
  const x = node.x ?? 0;
  const y = node.y ?? 0;

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      (e.target as Element).setPointerCapture(e.pointerId);
      onDragStart(node.id);
    },
    [node.id, onDragStart]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      // Convert screen coords to SVG coords accounting for pan/zoom
      const svg = (e.target as Element).closest("svg");
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const svgX = (e.clientX - rect.left - transform.x) / transform.scale;
      const svgY = (e.clientY - rect.top - transform.y) / transform.scale;
      onDragMove(node.id, svgX, svgY);
    },
    [node.id, onDragMove, transform]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!isDragging.current) return;
      isDragging.current = false;
      (e.target as Element).releasePointerCapture(e.pointerId);
      onDragEnd(node.id);
    },
    [node.id, onDragEnd]
  );

  const opacity = dimmed ? 0.15 : 1;
  const scale = highlighted || focused ? 1.1 : 1;

  return (
    <g
      transform={`translate(${x}, ${y}) scale(${scale})`}
      className="cursor-pointer transition-transform duration-150"
      style={{ opacity }}
      onPointerEnter={() => onHover(node.id)}
      onPointerLeave={() => onHover(null)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.id);
      }}
      role="button"
      aria-label={`${agent.name}, ${agent.role}, ${agent.status}`}
      tabIndex={0}
    >
      {/* Outer glow for active/busy */}
      {(agent.status === "active" || agent.status === "busy") && (highlighted || focused) && (
        <circle
          r={radius + 8}
          fill="none"
          stroke={statusColor}
          strokeWidth={1.5}
          opacity={0.3}
          className="animate-pulse"
        />
      )}

      {/* Node background circle */}
      <circle
        r={radius}
        fill="hsl(240 10% 8%)"
        stroke={focused ? "hsl(263 70% 50%)" : highlighted ? "hsl(240 5% 40%)" : "hsl(240 5% 20%)"}
        strokeWidth={focused ? 2.5 : highlighted ? 2 : 1.2}
        filter="url(#node-shadow)"
      />

      {/* Emoji */}
      <text
        textAnchor="middle"
        dy="1"
        style={{
          fontSize: `${radius * 0.85}px`,
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        {agent.emoji}
      </text>

      {/* Status indicator dot */}
      <circle
        cx={radius * 0.7}
        cy={-radius * 0.7}
        r={4.5}
        fill={statusColor}
        stroke="hsl(240 10% 8%)"
        strokeWidth={2}
      />
      {/* Pulsing ring on active status */}
      {agent.status === "active" && (
        <circle
          cx={radius * 0.7}
          cy={-radius * 0.7}
          r={4.5}
          fill="none"
          stroke={statusColor}
          strokeWidth={1}
          opacity={0.6}
          className="animate-ping"
          style={{ transformOrigin: `${radius * 0.7}px ${-radius * 0.7}px` }}
        />
      )}

      {/* Name label */}
      <text
        y={radius + 14}
        textAnchor="middle"
        className="text-[11px] font-medium"
        fill="hsl(0 0% 90%)"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {agent.name}
      </text>

      {/* Role label (only on hover/focus) */}
      {(highlighted || focused) && (
        <text
          y={radius + 26}
          textAnchor="middle"
          className="text-[9px]"
          fill="hsl(240 5% 55%)"
          style={{ pointerEvents: "none", userSelect: "none" }}
        >
          {agent.role}
        </text>
      )}
    </g>
  );
});

// ─── Tooltip Component ──────────────────────────────────────────────────────

interface TooltipProps {
  agent: TopologyAgent;
  x: number;
  y: number;
  svgRect: DOMRect;
  transform: { x: number; y: number; scale: number };
}

function NodeTooltip({ agent, x, y, svgRect, transform }: TooltipProps) {
  const screenX = x * transform.scale + transform.x + svgRect.left;
  const screenY = y * transform.scale + transform.y + svgRect.top;

  // Position tooltip to the right of the node, or left if too close to edge
  const radius = ROLE_SIZES[agent.roleType];
  const tooltipWidth = 220;
  const rightEdge = screenX + radius + tooltipWidth + 20;
  const posRight = rightEdge < window.innerWidth;

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: posRight ? screenX + radius * transform.scale + 16 : screenX - radius * transform.scale - tooltipWidth - 16,
        top: screenY - 40,
      }}
    >
      <div className="bg-card border border-border rounded-lg p-3 shadow-xl w-[220px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{agent.emoji}</span>
          <div>
            <div className="text-sm font-semibold text-foreground">{agent.name}</div>
            <div className="text-xs text-muted-foreground">{agent.role}</div>
          </div>
        </div>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Status</span>
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: STATUS_COLORS[agent.status] }}
              />
              {agent.status}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Model</span>
            <span className="text-foreground font-mono text-[10px]">{agent.model}</span>
          </div>
          {agent.squad && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Squad</span>
              <span className="text-foreground">{agent.squad}</span>
            </div>
          )}
          {agent.currentTask && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Task</span>
              <span className="text-foreground truncate max-w-[120px]">{agent.currentTask}</span>
            </div>
          )}
          {agent.messagesPerMin !== undefined && agent.messagesPerMin > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Activity</span>
              <span className="text-foreground">{agent.messagesPerMin.toFixed(1)} msg/min</span>
            </div>
          )}
          {agent.tokenUsage !== undefined && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tokens</span>
              <span className="text-foreground">{(agent.tokenUsage / 1000).toFixed(0)}k</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Legend ──────────────────────────────────────────────────────────────────

function TopologyLegend({ className }: { className?: string }) {
  return (
    <div className={cn("bg-card/90 backdrop-blur border border-border rounded-lg p-3", className)}>
      <div className="text-xs font-medium text-foreground mb-2">Legend</div>
      <div className="space-y-2">
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Status</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(Object.entries(STATUS_COLORS) as [AgentStatus, string][]).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                {status}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground mb-1">Relationships</div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {(Object.entries(EDGE_COLORS) as [RelationshipType, string][]).map(([type, color]) => (
              <div key={type} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <svg width="20" height="10" className="inline-block">
                  <line
                    x1="0" y1="5" x2="20" y2="5"
                    stroke={color} strokeWidth="2"
                    strokeDasharray={EDGE_DASH[type]}
                  />
                </svg>
                {type}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Panel ────────────────────────────────────────────────────────────

function StatsPanel({ agents, className }: { agents: TopologyAgent[]; className?: string }) {
  const active = agents.filter((a) => a.status === "active" || a.status === "busy").length;
  const idle = agents.filter((a) => a.status === "idle").length;
  const offline = agents.filter((a) => a.status === "offline" || a.status === "sleeping").length;
  const errors = agents.filter((a) => a.status === "error").length;
  const totalTokens = agents.reduce((sum, a) => sum + (a.tokenUsage ?? 0), 0);
  const squads = new Set(agents.map((a) => a.squad).filter(Boolean));

  return (
    <div className={cn("bg-card/90 backdrop-blur border border-border rounded-lg p-3", className)}>
      <div className="text-xs font-medium text-foreground mb-2">Topology Stats</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
        <div className="text-muted-foreground">Total agents</div>
        <div className="text-foreground font-medium text-right">{agents.length}</div>
        <div className="text-muted-foreground">Active / Busy</div>
        <div className="text-green-400 font-medium text-right">{active}</div>
        <div className="text-muted-foreground">Idle</div>
        <div className="text-muted-foreground/80 text-right">{idle}</div>
        <div className="text-muted-foreground">Offline</div>
        <div className="text-muted-foreground/60 text-right">{offline}</div>
        {errors > 0 && (
          <>
            <div className="text-muted-foreground">Errors</div>
            <div className="text-red-400 font-medium text-right">{errors}</div>
          </>
        )}
        <div className="text-muted-foreground">Squads</div>
        <div className="text-foreground text-right">{squads.size}</div>
        <div className="text-muted-foreground">Total tokens</div>
        <div className="text-foreground font-mono text-[10px] text-right">
          {(totalTokens / 1000000).toFixed(1)}M
        </div>
      </div>
    </div>
  );
}

// ─── Main View Component ────────────────────────────────────────────────────

export default function AgentTopologyView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Dimensions
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  // Camera
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  // Interaction state
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [focusedNode, setFocusedNode] = useState<string | null>(null);
  const [layout, setLayout] = useState<"force" | "hierarchical">("force");
  const [showLegend, setShowLegend] = useState(true);
  const [filterStatus, setFilterStatus] = useState<AgentStatus | "all">("all");
  const [searchText, setSearchText] = useState("");
  const [fullscreen, setFullscreen] = useState(false);

  // Filter agents
  const filteredAgents = useMemo(() => {
    let result = MOCK_AGENTS;
    if (filterStatus !== "all") {
      result = result.filter((a) => a.status === filterStatus);
    }
    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.role.toLowerCase().includes(q) ||
          a.squad?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [filterStatus, searchText]);

  // Filter edges to only include edges between visible nodes
  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredAgents.map((a) => a.id));
    return MOCK_EDGES.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));
  }, [filteredAgents]);

  // Force simulation
  const { nodes, links, reheat, dragStart, dragMove, dragEnd } = useForceSimulation(
    filteredAgents,
    filteredEdges,
    dimensions.width,
    dimensions.height,
    layout
  );

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Get neighbors of a node for highlighting
  const getNeighborIds = useCallback(
    (nodeId: string): Set<string> => {
      const ids = new Set<string>();
      ids.add(nodeId);
      links.forEach((l) => {
        const src = (l.source as SimNode).id;
        const tgt = (l.target as SimNode).id;
        if (src === nodeId) ids.add(tgt);
        if (tgt === nodeId) ids.add(src);
      });
      return ids;
    },
    [links]
  );

  const highlightedIds = useMemo(() => {
    const id = hoveredNode ?? focusedNode;
    return id ? getNeighborIds(id) : null;
  }, [hoveredNode, focusedNode, getNeighborIds]);

  // Zoom controls
  const zoom = useCallback((direction: "in" | "out" | "reset") => {
    setTransform((prev) => {
      if (direction === "reset") return { x: 0, y: 0, scale: 1 };
      const factor = direction === "in" ? 1.25 : 0.8;
      const newScale = Math.min(3, Math.max(0.2, prev.scale * factor));
      return { ...prev, scale: newScale };
    });
  }, []);

  // Pan handlers
  const handlePanStart = useCallback((e: React.PointerEvent) => {
    // Only pan on background click (not on nodes)
    if ((e.target as Element).tagName !== "svg" && !(e.target as Element).closest(".topology-bg")) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    (e.target as Element).setPointerCapture(e.pointerId);
  }, [transform]);

  const handlePanMove = useCallback((e: React.PointerEvent) => {
    if (!isPanning.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    setTransform((prev) => ({
      ...prev,
      x: panStart.current.tx + dx,
      y: panStart.current.ty + dy,
    }));
  }, []);

  const handlePanEnd = useCallback((e: React.PointerEvent) => {
    isPanning.current = false;
    (e.target as Element).releasePointerCapture(e.pointerId);
  }, []);

  // Wheel zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.95 : 1.05;
    setTransform((prev) => {
      const newScale = Math.min(3, Math.max(0.2, prev.scale * factor));
      // Zoom toward cursor position
      const svgRect = svgRef.current?.getBoundingClientRect();
      if (!svgRect) return { ...prev, scale: newScale };
      const cx = e.clientX - svgRect.left;
      const cy = e.clientY - svgRect.top;
      return {
        scale: newScale,
        x: cx - (cx - prev.x) * (newScale / prev.scale),
        y: cy - (cy - prev.y) * (newScale / prev.scale),
      };
    });
  }, []);

  // Click on background to deselect
  const handleBgClick = useCallback(() => {
    setFocusedNode(null);
  }, []);

  // Toggle fullscreen
  const toggleFullscreen = useCallback(() => {
    if (!containerRef.current) return;
    if (!fullscreen) {
      containerRef.current.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  }, [fullscreen]);

  // Listen for fullscreen exit via Escape
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // SVG rect for tooltip positioning
  const svgRect = svgRef.current?.getBoundingClientRect();

  // Find hovered/focused agent for tooltip
  const tooltipAgent = hoveredNode
    ? nodes.find((n) => n.id === hoveredNode)
    : null;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Agent Topology</h1>
            <p className="text-xs text-muted-foreground">
              Visualize agent relationships, hierarchies, and communication flows
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search agents..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs bg-secondary border border-border rounded-md text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-primary w-40"
              aria-label="Search agents in topology"
            />
          </div>

          {/* Status filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as AgentStatus | "all")}
            className="text-xs bg-secondary border border-border rounded-md px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            aria-label="Filter by agent status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="busy">Busy</option>
            <option value="idle">Idle</option>
            <option value="offline">Offline</option>
            <option value="sleeping">Sleeping</option>
            <option value="error">Error</option>
          </select>

          {/* Layout toggle */}
          <button
            onClick={() => {
              setLayout((l) => (l === "force" ? "hierarchical" : "force"));
              setTimeout(reheat, 100);
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md border transition-colors",
              "border-border text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            title={`Switch to ${layout === "force" ? "hierarchical" : "force-directed"} layout`}
            aria-label={`Switch to ${layout === "force" ? "hierarchical" : "force-directed"} layout`}
          >
            <Layers className="w-3.5 h-3.5" />
            {layout === "force" ? "Force" : "Hierarchy"}
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Zoom controls */}
          <button
            onClick={() => zoom("out")}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-[10px] text-muted-foreground font-mono w-10 text-center">
            {Math.round(transform.scale * 100)}%
          </span>
          <button
            onClick={() => zoom("in")}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => zoom("reset")}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title="Reset view"
            aria-label="Reset view"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <div className="h-4 w-px bg-border" />

          {/* Legend toggle */}
          <button
            onClick={() => setShowLegend((l) => !l)}
            className={cn(
              "p-1.5 rounded-md transition-colors",
              showLegend
                ? "text-primary bg-primary/10"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
            title="Toggle legend"
            aria-label="Toggle legend"
          >
            <Filter className="w-4 h-4" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-md transition-colors"
            title={fullscreen ? "Exit fullscreen" : "Fullscreen"}
            aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Graph canvas */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-0 overflow-hidden bg-background"
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="select-none"
          onPointerDown={handlePanStart}
          onPointerMove={handlePanMove}
          onPointerUp={handlePanEnd}
          onWheel={handleWheel}
          onClick={handleBgClick}
          role="img"
          aria-label="Agent topology graph showing relationships between agents"
        >
          <ArrowDefs />

          {/* Grid pattern background */}
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="20" cy="20" r="0.5" fill="hsl(240 5% 15%)" />
            </pattern>
          </defs>
          <rect
            className="topology-bg"
            width={dimensions.width}
            height={dimensions.height}
            fill="url(#grid)"
            opacity={0.6}
          />

          {/* Pannable/Zoomable group */}
          <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.scale})`}>
            {/* Edges layer (rendered first = behind nodes) */}
            <g className="edges">
              {links.map((link, i) => {
                const srcId = (link.source as SimNode).id;
                const tgtId = (link.target as SimNode).id;
                const isHighlighted =
                  highlightedIds !== null &&
                  highlightedIds.has(srcId) &&
                  highlightedIds.has(tgtId);
                const isDimmed =
                  highlightedIds !== null && !isHighlighted;
                return (
                  <Edge
                    key={`${srcId}-${tgtId}-${link.relationship}-${i}`}
                    link={link}
                    highlighted={isHighlighted}
                    dimmed={isDimmed}
                  />
                );
              })}
            </g>

            {/* Nodes layer */}
            <g className="nodes">
              {nodes.map((node) => {
                const isHighlighted =
                  highlightedIds !== null && highlightedIds.has(node.id);
                const isDimmed =
                  highlightedIds !== null && !isHighlighted;
                return (
                  <AgentNode
                    key={node.id}
                    node={node}
                    highlighted={isHighlighted || hoveredNode === node.id}
                    dimmed={isDimmed}
                    focused={focusedNode === node.id}
                    onHover={setHoveredNode}
                    onClick={(id) =>
                      setFocusedNode((prev) => (prev === id ? null : id))
                    }
                    onDragStart={dragStart}
                    onDragMove={dragMove}
                    onDragEnd={dragEnd}
                    transform={transform}
                  />
                );
              })}
            </g>
          </g>
        </svg>

        {/* Tooltip (rendered as HTML overlay for better text rendering) */}
        {tooltipAgent && svgRect && (
          <NodeTooltip
            agent={tooltipAgent.agent}
            x={tooltipAgent.x ?? 0}
            y={tooltipAgent.y ?? 0}
            svgRect={svgRect}
            transform={transform}
          />
        )}

        {/* Legend overlay */}
        {showLegend && (
          <TopologyLegend className="absolute bottom-4 left-4" />
        )}

        {/* Stats overlay */}
        <StatsPanel agents={filteredAgents} className="absolute top-4 right-4" />

        {/* Empty state */}
        {filteredAgents.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <GitBranch className="w-12 h-12 opacity-30" />
            <p className="text-sm">No agents match your filters</p>
            <button
              onClick={() => {
                setFilterStatus("all");
                setSearchText("");
              }}
              className="text-xs text-primary hover:underline"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

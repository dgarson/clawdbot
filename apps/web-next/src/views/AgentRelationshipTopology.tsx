import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

type AgentStatus = "active" | "idle" | "busy" | "done" | "error";
type EdgeKind    = "spawn" | "delegate" | "report";
type EventKind   = "spawn" | "delegate" | "complete" | "message" | "error";
type TabId       = "tree" | "map" | "chains" | "events";
type ChainStatus = "active" | "done" | "error";

interface TopoAgent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: AgentStatus;
  model: string;
  tier: number; // 0=exec, 1=lead, 2=worker
}

interface SpawnNode {
  id: string;
  agentId: string;
  sessionId: string;
  parentId: string | null;
  edgeKind: EdgeKind | null;
  task: string;
  startedAt: string;
  duration: string | null;
  messages: number;
  toolCalls: number;
  children: SpawnNode[];
}

interface TopoEdge {
  fromId: string;
  toId: string;
  kind: EdgeKind;
  label: string;
  active: boolean;
}

interface TopoEvent {
  id: string;
  kind: EventKind;
  fromAgentId: string;
  toAgentId: string | null;
  description: string;
  timestamp: string;
  sessionId: string;
}

interface SessionStep {
  agentId: string;
  sessionId: string;
  task: string;
  kind: EdgeKind | "root";
  messages: number;
}

interface SessionChain {
  id: string;
  title: string;
  startedAt: string;
  status: ChainStatus;
  steps: SessionStep[];
}

// ─── Static Data ───────────────────────────────────────────────────────────────

const TOPO_AGENTS: TopoAgent[] = [
  { id: "xavier", name: "Xavier", emoji: "🏗️", role: "CTO",                    status: "active", model: "claude-opus-4-6",   tier: 0 },
  { id: "tim",    name: "Tim",    emoji: "⚙️",  role: "VP Architecture",         status: "busy",   model: "claude-opus-4-6",   tier: 0 },
  { id: "luis",   name: "Luis",   emoji: "🎨",  role: "Principal UX Engineer",   status: "active", model: "claude-sonnet-4-6", tier: 1 },
  { id: "piper",  name: "Piper",  emoji: "🔧",  role: "Component Architecture",  status: "active", model: "claude-sonnet-4-6", tier: 2 },
  { id: "quinn",  name: "Quinn",  emoji: "⚡",  role: "State Management",        status: "busy",   model: "claude-sonnet-4-6", tier: 2 },
  { id: "reed",   name: "Reed",   emoji: "♿",  role: "Accessibility",           status: "active", model: "claude-sonnet-4-6", tier: 2 },
  { id: "wes",    name: "Wes",    emoji: "🚀",  role: "Performance",             status: "idle",   model: "claude-sonnet-4-6", tier: 2 },
  { id: "sam",    name: "Sam",    emoji: "🌐",  role: "Animation",               status: "active", model: "claude-sonnet-4-6", tier: 2 },
];

const SPAWN_TREE: SpawnNode = {
  id: "root",
  agentId: "xavier",
  sessionId: "sess_root_00",
  parentId: null,
  edgeKind: null,
  task: "Orchestrate Horizon UI sprint — ship 50+ dashboard views by sprint close",
  startedAt: "4 hr ago",
  duration: null,
  messages: 12,
  toolCalls: 8,
  children: [
    {
      id: "luis-main",
      agentId: "luis",
      sessionId: "sess_luis_main",
      parentId: "root",
      edgeKind: "delegate",
      task: "Lead Product & UI squad — implement all Horizon view components",
      startedAt: "4 hr ago",
      duration: null,
      messages: 48,
      toolCalls: 127,
      children: [
        {
          id: "quinn-1",
          agentId: "quinn",
          sessionId: "sess_quinn_collab",
          parentId: "luis-main",
          edgeKind: "spawn",
          task: "Build AgentCollaborationGraph component (bs-ux-1)",
          startedAt: "25 min ago",
          duration: "12 min",
          messages: 3,
          toolCalls: 2,
          children: [],
        },
        {
          id: "quinn-2",
          agentId: "quinn",
          sessionId: "sess_quinn_topo",
          parentId: "luis-main",
          edgeKind: "spawn",
          task: "Build AgentRelationshipTopology component (bs-ux-2)",
          startedAt: "2 min ago",
          duration: null,
          messages: 1,
          toolCalls: 0,
          children: [],
        },
        {
          id: "piper-1",
          agentId: "piper",
          sessionId: "sess_piper_team",
          parentId: "luis-main",
          edgeKind: "spawn",
          task: "Build TeamManagement + AgentComparison + ThemeEditor",
          startedAt: "2 hr ago",
          duration: "~45 min",
          messages: 22,
          toolCalls: 31,
          children: [],
        },
        {
          id: "wes-1",
          agentId: "wes",
          sessionId: "sess_wes_export",
          parentId: "luis-main",
          edgeKind: "spawn",
          task: "Build DataExportManager + CrashReporter + WebhookManager",
          startedAt: "3 hr ago",
          duration: "~55 min",
          messages: 19,
          toolCalls: 28,
          children: [
            {
              id: "wes-2",
              agentId: "wes",
              sessionId: "sess_wes_bundle",
              parentId: "wes-1",
              edgeKind: "spawn",
              task: "Sub-task: Analyze bundle size + optimize export chunk",
              startedAt: "3 hr ago",
              duration: "8 min",
              messages: 5,
              toolCalls: 4,
              children: [],
            },
          ],
        },
        {
          id: "reed-1",
          agentId: "reed",
          sessionId: "sess_reed_dev",
          parentId: "luis-main",
          edgeKind: "spawn",
          task: "Build DeveloperConsole + ChangelogView + PermissionsManager",
          startedAt: "2.5 hr ago",
          duration: "~1 hr",
          messages: 28,
          toolCalls: 40,
          children: [],
        },
      ],
    },
    {
      id: "tim-main",
      agentId: "tim",
      sessionId: "sess_tim_arch",
      parentId: "root",
      edgeKind: "delegate",
      task: "Architecture review — Horizon megabranch PRs and frontend constraints",
      startedAt: "3.5 hr ago",
      duration: null,
      messages: 15,
      toolCalls: 22,
      children: [
        {
          id: "tim-sub",
          agentId: "tim",
          sessionId: "sess_tim_diff",
          parentId: "tim-main",
          edgeKind: "spawn",
          task: "Sub-task: Analyze megabranch diff for type safety regressions",
          startedAt: "1 hr ago",
          duration: "22 min",
          messages: 8,
          toolCalls: 12,
          children: [],
        },
      ],
    },
  ],
};

const TOPO_EDGES: TopoEdge[] = [
  { fromId: "xavier", toId: "luis",  kind: "delegate", label: "Horizon sprint",   active: true  },
  { fromId: "xavier", toId: "tim",   kind: "delegate", label: "Arch review",      active: true  },
  { fromId: "tim",    toId: "luis",  kind: "report",   label: "PR coordination",  active: true  },
  { fromId: "luis",   toId: "piper", kind: "spawn",    label: "TeamMgmt suite",   active: false },
  { fromId: "luis",   toId: "quinn", kind: "spawn",    label: "bs-ux-1 + bs-ux-2",active: true  },
  { fromId: "luis",   toId: "reed",  kind: "spawn",    label: "DevConsole suite", active: false },
  { fromId: "luis",   toId: "wes",   kind: "spawn",    label: "DataExport suite", active: false },
  { fromId: "luis",   toId: "sam",   kind: "spawn",    label: "Animation tokens", active: false },
];

// Hierarchical absolute positions for the topology map
const MAP_POS: Readonly<Record<string, { x: number; y: number }>> = {
  xavier: { x: 200, y: 52  },
  tim:    { x: 410, y: 52  },
  luis:   { x: 200, y: 190 },
  piper:  { x: 52,  y: 330 },
  quinn:  { x: 160, y: 330 },
  reed:   { x: 268, y: 330 },
  wes:    { x: 376, y: 330 },
  sam:    { x: 484, y: 330 },
};

const SESSION_CHAINS: SessionChain[] = [
  {
    id: "chain-horizon",
    title: "Horizon Dashboard Sprint",
    startedAt: "4 hr ago",
    status: "active",
    steps: [
      { agentId: "xavier", sessionId: "sess_root_00",   task: "Orchestrate sprint",                kind: "root",     messages: 12 },
      { agentId: "luis",   sessionId: "sess_luis_main", task: "Lead Product & UI squad",           kind: "delegate", messages: 48 },
      { agentId: "quinn",  sessionId: "sess_quinn_topo",task: "Build AgentRelationshipTopology",   kind: "spawn",    messages: 1  },
    ],
  },
  {
    id: "chain-arch",
    title: "Architecture Review",
    startedAt: "3.5 hr ago",
    status: "active",
    steps: [
      { agentId: "xavier", sessionId: "sess_root_00",   task: "Request arch review",               kind: "root",     messages: 5  },
      { agentId: "tim",    sessionId: "sess_tim_arch",  task: "Review megabranch PRs",             kind: "delegate", messages: 15 },
      { agentId: "tim",    sessionId: "sess_tim_diff",  task: "Analyze megabranch diff",           kind: "spawn",    messages: 8  },
    ],
  },
  {
    id: "chain-theme",
    title: "ThemeEditor Handoff",
    startedAt: "2 hr ago",
    status: "done",
    steps: [
      { agentId: "luis",  sessionId: "sess_theme_scope", task: "Scope ThemeEditor requirements",   kind: "root",     messages: 6  },
      { agentId: "piper", sessionId: "sess_piper_theme", task: "Implement ThemeEditor component",  kind: "spawn",    messages: 22 },
    ],
  },
  {
    id: "chain-bundle",
    title: "Bundle Optimization",
    startedAt: "3 hr ago",
    status: "done",
    steps: [
      { agentId: "luis", sessionId: "sess_perf_flag",   task: "Flag performance concern",          kind: "root",     messages: 4  },
      { agentId: "wes",  sessionId: "sess_wes_export",  task: "Audit bundle + DataExport suite",  kind: "spawn",    messages: 19 },
      { agentId: "wes",  sessionId: "sess_wes_bundle",  task: "Deep-dive bundle analysis",        kind: "spawn",    messages: 5  },
    ],
  },
];

const TOPO_EVENTS: TopoEvent[] = [
  { id: "e1",  kind: "spawn",    fromAgentId: "luis",  toAgentId: "quinn",  description: "Spawned subagent: bs-ux-2 AgentRelationshipTopology component",  timestamp: "2 min ago",  sessionId: "sess_quinn_topo"   },
  { id: "e2",  kind: "message",  fromAgentId: "quinn", toAgentId: "luis",   description: "Reported: AgentCollaborationGraph complete — 902 lines, 0 errors", timestamp: "8 min ago",  sessionId: "sess_quinn_collab" },
  { id: "e3",  kind: "spawn",    fromAgentId: "luis",  toAgentId: "quinn",  description: "Spawned subagent: bs-ux-1 AgentCollaborationGraph component",      timestamp: "25 min ago", sessionId: "sess_quinn_collab" },
  { id: "e4",  kind: "message",  fromAgentId: "tim",   toAgentId: "xavier", description: "Architecture review complete — megabranch looks clean, no blockers",timestamp: "45 min ago", sessionId: "sess_tim_arch"     },
  { id: "e5",  kind: "complete", fromAgentId: "piper", toAgentId: null,     description: "Session complete: ThemeEditor + AgentComparison + TeamManagement",  timestamp: "1 hr ago",   sessionId: "sess_piper_team"   },
  { id: "e6",  kind: "complete", fromAgentId: "reed",  toAgentId: null,     description: "Session complete: DeveloperConsole + ChangelogView + Permissions",  timestamp: "1.5 hr ago", sessionId: "sess_reed_dev"     },
  { id: "e7",  kind: "complete", fromAgentId: "wes",   toAgentId: null,     description: "Session complete: DataExportManager + CrashReporter + Webhook",     timestamp: "2 hr ago",   sessionId: "sess_wes_export"   },
  { id: "e8",  kind: "spawn",    fromAgentId: "wes",   toAgentId: "wes",    description: "Self-spawned sub-session: bundle size analysis",                    timestamp: "3 hr ago",   sessionId: "sess_wes_bundle"   },
  { id: "e9",  kind: "spawn",    fromAgentId: "luis",  toAgentId: "piper",  description: "Spawned subagent: TeamManagement + AgentComparison + ThemeEditor",  timestamp: "2 hr ago",   sessionId: "sess_piper_team"   },
  { id: "e10", kind: "spawn",    fromAgentId: "luis",  toAgentId: "wes",    description: "Spawned subagent: DataExportManager + CrashReporter + Webhook",     timestamp: "3 hr ago",   sessionId: "sess_wes_export"   },
  { id: "e11", kind: "spawn",    fromAgentId: "luis",  toAgentId: "reed",   description: "Spawned subagent: DeveloperConsole + ChangelogView + Permissions",  timestamp: "2.5 hr ago", sessionId: "sess_reed_dev"     },
  { id: "e12", kind: "delegate", fromAgentId: "xavier",toAgentId: "luis",   description: "Delegated: Build all Horizon UI views — Product & UI squad lead",   timestamp: "4 hr ago",   sessionId: "sess_luis_main"    },
  { id: "e13", kind: "delegate", fromAgentId: "xavier",toAgentId: "tim",    description: "Delegated: Architecture review for Horizon megabranch",             timestamp: "3.5 hr ago", sessionId: "sess_tim_arch"     },
  { id: "e14", kind: "spawn",    fromAgentId: "tim",   toAgentId: "tim",    description: "Self-spawned sub-session: diff analysis for type safety",           timestamp: "1 hr ago",   sessionId: "sess_tim_diff"     },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTopoAgent(id: string): TopoAgent {
  return TOPO_AGENTS.find(a => a.id === id) ?? TOPO_AGENTS[0];
}

function statusDotClass(status: AgentStatus): string {
  if (status === "active") {return "bg-emerald-400";}
  if (status === "busy")   {return "bg-amber-400";}
  if (status === "error")  {return "bg-rose-400";}
  if (status === "done")   {return "bg-[var(--color-surface-3)]";}
  return "bg-[var(--color-surface-3)]";
}

function statusPillClass(status: AgentStatus): string {
  if (status === "active") {return "text-emerald-400 border-emerald-500/30 bg-emerald-500/10";}
  if (status === "busy")   {return "text-amber-400 border-amber-500/30 bg-amber-500/10";}
  if (status === "error")  {return "text-rose-400 border-rose-500/30 bg-rose-500/10";}
  if (status === "done")   {return "text-[var(--color-text-secondary)] border-[var(--color-surface-3)] bg-[var(--color-surface-3)]";}
  return "text-[var(--color-text-secondary)] border-[var(--color-border)] bg-[var(--color-surface-2)]";
}

function statusText(status: AgentStatus): string {
  if (status === "active") {return "Active";}
  if (status === "busy")   {return "Busy";}
  if (status === "error")  {return "Error";}
  if (status === "done")   {return "Done";}
  return "Idle";
}

function edgeLineColor(kind: EdgeKind): string {
  if (kind === "spawn")    {return "rgba(99,102,241,0.75)";}
  if (kind === "delegate") {return "rgba(251,191,36,0.75)";}
  return "rgba(113,113,122,0.45)";
}

function edgePillClass(kind: EdgeKind): string {
  if (kind === "spawn")    {return "bg-primary/20 text-primary border border-primary/30";}
  if (kind === "delegate") {return "bg-amber-500/20 text-amber-400 border border-amber-500/30";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]";
}

function edgeText(kind: EdgeKind): string {
  if (kind === "spawn")    {return "Spawned";}
  if (kind === "delegate") {return "Delegated";}
  return "Reports To";
}

function eventDotClass(kind: EventKind): string {
  if (kind === "spawn")    {return "bg-primary";}
  if (kind === "delegate") {return "bg-amber-400";}
  if (kind === "complete") {return "bg-emerald-400";}
  if (kind === "error")    {return "bg-rose-400";}
  return "bg-[var(--color-surface-3)]";
}

function eventPillClass(kind: EventKind): string {
  if (kind === "spawn")    {return "bg-primary/20 text-primary";}
  if (kind === "delegate") {return "bg-amber-500/20 text-amber-400";}
  if (kind === "complete") {return "bg-emerald-500/20 text-emerald-400";}
  if (kind === "error")    {return "bg-rose-500/20 text-rose-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}

function eventText(kind: EventKind): string {
  if (kind === "spawn")    {return "Spawned";}
  if (kind === "delegate") {return "Delegated";}
  if (kind === "complete") {return "Completed";}
  if (kind === "error")    {return "Error";}
  return "Message";
}

// ─── CSS-based Edge Line ──────────────────────────────────────────────────────

interface EdgeLineProps {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: EdgeKind;
  highlighted: boolean;
}

function EdgeLine({ x1, y1, x2, y2, kind, highlighted }: EdgeLineProps) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle  = Math.atan2(dy, dx) * (180 / Math.PI);
  const color  = edgeLineColor(kind);
  const opacity = highlighted ? 1 : 0.35;
  const thick   = highlighted ? 2 : 1;

  return (
    <div
      style={{
        position: "absolute",
        left: x1,
        top: y1,
        width: length,
        height: thick,
        backgroundColor: color,
        opacity,
        transformOrigin: "0 50%",
        transform: `rotate(${angle}deg)`,
        pointerEvents: "none",
        transition: "opacity 0.2s ease",
      }}
    />
  );
}

// ─── Map Node ─────────────────────────────────────────────────────────────────

interface MapNodeProps {
  agent: TopoAgent;
  x: number;
  y: number;
  selected: boolean;
  connected: boolean;
  onClick: () => void;
}

function MapNode({ agent, x, y, selected, connected, onClick }: MapNodeProps) {
  const w = 84;
  const h = 58;
  return (
    <div
      onClick={onClick}
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        cursor: "pointer",
        zIndex: selected ? 10 : 5,
      }}
      className={cn(
        "rounded-xl border flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
        selected
          ? "border-primary bg-indigo-900/60 shadow-lg shadow-indigo-500/30"
          : connected
          ? "border-[var(--color-surface-3)] bg-[var(--color-surface-2)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-surface-3)] hover:bg-[var(--color-surface-2)]"
      )}
    >
      <span className="text-lg leading-none">{agent.emoji}</span>
      <span className={cn("text-xs font-semibold leading-none", selected ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-primary)]")}>
        {agent.name}
      </span>
      <div className={cn("w-1.5 h-1.5 rounded-full mt-0.5", statusDotClass(agent.status))} />
    </div>
  );
}

// ─── Selected Agent Panel (used by TopologyMap) ────────────────────────────────

interface SelectedPanelProps {
  agentId: string;
  onClose: () => void;
}

function SelectedAgentPanel({ agentId, onClose }: SelectedPanelProps) {
  const agent    = getTopoAgent(agentId);
  const inbound  = TOPO_EDGES.filter(e => e.toId === agentId);
  const outbound = TOPO_EDGES.filter(e => e.fromId === agentId);

  // Active sessions for this agent
  const activeSessions = TOPO_EVENTS
    .filter(e => e.fromAgentId === agentId && e.kind === "spawn")
    .slice(0, 3);

  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className="text-2xl">{agent.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-[var(--color-text-primary)] font-semibold">{agent.name}</div>
          <div className="text-[var(--color-text-secondary)] text-xs">{agent.role}</div>
        </div>
        <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusPillClass(agent.status))}>
          {statusText(agent.status)}
        </span>
        <button
          onClick={onClose}
          className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors ml-1 text-lg leading-none"
        >
          ×
        </button>
      </div>

      {/* Model + tier */}
      <div className="flex gap-3">
        <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 flex-1 text-center">
          <div className="text-[var(--color-text-primary)] text-xs font-medium">{agent.model}</div>
          <div className="text-[var(--color-text-muted)] text-xs">model</div>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 flex-1 text-center">
          <div className="text-[var(--color-text-primary)] text-xs font-medium">
            {agent.tier === 0 ? "Executive" : agent.tier === 1 ? "Lead" : "Worker"}
          </div>
          <div className="text-[var(--color-text-muted)] text-xs">tier</div>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 flex-1 text-center">
          <div className="text-primary text-xs font-bold">
            {outbound.filter(e => e.kind === "spawn").length}
          </div>
          <div className="text-[var(--color-text-muted)] text-xs">spawns</div>
        </div>
      </div>

      {/* Relationships */}
      <div className="grid grid-cols-2 gap-3">
        {inbound.length > 0 && (
          <div>
            <div className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider mb-2">Reports To</div>
            <div className="space-y-1.5">
              {inbound.map(e => {
                const from = getTopoAgent(e.fromId);
                return (
                  <div key={e.fromId + e.kind} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{from.emoji}</span>
                    <span className="text-[var(--color-text-primary)]">{from.name}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs ml-auto", edgePillClass(e.kind))}>
                      {edgeText(e.kind)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {outbound.length > 0 && (
          <div>
            <div className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider mb-2">Delegates To</div>
            <div className="space-y-1.5">
              {outbound.map(e => {
                const to = getTopoAgent(e.toId);
                return (
                  <div key={e.toId + e.kind} className="flex items-center gap-2 text-xs">
                    <span className="text-base">{to.emoji}</span>
                    <span className="text-[var(--color-text-primary)]">{to.name}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs ml-auto", edgePillClass(e.kind))}>
                      {edgeText(e.kind)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Recent spawns */}
      {activeSessions.length > 0 && (
        <div>
          <div className="text-[var(--color-text-muted)] text-xs font-semibold uppercase tracking-wider mb-2">Recent Spawns</div>
          <div className="space-y-1">
            {activeSessions.map(ev => (
              <div key={ev.id} className="text-xs text-[var(--color-text-secondary)] flex items-start gap-1.5">
                <span className="text-primary mt-0.5 flex-shrink-0">↳</span>
                <span className="leading-relaxed">{ev.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Spawn Tree Node (recursive) ───────────────────────────────────────────────

interface SpawnNodeProps {
  node: SpawnNode;
  depth: number;
}

function SpawnTreeNode({ node, depth }: SpawnNodeProps) {
  const [expanded, setExpanded] = useState(true);
  const agent       = getTopoAgent(node.agentId);
  const hasChildren = node.children.length > 0;

  const cardBorder =
    node.edgeKind === "spawn"    ? "border-indigo-800/50 bg-indigo-950/30" :
    node.edgeKind === "delegate" ? "border-amber-800/50  bg-amber-950/20"  :
    "border-[var(--color-border)] bg-[var(--color-surface-1)]";

  return (
    <div>
      {/* Row: toggle + card */}
      <div className="flex items-start gap-2">
        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          disabled={!hasChildren}
          className={cn(
            "mt-3.5 w-5 h-5 rounded flex items-center justify-center text-sm flex-shrink-0 transition-colors",
            hasChildren
              ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              : "text-[var(--color-text-muted)] cursor-default"
          )}
        >
          {hasChildren ? (expanded ? "▾" : "▸") : "·"}
        </button>

        {/* Node card */}
        <div className={cn("flex-1 rounded-xl border p-3.5 transition-colors", cardBorder)}>
          <div className="flex items-center gap-3">
            <span className="text-xl flex-shrink-0">{agent.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[var(--color-text-primary)] font-semibold text-sm">{agent.name}</span>
                {node.edgeKind && (
                  <span className={cn("px-1.5 py-0.5 rounded text-xs", edgePillClass(node.edgeKind))}>
                    {edgeText(node.edgeKind)}
                  </span>
                )}
                {depth === 0 && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)]">
                    Root
                  </span>
                )}
                <div className={cn("w-2 h-2 rounded-full ml-auto flex-shrink-0", statusDotClass(agent.status))} />
              </div>
              <div className="text-[var(--color-text-secondary)] text-xs mt-0.5 leading-relaxed">{node.task}</div>
            </div>
          </div>

          {/* Metrics row */}
          <div className="flex items-center gap-4 mt-2.5 pt-2.5 border-t border-[var(--color-border)]/60 flex-wrap">
            <span className="text-[var(--color-text-muted)] text-xs flex items-center gap-1">
              <span className="text-[var(--color-text-muted)]">📨</span> {node.messages} msg
            </span>
            <span className="text-[var(--color-text-muted)] text-xs flex items-center gap-1">
              <span className="text-[var(--color-text-muted)]">🔧</span> {node.toolCalls} tools
            </span>
            <span className="text-[var(--color-text-muted)] text-xs">⏱ {node.startedAt}</span>
            {node.duration && (
              <span className="text-[var(--color-text-muted)] text-xs">⌛ {node.duration}</span>
            )}
            {!node.duration && node.edgeKind && (
              <span className="text-emerald-500 text-xs font-medium">● live</span>
            )}
            <span className="text-[var(--color-text-muted)] text-xs font-mono ml-auto">{node.sessionId}</span>
          </div>
        </div>
      </div>

      {/* Children */}
      {expanded && hasChildren && (
        <div className="ml-3 mt-2 pl-4 border-l border-dashed border-[var(--color-border)]/40 space-y-2">
          {node.children.map(child => (
            <SpawnTreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab: Spawn Tree ───────────────────────────────────────────────────────────

function SpawnTree() {
  const totalMessages  = TOPO_EVENTS.filter(e => e.kind === "message").length;
  const activeNodes    = TOPO_AGENTS.filter(a => a.status === "active" || a.status === "busy").length;
  const completedNodes = TOPO_EVENTS.filter(e => e.kind === "complete").length;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold">Agent Spawn Tree</h3>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Hierarchical view of agent spawning and delegation — root orchestrator down to leaf workers
          </p>
        </div>
        {/* Legend */}
        <div className="flex gap-3 text-xs flex-shrink-0">
          {([
            ["spawn",    "Spawned"   ],
            ["delegate", "Delegated" ],
            ["report",   "Reports To"],
          ] as [EdgeKind, string][]).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <span className={cn("px-1.5 py-0.5 rounded", edgePillClass(kind))}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tree */}
      <div className="space-y-2">
        <SpawnTreeNode node={SPAWN_TREE} depth={0} />
      </div>

      {/* Footer stats */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 p-4 grid grid-cols-4 gap-4 text-center">
        {[
          { label: "Total Agents",   value: TOPO_AGENTS.length.toString(), color: "text-[var(--color-text-primary)]" },
          { label: "Active / Busy",  value: `${activeNodes}`,              color: "text-emerald-400" },
          { label: "Completed",      value: `${completedNodes}`,           color: "text-[var(--color-text-secondary)]" },
          { label: "Messages",       value: `${totalMessages}`,            color: "text-primary" },
        ].map(s => (
          <div key={s.label}>
            <div className={cn("text-2xl font-bold", s.color)}>{s.value}</div>
            <div className="text-[var(--color-text-muted)] text-xs">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Tab: Topology Map ─────────────────────────────────────────────────────────

function TopologyMap() {
  const [selected, setSelected] = useState<string | null>(null);

  const containerW = 580;
  const containerH = 400;

  const connectedIds = selected
    ? new Set(
        TOPO_EDGES
          .filter(e => e.fromId === selected || e.toId === selected)
          .flatMap(e => [e.fromId, e.toId])
          .filter(id => id !== selected)
      )
    : new Set<string>();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold">Topology Map</h3>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Structural relationship map — command chain, delegations, spawn graph
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs">
          {([
            ["spawn",    "Spawn"   ],
            ["delegate", "Delegate"],
            ["report",   "Report"  ],
          ] as [EdgeKind, string][]).map(([kind, label]) => (
            <div key={kind} className="flex items-center gap-1.5">
              <div className="w-5 h-0.5" style={{ backgroundColor: edgeLineColor(kind) }} />
              <span className="text-[var(--color-text-muted)]">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Canvas */}
      <div
        className="relative rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-0)] overflow-hidden"
        style={{ width: containerW, height: containerH }}
      >
        {/* Tier label bands */}
        {[
          { top: 0,   h: 122, label: "Executive Tier" },
          { top: 122, h: 136, label: "Lead Tier" },
          { top: 258, h: 142, label: "Worker Tier" },
        ].map(band => (
          <div
            key={band.label}
            style={{ position: "absolute", left: 0, top: band.top, width: "100%", height: band.h }}
            className="border-b border-[var(--color-border)]/40 flex items-end pb-1 pl-2"
          >
            <span className="text-[var(--color-text-muted)] text-xs select-none">{band.label}</span>
          </div>
        ))}

        {/* Edge lines */}
        {TOPO_EDGES.map((edge, i) => {
          const fp = MAP_POS[edge.fromId];
          const tp = MAP_POS[edge.toId];
          if (!fp || !tp) {return null;}
          const isHighlighted =
            selected === null
              ? edge.active
              : edge.fromId === selected || edge.toId === selected;
          return (
            <EdgeLine
              key={i}
              x1={fp.x} y1={fp.y}
              x2={tp.x} y2={tp.y}
              kind={edge.kind}
              highlighted={isHighlighted}
            />
          );
        })}

        {/* Edge labels (mid-point) */}
        {TOPO_EDGES
          .filter(e => selected === null ? e.active : e.fromId === selected || e.toId === selected)
          .map((edge, i) => {
            const fp = MAP_POS[edge.fromId];
            const tp = MAP_POS[edge.toId];
            if (!fp || !tp) {return null;}
            const mx = (fp.x + tp.x) / 2;
            const my = (fp.y + tp.y) / 2;
            return (
              <div
                key={`lbl-${i}`}
                style={{ position: "absolute", left: mx, top: my, transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none" }}
                className="bg-[var(--color-surface-0)] px-1.5 py-0.5 rounded text-xs border border-[var(--color-border)] text-[var(--color-text-muted)] whitespace-nowrap"
              >
                {edge.label}
              </div>
            );
          })}

        {/* Agent nodes */}
        {TOPO_AGENTS.map(agent => {
          const pos = MAP_POS[agent.id];
          if (!pos) {return null;}
          return (
            <MapNode
              key={agent.id}
              agent={agent}
              x={pos.x}
              y={pos.y}
              selected={selected === agent.id}
              connected={connectedIds.has(agent.id)}
              onClick={() => setSelected(selected === agent.id ? null : agent.id)}
            />
          );
        })}

        {/* Empty hint */}
        {!selected && (
          <div
            style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" }}
            className="text-[var(--color-text-muted)] text-xs text-center select-none"
          >
            Click a node to<br />explore relationships
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selected && (
        <SelectedAgentPanel agentId={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

// ─── Tab: Session Chains ───────────────────────────────────────────────────────

function SessionChains() {
  const [open, setOpen] = useState<string | null>("chain-horizon");

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-[var(--color-text-primary)] font-semibold">Session Chains</h3>
        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
          Multi-agent session chains — root orchestration task through to leaf execution
        </p>
      </div>

      <div className="space-y-3">
        {SESSION_CHAINS.map(chain => {
          const isOpen = open === chain.id;
          return (
            <div
              key={chain.id}
              className={cn(
                "rounded-xl border transition-all",
                isOpen ? "border-primary/40 bg-[var(--color-surface-1)]" : "border-[var(--color-border)] bg-[var(--color-surface-1)]/50 hover:border-[var(--color-border)]"
              )}
            >
              {/* Header row */}
              <div
                className="p-4 flex items-center gap-3 cursor-pointer"
                onClick={() => setOpen(isOpen ? null : chain.id)}
              >
                <div className={cn(
                  "w-2.5 h-2.5 rounded-full flex-shrink-0",
                  chain.status === "active" ? "bg-emerald-400"   :
                  chain.status === "error"  ? "bg-rose-400"      :
                  "bg-[var(--color-surface-3)]"
                )} />
                <div className="flex-1 min-w-0">
                  <div className="text-[var(--color-text-primary)] font-medium text-sm">{chain.title}</div>
                  <div className="text-[var(--color-text-muted)] text-xs">
                    {chain.startedAt} · {chain.steps.length} agent{chain.steps.length !== 1 ? "s" : ""}
                    {chain.status === "active" ? " · running" : " · complete"}
                  </div>
                </div>
                <span className="text-[var(--color-text-muted)] text-sm">{isOpen ? "▾" : "▸"}</span>
              </div>

              {/* Step chain */}
              {isOpen && (
                <div className="px-4 pb-5 border-t border-[var(--color-border)]">
                  <div className="pt-4 overflow-x-auto">
                    <div className="flex items-center gap-0 min-w-max">
                      {chain.steps.map((step, i) => {
                        const agent  = getTopoAgent(step.agentId);
                        const isLast = i === chain.steps.length - 1;
                        const cardBorder =
                          step.kind === "spawn"    ? "border-indigo-800/50 bg-indigo-950/30" :
                          step.kind === "delegate" ? "border-amber-800/50  bg-amber-950/20"  :
                          "border-[var(--color-border)] bg-[var(--color-surface-2)]/60";

                        return (
                          <div key={step.sessionId + i} className="flex items-center">
                            {/* Step card */}
                            <div className={cn("rounded-xl border p-3 text-center w-40 flex-shrink-0", cardBorder)}>
                              {/* Kind badge */}
                              {step.kind !== "root" && (
                                <div className={cn("text-xs rounded px-1.5 py-0.5 mb-2 inline-block", edgePillClass(step.kind))}>
                                  {edgeText(step.kind)}
                                </div>
                              )}
                              {step.kind === "root" && (
                                <div className="text-xs rounded px-1.5 py-0.5 mb-2 inline-block bg-[var(--color-surface-3)] text-[var(--color-text-primary)] border border-[var(--color-surface-3)]">
                                  Root
                                </div>
                              )}
                              <div className="text-2xl mb-1">{agent.emoji}</div>
                              <div className="text-[var(--color-text-primary)] text-xs font-semibold">{agent.name}</div>
                              <div className="text-[var(--color-text-secondary)] text-xs mt-1 leading-snug">{step.task}</div>
                              <div className="text-[var(--color-text-muted)] text-xs mt-2">📨 {step.messages}</div>
                              <div className="text-[var(--color-text-muted)] text-xs font-mono mt-0.5 truncate">{step.sessionId}</div>
                            </div>

                            {/* Arrow */}
                            {!isLast && (
                              <div className="flex items-center flex-shrink-0 px-1">
                                <div className="w-5 h-px bg-[var(--color-surface-3)]" />
                                <span className="text-[var(--color-text-muted)] text-xs">▶</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Tab: Event Stream ─────────────────────────────────────────────────────────

function EventStream() {
  const [filter, setFilter] = useState<EventKind | "all">("all");

  const filtered = filter === "all"
    ? TOPO_EVENTS
    : TOPO_EVENTS.filter(e => e.kind === filter);

  const filters: { value: EventKind | "all"; label: string }[] = [
    { value: "all",      label: "All" },
    { value: "spawn",    label: "Spawn" },
    { value: "delegate", label: "Delegate" },
    { value: "complete", label: "Complete" },
    { value: "message",  label: "Message" },
    { value: "error",    label: "Error" },
  ];

  // Counts per kind
  const kindCounts: Partial<Record<EventKind, number>> = {};
  for (const ev of TOPO_EVENTS) {
    kindCounts[ev.kind] = (kindCounts[ev.kind] ?? 0) + 1;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[var(--color-text-primary)] font-semibold">Topology Event Stream</h3>
          <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
            Chronological log of agent spawn, delegation, and lifecycle events
          </p>
        </div>
        <div className="flex gap-1.5 flex-wrap flex-shrink-0">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap",
                filter === f.value
                  ? "bg-primary text-[var(--color-text-primary)]"
                  : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {f.label}
              {f.value !== "all" && kindCounts[f.value] != null && (
                <span className="ml-1 opacity-60">({kindCounts[f.value]})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex gap-2 flex-wrap">
        {[
          { kind: "spawn"    as EventKind, label: "Spawns",     count: kindCounts["spawn"]    ?? 0 },
          { kind: "delegate" as EventKind, label: "Delegations",count: kindCounts["delegate"] ?? 0 },
          { kind: "complete" as EventKind, label: "Completions",count: kindCounts["complete"] ?? 0 },
          { kind: "message"  as EventKind, label: "Messages",   count: kindCounts["message"]  ?? 0 },
        ].map(s => (
          <div
            key={s.kind}
            className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs", eventPillClass(s.kind))}
          >
            <span className="font-bold">{s.count}</span>
            <span className="opacity-70">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-[var(--color-surface-2)]" />

        <div className="space-y-3">
          {filtered.map(event => {
            const from = getTopoAgent(event.fromAgentId);
            const to   = event.toAgentId ? getTopoAgent(event.toAgentId) : null;

            return (
              <div key={event.id} className="flex gap-3 items-start">
                {/* Timeline dot */}
                <div className="w-10 flex-shrink-0 flex justify-center pt-3.5">
                  <div className={cn("w-3 h-3 rounded-full border-2 border-[var(--color-border)] z-10", eventDotClass(event.kind))} />
                </div>

                {/* Card */}
                <div className="flex-1 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-3.5 hover:border-[var(--color-border)] transition-colors">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-base leading-none">{from.emoji}</span>
                    <span className="text-[var(--color-text-primary)] text-sm font-semibold">{from.name}</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", eventPillClass(event.kind))}>
                      {eventText(event.kind)}
                    </span>
                    {to && to.id !== from.id && (
                      <>
                        <span className="text-[var(--color-text-muted)] text-xs">→</span>
                        <span className="text-base leading-none">{to.emoji}</span>
                        <span className="text-[var(--color-text-primary)] text-sm font-semibold">{to.name}</span>
                      </>
                    )}
                    <span className="text-[var(--color-text-muted)] text-xs ml-auto">{event.timestamp}</span>
                  </div>
                  <p className="text-[var(--color-text-secondary)] text-xs leading-relaxed">{event.description}</p>
                  <span className="text-primary/70 text-xs font-mono mt-1.5 block hover:text-primary cursor-pointer transition-colors">
                    {event.sessionId}
                  </span>
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-8 text-center ml-10">
              <div className="text-2xl mb-2">📭</div>
              <div className="text-[var(--color-text-muted)] text-sm">No events match this filter</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Root Component ────────────────────────────────────────────────────────────

export default function AgentRelationshipTopology() {
  const [activeTab, setActiveTab] = useState<TabId>("tree");

  const tabs: { id: TabId; label: string; icon: string }[] = [
    { id: "tree",   label: "Spawn Tree",     icon: "🌲" },
    { id: "map",    label: "Topology Map",   icon: "🗺️" },
    { id: "chains", label: "Session Chains", icon: "🔗" },
    { id: "events", label: "Event Stream",   icon: "📡" },
  ];

  const activeAgents  = TOPO_AGENTS.filter(a => a.status === "active" || a.status === "busy").length;
  const spawnCount    = TOPO_EVENTS.filter(e => e.kind === "spawn").length;
  const edgeCount     = TOPO_EDGES.length;

  const headerStats = [
    { label: "Online",   value: activeAgents, color: "text-emerald-400" },
    { label: "Spawns",   value: spawnCount,   color: "text-primary"  },
    { label: "Edges",    value: edgeCount,    color: "text-amber-400"   },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Agent Relationship Topology</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">
              Visualize how agents spawn, delegate, and coordinate — the living structure of your multi-agent system
            </p>
          </div>
          <div className="flex gap-3 flex-shrink-0">
            {headerStats.map(s => (
              <div
                key={s.label}
                className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] px-4 py-3 text-center"
              >
                <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
                <div className="text-[var(--color-text-muted)] text-xs">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Live indicator */}
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-emerald-400 text-xs font-medium">Live</span>
          <span className="text-[var(--color-text-muted)] text-xs">— topology reflects current sprint session state</span>
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
                  ? "bg-primary text-[var(--color-text-primary)] shadow-lg shadow-indigo-900/50"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              <span className="text-base leading-none">{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6">
          {activeTab === "tree"   && <SpawnTree />}
          {activeTab === "map"    && <TopologyMap />}
          {activeTab === "chains" && <SessionChains />}
          {activeTab === "events" && <EventStream />}
        </div>

      </div>
    </div>
  );
}

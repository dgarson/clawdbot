import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeKind = "trigger" | "condition" | "action" | "delay" | "notify" | "branch" | "end";
type NodeStatus = "active" | "inactive" | "error";
type WorkflowStatus = "active" | "draft" | "paused" | "archived";

interface WorkflowNode {
  id: string;
  kind: NodeKind;
  label: string;
  description: string;
  config: Record<string, string | number | boolean>;
  nextIds: string[]; // node IDs this connects to
  x: number; // percentage-based position
  y: number;
  status: NodeStatus;
}

interface WorkflowRun {
  id: string;
  startedAt: string;
  completedAt: string | null;
  status: "success" | "failed" | "running";
  triggeredBy: string;
  stepsCompleted: number;
  stepsTotal: number;
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  runs: WorkflowRun[];
  createdAt: string;
  lastRunAt: string | null;
  triggerType: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const WORKFLOWS: Workflow[] = [
  {
    id: "wf-1",
    name: "New Agent Onboarding",
    description: "Automatically onboard new agents: notify team, configure access, send welcome package",
    status: "active",
    triggerType: "Event: agent.created",
    createdAt: "2026-01-15",
    lastRunAt: "2026-02-21T14:30:00Z",
    runs: [
      { id: "r1", startedAt: "2026-02-21T14:30:00Z", completedAt: "2026-02-21T14:30:45Z", status: "success", triggeredBy: "agent.created", stepsCompleted: 5, stepsTotal: 5 },
      { id: "r2", startedAt: "2026-02-20T09:15:00Z", completedAt: "2026-02-20T09:15:38Z", status: "success", triggeredBy: "agent.created", stepsCompleted: 5, stepsTotal: 5 },
      { id: "r3", startedAt: "2026-02-18T16:00:00Z", completedAt: "2026-02-18T16:00:12Z", status: "failed", triggeredBy: "agent.created", stepsCompleted: 2, stepsTotal: 5 },
    ],
    nodes: [
      { id: "n1", kind: "trigger", label: "Agent Created", description: "Fires when agent.created event is emitted", config: { eventType: "agent.created" }, nextIds: ["n2"], x: 10, y: 40, status: "active" },
      { id: "n2", kind: "condition", label: "Check Tier", description: "Is the new agent a principal or higher?", config: { field: "tier", op: "in", value: "principal,executive" }, nextIds: ["n3", "n4"], x: 30, y: 40, status: "active" },
      { id: "n3", kind: "action", label: "Notify Amadeus", description: "Send DM to Amadeus with new agent details", config: { target: "amadeus", template: "new-agent-exec" }, nextIds: ["n5"], x: 52, y: 20, status: "active" },
      { id: "n4", kind: "action", label: "Notify Squad Lead", description: "Send DM to relevant squad lead", config: { target: "squad-lead", template: "new-agent-worker" }, nextIds: ["n5"], x: 52, y: 60, status: "active" },
      { id: "n5", kind: "delay", label: "Wait 5 min", description: "Allow setup to complete", config: { duration: 300, unit: "seconds" }, nextIds: ["n6"], x: 72, y: 40, status: "active" },
      { id: "n6", kind: "notify", label: "Welcome Message", description: "Post welcome to #cb-activity", config: { channel: "#cb-activity", template: "welcome" }, nextIds: ["n7"], x: 88, y: 40, status: "active" },
      { id: "n7", kind: "end", label: "Done", description: "Workflow complete", config: {}, nextIds: [], x: 100, y: 40, status: "active" },
    ],
  },
  {
    id: "wf-2",
    name: "Daily Digest",
    description: "Every morning: compile agent activity summary and post to #cb-inbox",
    status: "active",
    triggerType: "Schedule: 0 8 * * *",
    createdAt: "2026-01-20",
    lastRunAt: "2026-02-22T08:00:00Z",
    runs: [
      { id: "r4", startedAt: "2026-02-22T08:00:00Z", completedAt: "2026-02-22T08:00:22Z", status: "success", triggeredBy: "schedule", stepsCompleted: 4, stepsTotal: 4 },
      { id: "r5", startedAt: "2026-02-21T08:00:00Z", completedAt: "2026-02-21T08:00:18Z", status: "success", triggeredBy: "schedule", stepsCompleted: 4, stepsTotal: 4 },
    ],
    nodes: [
      { id: "n1", kind: "trigger", label: "Daily Schedule", description: "Runs at 8:00 AM every day", config: { cron: "0 8 * * *" }, nextIds: ["n2"], x: 10, y: 50, status: "active" },
      { id: "n2", kind: "action", label: "Fetch Activity", description: "Query last 24h agent runs and tasks", config: { lookback: "24h", include: "all-squads" }, nextIds: ["n3"], x: 35, y: 50, status: "active" },
      { id: "n3", kind: "action", label: "Compile Digest", description: "Format activity into digest template", config: { template: "daily-digest", format: "markdown" }, nextIds: ["n4"], x: 62, y: 50, status: "active" },
      { id: "n4", kind: "notify", label: "Post to Inbox", description: "Post digest to #cb-inbox", config: { channel: "#cb-inbox", mention: "here" }, nextIds: [], x: 88, y: 50, status: "active" },
    ],
  },
  {
    id: "wf-3",
    name: "Error Escalation",
    description: "When an agent reports an error, escalate based on severity and retry count",
    status: "active",
    triggerType: "Event: agent.error",
    createdAt: "2026-02-01",
    lastRunAt: "2026-02-22T02:15:00Z",
    runs: [
      { id: "r6", startedAt: "2026-02-22T02:15:00Z", completedAt: "2026-02-22T02:15:05Z", status: "success", triggeredBy: "agent.error", stepsCompleted: 3, stepsTotal: 3 },
      { id: "r7", startedAt: "2026-02-21T18:30:00Z", completedAt: null, status: "running", triggeredBy: "agent.error", stepsCompleted: 1, stepsTotal: 3 },
    ],
    nodes: [
      { id: "n1", kind: "trigger", label: "Agent Error", description: "Fires on agent.error event", config: { eventType: "agent.error" }, nextIds: ["n2"], x: 8, y: 50, status: "active" },
      { id: "n2", kind: "condition", label: "Retry Count", description: "Has this error occurred >3 times?", config: { field: "retryCount", op: "gt", value: "3" }, nextIds: ["n3", "n4"], x: 30, y: 50, status: "active" },
      { id: "n3", kind: "action", label: "Auto Retry", description: "Schedule an automatic retry in 30s", config: { delay: 30, maxRetries: 3 }, nextIds: ["n6"], x: 55, y: 25, status: "active" },
      { id: "n4", kind: "condition", label: "Severity Check", description: "Is severity CRITICAL?", config: { field: "severity", op: "eq", value: "critical" }, nextIds: ["n5", "n6"], x: 55, y: 70, status: "active" },
      { id: "n5", kind: "notify", label: "Page On-Call", description: "PagerDuty alert to on-call engineer", config: { integration: "pagerduty", urgency: "high" }, nextIds: ["n6"], x: 78, y: 55, status: "active" },
      { id: "n6", kind: "end", label: "Done", description: "Workflow complete", config: {}, nextIds: [], x: 95, y: 50, status: "active" },
    ],
  },
];

const NODE_CONFIG: Record<NodeKind, { emoji: string; color: string; bg: string; border: string; label: string }> = {
  trigger: { emoji: "⚡", color: "text-amber-400", bg: "bg-amber-900/30", border: "border-amber-600/50", label: "Trigger" },
  condition: { emoji: "🔀", color: "text-blue-400", bg: "bg-blue-900/30", border: "border-blue-600/50", label: "Condition" },
  action: { emoji: "⚙️", color: "text-indigo-400", bg: "bg-indigo-900/30", border: "border-indigo-600/50", label: "Action" },
  delay: { emoji: "⏱️", color: "text-purple-400", bg: "bg-purple-900/30", border: "border-purple-600/50", label: "Delay" },
  notify: { emoji: "🔔", color: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-600/50", label: "Notify" },
  branch: { emoji: "🌿", color: "text-teal-400", bg: "bg-teal-900/30", border: "border-teal-600/50", label: "Branch" },
  end: { emoji: "🏁", color: "text-zinc-400", bg: "bg-zinc-800/50", border: "border-zinc-600/50", label: "End" },
};

const STATUS_CONFIG: Record<WorkflowStatus, { label: string; color: string; dot: string }> = {
  active: { label: "Active", color: "text-emerald-400", dot: "bg-emerald-400" },
  draft: { label: "Draft", color: "text-zinc-400", dot: "bg-zinc-400" },
  paused: { label: "Paused", color: "text-amber-400", dot: "bg-amber-400" },
  archived: { label: "Archived", color: "text-zinc-600", dot: "bg-zinc-600" },
};

const RUN_STATUS_CONFIG = {
  success: { label: "Success", color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-700/50" },
  failed: { label: "Failed", color: "text-rose-400", bg: "bg-rose-900/30 border-rose-700/50" },
  running: { label: "Running", color: "text-amber-400", bg: "bg-amber-900/30 border-amber-700/50" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkflowBuilder() {
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow>(WORKFLOWS[0]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [activeTab, setActiveTab] = useState<"canvas" | "runs" | "settings">("canvas");
  const [isAddingNode, setIsAddingNode] = useState(false);

  const wf = selectedWorkflow;
  const st = STATUS_CONFIG[wf.status];

  const totalRuns = WORKFLOWS.reduce((s, w) => s + w.runs.length, 0);
  const successRuns = WORKFLOWS.reduce((s, w) => s + w.runs.filter((r) => r.status === "success").length, 0);
  const activeWfs = WORKFLOWS.filter((w) => w.status === "active").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Workflow Builder</h1>
            <p className="text-sm text-zinc-400">Automate agent operations with visual workflows</p>
          </div>
          <button
            onClick={() => setIsAddingNode(!isAddingNode)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-sm font-medium"
          >
            + New Workflow
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total Workflows", value: WORKFLOWS.length, color: "text-white" },
            { label: "Active", value: activeWfs, color: "text-emerald-400" },
            { label: "Total Runs", value: totalRuns, color: "text-indigo-400" },
            { label: "Success Rate", value: `${Math.round((successRuns / totalRuns) * 100)}%`, color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Sidebar: workflow list */}
        <div className="flex-shrink-0 w-64 border-r border-zinc-800 flex flex-col overflow-hidden">
          <div className="p-3 border-b border-zinc-800">
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide px-1 mb-2">Workflows</div>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {WORKFLOWS.map((workflow) => {
              const ws = STATUS_CONFIG[workflow.status];
              const isSelected = selectedWorkflow.id === workflow.id;
              const lastRun = workflow.runs.find((r) => r.status === "running") ?? workflow.runs[0];
              return (
                <button
                  key={workflow.id}
                  onClick={() => { setSelectedWorkflow(workflow); setSelectedNode(null); setActiveTab("canvas"); }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all",
                    isSelected
                      ? "bg-indigo-900/30 border-indigo-600/60"
                      : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-white truncate">{workflow.name}</span>
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0 ml-2", ws.dot)} />
                  </div>
                  <div className="text-xs text-zinc-500 mb-2 leading-relaxed truncate">{workflow.description}</div>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{workflow.nodes.length} nodes</span>
                    <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{workflow.runs.length} runs</span>
                    {lastRun && (
                      <span className={cn(
                        "px-1.5 py-0.5 rounded border",
                        RUN_STATUS_CONFIG[lastRun.status].bg,
                        RUN_STATUS_CONFIG[lastRun.status].color
                      )}>
                        {RUN_STATUS_CONFIG[lastRun.status].label}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Node palette */}
          <div className="border-t border-zinc-800 p-3">
            <div className="text-xs text-zinc-500 font-medium uppercase tracking-wide px-1 mb-2">Node Types</div>
            <div className="grid grid-cols-2 gap-1">
              {(Object.keys(NODE_CONFIG) as NodeKind[]).filter((k) => k !== "end").map((kind) => {
                const nc = NODE_CONFIG[kind];
                return (
                  <div
                    key={kind}
                    className={cn(
                      "flex items-center gap-1.5 px-2 py-1.5 rounded border cursor-default text-[11px]",
                      nc.bg, nc.border, nc.color
                    )}
                  >
                    <span>{nc.emoji}</span>
                    <span>{nc.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Workflow header */}
          <div className="flex-shrink-0 px-5 py-3 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-base font-semibold text-white">{wf.name}</h2>
                <span className={cn("flex items-center gap-1.5 text-xs", st.color)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", st.dot)} />
                  {st.label}
                </span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{wf.triggerType} · {wf.nodes.length} nodes</div>
            </div>
            <div className="flex items-center gap-2">
              {(["canvas", "runs", "settings"] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    "px-3 py-1.5 rounded text-sm capitalize",
                    activeTab === tab ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
              <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded text-sm ml-2">
                ▶ Run Now
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-hidden flex">
            {/* Canvas / content */}
            <div className="flex-1 overflow-auto">
              {activeTab === "canvas" && (
                <div className="relative bg-zinc-950" style={{ height: 480, minWidth: 900 }}>
                  {/* Grid background */}
                  <div
                    className="absolute inset-0 opacity-10"
                    style={{
                      backgroundImage: "radial-gradient(circle, #71717a 1px, transparent 1px)",
                      backgroundSize: "24px 24px",
                    }}
                  />

                  {/* Draw edges using absolute positioned divs */}
                  {wf.nodes.map((node) =>
                    node.nextIds.map((nextId) => {
                      const target = wf.nodes.find((n) => n.id === nextId);
                      if (!target) {return null;}
                      const x1 = node.x;
                      const y1 = node.y;
                      const x2 = target.x;
                      const y2 = target.y;
                      const midX = (x1 + x2) / 2;
                      const dy = y2 - y1;
                      const isDownward = dy > 5;
                      const isUpward = dy < -5;

                      return (
                        <div key={`${node.id}->${nextId}`} className="absolute inset-0 pointer-events-none">
                          {/* Horizontal segment from source */}
                          <div
                            className="absolute bg-zinc-600"
                            style={{
                              left: `calc(${x1}% + 68px)`,
                              top: `calc(${y1}% + 18px)`,
                              width: `calc(${midX - x1}% - 68px + ${Math.abs(midX - x2) < 5 ? 0 : 0}px)`,
                              height: 1.5,
                            }}
                          />
                          {/* Vertical segment */}
                          {Math.abs(dy) > 3 && (
                            <div
                              className="absolute bg-zinc-600"
                              style={{
                                left: `${midX}%`,
                                top: `calc(${Math.min(y1, y2)}% + 18px)`,
                                width: 1.5,
                                height: `calc(${Math.abs(dy)}% + ${isDownward ? 0 : 0}px)`,
                              }}
                            />
                          )}
                          {/* Horizontal segment to target */}
                          <div
                            className="absolute bg-zinc-600"
                            style={{
                              left: `${midX}%`,
                              top: `calc(${y2}% + 18px)`,
                              width: `calc(${x2 - midX}%)`,
                              height: 1.5,
                            }}
                          />
                          {/* Arrow */}
                          <div
                            className="absolute text-zinc-600 text-xs"
                            style={{
                              left: `calc(${x2}% - 6px)`,
                              top: `calc(${y2}% + 13px)`,
                            }}
                          >
                            ▶
                          </div>
                        </div>
                      );
                    })
                  )}

                  {/* Nodes */}
                  {wf.nodes.map((node) => {
                    const nc = NODE_CONFIG[node.kind];
                    const isSelected = selectedNode?.id === node.id;
                    return (
                      <button
                        key={node.id}
                        onClick={() => setSelectedNode(isSelected ? null : node)}
                        className={cn(
                          "absolute flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-left",
                          "w-32",
                          nc.bg, nc.border,
                          isSelected
                            ? "ring-2 ring-indigo-400 ring-offset-1 ring-offset-zinc-950 shadow-lg shadow-indigo-900/30"
                            : "hover:brightness-110"
                        )}
                        style={{
                          left: `${node.x}%`,
                          top: `${node.y}%`,
                          transform: "translateY(-50%)",
                          zIndex: isSelected ? 10 : 1,
                        }}
                      >
                        <span className="text-xl">{nc.emoji}</span>
                        <span className={cn("text-xs font-semibold leading-tight text-center", nc.color)}>
                          {node.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 text-center leading-tight">
                          {nc.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "runs" && (
                <div className="p-5 space-y-3">
                  <div className="text-sm font-medium text-white mb-3">Run History</div>
                  {wf.runs.map((run) => {
                    const rs = RUN_STATUS_CONFIG[run.status];
                    const duration = run.completedAt
                      ? `${Math.round((new Date(run.completedAt).getTime() - new Date(run.startedAt).getTime()) / 1000)}s`
                      : "Running…";
                    const progressPct = Math.round((run.stepsCompleted / run.stepsTotal) * 100);
                    return (
                      <div
                        key={run.id}
                        className={cn("rounded-xl border p-4", rs.bg)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className={cn("text-sm font-semibold", rs.color)}>
                              {rs.label}
                            </span>
                            <span className="text-xs text-zinc-500">{run.id}</span>
                          </div>
                          <span className="text-xs text-zinc-500">{duration}</span>
                        </div>
                        <div className="text-xs text-zinc-400 mb-2">
                          Triggered by <span className="text-zinc-300">{run.triggeredBy}</span> · {run.startedAt.slice(0, 16).replace("T", " ")}
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={cn("h-full rounded-full", run.status === "success" ? "bg-emerald-500" : run.status === "failed" ? "bg-rose-500" : "bg-amber-500")}
                              style={{ width: `${progressPct}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{run.stepsCompleted}/{run.stepsTotal} steps</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {activeTab === "settings" && (
                <div className="p-5 max-w-lg space-y-4">
                  <div className="text-sm font-medium text-white mb-3">Workflow Settings</div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Name</label>
                      <input
                        type="text"
                        defaultValue={wf.name}
                        className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-full"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Description</label>
                      <textarea
                        defaultValue={wf.description}
                        className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-full resize-none"
                        rows={3}
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Trigger</label>
                      <input
                        type="text"
                        defaultValue={wf.triggerType}
                        className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-full font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400 block mb-1">Status</label>
                      <select className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-full" defaultValue={wf.status}>
                        <option value="active">Active</option>
                        <option value="paused">Paused</option>
                        <option value="draft">Draft</option>
                        <option value="archived">Archived</option>
                      </select>
                    </div>
                    <div className="flex gap-2 pt-2">
                      <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm">Save Changes</button>
                      <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded text-sm">Cancel</button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Node detail panel */}
            {selectedNode && activeTab === "canvas" && (
              <div className="flex-shrink-0 w-72 border-l border-zinc-800 bg-zinc-900 overflow-y-auto p-4">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className={cn("text-xs font-medium mb-1", NODE_CONFIG[selectedNode.kind].color)}>
                      {NODE_CONFIG[selectedNode.kind].emoji} {NODE_CONFIG[selectedNode.kind].label}
                    </div>
                    <h3 className="text-base font-semibold text-white">{selectedNode.label}</h3>
                    <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{selectedNode.description}</p>
                  </div>
                  <button onClick={() => setSelectedNode(null)} className="text-zinc-500 hover:text-white ml-2">✕</button>
                </div>

                {/* Config */}
                {Object.keys(selectedNode.config).length > 0 && (
                  <div className="mb-4">
                    <div className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wide">Configuration</div>
                    <div className="space-y-2">
                      {Object.entries(selectedNode.config).map(([key, val]) => (
                        <div key={key}>
                          <label className="text-[11px] text-zinc-500 block mb-1 capitalize">{key.replace(/([A-Z])/g, " $1")}</label>
                          <input
                            type="text"
                            defaultValue={String(val)}
                            className="bg-zinc-800 border border-zinc-700 text-white rounded px-2.5 py-1.5 text-xs w-full font-mono"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Connections */}
                <div className="mb-4">
                  <div className="text-xs text-zinc-500 font-medium mb-2 uppercase tracking-wide">Connections Out</div>
                  {selectedNode.nextIds.length === 0 ? (
                    <div className="text-xs text-zinc-600">Terminal node — no outgoing connections</div>
                  ) : (
                    <div className="space-y-1">
                      {selectedNode.nextIds.map((nextId) => {
                        const target = wf.nodes.find((n) => n.id === nextId);
                        return target ? (
                          <button
                            key={nextId}
                            onClick={() => setSelectedNode(target)}
                            className="flex items-center gap-2 bg-zinc-800 rounded px-2.5 py-1.5 w-full text-left hover:bg-zinc-700 transition-colors"
                          >
                            <span>{NODE_CONFIG[target.kind].emoji}</span>
                            <span className="text-xs text-zinc-300">{target.label}</span>
                            <span className={cn("text-[10px] ml-auto", NODE_CONFIG[target.kind].color)}>{NODE_CONFIG[target.kind].label}</span>
                          </button>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3 border-t border-zinc-800">
                  <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs">Save</button>
                  <button className="flex-1 bg-rose-900/40 hover:bg-rose-900/60 text-rose-400 border border-rose-700/50 py-1.5 rounded text-xs">Delete</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type NodeStatus = "healthy" | "degraded" | "down";
type NodeType = "cdn" | "load-balancer" | "web" | "api" | "database" | "cache" | "queue" | "external";
type ViewMode = "topology" | "list" | "connections";
type SortField = "name" | "type" | "status" | "uptime" | "requestRate" | "responseTime";
type SortDir = "asc" | "desc";

interface TopoNode {
  id: string;
  name: string;
  type: NodeType;
  hostname: string;
  ip: string;
  status: NodeStatus;
  uptime: number;
  requestRate: number;
  responseTime: number;
  connections: string[];
  /** Position on the topology canvas (percent-based) */
  x: number;
  y: number;
}

interface Edge {
  from: string;
  to: string;
  latency: number;
  throughput: number;
}

// ── Static data ────────────────────────────────────────────────────────────

const NODES: TopoNode[] = [
  {
    id: "cdn-1",
    name: "CloudFront CDN",
    type: "cdn",
    hostname: "cdn.horizon.io",
    ip: "13.224.60.12",
    status: "healthy",
    uptime: 99.99,
    requestRate: 24800,
    responseTime: 8,
    connections: ["lb-1"],
    x: 50,
    y: 2,
  },
  {
    id: "lb-1",
    name: "HAProxy LB",
    type: "load-balancer",
    hostname: "lb-01.horizon.internal",
    ip: "10.0.1.10",
    status: "healthy",
    uptime: 99.97,
    requestRate: 18200,
    responseTime: 2,
    connections: ["web-1", "web-2", "web-3"],
    x: 50,
    y: 16,
  },
  {
    id: "web-1",
    name: "Web Server 1",
    type: "web",
    hostname: "web-01.horizon.internal",
    ip: "10.0.2.11",
    status: "healthy",
    uptime: 99.94,
    requestRate: 6100,
    responseTime: 18,
    connections: ["api-1", "api-2"],
    x: 18,
    y: 32,
  },
  {
    id: "web-2",
    name: "Web Server 2",
    type: "web",
    hostname: "web-02.horizon.internal",
    ip: "10.0.2.12",
    status: "healthy",
    uptime: 99.91,
    requestRate: 5900,
    responseTime: 21,
    connections: ["api-1", "api-2"],
    x: 50,
    y: 32,
  },
  {
    id: "web-3",
    name: "Web Server 3",
    type: "web",
    hostname: "web-03.horizon.internal",
    ip: "10.0.2.13",
    status: "degraded",
    uptime: 98.72,
    requestRate: 4300,
    responseTime: 45,
    connections: ["api-1", "api-2"],
    x: 82,
    y: 32,
  },
  {
    id: "api-1",
    name: "API Server 1",
    type: "api",
    hostname: "api-01.horizon.internal",
    ip: "10.0.3.21",
    status: "healthy",
    uptime: 99.95,
    requestRate: 9400,
    responseTime: 34,
    connections: ["db-primary", "cache-1", "mq-1"],
    x: 30,
    y: 50,
  },
  {
    id: "api-2",
    name: "API Server 2",
    type: "api",
    hostname: "api-02.horizon.internal",
    ip: "10.0.3.22",
    status: "healthy",
    uptime: 99.88,
    requestRate: 8700,
    responseTime: 37,
    connections: ["db-primary", "cache-1", "mq-1", "s3-1"],
    x: 70,
    y: 50,
  },
  {
    id: "db-primary",
    name: "PostgreSQL Primary",
    type: "database",
    hostname: "pg-primary.horizon.internal",
    ip: "10.0.4.31",
    status: "healthy",
    uptime: 99.99,
    requestRate: 12300,
    responseTime: 4,
    connections: ["db-replica"],
    x: 22,
    y: 70,
  },
  {
    id: "db-replica",
    name: "PostgreSQL Replica",
    type: "database",
    hostname: "pg-replica.horizon.internal",
    ip: "10.0.4.32",
    status: "healthy",
    uptime: 99.98,
    requestRate: 7100,
    responseTime: 5,
    connections: [],
    x: 22,
    y: 88,
  },
  {
    id: "cache-1",
    name: "Redis Cache",
    type: "cache",
    hostname: "redis-01.horizon.internal",
    ip: "10.0.5.41",
    status: "healthy",
    uptime: 99.96,
    requestRate: 31200,
    responseTime: 1,
    connections: [],
    x: 50,
    y: 70,
  },
  {
    id: "mq-1",
    name: "RabbitMQ",
    type: "queue",
    hostname: "mq-01.horizon.internal",
    ip: "10.0.5.51",
    status: "degraded",
    uptime: 97.84,
    requestRate: 4500,
    responseTime: 12,
    connections: ["s3-1"],
    x: 68,
    y: 70,
  },
  {
    id: "s3-1",
    name: "AWS S3 Bucket",
    type: "external",
    hostname: "horizon-assets.s3.amazonaws.com",
    ip: "52.216.133.37",
    status: "healthy",
    uptime: 99.99,
    requestRate: 2200,
    responseTime: 22,
    connections: [],
    x: 85,
    y: 88,
  },
];

function buildEdges(nodes: TopoNode[]): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    for (const targetId of node.connections) {
      const key = [node.id, targetId].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({
        from: node.id,
        to: targetId,
        latency: Math.round((Math.random() * 8 + 1) * 10) / 10,
        throughput: Math.round(Math.random() * 800 + 50),
      });
    }
  }
  return edges;
}

const EDGES: Edge[] = buildEdges(NODES);

// ── Helpers ────────────────────────────────────────────────────────────────

const statusColor: Record<NodeStatus, string> = {
  healthy: "bg-emerald-400",
  degraded: "bg-amber-400",
  down: "bg-rose-400",
};

const statusTextColor: Record<NodeStatus, string> = {
  healthy: "text-emerald-400",
  degraded: "text-amber-400",
  down: "text-rose-400",
};

const typeEmoji: Record<NodeType, string> = {
  cdn: "🌐",
  "load-balancer": "⚖️",
  web: "🖥️",
  api: "⚡",
  database: "🗄️",
  cache: "💾",
  queue: "📨",
  external: "☁️",
};

const typeLabel: Record<NodeType, string> = {
  cdn: "CDN",
  "load-balancer": "Load Balancer",
  web: "Web Server",
  api: "API Server",
  database: "Database",
  cache: "Cache",
  queue: "Message Queue",
  external: "External",
};

function nameById(id: string): string {
  return NODES.find((n) => n.id === id)?.name ?? id;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function StatusLegend() {
  return (
    <div className="flex items-center gap-5 text-xs text-zinc-400">
      {(["healthy", "degraded", "down"] as const).map((s) => (
        <span key={s} className="flex items-center gap-1.5">
          <span className={cn("inline-block h-2.5 w-2.5 rounded-full", statusColor[s])} />
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </span>
      ))}
    </div>
  );
}

function StatsBar({ nodes }: { nodes: TopoNode[] }) {
  const total = nodes.length;
  const healthy = nodes.filter((n) => n.status === "healthy").length;
  const avgLatency = Math.round(nodes.reduce((s, n) => s + n.responseTime, 0) / total);
  const totalThroughput = nodes.reduce((s, n) => s + n.requestRate, 0);
  const stats = [
    { label: "Total Nodes", value: String(total) },
    { label: "Healthy", value: `${healthy}/${total}` },
    { label: "Avg Latency", value: `${avgLatency} ms` },
    { label: "Throughput", value: `${(totalThroughput / 1000).toFixed(1)}k req/s` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div key={s.label} className="rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-3">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">{s.label}</p>
          <p className="mt-0.5 text-lg font-semibold text-white">{s.value}</p>
        </div>
      ))}
    </div>
  );
}

function ViewTabs({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const tabs: { key: ViewMode; label: string }[] = [
    { key: "topology", label: "Topology" },
    { key: "list", label: "List" },
    { key: "connections", label: "Connections" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-zinc-800 bg-zinc-900 p-0.5">
      {tabs.map((t) => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-md px-4 py-1.5 text-sm font-medium transition-colors",
            mode === t.key
              ? "bg-indigo-500 text-white shadow-sm"
              : "text-zinc-400 hover:text-white"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Connection lines (SVG overlay) ─────────────────────────────────────────

function ConnectionLines({ nodes, selected }: { nodes: TopoNode[]; selected: string | null }) {
  const posMap = new Map(nodes.map((n) => [n.id, { x: n.x, y: n.y }]));
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 0 }}>
      {EDGES.map((e) => {
        const a = posMap.get(e.from);
        const b = posMap.get(e.to);
        if (!a || !b) return null;
        const isHighlighted = selected === e.from || selected === e.to;
        return (
          <line
            key={`${e.from}-${e.to}`}
            x1={`${a.x}%`}
            y1={`${a.y + 2.5}%`}
            x2={`${b.x}%`}
            y2={`${b.y + 2.5}%`}
            stroke={isHighlighted ? "#6366f1" : "#3f3f46"}
            strokeWidth={isHighlighted ? 2 : 1}
            strokeDasharray={isHighlighted ? undefined : "4 4"}
            opacity={isHighlighted ? 1 : 0.5}
          />
        );
      })}
    </svg>
  );
}

// ── Topology Canvas ────────────────────────────────────────────────────────

function TopologyCanvas({
  nodes,
  selected,
  onSelect,
}: {
  nodes: TopoNode[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900" style={{ height: 540 }}>
      <ConnectionLines nodes={nodes} selected={selected} />
      {nodes.map((node) => (
        <button
          key={node.id}
          onClick={() => onSelect(node.id)}
          className={cn(
            "absolute z-10 flex min-w-[110px] -translate-x-1/2 flex-col items-center rounded-lg border px-3 py-2 text-xs transition-all hover:scale-105",
            selected === node.id
              ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50"
              : "border-zinc-700 bg-zinc-800 hover:border-zinc-600"
          )}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <span className="text-base leading-none">{typeEmoji[node.type]}</span>
          <span className="mt-1 font-medium text-white truncate max-w-[100px]">{node.name}</span>
          <span className="flex items-center gap-1 mt-0.5">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", statusColor[node.status])} />
            <span className="text-zinc-500">{node.responseTime}ms</span>
          </span>
        </button>
      ))}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────

function DetailPanel({ node, onClose }: { node: TopoNode; onClose: () => void }) {
  const rows: { label: string; value: string | number; color?: string }[] = [
    { label: "Type", value: typeLabel[node.type] },
    { label: "Hostname", value: node.hostname },
    { label: "IP Address", value: node.ip },
    { label: "Status", value: node.status.charAt(0).toUpperCase() + node.status.slice(1), color: statusTextColor[node.status] },
    { label: "Uptime", value: `${node.uptime}%` },
    { label: "Request Rate", value: `${node.requestRate.toLocaleString()} req/s` },
    { label: "Response Time", value: `${node.responseTime} ms` },
    { label: "Connections", value: node.connections.length > 0 ? node.connections.map(nameById).join(", ") : "—" },
  ];
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{typeEmoji[node.type]}</span>
          <h3 className="text-base font-semibold text-white">{node.name}</h3>
        </div>
        <button onClick={onClose} className="text-zinc-500 hover:text-white text-lg leading-none">✕</button>
      </div>
      <dl className="space-y-2">
        {rows.map((r) => (
          <div key={r.label} className="flex justify-between text-sm">
            <dt className="text-zinc-500">{r.label}</dt>
            <dd className={cn("font-medium", r.color ?? "text-white")}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// ── List View ──────────────────────────────────────────────────────────────

function ListView({
  nodes,
  onSelect,
}: {
  nodes: TopoNode[];
  onSelect: (id: string) => void;
}) {
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sorted = [...nodes].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortField) {
      case "name":
        return a.name.localeCompare(b.name) * dir;
      case "type":
        return a.type.localeCompare(b.type) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "uptime":
        return (a.uptime - b.uptime) * dir;
      case "requestRate":
        return (a.requestRate - b.requestRate) * dir;
      case "responseTime":
        return (a.responseTime - b.responseTime) * dir;
    }
  });

  const headers: { field: SortField; label: string }[] = [
    { field: "name", label: "Name" },
    { field: "type", label: "Type" },
    { field: "status", label: "Status" },
    { field: "uptime", label: "Uptime" },
    { field: "requestRate", label: "Req/s" },
    { field: "responseTime", label: "Latency" },
  ];

  const arrow = (f: SortField) => (sortField === f ? (sortDir === "asc" ? " ↑" : " ↓") : "");

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
          <tr>
            {headers.map((h) => (
              <th
                key={h.field}
                onClick={() => toggleSort(h.field)}
                className="px-4 py-3 cursor-pointer select-none hover:text-white transition-colors"
              >
                {h.label}
                {arrow(h.field)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {sorted.map((n) => (
            <tr
              key={n.id}
              onClick={() => onSelect(n.id)}
              className="bg-zinc-950 hover:bg-zinc-900 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 font-medium text-white">
                <span className="mr-1.5">{typeEmoji[n.type]}</span>
                {n.name}
              </td>
              <td className="px-4 py-3 text-zinc-400">{typeLabel[n.type]}</td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5">
                  <span className={cn("inline-block h-2 w-2 rounded-full", statusColor[n.status])} />
                  <span className={statusTextColor[n.status]}>
                    {n.status.charAt(0).toUpperCase() + n.status.slice(1)}
                  </span>
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-300">{n.uptime}%</td>
              <td className="px-4 py-3 text-zinc-300">{n.requestRate.toLocaleString()}</td>
              <td className="px-4 py-3 text-zinc-300">{n.responseTime} ms</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Connections View ───────────────────────────────────────────────────────

function ConnectionsView() {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-sm text-left">
        <thead className="bg-zinc-900 text-zinc-400 text-xs uppercase tracking-wider">
          <tr>
            <th className="px-4 py-3">From</th>
            <th className="px-4 py-3">To</th>
            <th className="px-4 py-3">Latency</th>
            <th className="px-4 py-3">Throughput</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {EDGES.map((e) => (
            <tr key={`${e.from}-${e.to}`} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
              <td className="px-4 py-3 text-white font-medium">{nameById(e.from)}</td>
              <td className="px-4 py-3 text-white font-medium">{nameById(e.to)}</td>
              <td className="px-4 py-3 text-zinc-300">{e.latency} ms</td>
              <td className="px-4 py-3 text-zinc-300">{e.throughput} MB/s</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export default function NetworkTopologyViewer() {
  const [viewMode, setViewMode] = useState<ViewMode>("topology");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNode = selectedId ? NODES.find((n) => n.id === selectedId) ?? null : null;

  return (
    <div className="min-h-screen bg-zinc-950 p-6 text-white">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Network Topology</h1>
            <p className="mt-1 text-sm text-zinc-400">Infrastructure overview and connectivity map</p>
          </div>
          <StatusLegend />
        </div>

        {/* Stats */}
        <StatsBar nodes={NODES} />

        {/* View toggle */}
        <ViewTabs mode={viewMode} onChange={setViewMode} />

        {/* Content area */}
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {viewMode === "topology" && (
              <TopologyCanvas
                nodes={NODES}
                selected={selectedId}
                onSelect={setSelectedId}
              />
            )}
            {viewMode === "list" && (
              <ListView nodes={NODES} onSelect={setSelectedId} />
            )}
            {viewMode === "connections" && <ConnectionsView />}
          </div>

          {/* Detail panel (always present in sidebar slot) */}
          <div>
            {selectedNode ? (
              <DetailPanel node={selectedNode} onClose={() => setSelectedId(null)} />
            ) : (
              <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-zinc-800 text-sm text-zinc-600">
                Click a node to inspect
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

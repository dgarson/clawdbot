import React, { useState } from "react";
import { cn } from "../lib/utils";

type NodeType = "gateway" | "loadbalancer" | "service" | "database" | "cache" | "queue" | "external";
type NodeStatus = "healthy" | "degraded" | "down" | "unknown";
type LinkType = "http" | "grpc" | "tcp" | "amqp" | "redis";

interface NetworkNode {
  id: string;
  name: string;
  type: NodeType;
  status: NodeStatus;
  region: string;
  host: string;
  port: number;
  version: string;
  connections: number;
  latencyMs: number;
  rps: number;
  errorRate: number;
  cpu: number;
  memory: number;
  tags: string[];
}

interface NetworkLink {
  id: string;
  source: string;
  target: string;
  type: LinkType;
  rps: number;
  latencyMs: number;
  errorRate: number;
  encrypted: boolean;
  status: "active" | "degraded" | "down";
}

interface TrafficFlow {
  path: string[];
  label: string;
  rps: number;
  p99Ms: number;
}

interface RegionSummary {
  name: string;
  nodeCount: number;
  healthyCount: number;
  rps: number;
  avgLatencyMs: number;
}

const NODES: NetworkNode[] = [
  { id: "gw1", name: "API Gateway", type: "gateway", status: "healthy", region: "us-east-1", host: "gw-us-east.internal", port: 443, version: "3.2.1", connections: 4820, latencyMs: 8, rps: 12400, errorRate: 0.12, cpu: 34, memory: 48, tags: ["edge", "tls-termination"] },
  { id: "lb1", name: "Load Balancer US-E", type: "loadbalancer", status: "healthy", region: "us-east-1", host: "lb-ue1.internal", port: 80, version: "nginx/1.25", connections: 3200, latencyMs: 2, rps: 11800, errorRate: 0.04, cpu: 22, memory: 31, tags: ["layer7", "sticky"] },
  { id: "lb2", name: "Load Balancer EU", type: "loadbalancer", status: "degraded", region: "eu-west-1", host: "lb-ew1.internal", port: 80, version: "nginx/1.24", connections: 1100, latencyMs: 18, rps: 3200, errorRate: 1.4, cpu: 78, memory: 65, tags: ["layer7"] },
  { id: "svc1", name: "Auth Service", type: "service", status: "healthy", region: "us-east-1", host: "auth-svc.internal", port: 8080, version: "2.4.0", connections: 840, latencyMs: 12, rps: 4200, errorRate: 0.08, cpu: 45, memory: 60, tags: ["stateless", "jwt"] },
  { id: "svc2", name: "User Service", type: "service", status: "healthy", region: "us-east-1", host: "user-svc.internal", port: 8081, version: "1.9.3", connections: 520, latencyMs: 22, rps: 2100, errorRate: 0.15, cpu: 38, memory: 52, tags: ["stateless"] },
  { id: "svc3", name: "Order Service", type: "service", status: "degraded", region: "us-east-1", host: "order-svc.internal", port: 8082, version: "3.1.0", connections: 380, latencyMs: 145, rps: 980, errorRate: 2.8, cpu: 88, memory: 74, tags: ["stateful"] },
  { id: "svc4", name: "Notification Service", type: "service", status: "healthy", region: "us-east-1", host: "notif-svc.internal", port: 8083, version: "1.2.1", connections: 90, latencyMs: 35, rps: 450, errorRate: 0.3, cpu: 18, memory: 28, tags: ["async"] },
  { id: "svc5", name: "Analytics Service", type: "service", status: "healthy", region: "eu-west-1", host: "analytics-svc.internal", port: 8084, version: "2.0.0", connections: 210, latencyMs: 55, rps: 720, errorRate: 0.5, cpu: 62, memory: 71, tags: ["batch"] },
  { id: "db1", name: "Postgres Primary", type: "database", status: "healthy", region: "us-east-1", host: "pg-primary.internal", port: 5432, version: "16.1", connections: 240, latencyMs: 3, rps: 8200, errorRate: 0.02, cpu: 55, memory: 72, tags: ["primary", "rds"] },
  { id: "db2", name: "Postgres Replica", type: "database", status: "healthy", region: "us-east-1", host: "pg-replica.internal", port: 5432, version: "16.1", connections: 120, latencyMs: 5, rps: 3100, errorRate: 0.01, cpu: 32, memory: 58, tags: ["replica", "read-only"] },
  { id: "db3", name: "MongoDB", type: "database", status: "down", region: "us-east-1", host: "mongo.internal", port: 27017, version: "7.0.3", connections: 0, latencyMs: 0, rps: 0, errorRate: 100, cpu: 0, memory: 0, tags: ["document", "shard"] },
  { id: "c1", name: "Redis Primary", type: "cache", status: "healthy", region: "us-east-1", host: "redis-primary.internal", port: 6379, version: "7.2.3", connections: 580, latencyMs: 0.8, rps: 22000, errorRate: 0, cpu: 24, memory: 44, tags: ["cache", "sessions"] },
  { id: "c2", name: "Redis Replica", type: "cache", status: "healthy", region: "eu-west-1", host: "redis-replica.internal", port: 6379, version: "7.2.3", connections: 190, latencyMs: 1.2, rps: 7400, errorRate: 0, cpu: 18, memory: 38, tags: ["cache", "read-only"] },
  { id: "q1", name: "RabbitMQ", type: "queue", status: "healthy", region: "us-east-1", host: "rabbitmq.internal", port: 5672, version: "3.13.0", connections: 44, latencyMs: 4, rps: 1800, errorRate: 0.1, cpu: 28, memory: 55, tags: ["amqp", "durable"] },
  { id: "ext1", name: "Stripe API", type: "external", status: "healthy", region: "external", host: "api.stripe.com", port: 443, version: "v1", connections: 12, latencyMs: 220, rps: 180, errorRate: 0.5, cpu: 0, memory: 0, tags: ["payments", "webhook"] },
  { id: "ext2", name: "SendGrid", type: "external", status: "healthy", region: "external", host: "api.sendgrid.com", port: 443, version: "v3", connections: 5, latencyMs: 185, rps: 90, errorRate: 0.2, cpu: 0, memory: 0, tags: ["email", "transactional"] },
];

const LINKS: NetworkLink[] = [
  { id: "l1", source: "gw1", target: "lb1", type: "http", rps: 11800, latencyMs: 2, errorRate: 0.04, encrypted: true, status: "active" },
  { id: "l2", source: "gw1", target: "lb2", type: "http", rps: 3200, latencyMs: 18, errorRate: 1.4, encrypted: true, status: "degraded" },
  { id: "l3", source: "lb1", target: "svc1", type: "http", rps: 4200, latencyMs: 12, errorRate: 0.08, encrypted: false, status: "active" },
  { id: "l4", source: "lb1", target: "svc2", type: "http", rps: 2100, latencyMs: 22, errorRate: 0.15, encrypted: false, status: "active" },
  { id: "l5", source: "lb1", target: "svc3", type: "grpc", rps: 980, latencyMs: 145, errorRate: 2.8, encrypted: true, status: "degraded" },
  { id: "l6", source: "svc1", target: "db1", type: "tcp", rps: 3200, latencyMs: 3, errorRate: 0.02, encrypted: true, status: "active" },
  { id: "l7", source: "svc2", target: "db1", type: "tcp", rps: 1800, latencyMs: 3, errorRate: 0.02, encrypted: true, status: "active" },
  { id: "l8", source: "svc3", target: "db1", type: "tcp", rps: 850, latencyMs: 3, errorRate: 0.02, encrypted: true, status: "active" },
  { id: "l9", source: "svc3", target: "db3", type: "tcp", rps: 0, latencyMs: 0, errorRate: 100, encrypted: false, status: "down" },
  { id: "l10", source: "svc1", target: "c1", type: "redis", rps: 8200, latencyMs: 0.8, errorRate: 0, encrypted: false, status: "active" },
  { id: "l11", source: "svc2", target: "c1", type: "redis", rps: 5400, latencyMs: 0.8, errorRate: 0, encrypted: false, status: "active" },
  { id: "l12", source: "svc3", target: "q1", type: "amqp", rps: 450, latencyMs: 4, errorRate: 0.1, encrypted: true, status: "active" },
  { id: "l13", source: "q1", target: "svc4", type: "amqp", rps: 440, latencyMs: 4, errorRate: 0.1, encrypted: true, status: "active" },
  { id: "l14", source: "svc3", target: "ext1", type: "http", rps: 180, latencyMs: 220, errorRate: 0.5, encrypted: true, status: "active" },
  { id: "l15", source: "svc4", target: "ext2", type: "http", rps: 90, latencyMs: 185, errorRate: 0.2, encrypted: true, status: "active" },
  { id: "l16", source: "db1", target: "db2", type: "tcp", rps: 3100, latencyMs: 5, errorRate: 0.01, encrypted: true, status: "active" },
];

const TRAFFIC_FLOWS: TrafficFlow[] = [
  { label: "User Login", path: ["gw1", "lb1", "svc1", "db1"], rps: 1200, p99Ms: 45 },
  { label: "Place Order", path: ["gw1", "lb1", "svc3", "db1", "q1", "svc4", "ext1"], rps: 180, p99Ms: 680 },
  { label: "User Profile", path: ["gw1", "lb1", "svc2", "c1"], rps: 840, p99Ms: 28 },
];

function nodeTypeColor(t: NodeType) {
  switch (t) {
    case "gateway": return "bg-purple-500/20 text-purple-300";
    case "loadbalancer": return "bg-blue-500/20 text-blue-300";
    case "service": return "bg-primary/20 text-indigo-300";
    case "database": return "bg-amber-500/20 text-amber-300";
    case "cache": return "bg-emerald-500/20 text-emerald-300";
    case "queue": return "bg-orange-500/20 text-orange-300";
    case "external": return "bg-[var(--color-surface-3)]/20 text-[var(--color-text-primary)]";
  }
}
function nodeStatusDot(s: NodeStatus) {
  if (s === "healthy") {return "bg-emerald-400";}
  if (s === "degraded") {return "bg-amber-400";}
  if (s === "down") {return "bg-rose-400";}
  return "bg-[var(--color-surface-3)]";
}
function nodeStatusText(s: NodeStatus) {
  if (s === "healthy") {return "text-emerald-400";}
  if (s === "degraded") {return "text-amber-400";}
  if (s === "down") {return "text-rose-400";}
  return "text-[var(--color-text-secondary)]";
}
function linkStatusColor(s: NetworkLink["status"]) {
  if (s === "active") {return "bg-emerald-500/10 text-emerald-400";}
  if (s === "degraded") {return "bg-amber-500/10 text-amber-400";}
  return "bg-rose-500/10 text-rose-400";
}
function linkTypeEmoji(t: LinkType) {
  if (t === "http") {return "🌐";}
  if (t === "grpc") {return "⚡";}
  if (t === "tcp") {return "🔌";}
  if (t === "amqp") {return "📨";}
  return "🔴";
}

function ResourceBar({ label, value, warn = 70, crit = 90 }: { label: string; value: number; warn?: number; crit?: number }) {
  const color = value >= crit ? "bg-rose-500" : value >= warn ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div>
      <div className="flex justify-between text-xs mb-0.5">
        <span className="text-[var(--color-text-muted)]">{label}</span>
        <span className={value >= crit ? "text-rose-400" : value >= warn ? "text-amber-400" : "text-[var(--color-text-secondary)]"}>{value}%</span>
      </div>
      <div className="h-1.5 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export default function NetworkTopologyViewer() {
  const [activeView, setActiveView] = useState<"network-topology">("network-topology");
  const [tab, setTab] = useState<"topology" | "nodes" | "links" | "traffic">("topology");
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [filterType, setFilterType] = useState<NodeType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<NodeStatus | "all">("all");
  const [filterRegion, setFilterRegion] = useState<string>("all");

  void activeView;

  const regions = Array.from(new Set(NODES.map(n => n.region)));
  const healthyCount = NODES.filter(n => n.status === "healthy").length;
  const degradedCount = NODES.filter(n => n.status === "degraded").length;
  const downCount = NODES.filter(n => n.status === "down").length;
  const totalRps = NODES.filter(n => n.type === "gateway").reduce((s, n) => s + n.rps, 0);
  const activeLinks = LINKS.filter(l => l.status === "active").length;
  const downLinks = LINKS.filter(l => l.status === "down").length;

  const regionSummaries: RegionSummary[] = regions.map(r => {
    const rNodes = NODES.filter(n => n.region === r);
    return {
      name: r,
      nodeCount: rNodes.length,
      healthyCount: rNodes.filter(n => n.status === "healthy").length,
      rps: rNodes.reduce((s, n) => s + n.rps, 0),
      avgLatencyMs: rNodes.length > 0 ? Math.round(rNodes.reduce((s, n) => s + n.latencyMs, 0) / rNodes.length) : 0,
    };
  });

  const filteredNodes = NODES.filter(n => {
    if (filterType !== "all" && n.type !== filterType) {return false;}
    if (filterStatus !== "all" && n.status !== filterStatus) {return false;}
    if (filterRegion !== "all" && n.region !== filterRegion) {return false;}
    return true;
  });

  const nodeMap = Object.fromEntries(NODES.map(n => [n.id, n]));

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "topology", label: "Topology" },
    { id: "nodes", label: `Nodes (${NODES.length})` },
    { id: "links", label: `Links (${LINKS.length})` },
    { id: "traffic", label: "Traffic Flows" },
  ];

  // Group nodes by type for topology view
  const nodesByType: Record<NodeType, NetworkNode[]> = {
    gateway: NODES.filter(n => n.type === "gateway"),
    loadbalancer: NODES.filter(n => n.type === "loadbalancer"),
    service: NODES.filter(n => n.type === "service"),
    database: NODES.filter(n => n.type === "database"),
    cache: NODES.filter(n => n.type === "cache"),
    queue: NODES.filter(n => n.type === "queue"),
    external: NODES.filter(n => n.type === "external"),
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Network Topology Viewer</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Real-time service mesh topology and connectivity health</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] transition-colors">Export Map</button>
          <button className="px-3 py-1.5 text-sm bg-primary hover:bg-primary rounded-lg text-[var(--color-text-primary)] transition-colors">⟳ Refresh</button>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Healthy Nodes</div>
          <div className="text-2xl font-bold text-emerald-400">{healthyCount}<span className="text-[var(--color-text-muted)] text-sm font-normal">/{NODES.length}</span></div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Degraded / Down</div>
          <div className="text-2xl font-bold">
            <span className="text-amber-400">{degradedCount}</span>
            <span className="text-[var(--color-text-muted)] text-sm font-normal"> / </span>
            <span className="text-rose-400">{downCount}</span>
          </div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Total RPS</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{(totalRps / 1000).toFixed(1)}k</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Active / Down Links</div>
          <div className="text-2xl font-bold">
            <span className="text-emerald-400">{activeLinks}</span>
            <span className="text-[var(--color-text-muted)] text-sm font-normal"> / </span>
            <span className="text-rose-400">{downLinks}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedNode(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Topology */}
      {tab === "topology" && (
        <div className="space-y-6">
          {/* Region summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {regionSummaries.map(r => (
              <div key={r.name} className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
                <div className="flex justify-between items-start mb-2">
                  <div className="font-medium text-[var(--color-text-primary)]">{r.name}</div>
                  <div className={cn("text-xs px-2 py-0.5 rounded-full", r.healthyCount === r.nodeCount ? "bg-emerald-400/10 text-emerald-400" : "bg-amber-400/10 text-amber-400")}>
                    {r.healthyCount}/{r.nodeCount} healthy
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-[var(--color-text-muted)]">RPS: </span><span className="text-[var(--color-text-primary)]">{r.rps.toLocaleString()}</span></div>
                  <div><span className="text-[var(--color-text-muted)]">Avg latency: </span><span className="text-[var(--color-text-primary)]">{r.avgLatencyMs}ms</span></div>
                </div>
              </div>
            ))}
          </div>

          {/* Topology diagram — text-based layers */}
          {(["gateway", "loadbalancer", "service", "database", "cache", "queue", "external"] as NodeType[]).map(type => {
            const nodes = nodesByType[type];
            if (nodes.length === 0) {return null;}
            return (
              <div key={type}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={cn("text-xs px-2 py-0.5 rounded-full capitalize font-medium", nodeTypeColor(type))}>{type}</div>
                  <div className="flex-1 h-px bg-[var(--color-surface-2)]" />
                </div>
                <div className="flex flex-wrap gap-3">
                  {nodes.map(n => (
                    <button
                      key={n.id}
                      onClick={() => { setSelectedNode(n); setTab("nodes"); }}
                      className={cn(
                        "bg-[var(--color-surface-1)] rounded-xl p-3 border transition-all text-left hover:border-[var(--color-surface-3)]",
                        n.status === "down" ? "border-rose-500/50" : n.status === "degraded" ? "border-amber-500/30" : "border-[var(--color-border)]",
                      )}
                      style={{ minWidth: 160 }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={cn("w-2 h-2 rounded-full", nodeStatusDot(n.status))} />
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{n.name}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">{n.host}</div>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-[var(--color-text-secondary)]">{n.rps.toLocaleString()} rps</span>
                        <span className={n.latencyMs > 100 ? "text-rose-400" : "text-[var(--color-text-muted)]"}>{n.latencyMs}ms</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nodes */}
      {tab === "nodes" && !selectedNode && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterType} onChange={e => setFilterType(e.target.value as NodeType | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Types</option>
              {(["gateway", "loadbalancer", "service", "database", "cache", "queue", "external"] as NodeType[]).map(t => (
                <option key={t} value={t} className="capitalize">{t}</option>
              ))}
            </select>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as NodeStatus | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Status</option>
              <option value="healthy">Healthy</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
            <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Regions</option>
              {regions.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            {filteredNodes.map(n => (
              <div
                key={n.id}
                onClick={() => setSelectedNode(n)}
                className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-surface-3)] cursor-pointer transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full", nodeStatusDot(n.status))} />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text-primary)]">{n.name}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full capitalize", nodeTypeColor(n.type))}>{n.type}</span>
                        <span className={cn("text-xs capitalize", nodeStatusText(n.status))}>{n.status}</span>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{n.host}:{n.port} · v{n.version} · {n.region}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-right text-xs">
                    <div><div className="text-[var(--color-text-primary)]">{n.rps.toLocaleString()}</div><div className="text-[var(--color-text-muted)]">rps</div></div>
                    <div><div className={n.latencyMs > 100 ? "text-rose-400" : "text-[var(--color-text-primary)]"}>{n.latencyMs}ms</div><div className="text-[var(--color-text-muted)]">latency</div></div>
                    <div><div className={n.errorRate > 1 ? "text-rose-400" : "text-[var(--color-text-primary)]"}>{n.errorRate}%</div><div className="text-[var(--color-text-muted)]">errors</div></div>
                    <div><div className="text-[var(--color-text-primary)]">{n.connections}</div><div className="text-[var(--color-text-muted)]">conns</div></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Node Detail */}
      {tab === "nodes" && selectedNode && (
        <div>
          <button onClick={() => setSelectedNode(null)} className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors">
            ← Back to nodes
          </button>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <div className="flex items-center gap-2 mb-4">
                <div className={cn("w-3 h-3 rounded-full", nodeStatusDot(selectedNode.status))} />
                <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedNode.name}</h2>
                <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", nodeTypeColor(selectedNode.type))}>{selectedNode.type}</span>
              </div>
              <div className="space-y-2 text-sm">
                {[
                  { label: "Host", value: `${selectedNode.host}:${selectedNode.port}` },
                  { label: "Version", value: selectedNode.version },
                  { label: "Region", value: selectedNode.region },
                  { label: "Status", value: selectedNode.status },
                  { label: "Connections", value: selectedNode.connections.toLocaleString() },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">{row.label}</span>
                    <span className={cn("font-medium", row.label === "Status" ? nodeStatusText(selectedNode.status) : "text-[var(--color-text-primary)]")}>{row.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {selectedNode.tags.map(tag => (
                  <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-surface-3)] text-[var(--color-text-primary)]">{tag}</span>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Performance Metrics</h3>
              <div className="grid grid-cols-2 gap-4 mb-5">
                {[
                  { label: "RPS", value: selectedNode.rps.toLocaleString(), sub: "requests/sec" },
                  { label: "Latency", value: `${selectedNode.latencyMs}ms`, sub: "avg response" },
                  { label: "Error Rate", value: `${selectedNode.errorRate}%`, sub: "error rate" },
                  { label: "Connections", value: selectedNode.connections.toLocaleString(), sub: "active" },
                ].map(m => (
                  <div key={m.label} className="bg-[var(--color-surface-2)] rounded-lg p-3">
                    <div className="text-xl font-bold text-[var(--color-text-primary)]">{m.value}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{m.sub}</div>
                  </div>
                ))}
              </div>
              {selectedNode.type !== "external" && (
                <div className="space-y-3">
                  <ResourceBar label="CPU" value={selectedNode.cpu} />
                  <ResourceBar label="Memory" value={selectedNode.memory} />
                </div>
              )}
            </div>
          </div>

          {/* Connections */}
          <div className="mt-5 bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Connections</h3>
            <div className="space-y-2">
              {LINKS.filter(l => l.source === selectedNode.id || l.target === selectedNode.id).map(l => {
                const other = l.source === selectedNode.id ? nodeMap[l.target] : nodeMap[l.source];
                const dir = l.source === selectedNode.id ? "→" : "←";
                if (!other) {return null;}
                return (
                  <div key={l.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                    <div className="flex items-center gap-2">
                      <span className="text-[var(--color-text-muted)] text-sm">{dir}</span>
                      <div className={cn("w-2 h-2 rounded-full", nodeStatusDot(other.status))} />
                      <span className="text-sm text-[var(--color-text-primary)]">{other.name}</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{linkTypeEmoji(l.type)} {l.type.toUpperCase()}</span>
                      {l.encrypted && <span className="text-xs text-emerald-400">🔒</span>}
                    </div>
                    <div className="flex gap-4 text-xs text-right">
                      <span className="text-[var(--color-text-secondary)]">{l.rps.toLocaleString()} rps</span>
                      <span className={l.latencyMs > 100 ? "text-rose-400" : "text-[var(--color-text-secondary)]"}>{l.latencyMs}ms</span>
                      <span className={cn("px-1.5 py-0.5 rounded-full", linkStatusColor(l.status))}>{l.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Links */}
      {tab === "links" && (
        <div className="space-y-2">
          {LINKS.map(l => {
            const src = nodeMap[l.source];
            const tgt = nodeMap[l.target];
            return (
              <div key={l.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", l.status === "down" ? "border-rose-500/40" : l.status === "degraded" ? "border-amber-500/30" : "border-[var(--color-border)]")}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[var(--color-text-primary)]">{src?.name ?? l.source}</span>
                        <span className="text-[var(--color-text-muted)]">→</span>
                        <span className="text-sm text-[var(--color-text-primary)]">{tgt?.name ?? l.target}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{linkTypeEmoji(l.type)} {l.type.toUpperCase()}</span>
                        {l.encrypted && <span className="text-xs text-emerald-400">🔒</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-[var(--color-text-secondary)]">{l.rps.toLocaleString()} rps</span>
                    <span className={l.latencyMs > 100 ? "text-rose-400" : "text-[var(--color-text-secondary)]"}>{l.latencyMs}ms</span>
                    <span className={l.errorRate > 1 ? "text-rose-400" : "text-[var(--color-text-muted)]"}>{l.errorRate}% err</span>
                    <span className={cn("px-2 py-0.5 rounded-full", linkStatusColor(l.status))}>{l.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Traffic Flows */}
      {tab === "traffic" && (
        <div className="space-y-5">
          {TRAFFIC_FLOWS.map(flow => (
            <div key={flow.label} className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">{flow.label}</h3>
                  <div className="flex gap-4 text-xs text-[var(--color-text-muted)] mt-1">
                    <span>{flow.rps.toLocaleString()} rps</span>
                    <span>p99: {flow.p99Ms}ms</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {flow.path.map((nodeId, i) => {
                  const n = nodeMap[nodeId];
                  return (
                    <React.Fragment key={nodeId}>
                      <div className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-medium border",
                        n?.status === "down" ? "border-rose-500 bg-rose-500/10 text-rose-300" :
                        n?.status === "degraded" ? "border-amber-500 bg-amber-500/10 text-amber-300" :
                        "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-primary)]",
                      )}>
                        <div className="flex items-center gap-1.5">
                          <div className={cn("w-1.5 h-1.5 rounded-full", n ? nodeStatusDot(n.status) : "bg-[var(--color-surface-3)]")} />
                          {n?.name ?? nodeId}
                        </div>
                      </div>
                      {i < flow.path.length - 1 && <span className="text-[var(--color-text-muted)]">→</span>}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Aggregate traffic matrix */}
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Service-to-Service Traffic Matrix</h3>
            <div className="space-y-2">
              {LINKS.filter(l => {
                const src = nodeMap[l.source];
                const tgt = nodeMap[l.target];
                return src?.type === "service" || tgt?.type === "service";
              }).slice(0, 8).map(l => {
                const src = nodeMap[l.source];
                const tgt = nodeMap[l.target];
                const maxRps = 10000;
                const pct = Math.min(100, (l.rps / maxRps) * 100);
                return (
                  <div key={l.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--color-text-secondary)]">{src?.name ?? l.source} → {tgt?.name ?? l.target}</span>
                      <span className={cn(l.status === "down" ? "text-rose-400" : l.status === "degraded" ? "text-amber-400" : "text-[var(--color-text-secondary)]")}>{l.rps.toLocaleString()} rps</span>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full", l.status === "down" ? "bg-rose-500" : l.status === "degraded" ? "bg-amber-500" : "bg-primary")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

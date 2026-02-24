import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type Tab = "nodes" | "pods" | "namespaces" | "events";

interface NodeInfo {
  name: string;
  role: "control-plane" | "worker";
  status: "Ready" | "NotReady";
  cpuUsage: number;
  memUsage: number;
  podCount: number;
  version: string;
  os: string;
}

interface PodInfo {
  name: string;
  namespace: string;
  status: "Running" | "Pending" | "CrashLoopBackOff" | "Completed";
  restarts: number;
  age: string;
  node: string;
  cpuRequest: string;
  cpuLimit: string;
  memRequest: string;
  memLimit: string;
}

interface NamespaceInfo {
  name: string;
  status: "Active" | "Terminating";
  podCount: number;
  cpuUsed: number;
  cpuLimit: number;
  memUsed: number;
  memLimit: number;
}

interface K8sEvent {
  type: "Normal" | "Warning";
  reason: string;
  object: string;
  message: string;
  age: string;
}

// ── Mock Data ──────────────────────────────────────────────────────────────

const NODES: NodeInfo[] = [
  { name: "cp-node-01", role: "control-plane", status: "Ready", cpuUsage: 34, memUsage: 52, podCount: 28, version: "v1.29.2", os: "Ubuntu 22.04" },
  { name: "cp-node-02", role: "control-plane", status: "Ready", cpuUsage: 29, memUsage: 47, podCount: 25, version: "v1.29.2", os: "Ubuntu 22.04" },
  { name: "cp-node-03", role: "control-plane", status: "Ready", cpuUsage: 41, memUsage: 58, podCount: 31, version: "v1.29.2", os: "Ubuntu 22.04" },
  { name: "worker-node-01", role: "worker", status: "Ready", cpuUsage: 72, memUsage: 68, podCount: 47, version: "v1.29.2", os: "Ubuntu 22.04" },
  { name: "worker-node-02", role: "worker", status: "Ready", cpuUsage: 58, memUsage: 74, podCount: 52, version: "v1.29.2", os: "Ubuntu 22.04" },
  { name: "worker-node-03", role: "worker", status: "NotReady", cpuUsage: 93, memUsage: 89, podCount: 38, version: "v1.29.2", os: "Ubuntu 22.04" },
];

const PODS: PodInfo[] = [
  { name: "api-gateway-7d8f9b-k2xpq", namespace: "prod", status: "Running", restarts: 0, age: "4d12h", node: "worker-node-01", cpuRequest: "250m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "api-gateway-7d8f9b-m9tnl", namespace: "prod", status: "Running", restarts: 0, age: "4d12h", node: "worker-node-02", cpuRequest: "250m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "auth-service-5c4a1e-jw8rp", namespace: "prod", status: "Running", restarts: 1, age: "12d3h", node: "worker-node-01", cpuRequest: "200m", cpuLimit: "400m", memRequest: "128Mi", memLimit: "256Mi" },
  { name: "payment-svc-8b3e2f-qz6dk", namespace: "prod", status: "CrashLoopBackOff", restarts: 47, age: "2d8h", node: "worker-node-03", cpuRequest: "500m", cpuLimit: "1000m", memRequest: "512Mi", memLimit: "1Gi" },
  { name: "order-processor-3f9a7c-hn4ws", namespace: "prod", status: "Running", restarts: 0, age: "7d19h", node: "worker-node-02", cpuRequest: "300m", cpuLimit: "600m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "notification-worker-6d2b8e-tx5lp", namespace: "prod", status: "Running", restarts: 2, age: "9d6h", node: "worker-node-01", cpuRequest: "100m", cpuLimit: "250m", memRequest: "128Mi", memLimit: "256Mi" },
  { name: "redis-cluster-0", namespace: "prod", status: "Running", restarts: 0, age: "31d", node: "worker-node-02", cpuRequest: "500m", cpuLimit: "1000m", memRequest: "1Gi", memLimit: "2Gi" },
  { name: "postgres-primary-0", namespace: "prod", status: "Running", restarts: 0, age: "31d", node: "worker-node-01", cpuRequest: "1000m", cpuLimit: "2000m", memRequest: "2Gi", memLimit: "4Gi" },
  { name: "frontend-deploy-4e7c9a-bk2mj", namespace: "staging", status: "Running", restarts: 0, age: "1d4h", node: "worker-node-02", cpuRequest: "100m", cpuLimit: "250m", memRequest: "128Mi", memLimit: "256Mi" },
  { name: "frontend-deploy-4e7c9a-rf8nq", namespace: "staging", status: "Pending", restarts: 0, age: "22m", node: "worker-node-03", cpuRequest: "100m", cpuLimit: "250m", memRequest: "128Mi", memLimit: "256Mi" },
  { name: "data-migration-job-a8f3e-lw9vd", namespace: "staging", status: "Completed", restarts: 0, age: "6h", node: "worker-node-01", cpuRequest: "200m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "coredns-5d78c9869-xz7bp", namespace: "kube-system", status: "Running", restarts: 0, age: "45d", node: "cp-node-01", cpuRequest: "100m", cpuLimit: "200m", memRequest: "70Mi", memLimit: "170Mi" },
  { name: "coredns-5d78c9869-qm4kl", namespace: "kube-system", status: "Running", restarts: 0, age: "45d", node: "cp-node-02", cpuRequest: "100m", cpuLimit: "200m", memRequest: "70Mi", memLimit: "170Mi" },
  { name: "etcd-cp-node-01", namespace: "kube-system", status: "Running", restarts: 0, age: "45d", node: "cp-node-01", cpuRequest: "100m", cpuLimit: "500m", memRequest: "256Mi", memLimit: "512Mi" },
  { name: "metrics-server-7b4f8d-n3plq", namespace: "monitoring", status: "Running", restarts: 0, age: "20d", node: "worker-node-01", cpuRequest: "100m", cpuLimit: "300m", memRequest: "200Mi", memLimit: "400Mi" },
];

const NAMESPACES: NamespaceInfo[] = [
  { name: "default", status: "Active", podCount: 0, cpuUsed: 0, cpuLimit: 4000, memUsed: 0, memLimit: 8192 },
  { name: "kube-system", status: "Active", podCount: 14, cpuUsed: 1200, cpuLimit: 4000, memUsed: 2048, memLimit: 8192 },
  { name: "kube-public", status: "Active", podCount: 0, cpuUsed: 0, cpuLimit: 2000, memUsed: 0, memLimit: 4096 },
  { name: "prod", status: "Active", podCount: 34, cpuUsed: 3100, cpuLimit: 8000, memUsed: 5632, memLimit: 16384 },
  { name: "staging", status: "Active", podCount: 12, cpuUsed: 800, cpuLimit: 4000, memUsed: 1536, memLimit: 8192 },
  { name: "monitoring", status: "Active", podCount: 8, cpuUsed: 600, cpuLimit: 2000, memUsed: 1024, memLimit: 4096 },
  { name: "cert-manager", status: "Active", podCount: 3, cpuUsed: 150, cpuLimit: 1000, memUsed: 256, memLimit: 2048 },
  { name: "legacy-api", status: "Terminating", podCount: 2, cpuUsed: 200, cpuLimit: 2000, memUsed: 512, memLimit: 4096 },
];

const EVENTS: K8sEvent[] = [
  { type: "Warning", reason: "BackOff", object: "pod/payment-svc-8b3e2f-qz6dk", message: "Back-off restarting failed container payment-svc in pod payment-svc-8b3e2f-qz6dk", age: "2m" },
  { type: "Warning", reason: "NodeNotReady", object: "node/worker-node-03", message: "Node worker-node-03 status is now: NodeNotReady", age: "5m" },
  { type: "Warning", reason: "FailedScheduling", object: "pod/frontend-deploy-4e7c9a-rf8nq", message: "0/6 nodes are available: 1 node(s) had untolerated taint {node.kubernetes.io/not-ready: }, 5 Insufficient memory.", age: "22m" },
  { type: "Normal", reason: "Scheduled", object: "pod/data-migration-job-a8f3e-lw9vd", message: "Successfully assigned staging/data-migration-job-a8f3e-lw9vd to worker-node-01", age: "6h" },
  { type: "Normal", reason: "Completed", object: "job/data-migration-job-a8f3e", message: "Job completed successfully", age: "5h" },
  { type: "Normal", reason: "Pulled", object: "pod/auth-service-5c4a1e-jw8rp", message: "Container image \"registry.internal/auth-service:v2.14.1\" already present on machine", age: "8h" },
  { type: "Warning", reason: "Unhealthy", object: "pod/payment-svc-8b3e2f-qz6dk", message: "Liveness probe failed: HTTP probe failed with statuscode: 503", age: "12h" },
  { type: "Normal", reason: "ScalingReplicaSet", object: "deployment/api-gateway", message: "Scaled up replica set api-gateway-7d8f9b to 2", age: "4d" },
  { type: "Normal", reason: "SuccessfulCreate", object: "replicaset/api-gateway-7d8f9b", message: "Created pod: api-gateway-7d8f9b-k2xpq", age: "4d" },
  { type: "Warning", reason: "EvictionThresholdMet", object: "node/worker-node-03", message: "Attempting to reclaim memory, current usage: 89%", age: "1d" },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function UsageBar({ value, className }: { value: number; className?: string }) {
  const barColor =
    value >= 85 ? "bg-rose-400" : value >= 65 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-2 w-24 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] tabular-nums w-9 text-right">{value}%</span>
    </div>
  );
}

function QuotaBar({ used, limit, unit }: { used: number; limit: number; unit: string }) {
  const pct = limit > 0 ? Math.round((used / limit) * 100) : 0;
  const barColor =
    pct >= 85 ? "bg-rose-400" : pct >= 65 ? "bg-amber-400" : "bg-indigo-500";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-xs text-[var(--color-text-secondary)]">
        <span>
          {used}{unit} / {limit}{unit}
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className={cn("h-full rounded-full", barColor)}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    Ready: "bg-emerald-400/15 text-emerald-400",
    NotReady: "bg-rose-400/15 text-rose-400",
    Running: "bg-emerald-400/15 text-emerald-400",
    Pending: "bg-amber-400/15 text-amber-400",
    CrashLoopBackOff: "bg-rose-400/15 text-rose-400",
    Completed: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)]",
    Active: "bg-emerald-400/15 text-emerald-400",
    Terminating: "bg-rose-400/15 text-rose-400",
    Healthy: "bg-emerald-400/15 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        styles[status] ?? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]"
      )}
    >
      {status}
    </span>
  );
}

function EventTypeBadge({ type }: { type: "Normal" | "Warning" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        type === "Warning"
          ? "bg-amber-400/15 text-amber-400"
          : "bg-indigo-500/15 text-indigo-400"
      )}
    >
      {type === "Warning" ? "⚠" : "●"} {type}
    </span>
  );
}

// ── Tab panels ──────────────────────────────────────────────────────────────

function NodesPanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
            <th className="py-3 px-4 font-medium">Name</th>
            <th className="py-3 px-4 font-medium">Role</th>
            <th className="py-3 px-4 font-medium">Status</th>
            <th className="py-3 px-4 font-medium">CPU</th>
            <th className="py-3 px-4 font-medium">Memory</th>
            <th className="py-3 px-4 font-medium text-right">Pods</th>
            <th className="py-3 px-4 font-medium">Version</th>
            <th className="py-3 px-4 font-medium">OS</th>
          </tr>
        </thead>
        <tbody>
          {NODES.map((n) => (
            <tr
              key={n.name}
              className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors"
            >
              <td className="py-3 px-4 font-mono text-[var(--color-text-primary)] text-xs">{n.name}</td>
              <td className="py-3 px-4">
                <span
                  className={cn(
                    "text-xs rounded px-2 py-0.5",
                    n.role === "control-plane"
                      ? "bg-indigo-500/15 text-indigo-400"
                      : "bg-[var(--color-surface-3)]/50 text-[var(--color-text-primary)]"
                  )}
                >
                  {n.role}
                </span>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={n.status} />
              </td>
              <td className="py-3 px-4">
                <UsageBar value={n.cpuUsage} />
              </td>
              <td className="py-3 px-4">
                <UsageBar value={n.memUsage} />
              </td>
              <td className="py-3 px-4 text-right text-[var(--color-text-primary)] tabular-nums">{n.podCount}</td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs font-mono">{n.version}</td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs">{n.os}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PodsPanel() {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left">
        <thead>
          <tr className="border-b border-[var(--color-border)] text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">
            <th className="py-3 px-4 font-medium">Name</th>
            <th className="py-3 px-4 font-medium">Namespace</th>
            <th className="py-3 px-4 font-medium">Status</th>
            <th className="py-3 px-4 font-medium text-right">Restarts</th>
            <th className="py-3 px-4 font-medium">Age</th>
            <th className="py-3 px-4 font-medium">Node</th>
            <th className="py-3 px-4 font-medium">CPU (req/lim)</th>
            <th className="py-3 px-4 font-medium">Mem (req/lim)</th>
          </tr>
        </thead>
        <tbody>
          {PODS.map((p) => (
            <tr
              key={p.name}
              className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors"
            >
              <td className="py-3 px-4 font-mono text-[var(--color-text-primary)] text-xs max-w-[280px] truncate">
                {p.name}
              </td>
              <td className="py-3 px-4">
                <span className="text-xs rounded bg-[var(--color-surface-2)] px-2 py-0.5 text-[var(--color-text-primary)]">
                  {p.namespace}
                </span>
              </td>
              <td className="py-3 px-4">
                <StatusBadge status={p.status} />
              </td>
              <td className="py-3 px-4 text-right tabular-nums">
                <span className={cn(p.restarts > 5 ? "text-rose-400" : "text-[var(--color-text-primary)]")}>
                  {p.restarts}
                </span>
              </td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs">{p.age}</td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs font-mono">{p.node}</td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs font-mono tabular-nums">
                {p.cpuRequest} / {p.cpuLimit}
              </td>
              <td className="py-3 px-4 text-[var(--color-text-secondary)] text-xs font-mono tabular-nums">
                {p.memRequest} / {p.memLimit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NamespacesPanel() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {NAMESPACES.map((ns) => (
        <div
          key={ns.name}
          className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-primary)] font-semibold font-mono text-sm">{ns.name}</span>
            <StatusBadge status={ns.status} />
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">
            {ns.podCount} pod{ns.podCount !== 1 ? "s" : ""}
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">CPU (m)</span>
              <QuotaBar used={ns.cpuUsed} limit={ns.cpuLimit} unit="m" />
            </div>
            <div>
              <span className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">Memory (Mi)</span>
              <QuotaBar used={ns.memUsed} limit={ns.memLimit} unit="Mi" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EventsPanel() {
  return (
    <div className="flex flex-col gap-2">
      {EVENTS.map((e, i) => (
        <div
          key={i}
          className={cn(
            "bg-[var(--color-surface-1)] border rounded-lg px-5 py-4 flex flex-col gap-1.5",
            e.type === "Warning" ? "border-amber-400/20" : "border-[var(--color-border)]"
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <EventTypeBadge type={e.type} />
              <span className="text-xs font-medium text-[var(--color-text-primary)]">{e.reason}</span>
              <span className="text-xs font-mono text-indigo-400">{e.object}</span>
            </div>
            <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">{e.age}</span>
          </div>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{e.message}</p>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "nodes", label: "Nodes", emoji: "🖥" },
  { key: "pods", label: "Pods", emoji: "📦" },
  { key: "namespaces", label: "Namespaces", emoji: "📂" },
  { key: "events", label: "Events", emoji: "📋" },
];

const totalNodes = NODES.length;
const readyNodes = NODES.filter((n) => n.status === "Ready").length;
const totalPods = PODS.length;
const runningPods = PODS.filter((p) => p.status === "Running").length;
const totalNamespaces = NAMESPACES.length;
const warningEvents = EVENTS.filter((e) => e.type === "Warning").length;
const clusterHealthy = readyNodes === totalNodes && warningEvents === 0;

interface OverviewCard {
  label: string;
  value: string;
  sub?: string;
  emoji: string;
}

const overviewCards: OverviewCard[] = [
  { label: "Cluster", value: "prod-us-west-2", sub: "v1.29.2", emoji: "☸" },
  { label: "Nodes", value: `${readyNodes}/${totalNodes}`, sub: `${readyNodes} ready`, emoji: "🖥" },
  { label: "Pods", value: `${totalPods}`, sub: `${runningPods} running`, emoji: "📦" },
  { label: "Namespaces", value: `${totalNamespaces}`, sub: `${NAMESPACES.filter((n) => n.status === "Active").length} active`, emoji: "📂" },
  { label: "Events", value: `${EVENTS.length}`, sub: `${warningEvents} warning`, emoji: "📋" },
  { label: "Health", value: clusterHealthy ? "Healthy" : "Degraded", sub: clusterHealthy ? "All systems nominal" : "Issues detected", emoji: clusterHealthy ? "✅" : "⚠️" },
];

function KubernetesClusterViewer() {
  const [activeTab, setActiveTab] = useState<Tab>("nodes");

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          ☸ Kubernetes Cluster
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          prod-us-west-2 — v1.29.2 — {totalNodes} nodes
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {overviewCards.map((card) => (
          <div
            key={card.label}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-1"
          >
            <span className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider flex items-center gap-1.5">
              <span>{card.emoji}</span>
              {card.label}
            </span>
            <span
              className={cn(
                "text-xl font-bold tabular-nums",
                card.label === "Health" && !clusterHealthy ? "text-amber-400" : "text-[var(--color-text-primary)]"
              )}
            >
              {card.value}
            </span>
            {card.sub && <span className="text-xs text-[var(--color-text-muted)]">{card.sub}</span>}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 border-b border-[var(--color-border)] pb-px overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap flex items-center gap-1.5",
              activeTab === tab.key
                ? "bg-[var(--color-surface-1)] text-[var(--color-text-primary)] border border-[var(--color-border)] border-b-zinc-900 -mb-px"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]/50"
            )}
          >
            <span>{tab.emoji}</span>
            {tab.label}
            {tab.key === "nodes" && (
              <span className="ml-1 text-xs bg-[var(--color-surface-2)] rounded-full px-1.5 py-0.5 tabular-nums text-[var(--color-text-secondary)]">
                {totalNodes}
              </span>
            )}
            {tab.key === "pods" && (
              <span className="ml-1 text-xs bg-[var(--color-surface-2)] rounded-full px-1.5 py-0.5 tabular-nums text-[var(--color-text-secondary)]">
                {totalPods}
              </span>
            )}
            {tab.key === "namespaces" && (
              <span className="ml-1 text-xs bg-[var(--color-surface-2)] rounded-full px-1.5 py-0.5 tabular-nums text-[var(--color-text-secondary)]">
                {totalNamespaces}
              </span>
            )}
            {tab.key === "events" && warningEvents > 0 && (
              <span className="ml-1 text-xs bg-amber-400/15 text-amber-400 rounded-full px-1.5 py-0.5 tabular-nums">
                {warningEvents}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="p-1">
          {activeTab === "nodes" && <NodesPanel />}
          {activeTab === "pods" && <PodsPanel />}
          {activeTab === "namespaces" && (
            <div className="p-4">
              <NamespacesPanel />
            </div>
          )}
          {activeTab === "events" && (
            <div className="p-4">
              <EventsPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default KubernetesClusterViewer;

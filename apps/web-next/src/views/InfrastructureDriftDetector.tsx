import React, { useState } from "react";
import { cn } from "../lib/utils";

type DriftStatus = "drifted" | "clean" | "unknown" | "error";
type DriftSeverity = "critical" | "high" | "medium" | "low";
type Tab = "overview" | "resources" | "history" | "remediation";

interface DriftResource {
  id: string;
  name: string;
  type: string;
  provider: "aws" | "gcp" | "azure" | "k8s";
  region: string;
  status: DriftStatus;
  severity: DriftSeverity | null;
  driftCount: number;
  lastChecked: string;
  drifts: DriftDetail[];
  expectedBy: string;
}

interface DriftDetail {
  field: string;
  expected: string;
  actual: string;
  severity: DriftSeverity;
}

interface DriftEvent {
  id: string;
  resourceId: string;
  resourceName: string;
  type: string;
  timestamp: string;
  driftCount: number;
  status: "detected" | "remediated" | "acknowledged" | "ignored";
  remediatedBy?: string;
}

const DRIFT_RESOURCES: DriftResource[] = [
  {
    id: "r1", name: "prod-eks-cluster", type: "AWS EKS Cluster", provider: "aws", region: "us-east-1",
    status: "drifted", severity: "critical", driftCount: 3, lastChecked: "2m ago",
    expectedBy: "Terraform state",
    drifts: [
      { field: "node_group.desired_size", expected: "5", actual: "3", severity: "critical" },
      { field: "cluster.version", expected: "1.28", actual: "1.27", severity: "high" },
      { field: "logging.enabled", expected: "true", actual: "false", severity: "medium" },
    ],
  },
  {
    id: "r2", name: "prod-rds-postgres", type: "AWS RDS Instance", provider: "aws", region: "us-east-1",
    status: "drifted", severity: "high", driftCount: 2, lastChecked: "5m ago",
    expectedBy: "Terraform state",
    drifts: [
      { field: "instance_class", expected: "db.r6g.xlarge", actual: "db.r6g.large", severity: "high" },
      { field: "multi_az", expected: "true", actual: "false", severity: "high" },
    ],
  },
  {
    id: "r3", name: "prod-vpc-main", type: "AWS VPC", provider: "aws", region: "us-east-1",
    status: "clean", severity: null, driftCount: 0, lastChecked: "2m ago",
    expectedBy: "Terraform state", drifts: [],
  },
  {
    id: "r4", name: "prod-redis-cluster", type: "AWS ElastiCache", provider: "aws", region: "us-east-1",
    status: "drifted", severity: "medium", driftCount: 1, lastChecked: "2m ago",
    expectedBy: "Terraform state",
    drifts: [
      { field: "num_cache_nodes", expected: "3", actual: "2", severity: "medium" },
    ],
  },
  {
    id: "r5", name: "gke-prod-cluster", type: "GCP GKE Cluster", provider: "gcp", region: "us-central1",
    status: "clean", severity: null, driftCount: 0, lastChecked: "3m ago",
    expectedBy: "Terraform state", drifts: [],
  },
  {
    id: "r6", name: "prod-s3-data-lake", type: "AWS S3 Bucket", provider: "aws", region: "us-east-1",
    status: "drifted", severity: "low", driftCount: 1, lastChecked: "2m ago",
    expectedBy: "Terraform state",
    drifts: [
      { field: "lifecycle_rule.transition_days", expected: "30", actual: "90", severity: "low" },
    ],
  },
  {
    id: "r7", name: "ingress-nginx-deployment", type: "K8s Deployment", provider: "k8s", region: "prod-cluster",
    status: "drifted", severity: "high", driftCount: 2, lastChecked: "1m ago",
    expectedBy: "Helm values",
    drifts: [
      { field: "spec.replicas", expected: "3", actual: "1", severity: "high" },
      { field: "resources.limits.memory", expected: "512Mi", actual: "256Mi", severity: "medium" },
    ],
  },
  {
    id: "r8", name: "prod-iam-role-deploy", type: "AWS IAM Role", provider: "aws", region: "global",
    status: "error", severity: null, driftCount: 0, lastChecked: "10m ago",
    expectedBy: "Terraform state", drifts: [],
  },
  {
    id: "r9", name: "cloudflare-dns-main", type: "Azure DNS Zone", provider: "azure", region: "global",
    status: "clean", severity: null, driftCount: 0, lastChecked: "4m ago",
    expectedBy: "Terraform state", drifts: [],
  },
  {
    id: "r10", name: "prometheus-operator", type: "K8s Deployment", provider: "k8s", region: "prod-cluster",
    status: "drifted", severity: "medium", driftCount: 1, lastChecked: "1m ago",
    expectedBy: "Helm values",
    drifts: [
      { field: "image.tag", expected: "v0.71.0", actual: "v0.68.0", severity: "medium" },
    ],
  },
];

const DRIFT_HISTORY: DriftEvent[] = [
  { id: "e1", resourceId: "r1", resourceName: "prod-eks-cluster", type: "AWS EKS Cluster", timestamp: "2m ago", driftCount: 3, status: "detected" },
  { id: "e2", resourceId: "r7", resourceName: "ingress-nginx-deployment", type: "K8s Deployment", timestamp: "1m ago", driftCount: 2, status: "detected" },
  { id: "e3", resourceId: "r2", resourceName: "prod-rds-postgres", type: "AWS RDS Instance", timestamp: "5m ago", driftCount: 2, status: "detected" },
  { id: "e4", resourceId: "r4", resourceName: "prod-redis-cluster", type: "AWS ElastiCache", timestamp: "15m ago", driftCount: 1, status: "acknowledged", remediatedBy: "platform-oncall" },
  { id: "e5", resourceId: "r1", resourceName: "prod-eks-cluster", type: "AWS EKS Cluster", timestamp: "1h ago", driftCount: 1, status: "remediated", remediatedBy: "terraform-apply" },
  { id: "e6", resourceId: "r10", resourceName: "prometheus-operator", type: "K8s Deployment", timestamp: "2h ago", driftCount: 1, status: "detected" },
  { id: "e7", resourceId: "r3", resourceName: "prod-vpc-main", type: "AWS VPC", timestamp: "3h ago", driftCount: 2, status: "remediated", remediatedBy: "terraform-apply" },
  { id: "e8", resourceId: "r6", resourceName: "prod-s3-data-lake", type: "AWS S3 Bucket", timestamp: "4h ago", driftCount: 1, status: "ignored" },
];

const driftStatusColor: Record<DriftStatus, string> = {
  drifted: "text-rose-400",
  clean: "text-emerald-400",
  unknown: "text-zinc-500",
  error: "text-amber-400",
};

const driftStatusBg: Record<DriftStatus, string> = {
  drifted: "bg-rose-500/10 border-rose-500/30",
  clean: "bg-emerald-500/10 border-emerald-500/30",
  unknown: "bg-zinc-700/30 border-zinc-600",
  error: "bg-amber-500/10 border-amber-500/30",
};

const severityColor: Record<DriftSeverity, string> = {
  critical: "text-rose-400",
  high: "text-orange-400",
  medium: "text-amber-400",
  low: "text-sky-400",
};

const severityBg: Record<DriftSeverity, string> = {
  critical: "bg-rose-500/10 border-rose-500/30",
  high: "bg-orange-500/10 border-orange-500/30",
  medium: "bg-amber-500/10 border-amber-500/30",
  low: "bg-sky-500/10 border-sky-500/30",
};

const historyStatusColor: Record<string, string> = {
  detected: "text-rose-400",
  remediated: "text-emerald-400",
  acknowledged: "text-amber-400",
  ignored: "text-zinc-500",
};

const providerIcon: Record<string, string> = {
  aws: "☁️",
  gcp: "🌐",
  azure: "💠",
  k8s: "⚙️",
};

export default function InfrastructureDriftDetector() {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedResource, setSelectedResource] = useState<DriftResource | null>(null);
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview", emoji: "🗺️" },
    { id: "resources", label: "Resources", emoji: "🏗️" },
    { id: "history", label: "Drift History", emoji: "📜" },
    { id: "remediation", label: "Remediation", emoji: "🔧" },
  ];

  const driftedCount = DRIFT_RESOURCES.filter(r => r.status === "drifted").length;
  const cleanCount = DRIFT_RESOURCES.filter(r => r.status === "clean").length;
  const totalDrifts = DRIFT_RESOURCES.reduce((sum, r) => sum + r.driftCount, 0);
  const criticalCount = DRIFT_RESOURCES.filter(r => r.severity === "critical").length;

  const filteredResources = DRIFT_RESOURCES.filter(r => {
    if (providerFilter !== "all" && r.provider !== providerFilter) {return false;}
    if (statusFilter !== "all" && r.status !== statusFilter) {return false;}
    return true;
  });

  const providerDriftCounts = DRIFT_RESOURCES.reduce<Record<string, number>>((acc, r) => {
    if (r.status === "drifted") {acc[r.provider] = (acc[r.provider] || 0) + 1;}
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Infrastructure Drift Detector</h1>
          <p className="text-xs text-zinc-500 mt-0.5">Comparing live state vs Terraform / Helm expected state</p>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30">
              <span className="text-xs text-rose-400 font-medium">🚨 {criticalCount} critical</span>
            </div>
          )}
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
            ↻ Scan Now
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-0 border-b border-zinc-800">
        {[
          { label: "Total Resources", value: String(DRIFT_RESOURCES.length), sub: "monitored" },
          { label: "Drifted", value: String(driftedCount), sub: `${totalDrifts} drift points`, alert: true },
          { label: "Clean", value: String(cleanCount), sub: "in sync with IaC" },
          { label: "Critical Drifts", value: String(criticalCount), sub: "require immediate action", alert: criticalCount > 0 },
          { label: "Last Full Scan", value: "2m ago", sub: "next in 8m" },
        ].map((stat, i) => (
          <div key={i} className={cn("px-6 py-3 border-r border-zinc-800 last:border-r-0", stat.alert && "bg-rose-500/5")}>
            <div className={cn("text-xl font-bold", stat.alert ? "text-rose-400" : "text-white")}>{stat.value}</div>
            <div className="text-xs font-medium text-zinc-400 mt-0.5">{stat.label}</div>
            <div className="text-xs text-zinc-600 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* OVERVIEW TAB */}
        {tab === "overview" && (
          <div className="p-6 space-y-6">
            {/* Drifted resources highlight */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Drifted Resources</h2>
              <div className="space-y-2">
                {DRIFT_RESOURCES.filter(r => r.status === "drifted").map(resource => (
                  <div
                    key={resource.id}
                    className="bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 p-4 cursor-pointer transition-colors"
                    onClick={() => { setTab("resources"); setSelectedResource(resource); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{providerIcon[resource.provider]}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-sm text-white">{resource.name}</span>
                            {resource.severity && (
                              <span className={cn("text-xs px-1.5 py-0.5 rounded border", severityBg[resource.severity])}>
                                <span className={severityColor[resource.severity]}>{resource.severity}</span>
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500">{resource.type} · {resource.region}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-rose-400">{resource.driftCount} drift{resource.driftCount !== 1 ? "s" : ""}</div>
                        <div className="text-xs text-zinc-600">vs {resource.expectedBy}</div>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      {resource.drifts.slice(0, 2).map((drift, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className={cn("shrink-0 px-1.5 py-0.5 rounded", severityBg[drift.severity])}>
                            <span className={severityColor[drift.severity]}>{drift.severity[0].toUpperCase()}</span>
                          </span>
                          <span className="text-zinc-400">{drift.field}:</span>
                          <span className="text-emerald-400/60 line-through">{drift.expected}</span>
                          <span className="text-zinc-500">→</span>
                          <span className="text-rose-400">{drift.actual}</span>
                        </div>
                      ))}
                      {resource.drifts.length > 2 && (
                        <div className="text-xs text-zinc-600">+{resource.drifts.length - 2} more drift points</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* By provider breakdown */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Drift by Provider</h2>
              <div className="grid grid-cols-4 gap-3">
                {(["aws", "gcp", "azure", "k8s"] as const).map(provider => {
                  const total = DRIFT_RESOURCES.filter(r => r.provider === provider).length;
                  const drifted = providerDriftCounts[provider] || 0;
                  return (
                    <div key={provider} className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{providerIcon[provider]}</span>
                        <span className="text-sm font-medium text-zinc-300 uppercase">{provider}</span>
                      </div>
                      <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-rose-500 rounded-full"
                          style={{ width: total > 0 ? `${(drifted / total) * 100}%` : "0%" }}
                        />
                      </div>
                      <div className="text-xs text-zinc-500">{drifted}/{total} resources drifted</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* RESOURCES TAB */}
        {tab === "resources" && (
          <div className="flex h-full">
            <div className="w-96 border-r border-zinc-800 flex flex-col">
              <div className="p-3 border-b border-zinc-800 space-y-2">
                <div className="flex gap-2">
                  <select
                    value={providerFilter}
                    onChange={e => setProviderFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All providers</option>
                    <option value="aws">AWS</option>
                    <option value="gcp">GCP</option>
                    <option value="azure">Azure</option>
                    <option value="k8s">Kubernetes</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All status</option>
                    <option value="drifted">Drifted</option>
                    <option value="clean">Clean</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filteredResources.map(resource => (
                  <button
                    key={resource.id}
                    onClick={() => setSelectedResource(resource)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors",
                      selectedResource?.id === resource.id && "bg-zinc-800"
                    )}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{providerIcon[resource.provider]}</span>
                        <span className="text-xs font-mono text-zinc-200 truncate max-w-[180px]">{resource.name}</span>
                      </div>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", driftStatusBg[resource.status])}>
                        <span className={driftStatusColor[resource.status]}>{resource.status}</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-zinc-600">
                      <span>{resource.type}</span>
                      {resource.driftCount > 0 && <span className="text-rose-400">{resource.driftCount} drifts</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedResource ? (
                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-2xl">{providerIcon[selectedResource.provider]}</span>
                      <div>
                        <h2 className="font-mono text-sm font-semibold text-white">{selectedResource.name}</h2>
                        <p className="text-xs text-zinc-500">{selectedResource.type} · {selectedResource.region}</p>
                      </div>
                      <span className={cn("ml-auto text-xs px-2 py-0.5 rounded border", driftStatusBg[selectedResource.status])}>
                        <span className={driftStatusColor[selectedResource.status]}>{selectedResource.status}</span>
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Expected By", value: selectedResource.expectedBy },
                      { label: "Last Checked", value: selectedResource.lastChecked },
                      { label: "Drift Points", value: String(selectedResource.driftCount) },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-zinc-900 rounded p-3">
                        <div className="text-xs text-zinc-500">{label}</div>
                        <div className="text-sm font-medium text-zinc-200 mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>

                  {selectedResource.drifts.length > 0 ? (
                    <div>
                      <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Drift Details</div>
                      <div className="space-y-2">
                        {selectedResource.drifts.map((drift, i) => (
                          <div key={i} className={cn(
                            "rounded-lg border p-4",
                            drift.severity === "critical" ? "bg-rose-500/5 border-rose-500/20" :
                            drift.severity === "high" ? "bg-orange-500/5 border-orange-500/20" :
                            "bg-zinc-900 border-zinc-800"
                          )}>
                            <div className="flex items-center gap-2 mb-2">
                              <span className={cn("text-xs px-2 py-0.5 rounded border font-medium", severityBg[drift.severity])}>
                                <span className={severityColor[drift.severity]}>{drift.severity}</span>
                              </span>
                              <span className="font-mono text-sm text-zinc-200">{drift.field}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded p-2">
                                <div className="text-zinc-500 mb-1">Expected (IaC)</div>
                                <div className="text-emerald-400">{drift.expected}</div>
                              </div>
                              <div className="bg-rose-500/5 border border-rose-500/20 rounded p-2">
                                <div className="text-zinc-500 mb-1">Actual (live)</div>
                                <div className="text-rose-400">{drift.actual}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-4 text-center">
                      <div className="text-emerald-400 font-medium text-sm">✓ No drift detected</div>
                      <p className="text-xs text-zinc-500 mt-1">Resource matches expected state</p>
                    </div>
                  )}

                  {selectedResource.drifts.length > 0 && (
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">Apply Fix (terraform apply)</button>
                      <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">Acknowledge</button>
                      <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">View Plan</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Select a resource to view drift details</div>
              )}
            </div>
          </div>
        )}

        {/* HISTORY TAB */}
        {tab === "history" && (
          <div className="p-6">
            <div className="space-y-2">
              {DRIFT_HISTORY.map(event => (
                <div key={event.id} className={cn(
                  "bg-zinc-900 rounded-lg border px-5 py-3 flex items-center gap-4",
                  event.status === "detected" ? "border-rose-500/20" : "border-zinc-800"
                )}>
                  <span className="text-lg shrink-0">{event.status === "remediated" ? "✅" : event.status === "acknowledged" ? "👁️" : event.status === "ignored" ? "🔕" : "🚨"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm text-zinc-200">{event.resourceName}</span>
                      <span className="text-xs text-zinc-500">{event.type}</span>
                    </div>
                    <div className="text-xs text-zinc-600 mt-0.5">
                      {event.driftCount} drift{event.driftCount !== 1 ? "s" : ""} detected
                      {event.remediatedBy && <span> · remediated by <span className="text-zinc-400">{event.remediatedBy}</span></span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={cn("text-xs font-medium", historyStatusColor[event.status])}>{event.status}</div>
                    <div className="text-xs text-zinc-600 mt-0.5">{event.timestamp}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* REMEDIATION TAB */}
        {tab === "remediation" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Auto-Remediation Plan</h2>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-medium text-white">Terraform Apply</h3>
                    <p className="text-xs text-zinc-500 mt-0.5">Will reconcile 7 drifted resources across AWS + Kubernetes</p>
                  </div>
                  <button className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                    Run Plan →
                  </button>
                </div>
                <div className="space-y-1">
                  {DRIFT_RESOURCES.filter(r => r.status === "drifted").map(r => (
                    <div key={r.id} className="flex items-center gap-2 text-xs font-mono text-zinc-500 py-0.5">
                      <span className="text-amber-400">~</span>
                      <span className="text-zinc-300">{r.type.toLowerCase().replace(/ /g, "_")}</span>
                      <span className="text-zinc-600">{r.name}</span>
                      <span className="text-rose-400 ml-auto">{r.driftCount} change{r.driftCount !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
                </div>
                <div className="bg-zinc-800 rounded p-3 font-mono text-xs text-zinc-400">
                  <div className="text-zinc-500">$ terraform plan -out=drift-fix.tfplan</div>
                  <div className="text-emerald-400 mt-1">Plan: 0 to add, 7 to change, 0 to destroy.</div>
                  <div className="text-zinc-600 mt-0.5">Changes to Outputs: (none)</div>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Remediation Settings</h2>
              <div className="space-y-3">
                {[
                  { name: "Auto-remediate critical drifts", desc: "Automatically apply fixes for critical severity drifts", enabled: false },
                  { name: "Auto-remediate K8s replicas", desc: "Re-scale deployments to match Helm values", enabled: true },
                  { name: "Notify on drift detected", desc: "Send Slack alert when drift is first detected", enabled: true },
                  { name: "Block deploys on critical drift", desc: "Pause CI/CD pipeline until critical drifts are resolved", enabled: false },
                ].map(setting => (
                  <div key={setting.name} className="flex items-center justify-between bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3">
                    <div>
                      <div className="text-sm font-medium text-zinc-200">{setting.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{setting.desc}</div>
                    </div>
                    <div className={cn(
                      "w-10 h-5 rounded-full relative shrink-0 cursor-pointer transition-colors",
                      setting.enabled ? "bg-indigo-600" : "bg-zinc-700"
                    )}>
                      <div className={cn(
                        "absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform",
                        setting.enabled ? "translate-x-5" : "translate-x-0.5"
                      )} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

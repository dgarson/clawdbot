import React, { useState } from "react";
import { cn } from "../lib/utils";

type SecretStatus = "active" | "expiring" | "expired" | "rotated";
type EngineType = "kv" | "database" | "pki" | "aws" | "ssh";
type Tab = "secrets" | "engines" | "policies" | "audit";

interface Secret {
  id: string;
  path: string;
  engine: string;
  engineType: EngineType;
  version: number;
  status: SecretStatus;
  expiresAt: string | null;
  lastAccessed: string;
  lastRotated: string | null;
  accessCount: number;
  owner: string;
  tags: string[];
}

interface SecretEngine {
  id: string;
  name: string;
  type: EngineType;
  path: string;
  status: "active" | "sealed" | "degraded";
  secretCount: number;
  leaseCount: number;
  maxLeaseTtl: string;
  defaultLeaseTtl: string;
  description: string;
}

interface Policy {
  id: string;
  name: string;
  rules: PolicyRule[];
  attachedTo: string[];
  createdAt: string;
  updatedAt: string;
}

interface PolicyRule {
  path: string;
  capabilities: string[];
}

interface AuditEvent {
  id: string;
  timestamp: string;
  type: "read" | "write" | "delete" | "rotate" | "login" | "policy";
  path: string;
  accessor: string;
  clientToken: string;
  remoteAddr: string;
  status: "success" | "denied";
}

const SECRETS: Secret[] = [
  { id: "s1", path: "secret/prod/db/postgres", engine: "kv-v2", engineType: "kv", version: 4, status: "active", expiresAt: null, lastAccessed: "2m ago", lastRotated: "3d ago", accessCount: 1247, owner: "platform-team", tags: ["database", "prod"] },
  { id: "s2", path: "secret/prod/api/stripe-key", engine: "kv-v2", engineType: "kv", version: 2, status: "expiring", expiresAt: "2d", lastAccessed: "10m ago", lastRotated: "87d ago", accessCount: 892, owner: "billing-svc", tags: ["api", "payment", "prod"] },
  { id: "s3", path: "aws/creds/deploy-role", engine: "aws", engineType: "aws", version: 1, status: "active", expiresAt: "1h", lastAccessed: "30s ago", lastRotated: null, accessCount: 3401, owner: "ci-cd", tags: ["aws", "dynamic"] },
  { id: "s4", path: "database/creds/app-user", engine: "database", engineType: "database", version: 1, status: "active", expiresAt: "24h", lastAccessed: "1m ago", lastRotated: null, accessCount: 7823, owner: "app-service", tags: ["database", "dynamic"] },
  { id: "s5", path: "pki/issue/internal-ca", engine: "pki", engineType: "pki", version: 1, status: "active", expiresAt: "90d", lastAccessed: "5h ago", lastRotated: "30d ago", accessCount: 234, owner: "infra-team", tags: ["tls", "cert"] },
  { id: "s6", path: "secret/staging/db/redis", engine: "kv-v2", engineType: "kv", version: 2, status: "active", expiresAt: null, lastAccessed: "2h ago", lastRotated: "10d ago", accessCount: 412, owner: "platform-team", tags: ["database", "staging"] },
  { id: "s7", path: "secret/prod/oauth/google", engine: "kv-v2", engineType: "kv", version: 1, status: "expired", expiresAt: "2d ago", lastAccessed: "5d ago", lastRotated: null, accessCount: 56, owner: "auth-svc", tags: ["oauth", "prod"] },
  { id: "s8", path: "ssh/sign/prod-bastion", engine: "ssh", engineType: "ssh", version: 1, status: "active", expiresAt: "8h", lastAccessed: "3h ago", lastRotated: null, accessCount: 89, owner: "ops-team", tags: ["ssh", "prod"] },
  { id: "s9", path: "secret/prod/smtp/sendgrid", engine: "kv-v2", engineType: "kv", version: 3, status: "active", expiresAt: null, lastAccessed: "1d ago", lastRotated: "14d ago", accessCount: 301, owner: "notification-svc", tags: ["email", "prod"] },
  { id: "s10", path: "secret/prod/jwt/signing-key", engine: "kv-v2", engineType: "kv", version: 6, status: "rotated", expiresAt: null, lastAccessed: "45m ago", lastRotated: "1h ago", accessCount: 14230, owner: "auth-svc", tags: ["jwt", "auth", "prod"] },
];

const ENGINES: SecretEngine[] = [
  { id: "e1", name: "kv-v2", type: "kv", path: "secret/", status: "active", secretCount: 847, leaseCount: 0, maxLeaseTtl: "768h", defaultLeaseTtl: "768h", description: "Key/Value secrets v2 with versioning" },
  { id: "e2", name: "database", type: "database", path: "database/", status: "active", secretCount: 12, leaseCount: 234, maxLeaseTtl: "24h", defaultLeaseTtl: "1h", description: "Dynamic database credentials" },
  { id: "e3", name: "aws", type: "aws", path: "aws/", status: "active", secretCount: 8, leaseCount: 89, maxLeaseTtl: "1h", defaultLeaseTtl: "30m", description: "Dynamic AWS IAM credentials" },
  { id: "e4", name: "pki", type: "pki", path: "pki/", status: "active", secretCount: 3, leaseCount: 45, maxLeaseTtl: "8760h", defaultLeaseTtl: "720h", description: "PKI certificate authority" },
  { id: "e5", name: "ssh", type: "ssh", path: "ssh/", status: "degraded", secretCount: 2, leaseCount: 12, maxLeaseTtl: "24h", defaultLeaseTtl: "4h", description: "SSH key signing" },
];

const POLICIES: Policy[] = [
  { id: "p1", name: "app-service-policy", rules: [{ path: "secret/prod/*", capabilities: ["read", "list"] }, { path: "database/creds/app-user", capabilities: ["read"] }], attachedTo: ["app-service", "app-service-staging"], createdAt: "45d ago", updatedAt: "3d ago" },
  { id: "p2", name: "ci-cd-policy", rules: [{ path: "aws/creds/deploy-role", capabilities: ["read"] }, { path: "secret/staging/*", capabilities: ["read", "write", "list"] }], attachedTo: ["github-actions", "circleci"], createdAt: "120d ago", updatedAt: "14d ago" },
  { id: "p3", name: "platform-admin", rules: [{ path: "secret/*", capabilities: ["create", "read", "update", "delete", "list"] }, { path: "sys/*", capabilities: ["create", "read", "update", "delete", "list", "sudo"] }], attachedTo: ["platform-team"], createdAt: "365d ago", updatedAt: "7d ago" },
  { id: "p4", name: "billing-service-policy", rules: [{ path: "secret/prod/api/stripe-key", capabilities: ["read"] }, { path: "secret/prod/api/paypal-key", capabilities: ["read"] }], attachedTo: ["billing-svc"], createdAt: "90d ago", updatedAt: "30d ago" },
];

const AUDIT_EVENTS: AuditEvent[] = [
  { id: "a1", timestamp: "2s ago", type: "read", path: "database/creds/app-user", accessor: "app-service", clientToken: "s.xKj3...8Qmn", remoteAddr: "10.0.1.45", status: "success" },
  { id: "a2", timestamp: "15s ago", type: "read", path: "aws/creds/deploy-role", accessor: "github-actions", clientToken: "s.aB2z...7Pqr", remoteAddr: "192.30.252.10", status: "success" },
  { id: "a3", timestamp: "1m ago", type: "rotate", path: "secret/prod/jwt/signing-key", accessor: "platform-team", clientToken: "s.mN9y...3Fst", remoteAddr: "10.0.0.12", status: "success" },
  { id: "a4", timestamp: "2m ago", type: "read", path: "secret/prod/db/postgres", accessor: "unknown-service", clientToken: "s.uV4w...1Klm", remoteAddr: "10.0.3.99", status: "denied" },
  { id: "a5", timestamp: "5m ago", type: "write", path: "secret/staging/config/flags", accessor: "ci-cd", clientToken: "s.aB2z...7Pqr", remoteAddr: "192.30.252.10", status: "success" },
  { id: "a6", timestamp: "8m ago", type: "login", path: "auth/kubernetes/login", accessor: "auth-svc", clientToken: "s.cR7t...5Wxy", remoteAddr: "10.0.2.11", status: "success" },
  { id: "a7", timestamp: "12m ago", type: "delete", path: "secret/dev/old-api-key", accessor: "platform-team", clientToken: "s.mN9y...3Fst", remoteAddr: "10.0.0.12", status: "success" },
  { id: "a8", timestamp: "20m ago", type: "read", path: "pki/issue/internal-ca", accessor: "infra-team", clientToken: "s.hJ6k...9Abc", remoteAddr: "10.0.0.8", status: "success" },
];

const statusColor: Record<SecretStatus, string> = {
  active: "text-emerald-400",
  expiring: "text-amber-400",
  expired: "text-rose-400",
  rotated: "text-indigo-400",
};

const statusBg: Record<SecretStatus, string> = {
  active: "bg-emerald-400/10 border-emerald-400/30",
  expiring: "bg-amber-400/10 border-amber-400/30",
  expired: "bg-rose-400/10 border-rose-400/30",
  rotated: "bg-indigo-400/10 border-indigo-400/30",
};

const engineIcon: Record<EngineType, string> = {
  kv: "🗝️",
  database: "🗄️",
  pki: "🔐",
  aws: "☁️",
  ssh: "🖥️",
};

const capabilityColor: Record<string, string> = {
  read: "bg-sky-500/20 text-sky-400",
  write: "bg-amber-500/20 text-amber-400",
  update: "bg-amber-500/20 text-amber-400",
  create: "bg-emerald-500/20 text-emerald-400",
  delete: "bg-rose-500/20 text-rose-400",
  list: "bg-zinc-500/20 text-zinc-300",
  sudo: "bg-purple-500/20 text-purple-400",
};

export default function VaultSecretsManager() {
  const [tab, setTab] = useState<Tab>("secrets");
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null);
  const [engineFilter, setEngineFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);
  const [auditFilter, setAuditFilter] = useState<string>("all");

  const filteredSecrets = SECRETS.filter(s => {
    if (engineFilter !== "all" && s.engineType !== engineFilter) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (searchQuery && !s.path.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "secrets", label: "Secrets", emoji: "🔑" },
    { id: "engines", label: "Engines", emoji: "⚙️" },
    { id: "policies", label: "Policies", emoji: "📋" },
    { id: "audit", label: "Audit Log", emoji: "🔍" },
  ];

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Vault Secrets Manager</h1>
          <p className="text-xs text-zinc-500 mt-0.5">HashiCorp Vault — cluster: vault-prod-us-east</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/30">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 font-medium">Vault Unsealed</span>
          </div>
          <div className="text-xs text-zinc-500">2 standbys</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-0 border-b border-zinc-800">
        {[
          { label: "Total Secrets", value: "872", sub: "kv-v2 engine" },
          { label: "Active Leases", value: "380", sub: "dynamic creds" },
          { label: "Expiring Soon", value: "3", sub: "within 7d", alert: true },
          { label: "Policies", value: "18", sub: "attached to 47 entities" },
          { label: "Audit Events", value: "14.2k", sub: "last 24h" },
        ].map((stat, i) => (
          <div key={i} className={cn("px-6 py-3 border-r border-zinc-800 last:border-r-0", stat.alert && "bg-amber-500/5")}>
            <div className={cn("text-xl font-bold", stat.alert ? "text-amber-400" : "text-white")}>{stat.value}</div>
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
              tab === t.id
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* SECRETS TAB */}
        {tab === "secrets" && (
          <div className="flex h-full">
            {/* List panel */}
            <div className="w-96 border-r border-zinc-800 flex flex-col">
              {/* Filters */}
              <div className="p-3 space-y-2 border-b border-zinc-800">
                <input
                  type="text"
                  placeholder="Search paths..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-1.5 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-zinc-500"
                />
                <div className="flex gap-2">
                  <select
                    value={engineFilter}
                    onChange={e => setEngineFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All engines</option>
                    <option value="kv">KV v2</option>
                    <option value="database">Database</option>
                    <option value="aws">AWS</option>
                    <option value="pki">PKI</option>
                    <option value="ssh">SSH</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All status</option>
                    <option value="active">Active</option>
                    <option value="expiring">Expiring</option>
                    <option value="expired">Expired</option>
                    <option value="rotated">Rotated</option>
                  </select>
                </div>
              </div>
              {/* Secret list */}
              <div className="flex-1 overflow-y-auto">
                {filteredSecrets.map(secret => (
                  <button
                    key={secret.id}
                    onClick={() => setSelectedSecret(secret)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors",
                      selectedSecret?.id === secret.id && "bg-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{engineIcon[secret.engineType]}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-mono text-zinc-200 truncate">{secret.path}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">{secret.engine} · v{secret.version}</div>
                        </div>
                      </div>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", statusBg[secret.status])}>
                        <span className={statusColor[secret.status]}>{secret.status}</span>
                      </span>
                    </div>
                    {secret.status === "expiring" && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-amber-400">
                        <span>⚠️</span>
                        <span>Expires in {secret.expiresAt}</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Detail panel */}
            <div className="flex-1 overflow-y-auto">
              {selectedSecret ? (
                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl">{engineIcon[selectedSecret.engineType]}</span>
                      <div>
                        <div className="font-mono text-sm text-zinc-200">{selectedSecret.path}</div>
                        <div className="text-xs text-zinc-500 mt-0.5">{selectedSecret.engine} — version {selectedSecret.version}</div>
                      </div>
                      <span className={cn("ml-auto text-xs px-2 py-1 rounded border", statusBg[selectedSecret.status])}>
                        <span className={statusColor[selectedSecret.status]}>{selectedSecret.status}</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Owner", value: selectedSecret.owner },
                        { label: "Last Accessed", value: selectedSecret.lastAccessed },
                        { label: "Last Rotated", value: selectedSecret.lastRotated || "Never" },
                        { label: "Access Count", value: selectedSecret.accessCount.toLocaleString() },
                        { label: "Expires", value: selectedSecret.expiresAt || "Never" },
                        { label: "Engine Type", value: selectedSecret.engineType.toUpperCase() },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-zinc-900 rounded p-3">
                          <div className="text-xs text-zinc-500">{label}</div>
                          <div className="text-sm font-medium text-zinc-200 mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tags */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Tags</div>
                    <div className="flex gap-2 flex-wrap">
                      {selectedSecret.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-300 font-mono">{tag}</span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Actions</div>
                    <div className="flex gap-2 flex-wrap">
                      {["Read Value", "Rotate Now", "View History", "Revoke Leases", "Update Policy"].map(action => (
                        <button key={action} className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Access trend */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Access Trend — 7d</div>
                    <div className="flex items-end gap-1 h-16">
                      {[42, 67, 54, 89, 73, 91, 85].map((v, i) => (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div
                            className="w-full bg-indigo-500/60 rounded-sm"
                            style={{ height: `${(v / 91) * 100}%` }}
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between mt-1">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                        <span key={d} className="text-xs text-zinc-600">{d}</span>
                      ))}
                    </div>
                  </div>

                  {selectedSecret.status === "expiring" && (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <div className="flex items-center gap-2 text-amber-400 font-medium text-sm mb-1">
                        <span>⚠️</span> Rotation Required
                      </div>
                      <p className="text-xs text-amber-300/70">This secret expires in {selectedSecret.expiresAt}. Schedule rotation or enable auto-rotation to avoid service disruption.</p>
                      <button className="mt-2 px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-xs text-amber-400 transition-colors">
                        Enable Auto-Rotation
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Select a secret to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* ENGINES TAB */}
        {tab === "engines" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-semibold text-zinc-300">Secret Engines</h2>
              <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                + Enable Engine
              </button>
            </div>
            <div className="space-y-3">
              {ENGINES.map(engine => (
                <div key={engine.id} className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{engineIcon[engine.type]}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm text-white">{engine.name}</span>
                          <span className="text-xs text-zinc-500 font-mono">/{engine.path}</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5">{engine.description}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        engine.status === "active" ? "bg-emerald-500/10 text-emerald-400" :
                        engine.status === "degraded" ? "bg-amber-500/10 text-amber-400" :
                        "bg-zinc-700 text-zinc-400"
                      )}>
                        {engine.status}
                      </span>
                      <button className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1 bg-zinc-800 rounded transition-colors">Configure</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: "Secrets", value: engine.secretCount.toLocaleString() },
                      { label: "Active Leases", value: engine.leaseCount.toLocaleString() },
                      { label: "Default TTL", value: engine.defaultLeaseTtl },
                      { label: "Max TTL", value: engine.maxLeaseTtl },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <div className="text-xs text-zinc-600">{label}</div>
                        <div className="text-sm font-medium text-zinc-300 mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                  {engine.status === "degraded" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                      <span>⚠️</span> Engine degraded — SSH signing latency above threshold (avg 2.4s)
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* POLICIES TAB */}
        {tab === "policies" && (
          <div className="flex h-full">
            <div className="w-80 border-r border-zinc-800 overflow-y-auto">
              <div className="p-3 border-b border-zinc-800">
                <div className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Policies (18)</div>
                <button className="w-full px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                  + New Policy
                </button>
              </div>
              {POLICIES.map(policy => (
                <button
                  key={policy.id}
                  onClick={() => setSelectedPolicy(policy)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors",
                    selectedPolicy?.id === policy.id && "bg-zinc-800"
                  )}
                >
                  <div className="text-sm font-medium text-zinc-200 font-mono">{policy.name}</div>
                  <div className="text-xs text-zinc-500 mt-0.5">{policy.rules.length} rules · {policy.attachedTo.length} entities</div>
                  <div className="text-xs text-zinc-600 mt-0.5">Updated {policy.updatedAt}</div>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto">
              {selectedPolicy ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="font-mono text-sm font-semibold text-white">{selectedPolicy.name}</h2>
                      <p className="text-xs text-zinc-500 mt-0.5">Created {selectedPolicy.createdAt} · Updated {selectedPolicy.updatedAt}</p>
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">Edit</button>
                      <button className="px-3 py-1.5 text-xs bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-rose-400 transition-colors">Delete</button>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Path Rules</div>
                    <div className="space-y-2">
                      {selectedPolicy.rules.map((rule, i) => (
                        <div key={i} className="bg-zinc-900 rounded-lg border border-zinc-800 p-3">
                          <div className="font-mono text-xs text-zinc-200 mb-2">{rule.path}</div>
                          <div className="flex gap-1.5 flex-wrap">
                            {rule.capabilities.map(cap => (
                              <span key={cap} className={cn("text-xs px-2 py-0.5 rounded-full font-medium", capabilityColor[cap] || "bg-zinc-700 text-zinc-300")}>
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Attached To</div>
                    <div className="flex gap-2 flex-wrap">
                      {selectedPolicy.attachedTo.map(entity => (
                        <span key={entity} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300 font-mono">
                          {entity}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">HCL Preview</div>
                    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4 font-mono text-xs text-zinc-400 overflow-x-auto">
                      {selectedPolicy.rules.map((rule, i) => (
                        <div key={i} className="mb-3 last:mb-0">
                          <span className="text-indigo-400">path</span>
                          <span className="text-zinc-300"> "{rule.path}" </span>
                          <span className="text-zinc-500">{"{"}</span>
                          <div className="ml-4">
                            <span className="text-sky-400">capabilities</span>
                            <span className="text-zinc-300"> = [</span>
                            {rule.capabilities.map((cap, j) => (
                              <span key={cap}>
                                <span className="text-emerald-400">"{cap}"</span>
                                {j < rule.capabilities.length - 1 && <span className="text-zinc-300">, </span>}
                              </span>
                            ))}
                            <span className="text-zinc-300">]</span>
                          </div>
                          <span className="text-zinc-500">{"}"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
                  Select a policy to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIT LOG TAB */}
        {tab === "audit" && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="flex gap-2">
                {["all", "read", "write", "rotate", "delete", "denied"].map(f => (
                  <button
                    key={f}
                    onClick={() => setAuditFilter(f)}
                    className={cn(
                      "px-3 py-1 text-xs rounded transition-colors capitalize",
                      auditFilter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                    )}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <span className="ml-auto text-xs text-zinc-500">Streaming audit log — last 100 events</span>
            </div>

            <div className="space-y-1">
              {AUDIT_EVENTS.filter(e =>
                auditFilter === "all" ? true :
                auditFilter === "denied" ? e.status === "denied" :
                e.type === auditFilter
              ).map(event => (
                <div key={event.id} className={cn(
                  "flex items-center gap-4 px-4 py-2.5 rounded-lg border text-xs font-mono",
                  event.status === "denied"
                    ? "bg-rose-500/5 border-rose-500/20"
                    : "bg-zinc-900 border-zinc-800"
                )}>
                  <span className="text-zinc-600 w-16 shrink-0">{event.timestamp}</span>
                  <span className={cn(
                    "w-12 shrink-0 font-medium",
                    event.type === "read" ? "text-sky-400" :
                    event.type === "write" ? "text-amber-400" :
                    event.type === "delete" ? "text-rose-400" :
                    event.type === "rotate" ? "text-indigo-400" :
                    event.type === "login" ? "text-emerald-400" :
                    "text-zinc-400"
                  )}>{event.type}</span>
                  <span className={cn(
                    "w-16 shrink-0 text-center rounded px-1.5 py-0.5",
                    event.status === "success" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                  )}>{event.status}</span>
                  <span className="flex-1 text-zinc-300 truncate">{event.path}</span>
                  <span className="text-zinc-500 w-28 shrink-0 truncate">{event.accessor}</span>
                  <span className="text-zinc-600 w-24 shrink-0">{event.remoteAddr}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

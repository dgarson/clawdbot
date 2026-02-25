import React, { useState } from "react";
import { cn } from "../lib/utils";

type KeyStatus = "active" | "expired" | "revoked" | "rotating";
type SAStatus = "active" | "inactive" | "suspended";
type RotationPolicy = "30d" | "60d" | "90d" | "180d" | "never";

interface ServiceKey {
  id: string;
  name: string;
  prefix: string;
  status: KeyStatus;
  createdAt: string;
  expiresAt: string | null;
  lastUsed: string | null;
  usageCount: number;
  scopes: string[];
}

interface ServiceAccount {
  id: string;
  name: string;
  displayName: string;
  status: SAStatus;
  description: string;
  team: string;
  roles: string[];
  keys: ServiceKey[];
  rotationPolicy: RotationPolicy;
  createdAt: string;
  lastActivity: string;
  requestsLast30d: number;
}

interface AuditEntry {
  id: string;
  action: string;
  serviceAccount: string;
  keyId: string;
  actor: string;
  timestamp: string;
  result: "success" | "failure";
  ip: string;
}

const SERVICE_ACCOUNTS: ServiceAccount[] = [
  {
    id: "sa1",
    name: "sa-api-gateway",
    displayName: "API Gateway",
    status: "active",
    description: "Service account for the main API gateway to access internal services",
    team: "Platform",
    roles: ["api:read", "api:write", "metrics:read"],
    rotationPolicy: "90d",
    createdAt: "2025-08-15",
    lastActivity: "2026-02-22T14:28:00Z",
    requestsLast30d: 84291,
    keys: [
      {
        id: "k1a",
        name: "Production Key",
        prefix: "sak_live_xK9m",
        status: "active",
        createdAt: "2025-11-15",
        expiresAt: "2026-02-13",
        lastUsed: "2026-02-22T14:28:00Z",
        usageCount: 82913,
        scopes: ["api:read", "api:write"],
      },
      {
        id: "k1b",
        name: "Backup Key",
        prefix: "sak_live_bP3r",
        status: "rotating",
        createdAt: "2026-02-20",
        expiresAt: "2026-05-20",
        lastUsed: null,
        usageCount: 0,
        scopes: ["api:read", "api:write"],
      },
    ],
  },
  {
    id: "sa2",
    name: "sa-data-pipeline",
    displayName: "Data Pipeline",
    status: "active",
    description: "ETL pipeline service account for reading and writing to data stores",
    team: "Data Engineering",
    roles: ["data:read", "data:write", "storage:read", "storage:write"],
    rotationPolicy: "60d",
    createdAt: "2025-07-01",
    lastActivity: "2026-02-22T13:45:00Z",
    requestsLast30d: 31204,
    keys: [
      {
        id: "k2a",
        name: "ETL Key",
        prefix: "sak_live_dQ7n",
        status: "active",
        createdAt: "2025-12-20",
        expiresAt: "2026-02-18",
        lastUsed: "2026-02-22T13:45:00Z",
        usageCount: 31100,
        scopes: ["data:read", "data:write", "storage:read", "storage:write"],
      },
    ],
  },
  {
    id: "sa3",
    name: "sa-monitoring",
    displayName: "Monitoring Agent",
    status: "active",
    description: "Scrapes metrics and sends alerts. Read-only access to all services.",
    team: "SRE",
    roles: ["metrics:read", "logs:read", "alerts:write"],
    rotationPolicy: "180d",
    createdAt: "2025-06-10",
    lastActivity: "2026-02-22T14:30:00Z",
    requestsLast30d: 129340,
    keys: [
      {
        id: "k3a",
        name: "Prom Scrape Key",
        prefix: "sak_live_mX2p",
        status: "active",
        createdAt: "2025-09-01",
        expiresAt: "2026-03-01",
        lastUsed: "2026-02-22T14:30:00Z",
        usageCount: 128000,
        scopes: ["metrics:read", "logs:read"],
      },
    ],
  },
  {
    id: "sa4",
    name: "sa-ci-deployer",
    displayName: "CI/CD Deployer",
    status: "active",
    description: "GitHub Actions service account for deployments to all environments",
    team: "DevOps",
    roles: ["deploy:write", "config:read", "secrets:read"],
    rotationPolicy: "30d",
    createdAt: "2025-05-20",
    lastActivity: "2026-02-21T18:00:00Z",
    requestsLast30d: 412,
    keys: [
      {
        id: "k4a",
        name: "GH Actions Key",
        prefix: "sak_live_cD5s",
        status: "active",
        createdAt: "2026-01-22",
        expiresAt: "2026-02-22",
        lastUsed: "2026-02-21T18:00:00Z",
        usageCount: 400,
        scopes: ["deploy:write", "config:read"],
      },
      {
        id: "k4b",
        name: "Old Deploy Key",
        prefix: "sak_live_oZ8q",
        status: "revoked",
        createdAt: "2025-12-01",
        expiresAt: "2026-01-01",
        lastUsed: "2025-12-31T23:59:00Z",
        usageCount: 892,
        scopes: ["deploy:write"],
      },
    ],
  },
  {
    id: "sa5",
    name: "sa-backup-service",
    displayName: "Backup Service",
    status: "inactive",
    description: "Automated backup service (currently paused for migration)",
    team: "Platform",
    roles: ["storage:read", "storage:write", "data:read"],
    rotationPolicy: "90d",
    createdAt: "2025-04-12",
    lastActivity: "2026-01-15T03:00:00Z",
    requestsLast30d: 0,
    keys: [
      {
        id: "k5a",
        name: "Backup Key",
        prefix: "sak_live_bkZ1",
        status: "expired",
        createdAt: "2025-10-15",
        expiresAt: "2026-01-15",
        lastUsed: "2026-01-15T03:00:00Z",
        usageCount: 18000,
        scopes: ["storage:read", "storage:write"],
      },
    ],
  },
];

const AUDIT_LOG: AuditEntry[] = [
  { id: "a1", action: "key.created", serviceAccount: "sa-api-gateway", keyId: "k1b", actor: "jane@openclaw.io", timestamp: "2026-02-20T09:30:00Z", result: "success", ip: "10.0.1.45" },
  { id: "a2", action: "key.rotated", serviceAccount: "sa-api-gateway", keyId: "k1a", actor: "system", timestamp: "2026-02-20T09:30:00Z", result: "success", ip: "10.0.0.1" },
  { id: "a3", action: "key.revoked", serviceAccount: "sa-ci-deployer", keyId: "k4b", actor: "mike@openclaw.io", timestamp: "2026-01-05T14:00:00Z", result: "success", ip: "10.0.2.12" },
  { id: "a4", action: "sa.suspended", serviceAccount: "sa-backup-service", keyId: "—", actor: "admin@openclaw.io", timestamp: "2026-01-20T11:00:00Z", result: "success", ip: "10.0.1.99" },
  { id: "a5", action: "key.auth_failed", serviceAccount: "sa-data-pipeline", keyId: "k2a", actor: "system", timestamp: "2026-02-22T08:15:00Z", result: "failure", ip: "203.0.113.42" },
  { id: "a6", action: "key.created", serviceAccount: "sa-monitoring", keyId: "k3a", actor: "sre@openclaw.io", timestamp: "2025-09-01T10:00:00Z", result: "success", ip: "10.0.1.5" },
];

const TABS = ["Accounts", "Keys", "Rotation", "Audit"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<SAStatus, string> = {
  active: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  inactive: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30",
  suspended: "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

const keyStatusColor: Record<KeyStatus, string> = {
  active: "text-emerald-400",
  expired: "text-amber-400",
  revoked: "text-rose-400",
  rotating: "text-primary",
};

const expiryWarning = (expiresAt: string | null): string | null => {
  if (!expiresAt) {return null;}
  const now = new Date("2026-02-22");
  const exp = new Date(expiresAt);
  const days = Math.floor((exp.getTime() - now.getTime()) / 86400000);
  if (days < 0) {return "Expired";}
  if (days <= 7) {return `Expires in ${days}d`;}
  if (days <= 30) {return `Expires in ${days}d`;}
  return null;
};

export default function ServiceAccountManager(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Accounts");
  const [selectedSA, setSelectedSA] = useState<ServiceAccount>(SERVICE_ACCOUNTS[0]);
  const [showKeyValue, setShowKeyValue] = useState<Record<string, boolean>>({});

  const toggleKeyReveal = (keyId: string) => {
    setShowKeyValue((prev) => ({ ...prev, [keyId]: !prev[keyId] }));
  };

  const allKeys = SERVICE_ACCOUNTS.flatMap((sa) =>
    sa.keys.map((k) => ({ ...k, saName: sa.displayName, saId: sa.id }))
  );

  const expiringSoon = allKeys.filter((k) => {
    if (!k.expiresAt || k.status !== "active") {return false;}
    const now = new Date("2026-02-22");
    const exp = new Date(k.expiresAt);
    return (exp.getTime() - now.getTime()) / 86400000 <= 30;
  });

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Service Account Manager</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Manage service accounts, API keys, and rotation policies</p>
        </div>
        <div className="flex items-center gap-3">
          {expiringSoon.length > 0 && (
            <div className="text-xs px-2 py-1 rounded bg-amber-400/10 border border-amber-400/30 text-amber-400">
              ⚠ {expiringSoon.length} key{expiringSoon.length > 1 ? "s" : ""} expiring soon
            </div>
          )}
          <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded-md transition-colors">
            + New Service Account
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-primary border-primary"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── ACCOUNTS ── */}
        {tab === "Accounts" && (
          <div className="h-full flex">
            {/* SA list */}
            <div className="w-64 border-r border-[var(--color-border)] overflow-y-auto">
              {SERVICE_ACCOUNTS.map((sa) => (
                <button
                  key={sa.id}
                  onClick={() => setSelectedSA(sa)}
                  className={cn(
                    "w-full text-left px-4 py-4 border-b border-[var(--color-border)]/50 transition-colors",
                    selectedSA.id === sa.id ? "bg-primary/10" : "hover:bg-[var(--color-surface-2)]/40"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium text-[var(--color-text-primary)]">{sa.displayName}</div>
                    <div className={cn("text-[10px] px-1 py-0.5 rounded border", statusColor[sa.status])}>{sa.status}</div>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] font-mono mt-1">{sa.name}</div>
                  <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">{sa.team}</div>
                </button>
              ))}
            </div>

            {/* SA detail */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold">{selectedSA.displayName}</h2>
                    <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedSA.status])}>{selectedSA.status}</span>
                  </div>
                  <div className="text-sm text-[var(--color-text-muted)] font-mono mt-1">{selectedSA.name}</div>
                  <p className="text-sm text-[var(--color-text-secondary)] mt-2">{selectedSA.description}</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)] rounded-md transition-colors">Edit</button>
                  <button className="px-3 py-1.5 text-xs border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors">Suspend</button>
                </div>
              </div>

              {/* Meta */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Team", value: selectedSA.team },
                  { label: "Created", value: selectedSA.createdAt },
                  { label: "Rotation Policy", value: selectedSA.rotationPolicy },
                  { label: "Requests (30d)", value: selectedSA.requestsLast30d.toLocaleString() },
                ].map((m) => (
                  <div key={m.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
                    <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
                    <div className="text-sm font-medium mt-1">{m.value}</div>
                  </div>
                ))}
              </div>

              {/* Roles */}
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">Roles & Scopes</div>
                <div className="flex flex-wrap gap-2">
                  {selectedSA.roles.map((r) => (
                    <span key={r} className="text-xs px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] font-mono">{r}</span>
                  ))}
                </div>
              </div>

              {/* Keys */}
              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider">API Keys</div>
                  <button className="text-xs text-primary hover:text-indigo-300">+ Create Key</button>
                </div>
                <div className="divide-y divide-[var(--color-border)]">
                  {selectedSA.keys.map((key) => {
                    const warn = expiryWarning(key.expiresAt);
                    return (
                      <div key={key.id} className="px-5 py-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium">{key.name}</span>
                            <span className={cn("text-xs", keyStatusColor[key.status])}>{key.status}</span>
                            {warn && (
                              <span className={cn("text-[10px] px-1.5 py-0.5 rounded border",
                                warn === "Expired" ? "text-rose-400 bg-rose-400/10 border-rose-400/30" : "text-amber-400 bg-amber-400/10 border-amber-400/30"
                              )}>{warn}</span>
                            )}
                          </div>
                          {key.status === "active" && (
                            <div className="flex gap-2">
                              <button className="text-xs text-amber-400 hover:text-amber-300">Rotate</button>
                              <button className="text-xs text-rose-400 hover:text-rose-300">Revoke</button>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs font-mono">
                          <span className="text-[var(--color-text-primary)]">
                            {showKeyValue[key.id] ? `${key.prefix}••••••••••••••••••••` : `${key.prefix}••••••••••••••••••••`}
                          </span>
                          <button
                            onClick={() => toggleKeyReveal(key.id)}
                            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-[10px]"
                          >
                            {showKeyValue[key.id] ? "hide" : "reveal"}
                          </button>
                        </div>
                        <div className="flex gap-4 mt-2 text-[10px] text-[var(--color-text-muted)]">
                          <span>Created: {key.createdAt}</span>
                          {key.expiresAt && <span>Expires: {key.expiresAt}</span>}
                          {key.lastUsed && <span>Last used: {key.lastUsed.slice(0, 10)}</span>}
                          <span>{key.usageCount.toLocaleString()} requests</span>
                        </div>
                        {key.scopes.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {key.scopes.map((s) => (
                              <span key={s} className="text-[10px] px-1 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] font-mono">{s}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── KEYS ── */}
        {tab === "Keys" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
                <h3 className="text-sm font-medium">All API Keys</h3>
                <span className="text-xs text-[var(--color-text-muted)]">{allKeys.length} total</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--color-border)]">
                      {["Key Name", "Service Account", "Prefix", "Status", "Expires", "Last Used", "Requests"].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-[var(--color-text-muted)] font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {allKeys.map((key) => {
                      const warn = expiryWarning(key.expiresAt);
                      return (
                        <tr key={key.id} className="hover:bg-[var(--color-surface-2)]/30">
                          <td className="px-4 py-3 text-sm">{key.name}</td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{key.saName}</td>
                          <td className="px-4 py-3 text-xs font-mono text-[var(--color-text-primary)]">{key.prefix}…</td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs", keyStatusColor[key.status])}>{key.status}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs">{key.expiresAt ?? "—"}</div>
                            {warn && <div className={cn("text-[10px]", warn === "Expired" ? "text-rose-400" : "text-amber-400")}>{warn}</div>}
                          </td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{key.lastUsed ? key.lastUsed.slice(0, 10) : "—"}</td>
                          <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">{key.usageCount.toLocaleString()}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ROTATION ── */}
        {tab === "Rotation" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {expiringSoon.length > 0 && (
              <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4">
                <div className="text-sm font-medium text-amber-400 mb-2">⚠ Keys requiring attention</div>
                <div className="space-y-1">
                  {expiringSoon.map((k) => (
                    <div key={k.id} className="text-xs text-[var(--color-text-primary)]">
                      <span className="font-mono">{k.prefix}…</span> ({k.saName}) — {expiryWarning(k.expiresAt)}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium">Rotation Policies</h3>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {SERVICE_ACCOUNTS.map((sa) => (
                  <div key={sa.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium">{sa.displayName}</div>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">{sa.name}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        defaultValue={sa.rotationPolicy}
                        className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded px-2 py-1 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                      >
                        {(["30d", "60d", "90d", "180d", "never"] as const).map((p) => (
                          <option key={p} value={p}>{p}</option>
                        ))}
                      </select>
                    </div>
                    <button className="px-3 py-1 text-xs bg-primary/20 border border-primary/40 text-indigo-300 rounded hover:bg-primary/30 transition-colors">
                      Rotate Now
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT ── */}
        {tab === "Audit" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="space-y-2">
              {AUDIT_LOG.map((entry) => (
                <div key={entry.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-5 py-3 flex items-center gap-4">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", entry.result === "success" ? "bg-emerald-400" : "bg-rose-400")} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-mono font-medium text-indigo-300">{entry.action}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{entry.serviceAccount}</span>
                      {entry.keyId !== "—" && (
                        <span className="text-[10px] text-[var(--color-text-muted)] font-mono">key:{entry.keyId}</span>
                      )}
                    </div>
                    <div className="flex gap-3 mt-1 text-[10px] text-[var(--color-text-muted)]">
                      <span>Actor: {entry.actor}</span>
                      <span>IP: {entry.ip}</span>
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] shrink-0">{entry.timestamp.slice(0, 16).replace("T", " ")}</div>
                  <div className={cn("text-xs font-medium shrink-0", entry.result === "success" ? "text-emerald-400" : "text-rose-400")}>
                    {entry.result}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

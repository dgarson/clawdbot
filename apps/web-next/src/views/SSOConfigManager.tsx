import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type SSOProtocol = "saml" | "oidc" | "oauth2" | "ldap";
type ConnectionStatus = "active" | "inactive" | "testing" | "error";

interface SSOConnection {
  id: string;
  name: string;
  protocol: SSOProtocol;
  provider: string;
  status: ConnectionStatus;
  entityId: string;
  loginUrl: string;
  userCount: number;
  lastUsed: string;
  createdAt: string;
  autoProvision: boolean;
  jitProvisioning: boolean;
  defaultRole: string;
  domains: string[];
}

interface AttributeMapping {
  id: string;
  connectionId: string;
  samlAttribute: string;
  appField: string;
  transform: string | null;
  required: boolean;
}

interface SSOSession {
  id: string;
  userId: string;
  email: string;
  connectionId: string;
  loginAt: string;
  expiresAt: string;
  ipAddress: string;
  userAgent: string;
  active: boolean;
}

interface ProvisioningLog {
  id: string;
  timestamp: string;
  action: "created" | "updated" | "deactivated" | "failed";
  email: string;
  connectionId: string;
  details: string;
}

// ── Sample Data ────────────────────────────────────────────────────────────

const connections: SSOConnection[] = [
  {
    id: "conn-okta", name: "Okta (Production)", protocol: "saml", provider: "Okta",
    status: "active", entityId: "https://openclawapp.okta.com/exk1234", loginUrl: "https://openclawapp.okta.com/app/openclawapp/sso/saml",
    userCount: 1240, lastUsed: "2026-02-22T06:14:00Z", createdAt: "2024-01-15",
    autoProvision: true, jitProvisioning: true, defaultRole: "member",
    domains: ["openclawapp.com", "openclawteam.com"],
  },
  {
    id: "conn-azure", name: "Azure AD (Production)", protocol: "oidc", provider: "Microsoft Azure AD",
    status: "active", entityId: "https://login.microsoftonline.com/tenant-id/v2.0", loginUrl: "https://login.microsoftonline.com/tenant-id/oauth2/v2.0/authorize",
    userCount: 482, lastUsed: "2026-02-22T05:58:00Z", createdAt: "2024-03-01",
    autoProvision: true, jitProvisioning: false, defaultRole: "viewer",
    domains: ["contractor.openclawapp.com"],
  },
  {
    id: "conn-google", name: "Google Workspace", protocol: "oidc", provider: "Google",
    status: "active", entityId: "https://accounts.google.com", loginUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    userCount: 84, lastUsed: "2026-02-22T04:30:00Z", createdAt: "2024-06-01",
    autoProvision: false, jitProvisioning: true, defaultRole: "viewer",
    domains: ["partner.openclawapp.com"],
  },
  {
    id: "conn-onelogin", name: "OneLogin (Staging)", protocol: "saml", provider: "OneLogin",
    status: "testing", entityId: "https://app.onelogin.com/saml/metadata/stage-app", loginUrl: "https://openclawapp.onelogin.com/trust/saml2/http-post/sso",
    userCount: 12, lastUsed: "2026-02-21T16:00:00Z", createdAt: "2026-02-01",
    autoProvision: false, jitProvisioning: false, defaultRole: "viewer",
    domains: ["staging.openclawapp.com"],
  },
  {
    id: "conn-ldap", name: "Active Directory (Legacy)", protocol: "ldap", provider: "Microsoft AD",
    status: "inactive", entityId: "ldap://ad.openclawapp.local", loginUrl: "ldap://ad.openclawapp.local:389",
    userCount: 0, lastUsed: "2025-12-01T00:00:00Z", createdAt: "2023-06-01",
    autoProvision: false, jitProvisioning: false, defaultRole: "member",
    domains: ["internal.openclawapp.com"],
  },
];

const attributeMappings: AttributeMapping[] = [
  { id: "m1", connectionId: "conn-okta", samlAttribute: "email", appField: "email", transform: null, required: true },
  { id: "m2", connectionId: "conn-okta", samlAttribute: "firstName", appField: "name", transform: "concat(firstName, ' ', lastName)", required: true },
  { id: "m3", connectionId: "conn-okta", samlAttribute: "lastName", appField: "family_name", transform: null, required: false },
  { id: "m4", connectionId: "conn-okta", samlAttribute: "groups", appField: "role", transform: "mapGroupsToRole", required: true },
  { id: "m5", connectionId: "conn-okta", samlAttribute: "department", appField: "department", transform: "lowercase", required: false },
  { id: "m6", connectionId: "conn-okta", samlAttribute: "employeeId", appField: "external_id", transform: null, required: false },
  { id: "m7", connectionId: "conn-azure", samlAttribute: "email", appField: "email", transform: null, required: true },
  { id: "m8", connectionId: "conn-azure", samlAttribute: "displayName", appField: "name", transform: null, required: true },
  { id: "m9", connectionId: "conn-azure", samlAttribute: "jobTitle", appField: "title", transform: null, required: false },
];

const sessions: SSOSession[] = [
  { id: "s1", userId: "usr-001", email: "alice@openclawapp.com", connectionId: "conn-okta", loginAt: "2026-02-22T06:00:00Z", expiresAt: "2026-02-22T14:00:00Z", ipAddress: "198.51.100.1", userAgent: "Chrome/120 (macOS)", active: true },
  { id: "s2", userId: "usr-002", email: "bob@openclawapp.com", connectionId: "conn-okta", loginAt: "2026-02-22T05:30:00Z", expiresAt: "2026-02-22T13:30:00Z", ipAddress: "198.51.100.2", userAgent: "Safari/17 (macOS)", active: true },
  { id: "s3", userId: "usr-003", email: "carol@contractor.openclawapp.com", connectionId: "conn-azure", loginAt: "2026-02-22T04:45:00Z", expiresAt: "2026-02-22T12:45:00Z", ipAddress: "203.0.113.10", userAgent: "Edge/120 (Windows)", active: true },
  { id: "s4", userId: "usr-004", email: "dave@openclawapp.com", connectionId: "conn-okta", loginAt: "2026-02-22T03:00:00Z", expiresAt: "2026-02-22T11:00:00Z", ipAddress: "198.51.100.4", userAgent: "Firefox/121 (Linux)", active: false },
  { id: "s5", userId: "usr-005", email: "eve@partner.openclawapp.com", connectionId: "conn-google", loginAt: "2026-02-22T04:30:00Z", expiresAt: "2026-02-22T12:30:00Z", ipAddress: "192.0.2.50", userAgent: "Chrome/120 (macOS)", active: true },
  { id: "s6", userId: "usr-006", email: "frank@openclawapp.com", connectionId: "conn-okta", loginAt: "2026-02-22T02:00:00Z", expiresAt: "2026-02-22T10:00:00Z", ipAddress: "198.51.100.6", userAgent: "Chrome/120 (Windows)", active: false },
];

const provisioningLogs: ProvisioningLog[] = [
  { id: "p1", timestamp: "2026-02-22T06:01:00Z", action: "created", email: "alice.new@openclawapp.com", connectionId: "conn-okta", details: "JIT provisioned via Okta SAML. Role: member" },
  { id: "p2", timestamp: "2026-02-22T05:45:00Z", action: "updated", email: "bob@openclawapp.com", connectionId: "conn-okta", details: "Department updated: engineering → platform" },
  { id: "p3", timestamp: "2026-02-22T04:00:00Z", action: "failed", email: "invalid@openclawapp.com", connectionId: "conn-azure", details: "Email domain not in allowlist. Blocked." },
  { id: "p4", timestamp: "2026-02-21T20:00:00Z", action: "deactivated", email: "alice.left@openclawapp.com", connectionId: "conn-okta", details: "User deprovisioned via SCIM. Account suspended." },
  { id: "p5", timestamp: "2026-02-21T18:00:00Z", action: "created", email: "carol@contractor.openclawapp.com", connectionId: "conn-azure", details: "Auto-provisioned via Azure AD sync. Role: viewer" },
  { id: "p6", timestamp: "2026-02-21T14:00:00Z", action: "updated", email: "dave@openclawapp.com", connectionId: "conn-okta", details: "Groups changed: [dev] → [dev, leads]. Role promoted: member → developer" },
  { id: "p7", timestamp: "2026-02-21T10:00:00Z", action: "failed", email: "test@example.com", connectionId: "conn-onelogin", details: "Attribute mapping error: email attribute missing from SAML assertion" },
  { id: "p8", timestamp: "2026-02-20T16:00:00Z", action: "created", email: "eve@partner.openclawapp.com", connectionId: "conn-google", details: "JIT provisioned via Google OIDC. Role: viewer" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function protocolColor(p: SSOProtocol): string {
  const map: Record<SSOProtocol, string> = {
    saml:   "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    oidc:   "bg-blue-500/20 text-blue-400 border-blue-500/30",
    oauth2: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    ldap:   "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  return map[p];
}

function statusColor(s: ConnectionStatus): string {
  const map: Record<ConnectionStatus, string> = {
    active:   "bg-emerald-400",
    inactive: "bg-zinc-600",
    testing:  "bg-amber-400",
    error:    "bg-rose-500",
  };
  return map[s];
}

function statusText(s: ConnectionStatus): string {
  const map: Record<ConnectionStatus, string> = {
    active:   "text-emerald-400",
    inactive: "text-zinc-500",
    testing:  "text-amber-400",
    error:    "text-rose-400",
  };
  return map[s];
}

function logActionColor(a: ProvisioningLog["action"]): string {
  const map: Record<ProvisioningLog["action"], string> = {
    created:     "text-emerald-400",
    updated:     "text-indigo-400",
    deactivated: "text-amber-400",
    failed:      "text-rose-400",
  };
  return map[a];
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function ConnectionsTab() {
  const [selected, setSelected] = useState<SSOConnection | null>(null);

  return (
    <div className="space-y-3">
      {connections.map((conn) => (
        <div
          key={conn.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            selected?.id === conn.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
          )}
          onClick={() => setSelected(selected?.id === conn.id ? null : conn)}
        >
          <div className="flex items-center gap-3">
            <span className={cn("w-2.5 h-2.5 rounded-full shrink-0", statusColor(conn.status))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-white">{conn.name}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded border uppercase", protocolColor(conn.protocol))}>
                  {conn.protocol}
                </span>
                <span className={cn("text-xs capitalize", statusText(conn.status))}>{conn.status}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">{conn.provider} · {conn.domains.join(", ")}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-white font-semibold">{conn.userCount.toLocaleString()}</div>
              <div className="text-zinc-500">users</div>
            </div>
          </div>

          {selected?.id === conn.id && (
            <div className="mt-4 border-t border-zinc-800 pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Entity / Issuer ID</span>
                    <span className="font-mono text-zinc-300 text-right max-w-48 truncate">{conn.entityId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Login URL</span>
                    <span className="font-mono text-indigo-300 text-right max-w-48 truncate">{conn.loginUrl}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Default Role</span>
                    <span className="text-zinc-300">{conn.defaultRole}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Created</span>
                    <span className="text-zinc-300">{conn.createdAt}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Auto-provision</span>
                    <span className={conn.autoProvision ? "text-emerald-400" : "text-zinc-500"}>{conn.autoProvision ? "enabled" : "disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">JIT provisioning</span>
                    <span className={conn.jitProvisioning ? "text-emerald-400" : "text-zinc-500"}>{conn.jitProvisioning ? "enabled" : "disabled"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Last used</span>
                    <span className="text-zinc-300">{conn.lastUsed.slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Allowed domains</span>
                    <span className="text-zinc-300">{conn.domains.length}</span>
                  </div>
                </div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Allowed domains</div>
                <div className="flex flex-wrap gap-1">
                  {conn.domains.map((d) => (
                    <span key={d} className="text-xs font-mono bg-zinc-800 text-zinc-300 rounded px-2 py-0.5">{d}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function MappingsTab() {
  const [activeConn, setActiveConn] = useState<string>("conn-okta");
  const filtered = attributeMappings.filter((m) => m.connectionId === activeConn);
  const connName = connections.find((c) => c.id === activeConn)?.name ?? activeConn;

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        {connections.filter((c) => c.status !== "inactive").map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveConn(c.id)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
              activeConn === c.id ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {c.name}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <h3 className="text-sm font-semibold text-white mb-3">{connName} — Attribute Mappings</h3>
        {filtered.length === 0 ? (
          <div className="text-sm text-zinc-500 text-center py-8">No mappings configured for this connection</div>
        ) : (
          <div className="rounded-lg border border-zinc-800 overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-950">
                  <th className="text-left px-3 py-2 text-zinc-400">IdP Attribute</th>
                  <th className="text-left px-3 py-2 text-zinc-400">App Field</th>
                  <th className="text-left px-3 py-2 text-zinc-400">Transform</th>
                  <th className="text-left px-3 py-2 text-zinc-400">Required</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filtered.map((m) => (
                  <tr key={m.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                    <td className="px-3 py-2 font-mono text-indigo-300">{m.samlAttribute}</td>
                    <td className="px-3 py-2 font-mono text-emerald-300">{m.appField}</td>
                    <td className="px-3 py-2 text-zinc-400">{m.transform ?? "—"}</td>
                    <td className="px-3 py-2">
                      {m.required ? <span className="text-rose-400">yes</span> : <span className="text-zinc-500">no</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SessionsTab() {
  const [showActive, setShowActive] = useState(true);

  const visible = sessions.filter((s) => !showActive || s.active);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <button
            onClick={() => setShowActive(false)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors", !showActive ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white")}
          >
            All
          </button>
          <button
            onClick={() => setShowActive(true)}
            className={cn("px-3 py-1 rounded-full text-xs font-medium transition-colors", showActive ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white")}
          >
            Active Only
          </button>
        </div>
        <span className="text-xs text-zinc-500 ml-auto">{visible.length} sessions shown</span>
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left px-3 py-2 text-zinc-400">User</th>
              <th className="text-left px-3 py-2 text-zinc-400">Connection</th>
              <th className="text-left px-3 py-2 text-zinc-400">Login at</th>
              <th className="text-left px-3 py-2 text-zinc-400">Expires</th>
              <th className="text-left px-3 py-2 text-zinc-400">IP</th>
              <th className="text-left px-3 py-2 text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {visible.map((s) => {
              const conn = connections.find((c) => c.id === s.connectionId);
              return (
                <tr key={s.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                  <td className="px-3 py-2 text-zinc-300">{s.email}</td>
                  <td className="px-3 py-2 text-zinc-400">{conn?.name ?? s.connectionId}</td>
                  <td className="px-3 py-2 text-zinc-400">{s.loginAt.slice(11, 16)} UTC</td>
                  <td className="px-3 py-2 text-zinc-500">{s.expiresAt.slice(11, 16)} UTC</td>
                  <td className="px-3 py-2 font-mono text-zinc-500">{s.ipAddress}</td>
                  <td className="px-3 py-2">
                    <span className={cn("font-medium", s.active ? "text-emerald-400" : "text-zinc-600")}>
                      {s.active ? "active" : "expired"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogsTab() {
  return (
    <div className="space-y-2">
      {provisioningLogs.map((log) => (
        <div key={log.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <span className={cn("font-semibold text-xs capitalize w-20 shrink-0", logActionColor(log.action))}>
              {log.action}
            </span>
            <span className="text-sm text-white">{log.email}</span>
            <span className="text-xs text-zinc-500 ml-auto">{log.timestamp.slice(0, 16).replace("T", " ")}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-xs text-zinc-500">{connections.find((c) => c.id === log.connectionId)?.name ?? log.connectionId}</span>
            <span className="text-zinc-700">·</span>
            <span className="text-xs text-zinc-400">{log.details}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Connections", "Mappings", "Sessions", "Logs"] as const;
type Tab = typeof TABS[number];

export default function SSOConfigManager() {
  const [tab, setTab] = useState<Tab>("Connections");

  const active = connections.filter((c) => c.status === "active").length;
  const totalUsers = connections.reduce((a, c) => a + c.userCount, 0);
  const activeSessions = sessions.filter((s) => s.active).length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">SSO Configuration Manager</h1>
        <p className="text-zinc-400 text-sm">
          SAML, OIDC & OAuth2 identity provider connections — {connections.length} providers, {totalUsers.toLocaleString()} users
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Active Connections", value: active, color: "text-emerald-400" },
          { label: "Total SSO Users", value: totalUsers.toLocaleString(), color: "text-white" },
          { label: "Active Sessions", value: activeSessions, color: "text-indigo-400" },
          { label: "Domains Protected", value: [...new Set(connections.flatMap((c) => c.domains))].length, color: "text-white" },
        ].map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className={cn("text-3xl font-bold", kpi.color)}>{kpi.value}</div>
            <div className="text-sm text-zinc-400 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Connections" && <ConnectionsTab />}
      {tab === "Mappings" && <MappingsTab />}
      {tab === "Sessions" && <SessionsTab />}
      {tab === "Logs" && <LogsTab />}
    </div>
  );
}

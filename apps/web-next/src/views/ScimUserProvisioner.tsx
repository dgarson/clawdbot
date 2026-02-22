import React, { useState } from "react";
import { cn } from "../lib/utils";

type ProvisionStatus = "active" | "deprovisioned" | "pending" | "failed";
type SyncStatus = "synced" | "out_of_sync" | "not_mapped" | "error";
type IdPType = "okta" | "azure_ad" | "google_workspace" | "onelogin" | "ping";

interface ScimUser {
  id: string;
  externalId: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  department: string;
  title: string;
  status: ProvisionStatus;
  syncStatus: SyncStatus;
  lastSync: string;
  groups: string[];
  idp: IdPType;
}

interface ScimGroup {
  id: string;
  externalId: string;
  displayName: string;
  memberCount: number;
  mappedRole: string | null;
  syncStatus: SyncStatus;
  lastSync: string;
  idp: IdPType;
}

interface AttributeMapping {
  scimAttribute: string;
  idpAttribute: string;
  transform: string | null;
  required: boolean;
}

interface SyncLog {
  id: string;
  timestamp: string;
  operation: "create" | "update" | "deactivate" | "group_sync" | "full_sync";
  entity: string;
  entityType: "user" | "group";
  status: "success" | "failed" | "skipped";
  details: string;
}

const SCIM_USERS: ScimUser[] = [
  {
    id: "u1", externalId: "00u1a2b3c4d5e6f7", username: "alice.chen", email: "alice.chen@acme.corp",
    firstName: "Alice", lastName: "Chen", department: "Engineering", title: "Senior Engineer",
    status: "active", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z",
    groups: ["engineering", "all-staff"], idp: "okta",
  },
  {
    id: "u2", externalId: "00u2b3c4d5e6f7g8", username: "bob.martinez", email: "bob.martinez@acme.corp",
    firstName: "Bob", lastName: "Martinez", department: "Product", title: "Product Manager",
    status: "active", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z",
    groups: ["product", "all-staff"], idp: "okta",
  },
  {
    id: "u3", externalId: "00u3c4d5e6f7g8h9", username: "carol.jones", email: "carol.jones@acme.corp",
    firstName: "Carol", lastName: "Jones", department: "Sales", title: "Account Executive",
    status: "active", syncStatus: "out_of_sync", lastSync: "2026-02-21T10:00:00Z",
    groups: ["sales", "all-staff"], idp: "okta",
  },
  {
    id: "u4", externalId: "aad4d5e6f7g8h9i0", username: "david.kim", email: "david.kim@acme.corp",
    firstName: "David", lastName: "Kim", department: "DevOps", title: "Platform Engineer",
    status: "active", syncStatus: "synced", lastSync: "2026-02-22T14:28:00Z",
    groups: ["engineering", "devops", "all-staff"], idp: "azure_ad",
  },
  {
    id: "u5", externalId: "00u5e6f7g8h9i0j1", username: "eve.thompson", email: "eve.thompson@acme.corp",
    firstName: "Eve", lastName: "Thompson", department: "Legal", title: "General Counsel",
    status: "active", syncStatus: "synced", lastSync: "2026-02-22T14:29:00Z",
    groups: ["legal", "all-staff", "leadership"], idp: "okta",
  },
  {
    id: "u6", externalId: "00u6f7g8h9i0j1k2", username: "frank.wu", email: "frank.wu@acme.corp",
    firstName: "Frank", lastName: "Wu", department: "Engineering", title: "Staff Engineer",
    status: "deprovisioned", syncStatus: "synced", lastSync: "2026-02-15T09:00:00Z",
    groups: [], idp: "okta",
  },
  {
    id: "u7", externalId: "google7g8h9i0j1k2", username: "grace.patel", email: "grace.patel@acme.corp",
    firstName: "Grace", lastName: "Patel", department: "Design", title: "Design Lead",
    status: "pending", syncStatus: "not_mapped", lastSync: "",
    groups: ["design", "all-staff"], idp: "google_workspace",
  },
  {
    id: "u8", externalId: "00u8h9i0j1k2l3m4", username: "henry.lee", email: "henry.lee@acme.corp",
    firstName: "Henry", lastName: "Lee", department: "Finance", title: "CFO",
    status: "active", syncStatus: "error", lastSync: "2026-02-22T13:00:00Z",
    groups: ["finance", "all-staff", "leadership"], idp: "okta",
  },
];

const SCIM_GROUPS: ScimGroup[] = [
  { id: "g1", externalId: "grp_eng_00a1", displayName: "engineering", memberCount: 42, mappedRole: "developer", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z", idp: "okta" },
  { id: "g2", externalId: "grp_prd_00b2", displayName: "product", memberCount: 8, mappedRole: "product", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z", idp: "okta" },
  { id: "g3", externalId: "grp_ops_00c3", displayName: "devops", memberCount: 12, mappedRole: "admin", syncStatus: "out_of_sync", lastSync: "2026-02-21T18:00:00Z", idp: "okta" },
  { id: "g4", externalId: "grp_lds_00d4", displayName: "leadership", memberCount: 5, mappedRole: "admin", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z", idp: "okta" },
  { id: "g5", externalId: "grp_all_00e5", displayName: "all-staff", memberCount: 234, mappedRole: "viewer", syncStatus: "synced", lastSync: "2026-02-22T14:30:00Z", idp: "okta" },
  { id: "g6", externalId: "gsuite_design_6f", displayName: "design", memberCount: 7, mappedRole: null, syncStatus: "not_mapped", lastSync: "", idp: "google_workspace" },
];

const ATTRIBUTE_MAPPINGS: AttributeMapping[] = [
  { scimAttribute: "userName", idpAttribute: "login", transform: null, required: true },
  { scimAttribute: "name.givenName", idpAttribute: "firstName", transform: null, required: true },
  { scimAttribute: "name.familyName", idpAttribute: "lastName", transform: null, required: true },
  { scimAttribute: "emails[primary].value", idpAttribute: "email", transform: null, required: true },
  { scimAttribute: "title", idpAttribute: "title", transform: null, required: false },
  { scimAttribute: "department", idpAttribute: "department", transform: null, required: false },
  { scimAttribute: "active", idpAttribute: "status", transform: "status === 'ACTIVE'", required: true },
  { scimAttribute: "externalId", idpAttribute: "id", transform: null, required: true },
];

const SYNC_LOGS: SyncLog[] = [
  { id: "l1", timestamp: "2026-02-22T14:30:00Z", operation: "full_sync", entity: "All users/groups", entityType: "user", status: "success", details: "234 users processed, 6 groups synced. 2 users updated, 0 created." },
  { id: "l2", timestamp: "2026-02-22T13:00:00Z", operation: "update", entity: "henry.lee", entityType: "user", status: "failed", details: "Attribute mapping failed: 'title' exceeds max length (128 chars). Value: 'Chief Financial Officer and Head of Accounting Operations'" },
  { id: "l3", timestamp: "2026-02-22T10:00:00Z", operation: "deactivate", entity: "frank.wu", entityType: "user", status: "success", details: "User deprovisioned. Account suspended, sessions revoked." },
  { id: "l4", timestamp: "2026-02-21T18:00:00Z", operation: "group_sync", entity: "devops", entityType: "group", status: "skipped", details: "No membership changes detected since last sync." },
  { id: "l5", timestamp: "2026-02-21T10:00:00Z", operation: "create", entity: "grace.patel", entityType: "user", status: "failed", details: "User mapping incomplete. Department 'Design' has no role mapping configured." },
];

const TABS = ["Users", "Groups", "Mappings", "Sync Log"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<ProvisionStatus, string> = {
  active:        "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  deprovisioned: "text-zinc-400 bg-zinc-400/10 border-zinc-400/30",
  pending:       "text-amber-400 bg-amber-400/10 border-amber-400/30",
  failed:        "text-rose-400 bg-rose-400/10 border-rose-400/30",
};

const syncStatusColor: Record<SyncStatus, string> = {
  synced:      "text-emerald-400",
  out_of_sync: "text-amber-400",
  not_mapped:  "text-zinc-400",
  error:       "text-rose-400",
};

const idpLabel: Record<IdPType, string> = {
  okta:              "Okta",
  azure_ad:          "Azure AD",
  google_workspace:  "Google WS",
  onelogin:          "OneLogin",
  ping:              "PingFed",
};

export default function ScimUserProvisioner(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Users");
  const [selectedUser, setSelectedUser] = useState<ScimUser>(SCIM_USERS[0]);
  const [userSearch, setUserSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<ProvisionStatus | "all">("all");

  const filteredUsers = SCIM_USERS.filter((u) => {
    if (statusFilter !== "all" && u.status !== statusFilter) {return false;}
    if (userSearch && !u.email.includes(userSearch) && !u.username.includes(userSearch)) {return false;}
    return true;
  });

  const syncedCount = SCIM_USERS.filter(u => u.syncStatus === "synced").length;
  const outOfSyncCount = SCIM_USERS.filter(u => u.syncStatus === "out_of_sync" || u.syncStatus === "error").length;
  const unmappedCount = SCIM_USERS.filter(u => u.syncStatus === "not_mapped").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
        <div>
          <h1 className="text-lg font-semibold">SCIM User Provisioner</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Automated user/group provisioning via SCIM 2.0 from identity providers</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-3 text-xs">
            <span className="text-emerald-400">{syncedCount} synced</span>
            <span className="text-amber-400">{outOfSyncCount} out-of-sync</span>
            <span className="text-zinc-400">{unmappedCount} unmapped</span>
          </div>
          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded-md transition-colors">
            Sync Now
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-zinc-800 shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-400 border-transparent hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── USERS ── */}
        {tab === "Users" && (
          <div className="h-full flex">
            {/* List */}
            <div className="w-72 border-r border-zinc-800 flex flex-col">
              <div className="p-3 space-y-2 border-b border-zinc-800">
                <input
                  type="text"
                  placeholder="Search users..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-2.5 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap gap-1">
                  {(["all", "active", "deprovisioned", "pending", "failed"] as const).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={cn(
                        "px-1.5 py-0.5 text-[10px] rounded border transition-colors",
                        statusFilter === s ? "bg-indigo-600/20 border-indigo-500 text-indigo-300" : "border-zinc-700 text-zinc-500 hover:border-zinc-600"
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/50">
                {filteredUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className={cn(
                      "w-full text-left px-4 py-3 transition-colors",
                      selectedUser.id === u.id ? "bg-indigo-600/10" : "hover:bg-zinc-800/40"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">{u.firstName} {u.lastName}</span>
                      <span className={cn("text-[10px] px-1 py-0.5 rounded border shrink-0", statusColor[u.status])}>{u.status}</span>
                    </div>
                    <div className="text-[10px] text-zinc-500 truncate">{u.email}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-zinc-500">{idpLabel[u.idp]}</span>
                      <span className={cn("text-[10px]", syncStatusColor[u.syncStatus])}>● {u.syncStatus.replace("_", " ")}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold">{selectedUser.firstName} {selectedUser.lastName}</h2>
                  <div className="text-sm text-zinc-400">{selectedUser.title} · {selectedUser.department}</div>
                  <div className="text-xs text-zinc-500 mt-0.5 font-mono">{selectedUser.email}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedUser.status])}>{selectedUser.status}</span>
                  <button className="px-3 py-1.5 text-xs border border-zinc-700 text-zinc-400 hover:border-zinc-600 rounded-md transition-colors">
                    {selectedUser.status === "active" ? "Deprovision" : "Provision"}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: "Identity Provider", value: idpLabel[selectedUser.idp] },
                  { label: "External ID", value: selectedUser.externalId.slice(0, 18) + "…" },
                  { label: "Username", value: selectedUser.username },
                  { label: "Sync Status", value: selectedUser.syncStatus.replace("_", " "), color: syncStatusColor[selectedUser.syncStatus] },
                  { label: "Last Sync", value: selectedUser.lastSync ? selectedUser.lastSync.slice(0, 16).replace("T", " ") : "Never" },
                ].map((m) => (
                  <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                    <div className="text-xs text-zinc-500">{m.label}</div>
                    <div className={cn("text-sm font-medium mt-1", m.color ?? "text-white")}>{m.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400 font-semibold uppercase tracking-wider mb-3">Group Memberships</div>
                <div className="flex flex-wrap gap-2">
                  {selectedUser.groups.length > 0
                    ? selectedUser.groups.map(g => (
                        <span key={g} className="text-xs px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300">{g}</span>
                      ))
                    : <span className="text-xs text-zinc-500">No group memberships</span>
                  }
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── GROUPS ── */}
        {tab === "Groups" && (
          <div className="h-full overflow-y-auto p-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800 flex items-center justify-between">
                <h3 className="text-sm font-medium">Synced Groups</h3>
                <span className="text-xs text-zinc-500">{SCIM_GROUPS.length} groups</span>
              </div>
              <div className="divide-y divide-zinc-800">
                {SCIM_GROUPS.map((g) => (
                  <div key={g.id} className="px-5 py-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{g.displayName}</span>
                        <span className="text-[10px] text-zinc-500">{idpLabel[g.idp]}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-0.5">{g.externalId}</div>
                    </div>
                    <div className="text-xs text-zinc-400">{g.memberCount} members</div>
                    <div className="w-28 text-center">
                      {g.mappedRole
                        ? <span className="text-xs px-2 py-0.5 rounded bg-indigo-600/10 border border-indigo-600/30 text-indigo-300">{g.mappedRole}</span>
                        : <span className="text-xs text-zinc-500">no role mapped</span>
                      }
                    </div>
                    <span className={cn("text-xs w-20 text-right", syncStatusColor[g.syncStatus])}>
                      {g.syncStatus.replace("_", " ")}
                    </span>
                    <button className="text-[10px] text-indigo-400 hover:text-indigo-300">Map Role</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── MAPPINGS ── */}
        {tab === "Mappings" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            <div className="bg-amber-400/10 border border-amber-400/30 rounded-lg p-4 text-xs text-amber-300">
              Attribute mappings define how IdP user attributes map to SCIM user schema fields during provisioning.
            </div>
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-zinc-800">
                <h3 className="text-sm font-medium">SCIM ↔ IdP Attribute Mappings</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800">
                      {["SCIM Attribute", "IdP Attribute", "Transform", "Required"].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left text-xs text-zinc-500 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {ATTRIBUTE_MAPPINGS.map((m, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30">
                        <td className="px-4 py-3 text-xs font-mono text-indigo-300">{m.scimAttribute}</td>
                        <td className="px-4 py-3 text-xs font-mono text-zinc-300">{m.idpAttribute}</td>
                        <td className="px-4 py-3 text-xs font-mono text-amber-300">{m.transform ?? "—"}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs", m.required ? "text-rose-400" : "text-zinc-500")}>{m.required ? "required" : "optional"}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── SYNC LOG ── */}
        {tab === "Sync Log" && (
          <div className="h-full overflow-y-auto p-6 space-y-3">
            {SYNC_LOGS.map((log) => (
              <div key={log.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className={cn("w-2 h-2 rounded-full shrink-0", log.status === "success" ? "bg-emerald-400" : log.status === "failed" ? "bg-rose-400" : "bg-zinc-500")} />
                  <span className={cn("text-xs font-mono font-bold",
                    log.operation === "create" ? "text-emerald-400" :
                    log.operation === "deactivate" ? "text-rose-400" :
                    log.operation === "full_sync" ? "text-indigo-400" : "text-amber-400"
                  )}>{log.operation.replace("_", " ")}</span>
                  <span className="text-xs text-zinc-300">{log.entity}</span>
                  <span className={cn("text-xs ml-auto", log.status === "success" ? "text-emerald-400" : log.status === "failed" ? "text-rose-400" : "text-zinc-500")}>
                    {log.status}
                  </span>
                  <span className="text-xs text-zinc-500 shrink-0">{log.timestamp.slice(0, 16).replace("T", " ")}</span>
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">{log.details}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

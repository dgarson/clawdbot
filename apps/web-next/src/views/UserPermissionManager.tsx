import React, { useState } from "react";
import { cn } from "../lib/utils";

type UserRole = "owner" | "admin" | "developer" | "viewer" | "billing";
type ResourceScope = "organization" | "workspace" | "project" | "resource";
type PermAction = "read" | "write" | "delete" | "admin" | "execute";
type UserStatus = "active" | "invited" | "suspended";

interface Permission {
  action: PermAction;
  resource: string;
  scope: ResourceScope;
  granted: boolean;
}

interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  teams: string[];
  lastActive: string;
  joinedAt: string;
  avatarColor: string;
  permissions: Permission[];
}

interface Team {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  role: UserRole;
  createdAt: string;
  tags: string[];
}

interface RoleDefinition {
  role: UserRole;
  description: string;
  permissionCount: number;
  memberCount: number;
  color: string;
}

const roleColor: Record<UserRole, string> = {
  owner:     "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  admin:     "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  developer: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  viewer:    "bg-[var(--color-surface-3)]/20 text-[var(--color-text-primary)] border border-[var(--color-surface-3)]/30",
  billing:   "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
};

const statusDot: Record<UserStatus, string> = {
  active:    "bg-emerald-400",
  invited:   "bg-amber-400",
  suspended: "bg-rose-400",
};

const statusBadge: Record<UserStatus, string> = {
  active:    "text-emerald-400",
  invited:   "text-amber-400",
  suspended: "text-rose-400",
};

const actionIcon: Record<PermAction, string> = {
  read:    "👁️",
  write:   "✏️",
  delete:  "🗑️",
  admin:   "🔑",
  execute: "⚡",
};

const scopeIcon: Record<ResourceScope, string> = {
  organization: "🏢",
  workspace:    "📁",
  project:      "📋",
  resource:     "🔧",
};

const MEMBERS: TeamMember[] = [
  {
    id: "u-01", name: "Tim Harper", email: "tim@clawdbot.io", role: "owner", status: "active",
    teams: ["Platform Core", "Engineering Leadership"], lastActive: "2m ago", joinedAt: "2024-01-15", avatarColor: "bg-indigo-600",
    permissions: [
      { action: "admin", resource: "Organization", scope: "organization", granted: true },
      { action: "read", resource: "Billing", scope: "organization", granted: true },
      { action: "write", resource: "All Workspaces", scope: "workspace", granted: true },
    ],
  },
  {
    id: "u-02", name: "Xavier Chen", email: "xavier@clawdbot.io", role: "admin", status: "active",
    teams: ["Engineering Leadership", "Product"], lastActive: "5m ago", joinedAt: "2024-02-01", avatarColor: "bg-purple-600",
    permissions: [
      { action: "admin", resource: "Workspaces", scope: "workspace", granted: true },
      { action: "write", resource: "Team Members", scope: "organization", granted: true },
      { action: "read", resource: "Billing", scope: "organization", granted: true },
    ],
  },
  {
    id: "u-03", name: "Sam Rivera", email: "sam@clawdbot.io", role: "developer", status: "active",
    teams: ["Product & UI", "API Squad"], lastActive: "1h ago", joinedAt: "2024-03-15", avatarColor: "bg-teal-600",
    permissions: [
      { action: "write", resource: "API Keys", scope: "workspace", granted: true },
      { action: "read", resource: "Logs", scope: "project", granted: true },
      { action: "execute", resource: "Webhooks", scope: "resource", granted: true },
    ],
  },
  {
    id: "u-04", name: "Quinn Patel", email: "quinn@clawdbot.io", role: "developer", status: "active",
    teams: ["Product & UI"], lastActive: "3h ago", joinedAt: "2024-04-01", avatarColor: "bg-emerald-600",
    permissions: [
      { action: "write", resource: "Projects", scope: "workspace", granted: true },
      { action: "read", resource: "Analytics", scope: "workspace", granted: true },
    ],
  },
  {
    id: "u-05", name: "Piper Walsh", email: "piper@clawdbot.io", role: "developer", status: "active",
    teams: ["Product & UI", "Design System"], lastActive: "30m ago", joinedAt: "2024-04-15", avatarColor: "bg-pink-600",
    permissions: [
      { action: "write", resource: "Design Tokens", scope: "workspace", granted: true },
      { action: "read", resource: "Feature Flags", scope: "project", granted: true },
    ],
  },
  {
    id: "u-06", name: "Alice Fontaine", email: "alice@acmecorp.com", role: "viewer", status: "invited",
    teams: [], lastActive: "Never", joinedAt: "2026-02-20", avatarColor: "bg-amber-600",
    permissions: [
      { action: "read", resource: "Dashboard", scope: "workspace", granted: true },
      { action: "read", resource: "Reports", scope: "project", granted: true },
    ],
  },
  {
    id: "u-07", name: "Bob Tran", email: "bob@clawdbot.io", role: "billing", status: "active",
    teams: ["Finance"], lastActive: "1d ago", joinedAt: "2024-06-01", avatarColor: "bg-cyan-600",
    permissions: [
      { action: "admin", resource: "Billing", scope: "organization", granted: true },
      { action: "read", resource: "Usage Reports", scope: "organization", granted: true },
    ],
  },
  {
    id: "u-08", name: "Carol James", email: "carol@clawdbot.io", role: "developer", status: "suspended",
    teams: ["Platform Core"], lastActive: "5d ago", joinedAt: "2024-05-01", avatarColor: "bg-rose-600",
    permissions: [],
  },
];

const TEAMS: Team[] = [
  { id: "t-01", name: "Engineering Leadership", description: "Senior engineering leads and architects", memberCount: 3, role: "admin", createdAt: "2024-01-15", tags: ["engineering", "leadership"] },
  { id: "t-02", name: "Platform Core", description: "Infrastructure and platform services team", memberCount: 5, role: "developer", createdAt: "2024-02-01", tags: ["platform", "infra"] },
  { id: "t-03", name: "Product & UI", description: "Frontend and product experience squad", memberCount: 6, role: "developer", createdAt: "2024-03-01", tags: ["frontend", "product"] },
  { id: "t-04", name: "API Squad", description: "API design and implementation team", memberCount: 4, role: "developer", createdAt: "2024-03-15", tags: ["api", "backend"] },
  { id: "t-05", name: "Finance", description: "Billing and financial management", memberCount: 2, role: "billing", createdAt: "2024-04-01", tags: ["finance", "billing"] },
  { id: "t-06", name: "Design System", description: "Design system and component library", memberCount: 3, role: "developer", createdAt: "2024-05-01", tags: ["design", "ui"] },
];

const ROLES: RoleDefinition[] = [
  { role: "owner", description: "Full access to organization. Manage billing, members, and all settings.", permissionCount: 48, memberCount: 1, color: "text-rose-400" },
  { role: "admin", description: "Manage members, workspaces, and org settings. Cannot access billing.", permissionCount: 36, memberCount: 2, color: "text-orange-400" },
  { role: "developer", description: "Create and manage projects, APIs, and resources within workspaces.", permissionCount: 22, memberCount: 4, color: "text-indigo-400" },
  { role: "billing", description: "View and manage billing and subscription. Read-only for other resources.", permissionCount: 8, memberCount: 1, color: "text-emerald-400" },
  { role: "viewer", description: "Read-only access to specified workspaces and projects.", permissionCount: 5, memberCount: 1, color: "text-[var(--color-text-secondary)]" },
];

export default function UserPermissionManager() {
  const [tab, setTab] = useState<"members" | "teams" | "roles" | "audit">("members");
  const [selectedMember, setSelectedMember] = useState<TeamMember>(MEMBERS[0]);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<UserStatus | "all">("all");

  const filtered = MEMBERS.filter(m =>
    (roleFilter === "all" || m.role === roleFilter) &&
    (statusFilter === "all" || m.status === statusFilter)
  );

  const memberInitials = (name: string) => name.split(" ").map(n => n[0]).join("").slice(0, 2);

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">User & Permission Manager</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Members · Teams · Roles · Audit</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-[var(--color-text-secondary)]">{MEMBERS.filter(m => m.status === "active").length} active</span>
          <span className="text-amber-400">{MEMBERS.filter(m => m.status === "invited").length} pending</span>
          <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
            + Invite Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {(["members", "teams", "roles", "audit"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Members Tab */}
      {tab === "members" && (
        <div className="flex flex-1 overflow-hidden">
          {/* List */}
          <div className="w-80 border-r border-[var(--color-border)] flex flex-col">
            <div className="p-3 border-b border-[var(--color-border)] space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setRoleFilter("all")} className={cn("text-xs px-2 py-0.5 rounded border transition-colors", roleFilter === "all" ? "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]")}>All</button>
                {(["owner", "admin", "developer", "viewer", "billing"] as UserRole[]).map(r => (
                  <button key={r} onClick={() => setRoleFilter(r)} className={cn("text-xs px-2 py-0.5 rounded border transition-colors capitalize", roleFilter === r ? roleColor[r] : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]")}>{r}</button>
                ))}
              </div>
              <div className="flex gap-1.5">
                {(["all", "active", "invited", "suspended"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)} className={cn("text-xs px-2 py-0.5 rounded border transition-colors capitalize", statusFilter === s ? "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]")}>{s}</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filtered.map(m => (
                <button
                  key={m.id}
                  onClick={() => setSelectedMember(m)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                    selectedMember.id === m.id && "bg-[var(--color-surface-2)]/60"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[var(--color-text-primary)] flex-shrink-0", m.avatarColor)}>
                      {memberInitials(m.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{m.name}</span>
                        <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot[m.status])} />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full capitalize", roleColor[m.role])}>{m.role}</span>
                        <span className="text-xs text-[var(--color-text-muted)]">{m.lastActive}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-4">
                <div className={cn("w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-[var(--color-text-primary)]", selectedMember.avatarColor)}>
                  {memberInitials(selectedMember.name)}
                </div>
                <div>
                  <h2 className="text-lg font-semibold mb-1">{selectedMember.name}</h2>
                  <div className="text-sm font-mono text-[var(--color-text-secondary)] mb-1">{selectedMember.email}</div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", roleColor[selectedMember.role])}>{selectedMember.role}</span>
                    <span className={cn("text-xs font-medium capitalize", statusBadge[selectedMember.status])}>{selectedMember.status}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded text-sm transition-colors">Edit Role</button>
                {selectedMember.status === "active" && <button className="px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-300 border border-amber-600/40 rounded text-sm transition-colors">Suspend</button>}
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[var(--color-text-primary)] mb-1">{selectedMember.teams.length}</div>
                <div className="text-xs text-[var(--color-text-muted)]">teams</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                <div className="text-lg font-bold text-[var(--color-text-primary)] mb-1">{selectedMember.permissions.length}</div>
                <div className="text-xs text-[var(--color-text-muted)]">permissions</div>
              </div>
              <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-1">{selectedMember.lastActive}</div>
                <div className="text-xs text-[var(--color-text-muted)]">last active</div>
              </div>
            </div>

            {/* Teams */}
            {selectedMember.teams.length > 0 && (
              <div className="mb-4">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Teams</div>
                <div className="flex flex-wrap gap-2">
                  {selectedMember.teams.map(t => (
                    <span key={t} className="text-xs px-2.5 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border border-[var(--color-border)]">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Permissions */}
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-2">Permissions</div>
              {selectedMember.permissions.length > 0 ? (
                <div className="space-y-1.5">
                  {selectedMember.permissions.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 bg-[var(--color-surface-1)] rounded p-3">
                      <span className="text-sm">{actionIcon[p.action]}</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)] capitalize">{p.action}</span>
                      <span className="text-xs text-[var(--color-text-secondary)]">{p.resource}</span>
                      <span className="ml-auto flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                        <span>{scopeIcon[p.scope]}</span>
                        <span className="capitalize">{p.scope}</span>
                      </span>
                      <span className={p.granted ? "text-emerald-400" : "text-rose-400"}>{p.granted ? "✓" : "✗"}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[var(--color-text-muted)] bg-[var(--color-surface-1)] rounded p-4 text-center">Account suspended — no active permissions</div>
              )}
            </div>

            <div className="mt-4 text-xs text-[var(--color-text-muted)]">Joined {selectedMember.joinedAt}</div>
          </div>
        </div>
      )}

      {/* Teams Tab */}
      {tab === "teams" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold">Teams ({TEAMS.length})</h2>
            <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">+ New Team</button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {TEAMS.map(team => (
              <div key={team.id} className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-0.5">{team.name}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{team.description}</div>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize flex-shrink-0", roleColor[team.role])}>{team.role}</span>
                </div>
                <div className="flex items-center gap-3 mt-3 text-xs text-[var(--color-text-muted)]">
                  <span className="text-[var(--color-text-primary)] font-medium">{team.memberCount}</span> members
                  <span>·</span>
                  <span>since {team.createdAt}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {team.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {tab === "roles" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Role Definitions</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Pre-defined roles with permission sets</p>
            </div>
          </div>
          <div className="space-y-3">
            {ROLES.map(r => (
              <div key={r.role} className="bg-[var(--color-surface-1)] rounded-xl p-5 flex items-center gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className={cn("text-sm font-semibold capitalize", r.color)}>{r.role}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", roleColor[r.role])}>{r.role}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)]">{r.description}</p>
                </div>
                <div className="flex items-center gap-6 text-center flex-shrink-0">
                  <div>
                    <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">{r.permissionCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">permissions</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">{r.memberCount}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">members</div>
                  </div>
                </div>
                <button className="text-xs px-3 py-1.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded border border-[var(--color-border)] transition-colors flex-shrink-0">
                  View Permissions
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Tab */}
      {tab === "audit" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Access Audit Log</h2>
          <div className="space-y-2">
            {[
              { actor: "Tim", action: "Promoted", target: "Quinn", change: "developer → admin", time: "09:15", env: "production" },
              { actor: "Xavier", action: "Invited", target: "alice@acmecorp.com", change: "viewer role", time: "Feb 20", env: "staging" },
              { actor: "Tim", action: "Suspended", target: "Carol", change: "developer → suspended", time: "Feb 17", env: "production" },
              { actor: "Xavier", action: "Updated", target: "Sam", change: "Added webhook:execute permission", time: "Feb 15", env: "production" },
              { actor: "Tim", action: "Created team", target: "Design System", change: "6 initial members", time: "Feb 10", env: "production" },
              { actor: "Bob", action: "Removed", target: "Expired API key", change: "billing admin revoked key", time: "Feb 5", env: "production" },
            ].map((log, i) => (
              <div key={i} className="bg-[var(--color-surface-1)] rounded-lg p-3 flex items-center gap-4">
                <div className="w-8 h-8 rounded-full bg-[var(--color-surface-3)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {log.actor[0]}
                </div>
                <div className="flex-1">
                  <div className="text-sm text-[var(--color-text-primary)]">
                    <span className="font-medium">{log.actor}</span>
                    <span className="text-[var(--color-text-secondary)] mx-1">{log.action}</span>
                    <span className="font-medium">{log.target}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">{log.change}</div>
                </div>
                <div className="text-right text-xs text-[var(--color-text-muted)]">
                  <div>{log.time}</div>
                  <div className={cn("capitalize", log.env === "production" ? "text-rose-400" : "text-amber-400")}>{log.env}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

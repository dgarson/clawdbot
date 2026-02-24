import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Shield } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

/**
 * AccessControlManager.tsx
 * 
 * A comprehensive RBAC management interface for the Horizon UI dashboard.
 * Features:
 * - Roles management with resource-grouped permission details
 * - Global permissions registry with role mapping
 * - User access overview and permission auditing
 * - Detailed audit log for access control changes
 */

// --- Types ---

type RoleName = "Admin" | "Member" | "Viewer" | "Developer" | "Support" | "Guest";
type ResourceGroup = "Users" | "Agents" | "Sessions" | "Billing" | "Settings";
type TabID = "roles" | "permissions" | "users" | "audit";

interface Permission {
  id: string;
  name: string;
  group: ResourceGroup;
  description: string;
}

interface Role {
  id: RoleName;
  name: RoleName;
  description: string;
  userCount: number;
  permissions: string[]; // Permission IDs
}

interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  lastActive: string;
  avatarEmoji: string;
}

interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  timestamp: string;
  oldValue: string;
  newValue: string;
}

// --- Sample Data ---

const PERMISSIONS: Permission[] = [
  { id: "users:read", name: "users:read", group: "Users", description: "Read user profiles and list users" },
  { id: "users:write", name: "users:write", group: "Users", description: "Create and update user accounts" },
  { id: "users:delete", name: "users:delete", group: "Users", description: "Deactivate or delete user accounts" },
  { id: "agents:read", name: "agents:read", group: "Agents", description: "View agent status and configuration" },
  { id: "agents:start", name: "agents:start", group: "Agents", description: "Start new agent sessions" },
  { id: "agents:stop", name: "agents:stop", group: "Agents", description: "Terminate running agent sessions" },
  { id: "agents:manage", name: "agents:manage", group: "Agents", description: "Full control over agent lifecycle and settings" },
  { id: "sessions:read", name: "sessions:read", group: "Sessions", description: "View active and past session logs" },
  { id: "sessions:join", name: "sessions:join", group: "Sessions", description: "Join and interact with active sessions" },
  { id: "sessions:delete", name: "sessions:delete", group: "Sessions", description: "Purge session history" },
  { id: "billing:read", name: "billing:read", group: "Billing", description: "View invoices and usage metrics" },
  { id: "billing:write", name: "billing:write", group: "Billing", description: "Update payment methods and plans" },
  { id: "settings:read", name: "settings:read", group: "Settings", description: "View system-wide configuration" },
  { id: "settings:write", name: "settings:write", group: "Settings", description: "Modify system-wide configuration" },
  { id: "settings:security", name: "settings:security", group: "Settings", description: "Manage security policies and MFA" },
  { id: "agents:deploy", name: "agents:deploy", group: "Agents", description: "Deploy new agent images to the cluster" },
  { id: "users:invite", name: "users:invite", group: "Users", description: "Invite new users to the organization" },
  { id: "sessions:export", name: "sessions:export", group: "Sessions", description: "Download session transcripts and data" },
  { id: "billing:refund", name: "billing:refund", group: "Billing", description: "Issue refunds for billing discrepancies" },
  { id: "settings:logs", name: "settings:logs", group: "Settings", description: "View system audit and error logs" },
];

const ROLES: Role[] = [
  {
    id: "Admin",
    name: "Admin",
    description: "Full system access. Can manage all resources, billing, and security settings.",
    userCount: 2,
    permissions: PERMISSIONS.map(p => p.id),
  },
  {
    id: "Developer",
    name: "Developer",
    description: "Technical access for managing agents and sessions. Restricted from billing and user management.",
    userCount: 4,
    permissions: [
      "agents:read", "agents:start", "agents:stop", "agents:manage", "agents:deploy",
      "sessions:read", "sessions:join", "settings:read", "settings:logs"
    ],
  },
  {
    id: "Member",
    name: "Member",
    description: "Standard organizational access. Can run agents and view common resources.",
    userCount: 12,
    permissions: ["agents:read", "agents:start", "sessions:read", "sessions:join", "settings:read"],
  },
  {
    id: "Support",
    name: "Support",
    description: "Access to user information and session logs for troubleshooting customer issues.",
    userCount: 3,
    permissions: ["users:read", "agents:read", "sessions:read", "sessions:join", "billing:read"],
  },
  {
    id: "Viewer",
    name: "Viewer",
    description: "Read-only access to dashboards and reports across the platform.",
    userCount: 8,
    permissions: ["users:read", "agents:read", "sessions:read", "billing:read", "settings:read"],
  },
  {
    id: "Guest",
    name: "Guest",
    description: "Minimal access, typically for temporary external observers.",
    userCount: 1,
    permissions: ["agents:read", "sessions:read"],
  },
];

const USERS: User[] = [
  { id: "u1", name: "Xavier Chen", email: "x.chen@horizon.ai", role: "Admin", lastActive: "2 mins ago", avatarEmoji: "🦊" },
  { id: "u2", name: "Sarah Miller", email: "s.miller@horizon.ai", role: "Developer", lastActive: "15 mins ago", avatarEmoji: "👩‍💻" },
  { id: "u3", name: "Marcus Thorne", email: "m.thorne@horizon.ai", role: "Member", lastActive: "1 hour ago", avatarEmoji: "🦁" },
  { id: "u4", name: "Elena Rodriguez", email: "e.rodriguez@horizon.ai", role: "Support", lastActive: "4 hours ago", avatarEmoji: "🦉" },
  { id: "u5", name: "David Garson", email: "david@horizon.ai", role: "Admin", lastActive: "Just now", avatarEmoji: "💎" },
  { id: "u6", name: "Quinn State", email: "q.state@horizon.ai", role: "Developer", lastActive: "10 mins ago", avatarEmoji: "⚛️" },
  { id: "u7", name: "Liam Wilson", email: "l.wilson@horizon.ai", role: "Viewer", lastActive: "2 days ago", avatarEmoji: "🐘" },
  { id: "u8", name: "Chloe Park", email: "c.park@horizon.ai", role: "Member", lastActive: "5 hours ago", avatarEmoji: "🐼" },
  { id: "u9", name: "Jordan Smith", email: "j.smith@horizon.ai", role: "Developer", lastActive: "3 mins ago", avatarEmoji: "🚀" },
  { id: "u10", name: "Taylor Reed", email: "t.reed@horizon.ai", role: "Guest", lastActive: "1 week ago", avatarEmoji: "🐢" },
];

const AUDIT_LOG: AuditEntry[] = [
  { id: "a1", actor: "David Garson", action: "Update Role", target: "Developer", timestamp: "2026-02-21 14:30", oldValue: "8 permissions", newValue: "9 permissions (added agents:deploy)" },
  { id: "a2", actor: "Xavier Chen", action: "Change User Role", target: "Taylor Reed", timestamp: "2026-02-21 11:15", oldValue: "Viewer", newValue: "Guest" },
  { id: "a3", actor: "David Garson", action: "Create Permission", target: "settings:logs", timestamp: "2026-02-20 16:45", oldValue: "None", newValue: "settings:logs (Settings group)" },
  { id: "a4", actor: "System", action: "Auto-Lock User", target: "Jordan Smith", timestamp: "2026-02-20 03:00", oldValue: "Active", newValue: "Locked (Failed MFA)" },
  { id: "a5", actor: "Xavier Chen", action: "Update Role", target: "Support", timestamp: "2026-02-19 09:20", oldValue: "4 permissions", newValue: "5 permissions (added billing:read)" },
  { id: "a6", actor: "David Garson", action: "Invite User", target: "Quinn State", timestamp: "2026-02-18 13:10", oldValue: "None", newValue: "Developer" },
  { id: "a7", actor: "Elena Rodriguez", action: "Update Profile", target: "Elena Rodriguez", timestamp: "2026-02-18 10:05", oldValue: "Avatar: 👤", newValue: "Avatar: 🦉" },
  { id: "a8", actor: "Xavier Chen", action: "Revoke Access", target: "Former Employee", timestamp: "2026-02-17 17:40", oldValue: "Member", newValue: "Deleted" },
  { id: "a9", actor: "David Garson", action: "Modify Permission", target: "agents:manage", timestamp: "2026-02-16 12:00", oldValue: "Manage agent lifecycle", newValue: "Full control over lifecycle and settings" },
  { id: "a10", actor: "Xavier Chen", action: "Change User Role", target: "Liam Wilson", timestamp: "2026-02-15 14:22", oldValue: "Member", newValue: "Viewer" },
  { id: "a11", actor: "David Garson", action: "Update Role", target: "Admin", timestamp: "2026-02-14 08:55", oldValue: "19 permissions", newValue: "20 permissions" },
  { id: "a12", actor: "Elena Rodriguez", action: "Export Data", target: "Billing History", timestamp: "2026-02-13 16:10", oldValue: "None", newValue: "CSV Export" },
];

// --- Components ---

/**
 * RoleBadge Component
 * Maps roles to specific design system colors
 */
const RoleBadge = ({ role, className }: { role: RoleName; className?: string }) => {
  const colors: Record<RoleName, string> = {
    Admin: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    Member: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    Developer: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    Viewer: "bg-surface-3/10 text-fg-secondary border-tok-border/20",
    Support: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    Guest: "bg-surface-3/10 text-fg-muted border-tok-border/20",
  };

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border", colors[role], className)}>
      {role}
    </span>
  );
};

function AccessControlManagerSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-0 text-fg-primary font-sans">
      {/* Header */}
      <header className="px-3 sm:px-4 md:px-8 py-4 md:py-6 border-b border-tok-border bg-surface-0/50 sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <Skeleton className="h-8 w-40 mb-2" />
            <Skeleton variant="text" className="w-72 h-3" />
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
        <nav className="flex gap-8">
          {[56, 88, 48, 44].map((w, i) => (
            <Skeleton key={i} className="h-4" style={{ width: w }} />
          ))}
        </nav>
      </header>
      {/* Role cards grid */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className="text-left p-6 rounded-xl border border-tok-border bg-surface-1">
                <div className="flex justify-between items-start mb-4">
                  <Skeleton className="h-5 w-20" />
                  <Skeleton variant="text" className="w-12 h-3" />
                </div>
                <Skeleton className="h-5 w-24 mb-2" />
                <Skeleton variant="text" className="w-full h-3 mb-1" />
                <Skeleton variant="text" className="w-3/4 h-3 mb-6" />
                <div className="flex items-center justify-between pt-4 border-t border-tok-border/50">
                  <Skeleton variant="text" className="w-24 h-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      {/* Footer */}
      <footer className="p-8 border-t border-tok-border bg-surface-0 flex justify-between items-center">
        <Skeleton variant="text" className="w-48 h-3" />
        <Skeleton variant="text" className="w-40 h-3" />
      </footer>
    </div>
  );
}

export default function AccessControlManager({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AccessControlManagerSkeleton />;

  const [activeTab, setActiveTab] = useState<TabID>("roles");
  const [selectedRole, setSelectedRole] = useState<RoleName | null>(null);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  // Helper: Get roles that have a specific permission
  const getRolesWithPermission = (permId: string) => {
    return ROLES.filter(r => r.permissions.includes(permId)).map(r => r.name);
  };

  return (
    <div className="flex flex-col min-h-screen bg-surface-0 text-fg-primary font-sans selection:bg-indigo-500/30">
      {/* Header */}
      <header className="px-3 sm:px-4 md:px-8 py-4 md:py-6 border-b border-tok-border bg-surface-0/50 backdrop-blur-md sticky top-0 z-20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-fg-primary">Access Control</h1>
            <p className="text-fg-secondary text-sm mt-1">Manage organization roles, permissions, and user access policies.</p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 bg-surface-1 hover:bg-surface-2 border border-tok-border rounded-lg text-sm font-medium transition-colors">
              Export Log
            </button>
            <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-fg-primary rounded-lg text-sm font-medium shadow-lg shadow-indigo-500/20 transition-all">
              Invite User
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <nav className="flex gap-8">
          {(["roles", "permissions", "users", "audit"] as TabID[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setSelectedRole(null);
              }}
              className={cn(
                "pb-3 text-sm font-medium transition-all relative capitalize",
                activeTab === tab ? "text-indigo-400" : "text-fg-muted hover:text-fg-primary"
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          
          {/* --- Roles Tab --- */}
          {activeTab === "roles" && (
            <div className="flex gap-6 items-start">
              {/* Roles List */}
              <div className={cn("grid gap-4 transition-all duration-300", selectedRole ? "w-1/2" : "w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3")}>
                {ROLES.length === 0 && (
                  <ContextualEmptyState
                    icon={Shield}
                    title="No roles defined"
                    description="Create your first role to start managing access permissions."
                    size="md"
                  />
                )}
                {ROLES.map((role) => (
                  <button
                    key={role.id}
                    onClick={() => setSelectedRole(role.id === selectedRole ? null : role.id)}
                    className={cn(
                      "text-left p-6 rounded-xl border transition-all group",
                      selectedRole === role.id 
                        ? "bg-surface-1 border-indigo-500/50 ring-1 ring-indigo-500/20" 
                        : "bg-surface-1 border-tok-border hover:border-tok-border"
                    )}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <RoleBadge role={role.name} className="text-sm px-3" />
                      <span className="text-fg-muted text-xs font-mono">{role.userCount} Users</span>
                    </div>
                    <h3 className="text-lg font-semibold mb-2 group-hover:text-indigo-300 transition-colors">{role.name}</h3>
                    <p className="text-fg-secondary text-sm leading-relaxed mb-6 h-10 overflow-hidden line-clamp-2">
                      {role.description}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-tok-border/50">
                      <span className="text-xs text-fg-muted font-medium">{role.permissions.length} Permissions</span>
                      <span className="text-xs text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity">
                        View Details →
                      </span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Role Detail Panel */}
              {selectedRole && (
                <div className="w-1/2 bg-surface-1 border border-tok-border rounded-xl overflow-hidden animate-in slide-in-from-right-4 fade-in duration-300 sticky top-44">
                  {ROLES.filter(r => r.id === selectedRole).map(role => (
                    <div key={role.id}>
                      <div className="p-3 sm:p-4 md:p-6 border-b border-tok-border bg-surface-1/50">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h2 className="text-xl font-bold">{role.name}</h2>
                              <RoleBadge role={role.name} />
                            </div>
                            <p className="text-fg-secondary text-sm">{role.description}</p>
                          </div>
                          <button 
                            onClick={() => setSelectedRole(null)}
                            className="p-1 hover:bg-surface-2 rounded-md transition-colors text-fg-muted"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      
                      <div className="p-3 sm:p-4 md:p-6 h-[500px] overflow-y-auto custom-scrollbar">
                        <h4 className="text-xs font-bold uppercase tracking-widest text-fg-muted mb-4">Permissions by Resource</h4>
                        
                        {(["Users", "Agents", "Sessions", "Billing", "Settings"] as ResourceGroup[]).map(group => {
                          const groupPerms = PERMISSIONS.filter(p => p.group === group && role.permissions.includes(p.id));
                          if (groupPerms.length === 0) {return null;}
                          
                          return (
                            <div key={group} className="mb-6 last:mb-0">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="w-1 h-4 bg-indigo-500 rounded-full" />
                                <h5 className="text-sm font-semibold text-fg-primary">{group}</h5>
                              </div>
                              <div className="space-y-2">
                                {groupPerms.map(perm => (
                                  <div key={perm.id} className="p-3 bg-surface-0 border border-tok-border/50 rounded-lg">
                                    <div className="text-xs font-mono text-indigo-400 mb-1">{perm.name}</div>
                                    <div className="text-xs text-fg-muted">{perm.description}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      <div className="p-4 bg-surface-0 border-t border-tok-border flex justify-end gap-3">
                        <button className="px-4 py-2 text-sm font-medium text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors">
                          Delete Role
                        </button>
                        <button className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-fg-primary rounded-lg text-sm font-medium transition-colors">
                          Edit Permissions
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* --- Permissions Tab --- */}
          {activeTab === "permissions" && (
            <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-tok-border bg-surface-1/50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Permission</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Resource Group</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Assigned Roles</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tok-border">
                    {PERMISSIONS.map((perm) => (
                      <tr key={perm.id} className="hover:bg-surface-0/50 transition-colors group">
                        <td className="px-6 py-4">
                          <span className="font-mono text-sm text-indigo-400 font-medium">{perm.name}</span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm text-fg-primary">{perm.group}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {getRolesWithPermission(perm.id).map(roleName => (
                              <RoleBadge key={roleName} role={roleName} className="text-[10px] py-0 px-1.5" />
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 max-w-xs">
                          <p className="text-sm text-fg-muted line-clamp-1 group-hover:line-clamp-none transition-all">
                            {perm.description}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- Users Tab --- */}
          {activeTab === "users" && (
            <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-tok-border bg-surface-1/50">
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">User</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Role</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Last Active</th>
                      <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-tok-border">
                    {USERS.map((user) => (
                      <React.Fragment key={user.id}>
                        <tr className={cn(
                          "hover:bg-surface-0/50 transition-colors",
                          expandedUser === user.id ? "bg-surface-0/50" : ""
                        )}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-surface-2 border border-tok-border flex items-center justify-center text-lg shadow-inner">
                                {user.avatarEmoji}
                              </div>
                              <div>
                                <div className="text-sm font-semibold text-fg-primary">{user.name}</div>
                                <div className="text-xs text-fg-muted">{user.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <RoleBadge role={user.role} />
                          </td>
                          <td className="px-6 py-4 text-sm text-fg-muted">
                            {user.lastActive}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button 
                              onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                              className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors px-3 py-1 rounded-md hover:bg-indigo-500/10"
                            >
                              {expandedUser === user.id ? "Hide Permissions" : "View Permissions"}
                            </button>
                          </td>
                        </tr>
                        {expandedUser === user.id && (
                          <tr className="bg-surface-0/80">
                            <td colSpan={4} className="px-12 py-6 border-b border-tok-border">
                              <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="flex items-center justify-between mb-6">
                                  <h4 className="text-sm font-bold text-fg-secondary uppercase tracking-widest">Active Permissions for {user.name}</h4>
                                  <div className="text-xs text-fg-muted">Inherited from <RoleBadge role={user.role} className="ml-1" /></div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                  {PERMISSIONS.filter(p => ROLES.find(r => r.id === user.role)?.permissions.includes(p.id)).map(perm => (
                                    <div key={perm.id} className="p-3 bg-surface-1 border border-tok-border rounded-lg flex flex-col gap-1">
                                      <span className="text-xs font-mono text-indigo-400">{perm.name}</span>
                                      <span className="text-[10px] text-fg-muted leading-tight">{perm.description}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- Audit Tab --- */}
          {activeTab === "audit" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-surface-1 p-4 border border-tok-border rounded-xl mb-6">
                <div className="flex gap-4">
                  <div className="px-3 py-1 bg-surface-0 border border-tok-border rounded text-xs text-fg-secondary">
                    Filter by Actor: <span className="text-fg-primary ml-1 font-medium">All</span>
                  </div>
                  <div className="px-3 py-1 bg-surface-0 border border-tok-border rounded text-xs text-fg-secondary">
                    Date Range: <span className="text-fg-primary ml-1 font-medium">Last 7 Days</span>
                  </div>
                </div>
                <div className="text-xs text-fg-muted">Showing {AUDIT_LOG.length} entries</div>
              </div>

              <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-tok-border bg-surface-1/50">
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Timestamp</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Actor</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Action</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Target</th>
                        <th className="px-6 py-4 text-xs font-bold uppercase tracking-widest text-fg-muted">Changes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-tok-border">
                      {AUDIT_LOG.map((entry) => (
                        <tr key={entry.id} className="hover:bg-surface-0/50 transition-colors group">
                          <td className="px-6 py-4">
                            <div className="text-xs text-fg-secondary font-mono whitespace-nowrap">{entry.timestamp}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-surface-2 flex items-center justify-center text-[10px] border border-tok-border">
                                {entry.actor === "System" ? "🤖" : "👤"}
                              </span>
                              <span className="text-sm font-medium text-fg-primary">{entry.actor}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-xs px-2 py-0.5 rounded font-medium",
                              entry.action.includes("Create") ? "text-emerald-400 bg-emerald-500/10" : 
                              entry.action.includes("Revoke") || entry.action.includes("Delete") ? "text-rose-400 bg-rose-500/10" :
                              entry.action.includes("Lock") ? "text-amber-400 bg-amber-500/10" :
                              "text-indigo-400 bg-indigo-500/10"
                            )}>
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-sm text-fg-primary font-medium">
                            {entry.target}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1 max-w-md">
                              <div className="text-[10px] text-fg-muted line-through truncate opacity-50">FROM: {entry.oldValue}</div>
                              <div className="text-xs text-indigo-300 font-medium line-clamp-2">TO: {entry.newValue}</div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              
              <div className="flex justify-center pt-6 pb-2">
                <button className="text-xs font-bold uppercase tracking-widest text-fg-muted hover:text-fg-primary transition-colors flex items-center gap-2">
                  Load Older Entries <span className="text-lg leading-none">↓</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Styles for scrollbar */}
      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />

      {/* Footer Info */}
      <footer className="p-8 border-t border-tok-border bg-surface-0 flex justify-between items-center">
        <div className="flex gap-6 text-xs text-fg-muted">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50" />
            RBAC Engine v2.4.1 (Stable)
          </div>
          <div>Last security audit: 24h ago</div>
        </div>
        <div className="text-xs text-fg-muted">
          Horizon Cloud IAM • Built by Quinn
        </div>
      </footer>
    </div>
  );
}

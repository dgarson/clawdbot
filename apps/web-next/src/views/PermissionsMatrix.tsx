import React, { useState } from "react";
import { cn } from "../lib/utils";

interface Permission {
  id: string;
  resource: string;
  action: string;
  description: string;
  category: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  color: string;
  userCount: number;
  permissions: Set<string>;
  isSystem: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  roles: string[];
  department: string;
  status: "active" | "inactive";
}

const PERMISSIONS: Permission[] = [
  // Users
  { id: "users.read",    resource: "Users",    action: "Read",    description: "View user profiles and list",   category: "Users" },
  { id: "users.create",  resource: "Users",    action: "Create",  description: "Create new user accounts",      category: "Users" },
  { id: "users.update",  resource: "Users",    action: "Update",  description: "Modify user details and roles", category: "Users" },
  { id: "users.delete",  resource: "Users",    action: "Delete",  description: "Remove user accounts",          category: "Users" },
  // Projects
  { id: "projects.read",   resource: "Projects", action: "Read",   description: "View project details",       category: "Projects" },
  { id: "projects.create", resource: "Projects", action: "Create", description: "Create new projects",        category: "Projects" },
  { id: "projects.update", resource: "Projects", action: "Update", description: "Modify project settings",    category: "Projects" },
  { id: "projects.delete", resource: "Projects", action: "Delete", description: "Archive or delete projects", category: "Projects" },
  // Billing
  { id: "billing.read",    resource: "Billing",  action: "Read",   description: "View invoices and plans",    category: "Billing" },
  { id: "billing.manage",  resource: "Billing",  action: "Manage", description: "Change plans and payment",   category: "Billing" },
  // API
  { id: "api.read",        resource: "API Keys", action: "Read",   description: "View API keys (masked)",     category: "API" },
  { id: "api.create",      resource: "API Keys", action: "Create", description: "Generate new API keys",      category: "API" },
  { id: "api.revoke",      resource: "API Keys", action: "Revoke", description: "Revoke API keys",            category: "API" },
  // Audit
  { id: "audit.read",      resource: "Audit Log", action: "Read",  description: "View audit trail",           category: "Audit" },
  { id: "audit.export",    resource: "Audit Log", action: "Export","description": "Export audit log data",    category: "Audit" },
  // Settings
  { id: "settings.read",   resource: "Settings", action: "Read",   description: "View org settings",         category: "Settings" },
  { id: "settings.update", resource: "Settings", action: "Update", description: "Modify org-wide settings",  category: "Settings" },
  // Analytics
  { id: "analytics.read",  resource: "Analytics", action: "Read",  description: "View usage analytics",      category: "Analytics" },
  { id: "analytics.export",resource: "Analytics", action: "Export","description": "Export analytics data",   category: "Analytics" },
];

const makePerms = (...ids: string[]) => new Set<string>(ids);

const ROLES: Role[] = [
  {
    id: "r1", name: "Owner", description: "Full access to everything", color: "bg-rose-500",
    userCount: 2, isSystem: true,
    permissions: makePerms(...PERMISSIONS.map(p => p.id)),
  },
  {
    id: "r2", name: "Admin", description: "Manage users, projects, billing", color: "bg-indigo-500",
    userCount: 4, isSystem: true,
    permissions: makePerms(
      "users.read","users.create","users.update","users.delete",
      "projects.read","projects.create","projects.update","projects.delete",
      "billing.read","billing.manage",
      "api.read","api.create","api.revoke",
      "audit.read","audit.export",
      "settings.read","settings.update",
      "analytics.read","analytics.export"
    ),
  },
  {
    id: "r3", name: "Developer", description: "Manage projects and API keys", color: "bg-emerald-500",
    userCount: 12, isSystem: true,
    permissions: makePerms(
      "users.read",
      "projects.read","projects.create","projects.update",
      "api.read","api.create","api.revoke",
      "analytics.read",
      "audit.read"
    ),
  },
  {
    id: "r4", name: "Analyst", description: "Read-only analytics and reports", color: "bg-amber-500",
    userCount: 6, isSystem: false,
    permissions: makePerms("projects.read","analytics.read","analytics.export","users.read"),
  },
  {
    id: "r5", name: "Billing Manager", description: "Manage billing only", color: "bg-purple-500",
    userCount: 3, isSystem: false,
    permissions: makePerms("billing.read","billing.manage","users.read"),
  },
  {
    id: "r6", name: "Viewer", description: "Read-only access", color: "bg-zinc-500",
    userCount: 9, isSystem: true,
    permissions: makePerms("users.read","projects.read","analytics.read"),
  },
];

const USERS: User[] = [
  { id: "u1", name: "Alice Chen",     email: "alice@corp.io",   avatar: "AC", roles: ["r1","r2"], department: "Engineering",  status: "active" },
  { id: "u2", name: "Bob Martinez",   email: "bob@corp.io",     avatar: "BM", roles: ["r3"],      department: "Engineering",  status: "active" },
  { id: "u3", name: "Carol White",    email: "carol@corp.io",   avatar: "CW", roles: ["r4"],      department: "Data Science", status: "active" },
  { id: "u4", name: "David Kim",      email: "david@corp.io",   avatar: "DK", roles: ["r2","r5"], department: "Finance",      status: "active" },
  { id: "u5", name: "Eve Johnson",    email: "eve@corp.io",     avatar: "EJ", roles: ["r3"],      department: "Engineering",  status: "active" },
  { id: "u6", name: "Frank Lee",      email: "frank@corp.io",   avatar: "FL", roles: ["r6"],      department: "Marketing",    status: "inactive" },
  { id: "u7", name: "Grace Park",     email: "grace@corp.io",   avatar: "GP", roles: ["r4","r3"], department: "Product",      status: "active" },
  { id: "u8", name: "Henry Brown",    email: "henry@corp.io",   avatar: "HB", roles: ["r5"],      department: "Finance",      status: "active" },
];

const CATEGORIES = Array.from(new Set(PERMISSIONS.map(p => p.category)));

type Tab = "matrix" | "roles" | "users" | "compare";

export default function PermissionsMatrix() {
  const [activeTab, setActiveTab] = useState<Tab>("matrix");
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [draftPerms, setDraftPerms] = useState<Set<string>>(new Set());
  const [compareRoleA, setCompareRoleA] = useState<string>("r2");
  const [compareRoleB, setCompareRoleB] = useState<string>("r3");
  const [filterCategory, setFilterCategory] = useState("all");
  const [searchUser, setSearchUser] = useState("");

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "matrix",  label: "Permission Matrix", emoji: "📋" },
    { id: "roles",   label: "Roles",             emoji: "🎭" },
    { id: "users",   label: "User Assignments",  emoji: "👥" },
    { id: "compare", label: "Role Compare",      emoji: "⚖️" },
  ];

  const filteredPerms = PERMISSIONS.filter(p =>
    filterCategory === "all" || p.category === filterCategory
  );

  const startEdit = (role: Role) => {
    setEditingRole(role);
    setDraftPerms(new Set(role.permissions));
  };

  const toggleDraftPerm = (permId: string) => {
    setDraftPerms(prev => {
      const next = new Set(prev);
      if (next.has(permId)) next.delete(permId);
      else next.add(permId);
      return next;
    });
  };

  const getRoleById = (id: string) => ROLES.find(r => r.id === id);

  const roleA = getRoleById(compareRoleA);
  const roleB = getRoleById(compareRoleB);

  const filteredUsers = USERS.filter(u =>
    !searchUser ||
    u.name.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUser.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Permissions Matrix</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Role-based access control — {ROLES.length} roles · {PERMISSIONS.length} permissions · {USERS.length} users</p>
        </div>
        <button className="text-sm px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 transition-colors">
          + New Role
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Permission Matrix Tab */}
      {activeTab === "matrix" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="text-xs text-zinc-400">Filter by category:</div>
            <div className="flex gap-1">
              {["all", ...CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat)}
                  className={cn(
                    "text-xs px-3 py-1 rounded border transition-colors capitalize",
                    filterCategory === cat
                      ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-300"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="px-4 py-3 text-left text-xs text-zinc-400 font-medium w-48 sticky left-0 bg-zinc-900">Permission</th>
                    {ROLES.map(role => (
                      <th key={role.id} className="px-3 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded text-white font-medium", role.color)}>{role.name}</span>
                          <span className="text-zinc-500 text-xs">{role.userCount}u</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {CATEGORIES.filter(c => filterCategory === "all" || c === filterCategory).map(category => (
                    <React.Fragment key={category}>
                      <tr className="bg-zinc-800/30">
                        <td colSpan={ROLES.length + 1} className="px-4 py-2 text-xs font-semibold text-zinc-400 uppercase tracking-wider sticky left-0 bg-zinc-800/30">
                          {category}
                        </td>
                      </tr>
                      {filteredPerms.filter(p => p.category === category).map(perm => (
                        <tr key={perm.id} className="border-t border-zinc-800/50 hover:bg-zinc-800/20 transition-colors">
                          <td className="px-4 py-2.5 sticky left-0 bg-zinc-900">
                            <div className="text-xs text-white font-medium">{perm.resource} · {perm.action}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{perm.description}</div>
                          </td>
                          {ROLES.map(role => (
                            <td key={role.id} className="px-3 py-2.5 text-center">
                              {role.permissions.has(perm.id) ? (
                                <span className="text-emerald-400 text-base">✓</span>
                              ) : (
                                <span className="text-zinc-700 text-base">—</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Roles Tab */}
      {activeTab === "roles" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-3">
            {ROLES.map(role => (
              <button
                key={role.id}
                onClick={() => { setSelectedRole(role); setEditingRole(null); }}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedRole?.id === role.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn("w-2 h-2 rounded-full", role.color)} />
                  <span className="text-sm font-medium text-white">{role.name}</span>
                  {role.isSystem && <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">system</span>}
                </div>
                <div className="text-xs text-zinc-400 mb-2">{role.description}</div>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{role.userCount} users</span>
                  <span>{role.permissions.size} permissions</span>
                </div>
              </button>
            ))}
          </div>

          <div className="col-span-3">
            {selectedRole && !editingRole ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={cn("w-3 h-3 rounded-full", selectedRole.color)} />
                    <h3 className="text-base font-semibold text-white">{selectedRole.name}</h3>
                    {selectedRole.isSystem && <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">system</span>}
                  </div>
                  {!selectedRole.isSystem && (
                    <button
                      onClick={() => startEdit(selectedRole)}
                      className="text-xs px-3 py-1.5 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30 transition-colors"
                    >
                      ✏️ Edit Permissions
                    </button>
                  )}
                </div>

                <p className="text-sm text-zinc-400">{selectedRole.description}</p>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-zinc-800 rounded p-3">
                    <div className="text-xs text-zinc-400">Users with this role</div>
                    <div className="text-xl font-bold text-white mt-1">{selectedRole.userCount}</div>
                  </div>
                  <div className="bg-zinc-800 rounded p-3">
                    <div className="text-xs text-zinc-400">Permissions granted</div>
                    <div className="text-xl font-bold text-indigo-400 mt-1">{selectedRole.permissions.size}</div>
                  </div>
                </div>

                <div className="space-y-3">
                  {CATEGORIES.map(cat => {
                    const catPerms = PERMISSIONS.filter(p => p.category === cat);
                    const grantedPerms = catPerms.filter(p => selectedRole.permissions.has(p.id));
                    if (grantedPerms.length === 0) return null;
                    return (
                      <div key={cat}>
                        <div className="text-xs font-medium text-zinc-400 mb-1.5">{cat}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {grantedPerms.map(p => (
                            <span key={p.id} className="text-xs bg-emerald-400/10 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 rounded font-mono">
                              {p.action.toLowerCase()}
                            </span>
                          ))}
                          {catPerms.filter(p => !selectedRole.permissions.has(p.id)).map(p => (
                            <span key={p.id} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-600 px-2 py-0.5 rounded font-mono">
                              {p.action.toLowerCase()}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : editingRole ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Edit: {editingRole.name}</h3>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingRole(null)}
                      className="text-xs px-3 py-1.5 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-800"
                    >Cancel</button>
                    <button
                      onClick={() => setEditingRole(null)}
                      className="text-xs px-3 py-1.5 bg-indigo-500 text-white rounded hover:bg-indigo-600"
                    >Save Changes</button>
                  </div>
                </div>
                <div className="space-y-4 max-h-[440px] overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => (
                    <div key={cat}>
                      <div className="text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">{cat}</div>
                      <div className="space-y-1">
                        {PERMISSIONS.filter(p => p.category === cat).map(perm => (
                          <label key={perm.id} className="flex items-start gap-3 cursor-pointer hover:bg-zinc-800/50 rounded p-2 transition-colors">
                            <input
                              type="checkbox"
                              checked={draftPerms.has(perm.id)}
                              onChange={() => toggleDraftPerm(perm.id)}
                              className="mt-0.5 accent-indigo-500"
                            />
                            <div>
                              <div className="text-xs text-white font-medium">{perm.resource} · {perm.action}</div>
                              <div className="text-xs text-zinc-500">{perm.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a role to view its permissions
              </div>
            )}
          </div>
        </div>
      )}

      {/* Users Tab */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="text"
              placeholder="Search users..."
              value={searchUser}
              onChange={e => setSearchUser(e.target.value)}
              className="w-64 bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="text-xs text-zinc-400">{filteredUsers.length} users</div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                  <th className="px-4 py-3 text-left font-medium">User</th>
                  <th className="px-4 py-3 text-left font-medium">Department</th>
                  <th className="px-4 py-3 text-left font-medium">Roles</th>
                  <th className="px-4 py-3 text-left font-medium">Permissions</th>
                  <th className="px-4 py-3 text-left font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {filteredUsers.map(user => {
                  const userRoles = user.roles.map(rid => ROLES.find(r => r.id === rid)).filter(Boolean) as Role[];
                  const effectivePerms = new Set<string>();
                  userRoles.forEach(r => r.permissions.forEach(p => effectivePerms.add(p)));
                  return (
                    <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300">
                            {user.avatar}
                          </div>
                          <div>
                            <div className="text-sm text-white font-medium">{user.name}</div>
                            <div className="text-xs text-zinc-400">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">{user.department}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {userRoles.map(r => (
                            <span key={r.id} className={cn("text-xs text-white px-2 py-0.5 rounded", r.color)}>{r.name}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-24 bg-zinc-800 rounded-full h-1.5">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${(effectivePerms.size / PERMISSIONS.length) * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-400">{effectivePerms.size}/{PERMISSIONS.length}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded border",
                          user.status === "active"
                            ? "bg-emerald-400/10 border-emerald-500/30 text-emerald-400"
                            : "bg-zinc-800 border-zinc-700 text-zinc-500"
                        )}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">Edit Roles</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Compare Tab */}
      {activeTab === "compare" && (
        <div className="space-y-4">
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Role A:</label>
              <select
                value={compareRoleA}
                onChange={e => setCompareRoleA(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none"
              >
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="text-zinc-500">vs</div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-zinc-400">Role B:</label>
              <select
                value={compareRoleB}
                onChange={e => setCompareRoleB(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none"
              >
                {ROLES.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
          </div>

          {roleA && roleB && (
            <>
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", roleA.color)} />
                    <span className="text-sm font-semibold text-white">{roleA.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{roleA.permissions.size}</div>
                  <div className="text-xs text-zinc-400">permissions</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 flex flex-col items-center justify-center">
                  <div className="text-xs text-zinc-400 mb-1">Shared</div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {[...roleA.permissions].filter(p => roleB.permissions.has(p)).length}
                  </div>
                  <div className="text-xs text-zinc-400">in common</div>
                </div>
                <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", roleB.color)} />
                    <span className="text-sm font-semibold text-white">{roleB.name}</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{roleB.permissions.size}</div>
                  <div className="text-xs text-zinc-400">permissions</div>
                </div>
              </div>

              {/* Per-permission diff */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 text-xs text-zinc-400 font-medium border-b border-zinc-800 px-4 py-2">
                  <div className="text-center">{roleA.name} only</div>
                  <div className="text-center">Both</div>
                  <div className="text-center">{roleB.name} only</div>
                </div>
                {CATEGORIES.map(cat => {
                  const catPerms = PERMISSIONS.filter(p => p.category === cat);
                  const aOnly = catPerms.filter(p => roleA.permissions.has(p.id) && !roleB.permissions.has(p.id));
                  const both  = catPerms.filter(p => roleA.permissions.has(p.id) &&  roleB.permissions.has(p.id));
                  const bOnly = catPerms.filter(p => !roleA.permissions.has(p.id) && roleB.permissions.has(p.id));
                  const anyDiff = aOnly.length > 0 || both.length > 0 || bOnly.length > 0;
                  if (!anyDiff) return null;
                  return (
                    <div key={cat} className="border-b border-zinc-800 last:border-b-0">
                      <div className="bg-zinc-800/40 px-4 py-1.5 text-xs text-zinc-400 font-medium">{cat}</div>
                      <div className="grid grid-cols-3 gap-0 px-4 py-2">
                        <div className="space-y-1 pr-2 border-r border-zinc-800">
                          {aOnly.map(p => (
                            <div key={p.id} className="text-xs bg-rose-400/10 border border-rose-500/20 text-rose-300 px-2 py-0.5 rounded font-mono">{p.action}</div>
                          ))}
                        </div>
                        <div className="space-y-1 px-2 border-r border-zinc-800">
                          {both.map(p => (
                            <div key={p.id} className="text-xs bg-emerald-400/10 border border-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded font-mono">{p.action}</div>
                          ))}
                        </div>
                        <div className="space-y-1 pl-2">
                          {bOnly.map(p => (
                            <div key={p.id} className="text-xs bg-indigo-400/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded font-mono">{p.action}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useCallback, useMemo } from "react"
import { cn } from "../lib/utils"

type PermAction = "read" | "write" | "execute" | "admin" | "delete";
type ResourceType = "agent" | "session" | "file" | "tool" | "model" | "webhook" | "api-key" | "config";

interface Permission {
  resourceType: ResourceType;
  resourceId: string;
  resourceName: string;
  actions: PermAction[];
  inherited?: boolean;
  grantedAt: string;
  grantedBy: string;
}

interface AgentPermProfile {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  role: "owner" | "admin" | "member" | "guest";
  permissions: Permission[];
  lastModified: string;
}

const RESOURCE_TYPES: ResourceType[] = ["agent", "session", "file", "tool", "model", "webhook", "api-key", "config"];
const ACTIONS: PermAction[] = ["read", "write", "execute", "admin", "delete"];

const ROLE_STYLES: Record<AgentPermProfile["role"], string> = {
  owner: "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/12 text-[var(--color-text-primary)]",
  admin: "border-emerald-500/40 bg-emerald-500/12 text-[var(--color-text-primary)]",
  member: "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]",
  guest: "border-amber-500/40 bg-amber-500/12 text-[var(--color-text-primary)]",
};

const SEED_DATA: AgentPermProfile[] = [
  {
    agentId: "luis-01",
    agentName: "Luis",
    agentEmoji: "🏗️",
    role: "owner",
    lastModified: "2026-02-20T10:00:00Z",
    permissions: RESOURCE_TYPES.map(rt => ({
      resourceType: rt,
      resourceId: "*",
      resourceName: `All ${rt}s`,
      actions: [...ACTIONS],
      grantedAt: "2026-01-01T00:00:00Z",
      grantedBy: "system"
    }))
  },
  {
    agentId: "xavier-02",
    agentName: "Xavier",
    agentEmoji: "⚡",
    role: "admin",
    lastModified: "2026-02-21T15:30:00Z",
    permissions: [
      { resourceType: "agent", resourceId: "*", resourceName: "All agents", actions: ["read", "write", "execute"], grantedAt: "2026-01-01T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "session", resourceId: "*", resourceName: "All sessions", actions: ["read", "write", "execute"], grantedAt: "2026-01-01T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "tool", resourceId: "*", resourceName: "All tools", actions: ["read", "write", "execute"], grantedAt: "2026-01-01T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "model", resourceId: "*", resourceName: "All models", actions: ["admin"], grantedAt: "2026-01-01T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "config", resourceId: "*", resourceName: "System Config", actions: ["read"], inherited: true, grantedAt: "2026-01-01T00:00:00Z", grantedBy: "system" }
    ]
  },
  {
    agentId: "stephan-03",
    agentName: "Stephan",
    agentEmoji: "🧬",
    role: "member",
    lastModified: "2026-02-19T09:15:00Z",
    permissions: [
      { resourceType: "agent", resourceId: "*", resourceName: "All agents", actions: ["read"], grantedAt: "2026-01-05T00:00:00Z", grantedBy: "Xavier" },
      { resourceType: "session", resourceId: "*", resourceName: "All sessions", actions: ["read"], grantedAt: "2026-01-05T00:00:00Z", grantedBy: "Xavier" },
      { resourceType: "file", resourceId: "*", resourceName: "All files", actions: ["read", "write"], grantedAt: "2026-01-05T00:00:00Z", grantedBy: "Xavier" },
      { resourceType: "tool", resourceId: "*", resourceName: "All tools", actions: ["read"], inherited: true, grantedAt: "2026-01-01T00:00:00Z", grantedBy: "system" }
    ]
  },
  {
    agentId: "piper-04",
    agentName: "Piper",
    agentEmoji: "🎨",
    role: "member",
    lastModified: "2026-02-22T00:45:00Z",
    permissions: [
      { resourceType: "session", resourceId: "*", resourceName: "All sessions", actions: ["read", "write", "execute"], grantedAt: "2026-01-10T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "tool", resourceId: "*", resourceName: "All tools", actions: ["read", "write", "execute"], grantedAt: "2026-01-10T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "file", resourceId: "*", resourceName: "All files", actions: ["read"], grantedAt: "2026-01-10T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "agent", resourceId: "*", resourceName: "All agents", actions: ["read"], inherited: true, grantedAt: "2026-01-01T00:00:00Z", grantedBy: "system" }
    ]
  },
  {
    agentId: "tim-05",
    agentName: "Tim",
    agentEmoji: "🏛️",
    role: "admin",
    lastModified: "2026-02-18T14:20:00Z",
    permissions: [
      { resourceType: "webhook", resourceId: "*", resourceName: "All webhooks", actions: ["read", "write", "execute", "admin", "delete"], grantedAt: "2026-01-02T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "api-key", resourceId: "*", resourceName: "All API keys", actions: ["read", "write", "execute", "admin", "delete"], grantedAt: "2026-01-02T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "config", resourceId: "*", resourceName: "System Config", actions: ["read", "write", "execute", "admin", "delete"], grantedAt: "2026-01-02T00:00:00Z", grantedBy: "Luis" },
      { resourceType: "agent", resourceId: "*", resourceName: "All agents", actions: ["read"], grantedAt: "2026-01-02T00:00:00Z", grantedBy: "Luis" }
    ]
  }
];

const RoleBadge = ({ role }: { role: AgentPermProfile["role"] }) => {
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em]", ROLE_STYLES[role])}>
      {role}
    </span>
  );
};

export default function PermissionsManager() {
  const [agents, setAgents] = useState<AgentPermProfile[]>(SEED_DATA);
  const [selectedAgentId, setSelectedAgentId] = useState<string>(SEED_DATA[0].agentId);
  const [isEditing, setIsEditing] = useState(false);
  const [editBuffer, setEditBuffer] = useState<Permission[]>([]);

  const selectedAgent = useMemo(() => 
    agents.find(a => a.agentId === selectedAgentId) || agents[0],
    [agents, selectedAgentId]
  );

  const startEditing = useCallback(() => {
    setEditBuffer(JSON.parse(JSON.stringify(selectedAgent.permissions)));
    setIsEditing(true);
  }, [selectedAgent]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditBuffer([]);
  }, []);

  const saveEditing = useCallback(() => {
    setAgents(prev => prev.map(a => 
      a.agentId === selectedAgentId 
        ? { ...a, permissions: editBuffer, lastModified: new Date().toISOString() } 
        : a
    ));
    setIsEditing(false);
    setEditBuffer([]);
  }, [selectedAgentId, editBuffer]);

  const togglePermission = useCallback((resourceType: ResourceType, action: PermAction) => {
    if (!isEditing) {return;}
    
    setEditBuffer(prev => {
      const existingIdx = prev.findIndex(p => p.resourceType === resourceType);
      if (existingIdx > -1) {
        if (prev[existingIdx].inherited) {return prev;} // Cannot edit inherited
        
        const newActions = prev[existingIdx].actions.includes(action)
          ? prev[existingIdx].actions.filter(a => a !== action)
          : [...prev[existingIdx].actions, action];
        
        const newBuffer = [...prev];
        newBuffer[existingIdx] = { ...newBuffer[existingIdx], actions: newActions };
        return newBuffer;
      } else {
        return [...prev, {
          resourceType,
          resourceId: "*",
          resourceName: `All ${resourceType}s`,
          actions: [action],
          grantedAt: new Date().toISOString(),
          grantedBy: "me"
        }];
      }
    });
  }, [isEditing]);

  const hasPerm = (resourceType: ResourceType, action: PermAction) => {
    const source = isEditing ? editBuffer : selectedAgent.permissions;
    const p = source.find(p => p.resourceType === resourceType);
    return {
      granted: p?.actions.includes(action) || false,
      inherited: p?.inherited || false
    };
  };

  const currentPermissions = isEditing ? editBuffer : selectedAgent.permissions;
  const grantedCount = currentPermissions.reduce((sum, permission) => sum + permission.actions.length, 0);
  const inheritedCount = currentPermissions.filter((permission) => permission.inherited).length;

  return (
    <div className="flex h-full w-full overflow-hidden bg-[var(--color-surface-0)] text-[var(--color-text-primary)] font-sans">
      {/* Sidebar */}
      <aside className="flex w-72 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface-1)]/70" role="navigation" aria-label="Agents List">
        <div className="border-b border-[var(--color-border)] px-5 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">Agents</h2>
        </div>
        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {agents.map(agent => (
            <button
              key={agent.agentId}
              onClick={() => { setSelectedAgentId(agent.agentId); setIsEditing(false); }}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55",
                selectedAgentId === agent.agentId
                  ? "border-[var(--color-accent)]/45 bg-[var(--color-accent)]/10 shadow-sm"
                  : "border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/40"
              )}
              aria-selected={selectedAgentId === agent.agentId}
              role="tab"
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl" aria-hidden="true">{agent.agentEmoji}</span>
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-base font-semibold">{agent.agentName}</span>
                  <RoleBadge role={agent.role} />
                </div>
              </div>
              <p className="mt-2 text-[11px] text-[var(--color-text-muted)]">
                Updated {new Date(agent.lastModified).toLocaleDateString()}
              </p>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex min-w-0 flex-1 flex-col bg-[var(--color-surface-0)]" role="tabpanel" aria-label={`Permissions for ${selectedAgent.agentName}`}>
        {/* Header */}
        <header className="flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-surface-1)]/45 px-6 py-4">
          <div className="flex items-center gap-4">
            <span className="text-3xl" aria-hidden="true">{selectedAgent.agentEmoji}</span>
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold">
                {selectedAgent.agentName}
                <RoleBadge role={selectedAgent.role} />
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-[var(--color-text-secondary)]">
                <span>Last modified: {new Date(selectedAgent.lastModified).toLocaleString()}</span>
                <span>{grantedCount} granted actions</span>
                <span>{inheritedCount} inherited resources</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button 
                onClick={startEditing}
                className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] transition-colors hover:bg-[var(--color-surface-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
              >
                Edit Permissions
              </button>
            ) : (
              <>
                <button 
                  onClick={cancelEditing}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/55"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEditing}
                  className="rounded-lg border border-[var(--color-accent)]/30 bg-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60"
                >
                  Save Changes
                </button>
              </>
            )}
          </div>
        </header>

        {/* Matrix */}
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-6xl">
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)] shadow-[0_10px_30px_rgba(0,0,0,0.12)]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)]/70">
                  <th scope="col" className="sticky left-0 z-10 bg-[var(--color-surface-2)]/90 p-4 text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">Resource Type</th>
                  {ACTIONS.map(action => (
                    <th key={action} scope="col" className="p-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[var(--color-text-secondary)]">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {RESOURCE_TYPES.map(resType => (
                  <tr key={resType} className="transition-colors odd:bg-[var(--color-surface-1)] even:bg-[var(--color-surface-1)]/40 hover:bg-[var(--color-surface-2)]/35">
                    <th scope="row" className="sticky left-0 bg-inherit p-4 text-sm font-semibold capitalize text-[var(--color-text-primary)]">
                      {resType.replace("-", " ")}
                    </th>
                    {ACTIONS.map(action => {
                      const { granted, inherited } = hasPerm(resType, action);
                      const id = `perm-${resType}-${action}`;
                      return (
                        <td key={action} className="p-4 text-center">
                          <div className="flex justify-center items-center">
                            <label htmlFor={id} className="sr-only">{`${action} permission for ${resType}`}</label>
                            <div className="relative flex items-center">
                              <input
                                id={id}
                                type="checkbox"
                                checked={granted}
                                disabled={!isEditing || inherited}
                                onChange={() => togglePermission(resType, action)}
                                className={cn(
                                  "h-5 w-5 rounded border-2 bg-[var(--color-surface-0)] accent-[var(--color-accent)] transition-all",
                                  granted ? "border-[var(--color-accent)]" : "border-[var(--color-border)]",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/60",
                                  inherited
                                    ? "cursor-not-allowed opacity-60"
                                    : isEditing
                                      ? "cursor-pointer"
                                      : "cursor-default"
                                )}
                                aria-disabled={!isEditing || inherited}
                              />
                              {inherited && (
                                <span className="absolute -right-1 -top-1 rounded-full border border-[var(--color-border)] bg-[var(--color-surface-1)] p-0.5" title="Inherited from role">
                                  <svg className="h-2.5 w-2.5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
                </table>
              </div>
            </div>

            {/* Legend / Status */}
            <div className="mt-6 flex flex-wrap gap-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/70 px-4 py-3 text-xs text-[var(--color-text-secondary)]">
              <div className="flex items-center gap-2 rounded-md bg-[var(--color-surface-2)]/70 px-2 py-1">
                <div className="h-3.5 w-3.5 rounded border border-[var(--color-accent)] bg-[var(--color-accent)]"></div>
                <span>Granted Permission</span>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-[var(--color-surface-2)]/70 px-2 py-1">
                <div className="h-3.5 w-3.5 rounded border border-[var(--color-border)] bg-[var(--color-surface-0)]"></div>
                <span>Denied Permission</span>
              </div>
              <div className="flex items-center gap-2 rounded-md bg-[var(--color-surface-2)]/70 px-2 py-1">
                <div className="relative">
                   <div className="h-3.5 w-3.5 rounded border border-[var(--color-accent)] bg-[var(--color-accent)] opacity-60"></div>
                   <span className="absolute -right-1 -top-1 text-[8px]">🔒</span>
                </div>
                <span>Inherited (Read-only)</span>
              </div>
            </div>
            
            {isEditing && (
              <div role="status" className="mt-4 flex items-center gap-2 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 px-3 py-2 text-sm text-[var(--color-text-primary)]">
                <span aria-hidden="true">✏️</span>
                <span>You are currently in edit mode. Changes will not be permanent until saved.</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

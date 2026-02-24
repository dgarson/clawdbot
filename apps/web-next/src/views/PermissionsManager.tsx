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
  const colors = {
    owner: "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    admin: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    member: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/30",
    guest: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  };
  return (
    <span className={cn("px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider border", colors[role])}>
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

  return (
    <div className="flex h-full w-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden font-sans">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--color-border)] flex flex-col bg-[var(--color-surface-0)]/50" role="navigation" aria-label="Agents List">
        <div className="p-4 border-b border-[var(--color-border)]">
          <h2 className="text-sm font-semibold text-[var(--color-text-secondary)] uppercase tracking-widest">Agents</h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {agents.map(agent => (
            <button
              key={agent.agentId}
              onClick={() => { setSelectedAgentId(agent.agentId); setIsEditing(false); }}
              className={cn(
                "w-full flex items-center gap-3 p-4 text-left transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                selectedAgentId === agent.agentId ? "bg-[var(--color-surface-1)] shadow-inner" : "hover:bg-[var(--color-surface-1)]/50"
              )}
              aria-selected={selectedAgentId === agent.agentId}
              role="tab"
            >
              <span className="text-2xl" aria-hidden="true">{agent.agentEmoji}</span>
              <div className="flex flex-col min-w-0">
                <span className="font-medium truncate">{agent.agentName}</span>
                <RoleBadge role={agent.role} />
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col min-w-0 bg-[var(--color-surface-0)]" role="tabpanel" aria-label={`Permissions for ${selectedAgent.agentName}`}>
        {/* Header */}
        <header className="h-16 border-b border-[var(--color-border)] flex items-center justify-between px-6 bg-[var(--color-surface-1)]/30">
          <div className="flex items-center gap-4">
            <span className="text-3xl" aria-hidden="true">{selectedAgent.agentEmoji}</span>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                {selectedAgent.agentName}
                <RoleBadge role={selectedAgent.role} />
              </h1>
              <p className="text-xs text-[var(--color-text-muted)]">Last modified: {new Date(selectedAgent.lastModified).toLocaleString()}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isEditing ? (
              <button 
                onClick={startEditing}
                className="px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none border border-[var(--color-border)]"
              >
                Edit Permissions
              </button>
            ) : (
              <>
                <button 
                  onClick={cancelEditing}
                  className="px-4 py-2 bg-transparent hover:bg-[var(--color-surface-2)] rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none text-[var(--color-text-secondary)]"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveEditing}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-md text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none shadow-lg shadow-indigo-500/20"
                >
                  Save Changes
                </button>
              </>
            )}
          </div>
        </header>

        {/* Matrix */}
        <div className="flex-1 overflow-auto p-6">
          <div className="max-w-5xl mx-auto">
            <table className="w-full border-collapse text-left bg-[var(--color-surface-1)]/50 rounded-lg overflow-hidden border border-[var(--color-border)]">
              <thead>
                <tr className="bg-[var(--color-surface-1)] border-b border-[var(--color-border)]">
                  <th scope="col" className="p-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Resource Type</th>
                  {ACTIONS.map(action => (
                    <th key={action} scope="col" className="p-4 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider text-center">{action}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {RESOURCE_TYPES.map(resType => (
                  <tr key={resType} className="hover:bg-[var(--color-surface-2)]/30 transition-colors">
                    <th scope="row" className="p-4 font-medium text-[var(--color-text-primary)] capitalize">
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
                                  "h-5 w-5 rounded border-[var(--color-border)] bg-[var(--color-surface-2)] text-indigo-600 transition-all",
                                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                                  inherited ? "opacity-40 cursor-not-allowed" : isEditing ? "cursor-pointer" : "cursor-default"
                                )}
                                aria-disabled={!isEditing || inherited}
                              />
                              {inherited && (
                                <span className="absolute -top-1 -right-1 bg-[var(--color-surface-0)] rounded-full p-0.5" title="Inherited from role">
                                  <svg className="w-2.5 h-2.5 text-[var(--color-text-muted)]" fill="currentColor" viewBox="0 0 20 20">
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

            {/* Legend / Status */}
            <div className="mt-8 flex flex-wrap gap-6 text-xs text-[var(--color-text-muted)] border-t border-[var(--color-border)] pt-6">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-indigo-600 border border-indigo-500"></div>
                <span>Granted Permission</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)]"></div>
                <span>Denied Permission</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                   <div className="h-4 w-4 rounded bg-indigo-600 opacity-40 border border-indigo-500"></div>
                   <span className="absolute -top-1 -right-1 text-[8px]">🔒</span>
                </div>
                <span>Inherited (Read-only)</span>
              </div>
            </div>
            
            {isEditing && (
              <div role="status" className="mt-4 p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-md text-indigo-400 text-sm flex items-center gap-2 animate-pulse">
                <span>⚠️</span>
                <span>You are currently in edit mode. Changes will not be permanent until saved.</span>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

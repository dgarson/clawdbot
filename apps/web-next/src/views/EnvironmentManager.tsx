import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type EnvScope = "global" | "agent" | "workspace";
type EnvType = "string" | "secret" | "boolean" | "number" | "url";

interface EnvVar {
  id: string;
  key: string;
  value: string;
  type: EnvType;
  scope: EnvScope;
  agentId?: string;      // if scope === "agent"
  description?: string;
  required: boolean;
  isSystem: boolean;     // set by OpenClaw, read-only
  createdAt: Date;
  updatedAt: Date;
}

interface Agent {
  id: string;
  name: string;
  emoji: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const days = (n: number) => n * 86_400_000;
const hrs = (n: number) => n * 3_600_000;

const AGENTS: Agent[] = [
  { id: "luis",    name: "Luis",    emoji: "🎨" },
  { id: "xavier",  name: "Xavier",  emoji: "🏗️" },
  { id: "stephan", name: "Stephan", emoji: "📣" },
  { id: "piper",   name: "Piper",   emoji: "🖌️" },
  { id: "tim",     name: "Tim",     emoji: "⚙️" },
];

const SEED_VARS: EnvVar[] = [
  // Global — system
  {
    id: "v1", key: "OPENCLAW_GATEWAY_URL", value: "ws://127.0.0.1:9090",
    type: "url", scope: "global", description: "Gateway WebSocket URL", required: true, isSystem: true,
    createdAt: ago(days(30)), updatedAt: ago(days(30)),
  },
  {
    id: "v2", key: "OPENCLAW_ENV", value: "development",
    type: "string", scope: "global", description: "Deployment environment (development/staging/production)", required: true, isSystem: true,
    createdAt: ago(days(30)), updatedAt: ago(days(10)),
  },
  {
    id: "v3", key: "OPENCLAW_DEBUG", value: "false",
    type: "boolean", scope: "global", description: "Enable verbose debug logging across all agents", required: false, isSystem: true,
    createdAt: ago(days(30)), updatedAt: ago(days(5)),
  },
  {
    id: "v4", key: "ANTHROPIC_API_KEY", value: "sk-ant-api03-••••••••••••••••••••••••••••••••••••••••••••",
    type: "secret", scope: "global", description: "Anthropic API key for Claude models", required: true, isSystem: false,
    createdAt: ago(days(25)), updatedAt: ago(days(2)),
  },
  {
    id: "v5", key: "OPENAI_API_KEY", value: "sk-proj-••••••••••••••••••••••••••••••••••••••••••••••••••••",
    type: "secret", scope: "global", description: "OpenAI API key for GPT, TTS, and embeddings", required: false, isSystem: false,
    createdAt: ago(days(20)), updatedAt: ago(days(2)),
  },
  {
    id: "v6", key: "SLACK_BOT_TOKEN", value: "xoxb-••••••••••••••••••••••••••••••••••••••••••••••••••••••",
    type: "secret", scope: "global", description: "Slack bot OAuth token for message delivery", required: false, isSystem: false,
    createdAt: ago(days(15)), updatedAt: ago(days(1)),
  },
  {
    id: "v7", key: "GITHUB_TOKEN", value: "ghp_••••••••••••••••••••••••••••••••••",
    type: "secret", scope: "global", description: "GitHub personal access token for repo operations", required: false, isSystem: false,
    createdAt: ago(days(20)), updatedAt: ago(days(3)),
  },
  {
    id: "v8", key: "DAILY_TOKEN_BUDGET", value: "500000",
    type: "number", scope: "global", description: "Max tokens per day across all agents (0 = unlimited)", required: false, isSystem: false,
    createdAt: ago(days(10)), updatedAt: ago(days(1)),
  },
  // Global — user-defined
  {
    id: "v9", key: "REPORT_RECIPIENT_EMAIL", value: "david@openclaw.dev",
    type: "string", scope: "global", description: "Email address for automated reports", required: false, isSystem: false,
    createdAt: ago(days(8)), updatedAt: ago(days(8)),
  },
  {
    id: "v10", key: "WORKSPACE_BASE_PATH", value: "/Users/openclaw/.openclaw/workspace",
    type: "string", scope: "global", description: "Base path for agent workspaces", required: true, isSystem: true,
    createdAt: ago(days(30)), updatedAt: ago(days(30)),
  },
  // Agent-scoped
  {
    id: "v11", key: "UX_SPRINT_DEADLINE", value: "2026-02-22T07:30:00-07:00",
    type: "string", scope: "agent", agentId: "luis", description: "Sprint deadline for Luis UX work", required: false, isSystem: false,
    createdAt: ago(days(1)), updatedAt: ago(hrs(6)),
  },
  {
    id: "v12", key: "GITHUB_REPO", value: "dgarson/clawdbot",
    type: "string", scope: "agent", agentId: "luis", description: "Primary GitHub repo for Luis's work", required: false, isSystem: false,
    createdAt: ago(days(5)), updatedAt: ago(days(2)),
  },
  {
    id: "v13", key: "SLACK_CHANNEL", value: "cb-activity",
    type: "string", scope: "agent", agentId: "stephan", description: "Primary Slack channel for Stephan's posts", required: false, isSystem: false,
    createdAt: ago(days(3)), updatedAt: ago(days(3)),
  },
  {
    id: "v14", key: "BRAND_VOICE", value: "confident, warm, approachable",
    type: "string", scope: "agent", agentId: "stephan", description: "Brand voice guidelines for content generation", required: false, isSystem: false,
    createdAt: ago(days(10)), updatedAt: ago(days(10)),
  },
  {
    id: "v15", key: "MAX_CONCURRENT_SESSIONS", value: "5",
    type: "number", scope: "agent", agentId: "xavier", description: "Maximum concurrent sub-agent sessions Xavier can spawn", required: false, isSystem: false,
    createdAt: ago(days(7)), updatedAt: ago(days(7)),
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<EnvType, { label: string; color: string; badge: string }> = {
  string:  { label: "String",  color: "text-[var(--color-text-secondary)]",    badge: "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]" },
  secret:  { label: "Secret",  color: "text-amber-400",   badge: "bg-amber-500/10 text-amber-400 border border-amber-500/20" },
  boolean: { label: "Boolean", color: "text-primary",  badge: "bg-primary/10 text-primary border border-primary/20" },
  number:  { label: "Number",  color: "text-emerald-400", badge: "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" },
  url:     { label: "URL",     color: "text-primary",  badge: "bg-primary/10 text-primary border border-primary/20" },
};

const SCOPE_CONFIG: Record<EnvScope, { label: string; color: string }> = {
  global:    { label: "Global",    color: "text-[var(--color-text-secondary)]" },
  agent:     { label: "Agent",     color: "text-primary" },
  workspace: { label: "Workspace", color: "text-emerald-400" },
};

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  envVar: EnvVar;
  onSave: (updated: EnvVar) => void;
  onClose: () => void;
}

function EditModal({ envVar, onSave, onClose }: EditModalProps) {
  const [value, setValue] = useState(envVar.type === "secret" ? "" : envVar.value);
  const [description, setDescription] = useState(envVar.description ?? "");

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") {onClose();} };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = () => {
    onSave({ ...envVar, value: envVar.type === "secret" && !value ? envVar.value : value, description, updatedAt: new Date() });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="env-modal-title">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-lg bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--color-border)]">
          <div>
            <h2 id="env-modal-title" className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">{envVar.key}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn("text-xs font-mono px-1.5 py-0.5 rounded", TYPE_CONFIG[envVar.type].badge)}>{TYPE_CONFIG[envVar.type].label}</span>
              <span className={cn("text-xs", SCOPE_CONFIG[envVar.scope].color)}>{SCOPE_CONFIG[envVar.scope].label}</span>
              {envVar.isSystem && <span className="text-xs text-rose-400">System — read-only</span>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1.5 rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div>
            <label htmlFor="env-value" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">
              Value {envVar.type === "secret" && <span className="text-[var(--color-text-muted)]">(leave blank to keep current)</span>}
            </label>
            {envVar.type === "boolean" ? (
              <div className="flex gap-3">
                {["true", "false"].map((v) => (
                  <button
                    key={v}
                    onClick={() => setValue(v)}
                    aria-pressed={value === v}
                    className={cn(
                      "flex-1 py-2 text-sm font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                      value === v ? "bg-primary border-primary text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-secondary)]"
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
            ) : (
              <input
                id="env-value"
                type={envVar.type === "secret" ? "password" : "text"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={envVar.isSystem}
                placeholder={envVar.type === "secret" ? "Enter new value to change…" : envVar.value}
                className={cn(
                  "w-full px-3 py-2 text-sm border rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                  envVar.isSystem ? "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed" : "bg-[var(--color-surface-0)] border-[var(--color-border)] text-[var(--color-text-primary)]"
                )}
              />
            )}
          </div>
          <div>
            <label htmlFor="env-desc" className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5">Description</label>
            <input
              id="env-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={envVar.isSystem}
              className={cn(
                "w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent",
                envVar.isSystem ? "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed" : "bg-[var(--color-surface-0)] border-[var(--color-border)] text-[var(--color-text-primary)]"
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
            <div>
              <p className="text-[var(--color-text-muted)]">Created</p>
              <p className="mt-0.5 text-[var(--color-text-secondary)]">{relTime(envVar.createdAt)}</p>
            </div>
            <div>
              <p className="text-[var(--color-text-muted)]">Last updated</p>
              <p className="mt-0.5 text-[var(--color-text-secondary)]">{relTime(envVar.updatedAt)}</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-[var(--color-border)]">
          {!envVar.isSystem ? (
            <button onClick={handleSave} className="flex-1 py-2 text-sm font-medium rounded-lg bg-primary text-[var(--color-text-primary)] hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
              Save Changes
            </button>
          ) : (
            <div className="flex-1 py-2 text-sm text-center text-[var(--color-text-muted)]">System variable — cannot be edited</div>
          )}
          <button onClick={onClose} className="py-2 px-4 text-sm font-medium rounded-lg bg-[var(--color-surface-2)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Env Row ──────────────────────────────────────────────────────────────────

interface EnvRowProps {
  envVar: EnvVar;
  agents: Agent[];
  onEdit: () => void;
  onDelete: () => void;
}

function EnvRow({ envVar, agents, onEdit, onDelete }: EnvRowProps) {
  const [revealed, setRevealed] = useState(false);
  const typeCfg = TYPE_CONFIG[envVar.type];
  const displayValue = envVar.type === "secret" && !revealed
    ? envVar.value
    : envVar.value;
  const agent = envVar.agentId ? agents.find((a) => a.id === envVar.agentId) : null;

  return (
    <div className="flex items-start gap-3 px-5 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)]/50 group transition-colors">
      {/* Key + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-mono font-semibold", envVar.isSystem ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-primary)]")}>{envVar.key}</span>
          <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", typeCfg.badge)}>{typeCfg.label}</span>
          {envVar.required && <span className="text-xs text-rose-400">Required</span>}
          {envVar.isSystem && <span className="text-xs text-[var(--color-text-muted)]">System</span>}
          {agent && (
            <span className="flex items-center gap-1 text-xs text-primary">
              {agent.emoji} {agent.name}
            </span>
          )}
        </div>
        {envVar.description && <p className="text-xs text-[var(--color-text-muted)] mt-0.5 truncate">{envVar.description}</p>}
        <div className="flex items-center gap-2 mt-1">
          <span className={cn("text-xs font-mono truncate max-w-xs", envVar.type === "secret" && !revealed ? "text-[var(--color-text-muted)]" : "text-[var(--color-text-secondary)]")}>
            {displayValue}
          </span>
          {envVar.type === "secret" && (
            <button
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide value" : "Reveal value"}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded"
            >
              {revealed ? "hide" : "reveal"}
            </button>
          )}
        </div>
      </div>

      {/* Updated + actions */}
      <div className="flex-none flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)] hidden sm:block">{relTime(envVar.updatedAt)}</span>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onEdit}
            aria-label={`Edit ${envVar.key}`}
            className="p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10 2l2 2-7 7H3V9l7-7z" /></svg>
          </button>
          {!envVar.isSystem && (
            <button
              onClick={onDelete}
              aria-label={`Delete ${envVar.key}`}
              className="p-1.5 text-[var(--color-text-muted)] hover:text-rose-400 hover:bg-rose-500/10 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2 4h10M5 4V2h4v2M5 4v7h4V4" /></svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type ScopeFilter = EnvScope | "all";
type TypeFilter = EnvType | "all";

export default function EnvironmentManager() {
  const [vars, setVars] = useState<EnvVar[]>(SEED_VARS);
  const [search, setSearch] = useState("");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showSecrets, setShowSecrets] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const filtered = vars.filter((v) => {
    if (scopeFilter !== "all" && v.scope !== scopeFilter) {return false;}
    if (typeFilter !== "all" && v.type !== typeFilter) {return false;}
    if (agentFilter !== "all") {
      if (agentFilter === "global" && v.scope !== "global") {return false;}
      if (agentFilter !== "global" && v.agentId !== agentFilter) {return false;}
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      return v.key.toLowerCase().includes(q) || (v.description?.toLowerCase().includes(q) ?? false);
    }
    return true;
  });

  const handleSave = useCallback((updated: EnvVar) => {
    setVars((prev) => prev.map((v) => v.id === updated.id ? updated : v));
  }, []);

  const handleDelete = useCallback((id: string) => {
    setVars((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const editingVar = editingId ? vars.find((v) => v.id === editingId) ?? null : null;

  const stats = {
    total: vars.length,
    secrets: vars.filter((v) => v.type === "secret").length,
    system: vars.filter((v) => v.isSystem).length,
    required: vars.filter((v) => v.required).length,
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Environment Variables</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Manage secrets, config, and per-agent settings</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSecrets((v) => !v)}
              aria-pressed={showSecrets}
              aria-label={showSecrets ? "Hide all secrets" : "Show all secrets"}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                showSecrets ? "bg-amber-600/20 text-amber-300 border-amber-500/30" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
              )}
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
                {showSecrets ? <><path strokeLinecap="round" d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" /><circle cx="7" cy="7" r="1.5" /></> : <><path strokeLinecap="round" d="M1 1l12 12M5.5 5.5A2.5 2.5 0 019.5 9.5" /><path strokeLinecap="round" d="M2.5 7s1.5-3 4.5-3M8 4.5C10 5 11.5 7 11.5 7s-.5 1-1.5 2" /></>}
              </svg>
              {showSecrets ? "Hide Secrets" : "Show Secrets"}
            </button>
            <button
              aria-label="Add new environment variable"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary text-[var(--color-text-primary)] hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M7 2v10M2 7h10" /></svg>
              New Variable
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
          <span><span className="text-[var(--color-text-primary)] font-semibold">{stats.total}</span> variables</span>
          <span><span className="text-amber-400 font-semibold">{stats.secrets}</span> secrets</span>
          <span><span className="text-[var(--color-text-muted)] font-semibold">{stats.system}</span> system</span>
          <span><span className="text-rose-400 font-semibold">{stats.required}</span> required</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search variables… (⌘F)"
            aria-label="Search environment variables"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <select value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value as ScopeFilter)} aria-label="Filter by scope" className="py-1.5 pl-2 pr-6 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
          <option value="all">All Scopes</option>
          <option value="global">Global</option>
          <option value="agent">Agent</option>
          <option value="workspace">Workspace</option>
        </select>

        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as TypeFilter)} aria-label="Filter by type" className="py-1.5 pl-2 pr-6 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
          <option value="all">All Types</option>
          <option value="string">String</option>
          <option value="secret">Secret</option>
          <option value="boolean">Boolean</option>
          <option value="number">Number</option>
          <option value="url">URL</option>
        </select>

        <select value={agentFilter} onChange={(e) => setAgentFilter(e.target.value)} aria-label="Filter by agent" className="py-1.5 pl-2 pr-6 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none">
          <option value="all">All Agents</option>
          <option value="global">Global only</option>
          {AGENTS.map((a) => <option key={a.id} value={a.id}>{a.emoji} {a.name}</option>)}
        </select>

        {(search || scopeFilter !== "all" || typeFilter !== "all" || agentFilter !== "all") && (
          <button onClick={() => { setSearch(""); setScopeFilter("all"); setTypeFilter("all"); setAgentFilter("all"); }} aria-label="Clear filters" className="text-xs text-primary hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1">
            Clear
          </button>
        )}
      </div>

      {/* Column headers */}
      <div className="flex-none px-5 py-2 border-b border-[var(--color-border)] flex items-center gap-3">
        <span className="flex-1 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Key / Value</span>
        <span className="flex-none text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider hidden sm:block">Updated</span>
        <span className="flex-none w-16" />
      </div>

      {/* Variable list */}
      <div className="flex-1 overflow-y-auto" role="list" aria-label="Environment variables">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="text-4xl">🔑</span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No variables found</p>
            <p className="text-xs text-[var(--color-text-muted)]">Try adjusting your filters</p>
          </div>
        ) : (
          filtered.map((v) => (
            <EnvRow
              key={v.id}
              envVar={showSecrets ? v : { ...v, value: v.type === "secret" ? v.value : v.value }}
              agents={AGENTS}
              onEdit={() => setEditingId(v.id)}
              onDelete={() => handleDelete(v.id)}
            />
          ))
        )}
      </div>

      {/* Edit Modal */}
      {editingVar && (
        <EditModal envVar={editingVar} onSave={handleSave} onClose={() => setEditingId(null)} />
      )}
    </div>
  );
}

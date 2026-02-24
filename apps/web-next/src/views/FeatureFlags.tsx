import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type FlagType = "boolean" | "string" | "number" | "percentage";
type FlagEnv = "all" | "dev" | "staging" | "production";

interface FlagOverride {
  agentId: string;
  agentName: string;
  agentEmoji: string;
  value: boolean | string | number;
}

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  type: FlagType;
  defaultValue: boolean | string | number;
  enabled: boolean;
  envOverrides: Record<string, boolean | string | number>; // env → value
  agentOverrides: FlagOverride[];
  rolloutPercent?: number;  // for percentage type
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  isExperimental: boolean;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const days = (n: number) => n * 86_400_000;
const hrs = (n: number) => n * 3_600_000;

const SEED_FLAGS: FeatureFlag[] = [
  {
    id: "f1",
    key: "horizon_ui_enabled",
    name: "Horizon UI",
    description: "Enable the new Horizon React UI (replaces Lit SPA)",
    type: "boolean",
    defaultValue: true,
    enabled: true,
    envOverrides: { production: false },
    agentOverrides: [],
    tags: ["ui", "horizon", "frontend"],
    createdAt: ago(days(5)),
    updatedAt: ago(hrs(6)),
    isExperimental: false,
  },
  {
    id: "f2",
    key: "voice_interface_enabled",
    name: "Voice Interface",
    description: "Enable the voice call feature for direct agent communication",
    type: "boolean",
    defaultValue: false,
    enabled: true,
    envOverrides: { dev: true },
    agentOverrides: [
      { agentId: "luis", agentName: "Luis", agentEmoji: "🎨", value: true },
    ],
    tags: ["voice", "experimental"],
    createdAt: ago(days(2)),
    updatedAt: ago(hrs(2)),
    isExperimental: true,
  },
  {
    id: "f3",
    key: "adaptive_ux_level",
    name: "Adaptive UX System",
    description: "Progressive feature revelation based on proficiency level",
    type: "boolean",
    defaultValue: true,
    enabled: true,
    envOverrides: {},
    agentOverrides: [],
    tags: ["ux", "proficiency", "adaptive"],
    createdAt: ago(days(10)),
    updatedAt: ago(days(1)),
    isExperimental: false,
  },
  {
    id: "f4",
    key: "max_concurrent_sessions",
    name: "Max Concurrent Sessions",
    description: "Maximum number of simultaneous active sessions per agent",
    type: "number",
    defaultValue: 5,
    enabled: true,
    envOverrides: { production: 3 },
    agentOverrides: [
      { agentId: "xavier", agentName: "Xavier", agentEmoji: "🏗️", value: 10 },
    ],
    tags: ["sessions", "limits"],
    createdAt: ago(days(15)),
    updatedAt: ago(days(3)),
    isExperimental: false,
  },
  {
    id: "f5",
    key: "beta_model_access",
    name: "Beta Model Access",
    description: "Allow access to preview/beta AI models before general availability",
    type: "percentage",
    defaultValue: false,
    enabled: true,
    envOverrides: { dev: true },
    agentOverrides: [],
    rolloutPercent: 10,
    tags: ["models", "beta", "experimental"],
    createdAt: ago(days(3)),
    updatedAt: ago(hrs(12)),
    isExperimental: true,
  },
  {
    id: "f6",
    key: "debug_mode",
    name: "Debug Mode",
    description: "Enable verbose logging, inspector tools, and raw API responses",
    type: "boolean",
    defaultValue: false,
    enabled: false,
    envOverrides: { dev: true, staging: true },
    agentOverrides: [],
    tags: ["debug", "development"],
    createdAt: ago(days(20)),
    updatedAt: ago(days(2)),
    isExperimental: false,
  },
  {
    id: "f7",
    key: "agent_greeting_style",
    name: "Agent Greeting Style",
    description: "Default greeting format when agents start sessions",
    type: "string",
    defaultValue: "brief",
    enabled: true,
    envOverrides: {},
    agentOverrides: [
      { agentId: "stephan", agentName: "Stephan", agentEmoji: "📣", value: "warm" },
    ],
    tags: ["agents", "personality"],
    createdAt: ago(days(8)),
    updatedAt: ago(days(8)),
    isExperimental: false,
  },
  {
    id: "f8",
    key: "session_branching",
    name: "Session Branching",
    description: "Allow users to branch sessions at any point for A/B exploration",
    type: "boolean",
    defaultValue: false,
    enabled: true,
    envOverrides: { dev: true },
    agentOverrides: [],
    tags: ["sessions", "experimental"],
    createdAt: ago(days(7)),
    updatedAt: ago(days(1)),
    isExperimental: true,
  },
  {
    id: "f9",
    key: "token_budget_warning_threshold",
    name: "Budget Warning Threshold",
    description: "Percentage at which to trigger token budget warnings",
    type: "number",
    defaultValue: 80,
    enabled: true,
    envOverrides: {},
    agentOverrides: [],
    tags: ["billing", "alerts"],
    createdAt: ago(days(12)),
    updatedAt: ago(days(4)),
    isExperimental: false,
  },
  {
    id: "f10",
    key: "multi_agent_orchestration",
    name: "Multi-Agent Orchestration",
    description: "Enable visual workflow builder for chaining multiple agents",
    type: "boolean",
    defaultValue: false,
    enabled: false,
    envOverrides: {},
    agentOverrides: [],
    tags: ["orchestration", "experimental", "roadmap"],
    createdAt: ago(days(1)),
    updatedAt: ago(hrs(1)),
    isExperimental: true,
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<FlagType, { label: string; color: string }> = {
  boolean:    { label: "Boolean",    color: "text-indigo-400" },
  string:     { label: "String",     color: "text-[var(--color-text-secondary)]" },
  number:     { label: "Number",     color: "text-emerald-400" },
  percentage: { label: "Rollout %",  color: "text-violet-400" },
};

const ENV_LABELS: Record<FlagEnv, string> = {
  all: "All Environments",
  dev: "Development",
  staging: "Staging",
  production: "Production",
};

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 3_600_000) {return `${Math.floor(diff / 60_000)}m ago`;}
  if (diff < 86_400_000) {return `${Math.floor(diff / 3_600_000)}h ago`;}
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Flag Card ────────────────────────────────────────────────────────────────

interface FlagCardProps {
  flag: FeatureFlag;
  onToggle: (id: string) => void;
  onRolloutChange: (id: string, pct: number) => void;
}

function FlagCard({ flag, onToggle, onRolloutChange }: FlagCardProps) {
  const [expanded, setExpanded] = useState(false);
  const typeCfg = TYPE_CONFIG[flag.type];

  const displayValue = (val: boolean | string | number): string => {
    if (typeof val === "boolean") {return val ? "true" : "false";}
    return String(val);
  };

  return (
    <div className={cn(
      "rounded-xl border transition-colors",
      flag.enabled ? "bg-[var(--color-surface-1)] border-[var(--color-border)]" : "bg-[var(--color-surface-1)]/50 border-[var(--color-border)] opacity-70"
    )}>
      {/* Header row */}
      <div className="flex items-start gap-3 p-4">
        {/* Toggle */}
        <button
          onClick={() => onToggle(flag.id)}
          role="switch"
          aria-checked={flag.enabled}
          aria-label={`${flag.enabled ? "Disable" : "Enable"} ${flag.name}`}
          className={cn(
            "flex-none mt-0.5 relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-900",
            flag.enabled ? "bg-indigo-600" : "bg-[var(--color-surface-3)]"
          )}
        >
          <span className={cn(
            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm",
            flag.enabled ? "translate-x-4" : "translate-x-0.5"
          )} />
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">{flag.name}</span>
            {flag.isExperimental && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25">Experimental</span>
            )}
            <span className={cn("text-xs", typeCfg.color)}>{typeCfg.label}</span>
          </div>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{flag.description}</p>
          <p className="text-xs font-mono text-[var(--color-text-muted)] mt-0.5">{flag.key}</p>
        </div>

        {/* Value + expand */}
        <div className="flex-none flex items-center gap-2">
          <div className="text-right">
            <p className={cn("text-xs font-mono font-semibold", flag.enabled ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>
              {flag.type === "percentage" ? `${flag.rolloutPercent ?? 0}%` : displayValue(flag.defaultValue)}
            </p>
            <p className="text-xs text-[var(--color-text-muted)]">default</p>
          </div>
          <button
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            aria-label={`${expanded ? "Collapse" : "Expand"} ${flag.name} details`}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded transition-colors"
          >
            <svg className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6l4 4 4-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tags */}
      <div className="px-4 pb-3 flex flex-wrap gap-1">
        {flag.tags.map((t) => (
          <span key={t} className="px-1.5 py-0.5 text-xs rounded bg-[var(--color-surface-2)] text-[var(--color-text-muted)] border border-[var(--color-border)]/50">{t}</span>
        ))}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t border-[var(--color-border)]">
          <div className="pt-3 space-y-3">
            {/* Rollout slider */}
            {flag.type === "percentage" && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`rollout-${flag.id}`} className="text-xs text-[var(--color-text-muted)]">Rollout Percentage</label>
                  <span className="text-xs font-mono font-semibold text-violet-400">{flag.rolloutPercent ?? 0}%</span>
                </div>
                <input
                  id={`rollout-${flag.id}`}
                  type="range"
                  min={0}
                  max={100}
                  value={flag.rolloutPercent ?? 0}
                  onChange={(e) => onRolloutChange(flag.id, Number(e.target.value))}
                  className="w-full accent-violet-500"
                />
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-0.5">
                  <span>0% (off)</span>
                  <span>50%</span>
                  <span>100% (all)</span>
                </div>
              </div>
            )}

            {/* Environment overrides */}
            {Object.keys(flag.envOverrides).length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Environment Overrides</p>
                <div className="space-y-1">
                  {Object.entries(flag.envOverrides).map(([env, val]) => (
                    <div key={env} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border)]">
                      <span className="text-xs text-[var(--color-text-secondary)] capitalize">{env}</span>
                      <span className={cn("text-xs font-mono font-semibold", typeof val === "boolean" ? (val ? "text-emerald-400" : "text-rose-400") : "text-[var(--color-text-primary)]")}>
                        {displayValue(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Agent overrides */}
            {flag.agentOverrides.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-[var(--color-text-muted)] mb-2">Agent Overrides</p>
                <div className="space-y-1">
                  {flag.agentOverrides.map((override) => (
                    <div key={override.agentId} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-[var(--color-surface-0)] border border-[var(--color-border)]">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{override.agentEmoji}</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{override.agentName}</span>
                      </div>
                      <span className={cn("text-xs font-mono font-semibold", typeof override.value === "boolean" ? (override.value ? "text-emerald-400" : "text-rose-400") : "text-[var(--color-text-primary)]")}>
                        {displayValue(override.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Meta */}
            <div className="grid grid-cols-2 gap-3 text-xs text-[var(--color-text-muted)]">
              <div>
                <p className="text-[var(--color-text-muted)]">Created</p>
                <p className="mt-0.5 text-[var(--color-text-secondary)]">{relTime(flag.createdAt)}</p>
              </div>
              <div>
                <p className="text-[var(--color-text-muted)]">Updated</p>
                <p className="mt-0.5 text-[var(--color-text-secondary)]">{relTime(flag.updatedAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main View ────────────────────────────────────────────────────────────────

type FilterMode = "all" | "enabled" | "disabled" | "experimental";

export default function FeatureFlags() {
  const [flags, setFlags] = useState<FeatureFlag[]>(SEED_FLAGS);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FilterMode>("all");
  const [envFilter, setEnvFilter] = useState<FlagEnv>("all");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "f") { e.preventDefault(); searchRef.current?.focus(); }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const handleToggle = useCallback((id: string) => {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, enabled: !f.enabled, updatedAt: new Date() } : f));
  }, []);

  const handleRolloutChange = useCallback((id: string, pct: number) => {
    setFlags((prev) => prev.map((f) => f.id === id ? { ...f, rolloutPercent: pct, updatedAt: new Date() } : f));
  }, []);

  const filtered = flags.filter((f) => {
    if (filterMode === "enabled" && !f.enabled) {return false;}
    if (filterMode === "disabled" && f.enabled) {return false;}
    if (filterMode === "experimental" && !f.isExperimental) {return false;}
    if (search.trim()) {
      const q = search.toLowerCase();
      return f.key.toLowerCase().includes(q) || f.name.toLowerCase().includes(q) || f.description.toLowerCase().includes(q) || f.tags.some((t) => t.includes(q));
    }
    return true;
  });

  const stats = {
    total: flags.length,
    enabled: flags.filter((f) => f.enabled).length,
    experimental: flags.filter((f) => f.isExperimental).length,
  };

  const FILTERS: { id: FilterMode; label: string; count: number }[] = [
    { id: "all",          label: "All",          count: flags.length },
    { id: "enabled",      label: "Enabled",      count: stats.enabled },
    { id: "disabled",     label: "Disabled",     count: flags.length - stats.enabled },
    { id: "experimental", label: "Experimental", count: stats.experimental },
  ];

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Feature Flags</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Toggle features, manage rollouts, and configure per-environment or per-agent overrides</p>
          </div>
          <button aria-label="Create new feature flag" className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-[var(--color-text-primary)] hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors">
            <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" d="M7 2v10M2 7h10" /></svg>
            New Flag
          </button>
        </div>
        <div className="flex items-center gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
          <span><span className="text-[var(--color-text-primary)] font-semibold">{stats.total}</span> flags</span>
          <span><span className="text-emerald-400 font-semibold">{stats.enabled}</span> enabled</span>
          <span><span className="text-[var(--color-text-muted)] font-semibold">{flags.length - stats.enabled}</span> disabled</span>
          <span><span className="text-amber-400 font-semibold">{stats.experimental}</span> experimental</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-none px-6 py-3 border-b border-[var(--color-border)] flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)] pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input ref={searchRef} type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search flags… (⌘F)" aria-label="Search feature flags" className="w-full pl-8 pr-3 py-1.5 text-sm bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-indigo-500" />
        </div>
        <div role="group" aria-label="Filter flags" className="flex items-center gap-1">
          {FILTERS.map(({ id, label, count }) => (
            <button
              key={id}
              onClick={() => setFilterMode(id)}
              aria-pressed={filterMode === id}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500",
                filterMode === id ? "bg-indigo-600 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {label} <span className={cn("ml-1 tabular-nums", filterMode === id ? "opacity-80" : "text-[var(--color-text-muted)]")}>{count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Flag list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="text-4xl">🚩</span>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">No flags found</p>
          </div>
        ) : (
          filtered.map((flag) => (
            <FlagCard key={flag.id} flag={flag} onToggle={handleToggle} onRolloutChange={handleRolloutChange} />
          ))
        )}
      </div>
    </div>
  );
}

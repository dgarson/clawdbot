import React, { useState } from "react";
import { cn } from "../lib/utils";

type ConfigEnv = "development" | "staging" | "production" | "dr";
type SecretType = "string" | "json" | "url" | "boolean" | "number";
type ConfigStatus = "synced" | "pending" | "error" | "drift";
type DeployTarget = "kubernetes" | "lambda" | "ecs" | "vm";

interface ConfigVar {
  id: string;
  key: string;
  value: string;
  type: SecretType;
  isSecret: boolean;
  description: string;
  service: string;
  env: ConfigEnv;
  lastModified: string;
  modifiedBy: string;
  version: number;
}

interface EnvSnapshot {
  env: ConfigEnv;
  status: ConfigStatus;
  varCount: number;
  secretCount: number;
  lastSync: string;
  pendingChanges: number;
  deployTarget: DeployTarget;
}

interface ConfigDiff {
  key: string;
  env1Value: string;
  env2Value: string;
  match: boolean;
}

interface ChangeEvent {
  id: string;
  key: string;
  env: ConfigEnv;
  action: "created" | "updated" | "deleted" | "promoted";
  author: string;
  timestamp: string;
  fromValue: string;
  toValue: string;
  service: string;
}

const envColor: Record<ConfigEnv, string> = {
  development: "text-indigo-400",
  staging:     "text-amber-400",
  production:  "text-rose-400",
  dr:          "text-purple-400",
};

const envBadge: Record<ConfigEnv, string> = {
  development: "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
  staging:     "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  production:  "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  dr:          "bg-purple-500/20 text-purple-300 border border-purple-500/30",
};

const statusBadge: Record<ConfigStatus, string> = {
  synced:  "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  pending: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  error:   "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  drift:   "bg-orange-500/20 text-orange-300 border border-orange-500/30",
};

const typeIcon: Record<SecretType, string> = {
  string:  "📝",
  json:    "🔧",
  url:     "🔗",
  boolean: "⚡",
  number:  "🔢",
};

const targetIcon: Record<DeployTarget, string> = {
  kubernetes: "☸️",
  lambda:     "λ",
  ecs:        "🐳",
  vm:         "🖥️",
};

const ENV_SNAPSHOTS: EnvSnapshot[] = [
  { env: "development", status: "synced", varCount: 42, secretCount: 12, lastSync: "2m ago", pendingChanges: 0, deployTarget: "kubernetes" },
  { env: "staging", status: "pending", varCount: 44, secretCount: 12, lastSync: "15m ago", pendingChanges: 3, deployTarget: "kubernetes" },
  { env: "production", status: "synced", varCount: 44, secretCount: 14, lastSync: "1m ago", pendingChanges: 0, deployTarget: "kubernetes" },
  { env: "dr", status: "drift", varCount: 38, secretCount: 10, lastSync: "2h ago", pendingChanges: 6, deployTarget: "ecs" },
];

const CONFIG_VARS: ConfigVar[] = [
  { id: "cv-01", key: "DATABASE_URL", value: "postgres://***@prod-db.internal:5432/clawdbot", type: "url", isSecret: true, description: "Primary database connection string", service: "api", env: "production", lastModified: "2026-02-20", modifiedBy: "tim", version: 5 },
  { id: "cv-02", key: "JWT_SECRET", value: "***", type: "string", isSecret: true, description: "JWT signing secret", service: "auth-service", env: "production", lastModified: "2026-02-18", modifiedBy: "tim", version: 3 },
  { id: "cv-03", key: "REDIS_URL", value: "redis://prod-redis.internal:6379", type: "url", isSecret: false, description: "Redis cache connection", service: "api", env: "production", lastModified: "2026-02-15", modifiedBy: "sam", version: 2 },
  { id: "cv-04", key: "AI_PROVIDER_API_KEY", value: "***", type: "string", isSecret: true, description: "Anthropic API key for AI features", service: "ai-service", env: "production", lastModified: "2026-02-22", modifiedBy: "xavier", version: 7 },
  { id: "cv-05", key: "LOG_LEVEL", value: "warn", type: "string", isSecret: false, description: "Application log verbosity", service: "api", env: "production", lastModified: "2026-02-01", modifiedBy: "quinn", version: 4 },
  { id: "cv-06", key: "MAX_CONNECTIONS", value: "100", type: "number", isSecret: false, description: "Max DB pool connections", service: "api", env: "production", lastModified: "2026-02-10", modifiedBy: "tim", version: 2 },
  { id: "cv-07", key: "FEATURE_FLAGS_JSON", value: '{"session_replay":true,"ai_completions":false}', type: "json", isSecret: false, description: "Feature flag overrides", service: "api", env: "production", lastModified: "2026-02-22", modifiedBy: "piper", version: 12 },
  { id: "cv-08", key: "SMTP_HOST", value: "smtp.sendgrid.net", type: "string", isSecret: false, description: "Email delivery host", service: "notification-service", env: "production", lastModified: "2026-02-05", modifiedBy: "sam", version: 1 },
  { id: "cv-09", key: "ENABLE_RATE_LIMITING", value: "true", type: "boolean", isSecret: false, description: "Toggle global rate limiting", service: "api-gateway", env: "production", lastModified: "2026-02-12", modifiedBy: "tim", version: 3 },
  { id: "cv-10", key: "S3_BUCKET_NAME", value: "clawdbot-prod-assets", type: "string", isSecret: false, description: "Primary S3 bucket for file storage", service: "storage-service", env: "production", lastModified: "2026-01-15", modifiedBy: "wes", version: 1 },
  { id: "cv-11", key: "DATABASE_URL", value: "postgres://***@staging-db.internal:5432/clawdbot", type: "url", isSecret: true, description: "Staging database connection string", service: "api", env: "staging", lastModified: "2026-02-20", modifiedBy: "tim", version: 5 },
  { id: "cv-12", key: "LOG_LEVEL", value: "debug", type: "string", isSecret: false, description: "Application log verbosity", service: "api", env: "staging", lastModified: "2026-02-01", modifiedBy: "quinn", version: 4 },
];

const CONFIG_DIFF: ConfigDiff[] = [
  { key: "LOG_LEVEL", env1Value: "debug", env2Value: "warn", match: false },
  { key: "DATABASE_URL", env1Value: "postgres://***@staging-db.internal", env2Value: "postgres://***@prod-db.internal", match: false },
  { key: "REDIS_URL", env1Value: "redis://staging-redis.internal:6379", env2Value: "redis://prod-redis.internal:6379", match: false },
  { key: "AI_PROVIDER_API_KEY", env1Value: "***", env2Value: "***", match: true },
  { key: "MAX_CONNECTIONS", env1Value: "50", env2Value: "100", match: false },
  { key: "FEATURE_FLAGS_JSON", env1Value: '{"session_replay":true,"ai_completions":true}', env2Value: '{"session_replay":true,"ai_completions":false}', match: false },
  { key: "ENABLE_RATE_LIMITING", env1Value: "true", env2Value: "true", match: true },
  { key: "S3_BUCKET_NAME", env1Value: "clawdbot-staging-assets", env2Value: "clawdbot-prod-assets", match: false },
];

const CHANGE_LOG: ChangeEvent[] = [
  { id: "cl-01", key: "AI_PROVIDER_API_KEY", env: "production", action: "updated", author: "xavier", timestamp: "2026-02-22 10:15", fromValue: "***", toValue: "***", service: "ai-service" },
  { id: "cl-02", key: "FEATURE_FLAGS_JSON", env: "production", action: "updated", author: "piper", timestamp: "2026-02-22 09:30", fromValue: '{"session_replay":false}', toValue: '{"session_replay":true}', service: "api" },
  { id: "cl-03", key: "FEATURE_FLAGS_JSON", env: "staging", action: "promoted", author: "tim", timestamp: "2026-02-22 09:00", fromValue: "", toValue: '{"session_replay":true,"ai_completions":true}', service: "api" },
  { id: "cl-04", key: "JWT_SECRET", env: "production", action: "updated", author: "tim", timestamp: "2026-02-18 14:00", fromValue: "***", toValue: "***", service: "auth-service" },
  { id: "cl-05", key: "WEBHOOK_SIGNING_SECRET", env: "production", action: "created", author: "sam", timestamp: "2026-02-16 11:45", fromValue: "", toValue: "***", service: "webhook-service" },
  { id: "cl-06", key: "LEGACY_AUTH_ENABLED", env: "staging", action: "deleted", author: "tim", timestamp: "2026-02-14 16:20", fromValue: "false", toValue: "", service: "auth-service" },
];

const actionBadge: Record<ChangeEvent["action"], string> = {
  created:  "bg-emerald-500/20 text-emerald-300",
  updated:  "bg-blue-500/20 text-blue-300",
  deleted:  "bg-rose-500/20 text-rose-300",
  promoted: "bg-indigo-500/20 text-indigo-300",
};

export default function EnvironmentConfigManager() {
  const [tab, setTab] = useState<"overview" | "vars" | "diff" | "history">("overview");
  const [selectedEnv, setSelectedEnv] = useState<ConfigEnv>("production");
  const [selectedVar, setSelectedVar] = useState<ConfigVar>(CONFIG_VARS.filter(v => v.env === "production")[0]);
  const [showSecrets, setShowSecrets] = useState(false);
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const envVars = CONFIG_VARS.filter(v => v.env === selectedEnv);
  const services = ["all", ...Array.from(new Set(CONFIG_VARS.map(v => v.service)))];
  const filteredVars = serviceFilter === "all" ? envVars : envVars.filter(v => v.service === serviceFilter);
  const matchCount = CONFIG_DIFF.filter(d => d.match).length;

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Environment Config Manager</h1>
          <p className="text-sm text-zinc-400 mt-0.5">Secrets · Variables · Drift Detection</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {ENV_SNAPSHOTS.map(s => (
              <span key={s.env} className={cn("flex items-center gap-1 text-xs px-2 py-0.5 rounded-full", statusBadge[s.status])}>
                <span className="capitalize">{s.env.slice(0, 4)}</span>
                {s.pendingChanges > 0 && <span className="font-bold">{s.pendingChanges}</span>}
              </span>
            ))}
          </div>
          <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded text-sm font-medium transition-colors">
            + Add Variable
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {(["overview", "vars", "diff", "history"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t === "vars" ? "Variables" : t === "diff" ? "Env Diff" : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 gap-4 mb-8">
            {ENV_SNAPSHOTS.map(snap => (
              <div key={snap.env} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{targetIcon[snap.deployTarget]}</span>
                    <span className={cn("text-sm font-semibold capitalize", envColor[snap.env])}>{snap.env}</span>
                  </div>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge[snap.status])}>{snap.status}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-white">{snap.varCount}</div>
                    <div className="text-xs text-zinc-500">variables</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold font-mono text-amber-400">{snap.secretCount}</div>
                    <div className="text-xs text-zinc-500">secrets</div>
                  </div>
                </div>
                <div className="text-xs text-zinc-500 text-center">Synced {snap.lastSync}</div>
                {snap.pendingChanges > 0 && (
                  <div className="mt-2 text-center text-xs text-amber-400 font-medium">
                    {snap.pendingChanges} pending change{snap.pendingChanges > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Recent activity */}
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Recent Changes</h2>
          <div className="space-y-2">
            {CHANGE_LOG.slice(0, 4).map(c => (
              <div key={c.id} className="bg-zinc-900 rounded-lg p-3 flex items-center gap-4">
                <span className={cn("text-xs px-2 py-0.5 rounded capitalize font-medium", actionBadge[c.action])}>{c.action}</span>
                <span className="font-mono text-sm text-white">{c.key}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded", envBadge[c.env])}>{c.env}</span>
                <span className="text-xs text-zinc-500">{c.service}</span>
                <span className="ml-auto text-xs text-zinc-500">by {c.author} · {c.timestamp}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variables Tab */}
      {tab === "vars" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar: env selector + list */}
          <div className="w-80 border-r border-zinc-800 flex flex-col">
            <div className="p-3 border-b border-zinc-800 space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                {(["development", "staging", "production", "dr"] as ConfigEnv[]).map(e => (
                  <button
                    key={e}
                    onClick={() => { setSelectedEnv(e); }}
                    className={cn(
                      "text-xs px-2 py-0.5 rounded border transition-colors capitalize",
                      selectedEnv === e ? envBadge[e] : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                    )}
                  >
                    {e.slice(0, 4)}
                  </button>
                ))}
              </div>
              <select
                value={serviceFilter}
                onChange={e => setServiceFilter(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white"
              >
                {services.map(s => <option key={s} value={s}>{s === "all" ? "All services" : s}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredVars.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVar(v)}
                  className={cn(
                    "w-full text-left px-4 py-2.5 border-b border-zinc-800/60 hover:bg-zinc-800/40 transition-colors",
                    selectedVar.id === v.id && "bg-zinc-800/60"
                  )}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs">{typeIcon[v.type]}</span>
                    <span className="font-mono text-xs font-medium text-white truncate">{v.key}</span>
                    {v.isSecret && <span className="ml-auto text-xs text-amber-400">🔒</span>}
                  </div>
                  <div className="text-xs text-zinc-500 ml-5">{v.service}</div>
                </button>
              ))}
              {filteredVars.length === 0 && (
                <div className="text-center py-8 text-zinc-500 text-sm">No variables found</div>
              )}
            </div>
          </div>

          {/* Detail */}
          {selectedVar && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="font-mono text-lg font-semibold mb-1">{selectedVar.key}</div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded", envBadge[selectedVar.env])}>{selectedVar.env}</span>
                    <span className="text-xs text-zinc-500">{selectedVar.service}</span>
                    <span className="text-xs text-zinc-500">v{selectedVar.version}</span>
                    {selectedVar.isSecret && <span className="text-xs text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">secret</span>}
                  </div>
                </div>
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded border border-zinc-700 transition-colors"
                >
                  {showSecrets ? "🔒 Hide" : "👁️ Reveal"}
                </button>
              </div>

              <div className="bg-zinc-900 rounded-lg p-4 mb-4">
                <div className="text-xs text-zinc-500 mb-1">Value</div>
                <div className={cn("font-mono text-sm break-all", selectedVar.isSecret && !showSecrets ? "text-zinc-600 select-none" : "text-white")}>
                  {selectedVar.isSecret && !showSecrets ? "●●●●●●●●●●●●●●●●●●●●" : selectedVar.value}
                </div>
              </div>

              <div className="bg-zinc-900 rounded-lg p-4 mb-4">
                <div className="text-xs text-zinc-500 mb-1">Description</div>
                <div className="text-sm text-zinc-300">{selectedVar.description}</div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-xs text-zinc-500 mb-1">Type</div>
                  <div className="flex items-center gap-1.5 text-sm text-white">
                    <span>{typeIcon[selectedVar.type]}</span>
                    <span className="capitalize">{selectedVar.type}</span>
                  </div>
                </div>
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-xs text-zinc-500 mb-1">Modified</div>
                  <div className="text-sm text-white">{selectedVar.lastModified}</div>
                </div>
                <div className="bg-zinc-900 rounded p-3">
                  <div className="text-xs text-zinc-500 mb-1">By</div>
                  <div className="text-sm text-white font-mono">{selectedVar.modifiedBy}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-sm transition-colors">Edit</button>
                <button className="flex-1 py-2 bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 rounded text-sm transition-colors">Promote to Prod</button>
                <button className="px-4 py-2 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 rounded text-sm transition-colors">Delete</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Diff Tab */}
      {tab === "diff" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Environment Diff</h2>
              <p className="text-sm text-zinc-400 mt-0.5">Staging vs Production — {CONFIG_DIFF.length - matchCount} differences</p>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-2 h-2 rounded-full bg-emerald-400" />{matchCount} matching</span>
              <span className="flex items-center gap-1.5 text-rose-400"><span className="w-2 h-2 rounded-full bg-rose-400" />{CONFIG_DIFF.length - matchCount} different</span>
            </div>
          </div>
          <div className="space-y-2">
            {CONFIG_DIFF.map(diff => (
              <div key={diff.key} className={cn("rounded-lg border overflow-hidden", diff.match ? "border-zinc-800" : "border-rose-500/30")}>
                <div className={cn("px-4 py-2 flex items-center gap-3", diff.match ? "bg-zinc-900" : "bg-rose-500/5")}>
                  <span className={diff.match ? "text-emerald-400" : "text-rose-400"}>
                    {diff.match ? "✓" : "✗"}
                  </span>
                  <span className="font-mono text-sm font-medium text-white">{diff.key}</span>
                </div>
                {!diff.match && (
                  <div className="grid grid-cols-2 divide-x divide-zinc-800">
                    <div className="px-4 py-2.5 bg-amber-500/5">
                      <div className="text-xs text-amber-400 mb-1">Staging</div>
                      <div className="font-mono text-xs text-zinc-300 break-all">{diff.env1Value}</div>
                    </div>
                    <div className="px-4 py-2.5 bg-rose-500/5">
                      <div className="text-xs text-rose-400 mb-1">Production</div>
                      <div className="font-mono text-xs text-zinc-300 break-all">{diff.env2Value}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Tab */}
      {tab === "history" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-4">Change History</h2>
          <div className="space-y-3">
            {CHANGE_LOG.map(c => (
              <div key={c.id} className="bg-zinc-900 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded capitalize font-medium", actionBadge[c.action])}>{c.action}</span>
                  <span className="font-mono text-sm font-medium text-white">{c.key}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", envBadge[c.env])}>{c.env}</span>
                  <span className="ml-auto text-xs text-zinc-500">{c.timestamp}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="font-mono">{c.service}</span>
                  <span>by <span className="text-white">{c.author}</span></span>
                </div>
                {(c.fromValue || c.toValue) && (c.action === "updated") && (
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-rose-500/10 rounded p-2">
                      <div className="text-zinc-500 mb-0.5">Before</div>
                      <div className="font-mono text-zinc-400">{c.fromValue || "—"}</div>
                    </div>
                    <div className="bg-emerald-500/10 rounded p-2">
                      <div className="text-zinc-500 mb-0.5">After</div>
                      <div className="font-mono text-zinc-400">{c.toValue || "—"}</div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

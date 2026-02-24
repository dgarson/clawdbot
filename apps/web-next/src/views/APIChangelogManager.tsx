import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { FileText } from "lucide-react";

type ChangeType = "breaking" | "feature" | "fix" | "deprecation" | "security";
type ChangeStatus = "draft" | "published" | "archived";
type Tab = "changelog" | "versions" | "diffs" | "subscribers";

interface APIVersion {
  id: string;
  version: string;
  releaseDate: string;
  status: "current" | "supported" | "deprecated" | "sunset";
  changeCount: number;
  breakingCount: number;
  sunsetDate: string | null;
}

interface ChangeEntry {
  id: string;
  version: string;
  type: ChangeType;
  status: ChangeStatus;
  endpoint: string;
  method: string;
  title: string;
  description: string;
  migration: string | null;
  publishedAt: string;
  affectedClients: number;
}

interface Subscriber {
  id: string;
  name: string;
  email: string;
  plan: string;
  apiVersion: string;
  lastActivity: string;
  breakingChangesAhead: number;
}

const API_VERSIONS: APIVersion[] = [
  { id: "v1", version: "v3", releaseDate: "Jan 15, 2026", status: "current", changeCount: 47, breakingCount: 0, sunsetDate: null },
  { id: "v2", version: "v2", releaseDate: "Jun 1, 2025", status: "supported", changeCount: 134, breakingCount: 3, sunsetDate: "Dec 31, 2026" },
  { id: "v3", version: "v1", releaseDate: "Mar 1, 2024", status: "deprecated", changeCount: 289, breakingCount: 12, sunsetDate: "Mar 31, 2026" },
];

const CHANGES: ChangeEntry[] = [
  { id: "c1", version: "v3", type: "feature", status: "published", endpoint: "/v3/agents/{id}/invoke", method: "POST", title: "Added streaming response support", description: "Agent invocations now support Server-Sent Events (SSE) for streaming responses. Set Accept: text/event-stream to opt in.", migration: null, publishedAt: "2h ago", affectedClients: 0 },
  { id: "c2", version: "v3", type: "fix", status: "published", endpoint: "/v3/sessions", method: "GET", title: "Fixed pagination cursor encoding", description: "Cursor values containing special characters were not properly URL-encoded, causing 400 errors on paginated requests.", migration: null, publishedAt: "1d ago", affectedClients: 234 },
  { id: "c3", version: "v3", type: "feature", status: "published", endpoint: "/v3/models", method: "GET", title: "Added model capability filtering", description: "New query parameters: supports_vision, supports_tools, min_context_length to filter available models.", migration: null, publishedAt: "3d ago", affectedClients: 0 },
  { id: "c4", version: "v3", type: "security", status: "published", endpoint: "/v3/auth/token", method: "POST", title: "Rate limiting now applies per IP", description: "Token refresh endpoints now enforce IP-based rate limiting in addition to token-based limits. Limit: 10 req/min per IP.", migration: null, publishedAt: "5d ago", affectedClients: 12 },
  { id: "c5", version: "v2", type: "breaking", status: "published", endpoint: "/v2/agents", method: "GET", title: "Renamed `status` field to `state` in response", description: "The `status` field in agent list responses has been renamed to `state`. The old field name is still returned but will be removed in v3.", migration: "Update response parsing to use `state` instead of `status`. Both fields are available during the transition period.", publishedAt: "30d ago", affectedClients: 891 },
  { id: "c6", version: "v2", type: "deprecation", status: "published", endpoint: "/v2/sessions/{id}/messages", method: "GET", title: "Deprecated in favor of /v3/sessions/{id}/history", description: "The v2 messages endpoint will be removed on sunset. The v3 endpoint provides richer metadata and better pagination.", migration: "Migrate to GET /v3/sessions/{id}/history. Response structure is compatible with minor field additions.", publishedAt: "45d ago", affectedClients: 1204 },
  { id: "c7", version: "v1", type: "breaking", status: "archived", endpoint: "/v1/run", method: "POST", title: "Removed synchronous run mode", description: "The sync=true parameter is no longer supported. All runs are async. The v2 API provides equivalent functionality.", migration: "Switch to async run with polling or webhooks. See migration guide for code examples.", publishedAt: "180d ago", affectedClients: 342 },
  { id: "c8", version: "v3", type: "feature", status: "draft", endpoint: "/v3/tools", method: "POST", title: "Tool schema validation endpoint (DRAFT)", description: "New endpoint to validate tool schemas before registration, returning detailed error messages.", migration: null, publishedAt: "Not published", affectedClients: 0 },
];

const SUBSCRIBERS: Subscriber[] = [
  { id: "s1", name: "Acme Corp", email: "api-team@acme.com", plan: "Enterprise", apiVersion: "v2", lastActivity: "5m ago", breakingChangesAhead: 3 },
  { id: "s2", name: "BuildFast Inc", email: "dev@buildfast.io", plan: "Pro", apiVersion: "v3", lastActivity: "1h ago", breakingChangesAhead: 0 },
  { id: "s3", name: "DataFlow Labs", email: "eng@dataflow.io", plan: "Enterprise", apiVersion: "v2", lastActivity: "2h ago", breakingChangesAhead: 3 },
  { id: "s4", name: "NovaTech", email: "platform@novatech.dev", plan: "Pro", apiVersion: "v1", lastActivity: "1d ago", breakingChangesAhead: 12 },
  { id: "s5", name: "Startup XYZ", email: "api@startupxyz.com", plan: "Free", apiVersion: "v3", lastActivity: "3d ago", breakingChangesAhead: 0 },
  { id: "s6", name: "MegaCorp Ltd", email: "devops@megacorp.com", plan: "Enterprise", apiVersion: "v2", lastActivity: "4h ago", breakingChangesAhead: 3 },
];

const changeTypeBadge: Record<ChangeType, string> = {
  breaking: "bg-rose-500/15 border-rose-500/40 text-rose-400",
  feature: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
  fix: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  deprecation: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  security: "bg-purple-500/10 border-purple-500/30 text-purple-400",
};

const changeTypeIcon: Record<ChangeType, string> = {
  breaking: "💥",
  feature: "✨",
  fix: "🔧",
  deprecation: "⚠️",
  security: "🔒",
};

const versionStatusBadge: Record<string, string> = {
  current: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  supported: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  deprecated: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  sunset: "bg-surface-3/30 border-tok-border text-fg-muted",
};

const methodColor: Record<string, string> = {
  GET: "text-sky-400",
  POST: "text-emerald-400",
  PUT: "text-amber-400",
  PATCH: "text-orange-400",
  DELETE: "text-rose-400",
};

export default function APIChangelogManager() {
  const [tab, setTab] = useState<Tab>("changelog");
  const [selectedChange, setSelectedChange] = useState<ChangeEntry | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [versionFilter, setVersionFilter] = useState<string>("all");

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "changelog", label: "Changelog", emoji: "📋" },
    { id: "versions", label: "API Versions", emoji: "🔖" },
    { id: "diffs", label: "Diffs", emoji: "🔍" },
    { id: "subscribers", label: "Subscribers", emoji: "👥" },
  ];

  const filteredChanges = CHANGES.filter(c => {
    if (typeFilter !== "all" && c.type !== typeFilter) {return false;}
    if (versionFilter !== "all" && c.version !== versionFilter) {return false;}
    return true;
  });

  const breakingAhead = SUBSCRIBERS.filter(s => s.breakingChangesAhead > 0).length;

  return (
    <>
      <a
        href="#acm-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="flex flex-col h-full bg-surface-0 text-fg-primary">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 sm:px-4 md:px-6 py-4 border-b border-tok-border">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">API Changelog Manager</h1>
            <p className="text-xs text-fg-muted mt-0.5">Track API changes, versions, and subscriber impact</p>
          </div>
          <div className="flex items-center gap-2">
            {breakingAhead > 0 && (
              <div role="status" className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30">
                <span className="text-xs text-amber-400 font-medium"><span aria-hidden="true">⚠️</span> {breakingAhead} clients on deprecated APIs</span>
              </div>
            )}
            <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-fg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              + New Change
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b border-tok-border">
          {[
            { label: "Current Version", value: "v3", sub: "released Jan 2026" },
            { label: "Active Subscribers", value: String(SUBSCRIBERS.length), sub: "across 3 API versions" },
            { label: "Breaking Changes (v3)", value: "0", sub: "since v3 launch" },
            { label: "At-Risk Clients", value: String(SUBSCRIBERS.filter(s => s.apiVersion === "v1").length), sub: "on deprecated v1" },
          ].map((stat, i) => (
            <div key={i} className="px-6 py-3 border-r border-tok-border last:border-r-0">
              <div className="text-xl font-bold text-fg-primary">{stat.value}</div>
              <div className="text-xs font-medium text-fg-secondary mt-0.5">{stat.label}</div>
              <div className="text-xs text-fg-muted mt-0.5">{stat.sub}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div role="tablist" aria-label="Changelog sections" className="flex border-b border-tok-border px-6">
          {tabs.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              aria-controls={`acm-panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                tab === t.id ? "border-indigo-500 text-fg-primary" : "border-transparent text-fg-muted hover:text-fg-primary"
              )}
            >
              <span aria-hidden="true">{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        <main id="acm-main" className="flex-1 overflow-auto">
          {/* CHANGELOG TAB */}
          {tab === "changelog" && (
            <div id="acm-panel-changelog" role="tabpanel" aria-label="Changelog" className="flex h-full">
              {/* List */}
              <div className="w-96 border-r border-tok-border flex flex-col">
                <div className="p-3 space-y-2 border-b border-tok-border">
                  <div className="flex gap-2">
                    <label htmlFor="type-filter" className="sr-only">Filter by change type</label>
                    <select
                      id="type-filter"
                      value={typeFilter}
                      onChange={e => setTypeFilter(e.target.value)}
                      className="flex-1 bg-surface-1 border border-tok-border rounded px-2 py-1 text-xs text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <option value="all">All types</option>
                      <option value="breaking">💥 Breaking</option>
                      <option value="feature">✨ Feature</option>
                      <option value="fix">🔧 Fix</option>
                      <option value="deprecation">⚠️ Deprecation</option>
                      <option value="security">🔒 Security</option>
                    </select>
                    <label htmlFor="version-filter" className="sr-only">Filter by API version</label>
                    <select
                      id="version-filter"
                      value={versionFilter}
                      onChange={e => setVersionFilter(e.target.value)}
                      className="flex-1 bg-surface-1 border border-tok-border rounded px-2 py-1 text-xs text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <option value="all">All versions</option>
                      <option value="v3">v3 (current)</option>
                      <option value="v2">v2</option>
                      <option value="v1">v1</option>
                    </select>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto" aria-live="polite">
                  {filteredChanges.length === 0 && (
                    <ContextualEmptyState
                      icon={FileText}
                      title="No changelog entries"
                      description="No changes match the current filter. Try adjusting the version or type filter."
                      size="sm"
                    />
                  )}
                  {filteredChanges.map(change => (
                    <button
                      key={change.id}
                      onClick={() => setSelectedChange(change)}
                      aria-pressed={selectedChange?.id === change.id}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-tok-border/50 hover:bg-surface-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                        selectedChange?.id === change.id && "bg-surface-2",
                        change.status === "draft" && "opacity-60"
                      )}
                    >
                      <div className="flex items-start gap-2 mb-1">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0 mt-0.5", changeTypeBadge[change.type])}>
                          <span aria-hidden="true">{changeTypeIcon[change.type]}</span> {change.type}
                        </span>
                        {change.status === "draft" && (
                          <span className="text-xs px-1 py-0.5 bg-surface-3/40 text-fg-muted rounded shrink-0">draft</span>
                        )}
                      </div>
                      <div className="text-sm font-medium text-fg-primary line-clamp-1">{change.title}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs font-mono">
                        <span className={cn("font-medium", methodColor[change.method] || "text-fg-secondary")}>{change.method}</span>
                        <span className="text-fg-muted truncate">{change.endpoint}</span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-fg-muted">
                        <span className="bg-surface-2 px-1.5 rounded">{change.version}</span>
                        <span>{change.publishedAt}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Detail */}
              <div className="flex-1 overflow-y-auto">
                {selectedChange ? (
                  <div className="p-3 sm:p-4 md:p-6 space-y-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn("text-xs px-2 py-0.5 rounded border", changeTypeBadge[selectedChange.type])}>
                          <span aria-hidden="true">{changeTypeIcon[selectedChange.type]}</span> {selectedChange.type}
                        </span>
                        <span className="text-xs bg-surface-2 px-2 py-0.5 rounded text-fg-secondary">{selectedChange.version}</span>
                        {selectedChange.status === "draft" && (
                          <span className="text-xs bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-amber-400">DRAFT</span>
                        )}
                        <span className="ml-auto text-xs text-fg-muted">{selectedChange.publishedAt}</span>
                      </div>
                      <h2 className="text-lg font-semibold text-fg-primary">{selectedChange.title}</h2>
                    </div>

                    {/* Endpoint */}
                    <section aria-label="Endpoint" className="bg-surface-1 rounded-lg border border-tok-border p-4 font-mono text-sm">
                      <span className={cn("font-bold mr-2", methodColor[selectedChange.method] || "text-fg-secondary")}>
                        {selectedChange.method}
                      </span>
                      <span className="text-fg-primary">{selectedChange.endpoint}</span>
                    </section>

                    {/* Description */}
                    <div>
                      <div className="text-xs text-fg-muted mb-2 uppercase tracking-wider">Description</div>
                      <p className="text-sm text-fg-primary leading-relaxed">{selectedChange.description}</p>
                    </div>

                    {/* Migration guide */}
                    {selectedChange.migration && (
                      <section
                        aria-label={selectedChange.type === "breaking" ? "Migration required" : "Migration guide"}
                        className={cn(
                          "rounded-lg border p-4",
                          selectedChange.type === "breaking" ? "bg-rose-500/5 border-rose-500/20" : "bg-amber-500/5 border-amber-500/20"
                        )}
                      >
                        <div className={cn("text-sm font-medium mb-2", selectedChange.type === "breaking" ? "text-rose-400" : "text-amber-400")}>
                          {selectedChange.type === "breaking" ? "⚡ Migration Required" : "📖 Migration Guide"}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: selectedChange.type === "breaking" ? "rgb(252 165 165 / 0.8)" : "rgb(253 230 138 / 0.7)" }}>
                          {selectedChange.migration}
                        </p>
                      </section>
                    )}

                    {/* Affected clients */}
                    {selectedChange.affectedClients > 0 && (
                      <div>
                        <div className="text-xs text-fg-muted mb-2 uppercase tracking-wider">Impact</div>
                        <div className="bg-surface-1 rounded p-3 flex items-center gap-3">
                          <div className="text-2xl font-bold text-amber-400">{selectedChange.affectedClients}</div>
                          <div>
                            <div className="text-sm text-fg-primary">API clients affected</div>
                            <div className="text-xs text-fg-muted">currently using this endpoint</div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      {selectedChange.status === "draft" && (
                        <button
                          aria-label={`Publish: ${selectedChange.title}`}
                          className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-fg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        aria-label={`Edit: ${selectedChange.title}`}
                        className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-tok-border rounded text-fg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        Edit
                      </button>
                      {selectedChange.affectedClients > 0 && (
                        <button
                          aria-label={`Notify ${selectedChange.affectedClients} affected clients about: ${selectedChange.title}`}
                          className="px-3 py-1.5 text-xs bg-surface-2 hover:bg-surface-3 border border-tok-border rounded text-fg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          Notify Clients
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full text-fg-muted text-sm">Select a change to view details</div>
                )}
              </div>
            </div>
          )}

          {/* VERSIONS TAB */}
          {tab === "versions" && (
            <div id="acm-panel-versions" role="tabpanel" aria-label="API Versions" className="p-3 sm:p-4 md:p-6 space-y-4">
              {API_VERSIONS.map(version => (
                <section key={version.id} aria-label={`API version ${version.version}`} className={cn(
                  "bg-surface-1 rounded-lg border p-5",
                  version.status === "deprecated" ? "border-amber-500/20" : "border-tok-border"
                )}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl font-bold text-fg-primary font-mono">{version.version}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", versionStatusBadge[version.status])}>
                        {version.status}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-fg-muted">Released {version.releaseDate}</div>
                      {version.sunsetDate && (
                        <div className="text-xs text-amber-400 mt-0.5">Sunset: {version.sunsetDate}</div>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-surface-2/50 rounded p-3">
                      <div className="text-lg font-bold text-fg-primary">{version.changeCount}</div>
                      <div className="text-xs text-fg-muted">total changes</div>
                    </div>
                    <div className={cn("rounded p-3", version.breakingCount > 0 ? "bg-rose-500/5" : "bg-surface-2/50")}>
                      <div className={cn("text-lg font-bold", version.breakingCount > 0 ? "text-rose-400" : "text-fg-primary")}>{version.breakingCount}</div>
                      <div className="text-xs text-fg-muted">breaking changes</div>
                    </div>
                    <div className="bg-surface-2/50 rounded p-3">
                      <div className="text-lg font-bold text-fg-primary">{SUBSCRIBERS.filter(s => s.apiVersion === version.version).length}</div>
                      <div className="text-xs text-fg-muted">active subscribers</div>
                    </div>
                  </div>
                  {version.status === "deprecated" && (
                    <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 rounded p-2">
                      <span aria-hidden="true">⚠️</span> Deprecated — clients should migrate to v3 before {version.sunsetDate}
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* DIFFS TAB */}
          {tab === "diffs" && (
            <div id="acm-panel-diffs" role="tabpanel" aria-label="API Diffs" className="p-3 sm:p-4 md:p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="diff-from" className="text-xs text-fg-muted">From:</label>
                  <select id="diff-from" className="bg-surface-1 border border-tok-border rounded px-2 py-1 text-sm text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    <option>v2</option>
                    <option>v1</option>
                  </select>
                </div>
                <span aria-hidden="true" className="text-fg-muted">→</span>
                <div className="flex items-center gap-2">
                  <label htmlFor="diff-to" className="text-xs text-fg-muted">To:</label>
                  <select id="diff-to" className="bg-surface-1 border border-tok-border rounded px-2 py-1 text-sm text-fg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                    <option>v3</option>
                    <option>v2</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {[
                  { type: "added", endpoint: "GET /v3/models", desc: "New endpoint for listing available models" },
                  { type: "added", endpoint: "POST /v3/agents/{id}/invoke", desc: "Unified agent invocation with streaming support" },
                  { type: "changed", endpoint: "GET /v3/sessions", desc: "state field renamed from status; richer pagination" },
                  { type: "changed", endpoint: "POST /v3/auth/token", desc: "IP-based rate limiting added" },
                  { type: "removed", endpoint: "GET /v2/sessions/{id}/messages", desc: "Replaced by /v3/sessions/{id}/history" },
                  { type: "removed", endpoint: "POST /v2/run", desc: "Removed sync run mode; all runs async" },
                ].map((diff, i) => (
                  <div key={i} className={cn(
                    "flex items-start gap-3 px-4 py-3 rounded-lg border font-mono text-xs",
                    diff.type === "added" ? "bg-emerald-500/5 border-emerald-500/20" :
                    diff.type === "removed" ? "bg-rose-500/5 border-rose-500/20" :
                    "bg-amber-500/5 border-amber-500/20"
                  )}>
                    <span
                      aria-label={diff.type}
                      className={cn(
                        "font-bold shrink-0 w-6",
                        diff.type === "added" ? "text-emerald-400" :
                        diff.type === "removed" ? "text-rose-400" : "text-amber-400"
                      )}
                    >
                      {diff.type === "added" ? "+" : diff.type === "removed" ? "-" : "~"}
                    </span>
                    <div>
                      <div className="text-fg-primary">{diff.endpoint}</div>
                      <div className="text-fg-muted font-sans mt-0.5">{diff.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SUBSCRIBERS TAB */}
          {tab === "subscribers" && (
            <div id="acm-panel-subscribers" role="tabpanel" aria-label="Subscribers" className="p-3 sm:p-4 md:p-6 space-y-3">
              {SUBSCRIBERS.toSorted((a, b) => b.breakingChangesAhead - a.breakingChangesAhead).map(sub => (
                <div key={sub.id} className={cn(
                  "bg-surface-1 rounded-lg border px-5 py-4",
                  sub.breakingChangesAhead > 0 ? "border-amber-500/20" : "border-tok-border"
                )}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium text-sm text-fg-primary">{sub.name}</span>
                      <span className="text-xs text-fg-muted ml-2">{sub.email}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-fg-muted">{sub.lastActivity}</span>
                      <span className="text-xs bg-surface-2 px-2 py-0.5 rounded font-mono text-fg-secondary">{sub.apiVersion}</span>
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded",
                        sub.plan === "Enterprise" ? "bg-indigo-500/10 text-indigo-400" :
                        sub.plan === "Pro" ? "bg-sky-500/10 text-sky-400" : "bg-surface-3/30 text-fg-muted"
                      )}>{sub.plan}</span>
                    </div>
                  </div>
                  {sub.breakingChangesAhead > 0 && (
                    <div className="flex items-center gap-2 text-xs bg-amber-500/10 rounded p-2 text-amber-400">
                      <span aria-hidden="true">⚠️</span>
                      <span>{sub.breakingChangesAhead} breaking changes ahead before sunset deadline</span>
                      <button
                        aria-label={`Notify ${sub.name} about ${sub.breakingChangesAhead} breaking changes`}
                        className="ml-auto text-amber-400 hover:text-amber-300 underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                      >
                        Notify
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </>
  );
}

import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ChangeType = "breaking" | "feature" | "improvement" | "bugfix" | "deprecation";
type ReleaseType = "major" | "minor" | "patch";

interface ChangeItem {
  type: ChangeType;
  title: string;
  description: string;
  pr?: number;
  issue?: number;
}

interface Release {
  version: string;
  date: string;
  releaseType: ReleaseType;
  summary: string;
  changes: ChangeItem[];
}

// ── Constants ──────────────────────────────────────────────────────────────

const CHANGE_META: Record<ChangeType, { label: string; emoji: string; pillBg: string; pillText: string }> = {
  breaking:    { label: "Breaking Change", emoji: "🔥", pillBg: "bg-rose-500/20",    pillText: "text-rose-400" },
  feature:     { label: "New Feature",     emoji: "✨", pillBg: "bg-emerald-500/20", pillText: "text-emerald-400" },
  improvement: { label: "Improvement",     emoji: "💎", pillBg: "bg-indigo-500/20",  pillText: "text-indigo-400" },
  bugfix:      { label: "Bug Fix",         emoji: "🐛", pillBg: "bg-amber-500/20",   pillText: "text-amber-400" },
  deprecation: { label: "Deprecation",     emoji: "📦", pillBg: "bg-zinc-500/20",    pillText: "text-zinc-400" },
};

const RELEASE_TYPE_STYLES: Record<ReleaseType, { bg: string; text: string }> = {
  major: { bg: "bg-rose-500/20",    text: "text-rose-400" },
  minor: { bg: "bg-indigo-500/20",  text: "text-indigo-400" },
  patch: { bg: "bg-zinc-500/20",    text: "text-zinc-300" },
};

const FILTER_OPTIONS: { value: ChangeType | "all"; label: string }[] = [
  { value: "all",         label: "All Changes" },
  { value: "breaking",    label: "Breaking" },
  { value: "feature",     label: "Features" },
  { value: "improvement", label: "Improvements" },
  { value: "bugfix",      label: "Bug Fixes" },
  { value: "deprecation", label: "Deprecations" },
];

// ── Data ───────────────────────────────────────────────────────────────────

const RELEASES: Release[] = [
  {
    version: "2.5.0",
    date: "2026-02-18",
    releaseType: "minor",
    summary: "Introduces real-time collaboration on API specs and a revamped billing dashboard.",
    changes: [
      { type: "feature",     title: "Real-time API spec collaboration",         description: "Multiple team members can now edit OpenAPI specs simultaneously with live cursors, presence indicators, and conflict-free merging.",                       pr: 1842 },
      { type: "feature",     title: "Billing dashboard redesign",               description: "Completely redesigned billing overview with invoice history, cost breakdown charts, and usage projections for the next billing cycle.",                       pr: 1839 },
      { type: "improvement", title: "SDK code generation speed",                description: "TypeScript and Python SDK generation is now 3× faster thanks to incremental compilation and template caching.",                                              pr: 1836 },
      { type: "bugfix",      title: "OAuth PKCE flow token refresh",            description: "Fixed a race condition where concurrent token refresh requests could invalidate active sessions on high-traffic applications.",                              pr: 1841, issue: 1102 },
      { type: "bugfix",      title: "Webhook retry backoff overflow",           description: "Exponential backoff for webhook retries no longer overflows after 15 consecutive failures, capping at 1 hour between attempts.",                              pr: 1838 },
      { type: "improvement", title: "Dashboard loading skeleton states",        description: "All dashboard pages now show contextual skeleton loaders instead of generic spinners during initial data fetch.",                                              pr: 1835 },
      { type: "deprecation", title: "Legacy API key format (v1 prefix)",        description: "API keys using the `hzn_v1_` prefix are deprecated. Migrate to `hzn_live_` / `hzn_test_` format before v3.0.",                                               issue: 987 },
    ],
  },
  {
    version: "2.4.1",
    date: "2026-01-30",
    releaseType: "patch",
    summary: "Hotfix for dashboard rendering issues on Safari and a critical auth token leak.",
    changes: [
      { type: "bugfix",      title: "Safari CSS grid layout collapse",          description: "Fixed dashboard grid layout breaking on Safari 17+ due to incorrect subgrid fallback calculation.",                                                          pr: 1830 },
      { type: "bugfix",      title: "Auth token exposure in error logs",        description: "Bearer tokens were inadvertently included in structured error logs sent to the client. Tokens are now redacted server-side.",                                  pr: 1831, issue: 1098 },
      { type: "bugfix",      title: "Rate limit header casing inconsistency",   description: "X-RateLimit-Remaining header was returned in mixed case on some edge nodes, causing SDK parsing failures.",                                                    pr: 1829 },
      { type: "improvement", title: "Error boundary crash reporting",           description: "React error boundaries now capture component stack traces and send them to the telemetry service for faster debugging.",                                        pr: 1828 },
      { type: "bugfix",      title: "Pagination cursor decode failure",         description: "Base64-encoded pagination cursors with special characters now URL-encode correctly on all API endpoints.",                                                      pr: 1827 },
      { type: "improvement", title: "CLI version check on startup",            description: "The Horizon CLI now checks for updates on startup and displays a non-blocking notice if a newer version is available.",                                           pr: 1826 },
    ],
  },
  {
    version: "2.4.0",
    date: "2026-01-14",
    releaseType: "minor",
    summary: "Adds organization-level RBAC, custom webhook templates, and improved analytics.",
    changes: [
      { type: "feature",     title: "Organization-level RBAC",                  description: "Define granular role-based access control policies at the organization level with custom roles, permission sets, and inheritance from team groups.",            pr: 1812 },
      { type: "feature",     title: "Custom webhook payload templates",         description: "Create reusable Handlebars-based payload templates for webhooks instead of using the default JSON structure.",                                                  pr: 1808, issue: 945 },
      { type: "improvement", title: "Analytics query performance",              description: "Dashboard analytics queries now run against a pre-aggregated materialized view, reducing p99 load time from 4.2s to 380ms.",                                     pr: 1815 },
      { type: "bugfix",      title: "Team invitation email delivery",           description: "Invitations sent to addresses with plus-addressing (user+tag@domain) were being silently dropped by the email provider.",                                       pr: 1810, issue: 1067 },
      { type: "improvement", title: "API playground request history",           description: "The interactive API playground now persists the last 50 requests per endpoint in local storage for quick replay.",                                                pr: 1814 },
      { type: "feature",     title: "Audit log export to S3",                   description: "Organization audit logs can now be exported on a scheduled basis directly to an S3-compatible bucket in JSON Lines format.",                                     pr: 1809 },
      { type: "deprecation", title: "Personal access tokens (PAT v1)",          description: "PAT v1 tokens without expiration dates are deprecated. All new tokens require an expiry. Existing tokens will be force-expired on 2026-07-01.",                  issue: 1070 },
    ],
  },
  {
    version: "2.3.0",
    date: "2025-12-09",
    releaseType: "minor",
    summary: "GraphQL API layer, improved onboarding wizard, and SDK for Go.",
    changes: [
      { type: "feature",     title: "GraphQL API (beta)",                       description: "A new GraphQL endpoint is available at /graphql with full schema introspection, query complexity analysis, and depth limiting.",                               pr: 1790 },
      { type: "feature",     title: "Go SDK",                                   description: "Official Go SDK with idiomatic error handling, context propagation, automatic retries, and comprehensive godoc documentation.",                                  pr: 1785 },
      { type: "improvement", title: "Onboarding wizard redesign",               description: "Step-by-step onboarding now includes interactive code samples, environment auto-detection, and a guided first API call experience.",                            pr: 1792 },
      { type: "bugfix",      title: "Idempotency key collision on retry",       description: "When a request timed out and was retried, the SDK could generate a duplicate idempotency key leading to 409 Conflict responses.",                               pr: 1788, issue: 1034 },
      { type: "bugfix",      title: "Dark mode contrast on status badges",      description: "Status badges in the dashboard had insufficient contrast ratios in dark mode, failing WCAG AA requirements.",                                                   pr: 1791, issue: 1029 },
      { type: "improvement", title: "Structured error responses",               description: "All API error responses now follow RFC 7807 Problem Details format with machine-readable error codes and documentation links.",                                   pr: 1786 },
    ],
  },
  {
    version: "2.2.0",
    date: "2025-11-03",
    releaseType: "minor",
    summary: "Multi-environment support, API versioning controls, and new Python SDK features.",
    changes: [
      { type: "feature",     title: "Multi-environment management",             description: "Create and manage isolated environments (staging, preview, production) with independent configurations, secrets, and deployment targets.",                       pr: 1765 },
      { type: "feature",     title: "API version pinning",                      description: "Pin your integration to a specific API version via the Horizon-Version header. Unpinned requests default to the latest stable version.",                        pr: 1760 },
      { type: "improvement", title: "Python SDK async support",                 description: "Python SDK now includes a fully async client using httpx, with connection pooling and automatic retry with jittered exponential backoff.",                       pr: 1768 },
      { type: "bugfix",      title: "Webhook signature verification timing",    description: "HMAC signature verification was vulnerable to timing side-channel attacks. Now uses constant-time comparison.",                                                  pr: 1762, issue: 998 },
      { type: "bugfix",      title: "API key rotation grace period",            description: "Rotating an API key now provides a 24-hour grace period where both old and new keys are accepted, preventing service disruption.",                               pr: 1764 },
      { type: "deprecation", title: "REST API v1 endpoints",                    description: "All /v1/* REST endpoints are deprecated and will be removed in v3.0. Migrate to /v2/* endpoints. See migration guide.",                                          issue: 950 },
    ],
  },
  {
    version: "2.1.0",
    date: "2025-09-22",
    releaseType: "minor",
    summary: "Interactive API explorer, team management, and performance improvements.",
    changes: [
      { type: "feature",     title: "Interactive API explorer",                 description: "A fully interactive API explorer with auto-generated request builders, response previews, and code snippets in 6 languages.",                                   pr: 1740 },
      { type: "feature",     title: "Team management dashboard",               description: "Create teams, assign members, set team-level permissions, and view aggregated usage analytics per team.",                                                         pr: 1735 },
      { type: "improvement", title: "Dashboard initial load time",              description: "Reduced initial dashboard bundle size by 42% through code splitting, lazy loading, and tree-shaking unused Radix components.",                                    pr: 1742 },
      { type: "bugfix",      title: "Session fixation on OAuth callback",       description: "After OAuth callback, the session ID was not regenerated, allowing potential session fixation attacks.",                                                           pr: 1738, issue: 912 },
      { type: "bugfix",      title: "CSV export encoding for Unicode",          description: "Exported CSV files now use UTF-8 BOM encoding, fixing garbled characters in Excel for non-Latin data.",                                                           pr: 1737 },
      { type: "improvement", title: "API response compression",                description: "All JSON responses over 1KB are now compressed with Brotli (preferred) or gzip, reducing average payload size by 68%.",                                            pr: 1741 },
    ],
  },
  {
    version: "2.0.0",
    date: "2025-08-01",
    releaseType: "major",
    summary: "Major release with new authentication system, TypeScript SDK rewrite, and breaking API changes.",
    changes: [
      { type: "breaking",    title: "Authentication system overhaul",           description: "Replaced legacy session-based auth with OAuth 2.1 + PKCE. All existing session tokens are invalidated. See migration guide for updating your integration.",       pr: 1700 },
      { type: "breaking",    title: "API response envelope change",            description: "API responses no longer wrap data in a { success, data, error } envelope. Data is returned directly. Errors use standard HTTP status codes + RFC 7807.",           pr: 1698 },
      { type: "feature",     title: "TypeScript SDK v2",                        description: "Complete rewrite of the TypeScript SDK with full type safety, auto-generated types from OpenAPI spec, and tree-shakeable exports.",                                pr: 1710 },
      { type: "feature",     title: "Webhook management UI",                   description: "Visual webhook management with endpoint creation, event filtering, payload inspection, delivery logs, and manual retry controls.",                                 pr: 1705 },
      { type: "bugfix",      title: "Memory leak in SSE connections",           description: "Server-Sent Events connections were not properly cleaned up on client disconnect, causing memory growth on long-running dashboard sessions.",                      pr: 1702, issue: 876 },
      { type: "improvement", title: "Rate limiting with sliding window",        description: "Upgraded from fixed-window to sliding-window rate limiting for smoother traffic distribution and fairer quota allocation.",                                        pr: 1708 },
      { type: "deprecation", title: "Session-based authentication",             description: "Cookie-based session auth is removed. All integrations must use OAuth 2.1 bearer tokens. Legacy session endpoints return 410 Gone.",                              pr: 1700 },
    ],
  },
  {
    version: "1.0.0",
    date: "2025-06-15",
    releaseType: "major",
    summary: "Initial stable release of the Horizon Developer Platform with REST API, dashboard, and SDKs.",
    changes: [
      { type: "feature",     title: "REST API v1",                              description: "Full RESTful API with CRUD operations for all platform resources, pagination, filtering, sorting, and field selection.",                                          pr: 1500 },
      { type: "feature",     title: "Developer dashboard",                      description: "Web-based dashboard for managing API keys, viewing usage analytics, configuring webhooks, and accessing documentation.",                                          pr: 1510 },
      { type: "feature",     title: "TypeScript SDK v1",                        description: "Official TypeScript/JavaScript SDK with promise-based API, automatic pagination, request/response interceptors, and retry logic.",                                pr: 1520 },
      { type: "feature",     title: "Python SDK v1",                            description: "Official Python SDK with sync and async clients, automatic rate limit handling, and comprehensive type stubs for IDE support.",                                    pr: 1525 },
      { type: "feature",     title: "API key management",                       description: "Create, rotate, and revoke API keys with scoped permissions, expiration dates, and IP allowlisting for enhanced security.",                                        pr: 1505 },
      { type: "improvement", title: "OpenAPI 3.1 specification",                description: "Complete OpenAPI 3.1 spec published at /openapi.json with JSON Schema 2020-12 support for request/response validation.",                                          pr: 1530 },
      { type: "bugfix",      title: "CORS preflight caching",                   description: "OPTIONS preflight responses now include proper Access-Control-Max-Age headers, reducing redundant preflight requests by 90%.",                                     pr: 1508 },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────────

function computeStats(releases: Release[]): { total: number; breaking: number; features: number; bugfixes: number } {
  let breaking = 0;
  let features = 0;
  let bugfixes = 0;
  for (const r of releases) {
    for (const c of r.changes) {
      if (c.type === "breaking") {breaking++;}
      else if (c.type === "feature") {features++;}
      else if (c.type === "bugfix") {bugfixes++;}
    }
  }
  return { total: releases.length, breaking, features, bugfixes };
}

// ── Component ──────────────────────────────────────────────────────────────

export default function ChangelogViewer() {
  const [selectedVersion, setSelectedVersion] = useState<string>(RELEASES[0].version);
  const [filter, setFilter] = useState<ChangeType | "all">("all");
  const [search, setSearch] = useState("");

  const lowerSearch = search.toLowerCase();

  // Filter releases that match search
  const filteredReleases = RELEASES.filter((r) => {
    if (!lowerSearch) {return true;}
    if (r.version.toLowerCase().includes(lowerSearch)) {return true;}
    if (r.summary.toLowerCase().includes(lowerSearch)) {return true;}
    return r.changes.some(
      (c) =>
        c.title.toLowerCase().includes(lowerSearch) ||
        c.description.toLowerCase().includes(lowerSearch)
    );
  });

  const selectedRelease = filteredReleases.find((r) => r.version === selectedVersion) ?? filteredReleases[0] ?? null;

  const filteredChanges = selectedRelease
    ? selectedRelease.changes.filter((c) => {
        const matchesFilter = filter === "all" || c.type === filter;
        const matchesSearch =
          !lowerSearch ||
          c.title.toLowerCase().includes(lowerSearch) ||
          c.description.toLowerCase().includes(lowerSearch);
        return matchesFilter && matchesSearch;
      })
    : [];

  const stats = computeStats(RELEASES);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-5">
        <div className="mx-auto max-w-7xl">
          <h1 className="text-2xl font-bold tracking-tight">📋 Changelog</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Release notes and version history for the Horizon Developer Platform
          </p>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap gap-6 text-sm">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="font-semibold text-white">{stats.total}</span> Releases
          </span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="font-semibold text-rose-400">{stats.breaking}</span> Breaking Changes
          </span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="font-semibold text-emerald-400">{stats.features}</span> Features Added
          </span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span className="font-semibold text-amber-400">{stats.bugfixes}</span> Bugs Fixed
          </span>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="border-b border-zinc-800 px-6 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search releases..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  filter === opt.value
                    ? "bg-indigo-500 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Sidebar — Releases List */}
          <aside className="w-full shrink-0 lg:w-72">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-2">
              <h2 className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                Releases ({filteredReleases.length})
              </h2>
              <nav className="flex flex-col gap-0.5">
                {filteredReleases.map((r) => {
                  const isSelected = selectedRelease?.version === r.version;
                  const rtStyle = RELEASE_TYPE_STYLES[r.releaseType];
                  return (
                    <button
                      key={r.version}
                      onClick={() => setSelectedVersion(r.version)}
                      className={cn(
                        "flex items-center justify-between rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected
                          ? "bg-indigo-500/10 text-white"
                          : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold">v{r.version}</span>
                          <span
                            className={cn(
                              "rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              rtStyle.bg,
                              rtStyle.text
                            )}
                          >
                            {r.releaseType}
                          </span>
                        </div>
                        <span className="mt-0.5 block text-xs text-zinc-500">{r.date}</span>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                        {r.changes.length}
                      </span>
                    </button>
                  );
                })}
                {filteredReleases.length === 0 && (
                  <p className="px-3 py-4 text-center text-sm text-zinc-500">No releases match your search.</p>
                )}
              </nav>
            </div>
          </aside>

          {/* Main Content — Release Detail */}
          <main className="min-w-0 flex-1">
            {selectedRelease ? (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                {/* Release Header */}
                <div className="mb-6 border-b border-zinc-800 pb-5">
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-bold tracking-tight">v{selectedRelease.version}</h2>
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-semibold uppercase",
                        RELEASE_TYPE_STYLES[selectedRelease.releaseType].bg,
                        RELEASE_TYPE_STYLES[selectedRelease.releaseType].text
                      )}
                    >
                      {selectedRelease.releaseType} release
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">{selectedRelease.date}</p>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-300">{selectedRelease.summary}</p>
                </div>

                {/* Changes List */}
                {filteredChanges.length > 0 ? (
                  <div className="space-y-3">
                    {filteredChanges.map((change, idx) => {
                      const meta = CHANGE_META[change.type];
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 transition-colors hover:border-zinc-700"
                        >
                          <div className="flex flex-wrap items-start gap-2">
                            <span className="mt-0.5 text-lg leading-none">{meta.emoji}</span>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-sm font-semibold text-white">{change.title}</h3>
                                <span
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                                    meta.pillBg,
                                    meta.pillText
                                  )}
                                >
                                  {meta.label}
                                </span>
                                {change.pr != null && (
                                  <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                                    PR #{change.pr}
                                  </span>
                                )}
                                {change.issue != null && (
                                  <span className="rounded-md bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                                    Issue #{change.issue}
                                  </span>
                                )}
                              </div>
                              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">
                                {change.description}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 px-6 py-10 text-center">
                    <p className="text-sm text-zinc-500">No changes match the current filter.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 px-6 py-20">
                <p className="text-sm text-zinc-500">Select a release to view details.</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

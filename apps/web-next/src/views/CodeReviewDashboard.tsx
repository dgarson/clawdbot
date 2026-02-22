import React, { useState } from "react";
import { cn } from "../lib/utils";

type PRStatus = "open" | "draft" | "merged" | "closed" | "needs-review";
type ReviewDecision = "approved" | "changes-requested" | "commented" | "pending";
type PRSize = "xs" | "s" | "m" | "l" | "xl";

interface Reviewer {
  name: string;
  avatar: string;
  decision: ReviewDecision;
}

interface PullRequest {
  id: number;
  title: string;
  author: string;
  authorAvatar: string;
  repo: string;
  branch: string;
  base: string;
  status: PRStatus;
  size: PRSize;
  additions: number;
  deletions: number;
  filesChanged: number;
  comments: number;
  reviewers: Reviewer[];
  labels: string[];
  createdAt: string;
  updatedAt: string;
  description: string;
  checks: { name: string; status: "passing" | "failing" | "pending" }[];
  conflicts: boolean;
}

interface ReviewMetric {
  label: string;
  value: string | number;
  delta?: string;
  positive?: boolean;
}

const statusBadge: Record<PRStatus, string> = {
  open:          "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
  draft:         "bg-zinc-500/20 text-zinc-400 border border-zinc-500/30",
  merged:        "bg-violet-500/20 text-violet-400 border border-violet-500/30",
  closed:        "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  "needs-review":"bg-amber-500/20 text-amber-400 border border-amber-500/30",
};

const decisionIcon: Record<ReviewDecision, { icon: string; color: string }> = {
  approved:           { icon: "✓", color: "text-emerald-400" },
  "changes-requested":{ icon: "✗", color: "text-rose-400" },
  commented:          { icon: "💬", color: "text-amber-400" },
  pending:            { icon: "⋯", color: "text-zinc-500" },
};

const sizeColor: Record<PRSize, string> = {
  xs: "bg-emerald-500/20 text-emerald-400",
  s:  "bg-sky-500/20 text-sky-400",
  m:  "bg-amber-500/20 text-amber-400",
  l:  "bg-orange-500/20 text-orange-400",
  xl: "bg-rose-500/20 text-rose-400",
};

const labelColor: Record<string, string> = {
  "bug":       "bg-rose-500/20 text-rose-400",
  "feature":   "bg-indigo-500/20 text-indigo-400",
  "refactor":  "bg-sky-500/20 text-sky-400",
  "perf":      "bg-amber-500/20 text-amber-400",
  "security":  "bg-orange-500/20 text-orange-400",
  "docs":      "bg-zinc-500/20 text-zinc-400",
  "breaking":  "bg-red-700/30 text-red-400",
  "chore":     "bg-zinc-600/20 text-zinc-400",
};

const pullRequests: PullRequest[] = [
  {
    id: 1482,
    title: "feat: add rate limiting middleware with Redis backend",
    author: "alice",
    authorAvatar: "A",
    repo: "api-gateway",
    branch: "feat/rate-limit-redis",
    base: "main",
    status: "needs-review",
    size: "m",
    additions: 342,
    deletions: 18,
    filesChanged: 12,
    comments: 4,
    reviewers: [
      { name: "bob",   avatar: "B", decision: "pending" },
      { name: "carol", avatar: "C", decision: "commented" },
    ],
    labels: ["feature", "perf"],
    createdAt: "2025-02-20",
    updatedAt: "2h ago",
    description: "Implements a Redis-backed rate limiter using token bucket algorithm. Supports per-user and per-IP limits.",
    checks: [
      { name: "CI / tests",      status: "passing" },
      { name: "CI / lint",       status: "passing" },
      { name: "Security scan",   status: "pending" },
    ],
    conflicts: false,
  },
  {
    id: 1479,
    title: "fix: resolve memory leak in websocket connection pool",
    author: "bob",
    authorAvatar: "B",
    repo: "realtime-service",
    branch: "fix/ws-pool-leak",
    base: "main",
    status: "open",
    size: "s",
    additions: 87,
    deletions: 64,
    filesChanged: 5,
    comments: 2,
    reviewers: [
      { name: "alice", avatar: "A", decision: "approved" },
      { name: "dave",  avatar: "D", decision: "pending" },
    ],
    labels: ["bug"],
    createdAt: "2025-02-21",
    updatedAt: "45m ago",
    description: "Fixes a leak where disconnected WebSocket clients were not removed from the pool.",
    checks: [
      { name: "CI / tests", status: "passing" },
      { name: "CI / lint",  status: "passing" },
    ],
    conflicts: false,
  },
  {
    id: 1475,
    title: "refactor: migrate auth service to Zod validation schemas",
    author: "carol",
    authorAvatar: "C",
    repo: "auth-service",
    branch: "refactor/zod-schemas",
    base: "main",
    status: "needs-review",
    size: "l",
    additions: 1240,
    deletions: 890,
    filesChanged: 34,
    comments: 9,
    reviewers: [
      { name: "alice", avatar: "A", decision: "changes-requested" },
      { name: "eve",   avatar: "E", decision: "commented" },
      { name: "frank", avatar: "F", decision: "pending" },
    ],
    labels: ["refactor", "breaking"],
    createdAt: "2025-02-18",
    updatedAt: "1d ago",
    description: "Replaces manual validation with Zod schemas across all auth endpoints. Includes migration guide.",
    checks: [
      { name: "CI / tests", status: "failing" },
      { name: "CI / lint",  status: "passing" },
    ],
    conflicts: true,
  },
  {
    id: 1468,
    title: "perf: lazy-load dashboard charts with IntersectionObserver",
    author: "dave",
    authorAvatar: "D",
    repo: "web-app",
    branch: "perf/lazy-charts",
    base: "main",
    status: "open",
    size: "s",
    additions: 210,
    deletions: 45,
    filesChanged: 8,
    comments: 1,
    reviewers: [
      { name: "alice", avatar: "A", decision: "approved" },
      { name: "carol", avatar: "C", decision: "approved" },
    ],
    labels: ["perf"],
    createdAt: "2025-02-19",
    updatedAt: "3h ago",
    description: "Defers chart rendering until the user scrolls them into view, improving initial load time by ~30%.",
    checks: [
      { name: "CI / tests", status: "passing" },
      { name: "Lighthouse",  status: "passing" },
    ],
    conflicts: false,
  },
  {
    id: 1461,
    title: "security: rotate JWT signing algorithm from HS256 to RS256",
    author: "eve",
    authorAvatar: "E",
    repo: "auth-service",
    branch: "security/rs256-rotation",
    base: "main",
    status: "needs-review",
    size: "m",
    additions: 445,
    deletions: 112,
    filesChanged: 18,
    comments: 6,
    reviewers: [
      { name: "alice", avatar: "A", decision: "commented" },
      { name: "frank", avatar: "F", decision: "pending" },
    ],
    labels: ["security", "breaking"],
    createdAt: "2025-02-17",
    updatedAt: "4h ago",
    description: "Switches JWT signing to RS256 using asymmetric keys. Requires key rotation runbook.",
    checks: [
      { name: "CI / tests",    status: "passing" },
      { name: "Security scan", status: "passing" },
      { name: "CI / lint",     status: "passing" },
    ],
    conflicts: false,
  },
  {
    id: 1458,
    title: "docs: add ADR for event-driven architecture decision",
    author: "frank",
    authorAvatar: "F",
    repo: "docs",
    branch: "docs/adr-events",
    base: "main",
    status: "open",
    size: "xs",
    additions: 120,
    deletions: 0,
    filesChanged: 2,
    comments: 0,
    reviewers: [
      { name: "alice", avatar: "A", decision: "approved" },
    ],
    labels: ["docs"],
    createdAt: "2025-02-21",
    updatedAt: "1h ago",
    description: "Adds ADR-007 documenting the decision to use event-driven architecture for notifications.",
    checks: [
      { name: "CI / lint", status: "passing" },
    ],
    conflicts: false,
  },
  {
    id: 1450,
    title: "feat: implement OAuth2 PKCE flow for mobile clients",
    author: "grace",
    authorAvatar: "G",
    repo: "auth-service",
    branch: "feat/pkce-mobile",
    base: "main",
    status: "draft",
    size: "xl",
    additions: 2100,
    deletions: 300,
    filesChanged: 52,
    comments: 0,
    reviewers: [],
    labels: ["feature"],
    createdAt: "2025-02-15",
    updatedAt: "2d ago",
    description: "Draft: PKCE flow implementation. Not ready for review yet — tests pending.",
    checks: [
      { name: "CI / tests", status: "failing" },
    ],
    conflicts: false,
  },
  {
    id: 1445,
    title: "chore: upgrade TypeScript 5.3 → 5.7 and fix type errors",
    author: "henry",
    authorAvatar: "H",
    repo: "web-app",
    branch: "chore/ts-upgrade",
    base: "main",
    status: "open",
    size: "m",
    additions: 560,
    deletions: 430,
    filesChanged: 28,
    comments: 3,
    reviewers: [
      { name: "carol", avatar: "C", decision: "changes-requested" },
    ],
    labels: ["chore"],
    createdAt: "2025-02-16",
    updatedAt: "6h ago",
    description: "Upgrades TypeScript to 5.7 and resolves all new strict mode errors.",
    checks: [
      { name: "CI / tests", status: "passing" },
      { name: "CI / lint",  status: "passing" },
    ],
    conflicts: false,
  },
];

const metrics: ReviewMetric[] = [
  { label: "Open PRs",         value: pullRequests.filter(p => p.status === "open" || p.status === "needs-review").length, delta: "+2 today" },
  { label: "Avg Review Time",  value: "4.2h", delta: "−0.8h", positive: true },
  { label: "Merge Rate (7d)",  value: "82%",  delta: "+5%", positive: true },
  { label: "Blocked by CI",    value: pullRequests.filter(p => p.checks.some(c => c.status === "failing")).length, delta: "0 today" },
];

// Weekly merge activity (last 7 days)
const weeklyData = [
  { day: "Mon", merged: 5, opened: 3 },
  { day: "Tue", merged: 8, opened: 6 },
  { day: "Wed", merged: 4, opened: 7 },
  { day: "Thu", merged: 9, opened: 4 },
  { day: "Fri", merged: 11, opened: 8 },
  { day: "Sat", merged: 2, opened: 1 },
  { day: "Sun", merged: 1, opened: 2 },
];
const maxVal = Math.max(...weeklyData.flatMap(d => [d.merged, d.opened]));

export default function CodeReviewDashboard() {
  const [tab, setTab]           = useState<"queue" | "detail" | "analytics" | "my-reviews">("queue");
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [statusFilter, setStatusFilter] = useState<PRStatus | "all">("all");

  const filteredPRs = statusFilter === "all"
    ? pullRequests
    : pullRequests.filter(p => p.status === statusFilter);

  const myReviews = pullRequests.filter(pr =>
    pr.reviewers.some(r => r.name === "alice")
  );

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "queue",      label: "Review Queue" },
    { id: "my-reviews", label: "My Reviews" },
    { id: "analytics",  label: "Analytics" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Code Review Dashboard</h1>
            <p className="text-zinc-400 text-sm mt-1">Pull requests, review queue, and team velocity</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
            + New PR
          </button>
        </div>

        {/* KPI metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {metrics.map(m => (
            <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{m.label}</p>
              <p className="text-3xl font-bold text-white mt-1">{m.value}</p>
              {m.delta && (
                <p className={cn("text-xs mt-1", m.positive === true ? "text-emerald-400" : m.positive === false ? "text-rose-400" : "text-zinc-500")}>
                  {m.delta}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedPR(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Review Queue */}
        {tab === "queue" && (
          <div className="space-y-4">
            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              {(["all", "needs-review", "open", "draft"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f === "all" ? "all" : f); setSelectedPR(null); }}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                    statusFilter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                  )}
                >
                  {f === "all" ? "All" : f === "needs-review" ? "Needs Review" : f.charAt(0).toUpperCase() + f.slice(1)}
                  <span className="ml-1.5 text-zinc-500">
                    {f === "all" ? pullRequests.length : pullRequests.filter(p => p.status === f).length}
                  </span>
                </button>
              ))}
            </div>

            {selectedPR ? (
              /* PR Detail */
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <button onClick={() => setSelectedPR(null)} className="text-zinc-400 hover:text-white text-sm">← Back</button>

                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[selectedPR.status])}>{selectedPR.status}</span>
                    <span className="text-xs text-zinc-500">#{selectedPR.id} in {selectedPR.repo}</span>
                  </div>
                  <h2 className="text-xl font-bold text-white">{selectedPR.title}</h2>
                  <p className="text-sm text-zinc-400 mt-1">{selectedPR.description}</p>
                </div>

                <div className="flex items-center gap-4 text-sm text-zinc-400">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white">{selectedPR.authorAvatar}</div>
                    <span>{selectedPR.author}</span>
                  </div>
                  <span className="text-zinc-600">{selectedPR.branch} → {selectedPR.base}</span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-500">Files</p>
                    <p className="text-lg font-bold text-white">{selectedPR.filesChanged}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-500">Added</p>
                    <p className="text-lg font-bold text-emerald-400">+{selectedPR.additions}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-500">Removed</p>
                    <p className="text-lg font-bold text-rose-400">-{selectedPR.deletions}</p>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
                    <p className="text-xs text-zinc-500">Comments</p>
                    <p className="text-lg font-bold text-zinc-300">{selectedPR.comments}</p>
                  </div>
                </div>

                {/* Checks */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">CI Checks</h3>
                  <div className="space-y-2">
                    {selectedPR.checks.map(c => (
                      <div key={c.name} className="flex items-center gap-3">
                        <span className={cn(
                          "w-2 h-2 rounded-full flex-shrink-0",
                          c.status === "passing" ? "bg-emerald-400" :
                          c.status === "failing" ? "bg-rose-400" : "bg-amber-400"
                        )} />
                        <span className="text-sm text-zinc-300">{c.name}</span>
                        <span className={cn(
                          "text-xs ml-auto",
                          c.status === "passing" ? "text-emerald-400" :
                          c.status === "failing" ? "text-rose-400" : "text-amber-400"
                        )}>{c.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedPR.conflicts && (
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-3 text-sm text-amber-400">
                    ⚠ Merge conflicts detected — resolve before merging
                  </div>
                )}

                {/* Reviewers */}
                <div>
                  <h3 className="text-sm font-semibold text-zinc-300 mb-3">Reviewers</h3>
                  <div className="space-y-2">
                    {selectedPR.reviewers.map(r => {
                      const d = decisionIcon[r.decision];
                      return (
                        <div key={r.name} className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">{r.avatar}</div>
                          <span className="text-sm text-zinc-300 flex-1">{r.name}</span>
                          <span className={cn("text-sm font-medium", d.color)}>{d.icon} {r.decision.split("-").join(" ")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-medium transition-colors">Approve</button>
                  <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">Request Changes</button>
                  <button className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg text-sm font-medium transition-colors">Comment</button>
                </div>
              </div>
            ) : (
              /* PR List */
              <div className="space-y-3">
                {filteredPRs.map(pr => (
                  <button
                    key={pr.id}
                    onClick={() => setSelectedPR(pr)}
                    className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[pr.status])}>{pr.status}</span>
                          <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", sizeColor[pr.size])}>SIZE-{pr.size.toUpperCase()}</span>
                          {pr.conflicts && <span className="text-xs bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">⚠ conflicts</span>}
                          {pr.labels.map(l => (
                            <span key={l} className={cn("text-xs px-1.5 py-0.5 rounded", labelColor[l] ?? "bg-zinc-500/20 text-zinc-400")}>{l}</span>
                          ))}
                        </div>
                        <p className="text-sm font-semibold text-white truncate">{pr.title}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          #{pr.id} · {pr.repo} · {pr.author} · Updated {pr.updatedAt}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex gap-1 justify-end">
                          {pr.reviewers.map(r => {
                            const d = decisionIcon[r.decision];
                            return (
                              <div key={r.name} className="relative">
                                <div className="w-6 h-6 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">{r.avatar}</div>
                                <span className={cn("absolute -bottom-0.5 -right-0.5 text-xs leading-none", d.color)}>{d.icon}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-500">
                      <span className="text-emerald-400">+{pr.additions}</span>
                      <span className="text-rose-400">-{pr.deletions}</span>
                      <span>{pr.filesChanged} files</span>
                      {pr.comments > 0 && <span>💬 {pr.comments}</span>}
                      <div className="flex gap-1 ml-auto">
                        {pr.checks.map(c => (
                          <div key={c.name} className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            c.status === "passing" ? "bg-emerald-400" :
                            c.status === "failing" ? "bg-rose-400" : "bg-amber-400"
                          )} title={`${c.name}: ${c.status}`} />
                        ))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* My Reviews */}
        {tab === "my-reviews" && (
          <div className="space-y-3">
            <p className="text-sm text-zinc-400">{myReviews.length} PRs waiting for your review or action</p>
            {myReviews.map(pr => {
              const myDecision = pr.reviewers.find(r => r.name === "alice")!;
              const d = decisionIcon[myDecision.decision];
              return (
                <div key={pr.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[pr.status])}>{pr.status}</span>
                        <span className={cn("text-sm font-medium", d.color)}>{d.icon} {myDecision.decision.split("-").join(" ")}</span>
                      </div>
                      <p className="text-sm font-semibold text-white">{pr.title}</p>
                      <p className="text-xs text-zinc-500 mt-0.5">#{pr.id} · {pr.repo} · by {pr.author} · {pr.updatedAt}</p>
                    </div>
                    {myDecision.decision === "pending" && (
                      <button className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-xs font-medium flex-shrink-0 transition-colors">
                        Review
                      </button>
                    )}
                  </div>
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span className="text-emerald-400">+{pr.additions}</span>
                    <span className="text-rose-400">-{pr.deletions}</span>
                    <span>{pr.filesChanged} files</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Analytics */}
        {tab === "analytics" && (
          <div className="space-y-6">
            {/* Weekly bar chart */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Weekly Activity</h2>
              <div className="flex items-end gap-3 h-32">
                {weeklyData.map(d => (
                  <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                    <div className="flex gap-0.5 items-end w-full">
                      <div
                        className="flex-1 bg-violet-500/70 rounded-t"
                        style={{ height: `${(d.merged / maxVal) * 100}px` }}
                        title={`Merged: ${d.merged}`}
                      />
                      <div
                        className="flex-1 bg-indigo-500/50 rounded-t"
                        style={{ height: `${(d.opened / maxVal) * 100}px` }}
                        title={`Opened: ${d.opened}`}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">{d.day}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4 mt-2">
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-violet-500/70" /><span className="text-xs text-zinc-400">Merged</span></div>
                <div className="flex items-center gap-2"><div className="w-3 h-3 rounded bg-indigo-500/50" /><span className="text-xs text-zinc-400">Opened</span></div>
              </div>
            </div>

            {/* Review time by author */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">PR Size Distribution</h2>
              <div className="space-y-3">
                {(["xs","s","m","l","xl"] as PRSize[]).map(size => {
                  const count = pullRequests.filter(p => p.size === size).length;
                  const pct = Math.round((count / pullRequests.length) * 100);
                  return (
                    <div key={size} className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium w-16", sizeColor[size])}>SIZE-{size.toUpperCase()}</span>
                      <div className="flex-1 bg-zinc-800 rounded-full h-2">
                        <div
                          className={cn("h-2 rounded-full", size === "xs" ? "bg-emerald-500" : size === "s" ? "bg-sky-500" : size === "m" ? "bg-amber-500" : size === "l" ? "bg-orange-500" : "bg-rose-500")}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-xs text-zinc-400 w-8 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top reviewers */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Top Reviewers (7d)</h2>
              <div className="space-y-2">
                {[
                  { name: "alice", reviews: 14, approved: 9, changes: 3 },
                  { name: "carol", reviews: 11, approved: 6, changes: 4 },
                  { name: "bob",   reviews: 8,  approved: 7, changes: 1 },
                  { name: "frank", reviews: 6,  approved: 3, changes: 2 },
                ].map(r => (
                  <div key={r.name} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-zinc-700 flex items-center justify-center text-xs font-bold">{r.name[0].toUpperCase()}</div>
                    <span className="text-sm text-zinc-300 flex-1">{r.name}</span>
                    <span className="text-xs text-zinc-500">{r.reviews} reviews</span>
                    <span className="text-xs text-emerald-400">{r.approved} ✓</span>
                    <span className="text-xs text-rose-400">{r.changes} ✗</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

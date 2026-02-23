import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CommitKind = "feat" | "fix" | "refactor" | "docs" | "chore" | "test" | "style";
type BranchStatus = "ahead" | "behind" | "synced" | "diverged";
type PRStatus = "open" | "merged" | "closed" | "draft";

interface GitCommit {
  sha: string;
  shortSha: string;
  message: string;
  kind: CommitKind;
  author: string;
  authorEmoji: string;
  branch: string;
  timestamp: string;
  additions: number;
  deletions: number;
  filesChanged: number;
  verified: boolean;
}

interface GitBranch {
  name: string;
  aheadBy: number;
  behindBy: number;
  status: BranchStatus;
  lastCommit: string;
  author: string;
  isProtected: boolean;
  isMegabranch: boolean;
}

interface PullRequest {
  number: number;
  title: string;
  author: string;
  authorEmoji: string;
  base: string;
  head: string;
  status: PRStatus;
  additions: number;
  deletions: number;
  filesChanged: number;
  reviewers: string[];
  approved: boolean;
  comments: number;
  createdAt: string;
  labels: string[];
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const COMMITS: GitCommit[] = [
  { sha: "785caf6", shortSha: "785caf6", message: "feat: views #80-81 — TeamDirectory, WorkflowBuilder", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T02:28:00Z", additions: 2455, deletions: 756, filesChanged: 124, verified: true },
  { sha: "9d119c0", shortSha: "9d119c0", message: "feat: views #82-83 wired — IntegrationHub, TokenBudgetPlanner", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T02:12:00Z", additions: 126, deletions: 121, filesChanged: 118, verified: true },
  { sha: "dfff3b5", shortSha: "dfff3b5", message: "feat: views #78-79 wired — ServiceMap, PromptOptimizer", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T02:00:00Z", additions: 1890, deletions: 430, filesChanged: 98, verified: true },
  { sha: "99d5848", shortSha: "99d5848", message: "feat: views #76-77 — GoalTracker, ResourceMonitor; fix ServiceMap TS", kind: "fix", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T01:45:00Z", additions: 1680, deletions: 210, filesChanged: 87, verified: true },
  { sha: "3e77d7f", shortSha: "3e77d7f", message: "feat: views #74-75 wired — AgentInbox, DependencyGraph", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T01:30:00Z", additions: 1240, deletions: 180, filesChanged: 76, verified: true },
  { sha: "caea701", shortSha: "caea701", message: "feat: views #70-71 wired — ModelRouter, SessionReplay", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T01:15:00Z", additions: 980, deletions: 120, filesChanged: 62, verified: true },
  { sha: "dc67380", shortSha: "dc67380", message: "feat: views #68-69 — AgentDiffViewer, MCPInspector", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T01:00:00Z", additions: 760, deletions: 95, filesChanged: 54, verified: true },
  { sha: "011f945", shortSha: "011f945", message: "feat: views #62-63 wired — CostOptimizer, PluginManager", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T00:45:00Z", additions: 620, deletions: 78, filesChanged: 48, verified: true },
  { sha: "801bdae", shortSha: "801bdae", message: "feat: views #60-61 — AgentTracer, DataPipelineViewer", kind: "feat", author: "Luis", authorEmoji: "🎨", branch: "master", timestamp: "2026-02-22T00:30:00Z", additions: 540, deletions: 62, filesChanged: 42, verified: true },
  { sha: "a4f2c18", shortSha: "a4f2c18", message: "fix: auth token validation race condition", kind: "fix", author: "Roman", authorEmoji: "⚙️", branch: "master", timestamp: "2026-02-21T22:10:00Z", additions: 48, deletions: 12, filesChanged: 3, verified: true },
  { sha: "b9e3d21", shortSha: "b9e3d21", message: "refactor: extract gateway middleware to shared module", kind: "refactor", author: "Tim", authorEmoji: "🏗️", branch: "master", timestamp: "2026-02-21T20:30:00Z", additions: 280, deletions: 340, filesChanged: 8, verified: true },
  { sha: "c7f4e92", shortSha: "c7f4e92", message: "docs: update AGENTS.md with new squad structure", kind: "docs", author: "Joey", authorEmoji: "📋", branch: "master", timestamp: "2026-02-21T18:00:00Z", additions: 94, deletions: 32, filesChanged: 2, verified: false },
];

const BRANCHES: GitBranch[] = [
  { name: "master", aheadBy: 0, behindBy: 0, status: "synced", lastCommit: "785caf6", author: "Luis", isProtected: true, isMegabranch: false },
  { name: "feat/horizon-ui-sprint", aheadBy: 89, behindBy: 0, status: "ahead", lastCommit: "785caf6", author: "Luis", isProtected: false, isMegabranch: true },
  { name: "feat/gateway-middleware", aheadBy: 4, behindBy: 0, status: "ahead", lastCommit: "b9e3d21", author: "Tim", isProtected: false, isMegabranch: true },
  { name: "feat/auth-improvements", aheadBy: 8, behindBy: 2, status: "diverged", lastCommit: "a4f2c18", author: "Roman", isProtected: false, isMegabranch: false },
  { name: "feat/ml-pipeline-v2", aheadBy: 12, behindBy: 0, status: "ahead", lastCommit: "d8a1b4c", author: "Claire", isProtected: false, isMegabranch: true },
  { name: "fix/rate-limiter-burst", aheadBy: 3, behindBy: 0, status: "ahead", lastCommit: "e2f9c1d", author: "Roman", isProtected: false, isMegabranch: false },
];

const PRS: PullRequest[] = [
  {
    number: 142,
    title: "feat: Horizon UI sprint — 80+ production-ready views",
    author: "Luis",
    authorEmoji: "🎨",
    base: "dgarson/fork",
    head: "feat/horizon-ui-sprint",
    status: "open",
    additions: 48420,
    deletions: 12800,
    filesChanged: 220,
    reviewers: ["Xavier", "Tim"],
    approved: false,
    comments: 3,
    createdAt: "2026-02-22T01:00:00Z",
    labels: ["frontend", "sprint", "priority-high"],
  },
  {
    number: 141,
    title: "refactor: extract gateway middleware to shared module",
    author: "Tim",
    authorEmoji: "🏗️",
    base: "dgarson/fork",
    head: "feat/gateway-middleware",
    status: "open",
    additions: 280,
    deletions: 340,
    filesChanged: 8,
    reviewers: ["Roman", "Xavier"],
    approved: true,
    comments: 7,
    createdAt: "2026-02-21T20:00:00Z",
    labels: ["backend", "refactor"],
  },
  {
    number: 140,
    title: "fix: auth token validation race condition",
    author: "Roman",
    authorEmoji: "⚙️",
    base: "dgarson/fork",
    head: "fix/auth-race",
    status: "merged",
    additions: 48,
    deletions: 12,
    filesChanged: 3,
    reviewers: ["Tim"],
    approved: true,
    comments: 2,
    createdAt: "2026-02-21T21:00:00Z",
    labels: ["bug", "security"],
  },
  {
    number: 139,
    title: "feat: ML pipeline v2 — streaming inference support",
    author: "Claire",
    authorEmoji: "🌟",
    base: "dgarson/fork",
    head: "feat/ml-pipeline-v2",
    status: "draft",
    additions: 1840,
    deletions: 290,
    filesChanged: 24,
    reviewers: ["Tim", "Roman"],
    approved: false,
    comments: 0,
    createdAt: "2026-02-21T16:00:00Z",
    labels: ["backend", "ml", "wip"],
  },
];

const KIND_CONFIG: Record<CommitKind, { color: string; bg: string; border: string }> = {
  feat: { color: "text-indigo-400", bg: "bg-indigo-900/30", border: "border-indigo-700/50" },
  fix: { color: "text-rose-400", bg: "bg-rose-900/30", border: "border-rose-700/50" },
  refactor: { color: "text-purple-400", bg: "bg-purple-900/30", border: "border-purple-700/50" },
  docs: { color: "text-blue-400", bg: "bg-blue-900/30", border: "border-blue-700/50" },
  chore: { color: "text-zinc-400", bg: "bg-zinc-800/50", border: "border-zinc-700" },
  test: { color: "text-emerald-400", bg: "bg-emerald-900/30", border: "border-emerald-700/50" },
  style: { color: "text-amber-400", bg: "bg-amber-900/30", border: "border-amber-700/50" },
};

const PR_STATUS_CONFIG: Record<PRStatus, { label: string; color: string; bg: string; border: string }> = {
  open: { label: "Open", color: "text-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50" },
  merged: { label: "Merged", color: "text-purple-400", bg: "bg-purple-900/20", border: "border-purple-700/50" },
  closed: { label: "Closed", color: "text-zinc-400", bg: "bg-zinc-800/50", border: "border-zinc-700" },
  draft: { label: "Draft", color: "text-zinc-400", bg: "bg-zinc-800/50", border: "border-zinc-700" },
};

const BRANCH_STATUS_CONFIG: Record<BranchStatus, { label: string; color: string }> = {
  ahead: { label: "Ahead", color: "text-emerald-400" },
  behind: { label: "Behind", color: "text-amber-400" },
  synced: { label: "Synced", color: "text-zinc-400" },
  diverged: { label: "Diverged", color: "text-rose-400" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function VersionControl() {
  const [activeTab, setActiveTab] = useState<"commits" | "branches" | "prs">("commits");
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(COMMITS[0]);
  const [selectedPR, setSelectedPR] = useState<PullRequest | null>(null);
  const [search, setSearch] = useState("");

  const filteredCommits = COMMITS.filter(
    (c) => !search || c.message.toLowerCase().includes(search.toLowerCase()) || c.shortSha.includes(search) || c.author.toLowerCase().includes(search.toLowerCase())
  );

  const totalAdditions = COMMITS.reduce((s, c) => s + c.additions, 0);
  const totalDeletions = COMMITS.reduce((s, c) => s + c.deletions, 0);
  const openPRs = PRS.filter((p) => p.status === "open" || p.status === "draft").length;

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Version Control</h1>
            <p className="text-sm text-zinc-400 font-mono">dgarson/clawdbot · master</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm">
            + New PR
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: "Commits", value: COMMITS.length, color: "text-white" },
            { label: "Branches", value: BRANCHES.length, color: "text-blue-400" },
            { label: "Open PRs", value: openPRs, color: "text-emerald-400" },
            { label: "Additions", value: `+${totalAdditions.toLocaleString()}`, color: "text-emerald-400" },
            { label: "Deletions", value: `-${totalDeletions.toLocaleString()}`, color: "text-rose-400" },
          ].map((s) => (
            <div key={s.label} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
              <div className={cn("text-lg font-bold font-mono", s.color)}>{s.value}</div>
              <div className="text-xs text-zinc-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-zinc-800 -mb-4">
          {(["commits", "branches", "prs"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors",
                activeTab === tab ? "border-indigo-500 text-white font-medium" : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab === "commits" ? `Commits (${COMMITS.length})` : tab === "branches" ? `Branches (${BRANCHES.length})` : `Pull Requests (${PRS.length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Main content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "commits" && (
            <div className="p-4">
              <div className="mb-3">
                <input
                  type="text"
                  placeholder="Search commits, SHA, author…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-1.5 text-sm w-80 placeholder:text-zinc-500"
                />
              </div>
              <div className="space-y-1">
                {filteredCommits.map((commit) => {
                  const kc = KIND_CONFIG[commit.kind];
                  const isSelected = selectedCommit?.sha === commit.sha;
                  return (
                    <button
                      key={commit.sha}
                      onClick={() => setSelectedCommit(isSelected ? null : commit)}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg border flex items-center gap-4 transition-all",
                        isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-zinc-900/50 border-zinc-800 hover:border-zinc-600"
                      )}
                    >
                      {/* SHA */}
                      <span className="font-mono text-xs text-zinc-500 w-16 flex-shrink-0">{commit.shortSha}</span>
                      {/* Kind badge */}
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border flex-shrink-0", kc.bg, kc.color, kc.border)}>
                        {commit.kind}
                      </span>
                      {/* Message */}
                      <span className="flex-1 text-sm text-zinc-200 truncate">{commit.message.replace(/^[a-z]+: /, "")}</span>
                      {/* Author */}
                      <span className="text-xs text-zinc-500 flex-shrink-0">{commit.authorEmoji} {commit.author}</span>
                      {/* Stats */}
                      <span className="text-xs text-emerald-400 flex-shrink-0">+{commit.additions.toLocaleString()}</span>
                      <span className="text-xs text-rose-400 flex-shrink-0">-{commit.deletions.toLocaleString()}</span>
                      {/* Time */}
                      <span className="text-xs text-zinc-600 flex-shrink-0 w-16 text-right">{commit.timestamp.slice(11, 16)} UTC</span>
                      {/* Verified */}
                      {commit.verified && <span className="text-emerald-400 text-xs flex-shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === "branches" && (
            <div className="p-4 space-y-2">
              {BRANCHES.map((branch) => {
                const bsc = BRANCH_STATUS_CONFIG[branch.status];
                return (
                  <div
                    key={branch.name}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-mono text-white font-medium truncate">{branch.name}</span>
                        {branch.isProtected && (
                          <span className="text-[10px] bg-amber-900/30 text-amber-400 border border-amber-700/50 px-1.5 py-0.5 rounded flex-shrink-0">🔒 Protected</span>
                        )}
                        {branch.isMegabranch && (
                          <span className="text-[10px] bg-indigo-900/30 text-indigo-400 border border-indigo-700/50 px-1.5 py-0.5 rounded flex-shrink-0">Megabranch</span>
                        )}
                      </div>
                      <div className="text-xs text-zinc-500">
                        Last commit: <span className="font-mono">{branch.lastCommit}</span> · {branch.author}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      {branch.aheadBy > 0 && (
                        <span className="text-xs text-emerald-400">↑ {branch.aheadBy} ahead</span>
                      )}
                      {branch.behindBy > 0 && (
                        <span className="text-xs text-amber-400">↓ {branch.behindBy} behind</span>
                      )}
                      <span className={cn("text-xs font-medium", bsc.color)}>{bsc.label}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2 py-1 rounded text-xs">Checkout</button>
                      {branch.name !== "master" && (
                        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-xs">PR</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === "prs" && (
            <div className="p-4 space-y-3">
              {PRS.map((pr) => {
                const prc = PR_STATUS_CONFIG[pr.status];
                const isSelected = selectedPR?.number === pr.number;
                return (
                  <button
                    key={pr.number}
                    onClick={() => setSelectedPR(isSelected ? null : pr)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all",
                      isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className={cn("text-xs px-2 py-0.5 rounded-full border", prc.bg, prc.color, prc.border)}>
                          {prc.label}
                        </span>
                        <span className="text-sm font-medium text-white">{pr.title}</span>
                      </div>
                      <span className="text-xs text-zinc-500 flex-shrink-0 ml-4">#{pr.number}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-zinc-400">
                      <span>{pr.authorEmoji} {pr.author}</span>
                      <span className="font-mono">{pr.head} → {pr.base}</span>
                      <span className="text-emerald-400">+{pr.additions.toLocaleString()}</span>
                      <span className="text-rose-400">-{pr.deletions.toLocaleString()}</span>
                      <span>{pr.filesChanged} files</span>
                      {pr.approved && <span className="text-emerald-400">✓ Approved</span>}
                      {pr.comments > 0 && <span>💬 {pr.comments}</span>}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {pr.labels.map((l) => (
                        <span key={l} className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                          {l}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail sidebar */}
        {selectedCommit && activeTab === "commits" && (
          <div className="flex-shrink-0 w-72 border-l border-zinc-800 bg-zinc-900/40 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-semibold text-white">Commit Detail</span>
              <button onClick={() => setSelectedCommit(null)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-zinc-500 mb-1">SHA</div>
                <div className="font-mono text-indigo-400">{selectedCommit.sha}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Message</div>
                <div className="text-zinc-300 leading-relaxed">{selectedCommit.message}</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-xs text-zinc-500">Author</div>
                  <div className="text-zinc-300">{selectedCommit.authorEmoji} {selectedCommit.author}</div>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-xs text-zinc-500">Branch</div>
                  <div className="font-mono text-xs text-zinc-300 truncate">{selectedCommit.branch}</div>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-xs text-zinc-500">Additions</div>
                  <div className="text-emerald-400 font-bold">+{selectedCommit.additions.toLocaleString()}</div>
                </div>
                <div className="bg-zinc-800/50 rounded p-2">
                  <div className="text-xs text-zinc-500">Deletions</div>
                  <div className="text-rose-400 font-bold">-{selectedCommit.deletions.toLocaleString()}</div>
                </div>
              </div>
              <div className="bg-zinc-800/50 rounded p-2">
                <div className="text-xs text-zinc-500 mb-1">Files Changed</div>
                <div className="text-white font-medium">{selectedCommit.filesChanged} files</div>
              </div>
              <div className="bg-zinc-800/50 rounded p-2">
                <div className="text-xs text-zinc-500 mb-1">Time</div>
                <div className="text-zinc-300 text-xs">{selectedCommit.timestamp.replace("T", " ").replace("Z", " UTC")}</div>
              </div>
              {selectedCommit.verified && (
                <div className="bg-emerald-900/20 border border-emerald-700/50 rounded p-2 flex items-center gap-2">
                  <span className="text-emerald-400">✓</span>
                  <span className="text-xs text-emerald-400">Verified signature</span>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <button className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-1.5 rounded text-xs">Browse files</button>
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white py-1.5 rounded text-xs">Revert</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

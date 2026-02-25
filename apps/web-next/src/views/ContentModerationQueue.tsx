import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type ContentType = "comment" | "post" | "image_description" | "bio";
type FlaggedReason =
  | "spam"
  | "hate_speech"
  | "harassment"
  | "explicit"
  | "misinformation"
  | "off_topic";
type Priority = "high" | "medium" | "low";
type Decision = "approved" | "removed" | "warned" | "escalated";

interface AICategory {
  label: string;
  score: number;
}

interface QueueItem {
  id: string;
  contentExcerpt: string;
  fullContent: string;
  author: string;
  submissionDate: string;
  contentType: ContentType;
  flaggedReason: FlaggedReason;
  aiConfidence: number;
  priority: Priority;
  aiCategories: AICategory[];
}

interface HistoryItem {
  id: string;
  contentExcerpt: string;
  author: string;
  decision: Decision;
  resolver: string;
  timestamp: string;
}

// ── Seed Data ──────────────────────────────────────────────────────────────

const QUEUE_ITEMS: QueueItem[] = [
  {
    id: "MOD-001",
    contentExcerpt: "FREE BITCOIN!! Visit my profile for guaranteed 10x returns on any crypto deposit...",
    fullContent:
      "FREE BITCOIN!! Visit my profile for guaranteed 10x returns on any crypto deposit. I've been making $50k/week with this simple method. Just send 0.1 BTC to get started and I'll send back 1.0 BTC within 24 hours. This is 100% legit, thousands of developers have already joined. DM me for the link! Not financial advice but also definitely financial advice.",
    author: "crypto_guru_2026",
    submissionDate: "2026-02-22T01:14:00Z",
    contentType: "comment",
    flaggedReason: "spam",
    aiConfidence: 97,
    priority: "high",
    aiCategories: [
      { label: "Spam", score: 97 },
      { label: "Scam/Fraud", score: 91 },
      { label: "Misleading", score: 78 },
      { label: "Harassment", score: 4 },
    ],
  },
  {
    id: "MOD-002",
    contentExcerpt: "This framework is mass-adopted only because of herd mentality. Anyone using it is a...",
    fullContent:
      "This framework is mass-adopted only because of herd mentality. Anyone using it is a brainless sheep following corporate propaganda. The maintainers are incompetent fools who couldn't code their way out of a for-loop. If you disagree with me you're part of the problem and should quit programming entirely.",
    author: "harsh_reviewer99",
    submissionDate: "2026-02-22T00:48:00Z",
    contentType: "comment",
    flaggedReason: "harassment",
    aiConfidence: 88,
    priority: "high",
    aiCategories: [
      { label: "Harassment", score: 88 },
      { label: "Toxicity", score: 82 },
      { label: "Hate Speech", score: 31 },
      { label: "Spam", score: 5 },
    ],
  },
  {
    id: "MOD-003",
    contentExcerpt: "My bio: Senior Developer | I build mass surveillance tools for authoritarian regimes and...",
    fullContent:
      "My bio: Senior Developer | I build mass surveillance tools for authoritarian regimes and I'm proud of it. DM me if your government needs help tracking dissidents. Also available for corporate espionage projects. Rates negotiable. All work done through untraceable shell companies.",
    author: "shadow_dev",
    submissionDate: "2026-02-21T22:30:00Z",
    contentType: "bio",
    flaggedReason: "explicit",
    aiConfidence: 79,
    priority: "high",
    aiCategories: [
      { label: "Policy Violation", score: 85 },
      { label: "Explicit", score: 79 },
      { label: "Threatening", score: 42 },
      { label: "Spam", score: 12 },
    ],
  },
  {
    id: "MOD-004",
    contentExcerpt: "EXPOSED: Node.js has a secret backdoor planted by the government to spy on all developers...",
    fullContent:
      "EXPOSED: Node.js has a secret backdoor planted by the government to spy on all developers. I decompiled the V8 engine and found hidden telemetry that sends your source code to a classified NSA server. Every npm install is monitored. Wake up people! Switch to my custom runtime (link in bio) which is the only safe option.",
    author: "truthseeker_dev",
    submissionDate: "2026-02-21T20:15:00Z",
    contentType: "post",
    flaggedReason: "misinformation",
    aiConfidence: 92,
    priority: "medium",
    aiCategories: [
      { label: "Misinformation", score: 92 },
      { label: "Conspiracy", score: 88 },
      { label: "Spam", score: 45 },
      { label: "Fear-mongering", score: 67 },
    ],
  },
  {
    id: "MOD-005",
    contentExcerpt: "Check out my SaaS landing page! We're revolutionizing the way you manage your...",
    fullContent:
      "Check out my SaaS landing page! We're revolutionizing the way you manage your bookmarks with AI-powered blockchain technology. Use code DEVFORUM50 for 50% off the first month. We've been featured on TechCrunch (not really but we will be soon). Star our repo and I'll star yours back! #SaaS #AI #Blockchain #StartupLife #DevTools",
    author: "saas_founder_mike",
    submissionDate: "2026-02-21T19:42:00Z",
    contentType: "post",
    flaggedReason: "spam",
    aiConfidence: 84,
    priority: "medium",
    aiCategories: [
      { label: "Spam", score: 84 },
      { label: "Self-promotion", score: 91 },
      { label: "Misleading", score: 38 },
      { label: "Harassment", score: 2 },
    ],
  },
  {
    id: "MOD-006",
    contentExcerpt: "Anybody know how to bypass API rate limits? I wrote a script that rotates through...",
    fullContent:
      "Anybody know how to bypass API rate limits? I wrote a script that rotates through stolen API keys I found on GitHub. Works great for scraping competitor data. Happy to share the script if anyone wants it. Also selling a list of 10k valid API keys for $50.",
    author: "hackerman_lite",
    submissionDate: "2026-02-21T18:20:00Z",
    contentType: "comment",
    flaggedReason: "explicit",
    aiConfidence: 94,
    priority: "high",
    aiCategories: [
      { label: "Policy Violation", score: 94 },
      { label: "Illegal Activity", score: 87 },
      { label: "Spam", score: 35 },
      { label: "Harmful", score: 72 },
    ],
  },
  {
    id: "MOD-007",
    contentExcerpt: "Why is everyone praising this library? It was clearly written by someone who doesn't understand...",
    fullContent:
      "Why is everyone praising this library? It was clearly written by someone who doesn't understand basic computer science. The algorithms used are O(n³) at best and the architecture is a textbook example of what NOT to do. I rewrote the entire thing in a weekend. People who contribute to this project are wasting their careers.",
    author: "elite_architect",
    submissionDate: "2026-02-21T17:55:00Z",
    contentType: "comment",
    flaggedReason: "harassment",
    aiConfidence: 62,
    priority: "medium",
    aiCategories: [
      { label: "Harassment", score: 62 },
      { label: "Toxicity", score: 58 },
      { label: "Opinion", score: 74 },
      { label: "Constructive", score: 15 },
    ],
  },
  {
    id: "MOD-008",
    contentExcerpt: "Posted an image described as: 'Screenshot showing private Slack messages from a company's...",
    fullContent:
      "Posted an image described as: 'Screenshot showing private Slack messages from a company's internal engineering channel, revealing unreleased product roadmap details, internal performance review excerpts of named employees, and salary figures. Names and profile photos of employees are clearly visible.'",
    author: "whistleblower_anon",
    submissionDate: "2026-02-21T16:10:00Z",
    contentType: "image_description",
    flaggedReason: "explicit",
    aiConfidence: 91,
    priority: "high",
    aiCategories: [
      { label: "Privacy Violation", score: 91 },
      { label: "Confidential Info", score: 88 },
      { label: "Doxxing", score: 76 },
      { label: "Harassment", score: 34 },
    ],
  },
  {
    id: "MOD-009",
    contentExcerpt: "Just want to share that tabs are objectively better than spaces and if you disagree you...",
    fullContent:
      "Just want to share that tabs are objectively better than spaces and if you disagree you should reconsider your life choices. This is a hill I will die on. Spaces people are the reason we can't have nice things in tech. Four spaces? Two spaces? Make up your minds already. Tabs gang forever.",
    author: "tab_crusader",
    submissionDate: "2026-02-21T15:00:00Z",
    contentType: "post",
    flaggedReason: "off_topic",
    aiConfidence: 43,
    priority: "low",
    aiCategories: [
      { label: "Off-topic", score: 43 },
      { label: "Low Quality", score: 52 },
      { label: "Humor", score: 61 },
      { label: "Harassment", score: 8 },
    ],
  },
  {
    id: "MOD-010",
    contentExcerpt: "According to my research, Python 4.0 will be released next month with full backward...",
    fullContent:
      "According to my research, Python 4.0 will be released next month with full backward compatibility, native compilation to machine code, and will replace C++ as the standard for OS development. Guido personally told me this at a conference. If you start learning Rust or Go now you're wasting your time because Python 4 will make them obsolete.",
    author: "python_prophet",
    submissionDate: "2026-02-21T14:22:00Z",
    contentType: "post",
    flaggedReason: "misinformation",
    aiConfidence: 86,
    priority: "medium",
    aiCategories: [
      { label: "Misinformation", score: 86 },
      { label: "Fabrication", score: 82 },
      { label: "Misleading", score: 79 },
      { label: "Humor/Satire", score: 22 },
    ],
  },
  {
    id: "MOD-011",
    contentExcerpt: "Hey everyone, selling premium Discord Nitro accounts at 80% off. Also got cheap GitHub...",
    fullContent:
      "Hey everyone, selling premium Discord Nitro accounts at 80% off. Also got cheap GitHub Copilot seats, JetBrains licenses, and AWS credits. All legitimate (wink). Payment via crypto only. Volume discounts available. DM me on Telegram @totallylegitdeals. Been doing this for 3 years with 500+ happy customers.",
    author: "deal_dealer",
    submissionDate: "2026-02-21T12:45:00Z",
    contentType: "comment",
    flaggedReason: "spam",
    aiConfidence: 96,
    priority: "high",
    aiCategories: [
      { label: "Spam", score: 96 },
      { label: "Scam/Fraud", score: 93 },
      { label: "Policy Violation", score: 88 },
      { label: "Harmful", score: 42 },
    ],
  },
  {
    id: "MOD-012",
    contentExcerpt: "Developers from [specific country] are ruining the industry by accepting low salaries and...",
    fullContent:
      "Developers from [specific country] are ruining the industry by accepting low salaries and producing garbage code. Every outsourced project I've seen from there is a disaster. They should be banned from contributing to open source until they learn to code properly. The entire region's education system is a joke.",
    author: "gatekeeping_gary",
    submissionDate: "2026-02-21T11:30:00Z",
    contentType: "comment",
    flaggedReason: "hate_speech",
    aiConfidence: 90,
    priority: "high",
    aiCategories: [
      { label: "Hate Speech", score: 90 },
      { label: "Xenophobia", score: 87 },
      { label: "Discrimination", score: 85 },
      { label: "Harassment", score: 54 },
    ],
  },
  {
    id: "MOD-013",
    contentExcerpt: "Full-stack developer | Open source contributor | Coffee addict | Building the future one...",
    fullContent:
      "Full-stack developer | Open source contributor | Coffee addict | Building the future one commit at a time | DM for consulting | Visit my site for free tutorials | Subscribe to my newsletter for weekly tips | Use my referral code DEVGURU for $100 off Lambda School | Also selling my Udemy course for $9.99 | Follow me on all platforms @devguru",
    author: "devguru_official",
    submissionDate: "2026-02-21T10:05:00Z",
    contentType: "bio",
    flaggedReason: "spam",
    aiConfidence: 68,
    priority: "low",
    aiCategories: [
      { label: "Spam", score: 68 },
      { label: "Self-promotion", score: 82 },
      { label: "Low Quality", score: 45 },
      { label: "Legitimate", score: 30 },
    ],
  },
  {
    id: "MOD-014",
    contentExcerpt: "This pull request is the worst code I've ever seen. The author clearly bought their degree...",
    fullContent:
      "This pull request is the worst code I've ever seen. The author clearly bought their degree from a diploma mill. I've reviewed thousands of PRs and this one physically hurt me. The variable names alone should be a fireable offense. How does someone this incompetent even get hired? Every senior engineer who approved this should be ashamed.",
    author: "brutal_reviewer",
    submissionDate: "2026-02-21T08:40:00Z",
    contentType: "comment",
    flaggedReason: "harassment",
    aiConfidence: 82,
    priority: "medium",
    aiCategories: [
      { label: "Harassment", score: 82 },
      { label: "Toxicity", score: 78 },
      { label: "Personal Attack", score: 72 },
      { label: "Code Review", score: 35 },
    ],
  },
];

const HISTORY_ITEMS: HistoryItem[] = [
  {
    id: "MOD-H01",
    contentExcerpt: "Buy followers and GitHub stars cheap! Guaranteed organic growth for your...",
    author: "growth_hacker_x",
    decision: "removed",
    resolver: "alice_mod",
    timestamp: "2026-02-21T09:15:00Z",
  },
  {
    id: "MOD-H02",
    contentExcerpt: "I think the new API design could be improved. Here's my honest critique...",
    author: "constructive_carl",
    decision: "approved",
    resolver: "bob_mod",
    timestamp: "2026-02-21T08:50:00Z",
  },
  {
    id: "MOD-H03",
    contentExcerpt: "All self-taught developers are inferior to CS graduates and should know their place...",
    author: "degree_snob",
    decision: "warned",
    resolver: "alice_mod",
    timestamp: "2026-02-21T07:30:00Z",
  },
  {
    id: "MOD-H04",
    contentExcerpt: "Found a critical vulnerability in production. Posting full exploit code here before...",
    author: "zero_day_poster",
    decision: "escalated",
    resolver: "charlie_mod",
    timestamp: "2026-02-21T06:45:00Z",
  },
  {
    id: "MOD-H05",
    contentExcerpt: "Join my Telegram group for daily trading signals. 100% win rate on all...",
    author: "signals_king",
    decision: "removed",
    resolver: "bob_mod",
    timestamp: "2026-02-21T05:20:00Z",
  },
  {
    id: "MOD-H06",
    contentExcerpt: "This library's documentation is confusing and the examples don't work on Windows...",
    author: "frustrated_frank",
    decision: "approved",
    resolver: "alice_mod",
    timestamp: "2026-02-20T23:10:00Z",
  },
  {
    id: "MOD-H07",
    contentExcerpt: "Posting private Discord DMs from the maintainer where they admitted the project is...",
    author: "leaker_2026",
    decision: "removed",
    resolver: "charlie_mod",
    timestamp: "2026-02-20T21:40:00Z",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  comment: "Comment",
  post: "Post",
  image_description: "Image",
  bio: "Bio",
};

const REASON_LABELS: Record<FlaggedReason, string> = {
  spam: "Spam",
  hate_speech: "Hate Speech",
  harassment: "Harassment",
  explicit: "Explicit",
  misinformation: "Misinfo",
  off_topic: "Off-topic",
};

const PRIORITY_STYLES: Record<Priority, string> = {
  high: "bg-rose-400/15 text-rose-400 border-rose-400/30",
  medium: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  low: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/40",
};

const REASON_STYLES: Record<FlaggedReason, string> = {
  spam: "bg-amber-400/15 text-amber-400",
  hate_speech: "bg-rose-400/15 text-rose-400",
  harassment: "bg-orange-400/15 text-orange-400",
  explicit: "bg-red-400/15 text-red-400",
  misinformation: "bg-purple-400/15 text-purple-400",
  off_topic: "bg-[var(--color-surface-3)]/15 text-[var(--color-text-secondary)]",
};

const DECISION_STYLES: Record<Decision, { bg: string; emoji: string }> = {
  approved: { bg: "text-emerald-400", emoji: "✓" },
  removed: { bg: "text-rose-400", emoji: "✕" },
  warned: { bg: "text-amber-400", emoji: "⚠" },
  escalated: { bg: "text-primary", emoji: "↑" },
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 60) {return `${diffMin}m ago`;}
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {return `${diffHr}h ago`;}
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function truncate(text: string, max: number): string {
  if (text.length <= max) {return text;}
  return text.slice(0, max) + "…";
}

function confidenceColor(score: number): string {
  if (score >= 80) {return "bg-rose-400";}
  if (score >= 60) {return "bg-amber-400";}
  return "bg-emerald-400";
}

function confidenceBarBg(score: number): string {
  if (score >= 80) {return "bg-rose-400/20";}
  if (score >= 60) {return "bg-amber-400/20";}
  return "bg-emerald-400/20";
}

// ── Component ──────────────────────────────────────────────────────────────

type Tab = "queue" | "history";

export default function ContentModerationQueue() {
  const [activeTab, setActiveTab] = useState<Tab>("queue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [localHistory, setLocalHistory] = useState<HistoryItem[]>(HISTORY_ITEMS);

  // Filters
  const [filterType, setFilterType] = useState<ContentType | "all">("all");
  const [filterReason, setFilterReason] = useState<FlaggedReason | "all">("all");
  const [filterPriority, setFilterPriority] = useState<Priority | "all">("all");

  const pendingItems = QUEUE_ITEMS.filter((item) => {
    if (resolvedIds.has(item.id)) {return false;}
    if (filterType !== "all" && item.contentType !== filterType) {return false;}
    if (filterReason !== "all" && item.flaggedReason !== filterReason) {return false;}
    if (filterPriority !== "all" && item.priority !== filterPriority) {return false;}
    return true;
  });

  const selectedItem = QUEUE_ITEMS.find((i) => i.id === selectedId) ?? null;

  const totalQueue = QUEUE_ITEMS.filter((i) => !resolvedIds.has(i.id)).length;
  const resolvedToday = localHistory.length;
  const escalatedCount = localHistory.filter((h) => h.decision === "escalated").length;

  function handleAction(decision: Decision) {
    if (!selectedItem) {return;}
    const entry: HistoryItem = {
      id: selectedItem.id,
      contentExcerpt: truncate(selectedItem.contentExcerpt, 80),
      author: selectedItem.author,
      decision,
      resolver: "you",
      timestamp: new Date().toISOString(),
    };
    setLocalHistory((prev) => [entry, ...prev]);
    setResolvedIds((prev) => new Set(prev).add(selectedItem.id));
    setSelectedId(null);
  }

  // ── Stats Bar ──────────────────────────────────────────────────────────

  function StatsBar() {
    return (
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Queue Size", value: totalQueue, icon: "📋", accent: "text-primary" },
          { label: "Avg Review", value: "2.4m", icon: "⏱", accent: "text-[var(--color-text-primary)]" },
          { label: "Resolved Today", value: resolvedToday, icon: "✓", accent: "text-emerald-400" },
          { label: "Escalated", value: escalatedCount, icon: "↑", accent: "text-amber-400" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-4 py-3 flex items-center gap-3"
          >
            <span className="text-xl">{stat.icon}</span>
            <div>
              <p className={cn("text-lg font-semibold", stat.accent)}>{stat.value}</p>
              <p className="text-xs text-[var(--color-text-muted)]">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── Filter Bar ─────────────────────────────────────────────────────────

  function FilterBar() {
    const selectBase =
      "bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-1.5 outline-none focus:border-primary transition-colors";
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">Filters</span>
        <select
          className={selectBase}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as ContentType | "all")}
        >
          <option value="all">All Types</option>
          {(Object.keys(CONTENT_TYPE_LABELS) as ContentType[]).map((t) => (
            <option key={t} value={t}>
              {CONTENT_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
        <select
          className={selectBase}
          value={filterReason}
          onChange={(e) => setFilterReason(e.target.value as FlaggedReason | "all")}
        >
          <option value="all">All Reasons</option>
          {(Object.keys(REASON_LABELS) as FlaggedReason[]).map((r) => (
            <option key={r} value={r}>
              {REASON_LABELS[r]}
            </option>
          ))}
        </select>
        <select
          className={selectBase}
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as Priority | "all")}
        >
          <option value="all">All Priorities</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        {(filterType !== "all" || filterReason !== "all" || filterPriority !== "all") && (
          <button
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors underline"
            onClick={() => {
              setFilterType("all");
              setFilterReason("all");
              setFilterPriority("all");
            }}
          >
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-[var(--color-text-muted)]">
          {pendingItems.length} item{pendingItems.length !== 1 ? "s" : ""}
        </span>
      </div>
    );
  }

  // ── Queue Row ──────────────────────────────────────────────────────────

  function QueueRow({ item }: { item: QueueItem }) {
    const isSelected = selectedId === item.id;
    return (
      <button
        onClick={() => setSelectedId(isSelected ? null : item.id)}
        className={cn(
          "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 transition-colors",
          isSelected
            ? "bg-primary/10 border-l-2 border-l-indigo-500"
            : "hover:bg-[var(--color-surface-2)]/50 border-l-2 border-l-transparent"
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-[var(--color-text-primary)] truncate">{item.contentExcerpt}</p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className="text-xs text-[var(--color-text-muted)]">@{item.author}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-xs text-[var(--color-text-muted)]">{formatDate(item.submissionDate)}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-xs text-[var(--color-text-muted)]">{CONTENT_TYPE_LABELS[item.contentType]}</span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase px-2 py-0.5 rounded border",
                PRIORITY_STYLES[item.priority]
              )}
            >
              {item.priority}
            </span>
            <span className={cn("text-[10px] px-2 py-0.5 rounded", REASON_STYLES[item.flaggedReason])}>
              {REASON_LABELS[item.flaggedReason]}
            </span>
            <span className={cn("text-[10px] font-mono", item.aiConfidence >= 80 ? "text-rose-400" : item.aiConfidence >= 60 ? "text-amber-400" : "text-emerald-400")}>
              {item.aiConfidence}% AI
            </span>
          </div>
        </div>
      </button>
    );
  }

  // ── Review Panel ───────────────────────────────────────────────────────

  function ReviewPanel({ item }: { item: QueueItem }) {
    const notes = reviewNotes[item.id] ?? "";
    return (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden flex flex-col h-full">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[var(--color-text-primary)] font-semibold text-sm">{item.id}</h3>
              <span
                className={cn(
                  "text-[10px] font-semibold uppercase px-2 py-0.5 rounded border",
                  PRIORITY_STYLES[item.priority]
                )}
              >
                {item.priority}
              </span>
            </div>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              @{item.author} · {CONTENT_TYPE_LABELS[item.contentType]} · {formatDate(item.submissionDate)}
            </p>
          </div>
          <button
            onClick={() => setSelectedId(null)}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Content Preview */}
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Full Content</p>
          <div className="bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-lg p-3 text-sm text-[var(--color-text-primary)] leading-relaxed max-h-40 overflow-y-auto">
            {item.fullContent}
          </div>
        </div>

        {/* AI Analysis */}
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider">AI Analysis</p>
            <span
              className={cn(
                "text-xs font-mono font-semibold",
                item.aiConfidence >= 80
                  ? "text-rose-400"
                  : item.aiConfidence >= 60
                  ? "text-amber-400"
                  : "text-emerald-400"
              )}
            >
              {item.aiConfidence}% confidence
            </span>
          </div>
          <div className="space-y-2.5">
            {item.aiCategories.map((cat) => (
              <div key={cat.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">{cat.label}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{cat.score}%</span>
                </div>
                <div className={cn("h-1.5 rounded-full overflow-hidden", confidenceBarBg(cat.score))}>
                  <div
                    className={cn("h-full rounded-full transition-all", confidenceColor(cat.score))}
                    style={{ width: `${cat.score}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Flagged reason badge */}
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Flagged For</p>
          <span className={cn("text-xs px-2.5 py-1 rounded-md", REASON_STYLES[item.flaggedReason])}>
            {REASON_LABELS[item.flaggedReason]}
          </span>
        </div>

        {/* Notes */}
        <div className="px-5 py-4 border-b border-[var(--color-border)]">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-2">Reviewer Notes</p>
          <textarea
            className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 outline-none focus:border-primary transition-colors resize-none h-20 placeholder:text-[var(--color-text-muted)]"
            placeholder="Add notes about your decision..."
            value={notes}
            onChange={(e) =>
              setReviewNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
            }
          />
        </div>

        {/* Action Buttons */}
        <div className="px-5 py-4 mt-auto">
          <p className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">Actions</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handleAction("approved")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 transition-colors"
            >
              ✓ Approve
            </button>
            <button
              onClick={() => handleAction("removed")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 transition-colors"
            >
              ✕ Remove
            </button>
            <button
              onClick={() => handleAction("warned")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              ⚠ Warn User
            </button>
            <button
              onClick={() => handleAction("escalated")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 transition-colors"
            >
              ↑ Escalate
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── History Tab ────────────────────────────────────────────────────────

  function HistoryList() {
    return (
      <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Recently Resolved</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{localHistory.length} items</p>
        </div>
        <div className="divide-y divide-[var(--color-border)]/60 max-h-[600px] overflow-y-auto">
          {localHistory.map((item) => {
            const ds = DECISION_STYLES[item.decision];
            return (
              <div key={item.id + item.timestamp} className="px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-[var(--color-text-primary)] truncate">{item.contentExcerpt}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-[var(--color-text-muted)]">@{item.author}</span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs text-[var(--color-text-muted)]">by {item.resolver}</span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span className="text-xs text-[var(--color-text-muted)]">{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                  <span className={cn("text-xs font-semibold flex items-center gap-1", ds.bg)}>
                    {ds.emoji} {item.decision}
                  </span>
                </div>
              </div>
            );
          })}
          {localHistory.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-[var(--color-text-muted)]">No resolved items yet</div>
          )}
        </div>
      </div>
    );
  }

  // ── Main Layout ────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-[1440px] mx-auto space-y-5">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Content Moderation</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Review flagged content and take action</p>
          </div>
          <div className="flex items-center gap-1 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab("queue")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "queue"
                  ? "bg-primary text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Queue
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                activeTab === "history"
                  ? "bg-primary text-[var(--color-text-primary)]"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              History
            </button>
          </div>
        </div>

        {/* Stats */}
        <StatsBar />

        {activeTab === "queue" ? (
          <>
            {/* Filters */}
            <FilterBar />

            {/* Queue + Review Panel */}
            <div className="flex gap-5 items-start">
              {/* Queue List */}
              <div
                className={cn(
                  "bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden transition-all",
                  selectedItem ? "w-[55%]" : "w-full"
                )}
              >
                <div className="max-h-[640px] overflow-y-auto">
                  {pendingItems.map((item) => (
                    <QueueRow key={item.id} item={item} />
                  ))}
                  {pendingItems.length === 0 && (
                    <div className="px-4 py-12 text-center">
                      <p className="text-[var(--color-text-muted)] text-sm">
                        {resolvedIds.size > 0
                          ? "All items in current filter have been resolved"
                          : "No items match current filters"}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Review Panel */}
              {selectedItem && (
                <div className="w-[45%] sticky top-6">
                  <ReviewPanel item={selectedItem} />
                </div>
              )}
            </div>
          </>
        ) : (
          <HistoryList />
        )}
      </div>
    </div>
  );
}

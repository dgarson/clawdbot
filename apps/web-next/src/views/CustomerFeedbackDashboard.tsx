import React, { useState } from "react";
import { cn } from "../lib/utils";

type SentimentScore = "promoter" | "passive" | "detractor";
type FeedbackCategory = "ux" | "performance" | "features" | "pricing" | "support" | "onboarding";
type FeedbackChannel = "in-app" | "email" | "slack" | "twitter" | "support";

interface FeedbackItem {
  id: string;
  userId: string;
  userName: string;
  plan: "free" | "pro" | "enterprise";
  npsScore: number;
  category: FeedbackCategory;
  channel: FeedbackChannel;
  sentiment: SentimentScore;
  message: string;
  tags: string[];
  submittedAt: string;
  agentVersion: string;
  resolved: boolean;
  upvotes: number;
}

interface NPSSurvey {
  month: string;
  score: number;
  responses: number;
  promoters: number;
  passives: number;
  detractors: number;
}

const FEEDBACK: FeedbackItem[] = [
  {
    id: "f1", userId: "u_a7b3c", userName: "Alex M.", plan: "enterprise",
    npsScore: 9, category: "ux", channel: "in-app", sentiment: "promoter",
    message: "The new Horizon UI is outstanding. The dark theme is exactly what power users need. The 100+ views make it feel like a complete platform — not just an MVP. I especially love the agent pulse monitor.",
    tags: ["dark-theme", "power-user", "positive"], submittedAt: "2026-02-22T02:15:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 14,
  },
  {
    id: "f2", userId: "u_k9m2d", userName: "Keisha D.", plan: "pro",
    npsScore: 4, category: "performance", channel: "email", sentiment: "detractor",
    message: "The app feels slow when switching between views. There's a noticeable delay and a loading spinner every time. Please cache views or do something to make navigation feel instant.",
    tags: ["performance", "lazy-loading", "ux-friction"], submittedAt: "2026-02-21T18:30:00Z", agentVersion: "1.9.5", resolved: false, upvotes: 23,
  },
  {
    id: "f3", userId: "u_r2x8f", userName: "Ravi S.", plan: "enterprise",
    npsScore: 10, category: "features", channel: "slack", sentiment: "promoter",
    message: "The API playground view is incredible. Being able to test endpoints directly inside the agent console without switching tools is a game changer. Saves my team at least 30 minutes a day.",
    tags: ["api-playground", "productivity", "enterprise"], submittedAt: "2026-02-21T14:00:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 31,
  },
  {
    id: "f4", userId: "u_l4p7w", userName: "Lyra P.", plan: "free",
    npsScore: 7, category: "onboarding", channel: "in-app", sentiment: "passive",
    message: "The onboarding flow was a bit confusing. There are so many features and I wasn't sure where to start. A 'recommended first steps' wizard would help. The checklist view was useful though!",
    tags: ["onboarding", "discovery", "first-time-user"], submittedAt: "2026-02-21T11:45:00Z", agentVersion: "2.0.0", resolved: true, upvotes: 8,
  },
  {
    id: "f5", userId: "u_m3n1c", userName: "Marcus N.", plan: "pro",
    npsScore: 2, category: "pricing", channel: "email", sentiment: "detractor",
    message: "Just discovered the rate limiting feature is Pro-only. I need it for basic use cases. The pricing tiers feel arbitrary — core agent controls shouldn't be locked away. Considering downgrading.",
    tags: ["pricing", "feature-gating", "retention-risk"], submittedAt: "2026-02-20T22:00:00Z", agentVersion: "1.9.5", resolved: false, upvotes: 41,
  },
  {
    id: "f6", userId: "u_s9q4v", userName: "Sora Q.", plan: "enterprise",
    npsScore: 9, category: "features", channel: "support", sentiment: "promoter",
    message: "The threat intelligence feed and security policy editor are exactly what our SecOps team needed. Excellent work. One request: can we get SSO integration with Okta documented better?",
    tags: ["security", "enterprise", "sso", "docs"], submittedAt: "2026-02-20T16:30:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 7,
  },
  {
    id: "f7", userId: "u_j7h5b", userName: "Jordan H.", plan: "free",
    npsScore: 8, category: "ux", channel: "twitter", sentiment: "promoter",
    message: "The keyboard shortcuts in the new UI are so good. Especially the command palette. I can navigate everything without touching the mouse now. 10/10 DX improvement.",
    tags: ["keyboard", "command-palette", "power-user"], submittedAt: "2026-02-19T20:15:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 52,
  },
  {
    id: "f8", userId: "u_c6r3t", userName: "Claire R.", plan: "pro",
    npsScore: 6, category: "support", channel: "in-app", sentiment: "passive",
    message: "Had an issue with the webhook playground not saving my HMAC secret between sessions. Support responded quickly but the fix took a week to deploy. Response time is good, deploy speed is not.",
    tags: ["bugs", "webhooks", "deploy-speed"], submittedAt: "2026-02-19T09:00:00Z", agentVersion: "1.9.5", resolved: true, upvotes: 12,
  },
  {
    id: "f9", userId: "u_p2k8n", userName: "Priya K.", plan: "enterprise",
    npsScore: 10, category: "ux", channel: "in-app", sentiment: "promoter",
    message: "The A11y audit dashboard caught 9 real accessibility violations in our product that we'd missed. This kind of built-in tooling is why we chose this platform. Please keep investing here.",
    tags: ["accessibility", "a11y", "built-in-tooling"], submittedAt: "2026-02-18T15:45:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 19,
  },
  {
    id: "f10", userId: "u_w1m4q", userName: "Wei M.", plan: "pro",
    npsScore: 3, category: "performance", channel: "email", sentiment: "detractor",
    message: "The gantt chart view lags noticeably on my M3 MacBook when I have all 22 tasks visible. The div-based rendering seems CPU intensive compared to a proper SVG approach. Please profile this.",
    tags: ["performance", "gantt", "rendering"], submittedAt: "2026-02-18T10:30:00Z", agentVersion: "2.0.0", resolved: false, upvotes: 9,
  },
];

const NPS_HISTORY: NPSSurvey[] = [
  { month: "Sep 2025", score: 28, responses: 142, promoters: 52, passives: 45, detractors: 45 },
  { month: "Oct 2025", score: 35, responses: 167, promoters: 63, passives: 52, detractors: 52 },
  { month: "Nov 2025", score: 41, responses: 198, promoters: 78, passives: 64, detractors: 56 },
  { month: "Dec 2025", score: 38, responses: 156, promoters: 64, passives: 50, detractors: 42 },
  { month: "Jan 2026", score: 47, responses: 234, promoters: 103, passives: 79, detractors: 52 },
  { month: "Feb 2026", score: 58, responses: 189, promoters: 98, passives: 64, detractors: 27 },
];

const CATEGORY_CONFIG: Record<FeedbackCategory, { label: string; emoji: string; color: string }> = {
  ux:          { label: "UX/Design",    emoji: "🎨", color: "text-purple-400" },
  performance: { label: "Performance",  emoji: "⚡", color: "text-amber-400" },
  features:    { label: "Features",     emoji: "✨", color: "text-indigo-400" },
  pricing:     { label: "Pricing",      emoji: "💰", color: "text-rose-400" },
  support:     { label: "Support",      emoji: "🎧", color: "text-teal-400" },
  onboarding:  { label: "Onboarding",  emoji: "🚀", color: "text-sky-400" },
};

const SENTIMENT_CONFIG: Record<SentimentScore, { label: string; emoji: string; color: string; bg: string; range: string }> = {
  promoter:  { label: "Promoter",  emoji: "😍", color: "text-emerald-400", bg: "bg-emerald-900/30 border-emerald-800", range: "9-10" },
  passive:   { label: "Passive",   emoji: "😐", color: "text-amber-400",   bg: "bg-amber-900/30 border-amber-800",    range: "7-8" },
  detractor: { label: "Detractor", emoji: "😞", color: "text-rose-400",    bg: "bg-rose-900/30 border-rose-800",      range: "0-6" },
};

const PLAN_CONFIG: Record<string, { label: string; color: string }> = {
  free:       { label: "Free",       color: "text-zinc-400 bg-zinc-800" },
  pro:        { label: "Pro",        color: "text-indigo-400 bg-indigo-900/30" },
  enterprise: { label: "Enterprise", color: "text-amber-400 bg-amber-900/30" },
};

const CHANNEL_CONFIG: Record<FeedbackChannel, string> = {
  "in-app": "📱", email: "📧", slack: "💬", twitter: "🐦", support: "🎧",
};

type Tab = "overview" | "feed" | "nps-trend" | "insights";

export default function CustomerFeedbackDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentScore | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<FeedbackCategory | "all">("all");
  const [planFilter, setPlanFilter] = useState<string>("all");

  const latestNPS = NPS_HISTORY[NPS_HISTORY.length - 1];
  const prevNPS = NPS_HISTORY[NPS_HISTORY.length - 2];
  const npsChange = latestNPS.score - prevNPS.score;

  const promoterCount = FEEDBACK.filter(f => f.sentiment === "promoter").length;
  const detractorCount = FEEDBACK.filter(f => f.sentiment === "detractor").length;
  const passiveCount = FEEDBACK.filter(f => f.sentiment === "passive").length;
  const totalUpvotes = FEEDBACK.reduce((a, f) => a + f.upvotes, 0);

  const filteredFeedback = FEEDBACK.filter(f => {
    if (sentimentFilter !== "all" && f.sentiment !== sentimentFilter) {return false;}
    if (categoryFilter !== "all" && f.category !== categoryFilter) {return false;}
    if (planFilter !== "all" && f.plan !== planFilter) {return false;}
    return true;
  });

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview",   label: "Overview",    emoji: "📊" },
    { id: "feed",       label: "Feedback",    emoji: "💬" },
    { id: "nps-trend",  label: "NPS Trend",   emoji: "📈" },
    { id: "insights",   label: "Insights",    emoji: "💡" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Customer Feedback</h1>
        <p className="text-zinc-400 text-sm mt-1">NPS tracking and feedback analysis for Horizon UI v2.0</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id ? "text-white bg-zinc-800 border border-b-0 border-zinc-700" : "text-zinc-400 hover:text-white"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Overview */}
      {tab === "overview" && (
        <div className="space-y-5">
          {/* Key metrics */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 col-span-1">
              <div className="flex items-end gap-2 mb-1">
                <div className={cn("text-4xl font-bold", latestNPS.score >= 50 ? "text-emerald-400" : latestNPS.score >= 30 ? "text-amber-400" : "text-rose-400")}>
                  {latestNPS.score}
                </div>
                <span className={cn("text-sm font-medium mb-1", npsChange >= 0 ? "text-emerald-400" : "text-rose-400")}>
                  {npsChange >= 0 ? "▲" : "▼"} {Math.abs(npsChange)}
                </span>
              </div>
              <div className="text-xs text-zinc-400">NPS Score (Feb 2026)</div>
              <div className="text-xs text-zinc-600 mt-0.5">{latestNPS.responses} responses</div>
            </div>
            {[
              { label: "Promoters",   value: promoterCount,  extra: `${Math.round(promoterCount/FEEDBACK.length*100)}%`, color: "text-emerald-400" },
              { label: "Passives",    value: passiveCount,   extra: `${Math.round(passiveCount/FEEDBACK.length*100)}%`,  color: "text-amber-400" },
              { label: "Detractors",  value: detractorCount, extra: `${Math.round(detractorCount/FEEDBACK.length*100)}%`, color: "text-rose-400" },
            ].map(s => (
              <div key={s.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
                <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
                <div className="text-xs text-zinc-400 mt-0.5">{s.label}</div>
                <div className={cn("text-xs mt-1", s.color)}>{s.extra} of responses</div>
              </div>
            ))}
          </div>

          {/* NPS breakdown bar */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm font-semibold text-zinc-300">NPS Breakdown — Feb 2026</div>
              <div className="text-xs text-zinc-500">{latestNPS.responses} total responses</div>
            </div>
            <div className="flex h-8 rounded-lg overflow-hidden gap-0.5">
              {[
                { pct: (latestNPS.promoters/latestNPS.responses)*100,  color: "bg-emerald-500", label: "Promoters" },
                { pct: (latestNPS.passives/latestNPS.responses)*100,   color: "bg-amber-500",   label: "Passives" },
                { pct: (latestNPS.detractors/latestNPS.responses)*100, color: "bg-rose-500",    label: "Detractors" },
              ].map(seg => (
                <div key={seg.label} className={cn("flex items-center justify-center text-xs text-white font-medium rounded", seg.color)} style={{ width: `${seg.pct}%` }}>
                  {seg.pct > 10 ? `${Math.round(seg.pct)}%` : ""}
                </div>
              ))}
            </div>
            <div className="flex gap-4 mt-2">
              {[
                { label: `Promoters (9-10)`, value: latestNPS.promoters,  color: "bg-emerald-500" },
                { label: `Passives (7-8)`,   value: latestNPS.passives,   color: "bg-amber-500" },
                { label: `Detractors (0-6)`, value: latestNPS.detractors, color: "bg-rose-500" },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5 text-xs text-zinc-400">
                  <div className={cn("w-2 h-2 rounded-full", l.color)} />
                  {l.label}: <strong className="text-white">{l.value}</strong>
                </div>
              ))}
            </div>
          </div>

          {/* Category breakdown */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-4">Feedback by Category</div>
            {Object.entries(CATEGORY_CONFIG).map(([cat, cfg]) => {
              const count = FEEDBACK.filter(f => f.category === cat).length;
              const pct = (count / FEEDBACK.length) * 100;
              const avgScore = FEEDBACK.filter(f => f.category === cat).reduce((a, f) => a + f.npsScore, 0) / (count || 1);
              return (
                <div key={cat} className="flex items-center gap-3 mb-3">
                  <span className="text-sm w-32 truncate">{cfg.emoji} {cfg.label}</span>
                  <div className="flex-1 bg-zinc-800 rounded-full h-2">
                    <div className={cn("h-full rounded-full", avgScore >= 8 ? "bg-emerald-500" : avgScore >= 6 ? "bg-amber-500" : "bg-rose-500")} style={{ width: `${pct * 3}%`, maxWidth: "100%" }} />
                  </div>
                  <div className="text-xs text-zinc-500 w-8 text-right">{count}</div>
                  <div className={cn("text-xs font-medium w-8 text-right", avgScore >= 8 ? "text-emerald-400" : avgScore >= 6 ? "text-amber-400" : "text-rose-400")}>
                    {avgScore.toFixed(1)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Feedback Feed */}
      {tab === "feed" && (
        <div className="flex gap-4">
          {/* Filters */}
          <div className="w-48 shrink-0 space-y-4">
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Sentiment</div>
              {(["all", "promoter", "passive", "detractor"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSentimentFilter(s)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 mb-1 transition-colors",
                    sentimentFilter === s ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {s !== "all" && SENTIMENT_CONFIG[s].emoji}
                  {s === "all" ? "All" : SENTIMENT_CONFIG[s].label}
                  <span className="ml-auto text-xs text-zinc-600">
                    {s === "all" ? FEEDBACK.length : FEEDBACK.filter(f => f.sentiment === s).length}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Category</div>
              {(["all", ...Object.keys(CATEGORY_CONFIG)] as const).map(c => (
                <button
                  key={c}
                  onClick={() => setCategoryFilter(c as FeedbackCategory | "all")}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-sm mb-1 transition-colors",
                    categoryFilter === c ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {c === "all" ? "All Categories" : `${CATEGORY_CONFIG[c as FeedbackCategory].emoji} ${CATEGORY_CONFIG[c as FeedbackCategory].label}`}
                </button>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Plan</div>
              {["all", "free", "pro", "enterprise"].map(p => (
                <button
                  key={p}
                  onClick={() => setPlanFilter(p)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-sm mb-1 transition-colors",
                    planFilter === p ? "bg-zinc-800 text-white" : "text-zinc-400 hover:text-white"
                  )}
                >
                  {p === "all" ? "All Plans" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Feed */}
          <div className="flex-1 space-y-3">
            {filteredFeedback.toSorted((a, b) => b.upvotes - a.upvotes).map(item => (
              <div
                key={item.id}
                onClick={() => setSelectedFeedback(selectedFeedback?.id === item.id ? null : item)}
                className={cn(
                  "bg-zinc-900 border rounded-lg p-4 cursor-pointer transition-colors",
                  selectedFeedback?.id === item.id ? "border-indigo-600" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl shrink-0">{SENTIMENT_CONFIG[item.sentiment].emoji}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-medium text-white text-sm">{item.userName}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded", PLAN_CONFIG[item.plan].color)}>{item.plan.charAt(0).toUpperCase() + item.plan.slice(1)}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded border", SENTIMENT_CONFIG[item.sentiment].color, SENTIMENT_CONFIG[item.sentiment].bg)}>
                        NPS {item.npsScore}
                      </span>
                      <span className="text-xs text-zinc-500">{CHANNEL_CONFIG[item.channel]} {item.channel}</span>
                      <span className={cn("text-xs font-medium", CATEGORY_CONFIG[item.category].color)}>
                        {CATEGORY_CONFIG[item.category].emoji} {CATEGORY_CONFIG[item.category].label}
                      </span>
                      <span className="ml-auto text-xs text-zinc-500">▲ {item.upvotes}</span>
                    </div>
                    <p className={cn("text-sm", selectedFeedback?.id === item.id ? "text-zinc-200" : "text-zinc-400 line-clamp-2")}>
                      {item.message}
                    </p>
                    {selectedFeedback?.id === item.id && (
                      <div className="mt-3 space-y-2" onClick={e => e.stopPropagation()}>
                        <div className="flex flex-wrap gap-1">
                          {item.tags.map(tag => (
                            <span key={tag} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">#{tag}</span>
                          ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>v{item.agentVersion}</span>
                          <span>{new Date(item.submittedAt).toLocaleString()}</span>
                          {item.resolved && <span className="text-emerald-400">✅ Resolved</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* NPS Trend */}
      {tab === "nps-trend" && (
        <div className="space-y-5">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-5">NPS Score Trend (6 months)</div>
            {/* Bar chart */}
            <div className="flex items-end gap-4 h-40 mb-3">
              {NPS_HISTORY.map(survey => {
                const h = Math.max(((survey.score + 100) / 200) * 100, 5);
                const color = survey.score >= 50 ? "bg-emerald-500" : survey.score >= 30 ? "bg-indigo-500" : survey.score >= 0 ? "bg-amber-500" : "bg-rose-500";
                return (
                  <div key={survey.month} className="flex-1 flex flex-col items-center gap-1">
                    <div className="text-xs text-zinc-400 font-medium">{survey.score}</div>
                    <div className={cn("w-full rounded-t", color)} style={{ height: `${h}%` }} />
                    <div className="text-xs text-zinc-600 text-center" style={{ fontSize: "10px" }}>{survey.month}</div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  {["Month", "NPS Score", "Responses", "Promoters", "Passives", "Detractors"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {NPS_HISTORY.map((survey, i) => {
                  const prev = NPS_HISTORY[i - 1];
                  const change = prev ? survey.score - prev.score : 0;
                  return (
                    <tr key={survey.month} className={cn("border-b border-zinc-800/50", i === NPS_HISTORY.length - 1 ? "bg-zinc-800/20" : "")}>
                      <td className="px-4 py-3 font-medium text-white">{survey.month}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={cn("font-bold text-lg", survey.score >= 50 ? "text-emerald-400" : survey.score >= 30 ? "text-indigo-400" : "text-amber-400")}>
                            {survey.score}
                          </span>
                          {prev && (
                            <span className={cn("text-xs", change >= 0 ? "text-emerald-400" : "text-rose-400")}>
                              {change >= 0 ? "▲" : "▼"}{Math.abs(change)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{survey.responses}</td>
                      <td className="px-4 py-3 text-emerald-400">{survey.promoters} ({Math.round(survey.promoters/survey.responses*100)}%)</td>
                      <td className="px-4 py-3 text-amber-400">{survey.passives} ({Math.round(survey.passives/survey.responses*100)}%)</td>
                      <td className="px-4 py-3 text-rose-400">{survey.detractors} ({Math.round(survey.detractors/survey.responses*100)}%)</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insights */}
      {tab === "insights" && (
        <div className="space-y-4">
          {/* Top themes */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <div className="text-sm font-semibold text-zinc-300 mb-4">🔥 Most Upvoted Feedback</div>
            {FEEDBACK.toSorted((a, b) => b.upvotes - a.upvotes).slice(0, 5).map((item, i) => (
              <div key={item.id} className="flex items-start gap-3 mb-4 pb-4 border-b border-zinc-800/50 last:border-0 last:mb-0 last:pb-0">
                <div className="text-zinc-600 font-bold text-lg w-6 shrink-0">#{i + 1}</div>
                <div className="text-2xl shrink-0">{SENTIMENT_CONFIG[item.sentiment].emoji}</div>
                <div className="flex-1">
                  <div className="text-sm text-zinc-300 mb-1">"{item.message.slice(0, 100)}..."</div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <span>{item.userName}</span>
                    <span>·</span>
                    <span className={cn(PLAN_CONFIG[item.plan].color.split(" ")[0])}>{item.plan}</span>
                    <span>·</span>
                    <span>{CATEGORY_CONFIG[item.category].emoji} {CATEGORY_CONFIG[item.category].label}</span>
                    <span className="ml-auto text-zinc-400 font-medium">▲ {item.upvotes} upvotes</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Action items */}
          <div className="bg-amber-900/20 border border-amber-900 rounded-lg p-5">
            <div className="text-sm font-semibold text-amber-300 mb-4">⚠️ Action Items from Detractors</div>
            {FEEDBACK.filter(f => f.sentiment === "detractor").map(item => (
              <div key={item.id} className="flex items-start gap-3 mb-3">
                <span className="text-rose-400 font-bold text-sm w-6 shrink-0">!</span>
                <div>
                  <div className="text-sm text-zinc-300">
                    <strong>{CATEGORY_CONFIG[item.category].label}:</strong> {item.message.slice(0, 80)}...
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    {item.userName} · NPS {item.npsScore} · {item.upvotes} upvotes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

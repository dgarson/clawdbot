import React, { useState } from "react";
import { cn } from "../lib/utils";

type AnnouncementStatus = "draft" | "scheduled" | "live" | "expired";
type TargetAudience = "all" | "enterprise" | "pro" | "free" | "beta";
type AnnouncementType = "feature" | "maintenance" | "update" | "deprecation" | "incident";
type Tab = "announcements" | "compose" | "targeting" | "analytics";

interface Announcement {
  id: string;
  title: string;
  body: string;
  type: AnnouncementType;
  status: AnnouncementStatus;
  audience: TargetAudience[];
  publishedAt: string | null;
  expiresAt: string | null;
  author: string;
  cta: string | null;
  ctaUrl: string | null;
  impressions: number;
  clicks: number;
  dismissals: number;
  pinned: boolean;
  tags: string[];
}

const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a1", title: "Introducing AI-Powered Code Review", body: "We're excited to launch our new AI code review assistant that automatically detects bugs, security issues, and style violations before your PR merges.",
    type: "feature", status: "live", audience: ["all"], publishedAt: "2h ago", expiresAt: "30d",
    author: "Luis", cta: "Try it now", ctaUrl: "/code-review", impressions: 12843, clicks: 3421, dismissals: 1204, pinned: true, tags: ["ai", "code-review", "new"],
  },
  {
    id: "a2", title: "Scheduled Maintenance — Feb 28 02:00 UTC", body: "We will be performing infrastructure maintenance on Saturday Feb 28 between 02:00–04:00 UTC. API availability may be intermittently affected.",
    type: "maintenance", status: "scheduled", audience: ["all"], publishedAt: null, expiresAt: "28 Feb",
    author: "ops-team", cta: "Status page", ctaUrl: "/status", impressions: 0, clicks: 0, dismissals: 0, pinned: false, tags: ["maintenance", "downtime"],
  },
  {
    id: "a3", title: "New Dashboard: ML Pipeline Monitor", body: "Track your machine learning training runs, model registry, and GPU utilization from one unified view.",
    type: "feature", status: "live", audience: ["enterprise", "pro"], publishedAt: "1d ago", expiresAt: "60d",
    author: "Luis", cta: "Open dashboard", ctaUrl: "/ml-pipeline", impressions: 4231, clicks: 1876, dismissals: 342, pinned: false, tags: ["ml", "monitoring"],
  },
  {
    id: "a4", title: "Legacy API v1 Deprecation Notice", body: "API v1 endpoints will be deprecated on March 31, 2026. All integrations must migrate to v2. See the migration guide for details.",
    type: "deprecation", status: "live", audience: ["all"], publishedAt: "3d ago", expiresAt: "Mar 31",
    author: "platform-team", cta: "Migration guide", ctaUrl: "/docs/v2-migration", impressions: 8923, clicks: 2341, dismissals: 1891, pinned: true, tags: ["api", "deprecation", "migration"],
  },
  {
    id: "a5", title: "Enhanced SSO: SAML 2.0 Support", body: "Enterprise customers can now configure SAML 2.0 identity providers in addition to OIDC. Supports Okta, Azure AD, and custom IdPs.",
    type: "update", status: "live", audience: ["enterprise"], publishedAt: "5d ago", expiresAt: "45d",
    author: "security-team", cta: "Configure SSO", ctaUrl: "/sso", impressions: 1823, clicks: 612, dismissals: 89, pinned: false, tags: ["sso", "enterprise", "security"],
  },
  {
    id: "a6", title: "Beta: Natural Language Query Builder", body: "Ask questions in plain English and get SQL queries auto-generated. Now available in beta for all plans.",
    type: "feature", status: "live", audience: ["beta", "enterprise"], publishedAt: "7d ago", expiresAt: "90d",
    author: "Luis", cta: "Join beta", ctaUrl: "/settings/beta", impressions: 2341, clicks: 987, dismissals: 124, pinned: false, tags: ["beta", "ai", "sql"],
  },
  {
    id: "a7", title: "Q1 2026 Product Roadmap Update", body: "We've published our Q1 roadmap with details on upcoming features including real-time collaboration, native mobile apps, and expanded AI capabilities.",
    type: "update", status: "draft", audience: ["all"], publishedAt: null, expiresAt: null,
    author: "product-team", cta: "View roadmap", ctaUrl: "/roadmap", impressions: 0, clicks: 0, dismissals: 0, pinned: false, tags: ["roadmap", "q1-2026"],
  },
  {
    id: "a8", title: "Performance Improvements — 40% Faster Load Times", body: "We've completed a major infrastructure optimization that reduces page load times by up to 40% across all dashboard views.",
    type: "update", status: "expired", audience: ["all"], publishedAt: "30d ago", expiresAt: "Expired",
    author: "platform-team", cta: null, ctaUrl: null, impressions: 31241, clicks: 4521, dismissals: 8234, pinned: false, tags: ["performance"],
  },
];

const typeIcon: Record<AnnouncementType, string> = {
  feature: "✨",
  maintenance: "🔧",
  update: "📦",
  deprecation: "⚠️",
  incident: "🚨",
};

const typeBadge: Record<AnnouncementType, string> = {
  feature: "bg-indigo-500/10 border-indigo-500/30 text-indigo-400",
  maintenance: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  update: "bg-sky-500/10 border-sky-500/30 text-sky-400",
  deprecation: "bg-rose-500/10 border-rose-500/30 text-rose-400",
  incident: "bg-red-600/15 border-red-500/40 text-red-400",
};

const statusBadge: Record<AnnouncementStatus, string> = {
  draft: "bg-zinc-700/30 border-zinc-600 text-zinc-400",
  scheduled: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  live: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  expired: "bg-zinc-700/30 border-zinc-600 text-zinc-500",
};

const audienceLabel: Record<TargetAudience, string> = {
  all: "All users",
  enterprise: "Enterprise",
  pro: "Pro",
  free: "Free",
  beta: "Beta",
};

export default function AnnouncementCenter() {
  const [tab, setTab] = useState<Tab>("announcements");
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "announcements", label: "Announcements", emoji: "📣" },
    { id: "compose", label: "Compose", emoji: "✏️" },
    { id: "targeting", label: "Targeting", emoji: "🎯" },
    { id: "analytics", label: "Analytics", emoji: "📊" },
  ];

  const filtered = ANNOUNCEMENTS.filter(a => {
    if (typeFilter !== "all" && a.type !== typeFilter) return false;
    if (statusFilter !== "all" && a.status !== statusFilter) return false;
    return true;
  });

  const liveCount = ANNOUNCEMENTS.filter(a => a.status === "live").length;
  const totalImpressions = ANNOUNCEMENTS.reduce((s, a) => s + a.impressions, 0);
  const totalClicks = ANNOUNCEMENTS.reduce((s, a) => s + a.clicks, 0);
  const avgCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : "0";

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Announcement Center</h1>
          <p className="text-xs text-zinc-500 mt-0.5">In-app notifications, release notes, and product updates</p>
        </div>
        <button className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
          + New Announcement
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-0 border-b border-zinc-800">
        {[
          { label: "Live Announcements", value: String(liveCount), sub: "currently showing" },
          { label: "Total Impressions", value: totalImpressions.toLocaleString(), sub: "all time" },
          { label: "Total Clicks", value: totalClicks.toLocaleString(), sub: "all time" },
          { label: "Avg CTR", value: `${avgCtr}%`, sub: "click-through rate" },
        ].map((stat, i) => (
          <div key={i} className="px-6 py-3 border-r border-zinc-800 last:border-r-0">
            <div className="text-xl font-bold text-white">{stat.value}</div>
            <div className="text-xs font-medium text-zinc-400 mt-0.5">{stat.label}</div>
            <div className="text-xs text-zinc-600 mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-zinc-800 px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-500 hover:text-zinc-300"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* ANNOUNCEMENTS TAB */}
        {tab === "announcements" && (
          <div className="flex h-full">
            {/* List */}
            <div className="w-96 border-r border-zinc-800 flex flex-col">
              <div className="p-3 space-y-2 border-b border-zinc-800">
                <div className="flex gap-2">
                  <select
                    value={typeFilter}
                    onChange={e => setTypeFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All types</option>
                    <option value="feature">Feature</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="update">Update</option>
                    <option value="deprecation">Deprecation</option>
                    <option value="incident">Incident</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-300"
                  >
                    <option value="all">All status</option>
                    <option value="live">Live</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="draft">Draft</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(ann => (
                  <button
                    key={ann.id}
                    onClick={() => setSelected(ann)}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-900 transition-colors",
                      selected?.id === ann.id && "bg-zinc-800"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        {ann.pinned && <span className="text-xs text-amber-400">📌</span>}
                        <span className="text-sm font-medium text-zinc-200 leading-snug line-clamp-1">{ann.title}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", typeBadge[ann.type])}>
                        {typeIcon[ann.type]} {ann.type}
                      </span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded border", statusBadge[ann.status])}>
                        {ann.status}
                      </span>
                      {ann.impressions > 0 && (
                        <span className="text-xs text-zinc-600 ml-auto">{ann.impressions.toLocaleString()} views</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto">
              {selected ? (
                <div className="p-6 space-y-6">
                  <div>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          {selected.pinned && <span className="text-amber-400 text-sm">📌 Pinned</span>}
                          <span className={cn("text-xs px-2 py-0.5 rounded border", typeBadge[selected.type])}>
                            {typeIcon[selected.type]} {selected.type}
                          </span>
                          <span className={cn("text-xs px-2 py-0.5 rounded border", statusBadge[selected.status])}>
                            {selected.status}
                          </span>
                        </div>
                        <h2 className="text-lg font-semibold text-white">{selected.title}</h2>
                        <p className="text-xs text-zinc-500 mt-1">by {selected.author} · {selected.publishedAt || "Not published"}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">Edit</button>
                        {selected.status === "draft" && (
                          <button className="px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">Publish</button>
                        )}
                        {selected.status === "live" && (
                          <button className="px-3 py-1.5 text-xs bg-amber-500/20 border border-amber-500/40 rounded text-amber-400 hover:bg-amber-500/30 transition-colors">Expire Now</button>
                        )}
                      </div>
                    </div>

                    {/* Preview */}
                    <div className={cn(
                      "rounded-lg border p-5",
                      selected.type === "deprecation" ? "bg-rose-500/5 border-rose-500/20" :
                      selected.type === "maintenance" ? "bg-amber-500/5 border-amber-500/20" :
                      selected.type === "feature" ? "bg-indigo-500/5 border-indigo-500/20" :
                      "bg-zinc-900 border-zinc-700"
                    )}>
                      <div className="flex items-start gap-3">
                        <span className="text-2xl">{typeIcon[selected.type]}</span>
                        <div className="flex-1">
                          <div className="font-semibold text-sm text-white mb-1">{selected.title}</div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{selected.body}</p>
                          {selected.cta && (
                            <button className="mt-3 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">
                              {selected.cta} →
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Audience */}
                  <div>
                    <div className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Target Audience</div>
                    <div className="flex gap-2 flex-wrap">
                      {selected.audience.map(a => (
                        <span key={a} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 rounded text-xs text-zinc-300">{audienceLabel[a]}</span>
                      ))}
                    </div>
                  </div>

                  {/* Metrics */}
                  {selected.impressions > 0 && (
                    <div>
                      <div className="text-xs text-zinc-500 mb-3 uppercase tracking-wider">Performance</div>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Impressions", value: selected.impressions.toLocaleString() },
                          { label: "Clicks", value: selected.clicks.toLocaleString() },
                          { label: "CTR", value: `${((selected.clicks / selected.impressions) * 100).toFixed(1)}%` },
                          { label: "Dismissals", value: selected.dismissals.toLocaleString() },
                          { label: "Dismiss Rate", value: `${((selected.dismissals / selected.impressions) * 100).toFixed(1)}%` },
                          { label: "Engagement", value: `${(((selected.clicks + selected.dismissals) / selected.impressions) * 100).toFixed(0)}%` },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-zinc-900 rounded p-3 text-center">
                            <div className="text-lg font-bold text-white">{value}</div>
                            <div className="text-xs text-zinc-500 mt-0.5">{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex gap-2 flex-wrap">
                    {selected.tags.map(tag => (
                      <span key={tag} className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400 font-mono">{tag}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-600 text-sm">Select an announcement to view details</div>
              )}
            </div>
          </div>
        )}

        {/* COMPOSE TAB */}
        {tab === "compose" && (
          <div className="max-w-2xl mx-auto p-6 space-y-5">
            <h2 className="text-sm font-semibold text-zinc-300">New Announcement</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Title</label>
                <input type="text" placeholder="What are you announcing?" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Body</label>
                <textarea rows={4} placeholder="Describe the announcement in detail..." className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500 resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Type</label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300">
                    <option value="feature">✨ Feature</option>
                    <option value="update">📦 Update</option>
                    <option value="maintenance">🔧 Maintenance</option>
                    <option value="deprecation">⚠️ Deprecation</option>
                    <option value="incident">🚨 Incident</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">Audience</label>
                  <select className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300">
                    <option value="all">All users</option>
                    <option value="enterprise">Enterprise only</option>
                    <option value="pro">Pro + Enterprise</option>
                    <option value="beta">Beta users</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">CTA Button (optional)</label>
                  <input type="text" placeholder="e.g. Learn more" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">CTA URL (optional)</label>
                  <input type="text" placeholder="/docs/new-feature" className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder-zinc-600 outline-none focus:border-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1.5">Expires After</label>
                <select className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300">
                  <option>7 days</option>
                  <option>14 days</option>
                  <option>30 days</option>
                  <option>60 days</option>
                  <option>Never</option>
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input type="checkbox" className="w-3 h-3" />
                  Pin to top of feed
                </label>
              </div>
              <div className="flex gap-3">
                <button className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">Save as Draft</button>
                <button className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 rounded text-white transition-colors">Publish Now</button>
                <button className="px-4 py-2 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded text-zinc-300 transition-colors">Schedule</button>
              </div>
            </div>
          </div>
        )}

        {/* TARGETING TAB */}
        {tab === "targeting" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Audience Segments</h2>
              <div className="grid grid-cols-2 gap-4">
                {([
                  { audience: "all" as TargetAudience, count: 48231, live: 3 },
                  { audience: "enterprise" as TargetAudience, count: 2341, live: 2 },
                  { audience: "pro" as TargetAudience, count: 12893, live: 1 },
                  { audience: "beta" as TargetAudience, count: 891, live: 2 },
                ]).map(seg => (
                  <div key={seg.audience} className="bg-zinc-900 rounded-lg border border-zinc-800 p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-zinc-200">{audienceLabel[seg.audience]}</span>
                      <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">{seg.live} live</span>
                    </div>
                    <div className="text-2xl font-bold text-white mb-1">{seg.count.toLocaleString()}</div>
                    <div className="text-xs text-zinc-500">users in segment</div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Delivery Channels</h2>
              <div className="space-y-3">
                {[
                  { name: "In-app banner", desc: "Shown at top of dashboard on next login", enabled: true, reach: "100%" },
                  { name: "Email digest", desc: "Included in weekly product digest email", enabled: true, reach: "68%" },
                  { name: "Push notification", desc: "Mobile app push (beta users only)", enabled: false, reach: "23%" },
                  { name: "Changelog feed", desc: "Appears in /changelog timeline", enabled: true, reach: "100%" },
                ].map(channel => (
                  <div key={channel.name} className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-zinc-200">{channel.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{channel.desc}</div>
                    </div>
                    <div className="text-xs text-zinc-500">{channel.reach} reach</div>
                    <div className={cn(
                      "w-9 h-5 rounded-full relative cursor-pointer transition-colors",
                      channel.enabled ? "bg-indigo-600" : "bg-zinc-700"
                    )}>
                      <div className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform", channel.enabled ? "translate-x-4" : "translate-x-0.5")} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="p-6 space-y-6">
            {/* 14-day impression trend */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Daily Impressions — Last 14 days</h2>
              <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-4">
                <div className="flex items-end gap-1 h-24">
                  {[2341, 3102, 2891, 4231, 3891, 5123, 4712, 3892, 4521, 6012, 5823, 7234, 6891, 8012].map((v, i) => (
                    <div key={i} className="flex-1 flex flex-col justify-end gap-0.5">
                      <div
                        className="bg-indigo-500/70 hover:bg-indigo-500 rounded-sm transition-colors cursor-pointer"
                        style={{ height: `${(v / 8012) * 96}px` }}
                        title={v.toLocaleString()}
                      />
                    </div>
                  ))}
                </div>
                <div className="flex justify-between mt-2 text-xs text-zinc-600">
                  <span>Feb 8</span>
                  <span>Feb 15</span>
                  <span>Feb 22</span>
                </div>
              </div>
            </div>

            {/* Top performing */}
            <div>
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">Top Performing Announcements</h2>
              <div className="space-y-2">
                {ANNOUNCEMENTS.filter(a => a.impressions > 0).sort((a, b) => b.clicks / b.impressions - a.clicks / a.impressions).map(ann => {
                  const ctr = ((ann.clicks / ann.impressions) * 100).toFixed(1);
                  return (
                    <div key={ann.id} className="bg-zinc-900 rounded-lg border border-zinc-800 px-4 py-3 flex items-center gap-4">
                      <span className="text-lg shrink-0">{typeIcon[ann.type]}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-zinc-200 truncate">{ann.title}</div>
                        <div className="text-xs text-zinc-600 mt-0.5">{ann.impressions.toLocaleString()} impressions</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-sm font-bold text-emerald-400">{ctr}%</div>
                        <div className="text-xs text-zinc-600">CTR</div>
                      </div>
                      <div className="w-20">
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${Math.min(parseFloat(ctr) * 4, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

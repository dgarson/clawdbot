import React, { useState } from "react";
import { cn } from "../lib/utils";

type FeatureStatus = "submitted" | "under-review" | "planned" | "in-progress" | "shipped" | "declined";
type Priority = "critical" | "high" | "medium" | "low";
type Category = "ux" | "performance" | "integration" | "api" | "security" | "analytics";

interface FeatureRequest {
  id: string;
  title: string;
  description: string;
  status: FeatureStatus;
  priority: Priority;
  category: Category;
  votes: number;
  comments: number;
  submittedBy: string;
  submittedAt: string;
  targetRelease: string;
  eta: string;
  effort: "S" | "M" | "L" | "XL";
  tags: string[];
  customerCount: number;
  mrr: number;
}

interface RoadmapItem {
  id: string;
  title: string;
  quarter: string;
  status: "planned" | "in-progress" | "shipped";
  featureIds: string[];
  percentDone: number;
}

interface Comment {
  id: string;
  featureId: string;
  author: string;
  role: string;
  text: string;
  timestamp: string;
  isTeam: boolean;
}

interface VoteBreakdown {
  category: Category;
  count: number;
  mrr: number;
}

const FEATURES: FeatureRequest[] = [
  { id: "f1", title: "Bulk export to CSV/Excel", description: "Allow users to export all dashboard data to CSV or Excel format with custom column selection and date range filters.", status: "planned", priority: "high", category: "ux", votes: 847, comments: 34, submittedBy: "enterprise@acme.com", submittedAt: "3mo ago", targetRelease: "v3.4", eta: "Q2 2026", effort: "M", tags: ["export", "data", "enterprise"], customerCount: 142, mrr: 48000 },
  { id: "f2", title: "Webhook retry with exponential backoff", description: "When webhook delivery fails, automatically retry with exponential backoff up to configurable max attempts before marking as failed.", status: "in-progress", priority: "critical", category: "api", votes: 623, comments: 19, submittedBy: "dev@startup.io", submittedAt: "2mo ago", targetRelease: "v3.3", eta: "Q1 2026", effort: "S", tags: ["webhooks", "reliability"], customerCount: 89, mrr: 32000 },
  { id: "f3", title: "SSO with SAML 2.0", description: "Support SAML 2.0 for enterprise SSO in addition to existing OIDC support. Required for most enterprise procurement approvals.", status: "planned", priority: "critical", category: "security", votes: 512, comments: 28, submittedBy: "it@bigcorp.com", submittedAt: "4mo ago", targetRelease: "v3.5", eta: "Q3 2026", effort: "XL", tags: ["sso", "saml", "enterprise"], customerCount: 67, mrr: 81000 },
  { id: "f4", title: "Dark mode", description: "System-level and manual dark mode toggle across all UI surfaces. Should respect OS preference by default.", status: "shipped", priority: "medium", category: "ux", votes: 1204, comments: 67, submittedBy: "user@gmail.com", submittedAt: "6mo ago", targetRelease: "v3.2", eta: "Shipped", effort: "L", tags: ["ui", "accessibility", "dark-mode"], customerCount: 0, mrr: 0 },
  { id: "f5", title: "Granular API rate limit per endpoint", description: "Allow per-endpoint rate limiting configuration rather than a single global limit. Essential for high-volume integrations.", status: "under-review", priority: "high", category: "api", votes: 389, comments: 12, submittedBy: "eng@saas.co", submittedAt: "1mo ago", targetRelease: "TBD", eta: "TBD", effort: "M", tags: ["api", "rate-limits"], customerCount: 44, mrr: 19000 },
  { id: "f6", title: "Slack integration for alerts", description: "Send real-time alerts and notifications to Slack channels with configurable thresholds and message templates.", status: "shipped", priority: "high", category: "integration", votes: 956, comments: 41, submittedBy: "ops@company.com", submittedAt: "5mo ago", targetRelease: "v3.1", eta: "Shipped", effort: "M", tags: ["slack", "integration", "alerts"], customerCount: 0, mrr: 0 },
  { id: "f7", title: "Audit log export", description: "Export full audit log history to S3 or GCS bucket for compliance and archival. Must include all user actions.", status: "planned", priority: "high", category: "security", votes: 278, comments: 9, submittedBy: "compliance@bank.com", submittedAt: "2mo ago", targetRelease: "v3.4", eta: "Q2 2026", effort: "M", tags: ["compliance", "audit", "export"], customerCount: 31, mrr: 52000 },
  { id: "f8", title: "Custom dashboard widgets", description: "Allow users to create custom metric widgets from any data source with their own visualization preferences.", status: "submitted", priority: "medium", category: "analytics", votes: 167, comments: 5, submittedBy: "analyst@data.com", submittedAt: "2w ago", targetRelease: "TBD", eta: "TBD", effort: "XL", tags: ["dashboard", "customization"], customerCount: 22, mrr: 7800 },
  { id: "f9", title: "Mobile app (iOS + Android)", description: "Native mobile applications for iOS and Android with core dashboard functionality and push notifications for alerts.", status: "declined", priority: "low", category: "ux", votes: 334, comments: 22, submittedBy: "user@personal.com", submittedAt: "8mo ago", targetRelease: "-", eta: "Not planned", effort: "XL", tags: ["mobile"], customerCount: 0, mrr: 0 },
  { id: "f10", title: "Performance benchmark reports", description: "Automated weekly performance benchmarks comparing key metrics against previous periods with PDF export.", status: "under-review", priority: "medium", category: "performance", votes: 201, comments: 7, submittedBy: "cto@startup.com", submittedAt: "3w ago", targetRelease: "TBD", eta: "TBD", effort: "L", tags: ["performance", "reports"], customerCount: 28, mrr: 11000 },
];

const ROADMAP: RoadmapItem[] = [
  { id: "rm1", title: "Q1 2026 — Reliability Sprint", quarter: "Q1 2026", status: "in-progress", featureIds: ["f2"], percentDone: 60 },
  { id: "rm2", title: "Q2 2026 — Enterprise Features", quarter: "Q2 2026", status: "planned", featureIds: ["f1", "f7"], percentDone: 0 },
  { id: "rm3", title: "Q3 2026 — Identity & Security", quarter: "Q3 2026", status: "planned", featureIds: ["f3"], percentDone: 0 },
];

const COMMENTS: Comment[] = [
  { id: "c1", featureId: "f1", author: "Sara Chen", role: "Customer Success", text: "We have 23 enterprise customers blocked on this. It's coming up in every QBR.", timestamp: "2d ago", isTeam: true },
  { id: "c2", featureId: "f1", author: "mike@acme.com", role: "Customer", text: "This is the #1 reason we haven't upgraded to Enterprise yet. Please prioritize!", timestamp: "1w ago", isTeam: false },
  { id: "c3", featureId: "f1", author: "Product Team", role: "PM", text: "We've scheduled this for v3.4. Design review starts next sprint.", timestamp: "5d ago", isTeam: true },
  { id: "c4", featureId: "f2", author: "eng@startup.io", role: "Customer", text: "This is causing us to miss SLA on our integration pipeline. Urgent for us.", timestamp: "3d ago", isTeam: false },
  { id: "c5", featureId: "f2", author: "Alex Rodriguez", role: "Engineer", text: "In progress — implementation at 60%. Target: shipped in 2 weeks.", timestamp: "1d ago", isTeam: true },
];

const VOTE_BREAKDOWN: VoteBreakdown[] = [
  { category: "ux", count: 1545, mrr: 55800 },
  { category: "api", count: 1012, mrr: 51000 },
  { category: "security", count: 790, mrr: 133000 },
  { category: "integration", count: 956, mrr: 32000 },
  { category: "analytics", count: 167, mrr: 7800 },
  { category: "performance", count: 201, mrr: 11000 },
];

const statusBadge: Record<FeatureStatus, string> = {
  "submitted":    "bg-zinc-700/50 border-zinc-600 text-zinc-400",
  "under-review": "bg-amber-500/15 border-amber-500/30 text-amber-400",
  "planned":      "bg-indigo-500/15 border-indigo-500/30 text-indigo-400",
  "in-progress":  "bg-sky-500/15 border-sky-500/30 text-sky-400",
  "shipped":      "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  "declined":     "bg-rose-500/10 border-rose-500/20 text-rose-500",
};

const statusLabel: Record<FeatureStatus, string> = {
  "submitted":    "Submitted",
  "under-review": "Under Review",
  "planned":      "Planned",
  "in-progress":  "In Progress",
  "shipped":      "Shipped ✓",
  "declined":     "Declined",
};

const priorityBadge: Record<Priority, string> = {
  critical: "bg-rose-500/15 text-rose-400",
  high:     "bg-orange-500/15 text-orange-400",
  medium:   "bg-amber-500/15 text-amber-400",
  low:      "bg-zinc-700 text-zinc-400",
};

const categoryIcon: Record<Category, string> = {
  ux: "🎨", performance: "⚡", integration: "🔗", api: "🔌", security: "🔒", analytics: "📊",
};

const effortColor: Record<string, string> = {
  S: "text-emerald-400", M: "text-amber-400", L: "text-orange-400", XL: "text-rose-400",
};

export default function FeatureRequestBoard() {
  const [tab, setTab] = useState<"requests" | "roadmap" | "feedback" | "trends">("requests");
  const [selected, setSelected] = useState<FeatureRequest | null>(FEATURES[0]);
  const [statusFilter, setStatusFilter] = useState<"all" | FeatureStatus>("all");

  const filtered = FEATURES
    .filter(f => statusFilter === "all" || f.status === statusFilter)
    .sort((a, b) => b.votes - a.votes);

  const inProgress = FEATURES.filter(f => f.status === "in-progress");
  const planned = FEATURES.filter(f => f.status === "planned");
  const shipped = FEATURES.filter(f => f.status === "shipped");
  const totalVotes = FEATURES.reduce((s, f) => s + f.votes, 0);

  const selectedComments = COMMENTS.filter(c => c.featureId === selected?.id);

  const maxVotes = Math.max(...VOTE_BREAKDOWN.map(v => v.count));

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Feature Request Board</h1>
            <p className="text-xs text-zinc-400 mt-0.5">{FEATURES.length} requests · {totalVotes.toLocaleString()} total votes</p>
          </div>
          <button className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-medium transition-colors">+ Submit Request</button>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "In Progress", value: inProgress.length, color: "text-sky-400" },
            { label: "Planned", value: planned.length, color: "text-indigo-400" },
            { label: "Shipped", value: shipped.length, color: "text-emerald-400" },
            { label: "Total Votes", value: totalVotes.toLocaleString(), color: "text-white" },
          ].map(s => (
            <div key={s.label}>
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-zinc-500 text-xs ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["requests", "roadmap", "feedback", "trends"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-800")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Requests Tab */}
        {tab === "requests" && (
          <div className="flex h-full">
            {/* Left */}
            <div className="w-[46%] flex-none border-r border-zinc-800 flex flex-col">
              <div className="flex-none px-4 py-2.5 border-b border-zinc-800 overflow-x-auto">
                <div className="flex items-center gap-1">
                  {(["all", "in-progress", "planned", "under-review", "submitted", "shipped", "declined"] as const).map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)}
                      className={cn("px-2 py-0.5 rounded text-[11px] whitespace-nowrap capitalize transition-colors flex-none",
                        statusFilter === s ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300")}>
                      {s === "all" ? "All" : statusLabel[s as FeatureStatus]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(feat => (
                  <button key={feat.id} onClick={() => setSelected(feat)} className={cn(
                    "w-full text-left px-4 py-3 border-b border-zinc-800/60 hover:bg-zinc-900 transition-colors",
                    selected?.id === feat.id && "bg-zinc-900 border-l-2 border-l-indigo-500"
                  )}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className="text-sm mt-0.5">{categoryIcon[feat.category]}</span>
                        <span className="text-sm font-medium text-white truncate">{feat.title}</span>
                      </div>
                      <div className="flex items-center gap-1.5 flex-none">
                        <span className="text-sm font-bold text-indigo-400">▲ {feat.votes.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1.5 pl-6 flex-wrap">
                      <span className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", statusBadge[feat.status])}>
                        {statusLabel[feat.status]}
                      </span>
                      <span className={cn("px-1.5 py-0.5 rounded text-[10px]", priorityBadge[feat.priority])}>{feat.priority}</span>
                      <span className={cn("text-[10px] font-mono font-semibold", effortColor[feat.effort])}>effort:{feat.effort}</span>
                      {feat.customerCount > 0 && (
                        <span className="text-[10px] text-zinc-600">{feat.customerCount} customers</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            {/* Right: detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-start gap-2">
                      <span className="text-lg">{categoryIcon[selected.category]}</span>
                      <h2 className="text-base font-semibold text-white leading-tight">{selected.title}</h2>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">{selected.description}</p>
                  </div>
                  {/* Badges */}
                  <div className="flex flex-wrap gap-2">
                    <span className={cn("px-2 py-1 rounded border text-xs font-medium", statusBadge[selected.status])}>{statusLabel[selected.status]}</span>
                    <span className={cn("px-2 py-1 rounded text-xs", priorityBadge[selected.priority])}>{selected.priority} priority</span>
                    <span className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-400">Effort: <span className={cn("font-bold", effortColor[selected.effort])}>{selected.effort}</span></span>
                    {selected.eta !== "TBD" && selected.eta !== "-" && (
                      <span className="px-2 py-1 rounded border border-zinc-700 text-xs text-zinc-400">ETA: {selected.eta}</span>
                    )}
                  </div>
                  {/* Vote + customer impact */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                      <div className="text-xs text-zinc-500">Upvotes</div>
                      <div className="text-2xl font-bold text-indigo-400 mt-1">▲ {selected.votes.toLocaleString()}</div>
                    </div>
                    {selected.customerCount > 0 && (
                      <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                        <div className="text-xs text-zinc-500">Affected MRR</div>
                        <div className="text-2xl font-bold text-emerald-400 mt-1">${(selected.mrr / 1000).toFixed(0)}K</div>
                        <div className="text-[10px] text-zinc-600">{selected.customerCount} customers</div>
                      </div>
                    )}
                  </div>
                  {/* Metadata */}
                  <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
                    <div className="text-xs font-medium text-zinc-400 mb-2">Details</div>
                    <div className="grid grid-cols-2 gap-y-1.5 text-xs">
                      <div><span className="text-zinc-500">Submitted: </span><span className="text-zinc-300">{selected.submittedAt}</span></div>
                      <div><span className="text-zinc-500">Target: </span><span className="text-zinc-300">{selected.targetRelease}</span></div>
                      <div><span className="text-zinc-500">Category: </span><span className="text-zinc-300 capitalize">{selected.category}</span></div>
                      <div><span className="text-zinc-500">Comments: </span><span className="text-zinc-300">{selected.comments}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {selected.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{tag}</span>
                      ))}
                    </div>
                  </div>
                  {/* Comments */}
                  {selectedComments.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-zinc-400">Team Notes</div>
                      {selectedComments.map(c => (
                        <div key={c.id} className={cn("rounded-xl p-3 border text-xs",
                          c.isTeam ? "bg-indigo-500/5 border-indigo-500/20" : "bg-zinc-900 border-zinc-800"
                        )}>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-semibold text-white">{c.author}</span>
                            <span className="text-zinc-500">{c.role}</span>
                            <span className="text-zinc-600 ml-auto">{c.timestamp}</span>
                          </div>
                          <p className="text-zinc-400">{c.text}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Roadmap Tab */}
        {tab === "roadmap" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              {ROADMAP.map(rm => {
                const features = rm.featureIds.map(id => FEATURES.find(f => f.id === id)).filter(Boolean) as FeatureRequest[];
                return (
                  <div key={rm.id} className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-white">{rm.title}</h3>
                      <span className={cn("px-2 py-1 rounded border text-xs font-medium",
                        rm.status === "in-progress" ? "bg-sky-500/15 border-sky-500/30 text-sky-400" :
                        rm.status === "shipped" ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400" :
                        "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                      )}>{rm.status}</span>
                    </div>
                    {/* Progress bar */}
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-zinc-500 mb-1">
                        <span>Progress</span>
                        <span>{rm.percentDone}%</span>
                      </div>
                      <div className="w-full bg-zinc-800 rounded-full h-2">
                        <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${rm.percentDone}%` }} />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {features.map(f => (
                        <div key={f.id} className="flex items-center gap-2 bg-zinc-950 rounded-lg px-3 py-2">
                          <span>{categoryIcon[f.category]}</span>
                          <span className="text-xs text-zinc-300">{f.title}</span>
                          <span className={cn("ml-auto px-1.5 py-0.5 rounded border text-[10px]", statusBadge[f.status])}>{statusLabel[f.status]}</span>
                          <span className="text-[10px] text-indigo-400">▲ {f.votes.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Feedback Tab */}
        {tab === "feedback" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-2">
              {COMMENTS.map(c => (
                <div key={c.id} className={cn("rounded-xl p-4 border text-sm",
                  c.isTeam ? "bg-indigo-500/5 border-indigo-500/20" : "bg-zinc-900 border-zinc-800"
                )}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="font-semibold text-white">{c.author}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-[10px]",
                      c.isTeam ? "bg-indigo-500/20 text-indigo-400" : "bg-zinc-800 text-zinc-500"
                    )}>{c.role}</span>
                    <span className="text-zinc-600 text-xs ml-auto">{c.timestamp}</span>
                  </div>
                  <p className="text-zinc-400 text-xs">{c.text}</p>
                  <div className="mt-1.5 text-[10px] text-zinc-600">
                    Re: {FEATURES.find(f => f.id === c.featureId)?.title}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trends Tab */}
        {tab === "trends" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 mb-4">
              <div className="text-sm font-medium text-zinc-300 mb-4">Votes by Category</div>
              <div className="space-y-3">
                {VOTE_BREAKDOWN.sort((a, b) => b.count - a.count).map(vb => (
                  <div key={vb.category}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <div className="flex items-center gap-1.5">
                        <span>{categoryIcon[vb.category]}</span>
                        <span className="text-zinc-300 capitalize">{vb.category}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-indigo-400">▲ {vb.count.toLocaleString()} votes</span>
                        <span className="text-emerald-400">${(vb.mrr / 1000).toFixed(0)}K MRR</span>
                      </div>
                    </div>
                    <div className="w-full bg-zinc-800 rounded-full h-2">
                      <div className="bg-indigo-500 h-2 rounded-full" style={{ width: `${(vb.count / maxVotes) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
              <div className="text-sm font-medium text-zinc-300 mb-4">Top by MRR Impact</div>
              <div className="space-y-2">
                {FEATURES.filter(f => f.mrr > 0).sort((a, b) => b.mrr - a.mrr).slice(0, 5).map((f, idx) => (
                  <div key={f.id} className="flex items-center gap-3">
                    <span className="text-xs text-zinc-600 w-4">{idx + 1}.</span>
                    <span className="text-xs text-zinc-300 flex-1 truncate">{f.title}</span>
                    <span className="text-emerald-400 text-xs font-semibold">${(f.mrr / 1000).toFixed(0)}K</span>
                    <span className="text-indigo-400 text-xs">▲{f.votes.toLocaleString()}</span>
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

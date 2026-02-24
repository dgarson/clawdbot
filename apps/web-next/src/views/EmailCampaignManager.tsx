import React, { useState } from "react";
import { cn } from "../lib/utils";

/**
 * EMAIL CAMPAIGN MANAGER
 * 
 * A comprehensive dashboard for managing email marketing efforts.
 * Built for Horizon UI with a focus on strict dark theme compliance,
 * robust state management, and no external dependencies.
 */

// --- Types & Interfaces ---

type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused";

interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  subject: string;
  recipientsCount: number;
  openRate: number;
  clickRate: number;
  sentDate: string | null;
  stats: {
    delivered: number;
    bounced: number;
    unsubscribed: number;
    spamReports: number;
  };
}

interface Template {
  id: string;
  name: string;
  category: "welcome" | "newsletter" | "promo" | "transactional";
  color: string;
}

type TabType = "campaigns" | "compose" | "templates" | "analytics";

// --- Mock Data ---

const INITIAL_CAMPAIGNS: Campaign[] = [
  {
    id: "cp-1",
    name: "Q1 Product Update",
    status: "sent",
    subject: "Big news: Horizon UI v2.0 is here!",
    recipientsCount: 12450,
    openRate: 42.5,
    clickRate: 12.3,
    sentDate: "2026-02-15",
    stats: { delivered: 12400, bounced: 50, unsubscribed: 85, spamReports: 2 }
  },
  {
    id: "cp-2",
    name: "Spring Sale 2026",
    status: "sending",
    subject: "Flash Sale: 30% off everything",
    recipientsCount: 45000,
    openRate: 18.2,
    clickRate: 4.1,
    sentDate: "2026-02-21",
    stats: { delivered: 22000, bounced: 120, unsubscribed: 45, spamReports: 8 }
  },
  {
    id: "cp-3",
    name: "Welcome Series - Step 1",
    status: "scheduled",
    subject: "Thanks for joining Horizon!",
    recipientsCount: 890,
    openRate: 0,
    clickRate: 0,
    sentDate: "2026-02-25",
    stats: { delivered: 0, bounced: 0, unsubscribed: 0, spamReports: 0 }
  },
  {
    id: "cp-4",
    name: "Dormant User Reactivation",
    status: "paused",
    subject: "We miss you, [First Name]!",
    recipientsCount: 5200,
    openRate: 12.8,
    clickRate: 1.2,
    sentDate: "2026-02-10",
    stats: { delivered: 5180, bounced: 20, unsubscribed: 12, spamReports: 1 }
  },
  {
    id: "cp-5",
    name: "Monthly Newsletter - Jan",
    status: "sent",
    subject: "The Horizon Hub: January Edition",
    recipientsCount: 11800,
    openRate: 38.4,
    clickRate: 9.8,
    sentDate: "2026-01-30",
    stats: { delivered: 11750, bounced: 50, unsubscribed: 60, spamReports: 0 }
  },
  {
    id: "cp-6",
    name: "New Feature: Team Invites",
    status: "draft",
    subject: "Collaborate faster with Team Invites",
    recipientsCount: 0,
    openRate: 0,
    clickRate: 0,
    sentDate: null,
    stats: { delivered: 0, bounced: 0, unsubscribed: 0, spamReports: 0 }
  },
  {
    id: "cp-7",
    name: "Customer Survey 2026",
    status: "sent",
    subject: "Help us shape the future of Horizon",
    recipientsCount: 8400,
    openRate: 24.1,
    clickRate: 15.2,
    sentDate: "2026-01-15",
    stats: { delivered: 8390, bounced: 10, unsubscribed: 30, spamReports: 1 }
  },
  {
    id: "cp-8",
    name: "Holiday Promo Follow-up",
    status: "sent",
    subject: "Last chance for holiday savings",
    recipientsCount: 15000,
    openRate: 15.5,
    clickRate: 2.8,
    sentDate: "2026-01-02",
    stats: { delivered: 14900, bounced: 100, unsubscribed: 95, spamReports: 5 }
  }
];

const TEMPLATES: Template[] = [
  { id: "tm-1", name: "Clean Newsletter", category: "newsletter", color: "bg-indigo-500" },
  { id: "tm-2", name: "Bold Promotion", category: "promo", color: "bg-rose-500" },
  { id: "tm-3", name: "Minimal Welcome", category: "welcome", color: "bg-emerald-500" },
  { id: "tm-4", name: "Account Alert", category: "transactional", color: "bg-amber-500" },
  { id: "tm-5", name: "Modern Product Update", category: "newsletter", color: "bg-sky-500" },
  { id: "tm-6", name: "Simple Receipt", category: "transactional", color: "bg-zinc-500" }
];

const AUDIENCE_LISTS = [
  { id: "l1", name: "All Customers", count: 12450 },
  { id: "l2", name: "Active Users (Last 30d)", count: 5600 },
  { id: "l3", name: "VIP Beta Testers", count: 420 },
  { id: "l4", name: "Incomplete Onboarding", count: 1800 }
];

// --- Sub-Components ---

const StatusBadge = ({ status }: { status: CampaignStatus }) => {
  const styles: Record<CampaignStatus, string> = {
    draft: "bg-zinc-800 text-zinc-400",
    scheduled: "bg-indigo-900/40 text-indigo-400 border border-indigo-500/30",
    sending: "bg-emerald-900/40 text-emerald-400 border border-emerald-500/30",
    sent: "bg-emerald-500/10 text-emerald-400",
    paused: "bg-amber-900/40 text-amber-400 border border-amber-500/30"
  };

  const icons: Record<CampaignStatus, string> = {
    draft: "📝",
    scheduled: "🕒",
    sending: "⚡",
    sent: "✅",
    paused: "⏸️"
  };

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1.5 w-fit", styles[status])}>
      <span>{icons[status]}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
};

// --- Main View Component ---

export default function EmailCampaignManager() {
  const [activeTab, setActiveTab] = useState<TabType>("campaigns");
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>(INITIAL_CAMPAIGNS);

  // Compose State
  const [composeTo, setComposeTo] = useState(AUDIENCE_LISTS[0].id);
  const [composeSubject, setComposeSubject] = useState("");
  const [composeFrom, setComposeFrom] = useState("marketing@horizonui.com");
  const [composeSchedule, setComposeSchedule] = useState("now");
  const [composeBody, setComposeBody] = useState("Hello world! Start typing your campaign message here...");

  // Handlers
  const toggleCampaignExpand = (id: string) => {
    setExpandedCampaignId(expandedCampaignId === id ? null : id);
  };

  const deleteCampaign = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this campaign?")) {
      setCampaigns(campaigns.filter(c => c.id !== id));
    }
  };

  const duplicateCampaign = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const original = campaigns.find(c => c.id === id);
    if (original) {
      const copy: Campaign = {
        ...original,
        id: `cp-${Math.random().toString(36).substr(2, 9)}`,
        name: `${original.name} (Copy)`,
        status: "draft",
        sentDate: null,
        openRate: 0,
        clickRate: 0,
        stats: { delivered: 0, bounced: 0, unsubscribed: 0, spamReports: 0 }
      };
      setCampaigns([copy, ...campaigns]);
      setActiveTab("campaigns");
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 font-sans">
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Campaigns</h1>
          <p className="text-zinc-400 mt-1">Design, manage, and analyze your customer communication.</p>
        </div>
        
        <button 
          onClick={() => setActiveTab("compose")}
          className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10"
        >
          <span>➕</span> Create New Campaign
        </button>
      </div>

      {/* Tabs Navigation */}
      <div className="max-w-7xl mx-auto mb-8 border-b border-zinc-800">
        <div className="flex gap-8">
          {(["campaigns", "compose", "templates", "analytics"] as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "pb-4 text-sm font-medium transition-all relative capitalize",
                activeTab === tab ? "text-indigo-400" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab}
              {activeTab === tab && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto">
        
        {/* TAB: CAMPAIGNS */}
        {activeTab === "campaigns" && (
          <div className="space-y-4">
            <div className="grid grid-cols-12 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-500 border-b border-zinc-800/50">
              <div className="col-span-4">Campaign & Subject</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Recipients</div>
              <div className="col-span-2 text-right">Engagement</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {campaigns.map((cp) => (
              <div 
                key={cp.id}
                className={cn(
                  "bg-zinc-900 border border-zinc-800 rounded-xl transition-all overflow-hidden",
                  expandedCampaignId === cp.id ? "ring-1 ring-indigo-500/50" : "hover:border-zinc-700"
                )}
              >
                <div 
                  className="grid grid-cols-12 p-6 items-center cursor-pointer select-none"
                  onClick={() => toggleCampaignExpand(cp.id)}
                >
                  <div className="col-span-4 flex flex-col gap-1">
                    <span className="font-bold text-zinc-100">{cp.name}</span>
                    <span className="text-sm text-zinc-500 truncate pr-4">{cp.subject}</span>
                  </div>
                  <div className="col-span-2">
                    <StatusBadge status={cp.status} />
                  </div>
                  <div className="col-span-2 text-right">
                    <div className="text-zinc-100 font-medium">{cp.recipientsCount.toLocaleString()}</div>
                    <div className="text-xs text-zinc-500">{cp.sentDate || "Not sent yet"}</div>
                  </div>
                  <div className="col-span-2 text-right space-y-1">
                    <div className="flex justify-end gap-3 text-sm">
                      <span className="text-emerald-400">{cp.openRate}% <span className="text-[10px] uppercase text-zinc-600">Open</span></span>
                    </div>
                    <div className="flex justify-end gap-3 text-sm">
                      <span className="text-indigo-400">{cp.clickRate}% <span className="text-[10px] uppercase text-zinc-600">Click</span></span>
                    </div>
                  </div>
                  <div className="col-span-2 flex justify-end gap-2">
                    <button 
                      onClick={(e) => duplicateCampaign(cp.id, e)}
                      className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition-colors title='Duplicate'"
                    >
                      📑
                    </button>
                    <button 
                      onClick={(e) => deleteCampaign(cp.id, e)}
                      className="p-2 hover:bg-rose-900/20 rounded-lg text-zinc-400 hover:text-rose-400 transition-colors title='Delete'"
                    >
                      🗑️
                    </button>
                    <button className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 transition-colors">
                      {expandedCampaignId === cp.id ? "▲" : "▼"}
                    </button>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedCampaignId === cp.id && (
                  <div className="px-6 pb-6 pt-2 border-t border-zinc-800/50 bg-zinc-900/50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-4 gap-4 mt-4">
                      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Delivered</div>
                        <div className="text-xl font-bold text-white">{cp.stats.delivered.toLocaleString()}</div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-emerald-500 h-full" style={{ width: cp.recipientsCount > 0 ? `${(cp.stats.delivered / cp.recipientsCount) * 100}%` : '0%' }} />
                        </div>
                      </div>
                      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Bounced</div>
                        <div className="text-xl font-bold text-white">{cp.stats.bounced.toLocaleString()}</div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-rose-500 h-full" style={{ width: cp.recipientsCount > 0 ? `${(cp.stats.bounced / cp.recipientsCount) * 100}%` : '0%' }} />
                        </div>
                      </div>
                      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Unsubscribed</div>
                        <div className="text-xl font-bold text-white">{cp.stats.unsubscribed.toLocaleString()}</div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-amber-500 h-full" style={{ width: cp.recipientsCount > 0 ? `${(cp.stats.unsubscribed / cp.recipientsCount) * 100}%` : '0%' }} />
                        </div>
                      </div>
                      <div className="bg-zinc-950 p-4 rounded-lg border border-zinc-800">
                        <div className="text-xs text-zinc-500 uppercase font-bold mb-1">Spam Reports</div>
                        <div className="text-xl font-bold text-white">{cp.stats.spamReports.toLocaleString()}</div>
                        <div className="w-full bg-zinc-800 h-1.5 rounded-full mt-3 overflow-hidden">
                          <div className="bg-zinc-700 h-full" style={{ width: cp.recipientsCount > 0 ? `${(cp.stats.spamReports / cp.recipientsCount) * 100}%` : '0%' }} />
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex justify-end mt-6 gap-3">
                      {cp.status === 'paused' && <button className="px-4 py-2 text-sm font-semibold bg-emerald-600 rounded-lg">Resume Campaign</button>}
                      {cp.status === 'sending' && <button className="px-4 py-2 text-sm font-semibold bg-amber-600 rounded-lg">Pause Campaign</button>}
                      {cp.status === 'draft' && <button className="px-4 py-2 text-sm font-semibold bg-indigo-600 rounded-lg">Edit Details</button>}
                      <button className="px-4 py-2 text-sm font-semibold border border-zinc-700 rounded-lg hover:bg-zinc-800 transition-colors">Download Full CSV Report</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TAB: COMPOSE */}
        {activeTab === "compose" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Editor Side */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <span>✍️</span> Campaign Builder
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">To Audience</label>
                  <select 
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  >
                    {AUDIENCE_LISTS.map(list => (
                      <option key={list.id} value={list.id}>{list.name} ({list.count.toLocaleString()} subscribers)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">From Address</label>
                    <select 
                      value={composeFrom}
                      onChange={(e) => setComposeFrom(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <option value="marketing@horizonui.com">marketing@horizonui.com</option>
                      <option value="newsletter@horizonui.com">newsletter@horizonui.com</option>
                      <option value="support@horizonui.com">support@horizonui.com</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">Schedule</label>
                    <select 
                      value={composeSchedule}
                      onChange={(e) => setComposeSchedule(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                    >
                      <option value="now">Send Immediately</option>
                      <option value="schedule">Schedule for Later</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">Subject Line</label>
                  <input 
                    type="text"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="E.g. Your Weekly Digest is Here!"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-zinc-500 mb-1.5">Message Body</label>
                  <div className="bg-zinc-950 border border-zinc-800 rounded-lg overflow-hidden">
                    <div className="flex gap-2 p-2 bg-zinc-900 border-b border-zinc-800">
                      <button className="p-1 hover:bg-zinc-800 rounded text-xs px-2 font-bold">B</button>
                      <button className="p-1 hover:bg-zinc-800 rounded text-xs px-2 italic font-serif text-zinc-400">I</button>
                      <button className="p-1 hover:bg-zinc-800 rounded text-xs px-2 underline text-zinc-400">U</button>
                      <div className="w-px bg-zinc-800 mx-1" />
                      <button className="p-1 hover:bg-zinc-800 rounded text-xs px-2 text-zinc-400">🔗 Link</button>
                      <button className="p-1 hover:bg-zinc-800 rounded text-xs px-2 text-zinc-400">🖼️ Image</button>
                    </div>
                    <textarea 
                      value={composeBody}
                      onChange={(e) => setComposeBody(e.target.value)}
                      rows={10}
                      className="w-full bg-transparent p-4 text-sm text-zinc-300 focus:outline-none resize-none"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-indigo-500/20 transition-all">
                  🚀 {composeSchedule === 'now' ? 'Send Campaign Now' : 'Schedule Campaign'}
                </button>
                <button className="px-6 py-3 border border-zinc-700 hover:bg-zinc-800 rounded-xl font-bold transition-all">
                  💾 Save Draft
                </button>
              </div>
            </div>

            {/* Preview Side */}
            <div className="sticky top-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col h-[700px]">
                <div className="p-4 bg-zinc-800/50 border-b border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-rose-500/40" />
                      <div className="w-3 h-3 rounded-full bg-amber-500/40" />
                      <div className="w-3 h-3 rounded-full bg-emerald-500/40" />
                    </div>
                    <span className="ml-3 text-xs font-semibold text-zinc-400 uppercase tracking-widest">Live Preview</span>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-1.5 bg-zinc-950 border border-zinc-800 rounded text-xs">📱</button>
                    <button className="p-1.5 bg-indigo-500/20 border border-indigo-500/40 rounded text-xs">💻</button>
                  </div>
                </div>

                <div className="flex-1 bg-white overflow-y-auto p-12">
                   <div className="max-w-xl mx-auto space-y-8">
                      {/* Email Header */}
                      <div className="flex justify-between items-center border-b pb-6 border-zinc-100">
                        <div className="text-2xl font-black text-zinc-900 tracking-tighter italic">HORIZON</div>
                        <div className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Edition #42</div>
                      </div>

                      {/* Email Content */}
                      <div className="space-y-6">
                        <h1 className="text-3xl font-extrabold text-zinc-900 leading-tight">
                          {composeSubject || "Add a subject line..."}
                        </h1>
                        
                        <div className="text-zinc-600 leading-relaxed whitespace-pre-wrap">
                          {composeBody}
                        </div>

                        <div className="bg-zinc-900 text-white p-6 rounded-xl text-center space-y-4">
                          <p className="font-bold">Ready to take your UI to the next level?</p>
                          <button className="bg-indigo-500 text-white px-8 py-3 rounded-full font-bold text-sm">
                            Go to Dashboard
                          </button>
                        </div>

                        <p className="text-zinc-500 text-sm italic">
                          This is a dynamic preview. Your content is rendered in a secure sandbox to ensure perfect display across all mail clients.
                        </p>
                      </div>

                      {/* Email Footer */}
                      <div className="pt-12 border-t border-zinc-100 text-center space-y-4">
                        <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-widest">Horizon UI Dashboard • San Francisco, CA</div>
                        <div className="text-[10px] text-indigo-500 font-bold hover:underline cursor-pointer">Unsubscribe from this list</div>
                      </div>
                   </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: TEMPLATES */}
        {activeTab === "templates" && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Saved Email Templates</h2>
              <button className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                🎨 Create From Scratch
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {TEMPLATES.map((tmpl) => (
                <div 
                  key={tmpl.id}
                  className="group bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden hover:border-indigo-500/50 transition-all cursor-pointer"
                  onClick={() => setActiveTab("compose")}
                >
                  <div className={cn("aspect-video relative overflow-hidden flex items-center justify-center", tmpl.color)}>
                    <div className="absolute inset-0 bg-black/20" />
                    <div className="relative bg-white/10 backdrop-blur-md p-6 border border-white/20 rounded-xl w-3/4 shadow-2xl">
                      <div className="w-12 h-1 bg-white/40 rounded-full mb-3" />
                      <div className="w-20 h-1 bg-white/40 rounded-full mb-3" />
                      <div className="w-16 h-1 bg-white/40 rounded-full" />
                    </div>
                  </div>
                  <div className="p-5 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-zinc-100 group-hover:text-indigo-400 transition-colors">{tmpl.name}</h3>
                      <p className="text-xs text-zinc-500 uppercase font-bold tracking-wider mt-1">{tmpl.category}</p>
                    </div>
                    <button className="p-2 bg-zinc-800 rounded-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                      Use →
                    </button>
                  </div>
                </div>
              ))}

              <div className="border-2 border-dashed border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-zinc-900/40 transition-colors cursor-pointer group">
                <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
                  📥
                </div>
                <h3 className="font-bold text-zinc-400 mt-4">Import Template</h3>
                <p className="text-xs text-zinc-600 mt-1">JSON or HTML files</p>
              </div>
            </div>
          </div>
        )}

        {/* TAB: ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-8">
            {/* Top Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl text-xl">📈</div>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">+12.5%</span>
                </div>
                <div className="text-zinc-500 text-sm font-medium">Avg. Open Rate</div>
                <div className="text-3xl font-bold mt-1 text-white">31.42%</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/10 text-indigo-500 rounded-xl text-xl">🖱️</div>
                  <span className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded">+4.2%</span>
                </div>
                <div className="text-zinc-500 text-sm font-medium">Avg. Click-Through</div>
                <div className="text-3xl font-bold mt-1 text-white">6.18%</div>
              </div>
              <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-rose-500/10 text-rose-500 rounded-xl text-xl">📉</div>
                  <span className="text-xs font-bold text-rose-500 bg-rose-500/10 px-2 py-1 rounded">-0.8%</span>
                </div>
                <div className="text-zinc-500 text-sm font-medium">Unsubscribe Rate</div>
                <div className="text-3xl font-bold mt-1 text-white">0.45%</div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Bar Chart: Open Rates */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                <h3 className="text-lg font-bold mb-8">Open Rates (Last 7 Campaigns)</h3>
                <div className="flex items-end justify-between h-64 gap-2">
                  {[42, 18, 38, 24, 15, 29, 31].map((val, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
                      <div className="w-full relative">
                        {/* Data Tooltip (Simple Div) */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none">
                          {val}%
                        </div>
                        <div 
                          className="w-full bg-indigo-500/20 group-hover:bg-indigo-500/40 border-t border-indigo-500 rounded-t-lg transition-all duration-500"
                          style={{ height: `${val * 2}px` }}
                        />
                      </div>
                      <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-tighter">C-0{7-i}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trend Line: Unsubscribes */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8">
                <h3 className="text-lg font-bold mb-8">Unsubscribe Trend</h3>
                <div className="relative h-64 w-full flex items-end">
                   {/* Grid Lines */}
                   <div className="absolute inset-0 flex flex-col justify-between py-1">
                      {[1,2,3,4].map(l => <div key={l} className="w-full h-px bg-zinc-800/50" />)}
                   </div>
                   
                   {/* Fake "Line" chart using CSS clip-path and absolute positioning */}
                   <div className="absolute inset-0 flex items-end px-2">
                      <div className="w-full h-1/2 border-t-2 border-rose-500 relative flex items-center justify-between">
                         {[8, 12, 5, 20, 15, 8, 4].map((v, i) => (
                           <div key={i} className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]" 
                                style={{ transform: `translateY(${(v - 10) * 4}px)` }} />
                         ))}
                      </div>
                   </div>
                   
                   <div className="w-full flex justify-between mt-auto pt-4 border-t border-zinc-800">
                      {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(d => (
                        <span key={d} className="text-[10px] text-zinc-600 font-bold uppercase">{d}</span>
                      ))}
                   </div>
                </div>
              </div>
            </div>

            {/* Performance Table */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
               <div className="p-6 border-b border-zinc-800">
                  <h3 className="text-lg font-bold">Top Performing Campaigns</h3>
               </div>
               <table className="w-full text-left">
                  <thead className="bg-zinc-950/50 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Campaign</th>
                      <th className="px-6 py-4">Delivery</th>
                      <th className="px-6 py-4">Open Rate</th>
                      <th className="px-6 py-4">CTR</th>
                      <th className="px-6 py-4 text-right">Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {campaigns.filter(c => c.status === 'sent').toSorted((a,b) => b.openRate - a.openRate).slice(0, 4).map((cp) => (
                      <tr key={cp.id} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-bold text-sm">{cp.name}</div>
                          <div className="text-xs text-zinc-500">{cp.sentDate}</div>
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">99.2%</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-emerald-400">{cp.openRate}%</span>
                            <div className="w-16 h-1 bg-zinc-800 rounded-full overflow-hidden">
                               <div className="bg-emerald-500 h-full" style={{ width: `${cp.openRate}%` }} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-indigo-400">{cp.clickRate}%</td>
                        <td className="px-6 py-4 text-right">
                           <span className="bg-indigo-500/10 text-indigo-400 px-2 py-1 rounded text-xs font-bold border border-indigo-500/20">A+ Performance</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}
      </div>

      {/* Footer Branding */}
      <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-zinc-900 flex justify-between items-center text-zinc-600 text-[10px] font-bold uppercase tracking-[0.2em]">
        <div>Horizon UI © 2026 • Product & UI Squad</div>
        <div className="flex gap-6">
          <span className="hover:text-zinc-400 cursor-pointer transition-colors">Documentation</span>
          <span className="hover:text-zinc-400 cursor-pointer transition-colors">API Keys</span>
          <span className="hover:text-zinc-400 cursor-pointer transition-colors">Support</span>
        </div>
      </div>
    </div>
  );
}

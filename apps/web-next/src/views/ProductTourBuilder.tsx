import React, { useState } from "react";
import { cn } from "../lib/utils";

type StepType = "tooltip" | "modal" | "spotlight" | "banner" | "checklist";
type TourStatus = "draft" | "active" | "paused" | "archived";
type TargetAudience = "new_users" | "returning" | "enterprise" | "all";
type Tab = "tours" | "builder" | "analytics" | "segments";

interface TourStep {
  id: string;
  order: number;
  type: StepType;
  title: string;
  body: string;
  target: string;
  position: "top" | "bottom" | "left" | "right" | "center";
  ctaText: string | null;
  skippable: boolean;
}

interface ProductTour {
  id: string;
  name: string;
  description: string;
  status: TourStatus;
  audience: TargetAudience;
  trigger: string;
  steps: TourStep[];
  completionRate: number;
  starts: number;
  completions: number;
  avgTime: string;
  dropoffStep: number | null;
  createdAt: string;
  updatedAt: string;
}

const TOURS: ProductTour[] = [
  {
    id: "t1", name: "New User Onboarding", description: "Guides new users through key features on first login",
    status: "active", audience: "new_users", trigger: "First login",
    steps: [
      { id: "s1", order: 1, type: "modal", title: "Welcome to Horizon!", body: "Let's get you set up in 2 minutes. We'll show you the most important features.", target: "body", position: "center", ctaText: "Let's go!", skippable: true },
      { id: "s2", order: 2, type: "spotlight", title: "Your Dashboard", body: "This is your main dashboard. You can see all your agents, sessions, and activity at a glance.", target: "#dashboard-main", position: "bottom", ctaText: "Next", skippable: false },
      { id: "s3", order: 3, type: "tooltip", title: "Create an Agent", body: "Click here to create your first AI agent. Agents can answer questions, take actions, and automate workflows.", target: "#create-agent-btn", position: "right", ctaText: "Got it", skippable: true },
      { id: "s4", order: 4, type: "tooltip", title: "Model Selection", body: "Choose from 20+ AI models. Each has different capabilities and pricing.", target: "#model-selector", position: "left", ctaText: "Next", skippable: true },
      { id: "s5", order: 5, type: "modal", title: "You're all set!", body: "You've completed the tour. Explore the left nav to discover more features.", target: "body", position: "center", ctaText: "Start exploring", skippable: false },
    ],
    completionRate: 68, starts: 12341, completions: 8391, avgTime: "2m 14s", dropoffStep: 3, createdAt: "45d ago", updatedAt: "3d ago",
  },
  {
    id: "t2", name: "Agent Builder Walkthrough", description: "Interactive tour of the agent builder interface",
    status: "active", audience: "all", trigger: "First visit to /builder",
    steps: [
      { id: "s6", order: 1, type: "banner", title: "New: Agent Builder", body: "Build agents with a visual drag-and-drop interface. No code required.", target: "top", position: "top", ctaText: "Show me", skippable: true },
      { id: "s7", order: 2, type: "spotlight", title: "Tool Library", body: "Drag tools from the library to add capabilities to your agent.", target: "#tool-library", position: "right", ctaText: "Next", skippable: false },
      { id: "s8", order: 3, type: "tooltip", title: "Configure Tools", body: "Click any tool to configure it. Each tool has settings for behavior and permissions.", target: "#tool-config", position: "bottom", ctaText: "Next", skippable: true },
    ],
    completionRate: 82, starts: 3421, completions: 2805, avgTime: "1m 32s", dropoffStep: null, createdAt: "20d ago", updatedAt: "1d ago",
  },
  {
    id: "t3", name: "Enterprise SSO Setup", description: "Guides enterprise admins through SSO configuration",
    status: "paused", audience: "enterprise", trigger: "First visit to /settings/sso",
    steps: [
      { id: "s9", order: 1, type: "modal", title: "Configure SSO", body: "Set up SAML 2.0 or OIDC SSO for your organization. This requires admin credentials from your identity provider.", target: "body", position: "center", ctaText: "Start setup", skippable: true },
    ],
    completionRate: 91, starts: 234, completions: 213, avgTime: "4m 12s", dropoffStep: null, createdAt: "60d ago", updatedAt: "7d ago",
  },
  {
    id: "t4", name: "API Keys & Integrations", description: "Guide for developers on API authentication",
    status: "draft", audience: "all", trigger: "First visit to /api-keys",
    steps: [
      { id: "s10", order: 1, type: "tooltip", title: "Your API Keys", body: "Create and manage API keys for programmatic access.", target: "#api-keys-header", position: "bottom", ctaText: "Next", skippable: true },
    ],
    completionRate: 0, starts: 0, completions: 0, avgTime: "—", dropoffStep: null, createdAt: "2d ago", updatedAt: "2d ago",
  },
];

const stepTypeIcon: Record<StepType, string> = {
  tooltip: "💬",
  modal: "🪟",
  spotlight: "🔦",
  banner: "📢",
  checklist: "✅",
};

const statusBadge: Record<TourStatus, string> = {
  draft: "bg-[var(--color-surface-3)]/30 border-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  active: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
  paused: "bg-amber-500/10 border-amber-500/30 text-amber-400",
  archived: "bg-[var(--color-surface-3)]/30 border-[var(--color-surface-3)] text-[var(--color-text-muted)]",
};

const audienceLabel: Record<TargetAudience, string> = {
  new_users: "New Users",
  returning: "Returning",
  enterprise: "Enterprise",
  all: "All Users",
};

export default function ProductTourBuilder() {
  const [tab, setTab] = useState<Tab>("tours");
  const [selectedTour, setSelectedTour] = useState<ProductTour | null>(TOURS[0]);
  const [selectedStep, setSelectedStep] = useState<TourStep | null>(null);

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "tours", label: "Tours", emoji: "🗺️" },
    { id: "builder", label: "Step Builder", emoji: "🔧" },
    { id: "analytics", label: "Analytics", emoji: "📊" },
    { id: "segments", label: "Segments", emoji: "🎯" },
  ];

  const activeTours = TOURS.filter(t => t.status === "active").length;
  const totalStarts = TOURS.reduce((s, t) => s + t.starts, 0);
  const avgCompletion = TOURS.filter(t => t.starts > 0).reduce((s, t) => s + t.completionRate, 0) / TOURS.filter(t => t.starts > 0).length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Product Tour Builder</h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Interactive onboarding tours and feature walkthroughs</p>
        </div>
        <button className="px-4 py-2 text-sm bg-primary hover:bg-primary rounded text-[var(--color-text-primary)] transition-colors">
          + New Tour
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-0 border-b border-[var(--color-border)]">
        {[
          { label: "Active Tours", value: String(activeTours), sub: `${TOURS.length} total` },
          { label: "Total Starts (30d)", value: totalStarts.toLocaleString(), sub: "unique users" },
          { label: "Avg Completion", value: `${avgCompletion.toFixed(0)}%`, sub: "across active tours" },
          { label: "Best Tour CTR", value: "91%", sub: "Enterprise SSO" },
        ].map((stat, i) => (
          <div key={i} className="px-6 py-3 border-r border-[var(--color-border)] last:border-r-0">
            <div className="text-xl font-bold text-[var(--color-text-primary)]">{stat.value}</div>
            <div className="text-xs font-medium text-[var(--color-text-secondary)] mt-0.5">{stat.label}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{stat.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors",
              tab === t.id ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
            )}
          >
            <span>{t.emoji}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* TOURS TAB */}
        {tab === "tours" && (
          <div className="flex h-full">
            {/* Tour list */}
            <div className="w-72 border-r border-[var(--color-border)] overflow-y-auto">
              {TOURS.map(tour => (
                <button
                  key={tour.id}
                  onClick={() => setSelectedTour(tour)}
                  className={cn(
                    "w-full text-left px-4 py-4 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedTour?.id === tour.id && "bg-[var(--color-surface-2)]"
                  )}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">{tour.name}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded border shrink-0", statusBadge[tour.status])}>
                      {tour.status}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] line-clamp-1 mb-1">{tour.description}</p>
                  <div className="text-xs text-[var(--color-text-muted)]">
                    {tour.steps.length} steps · {audienceLabel[tour.audience]}
                  </div>
                  {tour.starts > 0 && (
                    <div className="mt-1.5">
                      <div className="h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${tour.completionRate}%` }} />
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{tour.completionRate}% complete</div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Tour detail */}
            <div className="flex-1 overflow-y-auto">
              {selectedTour ? (
                <div className="p-6 space-y-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{selectedTour.name}</h2>
                        <span className={cn("text-xs px-2 py-0.5 rounded border", statusBadge[selectedTour.status])}>
                          {selectedTour.status}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-text-secondary)]">{selectedTour.description}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      {selectedTour.status === "draft" && (
                        <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded text-[var(--color-text-primary)] transition-colors">Activate</button>
                      )}
                      {selectedTour.status === "active" && (
                        <button className="px-3 py-1.5 text-xs bg-amber-500/20 border border-amber-500/40 rounded text-amber-400 hover:bg-amber-500/30 transition-colors">Pause</button>
                      )}
                      <button
                        className="px-3 py-1.5 text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] transition-colors"
                        onClick={() => setTab("builder")}
                      >Edit Steps</button>
                    </div>
                  </div>

                  {/* Metrics */}
                  {selectedTour.starts > 0 && (
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Starts", value: selectedTour.starts.toLocaleString() },
                        { label: "Completions", value: selectedTour.completions.toLocaleString() },
                        { label: "Completion Rate", value: `${selectedTour.completionRate}%` },
                        { label: "Avg Time", value: selectedTour.avgTime },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[var(--color-surface-1)] rounded p-3 text-center">
                          <div className="text-xl font-bold text-[var(--color-text-primary)]">{value}</div>
                          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Step timeline */}
                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-3 uppercase tracking-wider">
                      Steps ({selectedTour.steps.length})
                    </div>
                    <div className="space-y-2">
                      {selectedTour.steps.map((step, i) => {
                        const isDropoff = selectedTour.dropoffStep === step.order;
                        return (
                          <div
                            key={step.id}
                            className={cn(
                              "flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:brightness-110 transition-all",
                              isDropoff ? "bg-rose-500/5 border-rose-500/20" : "bg-[var(--color-surface-1)] border-[var(--color-border)]"
                            )}
                            onClick={() => { setSelectedStep(step); setTab("builder"); }}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0",
                              isDropoff ? "bg-rose-500/20 text-rose-400" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                            )}>
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-sm font-medium text-[var(--color-text-primary)]">{step.title}</span>
                                <span className="text-xs text-[var(--color-text-muted)]">{stepTypeIcon[step.type]} {step.type}</span>
                                {isDropoff && <span className="text-xs text-rose-400 ml-auto">⬇ Drop-off point</span>}
                              </div>
                              <p className="text-xs text-[var(--color-text-muted)] truncate">{step.body}</p>
                              <div className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">{step.target}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="text-xs text-[var(--color-text-muted)] mb-2 uppercase tracking-wider">Configuration</div>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Trigger", value: selectedTour.trigger },
                        { label: "Audience", value: audienceLabel[selectedTour.audience] },
                        { label: "Created", value: selectedTour.createdAt },
                        { label: "Last Updated", value: selectedTour.updatedAt },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-[var(--color-surface-1)] rounded p-3">
                          <div className="text-xs text-[var(--color-text-muted)]">{label}</div>
                          <div className="text-sm text-[var(--color-text-primary)] mt-0.5">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select a tour</div>
              )}
            </div>
          </div>
        )}

        {/* BUILDER TAB */}
        {tab === "builder" && (
          <div className="flex h-full">
            <div className="w-64 border-r border-[var(--color-border)] overflow-y-auto">
              <div className="p-3 border-b border-[var(--color-border)] text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
                Steps — {selectedTour?.name || "Select a tour"}
              </div>
              {(selectedTour?.steps || []).map((step, i) => (
                <button
                  key={step.id}
                  onClick={() => setSelectedStep(step)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-1)] transition-colors",
                    selectedStep?.id === step.id && "bg-[var(--color-surface-2)]"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--color-text-muted)] w-4">{i + 1}</span>
                    <span className="text-xs">{stepTypeIcon[step.type]}</span>
                    <span className="text-xs text-[var(--color-text-primary)] truncate">{step.title}</span>
                  </div>
                </button>
              ))}
              <button className="w-full px-4 py-3 text-xs text-primary hover:text-indigo-300 text-left border-t border-[var(--color-border)]">
                + Add step
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selectedStep ? (
                <div className="p-6 space-y-5">
                  <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Edit Step {selectedStep.order}</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Step Type</label>
                      <select className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)]">
                        {(["tooltip", "modal", "spotlight", "banner", "checklist"] as StepType[]).map(t => (
                          <option key={t} value={t} selected={selectedStep.type === t}>{stepTypeIcon[t]} {t}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Title</label>
                      <input type="text" defaultValue={selectedStep.title} className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-primary" />
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Body Text</label>
                      <textarea rows={3} defaultValue={selectedStep.body} className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-primary resize-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Target Element</label>
                        <input type="text" defaultValue={selectedStep.target} placeholder="#element-id or .class" className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm font-mono text-[var(--color-text-primary)] outline-none focus:border-primary" />
                      </div>
                      <div>
                        <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">Position</label>
                        <select defaultValue={selectedStep.position} className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)]">
                          <option>top</option><option>bottom</option><option>left</option><option>right</option><option>center</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs text-[var(--color-text-muted)] mb-1.5">CTA Button Text (optional)</label>
                      <input type="text" defaultValue={selectedStep.ctaText || ""} placeholder="Next" className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none focus:border-primary" />
                    </div>
                    <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)] cursor-pointer">
                      <input type="checkbox" defaultChecked={selectedStep.skippable} className="w-3 h-3" />
                      Allow users to skip this step
                    </label>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 text-sm bg-primary hover:bg-primary rounded text-[var(--color-text-primary)] transition-colors">Save Step</button>
                      <button className="px-4 py-2 text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] border border-[var(--color-border)] rounded text-[var(--color-text-primary)] transition-colors">Preview</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-[var(--color-text-muted)] text-sm">Select a step to edit</div>
              )}
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {tab === "analytics" && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">Tour Performance</h2>
              <div className="space-y-2">
                {TOURS.filter(t => t.starts > 0).map(tour => (
                  <div key={tour.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{tour.name}</span>
                      <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                        <span>{tour.starts.toLocaleString()} starts</span>
                        <span className={cn(
                          "font-medium",
                          tour.completionRate >= 80 ? "text-emerald-400" :
                          tour.completionRate >= 60 ? "text-amber-400" : "text-rose-400"
                        )}>{tour.completionRate}% complete</span>
                      </div>
                    </div>
                    <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          tour.completionRate >= 80 ? "bg-emerald-500" :
                          tour.completionRate >= 60 ? "bg-amber-500" : "bg-rose-500"
                        )}
                        style={{ width: `${tour.completionRate}%` }}
                      />
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-[var(--color-text-muted)]">
                      <span>{tour.completions.toLocaleString()} completions</span>
                      <span>avg {tour.avgTime}</span>
                      {tour.dropoffStep && <span className="text-rose-400">drop-off at step {tour.dropoffStep}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SEGMENTS TAB */}
        {tab === "segments" && (
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Audience Segments</h2>
            {(["new_users", "returning", "enterprise", "all"] as TargetAudience[]).map(audience => {
              const tours = TOURS.filter(t => t.audience === audience);
              return (
                <div key={audience} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-medium text-[var(--color-text-primary)]">{audienceLabel[audience]}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{tours.length} tour{tours.length !== 1 ? "s" : ""}</span>
                  </div>
                  {tours.length > 0 ? (
                    <div className="flex gap-2 flex-wrap">
                      {tours.map(t => (
                        <span key={t.id} className={cn("text-xs px-2 py-1 rounded border", statusBadge[t.status])}>
                          {t.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--color-text-muted)]">No tours targeting this segment</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

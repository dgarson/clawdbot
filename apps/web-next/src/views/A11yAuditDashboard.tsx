import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { ShieldCheck } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

type Severity = "critical" | "serious" | "moderate" | "minor";
type WCAGLevel = "A" | "AA" | "AAA";

interface A11yViolation {
  id: string;
  ruleId: string;
  impact: Severity;
  description: string;
  wcagCriteria: string;
  wcagLevel: WCAGLevel;
  category: string;
  selector: string;
  affectedPages: number;
  helpUrl: string;
  howToFix: string;
  codeExample?: { before: string; after: string };
}

interface AuditedPage {
  url: string;
  title: string;
  score: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
  lastAuditedAt: string;
  violations: string[]; // violation ids
}

interface RemediationItem {
  violationId: string;
  category: string;
  priority: "immediate" | "high" | "medium" | "low";
  effort: "low" | "medium" | "high";
  status: "pending" | "in-progress" | "done";
  assignedTo?: string;
}

const VIOLATIONS: A11yViolation[] = [
  {
    id: "v1",
    ruleId: "color-contrast",
    impact: "serious",
    description: "Elements must have sufficient color contrast",
    wcagCriteria: "1.4.3 Contrast (Minimum)",
    wcagLevel: "AA",
    category: "Color Contrast",
    selector: ".zinc-500 on zinc-900 background",
    affectedPages: 11,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/color-contrast",
    howToFix: "Increase text color contrast ratio to at least 4.5:1 for normal text, 3:1 for large text. Replace zinc-500 with zinc-300 on dark backgrounds.",
    codeExample: {
      before: `<span className="text-fg-muted">Status: Active</span>`,
      after: `<span className="text-fg-primary">Status: Active</span>`,
    },
  },
  {
    id: "v2",
    ruleId: "button-name",
    impact: "critical",
    description: "Buttons must have discernible text",
    wcagCriteria: "4.1.2 Name, Role, Value",
    wcagLevel: "A",
    category: "Screen Reader",
    selector: "button.icon-only",
    affectedPages: 8,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/button-name",
    howToFix: "Add aria-label to icon-only buttons. Every interactive element must have a name accessible to screen readers.",
    codeExample: {
      before: `<button onClick={close}>✕</button>`,
      after: `<button onClick={close} aria-label="Close dialog">✕</button>`,
    },
  },
  {
    id: "v3",
    ruleId: "keyboard-focus",
    impact: "critical",
    description: "Interactive elements must be keyboard navigable",
    wcagCriteria: "2.1.1 Keyboard",
    wcagLevel: "A",
    category: "Keyboard Navigation",
    selector: "div[onClick]:not([tabIndex])",
    affectedPages: 6,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/keyboard",
    howToFix: "Replace div onClick handlers with button elements, or add tabIndex={0} and onKeyDown handler to non-interactive elements used as controls.",
    codeExample: {
      before: `<div onClick={handleSelect}>{item.name}</div>`,
      after: `<button onClick={handleSelect}>{item.name}</button>`,
    },
  },
  {
    id: "v4",
    ruleId: "aria-label",
    impact: "serious",
    description: "Form fields must have associated labels",
    wcagCriteria: "1.3.1 Info and Relationships",
    wcagLevel: "A",
    category: "ARIA Labels",
    selector: "input:not([aria-label]):not([id])",
    affectedPages: 5,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/label",
    howToFix: "Add aria-label or associate a <label> element via htmlFor/id pairing to every form input.",
    codeExample: {
      before: `<input type="text" placeholder="Search..." />`,
      after: `<input type="text" placeholder="Search..." aria-label="Search agents" />`,
    },
  },
  {
    id: "v5",
    ruleId: "focus-visible",
    impact: "serious",
    description: "Focus indicators must be visible",
    wcagCriteria: "2.4.7 Focus Visible",
    wcagLevel: "AA",
    category: "Focus Management",
    selector: "*:focus { outline: none }",
    affectedPages: 11,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/focus-visible",
    howToFix: "Remove `outline: none` from global focus styles. Add a visible focus ring using focus-visible:ring-2 utilities.",
    codeExample: {
      before: `className="focus:outline-none"`,
      after: `className="focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"`,
    },
  },
  {
    id: "v6",
    ruleId: "image-alt",
    impact: "critical",
    description: "Images must have alternative text",
    wcagCriteria: "1.1.1 Non-text Content",
    wcagLevel: "A",
    category: "Screen Reader",
    selector: "img:not([alt])",
    affectedPages: 3,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/image-alt",
    howToFix: "Add descriptive alt attributes to all img elements. Use alt=\"\" for decorative images.",
    codeExample: {
      before: `<img src="/avatar.png" />`,
      after: `<img src="/avatar.png" alt="Agent avatar for Luis" />`,
    },
  },
  {
    id: "v7",
    ruleId: "heading-order",
    impact: "moderate",
    description: "Heading levels should not be skipped",
    wcagCriteria: "1.3.1 Info and Relationships",
    wcagLevel: "A",
    category: "Screen Reader",
    selector: "h4 without preceding h3",
    affectedPages: 4,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/heading-order",
    howToFix: "Ensure heading hierarchy is sequential (h1 → h2 → h3). Don't skip levels for visual styling — use CSS classes instead.",
    codeExample: {
      before: `<h1>Dashboard</h1>\n<h4>Section</h4>`,
      after: `<h1>Dashboard</h1>\n<h2>Section</h2>`,
    },
  },
  {
    id: "v8",
    ruleId: "motion-reduce",
    impact: "moderate",
    description: "Animations should respect prefers-reduced-motion",
    wcagCriteria: "2.3.3 Animation from Interactions",
    wcagLevel: "AAA",
    category: "Motion",
    selector: ".animate-pulse, .animate-spin",
    affectedPages: 7,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/scrollable-region-focusable",
    howToFix: "Wrap animation utilities with motion:reduce variants, or add @media (prefers-reduced-motion: reduce) CSS rules.",
    codeExample: {
      before: `className="animate-pulse"`,
      after: `className="animate-pulse motion-reduce:animate-none"`,
    },
  },
  {
    id: "v9",
    ruleId: "link-name",
    impact: "serious",
    description: "Links must have discernible text",
    wcagCriteria: "4.1.2 Name, Role, Value",
    wcagLevel: "A",
    category: "Screen Reader",
    selector: "a:empty, a[aria-label='']",
    affectedPages: 2,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.7/link-name",
    howToFix: "Ensure anchor elements contain text or an aria-label describing their destination.",
    codeExample: {
      before: `<a href="/docs"></a>`,
      after: `<a href="/docs" aria-label="Open documentation">📖</a>`,
    },
  },
];

const PAGES: AuditedPage[] = [
  { url: "/",              title: "Agent Dashboard",    score: 72, critical: 2, serious: 3, moderate: 1, minor: 0, lastAuditedAt: "2026-02-22T03:00:00Z", violations: ["v1","v2","v3","v5","v7"] },
  { url: "/settings",      title: "Settings",           score: 61, critical: 1, serious: 4, moderate: 2, minor: 1, lastAuditedAt: "2026-02-22T03:01:00Z", violations: ["v1","v2","v4","v5","v7","v8"] },
  { url: "/agents",        title: "Agent Roster",       score: 78, critical: 1, serious: 2, moderate: 1, minor: 0, lastAuditedAt: "2026-02-22T03:02:00Z", violations: ["v2","v3","v5","v8"] },
  { url: "/analytics",     title: "Analytics Overview", score: 55, critical: 2, serious: 3, moderate: 3, minor: 2, lastAuditedAt: "2026-02-22T03:03:00Z", violations: ["v1","v2","v3","v4","v5","v6","v7","v8"] },
  { url: "/knowledge",     title: "Knowledge Base",     score: 69, critical: 1, serious: 2, moderate: 2, minor: 1, lastAuditedAt: "2026-02-22T03:04:00Z", violations: ["v6","v7","v8","v9"] },
  { url: "/integrations",  title: "Integrations Hub",   score: 84, critical: 0, serious: 1, moderate: 1, minor: 0, lastAuditedAt: "2026-02-22T03:05:00Z", violations: ["v1","v5"] },
];

const REMEDIATIONS: RemediationItem[] = [
  { violationId: "v2", category: "Screen Reader",    priority: "immediate", effort: "low",    status: "in-progress", assignedTo: "Quinn" },
  { violationId: "v3", category: "Keyboard Nav",     priority: "immediate", effort: "medium", status: "pending" },
  { violationId: "v6", category: "Screen Reader",    priority: "immediate", effort: "low",    status: "done",        assignedTo: "Reed" },
  { violationId: "v1", category: "Color Contrast",   priority: "high",      effort: "medium", status: "in-progress", assignedTo: "Wes" },
  { violationId: "v4", category: "ARIA Labels",      priority: "high",      effort: "low",    status: "pending" },
  { violationId: "v5", category: "Focus Management", priority: "high",      effort: "low",    status: "pending" },
  { violationId: "v7", category: "Screen Reader",    priority: "medium",    effort: "low",    status: "pending" },
  { violationId: "v8", category: "Motion",           priority: "medium",    effort: "low",    status: "pending" },
  { violationId: "v9", category: "Screen Reader",    priority: "medium",    effort: "low",    status: "pending" },
];

const SEVERITY_CONFIG: Record<Severity, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "text-rose-400",   bg: "bg-rose-900/40 border-rose-800" },
  serious:  { label: "Serious",  color: "text-orange-400", bg: "bg-orange-900/40 border-orange-800" },
  moderate: { label: "Moderate", color: "text-amber-400",  bg: "bg-amber-900/40 border-amber-800" },
  minor:    { label: "Minor",    color: "text-sky-400",    bg: "bg-sky-900/40 border-sky-800" },
};

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: "Pending",     color: "text-fg-secondary bg-surface-2" },
  "in-progress": { label: "In Progress", color: "text-amber-400 bg-amber-900/30" },
  done:        { label: "Done",        color: "text-emerald-400 bg-emerald-900/30" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  immediate: { label: "Immediate", color: "text-rose-400" },
  high:      { label: "High",      color: "text-orange-400" },
  medium:    { label: "Medium",    color: "text-amber-400" },
  low:       { label: "Low",       color: "text-fg-secondary" },
};

type Tab = "overview" | "issues" | "pages" | "fixes";

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "text-emerald-400" : score >= 60 ? "text-amber-400" : "text-rose-400";
  const bg = score >= 80 ? "bg-emerald-900/30 border-emerald-800" : score >= 60 ? "bg-amber-900/30 border-amber-800" : "bg-rose-900/30 border-rose-800";
  return (
    <span className={cn("text-xs font-bold px-2 py-0.5 rounded border", color, bg)}>
      {score}
    </span>
  );
}

function A11yAuditDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-7 w-56 mb-2" />
        <Skeleton variant="text" className="w-80 h-3" />
      </div>
      {/* Tabs */}
      <div className="flex gap-1 border-b border-tok-border mb-6">
        {[80, 64, 56, 96].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-t-lg rounded-b-none" style={{ width: w }} />
        ))}
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="bg-surface-1 border border-tok-border rounded-lg p-5 text-center">
            <Skeleton className="h-10 w-16 mx-auto mb-2" />
            <Skeleton variant="text" className="w-24 h-3 mx-auto" />
          </div>
        ))}
      </div>
      {/* Issues by severity */}
      <div className="bg-surface-1 border border-tok-border rounded-lg p-5 mb-6">
        <Skeleton variant="text" className="w-36 h-4 mb-4" />
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex items-center gap-3 mb-3">
            <Skeleton className="w-20 h-3" />
            <div className="flex-1"><Skeleton className="h-2 w-full rounded-full" /></div>
            <Skeleton className="w-6 h-3" />
          </div>
        ))}
      </div>
      {/* Two columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[0, 1].map(col => (
          <div key={col} className="bg-surface-1 border border-tok-border rounded-lg p-5">
            <Skeleton variant="text" className="w-40 h-4 mb-4" />
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3 mb-3">
                <Skeleton className="w-20 h-3" />
                <div className="flex-1"><Skeleton className="h-2 w-full rounded-full" /></div>
                <Skeleton className="w-6 h-3" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function A11yAuditDashboard({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <A11yAuditDashboardSkeleton />;

  const [tab, setTab] = useState<Tab>("overview");
  const [selectedPage, setSelectedPage] = useState<AuditedPage | null>(null);
  const [selectedViolation, setSelectedViolation] = useState<A11yViolation | null>(null);
  const [impactFilter, setImpactFilter] = useState<Severity | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const overallScore = Math.round(PAGES.reduce((a, p) => a + p.score, 0) / PAGES.length);
  const totalCritical = PAGES.reduce((a, p) => a + p.critical, 0);
  const totalIssues = VIOLATIONS.length;

  const categories = Array.from(new Set(VIOLATIONS.map(v => v.category)));

  const filteredViolations = VIOLATIONS.filter(v => {
    if (impactFilter !== "all" && v.impact !== impactFilter) {return false;}
    if (categoryFilter !== "all" && v.category !== categoryFilter) {return false;}
    return true;
  });

  const WCAG_COUNTS: Record<WCAGLevel, number> = {
    A:   VIOLATIONS.filter(v => v.wcagLevel === "A").length,
    AA:  VIOLATIONS.filter(v => v.wcagLevel === "AA").length,
    AAA: VIOLATIONS.filter(v => v.wcagLevel === "AAA").length,
  };

  const tabs: { id: Tab; label: string; emoji: string }[] = [
    { id: "overview", label: "Overview",         emoji: "📊" },
    { id: "issues",   label: "Issues",           emoji: "⚠️" },
    { id: "pages",    label: "Pages",            emoji: "📄" },
    { id: "fixes",    label: "Remediation",      emoji: "🔧" },
  ];

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold text-fg-primary">Accessibility Audit</h1>
            <p className="text-fg-secondary text-sm mt-1">WCAG 2.1 compliance audit across all Horizon UI surfaces</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-tok-border mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t-lg transition-colors",
              tab === t.id
                ? "text-fg-primary bg-surface-2 border border-b-0 border-tok-border"
                : "text-fg-secondary hover:text-fg-primary"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Score + Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-surface-1 border border-tok-border rounded-lg p-5 text-center col-span-1">
              <div className={cn("text-5xl font-bold mb-1", overallScore >= 80 ? "text-emerald-400" : overallScore >= 60 ? "text-amber-400" : "text-rose-400")}>
                {overallScore}
              </div>
              <div className="text-sm text-fg-secondary">Overall Score</div>
              <div className="text-xs text-fg-muted mt-1">WCAG AA target: 90+</div>
            </div>
            {[
              { label: "Total Issues",     value: totalIssues,  color: "text-fg-primary" },
              { label: "Critical Issues",  value: totalCritical, color: "text-rose-400" },
              { label: "Pages Audited",    value: PAGES.length, color: "text-sky-400" },
            ].map(s => (
              <div key={s.label} className="bg-surface-1 border border-tok-border rounded-lg p-5 text-center">
                <div className={cn("text-4xl font-bold mb-1", s.color)}>{s.value}</div>
                <div className="text-sm text-fg-secondary">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Issues by severity */}
          <div className="bg-surface-1 border border-tok-border rounded-lg p-5">
            <div className="text-sm font-semibold text-fg-primary mb-4">Issues by Severity</div>
            {(["critical", "serious", "moderate", "minor"] as Severity[]).map(sev => {
              const count = VIOLATIONS.filter(v => v.impact === sev).length;
              const pct = (count / VIOLATIONS.length) * 100;
              return (
                <div key={sev} className="flex items-center gap-3 mb-3">
                  <div className="w-20 text-right">
                    <span className={cn("text-xs font-medium", SEVERITY_CONFIG[sev].color)}>
                      {SEVERITY_CONFIG[sev].label}
                    </span>
                  </div>
                  <div className="flex-1 bg-surface-2 rounded-full h-2">
                    <div
                      className={cn("h-full rounded-full", sev === "critical" ? "bg-rose-500" : sev === "serious" ? "bg-orange-500" : sev === "moderate" ? "bg-amber-500" : "bg-sky-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="w-8 text-right text-xs text-fg-secondary">{count}</div>
                </div>
              );
            })}
          </div>

          {/* WCAG levels + top categories */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface-1 border border-tok-border rounded-lg p-5">
              <div className="text-sm font-semibold text-fg-primary mb-4">WCAG Level Breakdown</div>
              <div className="space-y-3">
                {(["A", "AA", "AAA"] as WCAGLevel[]).map(level => (
                  <div key={level} className="flex items-center gap-3">
                    <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-fg-primary font-mono w-12 text-center">
                      WCAG {level}
                    </span>
                    <div className="flex-1 bg-surface-2 rounded-full h-2">
                      <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(WCAG_COUNTS[level] / VIOLATIONS.length) * 100}%` }} />
                    </div>
                    <span className="text-xs text-fg-secondary w-4 text-right">{WCAG_COUNTS[level]}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-1 border border-tok-border rounded-lg p-5">
              <div className="text-sm font-semibold text-fg-primary mb-4">Top Failing Categories</div>
              <div className="space-y-2">
                {categories.map(cat => {
                  const count = VIOLATIONS.filter(v => v.category === cat).length;
                  const affectedPages = Math.max(...VIOLATIONS.filter(v => v.category === cat).map(v => v.affectedPages));
                  return (
                    <div key={cat} className="flex items-center justify-between text-sm">
                      <span className="text-fg-primary">{cat}</span>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-fg-muted">{count} rule{count !== 1 ? "s" : ""}</span>
                        <span className="text-rose-400">{affectedPages} pages</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Issues Tab */}
      {tab === "issues" && (
        <div className="flex gap-4">
          {/* Filters */}
          <div className="w-48 shrink-0 space-y-4">
            <div>
              <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Impact</div>
              {(["all", "critical", "serious", "moderate", "minor"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setImpactFilter(s)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-sm flex items-center gap-2 transition-colors mb-1",
                    impactFilter === s ? "bg-surface-2 text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                  )}
                >
                  {s !== "all" && <div className={cn("w-2 h-2 rounded-full", s === "critical" ? "bg-rose-400" : s === "serious" ? "bg-orange-400" : s === "moderate" ? "bg-amber-400" : "bg-sky-400")} />}
                  {s === "all" ? "All" : SEVERITY_CONFIG[s].label}
                  <span className="ml-auto text-xs text-fg-muted">
                    {s === "all" ? VIOLATIONS.length : VIOLATIONS.filter(v => v.impact === s).length}
                  </span>
                </button>
              ))}
            </div>
            <div>
              <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-2">Category</div>
              {["all", ...categories].map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 rounded text-sm transition-colors mb-1",
                    categoryFilter === cat ? "bg-surface-2 text-fg-primary" : "text-fg-secondary hover:text-fg-primary"
                  )}
                >
                  {cat === "all" ? "All Categories" : cat}
                </button>
              ))}
            </div>
          </div>

          {/* Issue list */}
          <div className="flex-1 space-y-3">
            {filteredViolations.length === 0 && (
              <ContextualEmptyState
                icon={ShieldCheck}
                title="No violations match filters"
                description="Try adjusting the severity or category filters to see results."
                size="md"
              />
            )}
            {filteredViolations.map(v => (
              <div
                key={v.id}
                onClick={() => setSelectedViolation(selectedViolation?.id === v.id ? null : v)}
                className={cn(
                  "bg-surface-1 border rounded-lg p-4 cursor-pointer transition-colors",
                  selectedViolation?.id === v.id ? "border-indigo-600" : "border-tok-border hover:border-tok-border"
                )}
              >
                <div className="flex items-start gap-3 mb-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded border mt-0.5 shrink-0", SEVERITY_CONFIG[v.impact].color, SEVERITY_CONFIG[v.impact].bg)}>
                    {SEVERITY_CONFIG[v.impact].label}
                  </span>
                  <div>
                    <div className="font-medium text-fg-primary text-sm">{v.description}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-fg-muted">
                      <span className="font-mono">{v.ruleId}</span>
                      <span>{v.wcagCriteria}</span>
                      <span className="text-fg-muted">WCAG {v.wcagLevel}</span>
                      <span className="text-rose-400">{v.affectedPages} pages affected</span>
                    </div>
                  </div>
                </div>

                {selectedViolation?.id === v.id && (
                  <div className="mt-4 space-y-4 border-t border-tok-border pt-4" onClick={e => e.stopPropagation()}>
                    <div>
                      <div className="text-xs text-fg-muted mb-1">Selector</div>
                      <code className="text-xs bg-surface-0 px-2 py-1 rounded text-amber-300 font-mono">{v.selector}</code>
                    </div>
                    <div>
                      <div className="text-xs text-fg-muted mb-1">How to Fix</div>
                      <p className="text-sm text-fg-primary">{v.howToFix}</p>
                    </div>
                    {v.codeExample && (
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <div className="text-xs text-rose-400 mb-1">❌ Before</div>
                          <pre className="bg-surface-0 border border-tok-border rounded p-3 text-xs text-fg-secondary font-mono overflow-x-auto whitespace-pre-wrap">{v.codeExample.before}</pre>
                        </div>
                        <div>
                          <div className="text-xs text-emerald-400 mb-1">✅ After</div>
                          <pre className="bg-surface-0 border border-tok-border rounded p-3 text-xs text-fg-primary font-mono overflow-x-auto whitespace-pre-wrap">{v.codeExample.after}</pre>
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-indigo-400 cursor-pointer hover:text-indigo-300">
                      📖 View WCAG guidance →
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pages Tab */}
      {tab === "pages" && (
        <div className="space-y-4">
          <div className="bg-surface-1 border border-tok-border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-tok-border">
                  {["Page", "Score", "Critical", "Serious", "Moderate", "Minor", "Last Audited"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-fg-muted uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAGES.map(page => (
                  <React.Fragment key={page.url}>
                    <tr
                      onClick={() => setSelectedPage(selectedPage?.url === page.url ? null : page)}
                      className="border-b border-tok-border/50 hover:bg-surface-2/30 cursor-pointer"
                    >
                      <td className="px-4 py-3">
                        <div className="font-medium text-fg-primary">{page.title}</div>
                        <div className="text-xs text-fg-muted font-mono">{page.url}</div>
                      </td>
                      <td className="px-4 py-3"><ScoreBadge score={page.score} /></td>
                      <td className="px-4 py-3 text-rose-400 font-medium">{page.critical > 0 ? page.critical : <span className="text-fg-muted">—</span>}</td>
                      <td className="px-4 py-3 text-orange-400">{page.serious > 0 ? page.serious : <span className="text-fg-muted">—</span>}</td>
                      <td className="px-4 py-3 text-amber-400">{page.moderate > 0 ? page.moderate : <span className="text-fg-muted">—</span>}</td>
                      <td className="px-4 py-3 text-sky-400">{page.minor > 0 ? page.minor : <span className="text-fg-muted">—</span>}</td>
                      <td className="px-4 py-3 text-fg-muted text-xs">{new Date(page.lastAuditedAt).toLocaleString()}</td>
                    </tr>
                    {selectedPage?.url === page.url && (
                      <tr className="border-b border-tok-border bg-surface-2/20">
                        <td colSpan={7} className="px-4 py-4">
                          <div className="text-xs font-semibold text-fg-muted uppercase tracking-wider mb-3">Violations on this page</div>
                          <div className="space-y-2">
                            {page.violations.map(vid => {
                              const v = VIOLATIONS.find(vv => vv.id === vid);
                              if (!v) {return null;}
                              return (
                                <div key={vid} className="flex items-center gap-3 text-sm">
                                  <span className={cn("text-xs px-2 py-0.5 rounded border shrink-0", SEVERITY_CONFIG[v.impact].color, SEVERITY_CONFIG[v.impact].bg)}>
                                    {SEVERITY_CONFIG[v.impact].label}
                                  </span>
                                  <span className="text-fg-primary">{v.description}</span>
                                  <span className="text-xs text-fg-muted font-mono ml-auto">{v.ruleId}</span>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Fixes / Remediation Tab */}
      {tab === "fixes" && (
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[
              { label: "Total Items",  value: REMEDIATIONS.length, color: "text-fg-primary" },
              { label: "In Progress",  value: REMEDIATIONS.filter(r => r.status === "in-progress").length, color: "text-amber-400" },
              { label: "Completed",    value: REMEDIATIONS.filter(r => r.status === "done").length, color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-surface-1 border border-tok-border rounded-lg p-4 text-center">
                <div className={cn("text-3xl font-bold", s.color)}>{s.value}</div>
                <div className="text-xs text-fg-muted mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {REMEDIATIONS.map(rem => {
              const v = VIOLATIONS.find(vv => vv.id === rem.violationId);
              if (!v) {return null;}
              return (
                <div key={rem.violationId} className="bg-surface-1 border border-tok-border rounded-lg p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={cn("text-xs font-semibold", PRIORITY_CONFIG[rem.priority].color)}>
                          {PRIORITY_CONFIG[rem.priority].label}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-2 text-fg-secondary">{rem.category}</span>
                        <span className="text-xs text-fg-muted">effort: {rem.effort}</span>
                        {rem.assignedTo && <span className="text-xs text-fg-muted">👤 {rem.assignedTo}</span>}
                      </div>
                      <div className="font-medium text-fg-primary text-sm">{v.description}</div>
                      <div className="text-xs text-fg-muted mt-1 font-mono">{v.ruleId} · {v.wcagCriteria}</div>
                      <div className="text-xs text-fg-secondary mt-2">{v.howToFix}</div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <span className={cn("text-xs px-2 py-1 rounded", STATUS_CONFIG[rem.status].color)}>
                        {STATUS_CONFIG[rem.status].label}
                      </span>
                      {rem.status !== "done" && (
                        <button className="text-xs px-3 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-fg-primary transition-colors">
                          Mark Done
                        </button>
                      )}
                      {rem.status === "done" && <span className="text-sm">✅</span>}
                    </div>
                  </div>
                  {v.codeExample && (
                    <details className="mt-3">
                      <summary className="text-xs text-fg-muted cursor-pointer hover:text-fg-primary">Show code example</summary>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <pre className="bg-surface-0 border border-rose-900/40 rounded p-2 text-xs text-fg-secondary font-mono overflow-x-auto whitespace-pre-wrap">{v.codeExample.before}</pre>
                        <pre className="bg-surface-0 border border-emerald-900/40 rounded p-2 text-xs text-fg-primary font-mono overflow-x-auto whitespace-pre-wrap">{v.codeExample.after}</pre>
                      </div>
                    </details>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

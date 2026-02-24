import React, { useState } from "react"
import { cn } from "../lib/utils"

// ─── Types ───────────────────────────────────────────────────────────────────

type ReleaseStatus = "draft" | "published" | "scheduled"
type TabId = "releases" | "editor" | "distribution" | "analytics"

interface ReleaseSection {
  features: string[]
  bugFixes: string[]
  breakingChanges: string[]
}

interface Release {
  id: string
  version: string
  title: string
  status: ReleaseStatus
  date: string
  author: string
  summary: string
  sections: ReleaseSection
}

interface EmailList {
  id: string
  name: string
  count: number
  sentDate: string | null
  openRate: number
  version: string
}

interface InAppBanner {
  id: string
  title: string
  version: string
  active: boolean
  views: number
  clicks: number
}

interface SlackChannel {
  id: string
  name: string
  version: string
  sentDate: string | null
  reactions: number
}

interface AnalyticsEntry {
  version: string
  openRate: number
  clickRate: number
  totalSent: number
  opens: number
  clicks: number
}

// ─── Mock Data ───────────────────────────────────────────────────────────────

const MOCK_RELEASES: Release[] = [
  {
    id: "rel-1",
    version: "v3.2.0",
    title: "Enhanced Dashboard & Performance",
    status: "published",
    date: "2026-02-15",
    author: "Sam Chen",
    summary: "Major performance improvements across the dashboard with new widget support and reduced load times.",
    sections: {
      features: [
        "New customizable widget grid for the main dashboard",
        "Real-time collaboration indicators on shared documents",
        "Keyboard shortcut command palette (⌘K)",
        "Export reports to PDF and CSV formats",
        "Dark mode system preference detection",
      ],
      bugFixes: [
        "Fixed infinite scroll stutter on the activity feed",
        "Resolved timezone offset errors in scheduled reports",
        "Corrected badge count not resetting after mark-all-read",
        "Fixed drag-and-drop in Firefox 122+",
      ],
      breakingChanges: [
        "Removed legacy `/api/v1/widgets` endpoint — migrate to `/api/v2/widgets`",
        "Dashboard config schema updated: `layout.cols` renamed to `layout.columns`",
      ],
    },
  },
  {
    id: "rel-2",
    version: "v3.1.1",
    title: "Security Patch & Bug Fixes",
    status: "published",
    date: "2026-01-28",
    author: "Quinn Park",
    summary: "Critical security patch addressing XSS vulnerability in the comment renderer, plus several UX fixes.",
    sections: {
      features: [
        "Added rate limiting UI feedback on login attempts",
      ],
      bugFixes: [
        "Patched XSS vulnerability in markdown comment renderer",
        "Fixed session persistence after browser restart",
        "Resolved blank screen on Safari 17 after OAuth redirect",
        "Fixed notification dropdown closing prematurely on mobile",
        "Corrected broken pagination on the members page",
      ],
      breakingChanges: [],
    },
  },
  {
    id: "rel-3",
    version: "v3.1.0",
    title: "Integrations & Workflow Automation",
    status: "published",
    date: "2026-01-10",
    author: "Wes Nakamura",
    summary: "First-class integrations with Slack, Linear, and GitHub, plus a new automation rules engine.",
    sections: {
      features: [
        "Native Slack integration — post updates directly from the app",
        "Linear issue sync with bi-directional status updates",
        "GitHub PR linkage on release notes",
        "Automation rules engine — trigger actions on status changes",
        "Webhook delivery logs with retry controls",
        "New integrations marketplace page",
      ],
      bugFixes: [
        "Fixed OAuth token refresh race condition",
        "Resolved duplicate webhook deliveries under high load",
        "Corrected Slack channel selector truncating long names",
      ],
      breakingChanges: [
        "Webhook payloads now include `api_version` field — update consumers",
      ],
    },
  },
  {
    id: "rel-4",
    version: "v3.0.0",
    title: "Platform Relaunch — New Architecture",
    status: "published",
    date: "2025-12-01",
    author: "Piper Lund",
    summary: "Complete platform relaunch with redesigned UI, new data model, and a fully rewritten backend.",
    sections: {
      features: [
        "Completely redesigned interface built on new design system",
        "Multi-workspace support with unified billing",
        "Role-based access control with granular permissions",
        "Global search across all workspaces",
        "New onboarding flow with interactive tutorials",
        "API v2 with GraphQL support",
      ],
      bugFixes: [
        "All known v2.x bugs resolved in the rewrite",
      ],
      breakingChanges: [
        "Full API v1 deprecation — all endpoints removed",
        "Data migration required: run `migrator --from=2.x --to=3.0`",
        "Legacy webhook format no longer supported",
        "OAuth scopes updated — users must re-authorize integrations",
      ],
    },
  },
  {
    id: "rel-5",
    version: "v3.3.0",
    title: "AI Assistant & Smart Suggestions",
    status: "scheduled",
    date: "2026-03-10",
    author: "Reed Kim",
    summary: "Introducing the AI assistant for drafting content, smart suggestions, and anomaly detection in analytics.",
    sections: {
      features: [
        "AI assistant for drafting release notes from commit messages",
        "Smart tag suggestions based on content analysis",
        "Anomaly detection alerts in the analytics dashboard",
        "Semantic search across all release history",
        "Auto-summarize release notes for Slack digests",
      ],
      bugFixes: [
        "Pre-release: fixing editor cursor jump on paste",
      ],
      breakingChanges: [],
    },
  },
  {
    id: "rel-6",
    version: "v3.2.1",
    title: "Hotfix — Editor & Exports",
    status: "draft",
    date: "2026-02-22",
    author: "Sam Chen",
    summary: "Hotfix for editor cursor regression introduced in v3.2.0 and PDF export encoding issues.",
    sections: {
      features: [],
      bugFixes: [
        "Fixed editor cursor jumping to line 1 on certain keyboard combos",
        "Corrected UTF-8 encoding in PDF exports",
        "Resolved table alignment in exported markdown",
      ],
      breakingChanges: [],
    },
  },
]

const MOCK_EMAIL_LISTS: EmailList[] = [
  { id: "el-1", name: "All Customers", count: 48320, sentDate: "2026-02-15", openRate: 34.2, version: "v3.2.0" },
  { id: "el-2", name: "Enterprise Tier", count: 1240, sentDate: "2026-02-15", openRate: 61.7, version: "v3.2.0" },
  { id: "el-3", name: "Beta Testers", count: 387, sentDate: "2026-02-14", openRate: 78.9, version: "v3.2.0" },
  { id: "el-4", name: "Developer API Users", count: 6840, sentDate: "2026-01-10", openRate: 52.4, version: "v3.1.0" },
  { id: "el-5", name: "Trial Users", count: 12005, sentDate: null, openRate: 0, version: "v3.2.1" },
]

const MOCK_BANNERS: InAppBanner[] = [
  { id: "b-1", title: "New dashboard widgets available!", version: "v3.2.0", active: true, views: 92400, clicks: 18320 },
  { id: "b-2", title: "Check out the new integrations marketplace", version: "v3.1.0", active: false, views: 71200, clicks: 9840 },
  { id: "b-3", title: "Security update applied — review your sessions", version: "v3.1.1", active: false, views: 43800, clicks: 5120 },
  { id: "b-4", title: "Platform v3.0 is here — explore what's new", version: "v3.0.0", active: false, views: 124500, clicks: 38760 },
]

const MOCK_SLACK_CHANNELS: SlackChannel[] = [
  { id: "sc-1", name: "#product-updates", version: "v3.2.0", sentDate: "2026-02-15", reactions: 47 },
  { id: "sc-2", name: "#engineering", version: "v3.2.0", sentDate: "2026-02-15", reactions: 31 },
  { id: "sc-3", name: "#customer-success", version: "v3.1.1", sentDate: "2026-01-28", reactions: 12 },
  { id: "sc-4", name: "#general", version: "v3.1.0", sentDate: "2026-01-10", reactions: 89 },
  { id: "sc-5", name: "#beta-program", version: "v3.3.0", sentDate: null, reactions: 0 },
]

const MOCK_ANALYTICS: AnalyticsEntry[] = [
  { version: "v3.2.0", openRate: 34.2, clickRate: 12.8, totalSent: 49947, opens: 17082, clicks: 6393 },
  { version: "v3.1.1", openRate: 29.4, clickRate: 8.1, totalSent: 47200, opens: 13877, clicks: 3823 },
  { version: "v3.1.0", openRate: 41.6, clickRate: 18.3, totalSent: 44100, opens: 18346, clicks: 8070 },
  { version: "v3.0.0", openRate: 58.3, clickRate: 31.2, totalSent: 38700, opens: 22562, clicks: 12074 },
  { version: "v2.9.0", openRate: 26.7, clickRate: 9.4, totalSent: 35200, opens: 9398, clicks: 3309 },
]

const DEFAULT_EDITOR_CONTENT = `## v3.2.1 — Hotfix Release

### 🐛 Bug Fixes
- Fixed editor cursor jumping to line 1 on certain keyboard combos
- Corrected UTF-8 encoding in PDF exports
- Resolved table alignment in exported markdown

### 📦 Notes
This is a targeted hotfix. No migration steps required.
Upgrade via: \`npm install @clawdbot/sdk@3.2.1\`
`

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ReleaseStatus }) {
  const cfg: Record<ReleaseStatus, { label: string; cls: string }> = {
    published: { label: "Published", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    draft: { label: "Draft", cls: "bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] border-[var(--color-surface-3)]/30" },
    scheduled: { label: "Scheduled", cls: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
  }
  const { label, cls } = cfg[status]
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border", cls)}>
      {label}
    </span>
  )
}

// ─── Icon SVGs ────────────────────────────────────────────────────────────────

function IconRocket({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  )
}

function IconBug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m8 2 1.88 1.88" /><path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6z" />
      <path d="M12 20v-9" /><path d="M6.53 9C4.6 8.8 3 7.1 3 5" /><path d="M6 13H2" /><path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" /><path d="M22 13h-4" /><path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  )
}

function IconAlertTriangle({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" /><path d="M12 17h.01" />
    </svg>
  )
}

function IconMail({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

function IconHash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" x2="20" y1="9" y2="9" /><line x1="4" x2="20" y1="15" y2="15" />
      <line x1="10" x2="8" y1="3" y2="21" /><line x1="16" x2="14" y1="3" y2="21" />
    </svg>
  )
}

function IconMonitor({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="14" x="2" y="3" rx="2" />
      <path d="M8 21h8" /><path d="M12 17v4" />
    </svg>
  )
}

function IconBarChart({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" x2="12" y1="20" y2="10" /><line x1="18" x2="18" y1="20" y2="4" /><line x1="6" x2="6" y1="20" y2="16" />
    </svg>
  )
}

function IconEdit({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function IconPackage({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

// ─── Releases Tab ─────────────────────────────────────────────────────────────

function ReleasesTab({
  releases,
  selected,
  onSelect,
}: {
  releases: Release[]
  selected: Release | null
  onSelect: (r: Release) => void
}) {
  return (
    <div className="flex gap-4 h-full min-h-0">
      {/* List */}
      <div className="w-72 shrink-0 flex flex-col gap-2 overflow-y-auto pr-1">
        {releases.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r)}
            className={cn(
              "w-full text-left rounded-xl border p-4 transition-all",
              selected?.id === r.id
                ? "border-indigo-500/60 bg-indigo-500/10"
                : "border-[var(--color-border)] bg-[var(--color-surface-1)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50"
            )}
          >
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="font-mono text-sm font-semibold text-[var(--color-text-primary)]">{r.version}</span>
              <StatusBadge status={r.status} />
            </div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-snug mb-2 line-clamp-2">{r.title}</p>
            <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
              <span>{r.date}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span>{r.author}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail */}
      {selected ? (
        <div className="flex-1 min-w-0 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-y-auto">
          <div className="p-6 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3 mb-1">
              <span className="font-mono text-2xl font-bold text-[var(--color-text-primary)]">{selected.version}</span>
              <StatusBadge status={selected.status} />
            </div>
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">{selected.title}</h2>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-3">{selected.summary}</p>
            <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
              <span>📅 {selected.date}</span>
              <span>✍️ {selected.author}</span>
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Features */}
            {selected.sections.features.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <IconRocket className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">New Features</h3>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{selected.sections.features.length} items</span>
                </div>
                <ul className="space-y-2">
                  {selected.sections.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <IconCheck className="w-3.5 h-3.5 mt-0.5 text-emerald-400 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Bug Fixes */}
            {selected.sections.bugFixes.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <IconBug className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Bug Fixes</h3>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{selected.sections.bugFixes.length} items</span>
                </div>
                <ul className="space-y-2">
                  {selected.sections.bugFixes.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
                      <span className="w-3.5 h-3.5 mt-0.5 text-amber-400 shrink-0 text-xs">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Breaking Changes */}
            {selected.sections.breakingChanges.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <IconAlertTriangle className="w-4 h-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Breaking Changes</h3>
                  <span className="ml-auto text-xs text-[var(--color-text-muted)]">{selected.sections.breakingChanges.length} items</span>
                </div>
                <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3 space-y-2">
                  {selected.sections.breakingChanges.map((f, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm text-rose-300">
                      <IconAlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-rose-400" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.sections.features.length === 0 &&
              selected.sections.bugFixes.length === 0 &&
              selected.sections.breakingChanges.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] italic">No release note sections drafted yet.</p>
              )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-[var(--color-text-muted)] text-sm">
          Select a release to view details
        </div>
      )}
    </div>
  )
}

// ─── Editor Tab ───────────────────────────────────────────────────────────────

function EditorTab() {
  const [content, setContent] = useState(DEFAULT_EDITOR_CONTENT)
  const [isPreview, setIsPreview] = useState(false)
  const [version, setVersion] = useState("v3.2.1")
  const [releaseType, setReleaseType] = useState("patch")
  const [saved, setSaved] = useState(false)

  function handleSave() {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  // Simple markdown-to-HTML parser (no external deps)
  function renderMarkdown(text: string): string {
    return text
      .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-[var(--color-text-primary)] mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-lg font-bold text-[var(--color-text-primary)] mt-6 mb-2 border-b border-[var(--color-border)] pb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-[var(--color-text-primary)] mt-6 mb-3">$1</h1>')
      .replace(/^- (.+)$/gm, '<li class="ml-4 text-[var(--color-text-primary)] text-sm leading-relaxed list-disc">$1</li>')
      .replace(/`([^`]+)`/g, '<code class="px-1 py-0.5 rounded bg-[var(--color-surface-2)] text-indigo-300 text-xs font-mono">$1</code>')
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-[var(--color-text-primary)] font-semibold">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em class="text-[var(--color-text-primary)] italic">$1</em>')
      .replace(/\n\n/g, '<br/><br/>')
  }

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-text-muted)]">Version</label>
          <input
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-24 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] font-mono focus:outline-none focus:border-indigo-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--color-text-muted)]">Type</label>
          <select
            value={releaseType}
            onChange={(e) => setReleaseType(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-indigo-500"
          >
            <option value="major">Major</option>
            <option value="minor">Minor</option>
            <option value="patch">Patch</option>
            <option value="hotfix">Hotfix</option>
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setIsPreview(false)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              !isPreview ? "bg-indigo-600 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <IconEdit className="w-3.5 h-3.5" />
            Edit
          </button>
          <button
            onClick={() => setIsPreview(true)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
              isPreview ? "bg-indigo-600 text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <IconEye className="w-3.5 h-3.5" />
            Preview
          </button>
          <button
            onClick={handleSave}
            className={cn(
              "flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-semibold transition-all",
              saved
                ? "bg-emerald-600 text-[var(--color-text-primary)]"
                : "bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)]"
            )}
          >
            {saved ? <><IconCheck className="w-3.5 h-3.5" /> Saved</> : "Save Draft"}
          </button>
        </div>
      </div>

      {/* Editor/Preview area */}
      <div className="flex-1 min-h-0 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        {isPreview ? (
          <div className="h-full overflow-y-auto p-6">
            <div
              className="prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
          </div>
        ) : (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="w-full h-full bg-transparent text-[var(--color-text-primary)] text-sm font-mono leading-relaxed p-6 resize-none focus:outline-none placeholder:text-[var(--color-text-muted)]"
            placeholder="Write release notes in Markdown..."
          />
        )}
      </div>

      {/* Word count */}
      <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
        <span>{content.split(/\s+/).filter(Boolean).length} words</span>
        <span>{content.length} chars</span>
        <span>{content.split("\n").length} lines</span>
      </div>
    </div>
  )
}

// ─── Distribution Tab ─────────────────────────────────────────────────────────

function DistributionTab({
  emailLists,
  banners,
  slackChannels,
}: {
  emailLists: EmailList[]
  banners: InAppBanner[]
  slackChannels: SlackChannel[]
}) {
  const [distSection, setDistSection] = useState<"email" | "banners" | "slack">("email")

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Sub-nav */}
      <div className="flex gap-1 bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-1 w-fit">
        {(["email", "banners", "slack"] as const).map((s) => {
          const labels: Record<string, string> = { email: "Email Lists", banners: "In-App Banners", slack: "Slack Channels" }
          const icons: Record<string, React.ReactNode> = {
            email: <IconMail className="w-3.5 h-3.5" />,
            banners: <IconMonitor className="w-3.5 h-3.5" />,
            slack: <IconHash className="w-3.5 h-3.5" />,
          }
          return (
            <button
              key={s}
              onClick={() => setDistSection(s)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                distSection === s ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {icons[s]}
              {labels[s]}
            </button>
          )
        })}
      </div>

      {/* Email Lists */}
      {distSection === "email" && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {emailLists.map((list) => (
            <div key={list.id} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border)] transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                    <IconMail className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">{list.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-text-muted)]">
                      <IconUsers className="w-3 h-3" />
                      <span>{list.count.toLocaleString()} subscribers</span>
                      <span className="text-[var(--color-text-muted)]">·</span>
                      <span>{list.version}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  {list.sentDate ? (
                    <>
                      <p className="text-xs text-[var(--color-text-muted)]">Sent {list.sentDate}</p>
                      <p className="text-sm font-semibold text-emerald-400 mt-0.5">{list.openRate}% open rate</p>
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30">
                      Pending
                    </span>
                  )}
                </div>
              </div>
              {list.sentDate && (
                <div className="mt-3">
                  <div className="h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${list.openRate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* In-App Banners */}
      {distSection === "banners" && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {banners.map((banner) => {
            const ctr = banner.views > 0 ? ((banner.clicks / banner.views) * 100).toFixed(1) : "0.0"
            return (
              <div key={banner.id} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border)] transition-colors">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                      <IconMonitor className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">{banner.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{banner.version}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {banner.active ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30">
                        Inactive
                      </span>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{banner.views.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Views</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-[var(--color-text-primary)]">{banner.clicks.toLocaleString()}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Clicks</p>
                  </div>
                  <div className="bg-[var(--color-surface-2)]/50 rounded-lg p-3 text-center">
                    <p className="text-lg font-bold text-indigo-400">{ctr}%</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">CTR</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Slack Channels */}
      {distSection === "slack" && (
        <div className="flex-1 overflow-y-auto space-y-3">
          {slackChannels.map((ch) => (
            <div key={ch.id} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 hover:border-[var(--color-border)] transition-colors">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                    <IconHash className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text-primary)] font-mono">{ch.name}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{ch.version}</p>
                  </div>
                </div>
                <div className="text-right">
                  {ch.sentDate ? (
                    <>
                      <p className="text-xs text-[var(--color-text-muted)]">Sent {ch.sentDate}</p>
                      <p className="text-sm text-[var(--color-text-primary)] mt-0.5">
                        <span className="text-amber-400 font-semibold">{ch.reactions}</span> reactions
                      </p>
                    </>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--color-surface-3)]/50 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30">
                      Not sent
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
          <div className="bg-[var(--color-surface-1)] rounded-xl border border-dashed border-[var(--color-border)] p-4 flex items-center justify-center">
            <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              + Add Slack Channel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ data }: { data: AnalyticsEntry[] }) {
  const [metric, setMetric] = useState<"openRate" | "clickRate">("openRate")

  const maxRate = Math.max(...data.map((d) => (metric === "openRate" ? d.openRate : d.clickRate)))

  const totalOpens = data.reduce((s, d) => s + d.opens, 0)
  const totalClicks = data.reduce((s, d) => s + d.clicks, 0)
  const totalSent = data.reduce((s, d) => s + d.totalSent, 0)
  const avgOpen = (data.reduce((s, d) => s + d.openRate, 0) / data.length).toFixed(1)
  const avgClick = (data.reduce((s, d) => s + d.clickRate, 0) / data.length).toFixed(1)

  return (
    <div className="flex flex-col gap-4 h-full min-h-0 overflow-y-auto">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Sent", value: totalSent.toLocaleString(), icon: <IconPackage className="w-4 h-4 text-indigo-400" />, color: "text-[var(--color-text-primary)]" },
          { label: "Total Opens", value: totalOpens.toLocaleString(), icon: <IconMail className="w-4 h-4 text-emerald-400" />, color: "text-emerald-400" },
          { label: "Total Clicks", value: totalClicks.toLocaleString(), icon: <IconBarChart className="w-4 h-4 text-indigo-400" />, color: "text-indigo-400" },
          { label: "Avg Open Rate", value: `${avgOpen}%`, icon: <IconEye className="w-4 h-4 text-amber-400" />, color: "text-amber-400" },
        ].map(({ label, value, icon, color }) => (
          <div key={label} className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4">
            <div className="flex items-center gap-2 mb-2 text-[var(--color-text-muted)]">
              {icon}
              <span className="text-xs">{label}</span>
            </div>
            <p className={cn("text-2xl font-bold", color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* Bar chart */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Engagement by Version</h3>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Avg: {avgOpen}% open · {avgClick}% click</p>
          </div>
          <div className="flex gap-1 bg-[var(--color-surface-2)] rounded-lg p-0.5">
            <button
              onClick={() => setMetric("openRate")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                metric === "openRate" ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Open Rate
            </button>
            <button
              onClick={() => setMetric("clickRate")}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all",
                metric === "clickRate" ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Click Rate
            </button>
          </div>
        </div>

        {/* Bars */}
        <div className="space-y-3">
          {data.map((entry) => {
            const val = metric === "openRate" ? entry.openRate : entry.clickRate
            const pct = maxRate > 0 ? (val / maxRate) * 100 : 0
            const barColor = metric === "openRate" ? "bg-emerald-500" : "bg-indigo-500"
            return (
              <div key={entry.version} className="flex items-center gap-3">
                <span className="w-14 text-right text-xs font-mono text-[var(--color-text-secondary)] shrink-0">
                  {entry.version}
                </span>
                <div className="flex-1 h-6 bg-[var(--color-surface-2)] rounded-md overflow-hidden relative">
                  <div
                    className={cn("h-full rounded-md transition-all duration-500", barColor)}
                    style={{ width: `${pct}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-2 text-xs font-semibold text-[var(--color-text-primary)] mix-blend-plus-lighter">
                    {val.toFixed(1)}%
                  </span>
                </div>
                <span className="w-20 text-xs text-[var(--color-text-muted)] shrink-0">
                  {metric === "openRate"
                    ? `${entry.opens.toLocaleString()} opens`
                    : `${entry.clicks.toLocaleString()} clicks`}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Side-by-side comparison */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Open vs Click Rate Comparison</h3>
        <div className="space-y-4">
          {data.map((entry) => (
            <div key={entry.version}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-mono text-[var(--color-text-secondary)]">{entry.version}</span>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-emerald-400 font-semibold">{entry.openRate}% open</span>
                  <span className="text-indigo-400 font-semibold">{entry.clickRate}% click</span>
                </div>
              </div>
              <div className="relative h-4 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-emerald-500/40"
                  style={{ width: `${entry.openRate}%` }}
                />
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-indigo-500"
                  style={{ width: `${entry.clickRate}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-4 text-xs text-[var(--color-text-muted)]">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-emerald-500/40" />
            Open Rate
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm bg-indigo-500" />
            Click Rate
          </div>
        </div>
      </div>

      {/* Stats table */}
      <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)]">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Detailed Stats</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {["Version", "Sent", "Opens", "Open Rate", "Clicks", "Click Rate"].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-[var(--color-text-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <tr
                  key={entry.version}
                  className={cn(
                    "border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors",
                    i === data.length - 1 && "border-b-0"
                  )}
                >
                  <td className="px-4 py-3 font-mono text-xs text-[var(--color-text-primary)] font-semibold">{entry.version}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{entry.totalSent.toLocaleString()}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{entry.opens.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="text-emerald-400 font-semibold">{entry.openRate}%</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{entry.clicks.toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <span className="text-indigo-400 font-semibold">{entry.clickRate}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ─── Root Component ───────────────────────────────────────────────────────────

export default function ReleaseNotesManager() {
  const [activeTab, setActiveTab] = useState<TabId>("releases")
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(MOCK_RELEASES[0])

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "releases", label: "Releases", icon: <IconPackage className="w-4 h-4" /> },
    { id: "editor", label: "Editor", icon: <IconEdit className="w-4 h-4" /> },
    { id: "distribution", label: "Distribution", icon: <IconMail className="w-4 h-4" /> },
    { id: "analytics", label: "Analytics", icon: <IconBarChart className="w-4 h-4" /> },
  ]

  const publishedCount = MOCK_RELEASES.filter((r) => r.status === "published").length
  const draftCount = MOCK_RELEASES.filter((r) => r.status === "draft").length
  const scheduledCount = MOCK_RELEASES.filter((r) => r.status === "scheduled").length

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-0)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2.5 mb-0.5">
                <IconPackage className="w-5 h-5 text-indigo-400" />
                <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Release Notes Manager</h1>
              </div>
              <p className="text-sm text-[var(--color-text-muted)]">Author, distribute, and track release communications</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mr-2">
                <span><span className="text-emerald-400 font-semibold">{publishedCount}</span> published</span>
                <span><span className="text-[var(--color-text-secondary)] font-semibold">{draftCount}</span> draft</span>
                <span><span className="text-amber-400 font-semibold">{scheduledCount}</span> scheduled</span>
              </div>
              <button className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] rounded-lg text-sm font-semibold transition-colors">
                <span className="text-base leading-none">+</span>
                New Release
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                  activeTab === tab.id
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
                    : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-1)]"
                )}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-6 py-6 flex flex-col min-h-0">
        {activeTab === "releases" && (
          <ReleasesTab
            releases={MOCK_RELEASES}
            selected={selectedRelease}
            onSelect={setSelectedRelease}
          />
        )}
        {activeTab === "editor" && <EditorTab />}
        {activeTab === "distribution" && (
          <DistributionTab
            emailLists={MOCK_EMAIL_LISTS}
            banners={MOCK_BANNERS}
            slackChannels={MOCK_SLACK_CHANNELS}
          />
        )}
        {activeTab === "analytics" && <AnalyticsTab data={MOCK_ANALYTICS} />}
      </div>
    </div>
  )
}

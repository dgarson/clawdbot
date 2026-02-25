import React, { useState } from "react"
import { cn } from "../lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

type RequestType = "access" | "deletion" | "portability" | "correction"
type Jurisdiction = "GDPR" | "CCPA" | "LGPD"
type RequestStatus = "pending" | "in-progress" | "completed" | "overdue"
type ConsentAction = "granted" | "revoked"
type MapStatus = "compliant" | "needs-review" | "non-compliant"

interface DSR {
  id: string
  subject: string
  email: string
  type: RequestType
  jurisdiction: Jurisdiction
  submitted: string
  due: string
  status: RequestStatus
  assignedTo: string
  timeline: { date: string; step: string; actor: string; done: boolean }[]
}

interface ConsentCategory {
  id: string
  name: string
  total: number
  optInPct: number
  trend: number[]
}

interface ConsentLog {
  id: string
  user: string
  category: string
  action: ConsentAction
  timestamp: string
  source: string
}

interface ProcessingActivity {
  id: string
  name: string
  purpose: string
  legalBasis: string
  dataCategories: string
  recipients: string
  retention: string
  transferCountries: string
  status: MapStatus
}

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_DSRS: DSR[] = [
  {
    id: "DSR-001",
    subject: "Alice Hoffman",
    email: "alice.hoffman@email.com",
    type: "access",
    jurisdiction: "GDPR",
    submitted: "2026-01-28",
    due: "2026-02-27",
    status: "in-progress",
    assignedTo: "Sarah K.",
    timeline: [
      { date: "2026-01-28", step: "Request received", actor: "System", done: true },
      { date: "2026-01-29", step: "Identity verified", actor: "Sarah K.", done: true },
      { date: "2026-02-03", step: "Data collection started", actor: "Sarah K.", done: true },
      { date: "2026-02-20", step: "Report compiled", actor: "Sarah K.", done: false },
      { date: "2026-02-27", step: "Response sent to subject", actor: "Sarah K.", done: false },
    ],
  },
  {
    id: "DSR-002",
    subject: "Marcus Webb",
    email: "m.webb@domain.org",
    type: "deletion",
    jurisdiction: "CCPA",
    submitted: "2026-01-15",
    due: "2026-02-14",
    status: "overdue",
    assignedTo: "Tom R.",
    timeline: [
      { date: "2026-01-15", step: "Request received", actor: "System", done: true },
      { date: "2026-01-16", step: "Identity verified", actor: "Tom R.", done: true },
      { date: "2026-01-20", step: "Deletion scope assessed", actor: "Tom R.", done: true },
      { date: "2026-02-14", step: "Data deleted", actor: "Tom R.", done: false },
      { date: "2026-02-14", step: "Confirmation sent", actor: "Tom R.", done: false },
    ],
  },
  {
    id: "DSR-003",
    subject: "Priya Nair",
    email: "priya.nair@corp.in",
    type: "portability",
    jurisdiction: "GDPR",
    submitted: "2026-02-01",
    due: "2026-03-03",
    status: "pending",
    assignedTo: "Unassigned",
    timeline: [
      { date: "2026-02-01", step: "Request received", actor: "System", done: true },
      { date: "", step: "Identity verification", actor: "—", done: false },
      { date: "", step: "Data export prepared", actor: "—", done: false },
      { date: "", step: "Export delivered", actor: "—", done: false },
    ],
  },
  {
    id: "DSR-004",
    subject: "Jonas Bauer",
    email: "jonas.bauer@test.de",
    type: "correction",
    jurisdiction: "GDPR",
    submitted: "2026-02-10",
    due: "2026-03-12",
    status: "pending",
    assignedTo: "Lisa M.",
    timeline: [
      { date: "2026-02-10", step: "Request received", actor: "System", done: true },
      { date: "2026-02-11", step: "Identity verified", actor: "Lisa M.", done: true },
      { date: "", step: "Correction applied", actor: "—", done: false },
      { date: "", step: "Confirmation sent", actor: "—", done: false },
    ],
  },
  {
    id: "DSR-005",
    subject: "Camila Reyes",
    email: "c.reyes@latam.br",
    type: "access",
    jurisdiction: "LGPD",
    submitted: "2026-01-05",
    due: "2026-02-04",
    status: "completed",
    assignedTo: "Tom R.",
    timeline: [
      { date: "2026-01-05", step: "Request received", actor: "System", done: true },
      { date: "2026-01-06", step: "Identity verified", actor: "Tom R.", done: true },
      { date: "2026-01-12", step: "Data collected", actor: "Tom R.", done: true },
      { date: "2026-02-01", step: "Report sent to subject", actor: "Tom R.", done: true },
    ],
  },
  {
    id: "DSR-006",
    subject: "Omar Khalil",
    email: "omar.k@mena.ae",
    type: "deletion",
    jurisdiction: "GDPR",
    submitted: "2026-02-05",
    due: "2026-03-07",
    status: "in-progress",
    assignedTo: "Sarah K.",
    timeline: [
      { date: "2026-02-05", step: "Request received", actor: "System", done: true },
      { date: "2026-02-06", step: "Identity verified", actor: "Sarah K.", done: true },
      { date: "2026-02-08", step: "Deletion scope mapped", actor: "Sarah K.", done: false },
      { date: "", step: "Data purged", actor: "—", done: false },
    ],
  },
  {
    id: "DSR-007",
    subject: "Nina Petrov",
    email: "n.petrov@eu.sk",
    type: "portability",
    jurisdiction: "GDPR",
    submitted: "2026-01-20",
    due: "2026-02-19",
    status: "completed",
    assignedTo: "Lisa M.",
    timeline: [
      { date: "2026-01-20", step: "Request received", actor: "System", done: true },
      { date: "2026-01-21", step: "Identity verified", actor: "Lisa M.", done: true },
      { date: "2026-01-28", step: "Export prepared", actor: "Lisa M.", done: true },
      { date: "2026-02-15", step: "Export delivered", actor: "Lisa M.", done: true },
    ],
  },
  {
    id: "DSR-008",
    subject: "Derek Flynn",
    email: "derek.f@company.ie",
    type: "correction",
    jurisdiction: "GDPR",
    submitted: "2026-01-18",
    due: "2026-02-17",
    status: "overdue",
    assignedTo: "Tom R.",
    timeline: [
      { date: "2026-01-18", step: "Request received", actor: "System", done: true },
      { date: "2026-01-19", step: "Identity verified", actor: "Tom R.", done: true },
      { date: "", step: "Correction applied", actor: "—", done: false },
      { date: "", step: "Confirmation sent", actor: "—", done: false },
    ],
  },
]

const MOCK_CONSENT: ConsentCategory[] = [
  { id: "marketing", name: "Marketing", total: 14820, optInPct: 62, trend: [58, 60, 61, 62, 61, 63, 62] },
  { id: "analytics", name: "Analytics", total: 21430, optInPct: 78, trend: [74, 75, 77, 78, 78, 79, 78] },
  { id: "functional", name: "Functional", total: 24100, optInPct: 91, trend: [89, 90, 90, 91, 91, 92, 91] },
  { id: "third-party", name: "Third-Party", total: 9870, optInPct: 41, trend: [44, 43, 42, 41, 40, 41, 41] },
]

const MOCK_CONSENT_LOG: ConsentLog[] = [
  { id: "cl-1", user: "alice.hoffman@email.com", category: "Marketing", action: "granted", timestamp: "2026-02-22 08:14", source: "Web Signup" },
  { id: "cl-2", user: "m.webb@domain.org", category: "Analytics", action: "revoked", timestamp: "2026-02-22 07:55", source: "Privacy Center" },
  { id: "cl-3", user: "priya.nair@corp.in", category: "Third-Party", action: "revoked", timestamp: "2026-02-21 23:02", source: "Mobile App" },
  { id: "cl-4", user: "jonas.bauer@test.de", category: "Functional", action: "granted", timestamp: "2026-02-21 18:30", source: "Cookie Banner" },
  { id: "cl-5", user: "c.reyes@latam.br", category: "Marketing", action: "granted", timestamp: "2026-02-21 15:44", source: "Web Signup" },
  { id: "cl-6", user: "omar.k@mena.ae", category: "Analytics", action: "granted", timestamp: "2026-02-21 12:09", source: "Cookie Banner" },
  { id: "cl-7", user: "n.petrov@eu.sk", category: "Third-Party", action: "revoked", timestamp: "2026-02-20 20:18", source: "Privacy Center" },
  { id: "cl-8", user: "derek.f@company.ie", category: "Functional", action: "granted", timestamp: "2026-02-20 09:55", source: "Mobile App" },
]

const MOCK_PROCESSING: ProcessingActivity[] = [
  {
    id: "pa-1", name: "Customer CRM", purpose: "Customer relationship management", legalBasis: "Legitimate Interest",
    dataCategories: "Name, Email, Phone, Purchase History", recipients: "Internal, Salesforce",
    retention: "5 years", transferCountries: "US, EU", status: "compliant",
  },
  {
    id: "pa-2", name: "Email Marketing", purpose: "Promotional communications", legalBasis: "Consent",
    dataCategories: "Email, Name, Preferences", recipients: "Mailchimp, Internal",
    retention: "Until revocation", transferCountries: "US", status: "compliant",
  },
  {
    id: "pa-3", name: "Analytics Platform", purpose: "Product usage analytics", legalBasis: "Consent",
    dataCategories: "Usage Data, Device ID, IP", recipients: "Mixpanel, Internal",
    retention: "2 years", transferCountries: "US, IE", status: "needs-review",
  },
  {
    id: "pa-4", name: "HR Records", purpose: "Employee management", legalBasis: "Contract",
    dataCategories: "Name, Address, Salary, Health", recipients: "Internal, Payroll Provider",
    retention: "7 years post-employment", transferCountries: "EU only", status: "compliant",
  },
  {
    id: "pa-5", name: "Ad Targeting", purpose: "Behavioral advertising", legalBasis: "Consent",
    dataCategories: "Browsing, Location, Interests", recipients: "Google Ads, Meta",
    retention: "90 days", transferCountries: "US, IE, SG", status: "non-compliant",
  },
  {
    id: "pa-6", name: "Support Ticketing", purpose: "Customer support", legalBasis: "Contract",
    dataCategories: "Name, Email, Issue Details", recipients: "Zendesk, Internal",
    retention: "3 years", transferCountries: "US, EU", status: "compliant",
  },
  {
    id: "pa-7", name: "Fraud Detection", purpose: "Security & fraud prevention", legalBasis: "Legitimate Interest",
    dataCategories: "Transaction Data, Device, IP", recipients: "Internal, Stripe",
    retention: "5 years", transferCountries: "US, EU", status: "needs-review",
  },
]

const MONTHLY_STATS = [
  { month: "Sep", volume: 18 },
  { month: "Oct", volume: 23 },
  { month: "Nov", volume: 19 },
  { month: "Dec", volume: 14 },
  { month: "Jan", volume: 31 },
  { month: "Feb", volume: 27 },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(status: RequestStatus): string {
  switch (status) {
    case "completed": return "text-emerald-400 bg-emerald-400/10"
    case "in-progress": return "text-primary bg-primary/10"
    case "overdue": return "text-rose-400 bg-rose-400/10"
    default: return "text-amber-400 bg-amber-400/10"
  }
}

function mapStatusColor(status: MapStatus): string {
  switch (status) {
    case "compliant": return "text-emerald-400 bg-emerald-400/10"
    case "needs-review": return "text-amber-400 bg-amber-400/10"
    default: return "text-rose-400 bg-rose-400/10"
  }
}

function typeIcon(type: RequestType): string {
  switch (type) {
    case "access": return "🔍"
    case "deletion": return "🗑️"
    case "portability": return "📦"
    case "correction": return "✏️"
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", className)}>
      {children}
    </span>
  )
}

function TrendBar({ values }: { values: number[] }) {
  const max = Math.max(...values)
  const days = ["M", "T", "W", "T", "F", "S", "S"]
  return (
    <div className="flex items-end gap-1 h-10">
      {values.map((v, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div
            className="w-full bg-primary rounded-sm opacity-80"
            style={{ height: `${(v / max) * 100}%` }}
          />
          <span className="text-[var(--color-text-muted)] text-[9px]">{days[i]}</span>
        </div>
      ))}
    </div>
  )
}

// ── Tab 1: Requests ───────────────────────────────────────────────────────────

function RequestsTab() {
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = MOCK_DSRS.filter((d) => {
    if (typeFilter !== "all" && d.type !== typeFilter) {return false}
    if (statusFilter !== "all" && d.status !== statusFilter) {return false}
    return true
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">Request Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="access">Access</option>
            <option value="deletion">Deletion</option>
            <option value="portability">Portability</option>
            <option value="correction">Correction</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="overdue">Overdue</option>
          </select>
        </div>
        <div className="ml-auto flex items-end">
          <span className="text-sm text-[var(--color-text-secondary)]">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Subject</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Type</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Jurisdiction</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Submitted</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Due</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Status</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Assigned</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((dsr) => (
              <React.Fragment key={dsr.id}>
                <tr
                  onClick={() => setExpandedId(expandedId === dsr.id ? null : dsr.id)}
                  className={cn(
                    "border-b border-[var(--color-border)] cursor-pointer transition-colors",
                    expandedId === dsr.id ? "bg-[var(--color-surface-2)]" : "hover:bg-[var(--color-surface-2)]/50"
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--color-text-primary)]">{dsr.subject}</div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{dsr.email}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">
                    <span>{typeIcon(dsr.type)} </span>
                    <span className="capitalize">{dsr.type}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge className={
                      dsr.jurisdiction === "GDPR" ? "text-primary bg-primary/10" :
                      dsr.jurisdiction === "CCPA" ? "text-amber-400 bg-amber-400/10" :
                      "text-emerald-400 bg-emerald-400/10"
                    }>
                      {dsr.jurisdiction}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{dsr.submitted}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{dsr.due}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusColor(dsr.status)}>
                      <span className="capitalize">{dsr.status}</span>
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{dsr.assignedTo}</td>
                </tr>
                {expandedId === dsr.id && (
                  <tr className="border-b border-[var(--color-border)]">
                    <td colSpan={7} className="px-6 py-4 bg-[var(--color-surface-2)]/40">
                      <div className="text-xs text-[var(--color-text-secondary)] font-medium uppercase tracking-wide mb-3">
                        Processing Timeline — {dsr.id}
                      </div>
                      <div className="space-y-2">
                        {dsr.timeline.map((step, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <div className={cn(
                              "mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-xs flex-shrink-0",
                              step.done ? "bg-emerald-500 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]"
                            )}>
                              {step.done ? "✓" : "○"}
                            </div>
                            <div className="flex-1">
                              <span className={cn("text-sm", step.done ? "text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)]")}>
                                {step.step}
                              </span>
                              {step.date && (
                                <span className="text-xs text-[var(--color-text-muted)] ml-2">{step.date}</span>
                              )}
                              <span className="text-xs text-[var(--color-text-muted)] ml-2">· {step.actor}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-[var(--color-text-muted)]">No requests match the selected filters.</div>
        )}
      </div>
    </div>
  )
}

// ── Tab 2: Consent ────────────────────────────────────────────────────────────

function ConsentTab() {
  return (
    <div className="space-y-6">
      {/* Consent Categories */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {MOCK_CONSENT.map((cat) => (
          <div key={cat.id} className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-primary)] font-medium">{cat.name}</span>
              <span className="text-xs text-[var(--color-text-secondary)]">{cat.total.toLocaleString()} users</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-[var(--color-text-secondary)]">Opt-in rate</span>
                <span className={cn("text-sm font-semibold", cat.optInPct >= 70 ? "text-emerald-400" : cat.optInPct >= 50 ? "text-amber-400" : "text-rose-400")}>
                  {cat.optInPct}%
                </span>
              </div>
              <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                <div
                  className={cn("h-full rounded-full", cat.optInPct >= 70 ? "bg-emerald-500" : cat.optInPct >= 50 ? "bg-amber-500" : "bg-rose-500")}
                  style={{ width: `${cat.optInPct}%` }}
                />
              </div>
            </div>
            <div>
              <div className="text-xs text-[var(--color-text-secondary)] mb-1.5">7-day trend</div>
              <TrendBar values={cat.trend} />
            </div>
          </div>
        ))}
      </div>

      {/* Consent Log */}
      <div>
        <h3 className="text-[var(--color-text-primary)] font-medium mb-3">Consent Activity Log</h3>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">User</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Category</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Action</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Timestamp</th>
                <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_CONSENT_LOG.map((log) => (
                <tr key={log.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50">
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{log.user}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)]">{log.category}</td>
                  <td className="px-4 py-3">
                    <Badge className={log.action === "granted" ? "text-emerald-400 bg-emerald-400/10" : "text-rose-400 bg-rose-400/10"}>
                      {log.action === "granted" ? "✓ Granted" : "✕ Revoked"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{log.timestamp}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{log.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Tab 3: Data Map ───────────────────────────────────────────────────────────

function DataMapTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all")

  const filtered = MOCK_PROCESSING.filter(
    (p) => statusFilter === "all" || p.status === statusFilter
  )

  const counts = {
    compliant: MOCK_PROCESSING.filter((p) => p.status === "compliant").length,
    needsReview: MOCK_PROCESSING.filter((p) => p.status === "needs-review").length,
    nonCompliant: MOCK_PROCESSING.filter((p) => p.status === "non-compliant").length,
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex items-center gap-3">
          <div className="text-2xl font-bold text-emerald-400">{counts.compliant}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Compliant</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex items-center gap-3">
          <div className="text-2xl font-bold text-amber-400">{counts.needsReview}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Needs Review</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-4 flex items-center gap-3">
          <div className="text-2xl font-bold text-rose-400">{counts.nonCompliant}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">Non-Compliant</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-3 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-[var(--color-text-secondary)]">Filter by Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">All</option>
            <option value="compliant">Compliant</option>
            <option value="needs-review">Needs Review</option>
            <option value="non-compliant">Non-Compliant</option>
          </select>
        </div>
        <div className="ml-auto">
          <span className="text-sm text-[var(--color-text-secondary)]">GDPR Article 30 Register — {filtered.length} activit{filtered.length !== 1 ? "ies" : "y"}</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] overflow-hidden overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Activity</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Purpose</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Legal Basis</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Data Categories</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Recipients</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Retention</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Transfers</th>
              <th className="text-left px-4 py-3 text-[var(--color-text-secondary)] font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((pa) => (
              <tr key={pa.id} className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/50">
                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)] whitespace-nowrap">{pa.name}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{pa.purpose}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)] whitespace-nowrap">{pa.legalBasis}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs max-w-[180px]">{pa.dataCategories}</td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)] text-xs">{pa.recipients}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)] whitespace-nowrap">{pa.retention}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)]">{pa.transferCountries}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                  <Badge className={mapStatusColor(pa.status)}>
                    {pa.status === "compliant" ? "✓ Compliant" : pa.status === "needs-review" ? "⚠ Needs Review" : "✕ Non-Compliant"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Tab 4: Reports ────────────────────────────────────────────────────────────

function ReportsTab() {
  const maxVol = Math.max(...MONTHLY_STATS.map((m) => m.volume))

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="text-3xl font-bold text-emerald-400">87%</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Requests on Time</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Last 90 days</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="text-3xl font-bold text-primary">18.4</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Avg Processing Days</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Target: 30 days</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="text-3xl font-bold text-amber-400">68%</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Consent Opt-in Rate</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">All categories avg</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">7</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-1">Active Processing</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">GDPR Art. 30 entries</div>
        </div>
      </div>

      {/* Monthly Volume Bar Chart */}
      <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-[var(--color-text-primary)] font-medium">Monthly Request Volume</h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Data subject requests over the last 6 months</p>
          </div>
          <div className="flex gap-2">
            <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm px-4 py-1.5 rounded-md border border-[var(--color-border)] transition-colors">
              ↓ Export CSV
            </button>
            <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm px-4 py-1.5 rounded-md border border-[var(--color-border)] transition-colors">
              ↓ Export PDF
            </button>
          </div>
        </div>
        <div className="flex items-end gap-4 h-40">
          {MONTHLY_STATS.map((m) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-[var(--color-text-secondary)]">{m.volume}</span>
              <div
                className="w-full bg-primary rounded-t-sm"
                style={{ height: `${(m.volume / maxVol) * 120}px` }}
              />
              <span className="text-xs text-[var(--color-text-secondary)]">{m.month}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Compliance breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <h3 className="text-[var(--color-text-primary)] font-medium mb-4">Request Types Breakdown</h3>
          <div className="space-y-3">
            {(["access", "deletion", "portability", "correction"] as RequestType[]).map((type) => {
              const count = MOCK_DSRS.filter((d) => d.type === type).length
              const pct = Math.round((count / MOCK_DSRS.length) * 100)
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-primary)] capitalize">{typeIcon(type)} {type}</span>
                    <span className="text-[var(--color-text-secondary)]">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-lg border border-[var(--color-border)] p-5">
          <h3 className="text-[var(--color-text-primary)] font-medium mb-4">Status Distribution</h3>
          <div className="space-y-3">
            {(["completed", "in-progress", "pending", "overdue"] as RequestStatus[]).map((status) => {
              const count = MOCK_DSRS.filter((d) => d.status === status).length
              const pct = Math.round((count / MOCK_DSRS.length) * 100)
              const color = status === "completed" ? "bg-emerald-500" : status === "in-progress" ? "bg-primary" : status === "overdue" ? "bg-rose-500" : "bg-amber-500"
              return (
                <div key={status} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-[var(--color-text-primary)] capitalize">{status}</span>
                    <span className="text-[var(--color-text-secondary)]">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

type TabId = "requests" | "consent" | "datamap" | "reports"

interface Tab {
  id: TabId
  label: string
  icon: string
}

const TABS: Tab[] = [
  { id: "requests", label: "Requests", icon: "📋" },
  { id: "consent", label: "Consent", icon: "🔐" },
  { id: "datamap", label: "Data Map", icon: "🗺️" },
  { id: "reports", label: "Reports", icon: "📊" },
]

export default function DataPrivacyDashboard() {
  const [activeTab, setActiveTab] = useState<TabId>("requests")

  const overdueCount = MOCK_DSRS.filter((d) => d.status === "overdue").length

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Data Privacy Dashboard</h1>
            <p className="text-[var(--color-text-secondary)] text-sm mt-1">GDPR · CCPA · LGPD Compliance Center</p>
          </div>
          <div className="flex items-center gap-2">
            {overdueCount > 0 && (
              <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 rounded-lg px-3 py-2">
                <span className="text-rose-400 text-sm font-medium">⚠ {overdueCount} overdue DSR{overdueCount !== 1 ? "s" : ""}</span>
              </div>
            )}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-secondary)]">
              Last sync: Today 04:45 UTC
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-[var(--color-surface-1)] rounded-lg p-1 border border-[var(--color-border)] w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2",
              activeTab === tab.id
                ? "bg-primary text-[var(--color-text-primary)]"
                : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
            )}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "requests" && <RequestsTab />}
      {activeTab === "consent" && <ConsentTab />}
      {activeTab === "datamap" && <DataMapTab />}
      {activeTab === "reports" && <ReportsTab />}
    </div>
  )
}

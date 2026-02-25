import React, { useState } from "react"
import { cn } from "../lib/utils"
import { AlertSelectFilterBar } from "../components/alerts/AlertFilters"

type ScanSeverity = "critical" | "high" | "medium" | "low" | "info"
type ScanType = "sast" | "dast" | "sca" | "container" | "iac" | "secrets"
type FindingStatus = "open" | "in-progress" | "resolved" | "accepted"
type ScanStatus = "running" | "completed" | "failed" | "scheduled"

interface Finding {
  id: string
  scanType: ScanType
  severity: ScanSeverity
  title: string
  file?: string
  line?: number
  cve?: string
  cvss?: number
  package?: string
  currentVersion?: string
  fixedVersion?: string
  description: string
  remediation: string
  status: FindingStatus
  firstSeen: string
  assignee?: string
}

interface ScanRun {
  id: string
  type: ScanType
  target: string
  status: ScanStatus
  startedAt: string
  completedAt?: string
  duration?: number
  critical: number
  high: number
  medium: number
  low: number
  info: number
  branch?: string
}

const FINDINGS: Finding[] = [
  { id: "f-001", scanType: "sca", severity: "critical", title: "Remote code execution in lodash", file: undefined, line: undefined, cve: "CVE-2021-23337", cvss: 9.8, package: "lodash", currentVersion: "4.17.15", fixedVersion: "4.17.21", description: "Arbitrary code execution via the template function due to improper sanitization.", remediation: "Upgrade lodash to >= 4.17.21", status: "open", firstSeen: "2026-02-10" },
  { id: "f-002", scanType: "sast", severity: "critical", title: "SQL injection via unsanitized query parameter", file: "src/api/users.ts", line: 142, description: "User input concatenated directly into SQL query string without parameterization.", remediation: "Use parameterized queries via pg or knex query builder.", status: "in-progress", firstSeen: "2026-02-15", assignee: "alice" },
  { id: "f-003", scanType: "secrets", severity: "critical", title: "AWS access key committed to source", file: ".env.example", line: 18, description: "AWS_ACCESS_KEY_ID with value AKIAIOSFODNN7EXAMPLE detected in committed file.", remediation: "Rotate the key immediately, add .env.example to .gitignore, use secrets manager.", status: "resolved", firstSeen: "2026-01-28" },
  { id: "f-004", scanType: "container", severity: "high", title: "Base image with known vulnerabilities", file: "Dockerfile", line: 1, cve: "CVE-2023-45853", cvss: 8.1, description: "node:18-alpine base image contains vulnerable version of zlib.", remediation: "Update base image to node:20-alpine or newer.", status: "open", firstSeen: "2026-02-18" },
  { id: "f-005", scanType: "sca", severity: "high", title: "Prototype pollution in minimist", cve: "CVE-2021-44906", cvss: 7.3, package: "minimist", currentVersion: "1.2.5", fixedVersion: "1.2.6", description: "Prototype pollution allows attackers to modify Object.prototype.", remediation: "Upgrade minimist to >= 1.2.6", status: "in-progress", firstSeen: "2026-02-12", assignee: "bob" },
  { id: "f-006", scanType: "iac", severity: "high", title: "S3 bucket publicly accessible", file: "infra/storage.tf", line: 24, description: "S3 bucket has public ACL enabled allowing unauthenticated read access.", remediation: "Set acl = 'private' and block_public_acls = true in bucket config.", status: "open", firstSeen: "2026-02-20" },
  { id: "f-007", scanType: "dast", severity: "high", title: "Missing Content-Security-Policy header", description: "Application does not set CSP header, enabling XSS attacks.", remediation: "Add Content-Security-Policy header with appropriate directives.", status: "accepted", firstSeen: "2026-01-15" },
  { id: "f-008", scanType: "sast", severity: "medium", title: "Insecure random number generation", file: "src/auth/tokens.ts", line: 67, description: "Math.random() used for security-sensitive token generation.", remediation: "Replace with crypto.randomBytes() for cryptographically secure randomness.", status: "open", firstSeen: "2026-02-19" },
  { id: "f-009", scanType: "sca", severity: "medium", title: "ReDoS vulnerability in validator", cve: "CVE-2021-3749", cvss: 5.4, package: "axios", currentVersion: "0.21.0", fixedVersion: "0.21.2", description: "Regular expression denial of service in input validation.", remediation: "Upgrade axios to >= 0.21.2", status: "open", firstSeen: "2026-02-11" },
  { id: "f-010", scanType: "iac", severity: "medium", title: "EC2 instance without IMDSv2 enforcement", file: "infra/compute.tf", line: 56, description: "IMDS v1 still allowed, vulnerable to SSRF metadata theft.", remediation: "Set http_tokens = 'required' in metadata_options block.", status: "open", firstSeen: "2026-02-17" },
  { id: "f-011", scanType: "container", severity: "low", title: "Container running as root", file: "Dockerfile", line: 28, description: "Container process runs as root user, increasing blast radius of container escape.", remediation: "Add USER nonroot instruction before CMD.", status: "open", firstSeen: "2026-02-18" },
  { id: "f-012", scanType: "sast", severity: "low", title: "Missing input length validation", file: "src/api/profile.ts", line: 89, description: "User-provided string fields have no max length check before database write.", remediation: "Add length validation before persisting user input.", status: "open", firstSeen: "2026-02-22" },
]

const SCANS: ScanRun[] = [
  { id: "scan-001", type: "sast", target: "dgarson/clawdbot", status: "completed", startedAt: "2026-02-22T06:00:00Z", completedAt: "2026-02-22T06:08:00Z", duration: 480, critical: 1, high: 0, medium: 1, low: 1, info: 3, branch: "master" },
  { id: "scan-002", type: "sca", target: "package.json", status: "completed", startedAt: "2026-02-22T06:01:00Z", completedAt: "2026-02-22T06:02:30Z", duration: 90, critical: 1, high: 1, medium: 1, low: 0, info: 0, branch: "master" },
  { id: "scan-003", type: "container", target: "ghcr.io/dgarson/clawdbot:latest", status: "completed", startedAt: "2026-02-22T06:05:00Z", completedAt: "2026-02-22T06:09:00Z", duration: 240, critical: 0, high: 1, medium: 0, low: 1, info: 2 },
  { id: "scan-004", type: "secrets", target: "dgarson/clawdbot", status: "completed", startedAt: "2026-02-22T06:00:00Z", completedAt: "2026-02-22T06:00:30Z", duration: 30, critical: 1, high: 0, medium: 0, low: 0, info: 0, branch: "master" },
  { id: "scan-005", type: "iac", target: "infra/", status: "completed", startedAt: "2026-02-22T06:02:00Z", completedAt: "2026-02-22T06:04:00Z", duration: 120, critical: 0, high: 1, medium: 1, low: 0, info: 1 },
  { id: "scan-006", type: "dast", target: "https://api.clawdbot.dev", status: "completed", startedAt: "2026-02-22T05:00:00Z", completedAt: "2026-02-22T05:45:00Z", duration: 2700, critical: 0, high: 1, medium: 2, low: 3, info: 5 },
  { id: "scan-007", type: "sast", target: "dgarson/clawdbot", status: "running", startedAt: "2026-02-22T12:00:00Z", critical: 0, high: 0, medium: 0, low: 0, info: 0, branch: "feat/onboarding-flow-redesign" },
  { id: "scan-008", type: "sca", target: "package.json", status: "scheduled", startedAt: "2026-02-22T18:00:00Z", critical: 0, high: 0, medium: 0, low: 0, info: 0 },
]

const severityColor: Record<ScanSeverity, string> = {
  critical: "text-rose-400 bg-rose-400/10 border-rose-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  info: "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20",
}

const findingStatusColor: Record<FindingStatus, string> = {
  open: "text-rose-400",
  "in-progress": "text-amber-400",
  resolved: "text-emerald-400",
  accepted: "text-[var(--color-text-secondary)]",
}

const scanTypeLabel: Record<ScanType, string> = {
  sast: "SAST",
  dast: "DAST",
  sca: "SCA",
  container: "Container",
  iac: "IaC",
  secrets: "Secrets",
}

const scanStatusColor: Record<ScanStatus, string> = {
  running: "text-primary",
  completed: "text-emerald-400",
  failed: "text-rose-400",
  scheduled: "text-[var(--color-text-secondary)]",
}

function SeverityPill({ severity }: { severity: ScanSeverity }) {
  return (
    <span className={cn("text-xs px-2 py-0.5 rounded border font-medium uppercase", severityColor[severity])}>
      {severity}
    </span>
  )
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function fmtDuration(secs?: number): string {
  if (!secs) {return "—"}
  if (secs < 60) {return `${secs}s`}
  return `${Math.floor(secs / 60)}m ${secs % 60}s`
}

export default function SecurityScanDashboard() {
  const [tab, setTab] = useState<"findings" | "scans" | "trends" | "posture">("findings")
  const [selectedFinding, setSelectedFinding] = useState<string | null>(null)
  const [severityFilter, setSeverityFilter] = useState<string>("all")
  const [typeFilter, setTypeFilter] = useState<string>("all")
  const [statusFilter, setStatusFilter] = useState<string>("open")

  const tabs = [
    { id: "findings" as const, label: "Findings", emoji: "🔍" },
    { id: "scans" as const, label: "Scan Runs", emoji: "⚙️" },
    { id: "trends" as const, label: "Trends", emoji: "📈" },
    { id: "posture" as const, label: "Security Posture", emoji: "🛡" },
  ]

  const filteredFindings = FINDINGS.filter(f => {
    if (severityFilter !== "all" && f.severity !== severityFilter) {return false}
    if (typeFilter !== "all" && f.scanType !== typeFilter) {return false}
    if (statusFilter !== "all" && f.status !== statusFilter) {return false}
    return true
  })

  const finding = selectedFinding ? FINDINGS.find(f => f.id === selectedFinding) : null

  const openCritical = FINDINGS.filter(f => f.severity === "critical" && f.status === "open").length
  const openHigh = FINDINGS.filter(f => f.severity === "high" && f.status === "open").length
  const openMedium = FINDINGS.filter(f => f.severity === "medium" && f.status === "open").length
  const openTotal = FINDINGS.filter(f => f.status === "open").length
  const resolvedTotal = FINDINGS.filter(f => f.status === "resolved").length

  // Weekly trend mock data
  const weeklyTrend = [
    { week: "Jan 6", critical: 4, high: 8, medium: 12 },
    { week: "Jan 13", critical: 3, high: 9, medium: 10 },
    { week: "Jan 20", critical: 5, high: 7, medium: 11 },
    { week: "Jan 27", critical: 2, high: 6, medium: 9 },
    { week: "Feb 3", critical: 3, high: 5, medium: 8 },
    { week: "Feb 10", critical: 2, high: 4, medium: 7 },
    { week: "Feb 17", critical: 2, high: 3, medium: 6 },
    { week: "Feb 22", critical: openCritical, high: openHigh, medium: openMedium },
  ]
  const maxTrend = Math.max(...weeklyTrend.map(w => w.critical + w.high + w.medium))

  // Posture scores
  const postureCategories = [
    { name: "Code Security (SAST)", score: 78, trend: "+3" },
    { name: "Dependency Risk (SCA)", score: 65, trend: "-2" },
    { name: "Infrastructure (IaC)", score: 82, trend: "+5" },
    { name: "Container Security", score: 71, trend: "0" },
    { name: "Secrets Management", score: 90, trend: "+10" },
    { name: "Dynamic Analysis (DAST)", score: 68, trend: "-1" },
  ]

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Security Scan Dashboard</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">SAST · DAST · SCA · Container · IaC · Secrets</p>
        </div>
        <button className="px-4 py-2 bg-primary hover:bg-primary rounded-md text-sm font-medium transition-colors">
          ▶ Run All Scans
        </button>
      </div>

      {/* Severity summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] border border-rose-400/20 rounded-lg p-4 cursor-pointer" onClick={() => setSeverityFilter(severityFilter === "critical" ? "all" : "critical")}>
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Critical Open</div>
          <div className="text-3xl font-bold text-rose-400">{openCritical}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">requires immediate action</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-orange-400/20 rounded-lg p-4 cursor-pointer" onClick={() => setSeverityFilter(severityFilter === "high" ? "all" : "high")}>
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">High Open</div>
          <div className="text-3xl font-bold text-orange-400">{openHigh}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">fix within 30 days</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-amber-400/20 rounded-lg p-4 cursor-pointer" onClick={() => setSeverityFilter(severityFilter === "medium" ? "all" : "medium")}>
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Medium Open</div>
          <div className="text-3xl font-bold text-amber-400">{openMedium}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">next sprint</div>
        </div>
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
          <div className="text-xs text-[var(--color-text-secondary)] mb-1">Resolved This Month</div>
          <div className="text-3xl font-bold text-emerald-400">{resolvedTotal}</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-1">{openTotal} still open</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[var(--color-border)]">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 transition-colors",
              tab === t.id
                ? "border-primary text-[var(--color-text-primary)] bg-[var(--color-surface-1)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Findings Tab */}
      {tab === "findings" && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <AlertSelectFilterBar
              filters={[
                {
                  value: severityFilter,
                  onChange: setSeverityFilter,
                  ariaLabel: "Filter findings by severity",
                  options: [
                    { value: "all", label: "All Severities" },
                    { value: "critical", label: "Critical" },
                    { value: "high", label: "High" },
                    { value: "medium", label: "Medium" },
                    { value: "low", label: "Low" },
                  ],
                },
                {
                  value: typeFilter,
                  onChange: setTypeFilter,
                  ariaLabel: "Filter findings by type",
                  options: [
                    { value: "all", label: "All Types" },
                    { value: "sast", label: "SAST" },
                    { value: "dast", label: "DAST" },
                    { value: "sca", label: "SCA" },
                    { value: "container", label: "Container" },
                    { value: "iac", label: "IaC" },
                    { value: "secrets", label: "Secrets" },
                  ],
                },
                {
                  value: statusFilter,
                  onChange: setStatusFilter,
                  ariaLabel: "Filter findings by status",
                  options: [
                    { value: "all", label: "All Statuses" },
                    { value: "open", label: "Open" },
                    { value: "in-progress", label: "In Progress" },
                    { value: "resolved", label: "Resolved" },
                    { value: "accepted", label: "Accepted" },
                  ],
                },
              ]}
            />
            <span className="text-sm text-[var(--color-text-secondary)] self-center">{filteredFindings.length} findings</span>
          </div>

          <div className="space-y-2">
            {filteredFindings.map(f => (
              <div key={f.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
                <button
                  onClick={() => setSelectedFinding(selectedFinding === f.id ? null : f.id)}
                  className="w-full text-left p-4 hover:bg-[var(--color-surface-2)]/50 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <SeverityPill severity={f.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-[var(--color-text-primary)]">{f.title}</span>
                        <span className="text-xs px-1.5 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded">{scanTypeLabel[f.scanType]}</span>
                        {f.cve && <span className="text-xs px-1.5 py-0.5 bg-rose-400/5 border border-rose-400/20 text-rose-300 rounded font-mono">{f.cve}</span>}
                        {f.cvss && <span className="text-xs text-[var(--color-text-muted)]">CVSS {f.cvss}</span>}
                      </div>
                      {f.file && (
                        <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">{f.file}{f.line ? `:${f.line}` : ""}</div>
                      )}
                      {f.package && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {f.package} {f.currentVersion} → <span className="text-emerald-400">{f.fixedVersion}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={cn("text-xs font-medium", findingStatusColor[f.status])}>
                        {f.status}
                      </span>
                      {f.assignee && <span className="text-xs text-[var(--color-text-muted)]">@{f.assignee}</span>}
                      <span className="text-[var(--color-text-muted)]">{selectedFinding === f.id ? "▲" : "▼"}</span>
                    </div>
                  </div>
                </button>

                {selectedFinding === f.id && (
                  <div className="border-t border-[var(--color-border)] p-4 bg-[var(--color-surface-0)] space-y-3">
                    <div>
                      <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-1">Description</div>
                      <p className="text-sm text-[var(--color-text-primary)]">{f.description}</p>
                    </div>
                    <div>
                      <div className="text-xs font-medium text-[var(--color-text-secondary)] uppercase mb-1">Remediation</div>
                      <p className="text-sm text-emerald-300">{f.remediation}</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-[var(--color-text-muted)]">First seen: {f.firstSeen}</span>
                      <div className="flex gap-2">
                        <button className="px-3 py-1 text-xs bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors">
                          Assign to Me
                        </button>
                        <button className="px-3 py-1 text-xs bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 rounded-md transition-colors">
                          Mark Resolved
                        </button>
                        <button className="px-3 py-1 text-xs bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-3)] rounded-md transition-colors">
                          Accept Risk
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan Runs Tab */}
      {tab === "scans" && (
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Type</th>
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Target</th>
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Started</th>
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Duration</th>
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Findings</th>
                <th className="text-left p-3 text-[var(--color-text-secondary)] font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {SCANS.map(s => (
                <tr key={s.id} className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/20">
                  <td className="p-3">
                    <span className="text-xs px-2 py-0.5 bg-[var(--color-surface-2)] text-[var(--color-text-primary)] rounded font-mono">{scanTypeLabel[s.type]}</span>
                  </td>
                  <td className="p-3">
                    <div className="text-[var(--color-text-primary)] font-mono text-xs">{s.target}</div>
                    {s.branch && <div className="text-xs text-[var(--color-text-muted)] mt-0.5">↳ {s.branch}</div>}
                  </td>
                  <td className="p-3 text-[var(--color-text-secondary)] text-xs">{fmtTime(s.startedAt)}</td>
                  <td className="p-3 text-[var(--color-text-secondary)]">{fmtDuration(s.duration)}</td>
                  <td className="p-3">
                    {s.status === "completed" ? (
                      <div className="flex items-center gap-1.5 text-xs">
                        {s.critical > 0 && <span className="text-rose-400 font-mono">{s.critical}C</span>}
                        {s.high > 0 && <span className="text-orange-400 font-mono">{s.high}H</span>}
                        {s.medium > 0 && <span className="text-amber-400 font-mono">{s.medium}M</span>}
                        {s.low > 0 && <span className="text-blue-400 font-mono">{s.low}L</span>}
                        {s.critical === 0 && s.high === 0 && s.medium === 0 && s.low === 0 && (
                          <span className="text-emerald-400">✓ clean</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[var(--color-text-muted)] text-xs">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <span className={cn("font-medium text-sm", scanStatusColor[s.status])}>
                      {s.status === "running" ? "⟳ " : ""}{s.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trends Tab */}
      {tab === "trends" && (
        <div className="space-y-6">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Open Finding Trend (Last 8 Weeks)</h3>
            <div className="flex items-end gap-2 h-40">
              {weeklyTrend.map(w => {
                const total = w.critical + w.high + w.medium
                return (
                  <div key={w.week} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col justify-end gap-px" style={{ height: "120px" }}>
                      <div className="w-full bg-amber-500/70 rounded-t-sm" style={{ height: `${(w.medium / maxTrend) * 120}px` }} />
                      <div className="w-full bg-orange-500/70" style={{ height: `${(w.high / maxTrend) * 120}px` }} />
                      <div className="w-full bg-rose-500 rounded-b-sm" style={{ height: `${(w.critical / maxTrend) * 120}px` }} />
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] text-center" style={{ fontSize: "10px" }}>{w.week}</div>
                    <div className="text-xs text-[var(--color-text-primary)] font-mono">{total}</div>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-4 mt-2 text-xs text-[var(--color-text-secondary)]">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-500 inline-block" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-orange-500 inline-block" /> High</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-500 inline-block" /> Medium</span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-emerald-400">↓ 33%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Critical findings reduction (8 weeks)</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-[var(--color-text-primary)]">4.2d</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Avg time to resolve critical</div>
            </div>
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-primary">94%</div>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">Scan coverage of codebase</div>
            </div>
          </div>
        </div>
      )}

      {/* Security Posture Tab */}
      {tab === "posture" && (
        <div className="space-y-4">
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Overall Security Score</h3>
              <span className="text-xs text-[var(--color-text-muted)]">based on open findings + coverage</span>
            </div>
            <div className="flex items-center gap-4 mt-3">
              <div className="text-5xl font-bold text-amber-400">76</div>
              <div className="flex-1">
                <div className="w-full h-3 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full" style={{ width: "76%" }} />
                </div>
                <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                  <span>0</span>
                  <span>Needs Improvement (60-79)</span>
                  <span>100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            {postureCategories.map(cat => {
              const score = cat.score
              return (
                <div key={cat.name} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">{cat.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-[var(--color-text-secondary)]">{cat.trend !== "0" ? (cat.trend.startsWith("+") ? <span className="text-emerald-400">{cat.trend}</span> : <span className="text-rose-400">{cat.trend}</span>) : <span className="text-[var(--color-text-muted)]">→</span>}</span>
                      <span className={cn("text-xl font-bold", score >= 80 ? "text-emerald-400" : score >= 65 ? "text-amber-400" : "text-rose-400")}>
                        {score}
                      </span>
                    </div>
                  </div>
                  <div className="w-full h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", score >= 80 ? "bg-emerald-500" : score >= 65 ? "bg-amber-500" : "bg-rose-500")}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

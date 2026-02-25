import React, { useState } from "react";
import { cn } from "../lib/utils";

type ScanStatus = "running" | "completed" | "failed" | "scheduled";
type Severity = "critical" | "high" | "medium" | "low" | "info";
type VulnCategory = "injection" | "auth" | "exposure" | "misconfiguration" | "dependency" | "crypto";
type ScanType = "sast" | "dast" | "sca" | "container" | "iac";

interface Vulnerability {
  id: string;
  title: string;
  severity: Severity;
  category: VulnCategory;
  file: string;
  line: number;
  description: string;
  recommendation: string;
  cveId: string | null;
  cvssScore: number | null;
  status: "open" | "acknowledged" | "fixed" | "false_positive";
  firstSeen: string;
  lastSeen: string;
}

interface ScanResult {
  id: string;
  name: string;
  type: ScanType;
  target: string;
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  duration: number | null;
  vulnCount: { critical: number; high: number; medium: number; low: number; info: number };
  vulnerabilities: Vulnerability[];
  coverage: number;
}

interface PolicyRule {
  id: string;
  name: string;
  description: string;
  severity: Severity;
  category: VulnCategory;
  enabled: boolean;
  occurrences: number;
}

interface TrendPoint {
  date: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

const statusBadge: Record<ScanStatus, string> = {
  running:   "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  completed: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  failed:    "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  scheduled: "bg-amber-500/20 text-amber-300 border border-amber-500/30",
};

const severityColor: Record<Severity, string> = {
  critical: "text-rose-400",
  high:     "text-orange-400",
  medium:   "text-amber-400",
  low:      "text-blue-400",
  info:     "text-[var(--color-text-secondary)]",
};

const severityBg: Record<Severity, string> = {
  critical: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  high:     "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  medium:   "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  low:      "bg-blue-500/20 text-blue-300 border border-blue-500/30",
  info:     "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
};

const severityBar: Record<Severity, string> = {
  critical: "bg-rose-500",
  high:     "bg-orange-500",
  medium:   "bg-amber-500",
  low:      "bg-blue-500",
  info:     "bg-[var(--color-surface-3)]",
};

const scanTypeLabel: Record<ScanType, string> = {
  sast:      "SAST",
  dast:      "DAST",
  sca:       "SCA",
  container: "Container",
  iac:       "IaC",
};

const scanTypeBg: Record<ScanType, string> = {
  sast:      "bg-primary/20 text-indigo-300 border border-primary/30",
  dast:      "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  sca:       "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
  container: "bg-teal-500/20 text-teal-300 border border-teal-500/30",
  iac:       "bg-sky-500/20 text-sky-300 border border-sky-500/30",
};

const categoryIcon: Record<VulnCategory, string> = {
  injection:         "💉",
  auth:              "🔑",
  exposure:          "👁️",
  misconfiguration:  "⚙️",
  dependency:        "📦",
  crypto:            "🔒",
};

const vulnStatusBadge: Record<Vulnerability["status"], string> = {
  open:           "bg-rose-500/20 text-rose-300 border border-rose-500/30",
  acknowledged:   "bg-amber-500/20 text-amber-300 border border-amber-500/30",
  fixed:          "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
  false_positive: "bg-[var(--color-surface-3)]/20 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
};

const SCANS: ScanResult[] = [
  {
    id: "scan-001",
    name: "API Server SAST",
    type: "sast",
    target: "src/api/**/*.ts",
    status: "completed",
    startedAt: "2026-02-22T08:00:00Z",
    completedAt: "2026-02-22T08:12:34Z",
    duration: 754,
    coverage: 94,
    vulnCount: { critical: 2, high: 5, medium: 11, low: 8, info: 3 },
    vulnerabilities: [
      {
        id: "v-001", title: "SQL Injection via unsanitized query parameter", severity: "critical",
        category: "injection", file: "src/api/users/search.ts", line: 47,
        description: "User-controlled input passed directly to database query without parameterization.",
        recommendation: "Use parameterized queries or prepared statements. Never interpolate user input directly.",
        cveId: null, cvssScore: 9.8,
        status: "open", firstSeen: "2026-02-22", lastSeen: "2026-02-22",
      },
      {
        id: "v-002", title: "JWT secret hardcoded in source", severity: "critical",
        category: "crypto", file: "src/api/auth/tokens.ts", line: 12,
        description: "JWT signing secret is hardcoded as a string literal in source code.",
        recommendation: "Load secrets from environment variables or a secrets manager. Rotate the exposed secret immediately.",
        cveId: null, cvssScore: 9.1,
        status: "acknowledged", firstSeen: "2026-02-20", lastSeen: "2026-02-22",
      },
      {
        id: "v-003", title: "Missing rate limiting on auth endpoint", severity: "high",
        category: "auth", file: "src/api/auth/login.ts", line: 23,
        description: "Login endpoint has no rate limiting, enabling brute-force attacks.",
        recommendation: "Implement rate limiting with exponential backoff. Consider account lockout after N failures.",
        cveId: null, cvssScore: 7.5,
        status: "open", firstSeen: "2026-02-21", lastSeen: "2026-02-22",
      },
      {
        id: "v-004", title: "Sensitive data in error response", severity: "medium",
        category: "exposure", file: "src/api/middleware/error.ts", line: 89,
        description: "Stack traces and internal paths exposed in production error responses.",
        recommendation: "Return generic error messages in production. Log detailed errors server-side only.",
        cveId: null, cvssScore: 5.3,
        status: "fixed", firstSeen: "2026-02-18", lastSeen: "2026-02-21",
      },
    ],
  },
  {
    id: "scan-002",
    name: "Frontend DAST Scan",
    type: "dast",
    target: "https://staging.clawdbot.io",
    status: "completed",
    startedAt: "2026-02-22T09:00:00Z",
    completedAt: "2026-02-22T09:45:12Z",
    duration: 2712,
    coverage: 78,
    vulnCount: { critical: 0, high: 3, medium: 7, low: 12, info: 6 },
    vulnerabilities: [
      {
        id: "v-005", title: "Cross-Site Scripting (XSS) in search field", severity: "high",
        category: "injection", file: "src/components/GlobalSearch.tsx", line: 134,
        description: "User input reflected in DOM without sanitization, enabling stored XSS.",
        recommendation: "Sanitize all user input before rendering. Use DOMPurify for HTML content.",
        cveId: "CVE-2024-1234", cvssScore: 7.2,
        status: "open", firstSeen: "2026-02-22", lastSeen: "2026-02-22",
      },
      {
        id: "v-006", title: "Missing Content-Security-Policy header", severity: "medium",
        category: "misconfiguration", file: "nginx.conf", line: 28,
        description: "CSP header not configured, increasing XSS risk surface.",
        recommendation: "Configure a strict Content-Security-Policy header. Start with report-only mode.",
        cveId: null, cvssScore: 5.1,
        status: "open", firstSeen: "2026-02-19", lastSeen: "2026-02-22",
      },
    ],
  },
  {
    id: "scan-003",
    name: "Dependency Audit",
    type: "sca",
    target: "package.json",
    status: "completed",
    startedAt: "2026-02-22T07:00:00Z",
    completedAt: "2026-02-22T07:03:22Z",
    duration: 202,
    coverage: 100,
    vulnCount: { critical: 1, high: 2, medium: 4, low: 6, info: 0 },
    vulnerabilities: [
      {
        id: "v-007", title: "Prototype pollution in lodash@4.17.20", severity: "critical",
        category: "dependency", file: "package.json", line: 34,
        description: "lodash versions before 4.17.21 are vulnerable to prototype pollution via merge operations.",
        recommendation: "Upgrade lodash to 4.17.21 or later.",
        cveId: "CVE-2021-23337", cvssScore: 9.0,
        status: "open", firstSeen: "2026-02-15", lastSeen: "2026-02-22",
      },
    ],
  },
  {
    id: "scan-004",
    name: "Container Image Scan",
    type: "container",
    target: "clawdbot-api:latest",
    status: "running",
    startedAt: "2026-02-22T10:00:00Z",
    completedAt: null,
    duration: null,
    coverage: 0,
    vulnCount: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    vulnerabilities: [],
  },
  {
    id: "scan-005",
    name: "Terraform IaC Scan",
    type: "iac",
    target: "infra/terraform/**",
    status: "scheduled",
    startedAt: "2026-02-22T12:00:00Z",
    completedAt: null,
    duration: null,
    coverage: 0,
    vulnCount: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    vulnerabilities: [],
  },
];

const POLICIES: PolicyRule[] = [
  { id: "r-01", name: "SQL Injection Detection", description: "Detects unsanitized SQL query construction", severity: "critical", category: "injection", enabled: true, occurrences: 3 },
  { id: "r-02", name: "Hardcoded Secrets", description: "Finds hardcoded passwords, tokens, API keys", severity: "critical", category: "crypto", enabled: true, occurrences: 1 },
  { id: "r-03", name: "XSS Vulnerability", description: "Identifies cross-site scripting attack vectors", severity: "high", category: "injection", enabled: true, occurrences: 5 },
  { id: "r-04", name: "Missing Auth Check", description: "Flags endpoints lacking authentication middleware", severity: "high", category: "auth", enabled: true, occurrences: 2 },
  { id: "r-05", name: "Sensitive Data Exposure", description: "Detects PII/secrets in logs or responses", severity: "medium", category: "exposure", enabled: true, occurrences: 8 },
  { id: "r-06", name: "Outdated Dependencies", description: "Flags packages with known CVEs", severity: "medium", category: "dependency", enabled: true, occurrences: 13 },
  { id: "r-07", name: "Weak Crypto Algorithm", description: "Detects use of MD5, SHA1, DES in security contexts", severity: "medium", category: "crypto", enabled: false, occurrences: 0 },
  { id: "r-08", name: "IaC Public Exposure", description: "Flags S3 buckets, RDS, EC2 with public access", severity: "high", category: "misconfiguration", enabled: true, occurrences: 4 },
];

const TREND: TrendPoint[] = [
  { date: "Feb 15", critical: 8, high: 14, medium: 22, low: 31 },
  { date: "Feb 16", critical: 7, high: 13, medium: 21, low: 29 },
  { date: "Feb 17", critical: 7, high: 12, medium: 20, low: 27 },
  { date: "Feb 18", critical: 6, high: 11, medium: 19, low: 25 },
  { date: "Feb 19", critical: 5, high: 10, medium: 18, low: 26 },
  { date: "Feb 20", critical: 5, high: 9,  medium: 16, low: 24 },
  { date: "Feb 21", critical: 4, high: 8,  medium: 15, low: 22 },
  { date: "Feb 22", critical: 3, high: 10, medium: 22, low: 26 },
];

const maxTrendTotal = Math.max(...TREND.map(p => p.critical + p.high + p.medium + p.low));

export default function SecurityScannerDashboard() {
  const [tab, setTab] = useState<"scans" | "vulnerabilities" | "policies" | "trend">("scans");
  const [selectedScan, setSelectedScan] = useState<ScanResult>(SCANS[0]);
  const [selectedVuln, setSelectedVuln] = useState<Vulnerability>(SCANS[0].vulnerabilities[0]);
  const [sevFilter, setSevFilter] = useState<Severity | "all">("all");

  const allVulns = SCANS.flatMap(s => s.vulnerabilities);
  const filteredVulns = sevFilter === "all" ? allVulns : allVulns.filter(v => v.severity === sevFilter);

  const totalCounts = SCANS.reduce(
    (acc, s) => {
      acc.critical += s.vulnCount.critical;
      acc.high     += s.vulnCount.high;
      acc.medium   += s.vulnCount.medium;
      acc.low      += s.vulnCount.low;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--color-border)] flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Security Scanner</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">SAST · DAST · SCA · Container · IaC</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3 text-sm">
            {(["critical", "high", "medium", "low"] as Severity[]).map(s => (
              <span key={s} className={cn("flex items-center gap-1.5", severityColor[s])}>
                <span className={cn("w-2 h-2 rounded-full", severityBar[s])} />
                <span className="font-mono font-bold">{totalCounts[s as keyof typeof totalCounts]}</span>
                <span className="text-[var(--color-text-muted)] capitalize">{s}</span>
              </span>
            ))}
          </div>
          <button className="px-3 py-1.5 bg-primary hover:bg-primary rounded text-sm font-medium transition-colors">
            + New Scan
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--color-border)] px-6">
        {(["scans", "vulnerabilities", "policies", "trend"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors capitalize",
              tab === t ? "border-primary text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Scans Tab */}
      {tab === "scans" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Scan List */}
          <div className="w-80 border-r border-[var(--color-border)] overflow-y-auto">
            {SCANS.map(scan => (
              <button
                key={scan.id}
                onClick={() => setSelectedScan(scan)}
                className={cn(
                  "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                  selectedScan.id === scan.id && "bg-[var(--color-surface-2)]/60"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <span className="text-sm font-medium text-[var(--color-text-primary)]">{scan.name}</span>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded-full whitespace-nowrap", statusBadge[scan.status])}>
                    {scan.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn("text-xs px-1.5 py-0.5 rounded", scanTypeBg[scan.type])}>
                    {scanTypeLabel[scan.type]}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] truncate">{scan.target}</span>
                </div>
                {scan.status === "completed" && (
                  <div className="flex items-center gap-3 text-xs">
                    {scan.vulnCount.critical > 0 && <span className="text-rose-400">●{scan.vulnCount.critical} crit</span>}
                    {scan.vulnCount.high > 0 && <span className="text-orange-400">●{scan.vulnCount.high} high</span>}
                    {scan.vulnCount.medium > 0 && <span className="text-amber-400">●{scan.vulnCount.medium} med</span>}
                  </div>
                )}
              </button>
            ))}
          </div>

          {/* Scan Detail */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold mb-1">{selectedScan.name}</h2>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded", scanTypeBg[selectedScan.type])}>
                    {scanTypeLabel[selectedScan.type]}
                  </span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge[selectedScan.status])}>
                    {selectedScan.status}
                  </span>
                  <span className="text-sm text-[var(--color-text-secondary)] font-mono">{selectedScan.target}</span>
                </div>
              </div>
              {selectedScan.status === "completed" && (
                <div className="text-right text-sm">
                  <div className="text-[var(--color-text-secondary)]">Duration</div>
                  <div className="font-mono text-[var(--color-text-primary)]">{Math.floor((selectedScan.duration ?? 0) / 60)}m {(selectedScan.duration ?? 0) % 60}s</div>
                </div>
              )}
            </div>

            {selectedScan.status === "completed" && (
              <>
                {/* Severity breakdown */}
                <div className="grid grid-cols-5 gap-3 mb-6">
                  {(["critical", "high", "medium", "low", "info"] as Severity[]).map(sev => (
                    <div key={sev} className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                      <div className={cn("text-2xl font-bold font-mono mb-1", severityColor[sev])}>
                        {selectedScan.vulnCount[sev as keyof typeof selectedScan.vulnCount]}
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)] capitalize">{sev}</div>
                    </div>
                  ))}
                </div>

                {/* Coverage bar */}
                <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Code Coverage</span>
                    <span className="text-sm font-mono text-emerald-400">{selectedScan.coverage}%</span>
                  </div>
                  <div className="w-full bg-[var(--color-surface-2)] rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: `${selectedScan.coverage}%` }} />
                  </div>
                </div>

                {/* Vulnerability list */}
                {selectedScan.vulnerabilities.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Vulnerabilities</h3>
                    <div className="space-y-2">
                      {selectedScan.vulnerabilities.map(v => (
                        <div key={v.id} className="bg-[var(--color-surface-1)] rounded-lg p-4">
                          <div className="flex items-start justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{categoryIcon[v.category]}</span>
                              <span className="text-sm font-medium">{v.title}</span>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", severityBg[v.severity])}>
                                {v.severity}
                              </span>
                              <span className={cn("text-xs px-1.5 py-0.5 rounded-full", vulnStatusBadge[v.status])}>
                                {v.status.replace("_", " ")}
                              </span>
                            </div>
                          </div>
                          <div className="text-xs font-mono text-[var(--color-text-secondary)] mb-2">{v.file}:{v.line}</div>
                          <p className="text-xs text-[var(--color-text-secondary)] mb-2">{v.description}</p>
                          <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)]">
                            {v.cveId && <span className="text-amber-400">{v.cveId}</span>}
                            {v.cvssScore !== null && <span>CVSS {v.cvssScore}</span>}
                            <span>First seen {v.firstSeen}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedScan.vulnerabilities.length === 0 && (
                  <div className="text-center py-12 text-[var(--color-text-muted)]">No vulnerabilities found in this scan</div>
                )}
              </>
            )}

            {selectedScan.status === "running" && (
              <div className="text-center py-16">
                <div className="text-2xl mb-3 animate-pulse">🔍</div>
                <div className="text-[var(--color-text-primary)] font-medium mb-1">Scan in progress</div>
                <div className="text-sm text-[var(--color-text-muted)]">Started at {new Date(selectedScan.startedAt).toLocaleTimeString()}</div>
              </div>
            )}

            {selectedScan.status === "scheduled" && (
              <div className="text-center py-16">
                <div className="text-2xl mb-3">🕐</div>
                <div className="text-[var(--color-text-primary)] font-medium mb-1">Scan scheduled</div>
                <div className="text-sm text-[var(--color-text-muted)]">Starts at {new Date(selectedScan.startedAt).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Vulnerabilities Tab */}
      {tab === "vulnerabilities" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left: filter + list */}
          <div className="w-80 border-r border-[var(--color-border)] flex flex-col">
            <div className="p-4 border-b border-[var(--color-border)]">
              <div className="text-xs text-[var(--color-text-muted)] mb-2">Filter by severity</div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSevFilter("all")}
                  className={cn("text-xs px-2 py-1 rounded-full border transition-colors",
                    sevFilter === "all" ? "bg-[var(--color-surface-3)] border-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                  )}
                >All ({allVulns.length})</button>
                {(["critical", "high", "medium", "low"] as Severity[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setSevFilter(s)}
                    className={cn("text-xs px-2 py-1 rounded-full border transition-colors capitalize",
                      sevFilter === s ? severityBg[s] : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                    )}
                  >{s} ({allVulns.filter(v => v.severity === s).length})</button>
                ))}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredVulns.map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVuln(v)}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-2)]/40 transition-colors",
                    selectedVuln?.id === v.id && "bg-[var(--color-surface-2)]/60"
                  )}
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-sm">{categoryIcon[v.category]}</span>
                    <span className="text-xs font-medium text-[var(--color-text-primary)] leading-snug">{v.title}</span>
                  </div>
                  <div className="flex items-center gap-2 ml-5">
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", severityBg[v.severity])}>{v.severity}</span>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono">{v.file.split("/").pop()}</span>
                  </div>
                </button>
              ))}
              {filteredVulns.length === 0 && (
                <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">No vulnerabilities match filter</div>
              )}
            </div>
          </div>

          {/* Right: vuln detail */}
          {selectedVuln && (
            <div className="flex-1 overflow-y-auto p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xl">{categoryIcon[selectedVuln.category]}</span>
                    <h2 className="text-lg font-semibold">{selectedVuln.title}</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", severityBg[selectedVuln.severity])}>{selectedVuln.severity}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", vulnStatusBadge[selectedVuln.status])}>{selectedVuln.status.replace("_", " ")}</span>
                    {selectedVuln.cveId && <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">{selectedVuln.cveId}</span>}
                  </div>
                </div>
                {selectedVuln.cvssScore !== null && (
                  <div className="bg-[var(--color-surface-1)] rounded-lg p-3 text-center">
                    <div className={cn("text-2xl font-bold font-mono", selectedVuln.cvssScore >= 9 ? "text-rose-400" : selectedVuln.cvssScore >= 7 ? "text-orange-400" : "text-amber-400")}>
                      {selectedVuln.cvssScore}
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)]">CVSS</div>
                  </div>
                )}
              </div>

              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-4">
                <div className="text-xs text-[var(--color-text-muted)] mb-1">Location</div>
                <div className="font-mono text-sm text-[var(--color-text-primary)]">{selectedVuln.file}<span className="text-[var(--color-text-muted)]">:{selectedVuln.line}</span></div>
              </div>

              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-4">
                <div className="text-sm font-medium mb-2 text-[var(--color-text-primary)]">Description</div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{selectedVuln.description}</p>
              </div>

              <div className="bg-[var(--color-surface-1)] rounded-lg p-4 mb-4 border border-primary/20">
                <div className="text-sm font-medium mb-2 text-indigo-300">Recommendation</div>
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">{selectedVuln.recommendation}</p>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-[var(--color-surface-1)] rounded-lg p-3">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">First Seen</div>
                  <div className="text-[var(--color-text-primary)]">{selectedVuln.firstSeen}</div>
                </div>
                <div className="bg-[var(--color-surface-1)] rounded-lg p-3">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Last Seen</div>
                  <div className="text-[var(--color-text-primary)]">{selectedVuln.lastSeen}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-4">
                <button className="flex-1 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded text-sm transition-colors">Mark Acknowledged</button>
                <button className="flex-1 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded text-sm transition-colors">Mark Fixed</button>
                <button className="flex-1 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded text-sm transition-colors">False Positive</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Policies Tab */}
      {tab === "policies" && (
        <div className="flex-1 overflow-y-auto p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold">Scan Policies</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">Rules applied across all scan types</p>
            </div>
            <button className="px-3 py-1.5 bg-primary hover:bg-primary rounded text-sm font-medium transition-colors">
              + Add Rule
            </button>
          </div>
          <div className="space-y-2">
            {POLICIES.map(rule => (
              <div key={rule.id} className="bg-[var(--color-surface-1)] rounded-lg p-4 flex items-center gap-4">
                <div className="text-lg">{categoryIcon[rule.category]}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-sm font-medium">{rule.name}</span>
                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", severityBg[rule.severity])}>{rule.severity}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-secondary)]">{rule.description}</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold font-mono text-[var(--color-text-primary)]">{rule.occurrences}</div>
                  <div className="text-xs text-[var(--color-text-muted)]">findings</div>
                </div>
                <div className={cn("text-xs px-2 py-1 rounded font-medium", rule.enabled ? "bg-emerald-500/20 text-emerald-300" : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]")}>
                  {rule.enabled ? "Enabled" : "Disabled"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Trend Tab */}
      {tab === "trend" && (
        <div className="flex-1 overflow-y-auto p-6">
          <h2 className="text-base font-semibold mb-1">Vulnerability Trend</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">Open vulnerabilities over time</p>

          <div className="bg-[var(--color-surface-1)] rounded-lg p-6">
            <div className="flex items-end gap-2 h-48 mb-3">
              {TREND.map(pt => {
                const total = pt.critical + pt.high + pt.medium + pt.low;
                const pct = maxTrendTotal > 0 ? (total / maxTrendTotal) * 100 : 0;
                return (
                  <div key={pt.date} className="flex-1 flex flex-col items-center gap-1">
                    <div className="w-full flex flex-col-reverse rounded overflow-hidden" style={{ height: `${pct}%`, minHeight: "4px" }}>
                      <div className="bg-rose-500" style={{ flex: pt.critical }} />
                      <div className="bg-orange-500" style={{ flex: pt.high }} />
                      <div className="bg-amber-500" style={{ flex: pt.medium }} />
                      <div className="bg-blue-500" style={{ flex: pt.low }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex items-end gap-2 mb-4">
              {TREND.map(pt => (
                <div key={pt.date} className="flex-1 text-center text-xs text-[var(--color-text-muted)]">{pt.date.replace("Feb ", "")}</div>
              ))}
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-rose-500" /><span className="text-[var(--color-text-secondary)]">Critical</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-orange-500" /><span className="text-[var(--color-text-secondary)]">High</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /><span className="text-[var(--color-text-secondary)]">Medium</span></span>
              <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500" /><span className="text-[var(--color-text-secondary)]">Low</span></span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4 mt-6">
            {(["critical", "high", "medium", "low"] as const).map(sev => {
              const latest = TREND[TREND.length - 1][sev];
              const prev = TREND[TREND.length - 2][sev];
              const delta = latest - prev;
              return (
                <div key={sev} className="bg-[var(--color-surface-1)] rounded-lg p-4 text-center">
                  <div className={cn("text-3xl font-bold font-mono mb-1", severityColor[sev])}>{latest}</div>
                  <div className="text-xs text-[var(--color-text-muted)] capitalize mb-2">{sev}</div>
                  <div className={cn("text-xs font-medium", delta > 0 ? "text-rose-400" : delta < 0 ? "text-emerald-400" : "text-[var(--color-text-secondary)]")}>
                    {delta > 0 ? "▲" : delta < 0 ? "▼" : "—"} {Math.abs(delta)} vs yesterday
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

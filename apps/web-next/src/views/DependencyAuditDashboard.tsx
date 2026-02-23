import React, { useState } from "react";
import { cn } from "../lib/utils";

type VulnSeverity = "critical" | "high" | "medium" | "low" | "info";
type LicenseRisk = "high" | "medium" | "low" | "unknown";
type UpdateType = "major" | "minor" | "patch";
type DepStatus = "vulnerable" | "outdated" | "deprecated" | "ok";

interface Dependency {
  id: string;
  name: string;
  version: string;
  latestVersion: string;
  updateType: UpdateType | null;
  status: DepStatus;
  vulns: number;
  maxSeverity: VulnSeverity | null;
  license: string;
  licenseRisk: LicenseRisk;
  usedBy: string[];
  transitive: boolean;
  size: number; // KB
  lastPublished: string;
  deprecated: boolean;
  deprecatedMsg: string | null;
}

interface Vulnerability {
  id: string;
  cve: string;
  depName: string;
  depVersion: string;
  severity: VulnSeverity;
  title: string;
  description: string;
  fixedIn: string | null;
  cvss: number;
  publishedAt: string;
}

interface LicenseIssue {
  dep: string;
  license: string;
  risk: LicenseRisk;
  reason: string;
}

const statusBadge: Record<DepStatus, string> = {
  vulnerable:  "bg-rose-500/20 text-rose-400 border border-rose-500/30",
  outdated:    "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  deprecated:  "bg-orange-500/20 text-orange-400 border border-orange-500/30",
  ok:          "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
};

const severityColor: Record<VulnSeverity, string> = {
  critical: "text-red-400",
  high:     "text-rose-400",
  medium:   "text-amber-400",
  low:      "text-yellow-400",
  info:     "text-zinc-400",
};

const severityBg: Record<VulnSeverity, string> = {
  critical: "bg-red-500/20 text-red-400",
  high:     "bg-rose-500/20 text-rose-400",
  medium:   "bg-amber-500/20 text-amber-400",
  low:      "bg-yellow-500/20 text-yellow-400",
  info:     "bg-zinc-500/20 text-zinc-400",
};

const licenseRiskBg: Record<LicenseRisk, string> = {
  high:    "bg-rose-500/20 text-rose-400",
  medium:  "bg-amber-500/20 text-amber-400",
  low:     "bg-emerald-500/20 text-emerald-400",
  unknown: "bg-zinc-500/20 text-zinc-400",
};

const updateBadge: Record<UpdateType, string> = {
  major: "bg-rose-500/20 text-rose-400",
  minor: "bg-amber-500/20 text-amber-400",
  patch: "bg-sky-500/20 text-sky-400",
};

const deps: Dependency[] = [
  { id: "d1",  name: "lodash",          version: "4.17.20", latestVersion: "4.17.21", updateType: "patch", status: "vulnerable", vulns: 1, maxSeverity: "high",   license: "MIT",     licenseRisk: "low",   usedBy: ["web-app","api"],   transitive: false, size: 71,  lastPublished: "2021-02-15", deprecated: false, deprecatedMsg: null },
  { id: "d2",  name: "axios",           version: "0.21.1",  latestVersion: "1.6.8",   updateType: "major", status: "vulnerable", vulns: 2, maxSeverity: "critical",license: "MIT",     licenseRisk: "low",   usedBy: ["web-app"],         transitive: false, size: 13,  lastPublished: "2024-01-20", deprecated: false, deprecatedMsg: null },
  { id: "d3",  name: "moment",          version: "2.29.4",  latestVersion: "2.29.4",  updateType: null,    status: "deprecated", vulns: 0, maxSeverity: null,    license: "MIT",     licenseRisk: "low",   usedBy: ["web-app","api"],   transitive: false, size: 288, lastPublished: "2022-09-08", deprecated: true, deprecatedMsg: "Maintainers recommend date-fns or Day.js" },
  { id: "d4",  name: "log4j-core",      version: "2.14.1",  latestVersion: "2.23.1",  updateType: "minor", status: "vulnerable", vulns: 3, maxSeverity: "critical",license: "Apache-2.0", licenseRisk: "low", usedBy: ["logging-svc"],  transitive: true,  size: 1820, lastPublished: "2024-02-10", deprecated: false, deprecatedMsg: null },
  { id: "d5",  name: "express",         version: "4.18.2",  latestVersion: "4.18.3",  updateType: "patch", status: "ok",        vulns: 0, maxSeverity: null,    license: "MIT",     licenseRisk: "low",   usedBy: ["api"],             transitive: false, size: 208, lastPublished: "2024-01-10", deprecated: false, deprecatedMsg: null },
  { id: "d6",  name: "react",           version: "18.2.0",  latestVersion: "18.3.1",  updateType: "minor", status: "outdated",  vulns: 0, maxSeverity: null,    license: "MIT",     licenseRisk: "low",   usedBy: ["web-app"],         transitive: false, size: 45,  lastPublished: "2024-04-25", deprecated: false, deprecatedMsg: null },
  { id: "d7",  name: "gpl-lib",         version: "2.1.0",   latestVersion: "2.1.0",   updateType: null,    status: "ok",        vulns: 0, maxSeverity: null,    license: "GPL-3.0", licenseRisk: "high",  usedBy: ["data-tool"],       transitive: true,  size: 140, lastPublished: "2023-06-01", deprecated: false, deprecatedMsg: null },
  { id: "d8",  name: "jsonwebtoken",    version: "8.5.1",   latestVersion: "9.0.2",   updateType: "major", status: "vulnerable", vulns: 1, maxSeverity: "high",  license: "MIT",     licenseRisk: "low",   usedBy: ["auth-svc"],        transitive: false, size: 18,  lastPublished: "2023-07-01", deprecated: false, deprecatedMsg: null },
  { id: "d9",  name: "webpack",         version: "5.88.0",  latestVersion: "5.91.0",  updateType: "patch", status: "outdated",  vulns: 0, maxSeverity: null,    license: "MIT",     licenseRisk: "low",   usedBy: ["web-app"],         transitive: false, size: 6200, lastPublished: "2024-03-15", deprecated: false, deprecatedMsg: null },
  { id: "d10", name: "left-pad",        version: "1.3.0",   latestVersion: "1.3.0",   updateType: null,    status: "deprecated", vulns: 0, maxSeverity: null,   license: "WTFPL",   licenseRisk: "medium", usedBy: ["legacy-tool"],    transitive: true,  size: 2,   lastPublished: "2017-04-07", deprecated: true, deprecatedMsg: "Package unmaintained since 2017" },
];

const vulns: Vulnerability[] = [
  { id: "v1", cve: "CVE-2021-23337", depName: "lodash",       depVersion: "4.17.20", severity: "high",    title: "Command injection via template",      description: "lodash before 4.17.21 is vulnerable to command injection via the template function due to incomplete defaultResult sanitization.", fixedIn: "4.17.21", cvss: 7.2, publishedAt: "2021-02-15" },
  { id: "v2", cve: "CVE-2020-28168", depName: "axios",        depVersion: "0.21.1",  severity: "medium",  title: "Server-side request forgery",          description: "Axios before 0.21.2 allows SSRF via redirects. An attacker can bypass SSRF protections by crafting a redirect chain.", fixedIn: "0.21.2",  cvss: 5.9, publishedAt: "2020-11-18" },
  { id: "v3", cve: "CVE-2023-45857", depName: "axios",        depVersion: "0.21.1",  severity: "critical","title": "XSRF token exposure",                description: "Axios versions before 1.6.2 may expose CSRF/XSRF tokens to third-party origins in certain scenarios.", fixedIn: "1.6.2",   cvss: 9.8, publishedAt: "2023-11-08" },
  { id: "v4", cve: "CVE-2021-44228", depName: "log4j-core",   depVersion: "2.14.1",  severity: "critical","title": "Log4Shell: Remote Code Execution",   description: "JNDI injection in Apache Log4j allows remote code execution with a single log message. CVSS 10.0.", fixedIn: "2.15.0",  cvss: 10.0, publishedAt: "2021-12-10" },
  { id: "v5", cve: "CVE-2021-45046", depName: "log4j-core",   depVersion: "2.14.1",  severity: "critical","title": "Log4j information disclosure/RCE",  description: "Incomplete fix for CVE-2021-44228. Certain non-default configurations can still be exploited.", fixedIn: "2.16.0",  cvss: 9.0, publishedAt: "2021-12-14" },
  { id: "v6", cve: "CVE-2022-45690", depName: "log4j-core",   depVersion: "2.14.1",  severity: "high",    title: "Stack overflow in PatternLayout",      description: "Uncontrolled recursion from self-referential lookups in log4j-core.", fixedIn: "2.19.0",  cvss: 7.5, publishedAt: "2022-12-13" },
  { id: "v7", cve: "CVE-2022-23529", depName: "jsonwebtoken", depVersion: "8.5.1",   severity: "high",    title: "Private key buffer write vulnerability","description": "jsonwebtoken <= 8.5.1 allows private key buffer write which may lead to RCE when using certain setPublicKey APIs.", fixedIn: "9.0.0",   cvss: 7.6, publishedAt: "2022-12-21" },
];

const licenseIssues: LicenseIssue[] = [
  { dep: "gpl-lib", license: "GPL-3.0", risk: "high",   reason: "GPL is copyleft — using this in a commercial product requires open-sourcing your code under GPL." },
  { dep: "left-pad", license: "WTFPL", risk: "medium", reason: "WTFPL has no explicit patent grant and is unrecognized in some enterprise legal reviews." },
];

export default function DependencyAuditDashboard() {
  const [tab, setTab]               = useState<"overview" | "dependencies" | "vulns" | "licenses">("overview");
  const [selectedDep, setSelectedDep] = useState<Dependency | null>(null);
  const [statusFilter, setStatusFilter] = useState<DepStatus | "all">("all");

  const filteredDeps = statusFilter === "all" ? deps : deps.filter(d => d.status === statusFilter);
  const criticalVulns = vulns.filter(v => v.severity === "critical").length;
  const highVulns     = vulns.filter(v => v.severity === "high").length;
  const vulnerableDeps = deps.filter(d => d.status === "vulnerable").length;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "overview",      label: "Overview" },
    { id: "dependencies",  label: `Dependencies (${deps.length})` },
    { id: "vulns",         label: `Vulnerabilities (${vulns.length})` },
    { id: "licenses",      label: `Licenses (${licenseIssues.length} issues)` },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dependency Audit</h1>
            <p className="text-zinc-400 text-sm mt-1">CVE scanning, outdated packages, and license compliance</p>
          </div>
          <button className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium transition-colors">
            Run Audit
          </button>
        </div>

        {/* KPI summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Critical CVEs",   value: criticalVulns, color: "text-red-400" },
            { label: "High CVEs",       value: highVulns,     color: "text-rose-400" },
            { label: "Vulnerable Deps", value: vulnerableDeps, color: "text-amber-400" },
            { label: "License Issues",  value: licenseIssues.length, color: "text-orange-400" },
          ].map(kpi => (
            <div key={kpi.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <p className="text-xs text-zinc-500 uppercase tracking-wider">{kpi.label}</p>
              <p className={cn("text-3xl font-bold mt-1", kpi.color)}>{kpi.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setSelectedDep(null); }}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
                tab === t.id
                  ? "border-indigo-500 text-white"
                  : "border-transparent text-zinc-400 hover:text-zinc-200"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Overview */}
        {tab === "overview" && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Status Distribution</h2>
              {(["vulnerable", "deprecated", "outdated", "ok"] as DepStatus[]).map(s => {
                const count = deps.filter(d => d.status === s).length;
                const pct = Math.round((count / deps.length) * 100);
                return (
                  <div key={s} className="flex items-center gap-3 mb-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium w-24 text-center", statusBadge[s])}>{s}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full", s === "vulnerable" ? "bg-rose-500" : s === "deprecated" ? "bg-orange-500" : s === "outdated" ? "bg-amber-500" : "bg-emerald-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-6 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Vulnerability Severity Breakdown</h2>
              {(["critical","high","medium","low"] as VulnSeverity[]).map(s => {
                const count = vulns.filter(v => v.severity === s).length;
                return (
                  <div key={s} className="flex items-center gap-3 mb-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium w-16 text-center", severityBg[s])}>{s}</span>
                    <div className="flex-1 bg-zinc-800 rounded-full h-2">
                      <div
                        className={cn("h-2 rounded-full", s === "critical" ? "bg-red-500" : s === "high" ? "bg-rose-500" : s === "medium" ? "bg-amber-500" : "bg-yellow-500")}
                        style={{ width: `${(count / vulns.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-4 text-right">{count}</span>
                  </div>
                );
              })}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-4">Top Risk: Immediate Action Required</h2>
              <div className="space-y-2">
                {vulns.filter(v => v.severity === "critical").map(v => (
                  <div key={v.id} className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold">CRITICAL</span>
                      <span className="text-sm font-semibold text-white">{v.cve}</span>
                      <span className="text-xs text-zinc-400">{v.depName}@{v.depVersion}</span>
                      <span className="text-xs text-zinc-500 ml-auto">CVSS: {v.cvss}</span>
                    </div>
                    <p className="text-xs text-zinc-400">{v.title}</p>
                    {v.fixedIn && <p className="text-xs text-emerald-400 mt-1">Fix available in v{v.fixedIn}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Dependencies tab */}
        {tab === "dependencies" && (
          <div className="space-y-4">
            <div className="flex gap-2 flex-wrap">
              {(["all", "vulnerable", "outdated", "deprecated", "ok"] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setStatusFilter(f === "all" ? "all" : f); setSelectedDep(null); }}
                  className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition-colors", statusFilter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200")}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>

            {selectedDep ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-5">
                <button onClick={() => setSelectedDep(null)} className="text-zinc-400 hover:text-white text-sm">← Back</button>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-white">{selectedDep.name}</h2>
                  <code className="text-xs text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded">v{selectedDep.version}</code>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[selectedDep.status])}>{selectedDep.status}</span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Installed",    value: selectedDep.version },
                    { label: "Latest",       value: selectedDep.latestVersion },
                    { label: "License",      value: selectedDep.license },
                    { label: "Size",         value: `${selectedDep.size} KB` },
                    { label: "Transitive",   value: selectedDep.transitive ? "Yes" : "No" },
                    { label: "Published",    value: selectedDep.lastPublished },
                    { label: "CVEs",         value: selectedDep.vulns },
                    { label: "Max Severity", value: selectedDep.maxSeverity ?? "none" },
                  ].map(m => (
                    <div key={m.label} className="bg-zinc-800/60 rounded-lg p-3">
                      <p className="text-xs text-zinc-500">{m.label}</p>
                      <p className="text-sm font-medium text-white mt-0.5">{m.value}</p>
                    </div>
                  ))}
                </div>

                {selectedDep.updateType && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">Update available:</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", updateBadge[selectedDep.updateType])}>{selectedDep.updateType.toUpperCase()}</span>
                    <span className="text-sm text-zinc-300">→ v{selectedDep.latestVersion}</span>
                  </div>
                )}

                {selectedDep.deprecated && selectedDep.deprecatedMsg && (
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-sm text-orange-400">
                    ⚠ Deprecated: {selectedDep.deprecatedMsg}
                  </div>
                )}

                <div>
                  <p className="text-xs text-zinc-500 mb-2">Used by</p>
                  <div className="flex gap-2 flex-wrap">
                    {selectedDep.usedBy.map(u => (
                      <span key={u} className="text-xs bg-zinc-800 text-zinc-300 px-2 py-1 rounded">{u}</span>
                    ))}
                  </div>
                </div>

                {/* Relevant vulns */}
                {vulns.filter(v => v.depName === selectedDep.name).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-300 mb-3">CVEs</h3>
                    <div className="space-y-2">
                      {vulns.filter(v => v.depName === selectedDep.name).map(v => (
                        <div key={v.id} className="bg-zinc-800/60 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", severityBg[v.severity])}>{v.severity}</span>
                            <span className="text-xs text-zinc-400 font-mono">{v.cve}</span>
                            <span className="text-xs text-zinc-500 ml-auto">CVSS {v.cvss}</span>
                          </div>
                          <p className="text-xs text-zinc-300">{v.title}</p>
                          {v.fixedIn && <p className="text-xs text-emerald-400 mt-1">Fixed in v{v.fixedIn}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDeps.map(dep => (
                  <button
                    key={dep.id}
                    onClick={() => setSelectedDep(dep)}
                    className="w-full text-left bg-zinc-900 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-semibold text-white">{dep.name}</span>
                          <code className="text-xs text-zinc-500">v{dep.version}</code>
                          {dep.updateType && <span className={cn("text-xs px-1.5 py-0.5 rounded", updateBadge[dep.updateType])}>→ v{dep.latestVersion}</span>}
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", statusBadge[dep.status])}>{dep.status}</span>
                          {dep.transitive && <span className="text-xs text-zinc-600">transitive</span>}
                        </div>
                        <div className="flex gap-3 text-xs text-zinc-500">
                          <span>{dep.license}</span>
                          <span>{dep.size} KB</span>
                          <span>Used by: {dep.usedBy.join(", ")}</span>
                        </div>
                      </div>
                      {dep.maxSeverity && (
                        <span className={cn("text-xs font-bold flex-shrink-0", severityColor[dep.maxSeverity])}>
                          {dep.vulns} CVE{dep.vulns !== 1 ? "s" : ""} ({dep.maxSeverity})
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Vulns tab */}
        {tab === "vulns" && (
          <div className="space-y-3">
            {vulns.toSorted((a, b) => b.cvss - a.cvss).map(v => (
              <div key={v.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div className="flex items-center gap-3">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-bold", severityBg[v.severity])}>{v.severity.toUpperCase()}</span>
                    <span className="text-xs font-mono text-zinc-400">{v.cve}</span>
                    <span className="text-xs text-zinc-600">CVSS: {v.cvss}</span>
                  </div>
                  <span className="text-xs text-zinc-500">{v.publishedAt}</span>
                </div>
                <p className="text-sm font-semibold text-white mb-1">{v.title}</p>
                <p className="text-xs text-zinc-400 mb-2">{v.description}</p>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-zinc-500">Package:</span>
                  <span className="text-zinc-300">{v.depName}@{v.depVersion}</span>
                  {v.fixedIn
                    ? <span className="text-emerald-400">✓ Fixed in v{v.fixedIn}</span>
                    : <span className="text-rose-400">✗ No fix available</span>
                  }
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Licenses tab */}
        {tab === "licenses" && (
          <div className="space-y-4">
            <div className="space-y-3">
              {licenseIssues.map((issue, i) => (
                <div key={i} className={cn(
                  "bg-zinc-900 border rounded-xl p-4",
                  issue.risk === "high" ? "border-rose-500/30" : "border-amber-500/30"
                )}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", licenseRiskBg[issue.risk])}>{issue.risk} risk</span>
                    <span className="text-sm font-semibold text-white">{issue.dep}</span>
                    <code className="text-xs text-zinc-400">{issue.license}</code>
                  </div>
                  <p className="text-xs text-zinc-400">{issue.reason}</p>
                </div>
              ))}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 mb-3">All Licenses</h2>
              <div className="space-y-2">
                {Array.from(new Set(deps.map(d => d.license))).map(lic => {
                  const count = deps.filter(d => d.license === lic).length;
                  const risk = deps.find(d => d.license === lic)?.licenseRisk ?? "unknown";
                  return (
                    <div key={lic} className="flex items-center gap-3">
                      <span className={cn("text-xs px-2 py-0.5 rounded font-medium w-16 text-center", licenseRiskBg[risk])}>{risk}</span>
                      <code className="text-xs text-zinc-300 flex-1">{lic}</code>
                      <span className="text-xs text-zinc-500">{count} package{count !== 1 ? "s" : ""}</span>
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

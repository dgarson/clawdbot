import React, { useState } from "react";
import { ClipboardCheck, FileCheck } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Tab = "overview" | "controls" | "frameworks" | "evidence";
type ControlStatus = "passing" | "failing" | "not-started";
type EvidenceStatus = "approved" | "pending" | "expired";
type RiskLevel = "critical" | "high" | "medium" | "low";

interface Control {
  id: string;
  name: string;
  status: ControlStatus;
  framework: string;
  owner: string;
  lastTested: string;
  description: string;
  notes: string;
}

interface Framework {
  name: string;
  compliancePct: number;
  totalControls: number;
  passing: number;
  failing: number;
  certificationStatus: string;
  nextAudit: string;
}

interface Evidence {
  name: string;
  type: string;
  framework: string;
  control: string;
  uploadedBy: string;
  uploadDate: string;
  status: EvidenceStatus;
}

interface Finding {
  id: string;
  title: string;
  severity: RiskLevel;
  date: string;
  framework: string;
}

// ---------------------------------------------------------------------------
// Sample Data
// ---------------------------------------------------------------------------

const CONTROLS_DATA: Control[] = [
  { id: "SOC2-CC6.1", name: "Logical Access Security", status: "passing", framework: "SOC 2", owner: "J. Martinez", lastTested: "2026-02-10", description: "Restrict logical access to information assets.", notes: "All access reviews completed Q1." },
  { id: "SOC2-CC6.2", name: "Access Authentication", status: "passing", framework: "SOC 2", owner: "J. Martinez", lastTested: "2026-02-08", description: "Authenticate users before granting system access.", notes: "MFA enforced across all environments." },
  { id: "SOC2-CC6.3", name: "Access Authorization", status: "failing", framework: "SOC 2", owner: "A. Chen", lastTested: "2026-02-05", description: "Authorize access based on business requirements.", notes: "3 service accounts lack proper authorization review." },
  { id: "SOC2-CC7.1", name: "System Monitoring", status: "passing", framework: "SOC 2", owner: "R. Patel", lastTested: "2026-02-12", description: "Detect and respond to security anomalies.", notes: "SIEM alerts configured and tested." },
  { id: "SOC2-CC7.2", name: "Incident Response", status: "passing", framework: "SOC 2", owner: "R. Patel", lastTested: "2026-02-11", description: "Manage security incidents through resolution.", notes: "Runbook updated for 2026." },
  { id: "SOC2-CC8.1", name: "Change Management", status: "passing", framework: "SOC 2", owner: "L. Kim", lastTested: "2026-02-09", description: "Control changes to infrastructure and software.", notes: "All changes tracked in Jira." },
  { id: "ISO-A5.1", name: "Information Security Policies", status: "passing", framework: "ISO 27001", owner: "M. Torres", lastTested: "2026-01-28", description: "Establish management direction for information security.", notes: "Policy reviewed and approved by CISO." },
  { id: "ISO-A6.1", name: "Organization of Information Security", status: "passing", framework: "ISO 27001", owner: "M. Torres", lastTested: "2026-01-25", description: "Establish framework for managing information security.", notes: "Roles and responsibilities documented." },
  { id: "ISO-A8.1", name: "Asset Management", status: "failing", framework: "ISO 27001", owner: "D. Singh", lastTested: "2026-01-22", description: "Identify and manage organizational assets.", notes: "Asset inventory 85% complete — 15% unclassified." },
  { id: "ISO-A9.1", name: "Access Control Policy", status: "passing", framework: "ISO 27001", owner: "J. Martinez", lastTested: "2026-02-01", description: "Limit access to information and processing facilities.", notes: "RBAC fully implemented." },
  { id: "ISO-A12.1", name: "Operational Security", status: "passing", framework: "ISO 27001", owner: "R. Patel", lastTested: "2026-02-06", description: "Ensure correct and secure operations.", notes: "Patching cadence within SLA." },
  { id: "GDPR-6.1", name: "Lawfulness of Processing", status: "passing", framework: "GDPR", owner: "S. O'Brien", lastTested: "2026-02-03", description: "Ensure lawful basis for all data processing.", notes: "Legal basis documented for all processing activities." },
  { id: "GDPR-17.1", name: "Right to Erasure", status: "failing", framework: "GDPR", owner: "S. O'Brien", lastTested: "2026-02-02", description: "Enable data subjects to request deletion.", notes: "Automated erasure pipeline has a 48h backlog." },
  { id: "GDPR-25.1", name: "Data Protection by Design", status: "passing", framework: "GDPR", owner: "L. Kim", lastTested: "2026-01-30", description: "Implement data protection from the design stage.", notes: "Privacy impact assessments completed for new features." },
  { id: "GDPR-33.1", name: "Breach Notification", status: "passing", framework: "GDPR", owner: "R. Patel", lastTested: "2026-02-07", description: "Notify authorities of breaches within 72 hours.", notes: "Incident playbook includes DPA notification steps." },
  { id: "HIPAA-164.312a", name: "Access Control", status: "not-started", framework: "HIPAA", owner: "A. Chen", lastTested: "—", description: "Implement technical policies for electronic PHI access.", notes: "Scoping phase — controls not yet implemented." },
  { id: "HIPAA-164.312c", name: "Integrity Controls", status: "not-started", framework: "HIPAA", owner: "A. Chen", lastTested: "—", description: "Protect electronic PHI from improper alteration.", notes: "Pending infrastructure review." },
  { id: "HIPAA-164.312e", name: "Transmission Security", status: "not-started", framework: "HIPAA", owner: "D. Singh", lastTested: "—", description: "Guard against unauthorized access during transmission.", notes: "TLS enforcement audit scheduled for March." },
  { id: "PCI-1.1", name: "Firewall Configuration", status: "passing", framework: "PCI-DSS", owner: "D. Singh", lastTested: "2026-02-14", description: "Install and maintain firewall configurations.", notes: "Quarterly firewall rule review completed." },
  { id: "PCI-3.4", name: "Stored Cardholder Data", status: "failing", framework: "PCI-DSS", owner: "L. Kim", lastTested: "2026-02-13", description: "Render PAN unreadable anywhere it is stored.", notes: "Legacy database migration pending — 2 tables unencrypted." },
  { id: "PCI-6.5", name: "Secure Development", status: "passing", framework: "PCI-DSS", owner: "L. Kim", lastTested: "2026-02-10", description: "Develop applications based on secure coding guidelines.", notes: "SAST integrated in CI pipeline." },
  { id: "PCI-8.2", name: "User Authentication", status: "passing", framework: "PCI-DSS", owner: "J. Martinez", lastTested: "2026-02-09", description: "Ensure proper user identification and authentication.", notes: "Password policy meets PCI requirements." },
  { id: "PCI-10.1", name: "Audit Trails", status: "passing", framework: "PCI-DSS", owner: "R. Patel", lastTested: "2026-02-11", description: "Track and monitor all access to cardholder data.", notes: "Centralized logging with 1-year retention." },
];

const FRAMEWORKS_DATA: Framework[] = [
  { name: "SOC 2 Type II", compliancePct: 92, totalControls: 38, passing: 35, failing: 3, certificationStatus: "Certified", nextAudit: "2026-08-15" },
  { name: "ISO 27001", compliancePct: 84, totalControls: 34, passing: 28, failing: 6, certificationStatus: "Certified", nextAudit: "2026-11-01" },
  { name: "GDPR", compliancePct: 88, totalControls: 28, passing: 25, failing: 3, certificationStatus: "Compliant", nextAudit: "2026-06-30" },
  { name: "HIPAA", compliancePct: 35, totalControls: 22, passing: 8, failing: 1, certificationStatus: "In Progress", nextAudit: "2027-01-15" },
  { name: "PCI-DSS", compliancePct: 80, totalControls: 20, passing: 16, failing: 4, certificationStatus: "Certified", nextAudit: "2026-09-20" },
];

const EVIDENCE_DATA: Evidence[] = [
  { name: "Access Review Q1 2026", type: "Report", framework: "SOC 2", control: "SOC2-CC6.1", uploadedBy: "J. Martinez", uploadDate: "2026-02-10", status: "approved" },
  { name: "MFA Enrollment Summary", type: "Screenshot", framework: "SOC 2", control: "SOC2-CC6.2", uploadedBy: "J. Martinez", uploadDate: "2026-02-08", status: "approved" },
  { name: "SIEM Configuration Export", type: "Config File", framework: "SOC 2", control: "SOC2-CC7.1", uploadedBy: "R. Patel", uploadDate: "2026-02-12", status: "approved" },
  { name: "Incident Response Runbook v3", type: "Document", framework: "SOC 2", control: "SOC2-CC7.2", uploadedBy: "R. Patel", uploadDate: "2026-02-11", status: "approved" },
  { name: "Change Mgmt Jira Export", type: "Report", framework: "SOC 2", control: "SOC2-CC8.1", uploadedBy: "L. Kim", uploadDate: "2026-02-09", status: "pending" },
  { name: "InfoSec Policy v2.4", type: "Document", framework: "ISO 27001", control: "ISO-A5.1", uploadedBy: "M. Torres", uploadDate: "2026-01-28", status: "approved" },
  { name: "Org Chart — Security Team", type: "Document", framework: "ISO 27001", control: "ISO-A6.1", uploadedBy: "M. Torres", uploadDate: "2026-01-25", status: "approved" },
  { name: "Asset Inventory Spreadsheet", type: "Spreadsheet", framework: "ISO 27001", control: "ISO-A8.1", uploadedBy: "D. Singh", uploadDate: "2026-01-22", status: "expired" },
  { name: "RBAC Matrix", type: "Spreadsheet", framework: "ISO 27001", control: "ISO-A9.1", uploadedBy: "J. Martinez", uploadDate: "2026-02-01", status: "approved" },
  { name: "Data Processing Register", type: "Spreadsheet", framework: "GDPR", control: "GDPR-6.1", uploadedBy: "S. O'Brien", uploadDate: "2026-02-03", status: "approved" },
  { name: "Erasure Pipeline Logs", type: "Log File", framework: "GDPR", control: "GDPR-17.1", uploadedBy: "S. O'Brien", uploadDate: "2026-02-02", status: "pending" },
  { name: "PIA — Feature Launch Q1", type: "Report", framework: "GDPR", control: "GDPR-25.1", uploadedBy: "L. Kim", uploadDate: "2026-01-30", status: "approved" },
  { name: "Breach Notification Playbook", type: "Document", framework: "GDPR", control: "GDPR-33.1", uploadedBy: "R. Patel", uploadDate: "2026-02-07", status: "approved" },
  { name: "Firewall Rule Review Q1", type: "Report", framework: "PCI-DSS", control: "PCI-1.1", uploadedBy: "D. Singh", uploadDate: "2026-02-14", status: "approved" },
  { name: "PAN Encryption Audit", type: "Report", framework: "PCI-DSS", control: "PCI-3.4", uploadedBy: "L. Kim", uploadDate: "2026-02-13", status: "pending" },
  { name: "SAST Pipeline Report", type: "Report", framework: "PCI-DSS", control: "PCI-6.5", uploadedBy: "L. Kim", uploadDate: "2026-02-10", status: "approved" },
  { name: "Centralized Log Retention Policy", type: "Document", framework: "PCI-DSS", control: "PCI-10.1", uploadedBy: "R. Patel", uploadDate: "2026-02-11", status: "approved" },
];

const FINDINGS_DATA: Finding[] = [
  { id: "FND-041", title: "Unencrypted PAN in legacy database", severity: "critical", date: "2026-02-13", framework: "PCI-DSS" },
  { id: "FND-040", title: "3 service accounts missing authorization review", severity: "high", date: "2026-02-05", framework: "SOC 2" },
  { id: "FND-039", title: "Data erasure pipeline backlog exceeds 24h SLA", severity: "high", date: "2026-02-02", framework: "GDPR" },
  { id: "FND-038", title: "Asset inventory 15% unclassified", severity: "medium", date: "2026-01-22", framework: "ISO 27001" },
  { id: "FND-037", title: "HIPAA access controls not yet scoped", severity: "medium", date: "2026-01-20", framework: "HIPAA" },
  { id: "FND-036", title: "Firewall rule documentation outdated", severity: "low", date: "2026-01-18", framework: "PCI-DSS" },
];

const RISK_DISTRIBUTION: { level: RiskLevel; count: number }[] = [
  { level: "critical", count: 2 },
  { level: "high", count: 5 },
  { level: "medium", count: 8 },
  { level: "low", count: 3 },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "controls", label: "Controls" },
  { key: "frameworks", label: "Frameworks" },
  { key: "evidence", label: "Evidence" },
];

function statusColor(s: ControlStatus): string {
  if (s === "passing") {return "text-emerald-400";}
  if (s === "failing") {return "text-rose-400";}
  return "text-zinc-400";
}

function statusBg(s: ControlStatus): string {
  if (s === "passing") {return "bg-emerald-400/15 text-emerald-400";}
  if (s === "failing") {return "bg-rose-400/15 text-rose-400";}
  return "bg-zinc-700/40 text-zinc-400";
}

function evidenceStatusBg(s: EvidenceStatus): string {
  if (s === "approved") {return "bg-emerald-400/15 text-emerald-400";}
  if (s === "pending") {return "bg-amber-400/15 text-amber-400";}
  return "bg-rose-400/15 text-rose-400";
}

function severityColor(s: RiskLevel): string {
  if (s === "critical") {return "bg-rose-500";}
  if (s === "high") {return "bg-amber-500";}
  if (s === "medium") {return "bg-amber-300";}
  return "bg-emerald-400";
}

function severityText(s: RiskLevel): string {
  if (s === "critical") {return "text-rose-400";}
  if (s === "high") {return "text-amber-400";}
  if (s === "medium") {return "text-amber-300";}
  return "text-emerald-400";
}

function certBadge(status: string): string {
  if (status === "Certified") {return "bg-emerald-400/15 text-emerald-400";}
  if (status === "Compliant") {return "bg-indigo-400/15 text-indigo-400";}
  return "bg-amber-400/15 text-amber-400";
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</span>
      <span className={cn("text-2xl font-bold", color ?? "text-white")}>{value}</span>
    </div>
  );
}

function OverviewTab() {
  const maxRisk = Math.max(...RISK_DISTRIBUTION.map((r) => r.count));

  return (
    <div className="space-y-6">
      {/* Score + KPIs row */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Compliance score card */}
        <div className="lg:col-span-1 rounded-lg bg-zinc-900 border border-zinc-800 p-5 flex flex-col items-center justify-center gap-2">
          <span className="text-xs font-medium uppercase tracking-wider text-zinc-400">Compliance Score</span>
          <span className="text-5xl font-extrabold text-indigo-400">78%</span>
          <div className="w-full h-2 rounded-full bg-zinc-800 mt-1">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: "78%" }} />
          </div>
        </div>

        {/* KPI cards */}
        <KpiCard label="Total Controls" value={142} />
        <KpiCard label="Passing" value={111} color="text-emerald-400" />
        <KpiCard label="Failing" value={18} color="text-rose-400" />
        <KpiCard label="Not Started" value={13} color="text-zinc-400" />
      </div>

      {/* Risk distribution + Recent findings */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk distribution */}
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Risk Distribution</h3>
          <div className="space-y-3">
            {RISK_DISTRIBUTION.map((r) => (
              <div key={r.level} className="flex items-center gap-3">
                <span className={cn("text-xs font-medium w-16 capitalize", severityText(r.level))}>{r.level}</span>
                <div className="flex-1 h-3 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", severityColor(r.level))}
                    style={{ width: `${(r.count / maxRisk) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-zinc-400 w-6 text-right">{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent findings */}
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-5">
          <h3 className="text-sm font-semibold text-zinc-300 mb-4">Recent Findings</h3>
          <div className="space-y-2">
            {FINDINGS_DATA.map((f) => (
              <div key={f.id} className="flex items-start gap-3 rounded-md bg-zinc-800/50 px-3 py-2">
                <span className={cn("mt-0.5 inline-block h-2 w-2 rounded-full flex-shrink-0", severityColor(f.severity))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 leading-snug">{f.title}</p>
                  <p className="text-xs text-zinc-500 mt-0.5">{f.id} · {f.framework} · {f.date}</p>
                </div>
                <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded", severityText(f.severity))}>{f.severity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlsTab() {
  const [filter, setFilter] = useState<string>("all");
  const [fwFilter, setFwFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const frameworks = Array.from(new Set(CONTROLS_DATA.map((c) => c.framework)));

  const filtered = CONTROLS_DATA.filter((c) => {
    const statusMatch = filter === "all" || c.status === filter;
    const fwMatch = fwFilter === "all" || c.framework === fwFilter;
    return statusMatch && fwMatch;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Status:</span>
          {["all", "passing", "failing", "not-started"].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                filter === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
            >
              {s === "all" ? "All" : s === "not-started" ? "Not Started" : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-400">Framework:</span>
          {["all", ...frameworks].map((fw) => (
            <button
              key={fw}
              onClick={() => setFwFilter(fw)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                fwFilter === fw ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              )}
            >
              {fw === "all" ? "All" : fw}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">ID</th>
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Framework</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Owner</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Last Tested</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <React.Fragment key={c.id}>
                <tr
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/40 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-indigo-400">{c.id}</td>
                  <td className="px-4 py-3 text-zinc-200">{c.name}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", statusBg(c.status))}>
                      {c.status === "not-started" ? "Not Started" : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{c.framework}</td>
                  <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{c.owner}</td>
                  <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">{c.lastTested}</td>
                </tr>
                {expanded === c.id && (
                  <tr className="bg-zinc-800/30">
                    <td colSpan={6} className="px-4 py-4">
                      <div className="space-y-1 text-sm">
                        <p className="text-zinc-300"><span className="text-zinc-500 font-medium">Description:</span> {c.description}</p>
                        <p className="text-zinc-300"><span className="text-zinc-500 font-medium">Notes:</span> {c.notes}</p>
                        <p className="text-zinc-300"><span className="text-zinc-500 font-medium">Owner:</span> {c.owner} · <span className="text-zinc-500 font-medium">Last Tested:</span> {c.lastTested}</p>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <ContextualEmptyState
            icon={ClipboardCheck}
            title="No controls match that filter"
            description="Adjust your criteria to surface controls — or add a new one to expand coverage."
            size="sm"
          />
        )}
      </div>
      <p className="text-xs text-zinc-600">Showing {filtered.length} of {CONTROLS_DATA.length} controls</p>
    </div>
  );
}

function FrameworksTab() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {FRAMEWORKS_DATA.map((fw) => {
        const notStarted = fw.totalControls - fw.passing - fw.failing;
        return (
          <div key={fw.name} className="rounded-lg bg-zinc-900 border border-zinc-800 p-5 flex flex-col gap-4">
            <div className="flex items-start justify-between">
              <h3 className="text-base font-semibold text-white">{fw.name}</h3>
              <span className={cn("text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full", certBadge(fw.certificationStatus))}>
                {fw.certificationStatus}
              </span>
            </div>

            {/* Compliance bar */}
            <div>
              <div className="flex items-end justify-between mb-1.5">
                <span className="text-xs text-zinc-400">Compliance</span>
                <span className="text-lg font-bold text-white">{fw.compliancePct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-zinc-800">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    fw.compliancePct >= 85 ? "bg-emerald-500" : fw.compliancePct >= 60 ? "bg-amber-400" : "bg-rose-400"
                  )}
                  style={{ width: `${fw.compliancePct}%` }}
                />
              </div>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold text-zinc-200">{fw.totalControls}</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold text-emerald-400">{fw.passing}</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Passing</p>
              </div>
              <div>
                <p className="text-lg font-bold text-rose-400">{fw.failing}</p>
                <p className="text-[10px] uppercase tracking-wider text-zinc-500">Failing</p>
              </div>
            </div>

            {notStarted > 0 && (
              <p className="text-xs text-zinc-500">{notStarted} controls not yet started</p>
            )}

            <div className="border-t border-zinc-800 pt-3 mt-auto">
              <p className="text-xs text-zinc-500">Next Audit: <span className="text-zinc-300">{fw.nextAudit}</span></p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvidenceTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = EVIDENCE_DATA.filter((e) => statusFilter === "all" || e.status === statusFilter);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-400">Status:</span>
        {["all", "approved", "pending", "expired"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              "px-3 py-1 rounded-md text-xs font-medium transition-colors",
              statusFilter === s ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            )}
          >
            {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase tracking-wider">
              <th className="text-left px-4 py-3 font-medium">Name</th>
              <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Type</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Framework</th>
              <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Control</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Uploaded By</th>
              <th className="text-left px-4 py-3 font-medium hidden lg:table-cell">Date</th>
              <th className="text-left px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e, idx) => (
              <tr key={`${e.control}-${idx}`} className="border-b border-zinc-800/50 hover:bg-zinc-800/40 transition-colors">
                <td className="px-4 py-3 text-zinc-200">{e.name}</td>
                <td className="px-4 py-3 text-zinc-400 hidden sm:table-cell">{e.type}</td>
                <td className="px-4 py-3 text-zinc-400 hidden md:table-cell">{e.framework}</td>
                <td className="px-4 py-3 font-mono text-xs text-indigo-400 hidden md:table-cell">{e.control}</td>
                <td className="px-4 py-3 text-zinc-400 hidden lg:table-cell">{e.uploadedBy}</td>
                <td className="px-4 py-3 text-zinc-500 hidden lg:table-cell">{e.uploadDate}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", evidenceStatusBg(e.status))}>
                    {e.status.charAt(0).toUpperCase() + e.status.slice(1)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <ContextualEmptyState
            icon={FileCheck}
            title="No evidence on file"
            description="Upload artifacts or attach evidence to controls to start tracking compliance."
            size="sm"
          />
        )}
      </div>
      <p className="text-xs text-zinc-600">Showing {filtered.length} of {EVIDENCE_DATA.length} artifacts</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ComplianceTracker() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 md:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Compliance Tracker</h1>
        <p className="text-sm text-zinc-400 mt-1">Regulatory compliance monitoring and evidence management</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium transition-colors relative",
              activeTab === tab.key
                ? "text-white"
                : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            {tab.label}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-t" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "controls" && <ControlsTab />}
      {activeTab === "frameworks" && <FrameworksTab />}
      {activeTab === "evidence" && <EvidenceTab />}
    </div>
  );
}

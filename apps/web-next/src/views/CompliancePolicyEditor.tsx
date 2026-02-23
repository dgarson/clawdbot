import React, { useState } from "react";
import { cn } from "../lib/utils";

type PolicyStatus = "active" | "draft" | "archived" | "review";
type PolicyCategory = "data-privacy" | "access-control" | "security" | "operational" | "financial";
type ControlStatus = "passing" | "failing" | "warning" | "not-tested";
type RiskLevel = "critical" | "high" | "medium" | "low";
type EvidenceType = "automated" | "manual" | "attestation";

interface PolicyControl {
  id: string;
  name: string;
  description: string;
  status: ControlStatus;
  lastTested: string;
  evidenceType: EvidenceType;
  owner: string;
  automationId: string | null;
}

interface PolicyRule {
  id: string;
  text: string;
  required: boolean;
}

interface CompliancePolicy {
  id: string;
  name: string;
  version: string;
  category: PolicyCategory;
  status: PolicyStatus;
  framework: string;
  riskLevel: RiskLevel;
  owner: string;
  reviewDate: string;
  effectiveDate: string;
  description: string;
  rules: PolicyRule[];
  controls: PolicyControl[];
  passingControls: number;
  totalControls: number;
  lastAudit: string;
  exceptions: number;
  tags: string[];
}

interface AuditEntry {
  id: string;
  policyId: string;
  policyName: string;
  action: string;
  user: string;
  timestamp: string;
  before: string;
  after: string;
}

interface ExceptionRequest {
  id: string;
  policyId: string;
  policyName: string;
  requester: string;
  reason: string;
  status: "pending" | "approved" | "denied";
  expiresAt: string;
  riskAccepted: RiskLevel;
  approver: string | null;
  submittedAt: string;
}

const POLICIES: CompliancePolicy[] = [
  {
    id: "p1", name: "Data Encryption at Rest", version: "2.1.0", category: "data-privacy",
    status: "active", framework: "SOC 2 Type II", riskLevel: "critical",
    owner: "CISO Office", reviewDate: "2026-06-01", effectiveDate: "2025-01-01",
    description: "All sensitive data stored in persistent storage must be encrypted using AES-256 or equivalent. This includes databases, file systems, backups, and logs containing PII.",
    rules: [
      { id: "r1", text: "Production databases must use AES-256 encryption", required: true },
      { id: "r2", text: "Encryption keys must be rotated every 90 days", required: true },
      { id: "r3", text: "Backup archives must be encrypted before transmission", required: true },
      { id: "r4", text: "Key management must use a dedicated HSM or KMS", required: true },
      { id: "r5", text: "Encryption algorithms must meet FIPS 140-2 standards", required: false },
    ],
    controls: [
      { id: "c1", name: "DB Encryption Check", description: "Automated scan of all databases for encryption configuration", status: "passing", lastTested: "2026-02-22 06:00", evidenceType: "automated", owner: "Platform Team", automationId: "scan-db-enc-001" },
      { id: "c2", name: "Key Rotation Audit", description: "Verify encryption keys were rotated within 90 days", status: "warning", lastTested: "2026-02-20 12:00", evidenceType: "automated", owner: "Security Team", automationId: "key-rot-check-002" },
      { id: "c3", name: "Backup Encryption Verification", description: "Sample-based verification of backup encryption", status: "passing", lastTested: "2026-02-19 08:00", evidenceType: "manual", owner: "Ops Team", automationId: null },
      { id: "c4", name: "KMS Configuration Review", description: "Quarterly review of KMS policies and access", status: "passing", lastTested: "2026-01-15 10:00", evidenceType: "attestation", owner: "CISO Office", automationId: null },
    ],
    passingControls: 3, totalControls: 4, lastAudit: "2026-02-15", exceptions: 0,
    tags: ["encryption", "PII", "GDPR", "SOC2"],
  },
  {
    id: "p2", name: "Multi-Factor Authentication", version: "1.5.2", category: "access-control",
    status: "active", framework: "ISO 27001", riskLevel: "high",
    owner: "Identity Team", reviewDate: "2026-08-01", effectiveDate: "2024-09-01",
    description: "All user accounts with access to production systems or sensitive data must authenticate using multi-factor authentication. Hardware tokens required for privileged accounts.",
    rules: [
      { id: "r6", text: "MFA required for all admin accounts", required: true },
      { id: "r7", text: "MFA required for production system access", required: true },
      { id: "r8", text: "Hardware tokens required for C-level and CISO roles", required: true },
      { id: "r9", text: "MFA bypass must require CISO approval and time-limit", required: true },
      { id: "r10", text: "MFA enrollment must complete within 24h of account creation", required: false },
    ],
    controls: [
      { id: "c5", name: "MFA Coverage Scan", description: "Scan all active accounts for MFA enrollment status", status: "passing", lastTested: "2026-02-22 04:00", evidenceType: "automated", owner: "Identity Team", automationId: "mfa-scan-003" },
      { id: "c6", name: "Privileged Account Review", description: "Quarterly review of privileged accounts with hardware token verification", status: "passing", lastTested: "2026-01-31 09:00", evidenceType: "manual", owner: "CISO Office", automationId: null },
      { id: "c7", name: "MFA Bypass Log Review", description: "Review all MFA bypass events for unauthorized usage", status: "failing", lastTested: "2026-02-10 11:00", evidenceType: "automated", owner: "Security Ops", automationId: "bypass-audit-004" },
    ],
    passingControls: 2, totalControls: 3, lastAudit: "2026-01-31", exceptions: 2,
    tags: ["MFA", "authentication", "access-control"],
  },
  {
    id: "p3", name: "Vulnerability Management", version: "3.0.0", category: "security",
    status: "active", framework: "NIST CSF", riskLevel: "high",
    owner: "Security Engineering", reviewDate: "2026-04-01", effectiveDate: "2025-04-01",
    description: "All systems must undergo regular vulnerability scanning. Critical vulnerabilities must be remediated within 24 hours, high severity within 7 days, and medium within 30 days.",
    rules: [
      { id: "r11", text: "Critical CVEs must be patched within 24 hours", required: true },
      { id: "r12", text: "High CVEs must be patched within 7 days", required: true },
      { id: "r13", text: "Weekly automated vulnerability scans for all services", required: true },
      { id: "r14", text: "Penetration testing annually for production systems", required: true },
    ],
    controls: [
      { id: "c8", name: "Automated Vuln Scan", description: "Weekly Trivy + Grype scan of all container images", status: "passing", lastTested: "2026-02-21 02:00", evidenceType: "automated", owner: "Security Engineering", automationId: "vuln-scan-005" },
      { id: "c9", name: "SLA Compliance Tracker", description: "Track patch SLA compliance for open CVEs", status: "failing", lastTested: "2026-02-22 01:00", evidenceType: "automated", owner: "Security Engineering", automationId: "patch-sla-006" },
      { id: "c10", name: "Pen Test Evidence", description: "Annual penetration test report and remediation evidence", status: "not-tested", lastTested: "2025-08-15 00:00", evidenceType: "manual", owner: "CISO Office", automationId: null },
    ],
    passingControls: 1, totalControls: 3, lastAudit: "2026-02-01", exceptions: 1,
    tags: ["CVE", "patching", "scanning", "NIST"],
  },
  {
    id: "p4", name: "Data Retention & Deletion", version: "1.2.0", category: "data-privacy",
    status: "draft", framework: "GDPR", riskLevel: "medium",
    owner: "Legal & Compliance", reviewDate: "2026-03-01", effectiveDate: "N/A",
    description: "Personal data must not be retained beyond its stated retention period. Deletion requests must be honored within 30 days. Automated deletion jobs must run at least weekly.",
    rules: [
      { id: "r15", text: "Retention periods must be documented per data class", required: true },
      { id: "r16", text: "DSAR deletion requests honored within 30 days", required: true },
      { id: "r17", text: "Automated deletion jobs run weekly", required: true },
    ],
    controls: [
      { id: "c11", name: "Retention Policy Audit", description: "Annual audit of documented retention policies vs actual data", status: "not-tested", lastTested: "2025-09-01 00:00", evidenceType: "manual", owner: "Legal", automationId: null },
      { id: "c12", name: "DSAR Response Timer", description: "Track time to completion of data deletion requests", status: "not-tested", lastTested: "never", evidenceType: "automated", owner: "Privacy Team", automationId: null },
    ],
    passingControls: 0, totalControls: 2, lastAudit: "2025-09-01", exceptions: 0,
    tags: ["GDPR", "retention", "PII", "deletion"],
  },
  {
    id: "p5", name: "Change Management Policy", version: "2.0.1", category: "operational",
    status: "active", framework: "ITIL", riskLevel: "medium",
    owner: "Platform Engineering", reviewDate: "2026-09-01", effectiveDate: "2025-03-01",
    description: "All changes to production systems must follow the change approval process. Emergency changes require post-hoc review within 72 hours. All changes must be logged.",
    rules: [
      { id: "r18", text: "All production changes require CAB approval", required: true },
      { id: "r19", text: "Emergency changes reviewed within 72 hours", required: true },
      { id: "r20", text: "Changes must include rollback plan", required: true },
      { id: "r21", text: "Deployment windows defined and enforced", required: false },
    ],
    controls: [
      { id: "c13", name: "CAB Approval Rate", description: "Track % of changes with formal CAB approval", status: "passing", lastTested: "2026-02-22 00:00", evidenceType: "automated", owner: "Change Mgmt", automationId: "cab-rate-007" },
      { id: "c14", name: "Emergency Change Review", description: "Verify emergency changes reviewed within 72h", status: "warning", lastTested: "2026-02-18 10:00", evidenceType: "automated", owner: "Change Mgmt", automationId: "emrg-review-008" },
      { id: "c15", name: "Rollback Plan Presence", description: "Check all change tickets include documented rollback", status: "passing", lastTested: "2026-02-20 08:00", evidenceType: "automated", owner: "Platform Eng", automationId: "rollback-check-009" },
    ],
    passingControls: 2, totalControls: 3, lastAudit: "2026-02-01", exceptions: 0,
    tags: ["change-management", "ITIL", "CAB"],
  },
];

const AUDIT_LOG: AuditEntry[] = [
  { id: "a1", policyId: "p1", policyName: "Data Encryption at Rest", action: "Version bumped to 2.1.0", user: "alice@company.com", timestamp: "2026-02-10 14:22", before: "2.0.3", after: "2.1.0" },
  { id: "a2", policyId: "p2", policyName: "Multi-Factor Authentication", action: "Added hardware token rule for C-level", user: "bob@company.com", timestamp: "2026-02-08 09:15", before: "r7 missing", after: "r7 added" },
  { id: "a3", policyId: "p3", policyName: "Vulnerability Management", action: "Critical CVE SLA changed from 48h to 24h", user: "security-eng@company.com", timestamp: "2026-02-05 16:00", before: "48h SLA", after: "24h SLA" },
  { id: "a4", policyId: "p5", policyName: "Change Management Policy", action: "Control c14 status changed to warning", user: "system", timestamp: "2026-02-18 10:00", before: "passing", after: "warning" },
  { id: "a5", policyId: "p4", policyName: "Data Retention & Deletion", action: "Policy status changed to draft for revision", user: "legal@company.com", timestamp: "2026-02-01 11:00", before: "review", after: "draft" },
];

const EXCEPTIONS: ExceptionRequest[] = [
  { id: "e1", policyId: "p2", policyName: "Multi-Factor Authentication", requester: "dev-tools-bot@company.com", reason: "CI/CD pipeline requires non-interactive auth; MFA not compatible with automation flows.", status: "approved", expiresAt: "2026-06-30", riskAccepted: "medium", approver: "ciso@company.com", submittedAt: "2026-01-15" },
  { id: "e2", policyId: "p2", policyName: "Multi-Factor Authentication", requester: "monitoring-svc@company.com", reason: "Legacy monitoring system does not support MFA; migration scheduled for Q3 2026.", status: "approved", expiresAt: "2026-09-30", riskAccepted: "medium", approver: "ciso@company.com", submittedAt: "2026-01-20" },
  { id: "e3", policyId: "p3", policyName: "Vulnerability Management", requester: "vendor-integration@company.com", reason: "Third-party vendor component CVE-2026-1234; patch not yet available from vendor.", status: "pending", expiresAt: "2026-04-30", riskAccepted: "high", approver: null, submittedAt: "2026-02-18" },
];

function statusBadge(s: PolicyStatus) {
  if (s === "active") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "draft") {return "bg-amber-400/10 text-amber-400";}
  if (s === "archived") {return "bg-zinc-600 text-zinc-400";}
  return "bg-indigo-400/10 text-indigo-400";
}
function riskBadge(r: RiskLevel) {
  if (r === "critical") {return "bg-rose-500/10 text-rose-400";}
  if (r === "high") {return "bg-orange-500/10 text-orange-400";}
  if (r === "medium") {return "bg-amber-500/10 text-amber-400";}
  return "bg-emerald-500/10 text-emerald-400";
}
function controlStatusDot(s: ControlStatus) {
  if (s === "passing") {return "bg-emerald-400";}
  if (s === "failing") {return "bg-rose-400";}
  if (s === "warning") {return "bg-amber-400";}
  return "bg-zinc-500";
}
function controlStatusText(s: ControlStatus) {
  if (s === "passing") {return "text-emerald-400";}
  if (s === "failing") {return "text-rose-400";}
  if (s === "warning") {return "text-amber-400";}
  return "text-zinc-500";
}
function categoryLabel(c: PolicyCategory) {
  const map: Record<PolicyCategory, string> = {
    "data-privacy": "Data Privacy",
    "access-control": "Access Control",
    "security": "Security",
    "operational": "Operational",
    "financial": "Financial",
  };
  return map[c];
}
function exceptionStatusBadge(s: ExceptionRequest["status"]) {
  if (s === "approved") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "denied") {return "bg-rose-400/10 text-rose-400";}
  return "bg-amber-400/10 text-amber-400";
}

function ControlPassBar({ passing, total }: { passing: number; total: number }) {
  const pct = total > 0 ? (passing / total) * 100 : 0;
  const color = pct === 100 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-700 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 whitespace-nowrap">{passing}/{total}</span>
    </div>
  );
}

export default function CompliancePolicyEditor() {
  const [tab, setTab] = useState<"policies" | "controls" | "exceptions" | "audit">("policies");
  const [selectedPolicy, setSelectedPolicy] = useState<CompliancePolicy | null>(null);
  const [filterStatus, setFilterStatus] = useState<PolicyStatus | "all">("all");
  const [filterCategory, setFilterCategory] = useState<PolicyCategory | "all">("all");
  const [filterRisk, setFilterRisk] = useState<RiskLevel | "all">("all");
  const [editMode, setEditMode] = useState(false);

  const filtered = POLICIES.filter(p => {
    if (filterStatus !== "all" && p.status !== filterStatus) {return false;}
    if (filterCategory !== "all" && p.category !== filterCategory) {return false;}
    if (filterRisk !== "all" && p.riskLevel !== filterRisk) {return false;}
    return true;
  });

  const totalPolicies = POLICIES.length;
  const activePolicies = POLICIES.filter(p => p.status === "active").length;
  const failingControls = POLICIES.flatMap(p => p.controls).filter(c => c.status === "failing").length;
  const openExceptions = EXCEPTIONS.filter(e => e.status === "pending").length;
  const totalControls = POLICIES.reduce((s, p) => s + p.totalControls, 0);
  const passingControls = POLICIES.reduce((s, p) => s + p.passingControls, 0);
  const overallPass = totalControls > 0 ? Math.round((passingControls / totalControls) * 100) : 0;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "policies", label: "Policies" },
    { id: "controls", label: "Controls" },
    { id: "exceptions", label: `Exceptions (${EXCEPTIONS.length})` },
    { id: "audit", label: "Audit Log" },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Compliance Policy Editor</h1>
          <p className="text-zinc-400 text-sm mt-1">Manage compliance policies, controls, and exception tracking</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors">Export PDF</button>
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-white transition-colors">+ New Policy</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Active Policies</div>
          <div className="text-2xl font-bold text-white">{activePolicies}<span className="text-sm text-zinc-500 font-normal">/{totalPolicies}</span></div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Control Pass Rate</div>
          <div className={cn("text-2xl font-bold", overallPass >= 80 ? "text-emerald-400" : overallPass >= 60 ? "text-amber-400" : "text-rose-400")}>{overallPass}%</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Failing Controls</div>
          <div className={cn("text-2xl font-bold", failingControls > 0 ? "text-rose-400" : "text-emerald-400")}>{failingControls}</div>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-zinc-800">
          <div className="text-xs text-zinc-500 mb-1">Open Exceptions</div>
          <div className={cn("text-2xl font-bold", openExceptions > 0 ? "text-amber-400" : "text-zinc-400")}>{openExceptions}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-800 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedPolicy(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-indigo-500 text-white" : "border-transparent text-zinc-400 hover:text-zinc-200")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Policies list */}
      {tab === "policies" && !selectedPolicy && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as PolicyStatus | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="draft">Draft</option>
              <option value="review">In Review</option>
              <option value="archived">Archived</option>
            </select>
            <select value={filterCategory} onChange={e => setFilterCategory(e.target.value as PolicyCategory | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Categories</option>
              <option value="data-privacy">Data Privacy</option>
              <option value="access-control">Access Control</option>
              <option value="security">Security</option>
              <option value="operational">Operational</option>
              <option value="financial">Financial</option>
            </select>
            <select value={filterRisk} onChange={e => setFilterRisk(e.target.value as RiskLevel | "all")} className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200">
              <option value="all">All Risk</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="space-y-3">
            {filtered.map(p => (
              <div
                key={p.id}
                onClick={() => setSelectedPolicy(p)}
                className="bg-zinc-900 rounded-xl p-4 border border-zinc-800 hover:border-zinc-600 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-zinc-100">{p.name}</span>
                      <span className="text-xs text-zinc-500">v{p.version}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", statusBadge(p.status))}>{p.status}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", riskBadge(p.riskLevel))}>{p.riskLevel}</span>
                    </div>
                    <div className="text-xs text-zinc-400">{categoryLabel(p.category)} · {p.framework}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">Owner: {p.owner} · Review: {p.reviewDate}</div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    {p.exceptions > 0 && <div className="text-amber-400 mb-1">{p.exceptions} exception{p.exceptions !== 1 ? "s" : ""}</div>}
                    <div>Last audit: {p.lastAudit}</div>
                  </div>
                </div>
                <ControlPassBar passing={p.passingControls} total={p.totalControls} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Policy Detail */}
      {tab === "policies" && selectedPolicy && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => { setSelectedPolicy(null); setEditMode(false); }} className="flex items-center gap-1 text-sm text-zinc-400 hover:text-zinc-200 transition-colors">
              ← Back to policies
            </button>
            <div className="flex gap-2">
              <button onClick={() => setEditMode(!editMode)} className={cn("px-3 py-1.5 text-sm rounded-lg transition-colors", editMode ? "bg-indigo-600 text-white" : "bg-zinc-800 hover:bg-zinc-700 text-zinc-300")}>
                {editMode ? "Editing..." : "Edit Policy"}
              </button>
              {editMode && <button className="px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors">Save Changes</button>}
            </div>
          </div>

          {/* Policy header */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 mb-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <h2 className="text-xl font-bold text-white">{selectedPolicy.name}</h2>
                  <span className="text-sm text-zinc-500">v{selectedPolicy.version}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge(selectedPolicy.status))}>{selectedPolicy.status}</span>
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", riskBadge(selectedPolicy.riskLevel))}>{selectedPolicy.riskLevel} risk</span>
                </div>
                <div className="text-sm text-zinc-400">{categoryLabel(selectedPolicy.category)} · {selectedPolicy.framework}</div>
                <div className="text-xs text-zinc-500 mt-1">
                  Owner: {selectedPolicy.owner} · Effective: {selectedPolicy.effectiveDate} · Review: {selectedPolicy.reviewDate}
                </div>
              </div>
              <ControlPassBar passing={selectedPolicy.passingControls} total={selectedPolicy.totalControls} />
            </div>
            <p className="text-sm text-zinc-300 leading-relaxed">{selectedPolicy.description}</p>
            <div className="flex flex-wrap gap-1 mt-3">
              {selectedPolicy.tags.map(t => <span key={t} className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300">{t}</span>)}
            </div>
          </div>

          {/* Rules */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800 mb-5">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Policy Rules</h3>
            <div className="space-y-2">
              {selectedPolicy.rules.map(rule => (
                <div key={rule.id} className="flex items-start gap-3 p-3 bg-zinc-800 rounded-lg">
                  <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", rule.required ? "bg-rose-400" : "bg-zinc-500")} />
                  <div className="flex-1">
                    <span className="text-sm text-zinc-200">{rule.text}</span>
                  </div>
                  <span className={cn("text-xs px-1.5 py-0.5 rounded flex-shrink-0", rule.required ? "bg-rose-400/10 text-rose-400" : "bg-zinc-600 text-zinc-400")}>
                    {rule.required ? "Required" : "Recommended"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div className="bg-zinc-900 rounded-xl p-5 border border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-300 mb-4">Controls ({selectedPolicy.controls.length})</h3>
            <div className="space-y-3">
              {selectedPolicy.controls.map(ctrl => (
                <div key={ctrl.id} className="p-4 bg-zinc-800 rounded-lg border border-zinc-700">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", controlStatusDot(ctrl.status))} />
                      <span className="font-medium text-zinc-200 text-sm">{ctrl.name}</span>
                      <span className={cn("text-xs capitalize", controlStatusText(ctrl.status))}>{ctrl.status.replace("-", " ")}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-500 capitalize">{ctrl.evidenceType}</span>
                      {ctrl.automationId && <span className="text-xs text-indigo-400">⚙ {ctrl.automationId}</span>}
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 ml-5 mb-2">{ctrl.description}</p>
                  <div className="flex justify-between text-xs text-zinc-500 ml-5">
                    <span>Owner: {ctrl.owner}</span>
                    <span>Last tested: {ctrl.lastTested}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Controls cross-policy view */}
      {tab === "controls" && (
        <div>
          <div className="mb-4 text-xs text-zinc-500">{totalControls} total controls across {POLICIES.length} policies</div>
          <div className="space-y-2">
            {POLICIES.flatMap(p => p.controls.map(c => ({ ...c, policyName: p.name, policyRisk: p.riskLevel }))).toSorted((a, b) => {
              const order = { failing: 0, warning: 1, "not-tested": 2, passing: 3 };
              return order[a.status] - order[b.status];
            }).map(ctrl => (
              <div key={ctrl.id} className={cn("bg-zinc-900 rounded-xl p-4 border transition-colors", ctrl.status === "failing" ? "border-rose-500/30" : ctrl.status === "warning" ? "border-amber-500/20" : "border-zinc-800")}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={cn("w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0", controlStatusDot(ctrl.status))} />
                    <div>
                      <div className="font-medium text-zinc-200 text-sm">{ctrl.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{ctrl.policyName} · Owner: {ctrl.owner}</div>
                      <div className="text-xs text-zinc-400 mt-1">{ctrl.description}</div>
                    </div>
                  </div>
                  <div className="text-right text-xs text-zinc-500">
                    <div className={cn("mb-1 capitalize font-medium", controlStatusText(ctrl.status))}>{ctrl.status.replace("-", " ")}</div>
                    <div>{ctrl.lastTested === "never" ? "Never tested" : `Tested: ${ctrl.lastTested}`}</div>
                    <div className="mt-1 capitalize">{ctrl.evidenceType}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Exceptions */}
      {tab === "exceptions" && (
        <div className="space-y-3">
          {EXCEPTIONS.map(ex => (
            <div key={ex.id} className={cn("bg-zinc-900 rounded-xl p-4 border", ex.status === "pending" ? "border-amber-500/30" : "border-zinc-800")}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-zinc-100">{ex.policyName}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", exceptionStatusBadge(ex.status))}>{ex.status}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", riskBadge(ex.riskAccepted))}>{ex.riskAccepted} risk accepted</span>
                  </div>
                  <div className="text-xs text-zinc-500">Requester: {ex.requester}</div>
                </div>
                <div className="text-right text-xs text-zinc-500">
                  <div>Submitted: {ex.submittedAt}</div>
                  <div>Expires: {ex.expiresAt}</div>
                  {ex.approver && <div className="text-emerald-400 mt-1">Approved by: {ex.approver}</div>}
                </div>
              </div>
              <div className="text-sm text-zinc-300 bg-zinc-800 rounded-lg p-3">{ex.reason}</div>
              {ex.status === "pending" && (
                <div className="flex gap-2 mt-3">
                  <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-lg text-white transition-colors">Approve</button>
                  <button className="px-3 py-1.5 text-xs bg-rose-600 hover:bg-rose-500 rounded-lg text-white transition-colors">Deny</button>
                  <button className="px-3 py-1.5 text-xs bg-zinc-700 hover:bg-zinc-600 rounded-lg text-zinc-300 transition-colors">Request Info</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Audit Log */}
      {tab === "audit" && (
        <div>
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-700">
                  {["Timestamp", "Policy", "Action", "User", "Before → After"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs text-zinc-500 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {AUDIT_LOG.map(entry => (
                  <tr key={entry.id} className="hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 text-xs text-zinc-400 whitespace-nowrap">{entry.timestamp}</td>
                    <td className="px-4 py-3 text-sm text-zinc-200">{entry.policyName}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">{entry.action}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{entry.user}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="text-zinc-500">{entry.before}</span>
                      <span className="text-zinc-600 mx-1">→</span>
                      <span className="text-zinc-300">{entry.after}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

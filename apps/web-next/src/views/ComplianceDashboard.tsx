import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ShieldCheck } from "lucide-react";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

// ── Types ──────────────────────────────────────────────────────────────────────

type FrameworkStatus = "compliant" | "in-progress" | "non-compliant";
type ControlStatus = "passed" | "failed" | "partial" | "not-tested";
type ControlCategory = "technical" | "administrative" | "physical";
type EvidenceStatus = "valid" | "expiring" | "expired";
type RiskSeverity = "critical" | "high" | "medium" | "low";
type TabKey = "controls" | "evidence" | "risks";

interface Framework {
  name: string;
  shortName: string;
  score: number;
  status: FrameworkStatus;
  controlsPassed: number;
  controlsTotal: number;
}

interface Control {
  id: string;
  title: string;
  framework: string;
  category: ControlCategory;
  status: ControlStatus;
  lastTested: string;
  owner: string;
  description: string;
}

interface EvidenceItem {
  filename: string;
  controlId: string;
  uploadDate: string;
  expiryDate: string;
  status: EvidenceStatus;
  size: string;
}

interface Risk {
  name: string;
  framework: string;
  severity: RiskSeverity;
  likelihood: number;
  impact: number;
  mitigations: string;
  owner: string;
}

// ── Data ───────────────────────────────────────────────────────────────────────

const frameworks: Framework[] = [
  { name: "SOC 2 Type II", shortName: "SOC2", score: 92, status: "compliant", controlsPassed: 46, controlsTotal: 50 },
  { name: "GDPR", shortName: "GDPR", score: 87, status: "in-progress", controlsPassed: 34, controlsTotal: 39 },
  { name: "ISO 27001", shortName: "ISO", score: 78, status: "in-progress", controlsPassed: 89, controlsTotal: 114 },
  { name: "HIPAA", shortName: "HIPAA", score: 95, status: "compliant", controlsPassed: 42, controlsTotal: 44 },
  { name: "PCI DSS", shortName: "PCI", score: 61, status: "non-compliant", controlsPassed: 74, controlsTotal: 121 },
];

const controls: Control[] = [
  { id: "CC6.1", title: "Logical and Physical Access Controls", framework: "SOC 2 Type II", category: "technical", status: "passed", lastTested: "2026-02-10", owner: "J. Martinez", description: "Logical access security measures over protected information assets to protect them from unauthorized access." },
  { id: "CC6.2", title: "User Authentication Mechanisms", framework: "SOC 2 Type II", category: "technical", status: "passed", lastTested: "2026-02-08", owner: "J. Martinez", description: "Prior to issuing system credentials, registered users are authenticated through multi-factor authentication." },
  { id: "CC6.3", title: "Role-Based Access Authorization", framework: "SOC 2 Type II", category: "administrative", status: "partial", lastTested: "2026-01-28", owner: "S. Chen", description: "Access to data and services is restricted to authorized users via role-based access control policies." },
  { id: "CC7.1", title: "Intrusion Detection and Monitoring", framework: "SOC 2 Type II", category: "technical", status: "passed", lastTested: "2026-02-15", owner: "K. Okafor", description: "To detect threats, deployed infrastructure is monitored with intrusion detection and SIEM tooling." },
  { id: "CC8.1", title: "Change Management Process", framework: "SOC 2 Type II", category: "administrative", status: "failed", lastTested: "2026-02-01", owner: "R. Patel", description: "Changes to infrastructure and software follow a documented change management process including peer review." },
  { id: "GDPR-Art5", title: "Principles of Data Processing", framework: "GDPR", category: "administrative", status: "passed", lastTested: "2026-02-12", owner: "L. Schmidt", description: "Personal data is processed lawfully, fairly, and transparently in relation to the data subject." },
  { id: "GDPR-Art17", title: "Right to Erasure", framework: "GDPR", category: "technical", status: "partial", lastTested: "2026-01-20", owner: "L. Schmidt", description: "Data subjects have the right to obtain erasure of personal data without undue delay." },
  { id: "GDPR-Art25", title: "Data Protection by Design", framework: "GDPR", category: "technical", status: "passed", lastTested: "2026-02-05", owner: "A. Novak", description: "Appropriate technical and organizational measures for data protection are implemented at design time." },
  { id: "GDPR-Art32", title: "Security of Processing", framework: "GDPR", category: "technical", status: "passed", lastTested: "2026-02-14", owner: "K. Okafor", description: "Implement appropriate technical measures to ensure security appropriate to the risk of processing." },
  { id: "GDPR-Art33", title: "Breach Notification (72h)", framework: "GDPR", category: "administrative", status: "not-tested", lastTested: "—", owner: "L. Schmidt", description: "In case of a personal data breach, notify the supervisory authority within 72 hours." },
  { id: "ISO-A.5.1.1", title: "Information Security Policies", framework: "ISO 27001", category: "administrative", status: "passed", lastTested: "2026-01-30", owner: "S. Chen", description: "A set of policies for information security shall be defined, approved, published, and communicated." },
  { id: "ISO-A.8.1.1", title: "Inventory of Assets", framework: "ISO 27001", category: "administrative", status: "partial", lastTested: "2026-02-03", owner: "R. Patel", description: "Assets associated with information and information processing facilities shall be identified and inventoried." },
  { id: "ISO-A.9.1.1", title: "Access Control Policy", framework: "ISO 27001", category: "technical", status: "passed", lastTested: "2026-02-11", owner: "J. Martinez", description: "An access control policy shall be established, documented, and reviewed based on business requirements." },
  { id: "ISO-A.12.4.1", title: "Event Logging", framework: "ISO 27001", category: "technical", status: "failed", lastTested: "2026-02-18", owner: "K. Okafor", description: "Event logs recording user activities, exceptions, faults, and security events shall be produced and kept." },
  { id: "HIPAA-164.312a", title: "Access Control (ePHI)", framework: "HIPAA", category: "technical", status: "passed", lastTested: "2026-02-09", owner: "J. Martinez", description: "Implement technical policies and procedures for electronic information systems that maintain ePHI." },
  { id: "HIPAA-164.312c", title: "Integrity Controls", framework: "HIPAA", category: "technical", status: "passed", lastTested: "2026-02-13", owner: "A. Novak", description: "Implement policies and procedures to protect ePHI from improper alteration or destruction." },
  { id: "HIPAA-164.312e", title: "Transmission Security", framework: "HIPAA", category: "technical", status: "passed", lastTested: "2026-02-07", owner: "K. Okafor", description: "Implement technical security measures to guard against unauthorized access to ePHI transmitted over networks." },
  { id: "PCI-1.1", title: "Firewall Configuration Standards", framework: "PCI DSS", category: "technical", status: "passed", lastTested: "2026-02-06", owner: "K. Okafor", description: "Establish and implement firewall and router configuration standards including a formal process for changes." },
  { id: "PCI-3.4", title: "Render PAN Unreadable", framework: "PCI DSS", category: "technical", status: "failed", lastTested: "2026-01-25", owner: "A. Novak", description: "Render PAN unreadable anywhere it is stored using strong cryptography, truncation, or tokenization." },
  { id: "PCI-6.5", title: "Secure Development Practices", framework: "PCI DSS", category: "technical", status: "partial", lastTested: "2026-02-02", owner: "R. Patel", description: "Address common coding vulnerabilities in software-development processes including injection flaws and XSS." },
  { id: "PCI-8.2", title: "User Identification and Auth", framework: "PCI DSS", category: "technical", status: "not-tested", lastTested: "—", owner: "J. Martinez", description: "Employ at least one method to authenticate all users: password, token, biometric." },
  { id: "PCI-10.1", title: "Audit Trail Linkage", framework: "PCI DSS", category: "technical", status: "failed", lastTested: "2026-01-18", owner: "K. Okafor", description: "Implement audit trails to link all access to system components to each individual user." },
];

const evidenceItems: EvidenceItem[] = [
  { filename: "soc2-penetration-test-2026.pdf", controlId: "CC6.1", uploadDate: "2026-01-15", expiryDate: "2027-01-15", status: "valid", size: "4.2 MB" },
  { filename: "gdpr-dpia-customer-portal.docx", controlId: "GDPR-Art25", uploadDate: "2026-01-20", expiryDate: "2026-07-20", status: "valid", size: "1.8 MB" },
  { filename: "iso27001-asset-inventory-q4.xlsx", controlId: "ISO-A.8.1.1", uploadDate: "2025-10-01", expiryDate: "2026-03-01", status: "expiring", size: "2.1 MB" },
  { filename: "hipaa-risk-assessment-2025.pdf", controlId: "HIPAA-164.312a", uploadDate: "2025-06-15", expiryDate: "2026-01-15", status: "expired", size: "5.7 MB" },
  { filename: "pci-network-scan-feb2026.xml", controlId: "PCI-1.1", uploadDate: "2026-02-10", expiryDate: "2026-05-10", status: "valid", size: "890 KB" },
  { filename: "mfa-enrollment-report.csv", controlId: "CC6.2", uploadDate: "2026-02-08", expiryDate: "2026-08-08", status: "valid", size: "340 KB" },
  { filename: "access-review-jan2026.pdf", controlId: "ISO-A.9.1.1", uploadDate: "2026-01-31", expiryDate: "2026-04-30", status: "valid", size: "1.2 MB" },
  { filename: "encryption-key-rotation-log.csv", controlId: "PCI-3.4", uploadDate: "2025-11-20", expiryDate: "2026-02-28", status: "expiring", size: "156 KB" },
  { filename: "incident-response-plan-v3.pdf", controlId: "GDPR-Art33", uploadDate: "2025-09-01", expiryDate: "2026-03-01", status: "expiring", size: "3.4 MB" },
  { filename: "change-mgmt-procedure-v2.1.docx", controlId: "CC8.1", uploadDate: "2025-12-15", expiryDate: "2026-06-15", status: "valid", size: "780 KB" },
  { filename: "vulnerability-scan-q1-2026.html", controlId: "PCI-6.5", uploadDate: "2026-02-01", expiryDate: "2026-05-01", status: "valid", size: "2.9 MB" },
  { filename: "hipaa-training-completion.xlsx", controlId: "HIPAA-164.312c", uploadDate: "2025-08-10", expiryDate: "2026-02-10", status: "expired", size: "420 KB" },
  { filename: "data-retention-policy-v4.pdf", controlId: "GDPR-Art5", uploadDate: "2026-01-05", expiryDate: "2027-01-05", status: "valid", size: "1.1 MB" },
];

const risks: Risk[] = [
  { name: "Unencrypted PAN storage in legacy DB", framework: "PCI DSS", severity: "critical", likelihood: 4, impact: 5, mitigations: "Migration to tokenized storage — 60% complete", owner: "A. Novak" },
  { name: "Incomplete audit trail for cardholder data", framework: "PCI DSS", severity: "high", likelihood: 3, impact: 5, mitigations: "SIEM integration in progress — ETA Mar 2026", owner: "K. Okafor" },
  { name: "Delayed breach notification process", framework: "GDPR", severity: "high", likelihood: 2, impact: 5, mitigations: "Automated incident workflow under development", owner: "L. Schmidt" },
  { name: "Expired HIPAA risk assessment", framework: "HIPAA", severity: "medium", likelihood: 3, impact: 3, mitigations: "Reassessment scheduled for Q1 2026", owner: "S. Chen" },
  { name: "Asset inventory gaps for cloud resources", framework: "ISO 27001", severity: "medium", likelihood: 3, impact: 4, mitigations: "Cloud asset discovery tool being deployed", owner: "R. Patel" },
  { name: "Third-party vendor access not reviewed", framework: "SOC 2 Type II", severity: "high", likelihood: 3, impact: 4, mitigations: "Vendor access review cycle initiated", owner: "J. Martinez" },
  { name: "Insufficient event log retention", framework: "ISO 27001", severity: "medium", likelihood: 2, impact: 3, mitigations: "Log retention policy update in review", owner: "K. Okafor" },
  { name: "Data erasure requests backlog", framework: "GDPR", severity: "low", likelihood: 2, impact: 2, mitigations: "Automated deletion pipeline — 80% complete", owner: "L. Schmidt" },
  { name: "Change management bypass incidents", framework: "SOC 2 Type II", severity: "high", likelihood: 3, impact: 4, mitigations: "Enforced PR gating rules being rolled out", owner: "R. Patel" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

function statusBadge(status: FrameworkStatus): React.ReactNode {
  const map: Record<FrameworkStatus, { label: string; cls: string }> = {
    compliant: { label: "Compliant", cls: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
    "in-progress": { label: "In Progress", cls: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
    "non-compliant": { label: "Non-Compliant", cls: "bg-rose-400/15 text-rose-400 border-rose-400/30" },
  };
  const { label, cls } = map[status];
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", cls)}>{label}</span>;
}

function controlStatusBadge(status: ControlStatus): React.ReactNode {
  const map: Record<ControlStatus, { label: string; emoji: string; cls: string }> = {
    passed: { label: "Passed", emoji: "✓", cls: "text-emerald-400" },
    failed: { label: "Failed", emoji: "✕", cls: "text-rose-400" },
    partial: { label: "Partial", emoji: "◐", cls: "text-amber-400" },
    "not-tested": { label: "Not Tested", emoji: "—", cls: "text-fg-muted" },
  };
  const { label, emoji, cls } = map[status];
  return <span className={cn("flex items-center gap-1.5 text-sm font-medium", cls)}><span>{emoji}</span>{label}</span>;
}

function categoryBadge(category: ControlCategory): React.ReactNode {
  const map: Record<ControlCategory, { cls: string }> = {
    technical: { cls: "bg-indigo-500/15 text-indigo-400 border-indigo-500/30" },
    administrative: { cls: "bg-violet-500/15 text-violet-400 border-violet-500/30" },
    physical: { cls: "bg-teal-500/15 text-teal-400 border-teal-500/30" },
  };
  const { cls } = map[category];
  return <span className={cn("text-xs px-2 py-0.5 rounded border capitalize", cls)}>{category}</span>;
}

function evidenceStatusBadge(status: EvidenceStatus): React.ReactNode {
  const map: Record<EvidenceStatus, { label: string; cls: string }> = {
    valid: { label: "Valid", cls: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30" },
    expiring: { label: "Expiring", cls: "bg-amber-400/15 text-amber-400 border-amber-400/30" },
    expired: { label: "Expired", cls: "bg-rose-400/15 text-rose-400 border-rose-400/30" },
  };
  const { label, cls } = map[status];
  return <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border", cls)}>{label}</span>;
}

function severityBadge(severity: RiskSeverity): React.ReactNode {
  const map: Record<RiskSeverity, { cls: string }> = {
    critical: { cls: "bg-rose-500/20 text-rose-400 border-rose-500/30" },
    high: { cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
    medium: { cls: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
    low: { cls: "bg-surface-3/40 text-fg-secondary border-tok-border" },
  };
  const { cls } = map[severity];
  return <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border uppercase", cls)}>{severity}</span>;
}

function scoreColor(score: number): string {
  if (score >= 90) {return "text-emerald-400";}
  if (score >= 75) {return "text-amber-400";}
  return "text-rose-400";
}

function scoreRingColor(score: number): string {
  if (score >= 90) {return "#34d399";}
  if (score >= 75) {return "#fbbf24";}
  return "#fb7185";
}

// ── Circular Progress ──────────────────────────────────────────────────────────

function CircularProgress({ score }: { score: number }) {
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreRingColor(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#3f3f46" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500"
        />
      </svg>
      <span className={cn("absolute text-sm font-bold", scoreColor(score))}>{score}%</span>
    </div>
  );
}

// ── Summary Stats ──────────────────────────────────────────────────────────────

function SummaryStats() {
  const totalPassed = frameworks.reduce((s, f) => s + f.controlsPassed, 0);
  const totalControls = frameworks.reduce((s, f) => s + f.controlsTotal, 0);
  const overallScore = Math.round((totalPassed / totalControls) * 100);
  const openRisks = risks.filter((r) => r.severity === "critical" || r.severity === "high").length;

  const stats = [
    { label: "Overall Compliance", value: `${overallScore}%`, accent: scoreColor(overallScore), emoji: "📊" },
    { label: "Controls Passed", value: `${totalPassed} / ${totalControls}`, accent: "text-indigo-400", emoji: "🛡" },
    { label: "Evidence Items", value: `${evidenceItems.length}`, accent: "text-violet-400", emoji: "📁" },
    { label: "Open Risks (High+)", value: `${openRisks}`, accent: "text-rose-400", emoji: "⚠" },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="bg-surface-1 border border-tok-border rounded-xl p-4 flex items-center gap-4">
          <span className="text-2xl">{s.emoji}</span>
          <div>
            <div className={cn("text-2xl font-bold", s.accent)}>{s.value}</div>
            <div className="text-xs text-fg-secondary mt-0.5">{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Framework Cards ────────────────────────────────────────────────────────────

function FrameworkCards() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
      {frameworks.map((fw) => (
        <div
          key={fw.shortName}
          className="bg-surface-1 border border-tok-border rounded-xl p-5 flex flex-col items-center gap-3"
        >
          <CircularProgress score={fw.score} />
          <div className="text-center">
            <div className="text-sm font-semibold text-fg-primary">{fw.name}</div>
            <div className="mt-1">{statusBadge(fw.status)}</div>
          </div>
          <div className="text-xs text-fg-secondary mt-auto pt-2 border-t border-tok-border w-full text-center">
            {fw.controlsPassed}/{fw.controlsTotal} controls passed
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Controls Table ─────────────────────────────────────────────────────────────

function ControlsTable() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [filterFramework, setFilterFramework] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {next.delete(id);}
      else {next.add(id);}
      return next;
    });
  };

  const uniqueFrameworks = Array.from(new Set(controls.map((c) => c.framework)));

  const filtered = controls.filter((c) => {
    if (filterFramework !== "all" && c.framework !== filterFramework) {return false;}
    if (filterStatus !== "all" && c.status !== filterStatus) {return false;}
    return true;
  });

  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={filterFramework}
          onChange={(e) => setFilterFramework(e.target.value)}
          className="bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Frameworks</option>
          {uniqueFrameworks.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="bg-surface-2 border border-tok-border text-fg-primary text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="all">All Statuses</option>
          <option value="passed">Passed</option>
          <option value="failed">Failed</option>
          <option value="partial">Partial</option>
          <option value="not-tested">Not Tested</option>
        </select>
        <span className="text-xs text-fg-muted self-center ml-auto">{filtered.length} control{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-[40px_100px_1fr_140px_110px_100px_110px_100px] text-xs text-fg-muted font-medium px-4 py-2.5 border-b border-tok-border bg-surface-1/80">
          <div />
          <div>ID</div>
          <div>Title</div>
          <div>Framework</div>
          <div>Category</div>
          <div>Status</div>
          <div>Last Tested</div>
          <div>Owner</div>
        </div>

        {filtered.map((ctrl) => {
          const isOpen = expanded.has(ctrl.id);
          return (
            <div key={ctrl.id} className="border-b border-tok-border/60 last:border-b-0">
              <button
                onClick={() => toggle(ctrl.id)}
                className="w-full grid grid-cols-[40px_100px_1fr_140px_110px_100px_110px_100px] items-center px-4 py-3 text-sm hover:bg-surface-2/40 transition-colors text-left"
              >
                <span className="text-fg-muted text-xs">{isOpen ? "▾" : "▸"}</span>
                <span className="text-indigo-400 font-mono text-xs">{ctrl.id}</span>
                <span className="text-fg-primary truncate pr-2">{ctrl.title}</span>
                <span className="text-fg-secondary text-xs truncate">{ctrl.framework}</span>
                <span>{categoryBadge(ctrl.category)}</span>
                <span>{controlStatusBadge(ctrl.status)}</span>
                <span className="text-fg-muted text-xs font-mono">{ctrl.lastTested}</span>
                <span className="text-fg-secondary text-xs">{ctrl.owner}</span>
              </button>
              {isOpen && (
                <div className="px-12 pb-4 text-sm text-fg-secondary bg-surface-2/20">
                  {ctrl.description}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <ContextualEmptyState
            icon={ShieldCheck}
            title="No controls match"
            description="Adjust the framework or status filter to see compliance controls."
            size="sm"
          />
        )}
      </div>
    </div>
  );
}

// ── Evidence Locker ────────────────────────────────────────────────────────────

function EvidenceLocker() {
  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_110px_110px_110px_90px_90px] text-xs text-fg-muted font-medium px-4 py-2.5 border-b border-tok-border bg-surface-1/80">
        <div>Filename</div>
        <div>Control</div>
        <div>Uploaded</div>
        <div>Expires</div>
        <div>Size</div>
        <div>Status</div>
      </div>
      {evidenceItems.map((ev) => (
        <div
          key={ev.filename}
          className="grid grid-cols-[1fr_110px_110px_110px_90px_90px] items-center px-4 py-3 text-sm border-b border-tok-border/60 last:border-b-0 hover:bg-surface-2/30 transition-colors"
        >
          <div className="flex items-center gap-2 text-fg-primary truncate">
            <span className="text-fg-muted">📄</span>
            <span className="truncate">{ev.filename}</span>
          </div>
          <span className="text-indigo-400 font-mono text-xs">{ev.controlId}</span>
          <span className="text-fg-secondary text-xs font-mono">{ev.uploadDate}</span>
          <span className={cn("text-xs font-mono", ev.status === "expired" ? "text-rose-400" : ev.status === "expiring" ? "text-amber-400" : "text-fg-secondary")}>{ev.expiryDate}</span>
          <span className="text-fg-muted text-xs">{ev.size}</span>
          <span>{evidenceStatusBadge(ev.status)}</span>
        </div>
      ))}
    </div>
  );
}

// ── Risk Register ──────────────────────────────────────────────────────────────

function RiskRegister() {
  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
      <div className="grid grid-cols-[1fr_130px_90px_80px_80px_1fr_100px] text-xs text-fg-muted font-medium px-4 py-2.5 border-b border-tok-border bg-surface-1/80">
        <div>Risk</div>
        <div>Framework</div>
        <div>Severity</div>
        <div>Likelihood</div>
        <div>Impact</div>
        <div>Mitigations</div>
        <div>Owner</div>
      </div>
      {risks.map((risk, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_130px_90px_80px_80px_1fr_100px] items-center px-4 py-3 text-sm border-b border-tok-border/60 last:border-b-0 hover:bg-surface-2/30 transition-colors"
        >
          <span className="text-fg-primary pr-2">{risk.name}</span>
          <span className="text-fg-secondary text-xs truncate">{risk.framework}</span>
          <span>{severityBadge(risk.severity)}</span>
          <span className="text-center">
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <span key={j} className={cn("w-1.5 h-3 rounded-sm", j < risk.likelihood ? "bg-amber-400" : "bg-surface-3")} />
              ))}
            </span>
          </span>
          <span className="text-center">
            <span className="inline-flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, j) => (
                <span key={j} className={cn("w-1.5 h-3 rounded-sm", j < risk.impact ? "bg-rose-400" : "bg-surface-3")} />
              ))}
            </span>
          </span>
          <span className="text-fg-secondary text-xs pr-2">{risk.mitigations}</span>
          <span className="text-fg-secondary text-xs">{risk.owner}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ComplianceDashboard() {
  const [activeTab, setActiveTab] = useState<TabKey>("controls");

  const tabs: { key: TabKey; label: string; emoji: string }[] = [
    { key: "controls", label: "Controls", emoji: "🛡" },
    { key: "evidence", label: "Evidence Locker", emoji: "📁" },
    { key: "risks", label: "Risk Register", emoji: "⚠" },
  ];

  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 sm:mb-8">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Compliance Dashboard</h1>
          <p className="text-sm text-fg-secondary mt-1">Governance, Risk & Compliance — Unified View</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-muted">Last sync: Feb 22, 2026 02:45 MST</span>
          <button className="bg-indigo-500 hover:bg-indigo-600 text-fg-primary text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            Export Report
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <SummaryStats />

      {/* Framework Cards */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-fg-primary mb-4">Frameworks</h2>
        <FrameworkCards />
      </div>

      {/* Tabs */}
      <div className="mt-10">
        <div className="flex items-center gap-1 border-b border-tok-border mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px",
                activeTab === tab.key
                  ? "border-indigo-500 text-fg-primary"
                  : "border-transparent text-fg-secondary hover:text-fg-primary"
              )}
            >
              <span>{tab.emoji}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "controls" && <ControlsTable />}
        {activeTab === "evidence" && <EvidenceLocker />}
        {activeTab === "risks" && <RiskRegister />}
      </div>
    </div>
  );
}

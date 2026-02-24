import React, { useState } from "react";
import { cn } from "../lib/utils";

type MaskingStrategy = "full-redact" | "partial-mask" | "tokenize" | "hash" | "pseudonymize" | "encrypt";
type DataSensitivity = "pii" | "phi" | "pci" | "financial" | "confidential" | "internal";
type RuleStatus = "active" | "inactive" | "draft";
type ScanStatus = "completed" | "running" | "failed" | "scheduled";
type FieldType = "email" | "ssn" | "phone" | "credit-card" | "dob" | "name" | "address" | "ip" | "custom";

interface MaskingExample {
  original: string;
  masked: string;
}

interface DataField {
  name: string;
  type: FieldType;
  table: string;
  database: string;
  rowCount: number;
  sensitivity: DataSensitivity;
}

interface MaskingRule {
  id: string;
  name: string;
  strategy: MaskingStrategy;
  status: RuleStatus;
  sensitivity: DataSensitivity;
  fieldTypes: FieldType[];
  appliedTo: DataField[];
  environments: string[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  description: string;
  example: MaskingExample;
  executionCount: number;
  lastExecuted: string | null;
}

interface ScanJob {
  id: string;
  name: string;
  databases: string[];
  status: ScanStatus;
  startedAt: string;
  completedAt: string | null;
  fieldsDiscovered: number;
  fieldsMatched: number;
  coverage: number;
  rulesApplied: number;
}

interface PolicyViolation {
  id: string;
  fieldName: string;
  database: string;
  table: string;
  sensitivity: DataSensitivity;
  environment: string;
  discoveredAt: string;
  ruleId: string | null;
  status: "open" | "remediated" | "accepted";
}

const RULES: MaskingRule[] = [
  {
    id: "r1", name: "Email Masking", strategy: "partial-mask", status: "active",
    sensitivity: "pii", fieldTypes: ["email"], environments: ["production", "staging"],
    appliedTo: [
      { name: "email", type: "email", table: "users", database: "app_db", rowCount: 245000, sensitivity: "pii" },
      { name: "contact_email", type: "email", table: "contacts", database: "crm_db", rowCount: 18200, sensitivity: "pii" },
    ],
    createdBy: "admin@co.com", createdAt: "2025-01-15", updatedAt: "2026-01-10",
    description: "Partially masks email addresses, preserving domain for analytics. E.g. jo**@example.com",
    example: { original: "john.smith@example.com", masked: "jo**@example.com" },
    executionCount: 1482000, lastExecuted: "2026-02-22 06:00",
  },
  {
    id: "r2", name: "SSN Full Redaction", strategy: "full-redact", status: "active",
    sensitivity: "pii", fieldTypes: ["ssn"], environments: ["production", "staging", "development"],
    appliedTo: [
      { name: "ssn", type: "ssn", table: "employees", database: "hr_db", rowCount: 1240, sensitivity: "pii" },
    ],
    createdBy: "compliance@co.com", createdAt: "2024-08-01", updatedAt: "2025-09-20",
    description: "Completely redacts Social Security Numbers to *** in all environments.",
    example: { original: "123-45-6789", masked: "***-**-****" },
    executionCount: 620000, lastExecuted: "2026-02-22 06:00",
  },
  {
    id: "r3", name: "Credit Card Tokenization", strategy: "tokenize", status: "active",
    sensitivity: "pci", fieldTypes: ["credit-card"], environments: ["production"],
    appliedTo: [
      { name: "card_number", type: "credit-card", table: "payments", database: "billing_db", rowCount: 89400, sensitivity: "pci" },
      { name: "billing_card", type: "credit-card", table: "subscriptions", database: "billing_db", rowCount: 42100, sensitivity: "pci" },
    ],
    createdBy: "security@co.com", createdAt: "2024-06-01", updatedAt: "2026-02-01",
    description: "Replaces credit card numbers with irreversible tokens. Last 4 digits preserved.",
    example: { original: "4111-1111-1111-1234", masked: "tok_****-****-****-1234" },
    executionCount: 3940000, lastExecuted: "2026-02-22 04:00",
  },
  {
    id: "r4", name: "Phone Number Masking", strategy: "partial-mask", status: "active",
    sensitivity: "pii", fieldTypes: ["phone"], environments: ["production", "staging"],
    appliedTo: [
      { name: "phone", type: "phone", table: "users", database: "app_db", rowCount: 220000, sensitivity: "pii" },
      { name: "mobile", type: "phone", table: "contacts", database: "crm_db", rowCount: 15600, sensitivity: "pii" },
    ],
    createdBy: "admin@co.com", createdAt: "2025-03-01", updatedAt: "2025-11-01",
    description: "Masks middle digits of phone numbers, preserving country code and last 2 digits.",
    example: { original: "+1 (555) 867-5309", masked: "+1 (***) ***-09" },
    executionCount: 890000, lastExecuted: "2026-02-22 06:00",
  },
  {
    id: "r5", name: "Date of Birth Pseudonymize", strategy: "pseudonymize", status: "active",
    sensitivity: "pii", fieldTypes: ["dob"], environments: ["production", "staging"],
    appliedTo: [
      { name: "date_of_birth", type: "dob", table: "patients", database: "health_db", rowCount: 54200, sensitivity: "phi" },
    ],
    createdBy: "compliance@co.com", createdAt: "2025-05-01", updatedAt: "2025-10-01",
    description: "Shifts date of birth by a deterministic random offset per patient, preserving age range for analytics.",
    example: { original: "1985-07-14", masked: "1985-07-21" },
    executionCount: 218000, lastExecuted: "2026-02-22 05:00",
  },
  {
    id: "r6", name: "IP Address Hashing", strategy: "hash", status: "draft",
    sensitivity: "pii", fieldTypes: ["ip"], environments: [],
    appliedTo: [],
    createdBy: "security@co.com", createdAt: "2026-02-10", updatedAt: "2026-02-10",
    description: "SHA-256 hash of IP addresses for analytics without exposing user location.",
    example: { original: "192.168.1.100", masked: "sha256:a4b2c3..." },
    executionCount: 0, lastExecuted: null,
  },
];

const SCAN_JOBS: ScanJob[] = [
  { id: "s1", name: "Full Discovery Scan — Feb 2026", databases: ["app_db", "crm_db", "billing_db", "hr_db", "health_db"], status: "completed", startedAt: "2026-02-22 02:00", completedAt: "2026-02-22 04:32", fieldsDiscovered: 1840, fieldsMatched: 412, coverage: 98.4, rulesApplied: 5 },
  { id: "s2", name: "Billing DB Scan", databases: ["billing_db"], status: "completed", startedAt: "2026-02-15 03:00", completedAt: "2026-02-15 03:45", fieldsDiscovered: 284, fieldsMatched: 89, coverage: 100, rulesApplied: 1 },
  { id: "s3", name: "HR Database Scan", databases: ["hr_db"], status: "failed", startedAt: "2026-02-10 06:00", completedAt: "2026-02-10 06:12", fieldsDiscovered: 0, fieldsMatched: 0, coverage: 0, rulesApplied: 0 },
  { id: "s4", name: "Weekly Automated Scan", databases: ["app_db", "crm_db"], status: "scheduled", startedAt: "2026-03-01 02:00", completedAt: null, fieldsDiscovered: 0, fieldsMatched: 0, coverage: 0, rulesApplied: 0 },
];

const VIOLATIONS: PolicyViolation[] = [
  { id: "v1", fieldName: "ip_address", database: "analytics_db", table: "events", sensitivity: "pii", environment: "production", discoveredAt: "2026-02-22 04:32", ruleId: null, status: "open" },
  { id: "v2", fieldName: "raw_email", database: "logs_db", table: "email_log", sensitivity: "pii", environment: "production", discoveredAt: "2026-02-22 04:32", ruleId: "r1", status: "open" },
  { id: "v3", fieldName: "patient_name", database: "health_db", table: "appointments", sensitivity: "phi", environment: "staging", discoveredAt: "2026-02-15 03:45", ruleId: null, status: "accepted" },
  { id: "v4", fieldName: "card_cvv", database: "billing_db", table: "payment_methods", sensitivity: "pci", environment: "production", discoveredAt: "2026-01-20 10:00", ruleId: null, status: "remediated" },
];

function strategyBadge(s: MaskingStrategy) {
  const map: Record<MaskingStrategy, string> = {
    "full-redact": "bg-rose-500/10 text-rose-400",
    "partial-mask": "bg-amber-500/10 text-amber-400",
    "tokenize": "bg-indigo-500/10 text-indigo-400",
    "hash": "bg-purple-500/10 text-purple-400",
    "pseudonymize": "bg-blue-500/10 text-blue-400",
    "encrypt": "bg-emerald-500/10 text-emerald-400",
  };
  return map[s];
}
function sensitivityBadge(s: DataSensitivity) {
  const map: Record<DataSensitivity, string> = {
    pii: "bg-rose-500/10 text-rose-400",
    phi: "bg-purple-500/10 text-purple-400",
    pci: "bg-orange-500/10 text-orange-400",
    financial: "bg-amber-500/10 text-amber-400",
    confidential: "bg-indigo-500/10 text-indigo-400",
    internal: "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)]",
  };
  return map[s];
}
function statusBadge(s: RuleStatus) {
  if (s === "active") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "inactive") {return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";}
  return "bg-amber-400/10 text-amber-400";
}
function scanStatusBadge(s: ScanStatus) {
  if (s === "completed") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "running") {return "bg-indigo-400/10 text-indigo-400";}
  if (s === "failed") {return "bg-rose-400/10 text-rose-400";}
  return "bg-[var(--color-surface-3)]/10 text-[var(--color-text-secondary)]";
}
function violationStatusBadge(s: PolicyViolation["status"]) {
  if (s === "open") {return "bg-rose-400/10 text-rose-400";}
  if (s === "remediated") {return "bg-emerald-400/10 text-emerald-400";}
  return "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]";
}

export default function DataMaskingManager() {
  const [tab, setTab] = useState<"rules" | "scans" | "violations" | "coverage">("rules");
  const [selectedRule, setSelectedRule] = useState<MaskingRule | null>(null);
  const [filterStatus, setFilterStatus] = useState<RuleStatus | "all">("all");
  const [filterSensitivity, setFilterSensitivity] = useState<DataSensitivity | "all">("all");

  const filteredRules = RULES.filter(r => {
    if (filterStatus !== "all" && r.status !== filterStatus) {return false;}
    if (filterSensitivity !== "all" && r.sensitivity !== filterSensitivity) {return false;}
    return true;
  });

  const activeRules = RULES.filter(r => r.status === "active").length;
  const totalFields = RULES.reduce((s, r) => s + r.appliedTo.length, 0);
  const totalExecs = RULES.reduce((s, r) => s + r.executionCount, 0);
  const openViolations = VIOLATIONS.filter(v => v.status === "open").length;

  const tabs: { id: typeof tab; label: string }[] = [
    { id: "rules", label: `Rules (${RULES.length})` },
    { id: "scans", label: "Discovery Scans" },
    { id: "violations", label: `Violations (${openViolations} open)` },
    { id: "coverage", label: "Coverage" },
  ];

  const dbCoverage = [
    { name: "app_db", covered: 98, sensitive: 245, total: 1840 },
    { name: "billing_db", covered: 100, sensitive: 131, total: 284 },
    { name: "hr_db", covered: 0, sensitive: 24, total: 180 },
    { name: "health_db", covered: 95, sensitive: 88, total: 320 },
    { name: "crm_db", covered: 92, sensitive: 64, total: 440 },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)]">Data Masking Manager</h1>
          <p className="text-[var(--color-text-secondary)] text-sm mt-1">Configure and enforce data masking policies across all environments</p>
        </div>
        <div className="flex gap-2">
          <button className="px-3 py-1.5 text-sm bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] transition-colors">Run Scan</button>
          <button className="px-3 py-1.5 text-sm bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[var(--color-text-primary)] transition-colors">+ New Rule</button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Active Rules</div>
          <div className="text-2xl font-bold text-emerald-400">{activeRules}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Protected Fields</div>
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">{totalFields}</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Total Executions</div>
          <div className="text-2xl font-bold text-indigo-400">{(totalExecs / 1000000).toFixed(1)}M</div>
        </div>
        <div className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)]">
          <div className="text-xs text-[var(--color-text-muted)] mb-1">Open Violations</div>
          <div className={cn("text-2xl font-bold", openViolations > 0 ? "text-rose-400" : "text-emerald-400")}>{openViolations}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSelectedRule(null); }}
            className={cn("px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px", tab === t.id ? "border-indigo-500 text-[var(--color-text-primary)]" : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Rules list */}
      {tab === "rules" && !selectedRule && (
        <div>
          <div className="flex flex-wrap gap-3 mb-4">
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as RuleStatus | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="draft">Draft</option>
            </select>
            <select value={filterSensitivity} onChange={e => setFilterSensitivity(e.target.value as DataSensitivity | "all")} className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)]">
              <option value="all">All Sensitivity</option>
              <option value="pii">PII</option>
              <option value="phi">PHI</option>
              <option value="pci">PCI</option>
              <option value="financial">Financial</option>
            </select>
          </div>

          <div className="space-y-3">
            {filteredRules.map(rule => (
              <div
                key={rule.id}
                onClick={() => setSelectedRule(rule)}
                className="bg-[var(--color-surface-1)] rounded-xl p-4 border border-[var(--color-border)] hover:border-[var(--color-surface-3)] cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-semibold text-[var(--color-text-primary)]">{rule.name}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", statusBadge(rule.status))}>{rule.status}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", sensitivityBadge(rule.sensitivity))}>{rule.sensitivity.toUpperCase()}</span>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", strategyBadge(rule.strategy))}>{rule.strategy.replace("-", " ")}</span>
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)]">{rule.description}</div>
                  </div>
                  <div className="text-right text-xs text-[var(--color-text-muted)] flex-shrink-0 ml-4">
                    <div>{rule.appliedTo.length} field{rule.appliedTo.length !== 1 ? "s" : ""}</div>
                    <div>{rule.executionCount.toLocaleString()} execs</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 p-2 bg-[var(--color-surface-2)] rounded-lg text-xs">
                  <span className="text-[var(--color-text-muted)]">Example:</span>
                  <span className="text-[var(--color-text-secondary)] font-mono">{rule.example.original}</span>
                  <span className="text-[var(--color-text-muted)]">→</span>
                  <span className="text-emerald-400 font-mono">{rule.example.masked}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rule Detail */}
      {tab === "rules" && selectedRule && (
        <div>
          <button onClick={() => setSelectedRule(null)} className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 transition-colors">
            ← Back to rules
          </button>

          <div className="grid md:grid-cols-2 gap-5 mb-5">
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{selectedRule.name}</h2>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBadge(selectedRule.status))}>{selectedRule.status}</span>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", sensitivityBadge(selectedRule.sensitivity))}>{selectedRule.sensitivity.toUpperCase()}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", strategyBadge(selectedRule.strategy))}>{selectedRule.strategy.replace("-", " ")}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-xs bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] rounded-lg text-[var(--color-text-primary)] transition-colors">Edit</button>
                  {selectedRule.status !== "active" && <button className="px-3 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 rounded-lg text-[var(--color-text-primary)] transition-colors">Activate</button>}
                </div>
              </div>
              <p className="text-sm text-[var(--color-text-primary)] mb-4">{selectedRule.description}</p>
              <div className="space-y-2 text-xs">
                {[
                  { label: "Created by", value: selectedRule.createdBy },
                  { label: "Created", value: selectedRule.createdAt },
                  { label: "Last updated", value: selectedRule.updatedAt },
                  { label: "Last executed", value: selectedRule.lastExecuted ?? "Never" },
                  { label: "Total executions", value: selectedRule.executionCount.toLocaleString() },
                  { label: "Environments", value: selectedRule.environments.join(", ") || "None" },
                ].map(row => (
                  <div key={row.label} className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">{row.label}</span>
                    <span className="text-[var(--color-text-primary)]">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Masking Example</h3>
              <div className="space-y-4 mb-5">
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Original (sensitive)</div>
                  <div className="bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2 font-mono text-sm text-rose-300">{selectedRule.example.original}</div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-[var(--color-text-muted)] text-lg">↓</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Masked output</div>
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2 font-mono text-sm text-emerald-300">{selectedRule.example.masked}</div>
                </div>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">Strategy: <span className="text-[var(--color-text-primary)] capitalize">{selectedRule.strategy.replace("-", " ")}</span></div>
              <div className="text-xs text-[var(--color-text-muted)] mt-1">Field types: <span className="text-[var(--color-text-primary)]">{selectedRule.fieldTypes.join(", ")}</span></div>
            </div>
          </div>

          {selectedRule.appliedTo.length > 0 && (
            <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
              <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Applied Fields ({selectedRule.appliedTo.length})</h3>
              <div className="space-y-2">
                {selectedRule.appliedTo.map((field, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-[var(--color-surface-2)] rounded-lg">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm text-[var(--color-text-primary)]">{field.database}.{field.table}.{field.name}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full", sensitivityBadge(field.sensitivity))}>{field.sensitivity.toUpperCase()}</span>
                      </div>
                    </div>
                    <div className="text-sm text-[var(--color-text-secondary)]">{field.rowCount.toLocaleString()} rows</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scan Jobs */}
      {tab === "scans" && (
        <div className="space-y-3">
          {SCAN_JOBS.map(job => (
            <div key={job.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", job.status === "failed" ? "border-rose-500/30" : "border-[var(--color-border)]")}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-[var(--color-text-primary)]">{job.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", scanStatusBadge(job.status))}>{job.status}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">Databases: {job.databases.join(", ")}</div>
                </div>
                <div className="text-right text-xs text-[var(--color-text-muted)]">
                  <div>Started: {job.startedAt}</div>
                  {job.completedAt && <div>Completed: {job.completedAt}</div>}
                </div>
              </div>
              {job.status === "completed" && (
                <div className="grid grid-cols-4 gap-3 text-xs mt-3 pt-3 border-t border-[var(--color-border)]">
                  <div className="text-center">
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">{job.fieldsDiscovered.toLocaleString()}</div>
                    <div className="text-[var(--color-text-muted)]">fields found</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-rose-400">{job.fieldsMatched.toLocaleString()}</div>
                    <div className="text-[var(--color-text-muted)]">sensitive</div>
                  </div>
                  <div className="text-center">
                    <div className={cn("text-lg font-bold", job.coverage >= 95 ? "text-emerald-400" : job.coverage >= 80 ? "text-amber-400" : "text-rose-400")}>{job.coverage}%</div>
                    <div className="text-[var(--color-text-muted)]">coverage</div>
                  </div>
                  <div className="text-center">
                    <div className="text-lg font-bold text-indigo-400">{job.rulesApplied}</div>
                    <div className="text-[var(--color-text-muted)]">rules applied</div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Violations */}
      {tab === "violations" && (
        <div className="space-y-3">
          {VIOLATIONS.map(v => (
            <div key={v.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-4 border", v.status === "open" ? "border-rose-500/30" : "border-[var(--color-border)]")}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-sm text-[var(--color-text-primary)]">{v.database}.{v.table}.{v.fieldName}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", sensitivityBadge(v.sensitivity))}>{v.sensitivity.toUpperCase()}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", violationStatusBadge(v.status))}>{v.status}</span>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">Environment: {v.environment} · Discovered: {v.discoveredAt}</div>
                  {v.ruleId && <div className="text-xs text-indigo-400 mt-0.5">Rule applicable: {v.ruleId}</div>}
                  {!v.ruleId && <div className="text-xs text-amber-400 mt-0.5">No masking rule assigned</div>}
                </div>
                {v.status === "open" && (
                  <div className="flex gap-2">
                    <button className="px-2 py-1 text-xs bg-indigo-600 hover:bg-indigo-500 rounded text-[var(--color-text-primary)] transition-colors">Apply Rule</button>
                    <button className="px-2 py-1 text-xs bg-[var(--color-surface-3)] hover:bg-[var(--color-surface-3)] rounded text-[var(--color-text-primary)] transition-colors">Accept</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Coverage */}
      {tab === "coverage" && (
        <div className="space-y-5">
          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Masking Coverage by Database</h3>
            <div className="space-y-4">
              {dbCoverage.map(db => (
                <div key={db.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[var(--color-text-primary)]">{db.name}</span>
                      <span className="text-[var(--color-text-muted)]">{db.sensitive} sensitive / {db.total} total fields</span>
                    </div>
                    <span className={cn(db.covered === 100 ? "text-emerald-400" : db.covered >= 90 ? "text-amber-400" : db.covered === 0 ? "text-rose-400" : "text-amber-400")}>{db.covered}%</span>
                  </div>
                  <div className="h-3 bg-[var(--color-surface-3)] rounded-full overflow-hidden">
                    <div
                      className={cn("h-full rounded-full", db.covered === 100 ? "bg-emerald-500" : db.covered >= 80 ? "bg-amber-500" : db.covered === 0 ? "bg-rose-500" : "bg-amber-500")}
                      style={{ width: `${db.covered}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)]">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Sensitivity Distribution</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(["pii", "phi", "pci", "financial", "confidential", "internal"] as DataSensitivity[]).map(s => {
                const count = RULES.filter(r => r.sensitivity === s).length;
                return (
                  <div key={s} className="bg-[var(--color-surface-2)] rounded-lg p-3 text-center">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full", sensitivityBadge(s))}>{s.toUpperCase()}</span>
                    <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-2">{count}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">rules</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

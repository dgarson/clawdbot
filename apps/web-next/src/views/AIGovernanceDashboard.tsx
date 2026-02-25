import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { ShieldAlert } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

type RiskLevel = "critical" | "high" | "medium" | "low";
type ModelStatus = "approved" | "pending" | "rejected" | "deprecated" | "review";
type PolicyStatus = "active" | "draft" | "archived";
type IncidentSeverity = "critical" | "high" | "medium" | "low";
type IncidentState = "open" | "investigating" | "resolved";
type BiasMetric = "demographic_parity" | "equalized_odds" | "calibration" | "predictive_parity";

interface ModelCard {
  id: string;
  name: string;
  version: string;
  provider: string;
  useCase: string;
  riskLevel: RiskLevel;
  status: ModelStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  deployedAt: string | null;
  biasScores: Record<BiasMetric, number>;
  explainabilityScore: number;
  driftScore: number;
  lastAudited: string | null;
  dataSources: string[];
  notes: string;
}

interface GovernancePolicy {
  id: string;
  name: string;
  category: string;
  status: PolicyStatus;
  version: string;
  appliesTo: string[];
  lastReviewed: string;
  nextReview: string;
  owner: string;
  description: string;
}

interface GovernanceIncident {
  id: string;
  title: string;
  modelId: string;
  modelName: string;
  severity: IncidentSeverity;
  state: IncidentState;
  reportedAt: string;
  resolvedAt: string | null;
  description: string;
  remediationSteps: string[];
}

interface AuditEntry {
  id: string;
  modelId: string;
  modelName: string;
  auditType: string;
  result: "pass" | "fail" | "partial";
  score: number;
  auditor: string;
  date: string;
  findings: string;
}

const MODELS: ModelCard[] = [
  {
    id: "m1",
    name: "LoanApprovalModel",
    version: "2.1.4",
    provider: "Internal",
    useCase: "Credit decisioning",
    riskLevel: "critical",
    status: "approved",
    approvedBy: "AI Ethics Committee",
    approvedAt: "2026-01-15",
    deployedAt: "2026-01-20",
    biasScores: { demographic_parity: 0.92, equalized_odds: 0.88, calibration: 0.95, predictive_parity: 0.90 },
    explainabilityScore: 87,
    driftScore: 12,
    lastAudited: "2026-02-01",
    dataSources: ["Credit Bureau", "Internal CRM", "Income DB"],
    notes: "Quarterly bias audit required per CFPB guidelines",
  },
  {
    id: "m2",
    name: "ContentModerationV3",
    version: "3.0.1",
    provider: "OpenAI",
    useCase: "User content moderation",
    riskLevel: "high",
    status: "approved",
    approvedBy: "Trust & Safety Lead",
    approvedAt: "2026-02-01",
    deployedAt: "2026-02-05",
    biasScores: { demographic_parity: 0.78, equalized_odds: 0.82, calibration: 0.91, predictive_parity: 0.85 },
    explainabilityScore: 61,
    driftScore: 8,
    lastAudited: "2026-02-10",
    dataSources: ["User Posts", "Moderation Labels"],
    notes: "Low explainability score — review in progress",
  },
  {
    id: "m3",
    name: "HRResumeScreener",
    version: "1.3.0",
    provider: "Anthropic",
    useCase: "Candidate pre-screening",
    riskLevel: "critical",
    status: "pending",
    approvedBy: null,
    approvedAt: null,
    deployedAt: null,
    biasScores: { demographic_parity: 0.71, equalized_odds: 0.69, calibration: 0.88, predictive_parity: 0.74 },
    explainabilityScore: 55,
    driftScore: 0,
    lastAudited: null,
    dataSources: ["Internal HR DB", "LinkedIn API"],
    notes: "Demographic parity below threshold — blocked for approval",
  },
  {
    id: "m4",
    name: "FraudDetectionEnsemble",
    version: "4.2.0",
    provider: "Internal",
    useCase: "Real-time fraud scoring",
    riskLevel: "high",
    status: "review",
    approvedBy: "Security Team",
    approvedAt: "2025-11-01",
    deployedAt: "2025-11-10",
    biasScores: { demographic_parity: 0.94, equalized_odds: 0.93, calibration: 0.96, predictive_parity: 0.92 },
    explainabilityScore: 72,
    driftScore: 34,
    lastAudited: "2026-01-20",
    dataSources: ["Transaction DB", "Device Fingerprint", "IP Intelligence"],
    notes: "High drift score — triggering re-validation",
  },
  {
    id: "m5",
    name: "MedicalCodeSuggester",
    version: "1.0.0",
    provider: "Cohere",
    useCase: "ICD-10 coding assistance",
    riskLevel: "critical",
    status: "rejected",
    approvedBy: null,
    approvedAt: null,
    deployedAt: null,
    biasScores: { demographic_parity: 0.65, equalized_odds: 0.60, calibration: 0.70, predictive_parity: 0.68 },
    explainabilityScore: 40,
    driftScore: 0,
    lastAudited: "2026-02-18",
    dataSources: ["Clinical Notes", "Medical Records"],
    notes: "Failed clinical validation — bias scores unacceptable for healthcare",
  },
];

const POLICIES: GovernancePolicy[] = [
  {
    id: "p1",
    name: "High-Risk AI Model Approval Policy",
    category: "Model Lifecycle",
    status: "active",
    version: "2.0",
    appliesTo: ["critical", "high"],
    lastReviewed: "2026-01-10",
    nextReview: "2026-07-10",
    owner: "AI Ethics Committee",
    description: "Requires multi-stage review, bias audit, and C-level sign-off for high/critical risk models.",
  },
  {
    id: "p2",
    name: "Bias Threshold Standards",
    category: "Fairness",
    status: "active",
    version: "1.3",
    appliesTo: ["critical", "high", "medium"],
    lastReviewed: "2025-12-01",
    nextReview: "2026-06-01",
    owner: "Data Science Ethics",
    description: "Minimum demographic parity ≥ 0.80 for deployed models. Equalized odds ≥ 0.75.",
  },
  {
    id: "p3",
    name: "Model Drift Monitoring SOP",
    category: "Monitoring",
    status: "active",
    version: "1.0",
    appliesTo: ["critical", "high", "medium", "low"],
    lastReviewed: "2026-02-01",
    nextReview: "2026-08-01",
    owner: "MLOps Team",
    description: "Models exceeding drift score > 25 must enter re-validation. > 40 triggers automatic suspension.",
  },
  {
    id: "p4",
    name: "Explainability Minimum Standards",
    category: "Transparency",
    status: "draft",
    version: "0.3",
    appliesTo: ["critical"],
    lastReviewed: "2026-02-15",
    nextReview: "2026-03-01",
    owner: "Legal & Compliance",
    description: "Draft policy requiring explainability score ≥ 70 for critical models. Under review.",
  },
];

const INCIDENTS: GovernanceIncident[] = [
  {
    id: "i1",
    title: "LoanApproval demographic disparity spike",
    modelId: "m1",
    modelName: "LoanApprovalModel",
    severity: "high",
    state: "investigating",
    reportedAt: "2026-02-20T09:12:00",
    resolvedAt: null,
    description: "Equity monitoring detected 18% approval rate gap between demographic groups over 48-hour window.",
    remediationSteps: ["Freeze new approvals for affected group", "Root cause analysis in progress", "Escalated to AI Ethics Committee"],
  },
  {
    id: "i2",
    title: "FraudDetection false positive surge",
    modelId: "m4",
    modelName: "FraudDetectionEnsemble",
    severity: "medium",
    state: "resolved",
    reportedAt: "2026-02-15T14:30:00",
    resolvedAt: "2026-02-16T08:00:00",
    description: "False positive rate spiked to 8.2% during Black Friday traffic. Threshold adjustment resolved issue.",
    remediationSteps: ["Adjusted threshold from 0.85 to 0.90", "Added traffic-aware thresholds", "Post-mortem completed"],
  },
  {
    id: "i3",
    title: "ContentModeration bias detected in religious content",
    modelId: "m2",
    modelName: "ContentModerationV3",
    severity: "high",
    state: "open",
    reportedAt: "2026-02-21T11:00:00",
    resolvedAt: null,
    description: "Third-party red-team found systematic over-flagging of religious content from specific demographics.",
    remediationSteps: ["Report escalated to Trust & Safety", "Awaiting provider response"],
  },
];

const AUDITS: AuditEntry[] = [
  { id: "a1", modelId: "m1", modelName: "LoanApprovalModel", auditType: "Bias Audit", result: "pass", score: 91, auditor: "Fairness Labs", date: "2026-02-01", findings: "All metrics within policy bounds. Minor equalized odds concern flagged." },
  { id: "a2", modelId: "m2", modelName: "ContentModerationV3", auditType: "Red Team", result: "partial", score: 68, auditor: "Security Research", date: "2026-02-10", findings: "Adversarial prompts caused 12% bypass rate. Partial pass." },
  { id: "a3", modelId: "m4", modelName: "FraudDetectionEnsemble", auditType: "Drift Analysis", result: "fail", score: 34, auditor: "MLOps", date: "2026-01-20", findings: "Drift score 34 exceeded threshold. Re-training initiated." },
  { id: "a4", modelId: "m5", modelName: "MedicalCodeSuggester", auditType: "Clinical Validation", result: "fail", score: 40, auditor: "Medical Review Board", date: "2026-02-18", findings: "Dangerous coding errors in 3.2% of test cases. Rejected." },
];

function riskBg(r: RiskLevel) {
  if (r === "critical") {return "bg-rose-500/10 text-rose-400";}
  if (r === "high") {return "bg-orange-500/10 text-orange-400";}
  if (r === "medium") {return "bg-amber-500/10 text-amber-400";}
  return "bg-emerald-500/10 text-emerald-400";
}
function statusBg(s: ModelStatus) {
  if (s === "approved") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "pending") {return "bg-amber-400/10 text-amber-400";}
  if (s === "rejected") {return "bg-rose-400/10 text-rose-400";}
  if (s === "deprecated") {return "bg-surface-3 text-fg-secondary";}
  return "bg-primary/10 text-primary";
}
function incidentSevBg(s: IncidentSeverity) {
  if (s === "critical") {return "bg-rose-500/10 text-rose-400";}
  if (s === "high") {return "bg-orange-500/10 text-orange-400";}
  if (s === "medium") {return "bg-amber-500/10 text-amber-400";}
  return "bg-emerald-500/10 text-emerald-400";
}
function incidentStateBg(s: IncidentState) {
  if (s === "open") {return "bg-rose-400/10 text-rose-400";}
  if (s === "investigating") {return "bg-amber-400/10 text-amber-400";}
  return "bg-emerald-400/10 text-emerald-400";
}
function auditResultBg(r: "pass" | "fail" | "partial") {
  if (r === "pass") {return "bg-emerald-400/10 text-emerald-400";}
  if (r === "fail") {return "bg-rose-400/10 text-rose-400";}
  return "bg-amber-400/10 text-amber-400";
}
function scoreColor(n: number) {
  if (n >= 85) {return "text-emerald-400";}
  if (n >= 70) {return "text-amber-400";}
  return "text-rose-400";
}
function biasLabel(m: BiasMetric) {
  const labels: Record<BiasMetric, string> = {
    demographic_parity: "Demographic Parity",
    equalized_odds: "Equalized Odds",
    calibration: "Calibration",
    predictive_parity: "Predictive Parity",
  };
  return labels[m];
}
function policyStatusBg(s: PolicyStatus) {
  if (s === "active") {return "bg-emerald-400/10 text-emerald-400";}
  if (s === "draft") {return "bg-amber-400/10 text-amber-400";}
  return "bg-surface-3 text-fg-secondary";
}

function AIGovernanceDashboardSkeleton() {
  return (
    <div className="h-full flex flex-col bg-surface-0 text-fg-primary">
      {/* Header */}
      <div className="border-b border-tok-border px-3 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <Skeleton className="h-6 w-56 mb-2" />
          <Skeleton variant="text" className="w-80 h-3" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-8 w-32" />
        </div>
      </div>
      {/* Stat bar */}
      <div className="border-b border-tok-border px-3 sm:px-4 md:px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="text-center">
            <Skeleton className="h-7 w-10 mx-auto mb-1" />
            <Skeleton variant="text" className="w-24 h-3 mx-auto" />
          </div>
        ))}
      </div>
      {/* Tabs */}
      <div className="border-b border-tok-border px-6">
        <div className="flex gap-6">
          {[70, 80, 72, 60].map((w, i) => (
            <Skeleton key={i} className="h-10 my-1" style={{ width: w }} />
          ))}
        </div>
      </div>
      {/* Split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Model list */}
        <div className="w-96 border-r border-tok-border flex flex-col">
          <div className="p-4 border-b border-tok-border space-y-3">
            <Skeleton className="h-9 w-full" />
            <div className="flex gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 flex-1" />
            </div>
          </div>
          <div className="overflow-y-auto flex-1">
            {[0, 1, 2, 3, 4].map(i => (
              <div key={i} className="px-4 py-3 border-b border-tok-border">
                <div className="flex items-center justify-between mb-1">
                  <Skeleton variant="text" className="w-36 h-4" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="flex items-center gap-2 mb-1">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton variant="text" className="w-20 h-3" />
                </div>
                <Skeleton variant="text" className="w-40 h-3" />
              </div>
            ))}
          </div>
        </div>
        {/* Detail panel */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <div className="flex items-start justify-between mb-5">
            <div>
              <Skeleton className="h-7 w-56 mb-2" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-5 w-16" />
                <Skeleton className="h-4 w-16" />
              </div>
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-9 w-20" />
              <Skeleton className="h-9 w-16" />
            </div>
          </div>
          {/* Score cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
            {[0, 1, 2].map(i => (
              <div key={i} className="bg-surface-1 rounded-xl p-4">
                <Skeleton className="h-8 w-16 mb-1" />
                <Skeleton variant="text" className="w-28 h-3" />
              </div>
            ))}
          </div>
          {/* Bias metrics */}
          <div className="bg-surface-1 rounded-xl p-5 mb-4">
            <Skeleton variant="text" className="w-32 h-4 mb-4" />
            {[0, 1, 2, 3].map(i => (
              <div key={i} className="mb-3">
                <div className="flex justify-between mb-1">
                  <Skeleton variant="text" className="w-36 h-3" />
                  <Skeleton className="w-10 h-3" />
                </div>
                <Skeleton className="h-1.5 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AIGovernanceDashboard({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AIGovernanceDashboardSkeleton />;

  const [tab, setTab] = useState<"models" | "incidents" | "policies" | "audits">("models");
  const [riskFilter, setRiskFilter] = useState<RiskLevel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ModelStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedModel, setSelectedModel] = useState<ModelCard | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<GovernanceIncident | null>(null);

  const filteredModels = MODELS.filter(m => {
    if (riskFilter !== "all" && m.riskLevel !== riskFilter) {return false;}
    if (statusFilter !== "all" && m.status !== statusFilter) {return false;}
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.useCase.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  const openIncidents = INCIDENTS.filter(i => i.state !== "resolved").length;
  const criticalModels = MODELS.filter(m => m.riskLevel === "critical").length;
  const pendingApprovals = MODELS.filter(m => m.status === "pending" || m.status === "review").length;

  return (
    <>
      <a
        href="#aigov-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-[var(--color-text-primary)] focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="h-full flex flex-col bg-surface-0 text-fg-primary">
        {/* Header */}
        <div className="border-b border-tok-border px-3 sm:px-4 md:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h1 className="text-lg font-semibold">AI Governance Dashboard</h1>
            <p className="text-sm text-fg-secondary mt-0.5">Model registry, bias monitoring, policy compliance, and incident tracking</p>
          </div>
          <div className="flex items-center gap-2">
            {openIncidents > 0 && (
              <span role="status" className="bg-rose-500/10 text-rose-400 text-xs px-2 py-1 rounded-full border border-rose-500/30">
                {openIncidents} open incident{openIncidents > 1 ? "s" : ""}
              </span>
            )}
            {pendingApprovals > 0 && (
              <span role="status" className="bg-amber-500/10 text-amber-400 text-xs px-2 py-1 rounded-full border border-amber-500/30">
                {pendingApprovals} pending review
              </span>
            )}
            <button className="bg-primary hover:bg-primary text-fg-primary text-sm px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              Register Model
            </button>
          </div>
        </div>

        {/* Stat bar */}
        <div aria-live="polite" className="border-b border-tok-border px-3 sm:px-4 md:px-6 py-3 grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Models", value: MODELS.length, color: "text-fg-primary" },
            { label: "Critical Risk", value: criticalModels, color: "text-rose-400" },
            { label: "Open Incidents", value: openIncidents, color: openIncidents > 0 ? "text-rose-400" : "text-emerald-400" },
            { label: "Pending Approvals", value: pendingApprovals, color: pendingApprovals > 0 ? "text-amber-400" : "text-emerald-400" },
          ].map((s, i) => (
            <div key={i} className="text-center">
              <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-fg-muted">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="border-b border-tok-border px-6">
          <div role="tablist" aria-label="Governance sections" className="flex gap-6">
            {(["models", "incidents", "policies", "audits"] as const).map(t => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                aria-controls={`aigov-panel-${t}`}
                onClick={() => setTab(t)}
                className={cn(
                  "py-3 text-sm font-medium border-b-2 capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                  tab === t ? "border-primary text-fg-primary" : "border-transparent text-fg-secondary hover:text-fg-primary"
                )}
              >
                {t}
                {t === "incidents" && openIncidents > 0 && (
                  <span className="ml-1.5 bg-rose-500 text-fg-primary text-xs px-1.5 rounded-full" aria-label={`${openIncidents} open`}>{openIncidents}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <main id="aigov-main" className="flex-1 overflow-auto">
          {/* MODELS TAB */}
          {tab === "models" && (
            <div id="aigov-panel-models" role="tabpanel" aria-label="Models" className="flex h-full">
              <div className="w-96 border-r border-tok-border flex flex-col">
                <div className="p-4 border-b border-tok-border space-y-3">
                  <label htmlFor="model-search" className="sr-only">Search models</label>
                  <input
                    id="model-search"
                    type="text"
                    placeholder="Search models..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-surface-2 text-sm rounded-lg px-3 py-2 text-fg-primary placeholder-fg-muted outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  />
                  <div className="flex gap-2">
                    <label htmlFor="risk-filter" className="sr-only">Filter by risk level</label>
                    <select
                      id="risk-filter"
                      value={riskFilter}
                      onChange={e => setRiskFilter(e.target.value as RiskLevel | "all")}
                      className="flex-1 bg-surface-2 text-sm rounded-lg px-2 py-1.5 text-fg-primary outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <option value="all">All Risk</option>
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                    <label htmlFor="status-filter" className="sr-only">Filter by status</label>
                    <select
                      id="status-filter"
                      value={statusFilter}
                      onChange={e => setStatusFilter(e.target.value as ModelStatus | "all")}
                      className="flex-1 bg-surface-2 text-sm rounded-lg px-2 py-1.5 text-fg-primary outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                    >
                      <option value="all">All Status</option>
                      <option value="approved">Approved</option>
                      <option value="pending">Pending</option>
                      <option value="review">Review</option>
                      <option value="rejected">Rejected</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  {filteredModels.map(m => (
                    <button
                      key={m.id}
                      onClick={() => setSelectedModel(m)}
                      aria-pressed={selectedModel?.id === m.id}
                      className={cn(
                        "w-full text-left px-4 py-3 border-b border-tok-border hover:bg-surface-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                        selectedModel?.id === m.id && "bg-surface-1 border-l-2 border-l-indigo-500"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-fg-primary truncate">{m.name}</span>
                        <span className={cn("text-xs px-1.5 py-0.5 rounded-full ml-2 shrink-0", statusBg(m.status))}>{m.status}</span>
                      </div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded", riskBg(m.riskLevel))}>{m.riskLevel}</span>
                        <span className="text-xs text-fg-muted">{m.provider}</span>
                      </div>
                      <div className="text-xs text-fg-muted truncate">{m.useCase}</div>
                      {m.driftScore > 25 && (
                        <div className="mt-1 text-xs text-amber-400"><span aria-hidden="true">⚠</span> Drift: {m.driftScore}</div>
                      )}
                    </button>
                  ))}
                  {filteredModels.length === 0 && (
                    <ContextualEmptyState
                      icon={ShieldAlert}
                      title="No models match filters"
                      description="Adjust the status or risk-level filters, or register a new model."
                      size="sm"
                    />
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                {selectedModel ? (
                  <div className="p-3 sm:p-4 md:p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="text-xl font-semibold text-fg-primary">{selectedModel.name} <span className="text-fg-muted text-base font-normal">v{selectedModel.version}</span></h2>
                        <div className="flex items-center gap-2 mt-1">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", riskBg(selectedModel.riskLevel))}>{selectedModel.riskLevel} risk</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", statusBg(selectedModel.status))}>{selectedModel.status}</span>
                          <span className="text-xs text-fg-muted">{selectedModel.provider}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {selectedModel.status === "pending" && (
                          <button
                            aria-label={`Approve ${selectedModel.name}`}
                            className="bg-emerald-700 hover:bg-emerald-600 text-fg-primary text-sm px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                          >
                            Approve
                          </button>
                        )}
                        <button
                          aria-label={`Edit ${selectedModel.name}`}
                          className="bg-surface-2 hover:bg-surface-3 text-sm px-3 py-1.5 rounded-lg text-fg-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                        >
                          Edit
                        </button>
                      </div>
                    </div>

                    {/* Scores */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-5">
                      {[
                        { label: "Explainability", value: selectedModel.explainabilityScore, suffix: "%" },
                        { label: "Drift Score", value: selectedModel.driftScore, suffix: "", invert: true },
                        { label: "Bias Audit Score", value: Math.round(Object.values(selectedModel.biasScores).reduce((a, b) => a + b, 0) / 4 * 100), suffix: "%" },
                      ].map((s, i) => (
                        <div key={i} className="bg-surface-1 rounded-xl p-4">
                          <div className={cn("text-2xl font-bold", s.invert
                            ? (s.value <= 10 ? "text-emerald-400" : s.value <= 25 ? "text-amber-400" : "text-rose-400")
                            : scoreColor(s.value)
                          )}>{s.value}{s.suffix}</div>
                          <div className="text-xs text-fg-muted mt-1">{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Bias metrics */}
                    <section aria-label="Fairness metrics" className="bg-surface-1 rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-fg-primary mb-4">Fairness Metrics</h3>
                      {(Object.entries(selectedModel.biasScores) as [BiasMetric, number][]).map(([metric, score]) => (
                        <div key={metric} className="mb-3">
                          <div className="flex justify-between text-xs text-fg-secondary mb-1">
                            <span>{biasLabel(metric)}</span>
                            <span className={score >= 0.80 ? "text-emerald-400" : score >= 0.70 ? "text-amber-400" : "text-rose-400"}>
                              {(score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div
                            className="h-1.5 bg-surface-2 rounded-full overflow-hidden"
                            role="img"
                            aria-label={`${biasLabel(metric)}: ${(score * 100).toFixed(0)}%`}
                          >
                            <div
                              className={cn("h-full rounded-full", score >= 0.80 ? "bg-emerald-500" : score >= 0.70 ? "bg-amber-500" : "bg-rose-500")}
                              style={{ width: `${score * 100}%` }}
                            />
                          </div>
                        </div>
                      ))}
                      <div className="mt-2 text-xs text-fg-muted">Policy minimum: 80% demographic parity, 75% equalized odds</div>
                    </section>

                    {/* Metadata */}
                    <section aria-label="Model details" className="bg-surface-1 rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-fg-primary mb-3">Model Details</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div><div className="text-fg-muted text-xs mb-0.5">Use Case</div><div className="text-fg-primary">{selectedModel.useCase}</div></div>
                        <div><div className="text-fg-muted text-xs mb-0.5">Approved By</div><div className="text-fg-primary">{selectedModel.approvedBy || "—"}</div></div>
                        <div><div className="text-fg-muted text-xs mb-0.5">Approved At</div><div className="text-fg-primary">{selectedModel.approvedAt || "—"}</div></div>
                        <div><div className="text-fg-muted text-xs mb-0.5">Deployed At</div><div className="text-fg-primary">{selectedModel.deployedAt || "—"}</div></div>
                        <div><div className="text-fg-muted text-xs mb-0.5">Last Audited</div><div className="text-fg-primary">{selectedModel.lastAudited || "—"}</div></div>
                        <div>
                          <div className="text-fg-muted text-xs mb-0.5">Data Sources</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {selectedModel.dataSources.map(ds => (
                              <span key={ds} className="bg-surface-2 text-fg-primary text-xs px-1.5 py-0.5 rounded">{ds}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {selectedModel.notes && (
                        <div className="mt-3 p-3 bg-surface-2 rounded-lg text-xs text-amber-300"><span aria-hidden="true">⚠</span> {selectedModel.notes}</div>
                      )}
                    </section>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-fg-muted">
                    <span aria-hidden="true" className="text-4xl mb-3">🤖</span>
                    <span className="text-sm">Select a model to view governance details</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* INCIDENTS TAB */}
          {tab === "incidents" && (
            <div id="aigov-panel-incidents" role="tabpanel" aria-label="Incidents" className="flex h-full">
              <div className="w-96 border-r border-tok-border overflow-y-auto">
                {INCIDENTS.map(inc => (
                  <button
                    key={inc.id}
                    onClick={() => setSelectedIncident(inc)}
                    aria-pressed={selectedIncident?.id === inc.id}
                    className={cn(
                      "w-full text-left px-4 py-3 border-b border-tok-border hover:bg-surface-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                      selectedIncident?.id === inc.id && "bg-surface-1 border-l-2 border-l-indigo-500"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full", incidentSevBg(inc.severity))}>{inc.severity}</span>
                      <span className={cn("text-xs px-1.5 py-0.5 rounded-full", incidentStateBg(inc.state))}>{inc.state}</span>
                    </div>
                    <div className="text-sm font-medium text-fg-primary mb-1">{inc.title}</div>
                    <div className="text-xs text-fg-muted">{inc.modelName}</div>
                    <div className="text-xs text-fg-muted mt-0.5">{inc.reportedAt}</div>
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedIncident ? (
                  <div className="p-3 sm:p-4 md:p-6">
                    <div className="flex items-start justify-between mb-5">
                      <div>
                        <h2 className="text-xl font-semibold text-fg-primary mb-2">{selectedIncident.title}</h2>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", incidentSevBg(selectedIncident.severity))}>{selectedIncident.severity}</span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", incidentStateBg(selectedIncident.state))}>{selectedIncident.state}</span>
                          <span className="text-xs text-fg-muted">{selectedIncident.modelName}</span>
                        </div>
                      </div>
                      <button
                        aria-label={`Update status for incident: ${selectedIncident.title}`}
                        className="bg-primary hover:bg-primary text-fg-primary text-sm px-3 py-1.5 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                      >
                        Update Status
                      </button>
                    </div>
                    <section aria-label="Incident description" className="bg-surface-1 rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-fg-primary mb-2">Description</h3>
                      <p className="text-sm text-fg-primary">{selectedIncident.description}</p>
                    </section>
                    <section aria-label="Remediation steps" className="bg-surface-1 rounded-xl p-5 mb-4">
                      <h3 className="text-sm font-medium text-fg-primary mb-3">Remediation Steps</h3>
                      <ol className="space-y-2">
                        {selectedIncident.remediationSteps.map((step, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-fg-primary">
                            <span aria-hidden="true" className="bg-primary/20 text-primary text-xs w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                          </li>
                        ))}
                      </ol>
                    </section>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-surface-1 rounded-xl p-4">
                        <div className="text-xs text-fg-muted mb-1">Reported</div>
                        <div className="text-sm text-fg-primary">{selectedIncident.reportedAt}</div>
                      </div>
                      <div className="bg-surface-1 rounded-xl p-4">
                        <div className="text-xs text-fg-muted mb-1">Resolved</div>
                        <div className="text-sm text-fg-primary">{selectedIncident.resolvedAt || "Open"}</div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-fg-muted">
                    <span aria-hidden="true" className="text-4xl mb-3">🚨</span>
                    <span className="text-sm">Select an incident to view details</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* POLICIES TAB */}
          {tab === "policies" && (
            <div id="aigov-panel-policies" role="tabpanel" aria-label="Policies" className="p-3 sm:p-4 md:p-6">
              <div className="space-y-4">
                {POLICIES.map(p => (
                  <section key={p.id} aria-label={p.name} className="bg-surface-1 rounded-xl p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-fg-primary">{p.name}</span>
                          <span className="text-xs text-fg-muted">v{p.version}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", policyStatusBg(p.status))}>{p.status}</span>
                          <span className="text-xs bg-surface-2 text-fg-secondary px-2 py-0.5 rounded">{p.category}</span>
                        </div>
                      </div>
                      <button
                        aria-label={`Edit policy: ${p.name}`}
                        className="text-xs text-primary hover:text-indigo-300 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                      >
                        Edit
                      </button>
                    </div>
                    <p className="text-sm text-fg-secondary mb-3">{p.description}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-fg-muted">
                      <div><span className="block text-fg-muted">Owner</span>{p.owner}</div>
                      <div><span className="block text-fg-muted">Last Review</span>{p.lastReviewed}</div>
                      <div><span className="block text-fg-muted">Next Review</span>{p.nextReview}</div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {p.appliesTo.map(risk => (
                        <span key={risk} className={cn("text-xs px-1.5 py-0.5 rounded", riskBg(risk as RiskLevel))}>{risk}</span>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          )}

          {/* AUDITS TAB */}
          {tab === "audits" && (
            <div id="aigov-panel-audits" role="tabpanel" aria-label="Audits" className="p-3 sm:p-4 md:p-6">
              <div className="bg-surface-1 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-tok-border">
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Model</th>
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Audit Type</th>
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Result</th>
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Score</th>
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Auditor</th>
                      <th scope="col" className="text-left px-4 py-3 text-fg-secondary font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AUDITS.map(a => (
                      <tr key={a.id} className="border-b border-tok-border hover:bg-surface-2/50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="text-fg-primary">{a.modelName}</div>
                          <div className="text-xs text-fg-muted mt-0.5">{a.findings}</div>
                        </td>
                        <td className="px-4 py-3 text-fg-primary">{a.auditType}</td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs px-2 py-0.5 rounded-full", auditResultBg(a.result))}>{a.result}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("font-medium", scoreColor(a.score))}>{a.score}</span>
                        </td>
                        <td className="px-4 py-3 text-fg-secondary">{a.auditor}</td>
                        <td className="px-4 py-3 text-fg-secondary">{a.date}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

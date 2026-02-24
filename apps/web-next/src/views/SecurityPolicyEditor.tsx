import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type PolicyStatus = "active" | "draft" | "deprecated";
type EnforcementMode = "audit" | "warn" | "enforce";
type RuleAction = "allow" | "deny" | "alert" | "require-MFA";
type TabId = "policies" | "rules" | "enforcement" | "audit";

interface Policy {
  id: string;
  name: string;
  scope: string;
  status: PolicyStatus;
  lastUpdated: string;
  owner: string;
  description: string;
  enforcementMode: EnforcementMode;
}

interface RuleCondition {
  eventType: string;
  sourceIpRange: string;
  userRole: string;
  timeWindow: string;
}

interface Rule {
  id: string;
  name: string;
  policyId: string;
  priority: number;
  condition: RuleCondition;
  action: RuleAction;
  enabled: boolean;
}

interface AuditEntry {
  id: string;
  timestamp: string;
  user: string;
  policyName: string;
  field: string;
  oldValue: string;
  newValue: string;
}

interface ImpactItem {
  description: string;
  count: number;
  severity: "high" | "medium" | "low";
}

// ─── Initial Data ────────────────────────────────────────────────────────────

const INITIAL_POLICIES: Policy[] = [
  {
    id: "pol-1",
    name: "GDPR Compliance",
    scope: "All EU User Data",
    status: "active",
    lastUpdated: "2026-02-18",
    owner: "Maria Chen",
    description:
      "Ensures all personal data processing complies with GDPR Articles 5-11. Covers consent management, data subject rights, and cross-border transfers.",
    enforcementMode: "enforce",
  },
  {
    id: "pol-2",
    name: "API Access Control",
    scope: "External & Internal APIs",
    status: "active",
    lastUpdated: "2026-02-15",
    owner: "James Rodriguez",
    description:
      "Governs authentication, authorization, and rate limiting for all API endpoints. Requires OAuth 2.0 with PKCE for external consumers.",
    enforcementMode: "enforce",
  },
  {
    id: "pol-3",
    name: "Data Retention",
    scope: "All Data Stores",
    status: "active",
    lastUpdated: "2026-02-10",
    owner: "Sarah Kim",
    description:
      "Defines retention periods by data classification. PII: 2 years. Financial: 7 years. Logs: 90 days. Automated purge pipelines enforced.",
    enforcementMode: "warn",
  },
  {
    id: "pol-4",
    name: "Incident Response",
    scope: "Security Operations",
    status: "draft",
    lastUpdated: "2026-02-20",
    owner: "Alex Thompson",
    description:
      "Playbook for security incident triage, escalation, containment, and post-mortem. Includes SLA targets: P1 < 15min acknowledgment, P2 < 1hr.",
    enforcementMode: "audit",
  },
  {
    id: "pol-5",
    name: "Password Policy",
    scope: "All User Accounts",
    status: "active",
    lastUpdated: "2026-01-28",
    owner: "Maria Chen",
    description:
      "Minimum 12 characters, must include uppercase, lowercase, digit, and special character. 90-day rotation. No reuse of last 12 passwords. MFA required for admin roles.",
    enforcementMode: "enforce",
  },
  {
    id: "pol-6",
    name: "Network Segmentation",
    scope: "Infrastructure & Cloud",
    status: "active",
    lastUpdated: "2026-02-05",
    owner: "David Park",
    description:
      "Enforces zero-trust network architecture. All inter-service communication via mTLS. DMZ isolation for public-facing services. VPC peering rules strictly controlled.",
    enforcementMode: "enforce",
  },
  {
    id: "pol-7",
    name: "Vendor Risk Assessment",
    scope: "Third-Party Integrations",
    status: "deprecated",
    lastUpdated: "2025-12-15",
    owner: "Sarah Kim",
    description:
      "Legacy vendor assessment framework. Superseded by automated continuous monitoring. Retained for audit trail purposes only.",
    enforcementMode: "audit",
  },
];

const INITIAL_RULES: Rule[] = [
  {
    id: "rule-1",
    name: "Block Non-EU Data Transfer",
    policyId: "pol-1",
    priority: 1,
    condition: {
      eventType: "data.transfer",
      sourceIpRange: "0.0.0.0/0",
      userRole: "any",
      timeWindow: "always",
    },
    action: "deny",
    enabled: true,
  },
  {
    id: "rule-2",
    name: "Rate Limit External API",
    policyId: "pol-2",
    priority: 2,
    condition: {
      eventType: "api.request",
      sourceIpRange: "0.0.0.0/0",
      userRole: "external-consumer",
      timeWindow: "per-minute",
    },
    action: "deny",
    enabled: true,
  },
  {
    id: "rule-3",
    name: "Require MFA for Admin Actions",
    policyId: "pol-5",
    priority: 1,
    condition: {
      eventType: "auth.privilege-escalation",
      sourceIpRange: "10.0.0.0/8",
      userRole: "admin",
      timeWindow: "always",
    },
    action: "require-MFA",
    enabled: true,
  },
  {
    id: "rule-4",
    name: "Alert on Anomalous Login",
    policyId: "pol-5",
    priority: 3,
    condition: {
      eventType: "auth.login",
      sourceIpRange: "0.0.0.0/0",
      userRole: "any",
      timeWindow: "outside-business-hours",
    },
    action: "alert",
    enabled: true,
  },
  {
    id: "rule-5",
    name: "Deny Unencrypted Storage Write",
    policyId: "pol-3",
    priority: 1,
    condition: {
      eventType: "storage.write",
      sourceIpRange: "10.0.0.0/8",
      userRole: "service-account",
      timeWindow: "always",
    },
    action: "deny",
    enabled: true,
  },
  {
    id: "rule-6",
    name: "Allow Internal Health Checks",
    policyId: "pol-2",
    priority: 0,
    condition: {
      eventType: "api.healthcheck",
      sourceIpRange: "10.0.0.0/8",
      userRole: "service-account",
      timeWindow: "always",
    },
    action: "allow",
    enabled: true,
  },
  {
    id: "rule-7",
    name: "Alert on PII Access",
    policyId: "pol-1",
    priority: 2,
    condition: {
      eventType: "data.read",
      sourceIpRange: "0.0.0.0/0",
      userRole: "analyst",
      timeWindow: "business-hours",
    },
    action: "alert",
    enabled: true,
  },
  {
    id: "rule-8",
    name: "Block Deprecated API Versions",
    policyId: "pol-2",
    priority: 3,
    condition: {
      eventType: "api.request.v1",
      sourceIpRange: "0.0.0.0/0",
      userRole: "any",
      timeWindow: "always",
    },
    action: "deny",
    enabled: false,
  },
  {
    id: "rule-9",
    name: "Require MFA for Vendor Portal",
    policyId: "pol-7",
    priority: 1,
    condition: {
      eventType: "auth.login",
      sourceIpRange: "0.0.0.0/0",
      userRole: "vendor",
      timeWindow: "always",
    },
    action: "require-MFA",
    enabled: true,
  },
  {
    id: "rule-10",
    name: "Deny Cross-Zone Traffic",
    policyId: "pol-6",
    priority: 1,
    condition: {
      eventType: "network.connection",
      sourceIpRange: "172.16.0.0/12",
      userRole: "service-account",
      timeWindow: "always",
    },
    action: "deny",
    enabled: true,
  },
];

const INITIAL_AUDIT: AuditEntry[] = [
  {
    id: "aud-1",
    timestamp: "2026-02-20 14:32",
    user: "Alex Thompson",
    policyName: "Incident Response",
    field: "status",
    oldValue: "active",
    newValue: "draft",
  },
  {
    id: "aud-2",
    timestamp: "2026-02-18 09:15",
    user: "Maria Chen",
    policyName: "GDPR Compliance",
    field: "description",
    oldValue: "Ensures GDPR compliance for EU data",
    newValue:
      "Ensures all personal data processing complies with GDPR Articles 5-11",
  },
  {
    id: "aud-3",
    timestamp: "2026-02-15 16:44",
    user: "James Rodriguez",
    policyName: "API Access Control",
    field: "enforcementMode",
    oldValue: "warn",
    newValue: "enforce",
  },
  {
    id: "aud-4",
    timestamp: "2026-02-10 11:20",
    user: "Sarah Kim",
    policyName: "Data Retention",
    field: "scope",
    oldValue: "Primary Data Stores",
    newValue: "All Data Stores",
  },
  {
    id: "aud-5",
    timestamp: "2026-02-05 08:55",
    user: "David Park",
    policyName: "Network Segmentation",
    field: "enforcementMode",
    oldValue: "audit",
    newValue: "enforce",
  },
  {
    id: "aud-6",
    timestamp: "2026-01-28 13:10",
    user: "Maria Chen",
    policyName: "Password Policy",
    field: "description",
    oldValue: "Minimum 8 characters with complexity requirements",
    newValue: "Minimum 12 characters with complexity requirements and MFA",
  },
  {
    id: "aud-7",
    timestamp: "2025-12-15 10:30",
    user: "Sarah Kim",
    policyName: "Vendor Risk Assessment",
    field: "status",
    oldValue: "active",
    newValue: "deprecated",
  },
];

const IMPACT_DATA: Record<string, ImpactItem[]> = {
  "pol-1": [
    {
      description: "Cross-border data transfers without adequacy decision",
      count: 142,
      severity: "high",
    },
    {
      description: "API calls missing consent verification",
      count: 38,
      severity: "medium",
    },
    {
      description: "Unclassified data records in EU storage",
      count: 15,
      severity: "low",
    },
  ],
  "pol-2": [
    {
      description: "Requests exceeding rate limit threshold",
      count: 2340,
      severity: "high",
    },
    {
      description: "Deprecated API version calls",
      count: 891,
      severity: "medium",
    },
    {
      description: "Missing OAuth scope declarations",
      count: 56,
      severity: "low",
    },
  ],
  "pol-3": [
    {
      description: "Records past retention deadline",
      count: 18420,
      severity: "high",
    },
    {
      description: "Unencrypted storage writes pending",
      count: 73,
      severity: "medium",
    },
  ],
  "pol-4": [
    {
      description: "Unacknowledged P1 incidents (simulated)",
      count: 0,
      severity: "low",
    },
    {
      description: "Missing post-mortem reports",
      count: 3,
      severity: "medium",
    },
  ],
  "pol-5": [
    {
      description: "Accounts with passwords older than 90 days",
      count: 234,
      severity: "high",
    },
    {
      description: "Admin accounts without MFA enabled",
      count: 12,
      severity: "high",
    },
    {
      description: "Accounts using previously-used passwords",
      count: 67,
      severity: "medium",
    },
  ],
  "pol-6": [
    {
      description: "Unauthorized cross-zone connections",
      count: 18,
      severity: "high",
    },
    {
      description: "Services without mTLS certificates",
      count: 4,
      severity: "medium",
    },
  ],
  "pol-7": [
    {
      description: "Vendors without current assessment",
      count: 8,
      severity: "low",
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const statusEmoji: Record<PolicyStatus, string> = {
  active: "✅",
  draft: "📝",
  deprecated: "⚠️",
};

const statusColor: Record<PolicyStatus, string> = {
  active: "text-emerald-400",
  draft: "text-amber-400",
  deprecated: "text-[var(--color-text-muted)]",
};

const statusBadgeBg: Record<PolicyStatus, string> = {
  active: "bg-emerald-400/15 text-emerald-400 border-emerald-400/30",
  draft: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  deprecated: "bg-[var(--color-surface-3)]/15 text-[var(--color-text-muted)] border-[var(--color-surface-3)]/30",
};

const actionEmoji: Record<RuleAction, string> = {
  allow: "✅",
  deny: "❌",
  alert: "🔔",
  "require-MFA": "🔐",
};

const actionColor: Record<RuleAction, string> = {
  allow: "text-emerald-400",
  deny: "text-rose-400",
  alert: "text-amber-400",
  "require-MFA": "text-indigo-400",
};

const enforcementEmoji: Record<EnforcementMode, string> = {
  audit: "👁️",
  warn: "⚠️",
  enforce: "🛡️",
};

const enforcementLabel: Record<EnforcementMode, string> = {
  audit: "Audit Only",
  warn: "Warn",
  enforce: "Enforce",
};

const severityColor: Record<string, string> = {
  high: "text-rose-400",
  medium: "text-amber-400",
  low: "text-[var(--color-text-secondary)]",
};

const TAB_CONFIG: { id: TabId; label: string; emoji: string }[] = [
  { id: "policies", label: "Policies", emoji: "🔒" },
  { id: "rules", label: "Rules", emoji: "📋" },
  { id: "enforcement", label: "Enforcement", emoji: "🛡️" },
  { id: "audit", label: "Audit Trail", emoji: "📜" },
];

// ─── Sub-Components ──────────────────────────────────────────────────────────

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── Policies Tab ────────────────────────────────────────────────────────────

function PoliciesTab({
  policies,
  onUpdate,
}: {
  policies: Policy[];
  onUpdate: (updated: Policy) => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<Partial<Policy>>({});

  const startEdit = (policy: Policy) => {
    setEditingId(policy.id);
    setEditDraft({
      name: policy.name,
      scope: policy.scope,
      status: policy.status,
      owner: policy.owner,
      description: policy.description,
    });
  };

  const saveEdit = (policy: Policy) => {
    onUpdate({
      ...policy,
      ...editDraft,
      lastUpdated: new Date().toISOString().slice(0, 10),
    });
    setEditingId(null);
    setEditDraft({});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Security Policies
        </h2>
        <span className="text-sm text-[var(--color-text-muted)]">
          {policies.filter((p) => p.status === "active").length} active /{" "}
          {policies.length} total
        </span>
      </div>
      {policies.map((policy) => {
        const isExpanded = expandedId === policy.id;
        const isEditing = editingId === policy.id;

        return (
          <div
            key={policy.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedId(isExpanded ? null : policy.id)
              }
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-[var(--color-surface-2)]/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-lg flex-shrink-0">
                  {statusEmoji[policy.status]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                    {policy.name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)] truncate">
                    {policy.scope}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0">
                <Badge className={statusBadgeBg[policy.status]}>
                  {policy.status}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)]">
                  {policy.lastUpdated}
                </span>
                <span className="text-[var(--color-text-muted)] text-sm">
                  {isExpanded ? "▲" : "▼"}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className="border-t border-[var(--color-border)] px-4 py-4 space-y-4">
                {isEditing ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                          Name
                        </span>
                        <input
                          type="text"
                          value={editDraft.name ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              name: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                          Scope
                        </span>
                        <input
                          type="text"
                          value={editDraft.scope ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              scope: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                          Owner
                        </span>
                        <input
                          type="text"
                          value={editDraft.owner ?? ""}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              owner: e.target.value,
                            }))
                          }
                          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                          Status
                        </span>
                        <select
                          value={editDraft.status ?? "active"}
                          onChange={(e) =>
                            setEditDraft((d) => ({
                              ...d,
                              status: e.target.value as PolicyStatus,
                            }))
                          }
                          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          <option value="active">Active</option>
                          <option value="draft">Draft</option>
                          <option value="deprecated">Deprecated</option>
                        </select>
                      </label>
                    </div>
                    <label className="block">
                      <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                        Description
                      </span>
                      <textarea
                        rows={3}
                        value={editDraft.description ?? ""}
                        onChange={(e) =>
                          setEditDraft((d) => ({
                            ...d,
                            description: e.target.value,
                          }))
                        }
                        className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                      />
                    </label>
                    <div className="flex gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft({});
                        }}
                        className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => saveEdit(policy)}
                        className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-indigo-500 transition-colors"
                      >
                        Save Changes
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-[var(--color-text-primary)] leading-relaxed">
                      {policy.description}
                    </p>
                    <div className="grid grid-cols-3 gap-4 text-xs">
                      <div>
                        <span className="text-[var(--color-text-muted)]">Owner</span>
                        <p className="text-[var(--color-text-primary)] mt-0.5">
                          {policy.owner}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)]">Last Updated</span>
                        <p className="text-[var(--color-text-primary)] mt-0.5">
                          {policy.lastUpdated}
                        </p>
                      </div>
                      <div>
                        <span className="text-[var(--color-text-muted)]">Enforcement</span>
                        <p className="text-[var(--color-text-primary)] mt-0.5">
                          {enforcementEmoji[policy.enforcementMode]}{" "}
                          {enforcementLabel[policy.enforcementMode]}
                        </p>
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => startEdit(policy)}
                        className="rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)] transition-colors"
                      >
                        ✏️ Edit Policy
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Rules Tab ───────────────────────────────────────────────────────────────

function RulesTab({
  rules,
  policies,
  onAdd,
  onRemove,
  onToggle,
}: {
  rules: Rule[];
  policies: Policy[];
  onAdd: (rule: Rule) => void;
  onRemove: (id: string) => void;
  onToggle: (id: string) => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    policyId: string;
    priority: string;
    eventType: string;
    sourceIpRange: string;
    userRole: string;
    timeWindow: string;
    action: RuleAction;
  }>({
    name: "",
    policyId: policies[0]?.id ?? "",
    priority: "5",
    eventType: "",
    sourceIpRange: "0.0.0.0/0",
    userRole: "any",
    timeWindow: "always",
    action: "deny",
  });

  const sorted = [...rules].toSorted((a, b) => a.priority - b.priority);

  const policyName = (id: string) =>
    policies.find((p) => p.id === id)?.name ?? "Unknown";

  const handleSubmit = () => {
    if (!formData.name.trim() || !formData.eventType.trim()) {return;}
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      name: formData.name,
      policyId: formData.policyId,
      priority: parseInt(formData.priority, 10) || 5,
      condition: {
        eventType: formData.eventType,
        sourceIpRange: formData.sourceIpRange,
        userRole: formData.userRole,
        timeWindow: formData.timeWindow,
      },
      action: formData.action,
      enabled: true,
    };
    onAdd(newRule);
    setShowForm(false);
    setFormData({
      name: "",
      policyId: policies[0]?.id ?? "",
      priority: "5",
      eventType: "",
      sourceIpRange: "0.0.0.0/0",
      userRole: "any",
      timeWindow: "always",
      action: "deny",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Rule Engine</h2>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-indigo-500 transition-colors"
        >
          {showForm ? "Cancel" : "➕ Add Rule"}
        </button>
      </div>

      {showForm && (
        <div className="rounded-lg border border-indigo-500/30 bg-[var(--color-surface-1)] p-4 space-y-3">
          <p className="text-sm font-medium text-indigo-400 mb-2">
            New Rule
          </p>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Rule Name
              </span>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, name: e.target.value }))
                }
                placeholder="e.g., Block Unauthorized Access"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Policy
              </span>
              <select
                value={formData.policyId}
                onChange={(e) =>
                  setFormData((d) => ({ ...d, policyId: e.target.value }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {policies.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Event Type
              </span>
              <input
                type="text"
                value={formData.eventType}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    eventType: e.target.value,
                  }))
                }
                placeholder="e.g., api.request"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Source IP Range
              </span>
              <input
                type="text"
                value={formData.sourceIpRange}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    sourceIpRange: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                User Role
              </span>
              <input
                type="text"
                value={formData.userRole}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    userRole: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Time Window
              </span>
              <select
                value={formData.timeWindow}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    timeWindow: e.target.value,
                  }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="always">Always</option>
                <option value="business-hours">Business Hours</option>
                <option value="outside-business-hours">
                  Outside Business Hours
                </option>
                <option value="per-minute">Per Minute</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Priority (lower = higher)
              </span>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    priority: e.target.value,
                  }))
                }
                min="0"
                max="99"
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </label>
            <label className="block">
              <span className="text-xs text-[var(--color-text-secondary)] mb-1 block">
                Action
              </span>
              <select
                value={formData.action}
                onChange={(e) =>
                  setFormData((d) => ({
                    ...d,
                    action: e.target.value as RuleAction,
                  }))
                }
                className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="allow">Allow</option>
                <option value="deny">Deny</option>
                <option value="alert">Alert</option>
                <option value="require-MFA">Require MFA</option>
              </select>
            </label>
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-md bg-indigo-600 px-4 py-1.5 text-xs text-[var(--color-text-primary)] hover:bg-indigo-500 transition-colors"
            >
              Create Rule
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {sorted.map((rule, index) => (
          <div
            key={rule.id}
            className={cn(
              "rounded-lg border bg-[var(--color-surface-1)] p-3",
              rule.enabled
                ? "border-[var(--color-border)]"
                : "border-[var(--color-border)]/50 opacity-50"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex-shrink-0 mt-0.5 w-6 h-6 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs font-mono flex items-center justify-center">
                  {rule.priority}
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {rule.name}
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px]",
                        rule.action === "allow"
                          ? "bg-emerald-400/15 text-emerald-400 border-emerald-400/30"
                          : rule.action === "deny"
                          ? "bg-rose-400/15 text-rose-400 border-rose-400/30"
                          : rule.action === "alert"
                          ? "bg-amber-400/15 text-amber-400 border-amber-400/30"
                          : "bg-indigo-400/15 text-indigo-400 border-indigo-400/30"
                      )}
                    >
                      {actionEmoji[rule.action]} {rule.action}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Policy: {policyName(rule.policyId)}
                  </p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-[var(--color-text-secondary)]">
                    <span>
                      <span className="text-[var(--color-text-muted)]">Event:</span>{" "}
                      <span className="font-mono text-[var(--color-text-primary)]">
                        {rule.condition.eventType}
                      </span>
                    </span>
                    <span>
                      <span className="text-[var(--color-text-muted)]">IP:</span>{" "}
                      <span className="font-mono text-[var(--color-text-primary)]">
                        {rule.condition.sourceIpRange}
                      </span>
                    </span>
                    <span>
                      <span className="text-[var(--color-text-muted)]">Role:</span>{" "}
                      <span className="text-[var(--color-text-primary)]">
                        {rule.condition.userRole}
                      </span>
                    </span>
                    <span>
                      <span className="text-[var(--color-text-muted)]">Window:</span>{" "}
                      <span className="text-[var(--color-text-primary)]">
                        {rule.condition.timeWindow}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => onToggle(rule.id)}
                  className={cn(
                    "rounded px-2 py-1 text-xs transition-colors",
                    rule.enabled
                      ? "bg-emerald-400/15 text-emerald-400 hover:bg-emerald-400/25"
                      : "bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)]"
                  )}
                >
                  {rule.enabled ? "ON" : "OFF"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove(rule.id)}
                  className="rounded px-2 py-1 text-xs bg-rose-400/10 text-rose-400 hover:bg-rose-400/20 transition-colors"
                >
                  🗑️
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-8 text-[var(--color-text-muted)] text-sm">
          No rules configured. Add one to get started.
        </div>
      )}
    </div>
  );
}

// ─── Enforcement Tab ─────────────────────────────────────────────────────────

function EnforcementTab({
  policies,
  onModeChange,
}: {
  policies: Policy[];
  onModeChange: (id: string, mode: EnforcementMode) => void;
}) {
  const [previewId, setPreviewId] = useState<string | null>(null);
  const modes: EnforcementMode[] = ["audit", "warn", "enforce"];

  return (
    <div className="space-y-4">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
          Enforcement Settings
        </h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Configure enforcement mode per policy and preview potential impact
        </p>
      </div>

      {policies.map((policy) => {
        const impact = IMPACT_DATA[policy.id] ?? [];
        const isPreview = previewId === policy.id;

        return (
          <div
            key={policy.id}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={statusColor[policy.status]}>
                  {statusEmoji[policy.status]}
                </span>
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  {policy.name}
                </span>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPreviewId(isPreview ? null : policy.id)
                }
                className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                {isPreview ? "Hide Impact" : "Preview Impact"}
              </button>
            </div>

            <div className="flex gap-2">
              {modes.map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onModeChange(policy.id, mode)}
                  className={cn(
                    "flex-1 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                    policy.enforcementMode === mode
                      ? mode === "enforce"
                        ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                        : mode === "warn"
                        ? "border-amber-500 bg-amber-500/20 text-amber-300"
                        : "border-[var(--color-surface-3)] bg-[var(--color-surface-3)]/50 text-[var(--color-text-primary)]"
                      : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text-primary)]"
                  )}
                >
                  {enforcementEmoji[mode]} {enforcementLabel[mode]}
                </button>
              ))}
            </div>

            {isPreview && impact.length > 0 && (
              <div className="border-t border-[var(--color-border)] pt-3 space-y-2">
                <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">
                  ⚡ Impact Preview — What would be affected
                </p>
                {impact.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-md bg-[var(--color-surface-2)]/50 px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className={cn(
                          "text-xs font-medium uppercase tracking-wider flex-shrink-0",
                          severityColor[item.severity]
                        )}
                      >
                        {item.severity}
                      </span>
                      <span className="text-xs text-[var(--color-text-primary)] truncate">
                        {item.description}
                      </span>
                    </div>
                    <span className="text-xs font-mono text-[var(--color-text-secondary)] flex-shrink-0 ml-2">
                      {item.count.toLocaleString()}
                    </span>
                  </div>
                ))}
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1">
                  Counts represent events in the last 30 days that would be
                  affected under{" "}
                  <span className="text-[var(--color-text-muted)]">enforce</span> mode.
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Audit Trail Tab ─────────────────────────────────────────────────────────

function AuditTrailTab({ entries }: { entries: AuditEntry[] }) {
  return (
    <div className="space-y-3">
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">Audit Trail</h2>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Chronological log of all policy changes
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-border)] overflow-hidden">
        <div className="grid grid-cols-[120px_120px_1fr_100px_1fr_1fr] gap-px bg-[var(--color-surface-2)]">
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Timestamp
          </div>
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            User
          </div>
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Policy
          </div>
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Field
          </div>
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            Old Value
          </div>
          <div className="bg-[var(--color-surface-1)] px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            New Value
          </div>
        </div>

        {entries.map((entry) => (
          <div
            key={entry.id}
            className="grid grid-cols-[120px_120px_1fr_100px_1fr_1fr] gap-px bg-[var(--color-surface-2)]"
          >
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5 text-xs font-mono text-[var(--color-text-muted)]">
              {entry.timestamp}
            </div>
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5 text-xs text-[var(--color-text-primary)]">
              {entry.user}
            </div>
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5 text-xs text-[var(--color-text-primary)] font-medium">
              {entry.policyName}
            </div>
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5">
              <span className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
                {entry.field}
              </span>
            </div>
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5 text-xs text-rose-400/80 line-through truncate">
              {entry.oldValue}
            </div>
            <div className="bg-[var(--color-surface-1)] px-3 py-2.5 text-xs text-emerald-400 truncate">
              {entry.newValue}
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-[var(--color-text-muted)] text-right">
        Showing {entries.length} entries
      </p>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function SecurityPolicyEditor() {
  const [activeTab, setActiveTab] = useState<TabId>("policies");
  const [policies, setPolicies] = useState<Policy[]>(INITIAL_POLICIES);
  const [rules, setRules] = useState<Rule[]>(INITIAL_RULES);
  const [auditEntries] = useState<AuditEntry[]>(INITIAL_AUDIT);

  const handleUpdatePolicy = (updated: Policy) => {
    setPolicies((prev) =>
      prev.map((p) => (p.id === updated.id ? updated : p))
    );
  };

  const handleEnforcementModeChange = (
    policyId: string,
    mode: EnforcementMode
  ) => {
    setPolicies((prev) =>
      prev.map((p) =>
        p.id === policyId ? { ...p, enforcementMode: mode } : p
      )
    );
  };

  const handleAddRule = (rule: Rule) => {
    setRules((prev) => [...prev, rule]);
  };

  const handleRemoveRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleToggleRule = (id: string) => {
    setRules((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, enabled: !r.enabled } : r
      )
    );
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-2xl">🔒</span>
            <h1 className="text-2xl font-bold text-[var(--color-text-primary)] tracking-tight">
              Security Policy Editor
            </h1>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] ml-10">
            Manage security policies, rules, enforcement, and audit trail
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 rounded-lg bg-[var(--color-surface-1)] p-1 border border-[var(--color-border)]">
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "bg-indigo-600 text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]"
              )}
            >
              {tab.emoji} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === "policies" && (
            <PoliciesTab
              policies={policies}
              onUpdate={handleUpdatePolicy}
            />
          )}
          {activeTab === "rules" && (
            <RulesTab
              rules={rules}
              policies={policies}
              onAdd={handleAddRule}
              onRemove={handleRemoveRule}
              onToggle={handleToggleRule}
            />
          )}
          {activeTab === "enforcement" && (
            <EnforcementTab
              policies={policies}
              onModeChange={handleEnforcementModeChange}
            />
          )}
          {activeTab === "audit" && (
            <AuditTrailTab entries={auditEntries} />
          )}
        </div>
      </div>
    </div>
  );
}

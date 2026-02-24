import React, { useState } from "react";
import { Flag, History } from "lucide-react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";

type FlagStatus = "enabled" | "disabled" | "partial";

interface TargetingRule {
  segment: string;
  percentage: number;
}

interface FlagOverride {
  id: string;
  userId: string;
  value: boolean;
  createdAt: string;
  createdBy: string;
}

interface FeatureFlag {
  id: string;
  name: string;
  key: string;
  description: string;
  status: FlagStatus;
  rolloutPercentage: number;
  targetingRules: TargetingRule[];
  overrides: FlagOverride[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

interface EnvironmentFlagState {
  enabled: boolean;
  rolloutPercentage: number;
  lastSynced: string;
}

interface Environment {
  id: string;
  name: string;
  color: string;
  flags: Record<string, EnvironmentFlagState>;
  syncStatus: "synced" | "pending" | "error";
}

interface ExperimentVariant {
  name: string;
  flagKey: string;
  traffic: number;
  conversions: number;
  conversionRate: number;
}

interface Experiment {
  id: string;
  name: string;
  status: "running" | "paused" | "completed";
  startDate: string;
  endDate: string | null;
  variants: ExperimentVariant[];
  totalParticipants: number;
  flagKey: string;
}

interface AuditEntry {
  id: string;
  flagKey: string;
  action: "created" | "updated" | "deleted" | "enabled" | "disabled" | "override_added" | "override_removed";
  user: string;
  timestamp: string;
  details: string;
  previousValue: string;
  newValue: string;
}

const mockFlags: FeatureFlag[] = [
  {
    id: "1",
    name: "Dark Mode",
    key: "feature.dark-mode",
    description: "Enable dark mode theme for all users",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-02-20T14:30:00Z",
    createdBy: "sarah.chen"
  },
  {
    id: "2",
    name: "New Dashboard",
    key: "feature.new-dashboard",
    description: "Redesigned analytics dashboard with advanced charts",
    status: "partial",
    rolloutPercentage: 35,
    targetingRules: [
      { segment: "enterprise", percentage: 100 },
      { segment: "pro", percentage: 50 },
      { segment: "free", percentage: 10 }
    ],
    overrides: [],
    createdAt: "2025-02-01T09:00:00Z",
    updatedAt: "2025-02-18T11:45:00Z",
    createdBy: "mike.johnson"
  },
  {
    id: "3",
    name: "AI Assistant",
    key: "feature.ai-assistant",
    description: "AI-powered assistant for content generation",
    status: "partial",
    rolloutPercentage: 25,
    targetingRules: [
      { segment: "beta-users", percentage: 100 },
      { segment: "pro", percentage: 30 }
    ],
    overrides: [],
    createdAt: "2025-02-10T08:00:00Z",
    updatedAt: "2025-02-21T16:20:00Z",
    createdBy: "alex.kim"
  },
  {
    id: "4",
    name: "Advanced Analytics",
    key: "feature.advanced-analytics",
    description: "Advanced analytics with custom reports",
    status: "disabled",
    rolloutPercentage: 0,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-20T14:00:00Z",
    updatedAt: "2025-02-15T09:30:00Z",
    createdBy: "sarah.chen"
  },
  {
    id: "5",
    name: "Real-time Collaboration",
    key: "feature.realtime-collab",
    description: "Multi-user real-time document editing",
    status: "partial",
    rolloutPercentage: 50,
    targetingRules: [
      { segment: "team", percentage: 80 },
      { segment: "individual", percentage: 20 }
    ],
    overrides: [],
    createdAt: "2025-02-05T11:00:00Z",
    updatedAt: "2025-02-19T13:15:00Z",
    createdBy: "david.lee"
  },
  {
    id: "6",
    name: "Custom Branding",
    key: "feature.custom-branding",
    description: "Allow white-label customization",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-10T10:00:00Z",
    updatedAt: "2025-02-20T10:00:00Z",
    createdBy: "mike.johnson"
  },
  {
    id: "7",
    name: "Mobile App v2",
    key: "feature.mobile-v2",
    description: "New mobile application with improved UX",
    status: "partial",
    rolloutPercentage: 15,
    targetingRules: [
      { segment: "beta-testers", percentage: 100 },
      { segment: "early-adopters", percentage: 25 }
    ],
    overrides: [],
    createdAt: "2025-02-08T15:00:00Z",
    updatedAt: "2025-02-21T08:45:00Z",
    createdBy: "alex.kim"
  },
  {
    id: "8",
    name: "Webhook Integrations",
    key: "feature.webhooks",
    description: "Custom webhook notifications and events",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-25T09:00:00Z",
    updatedAt: "2025-02-17T14:00:00Z",
    createdBy: "sarah.chen"
  },
  {
    id: "9",
    name: "SSO Authentication",
    key: "feature.sso-auth",
    description: "Single sign-on with enterprise identity providers",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-05T08:00:00Z",
    updatedAt: "2025-02-14T11:30:00Z",
    createdBy: "david.lee"
  },
  {
    id: "10",
    name: "API Rate Limiting",
    key: "feature.api-rate-limit",
    description: "Enhanced API rate limiting controls",
    status: "partial",
    rolloutPercentage: 75,
    targetingRules: [
      { segment: "enterprise", percentage: 100 },
      { segment: "pro", percentage: 80 },
      { segment: "free", percentage: 50 }
    ],
    overrides: [],
    createdAt: "2025-02-12T10:00:00Z",
    updatedAt: "2025-02-20T15:45:00Z",
    createdBy: "mike.johnson"
  },
  {
    id: "11",
    name: "Audit Logging",
    key: "feature.audit-logging",
    description: "Comprehensive audit trail for compliance",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-08T12:00:00Z",
    updatedAt: "2025-02-16T09:00:00Z",
    createdBy: "sarah.chen"
  },
  {
    id: "12",
    name: "File Preview",
    key: "feature.file-preview",
    description: "In-app document and image preview",
    status: "partial",
    rolloutPercentage: 60,
    targetingRules: [
      { segment: "team", percentage: 90 },
      { segment: "individual", percentage: 40 }
    ],
    overrides: [],
    createdAt: "2025-02-03T14:30:00Z",
    updatedAt: "2025-02-19T16:00:00Z",
    createdBy: "alex.kim"
  },
  {
    id: "13",
    name: "Budget Alerts",
    key: "feature.budget-alerts",
    description: "Customizable budget and spending alerts",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-18T11:00:00Z",
    updatedAt: "2025-02-18T10:30:00Z",
    createdBy: "david.lee"
  },
  {
    id: "14",
    name: "Workflow Automation",
    key: "feature.workflow-automation",
    description: "Visual workflow builder and automation",
    status: "disabled",
    rolloutPercentage: 0,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-02-15T08:00:00Z",
    updatedAt: "2025-02-21T12:00:00Z",
    createdBy: "mike.johnson"
  },
  {
    id: "15",
    name: "Team Directory",
    key: "feature.team-directory",
    description: "Organization-wide team directory and org chart",
    status: "enabled",
    rolloutPercentage: 100,
    targetingRules: [],
    overrides: [],
    createdAt: "2025-01-12T09:30:00Z",
    updatedAt: "2025-02-15T14:15:00Z",
    createdBy: "sarah.chen"
  },
  {
    id: "16",
    name: "Public API",
    key: "feature.public-api",
    description: "Public REST API for external integrations",
    status: "partial",
    rolloutPercentage: 40,
    targetingRules: [
      { segment: "enterprise", percentage: 100 },
      { segment: "developer", percentage: 60 }
    ],
    overrides: [],
    createdAt: "2025-02-07T13:00:00Z",
    updatedAt: "2025-02-20T17:30:00Z",
    createdBy: "alex.kim"
  }
];

const mockEnvironments: Environment[] = [
  {
    id: "env-1",
    name: "Development",
    color: "#22c55e",
    syncStatus: "synced",
    flags: {
      "feature.dark-mode": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" },
      "feature.new-dashboard": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" },
      "feature.ai-assistant": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" },
      "feature.advanced-analytics": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" },
      "feature.realtime-collab": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" },
      "feature.custom-branding": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T07:00:00Z" }
    }
  },
  {
    id: "env-2",
    name: "Staging",
    color: "#f59e0b",
    syncStatus: "pending",
    flags: {
      "feature.dark-mode": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T06:30:00Z" },
      "feature.new-dashboard": { enabled: true, rolloutPercentage: 50, lastSynced: "2025-02-22T06:30:00Z" },
      "feature.ai-assistant": { enabled: true, rolloutPercentage: 50, lastSynced: "2025-02-22T06:30:00Z" },
      "feature.advanced-analytics": { enabled: false, rolloutPercentage: 0, lastSynced: "2025-02-22T06:30:00Z" },
      "feature.realtime-collab": { enabled: true, rolloutPercentage: 75, lastSynced: "2025-02-22T06:30:00Z" },
      "feature.custom-branding": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T06:30:00Z" }
    }
  },
  {
    id: "env-3",
    name: "Production",
    color: "#ef4444",
    syncStatus: "synced",
    flags: {
      "feature.dark-mode": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T05:00:00Z" },
      "feature.new-dashboard": { enabled: true, rolloutPercentage: 35, lastSynced: "2025-02-22T05:00:00Z" },
      "feature.ai-assistant": { enabled: true, rolloutPercentage: 25, lastSynced: "2025-02-22T05:00:00Z" },
      "feature.advanced-analytics": { enabled: false, rolloutPercentage: 0, lastSynced: "2025-02-22T05:00:00Z" },
      "feature.realtime-collab": { enabled: true, rolloutPercentage: 50, lastSynced: "2025-02-22T05:00:00Z" },
      "feature.custom-branding": { enabled: true, rolloutPercentage: 100, lastSynced: "2025-02-22T05:00:00Z" }
    }
  }
];

const mockExperiments: Experiment[] = [
  {
    id: "exp-1",
    name: "New Dashboard Onboarding",
    status: "running",
    startDate: "2025-02-15T00:00:00Z",
    endDate: null,
    flagKey: "feature.new-dashboard",
    totalParticipants: 2847,
    variants: [
      { name: "Control", flagKey: "feature.new-dashboard-disabled", traffic: 50, conversions: 142, conversionRate: 4.99 },
      { name: "Treatment A", flagKey: "feature.new-dashboard-v1", traffic: 25, conversions: 98, conversionRate: 6.89 },
      { name: "Treatment B", flagKey: "feature.new-dashboard-v2", traffic: 25, conversions: 121, conversionRate: 8.50 }
    ]
  },
  {
    id: "exp-2",
    name: "AI Assistant Prompt Optimization",
    status: "running",
    startDate: "2025-02-18T00:00:00Z",
    endDate: null,
    flagKey: "feature.ai-assistant",
    totalParticipants: 1523,
    variants: [
      { name: "Control", flagKey: "feature.ai-assistant-v0", traffic: 50, conversions: 89, conversionRate: 5.84 },
      { name: "Variant 1", flagKey: "feature.ai-assistant-v1", traffic: 50, conversions: 134, conversionRate: 8.79 }
    ]
  },
  {
    id: "exp-3",
    name: "Checkout Flow Redesign",
    status: "paused",
    startDate: "2025-02-10T00:00:00Z",
    endDate: "2025-02-20T00:00:00Z",
    flagKey: "feature.checkout-v2",
    totalParticipants: 5621,
    variants: [
      { name: "Control", flagKey: "feature.checkout-v1", traffic: 50, conversions: 312, conversionRate: 5.55 },
      { name: "Variant 1", flagKey: "feature.checkout-v2", traffic: 50, conversions: 298, conversionRate: 5.30 }
    ]
  },
  {
    id: "exp-4",
    name: "Mobile App Navigation",
    status: "completed",
    startDate: "2025-01-20T00:00:00Z",
    endDate: "2025-02-10T00:00:00Z",
    flagKey: "feature.mobile-nav",
    totalParticipants: 8934,
    variants: [
      { name: "Control", flagKey: "feature.mobile-nav-bottom", traffic: 50, conversions: 523, conversionRate: 5.85 },
      { name: "Variant 1", flagKey: "feature.mobile-nav-drawer", traffic: 50, conversions: 612, conversionRate: 6.85 }
    ]
  },
  {
    id: "exp-5",
    name: "API Response Caching",
    status: "running",
    startDate: "2025-02-19T00:00:00Z",
    endDate: null,
    flagKey: "feature.api-cache",
    totalParticipants: 892,
    variants: [
      { name: "Control", flagKey: "feature.api-cache-off", traffic: 50, conversions: 45, conversionRate: 5.04 },
      { name: "Variant 1", flagKey: "feature.api-cache-on", traffic: 50, conversions: 67, conversionRate: 7.51 }
    ]
  }
];

const mockAuditEntries: AuditEntry[] = [
  {
    id: "audit-1",
    flagKey: "feature.new-dashboard",
    action: "updated",
    user: "mike.johnson",
    timestamp: "2025-02-22T06:45:00Z",
    details: "Updated rollout percentage from 25% to 35%",
    previousValue: "25%",
    newValue: "35%"
  },
  {
    id: "audit-2",
    flagKey: "feature.ai-assistant",
    action: "enabled",
    user: "alex.kim",
    timestamp: "2025-02-22T05:30:00Z",
    details: "Enabled flag for beta-users segment",
    previousValue: "disabled",
    newValue: "enabled"
  },
  {
    id: "audit-3",
    flagKey: "feature.advanced-analytics",
    action: "disabled",
    user: "sarah.chen",
    timestamp: "2025-02-21T18:20:00Z",
    details: "Disabled flag due to performance issues",
    previousValue: "enabled",
    newValue: "disabled"
  },
  {
    id: "audit-4",
    flagKey: "feature.realtime-collab",
    action: "override_added",
    user: "david.lee",
    timestamp: "2025-02-21T14:15:00Z",
    details: "Added override for user user-1234 to enable feature",
    previousValue: "null",
    newValue: "enabled"
  },
  {
    id: "audit-5",
    flagKey: "feature.mobile-v2",
    action: "created",
    user: "alex.kim",
    timestamp: "2025-02-21T10:00:00Z",
    details: "Created new feature flag",
    previousValue: "null",
    newValue: "enabled"
  },
  {
    id: "audit-6",
    flagKey: "feature.workflow-automation",
    action: "created",
    user: "mike.johnson",
    timestamp: "2025-02-20T16:30:00Z",
    details: "Created new feature flag",
    previousValue: "null",
    newValue: "disabled"
  },
  {
    id: "audit-7",
    flagKey: "feature.webhooks",
    action: "updated",
    user: "sarah.chen",
    timestamp: "2025-02-20T12:00:00Z",
    details: "Updated webhook retry policy",
    previousValue: "3 retries",
    newValue: "5 retries"
  },
  {
    id: "audit-8",
    flagKey: "feature.budget-alerts",
    action: "enabled",
    user: "david.lee",
    timestamp: "2025-02-19T09:45:00Z",
    details: "Enabled for all enterprise customers",
    previousValue: "disabled",
    newValue: "enabled"
  },
  {
    id: "audit-9",
    flagKey: "feature.file-preview",
    action: "updated",
    user: "alex.kim",
    timestamp: "2025-02-18T15:30:00Z",
    details: "Added support for PDF preview",
    previousValue: "images only",
    newValue: "images + PDF"
  },
  {
    id: "audit-10",
    flagKey: "feature.api-rate-limit",
    action: "override_removed",
    user: "mike.johnson",
    timestamp: "2025-02-18T11:00:00Z",
    details: "Removed override for user user-5678",
    previousValue: "enabled",
    newValue: "null"
  },
  {
    id: "audit-11",
    flagKey: "feature.new-dashboard",
    action: "override_added",
    user: "sarah.chen",
    timestamp: "2025-02-17T14:20:00Z",
    details: "Added override for user user-9999 to disable feature",
    previousValue: "null",
    newValue: "disabled"
  },
  {
    id: "audit-12",
    flagKey: "feature.custom-branding",
    action: "updated",
    user: "david.lee",
    timestamp: "2025-02-16T10:30:00Z",
    details: "Added custom logo placement options",
    previousValue: "header only",
    newValue: "header + footer"
  }
];

type TabType = "flags" | "environments" | "experiments" | "audit";

function StatusBadge({ status }: { status: FlagStatus }) {
  const styles = {
    enabled: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
    disabled: "bg-rose-400/20 text-rose-400 border-rose-400/30",
    partial: "bg-amber-400/20 text-amber-400 border-amber-400/30"
  };
  const labels = {
    enabled: "Enabled",
    disabled: "Disabled",
    partial: "Partial"
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", styles[status])}>
      {labels[status]}
    </span>
  );
}

function ExperimentStatusBadge({ status }: { status: Experiment["status"] }) {
  const styles = {
    running: "bg-emerald-400/20 text-emerald-400 border-emerald-400/30",
    paused: "bg-amber-400/20 text-amber-400 border-amber-400/30",
    completed: "bg-zinc-400/20 text-zinc-400 border-zinc-400/30"
  };
  const labels = {
    running: "Running",
    paused: "Paused",
    completed: "Completed"
  };
  return (
    <span className={cn("px-2 py-0.5 text-xs font-medium rounded-full border", styles[status])}>
      {labels[status]}
    </span>
  );
}

function SyncStatusBadge({ status }: { status: Environment["syncStatus"] }) {
  const styles = {
    synced: "text-emerald-400",
    pending: "text-amber-400",
    error: "text-rose-400"
  };
  const icons = {
    synced: "●",
    pending: "◐",
    error: "○"
  };
  return (
    <span className={cn("text-xs flex items-center gap-1", styles[status])}>
      <span>{icons[status]}</span>
      <span className="capitalize">{status}</span>
    </span>
  );
}

function ProgressBar({ percentage, className }: { percentage: number; className?: string }) {
  return (
    <div className={cn("w-full h-2 bg-zinc-800 rounded-full overflow-hidden", className)}>
      <div
        className="h-full bg-indigo-500 rounded-full transition-all duration-300"
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}

function BarChart({ data, maxValue }: { data: { label: string; value: number; color: string }[]; maxValue: number }) {
  return (
    <div className="flex flex-col gap-2">
      {data.map((item, index) => (
        <div key={index} className="flex items-center gap-3">
          <span className="text-xs text-zinc-400 w-20 truncate">{item.label}</span>
          <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
            <div
              className="h-full rounded transition-all duration-300"
              style={{ width: `${(item.value / maxValue) * 100}%`, backgroundColor: item.color }}
            />
          </div>
          <span className="text-xs text-zinc-300 w-12 text-right">{item.value}%</span>
        </div>
      ))}
    </div>
  );
}

function FlagsTab() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<FlagStatus | "all">("all");
  const [selectedFlag, setSelectedFlag] = useState<FeatureFlag | null>(null);

  const filteredFlags = mockFlags.filter((flag) => {
    const matchesSearch = flag.name.toLowerCase().split(searchQuery.toLowerCase()).join("").includes(flag.name.toLowerCase()) ||
      flag.key.toLowerCase().split(searchQuery.toLowerCase()).join("").includes(flag.key.toLowerCase());
    const matchesStatus = statusFilter === "all" || flag.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="flex gap-4 h-full">
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex gap-3 mb-4">
          <input
            type="text"
            placeholder="Search flags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as FlagStatus | "all")}
            className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            <option value="all">All Status</option>
            <option value="enabled">Enabled</option>
            <option value="disabled">Disabled</option>
            <option value="partial">Partial</option>
          </select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2">
          {filteredFlags.length === 0 ? (
            <ContextualEmptyState
              icon={Flag}
              title="No flags match that"
              description="Nothing matches your criteria. Try a different filter — or create a new flag to get started."
              size="sm"
            />
          ) : (
            filteredFlags.map((flag) => (
              <div
                key={flag.id}
                onClick={() => setSelectedFlag(flag)}
                className={cn(
                  "p-4 bg-zinc-900 border rounded-lg cursor-pointer transition-all duration-150",
                  selectedFlag?.id === flag.id ? "border-indigo-500" : "border-zinc-800 hover:border-zinc-700"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-sm font-medium text-white">{flag.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono">{flag.key}</p>
                  </div>
                  <StatusBadge status={flag.status} />
                </div>
                <p className="text-xs text-zinc-400 mb-3 line-clamp-2">{flag.description}</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">Rollout:</span>
                  <div className="flex-1">
                    <ProgressBar percentage={flag.rolloutPercentage} />
                  </div>
                  <span className="text-xs text-zinc-400">{flag.rolloutPercentage}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedFlag && (
        <div className="w-80 bg-zinc-900 border border-zinc-800 rounded-lg p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">{selectedFlag.name}</h2>
            <button
              onClick={() => setSelectedFlag(null)}
              className="text-zinc-500 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1">Key</p>
            <p className="text-sm text-zinc-300 font-mono">{selectedFlag.key}</p>
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-1">Description</p>
            <p className="text-sm text-zinc-300">{selectedFlag.description}</p>
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">Status</p>
            <StatusBadge status={selectedFlag.status} />
          </div>

          <div className="mb-4">
            <p className="text-xs text-zinc-500 mb-2">Rollout Percentage</p>
            <div className="flex items-center gap-2">
              <ProgressBar percentage={selectedFlag.rolloutPercentage} className="flex-1" />
              <span className="text-sm text-white">{selectedFlag.rolloutPercentage}%</span>
            </div>
          </div>

          {selectedFlag.targetingRules.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-2">Targeting Rules</p>
              <div className="space-y-2">
                {selectedFlag.targetingRules.map((rule, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-zinc-800 rounded">
                    <span className="text-sm text-zinc-300 capitalize">{rule.segment}</span>
                    <span className="text-sm text-indigo-400">{rule.percentage}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedFlag.overrides.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-zinc-500 mb-2">Overrides</p>
              <div className="space-y-2">
                {selectedFlag.overrides.map((override) => (
                  <div key={override.id} className="p-2 bg-zinc-800 rounded">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-zinc-400">{override.userId}</span>
                      <span className={cn("text-xs", override.value ? "text-emerald-400" : "text-rose-400")}>
                        {override.value ? "Enabled" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500">by {override.createdBy}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-zinc-800">
            <p className="text-xs text-zinc-500">Created by {selectedFlag.createdBy}</p>
            <p className="text-xs text-zinc-600">
              Updated {new Date(selectedFlag.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function EnvironmentsTab() {
  const flagKeys = ["feature.dark-mode", "feature.new-dashboard", "feature.ai-assistant", "feature.advanced-analytics", "feature.realtime-collab", "feature.custom-branding"];

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left p-3 text-xs font-medium text-zinc-500">Flag</th>
            {mockEnvironments.map((env) => (
              <th key={env.id} className="text-left p-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: env.color }} />
                  <span className="text-xs font-medium text-zinc-400">{env.name}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {flagKeys.map((flagKey) => {
            const flag = mockFlags.find((f) => f.key === flagKey);
            return (
              <tr key={flagKey} className="border-b border-zinc-800/50 hover:bg-zinc-900/50">
                <td className="p-3">
                  <p className="text-sm text-white">{flag?.name}</p>
                  <p className="text-xs text-zinc-500 font-mono">{flagKey}</p>
                </td>
                {mockEnvironments.map((env) => {
                  const envFlag = env.flags[flagKey];
                  return (
                    <td key={env.id} className="p-3">
                      {envFlag ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-xs", envFlag.enabled ? "text-emerald-400" : "text-rose-400")}>
                              {envFlag.enabled ? "Enabled" : "Disabled"}
                            </span>
                            {envFlag.enabled && (
                              <span className="text-xs text-zinc-500">{envFlag.rolloutPercentage}%</span>
                            )}
                          </div>
                          <SyncStatusBadge status={env.syncStatus} />
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ExperimentsTab() {
  const maxRate = Math.max(...mockExperiments.flatMap((exp) => exp.variants.map((v) => v.conversionRate)));

  return (
    <div className="space-y-4 overflow-y-auto">
      {mockExperiments.map((experiment) => (
        <div key={experiment.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-medium text-white">{experiment.name}</h3>
              <p className="text-xs text-zinc-500 font-mono">{experiment.flagKey}</p>
            </div>
            <ExperimentStatusBadge status={experiment.status} />
          </div>

          <div className="flex items-center gap-4 mb-4 text-xs text-zinc-500">
            <span>{new Date(experiment.startDate).toLocaleDateString()}</span>
            {experiment.endDate && (
              <>
                <span>→</span>
                <span>{new Date(experiment.endDate).toLocaleDateString()}</span>
              </>
            )}
            <span className="ml-auto">{experiment.totalParticipants.toLocaleString()} participants</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {experiment.variants.map((variant, index) => (
              <div key={index} className="bg-zinc-800 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-300">{variant.name}</span>
                  <span className="text-xs text-zinc-500">{variant.traffic}% traffic</span>
                </div>
                <div className="mb-2">
                  <BarChart
                    data={[
                      { label: "Conversion", value: Math.round(variant.conversionRate), color: "#6366f1" }
                    ]}
                    maxValue={maxRate}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">{variant.conversions} conversions</span>
                  <span className="text-indigo-400 font-medium">{variant.conversionRate.toFixed(2)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function AuditTab() {
  const [flagFilter, setFlagFilter] = useState("all");

  const filteredEntries = mockAuditEntries.filter(
    (entry) => flagFilter === "all" || entry.flagKey === flagFilter
  );

  const uniqueFlagKeys = Array.from(new Set(mockAuditEntries.map((e) => e.flagKey)));

  const actionColors: Record<AuditEntry["action"], string> = {
    created: "text-emerald-400",
    updated: "text-indigo-400",
    deleted: "text-rose-400",
    enabled: "text-emerald-400",
    disabled: "text-rose-400",
    override_added: "text-amber-400",
    override_removed: "text-zinc-400"
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <select
          value={flagFilter}
          onChange={(e) => setFlagFilter(e.target.value)}
          className="px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white focus:outline-none focus:border-indigo-500"
        >
          <option value="all">All Flags</option>
          {uniqueFlagKeys.map((key) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2 overflow-y-auto">
        {filteredEntries.length === 0 ? (
          <ContextualEmptyState
            icon={History}
            title="Clean slate"
            description="Every flag change will appear here. Make a modification and this log comes to life."
            size="sm"
          />
        ) : (
          filteredEntries.map((entry) => (
            <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-medium capitalize", actionColors[entry.action])}>
                    {entry.action.split("_").join(" ")}
                  </span>
                  <span className="text-xs text-zinc-500">•</span>
                  <span className="text-xs text-zinc-400 font-mono">{entry.flagKey}</span>
                </div>
                <span className="text-xs text-zinc-600">
                  {new Date(entry.timestamp).toLocaleString()}
                </span>
              </div>
              <p className="text-sm text-zinc-300 mb-2">{entry.details}</p>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-zinc-500">by {entry.user}</span>
                {entry.previousValue !== "null" && entry.newValue !== "null" && (
                  <span className="text-zinc-600">
                    {entry.previousValue} → {entry.newValue}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function FeatureFlagManager() {
  const [activeTab, setActiveTab] = useState<TabType>("flags");

  const tabs: { id: TabType; label: string }[] = [
    { id: "flags", label: "Flags" },
    { id: "environments", label: "Environments" },
    { id: "experiments", label: "Experiments" },
    { id: "audit", label: "Audit" }
  ];

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      <div className="p-4 border-b border-zinc-800">
        <h1 className="text-xl font-semibold text-white mb-1">Feature Flags</h1>
        <p className="text-sm text-zinc-500">Manage feature rollouts and experiments</p>
      </div>

      <div className="flex border-b border-zinc-800 px-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "px-4 py-3 text-sm font-medium border-b-2 transition-colors duration-150",
              activeTab === tab.id
                ? "text-indigo-400 border-indigo-500"
                : "text-zinc-500 border-transparent hover:text-zinc-300"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-hidden">
        {activeTab === "flags" && <FlagsTab />}
        {activeTab === "environments" && <EnvironmentsTab />}
        {activeTab === "experiments" && <ExperimentsTab />}
        {activeTab === "audit" && <AuditTab />}
      </div>
    </div>
  );
}


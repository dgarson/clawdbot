import React, { useState } from "react";
import { cn } from "../lib/utils";

type Category =
  | "communication"
  | "development"
  | "analytics"
  | "database"
  | "crm"
  | "monitoring"
  | "automation";

type Status = "connected" | "disconnected" | "error" | "pending";

interface SyncEntry {
  timestamp: string;
  records: number;
  status: "success" | "partial" | "failed";
}

interface Integration {
  id: string;
  name: string;
  category: Category;
  status: Status;
  lastSync: string;
  syncCount: number;
  emoji: string;
  webhookUrl: string;
  apiKey: string;
  scopes: string[];
  syncHistory: SyncEntry[];
}

const STATUS_COLOR: Record<Status, string> = {
  connected: "bg-emerald-400",
  disconnected: "bg-zinc-500",
  error: "bg-rose-400",
  pending: "bg-amber-400",
};

const STATUS_TEXT: Record<Status, string> = {
  connected: "text-emerald-400",
  disconnected: "text-zinc-500",
  error: "text-rose-400",
  pending: "text-amber-400",
};

const CATEGORY_LABEL: Record<Category, string> = {
  communication: "Communication",
  development: "Development",
  analytics: "Analytics",
  database: "Database",
  crm: "CRM",
  monitoring: "Monitoring",
  automation: "Automation",
};

const CATEGORY_BADGE: Record<Category, string> = {
  communication: "bg-blue-500/15 text-blue-400 border border-blue-500/30",
  development: "bg-violet-500/15 text-violet-400 border border-violet-500/30",
  analytics: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30",
  database: "bg-orange-500/15 text-orange-400 border border-orange-500/30",
  crm: "bg-pink-500/15 text-pink-400 border border-pink-500/30",
  monitoring: "bg-yellow-500/15 text-yellow-400 border border-yellow-500/30",
  automation: "bg-teal-500/15 text-teal-400 border border-teal-500/30",
};

const INTEGRATIONS: Integration[] = [
  {
    id: "slack",
    name: "Slack",
    category: "communication",
    status: "connected",
    lastSync: "2026-02-22T01:14:00Z",
    syncCount: 14832,
    emoji: "💬",
    webhookUrl: "https://hooks.slack.com/services/T04XXXXXX/B06XXXXXX",
    apiKey: "xoxb-****-****-****-a3f8d1",
    scopes: ["channels:read", "chat:write", "users:read", "reactions:read"],
    syncHistory: [
      { timestamp: "2026-02-22T01:14:00Z", records: 247, status: "success" },
      { timestamp: "2026-02-22T00:14:00Z", records: 189, status: "success" },
      { timestamp: "2026-02-21T23:14:00Z", records: 312, status: "success" },
      { timestamp: "2026-02-21T22:14:00Z", records: 56, status: "partial" },
      { timestamp: "2026-02-21T21:14:00Z", records: 201, status: "success" },
    ],
  },
  {
    id: "github",
    name: "GitHub",
    category: "development",
    status: "connected",
    lastSync: "2026-02-22T01:30:00Z",
    syncCount: 28451,
    emoji: "🐙",
    webhookUrl: "https://api.github.com/hooks/openclaw-prod",
    apiKey: "ghp_****-****-****-9x2kLm",
    scopes: ["repo", "read:org", "workflow", "write:packages"],
    syncHistory: [
      { timestamp: "2026-02-22T01:30:00Z", records: 523, status: "success" },
      { timestamp: "2026-02-22T00:30:00Z", records: 491, status: "success" },
      { timestamp: "2026-02-21T23:30:00Z", records: 387, status: "success" },
      { timestamp: "2026-02-21T22:30:00Z", records: 610, status: "success" },
      { timestamp: "2026-02-21T21:30:00Z", records: 445, status: "success" },
    ],
  },
  {
    id: "linear",
    name: "Linear",
    category: "development",
    status: "connected",
    lastSync: "2026-02-22T01:00:00Z",
    syncCount: 9217,
    emoji: "📐",
    webhookUrl: "https://api.linear.app/webhooks/oc-prod",
    apiKey: "lin_api_****-****-7bR3",
    scopes: ["read", "write", "issues:admin"],
    syncHistory: [
      { timestamp: "2026-02-22T01:00:00Z", records: 84, status: "success" },
      { timestamp: "2026-02-22T00:00:00Z", records: 91, status: "success" },
      { timestamp: "2026-02-21T23:00:00Z", records: 67, status: "success" },
      { timestamp: "2026-02-21T22:00:00Z", records: 103, status: "success" },
      { timestamp: "2026-02-21T21:00:00Z", records: 78, status: "partial" },
    ],
  },
  {
    id: "notion",
    name: "Notion",
    category: "database",
    status: "pending",
    lastSync: "2026-02-21T18:45:00Z",
    syncCount: 3410,
    emoji: "📝",
    webhookUrl: "https://api.notion.com/v1/webhooks/oc",
    apiKey: "ntn_****-****-****-kP9x",
    scopes: ["read_content", "update_content", "read_users"],
    syncHistory: [
      { timestamp: "2026-02-21T18:45:00Z", records: 42, status: "partial" },
      { timestamp: "2026-02-21T17:45:00Z", records: 38, status: "success" },
      { timestamp: "2026-02-21T16:45:00Z", records: 55, status: "success" },
      { timestamp: "2026-02-21T15:45:00Z", records: 29, status: "success" },
      { timestamp: "2026-02-21T14:45:00Z", records: 0, status: "failed" },
    ],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "analytics",
    status: "connected",
    lastSync: "2026-02-22T01:05:00Z",
    syncCount: 41290,
    emoji: "💳",
    webhookUrl: "https://api.stripe.com/webhooks/oc-events",
    apiKey: "sk_live_****-****-****-Qw7z",
    scopes: ["payment_intents", "customers", "subscriptions", "invoices"],
    syncHistory: [
      { timestamp: "2026-02-22T01:05:00Z", records: 1204, status: "success" },
      { timestamp: "2026-02-22T00:05:00Z", records: 987, status: "success" },
      { timestamp: "2026-02-21T23:05:00Z", records: 1341, status: "success" },
      { timestamp: "2026-02-21T22:05:00Z", records: 1102, status: "success" },
      { timestamp: "2026-02-21T21:05:00Z", records: 856, status: "success" },
    ],
  },
  {
    id: "datadog",
    name: "Datadog",
    category: "monitoring",
    status: "error",
    lastSync: "2026-02-21T22:30:00Z",
    syncCount: 18764,
    emoji: "🐕",
    webhookUrl: "https://app.datadoghq.com/api/v1/webhooks/oc",
    apiKey: "dd_api_****-****-Xm4p",
    scopes: ["metrics:read", "logs:read", "monitors:read", "apm:read"],
    syncHistory: [
      { timestamp: "2026-02-21T22:30:00Z", records: 0, status: "failed" },
      { timestamp: "2026-02-21T21:30:00Z", records: 0, status: "failed" },
      { timestamp: "2026-02-21T20:30:00Z", records: 3402, status: "success" },
      { timestamp: "2026-02-21T19:30:00Z", records: 2987, status: "success" },
      { timestamp: "2026-02-21T18:30:00Z", records: 3156, status: "success" },
    ],
  },
  {
    id: "pagerduty",
    name: "PagerDuty",
    category: "monitoring",
    status: "connected",
    lastSync: "2026-02-22T01:20:00Z",
    syncCount: 5693,
    emoji: "🚨",
    webhookUrl: "https://events.pagerduty.com/integration/oc",
    apiKey: "pd_****-****-****-Rv2n",
    scopes: ["incidents:read", "services:read", "oncalls:read"],
    syncHistory: [
      { timestamp: "2026-02-22T01:20:00Z", records: 17, status: "success" },
      { timestamp: "2026-02-22T00:20:00Z", records: 23, status: "success" },
      { timestamp: "2026-02-21T23:20:00Z", records: 9, status: "success" },
      { timestamp: "2026-02-21T22:20:00Z", records: 31, status: "success" },
      { timestamp: "2026-02-21T21:20:00Z", records: 14, status: "success" },
    ],
  },
  {
    id: "snowflake",
    name: "Snowflake",
    category: "database",
    status: "connected",
    lastSync: "2026-02-22T00:00:00Z",
    syncCount: 72105,
    emoji: "❄️",
    webhookUrl: "https://account.snowflakecomputing.com/api/oc",
    apiKey: "sf_****-****-****-Bk8w",
    scopes: ["warehouse:usage", "database:read", "schema:read", "table:read"],
    syncHistory: [
      { timestamp: "2026-02-22T00:00:00Z", records: 15420, status: "success" },
      { timestamp: "2026-02-21T18:00:00Z", records: 12890, status: "success" },
      { timestamp: "2026-02-21T12:00:00Z", records: 14205, status: "success" },
      { timestamp: "2026-02-21T06:00:00Z", records: 11340, status: "partial" },
      { timestamp: "2026-02-21T00:00:00Z", records: 16700, status: "success" },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot",
    category: "crm",
    status: "connected",
    lastSync: "2026-02-22T01:10:00Z",
    syncCount: 22380,
    emoji: "🧲",
    webhookUrl: "https://api.hubapi.com/webhooks/v3/oc",
    apiKey: "hs_pat_****-****-Tn6f",
    scopes: ["crm.objects.contacts.read", "crm.objects.deals.read", "content"],
    syncHistory: [
      { timestamp: "2026-02-22T01:10:00Z", records: 340, status: "success" },
      { timestamp: "2026-02-22T00:10:00Z", records: 287, status: "success" },
      { timestamp: "2026-02-21T23:10:00Z", records: 412, status: "success" },
      { timestamp: "2026-02-21T22:10:00Z", records: 298, status: "success" },
      { timestamp: "2026-02-21T21:10:00Z", records: 356, status: "success" },
    ],
  },
  {
    id: "twilio",
    name: "Twilio",
    category: "communication",
    status: "disconnected",
    lastSync: "2026-02-19T09:00:00Z",
    syncCount: 1847,
    emoji: "📞",
    webhookUrl: "https://api.twilio.com/2010-04-01/oc",
    apiKey: "SK****-****-****-Hj3r",
    scopes: ["messages:read", "calls:read", "usage:read"],
    syncHistory: [
      { timestamp: "2026-02-19T09:00:00Z", records: 64, status: "success" },
      { timestamp: "2026-02-19T08:00:00Z", records: 71, status: "success" },
      { timestamp: "2026-02-19T07:00:00Z", records: 43, status: "success" },
      { timestamp: "2026-02-19T06:00:00Z", records: 58, status: "success" },
      { timestamp: "2026-02-19T05:00:00Z", records: 39, status: "success" },
    ],
  },
  {
    id: "zapier",
    name: "Zapier",
    category: "automation",
    status: "connected",
    lastSync: "2026-02-22T01:25:00Z",
    syncCount: 8540,
    emoji: "⚡",
    webhookUrl: "https://hooks.zapier.com/hooks/catch/oc-prod",
    apiKey: "zap_****-****-****-Yw1q",
    scopes: ["zaps:read", "zaps:write", "actions:execute"],
    syncHistory: [
      { timestamp: "2026-02-22T01:25:00Z", records: 156, status: "success" },
      { timestamp: "2026-02-22T00:25:00Z", records: 132, status: "success" },
      { timestamp: "2026-02-21T23:25:00Z", records: 178, status: "success" },
      { timestamp: "2026-02-21T22:25:00Z", records: 94, status: "partial" },
      { timestamp: "2026-02-21T21:25:00Z", records: 141, status: "success" },
    ],
  },
  {
    id: "cloudwatch",
    name: "AWS CloudWatch",
    category: "monitoring",
    status: "error",
    lastSync: "2026-02-21T19:00:00Z",
    syncCount: 34219,
    emoji: "☁️",
    webhookUrl: "https://monitoring.us-east-1.amazonaws.com/oc",
    apiKey: "AKIA****-****-****-Fg5m",
    scopes: ["cloudwatch:GetMetricData", "logs:FilterLogEvents", "sns:Publish"],
    syncHistory: [
      { timestamp: "2026-02-21T19:00:00Z", records: 0, status: "failed" },
      { timestamp: "2026-02-21T18:00:00Z", records: 4210, status: "success" },
      { timestamp: "2026-02-21T17:00:00Z", records: 3890, status: "success" },
      { timestamp: "2026-02-21T16:00:00Z", records: 4567, status: "success" },
      { timestamp: "2026-02-21T15:00:00Z", records: 3201, status: "success" },
    ],
  },
];

const ALL_CATEGORIES: Category[] = [
  "communication",
  "development",
  "analytics",
  "database",
  "crm",
  "monitoring",
  "automation",
];

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function statusLabel(s: Status): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function actionLabel(s: Status): string {
  if (s === "connected") return "Configure";
  if (s === "error") return "Reconnect";
  return "Connect";
}

const SYNC_STATUS_STYLE: Record<string, string> = {
  success: "text-emerald-400",
  partial: "text-amber-400",
  failed: "text-rose-400",
};

export default function IntegrationHub() {
  const [activeCategory, setActiveCategory] = useState<Category | "all">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = INTEGRATIONS.filter((i) => {
    const matchesCat =
      activeCategory === "all" || i.category === activeCategory;
    const matchesSearch =
      !searchQuery ||
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const connectedCount = INTEGRATIONS.filter(
    (i) => i.status === "connected",
  ).length;
  const errorCount = INTEGRATIONS.filter((i) => i.status === "error").length;
  const pendingCount = INTEGRATIONS.filter((i) => i.status === "pending").length;
  const totalSyncs = INTEGRATIONS.reduce((s, i) => s + i.syncCount, 0);

  const selected = selectedId
    ? INTEGRATIONS.find((i) => i.id === selectedId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Integration Hub
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Manage third-party services and data pipelines
          </p>
        </div>
        <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded text-sm font-medium transition-colors">
          + Add Integration
        </button>
      </div>

      {/* Status Summary Bar */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Connected
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1">
            {connectedCount}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Errors
          </div>
          <div className="text-2xl font-bold text-rose-400 mt-1">
            {errorCount}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Pending
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1">
            {pendingCount}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3">
          <div className="text-zinc-500 text-xs font-medium uppercase tracking-wider">
            Total Syncs
          </div>
          <div className="text-2xl font-bold text-indigo-400 mt-1">
            {totalSyncs.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Search + Category Tabs */}
      <div className="flex items-center gap-4 mb-5">
        <input
          type="text"
          placeholder="Search integrations…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-2 text-sm w-64 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
        />
        <div className="flex gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveCategory("all")}
            className={cn(
              "px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors",
              activeCategory === "all"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-white",
            )}
          >
            All ({INTEGRATIONS.length})
          </button>
          {ALL_CATEGORIES.map((cat) => {
            const count = INTEGRATIONS.filter((i) => i.category === cat).length;
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded text-sm font-medium whitespace-nowrap transition-colors",
                  activeCategory === cat
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-800 text-zinc-400 hover:text-white",
                )}
              >
                {CATEGORY_LABEL[cat]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Layout: Grid + Detail Panel */}
      <div className="flex gap-5">
        {/* Cards Grid */}
        <div
          className={cn(
            "grid gap-3 flex-1 auto-rows-min",
            selected ? "grid-cols-2" : "grid-cols-3",
          )}
        >
          {filtered.map((intg) => (
            <button
              key={intg.id}
              onClick={() =>
                setSelectedId(selectedId === intg.id ? null : intg.id)
              }
              className={cn(
                "bg-zinc-900 border rounded-lg p-4 text-left transition-all hover:border-zinc-600",
                selectedId === intg.id
                  ? "border-indigo-500 ring-1 ring-indigo-500/30"
                  : "border-zinc-800",
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{intg.emoji}</span>
                  <div>
                    <div className="font-semibold text-white">{intg.name}</div>
                    <span
                      className={cn(
                        "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded mt-1",
                        CATEGORY_BADGE[intg.category],
                      )}
                    >
                      {CATEGORY_LABEL[intg.category]}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <div
                    className={cn(
                      "w-2 h-2 rounded-full",
                      STATUS_COLOR[intg.status],
                    )}
                  />
                  <span
                    className={cn(
                      "text-xs font-medium",
                      STATUS_TEXT[intg.status],
                    )}
                  >
                    {statusLabel(intg.status)}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Last sync: {formatRelativeTime(intg.lastSync)}</span>
                <span>{intg.syncCount.toLocaleString()} syncs</span>
              </div>

              <div className="mt-3 pt-3 border-t border-zinc-800 flex justify-end">
                <span
                  className={cn(
                    "px-3 py-1 rounded text-xs font-medium transition-colors",
                    intg.status === "error"
                      ? "bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                      : intg.status === "connected"
                        ? "bg-indigo-600 hover:bg-indigo-500 text-white"
                        : "bg-zinc-700 hover:bg-zinc-600 text-white",
                  )}
                >
                  {actionLabel(intg.status)}
                </span>
              </div>
            </button>
          ))}

          {filtered.length === 0 && (
            <div className="col-span-3 py-16 text-center text-zinc-500">
              No integrations match your filters.
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div className="w-96 shrink-0 bg-zinc-900 border border-zinc-800 rounded-lg p-5 self-start sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{selected.emoji}</span>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {selected.name}
                  </h2>
                  <span
                    className={cn(
                      "inline-block text-[10px] font-medium px-1.5 py-0.5 rounded",
                      CATEGORY_BADGE[selected.category],
                    )}
                  >
                    {CATEGORY_LABEL[selected.category]}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                className="text-zinc-500 hover:text-white text-lg leading-none px-1"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2 mb-5">
              <div
                className={cn(
                  "w-2.5 h-2.5 rounded-full",
                  STATUS_COLOR[selected.status],
                )}
              />
              <span
                className={cn(
                  "text-sm font-medium",
                  STATUS_TEXT[selected.status],
                )}
              >
                {statusLabel(selected.status)}
              </span>
              <span className="text-zinc-600 text-sm">·</span>
              <span className="text-zinc-400 text-sm">
                {selected.syncCount.toLocaleString()} total syncs
              </span>
            </div>

            {/* Configuration */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Configuration
              </h3>
              <div className="space-y-2.5">
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">
                    Webhook URL
                  </label>
                  <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-300 font-mono truncate">
                    {selected.webhookUrl}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">
                    API Key
                  </label>
                  <div className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-xs text-zinc-400 font-mono">
                    {selected.apiKey}
                  </div>
                </div>
                <div>
                  <label className="text-[11px] text-zinc-500 block mb-1">
                    Scopes
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.scopes.map((scope) => (
                      <span
                        key={scope}
                        className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] px-2 py-0.5 rounded font-mono"
                      >
                        {scope}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sync History */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Sync History
              </h3>
              <div className="space-y-1.5">
                {selected.syncHistory.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between bg-zinc-800/60 rounded px-3 py-2"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          entry.status === "success"
                            ? "bg-emerald-400"
                            : entry.status === "partial"
                              ? "bg-amber-400"
                              : "bg-rose-400",
                        )}
                      />
                      <span className="text-xs text-zinc-400">
                        {formatTimestamp(entry.timestamp)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-300 font-medium">
                        {entry.records.toLocaleString()} records
                      </span>
                      <span
                        className={cn(
                          "text-[10px] font-medium",
                          SYNC_STATUS_STYLE[entry.status],
                        )}
                      >
                        {entry.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sync Bar Chart */}
            <div className="mb-5">
              <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">
                Records per Sync
              </h3>
              <div className="flex items-end gap-1.5 h-16">
                {selected.syncHistory
                  .slice()
                  .reverse()
                  .map((entry, i) => {
                    const max = Math.max(
                      ...selected.syncHistory.map((e) => e.records),
                      1,
                    );
                    const pct = (entry.records / max) * 100;
                    return (
                      <div
                        key={i}
                        className="flex-1 flex flex-col items-center gap-1"
                      >
                        <div
                          className={cn(
                            "w-full rounded-sm transition-all",
                            entry.status === "failed"
                              ? "bg-rose-500/40"
                              : entry.status === "partial"
                                ? "bg-amber-500/50"
                                : "bg-indigo-500/60",
                          )}
                          style={{ height: `${Math.max(pct, 4)}%` }}
                        />
                      </div>
                    );
                  })}
              </div>
              <div className="flex gap-1.5 mt-1">
                {selected.syncHistory
                  .slice()
                  .reverse()
                  .map((_, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-[9px] text-zinc-600"
                    >
                      {i + 1}
                    </div>
                  ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              {selected.status === "connected" && (
                <button className="flex-1 bg-zinc-800 border border-zinc-700 hover:border-rose-500/50 text-rose-400 px-3 py-2 rounded text-sm font-medium transition-colors">
                  Disconnect
                </button>
              )}
              {selected.status === "error" && (
                <button className="flex-1 bg-rose-600 hover:bg-rose-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                  Reconnect
                </button>
              )}
              {(selected.status === "disconnected" ||
                selected.status === "pending") && (
                <button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                  {selected.status === "pending"
                    ? "Retry Connection"
                    : "Connect"}
                </button>
              )}
              <button className="flex-1 bg-zinc-800 border border-zinc-700 hover:border-zinc-600 text-white px-3 py-2 rounded text-sm font-medium transition-colors">
                Edit Config
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

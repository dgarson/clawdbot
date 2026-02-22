import React, { useState, useCallback } from "react";
import { cn } from "../lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type IntegrationStatus = "connected" | "disconnected" | "error" | "pending";
type IntegrationCategory = "ai" | "messaging" | "devtools" | "storage" | "productivity" | "monitoring";

interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  status: IntegrationStatus;
  logo: string;           // emoji placeholder
  connectedAt?: Date;
  lastActivity?: Date;
  detail?: string;
  features: string[];
  docsUrl?: string;
  isPremium?: boolean;
  config?: Record<string, string>;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const now = new Date();
const ago = (ms: number) => new Date(now.getTime() - ms);
const mins = (n: number) => n * 60_000;
const hrs = (n: number) => n * 3_600_000;
const days = (n: number) => n * 86_400_000;

const INTEGRATIONS: Integration[] = [
  // AI Providers
  {
    id: "anthropic",
    name: "Anthropic",
    description: "Claude models — claude-opus-4-6, claude-sonnet-4-6, claude-haiku",
    category: "ai",
    status: "connected",
    logo: "🧠",
    connectedAt: ago(days(30)),
    lastActivity: ago(mins(2)),
    detail: "API key authenticated. 4 models available. Daily budget tracking active.",
    features: ["Claude Opus 4.6", "Claude Sonnet 4.6", "Claude Haiku", "Tool use", "Vision", "Budget alerts"],
    config: { model: "claude-sonnet-4-6", budget: "$50/day" },
  },
  {
    id: "openai",
    name: "OpenAI",
    description: "GPT-4o, TTS-1-HD, Whisper, embeddings",
    category: "ai",
    status: "connected",
    logo: "⚡",
    connectedAt: ago(days(25)),
    lastActivity: ago(mins(14)),
    detail: "Authenticated. TTS-1-HD active (shimmer, chris voices). GPT-4o available.",
    features: ["GPT-4o", "TTS-1-HD", "Whisper STT", "text-embedding-3", "DALL-E 3"],
    config: { ttsVoice: "shimmer", model: "gpt-4o" },
  },
  {
    id: "minimax",
    name: "MiniMax",
    description: "MiniMax 2.5 — fast, cost-effective for code and tasks",
    category: "ai",
    status: "connected",
    logo: "🔷",
    connectedAt: ago(days(10)),
    lastActivity: ago(hrs(3)),
    detail: "MiniMax 2.5 connected. Used for worker agent code tasks.",
    features: ["MiniMax 2.5", "Fast inference", "Cost-effective", "Code generation"],
  },
  {
    id: "google-ai",
    name: "Google AI",
    description: "Gemini Pro, Gemini Flash — multimodal, long context",
    category: "ai",
    status: "disconnected",
    logo: "🌈",
    features: ["Gemini 2.0 Pro", "Gemini 2.0 Flash", "2M token context", "Video understanding"],
    isPremium: false,
  },
  // Messaging
  {
    id: "slack",
    name: "Slack",
    description: "Agent-to-channel messaging, reactions, pins, threads",
    category: "messaging",
    status: "connected",
    logo: "💬",
    connectedAt: ago(days(45)),
    lastActivity: ago(mins(5)),
    detail: "Connected to workspace openclawdev. Bot token active. 12 channels accessible.",
    features: ["Send messages", "Reactions", "Pin messages", "Thread replies", "File uploads", "Channel read"],
    config: { workspace: "openclawdev", botName: "OpenClaw" },
  },
  {
    id: "discord",
    name: "Discord",
    description: "Bot messaging, server notifications, voice channel alerts",
    category: "messaging",
    status: "disconnected",
    logo: "🎮",
    features: ["Bot messaging", "Server notifications", "Slash commands", "Role management"],
  },
  {
    id: "email",
    name: "Email (SMTP)",
    description: "Send email notifications and reports from agents",
    category: "messaging",
    status: "error",
    logo: "✉️",
    connectedAt: ago(days(15)),
    lastActivity: ago(hrs(12)),
    detail: "SMTP auth failed — credentials may have expired. Last successful send: 12h ago.",
    features: ["Send emails", "HTML templates", "Attachments", "Reply-to threading"],
    config: { host: "smtp.example.com", from: "agents@openclaw.dev" },
  },
  // Dev Tools
  {
    id: "github",
    name: "GitHub",
    description: "PRs, issues, branches, commits, code review",
    category: "devtools",
    status: "connected",
    logo: "🐙",
    connectedAt: ago(days(60)),
    lastActivity: ago(mins(20)),
    detail: "Authenticated as dgarson. Primary repo: dgarson/clawdbot. Rate limit: 4,821/5,000.",
    features: ["Pull requests", "Issues", "Branch management", "Code review", "Releases", "Webhooks"],
    config: { username: "dgarson", repo: "dgarson/clawdbot" },
  },
  {
    id: "linear",
    name: "Linear",
    description: "Issue tracking, project cycles, roadmap sync",
    category: "devtools",
    status: "disconnected",
    logo: "📐",
    features: ["Create issues", "Update status", "Assign members", "Cycle tracking", "Roadmap sync"],
    isPremium: true,
  },
  {
    id: "jira",
    name: "Jira",
    description: "Issue management, sprint tracking, Confluence docs",
    category: "devtools",
    status: "disconnected",
    logo: "🔵",
    features: ["Issue CRUD", "Sprint management", "Epic tracking", "JQL queries"],
  },
  // Storage
  {
    id: "s3",
    name: "Amazon S3",
    description: "File storage, agent artifact backup, data export",
    category: "storage",
    status: "disconnected",
    logo: "🪣",
    features: ["File upload/download", "Bucket management", "Presigned URLs", "Versioning"],
  },
  {
    id: "notion",
    name: "Notion",
    description: "Agent knowledge base, wiki sync, notes",
    category: "productivity",
    status: "pending",
    logo: "📝",
    connectedAt: ago(hours(2)),
    detail: "OAuth flow initiated. Waiting for workspace authorization.",
    features: ["Read pages", "Create/update pages", "Database sync", "Block operations"],
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Schedule-aware agents, meeting context, reminders",
    category: "productivity",
    status: "disconnected",
    logo: "📅",
    features: ["Read events", "Create events", "Availability check", "Meeting context"],
  },
  // Monitoring
  {
    id: "pagerduty",
    name: "PagerDuty",
    description: "Critical alert escalation from agent incidents",
    category: "monitoring",
    status: "disconnected",
    logo: "🚨",
    features: ["Create incidents", "Escalation policies", "On-call schedules", "Alert routing"],
    isPremium: true,
  },
  {
    id: "datadog",
    name: "Datadog",
    description: "Metrics, logs, and traces export from agent runtime",
    category: "monitoring",
    status: "disconnected",
    logo: "📊",
    features: ["Custom metrics", "Log shipping", "APM traces", "Dashboards"],
    isPremium: true,
  },
];

// ─── Constants ────────────────────────────────────────────────────────────────

function hours(n: number) { return n * 3_600_000; }

const STATUS_CONFIG: Record<IntegrationStatus, {
  label: string; dot: string; badge: string; text: string;
}> = {
  connected:    { label: "Connected",    dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/25", text: "text-emerald-400" },
  disconnected: { label: "Disconnected", dot: "bg-zinc-600",    badge: "bg-zinc-700/50 text-zinc-400 ring-1 ring-zinc-600/25",         text: "text-zinc-400" },
  error:        { label: "Error",        dot: "bg-rose-500",    badge: "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/25",         text: "text-rose-400" },
  pending:      { label: "Pending",      dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25",      text: "text-amber-400" },
};

const CATEGORY_CONFIG: Record<IntegrationCategory, { label: string; emoji: string }> = {
  ai:           { label: "AI Providers",  emoji: "🤖" },
  messaging:    { label: "Messaging",     emoji: "💬" },
  devtools:     { label: "Dev Tools",     emoji: "🔧" },
  storage:      { label: "Storage",       emoji: "🗄️" },
  productivity: { label: "Productivity",  emoji: "📋" },
  monitoring:   { label: "Monitoring",    emoji: "📡" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relTime(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

// ─── Integration Card ─────────────────────────────────────────────────────────

interface IntegrationCardProps {
  integration: Integration;
  onManage: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
}

function IntegrationCard({ integration: int, onManage, onConnect, onDisconnect }: IntegrationCardProps) {
  const cfg = STATUS_CONFIG[int.status];

  return (
    <div className={cn(
      "flex flex-col rounded-xl bg-zinc-900 border transition-colors",
      int.status === "connected" ? "border-zinc-700" : int.status === "error" ? "border-rose-500/20" : "border-zinc-800"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3 p-4">
        {/* Logo */}
        <div className="flex-none h-10 w-10 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xl">
          {int.logo}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-white">{int.name}</span>
            {int.isPremium && (
              <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-indigo-500/20 text-indigo-300 ring-1 ring-indigo-500/30">
                Pro
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{int.description}</p>
        </div>

        {/* Status badge */}
        <span className={cn("flex-none px-2 py-0.5 text-xs font-medium rounded-full", cfg.badge)}>
          {cfg.label}
        </span>
      </div>

      {/* Error alert */}
      {int.status === "error" && int.detail && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
          <p className="text-xs text-rose-300">{int.detail}</p>
        </div>
      )}

      {/* Pending info */}
      {int.status === "pending" && int.detail && (
        <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <p className="text-xs text-amber-300">{int.detail}</p>
        </div>
      )}

      {/* Connected meta */}
      {int.status === "connected" && (
        <div className="px-4 pb-3 flex items-center gap-4">
          {int.connectedAt && (
            <div>
              <p className="text-xs text-zinc-600">Connected</p>
              <p className="text-xs text-zinc-400">{relTime(int.connectedAt)}</p>
            </div>
          )}
          {int.lastActivity && (
            <div>
              <p className="text-xs text-zinc-600">Last active</p>
              <p className="text-xs text-zinc-400">{relTime(int.lastActivity)}</p>
            </div>
          )}
        </div>
      )}

      {/* Features */}
      <div className="px-4 pb-3 flex flex-wrap gap-1">
        {int.features.slice(0, 4).map((f) => (
          <span key={f} className="px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50">{f}</span>
        ))}
        {int.features.length > 4 && (
          <span className="px-1.5 py-0.5 text-xs rounded bg-zinc-800 text-zinc-600 border border-zinc-700/50">+{int.features.length - 4} more</span>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex items-center gap-2 mt-auto">
        {int.status === "connected" && (
          <>
            <button
              onClick={() => onManage(int.id)}
              aria-label={`Manage ${int.name} integration`}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 text-zinc-200 hover:bg-zinc-700 hover:text-white border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
            >
              Configure
            </button>
            <button
              onClick={() => onDisconnect(int.id)}
              aria-label={`Disconnect ${int.name}`}
              className="py-1.5 px-3 text-xs font-medium rounded-lg bg-zinc-900 text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
            >
              Disconnect
            </button>
          </>
        )}
        {int.status === "error" && (
          <>
            <button
              onClick={() => onManage(int.id)}
              aria-label={`Fix ${int.name} integration`}
              className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
            >
              Fix Configuration
            </button>
            <button
              onClick={() => onDisconnect(int.id)}
              aria-label={`Disconnect ${int.name}`}
              className="py-1.5 px-3 text-xs font-medium rounded-lg bg-zinc-900 text-zinc-500 hover:text-rose-400 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-colors"
            >
              Remove
            </button>
          </>
        )}
        {int.status === "disconnected" && (
          <button
            onClick={() => onConnect(int.id)}
            aria-label={`Connect ${int.name}`}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            Connect
          </button>
        )}
        {int.status === "pending" && (
          <button
            onClick={() => onManage(int.id)}
            aria-label={`Check status of ${int.name}`}
            className="flex-1 py-1.5 text-xs font-medium rounded-lg bg-amber-600/20 text-amber-300 hover:bg-amber-600/30 border border-amber-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-colors"
          >
            Check Status
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Configure Modal ──────────────────────────────────────────────────────────

interface ConfigModalProps {
  integration: Integration;
  onClose: () => void;
}

function ConfigModal({ integration: int, onClose }: ConfigModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="config-modal-title"
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md bg-zinc-900 border border-zinc-700 rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lg">
              {int.logo}
            </div>
            <div>
              <h2 id="config-modal-title" className="text-sm font-semibold text-white">{int.name} Configuration</h2>
              <p className="text-xs text-zinc-500">{CATEGORY_CONFIG[int.category].label}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close configuration"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>

        {/* Config fields */}
        <div className="p-5 space-y-4">
          {int.config && Object.entries(int.config).map(([key, val]) => (
            <div key={key}>
              <label htmlFor={`cfg-${key}`} className="block text-xs font-medium text-zinc-400 mb-1.5 capitalize">
                {key.replace(/([A-Z])/g, " $1").trim()}
              </label>
              <input
                id={`cfg-${key}`}
                type="text"
                defaultValue={val}
                className="w-full px-3 py-2 text-sm bg-zinc-950 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono"
              />
            </div>
          ))}
          {!int.config && (
            <p className="text-sm text-zinc-500 text-center py-4">No additional configuration required.</p>
          )}
        </div>

        {/* Features */}
        <div className="px-5 pb-4">
          <p className="text-xs font-medium text-zinc-500 mb-2">Enabled capabilities</p>
          <div className="grid grid-cols-2 gap-1">
            {int.features.map((f) => (
              <div key={f} className="flex items-center gap-1.5">
                <svg className="h-3 w-3 text-emerald-500 flex-none" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2 6l3 3 5-5" />
                </svg>
                <span className="text-xs text-zinc-400">{f}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            Save Changes
          </button>
          <button
            onClick={onClose}
            className="py-2 px-4 text-sm font-medium rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// Declare useEffect at the top so it's not just used inside ConfigModal
import { useEffect } from "react";

// ─── Main View ────────────────────────────────────────────────────────────────

type CategoryFilter = IntegrationCategory | "all";
type StatusFilter = IntegrationStatus | "all";
type SortOrder = "category" | "status" | "name";

export default function IntegrationHub() {
  const [integrations, setIntegrations] = useState<Integration[]>(INTEGRATIONS);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("category");
  const [managingId, setManagingId] = useState<string | null>(null);

  const filtered = integrations.filter((int) => {
    if (categoryFilter !== "all" && int.category !== categoryFilter) return false;
    if (statusFilter !== "all" && int.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return int.name.toLowerCase().includes(q) || int.description.toLowerCase().includes(q);
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortOrder === "name") return a.name.localeCompare(b.name);
    if (sortOrder === "status") {
      const order: IntegrationStatus[] = ["error", "pending", "connected", "disconnected"];
      return order.indexOf(a.status) - order.indexOf(b.status);
    }
    // category
    const order: IntegrationCategory[] = ["ai", "messaging", "devtools", "storage", "productivity", "monitoring"];
    return order.indexOf(a.category) - order.indexOf(b.category);
  });

  const stats = {
    connected: integrations.filter((i) => i.status === "connected").length,
    errors: integrations.filter((i) => i.status === "error").length,
    pending: integrations.filter((i) => i.status === "pending").length,
  };

  const handleManage = useCallback((id: string) => setManagingId(id), []);
  const handleCloseModal = useCallback(() => setManagingId(null), []);

  const handleConnect = useCallback((id: string) => {
    setIntegrations((prev) =>
      prev.map((int) => int.id === id ? { ...int, status: "pending" as const, detail: "OAuth flow initiated. Complete authorization in the popup." } : int)
    );
  }, []);

  const handleDisconnect = useCallback((id: string) => {
    setIntegrations((prev) =>
      prev.map((int) => int.id === id ? { ...int, status: "disconnected" as const, connectedAt: undefined, lastActivity: undefined, detail: undefined } : int)
    );
  }, []);

  const managingIntegration = managingId ? integrations.find((i) => i.id === managingId) ?? null : null;

  // Group by category for category sort
  const groupedByCategory = sortOrder === "category"
    ? (Object.keys(CATEGORY_CONFIG) as IntegrationCategory[]).reduce<Record<IntegrationCategory, Integration[]>>(
        (acc, cat) => {
          acc[cat] = sorted.filter((i) => i.category === cat);
          return acc;
        },
        {} as Record<IntegrationCategory, Integration[]>
      )
    : null;

  return (
    <div className="flex flex-col h-full bg-zinc-950 overflow-y-auto">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-semibold text-white">Integration Hub</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Connect OpenClaw to AI providers, tools, and services
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5 text-xs text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {stats.connected} connected
              </span>
              {stats.errors > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-rose-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                  {stats.errors} error{stats.errors > 1 ? "s" : ""}
                </span>
              )}
              {stats.pending > 0 && (
                <span className="flex items-center gap-1.5 text-xs text-amber-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  {stats.pending} pending
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Filters + sort */}
      <div className="flex-none px-6 py-3 border-b border-zinc-800 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500 pointer-events-none" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <circle cx="7" cy="7" r="4.5" /><path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations…"
            aria-label="Search integrations"
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          aria-label="Filter by status"
          className="py-1.5 pl-2 pr-6 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Status</option>
          <option value="connected">Connected</option>
          <option value="disconnected">Disconnected</option>
          <option value="error">Error</option>
          <option value="pending">Pending</option>
        </select>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          aria-label="Filter by category"
          className="py-1.5 pl-2 pr-6 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="all">All Categories</option>
          {(Object.entries(CATEGORY_CONFIG) as [IntegrationCategory, { label: string }][]).map(([cat, cfg]) => (
            <option key={cat} value={cat}>{cfg.label}</option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as SortOrder)}
          aria-label="Sort order"
          className="py-1.5 pl-2 pr-6 text-sm bg-zinc-900 border border-zinc-700 rounded-lg text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
        >
          <option value="category">By Category</option>
          <option value="status">By Status</option>
          <option value="name">By Name</option>
        </select>

        {(search || statusFilter !== "all" || categoryFilter !== "all") && (
          <button
            onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}
            aria-label="Clear filters"
            className="text-xs text-indigo-400 hover:text-indigo-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded px-1"
          >
            Clear
          </button>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-6 py-5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <span className="text-4xl">🔌</span>
            <p className="text-sm font-medium text-zinc-300">No integrations match your filters</p>
            <button
              onClick={() => { setSearch(""); setStatusFilter("all"); setCategoryFilter("all"); }}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {sortOrder === "category" && groupedByCategory ? (
          <div className="space-y-8">
            {(Object.entries(CATEGORY_CONFIG) as [IntegrationCategory, { label: string; emoji: string }][]).map(([cat, catCfg]) => {
              const items = groupedByCategory[cat];
              if (!items || items.length === 0) return null;
              return (
                <section key={cat} aria-labelledby={`cat-${cat}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-base">{catCfg.emoji}</span>
                    <h2 id={`cat-${cat}`} className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                      {catCfg.label}
                    </h2>
                    <span className="text-xs text-zinc-600">({items.length})</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {items.map((int) => (
                      <IntegrationCard
                        key={int.id}
                        integration={int}
                        onManage={handleManage}
                        onConnect={handleConnect}
                        onDisconnect={handleDisconnect}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {sorted.map((int) => (
              <IntegrationCard
                key={int.id}
                integration={int}
                onManage={handleManage}
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
              />
            ))}
          </div>
        )}
      </div>

      {/* Configure Modal */}
      {managingIntegration && (
        <ConfigModal integration={managingIntegration} onClose={handleCloseModal} />
      )}
    </div>
  );
}

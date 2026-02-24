import React, { useState, useCallback, useRef, useEffect } from "react";
import { cn } from "../lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type Scope =
  | "agents:read"
  | "agents:write"
  | "sessions:read"
  | "sessions:write"
  | "models:read"
  | "nodes:read"
  | "nodes:write"
  | "cron:read"
  | "cron:write"
  | "files:read"
  | "files:write"
  | "admin";

type KeyStatus = "active" | "revoked" | "expired";

interface ApiKey {
  id: string;
  name: string;
  prefix: string;        // e.g. "oc_sk_..."
  scopes: Scope[];
  status: KeyStatus;
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  lastUsedIp: string | null;
  usageCount: number;
}

interface Webhook {
  id: string;
  name: string;
  url: string;
  events: string[];
  status: "active" | "paused" | "failing";
  secret: string;
  lastFiredAt: Date | null;
  successRate: number; // 0-100
  totalDeliveries: number;
}

type Tab = "api-keys" | "webhooks";

// ─── Seed Data ───────────────────────────────────────────────────────────────

const SCOPES: { id: Scope; label: string; group: string; desc: string }[] = [
  { id: "agents:read",    label: "Agents Read",    group: "Agents",   desc: "List and read agent configurations" },
  { id: "agents:write",   label: "Agents Write",   group: "Agents",   desc: "Create, update, and delete agents" },
  { id: "sessions:read",  label: "Sessions Read",  group: "Sessions", desc: "View session history and logs" },
  { id: "sessions:write", label: "Sessions Write", group: "Sessions", desc: "Create and terminate sessions" },
  { id: "models:read",    label: "Models Read",    group: "Models",   desc: "List available models and pricing" },
  { id: "nodes:read",     label: "Nodes Read",     group: "Nodes",    desc: "View paired nodes and status" },
  { id: "nodes:write",    label: "Nodes Write",    group: "Nodes",    desc: "Pair, configure, and remove nodes" },
  { id: "cron:read",      label: "Cron Read",      group: "Cron",     desc: "List scheduled jobs" },
  { id: "cron:write",     label: "Cron Write",     group: "Cron",     desc: "Create, update, and delete cron jobs" },
  { id: "files:read",     label: "Files Read",     group: "Files",    desc: "Read workspace file contents" },
  { id: "files:write",    label: "Files Write",    group: "Files",    desc: "Write and delete workspace files" },
  { id: "admin",          label: "Admin",          group: "Admin",    desc: "Full administrative access — use sparingly" },
];

const WEBHOOK_EVENTS = [
  "agent.created", "agent.updated", "agent.deleted",
  "session.started", "session.ended", "session.error",
  "cron.fired", "cron.failed",
  "node.paired", "node.disconnected",
  "model.usage", "billing.threshold",
];

function randomHex(len: number): string {
  return Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
}

function makeKey(i: number): ApiKey {
  const statuses: KeyStatus[] = ["active", "active", "active", "revoked", "expired"];
  const scopeGroups: Scope[][] = [
    ["agents:read", "agents:write", "sessions:read"],
    ["models:read", "nodes:read", "files:read"],
    ["admin"],
    ["agents:read", "cron:read", "cron:write"],
    ["sessions:read", "sessions:write", "files:read", "files:write"],
  ];
  const names = ["Production Key", "CI/CD Pipeline", "Admin Backdoor", "Monitoring Bot", "Dev Integration"];
  const ips = ["104.21.8.1", "185.220.101.9", "31.13.72.36", "192.168.1.100", null];
  const now = new Date();
  const created = new Date(now.getTime() - (i + 1) * 14 * 24 * 3600_000);
  const expires = i === 2 ? null : new Date(now.getTime() + (4 - i) * 90 * 24 * 3600_000);
  return {
    id: `key_${randomHex(8)}`,
    name: names[i % names.length],
    prefix: `oc_sk_${randomHex(6)}`,
    scopes: scopeGroups[i % scopeGroups.length],
    status: statuses[i % statuses.length],
    createdAt: created,
    expiresAt: expires,
    lastUsedAt: i < 3 ? new Date(now.getTime() - i * 2 * 3600_000) : null,
    lastUsedIp: ips[i % ips.length],
    usageCount: [4812, 291, 18403, 0, 1043][i % 5],
  };
}

function makeWebhook(i: number): Webhook {
  const names = ["Slack Alert Relay", "GitHub CI Trigger", "PagerDuty Escalation", "Analytics Sink"];
  const urls = [
    "https://hooks.slack.com/services/T0.../B0.../xxx",
    "https://api.github.com/repos/dgarson/clawdbot/dispatches",
    "https://events.pagerduty.com/v2/enqueue",
    "https://ingest.segment.io/v1/track",
  ];
  const evtSets = [
    ["session.error", "cron.failed", "node.disconnected"],
    ["agent.created", "agent.updated", "cron.fired"],
    ["session.error", "model.usage", "billing.threshold"],
    ["agent.created", "session.started", "session.ended", "cron.fired", "model.usage"],
  ];
  const statuses: Webhook["status"][] = ["active", "active", "failing", "paused"];
  const now = new Date();
  return {
    id: `wh_${randomHex(8)}`,
    name: names[i % names.length],
    url: urls[i % urls.length],
    events: evtSets[i % evtSets.length],
    status: statuses[i % statuses.length],
    secret: `whsec_${randomHex(24)}`,
    lastFiredAt: i < 3 ? new Date(now.getTime() - i * 5 * 3600_000) : null,
    successRate: [99.4, 100, 62.1, 0][i % 4],
    totalDeliveries: [2341, 88, 417, 0][i % 4],
  };
}

const INITIAL_KEYS: ApiKey[] = Array.from({ length: 5 }, (_, i) => makeKey(i));
const INITIAL_WEBHOOKS: Webhook[] = Array.from({ length: 4 }, (_, i) => makeWebhook(i));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(date: Date | null): string {
  if (!date) {return "never";}
  const diff = Date.now() - date.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) {return `${s}s ago`;}
  const m = Math.floor(s / 60);
  if (m < 60) {return `${m}m ago`;}
  const h = Math.floor(m / 60);
  if (h < 24) {return `${h}h ago`;}
  return `${Math.floor(h / 24)}d ago`;
}

function formatDate(date: Date | null): string {
  if (!date) {return "Never";}
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function statusBadge(status: KeyStatus): string {
  return {
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    revoked: "bg-red-500/15 text-red-400 border border-red-500/30",
    expired: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
  }[status];
}

function webhookStatusBadge(status: Webhook["status"]): string {
  return {
    active: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30",
    paused: "bg-[var(--color-surface-3)]/15 text-[var(--color-text-secondary)] border border-[var(--color-surface-3)]/30",
    failing: "bg-red-500/15 text-red-400 border border-red-500/30",
  }[status];
}

// ─── Copy Button ─────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }, [text]);
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label ?? "value"}`}
      className="ml-1.5 px-2 py-0.5 rounded text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
    >
      {copied ? "✓ copied" : "copy"}
    </button>
  );
}

// ─── Create Key Modal ─────────────────────────────────────────────────────────

interface CreateKeyModalProps {
  onClose: () => void;
  onCreated: (key: ApiKey, rawSecret: string) => void;
}

function CreateKeyModal({ onClose, onCreated }: CreateKeyModalProps) {
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<Scope>>(new Set(["agents:read"]));
  const [expiry, setExpiry] = useState<"30" | "90" | "365" | "never">("90");
  const [step, setStep] = useState<"form" | "reveal">("form");
  const [revealKey, setRevealKey] = useState("");
  const [revealKeyObj, setRevealKeyObj] = useState<ApiKey | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const toggleScope = (s: Scope) => {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      if (next.has(s)) {next.delete(s);} else {next.add(s);}
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim() || selectedScopes.size === 0) {return;}
    const raw = `oc_sk_${randomHex(32)}`;
    const now = new Date();
    let expiresAt: Date | null = null;
    if (expiry !== "never") {
      expiresAt = new Date(now.getTime() + parseInt(expiry) * 24 * 3600_000);
    }
    const newKey: ApiKey = {
      id: `key_${randomHex(8)}`,
      name: name.trim(),
      prefix: raw.slice(0, 14),
      scopes: Array.from(selectedScopes),
      status: "active",
      createdAt: now,
      expiresAt,
      lastUsedAt: null,
      lastUsedIp: null,
      usageCount: 0,
    };
    setRevealKey(raw);
    setRevealKeyObj(newKey);
    setStep("reveal");
    onCreated(newKey, raw);
  };

  const groups = Array.from(new Set(SCOPES.map(s => s.group)));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create API Key"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) {onClose();} }}
    >
      <div className="w-full max-w-lg bg-[var(--color-surface-1)] border border-white/10 rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-semibold text-base">
            {step === "form" ? "Create API Key" : "Key Created — Copy Now"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
          >
            ✕
          </button>
        </div>

        {step === "form" ? (
          <div className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label htmlFor="key-name" className="block text-sm font-medium mb-1.5">
                Key Name <span className="text-red-400">*</span>
              </label>
              <input
                id="key-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Production Bot"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
              />
            </div>

            {/* Expiry */}
            <div>
              <span className="block text-sm font-medium mb-1.5">Expiration</span>
              <div className="flex gap-2 flex-wrap">
                {(["30", "90", "365", "never"] as const).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setExpiry(v)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                      expiry === v
                        ? "bg-violet-600 border-violet-500 text-[var(--color-text-primary)]"
                        : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                    )}
                  >
                    {v === "never" ? "No Expiry" : `${v} days`}
                  </button>
                ))}
              </div>
            </div>

            {/* Scopes */}
            <div>
              <span className="block text-sm font-medium mb-2">Scopes <span className="text-red-400">*</span></span>
              <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                {groups.map(group => (
                  <div key={group}>
                    <p className="text-[10px] uppercase tracking-widest text-muted-foreground/60 mb-1.5">{group}</p>
                    <div className="space-y-1">
                      {SCOPES.filter(s => s.group === group).map(scope => (
                        <label
                          key={scope.id}
                          className={cn(
                            "flex items-start gap-3 px-3 py-2 rounded-lg cursor-pointer border transition-all",
                            selectedScopes.has(scope.id)
                              ? "bg-violet-500/10 border-violet-500/30"
                              : "bg-white/5 border-white/5 hover:bg-white/8 hover:border-white/10"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={selectedScopes.has(scope.id)}
                            onChange={() => toggleScope(scope.id)}
                            className="mt-0.5 accent-violet-500 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className={cn("text-xs font-mono font-medium", selectedScopes.has(scope.id) ? "text-violet-300" : "text-foreground")}>
                              {scope.id}
                            </p>
                            <p className="text-xs text-muted-foreground">{scope.desc}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Admin warning */}
            {selectedScopes.has("admin") && (
              <div className="flex gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2">
                <span className="text-amber-400 shrink-0">⚠</span>
                <p className="text-xs text-amber-300">
                  Admin scope grants full access. Only use for trusted internal automation.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={!name.trim() || selectedScopes.size === 0}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Generate Key
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-5">
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-amber-300 mb-1">⚠ Copy this key now</p>
              <p className="text-xs text-amber-200/80">
                This is the only time you'll see the full key. We don't store it.
              </p>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">Your new API key</p>
              <div className="flex items-center bg-black/60 border border-white/10 rounded-lg px-3 py-2.5">
                <code className="text-xs font-mono text-emerald-300 break-all flex-1">{revealKey}</code>
                <CopyButton text={revealKey} label="API key" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div>
                <p className="font-medium text-foreground mb-0.5">Name</p>
                <p>{revealKeyObj?.name}</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">Scopes</p>
                <p>{revealKeyObj?.scopes.length} assigned</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">Expires</p>
                <p>{formatDate(revealKeyObj?.expiresAt ?? null)}</p>
              </div>
              <div>
                <p className="font-medium text-foreground mb-0.5">Status</p>
                <p className="text-emerald-400">Active</p>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Create Webhook Modal ─────────────────────────────────────────────────────

interface CreateWebhookModalProps {
  onClose: () => void;
  onCreated: (wh: Webhook) => void;
}

function CreateWebhookModal({ onClose, onCreated }: CreateWebhookModalProps) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set(["session.error", "cron.failed"]));
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => { nameRef.current?.focus(); }, []);

  const toggle = (ev: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(ev)) {next.delete(ev);} else {next.add(ev);}
      return next;
    });
  };

  const handleCreate = () => {
    if (!name.trim() || !url.trim() || selectedEvents.size === 0) {return;}
    const wh: Webhook = {
      id: `wh_${randomHex(8)}`,
      name: name.trim(),
      url: url.trim(),
      events: Array.from(selectedEvents),
      status: "active",
      secret: `whsec_${randomHex(24)}`,
      lastFiredAt: null,
      successRate: 100,
      totalDeliveries: 0,
    };
    onCreated(wh);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Create Webhook"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) {onClose();} }}
    >
      <div className="w-full max-w-lg bg-[var(--color-surface-1)] border border-white/10 rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-semibold text-base">Create Webhook</h2>
          <button type="button" onClick={onClose} aria-label="Close modal"
            className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <label htmlFor="wh-name" className="block text-sm font-medium mb-1.5">
              Name <span className="text-red-400">*</span>
            </label>
            <input id="wh-name" ref={nameRef} type="text" value={name}
              onChange={e => setName(e.target.value)} placeholder="e.g. Slack Alerts"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <label htmlFor="wh-url" className="block text-sm font-medium mb-1.5">
              Endpoint URL <span className="text-red-400">*</span>
            </label>
            <input id="wh-url" type="url" value={url}
              onChange={e => setUrl(e.target.value)} placeholder="https://your-server.com/webhooks/openclaw"
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          <div>
            <span className="block text-sm font-medium mb-2">Events <span className="text-red-400">*</span></span>
            <div className="flex flex-wrap gap-2">
              {WEBHOOK_EVENTS.map(ev => (
                <button key={ev} type="button" onClick={() => toggle(ev)}
                  aria-pressed={selectedEvents.has(ev)}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-mono border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                    selectedEvents.has(ev)
                      ? "bg-violet-600 border-violet-500 text-[var(--color-text-primary)]"
                      : "bg-white/5 border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10"
                  )}
                >
                  {ev}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              Cancel
            </button>
            <button type="button" onClick={handleCreate}
              disabled={!name.trim() || !url.trim() || selectedEvents.size === 0}
              className="px-4 py-2 text-sm rounded-lg bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              Create Webhook
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── API Keys Tab ─────────────────────────────────────────────────────────────

interface ApiKeysTabProps {
  keys: ApiKey[];
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
  onRotate: (id: string) => void;
  onCreate: () => void;
  revealedKeys: Record<string, string>;
}

function ApiKeysTab({ keys, onRevoke, onDelete, onRotate, onCreate, revealedKeys }: ApiKeysTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(keys[0]?.id ?? null);
  const selected = keys.find(k => k.id === selectedId) ?? null;
  const [filterStatus, setFilterStatus] = useState<"all" | KeyStatus>("all");
  const [search, setSearch] = useState("");

  const filtered = keys.filter(k => {
    if (filterStatus !== "all" && k.status !== filterStatus) {return false;}
    if (search && !k.name.toLowerCase().includes(search.toLowerCase())) {return false;}
    return true;
  });

  const statusCounts = {
    active: keys.filter(k => k.status === "active").length,
    revoked: keys.filter(k => k.status === "revoked").length,
    expired: keys.filter(k => k.status === "expired").length,
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-240px)] min-h-0">
      {/* Left list */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {(["active", "revoked", "expired"] as KeyStatus[]).map(s => (
            <button key={s} type="button" onClick={() => setFilterStatus(filterStatus === s ? "all" : s)}
              aria-pressed={filterStatus === s}
              className={cn(
                "rounded-lg p-2 text-center border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                filterStatus === s ? "bg-violet-600/20 border-violet-500/50" : "bg-white/5 border-white/10 hover:bg-white/8"
              )}
            >
              <p className="text-lg font-bold">{statusCounts[s]}</p>
              <p className="text-[10px] text-muted-foreground capitalize">{s}</p>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">🔍</span>
          <input type="search" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search keys…" aria-label="Search API keys"
            className="w-full bg-black/40 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5" role="listbox" aria-label="API Keys">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No keys match filter.</div>
          ) : filtered.map(key => (
            <button key={key.id} type="button"
              role="option"
              aria-selected={selectedId === key.id}
              onClick={() => setSelectedId(key.id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                selectedId === key.id
                  ? "bg-violet-600/15 border-violet-500/40"
                  : "bg-white/4 border-white/8 hover:bg-white/7 hover:border-white/12"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">{key.name}</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0 ml-2", statusBadge(key.status))}>
                  {key.status}
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground">{key.prefix}•••</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Used {relativeTime(key.lastUsedAt)} · {key.usageCount.toLocaleString()} calls
              </p>
            </button>
          ))}
        </div>

        <button type="button" onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <span aria-hidden>+</span> Generate New Key
        </button>
      </div>

      {/* Right detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a key to view details.
          </div>
        ) : (
          <div className="bg-white/4 border border-white/10 rounded-xl p-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{selected.id}</p>
              </div>
              <span className={cn("text-xs font-medium px-2 py-1 rounded-full capitalize shrink-0", statusBadge(selected.status))}>
                {selected.status}
              </span>
            </div>

            {/* Key value */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Key (masked)</p>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                {revealedKeys[selected.id] ? (
                  <code className="text-xs font-mono text-emerald-300 break-all flex-1">
                    {revealedKeys[selected.id]}
                  </code>
                ) : (
                  <code className="text-xs font-mono text-foreground flex-1">
                    {selected.prefix}{"•".repeat(28)}
                  </code>
                )}
                {revealedKeys[selected.id] && <CopyButton text={revealedKeys[selected.id]} label="API key" />}
              </div>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Created", value: formatDate(selected.createdAt) },
                { label: "Expires", value: formatDate(selected.expiresAt) },
                { label: "Last Used", value: relativeTime(selected.lastUsedAt) },
                { label: "Last IP", value: selected.lastUsedIp ?? "—" },
                { label: "Total Calls", value: selected.usageCount.toLocaleString() },
                { label: "Scopes", value: `${selected.scopes.length} assigned` },
              ].map(m => (
                <div key={m.label} className="bg-black/30 rounded-lg p-3">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-0.5">{m.label}</p>
                  <p className="text-sm font-medium">{m.value}</p>
                </div>
              ))}
            </div>

            {/* Scopes */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Scopes</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.scopes.map(s => (
                  <span key={s}
                    className={cn(
                      "px-2 py-0.5 rounded text-xs font-mono border",
                      s === "admin"
                        ? "bg-red-500/15 text-red-300 border-red-500/30"
                        : "bg-violet-500/10 text-violet-300 border-violet-500/20"
                    )}
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>

            {/* Usage sparkline placeholder */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Last 7 Days Activity</p>
              <div className="flex items-end gap-1 h-10">
                {Array.from({ length: 28 }, (_, i) => {
                  const h = Math.max(2, Math.floor(Math.random() * 40));
                  return (
                    <div key={i}
                      style={{ height: `${h}px` }}
                      className="flex-1 bg-violet-500/30 rounded-t hover:bg-violet-500/60 transition-colors"
                      title={`${Math.floor(Math.random() * 100)} calls`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground/60 mt-1">
                <span>7 days ago</span><span>Today</span>
              </div>
            </div>

            {/* Actions */}
            {selected.status === "active" && (
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={() => onRotate(selected.id)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  🔄 Rotate
                </button>
                <button type="button" onClick={() => onRevoke(selected.id)}
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:text-amber-200 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  🚫 Revoke
                </button>
                <button type="button" onClick={() => onDelete(selected.id)}
                  className="px-3 py-2 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  🗑
                </button>
              </div>
            )}
            {selected.status !== "active" && (
              <button type="button" onClick={() => onDelete(selected.id)}
                className="w-full px-3 py-2 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                🗑 Delete Key
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Webhooks Tab ─────────────────────────────────────────────────────────────

interface WebhooksTabProps {
  webhooks: Webhook[];
  onDelete: (id: string) => void;
  onToggle: (id: string) => void;
  onCreate: () => void;
}

function WebhooksTab({ webhooks, onDelete, onToggle, onCreate }: WebhooksTabProps) {
  const [selectedId, setSelectedId] = useState<string | null>(webhooks[0]?.id ?? null);
  const selected = webhooks.find(w => w.id === selectedId) ?? null;

  return (
    <div className="flex gap-4 h-[calc(100vh-240px)] min-h-0">
      {/* Left list */}
      <div className="w-80 shrink-0 flex flex-col gap-3">
        <div className="flex-1 overflow-y-auto space-y-1.5" role="listbox" aria-label="Webhooks">
          {webhooks.length === 0 ? (
            <div className="text-center py-10 text-sm text-muted-foreground">No webhooks yet.</div>
          ) : webhooks.map(wh => (
            <button key={wh.id} type="button"
              role="option"
              aria-selected={selectedId === wh.id}
              onClick={() => setSelectedId(wh.id)}
              className={cn(
                "w-full text-left px-3 py-3 rounded-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                selectedId === wh.id
                  ? "bg-violet-600/15 border-violet-500/40"
                  : "bg-white/4 border-white/8 hover:bg-white/7 hover:border-white/12"
              )}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium truncate">{wh.name}</span>
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0 ml-2", webhookStatusBadge(wh.status))}>
                  {wh.status}
                </span>
              </div>
              <p className="text-xs font-mono text-muted-foreground truncate">{wh.url}</p>
              <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground/70">
                <span>✉ {wh.totalDeliveries.toLocaleString()}</span>
                <span>✓ {wh.successRate}%</span>
                <span>{wh.events.length} events</span>
              </div>
            </button>
          ))}
        </div>

        <button type="button" onClick={onCreate}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-[var(--color-text-primary)] text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
          <span aria-hidden>+</span> Add Webhook
        </button>
      </div>

      {/* Right detail */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Select a webhook to view details.
          </div>
        ) : (
          <div className="bg-white/4 border border-white/10 rounded-xl p-5 space-y-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold">{selected.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{selected.id}</p>
              </div>
              <span className={cn("text-xs font-medium px-2 py-1 rounded-full capitalize shrink-0", webhookStatusBadge(selected.status))}>
                {selected.status}
              </span>
            </div>

            {/* URL */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Endpoint URL</p>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-foreground break-all flex-1">{selected.url}</code>
                <CopyButton text={selected.url} label="webhook URL" />
              </div>
            </div>

            {/* Secret */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Signing Secret</p>
              <div className="flex items-center bg-black/40 border border-white/10 rounded-lg px-3 py-2">
                <code className="text-xs font-mono text-muted-foreground flex-1">{"•".repeat(32)}</code>
                <CopyButton text={selected.secret} label="signing secret" />
              </div>
              <p className="text-[11px] text-muted-foreground/60 mt-1">
                Validate webhook payloads using HMAC-SHA256 with this secret.
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Deliveries", value: selected.totalDeliveries.toLocaleString() },
                { label: "Success Rate", value: `${selected.successRate}%` },
                { label: "Last Fired", value: relativeTime(selected.lastFiredAt) },
              ].map(m => (
                <div key={m.label} className="bg-black/30 rounded-lg p-3 text-center">
                  <p className={cn(
                    "text-lg font-bold",
                    m.label === "Success Rate" && selected.successRate < 80 ? "text-red-400" : ""
                  )}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Failing alert */}
            {selected.status === "failing" && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3">
                <p className="text-sm font-semibold text-red-400 mb-0.5">⚠ Delivery Failures Detected</p>
                <p className="text-xs text-red-300/80">
                  More than 20% of recent deliveries failed. Check your endpoint is reachable and returning 2xx.
                </p>
              </div>
            )}

            {/* Events */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Subscribed Events</p>
              <div className="flex flex-wrap gap-1.5">
                {selected.events.map(ev => (
                  <span key={ev} className="px-2 py-0.5 rounded text-xs font-mono bg-violet-500/10 text-violet-300 border border-violet-500/20">
                    {ev}
                  </span>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <button type="button" onClick={() => onToggle(selected.id)}
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                {selected.status === "active" ? "⏸ Pause" : "▶ Resume"}
              </button>
              <button type="button"
                className="flex-1 px-3 py-2 rounded-lg text-sm bg-white/5 hover:bg-white/10 border border-white/10 text-muted-foreground hover:text-foreground transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                📤 Send Test
              </button>
              <button type="button" onClick={() => onDelete(selected.id)}
                className="px-3 py-2 rounded-lg text-sm bg-red-500/10 hover:bg-red-500/15 border border-red-500/30 text-red-400 hover:text-red-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                🗑
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApiKeysManager() {
  const [activeTab, setActiveTab] = useState<Tab>("api-keys");
  const [keys, setKeys] = useState<ApiKey[]>(INITIAL_KEYS);
  const [webhooks, setWebhooks] = useState<Webhook[]>(INITIAL_WEBHOOKS);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [showCreateWebhook, setShowCreateWebhook] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState<Record<string, string>>({});

  // Key actions
  const revokeKey = useCallback((id: string) => {
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" as KeyStatus } : k));
  }, []);

  const deleteKey = useCallback((id: string) => {
    setKeys(prev => prev.filter(k => k.id !== id));
  }, []);

  const rotateKey = useCallback((id: string) => {
    const raw = `oc_sk_${randomHex(32)}`;
    setKeys(prev => prev.map(k => k.id === id ? { ...k, prefix: raw.slice(0, 14), lastUsedAt: null, usageCount: 0 } : k));
    setRevealedKeys(prev => ({ ...prev, [id]: raw }));
  }, []);

  const handleKeyCreated = useCallback((key: ApiKey, raw: string) => {
    setKeys(prev => [key, ...prev]);
    setRevealedKeys(prev => ({ ...prev, [key.id]: raw }));
  }, []);

  // Webhook actions
  const deleteWebhook = useCallback((id: string) => {
    setWebhooks(prev => prev.filter(w => w.id !== id));
  }, []);

  const toggleWebhook = useCallback((id: string) => {
    setWebhooks(prev => prev.map(w =>
      w.id === id ? { ...w, status: w.status === "active" ? "paused" : "active" } : w
    ));
  }, []);

  const handleWebhookCreated = useCallback((wh: Webhook) => {
    setWebhooks(prev => [wh, ...prev]);
  }, []);

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "api-keys", label: "API Keys", count: keys.filter(k => k.status === "active").length },
    { id: "webhooks", label: "Webhooks", count: webhooks.filter(w => w.status === "active").length },
  ];

  return (
    <div className="h-full flex flex-col gap-5">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">API & Integrations</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage API keys, signing secrets, and webhook endpoints.
          </p>
        </div>
        <a
          href="https://docs.openclaw.ai/api"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-violet-400 hover:text-violet-300 underline underline-offset-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
        >
          API Reference ↗
        </a>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
        <span className="text-amber-400 text-sm shrink-0 mt-0.5">🔐</span>
        <div className="text-xs text-amber-200/80">
          <span className="font-semibold text-amber-300">Keep your keys secret.</span>{" "}
          Never commit API keys to source control. Rotate keys that may have been exposed. Revoked keys stop working immediately.
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl w-fit border border-white/10" role="tablist">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              activeTab === tab.id
                ? "bg-violet-600 text-[var(--color-text-primary)] shadow"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            )}
          >
            {tab.label}
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              activeTab === tab.id ? "bg-white/20 text-[var(--color-text-primary)]" : "bg-white/10 text-muted-foreground"
            )}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0">
        {activeTab === "api-keys" ? (
          <ApiKeysTab
            keys={keys}
            onRevoke={revokeKey}
            onDelete={deleteKey}
            onRotate={rotateKey}
            onCreate={() => setShowCreateKey(true)}
            revealedKeys={revealedKeys}
          />
        ) : (
          <WebhooksTab
            webhooks={webhooks}
            onDelete={deleteWebhook}
            onToggle={toggleWebhook}
            onCreate={() => setShowCreateWebhook(true)}
          />
        )}
      </div>

      {/* Modals */}
      {showCreateKey && (
        <CreateKeyModal
          onClose={() => setShowCreateKey(false)}
          onCreated={handleKeyCreated}
        />
      )}
      {showCreateWebhook && (
        <CreateWebhookModal
          onClose={() => setShowCreateWebhook(false)}
          onCreated={handleWebhookCreated}
        />
      )}
    </div>
  );
}

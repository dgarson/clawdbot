import React, { useState, useCallback, useMemo } from "react";
import { cn } from "../lib/utils";

// ─── Types ──────────────────────────────────────────────────────────────────

type WebhookDirection = "inbound" | "outbound";
type WebhookStatus = "active" | "paused" | "error";
type DeliveryStatus = "success" | "failed" | "pending";

interface WebhookEndpoint {
  id: string;
  name: string;
  direction: WebhookDirection;
  status: WebhookStatus;
  url: string;
  secret?: string;
  events: string[];
  createdAt: string;
  lastTriggered?: string;
  successCount: number;
  failureCount: number;
}

interface DeliveryLog {
  id: string;
  webhookId: string;
  webhookName: string;
  event: string;
  status: DeliveryStatus;
  statusCode?: number;
  duration: number;
  timestamp: string;
  payload: string;
  response?: string;
}

type TabId = "endpoints" | "delivery-logs";

// ─── Seed Data ──────────────────────────────────────────────────────────────

const SEED_WEBHOOKS: WebhookEndpoint[] = [
  {
    id: "wh_01",
    name: "GitHub PR Events",
    direction: "outbound",
    status: "active",
    url: "https://api.github.com/webhooks/pr-events",
    secret: "ghp_s3cr3tK3y01",
    events: ["pr.opened", "pr.merged", "pr.closed"],
    createdAt: "2025-11-14T08:30:00Z",
    lastTriggered: "2026-02-21T23:14:02Z",
    successCount: 247,
    failureCount: 3,
  },
  {
    id: "wh_02",
    name: "Slack Notifications",
    direction: "outbound",
    status: "active",
    url: "https://hooks.slack.com/services/T00/B00/xxxx",
    secret: "xoxb-slack-secret-02",
    events: ["agent.error", "session.timeout"],
    createdAt: "2025-12-01T10:00:00Z",
    lastTriggered: "2026-02-21T19:42:11Z",
    successCount: 89,
    failureCount: 1,
  },
  {
    id: "wh_03",
    name: "Stripe Payment Events",
    direction: "inbound",
    status: "active",
    url: "https://openclaw.dev/api/webhooks/stripe",
    secret: "whsec_stripe03",
    events: ["payment.succeeded", "payment.failed"],
    createdAt: "2025-10-20T14:15:00Z",
    lastTriggered: "2026-02-22T00:05:33Z",
    successCount: 412,
    failureCount: 8,
  },
  {
    id: "wh_04",
    name: "PagerDuty Alerts",
    direction: "outbound",
    status: "paused",
    url: "https://events.pagerduty.com/v2/enqueue",
    secret: "pd_routing_key_04",
    events: ["system.alert", "health.degraded"],
    createdAt: "2026-01-05T09:00:00Z",
    lastTriggered: "2026-02-10T16:22:47Z",
    successCount: 34,
    failureCount: 0,
  },
  {
    id: "wh_05",
    name: "Internal Audit Hook",
    direction: "inbound",
    status: "active",
    url: "https://openclaw.dev/api/webhooks/audit",
    events: ["*"],
    createdAt: "2025-09-01T12:00:00Z",
    lastTriggered: "2026-02-22T01:30:10Z",
    successCount: 1823,
    failureCount: 12,
  },
  {
    id: "wh_06",
    name: "DeadLetter Catcher",
    direction: "inbound",
    status: "error",
    url: "https://openclaw.dev/api/webhooks/deadletter",
    secret: "dl_secret_06",
    events: ["*.failed"],
    createdAt: "2026-01-20T11:45:00Z",
    lastTriggered: "2026-02-21T22:58:00Z",
    successCount: 0,
    failureCount: 45,
  },
];

const SEED_DELIVERY_LOGS: DeliveryLog[] = [
  {
    id: "dl_01",
    webhookId: "wh_01",
    webhookName: "GitHub PR Events",
    event: "pr.merged",
    status: "success",
    statusCode: 200,
    duration: 142,
    timestamp: "2026-02-21T23:14:02Z",
    payload: '{"action":"merged","pull_request":{"id":4821,"title":"feat: add webhook manager","merged_by":"luis"}}',
    response: '{"ok":true}',
  },
  {
    id: "dl_02",
    webhookId: "wh_02",
    webhookName: "Slack Notifications",
    event: "agent.error",
    status: "success",
    statusCode: 200,
    duration: 89,
    timestamp: "2026-02-21T19:42:11Z",
    payload: '{"agent":"wes","error":"build_timeout","session":"s_abc123"}',
    response: '{"ok":true}',
  },
  {
    id: "dl_03",
    webhookId: "wh_03",
    webhookName: "Stripe Payment Events",
    event: "payment.succeeded",
    status: "success",
    statusCode: 200,
    duration: 210,
    timestamp: "2026-02-22T00:05:33Z",
    payload: '{"type":"payment.succeeded","data":{"amount":4900,"currency":"usd","customer":"cus_R8x"}}',
    response: '{"received":true}',
  },
  {
    id: "dl_04",
    webhookId: "wh_03",
    webhookName: "Stripe Payment Events",
    event: "payment.failed",
    status: "failed",
    statusCode: 502,
    duration: 3012,
    timestamp: "2026-02-21T18:30:45Z",
    payload: '{"type":"payment.failed","data":{"amount":9900,"currency":"usd","customer":"cus_Q2m","failure_code":"card_declined"}}',
    response: '{"error":"Bad Gateway"}',
  },
  {
    id: "dl_05",
    webhookId: "wh_06",
    webhookName: "DeadLetter Catcher",
    event: "payment.failed",
    status: "failed",
    statusCode: 503,
    duration: 5004,
    timestamp: "2026-02-21T22:58:00Z",
    payload: '{"original_webhook":"wh_03","event":"payment.failed","retry_count":3}',
    response: '{"error":"Service Unavailable"}',
  },
  {
    id: "dl_06",
    webhookId: "wh_05",
    webhookName: "Internal Audit Hook",
    event: "session.created",
    status: "success",
    statusCode: 200,
    duration: 34,
    timestamp: "2026-02-22T01:30:10Z",
    payload: '{"event":"session.created","session_id":"s_xyz789","agent":"quinn","channel":"slack"}',
    response: '{"ack":true}',
  },
  {
    id: "dl_07",
    webhookId: "wh_01",
    webhookName: "GitHub PR Events",
    event: "pr.opened",
    status: "pending",
    duration: 0,
    timestamp: "2026-02-22T01:38:00Z",
    payload: '{"action":"opened","pull_request":{"id":4822,"title":"fix: token refresh loop","author":"sam"}}',
  },
  {
    id: "dl_08",
    webhookId: "wh_04",
    webhookName: "PagerDuty Alerts",
    event: "system.alert",
    status: "success",
    statusCode: 202,
    duration: 178,
    timestamp: "2026-02-10T16:22:47Z",
    payload: '{"routing_key":"pd_key","event_action":"trigger","payload":{"summary":"CPU usage >95%","severity":"critical"}}',
    response: '{"status":"success","dedup_key":"srv-cpu-95"}',
  },
  {
    id: "dl_09",
    webhookId: "wh_02",
    webhookName: "Slack Notifications",
    event: "session.timeout",
    status: "failed",
    statusCode: 429,
    duration: 52,
    timestamp: "2026-02-20T14:11:30Z",
    payload: '{"agent":"piper","session":"s_timeout_001","idle_minutes":30}',
    response: '{"error":"rate_limited","retry_after":60}',
  },
  {
    id: "dl_10",
    webhookId: "wh_05",
    webhookName: "Internal Audit Hook",
    event: "agent.deployed",
    status: "success",
    statusCode: 200,
    duration: 28,
    timestamp: "2026-02-21T15:00:00Z",
    payload: '{"event":"agent.deployed","agent":"reed","version":"1.4.2","environment":"production"}',
    response: '{"ack":true}',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatDuration(ms: number): string {
  if (ms === 0) {return "—";}
  if (ms < 1000) {return `${ms}ms`;}
  return `${(ms / 1000).toFixed(1)}s`;
}

function generateId(): string {
  return `wh_${Date.now().toString(36)}`;
}

// ─── Inline SVG Icons ───────────────────────────────────────────────────────

function IconPlus({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="8" y1="2" x2="8" y2="14" />
      <line x1="2" y1="8" x2="14" y2="8" />
    </svg>
  );
}

function IconX({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <line x1="3" y1="3" x2="13" y2="13" />
      <line x1="13" y1="3" x2="3" y2="13" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 4h12" />
      <path d="M5 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
      <path d="M13 4v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" />
      <line x1="6.5" y1="7" x2="6.5" y2="11" />
      <line x1="9.5" y1="7" x2="9.5" y2="11" />
    </svg>
  );
}

function IconChevron({
  className,
  expanded,
}: {
  className?: string;
  expanded: boolean;
}) {
  return (
    <svg
      className={cn(
        "h-4 w-4 transition-transform duration-150",
        expanded && "rotate-90",
        className,
      )}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" />
    </svg>
  );
}

function IconEye({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" />
      <circle cx="8" cy="8" r="2" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-4 w-4", className)}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M1 1l14 14" />
      <path d="M6.5 6.5a2 2 0 0 0 2.83 2.83" />
      <path d="M3.6 3.6C2.1 4.8 1 8 1 8s2.5 5 7 5c1.3 0 2.5-.4 3.4-1" />
      <path d="M10.7 5.3C12 6.2 13 8 15 8s-2.5 5-7 5" />
    </svg>
  );
}

// ─── Status & Direction Badges ──────────────────────────────────────────────

const STATUS_STYLES: Record<WebhookStatus, string> = {
  active:
    "bg-emerald-400/10 text-emerald-400 border border-emerald-400/20",
  paused:
    "bg-amber-400/10 text-amber-400 border border-amber-400/20",
  error:
    "bg-rose-400/10 text-rose-400 border border-rose-400/20",
};

const DELIVERY_STYLES: Record<DeliveryStatus, string> = {
  success:
    "bg-emerald-400/10 text-emerald-400",
  failed:
    "bg-rose-400/10 text-rose-400",
  pending:
    "bg-amber-400/10 text-amber-400",
};

const DIRECTION_STYLES: Record<WebhookDirection, string> = {
  inbound:
    "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
  outbound:
    "bg-[var(--color-surface-3)]/50 text-[var(--color-text-primary)] border border-[var(--color-surface-3)]/40",
};

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}

// ─── Webhook Card ───────────────────────────────────────────────────────────

interface WebhookCardProps {
  webhook: WebhookEndpoint;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

function WebhookCard({ webhook, onToggle, onDelete }: WebhookCardProps) {
  const toggleLabel =
    webhook.status === "active" ? "Pause webhook" : "Activate webhook";

  return (
    <article
      className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-4 flex flex-col gap-3"
      aria-label={`Webhook: ${webhook.name}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {webhook.name}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={DIRECTION_STYLES[webhook.direction]}>
              {webhook.direction === "inbound" ? "↓ Inbound" : "↑ Outbound"}
            </Badge>
            <Badge className={STATUS_STYLES[webhook.status]}>
              {webhook.status}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggle(webhook.id)}
            aria-label={toggleLabel}
            className={cn(
              "rounded-md px-2 py-1 text-xs font-medium transition-colors",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              webhook.status === "active"
                ? "bg-amber-400/10 text-amber-400 hover:bg-amber-400/20"
                : "bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20",
            )}
          >
            {webhook.status === "active" ? "Pause" : "Activate"}
          </button>
          <button
            type="button"
            onClick={() => onDelete(webhook.id)}
            aria-label={`Delete webhook ${webhook.name}`}
            className={cn(
              "rounded-md p-1.5 text-[var(--color-text-muted)] hover:text-rose-400 hover:bg-rose-400/10 transition-colors",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            )}
          >
            <IconTrash />
          </button>
        </div>
      </div>

      {/* URL */}
      <p
        className="text-xs text-[var(--color-text-secondary)] font-mono truncate"
        title={webhook.url}
      >
        {webhook.url}
      </p>

      {/* Events */}
      <div className="flex flex-wrap gap-1">
        {webhook.events.map((e) => (
          <span
            key={e}
            className="rounded bg-[var(--color-surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--color-text-secondary)] font-mono"
          >
            {e}
          </span>
        ))}
      </div>

      {/* Counts + last triggered */}
      <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-2 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">
            ✓ {webhook.successCount.toLocaleString()}
          </span>
          <span className="text-rose-400">
            ✗ {webhook.failureCount.toLocaleString()}
          </span>
        </div>
        {webhook.lastTriggered && (
          <span title={webhook.lastTriggered}>
            Last: {formatTimestamp(webhook.lastTriggered)}
          </span>
        )}
      </div>
    </article>
  );
}

// ─── Add Webhook Modal ──────────────────────────────────────────────────────

interface AddModalProps {
  open: boolean;
  onClose: () => void;
  onAdd: (wh: WebhookEndpoint) => void;
}

function AddWebhookModal({ open, onClose, onAdd }: AddModalProps) {
  const [name, setName] = useState("");
  const [direction, setDirection] = useState<WebhookDirection>("outbound");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [eventsRaw, setEventsRaw] = useState("");

  const resetForm = useCallback(() => {
    setName("");
    setDirection("outbound");
    setUrl("");
    setSecret("");
    setShowSecret(false);
    setEventsRaw("");
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const events = eventsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      const newWebhook: WebhookEndpoint = {
        id: generateId(),
        name: name.trim(),
        direction,
        status: "active",
        url: url.trim(),
        secret: secret.trim() || undefined,
        events,
        createdAt: new Date().toISOString(),
        successCount: 0,
        failureCount: 0,
      };
      onAdd(newWebhook);
      resetForm();
      onClose();
    },
    [name, direction, url, secret, eventsRaw, onAdd, onClose, resetForm],
  );

  const handleClose = useCallback(() => {
    resetForm();
    onClose();
  }, [onClose, resetForm]);

  if (!open) {return null;}

  const inputClass = cn(
    "w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2 text-sm text-[var(--color-text-primary)]",
    "placeholder:text-[var(--color-text-muted)]",
    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
  );

  const labelClass = "block text-xs font-medium text-[var(--color-text-secondary)] mb-1";

  const isValid = name.trim() && url.trim() && eventsRaw.trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Add webhook"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-6 shadow-xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Add Webhook
          </h2>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close dialog"
            className={cn(
              "rounded-md p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            )}
          >
            <IconX />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label htmlFor="wh-name" className={labelClass}>
              Name
            </label>
            <input
              id="wh-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Webhook"
              className={inputClass}
              required
            />
          </div>

          {/* Direction */}
          <div>
            <label htmlFor="wh-direction" className={labelClass}>
              Direction
            </label>
            <select
              id="wh-direction"
              value={direction}
              onChange={(e) =>
                setDirection(e.target.value as WebhookDirection)
              }
              className={inputClass}
            >
              <option value="outbound">Outbound</option>
              <option value="inbound">Inbound</option>
            </select>
          </div>

          {/* URL */}
          <div>
            <label htmlFor="wh-url" className={labelClass}>
              URL
            </label>
            <input
              id="wh-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/webhook"
              className={inputClass}
              required
            />
          </div>

          {/* Secret */}
          <div>
            <label htmlFor="wh-secret" className={labelClass}>
              Secret{" "}
              <span className="text-[var(--color-text-muted)]">(optional)</span>
            </label>
            <div className="relative">
              <input
                id="wh-secret"
                type={showSecret ? "text" : "password"}
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="whsec_..."
                className={cn(inputClass, "pr-10")}
              />
              <button
                type="button"
                onClick={() => setShowSecret((v) => !v)}
                aria-label={showSecret ? "Hide secret" : "Show secret"}
                className={cn(
                  "absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors",
                  "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none rounded",
                )}
              >
                {showSecret ? <IconEyeOff /> : <IconEye />}
              </button>
            </div>
          </div>

          {/* Events */}
          <div>
            <label htmlFor="wh-events" className={labelClass}>
              Events{" "}
              <span className="text-[var(--color-text-muted)]">(comma-separated)</span>
            </label>
            <input
              id="wh-events"
              type="text"
              value={eventsRaw}
              onChange={(e) => setEventsRaw(e.target.value)}
              placeholder="pr.opened, pr.merged, pr.closed"
              className={inputClass}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className={cn(
                "rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-surface-3)] transition-colors",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isValid}
              className={cn(
                "rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors",
                "hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed",
                "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
              )}
            >
              Add Webhook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delivery Log Row ───────────────────────────────────────────────────────

interface LogRowProps {
  log: DeliveryLog;
  expanded: boolean;
  onToggle: () => void;
}

function DeliveryLogRow({ log, expanded, onToggle }: LogRowProps) {
  let prettyPayload: string;
  try {
    prettyPayload = JSON.stringify(JSON.parse(log.payload), null, 2);
  } catch {
    prettyPayload = log.payload;
  }

  let prettyResponse: string | undefined;
  if (log.response) {
    try {
      prettyResponse = JSON.stringify(JSON.parse(log.response), null, 2);
    } catch {
      prettyResponse = log.response;
    }
  }

  return (
    <>
      <tr
        className={cn(
          "border-b border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-surface-2)]/50 transition-colors",
          expanded && "bg-[var(--color-surface-2)]/30",
        )}
        onClick={onToggle}
        role="row"
        aria-expanded={expanded}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <IconChevron expanded={expanded} className="text-[var(--color-text-muted)]" />
            {formatTimestamp(log.timestamp)}
          </div>
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-text-primary)] whitespace-nowrap">
          {log.webhookName}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
          {log.event}
        </td>
        <td className="px-3 py-2.5">
          <Badge className={DELIVERY_STYLES[log.status]}>
            {log.status}
          </Badge>
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)] font-mono whitespace-nowrap">
          {log.statusCode ?? "—"}
        </td>
        <td className="px-3 py-2.5 text-xs text-[var(--color-text-secondary)] whitespace-nowrap text-right">
          {formatDuration(log.duration)}
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-[var(--color-border)]" role="row">
          <td colSpan={6} className="p-0">
            <div className="px-4 py-3 bg-[var(--color-surface-0)]">
              <div className="flex flex-col gap-2">
                <div>
                  <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                    Payload
                  </span>
                  <pre className="mt-1 rounded bg-[var(--color-surface-1)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-primary)] font-mono overflow-x-auto max-h-48">
                    {prettyPayload}
                  </pre>
                </div>
                {prettyResponse && (
                  <div>
                    <span className="text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                      Response
                    </span>
                    <pre className="mt-1 rounded bg-[var(--color-surface-1)] border border-[var(--color-border)] p-3 text-xs text-[var(--color-text-primary)] font-mono overflow-x-auto max-h-48">
                      {prettyResponse}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function WebhookManager() {
  const [tab, setTab] = useState<TabId>("endpoints");
  const [webhooks, setWebhooks] = useState<WebhookEndpoint[]>(SEED_WEBHOOKS);
  const [deliveryLogs] = useState<DeliveryLog[]>(SEED_DELIVERY_LOGS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Delivery log filters
  const [filterWebhook, setFilterWebhook] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // ── Handlers ────────────────────────────────────────────────────────────

  const handleToggle = useCallback((id: string) => {
    setWebhooks((prev) =>
      prev.map((wh) =>
        wh.id === id
          ? {
              ...wh,
              status:
                wh.status === "active"
                  ? ("paused" as const)
                  : ("active" as const),
            }
          : wh,
      ),
    );
  }, []);

  const handleDelete = useCallback((id: string) => {
    setWebhooks((prev) => prev.filter((wh) => wh.id !== id));
  }, []);

  const handleAdd = useCallback((wh: WebhookEndpoint) => {
    setWebhooks((prev) => [wh, ...prev]);
  }, []);

  const toggleRow = useCallback((id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ── Filtered logs ───────────────────────────────────────────────────────

  const filteredLogs = useMemo(() => {
    return deliveryLogs.filter((log) => {
      if (filterWebhook !== "all" && log.webhookId !== filterWebhook)
        {return false;}
      if (filterStatus !== "all" && log.status !== filterStatus)
        {return false;}
      return true;
    });
  }, [deliveryLogs, filterWebhook, filterStatus]);

  // unique webhook names for filter
  const webhookOptions = useMemo(() => {
    const seen = new Map<string, string>();
    deliveryLogs.forEach((l) => {
      if (!seen.has(l.webhookId)) {seen.set(l.webhookId, l.webhookName);}
    });
    return Array.from(seen.entries());
  }, [deliveryLogs]);

  // ── Tab button ──────────────────────────────────────────────────────────

  const tabClass = (active: boolean) =>
    cn(
      "px-4 py-2 text-sm font-medium rounded-md transition-colors",
      "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
      active
        ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)]"
        : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/50",
    );

  const selectClass = cn(
    "rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2.5 py-1.5 text-xs text-[var(--color-text-primary)]",
    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
  );

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">
              Webhooks
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              Manage inbound and outbound webhook endpoints
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            aria-label="Add webhook"
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-[var(--color-text-primary)]",
              "hover:bg-indigo-500 transition-colors",
              "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
            )}
          >
            <IconPlus />
            Add Webhook
          </button>
        </div>

        {/* Tabs */}
        <nav
          className="flex items-center gap-1 mb-6"
          role="tablist"
          aria-label="Webhook sections"
        >
          <button
            type="button"
            role="tab"
            id="tab-endpoints"
            aria-selected={tab === "endpoints"}
            aria-controls="panel-endpoints"
            onClick={() => setTab("endpoints")}
            className={tabClass(tab === "endpoints")}
          >
            Endpoints
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--color-surface-3)] px-1.5 text-[11px] text-[var(--color-text-primary)] min-w-[20px]">
              {webhooks.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            id="tab-delivery-logs"
            aria-selected={tab === "delivery-logs"}
            aria-controls="panel-delivery-logs"
            onClick={() => setTab("delivery-logs")}
            className={tabClass(tab === "delivery-logs")}
          >
            Delivery Logs
            <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-[var(--color-surface-3)] px-1.5 text-[11px] text-[var(--color-text-primary)] min-w-[20px]">
              {deliveryLogs.length}
            </span>
          </button>
        </nav>

        {/* ── Endpoints Panel ──────────────────────────────────────────── */}
        {tab === "endpoints" && (
          <div
            role="tabpanel"
            id="panel-endpoints"
            aria-labelledby="tab-endpoints"
          >
            {webhooks.length === 0 ? (
              <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-1)] p-12 text-center">
                <p className="text-sm text-[var(--color-text-muted)]">
                  No webhooks configured yet.
                </p>
                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className={cn(
                    "mt-4 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-[var(--color-text-primary)]",
                    "hover:bg-indigo-500 transition-colors",
                    "focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:outline-none",
                  )}
                >
                  <IconPlus />
                  Add your first webhook
                </button>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {webhooks.map((wh) => (
                  <WebhookCard
                    key={wh.id}
                    webhook={wh}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Delivery Logs Panel ──────────────────────────────────────── */}
        {tab === "delivery-logs" && (
          <div
            role="tabpanel"
            id="panel-delivery-logs"
            aria-labelledby="tab-delivery-logs"
          >
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label
                  htmlFor="filter-webhook"
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  Webhook
                </label>
                <select
                  id="filter-webhook"
                  value={filterWebhook}
                  onChange={(e) => setFilterWebhook(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All</option>
                  {webhookOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="filter-status"
                  className="text-xs text-[var(--color-text-muted)]"
                >
                  Status
                </label>
                <select
                  id="filter-status"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={selectClass}
                >
                  <option value="all">All</option>
                  <option value="success">Success</option>
                  <option value="failed">Failed</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              {(filterWebhook !== "all" || filterStatus !== "all") && (
                <span className="text-xs text-[var(--color-text-muted)]">
                  {filteredLogs.length} of {deliveryLogs.length} entries
                </span>
              )}
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-[var(--color-border)]">
              <table
                className="w-full text-left"
                role="table"
                aria-label="Delivery logs"
              >
                <thead>
                  <tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-1)]">
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                    >
                      Timestamp
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                    >
                      Webhook
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                    >
                      Event
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                    >
                      Status
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)]"
                    >
                      Code
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-[var(--color-text-muted)] text-right"
                    >
                      Duration
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-sm text-[var(--color-text-muted)]"
                      >
                        No delivery logs match the current filters.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((log) => (
                      <DeliveryLogRow
                        key={log.id}
                        log={log}
                        expanded={expandedRows.has(log.id)}
                        onToggle={() => toggleRow(log.id)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Add Webhook Modal */}
      <AddWebhookModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAdd}
      />
    </div>
  );
}

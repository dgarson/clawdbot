import React, { useState } from "react";
import { cn } from "../lib/utils";

type WebhookStatus = "delivered" | "failed" | "pending" | "retrying";
type HttpMethod = "POST" | "PUT" | "PATCH";
type EventType = "order.created" | "order.updated" | "payment.succeeded" | "payment.failed" | "user.created" | "user.deleted" | "subscription.renewed" | "refund.issued";

interface WebhookEndpoint {
  id: string;
  url: string;
  description: string;
  active: boolean;
  events: EventType[];
  secret: string;
  method: HttpMethod;
  createdAt: string;
  lastDelivery: string;
  successRate: number;
  deliveryCount: number;
}

interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventType: EventType;
  eventId: string;
  status: WebhookStatus;
  attempt: number;
  maxAttempts: number;
  responseCode: number | null;
  responseTime: number | null;
  sentAt: string;
  nextRetry: string | null;
  requestBody: string;
  responseBody: string;
  requestHeaders: Record<string, string>;
}

interface TestRequest {
  endpointId: string;
  eventType: EventType;
  status: "idle" | "sending" | "success" | "error";
}

const ENDPOINTS: WebhookEndpoint[] = [
  { id: "ep1", url: "https://api.acme.com/webhooks/orders", description: "Order processing system", active: true, events: ["order.created", "order.updated", "payment.succeeded", "payment.failed"], secret: "whsec_•••••••••••••", method: "POST", createdAt: "2024-01-15", lastDelivery: "2m ago", successRate: 98.4, deliveryCount: 14829 },
  { id: "ep2", url: "https://crm.bigco.io/api/v1/events", description: "CRM integration", active: true, events: ["user.created", "user.deleted", "subscription.renewed"], secret: "whsec_•••••••••••••", method: "POST", createdAt: "2024-02-01", lastDelivery: "8m ago", successRate: 99.1, deliveryCount: 8271 },
  { id: "ep3", url: "https://analytics.internal/ingest", description: "Analytics pipeline", active: true, events: ["order.created", "user.created", "payment.succeeded", "refund.issued"], secret: "whsec_•••••••••••••", method: "POST", createdAt: "2024-03-10", lastDelivery: "1m ago", successRate: 87.3, deliveryCount: 22194 },
  { id: "ep4", url: "https://legacy.oldapp.com/notify", description: "Legacy integration — migration in progress", active: false, events: ["payment.succeeded"], secret: "whsec_•••••••••••••", method: "POST", createdAt: "2023-08-20", lastDelivery: "2d ago", successRate: 72.1, deliveryCount: 3092 },
];

const DELIVERIES: WebhookDelivery[] = [
  {
    id: "d1", endpointId: "ep3", eventType: "order.created", eventId: "evt_01HX8K9M4P", status: "failed", attempt: 3, maxAttempts: 5, responseCode: 503, responseTime: 4201, sentAt: "10:42:31", nextRetry: "10:52:31",
    requestBody: JSON.stringify({ id: "evt_01HX8K9M4P", type: "order.created", data: { orderId: "ord_001", amount: 149.99, currency: "USD", status: "confirmed" } }, null, 2),
    responseBody: '{"error": "Service Unavailable", "message": "Database connection timeout"}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=abc123...", "X-Event-ID": "evt_01HX8K9M4P" },
  },
  {
    id: "d2", endpointId: "ep1", eventType: "payment.succeeded", eventId: "evt_01HX8J7L3Q", status: "delivered", attempt: 1, maxAttempts: 5, responseCode: 200, responseTime: 142, sentAt: "10:41:15", nextRetry: null,
    requestBody: JSON.stringify({ id: "evt_01HX8J7L3Q", type: "payment.succeeded", data: { paymentId: "pay_001", amount: 299.00, currency: "USD", method: "card" } }, null, 2),
    responseBody: '{"received": true, "processing": "queued"}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=def456...", "X-Event-ID": "evt_01HX8J7L3Q" },
  },
  {
    id: "d3", endpointId: "ep2", eventType: "user.created", eventId: "evt_01HX8H5K2N", status: "delivered", attempt: 1, maxAttempts: 5, responseCode: 201, responseTime: 89, sentAt: "10:39:02", nextRetry: null,
    requestBody: JSON.stringify({ id: "evt_01HX8H5K2N", type: "user.created", data: { userId: "usr_001", email: "new@example.com", plan: "pro" } }, null, 2),
    responseBody: '{"status": "created", "contactId": "crm_99821"}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=ghi789..." },
  },
  {
    id: "d4", endpointId: "ep3", eventType: "payment.succeeded", eventId: "evt_01HX8G3J1M", status: "retrying", attempt: 2, maxAttempts: 5, responseCode: 500, responseTime: 2800, sentAt: "10:38:45", nextRetry: "10:43:45",
    requestBody: JSON.stringify({ id: "evt_01HX8G3J1M", type: "payment.succeeded", data: { paymentId: "pay_002", amount: 49.99 } }, null, 2),
    responseBody: '{"error": "Internal Server Error"}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=jkl012..." },
  },
  {
    id: "d5", endpointId: "ep1", eventType: "order.updated", eventId: "evt_01HX8F2H0L", status: "delivered", attempt: 1, maxAttempts: 5, responseCode: 200, responseTime: 204, sentAt: "10:35:12", nextRetry: null,
    requestBody: JSON.stringify({ id: "evt_01HX8F2H0L", type: "order.updated", data: { orderId: "ord_002", status: "shipped", trackingId: "1Z999AA10123456784" } }, null, 2),
    responseBody: '{"ok": true}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=mno345..." },
  },
  {
    id: "d6", endpointId: "ep3", eventType: "user.created", eventId: "evt_01HX8E1G9K", status: "failed", attempt: 5, maxAttempts: 5, responseCode: 404, responseTime: 89, sentAt: "10:30:00", nextRetry: null,
    requestBody: JSON.stringify({ id: "evt_01HX8E1G9K", type: "user.created", data: { userId: "usr_002" } }, null, 2),
    responseBody: '{"error": "Not Found", "detail": "Ingest endpoint deprecated — use /v2/ingest"}',
    requestHeaders: { "Content-Type": "application/json", "X-Webhook-Secret": "sha256=pqr678..." },
  },
];

const statusBadge: Record<WebhookStatus, string> = {
  delivered: "bg-emerald-500/15 border-emerald-500/30 text-emerald-400",
  failed:    "bg-rose-500/15 border-rose-500/40 text-rose-400",
  pending:   "bg-[var(--color-surface-3)]/50 border-[var(--color-surface-3)] text-[var(--color-text-secondary)]",
  retrying:  "bg-amber-500/15 border-amber-500/30 text-amber-400",
};

const statusDot: Record<WebhookStatus, string> = {
  delivered: "bg-emerald-400",
  failed:    "bg-rose-400",
  pending:   "bg-[var(--color-surface-3)]",
  retrying:  "bg-amber-400 animate-pulse",
};

const eventColor: Record<EventType, string> = {
  "order.created":       "text-primary",
  "order.updated":       "text-sky-400",
  "payment.succeeded":   "text-emerald-400",
  "payment.failed":      "text-rose-400",
  "user.created":        "text-purple-400",
  "user.deleted":        "text-rose-400",
  "subscription.renewed":"text-amber-400",
  "refund.issued":       "text-orange-400",
};

const responseCodeColor = (code: number | null) => {
  if (!code) {return "text-[var(--color-text-muted)]";}
  if (code >= 200 && code < 300) {return "text-emerald-400";}
  if (code >= 400 && code < 500) {return "text-amber-400";}
  if (code >= 500) {return "text-rose-400";}
  return "text-[var(--color-text-secondary)]";
};

const ALL_EVENT_TYPES: EventType[] = ["order.created", "order.updated", "payment.succeeded", "payment.failed", "user.created", "user.deleted", "subscription.renewed", "refund.issued"];

export default function WebhookDebugger() {
  const [tab, setTab] = useState<"deliveries" | "endpoints" | "test" | "logs">("deliveries");
  const [selected, setSelected] = useState<WebhookDelivery | null>(DELIVERIES[0]);
  const [statusFilter, setStatusFilter] = useState<"all" | WebhookStatus>("all");
  const [testState, setTestState] = useState<TestRequest>({ endpointId: "ep1", eventType: "order.created", status: "idle" });
  const [expandSection, setExpandSection] = useState<"request" | "response" | "headers">("request");

  const filtered = DELIVERIES.filter(d => statusFilter === "all" || d.status === statusFilter);
  const failedCount = DELIVERIES.filter(d => d.status === "failed" || d.status === "retrying").length;

  const handleTest = () => {
    setTestState(prev => ({ ...prev, status: "sending" }));
    setTimeout(() => {
      setTestState(prev => ({ ...prev, status: "success" }));
    }, 1500);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
      {/* Header */}
      <div className="flex-none px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">Webhook Debugger</h1>
            <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">{ENDPOINTS.filter(e => e.active).length} active endpoints · {DELIVERIES.length} recent deliveries</p>
          </div>
          <div className="flex items-center gap-2">
            {failedCount > 0 && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 border border-rose-500/30">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span className="text-xs text-rose-400">{failedCount} failing</span>
              </div>
            )}
          </div>
        </div>
        {/* Stats */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Delivered", value: DELIVERIES.filter(d => d.status === "delivered").length, color: "text-emerald-400" },
            { label: "Failed", value: DELIVERIES.filter(d => d.status === "failed").length, color: "text-rose-400" },
            { label: "Retrying", value: DELIVERIES.filter(d => d.status === "retrying").length, color: "text-amber-400" },
            { label: "Total Deliveries", value: ENDPOINTS.reduce((s, e) => s + e.deliveryCount, 0).toLocaleString(), color: "text-[var(--color-text-primary)]" },
          ].map(s => (
            <div key={s.label}>
              <span className={cn("text-base font-bold", s.color)}>{s.value}</span>
              <span className="text-[var(--color-text-muted)] text-xs ml-1.5">{s.label}</span>
            </div>
          ))}
        </div>
        {/* Tabs */}
        <div className="flex gap-1 mt-3">
          {(["deliveries", "endpoints", "test", "logs"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors",
                tab === t ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]")}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
              {t === "deliveries" && failedCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-rose-500 text-[9px] font-bold text-[var(--color-text-primary)]">{failedCount}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {/* Deliveries Tab */}
        {tab === "deliveries" && (
          <div className="flex h-full">
            {/* Left */}
            <div className="w-[44%] flex-none border-r border-[var(--color-border)] flex flex-col">
              <div className="flex-none px-4 py-2.5 border-b border-[var(--color-border)] flex items-center gap-1">
                {(["all", "delivered", "failed", "retrying"] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={cn("px-2 py-0.5 rounded text-xs capitalize transition-colors",
                      statusFilter === s ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto">
                {filtered.map(d => {
                  const ep = ENDPOINTS.find(e => e.id === d.endpointId);
                  return (
                    <button key={d.id} onClick={() => setSelected(d)} className={cn(
                      "w-full text-left px-4 py-3 border-b border-[var(--color-border)]/60 hover:bg-[var(--color-surface-1)] transition-colors",
                      selected?.id === d.id && "bg-[var(--color-surface-1)] border-l-2 border-l-indigo-500"
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("w-1.5 h-1.5 rounded-full flex-none", statusDot[d.status])} />
                          <span className={cn("text-xs font-medium", eventColor[d.eventType])}>{d.eventType}</span>
                        </div>
                        <div className="flex items-center gap-2 flex-none">
                          <span className={cn("px-1.5 py-0.5 rounded border text-[10px]", statusBadge[d.status])}>{d.status}</span>
                          {d.responseCode && (
                            <span className={cn("text-xs font-mono font-semibold", responseCodeColor(d.responseCode))}>{d.responseCode}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-1 pl-3.5 text-[10px] text-[var(--color-text-muted)]">
                        <span className="font-mono text-[var(--color-text-muted)] truncate">{ep?.url.replace("https://", "").slice(0, 32)}</span>
                        {d.responseTime && <span>{d.responseTime}ms</span>}
                        <span>att. {d.attempt}/{d.maxAttempts}</span>
                        <span className="ml-auto">{d.sentAt}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            {/* Right: delivery detail */}
            <div className="flex-1 overflow-y-auto p-5">
              {selected && (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className={cn("w-2 h-2 rounded-full", statusDot[selected.status])} />
                      <span className={cn("font-medium", eventColor[selected.eventType])}>{selected.eventType}</span>
                      <span className={cn("px-2 py-0.5 rounded border text-xs", statusBadge[selected.status])}>{selected.status}</span>
                    </div>
                    <div className="font-mono text-xs text-[var(--color-text-muted)] mt-1">{selected.eventId}</div>
                  </div>
                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                      <div className="text-[var(--color-text-muted)]">Response Code</div>
                      <div className={cn("text-lg font-bold mt-0.5", responseCodeColor(selected.responseCode))}>{selected.responseCode ?? "—"}</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                      <div className="text-[var(--color-text-muted)]">Response Time</div>
                      <div className={cn("text-lg font-bold mt-0.5", selected.responseTime && selected.responseTime > 2000 ? "text-rose-400" : "text-[var(--color-text-primary)]")}>{selected.responseTime ? `${selected.responseTime}ms` : "—"}</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                      <div className="text-[var(--color-text-muted)]">Attempt</div>
                      <div className="text-lg font-bold text-[var(--color-text-primary)] mt-0.5">{selected.attempt} / {selected.maxAttempts}</div>
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                      <div className="text-[var(--color-text-muted)]">Sent At</div>
                      <div className="text-sm font-medium text-[var(--color-text-primary)] mt-0.5">{selected.sentAt}</div>
                    </div>
                  </div>
                  {selected.nextRetry && (
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/30">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      <span className="text-xs text-amber-400">Next retry at {selected.nextRetry}</span>
                      <button className="ml-auto px-2 py-0.5 rounded text-xs bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors">Retry Now</button>
                    </div>
                  )}
                  {/* Code section tabs */}
                  <div>
                    <div className="flex gap-1 mb-2">
                      {(["request", "response", "headers"] as const).map(s => (
                        <button key={s} onClick={() => setExpandSection(s)}
                          className={cn("px-2.5 py-1 rounded text-xs font-medium capitalize transition-colors",
                            expandSection === s ? "bg-[var(--color-surface-3)] text-[var(--color-text-primary)]" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]")}>
                          {s}
                        </button>
                      ))}
                    </div>
                    <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                      <pre className="text-[11px] font-mono text-[var(--color-text-primary)] p-4 overflow-x-auto max-h-64 leading-relaxed">
                        {expandSection === "request" && selected.requestBody}
                        {expandSection === "response" && selected.responseBody}
                        {expandSection === "headers" && JSON.stringify(selected.requestHeaders, null, 2)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Endpoints Tab */}
        {tab === "endpoints" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="space-y-4">
              {ENDPOINTS.map(ep => (
                <div key={ep.id} className={cn("bg-[var(--color-surface-1)] rounded-xl p-5 border",
                  ep.active ? "border-[var(--color-border)]" : "border-[var(--color-border)]/40 opacity-60"
                )}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", ep.active ? "bg-emerald-400" : "bg-[var(--color-surface-3)]")} />
                        <span className="font-mono text-sm text-[var(--color-text-primary)] truncate">{ep.url}</span>
                      </div>
                      <p className="text-xs text-[var(--color-text-muted)] mt-1 pl-4">{ep.description}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-none">
                      <div className="text-right text-xs">
                        <div className={cn("font-bold", ep.successRate >= 95 ? "text-emerald-400" : ep.successRate >= 80 ? "text-amber-400" : "text-rose-400")}>{ep.successRate}%</div>
                        <div className="text-[var(--color-text-muted)]">success rate</div>
                      </div>
                      <div className="text-right text-xs">
                        <div className="text-[var(--color-text-primary)] font-semibold">{ep.deliveryCount.toLocaleString()}</div>
                        <div className="text-[var(--color-text-muted)]">deliveries</div>
                      </div>
                      <button className="px-2.5 py-1 rounded text-xs bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] transition-colors">Edit</button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5 pl-4">
                    {ep.events.map(ev => (
                      <span key={ev} className={cn("px-2 py-0.5 rounded bg-[var(--color-surface-2)] text-[10px] font-mono", eventColor[ev])}>{ev}</span>
                    ))}
                  </div>
                  <div className="flex items-center gap-3 mt-2 pl-4 text-[10px] text-[var(--color-text-muted)]">
                    <span>Method: {ep.method}</span>
                    <span>·</span>
                    <span>Last delivery: {ep.lastDelivery}</span>
                    <span>·</span>
                    <span>Created: {ep.createdAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Test Tab */}
        {tab === "test" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="max-w-xl">
              <div className="bg-[var(--color-surface-1)] rounded-xl p-5 border border-[var(--color-border)] space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">Send Test Webhook</h2>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Endpoint</label>
                  <select
                    value={testState.endpointId}
                    onChange={e => setTestState(p => ({ ...p, endpointId: e.target.value }))}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                  >
                    {ENDPOINTS.filter(e => e.active).map(e => (
                      <option key={e.id} value={e.id}>{e.url}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Event Type</label>
                  <select
                    value={testState.eventType}
                    onChange={e => setTestState(p => ({ ...p, eventType: e.target.value as EventType }))}
                    className="w-full bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-primary"
                  >
                    {ALL_EVENT_TYPES.map(ev => (
                      <option key={ev} value={ev}>{ev}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Sample Payload</label>
                  <div className="bg-[var(--color-surface-0)] rounded-lg border border-[var(--color-border)] p-3 font-mono text-[11px] text-[var(--color-text-secondary)]">
                    {JSON.stringify({ id: "evt_test_001", type: testState.eventType, created: Date.now(), data: { test: true } }, null, 2)}
                  </div>
                </div>
                <button
                  onClick={handleTest}
                  disabled={testState.status === "sending"}
                  className={cn("w-full py-2.5 rounded-lg text-sm font-medium transition-colors",
                    testState.status === "sending" ? "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)] cursor-wait" :
                    testState.status === "success" ? "bg-emerald-600 text-[var(--color-text-primary)]" :
                    testState.status === "error" ? "bg-rose-600 text-[var(--color-text-primary)]" :
                    "bg-primary hover:bg-primary text-[var(--color-text-primary)]"
                  )}>
                  {testState.status === "sending" ? "Sending..." :
                   testState.status === "success" ? "✓ Delivered Successfully" :
                   testState.status === "error" ? "✗ Delivery Failed" :
                   "Send Test Webhook"}
                </button>
                {testState.status === "success" && (
                  <div className="bg-emerald-500/10 rounded-lg border border-emerald-500/30 p-3 text-xs">
                    <div className="text-emerald-400 font-semibold mb-1">Test delivery successful</div>
                    <div className="text-[var(--color-text-secondary)]">Response: 200 OK · 124ms · <span className="font-mono">{"{ received: true }"}</span></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Logs Tab */}
        {tab === "logs" && (
          <div className="overflow-y-auto h-full p-5">
            <div className="font-mono text-[11px] space-y-1.5">
              {DELIVERIES.flatMap(d => [
                { time: d.sentAt, level: "INFO", msg: `Dispatching ${d.eventType} → ${ENDPOINTS.find(e => e.id === d.endpointId)?.url}`, id: d.id + "-a" },
                { time: d.sentAt, level: d.status === "delivered" ? "INFO" : "ERROR", msg: `${d.status === "delivered" ? "✓" : "✗"} Response ${d.responseCode ?? "timeout"} (${d.responseTime ?? "—"}ms) — ${d.status}`, id: d.id + "-b" },
                ...(d.nextRetry ? [{ time: d.nextRetry, level: "WARN", msg: `Scheduled retry ${d.attempt + 1}/${d.maxAttempts} for ${d.eventId}`, id: d.id + "-c" }] : []),
              ]).map(entry => (
                <div key={entry.id} className={cn("flex items-start gap-3 px-3 py-1.5 rounded",
                  entry.level === "ERROR" ? "bg-rose-500/5 border-l-2 border-rose-500/40" :
                  entry.level === "WARN" ? "bg-amber-500/5 border-l-2 border-amber-500/30" :
                  "bg-[var(--color-surface-1)]/50"
                )}>
                  <span className="text-[var(--color-text-muted)] flex-none">{entry.time}</span>
                  <span className={cn("flex-none font-bold", entry.level === "ERROR" ? "text-rose-400" : entry.level === "WARN" ? "text-amber-400" : "text-sky-400")}>[{entry.level}]</span>
                  <span className={entry.level === "ERROR" ? "text-rose-300" : entry.level === "WARN" ? "text-amber-300" : "text-[var(--color-text-secondary)]"}>{entry.msg}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

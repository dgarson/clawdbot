import React, { useState } from "react";
import { cn } from "../lib/utils";

interface StreamEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  topic: string;
  payload: string;
  size: number;
  latency: number;
  status: "delivered" | "pending" | "failed" | "replayed";
  consumer?: string;
  partition?: number;
  offset?: number;
}

interface Stream {
  id: string;
  name: string;
  broker: "kafka" | "rabbitmq" | "sqs" | "pubsub" | "nats";
  topics: string[];
  eventsPerSec: number;
  consumers: number;
  status: "healthy" | "degraded" | "down";
  lag: number;
}

const STREAMS: Stream[] = [
  { id: "s1", name: "User Events",       broker: "kafka",    topics: ["user.created","user.updated","user.deleted"], eventsPerSec: 342, consumers: 8,  status: "healthy",  lag: 0 },
  { id: "s2", name: "Order Pipeline",    broker: "kafka",    topics: ["order.placed","order.paid","order.shipped","order.delivered"], eventsPerSec: 89, consumers: 5, status: "healthy", lag: 12 },
  { id: "s3", name: "Notification Bus",  broker: "rabbitmq", topics: ["email.send","sms.send","push.send"], eventsPerSec: 156, consumers: 3, status: "degraded", lag: 891 },
  { id: "s4", name: "Analytics Ingest",  broker: "pubsub",   topics: ["pageview","click","session"], eventsPerSec: 2847, consumers: 2, status: "healthy", lag: 0 },
  { id: "s5", name: "Audit Trail",       broker: "sqs",      topics: ["audit.action","audit.access"], eventsPerSec: 23, consumers: 1, status: "healthy", lag: 0 },
  { id: "s6", name: "Infra Metrics",     broker: "nats",     topics: ["cpu","memory","disk","network"], eventsPerSec: 512, consumers: 6, status: "down",    lag: 0 },
];

const EVENTS: StreamEvent[] = [
  { id: "e001", timestamp: "2026-02-22T07:41:03.142Z", source: "auth-service",       type: "user.created",      topic: "user.created",    payload: '{"userId":"usr_9kX2","email":"alice@corp.io","plan":"pro","createdAt":"2026-02-22T07:41:03Z"}', size: 142, latency: 3, status: "delivered", consumer: "user-sync-worker", partition: 2, offset: 88420 },
  { id: "e002", timestamp: "2026-02-22T07:41:02.890Z", source: "order-service",      type: "order.placed",      topic: "order.placed",    payload: '{"orderId":"ord_7mNp","userId":"usr_8xT1","amount":249.99,"currency":"USD","items":[{"sku":"PRO-ANNUAL","qty":1}]}', size: 218, latency: 7, status: "delivered", consumer: "billing-worker", partition: 0, offset: 31105 },
  { id: "e003", timestamp: "2026-02-22T07:41:02.551Z", source: "analytics-tracker",  type: "pageview",          topic: "pageview",        payload: '{"sessionId":"s_4Kxz","url":"/dashboard","referrer":"/login","duration":0}', size: 96, latency: 1, status: "delivered", consumer: "analytics-sink", partition: 3, offset: 1204411 },
  { id: "e004", timestamp: "2026-02-22T07:41:01.998Z", source: "email-service",      type: "email.send",        topic: "email.send",      payload: '{"to":"bob@example.com","template":"welcome","vars":{"name":"Bob","tier":"starter"}}', size: 187, latency: 0, status: "pending", consumer: "email-dispatcher" },
  { id: "e005", timestamp: "2026-02-22T07:41:01.620Z", source: "audit-logger",       type: "audit.action",      topic: "audit.action",    payload: '{"actor":"usr_5jK9","action":"update_policy","resource":"policy/sec-001","ip":"10.0.1.42"}', size: 163, latency: 4, status: "delivered", consumer: "audit-archiver", partition: 1, offset: 7823 },
  { id: "e006", timestamp: "2026-02-22T07:41:00.411Z", source: "notification-svc",   type: "push.send",         topic: "push.send",       payload: '{"deviceId":"dev_3mXq","title":"Order Shipped","body":"Your order ord_7mNp is on its way!","badge":1}', size: 134, latency: 12, status: "failed", consumer: "push-gateway" },
  { id: "e007", timestamp: "2026-02-22T07:40:59.889Z", source: "user-service",       type: "user.updated",      topic: "user.updated",    payload: '{"userId":"usr_2xR8","changes":{"plan":"pro","updatedAt":"2026-02-22T07:40:59Z"}}', size: 119, latency: 2, status: "delivered", consumer: "user-sync-worker", partition: 1, offset: 88419 },
  { id: "e008", timestamp: "2026-02-22T07:40:59.201Z", source: "billing-service",    type: "order.paid",        topic: "order.paid",      payload: '{"orderId":"ord_6kXm","amount":99.00,"method":"card","last4":"4242","txnId":"txn_8xQp"}', size: 176, latency: 5, status: "delivered", consumer: "fulfillment-worker", partition: 0, offset: 31104 },
  { id: "e009", timestamp: "2026-02-22T07:40:58.733Z", source: "analytics-tracker",  type: "click",             topic: "click",           payload: '{"sessionId":"s_9Lmz","element":"#upgrade-btn","page":"/billing","x":412,"y":288}', size: 89, latency: 1, status: "delivered", consumer: "analytics-sink", partition: 5, offset: 1204410 },
  { id: "e010", timestamp: "2026-02-22T07:40:57.444Z", source: "push.send",          type: "push.send",         topic: "push.send",       payload: '{"deviceId":"dev_1kPm","title":"New Message","body":"You have a new message from support.","badge":3}', size: 128, latency: 8, status: "replayed", consumer: "push-gateway" },
  { id: "e011", timestamp: "2026-02-22T07:40:56.100Z", source: "audit-logger",       type: "audit.access",      topic: "audit.access",    payload: '{"actor":"usr_7kW2","resource":"/api/admin/users","method":"GET","status":200}', size: 112, latency: 3, status: "delivered", consumer: "audit-archiver", partition: 1, offset: 7822 },
  { id: "e012", timestamp: "2026-02-22T07:40:55.888Z", source: "order-service",      type: "order.shipped",     topic: "order.shipped",   payload: '{"orderId":"ord_5nRt","trackingId":"TRK-88421","carrier":"fedex","eta":"2026-02-25"}', size: 145, latency: 6, status: "delivered", consumer: "notification-worker", partition: 0, offset: 31103 },
];

const BROKER_COLORS: Record<string, string> = {
  kafka:    "bg-orange-400/20 text-orange-300 border-orange-500/30",
  rabbitmq: "bg-indigo-400/20 text-indigo-300 border-indigo-500/30",
  sqs:      "bg-amber-400/20 text-amber-300 border-amber-500/30",
  pubsub:   "bg-emerald-400/20 text-emerald-300 border-emerald-500/30",
  nats:     "bg-cyan-400/20 text-cyan-300 border-cyan-500/30",
};

const STATUS_STYLES: Record<string, string> = {
  delivered: "bg-emerald-400/15 text-emerald-400 border-emerald-500/30",
  pending:   "bg-amber-400/15 text-amber-400 border-amber-500/30",
  failed:    "bg-rose-400/15 text-rose-400 border-rose-500/30",
  replayed:  "bg-indigo-400/15 text-indigo-300 border-indigo-500/30",
};

const STREAM_STATUS: Record<string, string> = {
  healthy:  "text-emerald-400",
  degraded: "text-amber-400",
  down:     "text-rose-400",
};

type Tab = "live" | "streams" | "inspect" | "dlq";

export default function EventStreamViewer() {
  const [activeTab, setActiveTab]         = useState<Tab>("live");
  const [selectedEvent, setSelectedEvent] = useState<StreamEvent | null>(null);
  const [filterStatus, setFilterStatus]   = useState<string>("all");
  const [filterSource, setFilterSource]   = useState<string>("all");
  const [searchTerm, setSearchTerm]       = useState("");
  const [paused, setPaused]               = useState(false);
  const [selectedStream, setSelectedStream] = useState<Stream | null>(null);

  const TABS: { id: Tab; label: string; emoji: string }[] = [
    { id: "live",    label: "Live Feed",    emoji: "📡" },
    { id: "streams", label: "Streams",      emoji: "🔀" },
    { id: "inspect", label: "Inspector",    emoji: "🔍" },
    { id: "dlq",     label: "Dead Letters", emoji: "💀" },
  ];

  const sources = Array.from(new Set(EVENTS.map(e => e.source)));

  const filteredEvents = EVENTS.filter(e => {
    if (filterStatus !== "all" && e.status !== filterStatus) {return false;}
    if (filterSource !== "all" && e.source !== filterSource) {return false;}
    if (searchTerm && !JSON.stringify(e).toLowerCase().includes(searchTerm.toLowerCase())) {return false;}
    return true;
  });

  const dlqEvents = EVENTS.filter(e => e.status === "failed");

  const totalEPS = STREAMS.reduce((a, s) => a + s.eventsPerSec, 0);
  const totalLag = STREAMS.reduce((a, s) => a + s.lag, 0);
  const healthyStreams = STREAMS.filter(s => s.status === "healthy").length;

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toTimeString().slice(0, 8) + "." + String(d.getMilliseconds()).padStart(3, "0");
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Event Stream Viewer</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Real-time event bus monitoring and inspection</p>
        </div>
        <div className="flex items-center gap-3">
          <div className={cn("flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border",
            paused ? "bg-amber-400/10 border-amber-500/30 text-amber-400" : "bg-emerald-400/10 border-emerald-500/30 text-emerald-400")}>
            <span className={cn("w-1.5 h-1.5 rounded-full", paused ? "bg-amber-400" : "bg-emerald-400 animate-pulse")} />
            {paused ? "Paused" : "Live"}
          </div>
          <button
            onClick={() => setPaused(p => !p)}
            className={cn("text-xs px-4 py-1.5 rounded border transition-colors",
              paused
                ? "border-emerald-500/50 text-emerald-400 hover:bg-emerald-400/10"
                : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}
          >
            {paused ? "▶ Resume" : "⏸ Pause"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total EPS",       value: totalEPS.toLocaleString(), sub: "events/sec",    color: "text-indigo-400" },
          { label: "Active Streams",  value: `${healthyStreams}/${STREAMS.length}`, sub: "healthy", color: "text-emerald-400" },
          { label: "Total Lag",       value: totalLag.toLocaleString(), sub: "messages behind", color: totalLag > 500 ? "text-amber-400" : "text-emerald-400" },
          { label: "Failed (DLQ)",    value: dlqEvents.length.toString(), sub: "dead letters",  color: dlqEvents.length > 0 ? "text-rose-400" : "text-zinc-400" },
        ].map(card => (
          <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
            <div className="text-xs text-zinc-400 mb-1">{card.label}</div>
            <div className={cn("text-2xl font-bold", card.color)}>{card.value}</div>
            <div className="text-xs text-zinc-500 mt-0.5">{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-zinc-900 p-1 rounded-lg border border-zinc-800 w-fit">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              "px-4 py-2 text-sm rounded-md transition-colors",
              activeTab === t.id
                ? "bg-indigo-500 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Live Feed */}
      {activeTab === "live" && (
        <div className="grid grid-cols-5 gap-4">
          {/* Feed */}
          <div className="col-span-3">
            {/* Filters */}
            <div className="flex gap-3 mb-4">
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
              />
              <select
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="delivered">Delivered</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
                <option value="replayed">Replayed</option>
              </select>
              <select
                value={filterSource}
                onChange={e => setFilterSource(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 text-white text-sm rounded px-3 py-2 focus:outline-none"
              >
                <option value="all">All Sources</option>
                {sources.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Event list */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="grid grid-cols-12 text-xs text-zinc-500 px-4 py-2 border-b border-zinc-800 bg-zinc-900">
                <div className="col-span-2">Time</div>
                <div className="col-span-3">Source</div>
                <div className="col-span-3">Type</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Size / Lat</div>
              </div>
              <div className="divide-y divide-zinc-800 max-h-[460px] overflow-y-auto">
                {filteredEvents.map(ev => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEvent(ev)}
                    className={cn(
                      "w-full grid grid-cols-12 px-4 py-2.5 text-xs hover:bg-zinc-800/50 transition-colors text-left",
                      selectedEvent?.id === ev.id ? "bg-zinc-800/80" : ""
                    )}
                  >
                    <div className="col-span-2 font-mono text-zinc-400">{formatTime(ev.timestamp)}</div>
                    <div className="col-span-3 text-zinc-300 truncate">{ev.source}</div>
                    <div className="col-span-3 text-indigo-300 truncate font-mono">{ev.type}</div>
                    <div className="col-span-2">
                      <span className={cn("px-1.5 py-0.5 rounded border text-xs", STATUS_STYLES[ev.status])}>
                        {ev.status}
                      </span>
                    </div>
                    <div className="col-span-2 text-zinc-500">{ev.size}B / {ev.latency}ms</div>
                  </button>
                ))}
                {filteredEvents.length === 0 && (
                  <div className="px-4 py-8 text-center text-zinc-500 text-sm">No events match filter</div>
                )}
              </div>
            </div>
          </div>

          {/* Event Detail */}
          <div className="col-span-2">
            {selectedEvent ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white">Event Detail</h3>
                  <button onClick={() => setSelectedEvent(null)} className="text-zinc-500 hover:text-white text-lg leading-none">×</button>
                </div>

                <div className="space-y-2">
                  {[
                    ["ID",        selectedEvent.id],
                    ["Type",      selectedEvent.type],
                    ["Source",    selectedEvent.source],
                    ["Topic",     selectedEvent.topic],
                    ["Status",    selectedEvent.status],
                    ["Consumer",  selectedEvent.consumer ?? "—"],
                    ["Partition", selectedEvent.partition != null ? String(selectedEvent.partition) : "—"],
                    ["Offset",    selectedEvent.offset != null ? selectedEvent.offset.toLocaleString() : "—"],
                    ["Size",      `${selectedEvent.size} bytes`],
                    ["Latency",   `${selectedEvent.latency}ms`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-xs">
                      <span className="text-zinc-500">{k}</span>
                      <span className="text-zinc-300 font-mono max-w-[60%] truncate text-right">{v}</span>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs text-zinc-500 mb-2">Payload</div>
                  <pre className="bg-zinc-800 rounded p-3 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre-wrap break-all leading-relaxed">
                    {(() => { try { return JSON.stringify(JSON.parse(selectedEvent.payload), null, 2); } catch { return selectedEvent.payload; } })()}
                  </pre>
                </div>

                <div className="text-xs text-zinc-500">{new Date(selectedEvent.timestamp).toLocaleString()}</div>

                <div className="flex gap-2">
                  <button className="flex-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 text-xs py-1.5 rounded hover:bg-indigo-500/30 transition-colors">
                    🔁 Replay
                  </button>
                  <button className="flex-1 bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs py-1.5 rounded hover:bg-zinc-700 transition-colors">
                    📋 Copy
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-8 text-center text-zinc-500 text-sm">
                Click an event to inspect payload and metadata
              </div>
            )}
          </div>
        </div>
      )}

      {/* Streams */}
      {activeTab === "streams" && (
        <div className="grid grid-cols-5 gap-4">
          <div className="col-span-2 space-y-3">
            {STREAMS.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedStream(s)}
                className={cn(
                  "w-full bg-zinc-900 border rounded-lg p-4 text-left hover:border-zinc-600 transition-colors",
                  selectedStream?.id === s.id ? "border-indigo-500/50" : "border-zinc-800"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">{s.name}</span>
                  <span className={cn("text-xs font-medium", STREAM_STATUS[s.status])}>
                    {s.status === "healthy" ? "●" : s.status === "degraded" ? "◑" : "○"} {s.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn("text-xs px-2 py-0.5 rounded border", BROKER_COLORS[s.broker])}>{s.broker}</span>
                  <span className="text-xs text-zinc-400">{s.eventsPerSec.toLocaleString()} eps</span>
                  <span className="text-xs text-zinc-400">{s.consumers} consumers</span>
                </div>
                {s.lag > 0 && (
                  <div className="mt-2 text-xs text-amber-400">⚠ {s.lag.toLocaleString()} msg lag</div>
                )}
              </button>
            ))}
          </div>

          <div className="col-span-3">
            {selectedStream ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 space-y-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">{selectedStream.name}</h3>
                  <span className={cn("text-xs px-2 py-0.5 rounded border", BROKER_COLORS[selectedStream.broker])}>{selectedStream.broker}</span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Events/sec",  value: selectedStream.eventsPerSec.toLocaleString(), color: "text-indigo-400" },
                    { label: "Consumers",   value: selectedStream.consumers,                      color: "text-white" },
                    { label: "Message Lag", value: selectedStream.lag.toLocaleString(),           color: selectedStream.lag > 0 ? "text-amber-400" : "text-emerald-400" },
                  ].map(m => (
                    <div key={m.label} className="bg-zinc-800 rounded-lg p-3">
                      <div className="text-xs text-zinc-400">{m.label}</div>
                      <div className={cn("text-xl font-bold mt-1", m.color)}>{m.value}</div>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="text-xs text-zinc-400 mb-2 font-medium">Topics</div>
                  <div className="flex flex-wrap gap-2">
                    {selectedStream.topics.map(t => (
                      <span key={t} className="bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs px-2.5 py-1 rounded font-mono">{t}</span>
                    ))}
                  </div>
                </div>

                {/* Throughput sparkline */}
                <div>
                  <div className="text-xs text-zinc-400 mb-2 font-medium">Throughput (last 12 intervals)</div>
                  <div className="bg-zinc-800 rounded p-3 flex items-end gap-1 h-20">
                    {Array.from({ length: 12 }, (_, i) => {
                      const base = selectedStream.eventsPerSec;
                      const h = Math.max(10, Math.round(base * (0.6 + Math.random() * 0.8)));
                      const pct = Math.min(100, (h / (base * 1.5)) * 100);
                      return (
                        <div key={i} className="flex-1 bg-indigo-500/70 rounded-t transition-all" style={{ height: `${pct}%` }} />
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400">Status</div>
                  <div className={cn("text-sm font-medium mt-0.5", STREAM_STATUS[selectedStream.status])}>
                    {selectedStream.status === "healthy" ? "✓ All consumers healthy" :
                     selectedStream.status === "degraded" ? "⚠ High consumer lag detected" :
                     "✗ Stream is down — no consumers connected"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-10 text-center text-zinc-500 text-sm">
                Select a stream to view details
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inspector */}
      {activeTab === "inspect" && (
        <div className="space-y-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Event Inspector — Schema & Routing</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-zinc-400 border-b border-zinc-800">
                    <th className="pb-2 text-left font-medium">Event Type</th>
                    <th className="pb-2 text-left font-medium">Source</th>
                    <th className="pb-2 text-left font-medium">Topic</th>
                    <th className="pb-2 text-left font-medium">Consumer</th>
                    <th className="pb-2 text-right font-medium">Partition</th>
                    <th className="pb-2 text-right font-medium">Offset</th>
                    <th className="pb-2 text-right font-medium">Latency</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800">
                  {EVENTS.filter(e => e.partition != null).map(ev => (
                    <tr key={ev.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2.5 font-mono text-xs text-indigo-300">{ev.type}</td>
                      <td className="py-2.5 text-zinc-300 text-xs">{ev.source}</td>
                      <td className="py-2.5 font-mono text-xs text-zinc-400">{ev.topic}</td>
                      <td className="py-2.5 text-zinc-400 text-xs">{ev.consumer}</td>
                      <td className="py-2.5 text-right text-zinc-400 font-mono text-xs">{ev.partition}</td>
                      <td className="py-2.5 text-right text-zinc-400 font-mono text-xs">{ev.offset?.toLocaleString()}</td>
                      <td className={cn("py-2.5 text-right font-mono text-xs", ev.latency > 8 ? "text-amber-400" : "text-emerald-400")}>{ev.latency}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Latency distribution */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5">
            <h3 className="text-sm font-semibold text-white mb-4">Latency Distribution</h3>
            <div className="space-y-2">
              {[
                { label: "< 2ms",    count: EVENTS.filter(e => e.latency < 2).length,   color: "bg-emerald-500" },
                { label: "2–5ms",    count: EVENTS.filter(e => e.latency >= 2 && e.latency < 5).length, color: "bg-indigo-500" },
                { label: "5–10ms",   count: EVENTS.filter(e => e.latency >= 5 && e.latency < 10).length, color: "bg-amber-500" },
                { label: "> 10ms",   count: EVENTS.filter(e => e.latency >= 10).length, color: "bg-rose-500" },
              ].map(bucket => (
                <div key={bucket.label} className="flex items-center gap-3">
                  <div className="w-16 text-xs text-zinc-400 text-right">{bucket.label}</div>
                  <div className="flex-1 bg-zinc-800 rounded-full h-3">
                    <div
                      className={cn("h-full rounded-full", bucket.color)}
                      style={{ width: `${(bucket.count / EVENTS.length) * 100}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs text-zinc-400">{bucket.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Dead Letter Queue */}
      {activeTab === "dlq" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white">Dead Letter Queue</h3>
            <div className="flex gap-2">
              <button className="text-xs px-3 py-1.5 bg-amber-400/10 border border-amber-500/30 text-amber-300 rounded hover:bg-amber-400/20 transition-colors">
                🔁 Replay All
              </button>
              <button className="text-xs px-3 py-1.5 bg-rose-400/10 border border-rose-500/30 text-rose-300 rounded hover:bg-rose-400/20 transition-colors">
                🗑 Purge DLQ
              </button>
            </div>
          </div>

          {dlqEvents.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 text-center">
              <div className="text-3xl mb-3">✅</div>
              <div className="text-white font-medium">Dead letter queue is empty</div>
              <div className="text-zinc-400 text-sm mt-1">All events delivered successfully</div>
            </div>
          ) : (
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              {dlqEvents.map(ev => (
                <div key={ev.id} className="p-4 border-b border-zinc-800 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xs text-rose-400 bg-rose-400/10 border border-rose-500/30 px-2 py-0.5 rounded">FAILED</span>
                      <span className="text-sm text-white font-medium">{ev.type}</span>
                      <span className="text-xs text-zinc-400">{ev.source}</span>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded hover:bg-indigo-500/30">Replay</button>
                      <button className="text-xs px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-400 rounded hover:bg-zinc-700">Discard</button>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-zinc-400 mb-2">
                    <span>Consumer: <span className="text-zinc-300">{ev.consumer}</span></span>
                    <span>Size: <span className="text-zinc-300">{ev.size}B</span></span>
                    <span>Time: <span className="text-zinc-300">{formatTime(ev.timestamp)}</span></span>
                  </div>
                  <pre className="bg-zinc-800 rounded p-2 text-xs font-mono text-zinc-300 overflow-x-auto">{ev.payload}</pre>
                </div>
              ))}
            </div>
          )}

          {/* DLQ Metrics */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total Failed",      value: dlqEvents.length,   color: "text-rose-400" },
              { label: "Oldest Entry",      value: "2m 16s ago",        color: "text-amber-400" },
              { label: "Avg Retry Count",   value: "3.2×",              color: "text-zinc-300" },
            ].map(m => (
              <div key={m.label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-4">
                <div className="text-xs text-zinc-400">{m.label}</div>
                <div className={cn("text-xl font-bold mt-1", m.color)}>{m.value}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

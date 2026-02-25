import React, { useState } from "react";
import { cn } from "../lib/utils";

type ConnectorStatus = "running" | "paused" | "failed" | "syncing" | "initializing";
type EventType = "INSERT" | "UPDATE" | "DELETE" | "DDL" | "TRUNCATE";

interface CDCConnector {
  id: string;
  name: string;
  source: string;
  sourceType: "postgres" | "mysql" | "mongodb" | "oracle" | "sqlserver";
  targetTopic: string;
  status: ConnectorStatus;
  lag: number; // ms
  eventsPerSec: number;
  totalEvents: number;
  lastEventAt: string;
  snapshotProgress: number; // 0-100
  errorMessage?: string;
  tables: string[];
}

interface CDCEvent {
  id: string;
  connectorId: string;
  connectorName: string;
  table: string;
  op: EventType;
  lsn: string;
  timestamp: string;
  before: Record<string, string> | null;
  after: Record<string, string> | null;
}

interface ThroughputPoint {
  time: string;
  insertCount: number;
  updateCount: number;
  deleteCount: number;
}

const CONNECTORS: CDCConnector[] = [
  {
    id: "c1",
    name: "prod-postgres-users",
    source: "prod-pg-01.internal:5432/appdb",
    sourceType: "postgres",
    targetTopic: "cdc.appdb.users",
    status: "running",
    lag: 12,
    eventsPerSec: 342,
    totalEvents: 18492031,
    lastEventAt: "2026-02-22T14:31:55Z",
    snapshotProgress: 100,
    tables: ["users", "user_profiles", "user_sessions"],
  },
  {
    id: "c2",
    name: "prod-postgres-orders",
    source: "prod-pg-01.internal:5432/ordersdb",
    sourceType: "postgres",
    targetTopic: "cdc.ordersdb.orders",
    status: "running",
    lag: 28,
    eventsPerSec: 89,
    totalEvents: 4201847,
    lastEventAt: "2026-02-22T14:31:52Z",
    snapshotProgress: 100,
    tables: ["orders", "order_items", "order_events"],
  },
  {
    id: "c3",
    name: "prod-mysql-inventory",
    source: "prod-mysql-01.internal:3306/inventory",
    sourceType: "mysql",
    targetTopic: "cdc.inventory.products",
    status: "syncing",
    lag: 142,
    eventsPerSec: 24,
    totalEvents: 892410,
    lastEventAt: "2026-02-22T14:31:48Z",
    snapshotProgress: 87,
    tables: ["products", "inventory_levels", "warehouses"],
  },
  {
    id: "c4",
    name: "analytics-mongodb",
    source: "prod-mongo-01.internal:27017/analytics",
    sourceType: "mongodb",
    targetTopic: "cdc.analytics.events",
    status: "failed",
    lag: 0,
    eventsPerSec: 0,
    totalEvents: 2104932,
    lastEventAt: "2026-02-22T13:45:00Z",
    snapshotProgress: 100,
    errorMessage: "Replication lag exceeded threshold (5000ms). OpLog may have rolled over.",
    tables: ["page_events", "click_events"],
  },
  {
    id: "c5",
    name: "staging-postgres",
    source: "staging-pg-01.internal:5432/appdb",
    sourceType: "postgres",
    targetTopic: "cdc.staging.all",
    status: "paused",
    lag: 0,
    eventsPerSec: 0,
    totalEvents: 312049,
    lastEventAt: "2026-02-21T08:00:00Z",
    snapshotProgress: 100,
    tables: ["*"],
  },
];

const CDC_EVENTS: CDCEvent[] = [
  {
    id: "ev1",
    connectorId: "c1",
    connectorName: "prod-postgres-users",
    table: "users",
    op: "UPDATE",
    lsn: "0/4A3B2C1",
    timestamp: "2026-02-22T14:31:55Z",
    before: { id: "12841", email: "alice@example.com", plan: "starter", updated_at: "2026-02-20T10:00:00Z" },
    after: { id: "12841", email: "alice@example.com", plan: "growth", updated_at: "2026-02-22T14:31:55Z" },
  },
  {
    id: "ev2",
    connectorId: "c2",
    connectorName: "prod-postgres-orders",
    table: "orders",
    op: "INSERT",
    lsn: "0/3F2A1B9",
    timestamp: "2026-02-22T14:31:52Z",
    before: null,
    after: { id: "ORD-84291", user_id: "12841", total: "299.00", status: "pending", created_at: "2026-02-22T14:31:52Z" },
  },
  {
    id: "ev3",
    connectorId: "c1",
    connectorName: "prod-postgres-users",
    table: "user_sessions",
    op: "DELETE",
    lsn: "0/4A3B2B0",
    timestamp: "2026-02-22T14:31:50Z",
    before: { id: "sess_abc123", user_id: "9284", expires_at: "2026-01-22T00:00:00Z" },
    after: null,
  },
  {
    id: "ev4",
    connectorId: "c2",
    connectorName: "prod-postgres-orders",
    table: "order_items",
    op: "INSERT",
    lsn: "0/3F2A1A2",
    timestamp: "2026-02-22T14:31:49Z",
    before: null,
    after: { id: "OI-28471", order_id: "ORD-84291", product_id: "PROD-119", qty: "2", price: "149.50" },
  },
  {
    id: "ev5",
    connectorId: "c3",
    connectorName: "prod-mysql-inventory",
    table: "inventory_levels",
    op: "UPDATE",
    lsn: "binlog.000124:9284810",
    timestamp: "2026-02-22T14:31:45Z",
    before: { product_id: "PROD-119", qty_available: "48", warehouse_id: "WH-01" },
    after: { product_id: "PROD-119", qty_available: "46", warehouse_id: "WH-01" },
  },
];

const THROUGHPUT: ThroughputPoint[] = [
  { time: "14:00", insertCount: 180, updateCount: 312, deleteCount: 42 },
  { time: "14:05", insertCount: 195, updateCount: 298, deleteCount: 38 },
  { time: "14:10", insertCount: 210, updateCount: 345, deleteCount: 51 },
  { time: "14:15", insertCount: 188, updateCount: 301, deleteCount: 44 },
  { time: "14:20", insertCount: 224, updateCount: 389, deleteCount: 55 },
  { time: "14:25", insertCount: 198, updateCount: 342, deleteCount: 48 },
  { time: "14:30", insertCount: 215, updateCount: 365, deleteCount: 52 },
];

const TABS = ["Connectors", "Event Log", "Throughput", "Settings"] as const;
type Tab = typeof TABS[number];

const statusColor: Record<ConnectorStatus, string> = {
  running:      "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  paused:       "text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30",
  failed:       "text-rose-400 bg-rose-400/10 border-rose-400/30",
  syncing:      "text-primary bg-primary/10 border-primary/30",
  initializing: "text-amber-400 bg-amber-400/10 border-amber-400/30",
};

const opColor: Record<EventType, string> = {
  INSERT:   "text-emerald-400 bg-emerald-400/10",
  UPDATE:   "text-primary bg-primary/10",
  DELETE:   "text-rose-400 bg-rose-400/10",
  DDL:      "text-amber-400 bg-amber-400/10",
  TRUNCATE: "text-rose-500 bg-rose-500/10",
};

const dbEmoji: Record<CDCConnector["sourceType"], string> = {
  postgres:  "🐘",
  mysql:     "🐬",
  mongodb:   "🍃",
  oracle:    "🔶",
  sqlserver: "🗄️",
};

export default function ChangeDataCapture(): React.ReactElement {
  const [tab, setTab] = useState<Tab>("Connectors");
  const [selectedConnector, setSelectedConnector] = useState<CDCConnector>(CONNECTORS[0]);
  const [selectedEvent, setSelectedEvent] = useState<CDCEvent | null>(null);
  const [eventFilter, setEventFilter] = useState<EventType | "all">("all");

  const maxThroughput = Math.max(...THROUGHPUT.map(p => p.insertCount + p.updateCount + p.deleteCount));
  const filteredEvents = CDCEvents_filtered();

  function CDCEvents_filtered(): CDCEvent[] {
    if (eventFilter === "all") {return CDC_EVENTS;}
    return CDC_EVENTS.filter(e => e.op === eventFilter);
  }

  const totalEPS = CONNECTORS.filter(c => c.status === "running" || c.status === "syncing")
    .reduce((a, c) => a + c.eventsPerSec, 0);

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] text-[var(--color-text-primary)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
        <div>
          <h1 className="text-lg font-semibold">Change Data Capture</h1>
          <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">Real-time database event streaming via Debezium-compatible connectors</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-[var(--color-text-secondary)]">
            <span className="text-[var(--color-text-primary)] font-semibold">{totalEPS.toLocaleString()}</span> events/s
          </div>
          <button className="px-3 py-1.5 text-xs bg-primary hover:bg-primary rounded-md transition-colors">
            + Connector
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3 border-b border-[var(--color-border)] shrink-0">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium rounded-t transition-colors border-b-2 -mb-px",
              tab === t
                ? "text-primary border-primary"
                : "text-[var(--color-text-secondary)] border-transparent hover:text-[var(--color-text-primary)]"
            )}
          >
            {t}
            {t === "Connectors" && CONNECTORS.filter(c => c.status === "failed").length > 0 && (
              <span className="ml-1.5 text-[10px] text-rose-400">
                {CONNECTORS.filter(c => c.status === "failed").length} failed
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden">
        {/* ── CONNECTORS ── */}
        {tab === "Connectors" && (
          <div className="h-full flex">
            {/* List */}
            <div className="w-72 border-r border-[var(--color-border)] overflow-y-auto">
              {CONNECTORS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedConnector(c)}
                  className={cn(
                    "w-full text-left px-4 py-4 border-b border-[var(--color-border)]/50 transition-colors",
                    selectedConnector.id === c.id ? "bg-primary/10" : "hover:bg-[var(--color-surface-2)]/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span>{dbEmoji[c.sourceType]}</span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)] truncate max-w-[120px]">{c.name}</span>
                    </div>
                    <span className={cn("text-[10px] px-1 py-0.5 rounded border shrink-0", statusColor[c.status])}>
                      {c.status}
                    </span>
                  </div>
                  <div className="text-[10px] text-[var(--color-text-muted)] font-mono truncate">{c.targetTopic}</div>
                  {c.status === "running" && (
                    <div className="text-[10px] text-[var(--color-text-secondary)] mt-1">{c.eventsPerSec} ev/s · lag {c.lag}ms</div>
                  )}
                  {c.status === "syncing" && (
                    <div className="mt-2">
                      <div className="flex justify-between text-[10px] text-[var(--color-text-muted)] mb-1">
                        <span>Snapshot</span><span>{c.snapshotProgress}%</span>
                      </div>
                      <div className="h-1 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${c.snapshotProgress}%` }} />
                      </div>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Detail */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{dbEmoji[selectedConnector.sourceType]}</span>
                    <div>
                      <h2 className="text-lg font-bold">{selectedConnector.name}</h2>
                      <div className="text-xs text-[var(--color-text-muted)] font-mono">{selectedConnector.source}</div>
                    </div>
                    <span className={cn("text-xs px-2 py-0.5 rounded border", statusColor[selectedConnector.status])}>
                      {selectedConnector.status}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedConnector.status === "running" && (
                    <button className="px-3 py-1.5 text-xs border border-amber-500/40 text-amber-400 hover:bg-amber-500/10 rounded-md transition-colors">Pause</button>
                  )}
                  {selectedConnector.status === "paused" && (
                    <button className="px-3 py-1.5 text-xs bg-primary/20 border border-primary/40 text-indigo-300 rounded-md transition-colors">Resume</button>
                  )}
                  {selectedConnector.status === "failed" && (
                    <button className="px-3 py-1.5 text-xs bg-primary/20 border border-primary/40 text-indigo-300 rounded-md transition-colors">Restart</button>
                  )}
                </div>
              </div>

              {selectedConnector.errorMessage && (
                <div className="bg-rose-400/10 border border-rose-400/30 rounded-lg p-4">
                  <div className="text-xs font-medium text-rose-400 mb-1">Error</div>
                  <div className="text-xs text-[var(--color-text-primary)]">{selectedConnector.errorMessage}</div>
                </div>
              )}

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Events/sec", value: selectedConnector.eventsPerSec.toLocaleString() },
                  { label: "Total Events", value: selectedConnector.totalEvents.toLocaleString() },
                  { label: "Lag", value: selectedConnector.lag > 0 ? `${selectedConnector.lag}ms` : "—" },
                  { label: "Last Event", value: selectedConnector.lastEventAt.slice(11, 19) },
                ].map((m) => (
                  <div key={m.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
                    <div className="text-xs text-[var(--color-text-muted)]">{m.label}</div>
                    <div className="text-sm font-semibold mt-1">{m.value}</div>
                  </div>
                ))}
              </div>

              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">Target Topic</div>
                <div className="font-mono text-sm text-indigo-300 break-all">{selectedConnector.targetTopic}</div>
              </div>

              <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="text-xs text-[var(--color-text-secondary)] font-semibold uppercase tracking-wider mb-3">Captured Tables</div>
                <div className="flex flex-wrap gap-2">
                  {selectedConnector.tables.map((t) => (
                    <span key={t} className="text-xs px-2 py-1 rounded bg-[var(--color-surface-2)] border border-[var(--color-border)] font-mono text-[var(--color-text-primary)]">{t}</span>
                  ))}
                </div>
              </div>

              {selectedConnector.snapshotProgress < 100 && (
                <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4">
                  <div className="flex justify-between text-xs text-[var(--color-text-secondary)] mb-2">
                    <span>Snapshot Progress</span>
                    <span className="text-indigo-300">{selectedConnector.snapshotProgress}%</span>
                  </div>
                  <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${selectedConnector.snapshotProgress}%` }} />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EVENT LOG ── */}
        {tab === "Event Log" && (
          <div className="h-full flex flex-col overflow-hidden">
            {/* Filter bar */}
            <div className="flex items-center gap-2 px-6 py-3 border-b border-[var(--color-border)] shrink-0">
              <span className="text-xs text-[var(--color-text-muted)]">Op:</span>
              {(["all", "INSERT", "UPDATE", "DELETE", "DDL"] as const).map((op) => (
                <button
                  key={op}
                  onClick={() => setEventFilter(op)}
                  className={cn(
                    "px-2 py-1 text-[10px] rounded border transition-colors",
                    eventFilter === op
                      ? "bg-primary/20 border-primary text-indigo-300"
                      : "border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-surface-3)]"
                  )}
                >
                  {op}
                </button>
              ))}
              <span className="ml-auto text-xs text-[var(--color-text-muted)]">{filteredEvents.length} events</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-[var(--color-border)]/50">
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(selectedEvent?.id === ev.id ? null : ev)}
                  className="px-6 py-3 cursor-pointer hover:bg-[var(--color-surface-2)]/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-mono font-bold", opColor[ev.op])}>
                      {ev.op}
                    </span>
                    <span className="text-xs font-mono text-[var(--color-text-primary)]">{ev.table}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{ev.connectorName}</span>
                    <span className="text-xs text-[var(--color-text-muted)] font-mono ml-auto">{ev.lsn}</span>
                    <span className="text-xs text-[var(--color-text-muted)]">{ev.timestamp.slice(11, 19)}</span>
                  </div>
                  {selectedEvent?.id === ev.id && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {ev.before && (
                        <div className="bg-[var(--color-surface-2)]/60 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-rose-400 mb-2 font-semibold">Before</div>
                          <div className="space-y-1">
                            {Object.entries(ev.before).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs">
                                <span className="text-[var(--color-text-muted)] font-mono w-24 shrink-0">{k}:</span>
                                <span className="text-[var(--color-text-primary)] break-all">{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {ev.after && (
                        <div className="bg-[var(--color-surface-2)]/60 rounded-lg p-3">
                          <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2 font-semibold">After</div>
                          <div className="space-y-1">
                            {Object.entries(ev.after).map(([k, v]) => (
                              <div key={k} className="flex gap-2 text-xs">
                                <span className="text-[var(--color-text-muted)] font-mono w-24 shrink-0">{k}:</span>
                                <span className={cn("break-all",
                                  ev.before && ev.before[k] !== v ? "text-amber-300" : "text-[var(--color-text-primary)]"
                                )}>{v}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── THROUGHPUT ── */}
        {tab === "Throughput" && (
          <div className="h-full overflow-y-auto p-6 space-y-6">
            {/* Stacked bar chart */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
              <h3 className="text-sm font-medium mb-4">Event Throughput (last 35 minutes)</h3>
              <div className="flex items-end gap-2 h-40">
                {THROUGHPUT.map((point) => {
                  const total = point.insertCount + point.updateCount + point.deleteCount;
                  const scale = 128 / maxThroughput;
                  return (
                    <div key={point.time} className="flex-1 flex flex-col items-center gap-1">
                      <div className="flex flex-col-reverse gap-0.5 w-full">
                        {[
                          { val: point.insertCount, color: "bg-emerald-500" },
                          { val: point.updateCount, color: "bg-primary" },
                          { val: point.deleteCount, color: "bg-rose-500" },
                        ].map((seg, si) => (
                          <div key={si} className={cn("w-full rounded-sm", seg.color)} style={{ height: Math.max(2, Math.round(seg.val * scale)) }} />
                        ))}
                      </div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{point.time}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-4 mt-3">
                {[
                  { label: "INSERT", color: "bg-emerald-500" },
                  { label: "UPDATE", color: "bg-primary" },
                  { label: "DELETE", color: "bg-rose-500" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-1.5">
                    <div className={cn("w-2.5 h-2.5 rounded-sm", l.color)} />
                    <span className="text-xs text-[var(--color-text-secondary)]">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-connector stats */}
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="px-5 py-3 border-b border-[var(--color-border)]">
                <h3 className="text-sm font-medium">Per-Connector Throughput</h3>
              </div>
              <div className="divide-y divide-[var(--color-border)]">
                {CONNECTORS.map((c) => (
                  <div key={c.id} className="px-5 py-3 flex items-center gap-4">
                    <span>{dbEmoji[c.sourceType]}</span>
                    <div className="flex-1">
                      <div className="text-sm">{c.name}</div>
                    </div>
                    <div className="w-40">
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full", c.status === "failed" || c.status === "paused" ? "bg-[var(--color-surface-3)]" : "bg-emerald-500")}
                          style={{ width: `${Math.min(100, (c.eventsPerSec / totalEPS) * 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="w-20 text-right text-sm font-mono">{c.eventsPerSec} <span className="text-xs text-[var(--color-text-muted)]">ev/s</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── SETTINGS ── */}
        {tab === "Settings" && (
          <div className="h-full overflow-y-auto p-6 space-y-4">
            {[
              { label: "Max Lag Threshold", value: "1000 ms", desc: "Alert when connector lag exceeds this value" },
              { label: "Event Retention", value: "7 days", desc: "How long to retain captured events in the buffer" },
              { label: "Batch Size", value: "1000 events", desc: "Number of events per batch for downstream consumers" },
              { label: "Snapshot Mode", value: "initial", desc: "How to perform the initial snapshot (initial, never, always)" },
              { label: "Kafka Bootstrap Servers", value: "kafka-01:9092, kafka-02:9092", desc: "Target Kafka cluster endpoints" },
              { label: "Schema Registry URL", value: "http://127.0.0.1:8081", desc: "Confluent Schema Registry for Avro serialization" },
            ].map((s) => (
              <div key={s.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-4 flex items-center gap-4">
                <div className="flex-1">
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{s.desc}</div>
                </div>
                <div className="text-sm font-mono text-[var(--color-text-primary)] text-right">{s.value}</div>
                <button className="text-xs text-primary hover:text-indigo-300 shrink-0">Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

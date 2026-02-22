import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpanStatus = "ok" | "error" | "unset";
type TelemetryKind = "trace" | "metric" | "log";
type MetricType = "counter" | "gauge" | "histogram" | "summary";

interface TelemetryAttribute {
  key: string;
  value: string;
}

interface TelemetrySpan {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  name: string;
  service: string;
  status: SpanStatus;
  startTime: number; // ms offset from trace start
  duration: number;  // ms
  attributes: TelemetryAttribute[];
  events: Array<{ ts: number; name: string; attrs: TelemetryAttribute[] }>;
}

interface TelemetryTrace {
  id: string;
  rootSpan: string;
  service: string;
  startedAt: string;
  totalDuration: number;
  spans: TelemetrySpan[];
  status: SpanStatus;
  spanCount: number;
  errorCount: number;
}

interface TelemetryMetric {
  id: string;
  name: string;
  description: string;
  unit: string;
  type: MetricType;
  service: string;
  labels: Record<string, string>;
  values: Array<{ ts: string; value: number }>;
  currentValue: number;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const TRACES: TelemetryTrace[] = [
  {
    id: "trace-a1b2c3",
    rootSpan: "POST /api/agent/run",
    service: "gateway",
    startedAt: "2026-02-22T02:00:00.000Z",
    totalDuration: 4280,
    status: "ok",
    spanCount: 8,
    errorCount: 0,
    spans: [
      {
        traceId: "a1b2c3",
        spanId: "s1",
        parentSpanId: null,
        name: "POST /api/agent/run",
        service: "gateway",
        status: "ok",
        startTime: 0,
        duration: 4280,
        attributes: [
          { key: "http.method", value: "POST" },
          { key: "http.status_code", value: "200" },
          { key: "agent.id", value: "luis" },
        ],
        events: [],
      },
      {
        traceId: "a1b2c3",
        spanId: "s2",
        parentSpanId: "s1",
        name: "auth.validate",
        service: "gateway",
        status: "ok",
        startTime: 12,
        duration: 45,
        attributes: [{ key: "auth.method", value: "token" }, { key: "auth.result", value: "valid" }],
        events: [],
      },
      {
        traceId: "a1b2c3",
        spanId: "s3",
        parentSpanId: "s1",
        name: "llm.chat",
        service: "model-router",
        status: "ok",
        startTime: 80,
        duration: 3900,
        attributes: [{ key: "model", value: "anthropic/claude-sonnet-4-6" }, { key: "tokens.total", value: "8420" }],
        events: [
          { ts: 100, name: "request.sent", attrs: [] },
          { ts: 3950, name: "response.received", attrs: [{ key: "finish_reason", value: "stop" }] },
        ],
      },
      {
        traceId: "a1b2c3",
        spanId: "s4",
        parentSpanId: "s3",
        name: "tool.exec",
        service: "tool-runner",
        status: "ok",
        startTime: 1200,
        duration: 380,
        attributes: [{ key: "tool.name", value: "exec" }, { key: "tool.exit_code", value: "0" }],
        events: [],
      },
      {
        traceId: "a1b2c3",
        spanId: "s5",
        parentSpanId: "s3",
        name: "tool.write",
        service: "tool-runner",
        status: "ok",
        startTime: 1800,
        duration: 65,
        attributes: [{ key: "tool.name", value: "write" }, { key: "file.bytes", value: "18420" }],
        events: [],
      },
      {
        traceId: "a1b2c3",
        spanId: "s6",
        parentSpanId: "s1",
        name: "session.save",
        service: "session-store",
        status: "ok",
        startTime: 4100,
        duration: 120,
        attributes: [{ key: "session.key", value: "agent:luis:main" }, { key: "record.size_kb", value: "84" }],
        events: [],
      },
    ],
  },
  {
    id: "trace-d4e5f6",
    rootSpan: "agent.spawn",
    service: "session-manager",
    startedAt: "2026-02-22T01:55:00.000Z",
    totalDuration: 12400,
    status: "error",
    spanCount: 6,
    errorCount: 1,
    spans: [
      {
        traceId: "d4e5f6",
        spanId: "t1",
        parentSpanId: null,
        name: "agent.spawn",
        service: "session-manager",
        status: "error",
        startTime: 0,
        duration: 12400,
        attributes: [{ key: "agent.id", value: "sub-agent-042" }, { key: "model", value: "google/gemini-2.5-flash-preview" }],
        events: [{ ts: 12350, name: "error.model_not_allowed", attrs: [{ key: "model", value: "google/gemini-2.5-flash-preview" }] }],
      },
      {
        traceId: "d4e5f6",
        spanId: "t2",
        parentSpanId: "t1",
        name: "model.validate",
        service: "model-router",
        status: "error",
        startTime: 200,
        duration: 80,
        attributes: [{ key: "error", value: "model not allowed: google/gemini-2.5-flash-preview" }],
        events: [],
      },
      {
        traceId: "d4e5f6",
        spanId: "t3",
        parentSpanId: "t1",
        name: "session.cleanup",
        service: "session-manager",
        status: "ok",
        startTime: 400,
        duration: 45,
        attributes: [{ key: "reason", value: "spawn_failed" }],
        events: [],
      },
    ],
  },
  {
    id: "trace-g7h8i9",
    rootSpan: "GET /api/sessions",
    service: "gateway",
    startedAt: "2026-02-22T01:50:00.000Z",
    totalDuration: 142,
    status: "ok",
    spanCount: 3,
    errorCount: 0,
    spans: [
      {
        traceId: "g7h8i9",
        spanId: "u1",
        parentSpanId: null,
        name: "GET /api/sessions",
        service: "gateway",
        status: "ok",
        startTime: 0,
        duration: 142,
        attributes: [{ key: "http.method", value: "GET" }, { key: "http.status_code", value: "200" }, { key: "result.count", value: "47" }],
        events: [],
      },
      {
        traceId: "g7h8i9",
        spanId: "u2",
        parentSpanId: "u1",
        name: "db.query",
        service: "session-store",
        status: "ok",
        startTime: 8,
        duration: 95,
        attributes: [{ key: "db.type", value: "postgres" }, { key: "db.rows", value: "47" }],
        events: [],
      },
    ],
  },
];

const METRICS: TelemetryMetric[] = [
  {
    id: "m1",
    name: "http_requests_total",
    description: "Total HTTP requests received by the gateway",
    unit: "count",
    type: "counter",
    service: "gateway",
    labels: { method: "POST", path: "/api/agent/run" },
    values: [
      { ts: "00:00", value: 1240 },
      { ts: "02:00", value: 1180 },
      { ts: "04:00", value: 890 },
      { ts: "06:00", value: 1450 },
      { ts: "08:00", value: 2100 },
      { ts: "10:00", value: 2380 },
      { ts: "12:00", value: 2280 },
      { ts: "14:00", value: 1920 },
    ],
    currentValue: 1920,
  },
  {
    id: "m2",
    name: "llm_tokens_consumed",
    description: "Tokens consumed across all LLM requests",
    unit: "tokens",
    type: "counter",
    service: "model-router",
    labels: { model: "all" },
    values: [
      { ts: "00:00", value: 84200 },
      { ts: "02:00", value: 72100 },
      { ts: "04:00", value: 65000 },
      { ts: "06:00", value: 91000 },
      { ts: "08:00", value: 142000 },
      { ts: "10:00", value: 168000 },
      { ts: "12:00", value: 154000 },
      { ts: "14:00", value: 138000 },
    ],
    currentValue: 138000,
  },
  {
    id: "m3",
    name: "active_sessions",
    description: "Number of currently active agent sessions",
    unit: "sessions",
    type: "gauge",
    service: "session-manager",
    labels: { state: "active" },
    values: [
      { ts: "00:00", value: 8 },
      { ts: "02:00", value: 6 },
      { ts: "04:00", value: 5 },
      { ts: "06:00", value: 9 },
      { ts: "08:00", value: 14 },
      { ts: "10:00", value: 18 },
      { ts: "12:00", value: 16 },
      { ts: "14:00", value: 12 },
    ],
    currentValue: 12,
  },
  {
    id: "m4",
    name: "request_duration_ms",
    description: "Distribution of request durations",
    unit: "ms",
    type: "histogram",
    service: "gateway",
    labels: { quantile: "p95" },
    values: [
      { ts: "00:00", value: 1840 },
      { ts: "02:00", value: 1620 },
      { ts: "04:00", value: 1480 },
      { ts: "06:00", value: 2100 },
      { ts: "08:00", value: 3200 },
      { ts: "10:00", value: 2890 },
      { ts: "12:00", value: 2450 },
      { ts: "14:00", value: 2180 },
    ],
    currentValue: 2180,
  },
];

const STATUS_CONFIG: Record<SpanStatus, { label: string; color: string; dot: string; bg: string }> = {
  ok: { label: "OK", color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-900/20 border-emerald-700/50" },
  error: { label: "Error", color: "text-rose-400", dot: "bg-rose-400", bg: "bg-rose-900/20 border-rose-700/50" },
  unset: { label: "Unset", color: "text-zinc-400", dot: "bg-zinc-400", bg: "bg-zinc-800/50 border-zinc-700" },
};

const METRIC_TYPE_CONFIG: Record<MetricType, { label: string; color: string }> = {
  counter: { label: "Counter", color: "text-blue-400" },
  gauge: { label: "Gauge", color: "text-emerald-400" },
  histogram: { label: "Histogram", color: "text-purple-400" },
  summary: { label: "Summary", color: "text-amber-400" },
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TelemetryViewer() {
  const [activeTab, setActiveTab] = useState<TelemetryKind>("trace");
  const [selectedTrace, setSelectedTrace] = useState<TelemetryTrace | null>(TRACES[0]);
  const [selectedSpan, setSelectedSpan] = useState<TelemetrySpan | null>(null);
  const [selectedMetric, setSelectedMetric] = useState<TelemetryMetric | null>(METRICS[0]);

  // ─── Trace waterfall ──────────────────────────────────────────────────────

  function SpanBar({ span, maxDuration }: { span: TelemetrySpan; maxDuration: number }) {
    const left = (span.startTime / maxDuration) * 100;
    const width = Math.max((span.duration / maxDuration) * 100, 0.5);
    const sc = STATUS_CONFIG[span.status];
    const isSelected = selectedSpan?.spanId === span.spanId;

    return (
      <button
        onClick={() => setSelectedSpan(isSelected ? null : span)}
        className={cn(
          "w-full flex items-center gap-3 px-3 py-1.5 hover:bg-zinc-800/30 rounded transition-all text-left",
          isSelected && "bg-indigo-900/20"
        )}
      >
        <div className="w-48 flex-shrink-0 flex items-center gap-2">
          <span className={cn("w-2 h-2 rounded-full flex-shrink-0", sc.dot)} />
          <span className="text-xs text-zinc-300 truncate">{span.name}</span>
        </div>
        <div className="flex-1 relative h-5 flex items-center">
          <div className="absolute inset-y-0 flex items-center" style={{ left: `${left}%`, width: `${width}%`, minWidth: 3 }}>
            <div
              className={cn(
                "h-4 rounded-sm w-full",
                span.status === "ok" ? "bg-indigo-500/70" : span.status === "error" ? "bg-rose-500/70" : "bg-zinc-600"
              )}
            />
          </div>
        </div>
        <div className="w-16 flex-shrink-0 text-right text-xs text-zinc-500">{span.duration}ms</div>
      </button>
    );
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-zinc-800">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-white">Telemetry Viewer</h1>
            <p className="text-sm text-zinc-400">OpenTelemetry traces, metrics, and logs</p>
          </div>
          <div className="flex items-center gap-2">
            <select className="bg-zinc-800 border border-zinc-700 text-white rounded px-3 py-1.5 text-sm">
              <option>Last 15 minutes</option>
              <option>Last 1 hour</option>
              <option>Last 6 hours</option>
              <option>Last 24 hours</option>
            </select>
            <button className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded text-sm">
              ⟳ Refresh
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-zinc-800 -mb-4">
          {(["trace", "metric", "log"] as TelemetryKind[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "px-4 py-2 text-sm capitalize border-b-2 -mb-px transition-colors",
                activeTab === tab
                  ? "border-indigo-500 text-white font-medium"
                  : "border-transparent text-zinc-500 hover:text-zinc-300"
              )}
            >
              {tab === "trace" ? `Traces (${TRACES.length})` : tab === "metric" ? `Metrics (${METRICS.length})` : "Logs"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {activeTab === "trace" && (
          <>
            {/* Trace list */}
            <div className="flex-shrink-0 w-72 border-r border-zinc-800 overflow-y-auto">
              <div className="p-3 space-y-2">
                {TRACES.map((trace) => {
                  const sc = STATUS_CONFIG[trace.status];
                  const isSelected = selectedTrace?.id === trace.id;
                  return (
                    <button
                      key={trace.id}
                      onClick={() => { setSelectedTrace(trace); setSelectedSpan(null); }}
                      className={cn(
                        "w-full text-left p-3 rounded-xl border transition-all",
                        isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={cn("flex items-center gap-1.5 text-xs", sc.color)}>
                          <span className={cn("w-2 h-2 rounded-full", sc.dot)} />
                          {sc.label}
                        </span>
                        <span className="text-xs text-zinc-500">{trace.totalDuration}ms</span>
                      </div>
                      <div className="text-sm font-medium text-white mb-1 truncate">{trace.rootSpan}</div>
                      <div className="text-xs text-zinc-500 mb-1.5">{trace.service} · {trace.startedAt.slice(11, 19)} UTC</div>
                      <div className="flex gap-2 text-[10px]">
                        <span className="bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">{trace.spanCount} spans</span>
                        {trace.errorCount > 0 && (
                          <span className="bg-rose-900/30 text-rose-400 border border-rose-700/50 px-1.5 py-0.5 rounded">{trace.errorCount} error</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Waterfall */}
            {selectedTrace && (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-shrink-0 px-5 py-3 border-b border-zinc-800 bg-zinc-900/30 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-semibold text-white">{selectedTrace.rootSpan}</span>
                    <span className="ml-3 text-xs text-zinc-500">Trace ID: {selectedTrace.id}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-zinc-400">
                    <span>{selectedTrace.totalDuration}ms total</span>
                    <span>{selectedTrace.spanCount} spans</span>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto">
                  <div className="p-4">
                    {/* Column headers */}
                    <div className="flex items-center gap-3 px-3 mb-2 text-[10px] text-zinc-600 uppercase tracking-wide">
                      <div className="w-48 flex-shrink-0">Span</div>
                      <div className="flex-1">Timeline ({selectedTrace.totalDuration}ms)</div>
                      <div className="w-16 text-right">Duration</div>
                    </div>

                    {/* Span bars */}
                    <div className="space-y-0.5">
                      {selectedTrace.spans.map((span) => (
                        <SpanBar key={span.spanId} span={span} maxDuration={selectedTrace.totalDuration} />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Span detail */}
                {selectedSpan && (
                  <div className="flex-shrink-0 border-t border-zinc-800 bg-zinc-900/50 p-4 max-h-64 overflow-y-auto">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-white">{selectedSpan.name}</h3>
                      <button onClick={() => setSelectedSpan(null)} className="text-zinc-500 hover:text-white">✕</button>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                      <div><span className="text-zinc-500">Service: </span><span className="text-zinc-300">{selectedSpan.service}</span></div>
                      <div><span className="text-zinc-500">Duration: </span><span className="text-indigo-400">{selectedSpan.duration}ms</span></div>
                      <div><span className="text-zinc-500">Status: </span><span className={STATUS_CONFIG[selectedSpan.status].color}>{selectedSpan.status}</span></div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-xs text-zinc-500 font-medium mb-1">Attributes</div>
                      <div className="grid grid-cols-2 gap-1">
                        {selectedSpan.attributes.map((attr) => (
                          <div key={attr.key} className="bg-zinc-800 rounded px-2 py-1 text-[11px]">
                            <span className="text-zinc-500">{attr.key}: </span>
                            <span className="text-zinc-300 font-mono">{attr.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {selectedSpan.events.length > 0 && (
                      <div className="mt-3">
                        <div className="text-xs text-zinc-500 font-medium mb-1">Events</div>
                        {selectedSpan.events.map((ev, i) => (
                          <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400">
                            <span className="text-indigo-400">+{ev.ts}ms</span>
                            <span className="text-zinc-300">{ev.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {activeTab === "metric" && (
          <>
            {/* Metric list */}
            <div className="flex-shrink-0 w-72 border-r border-zinc-800 overflow-y-auto p-3 space-y-2">
              {METRICS.map((metric) => {
                const mtc = METRIC_TYPE_CONFIG[metric.type];
                const isSelected = selectedMetric?.id === metric.id;
                return (
                  <button
                    key={metric.id}
                    onClick={() => setSelectedMetric(metric)}
                    className={cn(
                      "w-full text-left p-3 rounded-xl border transition-all",
                      isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                    )}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={cn("text-xs", mtc.color)}>{mtc.label}</span>
                      <span className="text-xs text-zinc-500">{metric.service}</span>
                    </div>
                    <div className="text-sm font-medium text-white mb-1 font-mono truncate">{metric.name}</div>
                    <div className="text-xs text-zinc-500">{metric.description}</div>
                    <div className="text-lg font-bold text-indigo-400 mt-1">{metric.currentValue.toLocaleString()}</div>
                  </button>
                );
              })}
            </div>

            {/* Metric chart */}
            {selectedMetric && (
              <div className="flex-1 overflow-y-auto p-6">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-white font-mono">{selectedMetric.name}</h2>
                  <p className="text-sm text-zinc-400 mt-1">{selectedMetric.description}</p>
                </div>

                {/* Labels */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {Object.entries(selectedMetric.labels).map(([k, v]) => (
                    <span key={k} className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full font-mono">
                      {k}=<span className="text-indigo-400">{v}</span>
                    </span>
                  ))}
                  <span className={cn("text-xs px-2 py-0.5 rounded-full", METRIC_TYPE_CONFIG[selectedMetric.type].color, "bg-zinc-800 border border-zinc-700")}>
                    {METRIC_TYPE_CONFIG[selectedMetric.type].label}
                  </span>
                </div>

                {/* Chart */}
                <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-5">
                  <div className="text-xs text-zinc-500 mb-3">Values over time · unit: {selectedMetric.unit}</div>
                  <div className="flex items-end gap-2 h-40">
                    {selectedMetric.values.map((v, i) => {
                      const maxV = Math.max(...selectedMetric.values.map((x) => x.value));
                      const pct = maxV > 0 ? (v.value / maxV) * 100 : 0;
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center gap-1">
                          <div className="text-[9px] text-zinc-600">{v.value.toLocaleString()}</div>
                          <div className="w-full flex-1 flex items-end">
                            <div
                              className="w-full rounded-t bg-indigo-500/50 hover:bg-indigo-500/70 transition-colors"
                              style={{ height: `${pct}%`, minHeight: 2 }}
                            />
                          </div>
                          <div className="text-[9px] text-zinc-600">{v.ts}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  {[
                    { label: "Current", value: selectedMetric.currentValue.toLocaleString() },
                    { label: "Max", value: Math.max(...selectedMetric.values.map((v) => v.value)).toLocaleString() },
                    { label: "Min", value: Math.min(...selectedMetric.values.map((v) => v.value)).toLocaleString() },
                  ].map((s) => (
                    <div key={s.label} className="bg-zinc-900 rounded-lg p-3 border border-zinc-800">
                      <div className="text-xs text-zinc-500">{s.label}</div>
                      <div className="text-base font-bold text-indigo-400">{s.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === "log" && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">📋</div>
              <div className="text-lg font-semibold text-white mb-1">Log stream</div>
              <div className="text-sm text-zinc-500">Switch to the Log Viewer for full log browsing</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

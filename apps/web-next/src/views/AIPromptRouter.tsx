import React, { useState } from "react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type RouteAction = "direct" | "load-balance" | "fallback" | "ab-test";
type ModelStatus = "healthy" | "degraded" | "down";
type RoutePriority = "latency" | "cost" | "quality" | "balanced";

interface Model {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  inputCostPer1k: number;
  outputCostPer1k: number;
  avgLatencyMs: number;
  status: ModelStatus;
  p99LatencyMs: number;
  errorRate: number;
  successRate: number;
}

interface Route {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  action: RouteAction;
  priority: RoutePriority;
  modelIds: string[];
  conditions: string[];
  requestCount24h: number;
  avgCostPer1k: number;
  avgLatencyMs: number;
  errorRate: number;
}

interface RoutingEvent {
  id: string;
  timestamp: string;
  routeName: string;
  selectedModel: string;
  reason: string;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  cost: number;
  status: "success" | "fallback" | "error";
}

// ── Sample Data ────────────────────────────────────────────────────────────

const models: Model[] = [
  {
    id: "claude-opus-4", name: "Claude Opus 4", provider: "Anthropic",
    contextWindow: 200_000, inputCostPer1k: 15.00, outputCostPer1k: 75.00,
    avgLatencyMs: 2800, status: "healthy", p99LatencyMs: 8200, errorRate: 0.2, successRate: 99.8,
  },
  {
    id: "claude-sonnet-4", name: "Claude Sonnet 4", provider: "Anthropic",
    contextWindow: 200_000, inputCostPer1k: 3.00, outputCostPer1k: 15.00,
    avgLatencyMs: 1400, status: "healthy", p99LatencyMs: 4100, errorRate: 0.3, successRate: 99.7,
  },
  {
    id: "gpt-4o", name: "GPT-4o", provider: "OpenAI",
    contextWindow: 128_000, inputCostPer1k: 2.50, outputCostPer1k: 10.00,
    avgLatencyMs: 1600, status: "healthy", p99LatencyMs: 4800, errorRate: 0.8, successRate: 99.2,
  },
  {
    id: "gpt-4o-mini", name: "GPT-4o Mini", provider: "OpenAI",
    contextWindow: 128_000, inputCostPer1k: 0.15, outputCostPer1k: 0.60,
    avgLatencyMs: 420, status: "healthy", p99LatencyMs: 1200, errorRate: 0.5, successRate: 99.5,
  },
  {
    id: "gemini-2-flash", name: "Gemini 2.0 Flash", provider: "Google",
    contextWindow: 1_048_576, inputCostPer1k: 0.10, outputCostPer1k: 0.40,
    avgLatencyMs: 380, status: "healthy", p99LatencyMs: 980, errorRate: 1.2, successRate: 98.8,
  },
  {
    id: "gemini-2-pro", name: "Gemini 2.0 Pro", provider: "Google",
    contextWindow: 1_048_576, inputCostPer1k: 1.25, outputCostPer1k: 5.00,
    avgLatencyMs: 2100, status: "degraded", p99LatencyMs: 9800, errorRate: 3.4, successRate: 96.6,
  },
  {
    id: "llama-3-70b", name: "Llama 3.3 70B", provider: "Groq",
    contextWindow: 128_000, inputCostPer1k: 0.59, outputCostPer1k: 0.79,
    avgLatencyMs: 240, status: "healthy", p99LatencyMs: 680, errorRate: 0.4, successRate: 99.6,
  },
  {
    id: "mistral-large", name: "Mistral Large 2", provider: "Mistral",
    contextWindow: 128_000, inputCostPer1k: 2.00, outputCostPer1k: 6.00,
    avgLatencyMs: 1800, status: "down", p99LatencyMs: 0, errorRate: 100, successRate: 0,
  },
];

const routes: Route[] = [
  {
    id: "r1", name: "Production Chat", description: "Main chat interface — optimize for quality and reliability",
    enabled: true, action: "fallback", priority: "quality",
    modelIds: ["claude-sonnet-4", "gpt-4o", "gpt-4o-mini"],
    conditions: ["context <= 100k tokens", "not code-heavy"],
    requestCount24h: 124_820, avgCostPer1k: 3.00, avgLatencyMs: 1420, errorRate: 0.3,
  },
  {
    id: "r2", name: "Cost-Optimized Tasks", description: "Background/batch tasks — minimize cost",
    enabled: true, action: "direct", priority: "cost",
    modelIds: ["gpt-4o-mini"],
    conditions: ["task_type = background", "latency_tolerance = high"],
    requestCount24h: 84_200, avgCostPer1k: 0.15, avgLatencyMs: 440, errorRate: 0.5,
  },
  {
    id: "r3", name: "Fast API Tier", description: "High-frequency, low-latency API responses",
    enabled: true, action: "load-balance", priority: "latency",
    modelIds: ["gemini-2-flash", "llama-3-70b", "gpt-4o-mini"],
    conditions: ["latency_sla < 500ms"],
    requestCount24h: 312_000, avgCostPer1k: 0.25, avgLatencyMs: 350, errorRate: 0.9,
  },
  {
    id: "r4", name: "Deep Reasoning", description: "Complex analysis, long-context reasoning",
    enabled: true, action: "fallback", priority: "quality",
    modelIds: ["claude-opus-4", "claude-sonnet-4"],
    conditions: ["task_complexity = high", "context > 50k tokens"],
    requestCount24h: 8_400, avgCostPer1k: 15.00, avgLatencyMs: 2820, errorRate: 0.2,
  },
  {
    id: "r5", name: "Experimental A/B", description: "Testing new models against production baseline",
    enabled: true, action: "ab-test", priority: "balanced",
    modelIds: ["claude-sonnet-4", "gemini-2-pro"],
    conditions: ["user_segment = beta"],
    requestCount24h: 4_200, avgCostPer1k: 2.10, avgLatencyMs: 1680, errorRate: 1.8,
  },
  {
    id: "r6", name: "Code Generation", description: "Dedicated route for coding tasks",
    enabled: false, action: "direct", priority: "quality",
    modelIds: ["claude-sonnet-4"],
    conditions: ["task_type = code"],
    requestCount24h: 0, avgCostPer1k: 3.00, avgLatencyMs: 0, errorRate: 0,
  },
];

const events: RoutingEvent[] = [
  { id: "e1", timestamp: "06:14:22", routeName: "Fast API Tier", selectedModel: "gemini-2-flash", reason: "lowest latency in pool", inputTokens: 120, outputTokens: 84, latencyMs: 312, cost: 0.00005, status: "success" },
  { id: "e2", timestamp: "06:14:21", routeName: "Production Chat", selectedModel: "claude-sonnet-4", reason: "primary model", inputTokens: 2840, outputTokens: 1200, latencyMs: 1820, cost: 0.0265, status: "success" },
  { id: "e3", timestamp: "06:14:19", routeName: "Deep Reasoning", selectedModel: "claude-opus-4", reason: "long context required", inputTokens: 42000, outputTokens: 8400, latencyMs: 6200, cost: 1.26, status: "success" },
  { id: "e4", timestamp: "06:14:18", routeName: "Cost-Optimized Tasks", selectedModel: "gpt-4o-mini", reason: "batch task", inputTokens: 800, outputTokens: 400, latencyMs: 480, cost: 0.00036, status: "success" },
  { id: "e5", timestamp: "06:14:17", routeName: "Fast API Tier", selectedModel: "llama-3-70b", reason: "load balance rotation", inputTokens: 200, outputTokens: 150, latencyMs: 280, cost: 0.000237, status: "success" },
  { id: "e6", timestamp: "06:14:15", routeName: "Production Chat", selectedModel: "gpt-4o", reason: "fallback from claude-sonnet-4 (timeout)", inputTokens: 1200, outputTokens: 600, latencyMs: 2100, cost: 0.009, status: "fallback" },
  { id: "e7", timestamp: "06:14:10", routeName: "Experimental A/B", selectedModel: "gemini-2-pro", reason: "A/B test allocation", inputTokens: 3000, outputTokens: 1800, latencyMs: 4200, cost: 0.01275, status: "success" },
  { id: "e8", timestamp: "06:14:08", routeName: "Fast API Tier", selectedModel: "gpt-4o-mini", reason: "load balance rotation", inputTokens: 90, outputTokens: 60, latencyMs: 390, cost: 0.0000495, status: "success" },
  { id: "e9", timestamp: "06:14:06", routeName: "Production Chat", selectedModel: "claude-sonnet-4", reason: "primary model", inputTokens: 5200, outputTokens: 2100, latencyMs: 2400, cost: 0.0471, status: "success" },
  { id: "e10", timestamp: "06:14:04", routeName: "Deep Reasoning", selectedModel: "claude-sonnet-4", reason: "fallback from opus (rate limit)", inputTokens: 8400, outputTokens: 3200, latencyMs: 3100, cost: 0.073, status: "fallback" },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function statusColor(s: ModelStatus): string {
  const map: Record<ModelStatus, string> = {
    healthy:  "bg-emerald-400",
    degraded: "bg-amber-400",
    down:     "bg-rose-400",
  };
  return map[s];
}

function statusText(s: ModelStatus): string {
  const map: Record<ModelStatus, string> = {
    healthy:  "text-emerald-400",
    degraded: "text-amber-400",
    down:     "text-rose-400",
  };
  return map[s];
}

function actionColor(a: RouteAction): string {
  const map: Record<RouteAction, string> = {
    direct:        "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
    "load-balance": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    fallback:      "bg-amber-500/20 text-amber-400 border-amber-500/30",
    "ab-test":     "bg-blue-500/20 text-blue-400 border-blue-500/30",
  };
  return map[a];
}

function eventStatusColor(s: RoutingEvent["status"]): string {
  const map: Record<RoutingEvent["status"], string> = {
    success:  "text-emerald-400",
    fallback: "text-amber-400",
    error:    "text-rose-400",
  };
  return map[s];
}

function fmtCtx(n: number): string {
  if (n >= 1_000_000) {return (n / 1_000_000).toFixed(0) + "M";}
  return (n / 1_000).toFixed(0) + "K";
}

// ── Tabs ───────────────────────────────────────────────────────────────────

function RoutesTab() {
  const [selected, setSelected] = useState<Route | null>(null);

  return (
    <div className="space-y-3">
      {routes.map((route) => (
        <div
          key={route.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            !route.enabled && "opacity-50",
            selected?.id === route.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
          )}
          onClick={() => setSelected(selected?.id === route.id ? null : route)}
        >
          <div className="flex items-center gap-3">
            <div className={cn("w-2 h-2 rounded-full shrink-0", route.enabled ? "bg-emerald-400" : "bg-zinc-600")} />
            <span className="font-medium text-white">{route.name}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", actionColor(route.action))}>
              {route.action}
            </span>
            <span className="text-xs text-zinc-500 ml-auto">{(route.requestCount24h / 1000).toFixed(0)}K req/24h</span>
            <span className="text-xs text-emerald-400">${route.avgCostPer1k.toFixed(2)}/1K</span>
            <span className="text-xs text-indigo-400">{route.avgLatencyMs}ms avg</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 ml-5">{route.description}</p>

          {selected?.id === route.id && (
            <div className="mt-4 ml-5 border-t border-zinc-800 pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-zinc-500 mb-1">Models in pool</div>
                  <div className="flex flex-wrap gap-1">
                    {route.modelIds.map((mid) => {
                      const m = models.find((mo) => mo.id === mid);
                      return (
                        <span key={mid} className="bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded text-xs">
                          {m?.name ?? mid}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1">Conditions</div>
                  <div className="space-y-0.5">
                    {route.conditions.map((c, i) => (
                      <div key={i} className="text-zinc-400 font-mono">{c}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-zinc-500">Priority</div>
                  <div className="text-indigo-400">{route.priority}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Requests (24h)</div>
                  <div className="text-white">{route.requestCount24h.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-zinc-500">Error rate</div>
                  <div className={route.errorRate > 2 ? "text-rose-400" : "text-emerald-400"}>{route.errorRate}%</div>
                </div>
                <div>
                  <div className="text-zinc-500">Avg latency</div>
                  <div className="text-zinc-300">{route.avgLatencyMs}ms</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ModelsTab() {
  const [selected, setSelected] = useState<Model | null>(null);
  const maxLatency = Math.max(...models.filter((m) => m.status !== "down").map((m) => m.avgLatencyMs));

  return (
    <div className="space-y-3">
      {models.map((m) => (
        <div
          key={m.id}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all",
            selected?.id === m.id ? "border-indigo-500 bg-indigo-500/5" : "border-zinc-800 bg-zinc-900 hover:border-zinc-600"
          )}
          onClick={() => setSelected(selected?.id === m.id ? null : m)}
        >
          <div className="flex items-center gap-3">
            <span className={cn("w-2 h-2 rounded-full shrink-0", statusColor(m.status))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-white">{m.name}</span>
                <span className="text-xs text-zinc-500">{m.provider}</span>
              </div>
              <div className="text-xs text-zinc-500 mt-0.5">ctx {fmtCtx(m.contextWindow)}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-zinc-300">in ${m.inputCostPer1k}/1K · out ${m.outputCostPer1k}/1K</div>
              <div className="text-zinc-500 mt-0.5">{m.avgLatencyMs}ms avg</div>
            </div>
            <div className={cn("text-xs font-semibold capitalize", statusText(m.status))}>{m.status}</div>
          </div>

          {/* Latency bar */}
          {m.status !== "down" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-zinc-500 w-14">Latency</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-1.5">
                <div
                  className={cn("h-1.5 rounded-full", m.status === "degraded" ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: (m.avgLatencyMs / maxLatency * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-zinc-400 w-16 text-right">{m.avgLatencyMs}ms</span>
            </div>
          )}

          {selected?.id === m.id && (
            <div className="mt-4 border-t border-zinc-800 pt-4 grid grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-zinc-500">p99 Latency</div>
                <div className="text-zinc-300">{m.status === "down" ? "—" : m.p99LatencyMs + "ms"}</div>
              </div>
              <div>
                <div className="text-zinc-500">Error Rate</div>
                <div className={m.errorRate > 2 ? "text-rose-400" : "text-emerald-400"}>{m.errorRate}%</div>
              </div>
              <div>
                <div className="text-zinc-500">Success Rate</div>
                <div className={m.successRate > 99 ? "text-emerald-400" : "text-amber-400"}>{m.successRate}%</div>
              </div>
              <div>
                <div className="text-zinc-500">Context Window</div>
                <div className="text-zinc-300">{fmtCtx(m.contextWindow)} tokens</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function EventsTab() {
  const [filter, setFilter] = useState<"all" | "fallback" | "error">("all");

  const filtered = events.filter((e) => filter === "all" || e.status === filter);

  return (
    <div className="space-y-3">
      <div className="flex gap-2 mb-4">
        {(["all", "fallback", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors",
              filter === f ? "bg-indigo-600 text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-900">
              <th className="text-left px-3 py-2 text-zinc-400">Time</th>
              <th className="text-left px-3 py-2 text-zinc-400">Route</th>
              <th className="text-left px-3 py-2 text-zinc-400">Model</th>
              <th className="text-left px-3 py-2 text-zinc-400">Reason</th>
              <th className="text-left px-3 py-2 text-zinc-400">Tokens</th>
              <th className="text-left px-3 py-2 text-zinc-400">Latency</th>
              <th className="text-left px-3 py-2 text-zinc-400">Cost</th>
              <th className="text-left px-3 py-2 text-zinc-400">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((ev) => (
              <tr key={ev.id} className="bg-zinc-950 hover:bg-zinc-900 transition-colors">
                <td className="px-3 py-2 font-mono text-zinc-500">{ev.timestamp}</td>
                <td className="px-3 py-2 text-zinc-300">{ev.routeName}</td>
                <td className="px-3 py-2 text-indigo-400">{ev.selectedModel}</td>
                <td className="px-3 py-2 text-zinc-500 max-w-xs truncate">{ev.reason}</td>
                <td className="px-3 py-2 text-zinc-400">{ev.inputTokens}/{ev.outputTokens}</td>
                <td className="px-3 py-2 text-zinc-300">{ev.latencyMs}ms</td>
                <td className="px-3 py-2 text-emerald-400">${ev.cost.toFixed(5)}</td>
                <td className={cn("px-3 py-2 capitalize font-medium", eventStatusColor(ev.status))}>{ev.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const routeReqs = routes.filter((r) => r.enabled && r.requestCount24h > 0);
  const totalReqs = routeReqs.reduce((a, r) => a + r.requestCount24h, 0);

  const modelUsage: Record<string, number> = {};
  routes.filter((r) => r.enabled).forEach((r) => {
    r.modelIds.forEach((mid) => {
      modelUsage[mid] = (modelUsage[mid] ?? 0) + Math.round(r.requestCount24h / r.modelIds.length);
    });
  });
  const sortedModels = Object.entries(modelUsage).toSorted((a, b) => b[1] - a[1]);
  const maxModelReqs = sortedModels[0]?.[1] ?? 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Requests (24h)", value: (totalReqs / 1000).toFixed(0) + "K" },
          { label: "Active Routes", value: routes.filter((r) => r.enabled).length.toString() },
          { label: "Models Available", value: models.filter((m) => m.status === "healthy").length.toString() },
          { label: "Avg Error Rate", value: (routeReqs.reduce((a, r) => a + r.errorRate, 0) / routeReqs.length).toFixed(1) + "%" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-sm text-zinc-400 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Requests by Route (24h)</h3>
        <div className="space-y-3">
          {routeReqs.toSorted((a, b) => b.requestCount24h - a.requestCount24h).map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="text-xs text-zinc-300 w-40 truncate">{r.name}</span>
              <div className="flex-1 bg-zinc-800 rounded-full h-2">
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: (r.requestCount24h / (routeReqs[0]?.requestCount24h ?? 1) * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-zinc-300 w-16 text-right">{(r.requestCount24h / 1000).toFixed(0)}K</span>
              <span className="text-xs text-zinc-500 w-10 text-right">{(r.requestCount24h / totalReqs * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Model Utilization</h3>
        <div className="space-y-3">
          {sortedModels.map(([mid, count]) => {
            const m = models.find((mo) => mo.id === mid);
            return (
              <div key={mid} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40">
                  <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", m ? statusColor(m.status) : "bg-zinc-500")} />
                  <span className="text-xs text-zinc-300 truncate">{m?.name ?? mid}</span>
                </div>
                <div className="flex-1 bg-zinc-800 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: (count / maxModelReqs * 100) + "%" }}
                  />
                </div>
                <span className="text-xs text-zinc-300 w-16 text-right">{(count / 1000).toFixed(0)}K</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Routes", "Models", "Events", "Analytics"] as const;
type Tab = typeof TABS[number];

export default function AIPromptRouter() {
  const [tab, setTab] = useState<Tab>("Routes");

  const healthyModels = models.filter((m) => m.status === "healthy").length;
  const downModels = models.filter((m) => m.status === "down").length;
  const totalReqs = routes.filter((r) => r.enabled).reduce((a, r) => a + r.requestCount24h, 0);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold">AI Prompt Router</h1>
          {downModels > 0 && (
            <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-3 py-1">
              {downModels} model{downModels > 1 ? "s" : ""} down
            </span>
          )}
        </div>
        <p className="text-zinc-400 text-sm">
          Intelligent routing across {models.length} models · {routes.filter((r) => r.enabled).length} active routes · {(totalReqs / 1000).toFixed(0)}K requests today · {healthyModels}/{models.length} healthy
        </p>
      </div>

      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px",
              tab === t
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-zinc-400 hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Routes" && <RoutesTab />}
      {tab === "Models" && <ModelsTab />}
      {tab === "Events" && <EventsTab />}
      {tab === "Analytics" && <AnalyticsTab />}
    </div>
  );
}

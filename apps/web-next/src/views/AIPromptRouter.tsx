import React, { useState } from "react";
import { cn } from "../lib/utils";
import { ContextualEmptyState } from "../components/ui/ContextualEmptyState";
import { Route } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton";

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

interface RouteConfig {
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

const routes: RouteConfig[] = [
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
  const [selected, setSelected] = useState<RouteConfig | null>(null);

  return (
    <section aria-label="Routes configuration" className="space-y-3">
      {routes.length === 0 && (
        <ContextualEmptyState
          icon={Route}
          title="No routes configured"
          description="Set up your first routing rule to intelligently distribute prompts across models."
          size="md"
        />
      )}
      {routes.map((route) => (
        <div
          key={route.id}
          role="button"
          tabIndex={0}
          aria-expanded={selected?.id === route.id}
          onClick={() => setSelected(selected?.id === route.id ? null : route)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected?.id === route.id ? null : route); } }}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
            !route.enabled && "opacity-50",
            selected?.id === route.id ? "border-indigo-500 bg-indigo-500/5" : "border-tok-border bg-surface-1 hover:border-tok-border"
          )}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={cn("w-2 h-2 rounded-full shrink-0", route.enabled ? "bg-emerald-400" : "bg-surface-3")} />
            <span className="font-medium text-fg-primary">{route.name}</span>
            <span className={cn("text-xs px-1.5 py-0.5 rounded border capitalize", actionColor(route.action))}>
              {route.action}
            </span>
            <span className="text-xs text-fg-muted ml-auto">{(route.requestCount24h / 1000).toFixed(0)}K req/24h</span>
            <span className="text-xs text-emerald-400">${route.avgCostPer1k.toFixed(2)}/1K</span>
            <span className="text-xs text-indigo-400">{route.avgLatencyMs}ms avg</span>
          </div>
          <p className="text-xs text-fg-muted mt-1 ml-5">{route.description}</p>

          {selected?.id === route.id && (
            <div className="mt-4 ml-5 border-t border-tok-border pt-4 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <div className="text-fg-muted mb-1">Models in pool</div>
                  <div className="flex flex-wrap gap-1">
                    {route.modelIds.map((mid) => {
                      const m = models.find((mo) => mo.id === mid);
                      return (
                        <span key={mid} className="bg-surface-2 text-fg-primary px-2 py-0.5 rounded text-xs">
                          {m?.name ?? mid}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <div className="text-fg-muted mb-1">Conditions</div>
                  <div className="space-y-0.5">
                    {route.conditions.map((c, i) => (
                      <div key={i} className="text-fg-secondary font-mono">{c}</div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <div className="text-fg-muted">Priority</div>
                  <div className="text-indigo-400">{route.priority}</div>
                </div>
                <div>
                  <div className="text-fg-muted">Requests (24h)</div>
                  <div className="text-fg-primary">{route.requestCount24h.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-fg-muted">Error rate</div>
                  <div className={route.errorRate > 2 ? "text-rose-400" : "text-emerald-400"}>{route.errorRate}%</div>
                </div>
                <div>
                  <div className="text-fg-muted">Avg latency</div>
                  <div className="text-fg-primary">{route.avgLatencyMs}ms</div>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function ModelsTab() {
  const [selected, setSelected] = useState<Model | null>(null);
  const maxLatency = Math.max(...models.filter((m) => m.status !== "down").map((m) => m.avgLatencyMs));

  return (
    <section aria-label="Model statuses" className="space-y-3">
      {models.map((m) => (
        <div
          key={m.id}
          role="button"
          tabIndex={0}
          aria-expanded={selected?.id === m.id}
          onClick={() => setSelected(selected?.id === m.id ? null : m)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(selected?.id === m.id ? null : m); } }}
          className={cn(
            "rounded-xl border p-4 cursor-pointer transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
            selected?.id === m.id ? "border-indigo-500 bg-indigo-500/5" : "border-tok-border bg-surface-1 hover:border-tok-border"
          )}
        >
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className={cn("w-2 h-2 rounded-full shrink-0", statusColor(m.status))} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-fg-primary">{m.name}</span>
                <span className="text-xs text-fg-muted">{m.provider}</span>
              </div>
              <div className="text-xs text-fg-muted mt-0.5">ctx {fmtCtx(m.contextWindow)}</div>
            </div>
            <div className="text-right text-xs">
              <div className="text-fg-primary">in ${m.inputCostPer1k}/1K · out ${m.outputCostPer1k}/1K</div>
              <div className="text-fg-muted mt-0.5">{m.avgLatencyMs}ms avg</div>
            </div>
            <div className={cn("text-xs font-semibold capitalize", statusText(m.status))}>{m.status}</div>
          </div>

          {/* Latency bar */}
          {m.status !== "down" && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-xs text-fg-muted w-14">Latency</span>
              <div
                className="flex-1 bg-surface-2 rounded-full h-1.5"
                role="img"
                aria-label={`${m.name} latency: ${m.avgLatencyMs}ms`}
              >
                <div
                  className={cn("h-1.5 rounded-full", m.status === "degraded" ? "bg-amber-500" : "bg-emerald-500")}
                  style={{ width: (m.avgLatencyMs / maxLatency * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-fg-secondary w-16 text-right" aria-hidden="true">{m.avgLatencyMs}ms</span>
            </div>
          )}

          {selected?.id === m.id && (
            <div className="mt-4 border-t border-tok-border pt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <div className="text-fg-muted">p99 Latency</div>
                <div className="text-fg-primary">{m.status === "down" ? "—" : m.p99LatencyMs + "ms"}</div>
              </div>
              <div>
                <div className="text-fg-muted">Error Rate</div>
                <div className={m.errorRate > 2 ? "text-rose-400" : "text-emerald-400"}>{m.errorRate}%</div>
              </div>
              <div>
                <div className="text-fg-muted">Success Rate</div>
                <div className={m.successRate > 99 ? "text-emerald-400" : "text-amber-400"}>{m.successRate}%</div>
              </div>
              <div>
                <div className="text-fg-muted">Context Window</div>
                <div className="text-fg-primary">{fmtCtx(m.contextWindow)} tokens</div>
              </div>
            </div>
          )}
        </div>
      ))}
    </section>
  );
}

function EventsTab() {
  const [filter, setFilter] = useState<"all" | "fallback" | "error">("all");

  const filtered = events.filter((e) => filter === "all" || e.status === filter);

  return (
    <section aria-label="Routing events" className="space-y-3">
      <div role="group" aria-label="Filter events by status" className="flex gap-2 mb-4">
        {(["all", "fallback", "error"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "px-3 py-1 rounded-full text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
              filter === f ? "bg-indigo-600 text-fg-primary" : "bg-surface-2 text-fg-secondary hover:text-fg-primary"
            )}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-tok-border overflow-hidden" aria-live="polite">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-tok-border bg-surface-1">
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Time</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Route</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Model</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Reason</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Tokens</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Latency</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Cost</th>
              <th scope="col" className="text-left px-3 py-2 text-fg-secondary">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-tok-border">
            {filtered.map((ev) => (
              <tr key={ev.id} className="bg-surface-0 hover:bg-surface-1 transition-colors">
                <td className="px-3 py-2 font-mono text-fg-muted">{ev.timestamp}</td>
                <td className="px-3 py-2 text-fg-primary">{ev.routeName}</td>
                <td className="px-3 py-2 text-indigo-400">{ev.selectedModel}</td>
                <td className="px-3 py-2 text-fg-muted max-w-xs truncate">{ev.reason}</td>
                <td className="px-3 py-2 text-fg-secondary">{ev.inputTokens}/{ev.outputTokens}</td>
                <td className="px-3 py-2 text-fg-primary">{ev.latencyMs}ms</td>
                <td className="px-3 py-2 text-emerald-400">${ev.cost.toFixed(5)}</td>
                <td className={cn("px-3 py-2 capitalize font-medium", eventStatusColor(ev.status))}>{ev.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
    <section aria-label="Analytics overview" className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Requests (24h)", value: (totalReqs / 1000).toFixed(0) + "K" },
          { label: "Active Routes", value: routes.filter((r) => r.enabled).length.toString() },
          { label: "Models Available", value: models.filter((m) => m.status === "healthy").length.toString() },
          { label: "Avg Error Rate", value: (routeReqs.reduce((a, r) => a + r.errorRate, 0) / routeReqs.length).toFixed(1) + "%" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-tok-border bg-surface-1 p-4">
            <div className="text-2xl font-bold text-fg-primary">{s.value}</div>
            <div className="text-sm text-fg-secondary mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <section aria-label="Requests by route" className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Requests by Route (24h)</h2>
        <div className="space-y-3">
          {routeReqs.toSorted((a, b) => b.requestCount24h - a.requestCount24h).map((r) => (
            <div key={r.id} className="flex items-center gap-3">
              <span className="text-xs text-fg-primary w-40 truncate">{r.name}</span>
              <div
                className="flex-1 bg-surface-2 rounded-full h-2"
                role="img"
                aria-label={`${r.name}: ${(r.requestCount24h / 1000).toFixed(0)}K requests`}
              >
                <div
                  className="h-2 rounded-full bg-indigo-500"
                  style={{ width: (r.requestCount24h / (routeReqs[0]?.requestCount24h ?? 1) * 100) + "%" }}
                />
              </div>
              <span className="text-xs text-fg-primary w-16 text-right" aria-hidden="true">{(r.requestCount24h / 1000).toFixed(0)}K</span>
              <span className="text-xs text-fg-muted w-10 text-right" aria-hidden="true">{(r.requestCount24h / totalReqs * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </section>

      <section aria-label="Model utilization" className="rounded-xl border border-tok-border bg-surface-1 p-5">
        <h2 className="text-sm font-semibold text-fg-primary mb-4">Model Utilization</h2>
        <div className="space-y-3">
          {sortedModels.map(([mid, count]) => {
            const m = models.find((mo) => mo.id === mid);
            return (
              <div key={mid} className="flex items-center gap-3">
                <div className="flex items-center gap-2 w-40">
                  <span aria-hidden="true" className={cn("w-1.5 h-1.5 rounded-full shrink-0", m ? statusColor(m.status) : "bg-surface-3")} />
                  <span className="text-xs text-fg-primary truncate">{m?.name ?? mid}</span>
                </div>
                <div
                  className="flex-1 bg-surface-2 rounded-full h-2"
                  role="img"
                  aria-label={`${m?.name ?? mid}: ${(count / 1000).toFixed(0)}K requests`}
                >
                  <div
                    className="h-2 rounded-full bg-emerald-500"
                    style={{ width: (count / maxModelReqs * 100) + "%" }}
                  />
                </div>
                <span className="text-xs text-fg-primary w-16 text-right" aria-hidden="true">{(count / 1000).toFixed(0)}K</span>
              </div>
            );
          })}
        </div>
      </section>
    </section>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────

const TABS = ["Routes", "Models", "Events", "Analytics"] as const;
type Tab = typeof TABS[number];

function AIPromptRouterSkeleton() {
  return (
    <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton variant="text" className="w-96 h-3" />
      </div>
      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-tok-border">
        {[64, 64, 60, 80].map((w, i) => (
          <Skeleton key={i} className="h-9 mb-px" style={{ width: w }} />
        ))}
      </div>
      {/* Route cards */}
      <div className="space-y-3">
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="rounded-xl border border-tok-border bg-surface-1 p-4">
            <div className="flex items-center gap-3">
              <Skeleton variant="circle" className="w-2 h-2" />
              <Skeleton variant="text" className="w-36 h-4" />
              <Skeleton className="h-5 w-16" />
              <div className="ml-auto flex items-center gap-4">
                <Skeleton variant="text" className="w-20 h-3" />
                <Skeleton variant="text" className="w-14 h-3" />
                <Skeleton variant="text" className="w-16 h-3" />
              </div>
            </div>
            <Skeleton variant="text" className="w-64 h-3 mt-1 ml-5" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AIPromptRouter({ isLoading = false }: { isLoading?: boolean }) {
  if (isLoading) return <AIPromptRouterSkeleton />;

  const [tab, setTab] = useState<Tab>("Routes");

  const healthyModels = models.filter((m) => m.status === "healthy").length;
  const downModels = models.filter((m) => m.status === "down").length;
  const totalReqs = routes.filter((r) => r.enabled).reduce((a, r) => a + r.requestCount24h, 0);

  return (
    <>
      <a
        href="#aipr-main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-surface-0 text-fg-primary p-3 sm:p-4 md:p-6">
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold">AI Prompt Router</h1>
            {downModels > 0 && (
              <span role="status" className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-full px-3 py-1">
                {downModels} model{downModels > 1 ? "s" : ""} down
              </span>
            )}
          </div>
          <p className="text-fg-secondary text-sm">
            Intelligent routing across {models.length} models · {routes.filter((r) => r.enabled).length} active routes · {(totalReqs / 1000).toFixed(0)}K requests today · {healthyModels}/{models.length} healthy
          </p>
        </div>

        <div role="tablist" aria-label="Router sections" className="flex gap-1 mb-6 border-b border-tok-border">
          {TABS.map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`aipr-panel-${t.toLowerCase()}`}
              onClick={() => setTab(t)}
              className={cn(
                "px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
                tab === t
                  ? "border-indigo-500 text-indigo-400"
                  : "border-transparent text-fg-secondary hover:text-fg-primary"
              )}
            >
              {t}
            </button>
          ))}
        </div>

        <main id="aipr-main">
          {tab === "Routes" && <RoutesTab />}
          {tab === "Models" && <ModelsTab />}
          {tab === "Events" && <EventsTab />}
          {tab === "Analytics" && <AnalyticsTab />}
        </main>
      </div>
    </>
  );
}

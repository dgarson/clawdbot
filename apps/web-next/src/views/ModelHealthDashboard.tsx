import React, { useState } from "react";
import { cn } from "../lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModelStatus = "healthy" | "degraded" | "down" | "maintenance";
type Provider = "anthropic" | "google" | "minimax" | "openai" | "meta" | "mistral";

interface ModelLatencyBucket {
  label: string; // e.g. "<1s", "1-2s", "2-5s", ">5s"
  count: number;
  pct: number;
}

interface ModelIncident {
  id: string;
  startedAt: string;
  resolvedAt: string | null;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  impact: string;
}

interface ModelEndpoint {
  id: string;
  name: string;
  provider: Provider;
  model: string;
  status: ModelStatus;
  region: string;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  errorRate: number;
  requestsPerMin: number;
  uptimePct: number;
  tokensPerSec: number;
  contextWindow: number;
  latencyBuckets: ModelLatencyBucket[];
  incidents: ModelIncident[];
  hourlyRequests: number[]; // 24 values
  lastChecked: string;
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const ENDPOINTS: ModelEndpoint[] = [
  {
    id: "claude-opus",
    name: "Claude Opus 4.6",
    provider: "anthropic",
    model: "anthropic/claude-opus-4-6",
    status: "healthy",
    region: "us-east-1",
    p50Ms: 1840,
    p95Ms: 4200,
    p99Ms: 8900,
    errorRate: 0.4,
    requestsPerMin: 82,
    uptimePct: 99.91,
    tokensPerSec: 48,
    contextWindow: 200000,
    latencyBuckets: [
      { label: "<1s", count: 120, pct: 15 },
      { label: "1-2s", count: 480, pct: 60 },
      { label: "2-5s", count: 160, pct: 20 },
      { label: ">5s", count: 40, pct: 5 },
    ],
    incidents: [],
    hourlyRequests: [42, 38, 31, 28, 35, 54, 68, 82, 91, 88, 76, 68, 72, 82, 88, 84, 74, 62, 54, 48, 45, 44, 43, 42],
    lastChecked: "2026-02-22T02:15:00Z",
  },
  {
    id: "claude-sonnet",
    name: "Claude Sonnet 4.6",
    provider: "anthropic",
    model: "anthropic/claude-sonnet-4-6",
    status: "healthy",
    region: "us-east-1",
    p50Ms: 890,
    p95Ms: 2100,
    p99Ms: 4200,
    errorRate: 0.8,
    requestsPerMin: 420,
    uptimePct: 99.97,
    tokensPerSec: 96,
    contextWindow: 200000,
    latencyBuckets: [
      { label: "<1s", count: 520, pct: 52 },
      { label: "1-2s", count: 360, pct: 36 },
      { label: "2-5s", count: 100, pct: 10 },
      { label: ">5s", count: 20, pct: 2 },
    ],
    incidents: [],
    hourlyRequests: [180, 160, 140, 130, 155, 220, 310, 420, 480, 460, 430, 400, 380, 420, 450, 440, 380, 320, 270, 240, 210, 200, 190, 182],
    lastChecked: "2026-02-22T02:15:00Z",
  },
  {
    id: "minimax",
    name: "MiniMax M2.5",
    provider: "minimax",
    model: "minimax-portal/MiniMax-M2.5",
    status: "degraded",
    region: "us-west-2",
    p50Ms: 1200,
    p95Ms: 5800,
    p99Ms: 12400,
    errorRate: 3.2,
    requestsPerMin: 340,
    uptimePct: 98.4,
    tokensPerSec: 72,
    contextWindow: 1000000,
    latencyBuckets: [
      { label: "<1s", count: 240, pct: 24 },
      { label: "1-2s", count: 380, pct: 38 },
      { label: "2-5s", count: 280, pct: 28 },
      { label: ">5s", count: 100, pct: 10 },
    ],
    incidents: [
      {
        id: "inc-001",
        startedAt: "2026-02-22T00:30:00Z",
        resolvedAt: null,
        severity: "medium",
        title: "Elevated P95 Latency",
        impact: "Requests experiencing 2-3x normal latency. Affecting ~15% of traffic.",
      },
    ],
    hourlyRequests: [120, 110, 100, 95, 115, 160, 220, 340, 380, 360, 310, 280, 300, 340, 380, 360, 310, 260, 220, 200, 180, 170, 160, 120],
    lastChecked: "2026-02-22T02:14:00Z",
  },
  {
    id: "gemini-flash",
    name: "Gemini Flash Preview",
    provider: "google",
    model: "google/gemini-3-flash-preview",
    status: "healthy",
    region: "us-central1",
    p50Ms: 420,
    p95Ms: 980,
    p99Ms: 1840,
    errorRate: 1.1,
    requestsPerMin: 890,
    uptimePct: 99.85,
    tokensPerSec: 180,
    contextWindow: 1000000,
    latencyBuckets: [
      { label: "<1s", count: 820, pct: 82 },
      { label: "1-2s", count: 140, pct: 14 },
      { label: "2-5s", count: 35, pct: 3.5 },
      { label: ">5s", count: 5, pct: 0.5 },
    ],
    incidents: [],
    hourlyRequests: [380, 340, 300, 280, 320, 480, 620, 890, 960, 940, 880, 820, 840, 890, 920, 900, 820, 710, 620, 560, 500, 460, 430, 382],
    lastChecked: "2026-02-22T02:15:00Z",
  },
  {
    id: "gpt4o",
    name: "GPT-4o",
    provider: "openai",
    model: "openai/gpt-4o",
    status: "maintenance",
    region: "eastus",
    p50Ms: 0,
    p95Ms: 0,
    p99Ms: 0,
    errorRate: 100,
    requestsPerMin: 0,
    uptimePct: 99.2,
    tokensPerSec: 0,
    contextWindow: 128000,
    latencyBuckets: [],
    incidents: [
      {
        id: "inc-002",
        startedAt: "2026-02-22T02:00:00Z",
        resolvedAt: null,
        severity: "low",
        title: "Scheduled Maintenance",
        impact: "Planned maintenance window. Expected completion 03:00 UTC.",
      },
    ],
    hourlyRequests: [45, 42, 38, 36, 40, 55, 72, 95, 102, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    lastChecked: "2026-02-22T02:01:00Z",
  },
];

const STATUS_CONFIG: Record<ModelStatus, { label: string; color: string; dot: string; bg: string; border: string }> = {
  healthy: { label: "Healthy", color: "text-emerald-400", dot: "bg-emerald-400", bg: "bg-emerald-900/20", border: "border-emerald-700/50" },
  degraded: { label: "Degraded", color: "text-amber-400", dot: "bg-amber-400 animate-pulse", bg: "bg-amber-900/20", border: "border-amber-700/50" },
  down: { label: "Down", color: "text-rose-400", dot: "bg-rose-400", bg: "bg-rose-900/20", border: "border-rose-700/50" },
  maintenance: { label: "Maintenance", color: "text-blue-400", dot: "bg-blue-400", bg: "bg-blue-900/20", border: "border-blue-700/50" },
};

const SEVERITY_CONFIG = {
  low: { color: "text-[var(--color-text-secondary)]", bg: "bg-[var(--color-surface-2)] border-[var(--color-border)]" },
  medium: { color: "text-amber-400", bg: "bg-amber-900/20 border-amber-700/50" },
  high: { color: "text-orange-400", bg: "bg-orange-900/20 border-orange-700/50" },
  critical: { color: "text-rose-400", bg: "bg-rose-900/20 border-rose-700/50" },
};

const PROVIDER_EMOJI: Record<Provider, string> = {
  anthropic: "🤖",
  google: "🔵",
  minimax: "🟣",
  openai: "🟢",
  meta: "🦙",
  mistral: "💨",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModelHealthDashboard() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<ModelEndpoint | null>(ENDPOINTS[0]);
  const [filterStatus, setFilterStatus] = useState<ModelStatus | "all">("all");

  const filtered = ENDPOINTS.filter((e) => filterStatus === "all" || e.status === filterStatus);

  const healthyCount = ENDPOINTS.filter((e) => e.status === "healthy").length;
  const degradedCount = ENDPOINTS.filter((e) => e.status === "degraded").length;
  const downCount = ENDPOINTS.filter((e) => e.status === "down" || e.status === "maintenance").length;
  const totalRPM = ENDPOINTS.reduce((s, e) => s + e.requestsPerMin, 0);

  const ep = selectedEndpoint;

  return (
    <div className="h-full flex flex-col bg-[var(--color-surface-0)] overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--color-text-primary)]">Model Health Dashboard</h1>
            <p className="text-sm text-[var(--color-text-secondary)]">Real-time status of LLM endpoints and providers</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-xs text-[var(--color-text-muted)]">Last updated: 02:15:00 UTC</div>
            <button className="bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] px-3 py-1.5 rounded text-sm">⟳</button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="grid grid-cols-5 gap-3 mb-4">
          {[
            { label: "Healthy", value: healthyCount, color: "text-emerald-400" },
            { label: "Degraded", value: degradedCount, color: "text-amber-400" },
            { label: "Down / Maintenance", value: downCount, color: "text-rose-400" },
            { label: "Total Req/Min", value: totalRPM.toLocaleString(), color: "text-indigo-400" },
            { label: "Active Incidents", value: ENDPOINTS.reduce((s, e) => s + e.incidents.filter((i) => !i.resolvedAt).length, 0), color: "text-orange-400" },
          ].map((s) => (
            <div key={s.label} className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
              <div className={cn("text-xl font-bold", s.color)}>{s.value}</div>
              <div className="text-xs text-[var(--color-text-muted)]">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Status filter */}
        <div className="flex gap-1">
          {(["all", "healthy", "degraded", "down", "maintenance"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s as ModelStatus | "all")}
              className={cn(
                "px-3 py-1 rounded text-xs capitalize",
                filterStatus === s ? "bg-indigo-600 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              {s === "all" ? "All Providers" : s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex">
        {/* Endpoint list */}
        <div className="flex-shrink-0 w-72 border-r border-[var(--color-border)] overflow-y-auto p-3 space-y-2">
          {filtered.map((endpoint) => {
            const sc = STATUS_CONFIG[endpoint.status];
            const isSelected = selectedEndpoint?.id === endpoint.id;
            return (
              <button
                key={endpoint.id}
                onClick={() => setSelectedEndpoint(endpoint)}
                className={cn(
                  "w-full text-left p-3 rounded-xl border transition-all",
                  isSelected ? "bg-indigo-900/20 border-indigo-600/50" : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-surface-3)]"
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span>{PROVIDER_EMOJI[endpoint.provider]}</span>
                    <div>
                      <div className="text-sm font-semibold text-[var(--color-text-primary)]">{endpoint.name}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)]">{endpoint.region}</div>
                    </div>
                  </div>
                  <span className={cn("flex items-center gap-1 text-xs", sc.color)}>
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", sc.dot)} />
                    {sc.label}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-[10px]">
                  <div>
                    <div className="text-[var(--color-text-muted)]">P50</div>
                    <div className="text-[var(--color-text-primary)]">{endpoint.p50Ms > 0 ? `${endpoint.p50Ms}ms` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-muted)]">RPM</div>
                    <div className="text-indigo-400">{endpoint.requestsPerMin}</div>
                  </div>
                  <div>
                    <div className="text-[var(--color-text-muted)]">Errors</div>
                    <div className={endpoint.errorRate > 2 ? "text-rose-400" : "text-[var(--color-text-primary)]"}>{endpoint.errorRate}%</div>
                  </div>
                </div>
                {endpoint.incidents.some((i) => !i.resolvedAt) && (
                  <div className="mt-2 text-[10px] text-amber-400 bg-amber-900/20 border border-amber-700/50 rounded px-2 py-1">
                    ⚠ Active incident
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Detail panel */}
        {ep && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{PROVIDER_EMOJI[ep.provider]}</span>
                <div>
                  <h2 className="text-xl font-bold text-[var(--color-text-primary)]">{ep.name}</h2>
                  <div className="text-sm text-[var(--color-text-secondary)] font-mono">{ep.model}</div>
                </div>
              </div>
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border", STATUS_CONFIG[ep.status].bg, STATUS_CONFIG[ep.status].border)}>
                <span className={cn("w-2.5 h-2.5 rounded-full", STATUS_CONFIG[ep.status].dot)} />
                <span className={cn("text-sm font-medium", STATUS_CONFIG[ep.status].color)}>{STATUS_CONFIG[ep.status].label}</span>
              </div>
            </div>

            {/* Latency metrics */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "P50 Latency", value: ep.p50Ms > 0 ? `${ep.p50Ms}ms` : "—", color: "text-emerald-400" },
                { label: "P95 Latency", value: ep.p95Ms > 0 ? `${ep.p95Ms}ms` : "—", color: "text-amber-400" },
                { label: "P99 Latency", value: ep.p99Ms > 0 ? `${ep.p99Ms}ms` : "—", color: "text-orange-400" },
                { label: "Error Rate", value: `${ep.errorRate}%`, color: ep.errorRate > 2 ? "text-rose-400" : "text-emerald-400" },
                { label: "Req/Min", value: ep.requestsPerMin.toLocaleString(), color: "text-indigo-400" },
                { label: "Uptime", value: `${ep.uptimePct}%`, color: "text-emerald-400" },
                { label: "Tokens/Sec", value: ep.tokensPerSec > 0 ? ep.tokensPerSec.toString() : "—", color: "text-blue-400" },
                { label: "Context", value: `${(ep.contextWindow / 1000).toFixed(0)}K`, color: "text-purple-400" },
              ].map((s) => (
                <div key={s.label} className="bg-[var(--color-surface-1)] rounded-lg p-3 border border-[var(--color-border)]">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">{s.label}</div>
                  <div className={cn("text-lg font-bold", s.color)}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Hourly request chart */}
            <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 mb-5">
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Requests / Hour (last 24h)</div>
              <div className="flex items-end gap-1 h-24">
                {ep.hourlyRequests.map((v, i) => {
                  const maxV = Math.max(...ep.hourlyRequests);
                  const pct = maxV > 0 ? (v / maxV) * 100 : 0;
                  const isRecent = i >= 20;
                  return (
                    <div
                      key={i}
                      className="flex-1 rounded-t transition-all hover:brightness-125"
                      style={{
                        height: `${pct}%`,
                        minHeight: v > 0 ? 2 : 0,
                        background: isRecent ? "rgba(99,102,241,0.7)" : "rgba(99,102,241,0.3)",
                      }}
                      title={`${String(i).padStart(2, "0")}:00 — ${v} req`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-[9px] text-[var(--color-text-muted)] mt-1">
                <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>Now</span>
              </div>
            </div>

            {/* Latency distribution */}
            {ep.latencyBuckets.length > 0 && (
              <div className="bg-[var(--color-surface-1)] rounded-xl border border-[var(--color-border)] p-4 mb-5">
                <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">Latency Distribution</div>
                <div className="space-y-2">
                  {ep.latencyBuckets.map((b) => (
                    <div key={b.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-[var(--color-text-secondary)]">{b.label}</span>
                        <span className="text-[var(--color-text-primary)]">{b.count.toLocaleString()} req · {b.pct}%</span>
                      </div>
                      <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-indigo-500/60"
                          style={{ width: `${b.pct}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incidents */}
            <div>
              <div className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
                Incidents {ep.incidents.length > 0 ? `(${ep.incidents.length})` : "— None"}
              </div>
              {ep.incidents.length === 0 ? (
                <div className="bg-emerald-900/10 border border-emerald-700/30 rounded-xl p-4 text-sm text-emerald-400 text-center">
                  ✓ No incidents reported
                </div>
              ) : (
                <div className="space-y-3">
                  {ep.incidents.map((inc) => {
                    const sv = SEVERITY_CONFIG[inc.severity];
                    return (
                      <div key={inc.id} className={cn("rounded-xl border p-4", sv.bg)}>
                        <div className="flex items-start justify-between mb-1">
                          <span className={cn("text-sm font-medium", sv.color)}>{inc.title}</span>
                          <span className={cn("text-xs capitalize px-2 py-0.5 rounded", sv.bg, sv.color, "border")}>{inc.severity}</span>
                        </div>
                        <div className="text-xs text-[var(--color-text-secondary)] mb-2">{inc.impact}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          Started: {inc.startedAt.slice(11, 19)} UTC
                          {inc.resolvedAt ? ` · Resolved: ${inc.resolvedAt.slice(11, 19)} UTC` : " · Ongoing"}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

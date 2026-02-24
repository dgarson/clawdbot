import React, { useState } from "react";
import { cn } from "../lib/utils";

type SLOStatus = "healthy" | "at-risk" | "breached";
type BurnRateWindow = "1h" | "6h" | "24h" | "7d" | "30d";

interface SLO {
  id: string;
  name: string;
  service: string;
  target: number; // e.g. 99.9 = 99.9%
  current: number;
  errorBudgetMinutes: number; // total error budget for 30d
  errorBudgetUsedMinutes: number;
  burnRate1h: number;
  burnRate6h: number;
  burnRate24h: number;
  status: SLOStatus;
  lastBreached: string | null;
  trend: number[]; // 8 data points
}

interface Alert {
  id: string;
  sloId: string;
  window: BurnRateWindow;
  threshold: number;
  triggered: boolean;
  triggeredAt: string | null;
}

const SLOS: SLO[] = [
  {
    id: "slo-1",
    name: "API Availability",
    service: "API Gateway",
    target: 99.9,
    current: 99.94,
    errorBudgetMinutes: 43.2, // 30d * 1440 * 0.001
    errorBudgetUsedMinutes: 8.4,
    burnRate1h: 0.8,
    burnRate6h: 1.1,
    burnRate24h: 0.9,
    status: "healthy",
    lastBreached: null,
    trend: [99.95, 99.97, 99.92, 99.94, 99.91, 99.96, 99.94, 99.94],
  },
  {
    id: "slo-2",
    name: "LLM P95 Latency < 500ms",
    service: "LLM Proxy",
    target: 99.5,
    current: 98.8,
    errorBudgetMinutes: 216,
    errorBudgetUsedMinutes: 186,
    burnRate1h: 8.2,
    burnRate6h: 5.4,
    burnRate24h: 3.1,
    status: "at-risk",
    lastBreached: "4 days ago",
    trend: [99.2, 99.5, 99.4, 99.1, 98.9, 98.7, 98.8, 98.8],
  },
  {
    id: "slo-3",
    name: "Agent Task Success Rate",
    service: "Agent Runtime",
    target: 99.0,
    current: 99.4,
    errorBudgetMinutes: 432,
    errorBudgetUsedMinutes: 95,
    burnRate1h: 0.6,
    burnRate6h: 0.8,
    burnRate24h: 0.7,
    status: "healthy",
    lastBreached: "18 days ago",
    trend: [99.1, 99.3, 99.5, 99.4, 99.2, 99.6, 99.4, 99.4],
  },
  {
    id: "slo-4",
    name: "Webhook Delivery Rate",
    service: "Slack Integration",
    target: 99.5,
    current: 97.2,
    errorBudgetMinutes: 216,
    errorBudgetUsedMinutes: 217,
    burnRate1h: 12.4,
    burnRate6h: 9.8,
    burnRate24h: 7.2,
    status: "breached",
    lastBreached: "Active",
    trend: [99.1, 99.0, 98.4, 98.1, 97.8, 97.4, 97.2, 97.2],
  },
  {
    id: "slo-5",
    name: "DB Query P99 < 100ms",
    service: "Database",
    target: 99.9,
    current: 99.97,
    errorBudgetMinutes: 43.2,
    errorBudgetUsedMinutes: 1.2,
    burnRate1h: 0.1,
    burnRate6h: 0.2,
    burnRate24h: 0.1,
    status: "healthy",
    lastBreached: null,
    trend: [99.95, 99.97, 99.98, 99.97, 99.96, 99.98, 99.97, 99.97],
  },
];

const ALERTS: Alert[] = [
  { id: "a1", sloId: "slo-2", window: "1h",  threshold: 5,  triggered: true,  triggeredAt: "07:02 MST" },
  { id: "a2", sloId: "slo-4", window: "1h",  threshold: 10, triggered: true,  triggeredAt: "06:55 MST" },
  { id: "a3", sloId: "slo-4", window: "6h",  threshold: 5,  triggered: true,  triggeredAt: "04:30 MST" },
  { id: "a4", sloId: "slo-1", window: "6h",  threshold: 2,  triggered: false, triggeredAt: null },
  { id: "a5", sloId: "slo-3", window: "24h", threshold: 1,  triggered: false, triggeredAt: null },
];

const statusColor = (s: SLOStatus) => {
  if (s === "healthy")  {return "text-emerald-400 bg-emerald-400/10 border-emerald-400/30";}
  if (s === "at-risk")  {return "text-amber-400 bg-amber-400/10 border-amber-400/30";}
  return "text-rose-400 bg-rose-400/10 border-rose-400/30";
};

const statusDot = (s: SLOStatus) => {
  if (s === "healthy")  {return "bg-emerald-400";}
  if (s === "at-risk")  {return "bg-amber-400 animate-pulse";}
  return "bg-rose-500 animate-pulse";
};

const burnRateColor = (rate: number) => {
  if (rate < 1)  {return "text-emerald-400";}
  if (rate < 5)  {return "text-amber-400";}
  return "text-rose-400";
};

function BudgetBar({ used, total, status }: { used: number; total: number; status: SLOStatus }) {
  const pct = Math.min((used / total) * 100, 100);
  const color = status === "breached" ? "bg-rose-500" : status === "at-risk" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="relative h-2 bg-[var(--color-surface-2)] rounded overflow-hidden">
      <div className={cn("h-full rounded transition-all", color)} style={{ width: `${pct}%` }} />
      {pct >= 80 && (
        <div className="absolute right-0 top-0 bottom-0 w-px bg-rose-500 opacity-50" />
      )}
    </div>
  );
}

function Sparkline({ data, status }: { data: number[]; status: SLOStatus }) {
  const min = Math.min(...data) - 0.1;
  const max = Math.max(...data) + 0.1;
  const range = max - min || 1;
  const color = status === "breached" ? "bg-rose-400" : status === "at-risk" ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div className="flex items-end gap-px h-8">
      {data.map((v, i) => {
        const h = ((v - min) / range) * 100;
        return (
          <div
            key={i}
            className={cn("flex-1 rounded-sm opacity-70", color, i === data.length - 1 && "opacity-100")}
            style={{ height: `${Math.max(h, 8)}%` }}
            title={`${v}%`}
          />
        );
      })}
    </div>
  );
}

export default function ErrorBudgetTracker() {
  const [selectedSLOId, setSelectedSLOId] = useState<string | null>("slo-2");
  const [burnWindow, setBurnWindow] = useState<BurnRateWindow>("6h");
  const [showAlerts, setShowAlerts] = useState<boolean>(true);

  const selectedSLO = SLOS.find(s => s.id === selectedSLOId);
  const triggeredAlerts = ALERTS.filter(a => a.triggered);

  const getBurnRate = (slo: SLO) => {
    if (burnWindow === "1h") {return slo.burnRate1h;}
    if (burnWindow === "6h") {return slo.burnRate6h;}
    return slo.burnRate24h;
  };

  const healthyCount = SLOS.filter(s => s.status === "healthy").length;
  const atRiskCount  = SLOS.filter(s => s.status === "at-risk").length;
  const breachedCount = SLOS.filter(s => s.status === "breached").length;

  return (
    <div className="flex h-full bg-[var(--color-surface-0)] overflow-hidden flex-col">
      {/* Header */}
      <div className="flex items-center gap-6 px-6 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface-1)] flex-shrink-0">
        <div>
          <div className="text-sm font-semibold text-[var(--color-text-primary)]">Error Budget Tracker</div>
          <div className="text-xs text-[var(--color-text-muted)] mt-0.5">30-day rolling window · SLO compliance</div>
        </div>
        <div className="flex items-center gap-4 ml-6">
          <div className="text-center">
            <div className="text-sm font-bold text-emerald-400">{healthyCount}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Healthy</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-amber-400">{atRiskCount}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">At Risk</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-rose-400">{breachedCount}</div>
            <div className="text-[10px] text-[var(--color-text-muted)]">Breached</div>
          </div>
        </div>

        {/* Burn rate window */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-[var(--color-text-muted)]">Burn Rate Window:</span>
          <div className="flex rounded border border-[var(--color-border)] overflow-hidden">
            {(["1h", "6h", "24h"] as BurnRateWindow[]).map(w => (
              <button
                key={w}
                onClick={() => setBurnWindow(w)}
                className={cn("text-xs px-3 py-1 transition-colors", burnWindow === w ? "bg-indigo-500 text-[var(--color-text-primary)]" : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]")}
              >
                {w}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* SLO list */}
        <div className="flex-1 overflow-y-auto">
          {/* Active alerts banner */}
          {triggeredAlerts.length > 0 && showAlerts && (
            <div className="bg-rose-500/10 border-b border-rose-500/30 px-4 py-3 flex items-center gap-3">
              <span className="text-rose-400 text-xs font-semibold">🔥 {triggeredAlerts.length} burn rate alert{triggeredAlerts.length > 1 ? "s" : ""} active</span>
              <div className="flex-1 flex flex-wrap gap-2">
                {triggeredAlerts.map(a => {
                  const slo = SLOS.find(s => s.id === a.sloId);
                  return (
                    <span key={a.id} className="text-[10px] bg-rose-500/20 text-rose-300 px-2 py-0.5 rounded border border-rose-500/30">
                      {slo?.name} · {a.window} &gt; {a.threshold}× · {a.triggeredAt}
                    </span>
                  );
                })}
              </div>
              <button onClick={() => setShowAlerts(false)} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]">Dismiss</button>
            </div>
          )}

          {/* SLO table */}
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                <th className="text-left px-4 py-3">SLO</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3 w-32">Error Budget</th>
                <th className="text-left px-4 py-3">Burn Rate ({burnWindow})</th>
                <th className="text-left px-4 py-3">Trend (8w)</th>
                <th className="text-left px-4 py-3">Current SLI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/50">
              {SLOS.map(slo => {
                const budgetPct = Math.min((slo.errorBudgetUsedMinutes / slo.errorBudgetMinutes) * 100, 100);
                const burnRate = getBurnRate(slo);
                const isSelected = selectedSLOId === slo.id;
                return (
                  <tr
                    key={slo.id}
                    onClick={() => setSelectedSLOId(isSelected ? null : slo.id)}
                    className={cn("cursor-pointer hover:bg-[var(--color-surface-1)] transition-colors", isSelected && "bg-indigo-500/5")}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className={cn("w-2 h-2 rounded-full flex-shrink-0", statusDot(slo.status))} />
                        <div>
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{slo.name}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)]">{slo.service} · Target {slo.target}%</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-[10px] px-2 py-0.5 rounded border font-medium capitalize", statusColor(slo.status))}>
                        {slo.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <BudgetBar used={slo.errorBudgetUsedMinutes} total={slo.errorBudgetMinutes} status={slo.status} />
                        <div className="text-[10px] text-[var(--color-text-muted)]">
                          {budgetPct.toFixed(0)}% used · {(slo.errorBudgetMinutes - slo.errorBudgetUsedMinutes).toFixed(1)}m left
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-bold font-mono", burnRateColor(burnRate))}>
                        {burnRate.toFixed(1)}×
                      </span>
                      <div className="text-[10px] text-[var(--color-text-muted)]">
                        {burnRate > 1 ? `⚠ ${(burnRate).toFixed(1)}× faster than replenish rate` : "Within safe range"}
                      </div>
                    </td>
                    <td className="px-4 py-3 w-24">
                      <Sparkline data={slo.trend} status={slo.status} />
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("text-sm font-mono font-semibold", slo.current >= slo.target ? "text-emerald-400" : "text-rose-400")}>
                        {slo.current.toFixed(2)}%
                      </span>
                      <div className="text-[10px] text-[var(--color-text-muted)]">vs {slo.target}% target</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selectedSLO && (
          <div className="w-80 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-surface-1)] overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold text-[var(--color-text-primary)]">{selectedSLO.name}</div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{selectedSLO.service}</div>
              </div>
              <button onClick={() => setSelectedSLOId(null)} className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] text-xs">✕</button>
            </div>

            {/* Status */}
            <div className={cn("flex items-center gap-2 px-3 py-2 rounded border mb-4", statusColor(selectedSLO.status))}>
              <span className={cn("w-2 h-2 rounded-full", statusDot(selectedSLO.status))} />
              <span className="text-xs font-semibold capitalize">{selectedSLO.status}</span>
              {selectedSLO.lastBreached && (
                <span className="ml-auto text-[10px]">Last: {selectedSLO.lastBreached}</span>
              )}
            </div>

            {/* Error budget breakdown */}
            <div className="mb-4">
              <div className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Error Budget (30d)</div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">Total budget</span>
                  <span className="text-[var(--color-text-primary)]">{selectedSLO.errorBudgetMinutes.toFixed(1)} min</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">Used</span>
                  <span className={selectedSLO.status === "breached" ? "text-rose-400" : "text-amber-400"}>
                    {selectedSLO.errorBudgetUsedMinutes.toFixed(1)} min
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--color-text-secondary)]">Remaining</span>
                  <span className="text-emerald-400">
                    {Math.max(0, selectedSLO.errorBudgetMinutes - selectedSLO.errorBudgetUsedMinutes).toFixed(1)} min
                  </span>
                </div>
                <BudgetBar
                  used={selectedSLO.errorBudgetUsedMinutes}
                  total={selectedSLO.errorBudgetMinutes}
                  status={selectedSLO.status}
                />
              </div>
            </div>

            {/* Burn rates */}
            <div className="mb-4">
              <div className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Burn Rates</div>
              <div className="space-y-2">
                {[
                  { label: "1-hour",  rate: selectedSLO.burnRate1h },
                  { label: "6-hour",  rate: selectedSLO.burnRate6h },
                  { label: "24-hour", rate: selectedSLO.burnRate24h },
                ].map(({ label, rate }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--color-text-muted)] w-14">{label}</span>
                    <div className="flex-1 h-1.5 bg-[var(--color-surface-2)] rounded overflow-hidden">
                      <div
                        className={cn("h-full rounded", rate < 1 ? "bg-emerald-400" : rate < 5 ? "bg-amber-400" : "bg-rose-500")}
                        style={{ width: `${Math.min(rate * 10, 100)}%` }}
                      />
                    </div>
                    <span className={cn("text-xs font-mono font-bold w-10 text-right", burnRateColor(rate))}>
                      {rate.toFixed(1)}×
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alerts for this SLO */}
            <div>
              <div className="text-[10px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">
                Alerts ({ALERTS.filter(a => a.sloId === selectedSLO.id).length})
              </div>
              <div className="space-y-1.5">
                {ALERTS.filter(a => a.sloId === selectedSLO.id).map(alert => (
                  <div
                    key={alert.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded border text-[10px]",
                      alert.triggered
                        ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                        : "bg-[var(--color-surface-2)] border-[var(--color-border)] text-[var(--color-text-muted)]"
                    )}
                  >
                    <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", alert.triggered ? "bg-rose-500 animate-pulse" : "bg-[var(--color-surface-3)]")} />
                    <span>{alert.window} burn rate &gt; {alert.threshold}×</span>
                    {alert.triggeredAt && <span className="ml-auto">{alert.triggeredAt}</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

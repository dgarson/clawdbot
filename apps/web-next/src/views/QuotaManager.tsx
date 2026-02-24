import React, { useState } from "react";
import { cn } from "../lib/utils";

type QuotaScope = "agent" | "model" | "global";
type QuotaUnit = "tokens" | "requests" | "sessions" | "cost-cents" | "storage-mb";
type QuotaPeriod = "hourly" | "daily" | "monthly";

interface Quota {
  id: string;
  name: string;
  scope: QuotaScope;
  scopeTarget: string;
  unit: QuotaUnit;
  period: QuotaPeriod;
  limit: number;
  used: number;
  alertThreshold: number;
  hardLimit: boolean;
}

const initialQuotas: Quota[] = [
  {
    id: "1",
    name: "Luis",
    scope: "agent",
    scopeTarget: "Luis",
    unit: "tokens",
    period: "daily",
    limit: 500000,
    used: 284200,
    alertThreshold: 80,
    hardLimit: true,
  },
  {
    id: "2",
    name: "Luis",
    scope: "agent",
    scopeTarget: "Luis",
    unit: "cost-cents",
    period: "monthly",
    limit: 5000,
    used: 2840,
    alertThreshold: 75,
    hardLimit: true,
  },
  {
    id: "3",
    name: "Xavier",
    scope: "agent",
    scopeTarget: "Xavier",
    unit: "tokens",
    period: "daily",
    limit: 300000,
    used: 45100,
    alertThreshold: 80,
    hardLimit: false,
  },
  {
    id: "4",
    name: "Piper",
    scope: "agent",
    scopeTarget: "Piper",
    unit: "tokens",
    period: "daily",
    limit: 200000,
    used: 198400,
    alertThreshold: 80,
    hardLimit: true,
  },
  {
    id: "5",
    name: "Claude Sonnet",
    scope: "model",
    scopeTarget: "Claude Sonnet",
    unit: "requests",
    period: "hourly",
    limit: 100,
    used: 87,
    alertThreshold: 85,
    hardLimit: true,
  },
  {
    id: "6",
    name: "GPT-4o",
    scope: "model",
    scopeTarget: "GPT-4o",
    unit: "requests",
    period: "hourly",
    limit: 50,
    used: 12,
    alertThreshold: 80,
    hardLimit: true,
  },
  {
    id: "7",
    name: "Global",
    scope: "global",
    scopeTarget: "Global",
    unit: "sessions",
    period: "daily",
    limit: 500,
    used: 234,
    alertThreshold: 70,
    hardLimit: false,
  },
  {
    id: "8",
    name: "Global",
    scope: "global",
    scopeTarget: "Global",
    unit: "cost-cents",
    period: "daily",
    limit: 2000,
    used: 1890,
    alertThreshold: 90,
    hardLimit: true,
  },
  {
    id: "9",
    name: "Reed",
    scope: "agent",
    scopeTarget: "Reed",
    unit: "storage-mb",
    period: "monthly",
    limit: 10240,
    used: 4820,
    alertThreshold: 80,
    hardLimit: false,
  },
  {
    id: "10",
    name: "Wes",
    scope: "agent",
    scopeTarget: "Wes",
    unit: "tokens",
    period: "daily",
    limit: 150000,
    used: 3200,
    alertThreshold: 80,
    hardLimit: false,
  },
];

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + "M";
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "K";
  }
  return num.toString();
}

function formatUnit(unit: QuotaUnit): string {
  switch (unit) {
    case "cost-cents":
      return "credits";
    case "storage-mb":
      return "MB";
    default:
      return unit;
  }
}

function getUsageColor(percentage: number, threshold: number, hardLimit: boolean): string {
  if (percentage >= 100) {
    return "bg-rose-400";
  }
  if (percentage >= threshold || (hardLimit && percentage >= threshold - 5)) {
    return "bg-amber-400";
  }
  return "bg-emerald-400";
}

function getScopeBadgeColor(scope: QuotaScope): string {
  switch (scope) {
    case "agent":
      return "bg-indigo-500/20 text-indigo-400 border-indigo-500/30";
    case "model":
      return "bg-violet-500/20 text-violet-400 border-violet-500/30";
    case "global":
      return "bg-slate-500/20 text-slate-400 border-slate-500/30";
  }
}

function getPeriodBadgeColor(period: QuotaPeriod): string {
  switch (period) {
    case "hourly":
      return "bg-orange-500/20 text-orange-400 border-orange-500/30";
    case "daily":
      return "bg-cyan-500/20 text-cyan-400 border-cyan-500/30";
    case "monthly":
      return "bg-teal-500/20 text-teal-400 border-teal-500/30";
  }
}

export default function QuotaManager() {
  const [quotas, setQuotas] = useState<Quota[]>(initialQuotas);
  const [selectedQuotaId, setSelectedQuotaId] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<QuotaScope | "all">("all");
  const [periodFilter, setPeriodFilter] = useState<QuotaPeriod | "all">("all");
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ limit: number; alertThreshold: number }>({
    limit: 0,
    alertThreshold: 0,
  });

  const selectedQuota = quotas.find((q) => q.id === selectedQuotaId) || null;

  const filteredQuotas = quotas.filter((quota) => {
    const matchesScope = scopeFilter === "all" || quota.scope === scopeFilter;
    const matchesPeriod = periodFilter === "all" || quota.period === periodFilter;
    return matchesScope && matchesPeriod;
  });

  const handleSelectQuota = (quota: Quota) => {
    setSelectedQuotaId(quota.id);
    setIsEditing(false);
  };

  const handleEdit = () => {
    if (selectedQuota) {
      setEditForm({
        limit: selectedQuota.limit,
        alertThreshold: selectedQuota.alertThreshold,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (selectedQuota) {
      setQuotas((prev) =>
        prev.map((q) =>
          q.id === selectedQuota.id
            ? { ...q, limit: editForm.limit, alertThreshold: editForm.alertThreshold }
            : q
        )
      );
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)] mb-2">Quota Manager</h1>
          <p className="text-[var(--color-text-secondary)]">Manage resource quotas across agents and models</p>
        </div>

        {/* Filter Bar */}
        <div className="mb-6 space-y-4">
          {/* Scope Tabs */}
          <div className="flex gap-1 bg-[var(--color-surface-1)] p-1 rounded-lg w-fit">
            {(["all", "agent", "model", "global"] as const).map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={cn(
                  "px-4 py-2 rounded-md text-sm font-medium transition-all duration-150",
                  scopeFilter === scope
                    ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm"
                    : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)]/50"
                )}
              >
                {scope === "all" ? "All" : scope.charAt(0).toUpperCase() + scope.slice(1)}
              </button>
            ))}
          </div>

          {/* Period Chips */}
          <div className="flex flex-wrap gap-2">
            {(["all", "hourly", "daily", "monthly"] as const).map((period) => (
              <button
                key={period}
                onClick={() => setPeriodFilter(period)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150",
                  periodFilter === period
                    ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30"
                    : "bg-[var(--color-surface-1)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
                )}
              >
                {period === "all" ? "All Periods" : period.charAt(0).toUpperCase() + period.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Quota Cards */}
          <div className="lg:col-span-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredQuotas.map((quota) => {
                const percentage = (quota.used / quota.limit) * 100;
                const isSelected = selectedQuotaId === quota.id;
                const isOverLimit = percentage >= 100;
                const isNearThreshold = percentage >= quota.alertThreshold && !isOverLimit;

                return (
                  <button
                    key={quota.id}
                    onClick={() => handleSelectQuota(quota)}
                    className={cn(
                      "text-left p-4 rounded-lg border transition-all duration-150",
                      isSelected
                        ? "bg-[var(--color-surface-2)]/50 border-indigo-500/50 shadow-lg shadow-indigo-500/5"
                        : "bg-[var(--color-surface-1)] border-[var(--color-border)] hover:border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/30"
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[var(--color-text-primary)]">{quota.name}</span>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs border",
                            getScopeBadgeColor(quota.scope)
                          )}
                        >
                          {quota.scopeTarget}
                        </span>
                      </div>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs border",
                          getPeriodBadgeColor(quota.period)
                        )}
                      >
                        {quota.period}
                      </span>
                    </div>

                    {/* Usage Bar */}
                    <div className="relative mb-2">
                      <div
                        className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden"
                        role="progressbar"
                        aria-valuenow={quota.used}
                        aria-valuemin={0}
                        aria-valuemax={quota.limit}
                        aria-label={`${quota.name} ${quota.unit} usage: ${formatNumber(quota.used)} of ${formatNumber(quota.limit)}`}
                      >
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-300",
                            getUsageColor(percentage, quota.alertThreshold, quota.hardLimit)
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                      {/* Threshold Tick Mark */}
                      <div
                        className="absolute top-0 h-2 w-0.5 bg-white/50"
                        style={{ left: `${quota.alertThreshold}%` }}
                        title={`Alert at ${quota.alertThreshold}%`}
                      />
                    </div>

                    {/* Usage Text */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-[var(--color-text-secondary)]">
                        {formatNumber(quota.used)} / {formatNumber(quota.limit)} {formatUnit(quota.unit)}
                      </span>
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "px-1.5 py-0.5 rounded text-xs",
                            quota.hardLimit
                              ? "bg-rose-500/20 text-rose-400"
                              : "bg-[var(--color-surface-3)] text-[var(--color-text-secondary)]"
                          )}
                        >
                          {quota.hardLimit ? "Hard" : "Soft"}
                        </span>
                        <span className="text-[var(--color-text-muted)] text-xs">{Math.round(percentage)}%</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {filteredQuotas.length === 0 && (
              <div className="text-center py-12 text-[var(--color-text-muted)]">
                No quotas match the selected filters
              </div>
            )}
          </div>

          {/* Right Column - Detail Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-5">
              {selectedQuota ? (
                <>
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">{selectedQuota.name}</h2>
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-xs border",
                          getScopeBadgeColor(selectedQuota.scope)
                        )}
                      >
                        {selectedQuota.scope}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-text-secondary)] capitalize">
                      {selectedQuota.unit.replace("-", " ")} • {selectedQuota.period}
                    </p>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-5">
                    <div className="bg-[var(--color-surface-0)] rounded-lg p-3">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Used</p>
                      <p className="text-lg font-medium text-[var(--color-text-primary)]">
                        {formatNumber(selectedQuota.used)}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{formatUnit(selectedQuota.unit)}</p>
                    </div>
                    <div className="bg-[var(--color-surface-0)] rounded-lg p-3">
                      <p className="text-xs text-[var(--color-text-muted)] mb-1">Limit</p>
                      <p className="text-lg font-medium text-[var(--color-text-primary)]">
                        {formatNumber(selectedQuota.limit)}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">{formatUnit(selectedQuota.unit)}</p>
                    </div>
                  </div>

                  {/* Additional Info */}
                  <div className="space-y-3 mb-5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Alert Threshold</span>
                      <span className="text-sm text-[var(--color-text-primary)]">{selectedQuota.alertThreshold}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Limit Type</span>
                      <span
                        className={cn(
                          "text-sm",
                          selectedQuota.hardLimit ? "text-rose-400" : "text-[var(--color-text-secondary)]"
                        )}
                      >
                        {selectedQuota.hardLimit ? "Hard Limit" : "Soft Limit"}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-[var(--color-text-secondary)]">Usage</span>
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {Math.round((selectedQuota.used / selectedQuota.limit) * 100)}%
                      </span>
                    </div>
                  </div>

                  {/* Edit Form or View */}
                  {isEditing ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">Limit</label>
                        <input
                          type="number"
                          value={editForm.limit}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              limit: Math.max(0, parseInt(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-3 py-2 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-[var(--color-text-secondary)] mb-1.5">Alert Threshold (%)</label>
                        <input
                          type="number"
                          value={editForm.alertThreshold}
                          onChange={(e) =>
                            setEditForm((prev) => ({
                              ...prev,
                              alertThreshold: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
                            }))
                          }
                          className="w-full px-3 py-2 bg-[var(--color-surface-0)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] text-sm focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={handleSave}
                          className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-[var(--color-text-primary)] text-sm font-medium rounded-md transition-colors"
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancel}
                          className="flex-1 px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm font-medium rounded-md transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={handleEdit}
                      className="w-full px-4 py-2.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] text-sm font-medium rounded-md border border-[var(--color-border)] transition-colors"
                    >
                      Edit Quota
                    </button>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-[var(--color-text-muted)]">
                  <p className="mb-2">No quota selected</p>
                  <p className="text-sm">Select a quota from the list to view details</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

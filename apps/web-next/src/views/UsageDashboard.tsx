import { useState, useMemo } from 'react';
import { Calendar, TrendingUp, DollarSign, Activity, BarChart3, Clock } from 'lucide-react';
import { cn } from '../lib/utils';
import { MOCK_USAGE, MOCK_SESSIONS, MOCK_AGENTS, formatRelativeTime } from '../mock-data';
import { ContextualEmptyState } from '../components/ui/ContextualEmptyState';
import { Skeleton } from '../components/ui/Skeleton';

type DateRange = 'today' | '7days' | '30days' | 'custom';

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {return `${(tokens / 1000000).toFixed(1)}M`;}
  if (tokens >= 1000) {return `${Math.floor(tokens / 1000)}K`;}
  return tokens.toString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function UsageDashboardSkeleton() {
  return (
    <div className="bg-surface-0 min-h-screen p-3 sm:p-4 md:p-6 text-fg-primary">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <Skeleton variant="text" className="h-7 w-36" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rect" className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-surface-1 border border-tok-border rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Skeleton variant="rect" className="w-8 h-8 rounded-lg" />
              <Skeleton variant="text" className="h-3.5 w-24" />
            </div>
            <Skeleton variant="text" className="h-8 w-20" />
            <Skeleton variant="text" className="h-3 w-28" />
          </div>
        ))}
      </div>
      {/* Chart area */}
      <div className="bg-surface-1 border border-tok-border rounded-xl p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="text" className="h-5 w-32" />
          <div className="flex gap-2">
            <Skeleton variant="rect" className="h-6 w-14 rounded" />
            <Skeleton variant="rect" className="h-6 w-14 rounded" />
          </div>
        </div>
        <Skeleton variant="rect" className="h-40 w-full rounded-lg" />
      </div>
      {/* Bottom panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, panel) => (
          <div key={panel} className="bg-surface-1 border border-tok-border rounded-xl p-4">
            <Skeleton variant="text" className="h-4 w-28 mb-3" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton variant="circle" className="w-8 h-8" />
                    <Skeleton variant="text" className="h-4 w-24" />
                  </div>
                  <Skeleton variant="text" className="h-4 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function UsageDashboard({ isLoading = false }: { isLoading?: boolean }) {
  const [dateRange, setDateRange] = useState<DateRange>('30days');
  const [hoveredBar, setHoveredBar] = useState<number | null>(null);

  const usage = MOCK_USAGE;

  // Calculate averages
  const avgCostPerRequest = usage.totalRequests > 0
    ? (usage.totalCost / usage.totalRequests).toFixed(3)
    : '0.000';

  // Get max tokens for chart scaling
  const maxTokens = Math.max(...usage.dailyUsage.map(d => d.tokens));

  // Top 5 sessions by cost
  const topSessions = useMemo(() => {
    return [...MOCK_SESSIONS]
      .filter(s => s.cost !== undefined)
      .toSorted((a, b) => (b.cost || 0) - (a.cost || 0))
      .slice(0, 5);
  }, []);

  if (isLoading) return <UsageDashboardSkeleton />;

  return (
    <>
      {/* Skip link */}
      <a
        href="#usage-dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      <main id="usage-dashboard-main" className="bg-surface-0 min-h-screen p-3 sm:p-4 md:p-6 text-fg-primary">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <h1 className="text-2xl font-bold">Usage &amp; Costs</h1>

          {/* Date Range Selector */}
          <div className="flex bg-surface-1 rounded-lg p-1" role="group" aria-label="Date range">
            {(['today', '7days', '30days', 'custom'] as DateRange[]).map(range => (
              <button
                key={range}
                onClick={() => setDateRange(range)}
                aria-pressed={dateRange === range}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none',
                  dateRange === range
                    ? 'bg-surface-2 text-fg-primary'
                    : 'text-fg-secondary hover:text-fg-primary'
                )}
              >
                {range === 'custom' && <Calendar className="w-3.5 h-3.5" aria-hidden="true" />}
                <span className="capitalize">{range === '7days' ? '7 Days' : range === '30days' ? '30 Days' : range}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Summary Cards */}
        <section aria-label="Usage summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <SummaryCard
            icon={<Activity className="w-5 h-5" aria-hidden="true" />}
            label="Total Tokens"
            value={formatTokens(usage.totalTokens)}
            color="violet"
          />
          <SummaryCard
            icon={<DollarSign className="w-5 h-5" aria-hidden="true" />}
            label="Total Cost"
            value={`$${usage.totalCost.toFixed(2)}`}
            color="green"
          />
          <SummaryCard
            icon={<BarChart3 className="w-5 h-5" aria-hidden="true" />}
            label="Total Requests"
            value={usage.totalRequests.toLocaleString()}
            color="blue"
          />
          <SummaryCard
            icon={<TrendingUp className="w-5 h-5" aria-hidden="true" />}
            label="Avg Cost/Request"
            value={`$${avgCostPerRequest}`}
            color="yellow"
          />
        </section>

        {/* Daily Usage Chart */}
        <section aria-label="Daily usage chart" className="bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Daily Usage</h2>

          {usage.dailyUsage.length === 0 ? (
            <ContextualEmptyState
              icon={BarChart3}
              title="No usage data yet"
              description="Usage metrics will appear here once agents start processing requests."
            />
          ) : (
          <div className="relative">
            {/* Y-axis labels */}
            <div className="absolute left-0 top-0 bottom-8 w-12 flex flex-col justify-between text-xs text-fg-muted" aria-hidden="true">
              <span>{formatTokens(maxTokens)}</span>
              <span>{formatTokens(maxTokens / 2)}</span>
              <span>0</span>
            </div>

            {/* Chart area */}
            <div className="ml-14 flex items-end gap-1 h-40" role="img" aria-label={`Daily token usage chart. Highest day: ${formatTokens(maxTokens)} tokens.`}>
              {usage.dailyUsage.map((day, index) => {
                const heightPercent = (day.tokens / maxTokens) * 100;
                const isHovered = hoveredBar === index;

                return (
                  <div
                    key={day.date}
                    className="flex-1 flex flex-col items-center relative group"
                    onMouseEnter={() => setHoveredBar(index)}
                    onMouseLeave={() => setHoveredBar(null)}
                  >
                    {/* Tooltip */}
                    {isHovered && (
                      <div className="absolute -top-16 left-1/2 -translate-x-1/2 bg-surface-2 border border-tok-border rounded-lg px-2 py-1 z-10 whitespace-nowrap text-xs" role="tooltip">
                        <div className="font-medium">{formatDate(day.date)}</div>
                        <div className="text-fg-secondary">{formatTokens(day.tokens)} tokens</div>
                        <div className="text-green-400">${day.cost.toFixed(2)}</div>
                      </div>
                    )}

                    {/* Bar */}
                    <div
                      className={cn(
                        'w-full rounded-t-sm transition-all',
                        isHovered ? 'bg-violet-400' : 'bg-violet-600'
                      )}
                      style={{ height: `${heightPercent}%` }}
                      aria-label={`${formatDate(day.date)}: ${formatTokens(day.tokens)} tokens, $${day.cost.toFixed(2)}`}
                    />
                  </div>
                );
              })}
            </div>

            {/* X-axis labels (every 5 days) */}
            <div className="ml-14 flex gap-1 mt-2" aria-hidden="true">
              {usage.dailyUsage.map((day, index) => (
                <div key={day.date} className="flex-1 text-center">
                  {index % 5 === 0 && (
                    <span className="text-xs text-fg-muted">{formatDate(day.date)}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
          )}
        </section>

        {/* Breakdown Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* By Model */}
          <section aria-label="Usage by model" className="bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">By Model</h2>
            <div className="space-y-4">
              {Object.entries(usage.byModel).map(([model, data]) => {
                const maxModelTokens = Math.max(...Object.values(usage.byModel).map(d => d.tokens));
                const barWidth = (data.tokens / maxModelTokens) * 100;

                return (
                  <div key={model}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-fg-secondary font-mono text-xs">{model}</span>
                      <span className="text-fg-secondary">
                        {formatTokens(data.tokens)} · ${data.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-3 bg-surface-2 rounded-full overflow-hidden" role="img" aria-label={`${model}: ${Math.round(barWidth)}% of peak usage`}>
                      <div
                        className="h-full bg-gradient-to-r from-violet-600 to-violet-400 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* By Agent */}
          <section aria-label="Usage by agent" className="bg-surface-1 border border-tok-border rounded-xl p-3 sm:p-4 md:p-6">
            <h2 className="text-lg font-semibold mb-4">By Agent</h2>
            <div className="space-y-4">
              {Object.entries(usage.byAgent).map(([agent, data]) => {
                const maxAgentTokens = Math.max(...Object.values(usage.byAgent).map(d => d.tokens));
                const barWidth = (data.tokens / maxAgentTokens) * 100;
                const agentInfo = MOCK_AGENTS.find(a => a.name === agent);

                return (
                  <div key={agent}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-fg-secondary flex items-center gap-2">
                        <span aria-hidden="true">{agentInfo?.emoji}</span> {agent}
                      </span>
                      <span className="text-fg-secondary">
                        {formatTokens(data.tokens)} · ${data.cost.toFixed(2)}
                      </span>
                    </div>
                    <div className="h-3 bg-surface-2 rounded-full overflow-hidden" role="img" aria-label={`${agent}: ${Math.round(barWidth)}% of peak usage`}>
                      <div
                        className="h-full bg-gradient-to-r from-blue-600 to-blue-400 rounded-full transition-all"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        {/* Top Sessions Table */}
        <section aria-label="Top sessions by cost" className="bg-surface-1 border border-tok-border rounded-xl overflow-hidden">
          <div className="p-4 border-b border-tok-border">
            <h2 className="text-lg font-semibold">Top Sessions by Cost</h2>
          </div>

          <table className="w-full">
            <caption className="sr-only">Top 5 sessions by cost, showing session key, agent, token usage, cost, and duration.</caption>
            <thead>
              <tr className="border-b border-tok-border text-left text-sm text-fg-secondary">
                <th scope="col" className="px-4 py-3 font-medium">Session</th>
                <th scope="col" className="px-4 py-3 font-medium">Agent</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Tokens</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Cost</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Duration</th>
              </tr>
            </thead>
            <tbody>
              {topSessions.map(session => {
                const duration = session.lastActivity && session.createdAt
                  ? Date.parse(session.lastActivity) - Date.parse(session.createdAt)
                  : 0;

                return (
                  <tr key={session.key} className="border-b border-tok-border/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-violet-400">
                        {session.key.length > 24 ? `${session.key.slice(0, 18)}...` : session.key}
                      </span>
                      {session.label && (
                        <div className="text-xs text-fg-muted mt-0.5">{session.label}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 text-sm">
                        <span aria-hidden="true">{session.agentEmoji}</span>
                        <span>{session.agentName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      {session.tokenUsage ? formatTokens(session.tokenUsage.total) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-green-400">
                      ${session.cost?.toFixed(2) || '0.00'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-fg-secondary">
                      <span className="flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" aria-hidden="true" />
                        {formatDuration(duration)}
                      </span>
                    </td>
                  </tr>
                );
              })}

              {/* Total Row */}
              <tr className="bg-surface-2/30 font-medium">
                <td className="px-4 py-3 text-fg-secondary">Total (Top 5)</td>
                <td className="px-4 py-3">—</td>
                <td className="px-4 py-3 text-right">
                  {formatTokens(topSessions.reduce((sum, s) => sum + (s.tokenUsage?.total || 0), 0))}
                </td>
                <td className="px-4 py-3 text-right text-green-400">
                  ${topSessions.reduce((sum, s) => sum + (s.cost || 0), 0).toFixed(2)}
                </td>
                <td className="px-4 py-3 text-right text-fg-secondary">—</td>
              </tr>
            </tbody>
          </table>
        </section>
      </main>
    </>
  );
}

interface SummaryCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'violet' | 'green' | 'blue' | 'yellow';
}

function SummaryCard({ icon, label, value, color }: SummaryCardProps) {
  const colorClasses = {
    violet: 'bg-violet-600/10 text-violet-400 border-violet-600/30',
    green: 'bg-green-600/10 text-green-400 border-green-600/30',
    blue: 'bg-blue-600/10 text-blue-400 border-blue-600/30',
    yellow: 'bg-yellow-600/10 text-yellow-400 border-yellow-600/30',
  };

  return (
    <div className="bg-surface-1 border border-tok-border rounded-xl p-4">
      <div className="flex items-center gap-3 mb-2">
        <div className={cn('p-2 rounded-lg border', colorClasses[color])}>
          {icon}
        </div>
        <span className="text-sm text-fg-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms <= 0) {return '—';}
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (hours > 0) {return `${hours}h ${minutes}m`;}
  return `${minutes}m`;
}

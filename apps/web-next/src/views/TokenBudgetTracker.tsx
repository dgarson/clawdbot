import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  DollarSign,
  Gauge,
  Info,
  LineChart,
  PieChart,
  Settings,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type TimeRange = 'today' | 'week' | 'month' | 'lastMonth';

interface BudgetData {
  totalBudget: number;
  currentSpend: number;
  period: string;
}

interface AgentSpend {
  name: string;
  emoji: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  percentage: number;
  tasks: number;
  costPerTask: number;
}

interface ModelSpend {
  name: string;
  tokensIn: number;
  tokensOut: number;
  cost: number;
  percentage: number;
}

interface DailySpend {
  date: string;
  spend: number;
}

interface RateLimit {
  provider: string;
  rpm: number;
  quotaUsed: number;
  quotaTotal: number;
  resetTime: string;
}

interface BudgetAlert {
  id: string;
  timestamp: Date;
  threshold: number;
  message: string;
}

type AlertSeverity = 'info' | 'warning' | 'critical';

// ============================================================================
// Mock Data Generation
// ============================================================================

const AGENTS = [
  { name: 'Luis', emoji: '🎨' },
  { name: 'Quinn', emoji: '⚡' },
  { name: 'Xavier', emoji: '🏗️' },
  { name: 'Stephan', emoji: '📣' },
  { name: 'Reed', emoji: '♿' },
  { name: 'Piper', emoji: '🔊' },
  { name: 'Nora', emoji: '📝' },
  { name: 'Max', emoji: '🚀' },
];

const MODELS = ['claude-sonnet', 'grok-4', 'minimax', 'glm-5', 'gpt-4o'];

function generateMockData(range: TimeRange): {
  budget: BudgetData;
  agents: AgentSpend[];
  models: ModelSpend[];
  daily: DailySpend[];
  rateLimits: RateLimit[];
  alerts: BudgetAlert[];
} {
  const totalBudget = 500;
  let currentSpend = 0;
  let period = '';

  switch (range) {
    case 'today':
      currentSpend = 15.20;
      period = 'Today';
      break;
    case 'week':
      currentSpend = 85.40;
      period = 'This Week';
      break;
    case 'month':
      currentSpend = 320.75;
      period = 'Feb 2026';
      break;
    case 'lastMonth':
      currentSpend = 280.30;
      period = 'Jan 2026';
      break;
  }

  // Generate agent spend
  const agents: AgentSpend[] = AGENTS.map((agent) => {
    const cost = Math.random() * (currentSpend / 3) + (currentSpend / 10);
    const tokensIn = Math.floor(Math.random() * 100000) + 50000;
    const tokensOut = Math.floor(tokensIn * 0.3);
    const tasks = Math.floor(Math.random() * 50) + 10;
    return {
      ...agent,
      tokensIn,
      tokensOut,
      cost: Math.round(cost * 100) / 100,
      percentage: (cost / currentSpend) * 100,
      tasks,
      costPerTask: Math.round((cost / tasks) * 100) / 100,
    };
  });

  // Generate model spend
  const models: ModelSpend[] = MODELS.map((model) => {
    const cost = Math.random() * (currentSpend / 2) + (currentSpend / 8);
    const tokensIn = Math.floor(Math.random() * 200000) + 100000;
    const tokensOut = Math.floor(tokensIn * 0.25);
    return {
      name: model,
      tokensIn,
      tokensOut,
      cost: Math.round(cost * 100) / 100,
      percentage: (cost / currentSpend) * 100,
    };
  });

  // Generate daily spend for last 14 days
  const daily: DailySpend[] = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - 13 + i);
    return {
      date: date.toISOString().split('T')[0],
      spend: Math.random() * 20 + 5,
    };
  });

  // Rate limits
  const rateLimits: RateLimit[] = [
    { provider: 'Anthropic', rpm: 120, quotaUsed: 450000, quotaTotal: 1000000, resetTime: 'in 4h' },
    { provider: 'xAI', rpm: 80, quotaUsed: 210000, quotaTotal: 500000, resetTime: 'in 12h' },
    { provider: 'MiniMax', rpm: 60, quotaUsed: 150000, quotaTotal: 300000, resetTime: 'in 2h' },
    { provider: 'GLM', rpm: 100, quotaUsed: 320000, quotaTotal: 800000, resetTime: 'in 8h' },
    { provider: 'OpenAI', rpm: 150, quotaUsed: 680000, quotaTotal: 2000000, resetTime: 'in 6h' },
  ];

  // Alerts
  const alerts: BudgetAlert[] = [
    { id: '1', timestamp: new Date(), threshold: 90, message: 'Approaching 90% of monthly budget' },
    { id: '2', timestamp: new Date(Date.now() - 3600000), threshold: 75, message: '75% budget used - high spend on grok-4' },
    { id: '3', timestamp: new Date(Date.now() - 7200000), threshold: 50, message: '50% budget reached midway through period' },
  ];

  return { budget: { totalBudget, currentSpend, period }, agents, models, daily, rateLimits, alerts };
}

// ============================================================================
// Helpers
// ============================================================================

function formatCurrency(value: number): string {
  return `$${value.toFixed(2)}`;
}

function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatTokens(value: number): string {
  if (value >= 1000000) {return `${(value / 1000000).toFixed(1)}M`;}
  if (value >= 1000) {return `${(value / 1000).toFixed(1)}k`;}
  return value.toString();
}

function tokenColorClass(total: number): string {
  if (total === 0) return 'text-red-400';
  if (total >= 160000) return 'text-red-400';
  if (total >= 100000) return 'text-orange-400';
  if (total >= 50000) return 'text-amber-400';
  if (total >= 10000) return 'text-blue-400';
  return 'text-green-400';
}

function costColorClass(cost: number): string {
  if (cost > 5) return 'text-red-400';
  if (cost > 2) return 'text-orange-400';
  if (cost > 1) return 'text-amber-400';
  if (cost > 0.5) return 'text-blue-400';
  if (cost > 0.2) return 'text-[var(--color-text-primary)]';
  return 'text-green-400';
}

function getGaugeColor(percentage: number): string {
  if (percentage < 50) {return 'bg-green-500';}
  if (percentage < 75) {return 'bg-amber-500';}
  return 'bg-red-500';
}

// ============================================================================
// Sub-components
// ============================================================================

function TimeRangeSelector({ current, onChange }: { current: TimeRange; onChange: (range: TimeRange) => void }) {
  const ranges: { key: TimeRange; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
    { key: 'lastMonth', label: 'Last Month' },
  ];

  return (
    <div className="relative">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value as TimeRange)}
        className="appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] pr-8"
      >
        {ranges.map((r) => (
          <option key={r.key} value={r.key}>
            {r.label}
          </option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
    </div>
  );
}

function BudgetGauge({ spend, budget }: { spend: number; budget: number }) {
  const percentage = (spend / budget) * 100;
  const color = getGaugeColor(percentage);

  return (
    <div className="relative w-40 h-40 mx-auto">
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-3xl font-bold text-[var(--color-text-primary)]">{formatPercentage(percentage)}</div>
          <div className="text-sm text-[var(--color-text-secondary)]">used</div>
        </div>
      </div>
      <svg className="w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="10" className="stroke-zinc-800" />
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          strokeWidth="10"
          className={cn('stroke-current transition-colors', color)}
          strokeDasharray={`${(percentage / 100) * 282.74} 282.74`}
          transform="rotate(-90 50 50)"
        />
      </svg>
    </div>
  );
}

function SpendBar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = (value / max) * 100;
  return (
    <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
      <div className={cn('h-full transition-all', color)} style={{ width: `${width}%` }} />
    </div>
  );
}

function DailyTrendChart({ data }: { data: DailySpend[] }) {
  const maxSpend = Math.max(...data.map((d) => d.spend));
  const today = new Date().toISOString().split('T')[0];

  return (
    <div className="flex items-end gap-1 h-24">
      {data.map((day, i) => (
        <div
          key={i}
          className={cn(
            'w-4 rounded-t-sm transition-all',
            day.date === today ? 'bg-violet-500' : 'bg-[var(--color-surface-3)]',
          )}
          style={{ height: `${(day.spend / maxSpend) * 100}%` }}
          title={`${day.date}: ${formatCurrency(day.spend)}`}
        />
      ))}
    </div>
  );
}

function RateLimitPanel({ limit }: { limit: RateLimit }) {
  const percentage = (limit.quotaUsed / limit.quotaTotal) * 100;
  const color = percentage < 50 ? 'bg-green-500' : percentage < 75 ? 'bg-amber-500' : 'bg-red-500';

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{limit.provider}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">RPM: {limit.rpm}</span>
      </div>
      <div className="h-1 bg-[var(--color-surface-2)] rounded-full mb-1 overflow-hidden">
        <div className={cn('h-full', color)} style={{ width: `${percentage}%` }} />
      </div>
      <div className="flex justify-between text-xs text-[var(--color-text-muted)]">
        <span className="select-none"><span className={tokenColorClass(limit.quotaUsed)}>{formatTokens(limit.quotaUsed)}</span> / {formatTokens(limit.quotaTotal)}</span>
        <span>Reset {limit.resetTime}</span>
      </div>
    </div>
  );
}

function AlertEntry({ alert }: { alert: BudgetAlert }) {
  const severity: AlertSeverity = alert.threshold >= 90 ? 'critical' : alert.threshold >= 75 ? 'warning' : 'info';
  const Icon = severity === 'critical' ? XCircle : severity === 'warning' ? AlertTriangle : Info;
  const color = severity === 'critical' ? 'text-red-400' : severity === 'warning' ? 'text-amber-400' : 'text-sky-400';

  return (
    <div className="flex items-center gap-2 py-2 border-b border-[var(--color-border)] last:border-0">
      <Icon className={cn('w-4 h-4', color)} />
      <div className="flex-1">
        <p className="text-xs text-[var(--color-text-primary)]">{alert.message}</p>
        <p className="text-xs text-[var(--color-text-muted)]">{alert.timestamp.toLocaleTimeString()}</p>
      </div>
      <span className="text-xs text-[var(--color-text-secondary)]">{alert.threshold}%</span>
    </div>
  );
}

// ============================================================================
// Main Sections
// ============================================================================

function HeaderSection({
  budget,
  onSetBudget,
  range,
  onRangeChange,
}: {
  budget: BudgetData;
  onSetBudget: () => void;
  range: TimeRange;
  onRangeChange: (r: TimeRange) => void;
}) {
  const percentage = (budget.currentSpend / budget.totalBudget) * 100;

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-6 flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
          <DollarSign className="w-6 h-6 text-green-400" />
          Token Budget
        </h1>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{budget.period}</p>
      </div>
      <div className="text-center">
        <BudgetGauge spend={budget.currentSpend} budget={budget.totalBudget} />
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          <span className={cn('select-none', costColorClass(budget.currentSpend))}>{formatCurrency(budget.currentSpend)}</span> / {formatCurrency(budget.totalBudget)}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">{formatPercentage(percentage)} used</p>
      </div>
      <div className="flex items-center gap-4">
        <TimeRangeSelector current={range} onChange={onRangeChange} />
        <button
          onClick={onSetBudget}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-medium text-[var(--color-text-primary)] transition-colors"
        >
          <Settings className="w-4 h-4" />
          Set Budget
        </button>
      </div>
    </div>
  );
}

function BreakdownSection({
  title,
  icon: Icon,
  items,
  isAgent = false,
}: {
  title: string;
  icon: React.ElementType;
  items: AgentSpend[] | ModelSpend[];
  isAgent?: boolean;
}) {
  const maxCost = Math.max(...items.map((i) => i.cost));

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <Icon className="w-4 h-4 text-violet-400" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <div className="flex-1 overflow-y-auto space-y-4">
        {items.map((item) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                {'emoji' in item && <span>{item.emoji}</span>}
                <span className="font-medium text-[var(--color-text-primary)]">{item.name}</span>
              </span>
              <span className="select-none"><span className={costColorClass(item.cost)}>{formatCurrency(item.cost)}</span> <span className="text-[var(--color-text-secondary)]">({formatPercentage(item.percentage)})</span></span>
            </div>
            <SpendBar value={item.cost} max={maxCost} color="bg-violet-500" />
            <div className="text-xs text-[var(--color-text-muted)] flex justify-between">
              <span className={cn('select-none', tokenColorClass(item.tokensIn))}>In: {formatTokens(item.tokensIn)}</span>
              <span className={cn('select-none', tokenColorClass(item.tokensOut))}>Out: {formatTokens(item.tokensOut)}</span>
              {isAgent && <span>Tasks: { (item as AgentSpend).tasks }</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DailyTrendSection({ daily }: { daily: DailySpend[] }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <LineChart className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Daily Spend Trend (Last 14 Days)</h3>
      </div>
      <DailyTrendChart data={daily} />
      <div className="flex justify-between mt-2 text-xs text-[var(--color-text-muted)]">
        <span>{daily[0].date}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function RateLimitsSection({ limits }: { limits: RateLimit[] }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Gauge className="w-4 h-4 text-sky-400" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Rate Limit Tracker</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {limits.map((limit) => (
          <RateLimitPanel key={limit.provider} limit={limit} />
        ))}
      </div>
    </div>
  );
}

function AlertsSection({ alerts }: { alerts: BudgetAlert[] }) {
  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Bell className="w-4 h-4 text-amber-400" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Budget Alerts</h3>
      </div>
      <div className="mb-4">
        <p className="text-xs text-[var(--color-text-secondary)] mb-2">Configured Thresholds</p>
        <div className="flex gap-2">
          {[50, 75, 90, 100].map((t) => (
            <span key={t} className="px-2 py-1 bg-[var(--color-surface-2)] rounded text-xs text-[var(--color-text-primary)]">
              {t}%
            </span>
          ))}
        </div>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {alerts.map((alert) => (
          <AlertEntry key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}

function EfficiencyTable({ agents }: { agents: AgentSpend[] }) {
  const sorted = [...agents].toSorted((a, b) => b.costPerTask - a.costPerTask);

  return (
    <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="w-4 h-4 text-green-400" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Cost Efficiency by Agent</h3>
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[var(--color-text-muted)] border-b border-[var(--color-border)]">
            <th className="pb-2">Agent</th>
            <th className="pb-2">Cost/Task</th>
            <th className="pb-2">Tasks</th>
            <th className="pb-2">Total Cost</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((agent) => (
            <tr key={agent.name} className="border-b border-[var(--color-border)] last:border-0">
              <td className="py-2 flex items-center gap-2">
                <span>{agent.emoji}</span>
                <span>{agent.name}</span>
              </td>
              <td className={cn("py-2 select-none", costColorClass(agent.costPerTask))}>{formatCurrency(agent.costPerTask)}</td>
              <td className="py-2">{agent.tasks}</td>
              <td className={cn("py-2 select-none", costColorClass(agent.cost))}>{formatCurrency(agent.cost)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function TokenBudgetTracker() {
  const [range, setRange] = useState<TimeRange>('month');
  const { budget, agents, models, daily, rateLimits, alerts } = generateMockData(range);

  const handleSetBudget = () => {
    console.log('[TokenBudgetTracker] Set Budget clicked');
    // In real app, open modal
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6 space-y-6">
      <HeaderSection
        budget={budget}
        onSetBudget={handleSetBudget}
        range={range}
        onRangeChange={setRange}
      />

      <div className="grid grid-cols-4 gap-6">
        <div className="col-span-2">
          <BreakdownSection title="Spend by Agent" icon={Users} items={agents} isAgent />
        </div>
        <div className="col-span-2">
          <BreakdownSection title="Spend by Model" icon={PieChart} items={models} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <DailyTrendSection daily={daily} />
        <RateLimitsSection limits={rateLimits} />
        <AlertsSection alerts={alerts} />
      </div>

      <EfficiencyTable agents={agents} />
    </div>
  );
}

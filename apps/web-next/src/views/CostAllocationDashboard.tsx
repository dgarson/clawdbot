import React, { useState } from 'react';
import { DollarSign, TrendingUp, TrendingDown, PieChart, Users, Bot, Clock, Download, Filter } from 'lucide-react';
import { cn } from '../lib/utils';

interface CostEntry {
  label: string;
  amount: number;
  pct: number;
  trend: number;
  color: string;
}

interface TeamCost {
  name: string;
  agent: string;
  monthlyBudget: number;
  currentSpend: number;
  tokens: number;
  sessions: number;
}

const COST_BY_MODEL: CostEntry[] = [
  { label: 'Claude Sonnet 4.6', amount: 284.50, pct: 38, trend: 12, color: 'bg-primary' },
  { label: 'Claude Opus 4.6', amount: 198.20, pct: 26, trend: 5, color: 'bg-purple-500' },
  { label: 'GPT-5.3 Codex', amount: 142.80, pct: 19, trend: -3, color: 'bg-blue-500' },
  { label: 'MiniMax M2.5', amount: 68.40, pct: 9, trend: 22, color: 'bg-emerald-500' },
  { label: 'GLM-5', amount: 45.10, pct: 6, trend: 8, color: 'bg-amber-500' },
  { label: 'Other', amount: 15.00, pct: 2, trend: -1, color: 'bg-[var(--color-surface-3)]' },
];

const COST_BY_TEAM: TeamCost[] = [
  { name: 'Platform Core', agent: 'Tim', monthlyBudget: 300, currentSpend: 214.80, tokens: 12_400_000, sessions: 1840 },
  { name: 'Product & UI', agent: 'Luis', monthlyBudget: 250, currentSpend: 178.20, tokens: 9_200_000, sessions: 1620 },
  { name: 'Agent Quality', agent: 'Claire', monthlyBudget: 200, currentSpend: 112.60, tokens: 6_800_000, sessions: 980 },
  { name: 'C-Suite', agent: 'Xavier', monthlyBudget: 400, currentSpend: 248.40, tokens: 14_100_000, sessions: 2240 },
];

const DAILY_SPEND = [42, 38, 51, 45, 67, 83, 71, 58, 62, 74, 81, 76, 69, 84];

function SpendBar({ current, budget }: { current: number; budget: number }) {
  const pct = Math.min((current / budget) * 100, 100);
  const color = pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] font-mono w-8 text-right">{Math.round(pct)}%</span>
    </div>
  );
}

function MiniBarChart({ data }: { data: number[] }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.5 h-10">
      {data.map((v, i) => {
        const h = Math.round((v / max) * 100);
        const isLast = i === data.length - 1;
        return (
          <div
            key={i}
            className={cn('flex-1 rounded-t-sm', isLast ? 'bg-primary' : 'bg-[var(--color-surface-3)]')}
            style={{ height: `${h}%` }}
          />
        );
      })}
    </div>
  );
}

export default function CostAllocationDashboard() {
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');

  const totalSpend = COST_BY_TEAM.reduce((sum, t) => sum + t.currentSpend, 0);
  const totalBudget = COST_BY_TEAM.reduce((sum, t) => sum + t.monthlyBudget, 0);
  const totalTokens = COST_BY_TEAM.reduce((sum, t) => sum + t.tokens, 0);

  return (
    <div className="flex-1 overflow-y-auto bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Cost Allocation
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Token spend breakdown by team, model, and time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                    period === p ? 'bg-primary text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" className="flex items-center gap-1.5 text-xs px-3 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] rounded-lg border border-[var(--color-border)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
              <Download className="w-3 h-3" />
              Export
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Spend', value: `$${totalSpend.toFixed(2)}`, sub: `of $${totalBudget} budget`, icon: DollarSign, color: 'text-emerald-400' },
            { label: 'Budget Used', value: `${Math.round((totalSpend / totalBudget) * 100)}%`, sub: `$${(totalBudget - totalSpend).toFixed(2)} remaining`, icon: PieChart, color: 'text-blue-400' },
            { label: 'Total Tokens', value: `${(totalTokens / 1_000_000).toFixed(1)}M`, sub: 'across all agents', icon: Bot, color: 'text-primary' },
            { label: 'Avg/Session', value: `$${(totalSpend / 6680).toFixed(3)}`, sub: '6,680 sessions total', icon: Clock, color: 'text-amber-400' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-xs text-[var(--color-text-muted)]">{label}</span>
              </div>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* By model */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)] mb-4">Spend by Model</h2>
            <div className="space-y-3">
              {COST_BY_MODEL.map((entry) => (
                <div key={entry.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', entry.color)} />
                      <span className="text-xs text-[var(--color-text-primary)]">{entry.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] flex items-center gap-0.5', entry.trend >= 0 ? 'text-red-400' : 'text-emerald-400')}>
                        {entry.trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {Math.abs(entry.trend)}%
                      </span>
                      <span className="text-xs font-medium text-[var(--color-text-primary)]">${entry.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', entry.color)} style={{ width: `${entry.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily spend chart */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-[var(--color-text-primary)]">Daily Spend</h2>
              <span className="text-xs text-[var(--color-text-muted)]">Last 14 days</span>
            </div>
            <MiniBarChart data={DAILY_SPEND} />
            <div className="flex justify-between mt-2 text-[10px] text-[var(--color-text-muted)]">
              <span>14d ago</span>
              <span>Today</span>
            </div>
            <div className="mt-3 pt-3 border-t border-[var(--color-border)] flex items-center justify-between">
              <span className="text-xs text-[var(--color-text-muted)]">Today's spend</span>
              <span className="text-sm font-medium text-primary">${DAILY_SPEND[DAILY_SPEND.length - 1]}.40</span>
            </div>
          </div>
        </div>

        {/* By team */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
            <h2 className="text-sm font-medium text-[var(--color-text-primary)] flex items-center gap-2">
              <Users className="w-4 h-4 text-[var(--color-text-secondary)]" />
              Spend by Team
            </h2>
            <button type="button" className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors">
              <Filter className="w-3 h-3" />
              Filter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Squad', 'Lead', 'Budget', 'Spent', 'Usage', 'Tokens', 'Sessions'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]/50">
                {COST_BY_TEAM.map((team) => (
                  <tr key={team.name} className="hover:bg-[var(--color-surface-2)]/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">{team.name}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{team.agent}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">${team.monthlyBudget}</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-primary)] font-medium">${team.currentSpend.toFixed(2)}</td>
                    <td className="px-4 py-3 w-32"><SpendBar current={team.currentSpend} budget={team.monthlyBudget} /></td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)] font-mono">{(team.tokens / 1_000_000).toFixed(1)}M</td>
                    <td className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">{team.sessions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)]/30">
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-primary)]">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-primary)]">${totalBudget}</td>
                  <td className="px-4 py-3 text-xs font-medium text-[var(--color-text-primary)]">${totalSpend.toFixed(2)}</td>
                  <td className="px-4 py-3"><SpendBar current={totalSpend} budget={totalBudget} /></td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-primary)] font-mono">{(totalTokens / 1_000_000).toFixed(1)}M</td>
                  <td className="px-4 py-3 text-xs text-[var(--color-text-primary)]">6,680</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

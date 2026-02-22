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
  { label: 'Claude Sonnet 4.6', amount: 284.50, pct: 38, trend: 12, color: 'bg-violet-500' },
  { label: 'Claude Opus 4.6', amount: 198.20, pct: 26, trend: 5, color: 'bg-purple-500' },
  { label: 'GPT-5.3 Codex', amount: 142.80, pct: 19, trend: -3, color: 'bg-blue-500' },
  { label: 'MiniMax M2.5', amount: 68.40, pct: 9, trend: 22, color: 'bg-emerald-500' },
  { label: 'GLM-5', amount: 45.10, pct: 6, trend: 8, color: 'bg-amber-500' },
  { label: 'Other', amount: 15.00, pct: 2, trend: -1, color: 'bg-zinc-500' },
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
      <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={cn('h-full rounded-full', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-zinc-400 font-mono w-8 text-right">{Math.round(pct)}%</span>
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
            className={cn('flex-1 rounded-t-sm', isLast ? 'bg-violet-500' : 'bg-zinc-700')}
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
    <div className="flex-1 overflow-y-auto bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              Cost Allocation
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Token spend breakdown by team, model, and time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
              {(['7d', '30d', '90d'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={cn(
                    'px-3 py-1.5 text-xs font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
                    period === p ? 'bg-violet-600 text-white' : 'text-zinc-400 hover:text-zinc-200'
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            <button type="button" className="flex items-center gap-1.5 text-xs px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg border border-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
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
            { label: 'Total Tokens', value: `${(totalTokens / 1_000_000).toFixed(1)}M`, sub: 'across all agents', icon: Bot, color: 'text-violet-400' },
            { label: 'Avg/Session', value: `$${(totalSpend / 6680).toFixed(3)}`, sub: '6,680 sessions total', icon: Clock, color: 'text-amber-400' },
          ].map(({ label, value, sub, icon: Icon, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={cn('w-4 h-4', color)} />
                <span className="text-xs text-zinc-500">{label}</span>
              </div>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              <p className="text-[10px] text-zinc-600 mt-0.5">{sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* By model */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <h2 className="text-sm font-medium text-zinc-200 mb-4">Spend by Model</h2>
            <div className="space-y-3">
              {COST_BY_MODEL.map((entry) => (
                <div key={entry.label}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={cn('w-2 h-2 rounded-full', entry.color)} />
                      <span className="text-xs text-zinc-300">{entry.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('text-[10px] flex items-center gap-0.5', entry.trend >= 0 ? 'text-red-400' : 'text-emerald-400')}>
                        {entry.trend >= 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                        {Math.abs(entry.trend)}%
                      </span>
                      <span className="text-xs font-medium text-zinc-200">${entry.amount.toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className={cn('h-full rounded-full', entry.color)} style={{ width: `${entry.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daily spend chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium text-zinc-200">Daily Spend</h2>
              <span className="text-xs text-zinc-500">Last 14 days</span>
            </div>
            <MiniBarChart data={DAILY_SPEND} />
            <div className="flex justify-between mt-2 text-[10px] text-zinc-600">
              <span>14d ago</span>
              <span>Today</span>
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between">
              <span className="text-xs text-zinc-500">Today's spend</span>
              <span className="text-sm font-medium text-violet-400">${DAILY_SPEND[DAILY_SPEND.length - 1]}.40</span>
            </div>
          </div>
        </div>

        {/* By team */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-sm font-medium text-zinc-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-zinc-400" />
              Spend by Team
            </h2>
            <button type="button" className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
              <Filter className="w-3 h-3" />
              Filter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800">
                  {['Squad', 'Lead', 'Budget', 'Spent', 'Usage', 'Tokens', 'Sessions'].map((h) => (
                    <th key={h} className="text-left text-[10px] font-medium text-zinc-500 uppercase tracking-wider px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {COST_BY_TEAM.map((team) => (
                  <tr key={team.name} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-4 py-3 text-sm font-medium text-zinc-200">{team.name}</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{team.agent}</td>
                    <td className="px-4 py-3 text-xs text-zinc-300">${team.monthlyBudget}</td>
                    <td className="px-4 py-3 text-xs text-zinc-200 font-medium">${team.currentSpend.toFixed(2)}</td>
                    <td className="px-4 py-3 w-32"><SpendBar current={team.currentSpend} budget={team.monthlyBudget} /></td>
                    <td className="px-4 py-3 text-xs text-zinc-400 font-mono">{(team.tokens / 1_000_000).toFixed(1)}M</td>
                    <td className="px-4 py-3 text-xs text-zinc-400">{team.sessions.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-zinc-700 bg-zinc-800/30">
                  <td className="px-4 py-3 text-xs font-medium text-zinc-300">Total</td>
                  <td className="px-4 py-3" />
                  <td className="px-4 py-3 text-xs font-medium text-zinc-200">${totalBudget}</td>
                  <td className="px-4 py-3 text-xs font-medium text-zinc-100">${totalSpend.toFixed(2)}</td>
                  <td className="px-4 py-3"><SpendBar current={totalSpend} budget={totalBudget} /></td>
                  <td className="px-4 py-3 text-xs text-zinc-300 font-mono">{(totalTokens / 1_000_000).toFixed(1)}M</td>
                  <td className="px-4 py-3 text-xs text-zinc-300">6,680</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { cn } from '../lib/utils';

interface AgentCost {
  name: string;
  domain: string;
  model: string;
  estTokens: string;
  estCost: number;
  status: 'Complete' | 'Running' | 'Pending';
}

const MODELS = {
  CLAUDE: { name: 'Claude Sonnet 4.6', price: 1.40 },
  MINIMAX: { name: 'MiniMax M2.5', price: 0.45 },
  GROK: { name: 'Grok 4', price: 0.85 },
};

const AGENTS_DATA: AgentCost[] = [
  // Wave 1
  { name: 'Atlas', domain: 'Finance', model: MODELS.CLAUDE.name, estTokens: '185k', estCost: MODELS.CLAUDE.price, status: 'Complete' },
  { name: 'Beacon', domain: 'Logistics', model: MODELS.MINIMAX.name, estTokens: '192k', estCost: MODELS.MINIMAX.price, status: 'Complete' },
  { name: 'Carta', domain: 'Mapping', model: MODELS.GROK.name, estTokens: '170k', estCost: MODELS.GROK.price, status: 'Complete' },
  { name: 'Delphi', domain: 'Forecasting', model: MODELS.CLAUDE.name, estTokens: '198k', estCost: MODELS.CLAUDE.price, status: 'Complete' },
  { name: 'Echo', domain: 'Communications', model: MODELS.MINIMAX.name, estTokens: '150k', estCost: MODELS.MINIMAX.price, status: 'Complete' },
  
  // Wave 2
  { name: 'Fenix', domain: 'Recovery', model: MODELS.CLAUDE.name, estTokens: '160k', estCost: MODELS.CLAUDE.price, status: 'Running' },
  { name: 'Gust', domain: 'Weather', model: MODELS.GROK.name, estTokens: '145k', estCost: MODELS.GROK.price, status: 'Running' },
  { name: 'Helix', domain: 'Genetics', model: MODELS.MINIMAX.name, estTokens: '110k', estCost: MODELS.MINIMAX.price, status: 'Running' },
  { name: 'Iris', domain: 'Vision', model: MODELS.CLAUDE.name, estTokens: '95k', estCost: MODELS.CLAUDE.price, status: 'Running' },
  { name: 'Jade', domain: 'Inventory', model: MODELS.MINIMAX.name, estTokens: '40k', estCost: MODELS.MINIMAX.price, status: 'Running' },

  // Wave 3
  { name: 'Kilo', domain: 'Weight/Measures', model: MODELS.CLAUDE.name, estTokens: '0', estCost: MODELS.CLAUDE.price, status: 'Pending' },
  { name: 'Luna', domain: 'Lunar Ops', model: MODELS.GROK.name, estTokens: '0', estCost: MODELS.GROK.price, status: 'Pending' },
  { name: 'Mosaic', domain: 'Pattern Rec', model: MODELS.GROK.name, estTokens: '0', estCost: MODELS.GROK.price, status: 'Pending' },
  { name: 'Nova', domain: 'Stellar Arch', model: MODELS.CLAUDE.name, estTokens: '0', estCost: MODELS.CLAUDE.price, status: 'Pending' },
  { name: 'Orbit', domain: 'Satellite Nav', model: MODELS.MINIMAX.name, estTokens: '0', estCost: MODELS.MINIMAX.price, status: 'Pending' },
];

const WAVES = [
  { id: 1, name: 'Wave 1', agents: AGENTS_DATA.slice(0, 5) },
  { id: 2, name: 'Wave 2', agents: AGENTS_DATA.slice(5, 10) },
  { id: 3, name: 'Wave 3', agents: AGENTS_DATA.slice(10, 15) },
];

const SummaryCard = ({ title, value, subtitle }: { title: string; value: string; subtitle: string }) => (
  <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] p-4 rounded-lg shadow-sm">
    <div className="text-[var(--color-text-secondary)] text-xs font-medium uppercase tracking-wider mb-1">{title}</div>
    <div className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">{value}</div>
    <div className="text-[var(--color-text-muted)] text-xs">{subtitle}</div>
  </div>
);

const WaveSection = ({ wave }: { wave: typeof WAVES[0] }) => {
  const [isOpen, setIsOpen] = useState(wave.id === 1);

  return (
    <div className="mb-4 border border-[var(--color-border)] rounded-lg overflow-hidden bg-[var(--color-surface-0)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-[var(--color-surface-1)]/50 hover:bg-[var(--color-surface-1)] transition-colors"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold text-[var(--color-text-primary)]">{wave.name}</span>
          <span className="px-2 py-0.5 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs">
            {wave.agents.length} Agents
          </span>
        </div>
        <svg
          className={cn("w-5 h-5 text-[var(--color-text-secondary)] transition-transform", isOpen && "rotate-180")}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isOpen && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--color-surface-1)]/30 text-[var(--color-text-secondary)] border-b border-[var(--color-border)]">
              <tr>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Domain</th>
                <th className="px-4 py-3 font-medium">Model</th>
                <th className="px-4 py-3 font-medium text-right">Est. Tokens</th>
                <th className="px-4 py-3 font-medium text-right">Est. Cost</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]">
              {wave.agents.map((agent) => (
                <tr key={agent.name} className="hover:bg-[var(--color-surface-1)]/20">
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium">{agent.name}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{agent.domain}</td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">{agent.model}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)] text-right font-mono">{agent.estTokens}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)] text-right font-mono">${agent.estCost.toFixed(2)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={cn(
                      "inline-flex px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-tight",
                      agent.status === 'Complete' && "bg-green-500/10 text-green-500",
                      agent.status === 'Running' && "bg-blue-500/10 text-blue-500 animate-pulse",
                      agent.status === 'Pending' && "bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                    )}>
                      {agent.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default function DiscoveryAgentCostTracker() {
  const budget = 50.00;
  const totalCost = 14.20;
  const percentUsed = (totalCost / budget) * 100;

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <header>
          <h1 className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight">Discovery Run Cost Tracker</h1>
          <p className="text-[var(--color-text-muted)] mt-1">Feb 23, 2026 — Estimated</p>
        </header>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard 
            title="Total Estimated Cost" 
            value={`$${totalCost.toFixed(2)}`} 
            subtitle="Total across all waves" 
          />
          <SummaryCard 
            title="Claude Sonnet" 
            value="$8.40" 
            subtitle="6 agents ($1.40 ea)" 
          />
          <SummaryCard 
            title="MiniMax M2.5" 
            value="$2.25" 
            subtitle="5 agents ($0.45 ea)" 
          />
          <SummaryCard 
            title="Grok 4" 
            value="$3.40" 
            subtitle="4 agents ($0.85 ea)" 
          />
        </div>

        {/* Budget Gauge */}
        <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] p-6 rounded-lg">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="text-sm font-medium text-[var(--color-text-secondary)] uppercase tracking-wider">Budget Utilization</h2>
              <div className="text-xl font-bold text-[var(--color-text-primary)] mt-1">
                ${totalCost.toFixed(2)} <span className="text-[var(--color-text-muted)] font-normal text-sm">/ ${budget.toFixed(2)} budget</span>
              </div>
            </div>
            <div className="text-green-500 font-bold text-lg">{percentUsed.toFixed(1)}%</div>
          </div>
          <div className="h-3 w-full bg-[var(--color-surface-2)] rounded-full overflow-hidden">
            <div 
              className="h-full bg-green-500 rounded-full transition-all duration-1000"
              style={{ width: `${percentUsed}%` }}
              role="progressbar"
              aria-valuenow={totalCost}
              aria-valuemin={0}
              aria-valuemax={budget}
            />
          </div>
        </div>

        {/* Waves */}
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] mb-4">Wave Breakdown</h2>
          {WAVES.map(wave => (
            <WaveSection key={wave.id} wave={wave} />
          ))}
        </div>

        {/* Note Banner */}
        <div className="flex items-center gap-3 p-4 bg-[var(--color-surface-1)]/50 border border-[var(--color-border)] rounded-lg text-sm text-[var(--color-text-secondary)]">
          <svg className="w-5 h-5 text-[var(--color-text-muted)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>All costs are estimates based on 200K token budget per agent. Actual costs will vary. (estimated)</p>
        </div>
      </div>
    </div>
  );
}

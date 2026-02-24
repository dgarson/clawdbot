import React, { useState, useMemo } from 'react';
import { cn } from '../lib/utils';

// --- Types ---

type ModelID = 'claude-3-5-sonnet' | 'minimax-m2-5' | 'grok-4' | 'gemini-1-5-flash' | 'gpt-4o';

interface ModelData {
  id: ModelID;
  name: string;
  provider: string;
  latency: number; // avg ms
  costInput: number; // per 1M tokens
  costOutput: number; // per 1M tokens
  reliability: number; // % uptime
  contextWindow: number; // tokens
  toolAccuracy: number; // %
  rateLimit: string; // text description
  isDiscovery: boolean;
  recommendation?: string;
}

// --- Mock Data ---

const MODELS: ModelData[] = [
  {
    id: 'claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    latency: 850,
    costInput: 3.00,
    costOutput: 15.00,
    reliability: 99.9,
    contextWindow: 200000,
    toolAccuracy: 94,
    rateLimit: '400k TPM',
    isDiscovery: true,
    recommendation: 'Best for Logic',
  },
  {
    id: 'minimax-m2-5',
    name: 'MiniMax M2.5',
    provider: 'MiniMax',
    latency: 1200,
    costInput: 0.15,
    costOutput: 0.60,
    reliability: 98.5,
    contextWindow: 128000,
    toolAccuracy: 88,
    rateLimit: '200k TPM',
    isDiscovery: false,
    recommendation: 'Best Value',
  },
  {
    id: 'grok-4',
    name: 'Grok 4',
    provider: 'xAI',
    latency: 950,
    costInput: 5.00,
    costOutput: 15.00,
    reliability: 99.2,
    contextWindow: 131072,
    toolAccuracy: 91,
    rateLimit: '300k TPM',
    isDiscovery: true,
    recommendation: 'Most Real-time',
  },
  {
    id: 'gemini-1-5-flash',
    name: 'Gemini 1.5 Flash',
    provider: 'Google',
    latency: 450,
    costInput: 0.075,
    costOutput: 0.30,
    reliability: 99.95,
    contextWindow: 1000000,
    toolAccuracy: 86,
    rateLimit: '1M TPM',
    isDiscovery: true,
    recommendation: 'Fastest',
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    latency: 700,
    costInput: 5.00,
    costOutput: 15.00,
    reliability: 99.8,
    contextWindow: 128000,
    toolAccuracy: 95,
    rateLimit: '500k TPM',
    isDiscovery: false,
    recommendation: 'Most Reliable',
  },
];

type SortKey = keyof Omit<ModelData, 'id' | 'name' | 'provider' | 'rateLimit' | 'isDiscovery' | 'recommendation'>;

// --- Helper Components ---

const Sparkline = ({ value, max, colorClass }: { value: number; max: number; colorClass: string }) => {
  const percentage = Math.min(100, (value / max) * 100);
  return (
    <div className="w-full bg-[var(--color-surface-2)] h-1.5 rounded-full mt-1 overflow-hidden">
      <div 
        className={cn("h-full rounded-full transition-all duration-500", colorClass)}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};

const Badge = ({ children, variant = 'default' }: { children: React.ReactNode, variant?: 'default' | 'success' | 'warning' }) => {
  const variants = {
    default: 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)] border-[var(--color-border)]',
    success: 'bg-emerald-950/50 text-emerald-400 border-emerald-800/50',
    warning: 'bg-amber-950/50 text-amber-400 border-amber-800/50',
  };
  return (
    <span className={cn("px-2 py-0.5 rounded-md text-[10px] font-medium border uppercase tracking-wider", variants[variant])}>
      {children}
    </span>
  );
};

// --- Main Component ---

export default function ModelComparisonMatrix() {
  const [viewMode, setViewMode] = useState<'discovery' | 'all'>('all');
  const [sortKey, setSortKey] = useState<SortKey>('latency');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Cost Calculator State
  const [calcInput, setCalcInput] = useState<number>(1000000); // 1M default

  const filteredModels = useMemo(() => {
    let list = viewMode === 'discovery' ? MODELS.filter(m => m.isDiscovery) : [...MODELS];
    return list.slice().sort((a: ModelData, b: ModelData) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [viewMode, sortKey, sortOrder]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  // Min/Max for color coding
  const bounds = useMemo(() => {
    const keys: SortKey[] = ['latency', 'costInput', 'costOutput', 'reliability', 'contextWindow', 'toolAccuracy'];
    const res: Record<string, { min: number; max: number }> = {};
    keys.forEach(k => {
      const values = MODELS.map(m => m[k]);
      res[k] = { min: Math.min(...values), max: Math.max(...values) };
    });
    return res;
  }, []);

  const getCellColor = (key: SortKey, value: number) => {
    const { min, max } = bounds[key];
    if (min === max) {return 'text-[var(--color-text-primary)]';}
    
    // Lower is better for latency and cost
    const lowerIsBetter = key === 'latency' || key === 'costInput' || key === 'costOutput';
    
    if (value === (lowerIsBetter ? min : max)) {return 'text-emerald-400 font-medium';}
    if (value === (lowerIsBetter ? max : min)) {return 'text-rose-400';}
    return 'text-[var(--color-text-primary)]';
  };

  return (
    <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 font-sans selection:bg-emerald-500/30">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-[var(--color-text-primary)]">Model Comparison Matrix</h1>
            <p className="text-[var(--color-text-secondary)]">Benchmarking performance, reliability, and cost across top-tier providers.</p>
          </div>
          
          <div className="flex bg-[var(--color-surface-1)] p-1 rounded-xl border border-[var(--color-border)] w-fit">
            <button 
              onClick={() => setViewMode('discovery')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                viewMode === 'discovery' ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              Discovery Run
            </button>
            <button 
              onClick={() => setViewMode('all')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                viewMode === 'all' ? "bg-[var(--color-surface-2)] text-[var(--color-text-primary)] shadow-sm" : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              )}
            >
              All Models
            </button>
          </div>
        </div>

        {/* Table Section */}
        <div className="relative overflow-hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-1)]/50 backdrop-blur-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--color-surface-1)]/80 border-b border-[var(--color-border)]">
                  <th className="p-4 sticky left-0 bg-[var(--color-surface-1)] z-10 min-w-[200px] text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Model</th>
                  <SortableHeader label="Latency" active={sortKey === 'latency'} order={sortOrder} onClick={() => toggleSort('latency')} />
                  <SortableHeader label="Cost / 1M (In)" active={sortKey === 'costInput'} order={sortOrder} onClick={() => toggleSort('costInput')} />
                  <SortableHeader label="Cost / 1M (Out)" active={sortKey === 'costOutput'} order={sortOrder} onClick={() => toggleSort('costOutput')} />
                  <SortableHeader label="Reliability" active={sortKey === 'reliability'} order={sortOrder} onClick={() => toggleSort('reliability')} />
                  <SortableHeader label="Context" active={sortKey === 'contextWindow'} order={sortOrder} onClick={() => toggleSort('contextWindow')} />
                  <SortableHeader label="Tool Accuracy" active={sortKey === 'toolAccuracy'} order={sortOrder} onClick={() => toggleSort('toolAccuracy')} />
                  <th className="p-4 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Rate Limit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {filteredModels.map((model) => (
                  <tr key={model.id} className="hover:bg-[var(--color-surface-2)]/30 transition-colors group">
                    <td className="p-4 sticky left-0 bg-[var(--color-surface-1)]/90 group-hover:bg-[var(--color-surface-2)]/90 backdrop-blur-md z-10 border-r border-[var(--color-border)]/50">
                      <div className="flex flex-col gap-1.5">
                        <span className="font-semibold text-[var(--color-text-primary)]">{model.name}</span>
                        <div className="flex gap-2 items-center">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">{model.provider}</span>
                          {model.recommendation && <Badge variant={model.id.includes('flash') || model.id.includes('minimax') ? 'success' : 'default'}>{model.recommendation}</Badge>}
                        </div>
                      </div>
                    </td>
                    
                    <td className="p-4">
                      <div className={cn("text-sm", getCellColor('latency', model.latency))}>{model.latency}ms</div>
                      <Sparkline value={model.latency} max={bounds.latency.max} colorClass="bg-amber-500" />
                    </td>
                    
                    <td className="p-4">
                      <div className={cn("text-sm", getCellColor('costInput', model.costInput))}>${model.costInput.toFixed(3)}</div>
                      <Sparkline value={model.costInput} max={bounds.costInput.max} colorClass="bg-blue-500" />
                    </td>

                    <td className="p-4">
                      <div className={cn("text-sm", getCellColor('costOutput', model.costOutput))}>${model.costOutput.toFixed(3)}</div>
                      <Sparkline value={model.costOutput} max={bounds.costOutput.max} colorClass="bg-indigo-500" />
                    </td>

                    <td className="p-4">
                      <div className={cn("text-sm", getCellColor('reliability', model.reliability))}>{model.reliability}%</div>
                      <Sparkline value={model.reliability} max={100} colorClass="bg-emerald-500" />
                    </td>

                    <td className="p-4 text-sm tabular-nums text-[var(--color-text-primary)]">
                      {model.contextWindow.toLocaleString()}
                    </td>

                    <td className="p-4">
                      <div className={cn("text-sm", getCellColor('toolAccuracy', model.toolAccuracy))}>{model.toolAccuracy}%</div>
                      <Sparkline value={model.toolAccuracy} max={100} colorClass="bg-violet-500" />
                    </td>

                    <td className="p-4 text-xs text-[var(--color-text-secondary)] italic">
                      {model.rateLimit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Calculator & Insights Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Cost Calculator */}
          <div className="lg:col-span-2 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Projected Cost Calculator</h2>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)]">
                <input 
                  type="number" 
                  value={calcInput}
                  onChange={(e) => setCalcInput(Number(e.target.value))}
                  className="bg-transparent border-none outline-none text-right text-sm font-mono w-24 text-emerald-400"
                />
                <span className="text-xs text-[var(--color-text-muted)] uppercase">Tokens</span>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {MODELS.slice().sort((a: ModelData, b: ModelData) => a.costInput - b.costInput).map((model: ModelData) => (
                <div key={model.id} className="p-4 bg-[var(--color-surface-0)]/50 rounded-xl border border-[var(--color-border)] flex flex-col justify-between group hover:border-emerald-500/30 transition-colors">
                  <div className="text-xs text-[var(--color-text-muted)] mb-2">{model.name}</div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-mono font-bold text-[var(--color-text-primary)]">
                      ${((calcInput / 1000000) * model.costInput).toFixed(4)}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] uppercase">Total</span>
                  </div>
                  <div className="mt-3 w-full bg-[var(--color-surface-2)] h-1 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-700"
                      style={{ width: `${(Math.min(MODELS[0].costInput, model.costInput) / model.costInput) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Insights */}
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold text-[var(--color-text-primary)]">Discovery Recommendations</h2>
            <div className="space-y-4">
              <RecommendationCard 
                title="Efficient Routing" 
                desc="Use Gemini 1.5 Flash for high-throughput classification tasks to minimize latency and burn."
                icon="⚡"
              />
              <RecommendationCard 
                title="Complex Extraction" 
                desc="Claude 3.5 Sonnet remains the gold standard for intricate tool-calling and structured data tasks."
                icon="🛠️"
              />
              <RecommendationCard 
                title="Strict Budget" 
                desc="MiniMax M2.5 offers unprecedented value for long-context summarization at scale."
                icon="💰"
              />
            </div>
          </div>

        </div>

        {/* Footer Info */}
        <div className="flex items-center gap-4 py-4 px-6 bg-amber-950/20 border border-amber-900/30 rounded-xl">
          <div className="text-xl">⚠️</div>
          <p className="text-xs text-amber-200/70 leading-relaxed">
            Pricing and performance benchmarks are based on internal discovery runs as of Feb 2026. Latency values represent P95 response times for 500-token payloads. 
            Reliability metrics track API availability across primary regions over a 30-day trailing window.
          </p>
        </div>
      </div>
    </div>
  );
}

// --- Sub-components ---

function SortableHeader({ label, active, order, onClick }: { label: string, active: boolean, order: 'asc' | 'desc', onClick: () => void }) {
  return (
    <th 
      className={cn(
        "p-4 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none transition-colors",
        active ? "text-emerald-400" : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-1.5">
        {label}
        <span className="flex flex-col text-[8px] leading-[4px]">
          <span className={cn(active && order === 'asc' ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>▲</span>
          <span className={cn(active && order === 'desc' ? "text-emerald-400" : "text-[var(--color-text-muted)]")}>▼</span>
        </span>
      </div>
    </th>
  );
}

function RecommendationCard({ title, desc, icon }: { title: string, desc: string, icon: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-surface-0)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]/20 transition-all cursor-default group">
      <div className="flex items-center gap-3 mb-2">
        <span className="text-lg group-hover:scale-110 transition-transform">{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
      </div>
      <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
        {desc}
      </p>
    </div>
  );
}

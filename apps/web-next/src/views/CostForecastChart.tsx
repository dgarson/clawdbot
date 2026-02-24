import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '../lib/utils';
import { ChevronUp, ChevronDown, TrendingUp, DollarSign, Cpu, CalendarDays } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Frequency = 'daily' | 'weekly' | 'monthly';
type Duration = 0.25 | 0.5 | 1 | 2;
type ModelTier = 'economy' | 'standard' | 'premium';

interface ForecastSettings {
  frequency: Frequency;
  agentCount: number;
  duration: Duration;
  modelTier: ModelTier;
  budgetLine: number;
}

interface BarData {
  label: string;
  cost: number;
  cumulative: number;
}

interface TooltipState {
  index: number;
  x: number;
  y: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL_RATES: Record<ModelTier, number> = {
  economy: 0.05,
  standard: 0.50,
  premium: 2.00,
};

const MODEL_LABELS: Record<ModelTier, { name: string; sub: string }> = {
  economy: { name: 'Economy', sub: 'GLM / MiniMax' },
  standard: { name: 'Standard', sub: 'Sonnet' },
  premium: { name: 'Premium', sub: 'Opus / Codex' },
};

const DURATION_OPTIONS: { value: Duration; label: string }[] = [
  { value: 0.25, label: '15 min' },
  { value: 0.5, label: '30 min' },
  { value: 1, label: '1 hr' },
  { value: 2, label: '2 hr' },
];

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const TOKENS_PER_AGENT_HOUR = 150_000;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(base: Date, offset: number, frequency: Frequency): string {
  const d = new Date(base);
  if (frequency === 'daily') {
    d.setDate(d.getDate() + offset);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else if (frequency === 'weekly') {
    d.setDate(d.getDate() + offset * 7);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } else {
    d.setMonth(d.getMonth() + offset);
    return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  }
}

function barColor(cost: number): string {
  if (cost < 10) return '#22c55e';   // green-500
  if (cost <= 50) return '#f59e0b';  // amber-500
  return '#ef4444';                  // red-500
}

function computeBars(settings: ForecastSettings): BarData[] {
  const { frequency, agentCount, duration, modelTier } = settings;
  const rate = MODEL_RATES[modelTier];
  const costPerRun = agentCount * duration * rate;
  const base = new Date('2026-02-23');
  const bars: BarData[] = [];
  let cumulative = 0;
  for (let i = 0; i < 12; i++) {
    cumulative += costPerRun;
    bars.push({
      label: formatDate(base, i + 1, frequency),
      cost: costPerRun,
      cumulative: parseFloat(cumulative.toFixed(2)),
    });
  }
  return bars;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
}

function Stepper({ value, min, max, onChange }: StepperProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className={cn(
          'w-7 h-7 flex items-center justify-center rounded border text-sm transition-colors',
          value <= min
            ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
            : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white',
        )}
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>
      <span className="w-8 text-center text-white font-semibold text-sm tabular-nums">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className={cn(
          'w-7 h-7 flex items-center justify-center rounded border text-sm transition-colors',
          value >= max
            ? 'border-zinc-800 text-zinc-700 cursor-not-allowed'
            : 'border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white',
        )}
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

interface PillGroupProps<T extends string | number> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (val: T) => void;
}

function PillGroup<T extends string | number>({ options, value, onChange }: PillGroupProps<T>) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {options.map((opt) => (
        <button
          key={String(opt.value)}
          onClick={() => onChange(opt.value)}
          className={cn(
            'px-3 py-1 rounded-lg text-xs font-medium transition-colors border',
            value === opt.value
              ? 'bg-violet-600 border-violet-500 text-white'
              : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

const CHART_WIDTH = 580;
const CHART_HEIGHT = 240;
const PADDING = { top: 20, right: 16, bottom: 50, left: 56 };
const PLOT_W = CHART_WIDTH - PADDING.left - PADDING.right;
const PLOT_H = CHART_HEIGHT - PADDING.top - PADDING.bottom;

interface BarChartProps {
  bars: BarData[];
  budgetLine: number;
}

function BarChart({ bars, budgetLine }: BarChartProps) {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const maxCost = useMemo(() => Math.max(...bars.map((b) => b.cost), budgetLine) * 1.2, [bars, budgetLine]);

  const barW = PLOT_W / bars.length;
  const barPad = barW * 0.22;

  const toY = useCallback((val: number) => PLOT_H - (val / maxCost) * PLOT_H, [maxCost]);

  // Y-axis ticks
  const yTicks = useMemo(() => {
    const step = maxCost <= 10 ? 2 : maxCost <= 50 ? 10 : maxCost <= 200 ? 25 : 50;
    const ticks: number[] = [];
    for (let v = 0; v <= maxCost; v += step) ticks.push(v);
    return ticks;
  }, [maxCost]);

  const budgetY = toY(budgetLine);

  return (
    <div className="relative w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        className="w-full"
        style={{ minWidth: 340 }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line
            key={v}
            x1={PADDING.left}
            x2={PADDING.left + PLOT_W}
            y1={PADDING.top + toY(v)}
            y2={PADDING.top + toY(v)}
            stroke="#27272a"
            strokeWidth={1}
          />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text
            key={v}
            x={PADDING.left - 6}
            y={PADDING.top + toY(v) + 4}
            textAnchor="end"
            fill="#71717a"
            fontSize={10}
          >
            ${v}
          </text>
        ))}

        {/* Budget dashed line */}
        <line
          x1={PADDING.left}
          x2={PADDING.left + PLOT_W}
          y1={PADDING.top + budgetY}
          y2={PADDING.top + budgetY}
          stroke="#f97316"
          strokeWidth={1.5}
          strokeDasharray="5,4"
        />
        <text
          x={PADDING.left + PLOT_W - 2}
          y={PADDING.top + budgetY - 5}
          textAnchor="end"
          fill="#f97316"
          fontSize={9}
          fontWeight="600"
        >
          Budget ${budgetLine}
        </text>

        {/* Bars */}
        {bars.map((bar, i) => {
          const x = PADDING.left + i * barW + barPad;
          const bw = barW - barPad * 2;
          const bh = Math.max(2, (bar.cost / maxCost) * PLOT_H);
          const y = PADDING.top + PLOT_H - bh;
          const color = barColor(bar.cost);
          const isHovered = tooltip?.index === i;

          return (
            <g key={i}>
              {/* Hover zone */}
              <rect
                x={PADDING.left + i * barW}
                y={PADDING.top}
                width={barW}
                height={PLOT_H}
                fill="transparent"
                onMouseEnter={(e) => {
                  const svgEl = (e.target as SVGRectElement).ownerSVGElement;
                  if (!svgEl) return;
                  const rect = svgEl.getBoundingClientRect();
                  const svgX = ((e.clientX - rect.left) / rect.width) * CHART_WIDTH;
                  const svgY = ((e.clientY - rect.top) / rect.height) * CHART_HEIGHT;
                  setTooltip({ index: i, x: svgX, y: svgY });
                }}
              />
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={bw}
                height={bh}
                rx={3}
                fill={isHovered ? color : color + 'cc'}
                style={{ transition: 'fill 0.1s' }}
              />
            </g>
          );
        })}

        {/* X-axis labels */}
        {bars.map((bar, i) => {
          const cx = PADDING.left + i * barW + barW / 2;
          return (
            <text
              key={i}
              x={cx}
              y={PADDING.top + PLOT_H + 16}
              textAnchor="middle"
              fill="#52525b"
              fontSize={9}
              transform={`rotate(-35,${cx},${PADDING.top + PLOT_H + 16})`}
            >
              {bar.label}
            </text>
          );
        })}

        {/* Tooltip box */}
        {tooltip !== null && (() => {
          const bar = bars[tooltip.index];
          const tx = Math.min(tooltip.x + 10, CHART_WIDTH - 120);
          const ty = Math.max(tooltip.y - 50, PADDING.top);
          return (
            <g>
              <rect x={tx} y={ty} width={110} height={48} rx={6} fill="#18181b" stroke="#3f3f46" strokeWidth={1} />
              <text x={tx + 8} y={ty + 15} fill="#a1a1aa" fontSize={10}>{bar.label}</text>
              <text x={tx + 8} y={ty + 30} fill="#ffffff" fontSize={12} fontWeight="600">
                ${bar.cost.toFixed(2)} / run
              </text>
              <text x={tx + 8} y={ty + 43} fill="#71717a" fontSize={9}>
                cumulative: ${bar.cumulative.toFixed(2)}
              </text>
            </g>
          );
        })()}
      </svg>
    </div>
  );
}

// ─── Summary Stats ────────────────────────────────────────────────────────────

interface ForecastSummaryProps {
  bars: BarData[];
  settings: ForecastSettings;
}

function ForecastSummary({ bars, settings }: ForecastSummaryProps) {
  const totalCost = bars[bars.length - 1]?.cumulative ?? 0;
  const totalBudget = settings.budgetLine * 12;
  const diff = totalCost - totalBudget;
  const diffPct = totalBudget > 0 ? (diff / totalBudget) * 100 : 0;
  const totalTokens = settings.agentCount * settings.duration * TOKENS_PER_AGENT_HOUR * 12;

  return (
    <div className="grid grid-cols-3 gap-3 mt-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
          <DollarSign className="w-3.5 h-3.5" />
          Total Forecast
        </div>
        <div className="text-lg font-bold text-white">${totalCost.toFixed(2)}</div>
        <div className="text-xs text-zinc-500">over 12 periods</div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
          <TrendingUp className="w-3.5 h-3.5" />
          vs. Budget
        </div>
        <div className={cn('text-lg font-bold', diff > 0 ? 'text-red-400' : 'text-green-400')}>
          {diff > 0 ? '+' : ''}{diffPct.toFixed(1)}%
        </div>
        <div className="text-xs text-zinc-500">
          {diff > 0 ? 'over' : 'under'} ${totalBudget.toFixed(0)}
        </div>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center gap-1.5 text-zinc-400 text-xs mb-1">
          <Cpu className="w-3.5 h-3.5" />
          Token Estimate
        </div>
        <div className="text-lg font-bold text-white">
          {(totalTokens / 1_000_000).toFixed(1)}M
        </div>
        <div className="text-xs text-zinc-500">total tokens</div>
      </div>
    </div>
  );
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

interface SettingsPanelProps {
  settings: ForecastSettings;
  onChange: (s: ForecastSettings) => void;
}

function SettingsPanel({ settings, onChange }: SettingsPanelProps) {
  const patch = <K extends keyof ForecastSettings>(key: K, val: ForecastSettings[K]) =>
    onChange({ ...settings, [key]: val });

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-6 h-full">
      <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">Forecast Settings</h2>

      {/* Run Frequency */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Run Frequency</label>
        <PillGroup
          options={FREQUENCY_OPTIONS}
          value={settings.frequency}
          onChange={(v) => patch('frequency', v)}
        />
      </div>

      {/* Agent Count */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Agent Count</label>
        <Stepper
          value={settings.agentCount}
          min={1}
          max={20}
          onChange={(v) => patch('agentCount', v)}
        />
      </div>

      {/* Avg Run Duration */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Avg Run Duration</label>
        <PillGroup
          options={DURATION_OPTIONS}
          value={settings.duration}
          onChange={(v) => patch('duration', v)}
        />
      </div>

      {/* Model Tier */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Model Tier</label>
        <div className="space-y-2">
          {(Object.keys(MODEL_LABELS) as ModelTier[]).map((tier) => {
            const { name, sub } = MODEL_LABELS[tier];
            const rate = MODEL_RATES[tier];
            const selected = settings.modelTier === tier;
            return (
              <button
                key={tier}
                onClick={() => patch('modelTier', tier)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg border transition-all',
                  selected
                    ? 'bg-violet-950/60 border-violet-500 ring-1 ring-violet-500/30'
                    : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600',
                )}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className={cn('text-sm font-semibold', selected ? 'text-white' : 'text-zinc-300')}>{name}</div>
                    <div className="text-xs text-zinc-500">{sub}</div>
                  </div>
                  <div className={cn('text-xs font-mono', selected ? 'text-violet-300' : 'text-zinc-500')}>
                    ${rate}/agent-hr
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Budget Line */}
      <div>
        <label className="block text-xs text-zinc-500 mb-2 uppercase tracking-wide">Budget Line (per period)</label>
        <div className="flex items-center gap-2">
          <span className="text-zinc-400 text-sm">$</span>
          <input
            type="number"
            min={1}
            max={10000}
            value={settings.budgetLine}
            onChange={(e) => patch('budgetLine', Math.max(1, Number(e.target.value)))}
            className="w-20 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-violet-500 tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CostForecastChart() {
  const [settings, setSettings] = useState<ForecastSettings>({
    frequency: 'weekly',
    agentCount: 8,
    duration: 1,
    modelTier: 'standard',
    budgetLine: 25,
  });

  const bars = useMemo(() => computeBars(settings), [settings]);

  const freqLabel: Record<Frequency, string> = {
    daily: '12 days',
    weekly: '12 weeks',
    monthly: '12 months',
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays className="w-5 h-5 text-violet-400" />
            <h1 className="text-xl font-bold text-white">Cost Forecast</h1>
          </div>
          <p className="text-sm text-zinc-400">
            Projected discovery run costs for the next {freqLabel[settings.frequency]}.
          </p>
        </div>

        {/* ── Two-panel layout ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

          {/* Left — Settings */}
          <SettingsPanel settings={settings} onChange={setSettings} />

          {/* Right — Chart */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-200 uppercase tracking-wider">
                Projected Cost per Run
              </h2>
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-green-500 inline-block" /> &lt;$10
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-amber-500 inline-block" /> $10–50
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-sm bg-red-500 inline-block" /> &gt;$50
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-6 border-t-2 border-dashed border-orange-500" />
                  Budget
                </span>
              </div>
            </div>

            <BarChart bars={bars} budgetLine={settings.budgetLine} />
            <ForecastSummary bars={bars} settings={settings} />
          </div>
        </div>
      </div>
    </div>
  );
}

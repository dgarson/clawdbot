import React, { useState, useMemo } from 'react';
import { GitCompare, Download, ChevronDown, TrendingUp, TrendingDown, Minus, Search, Zap, Users } from 'lucide-react';
import { cn } from '../lib/utils';
import { useToast } from '../components/Toast';

// ============================================================================
// Types
// ============================================================================

interface Finding {
  id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  wave: number;
  agent: string;
  cost: number;
}

interface DiscoveryRun {
  id: string;
  label: string;
  date: string;
  totalCost: number;
  agentCount: number;
  findings: Finding[];
  waveCount: number;
}

type DiffStatus = 'new' | 'lost' | 'shared';

interface DiffedFinding extends Finding {
  status: DiffStatus;
}

// ============================================================================
// Mock Data
// ============================================================================

const SEVERITY_ORDER: Record<Finding['severity'], number> = {
  critical: 0, high: 1, medium: 2, low: 3, info: 4,
};

const MOCK_RUNS: DiscoveryRun[] = [
  {
    id: 'run-2026-02-20',
    label: 'Run #41 — Feb 20',
    date: '2026-02-20',
    totalCost: 3.84,
    agentCount: 6,
    waveCount: 4,
    findings: [
      { id: 'f1', title: 'Open S3 bucket exposes user PII', severity: 'critical', wave: 1, agent: 'Recon', cost: 0.18 },
      { id: 'f2', title: 'JWT secret stored in env var', severity: 'high', wave: 1, agent: 'Recon', cost: 0.12 },
      { id: 'f3', title: 'Unrotated API key in config repo', severity: 'high', wave: 2, agent: 'Enum', cost: 0.09 },
      { id: 'f4', title: 'CORS policy allows wildcard origin', severity: 'medium', wave: 2, agent: 'Enum', cost: 0.07 },
      { id: 'f5', title: 'Missing rate-limit on /auth/token', severity: 'medium', wave: 3, agent: 'Probe', cost: 0.06 },
      { id: 'f6', title: 'Verbose stack trace in 500 response', severity: 'low', wave: 3, agent: 'Probe', cost: 0.04 },
      { id: 'f7', title: 'Dependency lodash@4.17.19 has CVE', severity: 'medium', wave: 4, agent: 'SCA', cost: 0.05 },
      { id: 'f8', title: 'Old TLS 1.0 still negotiated', severity: 'high', wave: 4, agent: 'Net', cost: 0.11 },
    ],
  },
  {
    id: 'run-2026-02-22',
    label: 'Run #42 — Feb 22',
    date: '2026-02-22',
    totalCost: 4.21,
    agentCount: 8,
    waveCount: 4,
    findings: [
      { id: 'f1', title: 'Open S3 bucket exposes user PII', severity: 'critical', wave: 1, agent: 'Recon', cost: 0.19 },
      { id: 'f2', title: 'JWT secret stored in env var', severity: 'high', wave: 1, agent: 'Recon', cost: 0.13 },
      { id: 'f4', title: 'CORS policy allows wildcard origin', severity: 'medium', wave: 2, agent: 'Enum', cost: 0.08 },
      { id: 'f5', title: 'Missing rate-limit on /auth/token', severity: 'medium', wave: 3, agent: 'Probe', cost: 0.06 },
      { id: 'f9', title: 'SSO bypass via null assertion', severity: 'critical', wave: 1, agent: 'Recon', cost: 0.22 },
      { id: 'f10', title: 'Reflected XSS in search param', severity: 'high', wave: 2, agent: 'Enum', cost: 0.14 },
      { id: 'f11', title: 'Prototype pollution in upload handler', severity: 'high', wave: 3, agent: 'Probe', cost: 0.13 },
      { id: 'f12', title: 'Admin panel lacks 2FA enforcement', severity: 'medium', wave: 4, agent: 'Auth', cost: 0.08 },
      { id: 'f13', title: 'Unrestricted file upload extension', severity: 'high', wave: 4, agent: 'Auth', cost: 0.10 },
    ],
  },
];

const ALL_RUNS = MOCK_RUNS;

// ============================================================================
// Helpers
// ============================================================================

const SEVERITY_COLORS: Record<Finding['severity'], string> = {
  critical: 'text-red-400 bg-red-400/10 border-red-400/30',
  high:     'text-orange-400 bg-orange-400/10 border-orange-400/30',
  medium:   'text-yellow-400 bg-yellow-400/10 border-yellow-400/30',
  low:      'text-blue-400 bg-blue-400/10 border-blue-400/30',
  info:     'text-[var(--color-text-secondary)] bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/30',
};

const DIFF_ROW: Record<DiffStatus, string> = {
  new:    'border-l-2 border-green-500 bg-green-500/5',
  lost:   'border-l-2 border-red-500 bg-red-500/5',
  shared: 'border-l-2 border-[var(--color-surface-3)] bg-transparent',
};

const DIFF_BADGE: Record<DiffStatus, string> = {
  new:    'text-green-400',
  lost:   'text-red-400',
  shared: 'text-[var(--color-text-muted)]',
};

function diffFindings(a: Finding[], b: Finding[]): { runA: DiffedFinding[]; runB: DiffedFinding[] } {
  const aIds = new Set(a.map(f => f.id));
  const bIds = new Set(b.map(f => f.id));
  const shared = new Set([...aIds].filter(id => bIds.has(id)));

  const runA: DiffedFinding[] = a.map(f => ({
    ...f,
    status: shared.has(f.id) ? 'shared' : 'lost',
  }));
  const runB: DiffedFinding[] = b.map(f => ({
    ...f,
    status: shared.has(f.id) ? 'shared' : 'new',
  }));

  return { runA, runB };
}

function fmtCost(n: number) { return `$${n.toFixed(2)}`; }
function fmtPct(a: number, b: number) {
  if (a === 0) {return '+∞%';}
  const pct = ((b - a) / a) * 100;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

// ============================================================================
// Sub-components
// ============================================================================

interface SelectProps { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }
function RunSelect({ value, onChange, options }: SelectProps) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="appearance-none bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm rounded-lg px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)] pointer-events-none" />
    </div>
  );
}

interface StatCardProps { label: string; value: string; sub?: string; trend?: 'up' | 'down' | 'neutral' }
function StatCard({ label, value, sub, trend }: StatCardProps) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-red-400' : trend === 'down' ? 'text-green-400' : 'text-[var(--color-text-secondary)]';
  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-1 min-w-0">
      <span className="text-[var(--color-text-secondary)] text-xs uppercase tracking-wider">{label}</span>
      <div className="flex items-baseline gap-2">
        <span className="text-[var(--color-text-primary)] text-xl font-semibold tabular-nums">{value}</span>
        {trend && <TrendIcon className={cn('w-4 h-4', trendColor)} />}
      </div>
      {sub && <span className="text-[var(--color-text-muted)] text-xs">{sub}</span>}
    </div>
  );
}

interface FindingsColumnProps { run: DiscoveryRun | null; findings: DiffedFinding[]; side: 'A' | 'B' }
function FindingsColumn({ run, findings, side }: FindingsColumnProps) {
  if (!run) {return <div className="flex-1 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)] p-6 flex items-center justify-center text-[var(--color-text-muted)]">Select a run</div>;}
  const sorted = [...findings].toSorted((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  return (
    <div className="flex-1 min-w-0 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl overflow-hidden">
      <div className={cn('px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between', side === 'A' ? 'bg-indigo-900/20' : 'bg-violet-900/20')}>
        <span className="text-sm font-medium text-[var(--color-text-primary)]">{run.label}</span>
        <span className="text-xs text-[var(--color-text-secondary)]">{findings.length} findings</span>
      </div>
      <div className="divide-y divide-[var(--color-border)]/50 max-h-96 overflow-y-auto">
        {sorted.map(f => (
          <div key={f.id} className={cn('px-4 py-3 flex items-start gap-3', DIFF_ROW[f.status])}>
            <span className={cn('mt-0.5 text-xs font-medium px-1.5 py-0.5 rounded border uppercase tracking-wide shrink-0', SEVERITY_COLORS[f.severity])}>
              {f.severity.slice(0, 4)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[var(--color-text-primary)] leading-snug">{f.title}</p>
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">Wave {f.wave} · {f.agent} · {fmtCost(f.cost)}</p>
            </div>
            <span className={cn('text-xs mt-1 font-semibold shrink-0', DIFF_BADGE[f.status])}>
              {f.status === 'new' ? '+NEW' : f.status === 'lost' ? '−LOST' : '='}
            </span>
          </div>
        ))}
        {sorted.length === 0 && <div className="px-4 py-8 text-center text-[var(--color-text-muted)] text-sm">No findings</div>}
      </div>
    </div>
  );
}

// ============================================================================
// SVG Wave Chart
// ============================================================================

interface WaveChartProps { runA: DiscoveryRun; runB: DiscoveryRun }
function WaveBarChart({ runA, runB }: WaveChartProps) {
  const waves = [1, 2, 3, 4];
  const countByWave = (run: DiscoveryRun, w: number) => run.findings.filter(f => f.wave === w).length;
  const maxVal = Math.max(...waves.flatMap(w => [countByWave(runA, w), countByWave(runB, w)]), 1);

  const W = 320, H = 110, PAD_L = 24, PAD_B = 24, PAD_T = 10, PAD_R = 12;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_B - PAD_T;
  const groupW = chartW / waves.length;
  const barW = (groupW - 12) / 2;

  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-4">
      <h3 className="text-xs font-medium text-[var(--color-text-secondary)] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Search className="w-3.5 h-3.5" /> Findings per Wave
      </h3>
      <svg width={W} height={H} className="w-full" viewBox={`0 0 ${W} ${H}`}>
        {/* Y gridlines */}
        {[0, 0.5, 1].map(t => {
          const y = PAD_T + chartH * (1 - t);
          return (
            <g key={t}>
              <line x1={PAD_L} x2={W - PAD_R} y1={y} y2={y} stroke="#3f3f46" strokeWidth={0.5} />
              <text x={PAD_L - 4} y={y + 4} fontSize={8} fill="#71717a" textAnchor="end">
                {Math.round(maxVal * t)}
              </text>
            </g>
          );
        })}
        {/* Bars */}
        {waves.map((w, i) => {
          const aCount = countByWave(runA, w);
          const bCount = countByWave(runB, w);
          const x0 = PAD_L + i * groupW + 6;
          const aH = (aCount / maxVal) * chartH;
          const bH = (bCount / maxVal) * chartH;
          return (
            <g key={w}>
              <rect x={x0} y={PAD_T + chartH - aH} width={barW} height={aH} fill="#6366f1" rx={2} opacity={0.85} />
              <rect x={x0 + barW + 3} y={PAD_T + chartH - bH} width={barW} height={bH} fill="#a78bfa" rx={2} opacity={0.85} />
              <text x={x0 + barW} y={H - 6} fontSize={9} fill="#a1a1aa" textAnchor="middle">W{w}</text>
            </g>
          );
        })}
        {/* X axis */}
        <line x1={PAD_L} x2={W - PAD_R} y1={PAD_T + chartH} y2={PAD_T + chartH} stroke="#52525b" strokeWidth={1} />
      </svg>
      <div className="flex items-center gap-4 mt-1">
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"><span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" />Run A</span>
        <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]"><span className="w-2.5 h-2.5 rounded-sm bg-violet-400 inline-block" />Run B</span>
      </div>
    </div>
  );
}

// ============================================================================
// Main View
// ============================================================================

export default function DiscoveryRunCompare() {
  const { toast } = useToast();
  const [runAId, setRunAId] = useState(ALL_RUNS[0].id);
  const [runBId, setRunBId] = useState(ALL_RUNS[1].id);

  const runA = useMemo(() => ALL_RUNS.find(r => r.id === runAId) ?? null, [runAId]);
  const runB = useMemo(() => ALL_RUNS.find(r => r.id === runBId) ?? null, [runBId]);

  const { diffA, diffB, newCount, lostCount, sharedCount } = useMemo(() => {
    if (!runA || !runB) {return { diffA: [], diffB: [], newCount: 0, lostCount: 0, sharedCount: 0 };}
    const { runA: dA, runB: dB } = diffFindings(runA.findings, runB.findings);
    return {
      diffA: dA,
      diffB: dB,
      newCount: dB.filter(f => f.status === 'new').length,
      lostCount: dA.filter(f => f.status === 'lost').length,
      sharedCount: dA.filter(f => f.status === 'shared').length,
    };
  }, [runA, runB]);

  const runOptions = ALL_RUNS.map(r => ({ value: r.id, label: r.label }));

  const costDelta = runA && runB ? runB.totalCost - runA.totalCost : 0;
  const agentDelta = runA && runB ? runB.agentCount - runA.agentCount : 0;

  return (
    <div className="min-h-screen bg-[var(--color-surface-1)] text-[var(--color-text-primary)] p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
            <GitCompare className="w-5 h-5 text-[var(--color-text-primary)]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Compare Discovery Runs</h1>
            <p className="text-xs text-[var(--color-text-muted)]">Side-by-side diff of findings, cost, and coverage</p>
          </div>
        </div>
        <button
          onClick={() => toast({ message: "Diff export is coming soon.", type: "info" })}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] text-sm font-medium transition-colors"
        >
          <Download className="w-4 h-4" />
          Export Diff
        </button>
      </div>

      {/* Run Selectors */}
      <div className="flex flex-wrap items-center gap-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-indigo-600 text-[var(--color-text-primary)] text-xs flex items-center justify-center font-bold">A</span>
          <RunSelect value={runAId} onChange={setRunAId} options={runOptions} />
        </div>
        <span className="text-[var(--color-text-muted)] text-lg font-light">vs</span>
        <div className="flex items-center gap-2">
          <span className="w-5 h-5 rounded bg-violet-600 text-[var(--color-text-primary)] text-xs flex items-center justify-center font-bold">B</span>
          <RunSelect value={runBId} onChange={setRunBId} options={runOptions} />
        </div>
      </div>

      {/* Summary Stats Bar */}
      {runA && runB && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Cost A" value={fmtCost(runA.totalCost)} sub={`${runA.agentCount} agents`} />
          <StatCard label="Cost B" value={fmtCost(runB.totalCost)} sub={`${runB.agentCount} agents`} />
          <StatCard
            label="Cost Δ"
            value={`${costDelta >= 0 ? '+' : ''}${fmtCost(costDelta)}`}
            sub={fmtPct(runA.totalCost, runB.totalCost)}
            trend={costDelta > 0 ? 'up' : costDelta < 0 ? 'down' : 'neutral'}
          />
          <StatCard
            label="Agent Δ"
            value={`${agentDelta >= 0 ? '+' : ''}${agentDelta}`}
            sub={`${runA.agentCount} → ${runB.agentCount}`}
            trend={agentDelta > 0 ? 'up' : agentDelta < 0 ? 'down' : 'neutral'}
          />
        </div>
      )}

      {/* Findings Delta Badges */}
      {runA && runB && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2">
            <Zap className="w-4 h-4 text-green-400" />
            <span className="text-green-400 font-semibold text-sm">{newCount}</span>
            <span className="text-[var(--color-text-secondary)] text-sm">new findings</span>
          </div>
          <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
            <Minus className="w-4 h-4 text-red-400" />
            <span className="text-red-400 font-semibold text-sm">{lostCount}</span>
            <span className="text-[var(--color-text-secondary)] text-sm">lost / resolved</span>
          </div>
          <div className="flex items-center gap-2 bg-[var(--color-surface-3)]/50 border border-[var(--color-surface-3)] rounded-lg px-3 py-2">
            <Users className="w-4 h-4 text-[var(--color-text-secondary)]" />
            <span className="text-[var(--color-text-primary)] font-semibold text-sm">{sharedCount}</span>
            <span className="text-[var(--color-text-secondary)] text-sm">shared</span>
          </div>
        </div>
      )}

      {/* Side-by-side Findings */}
      <div className="flex gap-4">
        <FindingsColumn run={runA} findings={diffA} side="A" />
        <FindingsColumn run={runB} findings={diffB} side="B" />
      </div>

      {/* Wave Chart */}
      {runA && runB && (
        <div className="max-w-sm">
          <WaveBarChart runA={runA} runB={runB} />
        </div>
      )}
    </div>
  );
}

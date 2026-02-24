import React, { useState } from 'react';
import { cn } from '../lib/utils';

const findingsBreakdown = [
  { category: 'API Endpoint', count: 42, severity: 'HIGH', wave: 1 },
  { category: 'Auth Bypass', count: 12, severity: 'CRITICAL', wave: 2 },
  { category: 'Data Leak', count: 28, severity: 'HIGH', wave: 1 },
  { category: 'IDOR', count: 15, severity: 'MEDIUM', wave: 3 },
  { category: 'SSRF', count: 8, severity: 'CRITICAL', wave: 2 },
  { category: 'Information Disclosure', count: 56, severity: 'LOW', wave: 1 },
];

const modelPerformance = [
  { model: 'GPT-4o', calls: 1240, latency: '450ms', error: '0.2%', success: 99.8, color: 'indigo' },
  { model: 'Claude 3.5 Sonnet', calls: 890, latency: '620ms', error: '0.5%', success: 99.5, color: 'violet' },
  { model: 'Grok-1', calls: 450, latency: '310ms', error: '1.2%', success: 98.8, color: 'emerald' },
];

const topFindings = [
  { id: 1, severity: 'CRITICAL', desc: 'Unauthenticated administrative access to user billing profiles via /api/v1/admin/debug/billing', source: 'https://api.internal.target.com/debug', wave: 2 },
  { id: 2, severity: 'HIGH', desc: 'Hardcoded JWT signing key found in client-side production bundle (bundle-2024.js)', source: 'https://app.target.com/assets/main.js', wave: 1 },
  { id: 3, severity: 'HIGH', desc: 'Full database dump accessible via misconfigured S3 bucket permissions (target-backups-production)', source: 's3://target-backups-production/', wave: 1 },
  { id: 4, severity: 'CRITICAL', desc: 'Blind SSRF in image processing service allows internal network scanning of 10.0.0.0/8', source: 'https://images.target.com/process', wave: 2 },
  { id: 5, severity: 'MEDIUM', desc: 'Missing rate limiting on login endpoint allows potential brute-force attacks', source: 'https://auth.target.com/login', wave: 3 },
];

const costBreakdown = [
  { agent: 'Agent-01', model: 'GPT-4o', in: '125k', out: '45k', cost: 0.85 },
  { agent: 'Agent-02', model: 'Claude 3.5 Sonnet', in: '98k', out: '62k', cost: 1.20 },
  { agent: 'Agent-03', model: 'GPT-4o', in: '142k', out: '51k', cost: 0.95 },
  { agent: 'Agent-04', model: 'Grok-1', in: '210k', out: '30k', cost: 0.45 },
  { agent: 'Agent-05', model: 'Claude 3.5 Sonnet', in: '85k', out: '58k', cost: 1.10 },
];

const DiscoveryRunSummaryReport: React.FC = () => {
  const [costExpanded, setCostExpanded] = useState(false);

  const getSeverityColor = (sev: string) => {
    switch (sev) {
      case 'CRITICAL': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'HIGH': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'MEDIUM': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'LOW': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-[var(--color-surface-3)]/10 text-[var(--color-text-muted)] border-[var(--color-surface-3)]/20';
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--color-surface-0)] text-[var(--color-text-primary)] p-8 space-y-8 overflow-y-auto">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Discovery Run Summary</h1>
          <div className="flex items-center space-x-3 text-sm text-[var(--color-text-muted)]">
            <span className="flex items-center space-x-1">
              <span className="font-mono bg-[var(--color-surface-1)] px-2 py-0.5 rounded border border-[var(--color-border)]">RUN-2026-02-22-001</span>
            </span>
            <span>•</span>
            <span>Feb 22, 2026 12:45:00 MST</span>
          </div>
        </div>
        <div className="px-4 py-2 bg-indigo-500/10 text-indigo-400 rounded-xl border border-indigo-500/20 flex flex-col items-center">
          <span className="text-[10px] uppercase font-bold tracking-widest mb-0.5">Total Runtime</span>
          <span className="text-xl font-mono font-bold">03:47:12</span>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total Findings', value: '161', color: 'text-indigo-400' },
          { label: 'Unique Sources', value: '42', color: 'text-violet-400' },
          { label: 'Models Used', value: '3', color: 'text-emerald-400' },
          { label: 'Total Cost', value: '$14.85', color: 'text-orange-400' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] p-6 rounded-2xl shadow-sm">
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-widest font-bold mb-1">{kpi.label}</div>
            <div className={cn("text-3xl font-black", kpi.color)}>{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Finding Breakdown */}
        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <div className="p-6 border-b border-[var(--color-border)] flex justify-between items-center">
            <h2 className="text-lg font-bold">Finding Breakdown</h2>
            <span className="px-2 py-1 bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded text-[10px] font-bold">CATEGORIZED</span>
          </div>
          <table className="w-full text-left">
            <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider bg-[var(--color-surface-0)]/50">
              <tr>
                <th className="px-6 py-3 font-bold">Category</th>
                <th className="px-6 py-3 font-bold">Count</th>
                <th className="px-6 py-3 font-bold">Severity</th>
                <th className="px-6 py-3 font-bold">Wave</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-border)]/50">
              {findingsBreakdown.map((row) => (
                <tr key={row.category} className="hover:bg-[var(--color-surface-2)]/30 transition-colors">
                  <td className="px-6 py-4 text-sm font-medium text-[var(--color-text-primary)]">{row.category}</td>
                  <td className="px-6 py-4 text-sm font-mono text-[var(--color-text-secondary)]">{row.count}</td>
                  <td className="px-6 py-4">
                    <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getSeverityColor(row.severity))}>
                      {row.severity}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-[var(--color-text-muted)]">Wave {row.wave}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Model Performance */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold px-2">Model Performance</h2>
          <div className="space-y-4">
            {modelPerformance.map((m) => (
              <div key={m.model} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] p-6 rounded-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-lg font-bold text-[var(--color-text-primary)]">{m.model}</div>
                    <div className="text-xs text-[var(--color-text-muted)]">{m.calls} API calls</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-mono font-bold text-emerald-500">{m.success}%</div>
                    <div className="text-[10px] text-[var(--color-text-muted)] uppercase font-bold">Success Rate</div>
                  </div>
                </div>
                <div className="h-1.5 w-full bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-1000", 
                      m.color === 'indigo' ? 'bg-indigo-500' : m.color === 'violet' ? 'bg-violet-500' : 'bg-emerald-500'
                    )}
                    style={{ width: `${m.success}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Avg Latency:</span>
                    <span className="text-[var(--color-text-primary)] font-mono">{m.latency}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-muted)]">Error Rate:</span>
                    <span className="text-red-400 font-mono">{m.error}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Top Findings */}
      <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-[var(--color-border)]">
          <h2 className="text-lg font-bold">Top Findings</h2>
        </div>
        <div className="divide-y divide-[var(--color-border)]">
          {topFindings.map((f) => (
            <div key={f.id} className="p-6 hover:bg-[var(--color-surface-2)]/30 transition-colors space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold border", getSeverityColor(f.severity))}>
                    {f.severity}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--color-text-muted)] uppercase tracking-widest">WAVE {f.wave}</span>
                </div>
                <button className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button>
              </div>
              <p className="text-[var(--color-text-primary)] font-medium leading-relaxed">{f.desc}</p>
              <div className="text-[11px] font-mono text-[var(--color-text-muted)] truncate">{f.source}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Recommendations & Cost */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl p-6 space-y-6">
          <h2 className="text-lg font-bold">Recommendations</h2>
          <div className="space-y-4">
            {[
              { priority: 'CRITICAL', text: 'Immediate rotation of all JWT signing keys in production and update CI/CD pipelines.' },
              { priority: 'HIGH', text: 'Implement strict egress filtering on image processing servers to mitigate SSRF risks.' },
              { priority: 'HIGH', text: 'Review and lockdown S3 bucket permissions for all backup and production-data buckets.' },
              { priority: 'MEDIUM', text: 'Audit admin debug endpoints and implement mandatory MFA for all internal tool access.' },
            ].map((rec, i) => (
              <div key={i} className="flex items-start space-x-4">
                <div className="mt-1 flex-shrink-0 w-6 h-6 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs font-bold text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                  {i + 1}
                </div>
                <div className="space-y-1">
                  <span className={cn("text-[9px] font-black tracking-tighter px-1 rounded", 
                    rec.priority === 'CRITICAL' ? 'bg-red-500 text-[var(--color-text-primary)]' : 'bg-orange-500 text-[var(--color-text-primary)]'
                  )}>
                    {rec.priority}
                  </span>
                  <p className="text-sm text-[var(--color-text-primary)] leading-snug">{rec.text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-2xl overflow-hidden">
          <button 
            onClick={() => setCostExpanded(!costExpanded)}
            className="w-full p-6 flex justify-between items-center hover:bg-[var(--color-surface-2)]/30 transition-colors"
          >
            <h2 className="text-lg font-bold">Cost Breakdown</h2>
            <svg 
              className={cn("text-[var(--color-text-muted)] transition-transform duration-300", costExpanded ? "rotate-180" : "")}
              width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6"></path>
            </svg>
          </button>
          {costExpanded && (
            <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
              <table className="w-full text-left">
                <thead className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
                  <tr>
                    <th className="py-2">Agent</th>
                    <th className="py-2 text-right">Tokens In/Out</th>
                    <th className="py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {costBreakdown.map((c) => (
                    <tr key={c.agent} className="text-sm">
                      <td className="py-3 font-medium text-[var(--color-text-secondary)]">
                        {c.agent}
                        <div className="text-[10px] text-[var(--color-text-muted)]">{c.model}</div>
                      </td>
                      <td className="py-3 text-right font-mono text-[var(--color-text-muted)]">{c.in} / {c.out}</td>
                      <td className="py-3 text-right font-bold text-indigo-400">${c.cost.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {/* Export Footer */}
      <div className="flex justify-end space-x-4 pt-4 border-t border-[var(--color-border)]">
        <button className="px-6 py-2 bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded-xl border border-[var(--color-border)] text-sm font-bold transition-all">CSV</button>
        <button className="px-6 py-2 bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] rounded-xl border border-[var(--color-border)] text-sm font-bold transition-all">JSON</button>
        <button className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-[var(--color-text-primary)] rounded-xl text-sm font-bold shadow-lg shadow-indigo-500/20 transition-all">Export PDF</button>
      </div>
    </div>
  );
};

export default DiscoveryRunSummaryReport;

import { useState } from 'react';
import {
  Bot,
  Brain,
  Search,
  MessageSquare,
  Code,
  Globe,
  Database,
  Shield,
  Zap,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Microscope,
  BarChart2,
  Download,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type CapabilityStatus = 'supported' | 'partial' | 'unsupported' | 'experimental';
type AgentTier = 'core' | 'enterprise' | 'research';

interface Agent {
  id: string;
  name: string;
  tier: AgentTier;
  version: string;
  description: string;
}

interface Capability {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ElementType;
}

interface MatrixCell {
  agentId: string;
  capabilityId: string;
  status: CapabilityStatus;
  notes?: string;
}

// ============================================================================
// Config
// ============================================================================

const TIER_CONFIG: Record<AgentTier, { label: string; color: string; bg: string }> = {
  core: { label: 'Core', color: 'text-blue-400', bg: 'bg-blue-400/10' },
  enterprise: { label: 'Enterprise', color: 'text-violet-400', bg: 'bg-violet-400/10' },
  research: { label: 'Research', color: 'text-amber-400', bg: 'bg-amber-400/10' },
};

const STATUS_CONFIG: Record<CapabilityStatus, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  supported: { label: 'Supported', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-400/10' },
  partial: { label: 'Partial', icon: AlertCircle, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  unsupported: { label: 'Not supported', icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10' },
  experimental: { label: 'Experimental', icon: Microscope, color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
};

// ============================================================================
// Mock Data
// ============================================================================

const AGENTS: Agent[] = [
  { id: 'a1', name: 'ClawdBot Base', tier: 'core', version: 'v3.2', description: 'Standard conversational agent' },
  { id: 'a2', name: 'ClawdBot Pro', tier: 'enterprise', version: 'v3.2', description: 'Enhanced enterprise agent with tool use' },
  { id: 'a3', name: 'ClawdBot Search', tier: 'core', version: 'v2.8', description: 'Search-optimized agent' },
  { id: 'a4', name: 'ClawdBot Code', tier: 'enterprise', version: 'v3.1', description: 'Software engineering specialist' },
  { id: 'a5', name: 'ClawdBot Research', tier: 'research', version: 'v0.9-beta', description: 'Experimental research assistant' },
  { id: 'a6', name: 'ClawdBot Data', tier: 'enterprise', version: 'v3.0', description: 'Data analysis and SQL specialist' },
];

const CAPABILITIES: Capability[] = [
  { id: 'c1', name: 'Web Search', category: 'Tools', description: 'Search the internet in real time', icon: Globe },
  { id: 'c2', name: 'Code Generation', category: 'Tools', description: 'Generate and explain code', icon: Code },
  { id: 'c3', name: 'Database Query', category: 'Tools', description: 'Execute SQL and analyze schemas', icon: Database },
  { id: 'c4', name: 'Multi-turn Memory', category: 'Reasoning', description: 'Remember context across turns', icon: Brain },
  { id: 'c5', name: 'Tool Orchestration', category: 'Reasoning', description: 'Chain multiple tools in sequence', icon: Zap },
  { id: 'c6', name: 'Document Analysis', category: 'Input', description: 'Parse and reason over documents', icon: Search },
  { id: 'c7', name: 'Data Visualization', category: 'Output', description: 'Generate charts and reports', icon: BarChart2 },
  { id: 'c8', name: 'PII Redaction', category: 'Safety', description: 'Automatically redact sensitive data', icon: Shield },
  { id: 'c9', name: 'Multi-modal Input', category: 'Input', description: 'Process images and audio', icon: MessageSquare },
  { id: 'c10', name: 'Streaming Output', category: 'Output', description: 'Stream tokens as they generate', icon: Bot },
];

const MATRIX: MatrixCell[] = [
  // ClawdBot Base
  { agentId: 'a1', capabilityId: 'c1', status: 'partial', notes: 'Rate limited to 5 req/min' },
  { agentId: 'a1', capabilityId: 'c2', status: 'supported' },
  { agentId: 'a1', capabilityId: 'c3', status: 'unsupported' },
  { agentId: 'a1', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a1', capabilityId: 'c5', status: 'unsupported' },
  { agentId: 'a1', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a1', capabilityId: 'c7', status: 'unsupported' },
  { agentId: 'a1', capabilityId: 'c8', status: 'partial' },
  { agentId: 'a1', capabilityId: 'c9', status: 'unsupported' },
  { agentId: 'a1', capabilityId: 'c10', status: 'supported' },
  // ClawdBot Pro
  { agentId: 'a2', capabilityId: 'c1', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c2', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c3', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c5', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c7', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c8', status: 'supported' },
  { agentId: 'a2', capabilityId: 'c9', status: 'partial', notes: 'Images only; no audio' },
  { agentId: 'a2', capabilityId: 'c10', status: 'supported' },
  // ClawdBot Search
  { agentId: 'a3', capabilityId: 'c1', status: 'supported' },
  { agentId: 'a3', capabilityId: 'c2', status: 'partial' },
  { agentId: 'a3', capabilityId: 'c3', status: 'unsupported' },
  { agentId: 'a3', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a3', capabilityId: 'c5', status: 'partial' },
  { agentId: 'a3', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a3', capabilityId: 'c7', status: 'unsupported' },
  { agentId: 'a3', capabilityId: 'c8', status: 'partial' },
  { agentId: 'a3', capabilityId: 'c9', status: 'unsupported' },
  { agentId: 'a3', capabilityId: 'c10', status: 'supported' },
  // ClawdBot Code
  { agentId: 'a4', capabilityId: 'c1', status: 'partial' },
  { agentId: 'a4', capabilityId: 'c2', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c3', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c5', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c7', status: 'partial', notes: 'Chart generation only' },
  { agentId: 'a4', capabilityId: 'c8', status: 'supported' },
  { agentId: 'a4', capabilityId: 'c9', status: 'partial', notes: 'Images only' },
  { agentId: 'a4', capabilityId: 'c10', status: 'supported' },
  // ClawdBot Research
  { agentId: 'a5', capabilityId: 'c1', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c2', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c3', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a5', capabilityId: 'c5', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a5', capabilityId: 'c7', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c8', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c9', status: 'experimental' },
  { agentId: 'a5', capabilityId: 'c10', status: 'supported' },
  // ClawdBot Data
  { agentId: 'a6', capabilityId: 'c1', status: 'partial' },
  { agentId: 'a6', capabilityId: 'c2', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c3', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c4', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c5', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c6', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c7', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c8', status: 'supported' },
  { agentId: 'a6', capabilityId: 'c9', status: 'unsupported' },
  { agentId: 'a6', capabilityId: 'c10', status: 'supported' },
];

// ============================================================================
// Helpers
// ============================================================================

function getCell(agentId: string, capabilityId: string): MatrixCell | undefined {
  return MATRIX.find((m) => m.agentId === agentId && m.capabilityId === capabilityId);
}

function getCapabilityScore(capabilityId: string): number {
  const statuses = AGENTS.map((a) => getCell(a.id, capabilityId)?.status ?? 'unsupported');
  const weights: Record<CapabilityStatus, number> = { supported: 1, experimental: 0.5, partial: 0.5, unsupported: 0 };
  return Math.round((statuses.reduce((sum, s) => sum + weights[s], 0) / AGENTS.length) * 100);
}

// ============================================================================
// StatusCell — text companion for the icon (not color-only)
// ============================================================================

function StatusCell({ status, notes }: { status: CapabilityStatus; notes?: string }) {
  const { label, icon: Icon, color, bg } = STATUS_CONFIG[status];
  return (
    <div
      className={cn('inline-flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg w-full', bg)}
      title={notes ? `${label}: ${notes}` : label}
    >
      <Icon className={cn('w-4 h-4', color)} aria-hidden="true" />
      <span className={cn('text-[10px] font-medium leading-tight', color)}>
        {status === 'supported' ? '✓' : status === 'unsupported' ? '✗' : status === 'partial' ? '~' : 'β'}
      </span>
      <span className="sr-only">{label}{notes ? `: ${notes}` : ''}</span>
    </div>
  );
}

// ============================================================================
// Legend
// ============================================================================

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {Object.entries(STATUS_CONFIG).map(([key, { label, icon: Icon, color, bg }]) => (
        <div key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)]">
          <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded', bg)}>
            <Icon className={cn('w-3 h-3', color)} aria-hidden="true" />
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AgentCapabilityMatrix() {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tierFilter, setTierFilter] = useState<AgentTier | 'all'>('all');
  const [search, setSearch] = useState('');

  const categories = ['all', ...Array.from(new Set(CAPABILITIES.map((c) => c.category)))];
  const filteredCapabilities = CAPABILITIES.filter((cap) => {
    const matchCat = categoryFilter === 'all' || cap.category === categoryFilter;
    const matchSearch = cap.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });
  const filteredAgents = AGENTS.filter((a) => tierFilter === 'all' || a.tier === tierFilter);

  return (
    <>
      {/* Skip link — WCAG 2.4.1 */}
      <a
        href="#capability-matrix-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-violet-600 focus:text-[var(--color-text-primary)] focus:rounded-lg focus:font-medium focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="min-h-screen bg-[var(--color-surface-0)] text-[var(--color-text-primary)]">
        <main id="capability-matrix-main" className="p-6 space-y-6 max-w-full">

          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[var(--color-text-primary)] flex items-center gap-2">
                <Bot className="w-6 h-6 text-violet-400" aria-hidden="true" />
                Agent Capability Matrix
              </h1>
              <p className="text-sm text-[var(--color-text-secondary)] mt-0.5">
                Compare feature support across all agent variants
              </p>
            </div>
            <button
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-surface-3)] text-sm font-medium focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              onClick={() => window.print()}
            >
              <Download className="w-4 h-4" aria-hidden="true" />
              Export
            </button>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Total Agents', value: AGENTS.length, sub: `${AGENTS.filter((a) => a.tier === 'enterprise').length} enterprise` },
              { label: 'Capabilities', value: CAPABILITIES.length, sub: `${categories.length - 1} categories` },
              {
                label: 'Full Coverage',
                value: `${Math.round(MATRIX.filter((m) => m.status === 'supported').length / MATRIX.length * 100)}%`,
                sub: 'of matrix cells',
              },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
                <div className="text-xs text-[var(--color-text-secondary)] uppercase tracking-wide">{label}</div>
                <div className="text-2xl font-bold text-[var(--color-text-primary)] mt-1">{value}</div>
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{sub}</div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <section aria-label="Filter controls" className="flex flex-wrap items-center gap-4 bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
            <Filter className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" aria-hidden="true" />

            <div>
              <label htmlFor="capability-search" className="sr-only">Search capabilities</label>
              <input
                id="capability-search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search capabilities…"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="category-filter" className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">Category:</label>
              <select
                id="category-filter"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c === 'all' ? 'All Categories' : c}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="tier-filter" className="text-sm text-[var(--color-text-secondary)] whitespace-nowrap">Agent tier:</label>
              <select
                id="tier-filter"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as AgentTier | 'all')}
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-[var(--color-text-primary)] text-sm focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:outline-none"
              >
                <option value="all">All Tiers</option>
                {Object.entries(TIER_CONFIG).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Legend */}
          <section aria-label="Status legend" className="flex items-center gap-3 flex-wrap">
            <span className="text-xs text-[var(--color-text-muted)] font-medium uppercase tracking-wide">Legend:</span>
            <Legend />
          </section>

          {/* Matrix table */}
          <section aria-label="Capability matrix table">
            <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">
                    Agent capability matrix — {filteredAgents.length} agents, {filteredCapabilities.length} capabilities shown
                  </caption>
                  <thead className="bg-[var(--color-surface-2)]/60">
                    <tr>
                      {/* Capability column header */}
                      <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-4 py-3 min-w-[200px] sticky left-0 bg-[var(--color-surface-2)]/60 z-10">
                        Capability
                      </th>
                      <th scope="col" className="text-left text-[var(--color-text-secondary)] font-medium px-3 py-3 w-20 hidden md:table-cell">
                        Category
                      </th>
                      {/* Agent column headers */}
                      {filteredAgents.map((agent) => {
                        const tierCfg = TIER_CONFIG[agent.tier];
                        return (
                          <th key={agent.id} scope="col" className="text-center px-3 py-3 min-w-[110px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[var(--color-text-primary)] font-semibold text-xs leading-tight">{agent.name}</span>
                              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', tierCfg.bg, tierCfg.color)}>
                                {tierCfg.label}
                              </span>
                              <span className="text-[var(--color-text-muted)] text-[10px]">{agent.version}</span>
                            </div>
                          </th>
                        );
                      })}
                      {/* Coverage column */}
                      <th scope="col" className="text-center text-[var(--color-text-secondary)] font-medium px-3 py-3 min-w-[80px]">
                        Coverage
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-border)]/50">
                    {filteredCapabilities.length === 0 ? (
                      <tr>
                        <td colSpan={filteredAgents.length + 3} className="px-4 py-8 text-center text-[var(--color-text-muted)]">
                          No capabilities match your filters.
                        </td>
                      </tr>
                    ) : (
                      filteredCapabilities.map((cap) => {
                        const CapIcon = cap.icon;
                        const score = getCapabilityScore(cap.id);
                        return (
                          <tr key={cap.id} className="hover:bg-[var(--color-surface-2)]/20 transition-colors">
                            {/* th scope="row" — capability name is the row header for AT navigation (WCAG 1.3.1) */}
                            <th scope="row" className="px-4 py-3 sticky left-0 bg-[var(--color-surface-1)] hover:bg-[var(--color-surface-2)]/20 z-10 font-normal text-left">
                              <div className="flex items-center gap-2">
                                <CapIcon className="w-4 h-4 text-[var(--color-text-secondary)] flex-shrink-0" aria-hidden="true" />
                                <div>
                                  <div className="text-[var(--color-text-primary)] font-medium text-xs">{cap.name}</div>
                                  <div className="text-[var(--color-text-muted)] text-[10px] hidden md:block">{cap.description}</div>
                                </div>
                              </div>
                            </th>
                            <td className="px-3 py-3 hidden md:table-cell">
                              <span className="text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-1.5 py-0.5 rounded">{cap.category}</span>
                            </td>
                            {filteredAgents.map((agent) => {
                              const cell = getCell(agent.id, cap.id);
                              return (
                                <td key={agent.id} className="px-3 py-2 text-center">
                                  {cell ? (
                                    <StatusCell status={cell.status} notes={cell.notes} />
                                  ) : (
                                    <span className="text-[var(--color-text-muted)] text-xs" aria-label="No data">—</span>
                                  )}
                                </td>
                              );
                            })}
                            {/* Coverage percentage — text + color */}
                            <td className="px-3 py-3 text-center">
                              <span
                                className={cn(
                                  'text-xs font-bold',
                                  score >= 75 ? 'text-green-400' : score >= 40 ? 'text-amber-400' : 'text-red-400'
                                )}
                                aria-label={`${score}% coverage`}
                              >
                                {score}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* Per-agent summary */}
          <section aria-label="Agent summary cards">
            <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-4">Agent Summaries</h2>
            <div className="grid grid-cols-3 gap-4">
              {AGENTS.map((agent) => {
                const cells = CAPABILITIES.map((cap) => getCell(agent.id, cap.id));
                const supported = cells.filter((c) => c?.status === 'supported').length;
                const partial = cells.filter((c) => c?.status === 'partial' || c?.status === 'experimental').length;
                const unsupported = cells.filter((c) => c?.status === 'unsupported').length;
                const tierCfg = TIER_CONFIG[agent.tier];
                return (
                  <div key={agent.id} className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[var(--color-text-primary)] font-semibold text-sm">{agent.name}</div>
                        <div className="text-[var(--color-text-muted)] text-xs mt-0.5">{agent.description}</div>
                      </div>
                      <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0', tierCfg.bg, tierCfg.color)}>
                        {tierCfg.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      {[
                        { label: 'Supported', value: supported, color: 'text-green-400' },
                        { label: 'Partial', value: partial, color: 'text-amber-400' },
                        { label: 'Not supported', value: unsupported, color: 'text-red-400' },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="bg-[var(--color-surface-2)] rounded-lg py-2 px-1">
                          <div className={cn('text-lg font-bold', color)}>{value}</div>
                          <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </>
  );
}

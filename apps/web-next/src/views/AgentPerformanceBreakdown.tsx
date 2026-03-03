import { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  DollarSign,
  Layers,
  Zap,
  Wrench as Tool,
  BarChart,
  PieChart,
  Users,
  Activity,
  XCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type TimeRange = '1h' | '24h' | '7d' | '30d';
type SortDirection = 'asc' | 'desc';
type ErrorType = 'rate-limit' | 'timeout' | 'tool-error' | 'auth' | 'other';

interface AgentMetrics {
  name: string;
  sessions: number;
  tasksCompleted: number;
  successRate: number; // percentage
  avgDuration: number; // seconds
  tokensIn: number;
  tokensOut: number;
  estCost: number; // USD
  errors: number;
  taskHistory: TaskEntry[];
  toolUsage: Record<string, number>;
  errorBreakdown: Record<ErrorType, number>;
  modelUsage: Record<string, { tokens: number }>;
}

interface TaskEntry {
  id: string;
  status: 'success' | 'error' | 'pending';
  duration: number; // seconds
  model: string;
  tokens: number;
}

interface TopMetrics {
  mostActive: string;
  highestSuccess: string;
  mostEfficient: string;
  costliest: string;
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_AGENTS: AgentMetrics[] = [
  {
    name: 'Luis',
    sessions: 45,
    tasksCompleted: 120,
    successRate: 92,
    avgDuration: 45,
    tokensIn: 150000,
    tokensOut: 45000,
    estCost: 12.5,
    errors: 8,
    taskHistory: [
      { id: 't1', status: 'success', duration: 30, model: 'claude-3-opus', tokens: 1200 },
      { id: 't2', status: 'error', duration: 60, model: 'gpt-4', tokens: 800 },
      { id: 't3', status: 'success', duration: 40, model: 'claude-3-opus', tokens: 1500 },
    ],
    toolUsage: { exec: 20, read: 15, write: 10, browser: 5, message: 8 },
    errorBreakdown: { 'rate-limit': 2, timeout: 3, 'tool-error': 1, auth: 0, other: 2 },
    modelUsage: { 'claude-3-opus': { tokens: 100000 }, 'gpt-4': { tokens: 50000 } },
  },
  {
    name: 'Reed',
    sessions: 32,
    tasksCompleted: 95,
    successRate: 88,
    avgDuration: 55,
    tokensIn: 120000,
    tokensOut: 38000,
    estCost: 10.2,
    errors: 12,
    taskHistory: [
      { id: 't1', status: 'success', duration: 50, model: 'gpt-4', tokens: 900 },
      { id: 't2', status: 'pending', duration: 0, model: 'claude-3-sonnet', tokens: 0 },
    ],
    toolUsage: { exec: 15, read: 20, write: 12, browser: 10, message: 5 },
    errorBreakdown: { 'rate-limit': 4, timeout: 2, 'tool-error': 3, auth: 1, other: 2 },
    modelUsage: { 'gpt-4': { tokens: 80000 }, 'claude-3-sonnet': { tokens: 40000 } },
  },
  {
    name: 'Quinn',
    sessions: 50,
    tasksCompleted: 140,
    successRate: 95,
    avgDuration: 40,
    tokensIn: 180000,
    tokensOut: 50000,
    estCost: 14.8,
    errors: 5,
    taskHistory: [
      { id: 't1', status: 'success', duration: 35, model: 'claude-3-haiku', tokens: 1000 },
      { id: 't2', status: 'success', duration: 45, model: 'claude-3-haiku', tokens: 1200 },
    ],
    toolUsage: { exec: 25, read: 18, write: 15, browser: 8, message: 10 },
    errorBreakdown: { 'rate-limit': 1, timeout: 1, 'tool-error': 2, auth: 0, other: 1 },
    modelUsage: { 'claude-3-haiku': { tokens: 150000 }, 'gpt-3.5': { tokens: 30000 } },
  },
  {
    name: 'Piper',
    sessions: 28,
    tasksCompleted: 85,
    successRate: 90,
    avgDuration: 50,
    tokensIn: 110000,
    tokensOut: 35000,
    estCost: 9.5,
    errors: 10,
    taskHistory: [
      { id: 't1', status: 'error', duration: 70, model: 'gpt-4', tokens: 1400 },
    ],
    toolUsage: { exec: 10, read: 12, write: 8, browser: 15, message: 12 },
    errorBreakdown: { 'rate-limit': 3, timeout: 4, 'tool-error': 1, auth: 1, other: 1 },
    modelUsage: { 'gpt-4': { tokens: 70000 }, 'claude-3-sonnet': { tokens: 40000 } },
  },
  {
    name: 'Wes',
    sessions: 40,
    tasksCompleted: 110,
    successRate: 85,
    avgDuration: 60,
    tokensIn: 140000,
    tokensOut: 42000,
    estCost: 11.8,
    errors: 15,
    taskHistory: [
      { id: 't1', status: 'success', duration: 55, model: 'claude-3-opus', tokens: 1300 },
      { id: 't2', status: 'success', duration: 65, model: 'claude-3-opus', tokens: 1500 },
    ],
    toolUsage: { exec: 18, read: 10, write: 20, browser: 6, message: 7 },
    errorBreakdown: { 'rate-limit': 5, timeout: 3, 'tool-error': 4, auth: 2, other: 1 },
    modelUsage: { 'claude-3-opus': { tokens: 90000 }, 'gpt-4': { tokens: 50000 } },
  },
  {
    name: 'Sandy',
    sessions: 35,
    tasksCompleted: 100,
    successRate: 93,
    avgDuration: 42,
    tokensIn: 130000,
    tokensOut: 40000,
    estCost: 10.9,
    errors: 7,
    taskHistory: [
      { id: 't1', status: 'success', duration: 40, model: 'gpt-3.5', tokens: 800 },
    ],
    toolUsage: { exec: 12, read: 16, write: 9, browser: 7, message: 9 },
    errorBreakdown: { 'rate-limit': 2, timeout: 2, 'tool-error': 2, auth: 0, other: 1 },
    modelUsage: { 'gpt-3.5': { tokens: 100000 }, 'claude-3-haiku': { tokens: 30000 } },
  },
  {
    name: 'Barry',
    sessions: 25,
    tasksCompleted: 70,
    successRate: 80,
    avgDuration: 70,
    tokensIn: 90000,
    tokensOut: 28000,
    estCost: 7.6,
    errors: 20,
    taskHistory: [
      { id: 't1', status: 'error', duration: 80, model: 'gpt-4', tokens: 1600 },
      { id: 't2', status: 'success', duration: 60, model: 'gpt-4', tokens: 1200 },
    ],
    toolUsage: { exec: 8, read: 8, write: 6, browser: 12, message: 6 },
    errorBreakdown: { 'rate-limit': 6, timeout: 5, 'tool-error': 5, auth: 3, other: 1 },
    modelUsage: { 'gpt-4': { tokens: 60000 }, 'claude-3-sonnet': { tokens: 30000 } },
  },
  {
    name: 'Jerry',
    sessions: 55,
    tasksCompleted: 160,
    successRate: 96,
    avgDuration: 35,
    tokensIn: 200000,
    tokensOut: 55000,
    estCost: 16.2,
    errors: 4,
    taskHistory: [
      { id: 't1', status: 'success', duration: 30, model: 'claude-3-haiku', tokens: 900 },
      { id: 't2', status: 'success', duration: 40, model: 'claude-3-haiku', tokens: 1100 },
      { id: 't3', status: 'pending', duration: 0, model: 'claude-3-haiku', tokens: 0 },
    ],
    toolUsage: { exec: 30, read: 22, write: 18, browser: 10, message: 15 },
    errorBreakdown: { 'rate-limit': 1, timeout: 1, 'tool-error': 1, auth: 0, other: 1 },
    modelUsage: { 'claude-3-haiku': { tokens: 180000 }, 'gpt-3.5': { tokens: 20000 } },
  },
];

const TOOLS = ['exec', 'read', 'write', 'browser', 'message'];

const TOP_METRICS: TopMetrics = {
  mostActive: 'Jerry',
  highestSuccess: 'Jerry',
  mostEfficient: 'Quinn',
  costliest: 'Jerry',
};

// ============================================================================
// Helpers
// ============================================================================

function formatPercentage(p: number): string {
  return `${p}%`;
}

function formatDuration(seconds: number): string {
  return `${seconds}s`;
}

function formatTokens(inTokens: number, outTokens: number): string {
  return `${(inTokens / 1000).toFixed(1)}k / ${(outTokens / 1000).toFixed(1)}k`;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(2)}`;
}

function getHeatmapColor(value: number, max: number): string {
  const intensity = Math.min(value / max, 1);
  return `bg-blue-${Math.floor(intensity * 900) + 100}`;
}

function getMaxToolUsage(agents: AgentMetrics[]): number {
  return Math.max(...agents.flatMap(a => Object.values(a.toolUsage)));
}

function getTotalErrors(breakdown: Record<ErrorType, number>): number {
  return Object.values(breakdown).reduce((a, b) => a + b, 0);
}

function getErrorColor(type: ErrorType): string {
  const colors: Record<ErrorType, string> = {
    'rate-limit': 'bg-yellow-500',
    timeout: 'bg-orange-500',
    'tool-error': 'bg-red-500',
    auth: 'bg-purple-500',
    other: 'bg-gray-500',
  };
  return colors[type];
}

// ============================================================================
// Sub-components
// ============================================================================

function TopMetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: React.ElementType }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-zinc-800 rounded-lg">
        <Icon className="w-4 h-4 text-zinc-400" />
      </div>
      <div>
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <span className="text-xl font-bold text-white">{value}</span>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: TaskEntry['status'] }) {
  const styles = {
    success: 'bg-green-500/15 text-green-400',
    error: 'bg-red-500/15 text-red-400',
    pending: 'bg-amber-500/15 text-amber-400',
  };
  return <span className={cn('px-2 py-1 rounded text-xs', styles[status])}>{status}</span>;
}

// ============================================================================
// Main Component
// ============================================================================

export default function AgentPerformanceBreakdown() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [sortColumn, setSortColumn] = useState<keyof AgentMetrics>('sessions');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  const sortedAgents = [...MOCK_AGENTS].sort((a, b) => {
    const aVal = a[sortColumn];
    const bVal = b[sortColumn];
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    return 0;
  });

  const handleSort = (column: keyof AgentMetrics) => {
    if (column === sortColumn) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const maxToolUsage = getMaxToolUsage(MOCK_AGENTS);

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <BarChart className="w-6 h-6 text-blue-400" />
          Agent Performance
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex gap-1 bg-zinc-800 rounded-lg p-0.5">
            {(['1h', '24h', '7d', '30d'] as TimeRange[]).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={cn(
                  'px-3 py-1 rounded-md text-xs font-medium transition-colors',
                  timeRange === range ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:text-zinc-300',
                )}
              >
                {range}
              </button>
            ))}
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-medium text-white transition-colors">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-4 gap-4">
        <TopMetricCard label="Most Active Agent" value={TOP_METRICS.mostActive} icon={Activity} />
        <TopMetricCard label="Highest Success Rate" value={TOP_METRICS.highestSuccess} icon={CheckCircle} />
        <TopMetricCard label="Most Efficient" value={TOP_METRICS.mostEfficient} icon={Zap} />
        <TopMetricCard label="Costliest Session" value={TOP_METRICS.costliest} icon={DollarSign} />
      </div>

      {/* Agent Roster Table */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Users className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Agent Roster</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs text-zinc-400 uppercase tracking-wider border-b border-zinc-800">
                <th className="px-4 py-2">Agent</th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('sessions')}>
                  Sessions {sortColumn === 'sessions' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('tasksCompleted')}>
                  Tasks Completed {sortColumn === 'tasksCompleted' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('successRate')}>
                  Success Rate {sortColumn === 'successRate' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('avgDuration')}>
                  Avg Duration {sortColumn === 'avgDuration' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('tokensIn')}>
                  Tokens In/Out {sortColumn === 'tokensIn' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('estCost')}>
                  Est. Cost {sortColumn === 'estCost' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
                <th className="px-4 py-2 cursor-pointer" onClick={() => handleSort('errors')}>
                  Errors {sortColumn === 'errors' && (sortDirection === 'asc' ? <ChevronUp className="inline w-4" /> : <ChevronDown className="inline w-4" />)}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedAgents.map((agent) => (
                <>
                  <tr
                    key={agent.name}
                    className="border-b border-zinc-800 cursor-pointer hover:bg-zinc-800"
                    onClick={() => setExpandedAgent(expandedAgent === agent.name ? null : agent.name)}
                  >
                    <td className="px-4 py-3 text-white">{agent.name}</td>
                    <td className="px-4 py-3">{agent.sessions}</td>
                    <td className="px-4 py-3">{agent.tasksCompleted}</td>
                    <td className="px-4 py-3">{formatPercentage(agent.successRate)}</td>
                    <td className="px-4 py-3">{formatDuration(agent.avgDuration)}</td>
                    <td className="px-4 py-3">{formatTokens(agent.tokensIn, agent.tokensOut)}</td>
                    <td className="px-4 py-3">{formatCost(agent.estCost)}</td>
                    <td className="px-4 py-3">{agent.errors}</td>
                  </tr>
                  {expandedAgent === agent.name && (
                    <tr>
                      <td colSpan={8} className="px-4 py-3 bg-zinc-800">
                        <div className="text-sm font-semibold mb-2">Task History</div>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-zinc-400">
                              <th>Status</th>
                              <th>Duration</th>
                              <th>Model</th>
                              <th>Tokens</th>
                            </tr>
                          </thead>
                          <tbody>
                            {agent.taskHistory.map((task) => (
                              <tr key={task.id}>
                                <td><StatusBadge status={task.status} /></td>
                                <td>{formatDuration(task.duration)}</td>
                                <td>{task.model}</td>
                                <td>{task.tokens}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tool Usage Heatmap */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <Tool className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-semibold text-white">Tool Usage Heatmap</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-zinc-400">
                <th className="pb-2">Agent</th>
                {TOOLS.map((tool) => (
                  <th key={tool} className="pb-2 text-center">{tool}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MOCK_AGENTS.map((agent) => (
                <tr key={agent.name}>
                  <td className="py-1">{agent.name}</td>
                  {TOOLS.map((tool) => (
                    <td key={tool} className="py-1">
                      <div className={cn('h-6 w-12 mx-auto rounded', getHeatmapColor(agent.toolUsage[tool] || 0, maxToolUsage))}>
                        <span className="flex items-center justify-center h-full text-white text-xs">{agent.toolUsage[tool] || 0}</span>
                      </div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Error Breakdown and Model Usage */}
      <div className="grid grid-cols-2 gap-4">
        {/* Error Breakdown */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-semibold text-white">Error Breakdown</span>
          </div>
          {MOCK_AGENTS.map((agent) => {
            const total = getTotalErrors(agent.errorBreakdown);
            let cumulative = 0;
            return (
              <div key={agent.name} className="mb-4">
                <div className="text-sm font-medium mb-1">{agent.name} ({total} errors)</div>
                <div className="h-4 bg-zinc-800 rounded overflow-hidden flex">
                  {Object.entries(agent.errorBreakdown).map(([type, count]) => {
                    if (count === 0) return null;
                    const width = (count / total) * 100;
                    cumulative += width;
                    return (
                      <div
                        key={type}
                        className={cn('h-full', getErrorColor(type as ErrorType))}
                        style={{ width: `${width}%` }}
                        title={`${type}: ${count}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Model Usage Distribution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <PieChart className="w-4 h-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Model Usage Distribution</span>
          </div>
          {MOCK_AGENTS.map((agent) => {
            const totalTokens = Object.values(agent.modelUsage).reduce((sum, { tokens }) => sum + tokens, 0);
            return (
              <div key={agent.name} className="mb-4">
                <div className="text-sm font-medium mb-1">{agent.name} ({(totalTokens / 1000).toFixed(1)}k tokens)</div>
                <div className="space-y-1">
                  {Object.entries(agent.modelUsage).map(([model, { tokens }]) => (
                    <div key={model} className="flex items-center gap-2">
                      <div className="w-24 text-xs text-zinc-400 truncate">{model}</div>
                      <div className="flex-1 h-2 bg-zinc-800 rounded">
                        <div className="h-full bg-green-500 rounded" style={{ width: `${(tokens / totalTokens) * 100}%` }} />
                      </div>
                      <div className="w-16 text-xs text-right">{(tokens / 1000).toFixed(1)}k</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

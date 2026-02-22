import React, { useState, useMemo } from 'react';

/**
 * AgentCapabilityMatrix.tsx
 * Purpose: Grid showing agents vs capabilities — what tools each agent has access to,
 * models it supports, avg latency, and health status.
 */

interface AgentCapability {
  id: string;
  name: string;
  role: string;
  status: 'online' | 'busy' | 'offline' | 'error';
  capabilities: {
    tools: {
      web_search: boolean;
      code_exec: boolean;
      file_read: boolean;
      file_write: boolean;
      browser: boolean;
      vision: boolean;
      voice: boolean;
    };
    models: {
      'claude-sonnet': boolean;
      'claude-haiku': boolean;
      'gpt-4o': boolean;
      'gemini-pro': boolean;
    };
  };
  metrics: {
    avgLatency: number;
    successRate: number;
    totalRuns: number;
  };
  description: string;
}

const MOCK_AGENTS: AgentCapability[] = [
  {
    id: 'discovery-agent',
    name: 'Discovery Agent',
    role: 'Researcher',
    status: 'online',
    description: 'Specializes in web research and data gathering.',
    capabilities: {
      tools: { web_search: true, code_exec: false, file_read: true, file_write: true, browser: true, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': false }
    },
    metrics: { avgLatency: 1240, successRate: 98.2, totalRuns: 1450 }
  },
  {
    id: 'summarizer',
    name: 'Summarizer',
    role: 'Utility',
    status: 'online',
    description: 'Condenses long documents into concise summaries.',
    capabilities: {
      tools: { web_search: false, code_exec: false, file_read: true, file_write: true, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': false, 'claude-haiku': true, 'gpt-4o': true, 'gemini-pro': false }
    },
    metrics: { avgLatency: 450, successRate: 99.8, totalRuns: 8900 }
  },
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    role: 'Developer',
    status: 'busy',
    description: 'Analyzes code for bugs and security vulnerabilities.',
    capabilities: {
      tools: { web_search: false, code_exec: true, file_read: true, file_write: false, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': false, 'gpt-4o': true, 'gemini-pro': false }
    },
    metrics: { avgLatency: 2800, successRate: 94.5, totalRuns: 320 }
  },
  {
    id: 'vision-analyst',
    name: 'Vision Analyst',
    role: 'Analyst',
    status: 'online',
    description: 'Extracts data and insights from images and videos.',
    capabilities: {
      tools: { web_search: false, code_exec: false, file_read: true, file_write: false, browser: false, vision: true, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': false, 'gpt-4o': true, 'gemini-pro': true }
    },
    metrics: { avgLatency: 1850, successRate: 96.1, totalRuns: 540 }
  },
  {
    id: 'voice-assistant',
    name: 'Voice Assistant',
    role: 'Support',
    status: 'offline',
    description: 'Handles voice-based interactions and transcriptions.',
    capabilities: {
      tools: { web_search: true, code_exec: false, file_read: false, file_write: false, browser: false, vision: false, voice: true },
      models: { 'claude-sonnet': false, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': true }
    },
    metrics: { avgLatency: 950, successRate: 88.4, totalRuns: 1100 }
  },
  {
    id: 'automation-bot',
    name: 'Automation Bot',
    role: 'Operations',
    status: 'online',
    description: 'Executes complex multi-step automation workflows.',
    capabilities: {
      tools: { web_search: true, code_exec: true, file_read: true, file_write: true, browser: true, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': true, 'gpt-4o': true, 'gemini-pro': true }
    },
    metrics: { avgLatency: 3200, successRate: 92.0, totalRuns: 210 }
  },
  {
    id: 'data-scientist',
    name: 'Data Scientist',
    role: 'Analyst',
    status: 'online',
    description: 'Performs statistical analysis and data visualization.',
    capabilities: {
      tools: { web_search: false, code_exec: true, file_read: true, file_write: true, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': false, 'gpt-4o': false, 'gemini-pro': true }
    },
    metrics: { avgLatency: 2100, successRate: 97.5, totalRuns: 850 }
  },
  {
    id: 'security-guard',
    name: 'Security Guard',
    role: 'Security',
    status: 'online',
    description: 'Monitors logs and detects suspicious activity.',
    capabilities: {
      tools: { web_search: false, code_exec: false, file_read: true, file_write: false, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': false, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': false }
    },
    metrics: { avgLatency: 120, successRate: 99.9, totalRuns: 45000 }
  },
  {
    id: 'translator',
    name: 'Translator',
    role: 'Utility',
    status: 'online',
    description: 'Translates text between 50+ languages.',
    capabilities: {
      tools: { web_search: false, code_exec: false, file_read: true, file_write: true, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': false, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': false }
    },
    metrics: { avgLatency: 350, successRate: 99.2, totalRuns: 12000 }
  },
  {
    id: 'technical-writer',
    name: 'Technical Writer',
    role: 'Support',
    status: 'busy',
    description: 'Generates documentation and API guides.',
    capabilities: {
      tools: { web_search: true, code_exec: false, file_read: true, file_write: true, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': false }
    },
    metrics: { avgLatency: 1500, successRate: 98.0, totalRuns: 760 }
  },
  {
    id: 'qa-tester',
    name: 'QA Tester',
    role: 'Developer',
    status: 'online',
    description: 'Runs automated tests and reports regressions.',
    capabilities: {
      tools: { web_search: false, code_exec: true, file_read: true, file_write: true, browser: true, vision: false, voice: false },
      models: { 'claude-sonnet': true, 'claude-haiku': false, 'gpt-4o': true, 'gemini-pro': false }
    },
    metrics: { avgLatency: 2400, successRate: 95.8, totalRuns: 1300 }
  },
  {
    id: 'archivist',
    name: 'Archivist',
    role: 'Utility',
    status: 'error',
    description: 'Indexes and categorizes historical data.',
    capabilities: {
      tools: { web_search: false, code_exec: false, file_read: true, file_write: true, browser: false, vision: false, voice: false },
      models: { 'claude-sonnet': false, 'claude-haiku': true, 'gpt-4o': false, 'gemini-pro': false }
    },
    metrics: { avgLatency: 800, successRate: 82.1, totalRuns: 500 }
  }
];

const TOOL_KEYS = ['web_search', 'code_exec', 'file_read', 'file_write', 'browser', 'vision', 'voice'] as const;
const MODEL_KEYS = ['claude-sonnet', 'claude-haiku', 'gpt-4o', 'gemini-pro'] as const;

export default function AgentCapabilityMatrix() {
  const [search, setSearch] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filteredAgents = useMemo(() => {
    return MOCK_AGENTS.filter(agent => {
      const matchesSearch = agent.name.toLowerCase().includes(search.toLowerCase()) || 
                           agent.role.toLowerCase().includes(search.toLowerCase());
      const matchesActive = !onlyActive || (agent.status === 'online' || agent.status === 'busy');
      return matchesSearch && matchesActive;
    });
  }, [search, onlyActive]);

  const toggleRow = (id: string) => {
    setExpandedRow(prev => prev === id ? null : id);
  };

  const StatusDot = ({ status }: { status: AgentCapability['status'] }) => {
    const colors = {
      online: 'bg-emerald-500',
      busy: 'bg-amber-500',
      offline: 'bg-gray-500',
      error: 'bg-rose-500'
    };
    return <span className={`h-2.5 w-2.5 rounded-full ${colors[status]} inline-block mr-2`} />;
  };

  const CheckOrDash = ({ value }: { value: boolean }) => (
    <span className={value ? 'text-emerald-400 font-bold' : 'text-gray-600'}>
      {value ? '✓' : '–'}
    </span>
  );

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-100 p-6 overflow-hidden">
      {/* Page Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Agent Capability Matrix</h1>
        <p className="text-gray-400 mt-1">Compare capabilities across your agent fleet</p>
      </header>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6 bg-gray-800/50 p-4 rounded-lg border border-gray-700">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">🔍</span>
            <input
              type="text"
              placeholder="Search agents or roles..."
              className="w-full bg-gray-900 border border-gray-700 rounded-md py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-gray-300">
            <input
              type="checkbox"
              className="w-4 h-4 rounded border-gray-700 bg-gray-900 text-blue-500 focus:ring-offset-gray-900"
              checked={onlyActive}
              onChange={(e) => setOnlyActive(e.target.checked)}
            />
            Show only active agents
          </label>
        </div>
        <div className="flex gap-2">
          {['Research', 'Utility', 'Developer', 'Support', 'Ops'].map(tag => (
            <button key={tag} className="px-3 py-1 text-xs rounded-full bg-gray-700 hover:bg-gray-600 transition-colors border border-gray-600">
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content: Table */}
      <div className="flex-1 overflow-auto bg-gray-800 rounded-xl border border-gray-700 shadow-xl">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="sticky top-0 z-20 bg-gray-800 shadow-sm">
            {/* Category Headers */}
            <tr>
              <th className="p-4 bg-gray-800 border-b border-gray-700 sticky left-0 z-30 w-64"></th>
              <th colSpan={7} className="p-2 text-center text-[10px] uppercase tracking-wider text-gray-500 border-b border-l border-gray-700">Tools</th>
              <th colSpan={4} className="p-2 text-center text-[10px] uppercase tracking-wider text-gray-500 border-b border-l border-gray-700">Models</th>
              <th colSpan={3} className="p-2 text-center text-[10px] uppercase tracking-wider text-gray-500 border-b border-l border-gray-700">Metrics</th>
            </tr>
            {/* Column Headers */}
            <tr className="text-xs font-medium text-gray-400 border-b border-gray-700">
              <th className="p-4 bg-gray-800 sticky left-0 z-30 border-r border-gray-700">Agent</th>
              {TOOL_KEYS.map(k => <th key={k} className="px-2 py-3 text-center min-w-[60px]">{k.replace('_', ' ')}</th>)}
              {MODEL_KEYS.map(k => <th key={k} className="px-2 py-3 text-center border-l border-gray-700/50 min-w-[80px]">{k.split('-')[1] || k}</th>)}
              <th className="px-4 py-3 text-right border-l border-gray-700/50 min-w-[100px]">Latency</th>
              <th className="px-4 py-3 text-right min-w-[80px]">Success</th>
              <th className="px-4 py-3 text-right min-w-[80px]">Runs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50 text-sm">
            {filteredAgents.map(agent => (
              <React.Fragment key={agent.id}>
                <tr 
                  className={`hover:bg-gray-700/30 transition-colors cursor-pointer ${expandedRow === agent.id ? 'bg-blue-500/5' : ''}`}
                  onClick={() => toggleRow(agent.id)}
                >
                  <td className="p-4 sticky left-0 z-10 bg-gray-800 border-r border-gray-700">
                    <div className="flex items-center">
                      <StatusDot status={agent.status} />
                      <div>
                        <div className="font-medium text-white">{agent.name}</div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 uppercase tracking-tighter">
                          {agent.role}
                        </span>
                      </div>
                    </div>
                  </td>
                  {TOOL_KEYS.map(k => <td key={k} className="p-2 text-center"><CheckOrDash value={agent.capabilities.tools[k]} /></td>)}
                  {MODEL_KEYS.map(k => <td key={k} className="p-2 text-center border-l border-gray-700/10"><CheckOrDash value={agent.capabilities.models[k]} /></td>)}
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-300 border-l border-gray-700/10">{agent.metrics.avgLatency}ms</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-emerald-400">{agent.metrics.successRate}%</td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-gray-400">{(agent.metrics.totalRuns / 1000).toFixed(1)}k</td>
                </tr>
                {/* Expandable Detail Panel */}
                {expandedRow === agent.id && (
                  <tr className="bg-gray-900/50">
                    <td colSpan={15} className="p-0 border-b border-gray-700">
                      <div className="p-6 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
                        <div className="flex items-start justify-between">
                          <div className="max-w-xl">
                            <h4 className="text-white font-medium mb-1">Capabilities Overview</h4>
                            <p className="text-gray-400 text-sm">{agent.description}</p>
                          </div>
                          <div className="flex gap-4">
                            <button className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm transition-colors">Configure Agent</button>
                            <button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded text-sm transition-colors border border-gray-600">View Logs</button>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-4 mt-2">
                          <div className="p-3 rounded bg-gray-800 border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase">System Load</div>
                            <div className="text-lg font-semibold">12%</div>
                          </div>
                          <div className="p-3 rounded bg-gray-800 border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase">Memory Usage</div>
                            <div className="text-lg font-semibold">256 MB</div>
                          </div>
                          <div className="p-3 rounded bg-gray-800 border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase">Tokens / Min</div>
                            <div className="text-lg font-semibold">4.2k</div>
                          </div>
                          <div className="p-3 rounded bg-gray-800 border border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase">Last Heartbeat</div>
                            <div className="text-lg font-semibold">2s ago</div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer / Legend */}
      <footer className="mt-6 flex items-center justify-between text-xs text-gray-500 border-t border-gray-800 pt-6">
        <div className="flex gap-6">
          <div className="flex items-center gap-2"><StatusDot status="online" /> Online</div>
          <div className="flex items-center gap-2"><StatusDot status="busy" /> Processing</div>
          <div className="flex items-center gap-2"><StatusDot status="offline" /> Offline</div>
          <div className="flex items-center gap-2"><StatusDot status="error" /> System Error</div>
        </div>
        <div className="flex gap-4">
          <span className="flex items-center gap-1"><span className="text-emerald-400 font-bold">✓</span> Enabled</span>
          <span className="flex items-center gap-1"><span>–</span> Restricted</span>
        </div>
      </footer>
    </div>
  );
}

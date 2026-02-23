import { useState } from 'react';
import {
  Bot,
  Wrench,
  Shield,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Search,
  Filter,
  ChevronDown,
  ChevronUp,
  X,
  Users,
  Key,
  Terminal,
  Globe,
  MessageSquare,
  Eye,
  Cpu,
  Brain,
  Zap,
  Activity,
  Clock,
  Lock,
  Unlock,
  Settings,
  RefreshCw,
  Plus,
  Minus,
  AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ============================================================================
// Types
// ============================================================================

type AgentId = 'luis' | 'quinn' | 'reed' | 'sam' | 'wes' | 'piper' | 'xavier' | 'stephan';

type ToolCategory = 'exec' | 'browser' | 'messaging' | 'filesystem' | 'code' | 'ai' | 'data';

type CapabilityStatus = 'enabled' | 'disabled' | 'degraded' | 'unavailable';

type PermissionLevel = 'none' | 'read' | 'write' | 'admin';

interface Agent {
  id: AgentId;
  name: string;
  role: string;
  status: 'active' | 'idle' | 'error' | 'offline';
  model: string;
  tools: string[];
  skills: string[];
  permissions: PermissionLevel[];
  lastActive: Date;
}

interface Tool {
  id: string;
  name: string;
  category: ToolCategory;
  description: string;
}

interface Skill {
  id: string;
  name: string;
  category: string;
}

interface CapabilityHealth {
  agentId: AgentId;
  type: 'missing_tool' | 'conflict' | 'degraded' | 'expired_permission';
  message: string;
  severity: 'critical' | 'warning' | 'info';
}

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_TOOLS: Tool[] = [
  { id: 'exec', name: 'Shell Exec', category: 'exec', description: 'Execute shell commands' },
  { id: 'browser', name: 'Browser Control', category: 'browser', description: 'Control web browser' },
  { id: 'read', name: 'File Read', category: 'filesystem', description: 'Read files from disk' },
  { id: 'write', name: 'File Write', category: 'filesystem', description: 'Write files to disk' },
  { id: 'message', name: 'Send Message', category: 'messaging', description: 'Send messages to channels' },
  { id: 'web_search', name: 'Web Search', category: 'ai', description: 'Search the web' },
  { id: 'web_fetch', name: 'Web Fetch', category: 'ai', description: 'Fetch web content' },
  { id: 'code', name: 'Code Execution', category: 'code', description: 'Run code snippets' },
  { id: 'tts', name: 'Text-to-Speech', category: 'ai', description: 'Convert text to speech' },
  { id: 'voice', name: 'Voice Call', category: 'messaging', description: 'Make voice calls' },
  { id: 'subagent', name: 'Subagent Spawn', category: 'ai', description: 'Spawn sub-agents' },
  { id: 'image', name: 'Image Analysis', category: 'ai', description: 'Analyze images' },
];

const MOCK_SKILLS: Skill[] = [
  { id: 'typescript', name: 'TypeScript', category: 'language' },
  { id: 'react', name: 'React', category: 'framework' },
  { id: 'tailwind', name: 'Tailwind CSS', category: 'framework' },
  { id: 'node', name: 'Node.js', category: 'runtime' },
  { id: 'python', name: 'Python', category: 'language' },
  { id: 'git', name: 'Git', category: 'tool' },
  { id: 'docker', name: 'Docker', category: 'tool' },
  { id: 'aws', name: 'AWS', category: 'cloud' },
  { id: 'sql', name: 'SQL', category: 'language' },
  { id: 'api', name: 'API Design', category: 'skill' },
];

const MOCK_AGENTS: Agent[] = [
  {
    id: 'luis',
    name: 'Luis',
    role: 'Principal UX Engineer',
    status: 'active',
    model: 'claude-opus-4-5',
    tools: ['exec', 'browser', 'read', 'write', 'message', 'web_search', 'web_fetch', 'subagent'],
    skills: ['typescript', 'react', 'tailwind', 'node', 'git', 'api'],
    permissions: ['admin', 'admin', 'admin', 'admin'],
    lastActive: new Date(Date.now() - 1000 * 60 * 5),
  },
  {
    id: 'quinn',
    name: 'Quinn',
    role: 'State Management Specialist',
    status: 'active',
    model: 'minimax-portal/MiniMax-M2.5',
    tools: ['exec', 'read', 'write', 'code', 'subagent'],
    skills: ['typescript', 'react', 'tailwind', 'node', 'python'],
    permissions: ['write', 'write', 'read', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 2),
  },
  {
    id: 'reed',
    name: 'Reed',
    role: 'Accessibility Specialist',
    status: 'idle',
    model: 'claude-sonnet-4',
    tools: ['read', 'code', 'web_fetch', 'image'],
    skills: ['typescript', 'react', 'tailwind', 'accessibility'],
    permissions: ['read', 'read', 'none', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: 'sam',
    name: 'Sam',
    role: 'Animation Specialist',
    status: 'active',
    model: 'claude-sonnet-4',
    tools: ['read', 'write', 'code', 'tts'],
    skills: ['typescript', 'react', 'tailwind', 'animation'],
    permissions: ['write', 'read', 'none', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 10),
  },
  {
    id: 'wes',
    name: 'Wes',
    role: 'Props & State Engineer',
    status: 'idle',
    model: 'claude-3-5-sonnet',
    tools: ['read', 'code'],
    skills: ['typescript', 'react', 'node', 'api'],
    permissions: ['read', 'none', 'none', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: 'piper',
    name: 'Piper',
    role: 'Interaction Patterns',
    status: 'active',
    model: 'claude-opus-4',
    tools: ['read', 'write', 'browser', 'web_search'],
    skills: ['typescript', 'react', 'tailwind', 'design-systems'],
    permissions: ['write', 'write', 'read', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 15),
  },
  {
    id: 'xavier',
    name: 'Xavier',
    role: 'System Architect',
    status: 'error',
    model: 'claude-opus-4-5',
    tools: ['exec', 'read', 'write', 'message', 'docker', 'aws'],
    skills: ['typescript', 'python', 'docker', 'aws', 'sql', 'api'],
    permissions: ['admin', 'admin', 'admin', 'admin'],
    lastActive: new Date(Date.now() - 1000 * 60 * 120),
  },
  {
    id: 'stephan',
    name: 'Stephan',
    role: 'Memory & Context',
    status: 'active',
    model: 'claude-3-5-sonnet',
    tools: ['read', 'write', 'message', 'subagent'],
    skills: ['typescript', 'python', 'sql', 'memory'],
    permissions: ['write', 'write', 'write', 'none'],
    lastActive: new Date(Date.now() - 1000 * 60 * 8),
  },
];

const MOCK_HEALTH_ALERTS: CapabilityHealth[] = [
  {
    agentId: 'xavier',
    type: 'expired_permission',
    message: 'AWS credentials expired 2 hours ago',
    severity: 'critical',
  },
  {
    agentId: 'reed',
    type: 'missing_tool',
    message: 'Missing browser tool - cannot perform visual testing',
    severity: 'warning',
  },
  {
    agentId: 'wes',
    type: 'degraded',
    message: 'Code execution throttled due to rate limits',
    severity: 'warning',
  },
  {
    agentId: 'quinn',
    type: 'conflict',
    message: 'Conflicting model versions with subagent tasks',
    severity: 'info',
  },
];

const PERMISSION_TYPES = [
  { id: 'exec', name: 'Shell Exec', icon: Terminal },
  { id: 'browser', name: 'Browser', icon: Globe },
  { id: 'message', name: 'Messaging', icon: MessageSquare },
  { id: 'data', name: 'Data Access', icon: Lock },
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatTimeAgo(date: Date): string {
  const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getStatusColor(status: Agent['status']): string {
  switch (status) {
    case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'idle': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'error': return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'offline': return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  }
}

function getCapabilityStatus(toolId: string, agentTools: string[]): CapabilityStatus {
  if (agentTools.includes(toolId)) return 'enabled';
  return 'disabled';
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color = 'text-zinc-400',
  subtext,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  subtext?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
      <div className="mt-0.5 p-2 bg-zinc-800 rounded-lg">
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div>
        <p className="text-xs text-zinc-400 font-medium uppercase tracking-wide mb-1">{label}</p>
        <span className="text-xl font-bold text-white">{value}</span>
        {subtext && <p className="text-xs text-zinc-500 mt-0.5">{subtext}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Agent['status'] }) {
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium border', getStatusColor(status))}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function CapabilityCell({
  status,
  toolName,
}: {
  status: CapabilityStatus;
  toolName: string;
}) {
  const icons = {
    enabled: <CheckCircle className="w-3 h-3 text-green-400" />,
    disabled: <XCircle className="w-3 h-3 text-zinc-600" />,
    degraded: <AlertTriangle className="w-3 h-3 text-amber-400" />,
    unavailable: <Minus className="w-3 h-3 text-red-400" />,
  };
  
  const bgColors = {
    enabled: 'bg-green-500/10',
    disabled: 'bg-zinc-800/50',
    degraded: 'bg-amber-500/10',
    unavailable: 'bg-red-500/10',
  };
  
  return (
    <div
      className={cn(
        'w-8 h-8 rounded flex items-center justify-center border',
        bgColors[status],
        status === 'enabled' ? 'border-green-500/30' :
        status === 'degraded' ? 'border-amber-500/30' :
        status === 'unavailable' ? 'border-red-500/30' :
        'border-zinc-700'
      )}
      title={`${toolName}: ${status}`}
    >
      {icons[status]}
    </div>
  );
}

function AgentCard({
  agent,
  isExpanded,
  onToggle,
  tools,
}: {
  agent: Agent;
  isExpanded: boolean;
  onToggle: () => void;
  tools: Tool[];
}) {
  const enabledTools = agent.tools.length;
  const enabledSkills = agent.skills.length;
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{agent.name}</span>
                <StatusBadge status={agent.status} />
              </div>
              <p className="text-xs text-zinc-400">{agent.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <div className="text-right">
              <p className="text-zinc-400 font-medium">{enabledTools} tools</p>
              <p>{enabledSkills} skills</p>
            </div>
            {isExpanded ? (
              <ChevronUp className="w-4 h-4 text-zinc-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-zinc-400" />
            )}
          </div>
        </div>
        
        <div className="mt-3 flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-400">{agent.model}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-400">{formatTimeAgo(agent.lastActive)}</span>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="border-t border-zinc-800 p-4 bg-zinc-800/30 space-y-4">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Tools Enabled</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.tools.map((toolId) => {
                const tool = tools.find((t) => t.id === toolId);
                return (
                  <span
                    key={toolId}
                    className="px-2 py-0.5 rounded bg-zinc-700 text-zinc-300 text-xs"
                  >
                    {tool?.name || toolId}
                  </span>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {agent.skills.map((skillId) => (
                <span
                  key={skillId}
                  className="px-2 py-0.5 rounded bg-violet-500/15 text-violet-300 text-xs border border-violet-500/30"
                >
                  {skillId}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PermissionBadge({ level }: { level: PermissionLevel }) {
  const styles: Record<PermissionLevel, string> = {
    none: 'bg-zinc-700/50 text-zinc-400',
    read: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    write: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    admin: 'bg-red-500/15 text-red-400 border-red-500/30',
  };
  
  const icons: Record<PermissionLevel, React.ElementType> = {
    none: X,
    read: Eye,
    write: Key,
    admin: Shield,
  };
  
  const Icon = icons[level];
  
  return (
    <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium border flex items-center gap-1', styles[level])}>
      <Icon className="w-3 h-3" />
      {level.charAt(0).toUpperCase() + level.slice(1)}
    </span>
  );
}

function PermissionPanel({
  agents,
}: {
  agents: Agent[];
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Permission Grants</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-zinc-800">
              <th className="text-left py-2 px-2 text-zinc-500 font-medium">Agent</th>
              {PERMISSION_TYPES.map((perm) => (
                <th key={perm.id} className="text-center py-2 px-2 text-zinc-500 font-medium">
                  <div className="flex items-center justify-center gap-1">
                    <perm.icon className="w-3 h-3" />
                    {perm.name}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <tr key={agent.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="py-2 px-2">
                  <span className="text-white font-medium">{agent.name}</span>
                </td>
                {agent.permissions.map((perm, idx) => (
                  <td key={idx} className="py-2 px-2 text-center">
                    <PermissionBadge level={perm} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HealthAlertsPanel({
  alerts,
  agents,
}: {
  alerts: CapabilityHealth[];
  agents: Agent[];
}) {
  const getSeverityStyles = (severity: CapabilityHealth['severity']) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-500/15 border-red-500/30 text-red-400';
      case 'warning':
        return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
      case 'info':
        return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
    }
  };
  
  const getSeverityIcon = (severity: CapabilityHealth['severity']) => {
    switch (severity) {
      case 'critical':
        return AlertCircle;
      case 'warning':
        return AlertTriangle;
      case 'info':
        return Activity;
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <AlertTriangle className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-semibold text-white">Capability Health</span>
        {alerts.length > 0 && (
          <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-xs">
            {alerts.length} issues
          </span>
        )}
      </div>
      
      {alerts.length === 0 ? (
        <div className="text-center py-4 text-zinc-500">
          <CheckCircle className="w-6 h-6 mx-auto mb-1 text-green-400" />
          <p className="text-sm">All capabilities healthy</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert, idx) => {
            const Icon = getSeverityIcon(alert.severity);
            const agent = agents.find((a) => a.id === alert.agentId);
            return (
              <div
                key={idx}
                className={cn(
                  'p-3 rounded-lg border flex items-start gap-2',
                  getSeverityStyles(alert.severity)
                )}
              >
                <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">{agent?.name || alert.agentId}</p>
                  <p className="text-xs opacity-80">{alert.message}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CapabilityMatrix({
  agents,
  tools,
}: {
  agents: Agent[];
  tools: Tool[];
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <Wrench className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Capability Matrix</span>
      </div>
      
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 px-2 text-zinc-500 font-medium min-w-[120px]">Agent</th>
            {tools.map((tool) => (
              <th key={tool.id} className="text-center py-2 px-1" title={tool.description}>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-zinc-400 text-[10px]">{tool.name.split(' ')[0]}</span>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={agent.status} />
                  <span className="text-white font-medium">{agent.name}</span>
                </div>
              </td>
              {tools.map((tool) => (
                <td key={tool.id} className="py-1 px-1">
                  <div className="flex justify-center">
                    <CapabilityCell
                      status={getCapabilityStatus(tool.id, agent.tools)}
                      toolName={tool.name}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="mt-4 flex items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle className="w-3 h-3 text-green-400" />
          <span>Enabled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="w-3 h-3 text-zinc-600" />
          <span>Disabled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          <span>Degraded</span>
        </div>
      </div>
    </div>
  );
}

function SkillMatrix({
  agents,
  skills,
}: {
  agents: Agent[];
  skills: Skill[];
}) {
  const getSkillStatus = (skillId: string, agentSkills: string[]): CapabilityStatus => {
    if (agentSkills.includes(skillId)) return 'enabled';
    return 'disabled';
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <Brain className="w-4 h-4 text-violet-400" />
        <span className="text-sm font-semibold text-white">Skill Coverage</span>
      </div>
      
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800">
            <th className="text-left py-2 px-2 text-zinc-500 font-medium min-w-[120px]">Agent</th>
            {skills.map((skill) => (
              <th key={skill.id} className="text-center py-2 px-1">
                <span className="text-zinc-400 text-[10px]" title={skill.category}>
                  {skill.name.length > 8 ? skill.name.slice(0, 8) + '..' : skill.name}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agents.map((agent) => (
            <tr key={agent.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
              <td className="py-2 px-2">
                <div className="flex items-center gap-2">
                  <StatusBadge status={agent.status} />
                  <span className="text-white font-medium">{agent.name}</span>
                </div>
              </td>
              {skills.map((skill) => (
                <td key={skill.id} className="py-1 px-1">
                  <div className="flex justify-center">
                    <CapabilityCell
                      status={getSkillStatus(skill.id, agent.skills)}
                      toolName={skill.name}
                    />
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilterBar({
  search,
  setSearch,
  filterAgent,
  setFilterAgent,
  filterCategory,
  setFilterCategory,
  filterPermission,
  setFilterPermission,
  agents,
  tools,
}: {
  search: string;
  setSearch: (v: string) => void;
  filterAgent: string;
  setFilterAgent: (v: string) => void;
  filterCategory: string;
  setFilterCategory: (v: string) => void;
  filterPermission: string;
  setFilterPermission: (v: string) => void;
  agents: Agent[];
  tools: Tool[];
}) {
  const categories = [...new Set(tools.map((t) => t.category))];
  
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 flex-wrap">
      <div className="flex-1 min-w-[200px] relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search agents, tools, skills..."
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-9 py-2 text-sm text-white placeholder-zinc-500"
        />
      </div>
      
      <select
        value={filterAgent}
        onChange={(e) => setFilterAgent(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white min-w-[140px]"
      >
        <option value="">All Agents</option>
        {agents.map((a) => (
          <option key={a.id} value={a.id}>{a.name}</option>
        ))}
      </select>
      
      <select
        value={filterCategory}
        onChange={(e) => setFilterCategory(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white min-w-[140px]"
      >
        <option value="">All Categories</option>
        {categories.map((cat) => (
          <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
        ))}
      </select>
      
      <select
        value={filterPermission}
        onChange={(e) => setFilterPermission(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white min-w-[140px]"
      >
        <option value="">All Permissions</option>
        <option value="admin">Admin</option>
        <option value="write">Write</option>
        <option value="read">Read</option>
        <option value="none">None</option>
      </select>
      
      {(search || filterAgent || filterCategory || filterPermission) && (
        <button
          onClick={() => {
            setSearch('');
            setFilterAgent('');
            setFilterCategory('');
            setFilterPermission('');
          }}
          className="flex items-center gap-1 px-3 py-2 rounded text-sm text-zinc-400 hover:text-white hover:bg-zinc-700"
        >
          <X className="w-4 h-4" />
          Clear
        </button>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function AgentCapabilityMatrix() {
  const [agents] = useState<Agent[]>(MOCK_AGENTS);
  const [tools] = useState<Tool[]>(MOCK_TOOLS);
  const [skills] = useState<Skill[]>(MOCK_SKILLS);
  const [healthAlerts] = useState<CapabilityHealth[]>(MOCK_HEALTH_ALERTS);
  
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterPermission, setFilterPermission] = useState('');
  
  const [expandedAgents, setExpandedAgents] = useState<Set<AgentId>>(new Set());
  const [activeTab, setActiveTab] = useState<'matrix' | 'skills'>('matrix');

  const toggleExpanded = (agentId: AgentId) => {
    setExpandedAgents((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  // Filter agents based on search and filters
  const filteredAgents = agents.filter((agent) => {
    const matchesSearch = !search || 
      agent.name.toLowerCase().includes(search.toLowerCase()) ||
      agent.role.toLowerCase().includes(search.toLowerCase()) ||
      agent.tools.some((t) => tools.find((tool) => tool.id === t && tool.name.toLowerCase().includes(search.toLowerCase()))) ||
      agent.skills.some((s) => s.toLowerCase().includes(search.toLowerCase()));
    
    const matchesAgent = !filterAgent || agent.id === filterAgent;
    
    const matchesCategory = !filterCategory || agent.tools.some((t) => {
      const tool = tools.find((tool) => tool.id === t);
      return tool?.category === filterCategory;
    });
    
    const matchesPermission = !filterPermission || agent.permissions.some((p) => p === filterPermission);
    
    return matchesSearch && matchesAgent && matchesCategory && matchesPermission;
  });

  // Calculate stats
  const totalAgents = agents.length;
  const activeAgents = agents.filter((a) => a.status === 'active').length;
  const totalTools = tools.length;
  const totalSkills = skills.length;
  const adminAgents = agents.filter((a) => a.permissions.includes('admin')).length;
  const criticalAlerts = healthAlerts.filter((a) => a.severity === 'critical').length;

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Bot className="w-6 h-6 text-violet-400" />
            Agent Capability Matrix
          </h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Tools, skills, and permission overview for all agents
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 text-sm font-medium">
            {filteredAgents.length} / {totalAgents} agents
          </span>
          <button className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-6 gap-4">
        <StatCard 
          label="Total Agents" 
          value={totalAgents} 
          icon={Users} 
          color="text-violet-400"
          subtext={`${activeAgents} active`}
        />
        <StatCard 
          label="Tools Tracked" 
          value={totalTools} 
          icon={Wrench} 
          color="text-blue-400"
        />
        <StatCard 
          label="Skills Loaded" 
          value={totalSkills} 
          icon={Brain} 
          color="text-green-400"
        />
        <StatCard 
          label="Admin Grants" 
          value={adminAgents} 
          icon={Shield} 
          color="text-red-400"
          subtext="elevated access"
        />
        <StatCard 
          label="Health Alerts" 
          value={criticalAlerts} 
          icon={AlertTriangle} 
          color={criticalAlerts > 0 ? "text-red-400" : "text-amber-400"}
          subtext={`${healthAlerts.length} total issues`}
        />
        <StatCard 
          label="Capability Score" 
          value="94%" 
          icon={Zap} 
          color="text-amber-400"
          subtext="system average"
        />
      </div>

      {/* Filter Bar */}
      <FilterBar
        search={search}
        setSearch={setSearch}
        filterAgent={filterAgent}
        setFilterAgent={setFilterAgent}
        filterCategory={filterCategory}
        setFilterCategory={setFilterCategory}
        filterPermission={filterPermission}
        setFilterPermission={setFilterPermission}
        agents={agents}
        tools={tools}
      />

      {/* Main Content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Agent Roster */}
        <div className="col-span-1 space-y-3">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-400" />
            Agent Roster
            <span className="ml-auto text-xs text-zinc-500">{filteredAgents.length} shown</span>
          </h2>
          {filteredAgents.length === 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-8 text-center text-zinc-500">
              <Bot className="w-12 h-12 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No agents match your filters</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filteredAgents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  isExpanded={expandedAgents.has(agent.id)}
                  onToggle={() => toggleExpanded(agent.id)}
                  tools={tools}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Matrix/Permissions/Health */}
        <div className="col-span-2 space-y-6">
          {/* Tab Switcher */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('matrix')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'matrix'
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              )}
            >
              <Wrench className="w-4 h-4 inline mr-2" />
              Tool Matrix
            </button>
            <button
              onClick={() => setActiveTab('skills')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                activeTab === 'skills'
                  ? 'bg-violet-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-white'
              )}
            >
              <Brain className="w-4 h-4 inline mr-2" />
              Skill Coverage
            </button>
          </div>

          {/* Matrix or Skills View */}
          {activeTab === 'matrix' ? (
            <CapabilityMatrix agents={filteredAgents} tools={tools} />
          ) : (
            <SkillMatrix agents={filteredAgents} skills={skills} />
          )}

          {/* Permission Panel */}
          <PermissionPanel agents={filteredAgents} />

          {/* Health Alerts */}
          <HealthAlertsPanel alerts={healthAlerts} agents={agents} />
        </div>
      </div>
    </div>
  );
}

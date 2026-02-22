import { useState, useMemo } from 'react';
import { Search, Eye, RotateCcw, Trash2, X, Clock, MessageSquare, Coins, Cpu } from 'lucide-react';
import { cn } from '../lib/utils';
import { MOCK_SESSIONS, formatRelativeTime, MOCK_AGENTS } from '../mock-data';
import type { Session, SessionStatus } from '../types';

type StatusFilter = 'all' | SessionStatus;

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${Math.floor(tokens / 1000)}K`;
  return tokens.toString();
}

function truncateKey(key: string): string {
  if (key.length <= 24) return key;
  return `${key.slice(0, 12)}...${key.slice(-9)}`;
}

export default function SessionExplorer() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const totalCount = MOCK_SESSIONS.length;
  const activeCount = MOCK_SESSIONS.filter(s => s.status === 'active').length;

  const filteredSessions = useMemo(() => {
    return MOCK_SESSIONS.filter(session => {
      if (statusFilter !== 'all' && session.status !== statusFilter) return false;
      if (agentFilter !== 'all' && session.agentId !== agentFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          session.key.toLowerCase().includes(query) ||
          (session.agentName?.toLowerCase().includes(query)) ||
          (session.label?.toLowerCase().includes(query))
        );
      }
      return true;
    });
  }, [statusFilter, agentFilter, searchQuery]);

  return (
    <div className="bg-gray-950 min-h-screen text-white">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <span className="text-gray-400">{totalCount} total</span>
          <span className="bg-green-600 text-white text-xs px-2 py-0.5 rounded-full">
            {activeCount} active
          </span>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Status Filter */}
          <div className="flex bg-gray-900 rounded-lg p-1">
            {(['all', 'active', 'idle', 'completed'] as StatusFilter[]).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md capitalize transition-colors',
                  statusFilter === status
                    ? 'bg-gray-800 text-white'
                    : 'text-gray-400 hover:text-white'
                )}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Agent Filter */}
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="bg-gray-900 border border-gray-800 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-600"
          >
            <option value="all">All Agents</option>
            {MOCK_AGENTS.map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.emoji} {agent.name}
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
        </div>

        {/* Sessions Table */}
        {filteredSessions.length > 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-800 text-left text-sm text-gray-400">
                  <th className="px-4 py-3 font-medium">Session Key</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Messages</th>
                  <th className="px-4 py-3 font-medium text-right">Tokens</th>
                  <th className="px-4 py-3 font-medium text-right">Cost</th>
                  <th className="px-4 py-3 font-medium">Last Active</th>
                  <th className="px-4 py-3 font-medium text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map(session => (
                  <tr
                    key={session.key}
                    className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-sm text-violet-400 cursor-pointer hover:underline" onClick={() => setSelectedSession(session)}>
                        {truncateKey(session.key)}
                      </span>
                      {session.label && (
                        <div className="text-xs text-gray-500 mt-0.5">{session.label}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2">
                        <span>{session.agentEmoji}</span>
                        <span className="text-sm">{session.agentName}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={session.status} />
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {session.messageCount}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {session.tokenUsage ? formatTokens(session.tokenUsage.total) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-300">
                      {session.cost !== undefined ? `$${session.cost.toFixed(2)}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {formatRelativeTime(session.lastActivity)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => setSelectedSession(session)}
                          className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400 hover:text-white transition-colors"
                          title="Reset"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-gray-700 rounded-md text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No sessions yet</p>
            <p className="text-gray-500 text-sm mt-1">Start a conversation with an agent</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: SessionStatus }) {
  const colors: Record<SessionStatus, string> = {
    active: 'bg-green-500',
    idle: 'bg-yellow-500',
    completed: 'bg-blue-500',
    error: 'bg-red-500',
  };

  const labels: Record<SessionStatus, string> = {
    active: 'Active',
    idle: 'Idle',
    completed: 'Completed',
    error: 'Error',
  };

  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('w-2 h-2 rounded-full', colors[status])} />
      <span className="text-sm text-gray-300">{labels[status]}</span>
    </span>
  );
}

interface SessionDetailPanelProps {
  session: Session;
  onClose: () => void;
}

function SessionDetailPanel({ session, onClose }: SessionDetailPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-gray-900 border-l border-gray-800 z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Session Details</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-800 rounded-md text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Session Key */}
          <div className="mb-4">
            <label className="text-xs text-gray-500 uppercase tracking-wide">Session Key</label>
            <div className="font-mono text-sm text-violet-400 mt-1 break-all bg-gray-800 p-2 rounded-lg">
              {session.key}
            </div>
          </div>

          {/* Agent Info */}
          <div className="mb-4 flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
            <span className="text-2xl">{session.agentEmoji}</span>
            <div>
              <div className="font-medium">{session.agentName}</div>
              <div className="text-xs text-gray-400">Agent ID: {session.agentId}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <MessageSquare className="w-3 h-3" />
                Messages
              </div>
              <div className="text-xl font-semibold">{session.messageCount}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                <Coins className="w-3 h-3" />
                Cost
              </div>
              <div className="text-xl font-semibold">
                {session.cost !== undefined ? `$${session.cost.toFixed(2)}` : '—'}
              </div>
            </div>
          </div>

          {/* Token Breakdown */}
          {session.tokenUsage && (
            <div className="mb-6">
              <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Token Usage</label>
              <div className="bg-gray-800 rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Cpu className="w-3 h-3" /> Input
                  </span>
                  <span>{formatTokens(session.tokenUsage.input)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400 flex items-center gap-2">
                    <Cpu className="w-3 h-3" /> Output
                  </span>
                  <span>{formatTokens(session.tokenUsage.output)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                  <span className="text-gray-300">Total</span>
                  <span className="font-medium">{formatTokens(session.tokenUsage.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-6">
            <label className="text-xs text-gray-500 uppercase tracking-wide mb-2 block">Timeline</label>
            <div className="space-y-2">
              <TimelineItem
                role="user"
                timestamp={session.createdAt}
                content="Session started"
              />
              <TimelineItem
                role="assistant"
                timestamp={session.lastActivity}
                content="Last activity recorded"
              />
            </div>
          </div>

          {/* Danger Buttons */}
          <div className="pt-4 border-t border-gray-800 space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors">
              <RotateCcw className="w-4 h-4" />
              Reset Session
            </button>
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-600/10 hover:bg-red-600/20 text-red-400 rounded-lg transition-colors border border-red-600/30">
              <Trash2 className="w-4 h-4" />
              Delete Session
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface TimelineItemProps {
  role: 'user' | 'assistant' | 'system';
  timestamp: string;
  content: string;
}

function TimelineItem({ role, timestamp, content }: TimelineItemProps) {
  const roleColors: Record<string, string> = {
    user: 'bg-blue-500',
    assistant: 'bg-violet-500',
    system: 'bg-gray-500',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('w-2 h-2 rounded-full', roleColors[role])} />
        <div className="w-0.5 flex-1 bg-gray-700 mt-1" />
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span className="capitalize">{role}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(timestamp)}
          </span>
        </div>
        <p className="text-sm text-gray-300 line-clamp-2">{content}</p>
      </div>
    </div>
  );
}

import { useState, useMemo } from 'react';
import { Search, Eye, RotateCcw, Trash2, X, Clock, MessageSquare, Coins, Cpu, ExternalLink } from 'lucide-react';
import { cn } from '../lib/utils';
import { MOCK_SESSIONS, formatRelativeTime, MOCK_AGENTS } from '../mock-data';
import type { Session, SessionStatus } from '../types';

type StatusFilter = 'all' | SessionStatus;

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {return `${(tokens / 1000000).toFixed(1)}M`;}
  if (tokens >= 1000) {return `${Math.floor(tokens / 1000)}K`;}
  return tokens.toString();
}

function truncateKey(key: string): string {
  if (key.length <= 24) {return key;}
  return `${key.slice(0, 12)}...${key.slice(-9)}`;
}

function TokenIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn('w-4 h-4', className)} aria-hidden="true">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M8 4v8M6 6h4M6 10h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BurnRateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" className={cn('w-4 h-4', className)} aria-hidden="true">
      <path d="M8 2C8 2 3 7 3 10a5 5 0 0 0 10 0c0-3-5-8-5-8Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M8 7c0 0-2 2-2 3.5a2 2 0 0 0 4 0C10 9 8 7 8 7Z" fill="currentColor" opacity="0.3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

function tokenColorClass(total: number): string {
  if (total === 0) return 'bg-red-600/15 text-red-400 border-red-600/30';
  if (total >= 160000) return 'bg-red-600/15 text-red-400 border-red-600/30';
  if (total >= 100000) return 'bg-orange-600/15 text-orange-400 border-orange-600/30';
  if (total >= 50000) return 'bg-amber-600/15 text-amber-400 border-amber-600/30';
  if (total >= 10000) return 'bg-blue-600/15 text-blue-400 border-blue-600/30';
  return 'bg-green-600/15 text-green-400 border-green-600/30';
}

function costColorClass(cost: number): string {
  if (cost > 5) return 'text-red-400';
  if (cost > 2) return 'text-orange-400';
  if (cost > 1) return 'text-amber-400';
  if (cost > 0.5) return 'text-blue-400';
  if (cost > 0.2) return 'text-[var(--color-text-primary)]';
  return 'text-green-400';
}

export default function SessionExplorer({ navigate }: { navigate?: (viewId: string) => void }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  const totalCount = MOCK_SESSIONS.length;
  const activeCount = MOCK_SESSIONS.filter(s => s.status === 'active').length;

  const filteredSessions = useMemo(() => {
    return MOCK_SESSIONS.filter(session => {
      if (statusFilter !== 'all' && session.status !== statusFilter) {return false;}
      if (agentFilter !== 'all' && session.agentId !== agentFilter) {return false;}
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
    <div className="bg-[var(--color-surface-0)] min-h-screen text-[var(--color-text-primary)]">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <h1 className="text-2xl font-bold">Sessions</h1>
          <span className="bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] text-xs px-2.5 py-0.5 rounded-full">
            {totalCount} total
          </span>
          <span className="bg-green-600/15 text-green-400 text-xs px-2.5 py-0.5 rounded-full border border-green-600/30">
            {activeCount} active
          </span>
        </div>

        {/* Filters Bar */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          {/* Status Filter */}
          <div className="flex bg-[var(--color-surface-1)] rounded-lg p-1">
            {(['all', 'active', 'idle', 'completed'] as StatusFilter[]).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  'px-3 py-1.5 text-sm rounded-md capitalize transition-colors',
                  statusFilter === status
                    ? 'bg-[var(--color-surface-2)] text-[var(--color-text-primary)]'
                    : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
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
            className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-violet-600"
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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <input
              type="text"
              aria-label="Search sessions"
              placeholder="Search sessions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-lg pl-9 pr-4 py-1.5 text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:ring-2 focus:ring-violet-600"
            />
          </div>
        </div>

        {/* Sessions Table */}
        {filteredSessions.length > 0 ? (
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-sm text-[var(--color-text-secondary)]">
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
                    className="border-b border-[var(--color-border)]/50 hover:bg-[var(--color-surface-2)]/30 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className="font-mono text-sm text-primary cursor-pointer hover:underline text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 rounded"
                        onClick={() => setSelectedSession(session)}
                        aria-label={`View session details for ${session.key}`}
                      >
                        {truncateKey(session.key)}
                      </button>
                      {session.label && (
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{session.label}</div>
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
                    <td className="px-4 py-3 text-right">
                      <span className="inline-flex items-center gap-1.5 text-sm text-[var(--color-text-primary)]">
                        <MessageSquare className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                        {session.messageCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.tokenUsage ? (
                        <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium', tokenColorClass(session.tokenUsage.total))}>
                          <TokenIcon className="w-3 h-3" />
                          {formatTokens(session.tokenUsage.total)}
                        </span>
                      ) : <span className="text-sm text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {session.cost !== undefined ? (
                        <span className={cn('text-sm font-medium', costColorClass(session.cost))}>
                          ${session.cost.toFixed(2)}
                        </span>
                      ) : <span className="text-sm text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                      {formatRelativeTime(session.lastActivity)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {navigate && (
                          <button
                            onClick={() => navigate(`agent-session:${session.agentId}:${session.key}`)}
                            className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-secondary)] hover:text-primary transition-colors"
                            title="Open Agent Session"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedSession(session)}
                          className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                          title="Reset"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          className="p-1.5 hover:bg-[var(--color-surface-3)] rounded-md text-[var(--color-text-secondary)] hover:text-red-400 transition-colors"
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
          <div className="bg-[var(--color-surface-1)] border border-[var(--color-border)] rounded-xl p-12 text-center">
            <MessageSquare className="w-12 h-12 text-[var(--color-text-muted)] mx-auto mb-4" />
            <p className="text-[var(--color-text-secondary)] text-lg">No sessions yet</p>
            <p className="text-[var(--color-text-muted)] text-sm mt-1">Start a conversation with an agent</p>
          </div>
        )}
      </div>

      {/* Detail Panel */}
      {selectedSession && (
        <SessionDetailPanel
          session={selectedSession}
          onClose={() => setSelectedSession(null)}
          navigate={navigate}
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
      <span className="text-sm text-[var(--color-text-primary)]">{labels[status]}</span>
    </span>
  );
}

interface SessionDetailPanelProps {
  session: Session;
  onClose: () => void;
  navigate?: (viewId: string) => void;
}

function SessionDetailPanel({ session, onClose, navigate }: SessionDetailPanelProps) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-[var(--color-surface-1)] border-l border-[var(--color-border)] z-50 overflow-y-auto">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Session Details</h2>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-[var(--color-surface-2)] rounded-md text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Session Key */}
          <div className="mb-4">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide">Session Key</label>
            <div className="font-mono text-sm text-primary mt-1 break-all bg-[var(--color-surface-2)] p-2 rounded-lg">
              {session.key}
            </div>
          </div>

          {/* Agent Info */}
          <div className="mb-4 flex items-center gap-3 p-3 bg-[var(--color-surface-2)] rounded-lg">
            <span className="text-2xl">{session.agentEmoji}</span>
            <div>
              <div className="font-medium">{session.agentName}</div>
              <div className="text-xs text-[var(--color-text-secondary)]">Agent ID: {session.agentId}</div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-xs mb-1">
                <MessageSquare className="w-3 h-3" />
                Messages
              </div>
              <div className="text-xl font-semibold">{session.messageCount}</div>
            </div>
            <div className="bg-[var(--color-surface-2)] rounded-lg p-3">
              <div className="flex items-center gap-2 text-[var(--color-text-secondary)] text-xs mb-1">
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
              <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Token Usage</label>
              <div className="bg-[var(--color-surface-2)] rounded-lg p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                    <Cpu className="w-3 h-3" /> Input
                  </span>
                  <span>{formatTokens(session.tokenUsage.input)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[var(--color-text-secondary)] flex items-center gap-2">
                    <Cpu className="w-3 h-3" /> Output
                  </span>
                  <span>{formatTokens(session.tokenUsage.output)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-[var(--color-border)]">
                  <span className="text-[var(--color-text-primary)] flex items-center gap-2">
                    <TokenIcon className="w-3 h-3" /> Total
                  </span>
                  <span className={cn('inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium', tokenColorClass(session.tokenUsage.total))}>
                    {formatTokens(session.tokenUsage.total)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="mb-6">
            <label className="text-xs text-[var(--color-text-muted)] uppercase tracking-wide mb-2 block">Timeline</label>
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

          {/* Open Session */}
          {navigate && (
            <button
              onClick={() => navigate(`agent-session:${session.agentId}:${session.key}`)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary text-white rounded-lg transition-colors mb-4 font-medium"
            >
              <ExternalLink className="w-4 h-4" />
              Open Agent Session
            </button>
          )}

          {/* Danger Buttons */}
          <div className="pt-4 border-t border-[var(--color-border)] space-y-2">
            <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text-primary)] rounded-lg transition-colors">
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
    assistant: 'bg-primary',
    system: 'bg-[var(--color-surface-3)]',
  };

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={cn('w-2 h-2 rounded-full', roleColors[role])} />
        <div className="w-0.5 flex-1 bg-[var(--color-surface-3)] mt-1" />
      </div>
      <div className="flex-1 pb-3">
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)] mb-1">
          <span className="capitalize">{role}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(timestamp)}
          </span>
        </div>
        <p className="text-sm text-[var(--color-text-primary)] line-clamp-2">{content}</p>
      </div>
    </div>
  );
}

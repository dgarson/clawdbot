import React, { useState } from 'react';
import { GitBranch, CheckCircle, Clock, XCircle, AlertTriangle, Plus, Filter, ChevronDown, User, Calendar, Tag } from 'lucide-react';
import { cn } from '../lib/utils';

type ChangeStatus = 'pending' | 'approved' | 'in-progress' | 'completed' | 'rejected';
type ChangePriority = 'low' | 'medium' | 'high' | 'critical';
type ChangeType = 'standard' | 'normal' | 'emergency';

interface Change {
  id: string;
  title: string;
  description: string;
  status: ChangeStatus;
  priority: ChangePriority;
  type: ChangeType;
  requester: string;
  assignee: string;
  scheduledDate: string;
  impactedSystems: string[];
  approvals: { name: string; status: 'pending' | 'approved' | 'rejected'; date?: string }[];
  riskLevel: 'low' | 'medium' | 'high';
  created: string;
}

const MOCK_CHANGES: Change[] = [
  {
    id: 'CHG-001',
    title: 'Gateway WebSocket Protocol Upgrade',
    description: 'Upgrade WS protocol from v1 to v2 for improved performance and connection stability.',
    status: 'approved',
    priority: 'high',
    type: 'normal',
    requester: 'Tim',
    assignee: 'Roman',
    scheduledDate: '2026-02-24T10:00:00Z',
    impactedSystems: ['Gateway', 'Agent Sessions', 'WebSocket Relay'],
    approvals: [
      { name: 'Xavier', status: 'approved', date: '2026-02-22T08:00:00Z' },
      { name: 'David', status: 'pending' },
    ],
    riskLevel: 'medium',
    created: '2026-02-21T14:00:00Z',
  },
  {
    id: 'CHG-002',
    title: 'Horizon UI Production Deployment',
    description: 'Deploy the Horizon UI (260-view operator dashboard) to production environment.',
    status: 'pending',
    priority: 'critical',
    type: 'normal',
    requester: 'Luis',
    assignee: 'Tim',
    scheduledDate: '2026-02-23T06:00:00Z',
    impactedSystems: ['apps/web-next', 'CDN', 'Nginx'],
    approvals: [
      { name: 'Xavier', status: 'pending' },
      { name: 'Tim', status: 'pending' },
    ],
    riskLevel: 'low',
    created: '2026-02-22T07:00:00Z',
  },
  {
    id: 'CHG-003',
    title: 'UTEE Canary Rollout — 5%',
    description: 'Expand UTEE to 5% of traffic after Phase 1 stabilization. Monitor error rates.',
    status: 'in-progress',
    priority: 'high',
    type: 'standard',
    requester: 'Sandy',
    assignee: 'Sandy',
    scheduledDate: '2026-02-23T14:00:00Z',
    impactedSystems: ['Agent Runtime', 'Tool Execution'],
    approvals: [
      { name: 'Tim', status: 'approved', date: '2026-02-22T06:00:00Z' },
    ],
    riskLevel: 'medium',
    created: '2026-02-21T20:00:00Z',
  },
  {
    id: 'CHG-004',
    title: 'Emergency: Gateway Rate Limit Patch',
    description: 'Apply hotfix for rate limit bypass vulnerability discovered in audit.',
    status: 'completed',
    priority: 'critical',
    type: 'emergency',
    requester: 'Xavier',
    assignee: 'Tim',
    scheduledDate: '2026-02-21T22:00:00Z',
    impactedSystems: ['Gateway', 'Rate Limiter', 'Auth Layer'],
    approvals: [
      { name: 'Xavier', status: 'approved', date: '2026-02-21T21:55:00Z' },
    ],
    riskLevel: 'high',
    created: '2026-02-21T21:00:00Z',
  },
  {
    id: 'CHG-005',
    title: 'A2A Protocol Integration',
    description: 'Enable Agent-to-Agent protocol for cross-squad delegation and communication.',
    status: 'pending',
    priority: 'high',
    type: 'normal',
    requester: 'Tim',
    assignee: 'Tim',
    scheduledDate: '2026-02-25T10:00:00Z',
    impactedSystems: ['Agent Runtime', 'Session Manager', 'Audit Log'],
    approvals: [
      { name: 'Xavier', status: 'pending' },
      { name: 'David', status: 'pending' },
    ],
    riskLevel: 'high',
    created: '2026-02-22T00:00:00Z',
  },
  {
    id: 'CHG-006',
    title: 'Discovery System Cron Enablement',
    description: 'Enable 17 discovery cron jobs for Monday Feb 23 first run.',
    status: 'approved',
    priority: 'medium',
    type: 'standard',
    requester: 'Julia',
    assignee: 'Julia',
    scheduledDate: '2026-02-23T10:00:00Z',
    impactedSystems: ['Cron Scheduler', 'Discovery Agents'],
    approvals: [
      { name: 'Amadeus', status: 'approved', date: '2026-02-21T20:00:00Z' },
    ],
    riskLevel: 'low',
    created: '2026-02-21T18:00:00Z',
  },
];

const STATUS_CONFIG: Record<ChangeStatus, { label: string; color: string; icon: React.FC<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20', icon: Clock },
  approved: { label: 'Approved', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: CheckCircle },
  'in-progress': { label: 'In Progress', color: 'text-blue-400 bg-blue-400/10 border-blue-400/20', icon: GitBranch },
  completed: { label: 'Completed', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'text-red-400 bg-red-400/10 border-red-400/20', icon: XCircle },
};

const PRIORITY_CONFIG: Record<ChangePriority, string> = {
  low: 'text-zinc-400 bg-zinc-400/10',
  medium: 'text-amber-400 bg-amber-400/10',
  high: 'text-orange-400 bg-orange-400/10',
  critical: 'text-red-400 bg-red-400/10',
};

const TYPE_CONFIG: Record<ChangeType, string> = {
  standard: 'text-zinc-300 bg-zinc-700',
  normal: 'text-blue-300 bg-blue-900/40',
  emergency: 'text-red-300 bg-red-900/40',
};

const RISK_CONFIG: Record<string, string> = {
  low: 'text-emerald-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ChangeCardProps {
  change: Change;
  selected: boolean;
  onSelect: () => void;
}

function ChangeCard({ change, selected, onSelect }: ChangeCardProps) {
  const statusCfg = STATUS_CONFIG[change.status];
  const StatusIcon = statusCfg.icon;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left p-4 border rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500',
        selected
          ? 'border-violet-500 bg-violet-500/5'
          : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-zinc-500">{change.id}</span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', TYPE_CONFIG[change.type])}>
              {change.type.toUpperCase()}
            </span>
            <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', PRIORITY_CONFIG[change.priority])}>
              {change.priority}
            </span>
          </div>
          <p className="text-sm font-medium text-zinc-100 truncate">{change.title}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {change.assignee}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatDate(change.scheduledDate)}
            </span>
          </div>
        </div>
        <span className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg border font-medium shrink-0', statusCfg.color)}>
          <StatusIcon className="w-3 h-3" />
          {statusCfg.label}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {change.impactedSystems.slice(0, 3).map((sys) => (
          <span key={sys} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">
            {sys}
          </span>
        ))}
        {change.impactedSystems.length > 3 && (
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
            +{change.impactedSystems.length - 3}
          </span>
        )}
      </div>
    </button>
  );
}

export default function ChangeManagementBoard() {
  const [selected, setSelected] = useState<Change | null>(null);
  const [statusFilter, setStatusFilter] = useState<ChangeStatus | 'all'>('all');
  const [search, setSearch] = useState('');

  const statuses: Array<ChangeStatus | 'all'> = ['all', 'pending', 'approved', 'in-progress', 'completed', 'rejected'];

  const filtered = MOCK_CHANGES.filter((c) => {
    const matchesStatus = statusFilter === 'all' || c.status === statusFilter;
    const matchesSearch =
      !search ||
      c.title.toLowerCase().includes(search.toLowerCase()) ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.assignee.toLowerCase().includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const stats = {
    pending: MOCK_CHANGES.filter((c) => c.status === 'pending').length,
    approved: MOCK_CHANGES.filter((c) => c.status === 'approved').length,
    inProgress: MOCK_CHANGES.filter((c) => c.status === 'in-progress').length,
    completed: MOCK_CHANGES.filter((c) => c.status === 'completed').length,
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100">
      {/* Left panel */}
      <div className="w-[380px] shrink-0 border-r border-zinc-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-violet-400" />
              <h1 className="text-sm font-semibold text-zinc-100">Change Management</h1>
            </div>
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              <Plus className="w-3 h-3" />
              New Change
            </button>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-4 gap-2 mb-3">
            {[
              { label: 'Pending', value: stats.pending, color: 'text-amber-400' },
              { label: 'Approved', value: stats.approved, color: 'text-emerald-400' },
              { label: 'Active', value: stats.inProgress, color: 'text-blue-400' },
              { label: 'Done', value: stats.completed, color: 'text-zinc-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center p-2 bg-zinc-900 rounded-lg border border-zinc-800">
                <p className={cn('text-lg font-bold', color)}>{value}</p>
                <p className="text-[10px] text-zinc-500">{label}</p>
              </div>
            ))}
          </div>

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search changes..."
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500 mb-2"
          />

          {/* Status filters */}
          <div className="flex gap-1 flex-wrap">
            {statuses.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={cn(
                  'text-[10px] px-2 py-1 rounded-lg font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500',
                  statusFilter === s
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                )}
              >
                {s === 'all' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        {/* Change list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filtered.map((change) => (
            <ChangeCard
              key={change.id}
              change={change}
              selected={selected?.id === change.id}
              onSelect={() => setSelected(change)}
            />
          ))}
          {filtered.length === 0 && (
            <div className="text-center py-12 text-zinc-500">
              <Filter className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No changes match filters</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="p-6 max-w-3xl">
            {/* Header */}
            <div className="flex items-start justify-between mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-mono text-zinc-500">{selected.id}</span>
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded', TYPE_CONFIG[selected.type])}>
                    {selected.type.toUpperCase()}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-zinc-100">{selected.title}</h2>
              </div>
              <span className={cn(
                'flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-xl border font-medium',
                STATUS_CONFIG[selected.status].color
              )}>
                {React.createElement(STATUS_CONFIG[selected.status].icon, { className: 'w-3.5 h-3.5' })}
                {STATUS_CONFIG[selected.status].label}
              </span>
            </div>

            <p className="text-sm text-zinc-300 mb-6 leading-relaxed">{selected.description}</p>

            {/* Meta grid */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              {[
                { label: 'Priority', value: selected.priority, cls: PRIORITY_CONFIG[selected.priority] },
                { label: 'Risk Level', value: selected.riskLevel, cls: RISK_CONFIG[selected.riskLevel] },
                { label: 'Requester', value: selected.requester, cls: 'text-zinc-300' },
                { label: 'Assignee', value: selected.assignee, cls: 'text-zinc-300' },
                { label: 'Scheduled', value: formatDate(selected.scheduledDate), cls: 'text-zinc-300' },
                { label: 'Created', value: formatDate(selected.created), cls: 'text-zinc-300' },
              ].map(({ label, value, cls }) => (
                <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3">
                  <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
                  <p className={cn('text-sm font-medium capitalize', cls)}>{value}</p>
                </div>
              ))}
            </div>

            {/* Impacted Systems */}
            <div className="mb-6">
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Tag className="w-3 h-3" />
                Impacted Systems
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.impactedSystems.map((sys) => (
                  <span key={sys} className="text-xs px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg">
                    {sys}
                  </span>
                ))}
              </div>
            </div>

            {/* Approvals */}
            <div>
              <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Approvals ({selected.approvals.filter((a) => a.status === 'approved').length}/{selected.approvals.length})
              </p>
              <div className="space-y-2">
                {selected.approvals.map((approval) => (
                  <div key={approval.name} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-violet-600/20 border border-violet-600/30 flex items-center justify-center text-xs font-medium text-violet-300">
                        {approval.name[0]}
                      </div>
                      <span className="text-sm text-zinc-200">{approval.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {approval.date && (
                        <span className="text-xs text-zinc-500">{formatDate(approval.date)}</span>
                      )}
                      <span className={cn(
                        'flex items-center gap-1 text-xs px-2 py-0.5 rounded-lg font-medium',
                        approval.status === 'approved'
                          ? 'text-emerald-400 bg-emerald-400/10'
                          : approval.status === 'rejected'
                          ? 'text-red-400 bg-red-400/10'
                          : 'text-amber-400 bg-amber-400/10'
                      )}>
                        {approval.status === 'approved' ? (
                          <CheckCircle className="w-3 h-3" />
                        ) : approval.status === 'rejected' ? (
                          <XCircle className="w-3 h-3" />
                        ) : (
                          <Clock className="w-3 h-3" />
                        )}
                        {approval.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="mt-6 flex gap-3">
              {selected.status === 'pending' && (
                <>
                  <button type="button" className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
                    Approve
                  </button>
                  <button type="button" className="flex-1 py-2.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm font-medium rounded-lg border border-red-600/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500">
                    Reject
                  </button>
                </>
              )}
              {selected.status === 'approved' && (
                <button type="button" className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
                  Start Implementation
                </button>
              )}
              {selected.status === 'in-progress' && (
                <button type="button" className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">
                  Mark Complete
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-600">
            <div className="text-center">
              <GitBranch className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Select a change request to view details</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

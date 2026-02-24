import React, { useState, useMemo } from 'react';
import { useMissionControl } from '../hooks';
import type { 
  ActiveSession, 
  MissionControlToolCall, 
  PendingApproval, 
  AlertEntry,
  AlertSeverity,
  AlertFilter,
  MissionControlSessionStatus,
  RiskLevel,
  MissionControlToolCallStatus,
} from '../types';

// ─── Helper Components ───────────────────────────────────────────────────────

function StatusBadge({ status }: { status: MissionControlSessionStatus }) {
  const colors = {
    RUNNING: 'bg-green-500/20 text-green-400 border-green-500/30',
    WAITING: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    ERROR: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[status]}`}>
      {status}
    </span>
  );
}

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  const colors = {
    critical: 'bg-red-500/20 text-red-400 border-red-500/30',
    error: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  };
  
  const icons = {
    critical: '🔴',
    error: '🟠',
    warning: '🟡',
    info: '🔵',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[severity]}`}>
      {icons[severity]} {severity.toUpperCase()}
    </span>
  );
}

function RiskBadge({ risk }: { risk: RiskLevel }) {
  const colors = {
    Low: 'bg-green-500/20 text-green-400 border-green-500/30',
    Medium: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    High: 'bg-red-500/20 text-red-400 border-red-500/30',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${colors[risk]}`}>
      {risk} Risk
    </span>
  );
}

function ToolStatusBadge({ status }: { status: MissionControlToolCallStatus }) {
  const colors = {
    running: 'bg-blue-500/20 text-blue-400',
    complete: 'bg-green-500/20 text-green-400',
    error: 'bg-red-500/20 text-red-400',
  };
  
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded ${colors[status]}`}>
      {status}
    </span>
  );
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit' 
  });
}

function formatTimeAgo(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

// ─── Live Status Bar Component ───────────────────────────────────────────────

function LiveStatusBar({ sessions }: { sessions: ActiveSession[] }) {
  const running = sessions.filter(s => s.status === 'RUNNING').length;
  const waiting = sessions.filter(s => s.status === 'WAITING').length;
  const errors = sessions.filter(s => s.status === 'ERROR').length;
  const total = sessions.length;
  
  return (
    <div className="flex items-center gap-6 p-4 bg-zinc-900 rounded-lg border border-zinc-800">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-sm text-zinc-400">Fleet Status</span>
      </div>
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-white">{total}</span>
          <span className="text-zinc-500">total</span>
        </div>
        <div className="w-px bg-zinc-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-green-400">{running}</span>
          <span className="text-zinc-500">running</span>
        </div>
        <div className="w-px bg-zinc-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-yellow-400">{waiting}</span>
          <span className="text-zinc-500">waiting</span>
        </div>
        <div className="w-px bg-zinc-700" />
        <div className="flex items-center gap-1.5">
          <span className="text-lg font-semibold text-red-400">{errors}</span>
          <span className="text-zinc-500">error</span>
        </div>
      </div>
    </div>
  );
}

// ─── Session List Component ─────────────────────────────────────────────────

function SessionList({ sessions }: { sessions: ActiveSession[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Active Sessions
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sessions.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">No active sessions</p>
        ) : (
          sessions.map(session => (
            <div 
              key={session.id}
              className="flex items-center justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{session.agentEmoji}</span>
                <div>
                  <div className="font-medium text-white">{session.agentName}</div>
                  <div className="text-xs text-zinc-500">
                    {session.sessionType} • {session.currentTool || 'idle'}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <div className="text-sm text-zinc-300">{formatDuration(session.durationSeconds)}</div>
                  <div className="text-xs text-zinc-500">
                    {(session.tokenInput + session.tokenOutput).toLocaleString()} tokens
                  </div>
                </div>
                <StatusBadge status={session.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Tool Call Feed Component ────────────────────────────────────────────────

function ToolCallFeed({ toolCalls }: { toolCalls: MissionControlToolCall[] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Tool Call Feed
      </h3>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {toolCalls.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">No tool calls</p>
        ) : (
          toolCalls.slice(0, 15).map(call => (
            <div 
              key={call.id}
              className="flex items-center justify-between p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-sm"
            >
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400">{call.toolName}</span>
                <span className="text-zinc-500">by</span>
                <span className="text-zinc-300">{call.agentName}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-500">{call.elapsedMs}ms</span>
                <ToolStatusBadge status={call.status} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Approval Queue Component ───────────────────────────────────────────────

function ApprovalQueue({ 
  approvals, 
  onApprove, 
  onDeny 
}: { 
  approvals: PendingApproval[];
  onApprove: (id: string) => void;
  onDeny: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Approval Queue
      </h3>
      <div className="space-y-2">
        {approvals.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">No pending approvals</p>
        ) : (
          approvals.map(approval => (
            <div 
              key={approval.id}
              className="p-3 bg-zinc-900 rounded-lg border border-zinc-800"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{approval.agentEmoji}</span>
                  <span className="font-medium text-white">{approval.agentName}</span>
                </div>
                <RiskBadge risk={approval.riskLevel} />
              </div>
              <p className="text-sm text-zinc-300 mb-2">{approval.actionDescription}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Waiting: {formatTimeAgo(approval.waitingSeconds)}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDeny(approval.id)}
                    className="px-3 py-1 text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 rounded transition-colors"
                  >
                    Deny
                  </button>
                  <button
                    onClick={() => onApprove(approval.id)}
                    className="px-3 py-1 text-xs font-medium text-green-400 bg-green-500/10 hover:bg-green-500/20 rounded transition-colors"
                  >
                    Approve
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Alert Feed Component ───────────────────────────────────────────────────

function AlertFeed({ 
  alerts, 
  filter, 
  onFilterChange,
  onDismiss 
}: { 
  alerts: AlertEntry[];
  filter: AlertFilter;
  onFilterChange: (filter: AlertFilter) => void;
  onDismiss: (id: string) => void;
}) {
  const filteredAlerts = useMemo(() => {
    if (filter === 'all') return alerts;
    return alerts.filter(a => a.severity === filter);
  }, [alerts, filter]);
  
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
          Alert Feed
        </h3>
        <div className="flex gap-1">
          {(['all', 'error', 'warning', 'info'] as AlertFilter[]).map(f => (
            <button
              key={f}
              onClick={() => onFilterChange(f)}
              className={`px-2 py-0.5 text-xs rounded transition-colors ${
                filter === f 
                  ? 'bg-zinc-700 text-white' 
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto">
        {filteredAlerts.length === 0 ? (
          <p className="text-zinc-500 text-sm py-4 text-center">No alerts</p>
        ) : (
          filteredAlerts.map(alert => (
            <div 
              key={alert.id}
              className="flex items-start justify-between p-3 bg-zinc-900 rounded-lg border border-zinc-800"
            >
              <div className="flex items-start gap-2">
                <SeverityBadge severity={alert.severity} />
                <div>
                  <p className="text-sm text-zinc-200">{alert.message}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-zinc-500">
                    <span>{alert.agentName}</span>
                    <span>•</span>
                    <span>{formatTime(alert.timestamp)}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => onDismiss(alert.id)}
                className="text-zinc-500 hover:text-zinc-300 text-xs"
              >
                ✕
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Main Dashboard Component ───────────────────────────────────────────────

export default function MissionControlDashboard() {
  const {
    sessions,
    toolCalls,
    approvals,
    alerts,
    isConnected,
    connectionState,
    isPolling,
    refresh,
    approveRequest,
    denyRequest,
    dismissAlert,
    setAlertFilter,
  } = useMissionControl();
  
  const [alertFilter, setAlertFilterLocal] = useState<AlertFilter>('all');

  const handleFilterChange = (filter: AlertFilter) => {
    setAlertFilterLocal(filter);
    setAlertFilter(filter);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-xl">🎯</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mission Control</h1>
            <p className="text-sm text-zinc-500">Real-time agent activity dashboard</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
            }`} />
            <span className="text-sm text-zinc-400">
              {isConnected ? 'Connected' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
            </span>
            {isPolling && <span className="text-xs text-zinc-600">(polling)</span>}
          </div>
          <button
            onClick={refresh}
            className="px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* Live Status Bar */}
      <LiveStatusBar sessions={sessions} />

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Left Column */}
        <div className="space-y-6">
          <SessionList sessions={sessions} />
          <ToolCallFeed toolCalls={toolCalls} />
        </div>

        {/* Right Column */}
        <div className="space-y-6">
          <ApprovalQueue 
            approvals={approvals}
            onApprove={approveRequest}
            onDeny={denyRequest}
          />
          <AlertFeed 
            alerts={alerts}
            filter={alertFilter}
            onFilterChange={handleFilterChange}
            onDismiss={dismissAlert}
          />
        </div>
      </div>
    </div>
  );
}

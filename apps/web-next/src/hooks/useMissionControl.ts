import { useState, useEffect, useCallback, useRef } from 'react';
import { useGateway } from './useGateway';
import type {
  ActiveSession,
  MissionControlToolCall,
  PendingApproval,
  AlertEntry,
  AlertFilter,
  MissionControlSessionStatus,
  MissionControlToolCallStatus,
  MissionControlToolType,
} from '../types';

// ============================================================================
// Mock Data for Development/Offline Mode
// ============================================================================

const MOCK_AGENTS = [
  { name: 'Xavier', emoji: '🧠' },
  { name: 'Luis', emoji: '🎨' },
  { name: 'Stephan', emoji: '📣' },
  { name: 'Harry', emoji: '⚡' },
  { name: 'Quinn', emoji: '🚀' },
  { name: 'Roman', emoji: '📊' },
  { name: 'Nala', emoji: '🦁' },
  { name: 'Barry', emoji: '🔒' },
];

const MOCK_TOOLS = ['exec', 'read', 'write', 'sessions_spawn', 'message', 'browser', 'web_search', 'web_fetch'];

function generateMockSessions(): ActiveSession[] {
  const sessions: ActiveSession[] = [];
  const count = Math.floor(Math.random() * 5) + 2;
  
  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    const statuses: MissionControlSessionStatus[] = ['RUNNING', 'WAITING', 'ERROR'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const sessionTypes = ['main', 'subagent', 'cron'] as const;
    
    sessions.push({
      id: `s${i + 1}`,
      agentName: agent.name,
      agentEmoji: agent.emoji,
      sessionType: sessionTypes[Math.floor(Math.random() * sessionTypes.length)],
      currentTool: status === 'RUNNING' ? MOCK_TOOLS[Math.floor(Math.random() * MOCK_TOOLS.length)] : undefined,
      tokenInput: Math.floor(Math.random() * 50000),
      tokenOutput: Math.floor(Math.random() * 20000),
      durationSeconds: Math.floor(Math.random() * 3600),
      status,
    });
  }
  
  return sessions;
}

function generateMockToolCalls(): MissionControlToolCall[] {
  const calls: MissionControlToolCall[] = [];
  const count = Math.floor(Math.random() * 10) + 5;
  
  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    const tool = MOCK_TOOLS[Math.floor(Math.random() * MOCK_TOOLS.length)];
    const statuses: MissionControlToolCallStatus[] = ['running', 'complete', 'error'];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    
    calls.push({
      id: `tc${i}`,
      toolName: tool,
      toolType: tool as MissionControlToolType,
      agentName: agent.name,
      elapsedMs: Math.floor(Math.random() * 5000),
      status,
      completedAt: status !== 'running' ? Date.now() - Math.floor(Math.random() * 60000) : undefined,
    });
  }
  
  return calls.sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

function generateMockApprovals(): PendingApproval[] {
  const approvals: PendingApproval[] = [];
  const count = Math.floor(Math.random() * 3);
  const actions = [
    'Execute shell command: npm install',
    'Write file: /tmp/test.txt',
    'Delete user account',
    'Send message to #general',
    'Create new branch',
    'Deploy to production',
  ];
  const risks: PendingApproval['riskLevel'][] = ['Low', 'Medium', 'High'];
  
  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    
    approvals.push({
      id: `apr${i}`,
      agentName: agent.name,
      agentEmoji: agent.emoji,
      actionDescription: actions[Math.floor(Math.random() * actions.length)],
      riskLevel: risks[Math.floor(Math.random() * risks.length)],
      waitingSeconds: Math.floor(Math.random() * 300),
    });
  }
  
  return approvals;
}

function generateMockAlerts(): AlertEntry[] {
  const alerts: AlertEntry[] = [];
  const count = Math.floor(Math.random() * 5) + 2;
  const messages = [
    'High memory usage on node-3',
    'Connection timeout to gateway',
    'New agent session started',
    'Tool execution failed: exec timeout',
    'Rate limit approaching for API',
    'Disk space below threshold',
    'Agent health check failed',
  ];
  const severities: AlertEntry['severity'][] = ['critical', 'error', 'warning', 'info'];
  
  for (let i = 0; i < count; i++) {
    const agent = MOCK_AGENTS[Math.floor(Math.random() * MOCK_AGENTS.length)];
    
    alerts.push({
      id: `alert${i}`,
      timestamp: new Date(Date.now() - Math.floor(Math.random() * 3600000)).toISOString(),
      severity: severities[Math.floor(Math.random() * severities.length)],
      agentName: agent.name,
      message: messages[Math.floor(Math.random() * messages.length)],
    });
  }
  
  return alerts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

// ============================================================================
// useMissionControl Hook
// ============================================================================

export interface UseMissionControlReturn {
  // Data
  sessions: ActiveSession[];
  toolCalls: MissionControlToolCall[];
  approvals: PendingApproval[];
  alerts: AlertEntry[];
  
  // Status
  isConnected: boolean;
  connectionState: 'connecting' | 'connected' | 'disconnected' | 'error';
  lastError: string | null;
  isPolling: boolean;
  
  // Actions
  refresh: () => void;
  approveRequest: (id: string) => Promise<void>;
  denyRequest: (id: string) => Promise<void>;
  dismissAlert: (id: string) => Promise<void>;
  setAlertFilter: (filter: AlertFilter) => void;
}

export function useMissionControl(): UseMissionControlReturn {
  const { call, isConnected, connectionState, lastError } = useGateway();
  const [sessions, setSessions] = useState<ActiveSession[]>([]);
  const [toolCalls, setToolCalls] = useState<MissionControlToolCall[]>([]);
  const [approvals, setApprovals] = useState<PendingApproval[]>([]);
  const [alerts, setAlerts] = useState<AlertEntry[]>([]);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>('all');
  const [isPolling, setIsPolling] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch data from Gateway or use mock data
  const fetchData = useCallback(async () => {
    if (!isConnected) {
      // Use mock data when not connected
      setSessions(generateMockSessions());
      setToolCalls(generateMockToolCalls());
      setApprovals(generateMockApprovals());
      setAlerts(generateMockAlerts());
      return;
    }

    setIsPolling(true);
    try {
      // Fetch sessions
      const sessionsData = await call<ActiveSession[]>('sessions.list');
      setSessions(sessionsData || []);
      
      // Fetch tool history
      const toolsData = await call<MissionControlToolCall[]>('tools.history', { limit: 20 });
      setToolCalls(toolsData || []);
      
      // Fetch approvals
      const approvalsData = await call<PendingApproval[]>('approvals.list');
      setApprovals(approvalsData || []);
      
      // Fetch alerts
      const alertsData = await call<AlertEntry[]>('alerts.list', { filter: alertFilter });
      setAlerts(alertsData || []);
    } catch (err) {
      console.warn('[MissionControl] Gateway call failed, using mock data:', err);
      // Fallback to mock data
      setSessions(generateMockSessions());
      setToolCalls(generateMockToolCalls());
      setApprovals(generateMockApprovals());
      setAlerts(generateMockAlerts());
    } finally {
      setIsPolling(false);
    }
  }, [call, isConnected, alertFilter]);

  // Initial fetch and polling
  useEffect(() => {
    fetchData();
    
    // Set up polling as fallback
    pollIntervalRef.current = setInterval(fetchData, 10000);
    
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [fetchData]);

  // WebSocket event handlers (when connected)
  useEffect(() => {
    if (!isConnected) return;
    
    const handleSessionStart = (session: ActiveSession) => {
      setSessions((prev: ActiveSession[]) => [...prev, session]);
    };
    
    const handleSessionEnd = ({ id }: { id: string }) => {
      setSessions((prev: ActiveSession[]) => prev.filter((s: ActiveSession) => s.id !== id));
    };
    
    const handleSessionUpdate = (update: Partial<ActiveSession> & { id: string }) => {
      setSessions((prev: ActiveSession[]) => prev.map((s: ActiveSession) => 
        s.id === update.id ? { ...s, ...update } : s
      ));
    };
    
    const handleToolCall = (toolCall: MissionControlToolCall) => {
      setToolCalls((prev: MissionControlToolCall[]) => [toolCall, ...prev].slice(0, 50));
    };
    
    const handleToolComplete = (toolCall: MissionControlToolCall) => {
      setToolCalls((prev: MissionControlToolCall[]) => prev.map((tc: MissionControlToolCall) => 
        tc.id === toolCall.id ? toolCall : tc
      ));
    };
    
    const handleApprovalRequest = (approval: PendingApproval) => {
      setApprovals((prev: PendingApproval[]) => [...prev, approval]);
    };
    
    const handleApprovalResolve = ({ id }: { id: string }) => {
      setApprovals((prev: PendingApproval[]) => prev.filter((a: PendingApproval) => a.id !== id));
    };
    
    const handleAlertNew = (alert: AlertEntry) => {
      setAlerts((prev: AlertEntry[]) => [alert, ...prev].slice(0, 100));
    };
    
    const handleAlertDismiss = ({ id }: { id: string }) => {
      setAlerts((prev: AlertEntry[]) => prev.filter((a: AlertEntry) => a.id !== id));
    };
    
    // Note: In production, these would be registered with the WebSocket
    // For now, we rely on polling for updates
    
    return () => {
      // Cleanup handlers
    };
  }, [isConnected]);

  // Actions
  const refresh = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const approveRequest = useCallback(async (id: string) => {
    if (isConnected) {
      await call('approvals.approve', { id });
    }
    setApprovals((prev: PendingApproval[]) => prev.filter((a: PendingApproval) => a.id !== id));
  }, [call, isConnected]);

  const denyRequest = useCallback(async (id: string) => {
    if (isConnected) {
      await call('approvals.deny', { id });
    }
    setApprovals((prev: PendingApproval[]) => prev.filter((a: PendingApproval) => a.id !== id));
  }, [call, isConnected]);

  const dismissAlert = useCallback(async (id: string) => {
    if (isConnected) {
      await call('alerts.dismiss', { id });
    }
    setAlerts((prev: AlertEntry[]) => prev.filter((a: AlertEntry) => a.id !== id));
  }, [call, isConnected]);

  const handleAlertFilterChange = useCallback((filter: AlertFilter) => {
    setAlertFilter(filter);
  }, []);

  return {
    sessions,
    toolCalls,
    approvals,
    alerts,
    isConnected,
    connectionState,
    lastError,
    isPolling,
    refresh,
    approveRequest,
    denyRequest,
    dismissAlert,
    setAlertFilter: handleAlertFilterChange,
  };
}

export default useMissionControl;

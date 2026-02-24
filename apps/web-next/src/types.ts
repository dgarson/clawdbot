// ============================================================================
// Gateway Types
// ============================================================================

export type GatewayConnectionState = 'connecting' | 'connected' | 'disconnected' | 'error';

/** Outgoing request frame (wire format: { type: 'req', id: string, method, params? }) */
export interface GatewayRequest {
  type: 'req';
  id: string;
  method: string;
  params?: Record<string, unknown>;
}

export interface GatewayErrorShape {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfterMs?: number;
}

/** Incoming response frame (wire format: { type: 'res', id: string, ok, payload?, error? }) */
export interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: unknown;
  error?: GatewayErrorShape;
}

/** hello-ok arrives as the payload of the connect RPC response */
export interface GatewayHelloOk {
  type: 'hello-ok';
  protocol: number;
  server: { version: string; connId: string };
  features: { methods: string[]; events: string[] };
}

/** @deprecated Use GatewayHelloOk */
export type GatewayHello = GatewayHelloOk;

export interface UseGatewayReturn {
  connectionState: GatewayConnectionState;
  isConnected: boolean;
  lastError: string | null;
  /** True when the gateway rejected our connect attempt due to auth (bad/missing token) */
  authFailed: boolean;
  /** The auth rejection message, if any */
  authError: string | null;
  call: <T = unknown>(method: string, params?: Record<string, unknown>) => Promise<T>;
  reconnect: () => void;
}

// ============================================================================
// Auth / Provider Types
// ============================================================================

export type AuthProfileStatus = 'connected' | 'not_connected' | 'expired' | 'error';

export type RuntimeId = 'pi' | 'claude-sdk';

export interface AuthProvider {
  id: string;
  name: string;
  description: string;
  icon: string;
  authKind: 'api_key' | 'oauth' | 'device_code' | 'token';
  docsUrl?: string;
  popular?: boolean;
  runtimes?: RuntimeId[];
  status: AuthProfileStatus;
  profileId?: string;
}

export interface OpenClawConfig {
  auth?: {
    profiles?: Record<string, unknown>;
  };
  models?: {
    default?: string;
    list?: string[];
  };
  [key: string]: unknown;
}

export interface ModelsListResponse {
  models: ModelInfo[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  description?: string;
  capabilities?: string[];
  speed?: 'fast' | 'medium' | 'slow';
  cost?: 'low' | 'medium' | 'high';
}

// ============================================================================
// WhatsApp Login Types
// ============================================================================

export interface WebLoginStartResponse {
  sessionId: string;
  qrCode?: string;
  qrDataUrl?: string;
  status: string;
  message?: string;
  expiresAt?: string;
}

export interface WebLoginWaitResponse {
  status?: 'pending' | 'connected' | 'expired' | 'error';
  connected?: boolean;
  phoneNumber?: string;
  error?: string;
  message?: string;
  qrCode?: string;
}

// ============================================================================
// Wizard Types
// ============================================================================

export type WizardStepType =
  | 'text'
  | 'password'
  | 'select'
  | 'confirm'
  | 'info'
  | 'note'
  | 'qr'
  | 'device_code'
  | 'progress';

export interface WizardSelectOption {
  value: string;
  label: string;
  description?: string;
  icon?: string;
  disabled?: boolean;
}

/**
 * WizardStep: flat interface — all fields optional except id and type.
 * Not a discriminated union to allow easy access of common fields across step types.
 */
export interface WizardStep {
  id: string;
  type: WizardStepType;
  title?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  sensitive?: boolean;
  defaultValue?: string;
  validation?: string;

  // select step
  options?: WizardSelectOption[];
  multi?: boolean;

  // info/note step
  content?: string;
  icon?: string;
  variant?: 'info' | 'warning' | 'error' | 'success';

  // qr step
  qrData?: string;

  // device_code step
  deviceCode?: string;
  verificationUrl?: string;

  // confirm step
  confirmLabel?: string;
  cancelLabel?: string;

  // progress step
  progress?: number;
  indeterminate?: boolean;
  message?: string;
}

export interface WizardAnswer {
  stepId: string;
  value: string | boolean | number | Record<string, unknown> | string[];
}

/** Shape returned by wizard.start / wizard.next / wizard.status */
export interface WizardSession {
  sessionId: string;
  done: boolean;
  step?: WizardStep;
  status?: string;
  error?: string;
}

export interface WizardStartParams {
  mode: string;
  provider?: string;
  workspace?: string;
  [key: string]: unknown;
}

export interface UseWizardReturn {
  sessionId: string | null;
  currentStep: WizardStep | null;
  done: boolean;
  loading: boolean;
  error: string | null;
  status: string | null;
  start: (params: WizardStartParams) => Promise<void>;
  submitAnswer: (answer: WizardAnswer) => Promise<void>;
  cancel: () => Promise<void>;
  refresh: () => Promise<void>;
  reset?: () => void;
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentStatus = 'active' | 'idle' | 'offline' | 'error';
export type AgentHealth = 'healthy' | 'degraded' | 'unhealthy';

export interface AgentPersonality {
  formality: number;      // 0-100
  humor: number;          // 0-100
  verbosity: number;      // 0-100
  empathy: number;        // 0-100
  tone: string;
}

export interface Agent {
  id: string;
  name: string;
  emoji: string;
  role: string;
  status: AgentStatus;
  health: AgentHealth;
  lastActive: string;
  model: string;
  description: string;
  personality: AgentPersonality;
  tools: string[];
  skills: string[];
  createdAt: string;
}

export interface AgentFile {
  name: string;
  content: string;
  modified?: boolean;
}

// ============================================================================
// Session Types
// ============================================================================

export type SessionStatus = 'active' | 'idle' | 'completed' | 'error';

export interface Session {
  key: string;
  agentId: string;
  agentName?: string;
  agentEmoji?: string;
  status: SessionStatus;
  messageCount: number;
  createdAt: string;
  lastActivity: string;
  tokenUsage?: {
    input: number;
    output: number;
    total: number;
  };
  cost?: number;
  label?: string;
  parentKey?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  streaming?: boolean;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'pending' | 'running' | 'done' | 'error';
}

// ============================================================================
// Cron Types
// ============================================================================

export type CronJobStatus = 'enabled' | 'disabled' | 'running' | 'error';

export interface CronJob {
  id: string;
  name: string;
  schedule: string;
  agentId: string;
  agentName?: string;
  agentEmoji?: string;
  prompt: string;
  status: CronJobStatus;
  lastRun?: string;
  lastRunStatus?: 'ok' | 'error' | 'timeout';
  lastRunDuration?: number;
  nextRun?: string;
  createdAt: string;
}

export interface CronRun {
  id: string;
  jobId: string;
  startedAt: string;
  completedAt?: string;
  status: 'running' | 'ok' | 'error' | 'timeout';
  duration?: number;
  error?: string;
}

// ============================================================================
// Skill Types
// ============================================================================

export type SkillStatus = 'installed' | 'available' | 'updating' | 'error';

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  status: SkillStatus;
  version?: string;
  author?: string;
  tools?: string[];
  popular?: boolean;
  featured?: boolean;
}

// ============================================================================
// Node Types
// ============================================================================

export type NodeStatus = 'online' | 'offline' | 'pairing' | 'error';

export interface Node {
  id: string;
  name: string;
  platform: string;
  status: NodeStatus;
  lastSeen: string;
  capabilities: string[];
  paired: boolean;
  ipAddress?: string;
  version?: string;
}

// ============================================================================
// Usage / Analytics Types
// ============================================================================

export interface UsageSummary {
  totalTokens: number;
  totalCost: number;
  totalRequests: number;
  byModel: Record<string, { tokens: number; cost: number; requests: number }>;
  byAgent: Record<string, { tokens: number; cost: number; requests: number }>;
  dailyUsage: Array<{
    date: string;
    tokens: number;
    cost: number;
    requests: number;
  }>;
}

// ============================================================================
// AnimatedComponents Types
// ============================================================================

export type StatusBadgeVariant =
  | 'connected'
  | 'not_connected'
  | 'expired'
  | 'error'
  | 'active'
  | 'idle'
  | 'offline'
  | 'healthy'
  | 'degraded'
  | 'enabled'
  | 'disabled'
  | 'running'
  | 'loading'
  | 'success'
  | 'warning';

export interface AnimatedCounterProps {
  value: number;
  duration?: number;
  formatter?: (value: number) => string;
  className?: string;
}

export interface TimeSeriesDataPoint {
  date?: string;
  timestamp?: string;
  label?: string;
  value: number;
}

export interface TimeSeriesChartProps {
  data: TimeSeriesDataPoint[];
  width?: number;
  height?: number;
  color?: string;
  className?: string;
  showAxis?: boolean;
  animated?: boolean;
}

// ============================================================================
// Mission Control Dashboard Types
// ============================================================================

/**
 * Session types for Mission Control
 */
export type MissionControlSessionType = 'main' | 'subagent' | 'cron';

/**
 * Session status for Mission Control
 */
export type MissionControlSessionStatus = 'RUNNING' | 'WAITING' | 'ERROR';

/**
 * Tool call status for Mission Control
 */
export type MissionControlToolCallStatus = 'running' | 'complete' | 'error';

/**
 * Tool types for Mission Control
 */
export type MissionControlToolType = 'exec' | 'read' | 'write' | 'sessions_spawn' | 'message' | 'browser' | 'other';

/**
 * Risk level for approvals
 */
export type RiskLevel = 'Low' | 'Medium' | 'High';

/**
 * Alert severity levels
 */
export type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';

/**
 * Alert filter options
 */
export type AlertFilter = 'all' | 'error' | 'warning' | 'info';

/**
 * Active session in Mission Control
 */
export interface ActiveSession {
  id: string;
  agentName: string;
  agentEmoji: string;
  sessionType: MissionControlSessionType;
  currentTool?: string;
  tokenInput: number;
  tokenOutput: number;
  durationSeconds: number;
  status: MissionControlSessionStatus;
}

/**
 * Tool call event for Mission Control
 */
export interface MissionControlToolCall {
  id: string;
  toolName: string;
  toolType: MissionControlToolType;
  agentName: string;
  elapsedMs: number;
  status: MissionControlToolCallStatus;
  completedAt?: number;
}

/**
 * Pending approval request
 */
export interface PendingApproval {
  id: string;
  agentName: string;
  agentEmoji: string;
  actionDescription: string;
  riskLevel: RiskLevel;
  waitingSeconds: number;
}

/**
 * Alert entry
 */
export interface AlertEntry {
  id: string;
  timestamp: string;
  severity: AlertSeverity;
  agentName: string;
  message: string;
}

/**
 * WebSocket event types for Mission Control
 */
export interface MissionControlEvents {
  'session.start': ActiveSession;
  'session.end': { id: string };
  'session.update': Partial<ActiveSession> & { id: string };
  'tool.call': MissionControlToolCall;
  'tool.complete': MissionControlToolCall;
  'approval.request': PendingApproval;
  'approval.resolve': { id: string; decision: 'approved' | 'denied' };
  'alert.new': AlertEntry;
  'alert.dismiss': { id: string };
}

/** Types for the telemetry dashboard UI. */

export type TelemetrySessionSummary = {
  key: string;
  agentId?: string;
  runCount: number;
  lastActivity?: string;
  totalTokens: number;
  totalCost: number;
  errorCount: number;
  startedAt?: string;
  endedAt?: string | null;
};

export type TelemetryUsageSummary = {
  totalSessions: number;
  totalRuns: number;
  totalTokens: number;
  estimatedCost: number;
  errorCount: number;
};

export type TelemetryCostBreakdown = {
  label: string;
  inputTokens: number;
  outputTokens: number;
  cacheTokens: number;
  inputCost: number;
  outputCost: number;
  cacheCost: number;
  totalCost: number;
};

export type TelemetryLeaderboardEntry = {
  label: string;
  value: number;
  count?: number;
};

export type TelemetryErrorEntry = {
  timestamp: string;
  source: string;
  message: string;
  runId?: string;
  sessionKey?: string;
};

export type TelemetryTimelineEvent = {
  id: string;
  timestamp: string;
  kind: string;
  data?: Record<string, unknown>;
  duration?: number;
};

export type TelemetrySubagentNode = {
  agentId: string;
  sessionKey?: string;
  parentAgentId?: string;
  children: TelemetrySubagentNode[];
};

export type TelemetryView = "dashboard" | "session-detail";

export type TelemetryReplayState = {
  playing: boolean;
  speed: number;
  currentIndex: number;
};

export type TelemetryCostGroupBy = "model" | "provider" | "day" | "session";

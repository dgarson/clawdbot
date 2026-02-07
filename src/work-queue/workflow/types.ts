import type { OverseerPlan } from "../../infra/overseer/store.types.js";

/** Workflow lifecycle phases. */
export type WorkflowPhase =
  | "planning"
  | "reviewing"
  | "discovering"
  | "decomposing"
  | "executing"
  | "completed"
  | "failed";

/** Plan produced by the planning phase. */
export type WorkflowPlan = {
  intent: string;
  scope: string;
  discoveryQuestions: string[];
  constraints: string[];
  successCriteria: string[];
  estimatedComplexity: "low" | "medium" | "high";
};

/** A single review iteration result. */
export type ReviewIteration = {
  iteration: number;
  approved: boolean;
  feedback: string;
  suggestedChanges?: string[];
  revisedPlan?: Partial<WorkflowPlan>;
  /** True when approval was inferred due to reviewer failure (empty/invalid response). */
  autoApproved?: boolean;
};

/** Result from a single discovery subagent. */
export type DiscoveryResult = {
  question: string;
  runId: string;
  sessionKey: string;
  status: "ok" | "error" | "timeout";
  findings: string;
  keyInsights: string[];
};

/** Structured subagent report parsed from final reply. */
export type SubagentReport = {
  summary: string;
  findings: string[];
  decisions: string[];
  blockers: string[];
  artifacts: string[];
};

/** Execution progress tracking. */
export type ExecutionProgress = {
  totalNodes: number;
  completedNodes: number;
  failedNodes: number;
  currentNodeId?: string;
};

/** Full workflow state across all phases. */
export type WorkflowState = {
  phase: WorkflowPhase;
  workItemId: string;
  workItemTitle: string;
  plan?: WorkflowPlan;
  reviewIterations: ReviewIteration[];
  discoveryResults: DiscoveryResult[];
  dag?: OverseerPlan;
  executionProgress?: ExecutionProgress;
  startedAt: number;
  completedAt?: number;
  error?: string;
};

/** Join barrier entry for tracking parallel subagent waits. */
export type JoinBarrierEntry = {
  runId: string;
  sessionKey: string;
  label: string;
};

/** Join barrier result after waiting for a subagent. */
export type JoinBarrierResult = {
  entry: JoinBarrierEntry;
  status: "ok" | "error" | "timeout";
  reply?: string;
  error?: string;
};

/** Logger interface used by workflow components. */
export type WorkflowLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
};

/** Gateway call function signature. */
export type GatewayCallFn = <T = Record<string, unknown>>(opts: {
  method: string;
  params?: unknown;
  timeoutMs?: number;
}) => Promise<T>;

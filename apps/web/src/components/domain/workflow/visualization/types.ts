export type WorkflowVizNodeStatus =
  | "idle"
  | "running"
  | "success"
  | "error"
  | "waiting"
  | "skipped";

export type WorkflowVizNodeType =
  | "start"
  | "process"
  | "worker"
  | "router"
  | "orchestrator"
  | "quality_check"
  | "complete"
  | "agent"
  | "result";

export type WorkflowVizEdgeType = "default" | "conditional" | "parallel" | "feedback";

export interface WorkflowVizLink {
  label: string;
  url: string;
}

export interface WorkflowVizNode extends Record<string, unknown> {
  id: string;
  type: WorkflowVizNodeType;
  title: string;
  subtitle?: string;
  description?: string;
  status: WorkflowVizNodeStatus;
  position: { x: number; y: number };
  width?: number;
  progress?: number; // 0-100
  metadata?: Record<string, unknown>;
  outLinks?: WorkflowVizLink[];
  /** Callback when "View Details" is clicked */
  onViewDetails?: (nodeId: string) => void;
  /** Callback when "Step Into" / Command & Control is clicked */
  onStepInto?: (nodeId: string) => void;
}

export interface WorkflowVizEdge {
  id: string;
  source: string;
  target: string;
  type?: WorkflowVizEdgeType;
  label?: string;
  isActive?: boolean;
  animated?: boolean;
}

export type WorkflowLogLevel = "info" | "success" | "warn" | "error";

export interface WorkflowLogEntry {
  id: string;
  timestamp: string;
  level: WorkflowLogLevel;
  nodeId?: string;
  message: string;
}

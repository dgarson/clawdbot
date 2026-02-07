export type WorkflowStatus =
  | "idle"
  | "thinking"
  | "executing"
  | "waiting_approval"
  | "waiting_input"
  | "paused"
  | "complete"
  | "error";

export type ToolCallStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "executing"
  | "complete"
  | "error";

export type RiskLevel = "low" | "medium" | "high";

export interface AgenticAttachment {
  id: string;
  name: string;
  kind: "image" | "file";
  file?: File;
  previewUrl?: string;
}

export interface AgenticChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
  attachments?: AgenticAttachment[];
}

export interface ToolCall {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  status: ToolCallStatus;
  risk?: RiskLevel;
  result?: unknown;
  error?: string;
}

export interface ChoiceOption {
  id: string;
  label: string;
  description?: string;
}

export interface Question {
  id: string;
  text: string;
  type: "text" | "choice";
  options?: ChoiceOption[];
  multiple?: boolean;
  placeholder?: string;
  multiline?: boolean;
  status: "pending" | "answered";
  answer?: unknown;
}

export interface ModelOption {
  id: string;
  name: string;
  description?: string;
}

export interface SessionOption {
  id: string;
  name: string;
  createdAt?: Date;
}


import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { Api, AssistantMessage, Model } from "@mariozechner/pi-ai";
import type { AuthStorage, ModelRegistry } from "@mariozechner/pi-coding-agent";
import type { ThinkLevel } from "../../../auto-reply/thinking.js";
import type { SessionSystemPromptReport } from "../../../config/sessions/types.js";
import type { PluginHookBeforeAgentStartResult } from "../../../plugins/types.js";
import type { ResolvedProviderAuth } from "../../model-auth.js";
import type { MessagingToolSend } from "../../pi-embedded-messaging.js";
import type { NormalizedUsage } from "../../usage.js";
import type { RunEmbeddedPiAgentParams } from "./params.js";

type EmbeddedRunAttemptBase = Omit<
  RunEmbeddedPiAgentParams,
  "provider" | "model" | "authProfileId" | "authProfileIdSource" | "thinkLevel" | "lane" | "enqueue"
>;

export type EmbeddedRunAttemptParams = EmbeddedRunAttemptBase & {
  provider: string;
  modelId: string;
  model: Model<Api>;
  runtimeOverride?: "pi" | "claude-sdk";
  resolvedProviderAuth?: ResolvedProviderAuth;
  authStorage: AuthStorage;
  modelRegistry: ModelRegistry;
  thinkLevel: ThinkLevel;
  legacyBeforeAgentStartResult?: PluginHookBeforeAgentStartResult;
  /** Routing metadata from before_model_resolve hook result, passed to llm_input/llm_output. */
  routingMetadata?: Record<string, unknown>;
  /** Pre-collected plugin prompt sections (P8). Appended after core prompt content. */
  pluginSections?: import("../../system-prompt.plugin-sections.js").PluginPromptSection[];
  previousSystemPromptReport?: SessionSystemPromptReport;
  lineageId?: string;
};

export type EmbeddedRunAttemptResult = {
  aborted: boolean;
  timedOut: boolean;
  /** True if the timeout occurred while compaction was in progress or pending. */
  timedOutDuringCompaction: boolean;
  promptError: unknown;
  sessionIdUsed: string;
  systemPromptReport?: SessionSystemPromptReport;
  messagesSnapshot: AgentMessage[];
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  lastAssistant: AssistantMessage | undefined;
  lastToolError?: {
    toolName: string;
    meta?: string;
    error?: string;
    mutatingAction?: boolean;
    actionFingerprint?: string;
  };
  didSendViaMessagingTool: boolean;
  messagingToolSentTexts: string[];
  messagingToolSentMediaUrls: string[];
  messagingToolSentTargets: MessagingToolSend[];
  successfulCronAdds?: number;
  cloudCodeAssistFormatError: boolean;
  attemptUsage?: NormalizedUsage;
  compactionCount?: number;
  /** Client tool call detected (OpenResponses hosted tools). */
  clientToolCall?: { name: string; params: Record<string, unknown> };
  /** Number of before_session_end continuation retries performed. */
  continuationCount?: number;
};

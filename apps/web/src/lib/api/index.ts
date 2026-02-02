/**
 * API module exports
 */

// Gateway client
export {
  GatewayClient,
  getGatewayClient,
  createGatewayClient,
  type GatewayStatus,
  type GatewayEvent,
  type GatewayClientConfig,
  type GatewayRequestOptions,
} from "./gateway-client";

// API types
export type {
  ConfigSnapshot,
  ClawdbrainConfig,
  AuthConfig,
  GatewayConfigData,
  ChannelsConfig,
  TelegramChannelConfig,
  DiscordChannelConfig,
  WhatsAppChannelConfig,
  SlackChannelConfig,
  SignalChannelConfig,
  iMessageChannelConfig,
  AgentsConfig,
  AgentConfigEntry,
  ChannelStatusResponse,
  ChannelMetaEntry,
  ChannelSummary,
  ChannelAccountSnapshot,
  ModelsListResponse,
  ModelEntry,
  AgentsListResponse,
  GatewayAgent,
  HealthResponse,
  StatusResponse,
  ConfigPatchParams,
  ConfigPatchResponse,
  ModelProviderId,
  ProviderVerifyRequest,
  ProviderVerifyResponse,
} from "./types";

// Config API functions
export {
  getConfig,
  getConfigSchema,
  patchConfig,
  applyConfig,
  getChannelsStatus,
  logoutChannel,
  listModels,
  listAgents,
  getHealth,
  getStatus,
  verifyProviderApiKey,
  saveProviderApiKey,
  removeProviderApiKey,
} from "./config";

// Session API functions
export {
  listSessions,
  getChatHistory,
  sendChatMessage,
  abortChat,
  patchSession,
  deleteSession,
  buildAgentSessionKey,
  parseAgentSessionKey,
  filterSessionsByAgent,
  type GatewaySessionRow,
  type SessionsListResult,
  type ChatMessage,
  type ToolCall,
  type ChatHistoryResult,
  type ChatSendParams,
  type ChatSendResult,
  type SessionPatchParams,
  type ChatEventPayload,
  type AgentEventPayload,
} from "./sessions";

// Worktree API functions
export {
  listWorktreeFiles,
  readWorktreeFile,
  writeWorktreeFile,
  moveWorktreeFile,
  deleteWorktreeFile,
  createWorktreeDir,
  type WorktreeEntry,
  type WorktreeListParams,
  type WorktreeListResult,
  type WorktreeReadParams,
  type WorktreeReadResult,
  type WorktreeWriteParams,
  type WorktreeWriteResult,
  type WorktreeMoveParams,
  type WorktreeDeleteParams,
  type WorktreeMkdirParams,
} from "./worktree";

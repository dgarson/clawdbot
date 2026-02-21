/**
 * API module exports
 */

// Gateway client
export {
  GatewayClient,
  getGatewayClient,
  createGatewayClient,
  resetGatewayClient,
  GATEWAY_CLIENT_ID,
  GATEWAY_CLIENT_MODE,
  DEFAULT_ROLE,
  DEFAULT_SCOPES,
  type GatewayConnectionState,
  type GatewayStatus,
  type GatewayEvent,
  type GatewayClientConfig,
  type GatewayRequestOptions,
  type GatewayAuthCredentials,
  type GatewayEventFrame,
  type GatewayResponseFrame,
  type GatewayHelloOk,
} from "./gateway-client";

// Device auth (token storage and payload builder)
export {
  loadDeviceAuthToken,
  storeDeviceAuthToken,
  clearDeviceAuthToken,
  buildDeviceAuthPayload,
  type DeviceAuthEntry,
  type DeviceAuthPayloadParams,
} from "./device-auth";

// Device auth storage (shared tokens, preferences)
export {
  clearAllDeviceAuthTokens,
  loadSharedGatewayToken,
  storeSharedGatewayToken,
  clearSharedGatewayToken,
  loadAuthMethodPreference,
  storeAuthMethodPreference,
  type AuthMethod,
} from "./device-auth-storage";

// Device identity
export {
  loadOrCreateDeviceIdentity,
  signDevicePayload,
  clearDeviceIdentity,
  isSecureContext,
  type DeviceIdentity,
} from "./device-identity";

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

// Overseer API functions
export {
  getOverseerStatus,
  listOverseerGoals,
  createGoal as createOverseerGoal,
  getGoalStatus,
  pauseGoal,
  resumeGoal,
  cancelGoal,
  deleteGoal as deleteOverseerGoal,
  type OverseerStatusResult,
  type OverseerGoal,
  type OverseerGoalCreateParams,
  type OverseerGoalCreateResult,
  type OverseerGoalStatusResult,
  type OverseerGoalListResult,
} from "./overseer";

// Cron API functions
export {
  listCronJobs,
  getCronJob,
  addCronJob,
  updateCronJob,
  removeCronJob,
  enableCronJob,
  disableCronJob,
  runCronJob,
  type CronJob,
  type CronJobCreateParams,
  type CronJobUpdateParams,
  type CronJobListResult,
  type CronJobRunResult,
} from "./cron";

// Agent Status API functions
export {
  getAgentStatus,
  type AgentHealthStatus,
  type AgentResourceUsage,
  type AgentStatusEntry,
  type AgentStatusSnapshot,
  type AgentStatusEvent,
} from "./agent-status";

// Skills API functions
export {
  getSkillsStatus,
  getSkill,
  updateSkill,
  enableSkill,
  disableSkill,
  installSkill,
  uninstallSkill,
  reloadSkills,
  type Skill,
  type SkillsStatusReport,
  type SkillUpdateParams,
  type SkillInstallParams,
  type SkillInstallResult,
} from "./skills";

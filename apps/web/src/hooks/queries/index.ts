// Query hooks barrel export

// Agents
export {
  useAgents,
  useAgent,
  useAgentsByStatus,
  agentKeys,
} from "./useAgents";
export type { Agent, AgentStatus } from "./useAgents";

// Conversations
export {
  useConversations,
  useConversation,
  useConversationsByAgent,
  useMessages,
  conversationKeys,
} from "./useConversations";
export type { Conversation, Message } from "./useConversations";

// Goals
export {
  useGoals,
  useGoal,
  useGoalsByStatus,
  useInvalidateGoals,
  goalKeys,
} from "./useGoals";
export type { Goal, GoalStatus, GoalPriority, Milestone, GoalDetail } from "./useGoals";

// Overseer (raw overseer hooks)
export {
  useOverseerStatus,
  useOverseerGoals,
  useOverseerGoal,
  useOverseerStalledAssignments,
  overseerKeys,
} from "./useOverseer";
export type {
  OverseerStatusResult,
  OverseerGoalStatusResult,
  OverseerGoalSummary,
  OverseerGoalDetail,
} from "./useOverseer";

// Memories
export {
  useMemories,
  useMemory,
  useMemoriesByType,
  useMemoriesByTag,
  useMemorySearch,
  memoryKeys,
} from "./useMemories";
export type { Memory, MemoryType } from "./useMemories";

// Rituals
export {
  useRituals,
  useRitual,
  useRitualsByStatus,
  useRitualsByAgent,
  useRitualExecutions,
  ritualKeys,
} from "./useRituals";
export type {
  Ritual,
  RitualStatus,
  RitualFrequency,
  RitualExecution,
} from "./useRituals";

// Workstreams
export {
  useWorkstreams,
  useWorkstream,
  useWorkstreamsByStatus,
  useWorkstreamsByOwner,
  useTasks,
  useTasksByStatus,
  workstreamKeys,
} from "./useWorkstreams";
export type {
  Workstream,
  WorkstreamStatus,
  Task,
  TaskStatus,
  TaskPriority,
} from "./useWorkstreams";

// Work Queue
export {
  useWorkQueues,
  useWorkQueue,
  useWorkQueueItems,
  useWorkQueueStatusByAgent,
  useInvalidateWorkQueue,
  workQueueKeys,
} from "./useWorkQueue";
export type {
  WorkQueue,
  WorkQueueItem,
  WorkQueueItemStatus,
  WorkQueueItemPriority,
  WorkQueueStats,
  WorkQueueStatusSnapshot,
} from "./useWorkQueue";

// Config
export { useConfig, useConfigSchema, configKeys } from "./useConfig";
export type { ConfigSnapshot } from "./useConfig";

// Channels
export {
  useChannelsStatus,
  useChannelsStatusFast,
  useChannelsStatusDeep,
  channelKeys,
} from "./useChannels";
export type {
  ChannelStatusResponse,
  ChannelAccountSnapshot,
  ChannelSummary,
  ChannelMetaEntry,
} from "./useChannels";

// Models
export { useModels, useModelsByProvider, modelKeys } from "./useModels";
export type { ModelsListResponse, ModelEntry } from "./useModels";

// Gateway
export {
  useGatewayHealth,
  useGatewayStatus,
  useGatewayConnected,
  gatewayKeys,
} from "./useGateway";
export type { HealthResponse, StatusResponse } from "./useGateway";

// Health (advanced probing and system health)
export {
  useHealthProbe,
  useSystemHealth,
  healthKeys,
} from "./useHealth";
export type { SystemHealthStatus } from "./useHealth";

// User Settings
export {
  useUserProfile,
  useUserPreferences,
  useUserSettings,
  usePrefetchUserSettings,
  userSettingsKeys,
} from "./useUserSettings";
export type {
  UserProfile,
  UserPreferences,
  UserSettings,
  NotificationPreference,
} from "./useUserSettings";

// Agent Status Dashboard
export {
  useAgentStatusDashboard,
  useAgentStatusSummary,
  agentStatusKeys,
} from "./useAgentStatus";
export type {
  AgentStatusEntry,
  AgentHealthStatus,
  AgentStatusSnapshot,
} from "./useAgentStatus";

// Agent Dashboard
export { useAgentDashboardData } from "./useAgentDashboard";
export type {
  AgentDashboardEntry,
  AgentDashboardSummary,
  AgentDashboardData,
} from "./useAgentDashboard";

// Sessions
export {
  useSessions,
  useAgentSessions,
  useChatHistory,
  useChatEventSubscription,
  sessionKeys,
} from "./useSessions";

// Cron Jobs
export {
  useCronStatus,
  useCronJobs,
  useCronJob,
  useCronJobsByAgent,
  useEnabledCronJobs,
  useCronRunHistory,
  useCronRunLog,
  useCronEventSubscription,
  useInvalidateCron,
  cronKeys,
} from "./useCron";
export type {
  CronJob,
  CronJobListResult,
  CronStatusResult,
  CronRunsResult,
  CronRunLogResult,
} from "./useCron";

// Skills
export {
  useSkillsStatus,
  useSkill,
  useEnabledSkills,
  useBuiltInSkills,
  useCustomSkills,
  skillKeys,
} from "./useSkills";
export type { SkillStatusEntry, SkillsStatusReport } from "./useSkills";

// Nodes, Devices, Exec Approvals
export {
  useNodes,
  useDevices,
  useExecApprovals,
  nodeKeys,
} from "./useNodes";
export type {
  NodeEntry,
  NodeListResult,
  DevicePairingList,
  PairedDevice,
  PendingDevice,
  DeviceTokenSummary,
  ExecApprovalsSnapshot,
  ExecApprovalsFile,
  ExecApprovalsDefaults,
  ExecApprovalsAgent,
  ExecApprovalsAllowlistEntry,
} from "./useNodes";

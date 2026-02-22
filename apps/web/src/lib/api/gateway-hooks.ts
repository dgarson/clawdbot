/**
 * React Query integration for the Gateway WebSocket client.
 *
 * Provides type-safe hooks for querying and mutating gateway state.
 * All data flows through the existing GatewayClient WebSocket connection.
 */

import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
  type UseMutationOptions,
} from "@tanstack/react-query";
import { getGatewayClient, type GatewayClient } from "./gateway-client";
import { useGatewayConnection } from "@/hooks/useGatewayConnection";

// ---------------------------------------------------------------------------
// Core Gateway Client Hook
// ---------------------------------------------------------------------------

/**
 * Returns the singleton GatewayClient instance.
 * Components should use the higher-level typed hooks below.
 */
export function useGatewayClient(): GatewayClient {
  return getGatewayClient();
}

/**
 * Returns whether the gateway is connected and ready for requests.
 */
export function useGatewayReady(): boolean {
  const { isConnected } = useGatewayConnection();
  return isConnected;
}

// ---------------------------------------------------------------------------
// Generic Gateway Query Hook
// ---------------------------------------------------------------------------

export interface UseGatewayQueryOptions<TResult> {
  /** Additional React Query options */
  enabled?: boolean;
  /** Refetch interval in ms (0 = disabled) */
  refetchInterval?: number;
  /** Stale time in ms */
  staleTime?: number;
  /** Retry count */
  retry?: number | boolean;
  /** Cache time */
  gcTime?: number;
  /** Select/transform result */
  select?: (data: TResult) => TResult;
  /** Initial data */
  initialData?: TResult;
  /** Placeholder data */
  placeholderData?: TResult | (() => TResult);
}

/**
 * Generic hook for gateway RPC queries.
 *
 * @example
 * const { data, isLoading } = useGatewayQuery<AgentsListResult>(
 *   "agents.list",
 *   { scope: "all" }
 * );
 */
export function useGatewayQuery<TResult = unknown>(
  method: string,
  params?: Record<string, unknown>,
  options?: UseGatewayQueryOptions<TResult>,
) {
  const client = useGatewayClient();
  const ready = useGatewayReady();

  return useQuery<TResult>({
    queryKey: [method, params ?? {}],
    queryFn: () => client.request<TResult>(method, params ?? {}),
    enabled: ready && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval,
    staleTime: options?.staleTime ?? 30_000,
    retry: options?.retry ?? 1,
    gcTime: options?.gcTime,
    select: options?.select,
    initialData: options?.initialData,
    placeholderData: options?.placeholderData as TResult | undefined,
  });
}

// ---------------------------------------------------------------------------
// Generic Gateway Mutation Hook
// ---------------------------------------------------------------------------

export interface UseGatewayMutationOptions<TParams, TResult> {
  /** Invalidate these query keys on success */
  invalidate?: readonly (readonly unknown[])[];
  /** Callback on success */
  onSuccess?: (data: TResult, variables: TParams) => void;
  /** Callback on error */
  onError?: (error: Error, variables: TParams) => void;
}

/**
 * Generic hook for gateway RPC mutations.
 *
 * @example
 * const saveFile = useGatewayMutation<SaveFileParams, SaveFileResult>(
 *   "agents.files.set",
 *   { invalidate: [["agents.files.list"]] }
 * );
 * saveFile.mutate({ agentId: "foo", name: "SOUL.md", content: "..." });
 */
export function useGatewayMutation<TParams = Record<string, unknown>, TResult = unknown>(
  method: string,
  options?: UseGatewayMutationOptions<TParams, TResult>,
) {
  const client = useGatewayClient();
  const queryClient = useQueryClient();

  return useMutation<TResult, Error, TParams>({
    mutationFn: (params: TParams) =>
      client.request<TResult>(method, params as Record<string, unknown>),
    onSuccess: (data, variables) => {
      // Invalidate related queries
      if (options?.invalidate) {
        for (const key of options.invalidate) {
          void queryClient.invalidateQueries({ queryKey: key as unknown[] });
        }
      }
      options?.onSuccess?.(data, variables);
    },
    onError: (error, variables) => {
      options?.onError?.(error, variables);
    },
  });
}

// ---------------------------------------------------------------------------
// Gateway Event Subscription Hook
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";

/**
 * Subscribe to gateway events with automatic cleanup.
 *
 * @example
 * useGatewayEvent("agent.status.changed", (event) => {
 *   console.log("Agent status changed:", event.payload);
 * });
 */
export function useGatewayEvent(
  eventName: string,
  handler: (event: { event: string; payload?: unknown; seq?: number }) => void,
) {
  const client = useGatewayClient();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const unsub = client.subscribe(eventName, (event) => {
      handlerRef.current(event);
    });
    return unsub;
  }, [client, eventName]);
}

// ---------------------------------------------------------------------------
// Typed Domain Hooks
// ---------------------------------------------------------------------------

// Re-export types from the old UI for compatibility
// These match the actual gateway RPC response shapes.

export interface GatewayAgentRow {
  id: string;
  name?: string;
  identity?: {
    name?: string;
    theme?: string;
    emoji?: string;
    avatar?: string;
    avatarUrl?: string;
  };
}

export interface AgentsListResult {
  defaultId: string;
  mainKey: string;
  scope: string;
  agents: GatewayAgentRow[];
}

export interface AgentIdentityResult {
  agentId: string;
  name: string;
  avatar: string;
  emoji?: string;
}

export interface AgentFileEntry {
  name: string;
  path: string;
  missing: boolean;
  size?: number;
  updatedAtMs?: number;
  content?: string;
}

export interface AgentsFilesListResult {
  agentId: string;
  workspace: string;
  files: AgentFileEntry[];
}

export interface AgentsFilesGetResult {
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export interface AgentsFilesSetResult {
  ok: true;
  agentId: string;
  workspace: string;
  file: AgentFileEntry;
}

export interface ConfigSnapshot {
  path?: string | null;
  exists?: boolean | null;
  raw?: string | null;
  hash?: string | null;
  parsed?: unknown;
  valid?: boolean | null;
  config?: Record<string, unknown> | null;
  issues?: Array<{ path: string; message: string }> | null;
}

export interface ConfigSchemaResponse {
  schema: unknown;
  uiHints: Record<string, unknown>;
  version: string;
  generatedAt: string;
}

export interface SkillStatusEntry {
  name: string;
  description: string;
  source: string;
  filePath: string;
  baseDir: string;
  skillKey: string;
  bundled?: boolean;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always: boolean;
  disabled: boolean;
  blockedByAllowlist: boolean;
  eligible: boolean;
  requirements: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  missing: {
    bins: string[];
    env: string[];
    config: string[];
    os: string[];
  };
  configChecks: Array<{ path: string; satisfied: boolean }>;
  install: Array<{ id: string; kind: string; label: string; bins: string[] }>;
}

export interface SkillStatusReport {
  workspaceDir: string;
  managedSkillsDir: string;
  skills: SkillStatusEntry[];
}

export interface SessionRow {
  key: string;
  kind: "direct" | "group" | "global" | "unknown";
  label?: string;
  displayName?: string;
  surface?: string;
  updatedAt: number | null;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  thinkingLevel?: string;
}

export interface SessionsListResult {
  ts: number;
  path: string;
  count: number;
  defaults: { model: string | null; contextTokens: number | null };
  sessions: SessionRow[];
}

export interface ModelEntry {
  id: string;
  provider: string;
  name?: string;
  description?: string;
  contextWindow?: number;
  supportsVision?: boolean;
  supportsTools?: boolean;
}

export interface ModelsListResult {
  models: ModelEntry[];
}

export interface CronJob {
  id: string;
  agentId?: string;
  name: string;
  description?: string;
  enabled: boolean;
  createdAtMs: number;
  updatedAtMs: number;
  schedule: unknown;
  sessionTarget: string;
  wakeMode: string;
  payload: unknown;
  delivery?: unknown;
  state?: {
    nextRunAtMs?: number;
    runningAtMs?: number;
    lastRunAtMs?: number;
    lastStatus?: string;
    lastError?: string;
    lastDurationMs?: number;
  };
}

export interface CronListResult {
  jobs: CronJob[];
}

export interface CronStatusResult {
  enabled: boolean;
  jobs: number;
  nextWakeAtMs?: number | null;
}

export interface HealthResult {
  ts: number;
  ok: boolean;
  version?: string;
  uptime?: number;
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Query Key Factories
// ---------------------------------------------------------------------------

export const queryKeys = {
  agents: {
    all: ["agents"] as const,
    list: () => ["agents.list", {}] as const,
    identity: (agentId: string) => ["agent.identity.get", { agentId }] as const,
    files: (agentId: string) => ["agents.files.list", { agentId }] as const,
    file: (agentId: string, name: string) => ["agents.files.get", { agentId, name }] as const,
  },
  config: {
    get: () => ["config.get", {}] as const,
    schema: () => ["config.schema", {}] as const,
  },
  models: {
    list: () => ["models.list", {}] as const,
  },
  sessions: {
    list: () => ["sessions.list", {}] as const,
    usage: (params: Record<string, unknown>) => ["sessions.usage", params] as const,
  },
  skills: {
    status: () => ["skills.status", {}] as const,
  },
  channels: {
    status: () => ["channels.status", {}] as const,
  },
  cron: {
    list: () => ["cron.list", {}] as const,
    status: () => ["cron.status", {}] as const,
  },
  health: () => ["health", {}] as const,
  status: () => ["status", {}] as const,
} as const;

// ---------------------------------------------------------------------------
// Typed Query Hooks
// ---------------------------------------------------------------------------

/** Fetch all agents from the gateway. */
export function useLiveAgents() {
  return useGatewayQuery<AgentsListResult>(
    "agents.list",
    { scope: "all" },
    { staleTime: 60_000 },
  );
}

/** Fetch identity (name, avatar, emoji) for a single agent. */
export function useLiveAgentIdentity(agentId: string | undefined) {
  return useGatewayQuery<AgentIdentityResult | null>(
    "agent.identity.get",
    { agentId: agentId! },
    { enabled: !!agentId, staleTime: 120_000 },
  );
}

/** Fetch the file manifest for an agent workspace. */
export function useLiveAgentFiles(agentId: string | undefined) {
  return useGatewayQuery<AgentsFilesListResult>(
    "agents.files.list",
    { agentId: agentId! },
    { enabled: !!agentId, staleTime: 30_000 },
  );
}

/** Fetch a single agent file's content. */
export function useLiveAgentFile(agentId: string | undefined, fileName: string | undefined) {
  return useGatewayQuery<AgentsFilesGetResult>(
    "agents.files.get",
    { agentId: agentId!, name: fileName! },
    { enabled: !!agentId && !!fileName, staleTime: 15_000 },
  );
}

/** Fetch the full config snapshot. */
export function useLiveConfig() {
  return useGatewayQuery<ConfigSnapshot>(
    "config.get",
    {},
    { staleTime: 30_000 },
  );
}

/** Fetch the config JSON schema + UI hints. */
export function useLiveConfigSchema() {
  return useGatewayQuery<ConfigSchemaResponse>(
    "config.schema",
    {},
    { staleTime: 300_000 },
  );
}

/** Fetch all available models. */
export function useLiveModels() {
  return useGatewayQuery<ModelsListResult>(
    "models.list",
    {},
    { staleTime: 120_000 },
  );
}

/** Fetch session list. */
export function useLiveSessions() {
  return useGatewayQuery<SessionsListResult>(
    "sessions.list",
    {},
    { staleTime: 15_000 },
  );
}

/** Fetch skills status report. */
export function useLiveSkills() {
  return useGatewayQuery<SkillStatusReport>(
    "skills.status",
    {},
    { staleTime: 60_000 },
  );
}

/** Fetch channel status. */
export function useLiveChannels() {
  return useGatewayQuery<Record<string, unknown>>(
    "channels.status",
    {},
    { staleTime: 30_000 },
  );
}

/** Fetch cron job list. */
export function useLiveCronJobs() {
  return useGatewayQuery<CronListResult>(
    "cron.list",
    {},
    { staleTime: 30_000 },
  );
}

/** Fetch cron status. */
export function useLiveCronStatus() {
  return useGatewayQuery<CronStatusResult>(
    "cron.status",
    {},
    { staleTime: 30_000 },
  );
}

/** Fetch gateway health. */
export function useLiveHealth() {
  return useGatewayQuery<HealthResult>(
    "health",
    {},
    { staleTime: 15_000, refetchInterval: 30_000 },
  );
}

// ---------------------------------------------------------------------------
// Typed Mutation Hooks
// ---------------------------------------------------------------------------

/** Save an agent file (SOUL.md, AGENTS.md, etc.). */
export function useSaveAgentFile() {
  return useGatewayMutation<
    { agentId: string; name: string; content: string },
    AgentsFilesSetResult
  >("agents.files.set", {
    invalidate: [["agents.files.list"], ["agents.files.get"]],
  });
}

/** Apply a config patch (raw JSON string). */
export function useApplyConfig() {
  return useGatewayMutation<
    { baseHash: string; raw: string; sessionKey?: string; note?: string },
    { ok: boolean; path: string; config: Record<string, unknown> }
  >("config.set", {
    invalidate: [["config.get"]],
  });
}

/** Send a chat message. */
export function useSendChat() {
  return useGatewayMutation<
    { sessionKey: string; message: string; attachments?: unknown[] },
    unknown
  >("chat.send");
}

/** Abort an active chat run. */
export function useAbortChat() {
  return useGatewayMutation<
    { sessionKey: string },
    unknown
  >("chat.abort");
}

/** Fetch chat history (mutation because it's an on-demand fetch, not cached). */
export function useChatHistory() {
  return useGatewayMutation<
    { sessionKey: string; limit?: number; before?: string },
    { messages: unknown[] }
  >("chat.history");
}

/** Toggle a skill on/off. */
export function useUpdateSkill() {
  return useGatewayMutation<
    { skillKey: string; enabled: boolean },
    unknown
  >("skills.update", {
    invalidate: [["skills.status"]],
  });
}

/** Add a cron job. */
export function useAddCronJob() {
  return useGatewayMutation<Record<string, unknown>, unknown>("cron.add", {
    invalidate: [["cron.list"], ["cron.status"]],
  });
}

/** Update a cron job. */
export function useUpdateCronJob() {
  return useGatewayMutation<Record<string, unknown>, unknown>("cron.update", {
    invalidate: [["cron.list"], ["cron.status"]],
  });
}

/** Remove a cron job. */
export function useRemoveCronJob() {
  return useGatewayMutation<{ id: string }, unknown>("cron.remove", {
    invalidate: [["cron.list"], ["cron.status"]],
  });
}

/** Delete a session. */
export function useDeleteSession() {
  return useGatewayMutation<{ key: string }, unknown>("sessions.delete", {
    invalidate: [["sessions.list"]],
  });
}

/** Patch session settings. */
export function usePatchSession() {
  return useGatewayMutation<
    { key: string; thinkingLevel?: string; reasoningLevel?: string },
    unknown
  >("sessions.patch", {
    invalidate: [["sessions.list"]],
  });
}

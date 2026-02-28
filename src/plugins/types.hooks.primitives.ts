/**
 * Hook event/result types for before_agent_run and before_message_route
 *
 * Extracted from types.ts to keep that file focused on the existing hook
 * surface. types.ts re-exports everything here.
 */

// ---------------------------------------------------------------------------
// P3: Run Gating Hook — before_agent_run
// ---------------------------------------------------------------------------

export type PluginHookBeforeAgentRunEvent = {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
  prompt: string;
  /** Resolved provider for this run (after before_model_resolve). */
  provider: string;
  /** Resolved model id for this run (after before_model_resolve). */
  model: string;
  /** Routing metadata from before_model_resolve, if any. */
  routingMetadata?: Record<string, unknown>;
};

export type PluginHookBeforeAgentRunResult = {
  /**
   * When true, the run is rejected and not executed.
   * The session receives `rejectUserMessage` (or a generic rejection message).
   */
  reject?: boolean;
  /** Internal reason for the rejection (logged, not shown to users). */
  rejectReason?: string;
  /** Message returned to the session when rejected. Defaults to a generic error. */
  rejectUserMessage?: string;
};

// ---------------------------------------------------------------------------
// P7: Message Routing Hook — before_message_route
// ---------------------------------------------------------------------------

export type PluginHookBeforeMessageRouteEvent = {
  /** The inbound channel identifier (e.g. "telegram", "discord", "slack"). */
  channelId: string;
  /** The channel account/bot identity (empty string if default). */
  accountId?: string;
  /** Sender identifier (phone, user ID, etc.). */
  from?: string;
  /** Raw inbound message content. */
  content?: string;
  /** Conversation/thread identifier. */
  conversationId?: string;
  /** Platform-specific group/guild identifier. */
  guildId?: string;
  /** Platform-specific team identifier. */
  teamId?: string;
};

export type PluginHookBeforeMessageRouteResult = {
  /** Override the resolved agent ID. Takes precedence over bindings. */
  agentId?: string;
  /**
   * Override the full session key (bypasses all routing logic).
   * Use this when you need to route to a specific session, not just an agent.
   */
  sessionKey?: string;
  /** When true, skip processing this message entirely (drop it). */
  skip?: boolean;
};

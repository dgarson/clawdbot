/**
 * Plugin Hook Runner
 *
 * Provides utilities for executing plugin lifecycle hooks with proper
 * error handling, priority ordering, and async support.
 */

import type { PluginRegistry } from "./registry.js";
import type {
  PluginHookAfterCompactionEvent,
  PluginHookAfterToolCallEvent,
  PluginHookAgentContext,
  PluginHookAgentEndEvent,
  PluginHookBeforeAgentRunEvent,
  PluginHookBeforeAgentRunResult,
  PluginHookBeforeAgentStartEvent,
  PluginHookBeforeAgentStartResult,
  PluginHookBeforeMessageRouteEvent,
  PluginHookBeforeMessageRouteResult,
  PluginHookBeforeModelResolveEvent,
  PluginHookBeforeModelResolveResult,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
  PluginHookBeforeCompactionEvent,
  PluginHookBeforeSessionCreateEvent,
  PluginHookBeforeSessionCreateResult,
  PluginHookMessageContextBuildEvent,
  PluginHookMessageContextBuildResult,
  PluginHookLlmInputEvent,
  PluginHookLlmOutputEvent,
  PluginHookBeforeResetEvent,
  PluginHookBeforeSessionEndEvent,
  PluginHookBeforeSessionEndResult,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookGatewayContext,
  PluginHookGatewayStartEvent,
  PluginHookGatewayStopEvent,
  PluginHookMessageContext,
  PluginHookMessageReceivedEvent,
  PluginHookMessageSendingEvent,
  PluginHookMessageSendingResult,
  PluginHookMessageSentEvent,
  PluginHookName,
  PluginHookRegistration,
  PluginHookSessionContext,
  PluginHookSessionEndEvent,
  PluginHookSessionStartEvent,
  PluginHookSubagentContext,
  PluginHookSubagentDeliveryTargetEvent,
  PluginHookSubagentDeliveryTargetResult,
  PluginHookSubagentSpawningEvent,
  PluginHookSubagentSpawningResult,
  PluginHookSubagentEndedEvent,
  PluginHookSubagentSpawnedEvent,
  PluginHookToolContext,
  PluginHookToolResultPersistContext,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistResult,
  PluginHookBeforeMessageWriteEvent,
  PluginHookBeforeMessageWriteResult,
  PluginHookAfterToolCallResult,
  PluginHookBeforeSubagentSpawnEvent,
  PluginHookBeforeSubagentSpawnResult,
} from "./types.js";

// Re-export types for consumers
export type {
  PluginHookAgentContext,
  PluginHookBeforeAgentStartEvent,
  PluginHookBeforeAgentStartResult,
  PluginHookBeforeModelResolveEvent,
  PluginHookBeforeModelResolveResult,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
  PluginHookLlmInputEvent,
  PluginHookLlmOutputEvent,
  PluginHookAgentEndEvent,
  PluginHookBeforeSessionEndEvent,
  PluginHookBeforeSessionEndResult,
  PluginHookBeforeCompactionEvent,
  PluginHookBeforeResetEvent,
  PluginHookAfterCompactionEvent,
  PluginHookBeforeSessionCreateEvent,
  PluginHookBeforeSessionCreateResult,
  PluginHookMessageContext,
  PluginHookMessageReceivedEvent,
  PluginHookMessageSendingEvent,
  PluginHookMessageSendingResult,
  PluginHookMessageSentEvent,
  PluginHookToolContext,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookAfterToolCallEvent,
  PluginHookAfterToolCallResult,
  PluginHookBeforeSubagentSpawnEvent,
  PluginHookBeforeSubagentSpawnResult,
  PluginHookToolResultPersistContext,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistResult,
  PluginHookBeforeMessageWriteEvent,
  PluginHookBeforeMessageWriteResult,
  PluginHookSessionContext,
  PluginHookSessionStartEvent,
  PluginHookSessionEndEvent,
  PluginHookSubagentContext,
  PluginHookSubagentDeliveryTargetEvent,
  PluginHookSubagentDeliveryTargetResult,
  PluginHookSubagentSpawningEvent,
  PluginHookSubagentSpawningResult,
  PluginHookSubagentSpawnedEvent,
  PluginHookSubagentEndedEvent,
  PluginHookGatewayContext,
  PluginHookGatewayStartEvent,
  PluginHookGatewayStopEvent,
  PluginHookMessageContextBuildEvent,
  PluginHookMessageContextBuildResult,
};

export type HookRunnerLogger = {
  debug?: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

export type HookRunnerOptions = {
  logger?: HookRunnerLogger;
  /** If true, errors in hooks will be caught and logged instead of thrown */
  catchErrors?: boolean;
};

/**
 * Get hooks for a specific hook name, sorted by priority (higher first).
 */
function getHooksForName<K extends PluginHookName>(
  registry: PluginRegistry,
  hookName: K,
): PluginHookRegistration<K>[] {
  return (registry.typedHooks as PluginHookRegistration<K>[])
    .filter((h) => h.hookName === hookName)
    .toSorted((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

/**
 * Create a hook runner for a specific registry.
 */
export function createHookRunner(registry: PluginRegistry, options: HookRunnerOptions = {}) {
  const logger = options.logger;
  const catchErrors = options.catchErrors ?? true;
  const failClosedHooks = new Set<PluginHookName>([
    "before_agent_run",
    "before_tool_call",
    "before_subagent_spawn",
  ]);

  const mergeBeforeModelResolve = (
    acc: PluginHookBeforeModelResolveResult | undefined,
    next: PluginHookBeforeModelResolveResult,
  ): PluginHookBeforeModelResolveResult => ({
    // Keep the first defined override so higher-priority hooks win.
    modelOverride: acc?.modelOverride ?? next.modelOverride,
    providerOverride: acc?.providerOverride ?? next.providerOverride,
    // Merge fallbacks: accumulate from all hooks, first-defined reason wins.
    fallbacks: [...(acc?.fallbacks ?? []), ...(next.fallbacks ?? [])].filter(
      (f): f is NonNullable<typeof f> => Boolean(f),
    ),
    reason: acc?.reason ?? next.reason,
    // Shallow-merge routingMetadata from all hooks.
    routingMetadata: { ...next.routingMetadata, ...acc?.routingMetadata },
  });

  const mergeBeforeAgentRun = (
    acc: PluginHookBeforeAgentRunResult | undefined,
    next: PluginHookBeforeAgentRunResult,
  ): PluginHookBeforeAgentRunResult => ({
    // Once any hook rejects, keep that rejection (first reject wins).
    reject: acc?.reject ?? next.reject,
    rejectReason: acc?.rejectReason ?? next.rejectReason,
    rejectUserMessage: acc?.rejectUserMessage ?? next.rejectUserMessage,
  });

  const mergeBeforeMessageRoute = (
    acc: PluginHookBeforeMessageRouteResult | undefined,
    next: PluginHookBeforeMessageRouteResult,
  ): PluginHookBeforeMessageRouteResult => ({
    // First defined agentId/sessionKey wins; skip is sticky.
    agentId: acc?.agentId ?? next.agentId,
    sessionKey: acc?.sessionKey ?? next.sessionKey,
    skip: acc?.skip ?? next.skip,
  });

  const mergeBeforePromptBuild = (
    acc: PluginHookBeforePromptBuildResult | undefined,
    next: PluginHookBeforePromptBuildResult,
  ): PluginHookBeforePromptBuildResult => ({
    systemPrompt: next.systemPrompt ?? acc?.systemPrompt,
    prependContext:
      acc?.prependContext && next.prependContext
        ? `${acc.prependContext}\n\n${next.prependContext}`
        : (next.prependContext ?? acc?.prependContext),
  });

  const mergeSubagentSpawningResult = (
    acc: PluginHookSubagentSpawningResult | undefined,
    next: PluginHookSubagentSpawningResult,
  ): PluginHookSubagentSpawningResult => {
    if (acc?.status === "error") {
      return acc;
    }
    if (next.status === "error") {
      return next;
    }
    return {
      status: "ok",
      threadBindingReady: Boolean(acc?.threadBindingReady || next.threadBindingReady),
    };
  };

  const mergeSubagentDeliveryTargetResult = (
    acc: PluginHookSubagentDeliveryTargetResult | undefined,
    next: PluginHookSubagentDeliveryTargetResult,
  ): PluginHookSubagentDeliveryTargetResult => {
    if (acc?.origin) {
      return acc;
    }
    return next;
  };

  const handleHookError = (params: {
    hookName: PluginHookName;
    pluginId: string;
    error: unknown;
  }): never | void => {
    const msg = `[hooks] ${params.hookName} handler from ${params.pluginId} failed: ${String(
      params.error,
    )}`;
    if (catchErrors && !failClosedHooks.has(params.hookName)) {
      logger?.warn(msg);
      logger?.error(msg);
      return;
    }
    throw new Error(msg, { cause: params.error });
  };

  /**
   * Run a hook that doesn't return a value (fire-and-forget style).
   * All handlers are executed in parallel for performance.
   */
  async function runVoidHook<K extends PluginHookName>(
    hookName: K,
    event: Parameters<NonNullable<PluginHookRegistration<K>["handler"]>>[0],
    ctx: Parameters<NonNullable<PluginHookRegistration<K>["handler"]>>[1],
  ): Promise<void> {
    const hooks = getHooksForName(registry, hookName);
    if (hooks.length === 0) {
      return;
    }

    const promises = hooks.map(async (hook) => {
      const start = Date.now();
      try {
        await (hook.handler as (event: unknown, ctx: unknown) => Promise<void>)(event, ctx);
        const elapsed = Date.now() - start;
        if (elapsed > 100) {
          logger?.debug?.(`[hooks] ${hookName} handler ${hook.pluginId} took ${elapsed}ms`);
        }
      } catch (err) {
        handleHookError({ hookName, pluginId: hook.pluginId, error: err });
      }
    });

    await Promise.all(promises);
  }

  /**
   * Run a hook that can return a modifying result.
   * Handlers are executed sequentially in priority order, and results are merged.
   */
  async function runModifyingHook<K extends PluginHookName, TResult>(
    hookName: K,
    event: Parameters<NonNullable<PluginHookRegistration<K>["handler"]>>[0],
    ctx: Parameters<NonNullable<PluginHookRegistration<K>["handler"]>>[1],
    mergeResults?: (accumulated: TResult | undefined, next: TResult, pluginId: string) => TResult,
  ): Promise<TResult | undefined> {
    const hooks = getHooksForName(registry, hookName);
    if (hooks.length === 0) {
      return undefined;
    }

    let result: TResult | undefined;

    for (const hook of hooks) {
      const start = Date.now();
      try {
        const handlerResult = await (
          hook.handler as (event: unknown, ctx: unknown) => Promise<TResult>
        )(event, ctx);

        const elapsed = Date.now() - start;
        if (elapsed > 100) {
          logger?.debug?.(`[hooks] ${hookName} handler ${hook.pluginId} took ${elapsed}ms`);
        }

        if (handlerResult !== undefined && handlerResult !== null) {
          const resultStr = JSON.stringify(handlerResult) ?? "undefined";
          logger?.debug?.(
            `[hooks] ${hookName} handler ${hook.pluginId} returned mutation: ${resultStr.length > 200 ? resultStr.substring(0, 200) + "..." : resultStr}`,
          );
          if (mergeResults) {
            result = mergeResults(result, handlerResult, hook.pluginId);
          } else {
            result = handlerResult;
          }
        }
      } catch (err) {
        handleHookError({ hookName, pluginId: hook.pluginId, error: err });
      }
    }

    return result;
  }

  // =========================================================================
  // Agent Hooks
  // =========================================================================

  /**
   * Run before_model_resolve hook.
   * Allows plugins to override provider/model before model resolution.
   */
  async function runBeforeModelResolve(
    event: PluginHookBeforeModelResolveEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeModelResolveResult | undefined> {
    return runModifyingHook<"before_model_resolve", PluginHookBeforeModelResolveResult>(
      "before_model_resolve",
      event,
      ctx,
      mergeBeforeModelResolve,
    );
  }

  /**
   * Run before_message_route hook.
   * Fires before agent binding resolution. Plugins can override the target
   * agent/session or skip the message entirely (router agent pattern).
   *
   * This hook takes only an event argument (no agent context) because it fires
   * before any agent has been selected.
   */
  async function runBeforeMessageRoute(
    event: PluginHookBeforeMessageRouteEvent,
  ): Promise<PluginHookBeforeMessageRouteResult | undefined> {
    const hooks = getHooksForName(registry, "before_message_route");
    if (hooks.length === 0) {
      return undefined;
    }

    let result: PluginHookBeforeMessageRouteResult | undefined;

    for (const hook of hooks) {
      const start = Date.now();
      try {
        const handlerResult = await (
          hook.handler as (
            event: PluginHookBeforeMessageRouteEvent,
          ) => Promise<PluginHookBeforeMessageRouteResult>
        )(event);

        const elapsed = Date.now() - start;
        if (elapsed > 100) {
          logger?.debug?.(
            `[hooks] before_message_route handler ${hook.pluginId} took ${elapsed}ms`,
          );
        }

        if (handlerResult !== undefined && handlerResult !== null) {
          const resultStr = JSON.stringify(handlerResult) ?? "undefined";
          logger?.debug?.(
            `[hooks] before_message_route handler ${hook.pluginId} returned mutation: ${resultStr.length > 200 ? resultStr.substring(0, 200) + "..." : resultStr}`,
          );
          result =
            result !== undefined ? mergeBeforeMessageRoute(result, handlerResult) : handlerResult;
        }
      } catch (err) {
        handleHookError({ hookName: "before_message_route", pluginId: hook.pluginId, error: err });
      }
    }

    return result;
  }

  /**
   * Run before_agent_run hook.
   * Fires after model resolution, before the LLM call. Plugins can reject
   * the run with a reason (budget enforcement, HITL gates, rate limiting).
   */
  async function runBeforeAgentRun(
    event: PluginHookBeforeAgentRunEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeAgentRunResult | undefined> {
    return runModifyingHook<"before_agent_run", PluginHookBeforeAgentRunResult>(
      "before_agent_run",
      event,
      ctx,
      mergeBeforeAgentRun,
    );
  }

  /**
   * Run before_prompt_build hook.
   * Allows plugins to inject context and system prompt before prompt submission.
   */
  async function runBeforePromptBuild(
    event: PluginHookBeforePromptBuildEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforePromptBuildResult | undefined> {
    return runModifyingHook<"before_prompt_build", PluginHookBeforePromptBuildResult>(
      "before_prompt_build",
      event,
      ctx,
      mergeBeforePromptBuild,
    );
  }

  /**
   * Run before_agent_start hook.
   * Legacy compatibility hook that combines model resolve + prompt build phases.
   */
  async function runBeforeAgentStart(
    event: PluginHookBeforeAgentStartEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeAgentStartResult | undefined> {
    return runModifyingHook<"before_agent_start", PluginHookBeforeAgentStartResult>(
      "before_agent_start",
      event,
      ctx,
      (acc, next) => ({
        ...mergeBeforePromptBuild(acc, next),
        ...mergeBeforeModelResolve(acc, next),
      }),
    );
  }

  /**
   * Run agent_end hook.
   * Allows plugins to analyze completed conversations.
   * Runs in parallel (fire-and-forget).
   */
  async function runAgentEnd(
    event: PluginHookAgentEndEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    return runVoidHook("agent_end", event, ctx);
  }

  const mergeBeforeSessionEnd = (
    acc: PluginHookBeforeSessionEndResult | undefined,
    next: PluginHookBeforeSessionEndResult,
  ): PluginHookBeforeSessionEndResult => ({
    continuationPrompt: acc?.continuationPrompt ?? next.continuationPrompt,
    reason: acc?.reason ?? next.reason,
  });

  /**
   * Run before_session_end hook.
   * Fires just before a successful run finalizes. Plugins may request a
   * continuation by returning { continuationPrompt }.
   * Runs sequentially (modifying).
   */
  async function runBeforeSessionEnd(
    event: PluginHookBeforeSessionEndEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeSessionEndResult | undefined> {
    return runModifyingHook<"before_session_end", PluginHookBeforeSessionEndResult>(
      "before_session_end",
      event,
      ctx,
      mergeBeforeSessionEnd,
    );
  }

  /**
   * Run llm_input hook.
   * Allows plugins to observe the exact input payload sent to the LLM.
   * Runs in parallel (fire-and-forget).
   */
  async function runLlmInput(event: PluginHookLlmInputEvent, ctx: PluginHookAgentContext) {
    return runVoidHook("llm_input", event, ctx);
  }

  /**
   * Run llm_output hook.
   * Allows plugins to observe the exact output payload returned by the LLM.
   * Runs in parallel (fire-and-forget).
   */
  async function runLlmOutput(event: PluginHookLlmOutputEvent, ctx: PluginHookAgentContext) {
    return runVoidHook("llm_output", event, ctx);
  }

  /**
   * Run before_compaction hook.
   */
  async function runBeforeCompaction(
    event: PluginHookBeforeCompactionEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    return runVoidHook("before_compaction", event, ctx);
  }

  /**
   * Run after_compaction hook.
   */
  async function runAfterCompaction(
    event: PluginHookAfterCompactionEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    return runVoidHook("after_compaction", event, ctx);
  }

  /**
   * Run before_reset hook.
   * Fired when /new or /reset clears a session, before messages are lost.
   * Runs in parallel (fire-and-forget).
   */
  async function runBeforeReset(
    event: PluginHookBeforeResetEvent,
    ctx: PluginHookAgentContext,
  ): Promise<void> {
    return runVoidHook("before_reset", event, ctx);
  }

  // =========================================================================
  // Message Hooks
  // =========================================================================

  /**
   * Run message_received hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runMessageReceived(
    event: PluginHookMessageReceivedEvent,
    ctx: PluginHookMessageContext,
  ): Promise<void> {
    return runVoidHook("message_received", event, ctx);
  }

  /**
   * Run message_sending hook.
   * Allows plugins to modify or cancel outgoing messages.
   * Runs sequentially.
   */
  async function runMessageSending(
    event: PluginHookMessageSendingEvent,
    ctx: PluginHookMessageContext,
  ): Promise<PluginHookMessageSendingResult | undefined> {
    return runModifyingHook<"message_sending", PluginHookMessageSendingResult>(
      "message_sending",
      event,
      ctx,
      (acc, next) => ({
        content: next.content ?? acc?.content,
        cancel: next.cancel ?? acc?.cancel,
      }),
    );
  }

  /**
   * Run message_sent hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runMessageSent(
    event: PluginHookMessageSentEvent,
    ctx: PluginHookMessageContext,
  ): Promise<void> {
    return runVoidHook("message_sent", event, ctx);
  }

  // =========================================================================
  // Tool Hooks
  // =========================================================================

  /**
   * Run before_tool_call hook.
   * Allows plugins to modify or block tool calls.
   * Runs sequentially.
   */
  async function runBeforeToolCall(
    event: PluginHookBeforeToolCallEvent,
    ctx: PluginHookToolContext,
  ): Promise<PluginHookBeforeToolCallResult | undefined> {
    return runModifyingHook<"before_tool_call", PluginHookBeforeToolCallResult>(
      "before_tool_call",
      event,
      ctx,
      (acc, next) => ({
        params: next.params ?? acc?.params,
        // Block decisions are fail-closed/sticky.
        block: Boolean(acc?.block || next.block),
        blockReason: acc?.blockReason ?? next.blockReason,
      }),
    );
  }

  const mergeAfterToolCall = (
    acc: PluginHookAfterToolCallResult | undefined,
    next: PluginHookAfterToolCallResult,
  ): PluginHookAfterToolCallResult => ({
    // First non-empty resultOverride wins so higher-priority hooks take precedence.
    resultOverride: acc?.resultOverride ?? next.resultOverride,
  });

  /**
   * Run after_tool_call hook.
   * Now modifying: handlers may return { resultOverride } to rewrite the tool
   * result before the LLM sees it.
   */
  async function runAfterToolCall(
    event: PluginHookAfterToolCallEvent,
    ctx: PluginHookToolContext,
  ): Promise<PluginHookAfterToolCallResult | undefined> {
    return runModifyingHook<"after_tool_call", PluginHookAfterToolCallResult>(
      "after_tool_call",
      event,
      ctx,
      mergeAfterToolCall,
    );
  }

  const mergeBeforeSubagentSpawn = (
    acc: PluginHookBeforeSubagentSpawnResult | undefined,
    next: PluginHookBeforeSubagentSpawnResult,
  ): PluginHookBeforeSubagentSpawnResult => ({
    // reject is sticky — once any hook rejects, the spawn is blocked.
    reject: acc?.reject || next.reject,
    rejectReason: acc?.rejectReason ?? next.rejectReason,
    // First defined override wins (highest-priority hook).
    agentIdOverride: acc?.agentIdOverride ?? next.agentIdOverride,
    taskOverride: acc?.taskOverride ?? next.taskOverride,
    // Deep-merge metadata from all hooks.
    metadataOverride: { ...next.metadataOverride, ...acc?.metadataOverride },
  });

  /**
   * Run before_subagent_spawn hook.
   * Fires for every spawn, before any resources are allocated.
   * Handlers may reject the spawn or override agent/task/metadata.
   */
  async function runBeforeSubagentSpawn(
    event: PluginHookBeforeSubagentSpawnEvent,
    ctx: PluginHookSubagentContext,
  ): Promise<PluginHookBeforeSubagentSpawnResult | undefined> {
    return runModifyingHook<"before_subagent_spawn", PluginHookBeforeSubagentSpawnResult>(
      "before_subagent_spawn",
      event,
      ctx,
      mergeBeforeSubagentSpawn,
    );
  }

  /**
   * Run tool_result_persist hook.
   *
   * This hook is intentionally synchronous: it runs in hot paths where session
   * transcripts are appended synchronously.
   *
   * Handlers are executed sequentially in priority order (higher first). Each
   * handler may return `{ message }` to replace the message passed to the next
   * handler.
   */
  function runToolResultPersist(
    event: PluginHookToolResultPersistEvent,
    ctx: PluginHookToolResultPersistContext,
  ): PluginHookToolResultPersistResult | undefined {
    const hooks = getHooksForName(registry, "tool_result_persist");
    if (hooks.length === 0) {
      return undefined;
    }

    let current = event.message;

    for (const hook of hooks) {
      try {
        // oxlint-disable-next-line typescript/no-explicit-any
        const out = (hook.handler as any)({ ...event, message: current }, ctx) as
          | PluginHookToolResultPersistResult
          | void
          | Promise<unknown>;

        // Guard against accidental async handlers (this hook is sync-only).
        // oxlint-disable-next-line typescript/no-explicit-any
        if (out && typeof (out as any).then === "function") {
          const msg =
            `[hooks] tool_result_persist handler from ${hook.pluginId} returned a Promise; ` +
            `this hook is synchronous and the result was ignored.`;
          if (catchErrors) {
            logger?.warn?.(msg);
            continue;
          }
          throw new Error(msg);
        }

        const next = (out as PluginHookToolResultPersistResult | undefined)?.message;
        if (next) {
          current = next;
        }
      } catch (err) {
        const msg = `[hooks] tool_result_persist handler from ${hook.pluginId} failed: ${String(err)}`;
        if (catchErrors) {
          logger?.error(msg);
        } else {
          throw new Error(msg, { cause: err });
        }
      }
    }

    return { message: current };
  }

  // =========================================================================
  // Message Write Hooks
  // =========================================================================

  /**
   * Run before_message_write hook.
   *
   * This hook is intentionally synchronous: it runs on the hot path where
   * session transcripts are appended synchronously.
   *
   * Handlers are executed sequentially in priority order (higher first).
   * If any handler returns { block: true }, the message is NOT written
   * to the session JSONL and we return immediately.
   * If a handler returns { message }, the modified message replaces the
   * original for subsequent handlers and the final write.
   */
  function runBeforeMessageWrite(
    event: PluginHookBeforeMessageWriteEvent,
    ctx: { agentId?: string; sessionKey?: string },
  ): PluginHookBeforeMessageWriteResult | undefined {
    const hooks = getHooksForName(registry, "before_message_write");
    if (hooks.length === 0) {
      return undefined;
    }

    let current = event.message;

    for (const hook of hooks) {
      try {
        // oxlint-disable-next-line typescript/no-explicit-any
        const out = (hook.handler as any)({ ...event, message: current }, ctx) as
          | PluginHookBeforeMessageWriteResult
          | void
          | Promise<unknown>;

        // Guard against accidental async handlers (this hook is sync-only).
        // oxlint-disable-next-line typescript/no-explicit-any
        if (out && typeof (out as any).then === "function") {
          const msg =
            `[hooks] before_message_write handler from ${hook.pluginId} returned a Promise; ` +
            `this hook is synchronous and the result was ignored.`;
          if (catchErrors) {
            logger?.warn?.(msg);
            continue;
          }
          throw new Error(msg);
        }

        const result = out as PluginHookBeforeMessageWriteResult | undefined;

        // If any handler blocks, return immediately.
        if (result?.block) {
          return { block: true };
        }

        // If handler provided a modified message, use it for subsequent handlers.
        if (result?.message) {
          current = result.message;
        }
      } catch (err) {
        const msg = `[hooks] before_message_write handler from ${hook.pluginId} failed: ${String(err)}`;
        if (catchErrors) {
          logger?.error(msg);
        } else {
          throw new Error(msg, { cause: err });
        }
      }
    }

    // If message was modified by any handler, return it.
    if (current !== event.message) {
      return { message: current };
    }

    return undefined;
  }

  // =========================================================================
  // Session Hooks
  // =========================================================================

  /**
   * Run before_session_create hook.
   * Fired in createClaudeSdkSession() before the session state object is built.
   * Each subscriber may contribute systemPromptSections and tools; results are
   * accumulated (not replaced) across all subscribers in priority order.
   */
  async function runBeforeSessionCreate(
    event: PluginHookBeforeSessionCreateEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforeSessionCreateResult | undefined> {
    return runModifyingHook<"before_session_create", PluginHookBeforeSessionCreateResult>(
      "before_session_create",
      event,
      ctx,
      (acc, next, pluginId) => ({
        systemPromptSections: [
          ...(acc?.systemPromptSections ?? []),
          ...(next.systemPromptSections?.map((s) =>
            typeof s === "string"
              ? { text: s, source: `hook:${pluginId}` }
              : { ...s, source: s.source ?? `hook:${pluginId}` },
          ) ?? []),
        ],
        tools: [...(acc?.tools ?? []), ...(next.tools ?? [])],
      }),
    );
  }

  /**
   * Run session_start hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runSessionStart(
    event: PluginHookSessionStartEvent,
    ctx: PluginHookSessionContext,
  ): Promise<void> {
    return runVoidHook("session_start", event, ctx);
  }

  /**
   * Run session_end hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runSessionEnd(
    event: PluginHookSessionEndEvent,
    ctx: PluginHookSessionContext,
  ): Promise<void> {
    return runVoidHook("session_end", event, ctx);
  }

  /**
   * Run subagent_spawning hook.
   * Runs sequentially so channel plugins can deterministically provision session bindings.
   */
  async function runSubagentSpawning(
    event: PluginHookSubagentSpawningEvent,
    ctx: PluginHookSubagentContext,
  ): Promise<PluginHookSubagentSpawningResult | undefined> {
    return runModifyingHook<"subagent_spawning", PluginHookSubagentSpawningResult>(
      "subagent_spawning",
      event,
      ctx,
      mergeSubagentSpawningResult,
    );
  }

  /**
   * Run subagent_delivery_target hook.
   * Runs sequentially so channel plugins can deterministically resolve routing.
   */
  async function runSubagentDeliveryTarget(
    event: PluginHookSubagentDeliveryTargetEvent,
    ctx: PluginHookSubagentContext,
  ): Promise<PluginHookSubagentDeliveryTargetResult | undefined> {
    return runModifyingHook<"subagent_delivery_target", PluginHookSubagentDeliveryTargetResult>(
      "subagent_delivery_target",
      event,
      ctx,
      mergeSubagentDeliveryTargetResult,
    );
  }

  /**
   * Run subagent_spawned hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runSubagentSpawned(
    event: PluginHookSubagentSpawnedEvent,
    ctx: PluginHookSubagentContext,
  ): Promise<void> {
    return runVoidHook("subagent_spawned", event, ctx);
  }

  /**
   * Run subagent_ended hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runSubagentEnded(
    event: PluginHookSubagentEndedEvent,
    ctx: PluginHookSubagentContext,
  ): Promise<void> {
    return runVoidHook("subagent_ended", event, ctx);
  }

  // =========================================================================
  // Channel Context Hooks
  // =========================================================================

  /**
   * Run message_context_build hook.
   * Fires during channel message prepare so subscribers can contribute StructuredContextInput.
   * Uses "claim" semantics: first subscriber that returns a non-null structuredContext wins.
   */
  async function runMessageContextBuild(
    event: PluginHookMessageContextBuildEvent,
  ): Promise<PluginHookMessageContextBuildResult | undefined> {
    return runModifyingHook<"message_context_build", PluginHookMessageContextBuildResult>(
      "message_context_build",
      event,
      // Empty context — all relevant info is in the event itself
      {} as Record<string, never>,
      // First subscriber to return a structuredContext wins; ignore later ones.
      (acc, _next) => acc ?? _next,
    );
  }

  // =========================================================================
  // Gateway Hooks
  // =========================================================================

  /**
   * Run gateway_start hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runGatewayStart(
    event: PluginHookGatewayStartEvent,
    ctx: PluginHookGatewayContext,
  ): Promise<void> {
    return runVoidHook("gateway_start", event, ctx);
  }

  /**
   * Run gateway_stop hook.
   * Runs in parallel (fire-and-forget).
   */
  async function runGatewayStop(
    event: PluginHookGatewayStopEvent,
    ctx: PluginHookGatewayContext,
  ): Promise<void> {
    return runVoidHook("gateway_stop", event, ctx);
  }

  // =========================================================================
  // Utility
  // =========================================================================

  /**
   * Check if any hooks are registered for a given hook name.
   */
  function hasHooks(hookName: PluginHookName): boolean {
    return registry.typedHooks.some((h) => h.hookName === hookName);
  }

  /**
   * Get count of registered hooks for a given hook name.
   */
  function getHookCount(hookName: PluginHookName): number {
    return registry.typedHooks.filter((h) => h.hookName === hookName).length;
  }

  return {
    // Agent hooks
    runBeforeModelResolve,
    runBeforeAgentRun,
    runBeforeMessageRoute,
    runBeforePromptBuild,
    runBeforeAgentStart,
    runLlmInput,
    runLlmOutput,
    runAgentEnd,
    runBeforeSessionEnd,
    runBeforeCompaction,
    runAfterCompaction,
    runBeforeReset,
    // Message hooks
    runMessageReceived,
    runMessageSending,
    runMessageSent,
    // Tool hooks
    runBeforeToolCall,
    runAfterToolCall,
    runToolResultPersist,
    // Message write hooks
    runBeforeMessageWrite,
    // Session hooks
    runBeforeSessionCreate,
    runSessionStart,
    runSessionEnd,
    runBeforeSubagentSpawn,
    runSubagentSpawning,
    runSubagentDeliveryTarget,
    runSubagentSpawned,
    runSubagentEnded,
    // Channel context hooks
    runMessageContextBuild,
    // Gateway hooks
    runGatewayStart,
    runGatewayStop,
    // Utility
    hasHooks,
    getHookCount,
  };
}

export type HookRunner = ReturnType<typeof createHookRunner>;

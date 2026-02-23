import type { AgentEvent } from "@mariozechner/pi-agent-core";
import { emitAgentEvent } from "../infra/agent-events.js";
import { getGlobalHookRunner } from "../plugins/hook-runner-global.js";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";

export function handleAutoCompactionStart(
  ctx: EmbeddedPiSubscribeContext,
  evt?: AgentEvent & { pre_tokens?: number; trigger?: string },
) {
  ctx.state.compactionInFlight = true;
  ctx.incrementCompactionCount();
  ctx.ensureCompactionPromise();
  ctx.log.debug(`embedded run compaction start: runId=${ctx.params.runId}`);

  // pre_tokens and trigger are provided by the claude-sdk compact_boundary event.
  // For Pi compaction they are undefined (Pi does not surface this metadata).
  const preTokens = typeof evt?.pre_tokens === "number" ? evt.pre_tokens : undefined;
  const trigger = typeof evt?.trigger === "string" ? evt.trigger : undefined;

  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "compaction",
    data: {
      phase: "start",
      ...(preTokens != null ? { pre_tokens: preTokens } : {}),
      ...(trigger ? { trigger } : {}),
    },
  });
  void ctx.params.onAgentEvent?.({
    stream: "compaction",
    data: {
      phase: "start",
      ...(preTokens != null ? { pre_tokens: preTokens } : {}),
      ...(trigger ? { trigger } : {}),
    },
  });

  // Run before_compaction plugin hook (fire-and-forget)
  const hookRunner = getGlobalHookRunner();
  if (hookRunner?.hasHooks("before_compaction")) {
    void hookRunner
      .runBeforeCompaction(
        {
          messageCount: ctx.params.session.messages?.length ?? 0,
          // tokenCount is populated from the claude-sdk compact_metadata.pre_tokens
          // when available, giving hooks accurate pre-compaction context size.
          // For Pi compaction this field is omitted (Pi surfaces message count instead).
          ...(preTokens != null ? { tokenCount: preTokens } : {}),
        },
        {},
      )
      .catch((err) => {
        ctx.log.warn(`before_compaction hook failed: ${String(err)}`);
      });
  }
}

export function handleAutoCompactionEnd(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { willRetry?: unknown; pre_tokens?: number; trigger?: string },
) {
  ctx.state.compactionInFlight = false;
  const willRetry = Boolean(evt.willRetry);
  if (willRetry) {
    ctx.noteCompactionRetry();
    ctx.resetForCompactionRetry();
    ctx.log.debug(`embedded run compaction retry: runId=${ctx.params.runId}`);
  } else {
    ctx.maybeResolveCompactionWait();
  }

  const preTokens = typeof evt.pre_tokens === "number" ? evt.pre_tokens : undefined;
  const trigger = typeof evt.trigger === "string" ? evt.trigger : undefined;
  const compactionMeta = {
    ...(preTokens != null ? { pre_tokens: preTokens } : {}),
    ...(trigger ? { trigger } : {}),
  };

  emitAgentEvent({
    runId: ctx.params.runId,
    stream: "compaction",
    data: { phase: "end", willRetry, ...compactionMeta },
  });
  void ctx.params.onAgentEvent?.({
    stream: "compaction",
    data: { phase: "end", willRetry, ...compactionMeta },
  });

  // Run after_compaction plugin hook (fire-and-forget)
  if (!willRetry) {
    const hookRunnerEnd = getGlobalHookRunner();
    if (hookRunnerEnd?.hasHooks("after_compaction")) {
      void hookRunnerEnd
        .runAfterCompaction(
          {
            messageCount: ctx.params.session.messages?.length ?? 0,
            compactedCount: ctx.getCompactionCount(),
            // tokenCount: pre-compaction token count from claude-sdk compact_metadata.
            // Not set for Pi (Pi provides messageCount directly).
            ...(preTokens != null ? { tokenCount: preTokens } : {}),
          },
          {},
        )
        .catch((err) => {
          ctx.log.warn(`after_compaction hook failed: ${String(err)}`);
        });
    }
  }
}

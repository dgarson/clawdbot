import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { EmbeddedPiSubscribeContext } from "./pi-embedded-subscribe.handlers.types.js";
import { parseReplyDirectives } from "../auto-reply/reply/reply-directives.js";
import { emitAgentEvent } from "../infra/agent-events.js";
import { createInlineCodeState } from "../markdown/code-spans.js";
import {
  isMessagingToolDuplicateNormalized,
  normalizeTextForComparison,
} from "./pi-embedded-helpers.js";
import { appendRawStream } from "./pi-embedded-subscribe.raw-stream.js";
import {
  extractAssistantText,
  extractAssistantThinking,
  extractThinkingFromTaggedStream,
  extractThinkingFromTaggedText,
  formatReasoningMessage,
  promoteThinkingTagsToBlocks,
  stripCompactionHandoffText,
} from "./pi-embedded-utils.js";

const stripTrailingDirective = (text: string): string => {
  const openIndex = text.lastIndexOf("[[");
  if (openIndex < 0) {
    return text;
  }
  const closeIndex = text.indexOf("]]", openIndex + 2);
  if (closeIndex >= 0) {
    return text;
  }
  return text.slice(0, openIndex);
};

export function handleMessageStart(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") {
    return;
  }

  ctx.log.debug("handleMessageStart: new assistant message", {
    feature: "streaming",
    assistantTextsLen: ctx.state.assistantTexts.length,
    messageIndex: ctx.state.assistantMessageIndex,
    blockReplyBreak: ctx.state.blockReplyBreak,
    reasoningMode: ctx.state.reasoningMode,
    streamReasoning: ctx.state.streamReasoning,
    includeReasoning: ctx.state.includeReasoning,
  });

  // KNOWN: Resetting at `text_end` is unsafe (late/duplicate end events).
  // ASSUME: `message_start` is the only reliable boundary for "new assistant message begins".
  // Start-of-message is a safer reset point than message_end: some providers
  // may deliver late text_end updates after message_end, which would otherwise
  // re-trigger block replies.
  ctx.resetAssistantMessageState(ctx.state.assistantTexts.length);
  // Push to middleware (dual-path)
  ctx.streamMiddleware?.push({ kind: "message_start" });
  // Use assistant message_start as the earliest "writing" signal for typing.
  void ctx.params.onAssistantMessageStart?.();
}

export function handleMessageUpdate(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage; assistantMessageEvent?: unknown },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") {
    return;
  }

  const assistantEvent = evt.assistantMessageEvent;
  const assistantRecord =
    assistantEvent && typeof assistantEvent === "object"
      ? (assistantEvent as Record<string, unknown>)
      : undefined;
  const evtType = typeof assistantRecord?.type === "string" ? assistantRecord.type : "";

  if (evtType !== "text_delta" && evtType !== "text_start" && evtType !== "text_end") {
    return;
  }

  const delta = typeof assistantRecord?.delta === "string" ? assistantRecord.delta : "";
  const content = typeof assistantRecord?.content === "string" ? assistantRecord.content : "";

  appendRawStream({
    ts: Date.now(),
    event: "assistant_text_stream",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    evtType,
    delta,
    content,
  });

  let chunk = "";
  if (evtType === "text_delta") {
    chunk = delta;
  } else if (evtType === "text_start" || evtType === "text_end") {
    if (delta) {
      chunk = delta;
    } else if (content) {
      // KNOWN: Some providers resend full content on `text_end`.
      // We only append a suffix (or nothing) to keep output monotonic.
      if (content.startsWith(ctx.state.deltaBuffer)) {
        chunk = content.slice(ctx.state.deltaBuffer.length);
      } else if (ctx.state.deltaBuffer.startsWith(content)) {
        chunk = "";
      } else if (!ctx.state.deltaBuffer.includes(content)) {
        chunk = content;
      }
    }
  }

  ctx.log.trace("handleMessageUpdate: chunk extraction", {
    feature: "streaming",
    evtType,
    chunkLen: chunk.length,
    deltaBufferLen: ctx.state.deltaBuffer.length,
    blockBufferLen: ctx.state.blockBuffer.length,
    hasBlockChunker: Boolean(ctx.blockChunker),
  });

  if (chunk) {
    ctx.state.deltaBuffer += chunk;
    if (ctx.blockChunker) {
      ctx.blockChunker.append(chunk);
    } else {
      ctx.state.blockBuffer += chunk;
    }
  }

  if (ctx.state.streamReasoning) {
    // Handle partial <think> tags: stream whatever reasoning is visible so far.
    const reasoning = extractThinkingFromTaggedStream(ctx.state.deltaBuffer);
    ctx.log.trace("handleMessageUpdate: streaming reasoning extraction", {
      feature: "streaming",
      reasoningLen: reasoning?.length ?? 0,
      deltaBufferLen: ctx.state.deltaBuffer.length,
    });
    ctx.emitReasoningStream(reasoning);
  }

  const next = ctx
    .stripBlockTags(ctx.state.deltaBuffer, {
      thinking: false,
      final: false,
      inlineCode: createInlineCodeState(),
    })
    .trim();
  if (next) {
    const visibleDelta = chunk ? ctx.stripBlockTags(chunk, ctx.state.partialBlockState) : "";
    const parsedDelta = visibleDelta ? ctx.consumePartialReplyDirectives(visibleDelta) : null;
    const parsedFull = parseReplyDirectives(stripTrailingDirective(next));
    const cleanedText = stripCompactionHandoffText(parsedFull.text);
    const mediaUrls = parsedDelta?.mediaUrls;
    const hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);
    const hasAudio = Boolean(parsedDelta?.audioAsVoice);
    const previousCleaned = ctx.state.lastStreamedAssistantCleaned ?? "";

    let shouldEmit = false;
    let deltaText = "";
    if (!cleanedText && !hasMedia && !hasAudio) {
      shouldEmit = false;
    } else if (previousCleaned && !cleanedText.startsWith(previousCleaned)) {
      shouldEmit = false;
    } else {
      deltaText = cleanedText.slice(previousCleaned.length);
      shouldEmit = Boolean(deltaText || hasMedia || hasAudio);
    }

    ctx.state.lastStreamedAssistant = next;
    ctx.state.lastStreamedAssistantCleaned = cleanedText;

    ctx.log.trace("handleMessageUpdate: partial emit decision", {
      feature: "streaming",
      shouldEmit,
      deltaTextLen: deltaText.length,
      cleanedTextLen: cleanedText.length,
      hasMedia,
      hasAudio,
      shouldEmitPartialReplies: ctx.state.shouldEmitPartialReplies,
    });

    if (shouldEmit) {
      emitAgentEvent({
        runId: ctx.params.runId,
        stream: "assistant",
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: hasMedia ? mediaUrls : undefined,
        },
      });
      // Push to middleware (dual-path)
      ctx.streamMiddleware?.push({
        kind: "agent_event",
        stream: "assistant",
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: hasMedia ? mediaUrls : undefined,
        },
      });
      void ctx.params.onAgentEvent?.({
        stream: "assistant",
        data: {
          text: cleanedText,
          delta: deltaText,
          mediaUrls: hasMedia ? mediaUrls : undefined,
        },
      });
      ctx.state.emittedAssistantUpdate = true;
      if (ctx.state.shouldEmitPartialReplies) {
        // Push text_delta to middleware (dual-path)
        if (ctx.streamMiddleware) {
          ctx.streamMiddleware.push({ kind: "text_delta", text: cleanedText });
        }
        if (ctx.params.onPartialReply) {
          void ctx.params.onPartialReply({
            text: cleanedText,
            mediaUrls: hasMedia ? mediaUrls : undefined,
          });
        }
      }
    }
  }

  if (ctx.params.onBlockReply && ctx.blockChunking && ctx.state.blockReplyBreak === "text_end") {
    ctx.blockChunker?.drain({ force: false, emit: ctx.emitBlockChunk });
  }

  if (evtType === "text_end" && ctx.state.blockReplyBreak === "text_end") {
    const chunkerBuffered = ctx.blockChunker?.hasBuffered() ?? false;
    ctx.log.debug("handleMessageUpdate: text_end block reply drain", {
      feature: "streaming",
      chunkerBuffered,
      blockBufferLen: ctx.state.blockBuffer.length,
      blockReplyBreak: ctx.state.blockReplyBreak,
    });
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (ctx.state.blockBuffer.length > 0) {
      ctx.emitBlockChunk(ctx.state.blockBuffer);
      ctx.state.blockBuffer = "";
    }
  }
}

export function handleMessageEnd(
  ctx: EmbeddedPiSubscribeContext,
  evt: AgentEvent & { message: AgentMessage },
) {
  const msg = evt.message;
  if (msg?.role !== "assistant") {
    return;
  }

  const assistantMessage = msg;
  promoteThinkingTagsToBlocks(assistantMessage);

  const rawText = extractAssistantText(assistantMessage);
  const rawThinkingExtract = extractAssistantThinking(assistantMessage);
  ctx.log.debug("handleMessageEnd: assistant message finalized", {
    feature: "streaming",
    rawTextLen: rawText.length,
    rawThinkingLen: rawThinkingExtract?.length ?? 0,
    deltaBufferLen: ctx.state.deltaBuffer.length,
    blockBufferLen: ctx.state.blockBuffer.length,
    assistantTextsLen: ctx.state.assistantTexts.length,
    assistantTextBaseline: ctx.state.assistantTextBaseline,
    emittedAssistantUpdate: ctx.state.emittedAssistantUpdate,
    includeReasoning: ctx.state.includeReasoning,
    streamReasoning: ctx.state.streamReasoning,
    blockReplyBreak: ctx.state.blockReplyBreak,
    hasOnBlockReply: Boolean(ctx.params.onBlockReply),
    hasOnReasoningStream: Boolean(ctx.params.onReasoningStream),
  });
  appendRawStream({
    ts: Date.now(),
    event: "assistant_message_end",
    runId: ctx.params.runId,
    sessionId: (ctx.params.session as { id?: string }).id,
    rawText,
    rawThinking: rawThinkingExtract,
  });

  const text = stripCompactionHandoffText(
    ctx.stripBlockTags(rawText, { thinking: false, final: false }),
  );
  const rawThinking =
    ctx.state.includeReasoning || ctx.state.streamReasoning
      ? extractAssistantThinking(assistantMessage) || extractThinkingFromTaggedText(rawText)
      : "";
  const formattedReasoning = rawThinking ? formatReasoningMessage(rawThinking) : "";
  const trimmedText = text.trim();
  const parsedText = trimmedText ? parseReplyDirectives(stripTrailingDirective(trimmedText)) : null;
  let cleanedText = parsedText?.text ?? "";
  let mediaUrls = parsedText?.mediaUrls;
  let hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);

  if (!cleanedText && !hasMedia) {
    const rawTrimmed = rawText.trim();
    const rawStrippedFinal = rawTrimmed.replace(/<\s*\/?\s*final\s*>/gi, "").trim();
    const rawCandidate = rawStrippedFinal || rawTrimmed;
    if (rawCandidate) {
      const parsedFallback = parseReplyDirectives(stripTrailingDirective(rawCandidate));
      cleanedText = parsedFallback.text ?? rawCandidate;
      mediaUrls = parsedFallback.mediaUrls;
      hasMedia = Boolean(mediaUrls && mediaUrls.length > 0);
    }
  }

  if (!ctx.state.emittedAssistantUpdate && (cleanedText || hasMedia)) {
    emitAgentEvent({
      runId: ctx.params.runId,
      stream: "assistant",
      data: {
        text: cleanedText,
        delta: cleanedText,
        mediaUrls: hasMedia ? mediaUrls : undefined,
      },
    });
    // Push to middleware (dual-path)
    ctx.streamMiddleware?.push({
      kind: "agent_event",
      stream: "assistant",
      data: {
        text: cleanedText,
        delta: cleanedText,
        mediaUrls: hasMedia ? mediaUrls : undefined,
      },
    });
    if (ctx.streamMiddleware) {
      ctx.streamMiddleware.push({ kind: "text_delta", text: cleanedText });
    }
    void ctx.params.onAgentEvent?.({
      stream: "assistant",
      data: {
        text: cleanedText,
        delta: cleanedText,
        mediaUrls: hasMedia ? mediaUrls : undefined,
      },
    });
    ctx.state.emittedAssistantUpdate = true;
  }

  const addedDuringMessage = ctx.state.assistantTexts.length > ctx.state.assistantTextBaseline;
  const chunkerHasBuffered = ctx.blockChunker?.hasBuffered() ?? false;
  ctx.finalizeAssistantTexts({ text, addedDuringMessage, chunkerHasBuffered });

  const onBlockReply = ctx.params.onBlockReply;
  const hasReasoningStreamCallback = typeof ctx.params.onReasoningStream === "function";

  // Reasoning emission priority:
  // 1. If onReasoningStream callback is provided -> emit via that (handled at end of function)
  // 2. Else if emitReasoningInBlockReply is true -> emit via onBlockReply (fallback for inline display)
  // 3. Else -> don't emit reasoning to user-facing surfaces (channels like Discord, Slack, etc.)
  //
  // This prevents reasoning from leaking into channel messages while allowing:
  // - TUI/Web UI to receive reasoning via onReasoningStream (with frontend toggle control)
  // - Explicit opt-in for inline reasoning in block replies when no stream callback exists
  const shouldEmitReasoningViaBlockReply = Boolean(
    ctx.state.includeReasoning &&
    formattedReasoning &&
    onBlockReply &&
    ctx.state.emitReasoningInBlockReply && // Must explicitly opt-in to emit reasoning via block reply
    !hasReasoningStreamCallback && // Don't use block reply if onReasoningStream is available
    formattedReasoning !== ctx.state.lastReasoningSent,
  );
  const shouldEmitReasoningBeforeAnswer =
    shouldEmitReasoningViaBlockReply &&
    ctx.state.blockReplyBreak === "message_end" &&
    !addedDuringMessage;

  ctx.log.debug("handleMessageEnd: reasoning emission decision", {
    feature: "streaming",
    shouldEmitReasoningViaBlockReply,
    shouldEmitReasoningBeforeAnswer,
    hasReasoningStreamCallback,
    formattedReasoningLen: formattedReasoning.length,
    emitReasoningInBlockReply: ctx.state.emitReasoningInBlockReply,
    addedDuringMessage,
  });
  const maybeEmitReasoningViaBlockReply = () => {
    if (!shouldEmitReasoningViaBlockReply || !formattedReasoning) {
      return;
    }
    ctx.state.lastReasoningSent = formattedReasoning;
    void onBlockReply?.({ text: formattedReasoning });
  };

  if (shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoningViaBlockReply();
  }

  const shouldEmitBlockReplyAtEnd =
    (ctx.state.blockReplyBreak === "message_end" ||
      (ctx.blockChunker ? ctx.blockChunker.hasBuffered() : ctx.state.blockBuffer.length > 0)) &&
    Boolean(text) &&
    Boolean(onBlockReply);

  ctx.log.debug("handleMessageEnd: block reply emission decision", {
    feature: "streaming",
    shouldEmitBlockReplyAtEnd,
    blockReplyBreak: ctx.state.blockReplyBreak,
    chunkerBuffered: ctx.blockChunker?.hasBuffered() ?? false,
    blockBufferLen: ctx.state.blockBuffer.length,
    textLen: text.length,
    hasOnBlockReply: Boolean(onBlockReply),
    lastBlockReplyTextLen: ctx.state.lastBlockReplyText?.length ?? 0,
  });

  if (shouldEmitBlockReplyAtEnd && onBlockReply) {
    if (ctx.blockChunker?.hasBuffered()) {
      ctx.blockChunker.drain({ force: true, emit: ctx.emitBlockChunk });
      ctx.blockChunker.reset();
    } else if (text !== ctx.state.lastBlockReplyText) {
      // Check for duplicates before emitting (same logic as emitBlockChunk).
      const normalizedText = normalizeTextForComparison(text);
      if (
        isMessagingToolDuplicateNormalized(
          normalizedText,
          ctx.state.messagingToolSentTextsNormalized,
        )
      ) {
        ctx.log.debug(
          `Skipping message_end block reply - already sent via messaging tool: ${text.slice(0, 50)}...`,
        );
      } else {
        ctx.state.lastBlockReplyText = text;
        const splitResult = ctx.consumeReplyDirectives(text, { final: true });
        if (splitResult) {
          const {
            text: cleanedText,
            mediaUrls,
            audioAsVoice,
            replyToId,
            replyToTag,
            replyToCurrent,
          } = splitResult;
          // Emit if there's content OR audioAsVoice flag (to propagate the flag).
          if (cleanedText || (mediaUrls && mediaUrls.length > 0) || audioAsVoice) {
            void onBlockReply({
              text: cleanedText,
              mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
              audioAsVoice,
              replyToId,
              replyToTag,
              replyToCurrent,
            });
          }
        }
      }
    }
  }

  if (!shouldEmitReasoningBeforeAnswer) {
    maybeEmitReasoningViaBlockReply();
  }

  // Emit reasoning via onReasoningStream if callback is provided and we have reasoning.
  // This works for both "on" and "stream" modes - the frontend/TUI decides what to display.
  // For "stream" mode, real-time deltas are also emitted during handleMessageUpdate.
  const shouldEmitReasoningViaStream =
    hasReasoningStreamCallback &&
    rawThinking &&
    (ctx.state.includeReasoning || ctx.state.streamReasoning);
  ctx.log.trace("handleMessageEnd: reasoning stream emission", {
    feature: "streaming",
    shouldEmitReasoningViaStream,
    rawThinkingLen: rawThinking.length,
  });
  if (shouldEmitReasoningViaStream) {
    ctx.emitReasoningStream(rawThinking);
  }

  if (ctx.state.blockReplyBreak === "text_end" && onBlockReply) {
    const tailResult = ctx.consumeReplyDirectives("", { final: true });
    if (tailResult) {
      const {
        text: cleanedText,
        mediaUrls,
        audioAsVoice,
        replyToId,
        replyToTag,
        replyToCurrent,
      } = tailResult;
      if (cleanedText || (mediaUrls && mediaUrls.length > 0) || audioAsVoice) {
        void onBlockReply({
          text: cleanedText,
          mediaUrls: mediaUrls?.length ? mediaUrls : undefined,
          audioAsVoice,
          replyToId,
          replyToTag,
          replyToCurrent,
        });
      }
    }
  }

  // Push message_end to middleware (dual-path)
  ctx.streamMiddleware?.push({ kind: "message_end" });

  ctx.log.debug("handleMessageEnd: resetting state", {
    feature: "streaming",
    finalAssistantTextsLen: ctx.state.assistantTexts.length,
    finalAssistantTextBaseline: ctx.state.assistantTextBaseline,
  });

  ctx.state.deltaBuffer = "";
  ctx.state.blockBuffer = "";
  ctx.blockChunker?.reset();
  ctx.state.blockState.thinking = false;
  ctx.state.blockState.final = false;
  ctx.state.blockState.inlineCode = createInlineCodeState();
  ctx.state.lastStreamedAssistant = undefined;
  ctx.state.lastStreamedAssistantCleaned = undefined;
}

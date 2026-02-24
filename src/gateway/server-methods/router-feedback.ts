import type { GatewayRequestHandlers } from "./types.js";
import { resolveMainSessionKeyFromConfig } from "../../config/sessions.js";
import { createInternalHookEvent, triggerInternalHook } from "../../hooks/internal-hooks.js";
import { emitDiagnosticEvent } from "../../infra/diagnostic-events.js";
import { getRouterFeedbackLoopStore } from "../../routing/feedback-loop-store.js";
import {
  parseImplicitFeedback,
  type FeedbackSource,
  type RouterAction,
  type RouterReviewStatus,
  type RouterTier,
} from "../../routing/feedback-loop.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";

function asString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry): entry is string => entry.length > 0);
}

function asTier(value: unknown): RouterTier | undefined {
  if (value === "T1" || value === "T2" || value === "T3" || value === "T4") {
    return value;
  }
  return undefined;
}

function asAction(value: unknown): RouterAction | undefined {
  if (value === "handle" || value === "escalate" || value === "defer" || value === "ignore") {
    return value;
  }
  return undefined;
}

function asReviewStatus(value: unknown): RouterReviewStatus | undefined {
  if (value === "open" || value === "resolved" || value === "dismissed") {
    return value;
  }
  return undefined;
}

function asFeedbackSource(value: unknown): FeedbackSource | undefined {
  if (value === "explicit" || value === "reaction" || value === "implicit") {
    return value;
  }
  return undefined;
}

function emitRouterFeedbackGatewayEvent(action: string, context: Record<string, unknown>): void {
  const sessionKey = resolveMainSessionKeyFromConfig();
  void triggerInternalHook(createInternalHookEvent("gateway", action, sessionKey, context));
}

export const routerFeedbackHandlers: GatewayRequestHandlers = {
  "router.feedback.log_decision": ({ params, respond }) => {
    const channelId = asString(params.channelId);
    const predictedTier = asTier(params.predictedTier);
    const predictedAction = asAction(params.predictedAction);
    if (!channelId || !predictedTier || !predictedAction) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "router.feedback.log_decision requires channelId, predictedTier, predictedAction",
        ),
      );
      return;
    }

    const store = getRouterFeedbackLoopStore();
    const confidence =
      typeof params.confidence === "number" && Number.isFinite(params.confidence)
        ? params.confidence
        : undefined;
    const decision = store.logDecision({
      channelId,
      conversationId: asString(params.conversationId),
      threadId: asString(params.threadId),
      inputMessageId: asString(params.inputMessageId),
      predictedTier,
      predictedAction,
      confidence,
      reasonTags: asStringArray(params.reasonTags),
      outcomeMessageId: asString(params.outcomeMessageId),
    });
    emitDiagnosticEvent({
      type: "router.feedback.decision_logged",
      channelId,
      predictedTier,
      predictedAction,
      decisionId: decision.decisionId,
    });
    emitRouterFeedbackGatewayEvent("router_feedback_decision_logged", { decision });
    respond(true, { decision }, undefined);
  },

  "router.feedback.capture": ({ params, respond }) => {
    const channelId = asString(params.channelId);
    const source = asFeedbackSource(params.source);
    if (!channelId || !source) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "router.feedback.capture requires channelId and source",
        ),
      );
      return;
    }

    const explicitTier = asTier(params.expectedTier);
    const explicitAction = asAction(params.expectedAction);
    const freeText = asString(params.freeText);
    const implicit = freeText ? parseImplicitFeedback(freeText) : {};

    const store = getRouterFeedbackLoopStore();
    const feedback = store.captureFeedback({
      decisionId: asString(params.decisionId),
      source,
      actorId: asString(params.actorId),
      channelId,
      conversationId: asString(params.conversationId),
      threadId: asString(params.threadId),
      feedbackMessageId: asString(params.feedbackMessageId),
      expectedTier: explicitTier ?? implicit.expectedTier,
      expectedAction: explicitAction ?? implicit.expectedAction,
      reaction: asString(params.reaction),
      freeText,
    });

    emitDiagnosticEvent({
      type: "router.feedback.feedback_captured",
      channelId,
      source,
      feedbackId: feedback.feedbackId,
      linkedDecisionId: feedback.linkedDecisionId,
      needsReview: feedback.needsReview,
    });
    emitRouterFeedbackGatewayEvent("router_feedback_captured", { feedback });
    respond(true, { feedback }, undefined);
  },

  "router.feedback.summary": ({ respond }) => {
    const store = getRouterFeedbackLoopStore();
    respond(true, { summary: store.summarizeCalibrationWindow() }, undefined);
  },

  "router.feedback.review_queue": ({ params, respond }) => {
    const store = getRouterFeedbackLoopStore();
    const limit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.max(1, Math.trunc(params.limit))
        : 100;
    const status = asReviewStatus(params.status);
    const queue = store.listReviewQueue({ status, limit }).toReversed();
    respond(true, { queue }, undefined);
  },

  "router.feedback.review_update": ({ params, respond }) => {
    const reviewId = asString(params.reviewId);
    const status = asReviewStatus(params.status);
    if (!reviewId || !status) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          "router.feedback.review_update requires reviewId and status",
        ),
      );
      return;
    }
    const store = getRouterFeedbackLoopStore();
    const review = store.updateReviewStatus({
      reviewId,
      status,
      actorId: asString(params.actorId),
      note: asString(params.note),
    });
    if (!review) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, `review not found: ${reviewId}`),
      );
      return;
    }
    emitDiagnosticEvent({
      type: "router.feedback.review_updated",
      reviewId,
      status,
      actorId: asString(params.actorId),
    });
    emitRouterFeedbackGatewayEvent("router_feedback_review_updated", { review });
    respond(true, { review }, undefined);
  },

  "router.feedback.decisions": ({ params, respond }) => {
    const store = getRouterFeedbackLoopStore();
    const limit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.max(1, Math.trunc(params.limit))
        : 100;
    const decisions = store
      .listDecisions({
        channelId: asString(params.channelId),
        conversationId: asString(params.conversationId),
        threadId: asString(params.threadId),
        messageId: asString(params.messageId),
        limit,
      })
      .toReversed();
    respond(true, { decisions }, undefined);
  },

  "router.feedback.events": ({ params, respond }) => {
    const store = getRouterFeedbackLoopStore();
    const limit =
      typeof params.limit === "number" && Number.isFinite(params.limit)
        ? Math.max(1, Math.trunc(params.limit))
        : 100;
    const source = asFeedbackSource(params.source);
    const feedback = store
      .listFeedback({
        source,
        channelId: asString(params.channelId),
        needsReview: typeof params.needsReview === "boolean" ? params.needsReview : undefined,
        linkedOnly: params.linkedOnly === true,
        limit,
      })
      .toReversed();
    respond(true, { feedback }, undefined);
  },
};

import { getRouterFeedbackLoopStore } from "../../routing/feedback-loop-store.js";
import {
  parseImplicitFeedback,
  type FeedbackSource,
  type RouterAction,
  type RouterTier,
} from "../../routing/feedback-loop.js";
import { ErrorCodes, errorShape } from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

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

function asFeedbackSource(value: unknown): FeedbackSource | undefined {
  if (value === "explicit" || value === "reaction" || value === "implicit") {
    return value;
  }
  return undefined;
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
    const status = asString(params.status);

    const queue = store
      .listReviewQueue()
      .filter((item) => (status ? item.status === status : true))
      .slice(-limit)
      .toReversed();

    respond(true, { queue }, undefined);
  },
};

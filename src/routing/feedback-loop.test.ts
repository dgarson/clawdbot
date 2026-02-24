import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseImplicitFeedback, RouterFeedbackLoopStore } from "./feedback-loop.js";

function createStore(): RouterFeedbackLoopStore {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-feedback-loop-"));
  return new RouterFeedbackLoopStore(tempDir);
}

describe("RouterFeedbackLoopStore", () => {
  it("links feedback to latest thread decision and adds review items for mismatches", () => {
    const store = createStore();
    const decision = store.logDecision({
      channelId: "slack",
      conversationId: "C123",
      threadId: "17000001.001",
      inputMessageId: "m-1",
      predictedTier: "T1",
      predictedAction: "handle",
      confidence: 0.91,
      reasonTags: ["status_update"],
      outcomeMessageId: "o-1",
    });

    const feedback = store.captureFeedback({
      source: "explicit",
      channelId: "slack",
      conversationId: "C123",
      threadId: "17000001.001",
      expectedTier: "T3",
      expectedAction: "escalate",
      freeText: "This should have escalated",
    });

    expect(feedback.linkedDecisionId).toBe(decision.decisionId);
    expect(feedback.needsReview).toBe(true);

    const review = store.listReviewQueue();
    expect(review).toHaveLength(1);
    expect(review[0]?.severity).toBe("high");
  });

  it("tracks summary metrics and review status updates", () => {
    const store = createStore();
    store.logDecision({
      channelId: "slack",
      conversationId: "C1",
      predictedTier: "T2",
      predictedAction: "escalate",
      reasonTags: ["incident_signal"],
      outcomeMessageId: "o-11",
    });

    store.captureFeedback({
      source: "explicit",
      channelId: "slack",
      conversationId: "C1",
      expectedAction: "handle",
      expectedTier: "T1",
      feedbackMessageId: "o-11",
    });

    store.captureFeedback({
      source: "explicit",
      channelId: "slack",
      conversationId: "C1",
      expectedAction: "handle",
      expectedTier: "T1",
      feedbackMessageId: "o-11",
    });

    const queue = store.listReviewQueue();
    expect(queue.length).toBe(1);
    const updated = store.updateReviewStatus({
      reviewId: queue[0]?.reviewId ?? "",
      status: "resolved",
      actorId: "reviewer",
    });
    expect(updated?.status).toBe("resolved");

    const summary = store.summarizeCalibrationWindow();
    expect(summary.totalDecisions).toBe(1);
    expect(summary.totalFeedback).toBe(2);
    expect(summary.mismatchCount).toBe(1);
    expect(summary.falseEscalationCount).toBe(1);
    expect(summary.duplicateFeedbackCount).toBe(1);
    expect(summary.openReviewCount).toBe(0);
  });

  it("skips corrupted jsonl lines while reading persisted records", () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-feedback-loop-corrupt-"));
    const store = new RouterFeedbackLoopStore(tempDir);

    store.logDecision({
      channelId: "slack",
      conversationId: "C777",
      predictedTier: "T2",
      predictedAction: "handle",
      reasonTags: ["baseline"],
    });

    fs.appendFileSync(path.join(tempDir, "router-decisions.jsonl"), "{bad json\n", "utf8");

    const decisions = store.listDecisions();
    expect(decisions).toHaveLength(1);
    expect(decisions[0]?.conversationId).toBe("C777");
  });
});

describe("parseImplicitFeedback", () => {
  it("extracts expected action and tier from correction text", () => {
    const parsed = parseImplicitFeedback("I expected T4 and this should escalate.");
    expect(parsed.expectedTier).toBe("T4");
    expect(parsed.expectedAction).toBe("escalate");
  });

  it("parses handling corrections", () => {
    const parsed = parseImplicitFeedback("Do not escalate this, should handle as T1.");
    expect(parsed.expectedTier).toBe("T1");
    expect(parsed.expectedAction).toBe("handle");
  });

  it("does not infer tier from generic mentions without correction cues", () => {
    const parsed = parseImplicitFeedback("We have T2 tickets in this queue.");
    expect(parsed.expectedTier).toBeUndefined();
  });

  it("does not infer tier from descriptive statements", () => {
    const parsed = parseImplicitFeedback("This is T2 according to triage notes.");
    expect(parsed.expectedTier).toBeUndefined();
  });
});

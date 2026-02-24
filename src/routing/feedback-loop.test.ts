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

  it("tracks calibration metrics including false escalation count", () => {
    const store = createStore();
    store.logDecision({
      channelId: "slack",
      conversationId: "C1",
      predictedTier: "T2",
      predictedAction: "escalate",
      reasonTags: ["incident_signal"],
    });

    store.captureFeedback({
      source: "explicit",
      channelId: "slack",
      conversationId: "C1",
      expectedAction: "handle",
      expectedTier: "T1",
    });

    const summary = store.summarizeCalibrationWindow();
    expect(summary.totalDecisions).toBe(1);
    expect(summary.totalFeedback).toBe(1);
    expect(summary.mismatchCount).toBe(1);
    expect(summary.falseEscalationCount).toBe(1);
  });
});

describe("parseImplicitFeedback", () => {
  it("extracts expected action and tier from correction text", () => {
    const parsed = parseImplicitFeedback("I expected T4 and this should escalate.");
    expect(parsed.expectedTier).toBe("T4");
    expect(parsed.expectedAction).toBe("escalate");
  });
});

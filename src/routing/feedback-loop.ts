import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RouterTier = "T1" | "T2" | "T3" | "T4";
export type RouterAction = "handle" | "escalate" | "defer" | "ignore";
export type FeedbackSource = "explicit" | "reaction" | "implicit";

export type RouterDecisionRecord = {
  decisionId: string;
  createdAt: string;
  channelId: string;
  conversationId?: string;
  threadId?: string;
  inputMessageId?: string;
  predictedTier: RouterTier;
  predictedAction: RouterAction;
  confidence?: number;
  reasonTags: string[];
  outcomeMessageId?: string;
};

export type RouterFeedbackRecord = {
  feedbackId: string;
  createdAt: string;
  decisionId?: string;
  linkedDecisionId?: string;
  source: FeedbackSource;
  actorId?: string;
  channelId: string;
  conversationId?: string;
  threadId?: string;
  feedbackMessageId?: string;
  expectedTier?: RouterTier;
  expectedAction?: RouterAction;
  reaction?: string;
  freeText?: string;
  latencyFromDecisionSec?: number;
  needsReview: boolean;
};

export type RouterReviewItem = {
  reviewId: string;
  createdAt: string;
  linkedDecisionId: string;
  feedbackId: string;
  severity: "low" | "medium" | "high";
  reason: string;
  status: "open" | "resolved";
};

export type FeedbackInput = {
  decisionId?: string;
  source: FeedbackSource;
  actorId?: string;
  channelId: string;
  conversationId?: string;
  threadId?: string;
  feedbackMessageId?: string;
  expectedTier?: RouterTier;
  expectedAction?: RouterAction;
  reaction?: string;
  freeText?: string;
};

export function parseImplicitFeedback(text: string): Partial<FeedbackInput> {
  const normalized = text.toLowerCase();
  const expectedAction =
    normalized.includes("should escalate") || normalized.includes("need escalation")
      ? "escalate"
      : normalized.includes("should handle") || normalized.includes("don't escalate")
        ? "handle"
        : undefined;
  const expectedTierMatch = normalized.match(/\bt([1-4])\b/);
  const expectedTier = expectedTierMatch ? (`T${expectedTierMatch[1]}` as RouterTier) : undefined;
  return { expectedAction, expectedTier };
}

function appendJsonl(filePath: string, payload: Record<string, unknown>): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, `${JSON.stringify(payload)}\n`, "utf8");
}

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const text = fs.readFileSync(filePath, "utf8");
  if (!text.trim()) {
    return [];
  }
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as T);
}

function computeThreadKey(input: {
  channelId: string;
  conversationId?: string;
  threadId?: string;
}): string {
  return `${input.channelId}|${input.conversationId ?? ""}|${input.threadId ?? ""}`;
}

function toSeverity(params: {
  decision: RouterDecisionRecord;
  expectedTier?: RouterTier;
  expectedAction?: RouterAction;
}): RouterReviewItem["severity"] {
  if (params.expectedAction === "escalate" && params.decision.predictedAction !== "escalate") {
    return "high";
  }
  if (params.expectedTier && ["T3", "T4"].includes(params.expectedTier)) {
    return "high";
  }
  if (params.expectedTier && params.expectedTier !== params.decision.predictedTier) {
    return "medium";
  }
  return "low";
}

export class RouterFeedbackLoopStore {
  private readonly decisionsPath: string;
  private readonly feedbackPath: string;
  private readonly reviewQueuePath: string;

  constructor(baseDir: string) {
    this.decisionsPath = path.join(baseDir, "router-decisions.jsonl");
    this.feedbackPath = path.join(baseDir, "router-feedback.jsonl");
    this.reviewQueuePath = path.join(baseDir, "router-review-queue.jsonl");
  }

  logDecision(input: Omit<RouterDecisionRecord, "decisionId" | "createdAt">): RouterDecisionRecord {
    const decision: RouterDecisionRecord = {
      ...input,
      decisionId: `rd_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    };
    appendJsonl(this.decisionsPath, decision);
    return decision;
  }

  captureFeedback(input: FeedbackInput): RouterFeedbackRecord {
    const decisions = this.listDecisions();
    const linked = input.decisionId
      ? decisions.find((record) => record.decisionId === input.decisionId)
      : this.findLatestDecisionByThread(
          {
            channelId: input.channelId,
            conversationId: input.conversationId,
            threadId: input.threadId,
          },
          decisions,
        );

    const feedback: RouterFeedbackRecord = {
      feedbackId: `rf_${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      decisionId: input.decisionId,
      linkedDecisionId: linked?.decisionId,
      source: input.source,
      actorId: input.actorId,
      channelId: input.channelId,
      conversationId: input.conversationId,
      threadId: input.threadId,
      feedbackMessageId: input.feedbackMessageId,
      expectedTier: input.expectedTier,
      expectedAction: input.expectedAction,
      reaction: input.reaction,
      freeText: input.freeText,
      latencyFromDecisionSec: linked
        ? Math.max(0, Math.round((Date.now() - new Date(linked.createdAt).getTime()) / 1000))
        : undefined,
      needsReview: this.shouldReview(input, linked),
    };

    appendJsonl(this.feedbackPath, feedback);

    if (linked && feedback.needsReview) {
      const review: RouterReviewItem = {
        reviewId: `rv_${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        linkedDecisionId: linked.decisionId,
        feedbackId: feedback.feedbackId,
        severity: toSeverity({
          decision: linked,
          expectedTier: input.expectedTier,
          expectedAction: input.expectedAction,
        }),
        reason: this.buildReviewReason(input, linked),
        status: "open",
      };
      appendJsonl(this.reviewQueuePath, review);
    }

    return feedback;
  }

  listDecisions(): RouterDecisionRecord[] {
    return readJsonl<RouterDecisionRecord>(this.decisionsPath);
  }

  listFeedback(): RouterFeedbackRecord[] {
    return readJsonl<RouterFeedbackRecord>(this.feedbackPath);
  }

  listReviewQueue(): RouterReviewItem[] {
    return readJsonl<RouterReviewItem>(this.reviewQueuePath);
  }

  summarizeCalibrationWindow(): {
    totalDecisions: number;
    totalFeedback: number;
    mismatchCount: number;
    falseEscalationCount: number;
    avgFeedbackLatencySec: number;
  } {
    const decisions = this.listDecisions();
    const feedback = this.listFeedback().filter((item) => item.linkedDecisionId);
    const decisionById = new Map(decisions.map((item) => [item.decisionId, item]));

    let mismatchCount = 0;
    let falseEscalationCount = 0;
    let latencyTotal = 0;
    let latencyCount = 0;

    for (const item of feedback) {
      const linkedDecision = decisionById.get(item.linkedDecisionId ?? "");
      if (!linkedDecision) {
        continue;
      }
      const mismatch =
        (item.expectedAction && item.expectedAction !== linkedDecision.predictedAction) ||
        (item.expectedTier && item.expectedTier !== linkedDecision.predictedTier);
      if (mismatch) {
        mismatchCount += 1;
      }
      if (
        linkedDecision.predictedAction === "escalate" &&
        item.expectedAction &&
        item.expectedAction !== "escalate"
      ) {
        falseEscalationCount += 1;
      }
      if (typeof item.latencyFromDecisionSec === "number") {
        latencyTotal += item.latencyFromDecisionSec;
        latencyCount += 1;
      }
    }

    return {
      totalDecisions: decisions.length,
      totalFeedback: feedback.length,
      mismatchCount,
      falseEscalationCount,
      avgFeedbackLatencySec: latencyCount === 0 ? 0 : Math.round(latencyTotal / latencyCount),
    };
  }

  private findLatestDecisionByThread(
    input: { channelId: string; conversationId?: string; threadId?: string },
    decisions: RouterDecisionRecord[],
  ): RouterDecisionRecord | undefined {
    const key = computeThreadKey(input);
    for (let index = decisions.length - 1; index >= 0; index -= 1) {
      const item = decisions[index];
      if (
        item &&
        computeThreadKey({
          channelId: item.channelId,
          conversationId: item.conversationId,
          threadId: item.threadId,
        }) === key
      ) {
        return item;
      }
    }
    return undefined;
  }

  private shouldReview(input: FeedbackInput, decision?: RouterDecisionRecord): boolean {
    if (!decision) {
      return true;
    }
    if (input.source === "implicit") {
      return true;
    }
    if (input.expectedAction && input.expectedAction !== decision.predictedAction) {
      return true;
    }
    if (input.expectedTier && input.expectedTier !== decision.predictedTier) {
      return true;
    }
    if (input.source === "reaction" && ["thumbsdown", "-1", "x"].includes(input.reaction ?? "")) {
      return true;
    }
    return false;
  }

  private buildReviewReason(input: FeedbackInput, decision: RouterDecisionRecord): string {
    const parts: string[] = [];
    if (input.expectedAction && input.expectedAction !== decision.predictedAction) {
      parts.push(
        `expected action ${input.expectedAction} != predicted ${decision.predictedAction}`,
      );
    }
    if (input.expectedTier && input.expectedTier !== decision.predictedTier) {
      parts.push(`expected tier ${input.expectedTier} != predicted ${decision.predictedTier}`);
    }
    if (input.source === "implicit") {
      parts.push("implicit correction phrase detected");
    }
    if (parts.length === 0) {
      parts.push("manual review requested");
    }
    return parts.join("; ");
  }
}

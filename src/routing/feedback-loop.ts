import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type RouterTier = "T1" | "T2" | "T3" | "T4";
export type RouterAction = "handle" | "escalate" | "defer" | "ignore";
export type FeedbackSource = "explicit" | "reaction" | "implicit";
export type RouterReviewStatus = "open" | "resolved" | "dismissed";

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
  fingerprint: string;
  duplicateOfFeedbackId?: string;
};

export type RouterReviewItem = {
  reviewId: string;
  createdAt: string;
  linkedDecisionId: string;
  feedbackId: string;
  severity: "low" | "medium" | "high";
  reason: string;
  status: RouterReviewStatus;
  updatedAt?: string;
  resolvedBy?: string;
  resolutionNote?: string;
};

export type RouterReviewUpdate = {
  updateId: string;
  reviewId: string;
  status: RouterReviewStatus;
  actorId?: string;
  note?: string;
  createdAt: string;
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
  const escalationCue =
    normalized.includes("should escalate") ||
    normalized.includes("needs escalation") ||
    normalized.includes("need escalation") ||
    normalized.includes("please escalate");
  const handlingCue =
    normalized.includes("should handle") ||
    normalized.includes("do not escalate") ||
    normalized.includes("don't escalate") ||
    normalized.includes("no escalation");
  const expectedAction = escalationCue ? "escalate" : handlingCue ? "handle" : undefined;

  const expectedTierMatch = normalized.match(/(?:expected|be|is|not)\s*t([1-4])\b|\bt([1-4])\b/);
  const tierNumber = expectedTierMatch?.[1] ?? expectedTierMatch?.[2];
  const expectedTier = tierNumber ? (`T${tierNumber}` as RouterTier) : undefined;
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

function fingerprintFeedback(input: FeedbackInput): string {
  return crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        source: input.source,
        channelId: input.channelId,
        conversationId: input.conversationId ?? null,
        threadId: input.threadId ?? null,
        feedbackMessageId: input.feedbackMessageId ?? null,
        expectedTier: input.expectedTier ?? null,
        expectedAction: input.expectedAction ?? null,
        reaction: input.reaction?.toLowerCase().trim() ?? null,
        freeText: input.freeText?.trim().toLowerCase() ?? null,
      }),
    )
    .digest("hex");
}

export class RouterFeedbackLoopStore {
  private readonly decisionsPath: string;
  private readonly feedbackPath: string;
  private readonly reviewQueuePath: string;
  private readonly reviewUpdatesPath: string;

  constructor(baseDir: string) {
    this.decisionsPath = path.join(baseDir, "router-decisions.jsonl");
    this.feedbackPath = path.join(baseDir, "router-feedback.jsonl");
    this.reviewQueuePath = path.join(baseDir, "router-review-queue.jsonl");
    this.reviewUpdatesPath = path.join(baseDir, "router-review-updates.jsonl");
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
    const allFeedback = this.listFeedback();
    const fingerprint = fingerprintFeedback(input);
    const duplicate = this.findRecentDuplicateFeedback({ allFeedback, fingerprint });

    const decisions = this.listDecisions();
    const linked =
      (input.decisionId
        ? decisions.find((record) => record.decisionId === input.decisionId)
        : undefined) ??
      this.findDecisionByMessage(input, decisions) ??
      this.findLatestDecisionByThread(
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
      fingerprint,
      duplicateOfFeedbackId: duplicate?.feedbackId,
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

  updateReviewStatus(input: {
    reviewId: string;
    status: RouterReviewStatus;
    actorId?: string;
    note?: string;
  }): RouterReviewItem | undefined {
    const current = this.listReviewQueue().find((item) => item.reviewId === input.reviewId);
    if (!current) {
      return undefined;
    }
    const update: RouterReviewUpdate = {
      updateId: `rvu_${crypto.randomUUID()}`,
      reviewId: input.reviewId,
      status: input.status,
      actorId: input.actorId,
      note: input.note,
      createdAt: new Date().toISOString(),
    };
    appendJsonl(this.reviewUpdatesPath, update);
    return this.listReviewQueue().find((item) => item.reviewId === input.reviewId);
  }

  listDecisions(filters?: {
    channelId?: string;
    conversationId?: string;
    threadId?: string;
    messageId?: string;
    limit?: number;
  }): RouterDecisionRecord[] {
    let records = readJsonl<RouterDecisionRecord>(this.decisionsPath);
    if (!filters) {
      return records;
    }
    if (filters.channelId) {
      records = records.filter((item) => item.channelId === filters.channelId);
    }
    if (filters.conversationId) {
      records = records.filter((item) => item.conversationId === filters.conversationId);
    }
    if (filters.threadId) {
      records = records.filter((item) => item.threadId === filters.threadId);
    }
    if (filters.messageId) {
      records = records.filter(
        (item) =>
          item.inputMessageId === filters.messageId || item.outcomeMessageId === filters.messageId,
      );
    }
    if (typeof filters.limit === "number") {
      records = records.slice(-Math.max(1, Math.trunc(filters.limit)));
    }
    return records;
  }

  listFeedback(filters?: {
    source?: FeedbackSource;
    channelId?: string;
    needsReview?: boolean;
    linkedOnly?: boolean;
    limit?: number;
  }): RouterFeedbackRecord[] {
    let records = readJsonl<RouterFeedbackRecord>(this.feedbackPath);
    if (!filters) {
      return records;
    }
    if (filters.source) {
      records = records.filter((item) => item.source === filters.source);
    }
    if (filters.channelId) {
      records = records.filter((item) => item.channelId === filters.channelId);
    }
    if (typeof filters.needsReview === "boolean") {
      records = records.filter((item) => item.needsReview === filters.needsReview);
    }
    if (filters.linkedOnly) {
      records = records.filter((item) => Boolean(item.linkedDecisionId));
    }
    if (typeof filters.limit === "number") {
      records = records.slice(-Math.max(1, Math.trunc(filters.limit)));
    }
    return records;
  }

  listReviewQueue(filters?: { status?: RouterReviewStatus; limit?: number }): RouterReviewItem[] {
    const items = readJsonl<RouterReviewItem>(this.reviewQueuePath);
    const updates = readJsonl<RouterReviewUpdate>(this.reviewUpdatesPath);
    const updatesByReviewId = new Map<string, RouterReviewUpdate>();
    for (const update of updates) {
      updatesByReviewId.set(update.reviewId, update);
    }

    let hydrated = items.map((item) => {
      const update = updatesByReviewId.get(item.reviewId);
      if (!update) {
        return item;
      }
      return {
        ...item,
        status: update.status,
        updatedAt: update.createdAt,
        resolvedBy: update.actorId,
        resolutionNote: update.note,
      } satisfies RouterReviewItem;
    });

    if (filters?.status) {
      hydrated = hydrated.filter((item) => item.status === filters.status);
    }
    if (typeof filters?.limit === "number") {
      hydrated = hydrated.slice(-Math.max(1, Math.trunc(filters.limit)));
    }
    return hydrated;
  }

  summarizeCalibrationWindow(): {
    totalDecisions: number;
    totalFeedback: number;
    mismatchCount: number;
    falseEscalationCount: number;
    avgFeedbackLatencySec: number;
    duplicateFeedbackCount: number;
    openReviewCount: number;
    highSeverityOpenReviewCount: number;
    feedbackBySource: Record<FeedbackSource, number>;
  } {
    const decisions = this.listDecisions();
    const feedback = this.listFeedback({ linkedOnly: true });
    const decisionById = new Map(decisions.map((item) => [item.decisionId, item]));
    const feedbackBySource: Record<FeedbackSource, number> = {
      explicit: 0,
      reaction: 0,
      implicit: 0,
    };

    let mismatchCount = 0;
    let falseEscalationCount = 0;
    let latencyTotal = 0;
    let latencyCount = 0;
    let duplicateFeedbackCount = 0;

    for (const item of feedback) {
      feedbackBySource[item.source] += 1;
      if (item.duplicateOfFeedbackId) {
        duplicateFeedbackCount += 1;
      }
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

    const reviewQueue = this.listReviewQueue();
    const openReviews = reviewQueue.filter((item) => item.status === "open");

    return {
      totalDecisions: decisions.length,
      totalFeedback: feedback.length,
      mismatchCount,
      falseEscalationCount,
      avgFeedbackLatencySec: latencyCount === 0 ? 0 : Math.round(latencyTotal / latencyCount),
      duplicateFeedbackCount,
      openReviewCount: openReviews.length,
      highSeverityOpenReviewCount: openReviews.filter((item) => item.severity === "high").length,
      feedbackBySource,
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

  private findDecisionByMessage(
    input: FeedbackInput,
    decisions: RouterDecisionRecord[],
  ): RouterDecisionRecord | undefined {
    if (!input.feedbackMessageId) {
      return undefined;
    }
    return decisions
      .slice()
      .toReversed()
      .find(
        (item) =>
          item.channelId === input.channelId &&
          (item.inputMessageId === input.feedbackMessageId ||
            item.outcomeMessageId === input.feedbackMessageId),
      );
  }

  private findRecentDuplicateFeedback(params: {
    allFeedback: RouterFeedbackRecord[];
    fingerprint: string;
  }): RouterFeedbackRecord | undefined {
    const cutoffMs = Date.now() - 10 * 60_000;
    return params.allFeedback
      .slice()
      .toReversed()
      .find(
        (item) =>
          item.fingerprint === params.fingerprint && new Date(item.createdAt).getTime() >= cutoffMs,
      );
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

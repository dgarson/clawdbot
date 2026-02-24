import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resetRouterFeedbackLoopStoreForTest } from "../../routing/feedback-loop-store.js";
import { routerFeedbackHandlers } from "./router-feedback.js";

async function invoke(
  method: keyof typeof routerFeedbackHandlers,
  params: Record<string, unknown>,
): Promise<{ ok: boolean; payload?: unknown; error?: unknown }> {
  let response: { ok: boolean; payload?: unknown; error?: unknown } | undefined;
  const handler = routerFeedbackHandlers[method];
  if (!handler) {
    throw new Error(`missing method ${method}`);
  }
  await handler({
    req: { type: "req", id: "1", method, params },
    params,
    client: null,
    isWebchatConnect: () => false,
    respond: (ok, payload, error) => {
      response = { ok, payload, error };
    },
    // oxlint-disable-next-line typescript/no-explicit-any
    context: {} as any,
  });
  if (!response) {
    throw new Error(`handler ${method} did not respond`);
  }
  return response;
}

describe("routerFeedbackHandlers", () => {
  const previousStateDir = process.env.OPENCLAW_STATE_DIR;

  afterEach(() => {
    if (previousStateDir === undefined) {
      delete process.env.OPENCLAW_STATE_DIR;
    } else {
      process.env.OPENCLAW_STATE_DIR = previousStateDir;
    }
    resetRouterFeedbackLoopStoreForTest();
  });

  it("logs decisions, captures feedback, and exposes query methods", async () => {
    const tempStateDir = fs.mkdtempSync(path.join(os.tmpdir(), "router-feedback-gateway-"));
    process.env.OPENCLAW_STATE_DIR = tempStateDir;

    const logged = await invoke("router.feedback.log_decision", {
      channelId: "slack",
      conversationId: "C123",
      threadId: "17000001.001",
      inputMessageId: "m-1",
      predictedTier: "T1",
      predictedAction: "handle",
      reasonTags: ["status_update"],
      outcomeMessageId: "m-2",
    });
    expect(logged.ok).toBe(true);

    const captured = await invoke("router.feedback.capture", {
      source: "implicit",
      channelId: "slack",
      conversationId: "C123",
      threadId: "17000001.001",
      freeText: "I expected T3 and this should escalate",
      feedbackMessageId: "m-2",
    });
    expect(captured.ok).toBe(true);

    const decisions = await invoke("router.feedback.decisions", { channelId: "slack" });
    expect(decisions.ok).toBe(true);
    expect((decisions.payload as { decisions: unknown[] }).decisions.length).toBe(1);

    const events = await invoke("router.feedback.events", { source: "implicit" });
    expect(events.ok).toBe(true);
    expect((events.payload as { feedback: unknown[] }).feedback.length).toBe(1);

    const queue = await invoke("router.feedback.review_queue", { status: "open", limit: 10 });
    expect(queue.ok).toBe(true);
    const queueItems = (queue.payload as { queue: Array<{ reviewId: string }> }).queue;
    expect(queueItems.length).toBe(1);

    const updated = await invoke("router.feedback.review_update", {
      reviewId: queueItems[0]?.reviewId,
      status: "resolved",
      actorId: "ops-user",
      note: "validated and corrected",
    });
    expect(updated.ok).toBe(true);

    const summary = await invoke("router.feedback.summary", {});
    expect(summary.ok).toBe(true);
    expect(
      (summary.payload as { summary: { totalDecisions: number } }).summary.totalDecisions,
    ).toBe(1);
  });

  it("rejects invalid payloads", async () => {
    const invalidLog = await invoke("router.feedback.log_decision", {
      channelId: "slack",
      predictedTier: "T9",
      predictedAction: "handle",
    });
    expect(invalidLog.ok).toBe(false);

    const invalidReviewUpdate = await invoke("router.feedback.review_update", {
      reviewId: "missing",
      status: "done",
    });
    expect(invalidReviewUpdate.ok).toBe(false);
  });
});

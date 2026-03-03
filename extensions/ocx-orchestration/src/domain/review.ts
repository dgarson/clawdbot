// ---------------------------------------------------------------------------
// Review request/verdict recording
// ---------------------------------------------------------------------------

import type { OrchestrationStore } from "../storage.js";
import type { ReviewRecord, ReviewVerdict } from "../types.js";

/**
 * Create a review request for a work item.
 */
export async function requestReview(
  store: OrchestrationStore,
  workItemId: string,
  reviewerAgentId: string,
): Promise<ReviewRecord | undefined> {
  const item = await store.getWorkItem(workItemId);
  if (!item) return undefined;

  const record: ReviewRecord = {
    workItemId,
    reviewerAgentId,
    requestedAt: new Date().toISOString(),
    verdict: null,
  };
  item.reviews.push(record);
  item.state = "in_review";
  await store.saveWorkItem(item);
  return record;
}

/**
 * Record a review verdict.
 */
export async function recordVerdict(
  store: OrchestrationStore,
  workItemId: string,
  reviewerAgentId: string,
  verdict: ReviewVerdict,
  feedback?: string,
): Promise<ReviewRecord | undefined> {
  const item = await store.getWorkItem(workItemId);
  if (!item) return undefined;

  // Find the most recent pending review from this reviewer
  const review = [...item.reviews]
    .reverse()
    .find((r) => r.reviewerAgentId === reviewerAgentId && r.verdict === null);
  if (!review) return undefined;

  review.verdict = verdict;
  review.completedAt = new Date().toISOString();
  if (feedback) review.feedback = feedback;

  // Update work item state based on verdict
  if (verdict === "approved") {
    // Check if all pending reviews are resolved
    const hasPending = item.reviews.some((r) => r.verdict === null);
    if (!hasPending) {
      item.state = "done";
    }
  } else if (verdict === "changes_requested") {
    item.state = "in_progress";
  } else if (verdict === "rejected") {
    item.state = "blocked";
  }

  await store.saveWorkItem(item);
  return review;
}

/**
 * List all review records for a work item.
 */
export async function listReviews(
  store: OrchestrationStore,
  workItemId: string,
): Promise<ReviewRecord[]> {
  const item = await store.getWorkItem(workItemId);
  return item?.reviews ?? [];
}

import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationStore } from "../storage.js";
import { recordVerdict, requestReview } from "./review.js";
import { createSprint } from "./sprint.js";
import { createWorkItem, updateWorkItemState } from "./work-item.js";

describe("review", () => {
  let tmpDir: string;
  let store: OrchestrationStore;
  let sprintId: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "orch-review-test-"));
    store = new OrchestrationStore(tmpDir);
    await store.ensureDir();
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    sprintId = sprint.id;
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // requestReview
  // -------------------------------------------------------------------------

  it("creates a review request and moves item to in_review", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Review me",
      description: "",
    });
    await updateWorkItemState(store, item.id, "in_progress");

    const review = await requestReview(store, item.id, "reviewer-1");
    expect(review).toBeDefined();
    expect(review!.workItemId).toBe(item.id);
    expect(review!.reviewerAgentId).toBe("reviewer-1");
    expect(review!.verdict).toBeNull();
    expect(review!.requestedAt).toBeDefined();

    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("in_review");
    expect(updated!.reviews).toHaveLength(1);
  });

  it("returns undefined for nonexistent work item", async () => {
    const result = await requestReview(store, "nonexistent", "reviewer-1");
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // recordVerdict
  // -------------------------------------------------------------------------

  it("records an approved verdict", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Approve me",
      description: "",
    });
    await requestReview(store, item.id, "reviewer-1");

    const review = await recordVerdict(store, item.id, "reviewer-1", "approved", "Looks good");
    expect(review).toBeDefined();
    expect(review!.verdict).toBe("approved");
    expect(review!.feedback).toBe("Looks good");
    expect(review!.completedAt).toBeDefined();
  });

  it("approved verdict moves item to done when all reviews approved", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "All approved",
      description: "",
    });
    await requestReview(store, item.id, "reviewer-1");
    await requestReview(store, item.id, "reviewer-2");

    // Approve both
    await recordVerdict(store, item.id, "reviewer-1", "approved");
    await recordVerdict(store, item.id, "reviewer-2", "approved");

    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("done");
  });

  it("does not move to done when some reviews are still pending", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Partial",
      description: "",
    });
    await requestReview(store, item.id, "reviewer-1");
    await requestReview(store, item.id, "reviewer-2");

    // Approve only one
    await recordVerdict(store, item.id, "reviewer-1", "approved");

    const updated = await store.getWorkItem(item.id);
    // State should stay in_review (not done) since reviewer-2 is still pending
    expect(updated!.state).toBe("in_review");
  });

  it("changes_requested moves item back to in_progress", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Changes needed",
      description: "",
    });
    await requestReview(store, item.id, "reviewer-1");

    await recordVerdict(store, item.id, "reviewer-1", "changes_requested", "Please fix the tests");

    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("in_progress");
  });

  it("rejected verdict moves item to blocked", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Rejected",
      description: "",
    });
    await requestReview(store, item.id, "reviewer-1");

    await recordVerdict(store, item.id, "reviewer-1", "rejected", "Not acceptable");

    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("blocked");
  });

  it("returns undefined when no pending review for the reviewer", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "No pending",
      description: "",
    });
    // No review requested for reviewer-1
    const result = await recordVerdict(store, item.id, "reviewer-1", "approved");
    expect(result).toBeUndefined();
  });

  it("returns undefined for nonexistent work item on verdict", async () => {
    const result = await recordVerdict(store, "nonexistent", "reviewer-1", "approved");
    expect(result).toBeUndefined();
  });
});

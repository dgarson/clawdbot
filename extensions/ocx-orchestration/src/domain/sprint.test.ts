import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationStore } from "../storage.js";
import {
  createSprint,
  getSprintReport,
  InvalidSprintTransitionError,
  isValidTransition,
  transitionSprint,
} from "./sprint.js";
import { createWorkItem } from "./work-item.js";

describe("sprint", () => {
  let tmpDir: string;
  let store: OrchestrationStore;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "orch-sprint-test-"));
    store = new OrchestrationStore(tmpDir);
    await store.ensureDir();
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Valid transitions
  // -------------------------------------------------------------------------

  it("allows planning -> active", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    expect(sprint.state).toBe("planning");
    const updated = await transitionSprint(store, sprint.id, "active");
    expect(updated.state).toBe("active");
  });

  it("allows active -> review", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    const updated = await transitionSprint(store, sprint.id, "review");
    expect(updated.state).toBe("review");
  });

  it("allows review -> retrospective", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    await transitionSprint(store, sprint.id, "review");
    const updated = await transitionSprint(store, sprint.id, "retrospective");
    expect(updated.state).toBe("retrospective");
  });

  it("allows review -> active (reopen)", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    await transitionSprint(store, sprint.id, "review");
    const updated = await transitionSprint(store, sprint.id, "active");
    expect(updated.state).toBe("active");
  });

  it("allows retrospective -> closed", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    await transitionSprint(store, sprint.id, "review");
    await transitionSprint(store, sprint.id, "retrospective");
    const updated = await transitionSprint(store, sprint.id, "closed");
    expect(updated.state).toBe("closed");
  });

  // -------------------------------------------------------------------------
  // Invalid transitions
  // -------------------------------------------------------------------------

  it("rejects planning -> review", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await expect(transitionSprint(store, sprint.id, "review")).rejects.toThrow(
      InvalidSprintTransitionError,
    );
  });

  it("rejects active -> closed", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    await expect(transitionSprint(store, sprint.id, "closed")).rejects.toThrow(
      InvalidSprintTransitionError,
    );
  });

  it("rejects planning -> retrospective", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await expect(transitionSprint(store, sprint.id, "retrospective")).rejects.toThrow(
      InvalidSprintTransitionError,
    );
  });

  it("rejects closed -> active", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    await transitionSprint(store, sprint.id, "active");
    await transitionSprint(store, sprint.id, "review");
    await transitionSprint(store, sprint.id, "retrospective");
    await transitionSprint(store, sprint.id, "closed");
    await expect(transitionSprint(store, sprint.id, "active")).rejects.toThrow(
      InvalidSprintTransitionError,
    );
  });

  // -------------------------------------------------------------------------
  // isValidTransition helper
  // -------------------------------------------------------------------------

  it("isValidTransition returns correct booleans", () => {
    expect(isValidTransition("planning", "active")).toBe(true);
    expect(isValidTransition("planning", "review")).toBe(false);
    expect(isValidTransition("active", "review")).toBe(true);
    expect(isValidTransition("active", "closed")).toBe(false);
    expect(isValidTransition("review", "retrospective")).toBe(true);
    expect(isValidTransition("review", "active")).toBe(true);
    expect(isValidTransition("retrospective", "closed")).toBe(true);
    expect(isValidTransition("closed", "planning")).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Sprint report
  // -------------------------------------------------------------------------

  it("getSprintReport aggregates work item states", async () => {
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint R" });
    await createWorkItem(store, { sprintId: sprint.id, title: "A", description: "" });
    await createWorkItem(store, { sprintId: sprint.id, title: "B", description: "" });
    const wi3 = await createWorkItem(store, { sprintId: sprint.id, title: "C", description: "" });
    // Move one item to done
    const item = await store.getWorkItem(wi3.id);
    if (item) {
      item.state = "done";
      await store.saveWorkItem(item);
    }

    const report = await getSprintReport(store, sprint.id);
    expect(report).toBeDefined();
    expect(report!.totalItems).toBe(3);
    expect(report!.workItemCounts.backlog).toBe(2);
    expect(report!.workItemCounts.done).toBe(1);
  });

  it("getSprintReport returns undefined for nonexistent sprint", async () => {
    const report = await getSprintReport(store, "nonexistent");
    expect(report).toBeUndefined();
  });

  it("throws when transitioning a nonexistent sprint", async () => {
    await expect(transitionSprint(store, "nonexistent", "active")).rejects.toThrow(
      "Sprint not found",
    );
  });
});

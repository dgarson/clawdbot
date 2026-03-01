import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationStore } from "../storage.js";
import {
  addDelegation,
  completeDelegation,
  findActiveDelegationBySessionKey,
} from "./delegation.js";
import { createSprint } from "./sprint.js";
import { createWorkItem } from "./work-item.js";

describe("delegation", () => {
  let tmpDir: string;
  let store: OrchestrationStore;
  let sprintId: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "orch-deleg-test-"));
    store = new OrchestrationStore(tmpDir);
    await store.ensureDir();
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    sprintId = sprint.id;
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // addDelegation
  // -------------------------------------------------------------------------

  it("adds a delegation to a work item and sets state to in_progress", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Delegated",
      description: "",
    });
    expect(item.state).toBe("backlog");

    const delegation = await addDelegation(store, item.id, {
      fromAgentId: "agent-coord",
      toAgentId: "agent-worker",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-1",
      isolated: false,
      status: "active",
    });

    expect(delegation).toBeDefined();
    expect(delegation!.fromAgentId).toBe("agent-coord");
    expect(delegation!.toAgentId).toBe("agent-worker");
    expect(delegation!.status).toBe("active");

    // Work item should move to in_progress
    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("in_progress");
    expect(updated!.delegations).toHaveLength(1);
  });

  it("returns undefined when adding delegation to nonexistent item", async () => {
    const result = await addDelegation(store, "nonexistent", {
      fromAgentId: "a",
      toAgentId: "b",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-x",
      isolated: false,
      status: "active",
    });
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // completeDelegation
  // -------------------------------------------------------------------------

  it("completes a delegation and moves item to in_review", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Complete me",
      description: "",
    });
    await addDelegation(store, item.id, {
      fromAgentId: "coord",
      toAgentId: "worker",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-complete",
      isolated: false,
      status: "active",
    });

    const completed = await completeDelegation(
      store,
      item.id,
      "sess-complete",
      "completed",
      "All done",
    );

    expect(completed).toBeDefined();
    expect(completed!.status).toBe("completed");
    expect(completed!.completedAt).toBeDefined();
    expect(completed!.outcome).toBe("All done");

    // Work item should move to in_review (no active delegations left)
    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("in_review");
  });

  it("failed delegation moves item to blocked", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Fail me",
      description: "",
    });
    await addDelegation(store, item.id, {
      fromAgentId: "coord",
      toAgentId: "worker",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-fail",
      isolated: false,
      status: "active",
    });

    await completeDelegation(store, item.id, "sess-fail", "failed", "Something broke");

    const updated = await store.getWorkItem(item.id);
    expect(updated!.state).toBe("blocked");
  });

  it("returns undefined when completing delegation on nonexistent item", async () => {
    const result = await completeDelegation(store, "nonexistent", "sess-x", "completed");
    expect(result).toBeUndefined();
  });

  it("returns undefined when session key does not match any active delegation", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "No match",
      description: "",
    });
    await addDelegation(store, item.id, {
      fromAgentId: "a",
      toAgentId: "b",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-real",
      isolated: false,
      status: "active",
    });

    const result = await completeDelegation(store, item.id, "sess-wrong", "completed");
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // findActiveDelegationBySessionKey
  // -------------------------------------------------------------------------

  it("finds active delegation by session key across all items", async () => {
    const item1 = await createWorkItem(store, {
      sprintId,
      title: "Item 1",
      description: "",
    });
    const item2 = await createWorkItem(store, {
      sprintId,
      title: "Item 2",
      description: "",
    });

    await addDelegation(store, item1.id, {
      fromAgentId: "a",
      toAgentId: "b",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-A",
      isolated: false,
      status: "active",
    });
    await addDelegation(store, item2.id, {
      fromAgentId: "c",
      toAgentId: "d",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-B",
      isolated: false,
      status: "active",
    });

    const found = await findActiveDelegationBySessionKey(store, "sess-B");
    expect(found).toBeDefined();
    expect(found!.workItemId).toBe(item2.id);
    expect(found!.delegation.sessionKey).toBe("sess-B");
  });

  it("returns undefined when no active delegation matches session key", async () => {
    const found = await findActiveDelegationBySessionKey(store, "nonexistent-sess");
    expect(found).toBeUndefined();
  });

  it("does not find completed delegations by session key", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Completed",
      description: "",
    });
    await addDelegation(store, item.id, {
      fromAgentId: "a",
      toAgentId: "b",
      delegatedAt: new Date().toISOString(),
      sessionKey: "sess-done",
      isolated: false,
      status: "active",
    });
    await completeDelegation(store, item.id, "sess-done", "completed");

    const found = await findActiveDelegationBySessionKey(store, "sess-done");
    expect(found).toBeUndefined();
  });
});

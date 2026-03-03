import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OrchestrationStore } from "../storage.js";
import { createSprint } from "./sprint.js";
import {
  createWorkItem,
  findByExternalRef,
  listWorkItems,
  updateWorkItem,
  updateWorkItemState,
} from "./work-item.js";

describe("work-item", () => {
  let tmpDir: string;
  let store: OrchestrationStore;
  let sprintId: string;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), "orch-wi-test-"));
    store = new OrchestrationStore(tmpDir);
    await store.ensureDir();
    const sprint = await createSprint(store, { teamId: "t1", name: "Sprint 1" });
    sprintId = sprint.id;
  });

  afterEach(async () => {
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  it("creates a work item with default state backlog", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Implement feature",
      description: "Description here",
    });
    expect(item.id).toMatch(/^wi-/);
    expect(item.state).toBe("backlog");
    expect(item.title).toBe("Implement feature");
    expect(item.sprintId).toBe(sprintId);
    expect(item.delegations).toEqual([]);
    expect(item.reviews).toEqual([]);
  });

  it("creates with optional fields", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "With refs",
      description: "desc",
      assigneeAgentId: "agent-1",
      acceptanceCriteria: ["Test passes"],
      externalRefs: ["https://github.com/org/repo/pull/1"],
    });
    expect(item.assigneeAgentId).toBe("agent-1");
    expect(item.acceptanceCriteria).toEqual(["Test passes"]);
    expect(item.externalRefs).toEqual(["https://github.com/org/repo/pull/1"]);
  });

  it("links newly created work item to its sprint", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Linked",
      description: "",
    });
    const sprint = await store.getSprint(sprintId);
    expect(sprint!.workItems).toContain(item.id);
  });

  // -------------------------------------------------------------------------
  // Update
  // -------------------------------------------------------------------------

  it("updates title and description", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "Old",
      description: "Old desc",
    });
    const updated = await updateWorkItem(store, item.id, {
      title: "New",
      description: "New desc",
    });
    expect(updated).toBeDefined();
    expect(updated!.title).toBe("New");
    expect(updated!.description).toBe("New desc");
  });

  it("returns undefined when updating nonexistent item", async () => {
    const result = await updateWorkItem(store, "nonexistent", { title: "X" });
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // State transitions
  // -------------------------------------------------------------------------

  it("transitions work item state", async () => {
    const item = await createWorkItem(store, {
      sprintId,
      title: "State test",
      description: "",
    });
    expect(item.state).toBe("backlog");

    const ready = await updateWorkItemState(store, item.id, "ready");
    expect(ready!.state).toBe("ready");

    const inProg = await updateWorkItemState(store, item.id, "in_progress");
    expect(inProg!.state).toBe("in_progress");

    const done = await updateWorkItemState(store, item.id, "done");
    expect(done!.state).toBe("done");
  });

  it("returns undefined when transitioning nonexistent item", async () => {
    const result = await updateWorkItemState(store, "nonexistent", "done");
    expect(result).toBeUndefined();
  });

  // -------------------------------------------------------------------------
  // Listing & filtering
  // -------------------------------------------------------------------------

  it("lists items filtered by sprint", async () => {
    await createWorkItem(store, { sprintId, title: "A", description: "" });
    await createWorkItem(store, { sprintId, title: "B", description: "" });

    const items = await listWorkItems(store, { sprintId });
    expect(items).toHaveLength(2);
  });

  it("lists items filtered by state", async () => {
    const item = await createWorkItem(store, { sprintId, title: "A", description: "" });
    await updateWorkItemState(store, item.id, "done");
    await createWorkItem(store, { sprintId, title: "B", description: "" });

    const doneItems = await listWorkItems(store, { state: "done" });
    expect(doneItems).toHaveLength(1);
    expect(doneItems[0].title).toBe("A");
  });

  // -------------------------------------------------------------------------
  // findByExternalRef
  // -------------------------------------------------------------------------

  it("finds item by external ref", async () => {
    const prUrl = "https://github.com/org/repo/pull/42";
    await createWorkItem(store, {
      sprintId,
      title: "PR item",
      description: "",
      externalRefs: [prUrl],
    });

    const found = await findByExternalRef(store, prUrl);
    expect(found).toBeDefined();
    expect(found!.title).toBe("PR item");
  });

  it("returns undefined when external ref not found", async () => {
    const found = await findByExternalRef(store, "https://unknown");
    expect(found).toBeUndefined();
  });
});

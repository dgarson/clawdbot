import { describe, expect, it } from "vitest";
import { createSessionRelationshipTracker } from "./session-relationship-tracker.js";

describe("SessionRelationshipTracker", () => {
  it("tracks parent-child spawn relationship", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({
      parentSessionKey: "parent-1",
      childSessionKey: "child-1",
      runId: "run-1",
      agentId: "agent-1",
    });

    expect(tracker.getParent("child-1")).toBe("parent-1");
    expect(tracker.getChildren("parent-1")).toEqual(["child-1"]);
  });

  it("tracks multiple children for same parent", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c1" });
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c2" });
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c3" });

    expect(tracker.getChildren("p")).toEqual(["c1", "c2", "c3"]);
  });

  it("tracks end of child session", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c" });
    tracker.trackEnd("c", "ok");

    const record = tracker.getRecord("c");
    expect(record).toBeDefined();
    expect(record!.outcome).toBe("ok");
    expect(record!.endedAt).toBeGreaterThan(0);
  });

  it("returns full relationship graph via getRelated", () => {
    const tracker = createSessionRelationshipTracker();
    // grandparent → parent → child
    tracker.trackSpawn({ parentSessionKey: "gp", childSessionKey: "p" });
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c" });

    const fromChild = tracker.getRelated("c");
    expect(fromChild.parent).toBe("p");
    expect(fromChild.ancestors).toEqual(["p", "gp"]);
    expect(fromChild.children).toEqual([]);
    expect(fromChild.descendants).toEqual([]);

    const fromParent = tracker.getRelated("p");
    expect(fromParent.parent).toBe("gp");
    expect(fromParent.ancestors).toEqual(["gp"]);
    expect(fromParent.children).toEqual(["c"]);
    expect(fromParent.descendants).toEqual(["c"]);

    const fromGp = tracker.getRelated("gp");
    expect(fromGp.parent).toBeUndefined();
    expect(fromGp.ancestors).toEqual([]);
    expect(fromGp.children).toEqual(["p"]);
    expect(fromGp.descendants).toContain("p");
    expect(fromGp.descendants).toContain("c");
  });

  it("collectRelatedStates gathers state from store for all related sessions", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "sub1" });
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "sub2" });

    // Mock store
    const store = {
      get: (key: string) => ({ sessionKey: key, count: key.length }),
    };

    const related = tracker.collectRelatedStates("sub1", store);
    // Should include self, parent (root), and sibling (sub2 is NOT related — only ancestors/descendants)
    expect(related.has("sub1")).toBe(true);
    expect(related.has("root")).toBe(true);
    // sub2 is a sibling, not ancestor/descendant — not included
    expect(related.has("sub2")).toBe(false);
  });

  it("cleanup removes session tracking data", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c" });

    tracker.cleanup("c");
    expect(tracker.getParent("c")).toBeUndefined();
    expect(tracker.getChildren("p")).toEqual([]);
  });

  it("handles missing sessions gracefully", () => {
    const tracker = createSessionRelationshipTracker();

    expect(tracker.getParent("nonexistent")).toBeUndefined();
    expect(tracker.getChildren("nonexistent")).toEqual([]);
    expect(tracker.getRecord("nonexistent")).toBeUndefined();

    const related = tracker.getRelated("nonexistent");
    expect(related.parent).toBeUndefined();
    expect(related.ancestors).toEqual([]);
    expect(related.children).toEqual([]);
    expect(related.descendants).toEqual([]);
  });

  it("handles circular references safely", () => {
    const tracker = createSessionRelationshipTracker();
    // Artificially create a cycle (shouldn't happen in practice)
    tracker.trackSpawn({ parentSessionKey: "a", childSessionKey: "b" });
    tracker.trackSpawn({ parentSessionKey: "b", childSessionKey: "a" });

    // Should not infinite loop
    const related = tracker.getRelated("a");
    expect(related.ancestors.length).toBeLessThan(10);
    expect(related.descendants.length).toBeLessThan(10);
  });

  // ---------------------------------------------------------------------------
  // Edge cases & contract hardening
  // ---------------------------------------------------------------------------

  it("trackEnd on non-existent child is a no-op", () => {
    const tracker = createSessionRelationshipTracker();
    // Should not throw
    tracker.trackEnd("nonexistent", "ok");
    expect(tracker.getRecord("nonexistent")).toBeUndefined();
  });

  it("cleanup of a parent removes its childrenOf entry", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c1" });
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c2" });

    tracker.cleanup("p");
    // Parent's childrenOf set should be removed
    expect(tracker.getChildren("p")).toEqual([]);
    // But children still have their own records (no cascade)
    expect(tracker.getRecord("c1")).toBeDefined();
    expect(tracker.getRecord("c2")).toBeDefined();
  });

  it("cleanup does not cascade to children's records", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "mid" });
    tracker.trackSpawn({ parentSessionKey: "mid", childSessionKey: "leaf" });

    tracker.cleanup("mid");

    // mid is gone as a child and as a parent
    expect(tracker.getParent("mid")).toBeUndefined();
    expect(tracker.getChildren("mid")).toEqual([]);

    // leaf's record still exists (points to mid, which is now dangling)
    expect(tracker.getRecord("leaf")).toBeDefined();
    expect(tracker.getParent("leaf")).toBe("mid");

    // root still has mid in its children set? No — cleanup removes mid from root's children
    expect(tracker.getChildren("root")).toEqual([]);
  });

  it("deep hierarchy: 4+ levels traverse correctly", () => {
    const tracker = createSessionRelationshipTracker();
    // L0 → L1 → L2 → L3 → L4
    tracker.trackSpawn({ parentSessionKey: "L0", childSessionKey: "L1" });
    tracker.trackSpawn({ parentSessionKey: "L1", childSessionKey: "L2" });
    tracker.trackSpawn({ parentSessionKey: "L2", childSessionKey: "L3" });
    tracker.trackSpawn({ parentSessionKey: "L3", childSessionKey: "L4" });

    // From L4: ancestors should be [L3, L2, L1, L0]
    const fromL4 = tracker.getRelated("L4");
    expect(fromL4.ancestors).toEqual(["L3", "L2", "L1", "L0"]);
    expect(fromL4.descendants).toEqual([]);

    // From L0: descendants should include all
    const fromL0 = tracker.getRelated("L0");
    expect(fromL0.ancestors).toEqual([]);
    expect(new Set(fromL0.descendants)).toEqual(new Set(["L1", "L2", "L3", "L4"]));

    // From L2: both ancestors and descendants
    const fromL2 = tracker.getRelated("L2");
    expect(fromL2.ancestors).toEqual(["L1", "L0"]);
    expect(new Set(fromL2.descendants)).toEqual(new Set(["L3", "L4"]));
  });

  it("wide hierarchy: many siblings from same parent", () => {
    const tracker = createSessionRelationshipTracker();
    for (let i = 0; i < 20; i++) {
      tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: `child-${i}` });
    }

    expect(tracker.getChildren("root")).toHaveLength(20);

    const related = tracker.getRelated("root");
    expect(related.descendants).toHaveLength(20);

    // Each child sees root as parent
    for (let i = 0; i < 20; i++) {
      expect(tracker.getParent(`child-${i}`)).toBe("root");
      const childRelated = tracker.getRelated(`child-${i}`);
      expect(childRelated.ancestors).toEqual(["root"]);
      expect(childRelated.descendants).toEqual([]);
      // Siblings are NOT in ancestors/descendants
      expect(childRelated.children).toEqual([]);
    }
  });

  it("getRecord returns full relationship data including optional fields", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({
      parentSessionKey: "parent-sess",
      childSessionKey: "child-sess",
      runId: "run-42",
      agentId: "summarizer",
      label: "summarize-task",
    });

    const record = tracker.getRecord("child-sess");
    expect(record).toBeDefined();
    expect(record!.parentSessionKey).toBe("parent-sess");
    expect(record!.childSessionKey).toBe("child-sess");
    expect(record!.runId).toBe("run-42");
    expect(record!.agentId).toBe("summarizer");
    expect(record!.label).toBe("summarize-task");
    expect(record!.spawnedAt).toBeGreaterThan(0);
    expect(record!.endedAt).toBeUndefined();
    expect(record!.outcome).toBeUndefined();
  });

  it("trackEnd updates endedAt and outcome on existing record", () => {
    const tracker = createSessionRelationshipTracker();
    const before = Date.now();
    tracker.trackSpawn({ parentSessionKey: "p", childSessionKey: "c" });
    tracker.trackEnd("c", "error");

    const record = tracker.getRecord("c");
    expect(record!.endedAt).toBeGreaterThanOrEqual(before);
    expect(record!.outcome).toBe("error");
  });

  it("collectRelatedStates includes descendants", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "mid" });
    tracker.trackSpawn({ parentSessionKey: "mid", childSessionKey: "leaf" });

    const store = {
      get: (key: string) => ({ key, value: key.length }),
    };

    // From root: should include self + descendants (mid, leaf)
    const fromRoot = tracker.collectRelatedStates("root", store);
    expect(fromRoot.has("root")).toBe(true);
    expect(fromRoot.has("mid")).toBe(true);
    expect(fromRoot.has("leaf")).toBe(true);
  });

  it("collectRelatedStates skips keys where store returns undefined", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "child" });

    const store = {
      get: (key: string) => (key === "root" ? { key } : undefined),
    };

    const related = tracker.collectRelatedStates("child", store);
    // child itself returns undefined from store, so not included
    expect(related.has("child")).toBe(false);
    // root is available
    expect(related.has("root")).toBe(true);
    expect(related.size).toBe(1);
  });

  it("second trackSpawn for same child overwrites previous relationship", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "parent-1", childSessionKey: "child" });
    tracker.trackSpawn({ parentSessionKey: "parent-2", childSessionKey: "child" });

    // child's parent should be updated
    expect(tracker.getParent("child")).toBe("parent-2");

    // parent-2 should have child
    expect(tracker.getChildren("parent-2")).toContain("child");

    // But parent-1 also still has child in its set (design: no cleanup of old parent)
    // This is expected behavior — trackSpawn doesn't clean up old parent refs
    expect(tracker.getChildren("parent-1")).toContain("child");
  });

  it("getRelated for root node has no parent or ancestors", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "c1" });
    tracker.trackSpawn({ parentSessionKey: "root", childSessionKey: "c2" });

    const related = tracker.getRelated("root");
    expect(related.sessionKey).toBe("root");
    expect(related.parent).toBeUndefined();
    expect(related.ancestors).toEqual([]);
    expect(related.children).toEqual(["c1", "c2"]);
    expect(new Set(related.descendants)).toEqual(new Set(["c1", "c2"]));
  });

  it("diamond dependency: child with multiple ancestors through different paths", () => {
    const tracker = createSessionRelationshipTracker();
    // A → B, A → C, B → D, C → D (diamond)
    tracker.trackSpawn({ parentSessionKey: "A", childSessionKey: "B" });
    tracker.trackSpawn({ parentSessionKey: "A", childSessionKey: "C" });
    tracker.trackSpawn({ parentSessionKey: "B", childSessionKey: "D" });
    // D is re-spawned by C (overwrites parent)
    tracker.trackSpawn({ parentSessionKey: "C", childSessionKey: "D" });

    // D's parent is now C (last trackSpawn wins)
    expect(tracker.getParent("D")).toBe("C");
    // D's ancestors: C → A
    const fromD = tracker.getRelated("D");
    expect(fromD.ancestors).toEqual(["C", "A"]);

    // A's descendants: B (and its child D via old ref), C (and its child D)
    const fromA = tracker.getRelated("A");
    expect(fromA.descendants).toContain("B");
    expect(fromA.descendants).toContain("C");
    expect(fromA.descendants).toContain("D");
  });

  it("cleanup then re-spawn: fresh relationship works", () => {
    const tracker = createSessionRelationshipTracker();
    tracker.trackSpawn({ parentSessionKey: "p1", childSessionKey: "c" });
    tracker.cleanup("c");

    tracker.trackSpawn({ parentSessionKey: "p2", childSessionKey: "c" });
    expect(tracker.getParent("c")).toBe("p2");
    expect(tracker.getChildren("p2")).toEqual(["c"]);
  });
});

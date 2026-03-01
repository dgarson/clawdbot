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
});

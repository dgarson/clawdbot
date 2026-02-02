import { describe, expect, it } from "vitest";
import { mergeGraphById, normalizeSelection, type GraphData } from "./types";

describe("integrations/graph", () => {
  it("mergeGraphById merges nodes and edges by id", () => {
    const base: GraphData<{ v: number }, { v: number }> = {
      nodes: [{ id: "a", label: "A", data: { v: 1 } }],
      edges: [{ id: "e1", source: "a", target: "b", data: { v: 1 } }],
    };

    const patch: GraphData<{ v: number }, { v: number }> = {
      nodes: [
        { id: "a", label: "A2", data: { v: 2 } },
        { id: "b", label: "B", data: { v: 3 } },
      ],
      edges: [
        { id: "e1", source: "a", target: "b", data: { v: 2 } },
        { id: "e2", source: "b", target: "a", data: { v: 3 } },
      ],
    };

    const merged = mergeGraphById(base, patch);
    expect(merged.nodes.map((n) => n.id).toSorted()).toEqual(["a", "b"]);
    expect(merged.edges.map((e) => e.id).toSorted()).toEqual(["e1", "e2"]);

    expect(merged.nodes.find((n) => n.id === "a")?.label).toBe("A2");
    expect(merged.edges.find((e) => e.id === "e1")?.data?.v).toBe(2);
  });

  it("normalizeSelection accepts node/edge selections and rejects invalid shapes", () => {
    expect(normalizeSelection({ type: "node", id: "n1" })).toEqual({ type: "node", id: "n1" });
    expect(normalizeSelection({ type: "edge", id: "e1" })).toEqual({ type: "edge", id: "e1" });
    expect(normalizeSelection({ type: "none" })).toEqual({ type: "none" });
    expect(normalizeSelection({ type: "node", id: 123 })).toEqual({ type: "none" });
    expect(normalizeSelection("wat")).toEqual({ type: "none" });
  });
});


import { describe, expect, it } from "vitest";
import { parseMetadata, serializeMetadataBody } from "./github-provider.js";

describe("parseMetadata / serializeMetadataBody round-trip", () => {
  it("round-trips body text and metadata correctly", () => {
    const body = "Some issue description.";
    const classifications = [
      { dimension: "complexity" as const, value: "high", source: "agent" as const },
    ];
    const references = [{ id: "ref-1", kind: "artifact" as const, uri: "/src/foo.ts" }];
    const relationships = [{ kind: "blocks" as const, ticketId: "42" }];

    const serialized = serializeMetadataBody(body, {
      classifications,
      references,
      relationships,
    });

    const parsed = parseMetadata(serialized);
    expect(parsed.textBody).toBe(body);
    expect(parsed.classifications).toEqual(classifications);
    expect(parsed.references).toEqual(references);
    expect(parsed.relationships).toEqual(relationships);
  });

  it("returns empty metadata when body has no marker", () => {
    const parsed = parseMetadata("Plain issue text.");
    expect(parsed.textBody).toBe("Plain issue text.");
    expect(parsed.classifications).toEqual([]);
    expect(parsed.references).toEqual([]);
    expect(parsed.relationships).toEqual([]);
  });

  it("returns empty metadata when body is null", () => {
    const parsed = parseMetadata(null);
    expect(parsed.textBody).toBe("");
    expect(parsed.classifications).toEqual([]);
  });

  it("preserves existing metadata on simulated merge", () => {
    // Simulate what updateTicket does: serialize initial, parse it back, merge new data
    const initial = serializeMetadataBody("Initial body", {
      classifications: [{ dimension: "priority" as const, value: "p1" }],
      references: [{ id: "ref-1", kind: "artifact" as const, uri: "/a.ts" }],
      relationships: [{ kind: "blocks" as const, ticketId: "10" }],
    });

    // Parse existing
    const existing = parseMetadata(initial);

    // Simulate addRelationship merge
    const mergedRelationships = [
      ...existing.relationships,
      { kind: "blocked_by" as const, ticketId: "20" },
    ];

    const merged = serializeMetadataBody(existing.textBody, {
      classifications: existing.classifications,
      references: existing.references,
      relationships: mergedRelationships,
    });

    const final = parseMetadata(merged);
    expect(final.textBody).toBe("Initial body");
    expect(final.classifications).toEqual([{ dimension: "priority", value: "p1" }]);
    expect(final.references).toEqual([{ id: "ref-1", kind: "artifact", uri: "/a.ts" }]);
    expect(final.relationships).toHaveLength(2);
    expect(final.relationships).toEqual(
      expect.arrayContaining([
        { kind: "blocks", ticketId: "10" },
        { kind: "blocked_by", ticketId: "20" },
      ]),
    );
  });
});

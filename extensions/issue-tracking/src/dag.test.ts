import { describe, it, expect } from "vitest";
import { buildIssueDagFromTickets } from "./dag.js";
import type { IssueTicket, TicketRelationshipKind } from "./types.js";

const createTicket = (
  id: string,
  relationships: { ticketId: string; kind: TicketRelationshipKind }[] = [],
): IssueTicket => ({
  id,
  trackerId: "tracker-1",
  title: `Ticket ${id}`,
  status: "backlog",
  labels: [],
  classifications: [],
  references: [],
  relationships,
  createdAt: "2024-01-01T00:00:00Z",
  updatedAt: "2024-01-01T00:00:00Z",
});

describe("buildIssueDagFromTickets", () => {
  // A -> B -> C
  // D -> B
  // E (orphan)
  // F blocks G
  const tickets: IssueTicket[] = [
    createTicket("A", [{ ticketId: "B", kind: "blocks" }]),
    createTicket("B", [{ ticketId: "C", kind: "blocks" }]),
    createTicket("C", []),
    createTicket("D", [{ ticketId: "B", kind: "related" }]),
    createTicket("E", []),
    createTicket("F", [{ ticketId: "G", kind: "blocks" }]),
    createTicket("G", []),
  ];

  it("filters by rootTicketIds and tests direction: outbound", () => {
    // Starting at A, outbound should find A, B, C
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["A"],
      direction: "outbound",
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C"]);
    expect(result.edges).toHaveLength(2);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        { fromTicketId: "A", toTicketId: "B", kind: "blocks" },
        { fromTicketId: "B", toTicketId: "C", kind: "blocks" },
      ]),
    );
  });

  it("tests direction: inbound", () => {
    // Starting at B, inbound should find B, A, D
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["B"],
      direction: "inbound",
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "D"]);
    expect(result.edges).toHaveLength(2);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        { fromTicketId: "A", toTicketId: "B", kind: "blocks" },
        { fromTicketId: "D", toTicketId: "B", kind: "related" },
      ]),
    );
  });

  it("tests direction: both", () => {
    // Starting at B, both should find A, B, C, D
    const result = buildIssueDagFromTickets(tickets, { rootTicketIds: ["B"], direction: "both" });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D"]);
    expect(result.edges).toHaveLength(3);
  });

  it("tests maxDepth", () => {
    // Starting at A, outbound, maxDepth 1 -> should only find A, B
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["A"],
      direction: "outbound",
      maxDepth: 1,
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
    expect(result.edges).toHaveLength(1);
    expect(result.edges).toEqual([{ fromTicketId: "A", toTicketId: "B", kind: "blocks" }]);
  });

  it("tests relationshipKinds", () => {
    // Starting at D, both, but only 'blocks'.
    // D -> B is 'related', so B is NOT reachable via 'blocks'.
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["D"],
      direction: "both",
      relationshipKinds: ["blocks"],
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["D"]);
    expect(result.edges).toHaveLength(0);

    // Starting at B, inbound, only 'blocks'.
    // A -> B is 'blocks', D -> B is 'related'.
    // So only A is reachable via inbound blocks.
    const result2 = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["B"],
      direction: "inbound",
      relationshipKinds: ["blocks"],
    });
    expect(result2.nodes.map((n) => n.id).sort()).toEqual(["A", "B"]);
    expect(result2.edges).toHaveLength(1);
    expect(result2.edges).toEqual([{ fromTicketId: "A", toTicketId: "B", kind: "blocks" }]);
  });

  it("tests includeOrphans", () => {
    // With includeOrphans: true, it should return all tickets even if not reachable from roots
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["A"],
      direction: "outbound",
      includeOrphans: true,
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    // Outbound edges only include edges originating from visited nodes (A, B, C)
    expect(result.edges).toHaveLength(2);
    expect(result.edges).toEqual(
      expect.arrayContaining([
        { fromTicketId: "A", toTicketId: "B", kind: "blocks" },
        { fromTicketId: "B", toTicketId: "C", kind: "blocks" },
      ]),
    );
  });

  it("tests multiple root ids", () => {
    // Root ids D and F, outbound
    // D -> B -> C
    // F -> G
    const result = buildIssueDagFromTickets(tickets, {
      rootTicketIds: ["D", "F"],
      direction: "outbound",
    });
    expect(result.nodes.map((n) => n.id).sort()).toEqual(["B", "C", "D", "F", "G"]);
    expect(result.edges).toHaveLength(3); // D->B, B->C, F->G
  });
});

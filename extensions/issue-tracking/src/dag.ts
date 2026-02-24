import type { IssueDag, IssueDagDirection, IssueDagQuery, IssueTicket } from "./types.js";

function includesDirection(
  direction: IssueDagDirection,
  candidate: "outbound" | "inbound",
): boolean {
  return direction === "both" || direction === candidate;
}

export function buildIssueDagFromTickets(
  allTickets: IssueTicket[],
  query: IssueDagQuery,
): IssueDag {
  const relationshipKinds = query.relationshipKinds;
  const maxDepth = Math.max(1, query.maxDepth ?? 5);
  const direction = query.direction ?? "outbound";
  const includeOrphans = query.includeOrphans === true;
  const ticketById = new Map(allTickets.map((ticket) => [ticket.id, ticket]));

  const adjacencyOut = new Map<string, Set<string>>();
  const adjacencyIn = new Map<string, Set<string>>();

  for (const ticket of allTickets) {
    for (const relationship of ticket.relationships) {
      if (relationshipKinds && !relationshipKinds.includes(relationship.kind)) {
        continue;
      }
      if (!ticketById.has(relationship.ticketId)) {
        continue;
      }
      const from = ticket.id;
      const to = relationship.ticketId;
      if (!adjacencyOut.has(from)) {
        adjacencyOut.set(from, new Set());
      }
      adjacencyOut.get(from)?.add(to);
      if (!adjacencyIn.has(to)) {
        adjacencyIn.set(to, new Set());
      }
      adjacencyIn.get(to)?.add(from);
    }
  }

  const defaultRoots = allTickets.map((ticket) => ticket.id);
  const rootIds = (
    query.rootTicketIds && query.rootTicketIds.length > 0 ? query.rootTicketIds : defaultRoots
  ).filter((id) => ticketById.has(id));

  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = rootIds.map((id) => ({ id, depth: 0 }));

  while (queue.length > 0) {
    const next = queue.shift();
    if (!next) {
      continue;
    }
    if (visited.has(next.id)) {
      continue;
    }
    visited.add(next.id);
    if (next.depth >= maxDepth) {
      continue;
    }

    if (includesDirection(direction, "outbound")) {
      for (const neighbor of adjacencyOut.get(next.id) ?? []) {
        queue.push({ id: neighbor, depth: next.depth + 1 });
      }
    }
    if (includesDirection(direction, "inbound")) {
      for (const neighbor of adjacencyIn.get(next.id) ?? []) {
        queue.push({ id: neighbor, depth: next.depth + 1 });
      }
    }
  }

  const nodes = includeOrphans ? allTickets : allTickets.filter((ticket) => visited.has(ticket.id));
  const nodeIds = new Set(nodes.map((ticket) => ticket.id));
  const edges = allTickets.flatMap((ticket) =>
    ticket.relationships
      .filter((relationship) => {
        if (relationshipKinds && !relationshipKinds.includes(relationship.kind)) {
          return false;
        }
        if (!nodeIds.has(ticket.id) || !nodeIds.has(relationship.ticketId)) {
          return false;
        }
        if (direction === "outbound") {
          return visited.has(ticket.id);
        }
        if (direction === "inbound") {
          return visited.has(relationship.ticketId);
        }
        return visited.has(ticket.id) || visited.has(relationship.ticketId);
      })
      .map((relationship) => ({
        fromTicketId: ticket.id,
        toTicketId: relationship.ticketId,
        kind: relationship.kind,
      })),
  );

  return { nodes, edges };
}

import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult, ToolInputError } from "../../../src/agents/tools/common.js";
import type { IssueTrackerRegistry } from "./registry.js";
import type {
  ClassificationDimension,
  ClassificationValue,
  IssueDagDirection,
  TicketRelationshipKind,
  TicketStatus,
} from "./types.js";

const TICKET_STATUSES = new Set<TicketStatus>([
  "backlog",
  "ready",
  "in_progress",
  "blocked",
  "in_review",
  "done",
  "canceled",
]);

const RELATIONSHIP_KINDS = new Set<TicketRelationshipKind>([
  "blocks",
  "blocked_by",
  "duplicates",
  "related",
]);

const CLASSIFICATION_DIMENSIONS = new Set<ClassificationDimension>([
  "complexity",
  "business_domain",
  "priority",
  "risk",
  "custom",
]);

const DAG_DIRECTIONS = new Set<IssueDagDirection>(["outbound", "inbound", "both"]);

const ProviderAndTicketSchema = Type.Object({
  providerId: Type.String({ description: "Issue tracker provider id." }),
  ticketId: Type.String({ description: "Source ticket id." }),
});

function readStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.filter((entry: unknown): entry is string => typeof entry === "string");
}

function readStatus(value: unknown): TicketStatus | undefined {
  if (typeof value !== "string" || !TICKET_STATUSES.has(value as TicketStatus)) {
    return undefined;
  }
  return value as TicketStatus;
}

function readRelationshipKind(value: unknown): TicketRelationshipKind | undefined {
  if (typeof value !== "string" || !RELATIONSHIP_KINDS.has(value as TicketRelationshipKind)) {
    return undefined;
  }
  return value as TicketRelationshipKind;
}

function readDagDirection(value: unknown): IssueDagDirection | undefined {
  if (typeof value !== "string" || !DAG_DIRECTIONS.has(value as IssueDagDirection)) {
    return undefined;
  }
  return value as IssueDagDirection;
}

function readClassifications(value: unknown): ClassificationValue[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter(
      (entry: unknown): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => {
      const source: ClassificationValue["source"] =
        entry.source === "human" || entry.source === "agent" || entry.source === "system"
          ? entry.source
          : undefined;
      return {
        dimension:
          typeof entry.dimension === "string" &&
          CLASSIFICATION_DIMENSIONS.has(entry.dimension as ClassificationDimension)
            ? (entry.dimension as ClassificationDimension)
            : "custom",
        value: typeof entry.value === "string" ? entry.value : "",
        source,
      };
    })
    .filter((classification) => classification.value.trim().length > 0);
}

export function createIssueTrackingTools(registry: IssueTrackerRegistry): AnyAgentTool[] {
  const createTicketTool: AnyAgentTool = {
    name: "issue_tracking_create",
    label: "Issue Tracking Create",
    description:
      "Create a ticket. Optionally include relationships (for example blocks/blocked_by) at creation time to start a dependency DAG.",
    parameters: Type.Object({
      providerId: Type.String({ description: "Issue tracker provider id." }),
      title: Type.String({ description: "Ticket title." }),
      body: Type.Optional(Type.String({ description: "Optional ticket body/details." })),
      status: Type.Optional(Type.String({ description: "Optional status value." })),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Optional label list." })),
      classifications: Type.Optional(
        Type.Array(
          Type.Object({
            dimension: Type.String({
              description:
                "Classification dimension (complexity, business_domain, priority, risk, custom).",
            }),
            value: Type.String({ description: "Classification value." }),
            source: Type.Optional(
              Type.String({ description: "Optional source: human, agent, or system." }),
            ),
          }),
        ),
      ),
      references: Type.Optional(
        Type.Array(
          Type.Object({
            id: Type.String({ description: "Reference id." }),
            kind: Type.String({ description: "Reference kind: artifact, ticket, or external." }),
            title: Type.Optional(Type.String({ description: "Optional reference title." })),
            uri: Type.String({ description: "Reference URI/path." }),
          }),
        ),
      ),
      relationships: Type.Optional(
        Type.Array(
          Type.Object({
            kind: Type.String({
              description:
                "Dependency link kind: blocks, blocked_by, duplicates, related. Use blocks/blocked_by to build a DAG.",
            }),
            ticketId: Type.String({ description: "Target ticket id for this relationship." }),
          }),
        ),
      ),
    }),
    async execute(_toolCallId, params) {
      const providerId = typeof params.providerId === "string" ? params.providerId : "";
      const title = typeof params.title === "string" ? params.title.trim() : "";
      if (!providerId || !title) {
        throw new ToolInputError("providerId and title are required");
      }
      const provider = registry.get(providerId);
      if (!provider) {
        throw new ToolInputError(`Unknown issue tracker provider: ${providerId}`);
      }
      const created = await provider.createTicket({
        title,
        body: typeof params.body === "string" ? params.body : undefined,
        status: readStatus(params.status),
        labels: readStringArray(params.labels),
        classifications: readClassifications(params.classifications),
        references: Array.isArray(params.references)
          ? params.references
              .filter(
                (entry: unknown): entry is Record<string, unknown> =>
                  typeof entry === "object" && entry !== null,
              )
              .map((entry: Record<string, unknown>) => ({
                id: typeof entry.id === "string" ? entry.id : "",
                kind:
                  entry.kind === "artifact" || entry.kind === "ticket" || entry.kind === "external"
                    ? entry.kind
                    : "external",
                title: typeof entry.title === "string" ? entry.title : undefined,
                uri: typeof entry.uri === "string" ? entry.uri : "",
              }))
              .filter((entry: { id: string; uri: string }) => entry.id && entry.uri)
          : undefined,
        relationships: Array.isArray(params.relationships)
          ? params.relationships
              .filter(
                (entry: unknown): entry is Record<string, unknown> =>
                  typeof entry === "object" && entry !== null,
              )
              .map((entry: Record<string, unknown>) => ({
                kind: readRelationshipKind(entry.kind) ?? "related",
                ticketId: typeof entry.ticketId === "string" ? entry.ticketId : "",
              }))
              .filter((entry: { ticketId: string }) => entry.ticketId)
          : undefined,
      });
      return jsonResult(created);
    },
  };

  const queryTicketsTool: AnyAgentTool = {
    name: "issue_tracking_query",
    label: "Issue Tracking Query",
    description: "Query tickets by text, labels, status, and blocked state.",
    parameters: Type.Object({
      providerId: Type.String({ description: "Issue tracker provider id." }),
      text: Type.Optional(Type.String({ description: "Optional free-text search." })),
      statuses: Type.Optional(
        Type.Array(Type.String(), { description: "Optional status filter." }),
      ),
      labels: Type.Optional(Type.Array(Type.String(), { description: "Optional labels filter." })),
      blockedOnly: Type.Optional(
        Type.Boolean({ description: "When true, return only tickets blocked by other tickets." }),
      ),
      limit: Type.Optional(Type.Number({ description: "Optional max result count." })),
    }),
    async execute(_toolCallId, params) {
      const providerId = typeof params.providerId === "string" ? params.providerId : "";
      if (!providerId) {
        throw new ToolInputError("providerId required");
      }
      const provider = registry.get(providerId);
      if (!provider) {
        throw new ToolInputError(`Unknown issue tracker provider: ${providerId}`);
      }
      const statuses = readStringArray(params.statuses)
        ?.map((status) => readStatus(status))
        .filter((status): status is TicketStatus => status !== undefined);
      const results = await provider.queryTickets({
        text: typeof params.text === "string" ? params.text : undefined,
        statuses,
        labels: readStringArray(params.labels),
        blockedOnly: typeof params.blockedOnly === "boolean" ? params.blockedOnly : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      });
      return jsonResult({ count: results.length, items: results });
    },
  };

  const queryDagTool: AnyAgentTool = {
    name: "issue_tracking_query_dag",
    label: "Issue Tracking Query DAG",
    description:
      "Build a dependency DAG from ticket relationships. Use rootTicketIds + direction + relationshipKinds to focus the graph.",
    parameters: Type.Object({
      providerId: Type.String({ description: "Issue tracker provider id." }),
      rootTicketIds: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Optional DAG roots. If omitted, traversal can start from all tickets in the provider.",
        }),
      ),
      relationshipKinds: Type.Optional(
        Type.Array(Type.String(), {
          description:
            "Optional relationship filter (blocks, blocked_by, duplicates, related). Prefer blocks/blocked_by for dependency DAGs.",
        }),
      ),
      direction: Type.Optional(
        Type.String({
          description:
            "Traversal direction: outbound (default), inbound, or both. Outbound follows source -> target links.",
        }),
      ),
      maxDepth: Type.Optional(
        Type.Number({ description: "Optional traversal depth limit (default 5)." }),
      ),
      includeOrphans: Type.Optional(
        Type.Boolean({
          description:
            "Optional flag to include tickets with no matching links in the DAG result node list.",
        }),
      ),
    }),
    async execute(_toolCallId, params) {
      const providerId = typeof params.providerId === "string" ? params.providerId : "";
      if (!providerId) {
        throw new ToolInputError("providerId required");
      }
      const provider = registry.get(providerId);
      if (!provider) {
        throw new ToolInputError(`Unknown issue tracker provider: ${providerId}`);
      }
      const dag = await provider.queryDag({
        rootTicketIds: readStringArray(params.rootTicketIds),
        relationshipKinds: readStringArray(params.relationshipKinds)
          ?.map((kind) => readRelationshipKind(kind))
          .filter((kind): kind is TicketRelationshipKind => kind !== undefined),
        direction: readDagDirection(params.direction),
        maxDepth: typeof params.maxDepth === "number" ? params.maxDepth : undefined,
        includeOrphans:
          typeof params.includeOrphans === "boolean" ? params.includeOrphans : undefined,
      });
      return jsonResult({ nodeCount: dag.nodes.length, edgeCount: dag.edges.length, ...dag });
    },
  };

  const linkTool: AnyAgentTool = {
    name: "issue_tracking_link",
    label: "Issue Tracking Link",
    description:
      "Create a relationship between two tickets. Use kind=blocks or kind=blocked_by to explicitly encode dependency DAG edges.",
    parameters: Type.Intersect([
      ProviderAndTicketSchema,
      Type.Object({
        kind: Type.String({
          description:
            "Optional relationship kind (blocks, blocked_by, duplicates, related). Defaults to related if invalid.",
        }),
        targetTicketId: Type.String({ description: "Target/dependent ticket id." }),
      }),
    ]),
    async execute(_toolCallId, params) {
      const providerId = typeof params.providerId === "string" ? params.providerId : "";
      const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";
      const targetTicketId = typeof params.targetTicketId === "string" ? params.targetTicketId : "";
      const relationshipKind = readRelationshipKind(params.kind) ?? "related";
      if (!providerId || !ticketId || !targetTicketId) {
        throw new ToolInputError("providerId, ticketId and targetTicketId are required");
      }
      const provider = registry.get(providerId);
      if (!provider) {
        throw new ToolInputError(`Unknown issue tracker provider: ${providerId}`);
      }
      const ticket = await provider.addRelationship(ticketId, {
        kind: relationshipKind,
        ticketId: targetTicketId,
      });
      return jsonResult(ticket);
    },
  };

  return [createTicketTool, queryTicketsTool, queryDagTool, linkTool];
}

export function registerIssueTrackingTools(
  api: OpenClawPluginApi,
  registry: IssueTrackerRegistry,
): void {
  for (const tool of createIssueTrackingTools(registry)) {
    api.registerTool(tool, { optional: true });
  }
}

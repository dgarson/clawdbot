import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import type { AnyAgentTool } from "../../../src/agents/tools/common.js";
import { jsonResult, ToolInputError } from "../../../src/agents/tools/common.js";
import type { IssueTrackerRegistry } from "./registry.js";
import type {
  ClassificationDimension,
  ClassificationValue,
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

const ProviderAndTicketSchema = Type.Object({
  providerId: Type.String({ description: "Issue tracker provider id" }),
  ticketId: Type.String({ description: "Ticket id" }),
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

function readClassifications(value: unknown): ClassificationValue[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value
    .filter(
      (entry: unknown): entry is Record<string, unknown> =>
        typeof entry === "object" && entry !== null,
    )
    .map((entry) => ({
      dimension:
        typeof entry.dimension === "string" &&
        CLASSIFICATION_DIMENSIONS.has(entry.dimension as ClassificationDimension)
          ? (entry.dimension as ClassificationDimension)
          : "custom",
      value: typeof entry.value === "string" ? entry.value : "",
      source:
        entry.source === "human" || entry.source === "agent" || entry.source === "system"
          ? entry.source
          : undefined,
    }));
}

export function createIssueTrackingTools(registry: IssueTrackerRegistry): AnyAgentTool[] {
  const createTicketTool: AnyAgentTool = {
    name: "issue_tracking_create",
    label: "Issue Tracking Create",
    description:
      "Create an issue in a specific issue-tracker provider with labels, classifications, and references.",
    parameters: Type.Object({
      providerId: Type.String(),
      title: Type.String(),
      body: Type.Optional(Type.String()),
      status: Type.Optional(Type.String()),
      labels: Type.Optional(Type.Array(Type.String())),
      classifications: Type.Optional(
        Type.Array(
          Type.Object({
            dimension: Type.String(),
            value: Type.String(),
            source: Type.Optional(Type.String()),
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
      });
      return jsonResult(created);
    },
  };

  const queryTicketsTool: AnyAgentTool = {
    name: "issue_tracking_query",
    label: "Issue Tracking Query",
    description: "Query issues by text, labels and status across registered trackers.",
    parameters: Type.Object({
      providerId: Type.String(),
      text: Type.Optional(Type.String()),
      statuses: Type.Optional(Type.Array(Type.String())),
      labels: Type.Optional(Type.Array(Type.String())),
      blockedOnly: Type.Optional(Type.Boolean()),
      limit: Type.Optional(Type.Number()),
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

  const linkTool: AnyAgentTool = {
    name: "issue_tracking_link",
    label: "Issue Tracking Link",
    description: "Link tickets together using blocks/related/duplicates relationships.",
    parameters: Type.Intersect([
      ProviderAndTicketSchema,
      Type.Object({
        kind: Type.String(),
        targetTicketId: Type.String(),
      }),
    ]),
    async execute(_toolCallId, params) {
      const providerId = typeof params.providerId === "string" ? params.providerId : "";
      const ticketId = typeof params.ticketId === "string" ? params.ticketId : "";
      const targetTicketId = typeof params.targetTicketId === "string" ? params.targetTicketId : "";
      const relationshipKind =
        typeof params.kind === "string" &&
        RELATIONSHIP_KINDS.has(params.kind as TicketRelationshipKind)
          ? (params.kind as TicketRelationshipKind)
          : "related";
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

  return [createTicketTool, queryTicketsTool, linkTool];
}

export function registerIssueTrackingTools(
  api: OpenClawPluginApi,
  registry: IssueTrackerRegistry,
): void {
  for (const tool of createIssueTrackingTools(registry)) {
    api.registerTool(tool, { optional: true });
  }
}

export type { IssueTrackerProvider, IssueTrackerCapabilities } from "./provider.js";
export { IssueTrackerRegistry } from "./registry.js";
export { LocalMarkdownIssueTrackerProvider } from "./local-md-provider.js";
export { GithubIssueTrackerProvider } from "./github-provider.js";
export { createIssueTrackingTools, registerIssueTrackingTools } from "./tools.js";
export type {
  AgentCapabilityProfile,
  ClassificationDimension,
  ClassificationValue,
  IssueDag,
  IssueDagDirection,
  IssueDagEdge,
  IssueDagQuery,
  IssueQuery,
  IssueTicket,
  IssueTicketCreateInput,
  IssueTicketUpdateInput,
  IssueTrackerId,
  TicketReference,
  TicketReferenceKind,
  TicketRelationship,
  TicketRelationshipKind,
  TicketStatus,
} from "./types.js";

export { resolveSharedIssueTrackingDir } from "./storage-path.js";

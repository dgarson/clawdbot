export type IssueTrackerId = string;

export type TicketReferenceKind = "artifact" | "ticket" | "external";

export type TicketRelationshipKind = "blocks" | "blocked_by" | "duplicates" | "related";

export type TicketStatus =
  | "backlog"
  | "ready"
  | "in_progress"
  | "blocked"
  | "in_review"
  | "done"
  | "canceled";

export type ClassificationDimension =
  | "complexity"
  | "business_domain"
  | "priority"
  | "risk"
  | "custom";

export type ClassificationValue = {
  dimension: ClassificationDimension;
  value: string;
  source?: "human" | "agent" | "system";
  confidence?: number;
  actorId?: string;
};

export type AgentCapabilityProfile = {
  agentId: string;
  maxComplexity?: string;
  supportedDomains?: string[];
  tags?: string[];
};

export type TicketReference = {
  id: string;
  kind: TicketReferenceKind;
  title?: string;
  uri: string;
  metadata?: Record<string, string | number | boolean>;
};

export type TicketRelationship = {
  kind: TicketRelationshipKind;
  ticketId: string;
};

export type IssueDagDirection = "outbound" | "inbound" | "both";

export type IssueDagQuery = {
  rootTicketIds?: string[];
  relationshipKinds?: TicketRelationshipKind[];
  direction?: IssueDagDirection;
  maxDepth?: number;
  includeOrphans?: boolean;
};

export type IssueDagEdge = {
  fromTicketId: string;
  toTicketId: string;
  kind: TicketRelationshipKind;
};

export type IssueDag = {
  nodes: IssueTicket[];
  edges: IssueDagEdge[];
};

export type IssueTicket = {
  id: string;
  trackerId: IssueTrackerId;
  title: string;
  body?: string;
  status: TicketStatus;
  labels: string[];
  classifications: ClassificationValue[];
  references: TicketReference[];
  relationships: TicketRelationship[];
  createdAt: string;
  updatedAt: string;
};

export type IssueTicketCreateInput = {
  title: string;
  body?: string;
  status?: TicketStatus;
  labels?: string[];
  classifications?: ClassificationValue[];
  references?: TicketReference[];
  relationships?: TicketRelationship[];
};

export type IssueTicketUpdateInput = Partial<Omit<IssueTicketCreateInput, "relationships">> & {
  status?: TicketStatus;
  appendReferences?: TicketReference[];
  appendRelationships?: TicketRelationship[];
};

export type IssueQuery = {
  text?: string;
  statuses?: TicketStatus[];
  labels?: string[];
  classifications?: Partial<ClassificationValue>[];
  blockedOnly?: boolean;
  assignedAgent?: AgentCapabilityProfile;
  limit?: number;
};

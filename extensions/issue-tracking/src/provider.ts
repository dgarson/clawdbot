import type {
  IssueQuery,
  IssueTicket,
  IssueTicketCreateInput,
  IssueTicketUpdateInput,
  TicketReference,
  TicketRelationship,
  IssueDag,
  IssueDagQuery,
} from "./types.js";

export type IssueTrackerCapabilities = {
  relationships: boolean;
  references: boolean;
  customClassifications: boolean;
};

export type IssueTrackerProvider = {
  readonly id: string;
  readonly label: string;
  readonly capabilities: IssueTrackerCapabilities;
  createTicket(input: IssueTicketCreateInput): Promise<IssueTicket>;
  getTicket(ticketId: string): Promise<IssueTicket | null>;
  updateTicket(ticketId: string, input: IssueTicketUpdateInput): Promise<IssueTicket>;
  addReference(ticketId: string, reference: TicketReference): Promise<IssueTicket>;
  addRelationship(ticketId: string, relationship: TicketRelationship): Promise<IssueTicket>;
  queryTickets(query: IssueQuery): Promise<IssueTicket[]>;
  queryDag(query: IssueDagQuery): Promise<IssueDag>;
};

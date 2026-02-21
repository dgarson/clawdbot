import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import YAML from "yaml";
import type { IssueTrackerProvider } from "./provider.js";
import type {
  IssueQuery,
  IssueTicket,
  IssueTicketCreateInput,
  IssueTicketUpdateInput,
  TicketReference,
  TicketRelationship,
} from "./types.js";

type FrontmatterTicket = Omit<IssueTicket, "trackerId">;

function normalizeTicket(trackerId: string, ticket: FrontmatterTicket): IssueTicket {
  return {
    ...ticket,
    trackerId,
    labels: ticket.labels ?? [],
    classifications: ticket.classifications ?? [],
    references: ticket.references ?? [],
    relationships: ticket.relationships ?? [],
  };
}

function serializeTicket(ticket: FrontmatterTicket): string {
  const frontmatter = YAML.stringify(ticket).trim();
  const body = ticket.body?.trim() ?? "";
  return `---\n${frontmatter}\n---\n\n${body}\n`;
}

function parseTicket(source: string): FrontmatterTicket {
  if (!source.startsWith("---\n")) {
    throw new Error("Invalid markdown ticket. Missing frontmatter.");
  }
  const end = source.indexOf("\n---\n", 4);
  if (end < 0) {
    throw new Error("Invalid markdown ticket. Unterminated frontmatter.");
  }
  const raw = source.slice(4, end);
  const parsed = YAML.parse(raw) as FrontmatterTicket;
  const body = source.slice(end + 5).trim();
  return {
    ...parsed,
    body,
    labels: parsed.labels ?? [],
    classifications: parsed.classifications ?? [],
    references: parsed.references ?? [],
    relationships: parsed.relationships ?? [],
  };
}

function mergeUpdate(ticket: IssueTicket, input: IssueTicketUpdateInput): IssueTicket {
  const now = new Date().toISOString();
  return {
    ...ticket,
    title: input.title ?? ticket.title,
    body: input.body ?? ticket.body,
    status: input.status ?? ticket.status,
    labels: input.labels ?? ticket.labels,
    classifications: input.classifications ?? ticket.classifications,
    references: [...ticket.references, ...(input.appendReferences ?? [])],
    relationships: [...ticket.relationships, ...(input.appendRelationships ?? [])],
    updatedAt: now,
  };
}

function matchesQuery(ticket: IssueTicket, query: IssueQuery): boolean {
  const text = query.text?.trim().toLowerCase();
  if (text) {
    const blob = `${ticket.title}\n${ticket.body ?? ""}`.toLowerCase();
    if (!blob.includes(text)) {
      return false;
    }
  }

  if (query.statuses && !query.statuses.includes(ticket.status)) {
    return false;
  }

  if (query.labels && query.labels.some((label) => !ticket.labels.includes(label))) {
    return false;
  }

  if (query.classifications) {
    for (const expected of query.classifications) {
      const found = ticket.classifications.some((value) => {
        if (expected.dimension && value.dimension !== expected.dimension) {
          return false;
        }
        if (expected.value && value.value !== expected.value) {
          return false;
        }
        return true;
      });
      if (!found) {
        return false;
      }
    }
  }

  if (query.blockedOnly) {
    const hasBlockedRelationship = ticket.relationships.some((rel) => rel.kind === "blocked_by");
    if (!hasBlockedRelationship) {
      return false;
    }
  }

  if (query.assignedAgent?.maxComplexity) {
    const complexity = ticket.classifications.find((cls) => cls.dimension === "complexity");
    if (complexity?.value && complexity.value > query.assignedAgent.maxComplexity) {
      return false;
    }
  }

  if (query.assignedAgent?.supportedDomains && query.assignedAgent.supportedDomains.length > 0) {
    const domain = ticket.classifications.find((cls) => cls.dimension === "business_domain");
    if (domain && !query.assignedAgent.supportedDomains.includes(domain.value)) {
      return false;
    }
  }

  return true;
}

export class LocalMarkdownIssueTrackerProvider implements IssueTrackerProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities = {
    relationships: true,
    references: true,
    customClassifications: true,
  } as const;

  readonly #baseDir: string;

  constructor(options: { id?: string; label?: string; baseDir: string }) {
    this.id = options.id ?? "local-md";
    this.label = options.label ?? "Local Markdown";
    this.#baseDir = options.baseDir;
  }

  async createTicket(input: IssueTicketCreateInput): Promise<IssueTicket> {
    await fs.mkdir(this.#baseDir, { recursive: true });
    const now = new Date().toISOString();
    const id = randomUUID();
    const ticket: IssueTicket = {
      id,
      trackerId: this.id,
      title: input.title,
      body: input.body,
      status: input.status ?? "backlog",
      labels: input.labels ?? [],
      classifications: input.classifications ?? [],
      references: input.references ?? [],
      relationships: input.relationships ?? [],
      createdAt: now,
      updatedAt: now,
    };
    await this.#writeTicket(ticket);
    return ticket;
  }

  async getTicket(ticketId: string): Promise<IssueTicket | null> {
    const file = this.#ticketFile(ticketId);
    try {
      const source = await fs.readFile(file, "utf8");
      return normalizeTicket(this.id, parseTicket(source));
    } catch {
      return null;
    }
  }

  async updateTicket(ticketId: string, input: IssueTicketUpdateInput): Promise<IssueTicket> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket not found: ${ticketId}`);
    }
    const updated = mergeUpdate(ticket, input);
    await this.#writeTicket(updated);
    return updated;
  }

  async addReference(ticketId: string, reference: TicketReference): Promise<IssueTicket> {
    return this.updateTicket(ticketId, { appendReferences: [reference] });
  }

  async addRelationship(ticketId: string, relationship: TicketRelationship): Promise<IssueTicket> {
    return this.updateTicket(ticketId, { appendRelationships: [relationship] });
  }

  async queryTickets(query: IssueQuery): Promise<IssueTicket[]> {
    await fs.mkdir(this.#baseDir, { recursive: true });
    const entries = await fs.readdir(this.#baseDir);
    const tickets: IssueTicket[] = [];
    for (const entry of entries) {
      if (!entry.endsWith(".md")) {
        continue;
      }
      const ticket = await this.getTicket(entry.slice(0, -3));
      if (ticket) {
        tickets.push(ticket);
      }
    }
    return tickets.filter((ticket) => matchesQuery(ticket, query)).slice(0, query.limit ?? 100);
  }

  #ticketFile(ticketId: string): string {
    return path.join(this.#baseDir, `${ticketId}.md`);
  }

  async #writeTicket(ticket: IssueTicket): Promise<void> {
    const serialized = serializeTicket({
      id: ticket.id,
      title: ticket.title,
      body: ticket.body,
      status: ticket.status,
      labels: ticket.labels,
      classifications: ticket.classifications,
      references: ticket.references,
      relationships: ticket.relationships,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    });
    await fs.writeFile(this.#ticketFile(ticket.id), serialized, "utf8");
  }
}

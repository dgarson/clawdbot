import { buildIssueDagFromTickets } from "./dag.js";
import type { IssueTrackerProvider } from "./provider.js";
import type {
  ClassificationValue,
  IssueDag,
  IssueDagQuery,
  IssueQuery,
  IssueTicket,
  IssueTicketCreateInput,
  IssueTicketUpdateInput,
  TicketReference,
  TicketRelationship,
  TicketStatus,
} from "./types.js";

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  state: "open" | "closed";
  labels: Array<{ name?: string } | string>;
  created_at: string;
  updated_at: string;
};

function toStatus(issue: GitHubIssue): TicketStatus {
  return issue.state === "closed" ? "done" : "in_progress";
}

function fromStatus(status: TicketStatus): "open" | "closed" {
  return status === "done" || status === "canceled" ? "closed" : "open";
}

/** Maximum per_page value accepted by the GitHub Issues API. */
const GITHUB_MAX_PER_PAGE = 100;

/** Soft cap on the number of tickets fetched when building a full DAG. */
const DAG_MAX_TICKETS = 500;

type ParsedMetadata = {
  textBody: string;
  status: TicketStatus | null;
  classifications: ClassificationValue[];
  references: TicketReference[];
  relationships: TicketRelationship[];
};

export function parseMetadata(body: string | null): ParsedMetadata {
  if (!body) {
    return { textBody: "", status: null, classifications: [], references: [], relationships: [] };
  }
  const marker = "\n<!-- openclaw-issue-meta\n";
  const markerIndex = body.indexOf(marker);
  if (markerIndex < 0) {
    return { textBody: body, status: null, classifications: [], references: [], relationships: [] };
  }
  const textBody = body.slice(0, markerIndex).trim();
  const tail = body.slice(markerIndex + marker.length);
  const end = tail.indexOf("\n-->");
  if (end < 0) {
    return { textBody, status: null, classifications: [], references: [], relationships: [] };
  }
  try {
    const metadata = JSON.parse(tail.slice(0, end)) as {
      status?: TicketStatus;
      classifications?: ClassificationValue[];
      references?: TicketReference[];
      relationships?: TicketRelationship[];
    };
    return {
      textBody,
      status: metadata.status ?? null,
      classifications: metadata.classifications ?? [],
      references: metadata.references ?? [],
      relationships: metadata.relationships ?? [],
    };
  } catch {
    return { textBody, status: null, classifications: [], references: [], relationships: [] };
  }
}

export function serializeMetadataBody(
  text: string,
  metadata: {
    status?: TicketStatus;
    classifications: ClassificationValue[];
    references: TicketReference[];
    relationships: TicketRelationship[];
  },
): string {
  const encoded = JSON.stringify(metadata, null, 2);
  return `${text}\n\n<!-- openclaw-issue-meta\n${encoded}\n-->`;
}

function deduplicateRelationships(relationships: TicketRelationship[]): TicketRelationship[] {
  const seen = new Set<string>();
  return relationships.filter((rel) => {
    const key = `${rel.kind}:${rel.ticketId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function serializeBodyForCreate(input: IssueTicketCreateInput): string {
  const text = input.body?.trim() ?? "";
  return serializeMetadataBody(text, {
    status: input.status,
    classifications: input.classifications ?? [],
    references: input.references ?? [],
    relationships: input.relationships ?? [],
  });
}

export class GithubIssueTrackerProvider implements IssueTrackerProvider {
  readonly id: string;
  readonly label: string;
  readonly capabilities = {
    relationships: true,
    references: true,
    customClassifications: true,
  } as const;

  readonly #owner: string;
  readonly #repo: string;
  readonly #token: string;
  readonly #baseUrl: string;

  constructor(options: {
    owner: string;
    repo: string;
    token: string;
    id?: string;
    label?: string;
    baseUrl?: string;
  }) {
    this.#owner = options.owner;
    this.#repo = options.repo;
    this.#token = options.token;
    this.#baseUrl = options.baseUrl ?? "https://api.github.com";
    this.id = options.id ?? "github-issues";
    this.label = options.label ?? "GitHub Issues";
  }

  async createTicket(input: IssueTicketCreateInput): Promise<IssueTicket> {
    const issue = await this.#request<GitHubIssue>(`/repos/${this.#owner}/${this.#repo}/issues`, {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        body: serializeBodyForCreate(input),
        labels: input.labels,
      }),
    });
    if (input.status && fromStatus(input.status) === "closed") {
      return this.updateTicket(String(issue.number), { status: input.status });
    }
    return this.#toTicket(issue);
  }

  async getTicket(ticketId: string): Promise<IssueTicket | null> {
    try {
      const issue = await this.#request<GitHubIssue>(
        `/repos/${this.#owner}/${this.#repo}/issues/${ticketId}`,
      );
      return this.#toTicket(issue);
    } catch {
      return null;
    }
  }

  async updateTicket(ticketId: string, input: IssueTicketUpdateInput): Promise<IssueTicket> {
    // Fetch current issue to merge metadata rather than overwriting it.
    const current = await this.#request<GitHubIssue>(
      `/repos/${this.#owner}/${this.#repo}/issues/${ticketId}`,
    );
    const existing = parseMetadata(current.body);

    const mergedStatus = input.status ?? existing.status ?? undefined;
    const mergedBody = input.body?.trim() ?? existing.textBody;
    const mergedClassifications = input.classifications ?? existing.classifications;
    const mergedReferences = [
      ...(input.references ?? existing.references),
      ...(input.appendReferences ?? []),
    ];
    const mergedRelationships = deduplicateRelationships([
      ...existing.relationships,
      ...(input.appendRelationships ?? []),
    ]);

    const issue = await this.#request<GitHubIssue>(
      `/repos/${this.#owner}/${this.#repo}/issues/${ticketId}`,
      {
        method: "PATCH",
        body: JSON.stringify({
          title: input.title,
          body: serializeMetadataBody(mergedBody, {
            status: mergedStatus,
            classifications: mergedClassifications,
            references: mergedReferences,
            relationships: mergedRelationships,
          }),
          labels: input.labels,
          state: mergedStatus ? fromStatus(mergedStatus) : undefined,
        }),
      },
    );
    return this.#toTicket(issue);
  }

  async addReference(ticketId: string, reference: TicketReference): Promise<IssueTicket> {
    return this.updateTicket(ticketId, { appendReferences: [reference] });
  }

  async addRelationship(ticketId: string, relationship: TicketRelationship): Promise<IssueTicket> {
    return this.updateTicket(ticketId, { appendRelationships: [relationship] });
  }

  async queryTickets(query: IssueQuery): Promise<IssueTicket[]> {
    const params = new URLSearchParams();
    params.set(
      "state",
      query.statuses?.some((status) => fromStatus(status) === "closed") ? "all" : "open",
    );
    if (query.labels && query.labels.length > 0) {
      params.set("labels", query.labels.join(","));
    }
    // GitHub API accepts at most 100 per page; clamp to avoid a 422 error.
    const perPage = Math.min(query.limit ?? 50, GITHUB_MAX_PER_PAGE);
    params.set("per_page", String(perPage));

    const issues = await this.#request<GitHubIssue[]>(
      `/repos/${this.#owner}/${this.#repo}/issues?${params.toString()}`,
    );
    return issues
      .map((issue) => this.#toTicket(issue))
      .filter((ticket) => {
        if (!query.text) {
          return true;
        }
        const text = `${ticket.title}\n${ticket.body ?? ""}`.toLowerCase();
        return text.includes(query.text.toLowerCase());
      })
      .slice(0, query.limit ?? 50);
  }

  async queryDag(query: IssueDagQuery): Promise<IssueDag> {
    const tickets = await this.queryTickets({ limit: DAG_MAX_TICKETS });
    return buildIssueDagFromTickets(tickets, query);
  }

  async #request<T>(pathname: string, init?: RequestInit): Promise<T> {
    const headers = new Headers(init?.headers);
    headers.set("Accept", "application/vnd.github+json");
    headers.set("Authorization", `Bearer ${this.#token}`);
    headers.set("User-Agent", "openclaw-issue-tracker");

    const res = await fetch(`${this.#baseUrl}${pathname}`, {
      ...init,
      headers,
    });
    if (!res.ok) {
      throw new Error(`GitHub API request failed (${res.status})`);
    }
    return (await res.json()) as T;
  }

  #toTicket(issue: GitHubIssue): IssueTicket {
    const metadata = parseMetadata(issue.body);
    const labels = issue.labels
      .map((label) => (typeof label === "string" ? label : (label.name ?? "")))
      .filter(Boolean);
    // Prefer the granular status stored in our metadata comment over the
    // coarse GitHub open/closed mapping (which loses backlog/ready/blocked etc.).
    const status = metadata.status ?? toStatus(issue);
    return {
      id: String(issue.number),
      trackerId: this.id,
      title: issue.title,
      body: metadata.textBody,
      status,
      labels,
      classifications: metadata.classifications,
      references: metadata.references,
      relationships: metadata.relationships,
      createdAt: issue.created_at,
      updatedAt: issue.updated_at,
    };
  }
}

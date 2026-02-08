import type { MemClawdIngestEvent } from "../contracts/events.js";
import type { MemClawdIngestResponse, MemClawdIngestRun } from "../contracts/ingest.js";
import type {
  MemClawdContextPackRequest,
  MemClawdContextPackResult,
  MemClawdQueryRequest,
  MemClawdQueryResult,
} from "../contracts/query.js";

export interface MemclawdClientOptions {
  baseUrl: string;
  apiKey?: string;
  fetcher?: typeof fetch;
}

export class MemclawdClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly fetcher: typeof fetch;

  constructor(options: MemclawdClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiKey = options.apiKey;
    this.fetcher = options.fetcher ?? fetch;
  }

  async ingest(event: MemClawdIngestEvent): Promise<MemClawdIngestResponse> {
    return this.request<MemClawdIngestResponse>("/v1/ingest", {
      event,
    });
  }

  async ingestSync(event: MemClawdIngestEvent): Promise<MemClawdIngestRun> {
    return this.request<MemClawdIngestRun>("/v1/ingest/sync", {
      event,
    });
  }

  async ingestRun(runId: string): Promise<MemClawdIngestRun> {
    return this.request<MemClawdIngestRun>(`/v1/ingest/${runId}`, undefined, "GET");
  }

  async query(request: MemClawdQueryRequest): Promise<MemClawdQueryResult> {
    return this.request<MemClawdQueryResult>("/v1/query", request);
  }

  async contextPack(request: MemClawdContextPackRequest): Promise<MemClawdContextPackResult> {
    return this.request<MemClawdContextPackResult>("/v1/context-pack", request);
  }

  private async request<T>(
    path: string,
    body?: unknown,
    method: "GET" | "POST" = "POST",
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: "application/json",
    };

    if (this.apiKey) {
      headers.Authorization = `Bearer ${this.apiKey}`;
    }

    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`Memclawd request failed: ${response.status}`);
    }

    return (await response.json()) as T;
  }
}

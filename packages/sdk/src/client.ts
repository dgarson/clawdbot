/**
 * OpenClaw SDK - Client Implementation
 */

import {
  type OpenClawClientConfig,
  type HealthResult,
  type ToolInvokeRequest,
  type ToolInvokeResponse,
  type SessionCreateRequest,
  type SessionResponse,
  type ResourceListRequest,
  type ResourceItem,
  DEFAULT_CLIENT_CONFIG,
  ok,
  err,
  OpenClawError,
  TransportError,
} from "./types.js";

/**
 * Tool client for tool operations
 */
export class ToolClient {
  constructor(private client: OpenClawClient) {}

  /**
   * List available tools
   */
  async list(): Promise<{ ok: true; data: string[] } | { ok: false; error: OpenClawError }> {
    try {
      const response = await this.client.request("GET", "/tools");
      return ok(response as string[]);
    } catch (error) {
      return err(error as OpenClawError);
    }
  }

  /**
   * Invoke a tool
   */
  async invoke<T = unknown>(request: ToolInvokeRequest): Promise<ToolInvokeResponse<T>> {
    if (!request.name) {
      return {
        ok: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Tool name is required",
          statusCode: 400,
        },
      };
    }

    try {
      const response = await this.client.request("POST", `/tools/${request.name}/invoke`, {
        input: request.input,
        timeoutMs: request.timeoutMs,
      });
      return ok(response as T);
    } catch (error) {
      if (error instanceof OpenClawError) {
        return err(error);
      }
      return err(new TransportError(error instanceof Error ? error.message : "Unknown error"));
    }
  }
}

/**
 * Session client for session management
 */
export class SessionClient {
  constructor(private client: OpenClawClient) {}

  /**
   * Create a new session
   */
  async create(
    request?: SessionCreateRequest,
  ): Promise<{ ok: true; data: SessionResponse } | { ok: false; error: OpenClawError }> {
    try {
      const response = await this.client.request("POST", "/sessions", request ?? {});
      return ok(response as SessionResponse);
    } catch (error) {
      return err(error as OpenClawError);
    }
  }

  /**
   * Get session by ID
   */
  async get(
    sessionId: string,
  ): Promise<{ ok: true; data: unknown } | { ok: false; error: OpenClawError }> {
    try {
      const response = await this.client.request("GET", `/sessions/${sessionId}`);
      return ok(response);
    } catch (error) {
      return err(error as OpenClawError);
    }
  }
}

/**
 * Resource client for resource operations
 */
export class ResourceClient {
  constructor(private client: OpenClawClient) {}

  /**
   * List resources
   */
  async list(
    request?: ResourceListRequest,
  ): Promise<{ ok: true; data: ResourceItem[] } | { ok: false; error: OpenClawError }> {
    try {
      const params = new URLSearchParams();
      if (request?.type) {
        params.set("type", request.type);
      }
      if (request?.limit) {
        params.set("limit", String(request.limit));
      }

      const query = params.toString();
      const path = query ? `/resources?${query}` : "/resources";
      const response = await this.client.request("GET", path);
      return ok(response as ResourceItem[]);
    } catch (error) {
      return err(error as OpenClawError);
    }
  }
}

/**
 * Main OpenClaw Client
 */
export class OpenClawClient {
  protected config: Required<OpenClawClientConfig>;
  public tools: ToolClient;
  public sessions: SessionClient;
  public resources: ResourceClient;

  constructor(config: OpenClawClientConfig = {}) {
    this.config = {
      ...DEFAULT_CLIENT_CONFIG,
      ...config,
    };

    this.tools = new ToolClient(this);
    this.sessions = new SessionClient(this);
    this.resources = new ResourceClient(this);
  }

  /**
   * Check gateway health
   */
  async health(): Promise<HealthResult> {
    try {
      const response = await this.request("GET", "/health");
      return response as HealthResult;
    } catch {
      return {
        ok: false,
        status: "unhealthy",
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Close the client and clean up
   */
  async close(): Promise<void> {
    // No-op for HTTP client, but can be overridden
  }

  /**
   * Make a request to the gateway
   */
  protected async request(method: string, path: string, body?: unknown): Promise<unknown> {
    const url = `${this.config.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": this.config.userAgent,
    };

    if (this.config.apiKey) {
      headers["Authorization"] = `Bearer ${this.config.apiKey}`;
    }

    this.config.logger.debug(`${method} ${url}`, body);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        await response.text().catch(() => "");
        throw new TransportError(
          `Request failed: ${response.status} ${response.statusText}`,
          response.status,
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof OpenClawError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === "AbortError") {
          throw new TransportError("Request timed out");
        }
        throw new TransportError(error.message);
      }

      throw new TransportError("Unknown error");
    }
  }
}

/**
 * Create an OpenClaw client instance
 */
export function createClient(config?: OpenClawClientConfig): OpenClawClient {
  return new OpenClawClient(config);
}

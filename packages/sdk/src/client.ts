import {
  AuthError,
  OpenClawError,
  SandboxUnavailableError,
  ToolRuntimeError,
  TransportError,
  ValidationError,
  parseErrorPayload,
} from "./errors.js";
import { FetchOpenClawTransport } from "./transport/index.js";
import {
  DEFAULT_TIMEOUT_MS,
  DFLT_BASE_URL,
  type EnvValidatedClientConfig,
  type HealthResult,
  type OpenClawClient,
  type OpenClawClientConfig,
  type OpenClawTransport,
  type OpenClawHttpRequest,
  type OpenClawLogger,
  type Result,
  type RetryOptions,
  type RuntimeExecRequest,
  type RuntimeExecResponse,
  type RuntimeStatus,
  type SessionClient,
  type SessionCreateRequest,
  type SessionRecord,
  type SandboxController,
  type ToolClient,
  type ToolInvocationRequest,
  type ToolInvocationResult,
  type ToolListRequest,
  type ToolListResult,
  type ToolStreamEvent,
  type ResourceClient,
  type ResourceRecord,
  type LocalSandboxRuntime,
} from "./types.js";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    statusCode?: number;
    requestId?: string;
    spanId?: string;
  };
};

const NOOP_LOGGER: OpenClawLogger = {
  debug: () => {
    return;
  },
  info: () => {
    return;
  },
  warn: () => {
    return;
  },
  error: () => {
    return;
  },
};

const validateConfig = (config: OpenClawClientConfig = {}): EnvValidatedClientConfig => {
  const baseUrl = config.baseUrl?.trim() || DFLT_BASE_URL;
  if (!/^https?:\/\//i.test(baseUrl)) {
    throw new ValidationError(`Invalid baseUrl: ${baseUrl}`);
  }

  const timeoutMs =
    typeof config.timeoutMs === "number" &&
    Number.isFinite(config.timeoutMs) &&
    config.timeoutMs > 0
      ? config.timeoutMs
      : DEFAULT_TIMEOUT_MS;

  return {
    baseUrl,
    apiKey: config.apiKey,
    timeoutMs,
    userAgent: config.userAgent ?? `@openclaw/sdk/1`,
  };
};

const errorFromEnvelope = (
  status: number,
  rawError: {
    code: string;
    message: string;
    statusCode?: number;
    requestId?: string;
    spanId?: string;
  },
): OpenClawError => {
  const payload = parseErrorPayload(rawError);
  const metadata = {
    statusCode: payload.statusCode ?? status,
    requestId: payload.requestId,
    spanId: payload.spanId,
  };

  if (status === 401 || status === 403) {
    return new AuthError(payload.message, metadata);
  }

  if (status >= 500) {
    return new TransportError(payload.message, metadata);
  }

  return new ToolRuntimeError(payload.message, metadata);
};

class ToolClientImpl implements ToolClient {
  public constructor(
    private readonly request: <TBody, TResponse>(
      request: OpenClawHttpRequest<TBody>,
    ) => Promise<Result<TResponse>>,
  ) {}

  public async list(request?: ToolListRequest): Promise<Result<ToolListResult>> {
    return this.request<ToolListRequest | undefined, ToolListResult>({
      method: "GET",
      path: "/v1/tools",
      query: request?.cursor ? { cursor: request.cursor } : undefined,
      headers: request?.limit ? { "x-openclaw-limit": `${request.limit}` } : undefined,
    });
  }

  public async invoke<TInput = unknown, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>,
  ): Promise<Result<ToolInvocationResult<TOutput>>> {
    return this.request<ToolInvocationRequest<TInput>, ToolInvocationResult<TOutput>>({
      method: "POST",
      path: "/v1/tools/invoke",
      body: request,
    });
  }

  public async stream<TInput = unknown, TOutput = unknown>(
    request: ToolInvocationRequest<TInput>,
  ): Promise<Result<AsyncIterable<ToolStreamEvent<TOutput>>>> {
    const result = await this.request<ToolInvocationRequest<TInput>, ToolInvocationResult<TOutput>>(
      {
        method: "POST",
        path: "/v1/tools/invoke",
        body: request,
      },
    );

    if (!result.ok) {
      return { ok: false, error: result.error };
    }

    const events: AsyncGenerator<ToolStreamEvent<TOutput>> = (async function* () {
      yield { kind: "result", payload: result.data };
    })();

    return { ok: true, data: events };
  }
}

class SessionClientImpl implements SessionClient {
  public constructor(
    private readonly request: <TBody, TResponse>(
      request: OpenClawHttpRequest<TBody>,
    ) => Promise<Result<TResponse>>,
  ) {}

  public async list(): Promise<Result<SessionRecord[]>> {
    return this.request<undefined, SessionRecord[]>({
      method: "GET",
      path: "/v1/sessions",
    });
  }

  public async create(request: SessionCreateRequest): Promise<Result<SessionRecord>> {
    return this.request<SessionCreateRequest, SessionRecord>({
      method: "POST",
      path: "/v1/sessions",
      body: request,
    });
  }
}

class ResourceClientImpl implements ResourceClient {
  public constructor(
    private readonly request: <TBody, TResponse>(
      request: OpenClawHttpRequest<TBody>,
    ) => Promise<Result<TResponse>>,
  ) {}

  public async list(): Promise<Result<ResourceRecord[]>> {
    return this.request<undefined, ResourceRecord[]>({
      method: "GET",
      path: "/v1/resources",
    });
  }

  public async get(id: string): Promise<Result<ResourceRecord>> {
    if (!id || id.trim().length === 0) {
      return { ok: false, error: new ValidationError("Resource id is required") };
    }

    return this.request<undefined, ResourceRecord>({
      method: "GET",
      path: `/v1/resources/${encodeURIComponent(id)}`,
    });
  }
}

class SandboxControllerImpl implements SandboxController {
  public constructor(
    private readonly runtime: LocalSandboxRuntime | undefined,
    private readonly logger: OpenClawLogger,
  ) {}

  public async start(): Promise<Result<void>> {
    if (!this.runtime) {
      return { ok: false, error: new SandboxUnavailableError() };
    }

    try {
      await this.runtime.start();
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof OpenClawError) {
        return { ok: false, error };
      }

      this.logger.error("Sandbox start failed", error);
      return {
        ok: false,
        error: new ToolRuntimeError("Unable to start sandbox runtime", {
          statusCode: 500,
        }),
      };
    }
  }

  public async stop(): Promise<Result<void>> {
    if (!this.runtime) {
      return { ok: false, error: new SandboxUnavailableError() };
    }

    try {
      await this.runtime.stop();
      return { ok: true, data: undefined };
    } catch (error) {
      if (error instanceof OpenClawError) {
        return { ok: false, error };
      }

      this.logger.error("Sandbox stop failed", error);
      return {
        ok: false,
        error: new ToolRuntimeError("Unable to stop sandbox runtime", {
          statusCode: 500,
        }),
      };
    }
  }

  public async status(): Promise<Result<RuntimeStatus>> {
    if (!this.runtime) {
      return {
        ok: false,
        error: new SandboxUnavailableError("Sandbox runtime unavailable for status call"),
      };
    }

    try {
      const status = await this.runtime.status();
      return { ok: true, data: status };
    } catch (error) {
      if (error instanceof OpenClawError) {
        return { ok: false, error };
      }

      this.logger.error("Sandbox status failed", error);
      return {
        ok: false,
        error: new ToolRuntimeError("Unable to read sandbox status", {
          statusCode: 500,
        }),
      };
    }
  }

  public async exec<TInput = unknown, TOutput = unknown>(
    request: RuntimeExecRequest<TInput>,
  ): Promise<Result<RuntimeExecResponse<TOutput>>> {
    if (!this.runtime) {
      return { ok: false, error: new SandboxUnavailableError() };
    }

    try {
      const output = await this.runtime.exec<TInput, TOutput>(request);
      return { ok: true, data: output };
    } catch (error) {
      if (error instanceof OpenClawError) {
        return { ok: false, error };
      }

      this.logger.error("Sandbox exec failed", error);
      return {
        ok: false,
        error: new ToolRuntimeError("Unable to execute in sandbox", {
          statusCode: 500,
        }),
      };
    }
  }
}

class OpenClawClientImpl implements OpenClawClient {
  public readonly tools: ToolClient;
  public readonly sessions: SessionClient;
  public readonly resources: ResourceClient;
  public readonly sandbox: SandboxController;

  public constructor(
    private readonly config: EnvValidatedClientConfig,
    private readonly transport: OpenClawTransport,
    private readonly logger: OpenClawLogger,
    sandboxRuntime?: LocalSandboxRuntime,
  ) {
    const request = this.request.bind(this);
    this.tools = new ToolClientImpl(request);
    this.sessions = new SessionClientImpl(request);
    this.resources = new ResourceClientImpl(request);
    this.sandbox = new SandboxControllerImpl(sandboxRuntime, this.logger);
  }

  public async health(): Promise<Result<HealthResult>> {
    return this.request({
      method: "GET",
      path: "/v1/health",
    });
  }

  public async close(): Promise<void> {
    return;
  }

  public async withRetries<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const attempts = options.attempts ?? 3;
    const baseDelayMs = options.baseDelayMs ?? 100;
    const maxDelayMs = options.maxDelayMs ?? 1500;

    let lastError: unknown;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (i >= attempts - 1) {
          break;
        }

        const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** i);
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay);
        });
      }
    }

    throw lastError;
  }

  private async request<TBody, TResponse>(
    request: OpenClawHttpRequest<TBody>,
  ): Promise<Result<TResponse>> {
    try {
      const response = await this.transport.request<TBody, Envelope<TResponse>>(request);
      const body = response.body;
      if (!body || typeof body !== "object") {
        return {
          ok: false,
          error: new ValidationError("Transport returned an invalid envelope"),
        };
      }

      if (!body.ok) {
        return {
          ok: false,
          error: errorFromEnvelope(
            response.status,
            body.error ?? { code: "OPEN_CLAW_ERROR", message: "Unknown" },
          ),
        };
      }

      if (body.data === undefined) {
        return {
          ok: false,
          error: new ValidationError("Transport returned missing data payload"),
        };
      }

      return { ok: true, data: body.data };
    } catch (error) {
      if (error instanceof OpenClawError) {
        return { ok: false, error };
      }

      this.logger.error("Request failed", error);
      return {
        ok: false,
        error:
          error instanceof TransportError
            ? error
            : new TransportError("Unable to complete request", {
                statusCode: 500,
              }),
      };
    }
  }
}

export const createClient = (config: OpenClawClientConfig = {}): OpenClawClient => {
  const validated = validateConfig(config);
  const logger = config.logger ?? NOOP_LOGGER;
  const transportHeaders: Record<string, string> = {
    "content-type": "application/json",
    "user-agent": validated.userAgent,
  };

  if (validated.apiKey) {
    transportHeaders.authorization = `Bearer ${validated.apiKey}`;
  }

  const transport =
    config.transport ??
    new FetchOpenClawTransport(validated.baseUrl, transportHeaders, validated.timeoutMs);

  return new OpenClawClientImpl(validated, transport, logger, config.sandbox?.runtime);
};

export {
  OpenClawClientImpl,
  ToolClientImpl,
  SessionClientImpl,
  ResourceClientImpl,
  SandboxControllerImpl,
};

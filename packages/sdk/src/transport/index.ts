import { TransportError } from "../errors.js";
import {
  DEFAULT_TIMEOUT_MS,
  OpenClawHttpRequest,
  OpenClawHttpResponse,
  OpenClawTransport,
} from "../types.js";

export const buildAbsoluteUrl = (
  baseUrl: string,
  path: string,
  query?: Record<string, string>,
): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  const url = new URL(normalizedPath, baseUrl);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value.length > 0) {
        url.searchParams.set(key, value);
      }
    });
  }

  return url.toString();
};

export class FetchOpenClawTransport implements OpenClawTransport {
  public readonly baseUrl: string;
  public readonly headers: Record<string, string>;
  public readonly timeoutMs: number;

  public constructor(
    baseUrl: string,
    headers: Record<string, string>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ) {
    this.baseUrl = baseUrl;
    this.headers = { ...headers };
    this.timeoutMs = timeoutMs;
  }

  public async request<TBody = unknown, TResponse = unknown>(
    request: OpenClawHttpRequest<TBody>,
  ): Promise<OpenClawHttpResponse<TResponse>> {
    const url = buildAbsoluteUrl(this.baseUrl, request.path, request.query);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);

    try {
      const response = await fetch(url, {
        method: request.method,
        headers: {
          ...this.headers,
          ...request.headers,
        },
        body: request.body === undefined ? undefined : JSON.stringify(request.body),
        signal: controller.signal,
      });

      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      let body: TResponse | undefined;
      const rawBody = await response.text();
      if (rawBody.length > 0) {
        try {
          body = JSON.parse(rawBody) as TResponse;
        } catch {
          throw new TransportError("Invalid JSON response from OpenClaw gateway", {
            statusCode: response.status,
          });
        }
      }

      return {
        status: response.status,
        headers,
        body,
      };
    } catch (error) {
      if (error instanceof TransportError) {
        throw error;
      }

      if (
        error instanceof Error &&
        (error.name === "AbortError" || error.name === "TimeoutError")
      ) {
        throw new TransportError("Request timed out contacting OpenClaw gateway", {
          statusCode: 504,
        });
      }

      if (error instanceof Error) {
        throw new TransportError(`Request failed: ${error.message}`);
      }

      throw new TransportError("Unknown request failure");
    } finally {
      clearTimeout(timer);
    }
  }
}

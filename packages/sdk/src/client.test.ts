import { describe, expect, it } from "vitest";
import { createClient, ValidationError, type OpenClawTransport, DFLT_BASE_URL } from "./index.js";
import type {
  OpenClawHttpRequest,
  OpenClawHttpResponse,
  ToolInvocationRequest,
  ToolInvocationResult,
} from "./types.js";

const createEnvelope = <T>(ok: boolean, data?: T, message?: string): Record<string, unknown> => {
  if (ok) {
    return {
      ok: true,
      data,
    };
  }

  return {
    ok: false,
    error: {
      code: "OPEN_CLAW_ERROR",
      message: message ?? "boom",
    },
  };
};

class RecordingTransport implements OpenClawTransport {
  public calls: Array<OpenClawHttpRequest> = [];

  public responses: Array<Record<string, unknown>> = [];

  public async request<TBody, TResponse>(
    request: OpenClawHttpRequest<TBody>,
  ): Promise<OpenClawHttpResponse<TResponse>> {
    this.calls.push(request as OpenClawHttpRequest);
    const nextResponse = this.responses.shift();

    if (!nextResponse) {
      throw new Error("No mock response configured");
    }

    return {
      status: 200,
      headers: { "content-type": "application/json" },
      body: nextResponse as TResponse,
    };
  }
}

describe("OpenClaw SDK client", () => {
  it("initializes with defaults and uses 127.0.0.1 in base URL", () => {
    const client = createClient();
    expect(client).toBeDefined();
    expect(client.tools).toBeDefined();
  });

  it("throws validation error when baseUrl is missing scheme", () => {
    expect(() => {
      createClient({
        baseUrl: "127.0.0.1:3939",
      });
    }).toThrow(ValidationError);
  });

  it("maps tool invoke into the configured request envelope", async () => {
    const transport = new RecordingTransport();
    const req: ToolInvocationRequest<{ value: string }> = {
      name: "echo",
      input: { value: "hello" },
    };
    const mockPayload: {
      ok: true;
      data: ToolInvocationResult<{ output: string }>;
    } = {
      ok: true,
      data: {
        requestId: "req-1",
        name: "echo",
        output: { output: "hello" },
      },
    };

    transport.responses.push(createEnvelope(mockPayload.ok, mockPayload.data));

    const client = createClient({
      baseUrl: DFLT_BASE_URL,
      transport,
    });

    const result = await client.tools.invoke<{ value: string }, { output: string }>(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.requestId).toBe("req-1");
      expect(result.data.output.output).toBe("hello");
    }
    expect(transport.calls).toHaveLength(1);
    expect(transport.calls[0]?.path).toBe("/v1/tools/invoke");
    expect(transport.calls[0]?.method).toBe("POST");
    expect(transport.calls[0]?.body).toEqual(req);
  });

  it("supports typed stream helpers", async () => {
    const transport = new RecordingTransport();
    const req: ToolInvocationRequest<{ value: string }> = {
      name: "echo",
      input: { value: "stream" },
    };
    transport.responses.push(
      createEnvelope(true, {
        requestId: "req-2",
        name: "echo",
        output: { output: "stream" },
      }),
    );

    const client = createClient({
      baseUrl: DFLT_BASE_URL,
      transport,
    });

    const result = await client.tools.stream<{ value: string }, { output: string }>(req);

    expect(result.ok).toBe(true);
    if (result.ok) {
      const items: string[] = [];
      for await (const event of result.data) {
        items.push(event.kind);
      }
      expect(items).toEqual(["result"]);
    }
  });

  it("surfaces tool invoke transport failures as typed errors", async () => {
    const transport = new RecordingTransport();
    transport.responses.push(
      createEnvelope(false, undefined, "tool runtime failed") as {
        ok: false;
        error: { code: string; message: string };
      },
    );

    const client = createClient({
      baseUrl: DFLT_BASE_URL,
      transport,
    });

    const result = await client.tools.invoke({
      name: "oops",
    });

    expect(result.ok).toBe(false);
  });
});

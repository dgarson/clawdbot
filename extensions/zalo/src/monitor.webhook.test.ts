import type { IncomingMessage, ServerResponse } from "node:http";
import type { OpenClawConfig, PluginRuntime } from "openclaw/plugin-sdk";
import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import type { ResolvedZaloAccount } from "./types.js";
import { handleZaloWebhookRequest, registerZaloWebhookTarget } from "./monitor.js";

function createMockRequest(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string> = {},
): IncomingMessage {
  const req = new EventEmitter() as IncomingMessage;
  req.method = method;
  req.url = url;
  req.headers = headers;
  (req as unknown as { socket: { remoteAddress: string } }).socket = { remoteAddress: "127.0.0.1" };

  // oxlint-disable-next-line no-floating-promises
  Promise.resolve().then(() => {
    const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
    req.emit("data", Buffer.from(bodyStr));
    req.emit("end");
  });

  return req;
}

function createMockResponse(): ServerResponse & { body: string; statusCode: number } {
  const res = {
    statusCode: 200,
    body: "",
    setHeader: () => undefined,
    end: (data?: string) => {
      res.body = data ?? "";
    },
  } as unknown as ServerResponse & { body: string; statusCode: number };
  return res;
}

describe("handleZaloWebhookRequest", () => {
  it("returns 400 for non-object payloads", async () => {
    const core = {} as PluginRuntime;
    const account: ResolvedZaloAccount = {
      accountId: "default",
      enabled: true,
      token: "tok",
      tokenSource: "config",
      config: {},
    };
    const unregister = registerZaloWebhookTarget({
      token: "tok",
      account,
      config: {} as OpenClawConfig,
      runtime: {},
      core,
      secret: "secret",
      path: "/hook",
      mediaMaxMb: 5,
    });

    try {
      const req = createMockRequest("POST", "/hook", "null", {
        "x-bot-api-secret-token": "secret",
      });
      const res = createMockResponse();

      const handled = await handleZaloWebhookRequest(req, res);

      expect(handled).toBe(true);
      expect(res.statusCode).toBe(400);
    } finally {
      unregister();
    }
  });
});

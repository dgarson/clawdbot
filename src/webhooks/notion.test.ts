import type { IncomingMessage, ServerResponse } from "node:http";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import {
  categoriseNotionEvent,
  createNotionEventRouter,
  createNotionWebhookHandler,
  NOTION_WEBHOOK_PATH,
  registerNotionWebhookRoute,
  validateNotionSignature,
} from "./notion.js";

// ────────────────────── Test Helpers ──────────────────────

class MockReq extends EventEmitter {
  method?: string;
  headers: Record<string, string> = {};
  constructor(method: string, headers: Record<string, string>, body: string | Buffer) {
    super();
    this.method = method;
    this.headers = headers;
    queueMicrotask(() => {
      this.emit("data", body);
      this.emit("end");
    });
  }
}

class MockRes {
  statusCode = 200;
  headers: Record<string, string> = {};
  body = "";
  ended = false;
  headersSent = false;
  setHeader(key: string, value: string) {
    this.headers[key.toLowerCase()] = value;
    this.headersSent = true;
  }
  end(text?: string) {
    this.body = text ?? "";
    this.ended = true;
  }
}

function sign(rawBody: string, secret: string): string {
  const computed = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return `sha256=${computed}`;
}

function makeReq(method: string, headers: Record<string, string>, body: string) {
  return new MockReq(method, headers, body) as unknown as IncomingMessage;
}

function makeRes() {
  return new MockRes() as unknown as ServerResponse;
}

function rawRes(res: ServerResponse): MockRes {
  return res as unknown as MockRes;
}

// ────────────────────── Signature Validation ──────────────────────

describe("validateNotionSignature", () => {
  it("validates correct signatures", () => {
    const raw = JSON.stringify({ type: "page.created" });
    expect(validateNotionSignature(raw, sign(raw, "s"), "s")).toBe(true);
  });

  it("rejects incorrect signatures", () => {
    const raw = JSON.stringify({ type: "page.created" });
    expect(validateNotionSignature(raw, sign(raw, "wrong"), "s")).toBe(false);
  });

  it("rejects signatures without sha256= prefix", () => {
    expect(validateNotionSignature("body", "deadbeef", "s")).toBe(false);
  });

  it("rejects non-hex content after prefix", () => {
    expect(validateNotionSignature("body", "sha256=ZZZZ", "s")).toBe(false);
  });
});

// ────────────────────── Webhook Handler ──────────────────────

describe("createNotionWebhookHandler", () => {
  it("rejects non-POST methods", async () => {
    const handler = createNotionWebhookHandler({});
    const res = makeRes();
    await handler(makeReq("GET", {}, ""), res);
    expect(rawRes(res).statusCode).toBe(405);
  });

  it("rejects invalid JSON", async () => {
    const handler = createNotionWebhookHandler({});
    const res = makeRes();
    await handler(makeReq("POST", {}, "not json"), res);
    expect(rawRes(res).statusCode).toBe(400);
    expect(rawRes(res).body).toContain("Invalid JSON");
  });

  it("responds to verification_token payload", async () => {
    const raw = JSON.stringify({ verification_token: "abc123" });
    const handler = createNotionWebhookHandler({});
    const res = makeRes();
    await handler(makeReq("POST", {}, raw), res);
    expect(rawRes(res).statusCode).toBe(200);
    expect(rawRes(res).body).toContain('"verification_token":"abc123"');
  });

  it("requires X-Notion-Signature when secret is set", async () => {
    const raw = JSON.stringify({ type: "page.created" });
    const handler = createNotionWebhookHandler({ secret: "s" });
    const res = makeRes();
    await handler(makeReq("POST", {}, raw), res);
    expect(rawRes(res).statusCode).toBe(400);
    expect(rawRes(res).body).toContain("Missing X-Notion-Signature");
  });

  it("rejects invalid signature", async () => {
    const raw = JSON.stringify({ type: "page.created" });
    const handler = createNotionWebhookHandler({ secret: "s" });
    const res = makeRes();
    await handler(makeReq("POST", { "x-notion-signature": sign(raw, "wrong") }, raw), res);
    expect(rawRes(res).statusCode).toBe(401);
  });

  it("acks and calls onEvent for valid signed events", async () => {
    const raw = JSON.stringify({
      type: "page.created",
      entity: { id: "page-1", type: "page" },
      authors: [{ id: "u1", type: "person" }],
      timestamp: "2026-02-08T00:00:00Z",
    });
    const onEvent = vi.fn(async () => {});
    const handler = createNotionWebhookHandler({ secret: "s", onEvent });
    const res = makeRes();
    await handler(makeReq("POST", { "x-notion-signature": sign(raw, "s") }, raw), res);
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(rawRes(res).statusCode).toBe(200);

    // Verify the event is fully parsed
    const event = onEvent.mock.calls[0]![0]!;
    expect(event.type).toBe("page.created");
    expect(event.entity?.id).toBe("page-1");
    expect(event.entity?.type).toBe("page");
    expect(event.authors).toHaveLength(1);
    expect(event.timestamp).toBe("2026-02-08T00:00:00Z");
  });

  it("ignores self-authored events (loop prevention)", async () => {
    const raw = JSON.stringify({
      type: "page.created",
      authors: [{ id: "bot-user-123", type: "bot" }],
    });
    const onEvent = vi.fn(async () => {});
    const handler = createNotionWebhookHandler({ secret: "s", botId: "bot-user-123", onEvent });
    const res = makeRes();
    await handler(makeReq("POST", { "x-notion-signature": sign(raw, "s") }, raw), res);
    expect(onEvent).not.toHaveBeenCalled();
    expect(rawRes(res).statusCode).toBe(200); // Still acks
  });

  it("allows events without secret when secret is not configured", async () => {
    const raw = JSON.stringify({ type: "page.created" });
    const onEvent = vi.fn(async () => {});
    const handler = createNotionWebhookHandler({ onEvent });
    const res = makeRes();
    await handler(makeReq("POST", {}, raw), res);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it("parses all event fields", async () => {
    const raw = JSON.stringify({
      id: "evt-1",
      type: "page.properties_updated",
      timestamp: "2026-02-08T12:00:00Z",
      workspace_id: "ws-1",
      subscription_id: "sub-1",
      integration_id: "int-1",
      entity: { id: "page-42", type: "page" },
      authors: [{ id: "u1", type: "person" }],
      data: { property_keys: ["Name"] },
      attempt_number: 1,
    });
    const onEvent = vi.fn(async () => {});
    const handler = createNotionWebhookHandler({ onEvent });
    const res = makeRes();
    await handler(makeReq("POST", {}, raw), res);

    const event = onEvent.mock.calls[0]![0]!;
    expect(event.id).toBe("evt-1");
    expect(event.workspaceId).toBe("ws-1");
    expect(event.subscriptionId).toBe("sub-1");
    expect(event.integrationId).toBe("int-1");
    expect(event.data).toEqual({ property_keys: ["Name"] });
    expect(event.attemptNumber).toBe(1);
  });
});

// ────────────────────── Event Categorisation ──────────────────────

describe("categoriseNotionEvent", () => {
  it("categorises content events as memory", () => {
    expect(categoriseNotionEvent("page.created")).toBe("memory");
    expect(categoriseNotionEvent("page.content_updated")).toBe("memory");
    expect(categoriseNotionEvent("page.properties_updated")).toBe("memory");
    expect(categoriseNotionEvent("database.content_updated")).toBe("memory");
    expect(categoriseNotionEvent("data_source.content_updated")).toBe("memory");
    expect(categoriseNotionEvent("comment.created")).toBe("memory");
    expect(categoriseNotionEvent("comment.updated")).toBe("memory");
  });

  it("categorises structural events as wake", () => {
    expect(categoriseNotionEvent("page.moved")).toBe("wake");
    expect(categoriseNotionEvent("page.deleted")).toBe("wake");
    expect(categoriseNotionEvent("page.undeleted")).toBe("wake");
    expect(categoriseNotionEvent("database.created")).toBe("wake");
    expect(categoriseNotionEvent("database.deleted")).toBe("wake");
    expect(categoriseNotionEvent("database.schema_updated")).toBe("wake");
    expect(categoriseNotionEvent("data_source.created")).toBe("wake");
    expect(categoriseNotionEvent("data_source.schema_updated")).toBe("wake");
  });

  it("categorises admin events as system", () => {
    expect(categoriseNotionEvent("page.locked")).toBe("system");
    expect(categoriseNotionEvent("page.unlocked")).toBe("system");
    expect(categoriseNotionEvent("comment.deleted")).toBe("system");
  });

  it("returns ignore for undefined", () => {
    expect(categoriseNotionEvent(undefined)).toBe("ignore");
  });
});

// ────────────────────── Event Router ──────────────────────

describe("createNotionEventRouter", () => {
  it("routes memory events to ingestMemory", async () => {
    const ingestMemory = vi.fn(async () => {});
    const router = createNotionEventRouter({ ingestMemory });
    await router({
      rawBody: "",
      body: {},
      type: "page.content_updated",
      entity: { id: "page-1", type: "page" },
    });
    expect(ingestMemory).toHaveBeenCalledTimes(1);
    expect(ingestMemory.mock.calls[0]![0]!.source).toBe("notion-webhook");
    expect(ingestMemory.mock.calls[0]![0]!.metadata?.notionEventType).toBe("page.content_updated");
  });

  it("routes wake events to wakeSession", async () => {
    const wakeSession = vi.fn();
    const logSystem = vi.fn();
    const router = createNotionEventRouter({ wakeSession, logSystem });
    await router({
      rawBody: "",
      body: {},
      type: "database.created",
      entity: { id: "db-1", type: "database" },
    });
    expect(wakeSession).toHaveBeenCalledTimes(1);
    expect(wakeSession.mock.calls[0]![0]!.mode).toBe("next-heartbeat");
    expect(logSystem).toHaveBeenCalledTimes(1);
  });

  it("routes system events to logSystem", async () => {
    const logSystem = vi.fn();
    const router = createNotionEventRouter({ logSystem });
    await router({
      rawBody: "",
      body: {},
      type: "page.locked",
      entity: { id: "page-1", type: "page" },
    });
    expect(logSystem).toHaveBeenCalledTimes(1);
  });

  it("fetches page content for memory events when fetchPageContent is provided", async () => {
    const ingestMemory = vi.fn(async () => {});
    const fetchPageContent = vi.fn(async () => "# Page Title\nSome content");
    const router = createNotionEventRouter({ ingestMemory, fetchPageContent });
    await router({
      rawBody: "",
      body: {},
      type: "page.content_updated",
      entity: { id: "page-1", type: "page" },
    });
    expect(fetchPageContent).toHaveBeenCalledWith("page-1");
    expect(ingestMemory.mock.calls[0]![0]!.text).toContain("# Page Title");
  });
});

// ────────────────────── Route Registration ──────────────────────

describe("registerNotionWebhookRoute", () => {
  it("registers at default path", () => {
    const registerHttpRoute = vi.fn(() => () => {});
    registerNotionWebhookRoute({ registerHttpRoute });
    expect(registerHttpRoute).toHaveBeenCalledTimes(1);
    expect(registerHttpRoute.mock.calls[0]![0]!.path).toBe(NOTION_WEBHOOK_PATH);
    expect(registerHttpRoute.mock.calls[0]![0]!.pluginId).toBe("notion-webhook");
  });

  it("supports custom path", () => {
    const registerHttpRoute = vi.fn(() => () => {});
    registerNotionWebhookRoute({ registerHttpRoute, path: "/custom/notion" });
    expect(registerHttpRoute.mock.calls[0]![0]!.path).toBe("/custom/notion");
  });

  it("returns unregister function", () => {
    const unregister = vi.fn();
    const registerHttpRoute = vi.fn(() => unregister);
    const result = registerNotionWebhookRoute({ registerHttpRoute });
    result();
    expect(unregister).toHaveBeenCalledTimes(1);
  });
});

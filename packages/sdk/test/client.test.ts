/**
 * SDK Client Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createClient, ok, err } from "../src/index.js";

describe("SDK Types", () => {
  describe("ok()", () => {
    it("should create a success result", () => {
      const result = ok({ foo: "bar" });
      expect(result.ok).toBe(true);
      expect(result.data).toEqual({ foo: "bar" });
    });
  });

  describe("err()", () => {
    it("should create an error result", () => {
      const result = err({ code: "ERROR", message: "Failed" });
      expect(result.ok).toBe(false);
      expect(result.error).toEqual({ code: "ERROR", message: "Failed" });
    });
  });
});

describe("OpenClawClient", () => {
  let client: ReturnType<typeof createClient>;

  beforeEach(() => {
    client = createClient({
      baseUrl: "http://127.0.0.1:3939",
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    void client.close();
  });

  describe("constructor", () => {
    it("should create client with default config", () => {
      const defaultClient = createClient();
      expect(defaultClient).toBeDefined();
      expect(defaultClient.tools).toBeDefined();
      expect(defaultClient.sessions).toBeDefined();
      expect(defaultClient.resources).toBeDefined();
    });

    it("should create client with custom config", () => {
      const customClient = createClient({
        baseUrl: "http://127.0.0.1:8080",
        apiKey: "test-key",
        timeoutMs: 10000,
      });
      expect(customClient).toBeDefined();
    });
  });

  describe("health()", () => {
    it("should return unhealthy when gateway is unreachable", async () => {
      // Using a non-existent port to simulate unreachable gateway
      const unreachableClient = createClient({
        baseUrl: "http://127.0.0.1:59999",
        timeoutMs: 500,
      });

      const result = await unreachableClient.health();

      expect(result.ok).toBe(false);
      expect(result.status).toBe("unhealthy");
      expect(result.timestamp).toBeDefined();
    });
  });

  describe("sub-clients", () => {
    it("should have tools client", () => {
      expect(client.tools).toBeDefined();
      expect(typeof client.tools.list).toBe("function");
      expect(typeof client.tools.invoke).toBe("function");
    });

    it("should have sessions client", () => {
      expect(client.sessions).toBeDefined();
      expect(typeof client.sessions.create).toBe("function");
      expect(typeof client.sessions.get).toBe("function");
    });

    it("should have resources client", () => {
      expect(client.resources).toBeDefined();
      expect(typeof client.resources.list).toBe("function");
    });
  });
});

describe("ToolClient", () => {
  describe("invoke()", () => {
    it("should return validation error for missing tool name", async () => {
      const client = createClient();
      const result = await client.tools.invoke(
        {} as unknown as Parameters<typeof client.tools.invoke>[0],
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_ERROR");
        expect(result.error.message).toBe("Tool name is required");
      }
    });

    it("should return error for unreachable gateway", async () => {
      const unreachableClient = createClient({
        baseUrl: "http://127.0.0.1:59999",
        timeoutMs: 500,
      });

      const result = await unreachableClient.tools.invoke({
        name: "test-tool",
        input: {},
      });

      expect(result.ok).toBe(false);
    });
  });
});

describe("SessionClient", () => {
  it("should return error for unreachable gateway", async () => {
    const unreachableClient = createClient({
      baseUrl: "http://127.0.0.1:59999",
      timeoutMs: 500,
    });

    const result = await unreachableClient.sessions.create();

    expect(result.ok).toBe(false);
  });
});

describe("ResourceClient", () => {
  it("should return error for unreachable gateway", async () => {
    const unreachableClient = createClient({
      baseUrl: "http://127.0.0.1:59999",
      timeoutMs: 500,
    });

    const result = await unreachableClient.resources.list();

    expect(result.ok).toBe(false);
  });
});

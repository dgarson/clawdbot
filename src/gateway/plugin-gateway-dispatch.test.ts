import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPluginGatewayDispatcher } from "./plugin-gateway-dispatch.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./server-methods/types.js";

function createMockContext() {
  return {
    logGateway: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(),
    },
  } as unknown as GatewayRequestContext;
}

describe("createPluginGatewayDispatcher", () => {
  let context: GatewayRequestContext;

  beforeEach(() => {
    vi.clearAllMocks();
    context = createMockContext();
  });

  it("resolves with handler payload on success", async () => {
    const handlers: GatewayRequestHandlers = {
      "test.method": ({ respond }) => {
        respond(true, { data: 1 });
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });
    const result = await dispatch("test.method", { foo: "bar" });

    expect(result).toEqual({ data: 1 });
  });

  it("rejects when handler calls respond with failure", async () => {
    const handlers: GatewayRequestHandlers = {
      "fail.method": ({ respond }) => {
        respond(false, undefined, { code: "ERR_TEST", message: "bad" });
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });

    await expect(dispatch("fail.method", {})).rejects.toThrow("bad");
  });

  it("rejects for unknown method", async () => {
    const handlers: GatewayRequestHandlers = {};

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });

    await expect(dispatch("nonexistent.method", {})).rejects.toThrow(
      'plugin gateway dispatch: unknown method "nonexistent.method"',
    );
  });

  it("rejects when handler throws synchronously", async () => {
    const handlers: GatewayRequestHandlers = {
      "throw.method": () => {
        throw new Error("sync explosion");
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });

    await expect(dispatch("throw.method", {})).rejects.toThrow("sync explosion");
  });

  it("rejects when handler returns a rejected Promise", async () => {
    const handlers: GatewayRequestHandlers = {
      "async.fail": () => {
        return Promise.reject(new Error("async boom"));
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });

    await expect(dispatch("async.fail", {})).rejects.toThrow("async boom");
  });

  it("logs debug with pluginId", async () => {
    const handlers: GatewayRequestHandlers = {
      "log.method": ({ respond }) => {
        respond(true, {});
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });
    await dispatch("log.method", {}, { pluginId: "my-plugin" });

    const debugFn = (context.logGateway as unknown as { debug: ReturnType<typeof vi.fn> }).debug;
    expect(debugFn).toHaveBeenCalledWith("plugin dispatch: plugin:my-plugin \u2192 log.method");
  });

  it("logs debug without pluginId (fallback to 'plugin')", async () => {
    const handlers: GatewayRequestHandlers = {
      "log.method": ({ respond }) => {
        respond(true, {});
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });
    await dispatch("log.method", {});

    const debugFn = (context.logGateway as unknown as { debug: ReturnType<typeof vi.fn> }).debug;
    expect(debugFn).toHaveBeenCalledWith("plugin dispatch: plugin \u2192 log.method");
  });

  it("passes null client to handler", async () => {
    let capturedClient: unknown = "sentinel";

    const handlers: GatewayRequestHandlers = {
      "client.check": (opts) => {
        capturedClient = opts.client;
        opts.respond(true, {});
      },
    };

    const dispatch = createPluginGatewayDispatcher({ allHandlers: handlers, context });
    await dispatch("client.check", {});

    expect(capturedClient).toBeNull();
  });
});

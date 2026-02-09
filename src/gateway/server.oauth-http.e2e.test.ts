import { describe, expect, it, vi } from "vitest";
import type { ResolvedGatewayAuth } from "./auth.js";
import type { GatewayWsClient } from "./server/ws-types.js";
import { createGatewayHttpServer } from "./server-http.js";

async function listen(server: ReturnType<typeof createGatewayHttpServer>): Promise<{
  port: number;
  close: () => Promise<void>;
}> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  return {
    port,
    close: async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      );
    },
  };
}

describe("gateway oauth http handler", () => {
  it("routes oauth endpoints through the configured handler", async () => {
    const resolvedAuth: ResolvedGatewayAuth = {
      mode: "token",
      token: "test-token",
      password: undefined,
      allowTailscale: false,
    };

    const handleOAuthRequest = vi.fn(async (req, res) => {
      if (req.url === "/oauth/status/github") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ connected: true }));
        return true;
      }
      return false;
    });

    const httpServer = createGatewayHttpServer({
      canvasHost: null,
      clients: new Set<GatewayWsClient>(),
      controlUiEnabled: false,
      controlUiBasePath: "/__control__",
      openAiChatCompletionsEnabled: false,
      openResponsesEnabled: false,
      handleHooksRequest: async () => false,
      handleOAuthRequest,
      resolvedAuth,
    });

    const listener = await listen(httpServer);
    try {
      const response = await fetch(`http://127.0.0.1:${listener.port}/oauth/status/github`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ connected: true });
      expect(handleOAuthRequest).toHaveBeenCalled();
    } finally {
      await listener.close();
    }
  });
});

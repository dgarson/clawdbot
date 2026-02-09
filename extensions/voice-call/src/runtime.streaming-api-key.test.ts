import net from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { VoiceCallConfigSchema } from "./config.js";
import { createVoiceCallRuntime } from "./runtime.js";

async function getFreePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Failed to get ephemeral port")));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

function makeStreamingConfig(port: number) {
  return VoiceCallConfigSchema.parse({
    enabled: true,
    provider: "twilio",
    fromNumber: "+15550001234",
    inboundPolicy: "disabled",
    twilio: {
      accountSid: "AC123",
      authToken: "secret",
    },
    serve: { port, bind: "127.0.0.1", path: "/voice/webhook" },
    streaming: {
      enabled: true,
      sttModel: "gpt-4o-transcribe",
    },
  });
}

describe("createVoiceCallRuntime streaming API key resolution", () => {
  const originalOpenAIKey = process.env.OPENAI_API_KEY;

  afterEach(() => {
    if (originalOpenAIKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAIKey;
    }
  });

  it("does not initialize media streaming when no key is available", async () => {
    delete process.env.OPENAI_API_KEY;
    const config = makeStreamingConfig(await getFreePort());

    const rt = await createVoiceCallRuntime({
      config,
      coreConfig: {},
    });

    expect(rt.webhookServer.getMediaStreamHandler()).toBeNull();
    await rt.stop();
  });

  it("uses OPENAI_API_KEY from core config env sugar", async () => {
    delete process.env.OPENAI_API_KEY;
    const config = makeStreamingConfig(await getFreePort());

    const rt = await createVoiceCallRuntime({
      config,
      coreConfig: {
        env: {
          OPENAI_API_KEY: "sk-core-env-key",
        },
      },
    });

    expect(rt.webhookServer.getMediaStreamHandler()).not.toBeNull();
    await rt.stop();
  });

  it("uses OPENAI_API_KEY from core config env.vars", async () => {
    delete process.env.OPENAI_API_KEY;
    const config = makeStreamingConfig(await getFreePort());

    const rt = await createVoiceCallRuntime({
      config,
      coreConfig: {
        env: {
          vars: {
            OPENAI_API_KEY: "sk-core-env-vars-key",
          },
        },
      },
    });

    expect(rt.webhookServer.getMediaStreamHandler()).not.toBeNull();
    await rt.stop();
  });
});

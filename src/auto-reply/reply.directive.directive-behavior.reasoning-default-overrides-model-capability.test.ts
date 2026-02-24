import "./reply.directive.directive-behavior.e2e-mocks.js";
import { describe, expect, it, vi } from "vitest";
import {
  installDirectiveBehaviorE2EHooks,
  loadModelCatalog,
  makeWhatsAppDirectiveConfig,
  runEmbeddedPiAgent,
  withTempHome,
} from "./reply.directive.directive-behavior.e2e-harness.js";
import { getReplyFromConfig } from "./reply.js";

describe("directive behavior reasoning defaults", () => {
  installDirectiveBehaviorE2EHooks();

  it("falls back to model reasoning capability when reasoningDefault is unset", async () => {
    await withTempHome(async (home) => {
      vi.mocked(loadModelCatalog).mockResolvedValue([
        { provider: "anthropic", id: "claude-opus-4-5", name: "Opus 4.5", reasoning: true },
      ]);
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "done" }],
        meta: {
          durationMs: 5,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      await getReplyFromConfig(
        { Body: "hello", From: "+1222", To: "+1222", Provider: "whatsapp" },
        {},
        makeWhatsAppDirectiveConfig(home, { model: "anthropic/claude-opus-4-5" }),
      );

      const runParams = vi.mocked(runEmbeddedPiAgent).mock.calls[0]?.[0];
      expect(runParams?.reasoningLevel).toBe("on");
    });
  });

  it("uses configured reasoningDefault instead of model reasoning capability when set", async () => {
    await withTempHome(async (home) => {
      vi.mocked(loadModelCatalog).mockResolvedValue([
        { provider: "anthropic", id: "claude-opus-4-5", name: "Opus 4.5", reasoning: true },
      ]);
      vi.mocked(runEmbeddedPiAgent).mockResolvedValue({
        payloads: [{ text: "done" }],
        meta: {
          durationMs: 5,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      await getReplyFromConfig(
        { Body: "hello", From: "+1222", To: "+1222", Provider: "whatsapp" },
        {},
        makeWhatsAppDirectiveConfig(home, {
          model: "anthropic/claude-opus-4-5",
          reasoningDefault: "off",
        }),
      );

      const runParams = vi.mocked(runEmbeddedPiAgent).mock.calls[0]?.[0];
      expect(runParams?.reasoningLevel).toBe("off");
    });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { createTempHomeHarness, makeReplyConfig } from "./reply.test-harness.js";

const agentMocks = vi.hoisted(() => ({
  runEmbeddedPiAgent: vi.fn(),
  loadModelCatalog: vi.fn(),
  webAuthExists: vi.fn().mockResolvedValue(true),
  getWebAuthAgeMs: vi.fn().mockReturnValue(120_000),
  readWebSelfId: vi.fn().mockReturnValue({ e164: "+1999" }),
}));

vi.mock("../agents/pi-embedded.js", () => ({
  abortEmbeddedPiRun: vi.fn().mockReturnValue(false),
  runEmbeddedPiAgent: agentMocks.runEmbeddedPiAgent,
  queueEmbeddedPiMessage: vi.fn().mockReturnValue(false),
  resolveEmbeddedSessionLane: (key: string) => `session:${key.trim() || "main"}`,
  isEmbeddedPiRunActive: vi.fn().mockReturnValue(false),
  isEmbeddedPiRunStreaming: vi.fn().mockReturnValue(false),
}));

vi.mock("../agents/model-catalog.js", () => ({
  loadModelCatalog: agentMocks.loadModelCatalog,
}));

vi.mock("../web/session.js", () => ({
  webAuthExists: agentMocks.webAuthExists,
  getWebAuthAgeMs: agentMocks.getWebAuthAgeMs,
  readWebSelfId: agentMocks.readWebSelfId,
}));

import { getReplyFromConfig } from "./reply.js";
import { HISTORY_CONTEXT_MARKER } from "./reply/history.js";
import { CURRENT_MESSAGE_MARKER } from "./reply/mentions.js";

const { withTempHome } = createTempHomeHarness({ prefix: "openclaw-rawbody-" });

describe("RawBody directive parsing", () => {
  beforeEach(() => {
    vi.stubEnv("OPENCLAW_TEST_FAST", "1");
    agentMocks.runEmbeddedPiAgent.mockReset();
    agentMocks.loadModelCatalog.mockReset();
    agentMocks.loadModelCatalog.mockResolvedValue([
      { id: "claude-opus-4-5", name: "Opus 4.5", provider: "anthropic" },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("handles directives and history in the prompt", async () => {
    await withTempHome(async (home) => {
      agentMocks.runEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      const groupMessageCtx = {
        Body: "/think:high status please",
        BodyForAgent: "/think:high status please",
        RawBody: "/think:high status please",
        InboundHistory: [{ sender: "Peter", body: "hello", timestamp: 1700000000000 }],
        From: "+1222",
        To: "+1222",
        ChatType: "group",
        GroupSubject: "Ops",
        SenderName: "Jake McInteer",
        SenderE164: "+6421807830",
        CommandAuthorized: true,
      };

      const res = await getReplyFromConfig(
        groupMessageCtx,
        {},
        makeReplyConfig(home) as OpenClawConfig,
      );

      const text = Array.isArray(res) ? res[0]?.text : res?.text;
      expect(text).toBe("ok");
      expect(agentMocks.runEmbeddedPiAgent).toHaveBeenCalledOnce();
      const prompt =
        (agentMocks.runEmbeddedPiAgent.mock.calls[0]?.[0] as { prompt?: string } | undefined)
          ?.prompt ?? "";
      expect(prompt).toContain("Chat history since last reply (untrusted, for context):");
      expect(prompt).toContain('"sender": "Peter"');
      expect(prompt).toContain('"body": "hello"');
      expect(prompt).toContain("status please");
      expect(prompt).not.toContain("/think:high");
    });
  });

  it("does not duplicate history when Body contains embedded envelope history", async () => {
    await withTempHome(async (home) => {
      agentMocks.runEmbeddedPiAgent.mockResolvedValue({
        payloads: [{ text: "ok" }],
        meta: {
          durationMs: 1,
          agentMeta: { sessionId: "s", provider: "p", model: "m" },
        },
      });

      // Simulate the composite Body that buildPendingHistoryContextFromMap produces:
      // history envelope text followed by the current message marker and current message.
      const embeddedBody = [
        HISTORY_CONTEXT_MARKER,
        "Peter: hello",
        "",
        CURRENT_MESSAGE_MARKER,
        "what is 2+2",
      ].join("\n");

      const groupMessageCtx = {
        // Body has history embedded (as real providers produce via buildPendingHistoryContextFromMap)
        Body: embeddedBody,
        RawBody: "what is 2+2",
        // InboundHistory is the structured canonical source of the same history
        InboundHistory: [{ sender: "Peter", body: "hello", timestamp: 1700000000000 }],
        From: "+1222",
        To: "+1222",
        ChatType: "group",
        GroupSubject: "Ops",
        SenderName: "Jake McInteer",
        SenderE164: "+6421807830",
        CommandAuthorized: true,
      };

      await getReplyFromConfig(groupMessageCtx, {}, makeReplyConfig(home) as OpenClawConfig);

      const prompt =
        (agentMocks.runEmbeddedPiAgent.mock.calls[0]?.[0] as { prompt?: string } | undefined)
          ?.prompt ?? "";

      // Current message should be present
      expect(prompt).toContain("what is 2+2");

      // History should appear via the structured InboundHistory JSON block
      expect(prompt).toContain("Chat history since last reply (untrusted, for context):");
      expect(prompt).toContain('"sender": "Peter"');
      expect(prompt).toContain('"body": "hello"');

      // The raw envelope history header from Body must NOT appear — Body should
      // contribute only the current message, not the embedded history prefix.
      expect(prompt).not.toContain(HISTORY_CONTEXT_MARKER);
      expect(prompt).not.toContain(CURRENT_MESSAGE_MARKER);
    });
  });
});

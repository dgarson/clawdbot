import { describe, expect, it, vi } from "vitest";
import type { TemplateContext } from "../templating.js";
import { clearInlineDirectives } from "./get-reply-directives-utils.js";
import { buildTestCtx } from "./test-ctx.js";
import type { TypingController } from "./typing.js";

const handleCommandsMock = vi.fn();
const mockToolExecute = vi.fn(async () => ({ content: "tool-ok" }));

vi.mock("../../agents/openclaw-tools.js", () => ({
  createOpenClawTools: vi.fn(() => [
    {
      name: "sessions_send",
      execute: (...args: unknown[]) => mockToolExecute(...args),
    },
  ]),
}));

vi.mock("../../agents/tool-policy.js", () => ({
  applyOwnerOnlyToolPolicy: vi.fn((tools: unknown[]) => tools),
}));

vi.mock("./commands.js", () => ({
  handleCommands: (...args: unknown[]) => handleCommandsMock(...args),
  buildStatusReply: vi.fn(),
  buildCommandContext: vi.fn(),
}));

const { handleInlineActions } = await import("./get-reply-inline-actions.js");

function makeTyping(): TypingController {
  return {
    onReplyStart: async () => {},
    startTypingLoop: async () => {},
    startTypingOnText: async () => {},
    refreshTypingTtl: () => {},
    isActive: () => false,
    markRunComplete: () => {},
    markDispatchIdle: () => {},
    cleanup: vi.fn(),
  };
}

describe("handleInlineActions skill disclosure", () => {
  it("adds credential disclosure for non-owner skill tool dispatch", async () => {
    const typing = makeTyping();
    const ctx = buildTestCtx({
      From: "slack:U123",
      To: "slack:C123",
      Body: "/demo hello",
    });

    const result = await handleInlineActions({
      ctx,
      sessionCtx: ctx as unknown as TemplateContext,
      cfg: {},
      agentId: "main",
      sessionKey: "s:main",
      workspaceDir: "/tmp",
      isGroup: false,
      typing,
      allowTextCommands: true,
      inlineStatusRequested: false,
      command: {
        surface: "slack",
        channel: "slack",
        channelId: "C123",
        ownerList: [],
        senderIsOwner: false,
        isAuthorizedSender: true,
        senderId: "U123",
        abortKey: "slack:U123",
        rawBodyNormalized: "/demo hello",
        commandBodyNormalized: "/demo hello",
        from: "slack:U123",
        to: "slack:C123",
      },
      skillCommands: [
        {
          name: "demo",
          skillName: "demo-skill",
          description: "Demo",
          dispatch: { kind: "tool", toolName: "sessions_send", argMode: "raw" },
        },
      ],
      directives: clearInlineDirectives("/demo hello"),
      cleanedBody: "/demo hello",
      elevatedEnabled: false,
      elevatedAllowed: false,
      elevatedFailures: [],
      defaultActivation: () => "always",
      resolvedThinkLevel: undefined,
      resolvedVerboseLevel: undefined,
      resolvedReasoningLevel: "off",
      resolvedElevatedLevel: "off",
      resolveDefaultThinkingLevel: async () => "off",
      provider: "openai",
      model: "gpt-4o-mini",
      contextTokens: 0,
      abortedLastRun: false,
      sessionScope: "per-sender",
    });

    expect(result.kind).toBe("reply");
    expect(result.reply).toEqual({
      text: expect.stringContaining(
        "Disclosure: this skill action may use owner-configured credentials",
      ),
    });
    expect(result.reply).toEqual({ text: expect.stringContaining("tool-ok") });
  });
});

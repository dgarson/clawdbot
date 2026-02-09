import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock sendMessageTelegram and editMessageTelegram
vi.mock("../send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "100", chatId: "555" }),
  editMessageTelegram: vi.fn().mockResolvedValue({ ok: true }),
  reactMessageTelegram: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../../logging/subsystem.js", () => ({
  createSubsystemLogger: () => ({
    raw: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }),
}));

// We DON'T mock callback-router and response-store — use the real ones.
// This tests the actual integration.

import { getCallbackRouter, resetCallbackRouter } from "../../channels/telegram/callback-router.js";
import { createTelegramInteractiveConfirmationTool } from "./interactive-confirmation-tool.js";
import { telegramResponseStore } from "./response-store.js";

describe("AskTelegramConfirmation tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallbackRouter();
  });

  afterEach(() => {
    telegramResponseStore.cancelAll();
    resetCallbackRouter();
  });

  it("creates tool with correct name and description", () => {
    const tool = createTelegramInteractiveConfirmationTool();
    expect(tool.name).toBe("AskTelegramConfirmation");
    expect(tool.label).toBe("Ask Telegram Confirmation");
    expect(tool.description).toContain("Yes/No confirmation");
  });

  it("has correct parameter schema", () => {
    const tool = createTelegramInteractiveConfirmationTool();
    const params = tool.parameters as { properties: Record<string, unknown> };
    expect(params.properties.to).toBeDefined();
    expect(params.properties.title).toBeDefined();
    expect(params.properties.message).toBeDefined();
    expect(params.properties.confirmLabel).toBeDefined();
    expect(params.properties.cancelLabel).toBeDefined();
    expect(params.properties.style).toBeDefined();
    expect(params.properties.timeoutSeconds).toBeDefined();
  });

  it("sends confirmation message with inline keyboard", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-1", {
      to: "555",
      title: "Delete file?",
      message: "This cannot be undone.",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(sendMessageTelegram).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    expect(callArgs[0]).toBe("555");
    expect(callArgs[1]).toContain("Delete file?");
    expect(callArgs[1]).toContain("This cannot be undone.");
    expect(callArgs[2]?.buttons).toBeDefined();
    expect(callArgs[2]?.buttons!.length).toBe(1);
    expect(callArgs[2]?.buttons![0].length).toBe(2);

    const router = getCallbackRouter();
    const stats = router.getStats();
    expect(stats.activeHandlers).toBe(1);

    telegramResponseStore.cancelAll();
    await executePromise;
  });

  it("returns confirmed=true when user confirms", async () => {
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-2", {
      to: "555",
      title: "Proceed?",
      message: "Continue with deployment?",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const { sendMessageTelegram } = await import("../send.js");
    const confirmData =
      vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons![0][0].callback_data;
    expect(confirmData).toBeDefined();

    const router = getCallbackRouter();
    await router.route({
      callbackData: confirmData!,
      prefix: "",
      actionId: "",
      chatId: "555",
      userId: "user123",
      username: "testuser",
      callbackQueryId: "cq1",
      messageId: 100,
    });

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(true);
    expect(parsed.confirmed).toBe(true);
    expect(parsed.cancelled).toBe(false);
    expect(parsed.respondedBy).toBe("user123");
    expect(parsed.respondedByName).toBe("testuser");
    expect(parsed.timedOut).toBe(false);
  });

  it("returns confirmed=false when user cancels", async () => {
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-3", {
      to: "555",
      title: "Delete?",
      message: "Are you sure?",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const { sendMessageTelegram } = await import("../send.js");
    const cancelData =
      vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons![0][1].callback_data;
    expect(cancelData).toBeDefined();

    const router = getCallbackRouter();
    await router.route({
      callbackData: cancelData!,
      prefix: "",
      actionId: "",
      chatId: "555",
      userId: "user456",
      username: "otheruser",
      callbackQueryId: "cq2",
      messageId: 100,
    });

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(true);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.cancelled).toBe(true);
  });

  it("uses custom confirm/cancel labels", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-4", {
      to: "555",
      title: "Continue?",
      message: "Deploy to production?",
      confirmLabel: "Deploy",
      cancelLabel: "Abort",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const buttons = vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons;
    expect(buttons![0][0].text).toContain("Deploy");
    expect(buttons![0][1].text).toContain("Abort");

    telegramResponseStore.cancelAll();
    await executePromise;
  });

  it("uses danger style with red emoji", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-5", {
      to: "555",
      title: "Danger",
      message: "This is destructive",
      style: "danger",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const buttons = vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons;
    expect(buttons![0][0].text).toContain("🔴");

    telegramResponseStore.cancelAll();
    await executePromise;
  });

  it("updates message after confirmation", async () => {
    const { editMessageTelegram, sendMessageTelegram } = await import("../send.js");
    vi.mocked(editMessageTelegram).mockClear();
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramInteractiveConfirmationTool();

    const executePromise = tool.execute("tc-6", {
      to: "555",
      title: "OK?",
      message: "Proceed?",
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const confirmData =
      vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons![0][0].callback_data;

    const router = getCallbackRouter();
    await router.route({
      callbackData: confirmData!,
      prefix: "",
      actionId: "",
      chatId: "555",
      userId: "u1",
      username: "user1",
      callbackQueryId: "cq3",
      messageId: 100,
    });

    await executePromise;

    expect(editMessageTelegram).toHaveBeenCalled();
    const editArgs = vi.mocked(editMessageTelegram).mock.calls[0];
    expect(editArgs[2]).toContain("Confirmed");
    expect(editArgs[3]?.buttons).toEqual([]); // Remove keyboard
  });

  it("handles send error gracefully", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Chat not found"));
    const tool = createTelegramInteractiveConfirmationTool();

    const result = await tool.execute("tc-7", {
      to: "999",
      title: "Test",
      message: "Hello",
      timeoutSeconds: 10,
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(false);
    expect(parsed.confirmed).toBe(false);
    expect(parsed.error).toBe("Chat not found");
  });
});

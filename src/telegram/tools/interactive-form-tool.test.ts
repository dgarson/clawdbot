import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "300", chatId: "888" }),
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

import { getCallbackRouter, resetCallbackRouter } from "../../channels/telegram/callback-router.js";
import { createTelegramInteractiveFormTool } from "./interactive-form-tool.js";
import { telegramResponseStore } from "./response-store.js";

describe("AskTelegramForm tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallbackRouter();
  });

  afterEach(() => {
    telegramResponseStore.cancelAll();
    resetCallbackRouter();
  });

  it("creates tool with correct name and description", () => {
    const tool = createTelegramInteractiveFormTool();
    expect(tool.name).toBe("AskTelegramForm");
    expect(tool.label).toBe("Ask Telegram Form");
    expect(tool.description).toContain("conversational form");
  });

  it("has correct parameter schema", () => {
    const tool = createTelegramInteractiveFormTool();
    const params = tool.parameters as { properties: Record<string, unknown> };
    expect(params.properties.to).toBeDefined();
    expect(params.properties.title).toBeDefined();
    expect(params.properties.fields).toBeDefined();
    expect(params.properties.submitLabel).toBeDefined();
    expect(params.properties.timeoutSeconds).toBeDefined();
  });

  it("collects single text field and submits", async () => {
    const { sendMessageTelegram } = await import("../send.js");

    // Create a tool with a test helper for text replies
    const tool = createTelegramInteractiveFormTool({
      _getTextReply: async (_chatId, _fieldName) => ({
        text: "John Doe",
        userId: "u1",
        username: "johndoe",
      }),
    });

    const executePromise = tool.execute("tf-1", {
      to: "888",
      title: "User Info",
      fields: [{ label: "Name", name: "name", type: "text" }],
      timeoutSeconds: 30,
    });

    // Wait for the form to reach the submit stage
    await new Promise((r) => setTimeout(r, 50));

    // The form should have sent: intro message, field prompt, and summary
    expect(vi.mocked(sendMessageTelegram).mock.calls.length).toBeGreaterThanOrEqual(2);

    // Simulate clicking Submit
    const router = getCallbackRouter();
    const stats = router.getStats();
    if (stats.activeHandlers > 0) {
      // Find the submit callback data from the last sendMessageTelegram call
      const calls = vi.mocked(sendMessageTelegram).mock.calls;
      const lastCall = calls[calls.length - 1];
      const submitBtn = lastCall[2]?.buttons?.[0]?.[0];
      if (submitBtn) {
        await router.route({
          callbackData: submitBtn.callback_data,
          prefix: "",
          actionId: "",
          chatId: "888",
          userId: "u1",
          username: "johndoe",
          callbackQueryId: "cq1",
          messageId: 300,
        });
      }
    }

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(true);
    expect(parsed.values.name).toBe("John Doe");
  });

  it("collects select field via inline keyboard", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();

    const tool = createTelegramInteractiveFormTool();

    const executePromise = tool.execute("tf-2", {
      to: "888",
      title: "Preferences",
      fields: [
        {
          label: "Color",
          name: "color",
          type: "select",
          options: [
            { text: "Red", value: "red" },
            { text: "Blue", value: "blue" },
          ],
        },
      ],
      timeoutSeconds: 30,
    });

    // Wait for field prompt to be sent
    await new Promise((r) => setTimeout(r, 30));

    const router = getCallbackRouter();

    // Find the select field buttons — they'll be in the second sendMessageTelegram call
    const calls = vi.mocked(sendMessageTelegram).mock.calls;
    // Find the call with select options (has buttons with the field options)
    const selectCall = calls.find((c) =>
      c[2]?.buttons?.some((row) => row.some((btn) => btn.text === "Red")),
    );
    expect(selectCall).toBeDefined();

    const redBtn = selectCall![2]!.buttons!.flat().find((btn) => btn.text === "Red");
    expect(redBtn).toBeDefined();

    await router.route({
      callbackData: redBtn!.callback_data,
      prefix: "",
      actionId: "",
      chatId: "888",
      userId: "u2",
      username: "selector",
      callbackQueryId: "cq2",
      messageId: 300,
    });

    // Wait for summary to appear
    await new Promise((r) => setTimeout(r, 30));

    // Now submit
    const latestCalls = vi.mocked(sendMessageTelegram).mock.calls;
    const summaryCall = latestCalls[latestCalls.length - 1];
    const submitBtn = summaryCall[2]?.buttons?.[0]?.[0];
    if (submitBtn) {
      await router.route({
        callbackData: submitBtn.callback_data,
        prefix: "",
        actionId: "",
        chatId: "888",
        userId: "u2",
        username: "selector",
        callbackQueryId: "cq3",
        messageId: 300,
      });
    }

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(true);
    expect(parsed.values.color).toBe("red");
  });

  it("collects multi-field form sequentially", async () => {
    const fieldReplies: Record<string, string> = {
      name: "Alice",
      email: "alice@example.com",
    };

    const tool = createTelegramInteractiveFormTool({
      _getTextReply: async (_chatId, fieldName) => ({
        text: fieldReplies[fieldName] ?? "",
        userId: "u3",
        username: "alice",
      }),
    });

    const executePromise = tool.execute("tf-3", {
      to: "888",
      title: "Contact Info",
      fields: [
        { label: "Name", name: "name", type: "text" },
        { label: "Email", name: "email", type: "email" },
      ],
      timeoutSeconds: 30,
    });

    await new Promise((r) => setTimeout(r, 50));

    // Submit
    const { sendMessageTelegram } = await import("../send.js");
    const router = getCallbackRouter();
    const calls = vi.mocked(sendMessageTelegram).mock.calls;
    const lastCall = calls[calls.length - 1];
    const submitBtn = lastCall[2]?.buttons?.[0]?.[0];
    if (submitBtn) {
      await router.route({
        callbackData: submitBtn.callback_data,
        prefix: "",
        actionId: "",
        chatId: "888",
        userId: "u3",
        username: "alice",
        callbackQueryId: "cq4",
        messageId: 300,
      });
    }

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(true);
    expect(parsed.values.name).toBe("Alice");
    expect(parsed.values.email).toBe("alice@example.com");
  });

  it("handles cancellation via Cancel button", async () => {
    const tool = createTelegramInteractiveFormTool({
      _getTextReply: async () => ({
        text: "value",
        userId: "u4",
        username: "canceller",
      }),
    });

    const executePromise = tool.execute("tf-4", {
      to: "888",
      title: "Test Form",
      fields: [{ label: "Field1", name: "f1", type: "text" }],
      timeoutSeconds: 30,
    });

    await new Promise((r) => setTimeout(r, 50));

    const { sendMessageTelegram } = await import("../send.js");
    const router = getCallbackRouter();
    const calls = vi.mocked(sendMessageTelegram).mock.calls;
    const lastCall = calls[calls.length - 1];
    // Click Cancel (second button)
    const cancelBtn = lastCall[2]?.buttons?.[0]?.[1];
    if (cancelBtn) {
      await router.route({
        callbackData: cancelBtn.callback_data,
        prefix: "",
        actionId: "",
        chatId: "888",
        userId: "u4",
        username: "canceller",
        callbackQueryId: "cq5",
        messageId: 300,
      });
    }

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(false);
    expect(parsed.cancelled).toBe(true);
  });

  it("handles number field validation", async () => {
    const tool = createTelegramInteractiveFormTool({
      _getTextReply: async () => ({
        text: "42",
        userId: "u5",
        username: "numuser",
      }),
    });

    const executePromise = tool.execute("tf-5", {
      to: "888",
      title: "Number Form",
      fields: [{ label: "Age", name: "age", type: "number" }],
      timeoutSeconds: 30,
    });

    await new Promise((r) => setTimeout(r, 50));

    const { sendMessageTelegram } = await import("../send.js");
    const router = getCallbackRouter();
    const calls = vi.mocked(sendMessageTelegram).mock.calls;
    const lastCall = calls[calls.length - 1];
    const submitBtn = lastCall[2]?.buttons?.[0]?.[0];
    if (submitBtn) {
      await router.route({
        callbackData: submitBtn.callback_data,
        prefix: "",
        actionId: "",
        chatId: "888",
        userId: "u5",
        username: "numuser",
        callbackQueryId: "cq6",
        messageId: 300,
      });
    }

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(true);
    expect(parsed.values.age).toBe(42);
  });

  it("handles send error gracefully", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Bot blocked"));
    const tool = createTelegramInteractiveFormTool();

    const result = await tool.execute("tf-6", {
      to: "999",
      title: "Test",
      fields: [{ label: "Name", name: "name", type: "text" }],
      timeoutSeconds: 10,
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.submitted).toBe(false);
    expect(parsed.error).toBe("Bot blocked");
  });
});

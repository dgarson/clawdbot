import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "200", chatId: "777" }),
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
import { createTelegramInteractiveQuestionTool } from "./interactive-question-tool.js";
import { telegramResponseStore } from "./response-store.js";

describe("AskTelegramQuestion tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCallbackRouter();
  });

  afterEach(() => {
    telegramResponseStore.cancelAll();
    resetCallbackRouter();
  });

  it("creates tool with correct name and description", () => {
    const tool = createTelegramInteractiveQuestionTool();
    expect(tool.name).toBe("AskTelegramQuestion");
    expect(tool.label).toBe("Ask Telegram Question");
    expect(tool.description).toContain("interactive question");
  });

  it("has correct parameter schema", () => {
    const tool = createTelegramInteractiveQuestionTool();
    const params = tool.parameters as { properties: Record<string, unknown> };
    expect(params.properties.to).toBeDefined();
    expect(params.properties.question).toBeDefined();
    expect(params.properties.options).toBeDefined();
    expect(params.properties.allowMultiple).toBeDefined();
    expect(params.properties.timeoutSeconds).toBeDefined();
  });

  it("sends question with inline keyboard options", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    const tool = createTelegramInteractiveQuestionTool();

    const executePromise = tool.execute("tq-1", {
      to: "777",
      question: "What color?",
      options: [
        { text: "Red", value: "red" },
        { text: "Blue", value: "blue" },
        { text: "Green", value: "green" },
      ],
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(sendMessageTelegram).toHaveBeenCalledOnce();
    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    expect(callArgs[0]).toBe("777");
    expect(callArgs[1]).toContain("What color?");
    expect(callArgs[2]?.buttons).toBeDefined();

    // 3 options → 1 per row (≤4 options), so 3 rows
    const buttons = callArgs[2]!.buttons!;
    expect(buttons.length).toBe(3);
    expect(buttons[0][0].text).toBe("Red");
    expect(buttons[1][0].text).toBe("Blue");
    expect(buttons[2][0].text).toBe("Green");

    telegramResponseStore.cancelAll();
    await executePromise;
  });

  it("returns selected value for single-choice", async () => {
    const tool = createTelegramInteractiveQuestionTool();

    const executePromise = tool.execute("tq-2", {
      to: "777",
      question: "Pick one",
      options: [
        { text: "A", value: "a" },
        { text: "B", value: "b" },
      ],
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const { sendMessageTelegram } = await import("../send.js");
    // Click the first option
    const optionData =
      vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons![0][0].callback_data;
    expect(optionData).toBeDefined();

    const router = getCallbackRouter();
    await router.route({
      callbackData: optionData!,
      prefix: "",
      actionId: "",
      chatId: "777",
      userId: "usr1",
      username: "testperson",
      callbackQueryId: "cq1",
      messageId: 200,
    });

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(true);
    expect(parsed.selectedValues).toContain("a");
    expect(parsed.respondedBy).toBe("usr1");
    expect(parsed.respondedByName).toBe("testperson");
    expect(parsed.timedOut).toBe(false);
  });

  it("supports multi-choice with Done button", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramInteractiveQuestionTool();

    const executePromise = tool.execute("tq-3", {
      to: "777",
      question: "Select languages",
      options: [
        { text: "TypeScript", value: "ts" },
        { text: "Python", value: "py" },
        { text: "Rust", value: "rs" },
      ],
      allowMultiple: true,
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const buttons = vi.mocked(sendMessageTelegram).mock.calls[0][2]!.buttons!;
    // Should have options + Done button row
    const lastRow = buttons[buttons.length - 1];
    expect(lastRow[0].text).toBe("✅ Done");

    // Toggle two options then submit
    const router = getCallbackRouter();
    const opt1Data = buttons[0][0].callback_data;
    const opt3Data = buttons[2][0].callback_data;
    const doneData = lastRow[0].callback_data;

    await router.route({
      callbackData: opt1Data,
      prefix: "",
      actionId: "",
      chatId: "777",
      userId: "usr2",
      username: "multiuser",
      callbackQueryId: "cq2",
      messageId: 200,
    });

    await router.route({
      callbackData: opt3Data,
      prefix: "",
      actionId: "",
      chatId: "777",
      userId: "usr2",
      username: "multiuser",
      callbackQueryId: "cq3",
      messageId: 200,
    });

    await router.route({
      callbackData: doneData,
      prefix: "",
      actionId: "",
      chatId: "777",
      userId: "usr2",
      username: "multiuser",
      callbackQueryId: "cq4",
      messageId: 200,
    });

    const result = await executePromise;
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(true);
    expect(parsed.selectedValues).toContain("ts");
    expect(parsed.selectedValues).toContain("rs");
    expect(parsed.selectedValues).not.toContain("py");
  });

  it("updates message after response", async () => {
    const { editMessageTelegram, sendMessageTelegram } = await import("../send.js");
    vi.mocked(editMessageTelegram).mockClear();
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramInteractiveQuestionTool();

    const executePromise = tool.execute("tq-4", {
      to: "777",
      question: "Favorite?",
      options: [
        { text: "Yes", value: "yes" },
        { text: "No", value: "no" },
      ],
      timeoutSeconds: 10,
    });

    await new Promise((r) => setTimeout(r, 10));

    const optionData =
      vi.mocked(sendMessageTelegram).mock.calls[0][2]?.buttons![0][0].callback_data;
    const router = getCallbackRouter();
    await router.route({
      callbackData: optionData!,
      prefix: "",
      actionId: "",
      chatId: "777",
      userId: "u1",
      username: "responder",
      callbackQueryId: "cq5",
      messageId: 200,
    });

    await executePromise;

    expect(editMessageTelegram).toHaveBeenCalled();
    const editArgs = vi.mocked(editMessageTelegram).mock.calls[0];
    expect(editArgs[2]).toContain("Answered");
    expect(editArgs[3]?.buttons).toEqual([]);
  });

  it("handles send error gracefully", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Forbidden"));
    const tool = createTelegramInteractiveQuestionTool();

    const result = await tool.execute("tq-5", {
      to: "888",
      question: "Test?",
      options: [
        { text: "A", value: "a" },
        { text: "B", value: "b" },
      ],
      timeoutSeconds: 10,
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.answered).toBe(false);
    expect(parsed.error).toBe("Forbidden");
  });

  it("validates minimum 2 options in schema", () => {
    const tool = createTelegramInteractiveQuestionTool();
    const params = tool.parameters as { properties: { options: { minItems: number } } };
    expect(params.properties.options.minItems).toBe(2);
  });
});

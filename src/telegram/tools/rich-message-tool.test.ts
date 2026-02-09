import { describe, expect, it, vi } from "vitest";
import { createTelegramRichMessageTool } from "./rich-message-tool.js";

vi.mock("../send.js", () => ({
  sendMessageTelegram: vi.fn().mockResolvedValue({ messageId: "42", chatId: "123456" }),
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

describe("TelegramRichMessage tool", () => {
  it("creates tool with correct name and description", () => {
    const tool = createTelegramRichMessageTool();
    expect(tool.name).toBe("TelegramRichMessage");
    expect(tool.label).toBe("Telegram Rich Message");
    expect(tool.description).toContain("semantic patterns");
  });

  it("sends multiple_choice pattern with keyboard", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-1", {
      to: "123456",
      pattern: "multiple_choice",
      params: {
        question: "Pick one",
        options: [
          { text: "A", value: "a" },
          { text: "B", value: "b" },
        ],
        actionIdPrefix: "test",
      },
    });

    expect(sendMessageTelegram).toHaveBeenCalled();
    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    expect(callArgs[0]).toBe("123456");
    // HTML should contain the question
    expect(callArgs[1]).toContain("Pick one");
    // Should have buttons
    expect(callArgs[2]?.buttons).toBeDefined();
    expect(callArgs[2]?.buttons!.length).toBeGreaterThan(0);
    expect(callArgs[2]?.textMode).toBe("html");

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.messageId).toBe("42");
    expect(parsed.chatId).toBe("123456");
    expect(parsed.hasKeyboard).toBe(true);
  });

  it("sends confirmation pattern with two buttons", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    await tool.execute("tc-2", {
      to: "999",
      pattern: "confirmation",
      params: {
        title: "Delete?",
        message: "Are you sure?",
        actionIdPrefix: "del",
      },
    });

    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    const buttons = callArgs[2]?.buttons;
    expect(buttons).toBeDefined();
    // Should have exactly one row with 2 buttons
    expect(buttons!.length).toBe(1);
    expect(buttons![0].length).toBe(2);
    expect(buttons![0][0].text).toContain("Confirm");
    expect(buttons![0][1].text).toContain("Cancel");
  });

  it("sends status pattern without keyboard", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-3", {
      to: "123456",
      pattern: "status",
      params: {
        title: "Build Complete",
        message: "All tests passed",
        status: "success",
      },
    });

    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    expect(callArgs[2]?.buttons).toBeUndefined();

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.hasKeyboard).toBe(false);
  });

  it("sends progress pattern without keyboard", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-4", {
      to: "123456",
      pattern: "progress",
      params: {
        title: "Upload",
        current: 50,
        total: 100,
      },
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.hasKeyboard).toBe(false);
  });

  it("sends info_grid pattern without keyboard", async () => {
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-5", {
      to: "123456",
      pattern: "info_grid",
      params: {
        title: "Server Info",
        items: [
          { label: "CPU", value: "98%" },
          { label: "Memory", value: "4GB" },
        ],
      },
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
    expect(parsed.hasKeyboard).toBe(false);
  });

  it("sends task_proposal pattern with accept/reject/modify buttons", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    await tool.execute("tc-6", {
      to: "123456",
      pattern: "task_proposal",
      params: {
        title: "New Feature",
        description: "Implement login",
        actionIdPrefix: "task1",
        modifyLabel: "Modify",
      },
    });

    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    const buttons = callArgs[2]?.buttons;
    expect(buttons).toBeDefined();
    expect(buttons!.length).toBe(1);
    // Accept, Reject, Modify
    expect(buttons![0].length).toBe(3);
  });

  it("sends action_items pattern with toggle buttons", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    await tool.execute("tc-7", {
      to: "123456",
      pattern: "action_items",
      params: {
        title: "Tasks",
        items: [
          { id: "1", text: "Task A", completed: false },
          { id: "2", text: "Task B", completed: true },
        ],
        actionIdPrefix: "tasks",
      },
    });

    const callArgs = vi.mocked(sendMessageTelegram).mock.calls[0];
    const buttons = callArgs[2]?.buttons;
    expect(buttons).toBeDefined();
    expect(buttons!.length).toBeGreaterThan(0);
  });

  it("adds reactions after sending", async () => {
    const { reactMessageTelegram } = await import("../send.js");
    vi.mocked(reactMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    await tool.execute("tc-8", {
      to: "123456",
      pattern: "status",
      params: {
        title: "Done",
        message: "Complete",
        status: "success",
      },
      reactions: ["👍", "🎉"],
    });

    expect(reactMessageTelegram).toHaveBeenCalledTimes(2);
  });

  it("handles send errors gracefully", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockRejectedValueOnce(new Error("Network error"));
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-9", {
      to: "123456",
      pattern: "status",
      params: { title: "Test", message: "Hello", status: "info" },
    });

    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(false);
    expect(parsed.error).toBe("Network error");
  });

  it("handles unknown pattern gracefully", async () => {
    const { sendMessageTelegram } = await import("../send.js");
    vi.mocked(sendMessageTelegram).mockClear();
    const tool = createTelegramRichMessageTool();

    const result = await tool.execute("tc-10", {
      to: "123456",
      pattern: "nonexistent_pattern",
      params: {},
    });

    // Should still succeed — renderPattern returns an "Unknown pattern" text-only result
    const parsed = JSON.parse((result.content[0] as { text: string }).text);
    expect(parsed.success).toBe(true);
  });
});

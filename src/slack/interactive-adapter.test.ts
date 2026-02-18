import { describe, expect, it, vi, beforeEach } from "vitest";
import { resetSystemEventsForTest } from "../infra/system-events.js";
import { createSlackInteractiveAdapter } from "./interactive-adapter.js";

describe("Slack interactive adapter", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
  });

  it("askQuestion builds blocks with options as buttons", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });
    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: () => [],
    });

    const responsePromise = adapter.askQuestion({
      to: "C123",
      question: {
        id: "q1",
        text: "Pick a color",
        options: [
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
        ],
        timeoutMs: 100,
      },
    });

    const response = await responsePromise;
    expect(sendMock).toHaveBeenCalledOnce();
    const sendArgs = sendMock.mock.calls[0];
    expect(sendArgs[2]?.blocks).toBeDefined();
    expect(response.timedOut).toBe(true);
    expect(response.answered).toBe(false);
  });

  it("askConfirmation builds confirm/cancel buttons", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });
    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: () => [],
    });

    const responsePromise = adapter.askConfirmation({
      to: "C123",
      confirmation: {
        id: "c1",
        title: "Deploy?",
        message: "Deploy to production?",
        timeoutMs: 100,
      },
    });

    const response = await responsePromise;
    expect(sendMock).toHaveBeenCalledOnce();
    expect(response.timedOut).toBe(true);
    expect(response.answered).toBe(false);
  });
});

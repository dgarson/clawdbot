import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  enqueueSystemEvent,
  resetSystemEventsForTest,
  peekSystemEventEntries,
} from "../infra/system-events.js";
import { createSlackInteractiveAdapter } from "./interactive-adapter.js";

describe("Slack interactive adapter e2e", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
  });

  it("resolves when matching interaction event arrives", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });

    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: (sessionKey) => peekSystemEventEntries(sessionKey),
    });

    const responsePromise = adapter.askQuestion({
      to: "C123",
      question: {
        id: "test_q1",
        text: "Pick a color",
        options: [
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
        ],
        timeoutMs: 5000,
      },
    });

    // Simulate user clicking "Blue" button after a short delay
    setTimeout(() => {
      enqueueSystemEvent(
        `Slack interaction: ${JSON.stringify({
          interactionType: "block_action",
          actionId: "openclaw:question:test_q1:blue",
          actionType: "button",
          value: "blue",
          userId: "U456",
          channelId: "C123",
        })}`,
        { sessionKey: "C123" },
      );
    }, 200);

    const response = await responsePromise;
    expect(response.answered).toBe(true);
    expect(response.timedOut).toBe(false);
    expect(response.selectedValues).toContain("blue");
    expect(response.respondedBy?.id).toBe("U456");
  });

  it("resolves confirmation when user approves", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });

    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: (sessionKey) => peekSystemEventEntries(sessionKey),
    });

    const responsePromise = adapter.askConfirmation({
      to: "C123",
      confirmation: {
        id: "test_c1",
        title: "Deploy?",
        message: "Deploy to production?",
        timeoutMs: 5000,
      },
    });

    setTimeout(() => {
      enqueueSystemEvent(
        `Slack interaction: ${JSON.stringify({
          interactionType: "block_action",
          actionId: "openclaw:confirm:test_c1:confirm",
          actionType: "button",
          value: "confirm",
          userId: "U789",
          channelId: "C123",
        })}`,
        { sessionKey: "C123" },
      );
    }, 200);

    const response = await responsePromise;
    expect(response.answered).toBe(true);
    expect(response.confirmed).toBe(true);
    expect(response.respondedBy?.id).toBe("U789");
  });
});

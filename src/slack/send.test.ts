import { ErrorCode, type WebClient } from "@slack/web-api";
import { describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { sendMessageSlack } from "./send.js";

describe("sendMessageSlack", () => {
  it("retries rate limited Slack sends", async () => {
    vi.useFakeTimers();
    const postMessage = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error("rate limited"), {
          code: ErrorCode.RateLimitedError,
          retryAfter: 0.01,
        }),
      )
      .mockResolvedValueOnce({ ts: "1710.25" });

    const client = {
      chat: { postMessage },
      conversations: { open: vi.fn() },
      files: { uploadV2: vi.fn() },
    } as unknown as WebClient;

    const config = {} as OpenClawConfig;
    const sendPromise = sendMessageSlack("channel:C123", "Hello", {
      client,
      token: "xoxb-test",
      config,
    });

    await vi.advanceTimersByTimeAsync(20);
    const result = await sendPromise;

    expect(postMessage).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ messageId: "1710.25", channelId: "C123" });
    vi.useRealTimers();
  });
});

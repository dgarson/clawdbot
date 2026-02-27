import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  cacheThreadReply,
  getCachedThreadReplies,
  resetThreadRepliesCacheForTest,
} from "./media.thread-replies.js";

beforeEach(() => {
  resetThreadRepliesCacheForTest();
  vi.useFakeTimers();
});

describe("thread replies cache", () => {
  it("returns undefined for unknown thread", () => {
    expect(getCachedThreadReplies("C1", "1111")).toBeUndefined();
  });

  it("stores and retrieves replies", () => {
    const replies = [{ text: "hi", userId: "U1", ts: "1234", botId: undefined, files: undefined }];
    cacheThreadReply("C1", "1111", replies);
    const cached = getCachedThreadReplies("C1", "1111");
    expect(cached?.replies).toEqual(replies);
  });

  it("appends a new reply incrementally", () => {
    const existing = [{ text: "first", userId: "U1", ts: "1", botId: undefined, files: undefined }];
    cacheThreadReply("C1", "1111", existing);
    const newReply = { text: "second", userId: "U2", ts: "2", botId: undefined, files: undefined };
    cacheThreadReply("C1", "1111", [...existing, newReply]);
    expect(getCachedThreadReplies("C1", "1111")?.replies.length).toBe(2);
  });

  it("returns undefined after TTL expiry", () => {
    cacheThreadReply("C1", "1111", []);
    vi.advanceTimersByTime(6 * 60_000); // 6 min > 5 min TTL
    expect(getCachedThreadReplies("C1", "1111")).toBeUndefined();
  });
});

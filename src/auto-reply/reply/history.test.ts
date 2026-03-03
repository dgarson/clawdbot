import { describe, expect, it } from "vitest";
import { DEFAULT_GROUP_HISTORY_LIMIT, appendHistoryEntry } from "./history.js";

describe("DEFAULT_GROUP_HISTORY_LIMIT", () => {
  it("is 10 to prevent context overflow in busy channels", () => {
    expect(DEFAULT_GROUP_HISTORY_LIMIT).toBe(10);
  });

  it("trims accumulated history to the default limit", () => {
    const historyMap = new Map<string, { sender: string; body: string }[]>();
    const historyKey = "test-channel";

    for (let i = 1; i <= 15; i++) {
      appendHistoryEntry({
        historyMap,
        historyKey,
        entry: { sender: "User", body: `message ${i}` },
        limit: DEFAULT_GROUP_HISTORY_LIMIT,
      });
    }

    const entries = historyMap.get(historyKey) ?? [];
    expect(entries.length).toBe(DEFAULT_GROUP_HISTORY_LIMIT);
    // The last N messages should be retained, not the first N
    expect(entries[0]?.body).toBe(`message ${15 - DEFAULT_GROUP_HISTORY_LIMIT + 1}`);
    expect(entries[entries.length - 1]?.body).toBe("message 15");
  });
});

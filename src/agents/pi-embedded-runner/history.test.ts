import { describe, it, expect } from "vitest";
import { getHistoryLimitForContext, limitHistoryTurns, type HistoryOptions } from "./history.js";

// Simplified message type for testing - limitHistoryTurns only checks role
type TestMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

describe("getHistoryLimitForContext", () => {
  describe("with explicit options", () => {
    it("returns explicit history limit when provided", () => {
      const options: HistoryOptions = { historyLimit: 10 };
      const result = getHistoryLimitForContext(undefined, undefined, options);

      expect(result.turnLimit).toBe(10);
      expect(result.tokenLimit).toBeUndefined();
    });

    it("returns explicit token limit when provided", () => {
      const options: HistoryOptions = { maxHistoryTokens: 16000 };
      const result = getHistoryLimitForContext(undefined, undefined, options);

      expect(result.tokenLimit).toBe(16000);
      expect(result.turnLimit).toBeUndefined();
    });

    it("returns both limits when both provided", () => {
      const options: HistoryOptions = { historyLimit: 12, maxHistoryTokens: 18000 };
      const result = getHistoryLimitForContext(undefined, undefined, options);

      expect(result.turnLimit).toBe(12);
      expect(result.tokenLimit).toBe(18000);
    });

    it("explicit options override config lookup", () => {
      const config = {
        channels: {
          telegram: { dmHistoryLimit: 20 },
        },
      };
      const options: HistoryOptions = { historyLimit: 5 };

      const result = getHistoryLimitForContext("telegram:dm:123", config, options);

      expect(result.turnLimit).toBe(5);
    });
  });

  describe("with config lookup", () => {
    it("returns dm history limit from config", () => {
      const config = {
        channels: {
          telegram: { dmHistoryLimit: 15 },
        },
      };

      const result = getHistoryLimitForContext("telegram:dm:123", config);

      expect(result.turnLimit).toBe(15);
      expect(result.tokenLimit).toBeUndefined();
    });

    it("returns undefined for non-dm session keys", () => {
      const config = {
        channels: {
          telegram: { dmHistoryLimit: 15 },
        },
      };

      const result = getHistoryLimitForContext("telegram:channel:123", config);

      expect(result.turnLimit).toBeUndefined();
    });

    it("returns undefined when no config provided", () => {
      const result = getHistoryLimitForContext("telegram:dm:123", undefined);

      expect(result.turnLimit).toBeUndefined();
      expect(result.tokenLimit).toBeUndefined();
    });
  });

  describe("voice call scenarios", () => {
    it("supports voice call pattern with explicit limits", () => {
      const options: HistoryOptions = {
        historyLimit: 12,
        maxHistoryTokens: 16000,
      };

      const result = getHistoryLimitForContext("voice:call:abc123", undefined, options);

      expect(result.turnLimit).toBe(12);
      expect(result.tokenLimit).toBe(16000);
    });

    it("returns no limits for voice without explicit options", () => {
      const result = getHistoryLimitForContext("voice:call:abc123", undefined);

      expect(result.turnLimit).toBeUndefined();
      expect(result.tokenLimit).toBeUndefined();
    });
  });
});

describe("limitHistoryTurns", () => {
  const createMessages = (count: number): TestMessage[] => {
    const messages: TestMessage[] = [];
    for (let i = 0; i < count; i++) {
      messages.push(
        { role: "user", content: `user message ${i}` },
        { role: "assistant", content: `assistant response ${i}` },
      );
    }
    return messages;
  };

  it("returns all messages when limit is undefined", () => {
    const messages = createMessages(5);
    // Cast to any for test compatibility - limitHistoryTurns only checks role
    const result = limitHistoryTurns(messages as never[], undefined);

    expect(result).toBe(messages);
    expect(result.length).toBe(10);
  });

  it("returns all messages when limit is 0", () => {
    const messages = createMessages(5);
    const result = limitHistoryTurns(messages as never[], 0);

    expect(result).toBe(messages);
  });

  it("limits to last N user turns", () => {
    const messages = createMessages(5);
    const result = limitHistoryTurns(messages as never[], 2);

    // Should have last 2 user turns with their responses
    expect(result.length).toBeLessThanOrEqual(4);
    expect(result[0].role).toBe("user");
  });

  it("handles empty messages array", () => {
    const result = limitHistoryTurns([], 5);

    expect(result).toEqual([]);
  });

  it("returns all messages when count is below limit", () => {
    const messages = createMessages(2);
    const result = limitHistoryTurns(messages as never[], 5);

    expect(result).toBe(messages);
    expect(result.length).toBe(4);
  });
});

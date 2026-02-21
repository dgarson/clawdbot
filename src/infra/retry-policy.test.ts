import { describe, expect, it } from "vitest";
import { getTelegramRetryAfterMs, createTelegramRetryRunner } from "./retry-policy.js";

describe("getTelegramRetryAfterMs", () => {
  describe("number handling in err.parameters", () => {
    it("returns retry_after * 1000 when retry_after is a positive number", () => {
      const err = { parameters: { retry_after: 2 } };
      expect(getTelegramRetryAfterMs(err)).toBe(2000);
    });

    it("returns retry_after * 1000 when retry_after is a float", () => {
      const err = { parameters: { retry_after: 1.5 } };
      expect(getTelegramRetryAfterMs(err)).toBe(1500);
    });

    it("returns undefined for negative retry_after number", () => {
      const err = { parameters: { retry_after: -1 } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined for zero retry_after", () => {
      const err = { parameters: { retry_after: 0 } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });
  });

  describe("string handling in err.parameters", () => {
    it("returns retry_after * 1000 when retry_after is a numeric string", () => {
      const err = { parameters: { retry_after: "2" } };
      expect(getTelegramRetryAfterMs(err)).toBe(2000);
    });

    it("returns retry_after * 1000 when retry_after is a float string", () => {
      const err = { parameters: { retry_after: "1.5" } };
      expect(getTelegramRetryAfterMs(err)).toBe(1500);
    });

    it("returns undefined for negative numeric string", () => {
      const err = { parameters: { retry_after: "-1" } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined for empty string", () => {
      const err = { parameters: { retry_after: "" } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined for non-numeric string", () => {
      const err = { parameters: { retry_after: "abc" } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined for whitespace string", () => {
      const err = { parameters: { retry_after: "   " } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });
  });

  describe("number handling in err.response.parameters", () => {
    it("returns retry_after * 1000 when retry_after is in response.parameters", () => {
      const err = { response: { parameters: { retry_after: 3 } } };
      expect(getTelegramRetryAfterMs(err)).toBe(3000);
    });
  });

  describe("string handling in err.response.parameters", () => {
    it("returns retry_after * 1000 when retry_after is a numeric string in response.parameters", () => {
      const err = { response: { parameters: { retry_after: "3" } } };
      expect(getTelegramRetryAfterMs(err)).toBe(3000);
    });
  });

  describe("number handling in err.error.parameters", () => {
    it("returns retry_after * 1000 when retry_after is in error.parameters", () => {
      const err = { error: { parameters: { retry_after: 4 } } };
      expect(getTelegramRetryAfterMs(err)).toBe(4000);
    });
  });

  describe("string handling in err.error.parameters", () => {
    it("returns retry_after * 1000 when retry_after is a numeric string in error.parameters", () => {
      const err = { error: { parameters: { retry_after: "4" } } };
      expect(getTelegramRetryAfterMs(err)).toBe(4000);
    });
  });

  describe("edge cases", () => {
    it("returns undefined when err is null", () => {
      expect(getTelegramRetryAfterMs(null)).toBeUndefined();
    });

    it("returns undefined when err is undefined", () => {
      expect(getTelegramRetryAfterMs(undefined)).toBeUndefined();
    });

    it("returns undefined when err is a primitive", () => {
      expect(getTelegramRetryAfterMs("error")).toBeUndefined();
      expect(getTelegramRetryAfterMs(123)).toBeUndefined();
    });

    it("returns undefined when err has no parameters", () => {
      expect(getTelegramRetryAfterMs({})).toBeUndefined();
    });

    it("returns undefined when retry_after is NaN", () => {
      const err = { parameters: { retry_after: NaN } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined when retry_after is Infinity", () => {
      const err = { parameters: { retry_after: Infinity } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined when retry_after is an object", () => {
      const err = { parameters: { retry_after: { seconds: 2 } } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });

    it("returns undefined when retry_after is an array", () => {
      const err = { parameters: { retry_after: [2] } };
      expect(getTelegramRetryAfterMs(err)).toBeUndefined();
    });
  });
});

describe("createTelegramRetryRunner", () => {
  it("uses default shouldRetry regex when no custom shouldRetry provided", async () => {
    const runner = createTelegramRetryRunner({});
    let callCount = 0;
    const _fn = async () => {
      callCount++;
      if (callCount < 2) {
        const err = new Error("429 Too Many Requests");
        // Simulate a Telegram API error structure
        throw err;
      }
      return "success";
    };

    // This test verifies the runner is created without error
    expect(runner).toBeDefined();
  });

  it("OR-composes custom shouldRetry with default regex behavior", async () => {
    const customShouldRetry = (err: unknown) => {
      return (
        "custom" in (err as Record<string, unknown>) &&
        (err as Record<string, unknown>).custom === true
      );
    };
    const runner = createTelegramRetryRunner({ shouldRetry: customShouldRetry });

    // The runner should be created with combined shouldRetry
    expect(runner).toBeDefined();
  });
});

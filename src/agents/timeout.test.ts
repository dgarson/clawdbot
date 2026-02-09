import { describe, expect, it } from "vitest";
import { resolveAgentTimeoutMs } from "./timeout.js";

describe("resolveAgentTimeoutMs", () => {
  it("uses a timer-safe sentinel for no-timeout overrides", () => {
    expect(resolveAgentTimeoutMs({ overrideSeconds: 0 })).toBe(2_147_000_000);
    expect(resolveAgentTimeoutMs({ overrideMs: 0 })).toBe(2_147_000_000);
  });

  it("falls back to the configured default for negative overrides", () => {
    const cfg = {
      agents: {
        defaults: {
          timeoutSeconds: 42,
        },
      },
    } as const;
    expect(resolveAgentTimeoutMs({ cfg, overrideSeconds: -1 })).toBe(42_000);
    expect(resolveAgentTimeoutMs({ cfg, overrideMs: -1 })).toBe(42_000);
  });

  it("clamps very large timeout overrides to timer-safe values", () => {
    expect(resolveAgentTimeoutMs({ overrideSeconds: 9_999_999 })).toBe(2_147_000_000);
    expect(resolveAgentTimeoutMs({ overrideMs: 9_999_999_999 })).toBe(2_147_000_000);
  });
});

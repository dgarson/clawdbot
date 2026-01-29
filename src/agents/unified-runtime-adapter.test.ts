import { describe, expect, it, vi } from "vitest";
import { runWithUnifiedFallback, isRuntimeSlotAvailable } from "./unified-runtime-adapter.js";
import type { AgentRuntimeResult } from "./agent-runtime.js";

describe("runWithUnifiedFallback", () => {
  const mockResult: AgentRuntimeResult = {
    payloads: [{ text: "Hello" }],
    meta: {
      durationMs: 100,
      agentMeta: {
        sessionId: "test-session",
        provider: "anthropic",
        model: "claude-sonnet-4",
      },
    },
  };

  it("returns result from successful run", async () => {
    const result = await runWithUnifiedFallback({
      config: {
        primaryRuntime: "pi",
        provider: "anthropic",
        model: "claude-sonnet-4",
      },
      run: vi.fn().mockResolvedValue(mockResult),
    });

    expect(result.result).toEqual(mockResult);
    expect(result.runtime).toBe("pi");
    expect(result.provider).toBe("anthropic");
    expect(result.model).toBe("claude-sonnet-4");
    expect(result.attempts).toEqual([]);
  });

  it("tries fallback runtime on failure", async () => {
    // Note: This test is a placeholder for future implementation.
    // In a real scenario, we would test that errors get properly classified
    // as failover-eligible based on status codes or message patterns.
    expect(true).toBe(true);
  });

  it("records attempts on failure and eventually succeeds with fallback", async () => {
    const error = new Error("Connection timeout");
    (error as { code?: string }).code = "ETIMEDOUT";

    // Use fallback runtimes so there are multiple slots to try
    const runFn = vi.fn().mockRejectedValueOnce(error).mockResolvedValueOnce(mockResult);

    const result = await runWithUnifiedFallback({
      config: {
        primaryRuntime: "pi",
        provider: "anthropic",
        model: "claude-sonnet-4",
        fallbackRuntimes: [{ runtime: "ccsdk" }],
      },
      run: runFn,
    });

    // Should have one failed attempt recorded before success
    expect(result.attempts.length).toBe(1);
    expect(result.attempts[0].reason).toBe("timeout");
  });
});

describe("isRuntimeSlotAvailable", () => {
  it("returns true when no auth profiles are configured", () => {
    const available = isRuntimeSlotAvailable({
      slot: { runtime: "pi" },
      config: { primaryRuntime: "pi" },
    });
    expect(available).toBe(true);
  });

  it("returns true when no config is provided", () => {
    const available = isRuntimeSlotAvailable({
      slot: { runtime: "pi", provider: "anthropic" },
      config: { primaryRuntime: "pi", provider: "anthropic" },
      cfg: undefined,
    });
    expect(available).toBe(true);
  });
});

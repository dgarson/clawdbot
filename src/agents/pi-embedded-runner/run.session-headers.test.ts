import type { Api, Model } from "@mariozechner/pi-ai";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the StreamFn type from pi-agent-core
type MockStreamFn = (
  model: Model<Api>,
  context: unknown,
  options?: { headers?: Record<string, string> },
) => Promise<unknown>;

// Helper to create headers object conditionally
function buildSessionHeaders(
  sessionKey: string | undefined,
  agentId: string | undefined,
  existingHeaders: Record<string, string> = {},
): { headers?: Record<string, string> } {
  const headers: Record<string, string> = { ...existingHeaders };
  let hasNewHeaders = Object.keys(existingHeaders).length > 0;
  if (sessionKey) {
    headers["X-OpenClaw-Session-Id"] = sessionKey;
    hasNewHeaders = true;
  }
  if (agentId) {
    headers["X-OpenClaw-Agent-Id"] = agentId;
    hasNewHeaders = true;
  }
  return hasNewHeaders ? { headers } : {};
}

describe("session header injection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should inject X-OpenClaw-Session-Id header when sessionKey is provided", async () => {
    const sessionKey = "test-session-key-123";
    const agentId = "test-agent-id";

    // Simulate the wrapper behavior from attempt.ts
    const inner: MockStreamFn = vi.fn((model, context, options) => {
      // Verify headers are injected
      expect(options?.headers?.["X-OpenClaw-Session-Id"]).toBe(sessionKey);
      expect(options?.headers?.["X-OpenClaw-Agent-Id"]).toBe(agentId);
      return Promise.resolve();
    });

    const wrappedStreamFn = (
      model: Model<Api>,
      context: unknown,
      options?: { headers?: Record<string, string> },
    ) => {
      const newHeaders = buildSessionHeaders(sessionKey, agentId, options?.headers);
      return inner(model, context, { ...options, ...newHeaders });
    };

    // Call the wrapped function
    await wrappedStreamFn({} as Model<Api>, {}, {});

    // Verify inner was called
    expect(inner).toHaveBeenCalled();
  });

  it("should not inject headers when sessionKey and agentId are undefined", async () => {
    const sessionKey: string | undefined = undefined;
    const agentId: string | undefined = undefined;

    const inner: MockStreamFn = vi.fn();

    // This simulates the condition in attempt.ts:
    // if (params.sessionKey || params.agentId) { ... }
    // When both are undefined, no wrapper should be applied

    const hasSessionOrAgent = sessionKey || agentId;
    let streamFn: MockStreamFn;

    if (hasSessionOrAgent) {
      streamFn = (model, context, options) => {
        const newHeaders = buildSessionHeaders(sessionKey, agentId, options?.headers);
        return inner(model, context, { ...options, ...newHeaders });
      };
    } else {
      streamFn = inner;
    }

    await streamFn({} as Model<Api>, {}, { headers: {} });

    // Inner should be called with original options (no injected headers)
    expect(inner).toHaveBeenCalledWith({} as Model<Api>, {}, { headers: {} });
  });

  it("should preserve existing headers when injecting session headers", async () => {
    const sessionKey = "test-session-key";
    const agentId = "test-agent";

    const existingHeaders = {
      "Custom-Header": "custom-value",
      "Another-Header": "another-value",
    };

    const inner: MockStreamFn = vi.fn((model, context, options) => {
      // Verify existing headers are preserved
      expect(options?.headers?.["Custom-Header"]).toBe("custom-value");
      expect(options?.headers?.["Another-Header"]).toBe("another-value");
      // Verify new headers are injected
      expect(options?.headers?.["X-OpenClaw-Session-Id"]).toBe(sessionKey);
      expect(options?.headers?.["X-OpenClaw-Agent-Id"]).toBe(agentId);
      return Promise.resolve();
    });

    const wrappedStreamFn = (
      model: Model<Api>,
      context: unknown,
      options?: { headers?: Record<string, string> },
    ) => {
      const newHeaders = buildSessionHeaders(sessionKey, agentId, options?.headers);
      return inner(model, context, { ...options, ...newHeaders });
    };

    await wrappedStreamFn({} as Model<Api>, {}, { headers: existingHeaders });

    expect(inner).toHaveBeenCalled();
  });

  it("should use sessionId as fallback when sessionKey is not provided", async () => {
    const sessionId = "fallback-session-id";
    const sessionKey = undefined;
    const agentId = "test-agent";

    const inner: MockStreamFn = vi.fn((model, context, options) => {
      // Should use sessionId as fallback
      expect(options?.headers?.["X-OpenClaw-Session-Id"]).toBe(sessionId);
      expect(options?.headers?.["X-OpenClaw-Agent-Id"]).toBe(agentId);
      return Promise.resolve();
    });

    // Simulates the logic: params.sessionKey ?? params.sessionId
    const effectiveSessionKey = sessionKey ?? sessionId;

    const wrappedStreamFn = (
      model: Model<Api>,
      context: unknown,
      options?: { headers?: Record<string, string> },
    ) => {
      const newHeaders = buildSessionHeaders(effectiveSessionKey, agentId, options?.headers);
      return inner(model, context, { ...options, ...newHeaders });
    };

    await wrappedStreamFn({} as Model<Api>, {}, {});

    expect(inner).toHaveBeenCalled();
  });
});

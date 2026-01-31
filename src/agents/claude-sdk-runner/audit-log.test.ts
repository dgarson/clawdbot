/**
 * Tests for SDK session audit logging.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import { appendSdkSessionAuditLog } from "./audit-log.js";

// Mock fs and SessionManager
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: vi.fn(),
      promises: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        writeFile: vi.fn().mockResolvedValue(undefined),
      },
    },
    existsSync: vi.fn(),
    promises: {
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    },
  };
});

const mockAppendMessage = vi.fn();
vi.mock("@mariozechner/pi-coding-agent", () => ({
  CURRENT_SESSION_VERSION: 1,
  SessionManager: {
    open: vi.fn(() => ({
      appendMessage: mockAppendMessage,
    })),
  },
}));

describe("appendSdkSessionAuditLog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: file doesn't exist
    vi.mocked(fs.existsSync).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when sessionFile is empty", async () => {
    await appendSdkSessionAuditLog({
      sessionFile: "",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi there"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(mockAppendMessage).not.toHaveBeenCalled();
  });

  it("does nothing when prompt is empty", async () => {
    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "",
      assistantTexts: ["Hi there"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(mockAppendMessage).not.toHaveBeenCalled();
  });

  it("creates session directory and header when file does not exist", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/sessions/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi there"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(fs.promises.mkdir).toHaveBeenCalledWith("/tmp/sessions", { recursive: true });
    expect(fs.promises.writeFile).toHaveBeenCalledWith(
      "/tmp/sessions/session.jsonl",
      expect.stringContaining('"type":"session"'),
      "utf-8",
    );
  });

  it("skips header creation when file already exists", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/sessions/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi there"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(fs.promises.mkdir).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  it("appends user message with prompt content", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "What is 2+2?",
      assistantTexts: ["4"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        content: [{ type: "text", text: "What is 2+2?" }],
      }),
    );
  });

  it("appends assistant message with combined texts", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["First response", "Second response"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: [{ type: "text", text: "First response\n\nSecond response" }],
        api: "claude-sdk",
        provider: "anthropic",
        model: "claude-3-opus-20240229",
      }),
    );
  });

  it("skips assistant message when no text content", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: [],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    // Should only append user message, not assistant
    expect(mockAppendMessage).toHaveBeenCalledTimes(1);
    expect(mockAppendMessage).toHaveBeenCalledWith(expect.objectContaining({ role: "user" }));
  });

  it("includes usage information when provided", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
      usage: {
        input: 100,
        output: 50,
        cacheRead: 10,
        cacheWrite: 5,
        total: 165,
      },
    });

    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        usage: expect.objectContaining({
          input: 100,
          output: 50,
          cacheRead: 10,
          cacheWrite: 5,
          totalTokens: 165,
        }),
      }),
    );
  });

  it("uses default zero values for missing usage fields", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
      usage: {}, // Empty usage object
    });

    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        usage: expect.objectContaining({
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
        }),
      }),
    );
  });

  it("handles errors gracefully without throwing", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    // Use mockImplementationOnce to avoid affecting subsequent tests
    mockAppendMessage.mockImplementationOnce(() => {
      throw new Error("Write failed");
    });

    // Should not throw
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      appendSdkSessionAuditLog({
        sessionFile: "/tmp/session.jsonl",
        sessionId: "session-1",
        prompt: "Hello",
        assistantTexts: ["Hi"],
        model: "claude-3-opus-20240229",
        provider: "anthropic",
      }),
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      "[claude-sdk-runner] audit log error:",
      expect.any(Error),
    );

    consoleSpy.mockRestore();
  });

  it("trims whitespace from combined assistant texts", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.clearAllMocks();

    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["  spaced  ", "  text  "],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });

    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        content: [{ type: "text", text: "spaced  \n\n  text" }],
      }),
    );
  });

  it("includes timestamp in messages", async () => {
    vi.mocked(fs.existsSync).mockReturnValue(true);
    vi.clearAllMocks();

    const beforeTime = Date.now();
    await appendSdkSessionAuditLog({
      sessionFile: "/tmp/session.jsonl",
      sessionId: "session-1",
      prompt: "Hello",
      assistantTexts: ["Hi"],
      model: "claude-3-opus-20240229",
      provider: "anthropic",
    });
    const afterTime = Date.now();

    // Both messages should have timestamps
    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "user",
        timestamp: expect.any(Number),
      }),
    );
    expect(mockAppendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "assistant",
        timestamp: expect.any(Number),
      }),
    );

    // Verify timestamps are reasonable
    const calls = mockAppendMessage.mock.calls;
    for (const call of calls) {
      const msg = call[0] as { timestamp: number };
      expect(msg.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(msg.timestamp).toBeLessThanOrEqual(afterTime);
    }
  });
});

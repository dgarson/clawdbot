import { describe, expect, it } from "vitest";
import { createPiSessionAdapter, PiSessionAdapter } from "./pi-session-adapter.js";

describe("PiSessionAdapter", () => {
  const sessionFile = "/tmp/test-session.jsonl";

  it("creates an adapter with format 'pi-agent'", () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    expect(adapter.format).toBe("pi-agent");
  });

  it("returns the session file path", () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    expect(adapter.sessionFile).toBe(sessionFile);
  });

  it("returns metadata with session ID", () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
      cwd: "/home/test",
    });
    const metadata = adapter.getMetadata();
    expect(metadata.sessionId).toBe("test-session-123");
    expect(metadata.cwd).toBe("/home/test");
    expect(metadata.runtime).toBe("pi-agent");
  });

  it("returns empty history when no session manager is set", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    const history = await adapter.loadHistory();
    expect(history).toEqual([]);
  });

  it("appends user message and returns message ID", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    const messageId = await adapter.appendUserMessage("Hello, world!");
    expect(messageId).toMatch(/^pi-\d+-[a-z0-9]+$/);
  });

  it("appends assistant message and returns message ID", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    const messageId = await adapter.appendAssistantMessage([{ type: "text", text: "Hello!" }]);
    expect(messageId).toMatch(/^pi-\d+-[a-z0-9]+$/);
  });

  it("appends tool result and returns message ID", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    const messageId = await adapter.appendToolResult("tool-123", {
      type: "tool_result",
      toolCallId: "tool-123",
      content: [{ type: "text", text: "Result" }],
    });
    expect(messageId).toMatch(/^pi-\d+-[a-z0-9]+$/);
  });

  it("flush is a no-op without session manager", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    // Should not throw
    await adapter.flush();
  });

  it("close clears internal state", async () => {
    const adapter = createPiSessionAdapter(sessionFile, {
      sessionId: "test-session-123",
    });
    await adapter.appendUserMessage("test");
    await adapter.close();
    // After close, history should be empty (no session manager)
    const history = await adapter.loadHistory();
    expect(history).toEqual([]);
  });
});

describe("createPiSessionAdapter", () => {
  it("returns a PiSessionAdapter instance", () => {
    const adapter = createPiSessionAdapter("/tmp/test.jsonl", {
      sessionId: "test-123",
    });
    expect(adapter).toBeInstanceOf(PiSessionAdapter);
  });
});

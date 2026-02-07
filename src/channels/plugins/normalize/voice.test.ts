import { describe, it, expect } from "vitest";
import {
  normalizeVoiceInput,
  extractVoiceMetadata,
  isVoiceCallContext,
  type VoiceInputParams,
} from "./voice.js";

describe("normalizeVoiceInput", () => {
  const baseParams: VoiceInputParams = {
    callId: "call-123",
    from: "+15551234567",
    transcript: "Hello, can you help me?",
  };

  it("creates MsgContext with correct text fields", () => {
    const ctx = normalizeVoiceInput(baseParams);

    expect(ctx.Body).toBe("Hello, can you help me?");
    expect(ctx.BodyForAgent).toBe("Hello, can you help me?");
    expect(ctx.RawBody).toBe("Hello, can you help me?");
    expect(ctx.CommandBody).toBe("Hello, can you help me?");
    expect(ctx.BodyForCommands).toBe("Hello, can you help me?");
  });

  it("sets sender identity from phone number", () => {
    const ctx = normalizeVoiceInput(baseParams);

    expect(ctx.From).toBe("+15551234567");
    expect(ctx.SenderId).toBe("+15551234567");
    expect(ctx.SenderE164).toBe("+15551234567");
    expect(ctx.SenderName).toBe("+15551234567");
  });

  it("uses caller name when provided", () => {
    const ctx = normalizeVoiceInput({
      ...baseParams,
      callerName: "John Doe",
    });

    expect(ctx.SenderName).toBe("John Doe");
    expect(ctx.SenderId).toBe("+15551234567");
  });

  it("creates correct session key", () => {
    const ctx = normalizeVoiceInput(baseParams);

    expect(ctx.SessionKey).toBe("voice:call:call-123");
  });

  it("sets voice channel metadata", () => {
    const ctx = normalizeVoiceInput(baseParams);

    expect(ctx.Provider).toBe("voice");
    expect(ctx.ChatType).toBe("voice");
  });

  it("creates message ID from call ID and timestamp", () => {
    const timestamp = 1700000000000;
    const ctx = normalizeVoiceInput({
      ...baseParams,
      timestamp,
    });

    expect(ctx.MessageSid).toBe("call-123:1700000000000");
    expect(ctx.Timestamp).toBe(timestamp);
  });

  it("uses current time when timestamp not provided", () => {
    const before = Date.now();
    const ctx = normalizeVoiceInput(baseParams);
    const after = Date.now();

    expect(ctx.Timestamp).toBeGreaterThanOrEqual(before);
    expect(ctx.Timestamp).toBeLessThanOrEqual(after);
  });

  it("includes voice metadata in UntrustedContext", () => {
    const ctx = normalizeVoiceInput(baseParams);

    expect(ctx.UntrustedContext).toBeDefined();
    expect(ctx.UntrustedContext?.length).toBe(1);
    expect(ctx.UntrustedContext?.[0]).toContain("[voice-metadata]:");
    expect(ctx.UntrustedContext?.[0]).toContain("call-123");
  });

  it("includes agent ID override in metadata when provided", () => {
    const ctx = normalizeVoiceInput({
      ...baseParams,
      agentId: "custom-agent",
    });

    expect(ctx.UntrustedContext?.[0]).toContain("agentIdOverride");
    expect(ctx.UntrustedContext?.[0]).toContain("custom-agent");
  });
});

describe("extractVoiceMetadata", () => {
  it("extracts metadata from voice context", () => {
    const ctx = normalizeVoiceInput({
      callId: "call-456",
      from: "+15559876543",
      transcript: "Test",
      agentId: "agent-1",
    });

    const metadata = extractVoiceMetadata(ctx);

    expect(metadata).not.toBeNull();
    expect(metadata?.isVoiceCall).toBe(true);
    expect(metadata?.callId).toBe("call-456");
    expect(metadata?.agentIdOverride).toBe("agent-1");
  });

  it("returns null for non-voice context", () => {
    const ctx = {
      Body: "Hello",
      Provider: "telegram",
    };

    const metadata = extractVoiceMetadata(ctx);

    expect(metadata).toBeNull();
  });

  it("handles malformed metadata gracefully", () => {
    const ctx = {
      Body: "Hello",
      UntrustedContext: ["[voice-metadata]: not-valid-json"],
    };

    const metadata = extractVoiceMetadata(ctx);

    expect(metadata).toBeNull();
  });
});

describe("isVoiceCallContext", () => {
  it("returns true for voice provider", () => {
    const ctx = { Provider: "voice", Body: "Hello" };

    expect(isVoiceCallContext(ctx)).toBe(true);
  });

  it("returns true for context with voice metadata", () => {
    const ctx = normalizeVoiceInput({
      callId: "call-123",
      from: "+15551234567",
      transcript: "Hello",
    });

    expect(isVoiceCallContext(ctx)).toBe(true);
  });

  it("returns false for non-voice context", () => {
    const ctx = { Provider: "telegram", Body: "Hello" };

    expect(isVoiceCallContext(ctx)).toBe(false);
  });
});

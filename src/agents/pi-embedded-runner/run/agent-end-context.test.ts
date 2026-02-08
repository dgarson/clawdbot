import { describe, expect, it } from "vitest";
import { resolveAgentEndHookMetadata } from "./agent-end-context.js";

describe("resolveAgentEndHookMetadata", () => {
  it("resolves Slack DM metadata from current channel/thread context", () => {
    const metadata = resolveAgentEndHookMetadata({
      messageProvider: "slack",
      messageTo: "user:U123",
      currentChannelId: "D123456",
      currentThreadTs: "1738901234.567800",
    });

    expect(metadata.channelType).toBe("dm");
    expect(metadata.channelId).toBe("D123456");
    expect(metadata.threadTs).toBe("1738901234.567800");
  });

  it("resolves group metadata from explicit group hints", () => {
    const metadata = resolveAgentEndHookMetadata({
      messageProvider: "telegram",
      messageTo: "-10012345678",
      groupId: "10012345678",
    });

    expect(metadata.channelType).toBe("group");
    expect(metadata.channelId).toBe("-10012345678");
    expect(metadata.threadTs).toBeUndefined();
  });

  it("resolves channel route targets and treats them as group context", () => {
    const metadata = resolveAgentEndHookMetadata({
      messageProvider: "discord",
      messageTo: "channel:1234567890",
    });

    expect(metadata.channelType).toBe("group");
    expect(metadata.channelId).toBe("1234567890");
    expect(metadata.threadTs).toBeUndefined();
  });

  it("falls back to Slack messageThreadId when currentThreadTs is absent", () => {
    const metadata = resolveAgentEndHookMetadata({
      messageProvider: "slack",
      messageTo: "channel:C123456",
      messageThreadId: "1738901234.123456",
    });

    expect(metadata.channelType).toBe("group");
    expect(metadata.channelId).toBe("C123456");
    expect(metadata.threadTs).toBe("1738901234.123456");
  });

  it("returns undefined channelType when no routing hints exist", () => {
    const metadata = resolveAgentEndHookMetadata({
      messageProvider: "telegram",
    });

    expect(metadata.channelType).toBeUndefined();
    expect(metadata.channelId).toBeUndefined();
    expect(metadata.threadTs).toBeUndefined();
  });
});

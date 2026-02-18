import { describe, it, expect } from "vitest";
import { extractSlackChannelId } from "./exec-approvals.js";

describe("extractSlackChannelId", () => {
  it("extracts channel ID from a channel session key", () => {
    expect(extractSlackChannelId("agent:main:slack:channel:C1234567890")).toBe("C1234567890");
  });

  it("extracts channel ID from a group session key", () => {
    expect(extractSlackChannelId("agent:main:slack:group:G0987654321")).toBe("G0987654321");
  });

  it("returns null for a DM session key (no channel: or group: prefix)", () => {
    expect(extractSlackChannelId("agent:main:slack:D1234567890")).toBeNull();
  });

  it("returns null for a Discord session key", () => {
    expect(extractSlackChannelId("agent:main:discord:channel:123456789")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractSlackChannelId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractSlackChannelId(undefined)).toBeNull();
  });
});

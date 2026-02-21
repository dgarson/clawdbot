import { describe, expect, it } from "vitest";
import { normalizeSlackMessagingTarget } from "../channels/plugins/normalize/slack.js";
import { parseSlackTarget, resolveSlackChannelId } from "./targets.js";

describe("parseSlackTarget", () => {
  it("parses user mentions and prefixes", () => {
    expect(parseSlackTarget("<@U123>")).toMatchObject({
      kind: "user",
      id: "U123",
      normalized: "user:u123",
    });
    expect(parseSlackTarget("user:U456")).toMatchObject({
      kind: "user",
      id: "U456",
      normalized: "user:u456",
    });
    expect(parseSlackTarget("slack:U789")).toMatchObject({
      kind: "user",
      id: "U789",
      normalized: "user:u789",
    });
  });

  it("parses channel targets", () => {
    expect(parseSlackTarget("channel:C123")).toMatchObject({
      kind: "channel",
      id: "C123",
      normalized: "channel:c123",
    });
    expect(parseSlackTarget("#C999")).toMatchObject({
      kind: "channel",
      id: "C999",
      normalized: "channel:c999",
    });
  });

  it("uppercases lowercase channel IDs in # targets", () => {
    expect(parseSlackTarget("#c999")).toMatchObject({
      kind: "channel",
      id: "C999",
    });
    expect(parseSlackTarget("#c1a2b3")).toMatchObject({
      kind: "channel",
      id: "C1A2B3",
    });
  });

  it("parses #-prefixed channel names as channel targets for async lookup", () => {
    expect(parseSlackTarget("#general")).toMatchObject({
      kind: "channel",
      id: "general",
    });
    expect(parseSlackTarget("#general-1")).toMatchObject({
      kind: "channel",
      id: "general-1",
    });
    expect(parseSlackTarget("#eng-frontend")).toMatchObject({
      kind: "channel",
      id: "eng-frontend",
    });
  });

  it("rejects invalid @ targets", () => {
    expect(() => parseSlackTarget("@bob-1")).toThrow(/Slack DMs require a user id/);
  });
});

describe("resolveSlackChannelId", () => {
  it("strips channel: prefix and accepts raw ids", () => {
    expect(resolveSlackChannelId("channel:C123")).toBe("C123");
    expect(resolveSlackChannelId("C123")).toBe("C123");
  });

  it("uppercases lowercase channel IDs", () => {
    expect(resolveSlackChannelId("c123")).toBe("C123");
    expect(resolveSlackChannelId("channel:c1a2b3")).toBe("C1A2B3");
    expect(resolveSlackChannelId("#c999")).toBe("C999");
  });

  it("rejects user targets", () => {
    expect(() => resolveSlackChannelId("user:U123")).toThrow(/channel id is required/i);
  });
});

describe("normalizeSlackMessagingTarget", () => {
  it("defaults raw ids to channels", () => {
    expect(normalizeSlackMessagingTarget("C123")).toBe("channel:c123");
  });
});

import { describe, it, expect } from "vitest";
import {
  isDebuggingEnabled,
  isFeatureEnabled,
  isChannelPropertyEnabled,
  type DebuggingConfig,
} from "./types.debugging.js";

describe("isDebuggingEnabled", () => {
  it("returns false for undefined config", () => {
    expect(isDebuggingEnabled(undefined, "slack")).toBe(false);
  });

  it("returns false when channels is undefined", () => {
    expect(isDebuggingEnabled({}, "slack")).toBe(false);
  });

  it("returns false when channel is not present", () => {
    expect(isDebuggingEnabled({ channels: {} }, "slack")).toBe(false);
  });

  it("returns true when channel key exists (even with empty object)", () => {
    expect(isDebuggingEnabled({ channels: { slack: {} } }, "slack")).toBe(true);
  });
});

describe("isFeatureEnabled", () => {
  it("returns false for undefined config", () => {
    expect(isFeatureEnabled(undefined, "test")).toBe(false);
  });

  it("returns false when features is undefined", () => {
    expect(isFeatureEnabled({}, "test")).toBe(false);
  });

  it("returns false when feature is not in list", () => {
    expect(isFeatureEnabled({ features: ["other"] }, "test")).toBe(false);
  });

  it("returns true when feature is in list", () => {
    expect(isFeatureEnabled({ features: ["test"] }, "test")).toBe(true);
  });
});

describe("isChannelPropertyEnabled", () => {
  it("returns false for undefined config", () => {
    expect(isChannelPropertyEnabled(undefined, "workqueue", "verbose")).toBe(false);
  });

  it("returns false when channel is not present", () => {
    expect(isChannelPropertyEnabled({ channels: {} }, "workqueue", "verbose")).toBe(false);
  });

  it("returns false when channel exists but property is absent", () => {
    expect(isChannelPropertyEnabled({ channels: { workqueue: {} } }, "workqueue", "verbose")).toBe(
      false,
    );
  });

  it("returns false when property is false", () => {
    const cfg: DebuggingConfig = { channels: { workqueue: { verbose: false } } };
    expect(isChannelPropertyEnabled(cfg, "workqueue", "verbose")).toBe(false);
  });

  it("returns false when property is truthy but not exactly true", () => {
    const cfg: DebuggingConfig = { channels: { workqueue: { verbose: "yes" } } };
    expect(isChannelPropertyEnabled(cfg, "workqueue", "verbose")).toBe(false);
  });

  it("returns true when channel exists and property is true", () => {
    const cfg: DebuggingConfig = { channels: { workqueue: { verbose: true } } };
    expect(isChannelPropertyEnabled(cfg, "workqueue", "verbose")).toBe(true);
  });

  it("works for other channels and properties", () => {
    const cfg: DebuggingConfig = { channels: { slack: { sendDebug: true, sendTracing: false } } };
    expect(isChannelPropertyEnabled(cfg, "slack", "sendDebug")).toBe(true);
    expect(isChannelPropertyEnabled(cfg, "slack", "sendTracing")).toBe(false);
  });
});

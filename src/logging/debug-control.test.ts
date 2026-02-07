import { describe, it, expect, beforeEach, vi } from "vitest";
import type { OpenClawConfig } from "../config/types.js";
import {
  shouldLogDebug,
  shouldLogTrace,
  getDebugContext,
  type DebugContext,
} from "./debug-control.js";

describe("debug-control", () => {
  let mockConfig: OpenClawConfig;

  beforeEach(() => {
    // Reset globals
    vi.resetModules();

    // Base config
    mockConfig = {
      debugging: {
        channels: {},
        features: {},
      },
      logging: {
        suppressSubsystemDebugLogs: [],
      },
    } as OpenClawConfig;
  });

  describe("getDebugContext", () => {
    it("should extract channel, feature, and runId", () => {
      const meta = {
        channel: "slack",
        feature: "compaction-hooks",
        runId: "abc123",
        other: "data",
      };

      const ctx = getDebugContext(meta);

      expect(ctx.channel).toBe("slack");
      expect(ctx.feature).toBe("compaction-hooks");
      expect(ctx.runId).toBe("abc123");
    });

    it("should handle missing metadata", () => {
      const ctx = getDebugContext();
      expect(ctx).toEqual({});
    });

    it("should handle empty metadata", () => {
      const ctx = getDebugContext({});
      expect(ctx).toEqual({});
    });

    it("should ignore non-string values", () => {
      const meta = {
        channel: 123,
        feature: null,
        runId: undefined,
      };

      const ctx = getDebugContext(meta);

      expect(ctx.channel).toBeUndefined();
      expect(ctx.feature).toBeUndefined();
      expect(ctx.runId).toBeUndefined();
    });
  });

  describe("shouldLogDebug", () => {
    it("should allow debug when global verbose is enabled", () => {
      // Mock isVerbose() to return true
      vi.doMock("../globals.js", () => ({
        isVerbose: () => true,
      }));

      // Re-import module to get mocked version
      return import("./debug-control.js").then((mod) => {
        expect(mod.shouldLogDebug("any-subsystem", {}, mockConfig)).toBe(true);
      });
    });

    it("should deny debug when subsystem is suppressed", () => {
      mockConfig.logging!.suppressSubsystemDebugLogs = ["slack"];

      expect(shouldLogDebug("slack", {}, mockConfig)).toBe(false);
      expect(shouldLogDebug("slack/send", {}, mockConfig)).toBe(false);
    });

    it("should deny debug when subsystem matches wildcard suppression", () => {
      mockConfig.logging!.suppressSubsystemDebugLogs = ["slack/*"];

      expect(shouldLogDebug("slack/send", {}, mockConfig)).toBe(false);
      expect(shouldLogDebug("slack/receive", {}, mockConfig)).toBe(false);
      expect(shouldLogDebug("slack", {}, mockConfig)).toBe(false);
    });

    it("should allow debug when channel config has verbose=true", () => {
      mockConfig.debugging!.channels = {
        slack: { verbose: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogDebug("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should allow debug when channel config has debug=true", () => {
      mockConfig.debugging!.channels = {
        slack: { debug: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogDebug("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should deny debug when channel config only has trace=true", () => {
      mockConfig.debugging!.channels = {
        slack: { trace: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogDebug("any-subsystem", ctx, mockConfig)).toBe(false);
    });

    it("should allow debug when feature config has verbose=true", () => {
      mockConfig.debugging!.features = {
        "compaction-hooks": { verbose: true },
      };

      const ctx: DebugContext = { feature: "compaction-hooks" };
      expect(shouldLogDebug("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should allow debug when feature config has debug=true", () => {
      mockConfig.debugging!.features = {
        "compaction-hooks": { debug: true },
      };

      const ctx: DebugContext = { feature: "compaction-hooks" };
      expect(shouldLogDebug("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should support hierarchical subsystem matching in channels", () => {
      mockConfig.debugging!.channels = {
        slack: { verbose: true },
      };

      expect(shouldLogDebug("slack", {}, mockConfig)).toBe(true);
      expect(shouldLogDebug("slack/send", {}, mockConfig)).toBe(true);
      expect(shouldLogDebug("slack/send/message", {}, mockConfig)).toBe(true);
    });

    it("should support hierarchical subsystem matching in features", () => {
      mockConfig.debugging!.features = {
        memory: { verbose: true },
      };

      expect(shouldLogDebug("memory", {}, mockConfig)).toBe(true);
      expect(shouldLogDebug("memory/compaction", {}, mockConfig)).toBe(true);
      expect(shouldLogDebug("memory/compaction/scheduler", {}, mockConfig)).toBe(true);
    });

    it("should check most specific subsystem first", () => {
      mockConfig.debugging!.channels = {
        slack: { debug: true },
        "slack/send": { debug: false },
      };

      // More specific rule should take precedence
      expect(shouldLogDebug("slack/send", {}, mockConfig)).toBe(false);
      expect(shouldLogDebug("slack/receive", {}, mockConfig)).toBe(true);
    });

    it("should support custom backward-compatibility properties", () => {
      mockConfig.debugging!.channels = {
        slack: { sendDebug: true },
      };

      expect(shouldLogDebug("slack", {}, mockConfig)).toBe(true);
    });

    it("should deny debug by default when no rules match", () => {
      expect(shouldLogDebug("unknown-subsystem", {}, mockConfig)).toBe(false);
    });

    it("should respect priority order: suppression overrides channel config", () => {
      mockConfig.logging!.suppressSubsystemDebugLogs = ["slack"];
      mockConfig.debugging!.channels = {
        slack: { verbose: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogDebug("slack", ctx, mockConfig)).toBe(false);
    });
  });

  describe("shouldLogTrace", () => {
    it("should allow trace when global verbose is enabled", () => {
      vi.doMock("../globals.js", () => ({
        isVerbose: () => true,
      }));

      return import("./debug-control.js").then((mod) => {
        expect(mod.shouldLogTrace("any-subsystem", {}, mockConfig)).toBe(true);
      });
    });

    it("should deny trace when subsystem is suppressed", () => {
      mockConfig.logging!.suppressSubsystemDebugLogs = ["slack"];

      expect(shouldLogTrace("slack", {}, mockConfig)).toBe(false);
    });

    it("should allow trace when channel config has verbose=true", () => {
      mockConfig.debugging!.channels = {
        slack: { verbose: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogTrace("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should allow trace when channel config has trace=true", () => {
      mockConfig.debugging!.channels = {
        slack: { trace: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogTrace("any-subsystem", ctx, mockConfig)).toBe(true);
    });

    it("should deny trace when channel config only has debug=true", () => {
      mockConfig.debugging!.channels = {
        slack: { debug: true },
      };

      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogTrace("any-subsystem", ctx, mockConfig)).toBe(false);
    });

    it("should support custom backward-compatibility properties", () => {
      mockConfig.debugging!.channels = {
        slack: { sendTracing: true },
      };

      expect(shouldLogTrace("slack", {}, mockConfig)).toBe(true);
    });

    it("should support tracing property", () => {
      mockConfig.debugging!.channels = {
        slack: { tracing: true },
      };

      expect(shouldLogTrace("slack", {}, mockConfig)).toBe(true);
    });

    it("should deny trace by default when no rules match", () => {
      expect(shouldLogTrace("unknown-subsystem", {}, mockConfig)).toBe(false);
    });
  });

  describe("priority order", () => {
    it("should prioritize channel config over feature config", () => {
      mockConfig.debugging!.channels = {
        slack: { debug: true },
      };
      mockConfig.debugging!.features = {
        "compaction-hooks": { debug: false },
      };

      // Channel context should take priority
      const channelCtx: DebugContext = {
        channel: "slack",
        feature: "compaction-hooks",
      };
      expect(shouldLogDebug("any-subsystem", channelCtx, mockConfig)).toBe(true);

      // Feature context alone should be denied
      const featureCtx: DebugContext = {
        feature: "compaction-hooks",
      };
      expect(shouldLogDebug("any-subsystem", featureCtx, mockConfig)).toBe(false);
    });

    it("should prioritize context over subsystem hierarchy", () => {
      mockConfig.debugging!.channels = {
        slack: { debug: false },
      };

      // Context channel should be checked before subsystem hierarchy
      const ctx: DebugContext = { channel: "slack" };
      expect(shouldLogDebug("slack/send", ctx, mockConfig)).toBe(false);
    });
  });
});

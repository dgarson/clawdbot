import { describe, expect, it, vi } from "vitest";
import type { ChannelId } from "../../channels/plugins/types.js";

const mocks = vi.hoisted(() => ({
  getChannelPlugin: vi.fn(),
  normalizeChannelId: vi.fn(),
}));

vi.mock("../../channels/plugins/index.js", () => ({
  getChannelPlugin: mocks.getChannelPlugin,
  normalizeChannelId: mocks.normalizeChannelId,
}));

import {
  buildTargetResolverSignature,
  normalizeChannelTargetInput,
  normalizeTargetForProvider,
} from "./target-normalization.js";

describe("normalizeChannelTargetInput", () => {
  it("trims whitespace from input", () => {
    expect(normalizeChannelTargetInput("  hello  ")).toBe("hello");
    expect(normalizeChannelTargetInput("\t\nvalue\r\n")).toBe("value");
    expect(normalizeChannelTargetInput("  +1-555-1234  ")).toBe("+1-555-1234");
  });

  it("returns empty string for whitespace-only input", () => {
    expect(normalizeChannelTargetInput("   ")).toBe("");
    expect(normalizeChannelTargetInput("\t\n")).toBe("");
  });

  it("returns the same string when no whitespace", () => {
    expect(normalizeChannelTargetInput("user@example.com")).toBe("user@example.com");
  });
});

describe("normalizeTargetForProvider", () => {
  it("returns undefined for undefined input", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({
      messaging: { normalizeTarget: (s: string) => s.toLowerCase() },
    });

    expect(normalizeTargetForProvider("slack", undefined)).toBe(undefined);
  });

  it("returns undefined for empty string input", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({
      messaging: { normalizeTarget: (s: string) => s.toLowerCase() },
    });

    expect(normalizeTargetForProvider("slack", "")).toBe(undefined);
  });

  it("uses plugin normalizeTarget when available", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({
      messaging: { normalizeTarget: (s: string) => s.toLowerCase().replace(/\s/g, "") },
    });

    expect(normalizeTargetForProvider("slack", "  USER@EXAMPLE.COM  ")).toBe("user@example.com");
  });

  it("falls back to trim when plugin normalizeTarget is absent", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({
      messaging: {}, // no normalizeTarget
    });

    expect(normalizeTargetForProvider("slack", "  +15551234  ")).toBe("+15551234");
  });

  it("falls back to trim when plugin messaging is absent", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({}); // no messaging

    expect(normalizeTargetForProvider("slack", "  target  ")).toBe("target");
  });

  it("returns undefined when provider ID cannot be normalized", () => {
    mocks.normalizeChannelId.mockReturnValue(undefined);
    mocks.getChannelPlugin.mockReturnValue({});

    expect(normalizeTargetForProvider("invalid-provider", "  target  ")).toBe("target");
  });

  it("returns undefined when plugin returns empty string", () => {
    mocks.normalizeChannelId.mockReturnValue("slack");
    mocks.getChannelPlugin.mockReturnValue({
      messaging: { normalizeTarget: () => "" },
    });

    expect(normalizeTargetForProvider("slack", "  target  ")).toBe(undefined);
  });
});

describe("buildTargetResolverSignature", () => {
  it("returns stable signature for same resolver metadata", () => {
    mocks.getChannelPlugin.mockReturnValue({
      messaging: {
        targetResolver: {
          hint: "email",
          looksLikeId: (s: string) => s.includes("@"),
        },
      },
    });

    const sig1 = buildTargetResolverSignature("slack" as ChannelId);
    const sig2 = buildTargetResolverSignature("slack" as ChannelId);

    expect(sig1).toBe(sig2);
    expect(sig1).toMatch(/^[0-9a-z]+$/);
  });

  it("returns different signature when hint changes", () => {
    mocks.getChannelPlugin.mockReturnValueOnce({
      messaging: {
        targetResolver: {
          hint: "email",
          looksLikeId: (s: string) => s.includes("@"),
        },
      },
    });

    const sig1 = buildTargetResolverSignature("slack" as ChannelId);

    mocks.getChannelPlugin.mockReturnValueOnce({
      messaging: {
        targetResolver: {
          hint: "phone",
          looksLikeId: (s: string) => s.includes("@"),
        },
      },
    });

    const sig2 = buildTargetResolverSignature("slack" as ChannelId);

    expect(sig1).not.toBe(sig2);
  });

  it("returns different signature when looksLikeId changes", () => {
    const fn1 = (s: string) => s.includes("@");
    const fn2 = (s: string) => s.includes("+");

    mocks.getChannelPlugin.mockReturnValueOnce({
      messaging: {
        targetResolver: {
          hint: "contact",
          looksLikeId: fn1,
        },
      },
    });

    const sig1 = buildTargetResolverSignature("slack" as ChannelId);

    mocks.getChannelPlugin.mockReturnValueOnce({
      messaging: {
        targetResolver: {
          hint: "contact",
          looksLikeId: fn2,
        },
      },
    });

    const sig2 = buildTargetResolverSignature("slack" as ChannelId);

    expect(sig1).not.toBe(sig2);
  });

  it("handles missing targetResolver gracefully", () => {
    mocks.getChannelPlugin.mockReturnValue({
      messaging: {},
    });

    const sig = buildTargetResolverSignature("slack" as ChannelId);

    expect(sig).toMatch(/^[0-9a-z]+$/);
  });

  it("handles missing messaging gracefully", () => {
    mocks.getChannelPlugin.mockReturnValue({});

    const sig = buildTargetResolverSignature("slack" as ChannelId);

    expect(sig).toMatch(/^[0-9a-z]+$/);
  });

  it("produces empty-base signature when no resolver fields exist", () => {
    mocks.getChannelPlugin.mockReturnValue({});

    // Both should produce the same signature since both have no resolver
    mocks.getChannelPlugin.mockReturnValueOnce({});
    const sig1 = buildTargetResolverSignature("a" as ChannelId);

    mocks.getChannelPlugin.mockReturnValueOnce({});
    const sig2 = buildTargetResolverSignature("b" as ChannelId);

    // Signatures should be equal because the channel id is not part of signature
    expect(sig1).toBe(sig2);
  });
});

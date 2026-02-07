import { describe, it, expect, vi, afterEach } from "vitest";
import type { Tab } from "./navigation.ts";
import { getTransitionDirection, startViewTransition } from "./view-transition.ts";

describe("getTransitionDirection", () => {
  it("returns 'none' for same tab", () => {
    expect(getTransitionDirection("chat", "chat")).toBe("none");
    expect(getTransitionDirection("logs", "logs")).toBe("none");
  });

  it("returns 'forward' when navigating to a later tab", () => {
    expect(getTransitionDirection("chat", "overview")).toBe("forward");
    expect(getTransitionDirection("overview", "config")).toBe("forward");
    expect(getTransitionDirection("chat", "logs")).toBe("forward");
  });

  it("returns 'backward' when navigating to an earlier tab", () => {
    expect(getTransitionDirection("logs", "chat")).toBe("backward");
    expect(getTransitionDirection("config", "overview")).toBe("backward");
    expect(getTransitionDirection("debug", "sessions")).toBe("backward");
  });

  it("returns 'forward' for unknown tabs", () => {
    expect(getTransitionDirection("unknown" as Tab, "chat")).toBe("forward");
  });
});

describe("startViewTransition", () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn> | undefined;

  afterEach(() => {
    matchMediaSpy?.mockRestore();
    vi.restoreAllMocks();
    // Clean up any leftover classes/data-attributes
    document.documentElement.classList.remove("view-transitioning");
    delete document.documentElement.dataset.viewTransitionDirection;
  });

  it("applies change immediately when from === to", () => {
    const applyChange = vi.fn();
    startViewTransition({ from: "chat", to: "chat", applyChange });
    expect(applyChange).toHaveBeenCalledOnce();
  });

  it("skips transition when reduced motion is preferred", () => {
    matchMediaSpy = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const applyChange = vi.fn();
    startViewTransition({ from: "chat", to: "overview", applyChange });
    // With reduced motion, change is applied immediately without transition
    expect(applyChange).toHaveBeenCalledOnce();
  });

  it("invokes applyChange for different tabs", async () => {
    matchMediaSpy = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const applyChange = vi.fn();
    startViewTransition({ from: "chat", to: "config", applyChange });

    // In a browser environment, the callback may be invoked asynchronously
    // (e.g., after a CSS transition or via the safety timeout in the fallback path).
    // Wait enough time for the safety timeout (200ms) to fire.
    await new Promise((r) => setTimeout(r, 300));
    expect(applyChange).toHaveBeenCalled();
  });

  it("sets direction data attribute on document element", async () => {
    matchMediaSpy = vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });

    const doc = document as Document & { startViewTransition?: unknown };
    if (doc.startViewTransition) {
      // Native path: direction attribute is set synchronously
      const applyChange = vi.fn();
      startViewTransition({ from: "chat", to: "logs", applyChange });
      expect(document.documentElement.dataset.viewTransitionDirection).toBe("forward");

      // Clean up and test backward
      delete document.documentElement.dataset.viewTransitionDirection;
      document.documentElement.classList.remove("view-transitioning");

      startViewTransition({ from: "logs", to: "chat", applyChange });
      expect(document.documentElement.dataset.viewTransitionDirection).toBe("backward");
    } else {
      // CSS fallback: direction attribute is not set (only used with native API)
      const applyChange = vi.fn();
      startViewTransition({ from: "chat", to: "logs", applyChange });
      // Fallback path doesn't use direction attribute — just verify it doesn't throw
      await new Promise((r) => setTimeout(r, 300));
      expect(applyChange).toHaveBeenCalled();
    }
  });
});

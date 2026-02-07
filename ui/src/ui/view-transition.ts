/**
 * View transition utilities for smooth tab/view switches.
 *
 * Uses the View Transitions API (document.startViewTransition) when available,
 * with a CSS-based fade fallback for unsupported browsers. Respects
 * `prefers-reduced-motion: reduce` — transitions are skipped entirely.
 */

import type { Tab } from "./navigation.js";

/** Subset of Document that includes the View Transitions API (not yet in all TS libs). */
type DocumentWithViewTransition = Document & {
  startViewTransition?: (callback: () => Promise<void> | void) => {
    finished: Promise<void>;
    ready: Promise<void>;
    updateCallbackDone: Promise<void>;
  };
};

/**
 * Returns true if the user has requested reduced motion via OS/browser settings.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Determine the direction of the tab switch for slide animations.
 * Returns 'forward' when navigating to a tab that is "later" in the nav order,
 * 'backward' for the reverse, or 'none' for same-tab.
 */
const TAB_ORDER: readonly Tab[] = [
  "chat",
  "overview",
  "channels",
  "instances",
  "sessions",
  "usage",
  "cron",
  "agents",
  "skills",
  "nodes",
  "config",
  "debug",
  "logs",
] as const;

export type TransitionDirection = "forward" | "backward" | "none";

export function getTransitionDirection(from: Tab, to: Tab): TransitionDirection {
  if (from === to) return "none";
  const fromIndex = TAB_ORDER.indexOf(from);
  const toIndex = TAB_ORDER.indexOf(to);
  if (fromIndex === -1 || toIndex === -1) return "forward";
  return toIndex > fromIndex ? "forward" : "backward";
}

export type ViewTransitionOptions = {
  /** The tab being navigated away from. */
  from: Tab;
  /** The tab being navigated to. */
  to: Tab;
  /** The callback that actually applies the tab change (DOM update). */
  applyChange: () => void;
};

/**
 * Start a view transition between tabs.
 *
 * When the View Transitions API is available and motion is not reduced,
 * wraps the DOM change in `document.startViewTransition()` and sets
 * a data-attribute on <html> to control CSS animation direction.
 *
 * Otherwise, applies the change immediately with a brief CSS class-based
 * fade animation as a graceful fallback.
 */
export function startViewTransition({ from, to, applyChange }: ViewTransitionOptions): void {
  if (from === to) {
    applyChange();
    return;
  }

  const doc = (globalThis.document ?? null) as DocumentWithViewTransition | null;
  if (!doc) {
    applyChange();
    return;
  }

  const root = doc.documentElement;
  const reduced = prefersReducedMotion();

  // Skip transitions entirely for reduced motion
  if (reduced) {
    applyChange();
    return;
  }

  const direction = getTransitionDirection(from, to);

  // Native View Transitions API path
  if (doc.startViewTransition) {
    root.dataset.viewTransitionDirection = direction;
    root.classList.add("view-transitioning");

    try {
      const transition = doc.startViewTransition(() => {
        applyChange();
      });

      void transition.finished.finally(() => {
        root.classList.remove("view-transitioning");
        delete root.dataset.viewTransitionDirection;
      });
    } catch {
      // Fallback if startViewTransition throws
      root.classList.remove("view-transitioning");
      delete root.dataset.viewTransitionDirection;
      applyChange();
    }
    return;
  }

  // CSS fallback path: brief opacity transition
  const content = doc.querySelector(".content") as HTMLElement | null;
  if (content) {
    content.classList.add("view-fade-out");
    // Wait for the fade-out to complete, then swap content and fade in
    const onTransitionEnd = () => {
      content.removeEventListener("transitionend", onTransitionEnd);
      applyChange();
      content.classList.remove("view-fade-out");
      content.classList.add("view-fade-in");
      // Clean up after fade-in
      const onFadeIn = () => {
        content.removeEventListener("animationend", onFadeIn);
        content.classList.remove("view-fade-in");
      };
      content.addEventListener("animationend", onFadeIn, { once: true });
    };
    content.addEventListener("transitionend", onTransitionEnd, { once: true });

    // Safety timeout in case transitionend doesn't fire (e.g. display: none)
    setTimeout(() => {
      if (content.classList.contains("view-fade-out")) {
        content.classList.remove("view-fade-out");
        applyChange();
      }
    }, 200);
  } else {
    applyChange();
  }
}

/**
 * Live region announcer for screen readers.
 *
 * Creates a visually-hidden ARIA live region and provides an `announce()` function
 * that injects messages for screen reader users. Useful for:
 * - Route changes ("Navigated to Settings")
 * - Async operation results ("3 agents loaded", "Search complete: 5 results")
 * - Form validation ("Error: name is required")
 * - Dynamic content updates ("New message from Sam")
 *
 * WCAG 4.1.3: Status Messages
 */
import * as React from "react";

let liveRegion: HTMLDivElement | null = null;

function getOrCreateLiveRegion(): HTMLDivElement {
  if (liveRegion && document.body.contains(liveRegion)) {
    return liveRegion;
  }

  const el = document.createElement("div");
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  // sr-only styles
  Object.assign(el.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    borderWidth: "0",
  });
  document.body.appendChild(el);
  liveRegion = el;
  return el;
}

/**
 * Returns a stable `announce(message)` function.
 * Messages are announced to screen readers via an ARIA live region.
 *
 * @param politeness - "polite" (default, waits for silence) or "assertive" (interrupts)
 */
export function useAnnounce(politeness: "polite" | "assertive" = "polite") {
  const announce = React.useCallback(
    (message: string) => {
      const region = getOrCreateLiveRegion();
      region.setAttribute("aria-live", politeness);
      // Clear first so repeated identical messages still trigger
      region.textContent = "";
      // Use rAF to ensure the clear takes effect before the new message
      requestAnimationFrame(() => {
        region.textContent = message;
      });
    },
    [politeness]
  );

  return announce;
}

/**
 * Announce route changes to screen readers.
 * Call this from the root layout with the current page title.
 */
export function useRouteAnnouncer(title: string) {
  const announce = useAnnounce();

  React.useEffect(() => {
    if (title) {
      announce(`Navigated to ${title}`);
    }
  }, [title, announce]);
}

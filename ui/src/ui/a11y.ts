/**
 * Accessibility (a11y) Utilities
 *
 * Shared helpers for ARIA compliance, focus management, and keyboard navigation
 * across the OpenClaw Web UI.
 *
 * Key standards addressed:
 * - WCAG 2.1 AA compliance
 * - ARIA 1.2 roles, states, and properties
 * - Focus trap management for modal dialogs
 * - Live region announcements for dynamic content
 * - Keyboard navigation patterns
 */

// ── Focus Management ────────────────────────────────────────────────────────

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Get all focusable elements within a container.
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (el) => el.offsetParent !== null,
  );
}

/**
 * Create a focus trap handler for a modal/dialog container.
 * Returns a cleanup function.
 */
export function createFocusTrap(container: HTMLElement): () => void {
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Tab") return;

    const focusable = getFocusableElements(container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}

/**
 * Move focus to the first focusable element within a container.
 * If preferredSelector is given, tries that first.
 */
export function focusFirst(container: HTMLElement, preferredSelector?: string): void {
  if (preferredSelector) {
    const preferred = container.querySelector<HTMLElement>(preferredSelector);
    if (preferred) {
      preferred.focus();
      return;
    }
  }
  const focusable = getFocusableElements(container);
  focusable[0]?.focus();
}

/**
 * Save the currently focused element and return a function to restore it.
 * Useful for modals that need to return focus on close.
 */
export function saveFocusRestore(): () => void {
  const previouslyFocused = document.activeElement as HTMLElement | null;
  return () => {
    previouslyFocused?.focus?.();
  };
}

// ── Live Region Announcements ───────────────────────────────────────────────

let liveRegion: HTMLElement | null = null;

/**
 * Get or create the ARIA live region for announcements.
 * Uses aria-live="polite" by default for non-interrupting updates.
 */
function getOrCreateLiveRegion(): HTMLElement {
  if (liveRegion && document.body.contains(liveRegion)) return liveRegion;

  liveRegion = document.createElement("div");
  liveRegion.id = "a11y-live-region";
  liveRegion.setAttribute("role", "status");
  liveRegion.setAttribute("aria-live", "polite");
  liveRegion.setAttribute("aria-atomic", "true");
  // Visually hidden but accessible to screen readers
  Object.assign(liveRegion.style, {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: "0",
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: "0",
  });
  document.body.appendChild(liveRegion);
  return liveRegion;
}

/**
 * Announce a message to screen readers via the live region.
 * @param message - Text to announce
 * @param priority - 'polite' (default, non-interrupting) or 'assertive' (interrupts)
 */
export function announce(message: string, priority: "polite" | "assertive" = "polite"): void {
  const region = getOrCreateLiveRegion();
  region.setAttribute("aria-live", priority);
  // Clear and re-set to ensure the announcement triggers
  region.textContent = "";
  requestAnimationFrame(() => {
    region.textContent = message;
  });
}

// ── Keyboard Navigation Helpers ─────────────────────────────────────────────

/**
 * Handle arrow key navigation within a list of items (e.g., table rows, menu items).
 * Supports Up/Down arrows with wrap-around.
 */
export function handleArrowNavigation(
  event: KeyboardEvent,
  items: HTMLElement[],
  options?: { wrap?: boolean; orientation?: "vertical" | "horizontal" },
): void {
  const { wrap = true, orientation = "vertical" } = options ?? {};
  const prevKey = orientation === "vertical" ? "ArrowUp" : "ArrowLeft";
  const nextKey = orientation === "vertical" ? "ArrowDown" : "ArrowRight";

  if (event.key !== prevKey && event.key !== nextKey && event.key !== "Home" && event.key !== "End")
    return;

  event.preventDefault();
  const currentIndex = items.indexOf(document.activeElement as HTMLElement);

  let nextIndex: number;
  if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = items.length - 1;
  } else if (event.key === nextKey) {
    nextIndex = currentIndex + 1;
    if (nextIndex >= items.length) nextIndex = wrap ? 0 : items.length - 1;
  } else {
    nextIndex = currentIndex - 1;
    if (nextIndex < 0) nextIndex = wrap ? items.length - 1 : 0;
  }

  items[nextIndex]?.focus();
}

/**
 * Make a click handler also respond to Enter and Space keys
 * for keyboard accessibility on non-button interactive elements.
 */
export function onClickOrKeyboard(handler: (e: Event) => void): {
  click: (e: Event) => void;
  keydown: (e: KeyboardEvent) => void;
} {
  return {
    click: handler,
    keydown: (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler(e);
      }
    },
  };
}

// ── ID Generation ───────────────────────────────────────────────────────────

let idCounter = 0;

/**
 * Generate a unique ID for ARIA references (aria-labelledby, aria-describedby, etc.).
 */
export function uniqueId(prefix = "a11y"): string {
  return `${prefix}-${++idCounter}`;
}

// ── Semantic Role Helpers ───────────────────────────────────────────────────

/**
 * Common ARIA attribute sets for frequently-used patterns.
 */
export const ariaPatterns = {
  /** Attributes for a modal dialog */
  dialog: (labelledBy: string) => ({
    role: "dialog" as const,
    "aria-modal": "true" as const,
    "aria-labelledby": labelledBy,
  }),

  /** Attributes for an alert dialog (destructive/confirmation) */
  alertDialog: (labelledBy: string) => ({
    role: "alertdialog" as const,
    "aria-modal": "true" as const,
    "aria-labelledby": labelledBy,
  }),

  /** Attributes for a tab panel */
  tabPanel: (id: string, labelledBy: string) => ({
    id,
    role: "tabpanel" as const,
    "aria-labelledby": labelledBy,
  }),

  /** Attributes for a search input */
  search: (label: string) => ({
    role: "search" as const,
    "aria-label": label,
  }),

  /** Attributes for a navigation landmark */
  navigation: (label: string) => ({
    role: "navigation" as const,
    "aria-label": label,
  }),

  /** Attributes for a complementary region (sidebar) */
  complementary: (label: string) => ({
    role: "complementary" as const,
    "aria-label": label,
  }),
} as const;

import * as React from "react";

const STORAGE_KEY = "oc_shortcuts_seen";

/**
 * Tracks whether the user has seen the keyboard shortcuts modal.
 * Uses localStorage so the state persists across sessions.
 * Once seen, the discoverability indicator is hidden permanently.
 */
export function useShortcutsSeen() {
  const [seen, setSeen] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      return false;
    }
  });

  const markSeen = React.useCallback(() => {
    if (!seen) {
      try {
        localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // localStorage unavailable (private browsing, etc.) — degrade gracefully
      }
      setSeen(true);
    }
  }, [seen]);

  return { seen, markSeen };
}

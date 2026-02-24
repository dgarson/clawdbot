import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { cn } from "../../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
type Theme = "light" | "dark";

const STORAGE_KEY = "horizon-theme";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Read the current theme from storage / system preference. */
function readTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/** Apply a theme to the <html> element and persist it. */
function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(STORAGE_KEY, theme);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ThemeToggleProps {
  /** Extra CSS classes applied to the button. */
  className?: string;
}

/**
 * ThemeToggle
 *
 * Toggles between Horizon's dark and light themes.
 * – Persists preference in localStorage under `horizon-theme`
 * – Applies `data-theme="light"|"dark"` to `<html>`
 * – Respects `prefers-color-scheme` on first load (when no stored value)
 * – Keyboard operable, focus-visible ring, aria-label reflects current state
 */
export function ThemeToggle({ className }: ThemeToggleProps) {
  // The index.html inline script already set data-theme before React mounts,
  // so we initialise state from the same source to stay in sync.
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const initial = readTheme();
    setTheme(initial);
    // Ensure DOM is in sync (handles cases where inline script was absent)
    applyTheme(initial);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "p-1.5 rounded-md transition-colors",
        "text-muted-foreground hover:text-foreground hover:bg-secondary/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tok-accent",
        className,
      )}
    >
      {isDark ? (
        <Sun
          aria-hidden="true"
          className="w-4 h-4"
        />
      ) : (
        <Moon
          aria-hidden="true"
          className="w-4 h-4"
        />
      )}
    </button>
  );
}

export default ThemeToggle;

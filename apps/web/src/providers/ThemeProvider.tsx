"use client";

import * as React from "react";
import { useUIStore, type Theme } from "@/stores/useUIStore";

interface ThemeProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that applies the theme class to the document element
 * and listens for system theme changes when in "system" mode.
 */
export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useUIStore((s) => s.theme);

  React.useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (newTheme: Theme) => {
      root.classList.remove("light", "dark");

      if (newTheme === "system") {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")
          .matches
          ? "dark"
          : "light";
        root.classList.add(systemTheme);
      } else {
        root.classList.add(newTheme);
      }
    };

    applyTheme(theme);

    // Listen for system theme changes when in system mode
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
  }, [theme]);

  return <>{children}</>;
}

export default ThemeProvider;

"use client";
import * as React from "react";
import { useUiStore } from "@/lib/stores/ui";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUiStore((s) => s.theme);
  const setResolvedTheme = useUiStore((s) => s.setResolvedTheme);

  React.useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function apply() {
      const resolved = theme === "system" ? (mediaQuery.matches ? "dark" : "light") : theme;
      root.classList.toggle("dark", resolved === "dark");
      setResolvedTheme(resolved);
    }

    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, [theme, setResolvedTheme]);

  return <>{children}</>;
}

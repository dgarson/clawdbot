import React, { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export type ThemeColor = "original" | "oceanic" | "emerald" | "amber" | "indigo";

const STORAGE_KEY = "horizon-theme-color";

// ── Helpers ──────────────────────────────────────────────────────────────────

function readThemeColor(): ThemeColor {
  const stored = localStorage.getItem(STORAGE_KEY) as ThemeColor | null;
  if (stored && ["original", "oceanic", "emerald", "amber", "indigo"].includes(stored)) {
    return stored;
  }
  return "original";
}

function applyThemeColor(color: ThemeColor): void {
  if (color === "original") {
    document.documentElement.removeAttribute("data-theme-color");
  } else {
    document.documentElement.setAttribute("data-theme-color", color);
  }
  localStorage.setItem(STORAGE_KEY, color);
}

// ── Component ─────────────────────────────────────────────────────────────────

interface ThemeColorToggleProps {
  className?: string;
}

const THEME_COLORS: { id: ThemeColor; label: string; colorClass: string; darkColorClass: string }[] = [
  { id: "original", label: "Original", colorClass: "bg-primary", darkColorClass: "bg-primary" },
  { id: "oceanic", label: "Oceanic", colorClass: "bg-blue-600", darkColorClass: "bg-blue-500" },
  { id: "emerald", label: "Emerald", colorClass: "bg-emerald-600", darkColorClass: "bg-emerald-500" },
  { id: "amber", label: "Amber", colorClass: "bg-amber-600", darkColorClass: "bg-amber-500" },
  { id: "indigo", label: "Indigo", colorClass: "bg-primary", darkColorClass: "bg-primary" },
];

export function ThemeColorToggle({ className }: ThemeColorToggleProps) {
  const [activeColor, setActiveColor] = useState<ThemeColor>("original");

  useEffect(() => {
    const initial = readThemeColor();
    setActiveColor(initial);
    applyThemeColor(initial);
  }, []);

  const handleSelect = (color: ThemeColor) => {
    setActiveColor(color);
    applyThemeColor(color);
  };

  return (
    <div
      className={cn(
        "flex items-center gap-1 p-1 bg-secondary/50 border border-border rounded-lg",
        className
      )}
      role="group"
      aria-label="Theme Color Picker"
    >
      {THEME_COLORS.map(({ id, label, colorClass, darkColorClass }) => (
        <button
          key={id}
          type="button"
          onClick={() => handleSelect(id)}
          aria-pressed={activeColor === id}
          title={`${label} theme`}
          aria-label={`${label} theme`}
          className={cn(
            "w-5 h-5 rounded-md flex items-center justify-center transition-all",
            "hover:scale-110",
            activeColor === id ? "bg-background border border-border shadow-sm" : "border border-transparent opacity-70 hover:opacity-100"
          )}
        >
          <span 
            className={cn(
              "w-2.5 h-2.5 rounded-full shadow-inner",
              "dark:" + darkColorClass,
              colorClass, // default to light class, tailwind's dark: prefix overrides it
            )} 
          />
        </button>
      ))}
    </div>
  );
}

export default ThemeColorToggle;

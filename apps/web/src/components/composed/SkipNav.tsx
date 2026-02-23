
import * as React from "react";
import { cn } from "@/lib/utils";

const SKIP_NAV_ID = "skip-nav-content";

/**
 * Skip navigation link — visually hidden until focused via keyboard.
 * Appears as a fixed badge at the top of the viewport on Tab press.
 * WCAG 2.4.1: Bypass Blocks
 */
export function SkipNavLink({
  className,
  children = "Skip to main content",
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={`#${SKIP_NAV_ID}`}
      className={cn(
        // Visually hidden by default
        "sr-only",
        // On focus: visible fixed position at top-left
        "focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999]",
        "focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground",
        "focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring",
        "transition-none",
        className
      )}
    >
      {children}
    </a>
  );
}

/**
 * Skip navigation target — renders an invisible anchor where main content begins.
 * Must be placed at the start of the main content area.
 */
export function SkipNavContent({ className }: { className?: string }) {
  return (
    <div
      id={SKIP_NAV_ID}
      tabIndex={-1}
      className={cn("outline-none", className)}
    />
  );
}

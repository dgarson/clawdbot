"use client";

import * as React from "react";
import { MotionConfig } from "framer-motion";

/**
 * Wraps the app in Framer Motion's MotionConfig with reducedMotion="user".
 *
 * When the user has `prefers-reduced-motion: reduce` enabled in their OS:
 * - All `motion.*` animations are skipped (instant transitions)
 * - AnimatePresence children mount/unmount without animation
 * - No layout animations
 *
 * This respects WCAG 2.3.3 (Animation from Interactions) globally
 * without requiring per-component checks.
 */
export function ReducedMotionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionConfig reducedMotion="user">
      {children}
    </MotionConfig>
  );
}

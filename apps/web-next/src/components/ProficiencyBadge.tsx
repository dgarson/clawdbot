/**
 * ProficiencyBadge — Shows the user's current UX proficiency level
 * with ability to toggle through levels.
 *
 * Renders as a compact badge in the sidebar footer.
 * Clicking opens a popover to change level or view stats.
 */

import React, { useState, useRef, useEffect } from "react";
import {
  useProficiency,
  PROFICIENCY_LEVELS,
  PROFICIENCY_META,
  ProficiencyLevel,
  PROMOTION_THRESHOLDS,
} from "../stores/proficiencyStore";
import { cn } from "../lib/utils";

// ─── Badge ────────────────────────────────────────────────────────────────────

export default function ProficiencyBadge() {
  const { level, state, setLevel, reset } = useProficiency();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const meta = PROFICIENCY_META[level];

  // Close on outside click
  useEffect(() => {
    if (!open) {return;}
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) {return;}
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") {setOpen(false);}
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {/* Badge Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2",
          "bg-white/5 hover:bg-white/10 transition-colors",
          "text-xs font-medium"
        )}
        aria-label={`UX Level: ${meta.label}. Click to change.`}
        aria-expanded={open}
      >
        <span className="text-base leading-none">{meta.emoji}</span>
        <div className="flex flex-col items-start min-w-0">
          <span className={cn("font-semibold truncate", meta.color)}>
            {meta.label}
          </span>
          <span className="text-white/30 text-[10px] leading-tight truncate">
            {state.manuallySet ? "Manual" : "Auto"} · {state.interactionCount} actions
          </span>
        </div>
        <svg
          className="ml-auto h-3.5 w-3.5 text-white/30 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d={open ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
        </svg>
      </button>

      {/* Popover */}
      {open && (
        <div
          className={cn(
            "absolute bottom-full left-0 right-0 mb-2 z-50",
            "rounded-xl border border-white/10 bg-[#1a1a2e] shadow-2xl",
            "p-3"
          )}
          role="dialog"
          aria-label="UX Proficiency Settings"
        >
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/30">
            UX Experience Level
          </div>

          {/* Level Selector */}
          <div className="flex flex-col gap-1">
            {PROFICIENCY_LEVELS.map((lvl) => {
              const m = PROFICIENCY_META[lvl];
              const isActive = lvl === level;
              const threshold = PROMOTION_THRESHOLDS[lvl];
              const progress = Math.min(
                100,
                ((state.interactionCount - threshold) /
                  (getNextThreshold(lvl) - threshold)) *
                  100
              );

              return (
                <button
                  key={lvl}
                  onClick={() => {
                    setLevel(lvl);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                    isActive
                      ? "bg-white/10 ring-1 ring-white/20"
                      : "hover:bg-white/5"
                  )}
                >
                  <span className="text-base leading-none">{m.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div
                      className={cn(
                        "text-xs font-semibold",
                        isActive ? m.color : "text-white/60"
                      )}
                    >
                      {m.label}
                    </div>
                    <div className="text-[10px] text-white/30 leading-tight">
                      {m.description}
                    </div>
                    {/* Progress bar toward next level */}
                    {!isActive && lvl !== "expert" && state.interactionCount >= threshold && (
                      <div className="mt-1 h-0.5 w-full rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white/30 transition-all"
                          style={{ width: `${Math.max(0, progress)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  {isActive && (
                    <span className="ml-auto text-white/50">
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Stats Footer */}
          <div className="mt-3 border-t border-white/8 pt-2 flex items-center justify-between text-[10px] text-white/25">
            <span>{state.viewsVisited.length} views explored</span>
            <button
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="hover:text-white/50 transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getNextThreshold(level: ProficiencyLevel): number {
  const idx = PROFICIENCY_LEVELS.indexOf(level);
  if (idx >= PROFICIENCY_LEVELS.length - 1) {return Infinity;}
  const next = PROFICIENCY_LEVELS[idx + 1];
  return PROMOTION_THRESHOLDS[next];
}

// Re-export PROMOTION_THRESHOLDS so ProficiencyBadge can use it (it's defined in the store)
// We need to import it — done via the store import above.

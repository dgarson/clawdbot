/**
 * TerminalOverlay — floating terminal panel that slides up from the bottom.
 *
 * Covers the bottom 60 % of the screen and is centered to 60 % of the viewport
 * width. Supports minimized state (title bar only) but has no docked mode.
 * Rendered via a portal so it overlays everything.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Minus, Terminal, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { WebTerminalRef } from "@/components/composed/WebTerminal";

const LazyWebTerminal = React.lazy(() =>
  import("@/components/composed/WebTerminal").then((mod) => ({
    default: mod.WebTerminal,
  }))
);

const TITLE_BAR_H = 40; // px

export interface TerminalOverlayProps {
  open: boolean;
  onClose: () => void;
  sessionKey?: string;
  workspaceDir?: string;
  className?: string;
}

export function TerminalOverlay({
  open,
  onClose,
  sessionKey,
  workspaceDir = "~",
}: TerminalOverlayProps) {
  const [minimized, setMinimized] = React.useState(false);
  const terminalRef = React.useRef<WebTerminalRef>(null);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Reset minimized when re-opened
  React.useEffect(() => {
    if (open) {setMinimized(false);}
  }, [open]);

  // Fit terminal after open / restore
  React.useEffect(() => {
    if (open && !minimized) {
      const t = setTimeout(() => terminalRef.current?.fit(), 120);
      return () => clearTimeout(t);
    }
  }, [open, minimized]);

  if (!mounted) {return null;}

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="terminal-overlay"
          initial={{ y: "100%" }}
          animate={{ y: minimized ? `calc(100% - ${TITLE_BAR_H}px)` : "0%" }}
          exit={{ y: "100%" }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            // Position: bottom of viewport, centered horizontally
            "fixed bottom-0 left-1/2 -translate-x-1/2 z-[60]",
            "w-[75vw] h-[60vh]",
            // Chrome
            "flex flex-col overflow-hidden",
            "rounded-t-xl border border-border border-b-0 shadow-2xl bg-background"
          )}
        >
          {/* ── Title bar ─────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between border-b border-border bg-muted/40 px-3 shrink-0"
            style={{ height: TITLE_BAR_H }}
          >
            <div className="flex items-center gap-2">
              <Terminal className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">Terminal</span>
              {sessionKey && (
                <span className="text-[10px] text-muted-foreground font-mono opacity-60">
                  {sessionKey}
                </span>
              )}
            </div>

            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title={minimized ? "Restore" : "Minimize"}
                onClick={() => setMinimized((v) => !v)}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                title="Close terminal"
                onClick={onClose}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* ── Terminal content ──────────────────────────────────── */}
          <div className="flex-1 min-h-0">
            <React.Suspense
              fallback={
                <div className="flex h-full items-center justify-center bg-black">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <LazyWebTerminal
                ref={terminalRef}
                className="h-full rounded-none border-none"
                height="100%"
                welcomeMessage={`Terminal — session: ${sessionKey ?? "none"}  workspace: ${workspaceDir}\n`}
              />
            </React.Suspense>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export default TerminalOverlay;

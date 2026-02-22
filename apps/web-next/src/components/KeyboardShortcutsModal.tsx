import { useEffect } from "react";
import { cn } from "../lib/utils";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    group: "Navigation",
    shortcuts: [
      { keys: ["⌘K"], description: "Open command palette" },
      { keys: ["Alt", "1–9"], description: "Jump to first 9 views" },
      { keys: ["Alt", "←"], description: "Go back" },
      { keys: ["Alt", "→"], description: "Go forward" },
      { keys: ["[", "]"], description: "Collapse / expand sidebar" },
    ],
  },
  {
    group: "Command Palette",
    shortcuts: [
      { keys: ["↑", "↓"], description: "Move through results" },
      { keys: ["↵"], description: "Open selected item" },
      { keys: ["Esc"], description: "Close palette" },
    ],
  },
  {
    group: "Global",
    shortcuts: [
      { keys: ["?"], description: "Show this help" },
      { keys: ["Esc"], description: "Close any modal / panel" },
    ],
  },
];

export default function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md animate-slide-in"
      >
        <div className="bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-base" aria-hidden="true">⌨️</span>
              Keyboard Shortcuts
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              aria-label="Close shortcuts modal"
            >
              ✕
            </button>
          </div>

          {/* Shortcut Groups */}
          <div className="p-4 space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.group}>
                <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground/60 mb-2 px-1">
                  {group.group}
                </h3>
                <div className="space-y-1">
                  {group.shortcuts.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-secondary/30 transition-colors"
                    >
                      <span className="text-sm text-foreground/80">{s.description}</span>
                      <div className="flex items-center gap-1">
                        {s.keys.map((key, ki) => (
                          <span key={ki} className="flex items-center gap-0.5">
                            {ki > 0 && (
                              <span className="text-[10px] text-muted-foreground/40 mx-0.5">+</span>
                            )}
                            <kbd
                              className={cn(
                                "px-1.5 py-0.5 rounded font-mono text-[11px] border",
                                "bg-secondary text-muted-foreground border-border",
                                key.length === 1 && "min-w-[1.5rem] text-center"
                              )}
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border bg-secondary/20">
            <p className="text-[10px] text-muted-foreground/50 text-center">
              Press <kbd className="font-mono bg-secondary px-1 py-0.5 rounded">?</kbd> anytime to reopen this
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

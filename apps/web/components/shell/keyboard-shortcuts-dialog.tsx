"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Keyboard } from "lucide-react";
import { SHORTCUTS } from "@/lib/hooks/use-keyboard-shortcuts";

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Also open with ?
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenChange(true);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpenChange]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-card shadow-2xl p-6 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Keyboard className="h-5 w-5 text-muted-foreground" />
              <Dialog.Title className="text-lg font-semibold">
                Keyboard Shortcuts
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="sr-only">
            List of keyboard shortcuts available in the application.
          </Dialog.Description>

          <div className="space-y-1">
            {SHORTCUTS.map((shortcut) => (
              <div
                key={shortcut.keys}
                className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/50 transition-colors"
              >
                <span className="text-sm text-foreground">
                  {shortcut.description}
                </span>
                <kbd className="inline-flex h-6 items-center rounded-md border border-border bg-muted px-2 font-mono text-xs text-muted-foreground">
                  {shortcut.keys}
                </kbd>
              </div>
            ))}
            <div className="flex items-center justify-between py-2 px-2 rounded-md hover:bg-accent/50 transition-colors">
              <span className="text-sm text-foreground">
                Show this help
              </span>
              <kbd className="inline-flex h-6 items-center rounded-md border border-border bg-muted px-2 font-mono text-xs text-muted-foreground">
                ?
              </kbd>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground mt-4 text-center">
            Press <kbd className="font-mono">?</kbd> anywhere to show shortcuts
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

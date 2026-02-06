"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

export interface ShortcutDef {
  keys: string[];
  description: string;
}

export interface ShortcutCategory {
  name: string;
  shortcuts: ShortcutDef[];
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: "General",
    shortcuts: [
      { keys: ["Cmd", "K"], description: "Open command palette" },
      { keys: ["?"], description: "Show keyboard shortcuts" },
      { keys: ["Cmd", "\\"], description: "Toggle sidebar" },
    ],
  },
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["Cmd", "N"], description: "New conversation" },
      { keys: ["G", "H"], description: "Go to Home" },
      { keys: ["G", "C"], description: "Go to Conversations" },
      { keys: ["G", "A"], description: "Go to Agents" },
      { keys: ["G", "W"], description: "Go to Waiting (approvals/input)" },
    ],
  },
  {
    name: "Appearance",
    shortcuts: [
      { keys: ["Cmd", "Shift", "D"], description: "Toggle dark mode" },
      { keys: ["Cmd", "Shift", "P"], description: "Toggle power user mode" },
    ],
  },
  {
    name: "Session",
    shortcuts: [
      { keys: ["Cmd", "B"], description: "Toggle left sidebar" },
      { keys: ["Cmd", "J"], description: "Toggle right sidebar" },
      { keys: ["Cmd", "`"], description: "Open terminal (maximized)" },
      { keys: ["Cmd", "E"], description: "Open Core Files editor" },
      { keys: ["Escape"], description: "Close maximized views" },
      { keys: ["Cmd", "Shift", "F"], description: "Toggle focus mode" },
    ],
  },
];

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded border border-border",
        "bg-muted px-1.5 text-xs font-medium text-muted-foreground shadow-sm"
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal({
  open,
  onOpenChange,
}: KeyboardShortcutsModalProps) {
  // Detect OS for key display
  const isMac = React.useMemo(
    () =>
      typeof navigator !== "undefined" &&
      navigator.platform.toLowerCase().includes("mac"),
    []
  );

  const formatKey = React.useCallback(
    (key: string) => {
      if (key === "Cmd") {return isMac ? "\u2318" : "Ctrl";}
      if (key === "Shift") {return isMac ? "\u21E7" : "Shift";}
      if (key === "Alt") {return isMac ? "\u2325" : "Alt";}
      return key;
    },
    [isMac]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          {shortcutCategories.map((category, idx) => (
            <div key={category.name}>
              {idx > 0 && <Separator className="mb-4" />}
              <h3 className="mb-3 text-sm font-medium text-foreground">
                {category.name}
              </h3>
              <div className="space-y-2">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIdx) => (
                        <React.Fragment key={key}>
                          {keyIdx > 0 && (
                            <span className="text-xs text-muted-foreground/50">
                              +
                            </span>
                          )}
                          <Kbd>{formatKey(key)}</Kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default KeyboardShortcutsModal;

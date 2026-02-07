"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";

interface Shortcut {
  keys: string[];
  description: string;
}

interface ShortcutCategory {
  name: string;
  shortcuts: Shortcut[];
}

interface KeyboardShortcutsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcutCategories: ShortcutCategory[] = [
  {
    name: "Navigation",
    shortcuts: [
      { keys: ["Cmd", "K"], description: "Open Command Palette" },
      { keys: ["Cmd", "/"], description: "Focus Search" },
      { keys: ["Cmd", "1"], description: "Go to Home" },
      { keys: ["Cmd", "2"], description: "Go to Conversations" },
      { keys: ["Cmd", "3"], description: "Go to Agents" },
      { keys: ["Cmd", "4"], description: "Go to Workstreams" },
      { keys: ["Cmd", ","], description: "Open Settings" },
      { keys: ["Esc"], description: "Close Modal / Go Back" },
    ],
  },
  {
    name: "Actions",
    shortcuts: [
      { keys: ["Cmd", "N"], description: "New Conversation" },
      { keys: ["Cmd", "Shift", "N"], description: "New Agent" },
      { keys: ["Cmd", "S"], description: "Save Changes" },
      { keys: ["Cmd", "Enter"], description: "Send Message" },
      { keys: ["Cmd", "Shift", "Enter"], description: "Send with New Line" },
      { keys: ["Cmd", "Z"], description: "Undo" },
      { keys: ["Cmd", "Shift", "Z"], description: "Redo" },
    ],
  },
  {
    name: "Chat",
    shortcuts: [
      { keys: ["Enter"], description: "Send Message" },
      { keys: ["Shift", "Enter"], description: "New Line in Message" },
      { keys: ["Up"], description: "Edit Last Message" },
      { keys: ["Cmd", "L"], description: "Clear Chat History" },
      { keys: ["Cmd", "C"], description: "Copy Selected Message" },
      { keys: ["Cmd", "J"], description: "Toggle Chat Settings" },
    ],
  },
  {
    name: "View",
    shortcuts: [
      { keys: ["Cmd", "B"], description: "Toggle Sidebar" },
      { keys: ["Cmd", "\\"], description: "Toggle Detail Panel" },
      { keys: ["Cmd", "Shift", "T"], description: "Toggle Theme" },
      { keys: ["Cmd", "+"], description: "Zoom In" },
      { keys: ["Cmd", "-"], description: "Zoom Out" },
      { keys: ["Cmd", "0"], description: "Reset Zoom" },
    ],
  },
];

function KeyboardKey({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-6 min-w-6 items-center justify-center rounded border border-border bg-muted px-1.5 text-xs font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsModal({ open, onOpenChange }: KeyboardShortcutsModalProps) {
  // Replace "Cmd" with platform-appropriate key
  const [isMac, setIsMac] = React.useState(true);

  React.useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes("mac"));
  }, []);

  const formatKey = (key: string) => {
    if (key === "Cmd") {
      return isMac ? "\u2318" : "Ctrl";
    }
    if (key === "Shift") {
      return isMac ? "\u21E7" : "Shift";
    }
    if (key === "Alt") {
      return isMac ? "\u2325" : "Alt";
    }
    if (key === "Enter") {
      return "\u23CE";
    }
    if (key === "Esc") {
      return "Esc";
    }
    if (key === "Up") {
      return "\u2191";
    }
    if (key === "Down") {
      return "\u2193";
    }
    return key;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts to navigate and perform actions quickly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {shortcutCategories.map((category, index) => (
            <div key={category.name}>
              {index > 0 && <Separator className="mb-6" />}
              <h3 className="text-sm font-semibold mb-4">{category.name}</h3>
              <div className="space-y-3">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.description}
                    className="flex items-center justify-between gap-4"
                  >
                    <span className="text-sm text-muted-foreground">
                      {shortcut.description}
                    </span>
                    <div className="flex items-center gap-1">
                      {shortcut.keys.map((key, keyIndex) => (
                        <React.Fragment key={key}>
                          {keyIndex > 0 && (
                            <span className="text-muted-foreground text-xs">+</span>
                          )}
                          <KeyboardKey>{formatKey(key)}</KeyboardKey>
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

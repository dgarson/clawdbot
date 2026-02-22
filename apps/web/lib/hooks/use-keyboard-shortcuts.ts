"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUiStore } from "@/lib/stores/ui";

type ShortcutDef = {
  key: string;
  meta?: boolean;
  ctrl?: boolean;
  shift?: boolean;
  action: () => void;
  description: string;
};

/**
 * Global keyboard shortcuts for the app.
 * ⌘K is handled separately in the CommandPalette component.
 */
export function useKeyboardShortcuts() {
  const router = useRouter();
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  useEffect(() => {
    const shortcuts: ShortcutDef[] = [
      // Navigation
      {
        key: "1",
        meta: true,
        action: () => router.push("/dashboard"),
        description: "Go to Dashboard",
      },
      {
        key: "2",
        meta: true,
        action: () => router.push("/agents"),
        description: "Go to Agents",
      },
      {
        key: "3",
        meta: true,
        action: () => router.push("/chat"),
        description: "Go to Chat",
      },
      {
        key: "4",
        meta: true,
        action: () => router.push("/cron"),
        description: "Go to Automations",
      },
      {
        key: "5",
        meta: true,
        action: () => router.push("/skills"),
        description: "Go to Skills",
      },
      {
        key: "6",
        meta: true,
        action: () => router.push("/settings"),
        description: "Go to Settings",
      },

      // Actions
      {
        key: "b",
        meta: true,
        action: toggleSidebar,
        description: "Toggle sidebar",
      },
      {
        key: "n",
        meta: true,
        shift: true,
        action: () => router.push("/agents/new"),
        description: "New agent",
      },
    ];

    const handler = (e: KeyboardEvent) => {
      // Ignore when typing in inputs
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcuts) {
        const metaMatch = shortcut.meta
          ? e.metaKey || e.ctrlKey
          : !e.metaKey && !e.ctrlKey;
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;

        if (e.key === shortcut.key && metaMatch && shiftMatch) {
          e.preventDefault();
          shortcut.action();
          return;
        }
      }
    };

    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [router, setCommandPaletteOpen, toggleSidebar]);
}

/** Exportable list of shortcuts for help display */
export const SHORTCUTS = [
  { keys: "⌘K", description: "Command palette" },
  { keys: "⌘B", description: "Toggle sidebar" },
  { keys: "⌘⇧N", description: "New agent" },
  { keys: "⌘1", description: "Dashboard" },
  { keys: "⌘2", description: "Agents" },
  { keys: "⌘3", description: "Chat" },
  { keys: "⌘4", description: "Automations" },
  { keys: "⌘5", description: "Skills" },
  { keys: "⌘6", description: "Settings" },
];

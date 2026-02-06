"use client";

import { useKeyboardShortcuts, type KeyboardShortcut } from "./useKeyboardShortcuts";
import { usePreferencesStore } from "@/stores/usePreferencesStore";

export interface UseSessionShortcutsOptions {
  onToggleTerminal: () => void;
  onOpenCoreFiles: () => void;
  onCloseMaximized: () => void;
}

/**
 * Session-specific keyboard shortcuts.
 * Registers shortcuts only while the session page is mounted.
 */
export function useSessionShortcuts({
  onToggleTerminal,
  onOpenCoreFiles,
  onCloseMaximized,
}: UseSessionShortcutsOptions) {
  const toggleLeft = usePreferencesStore((s) => s.toggleSessionLeftPanel);
  const toggleRight = usePreferencesStore((s) => s.toggleSessionRightPanel);
  const toggleFocus = usePreferencesStore((s) => s.toggleSessionFocusMode);

  const shortcuts: KeyboardShortcut[] = [
    // Cmd+B / Ctrl+B - toggle left sidebar
    { key: "b", meta: true, action: toggleLeft },
    // Cmd+J / Ctrl+J - toggle right sidebar
    { key: "j", meta: true, action: toggleRight },
    // Cmd+` - open terminal (maximized)
    { key: "`", meta: true, action: onToggleTerminal },
    // Cmd+E / Ctrl+E - open Core Files editor sheet
    { key: "e", meta: true, action: onOpenCoreFiles },
    // Escape - close maximized views
    { key: "Escape", action: onCloseMaximized, preventDefault: false },
    // Cmd+Shift+F / Ctrl+Shift+F - toggle focus mode
    { key: "f", meta: true, shift: true, action: toggleFocus },
  ];

  useKeyboardShortcuts(shortcuts);
}

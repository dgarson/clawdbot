"use client";

import * as React from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKeyboardShortcuts, type KeyboardShortcut } from "@/hooks";
import { useUIStore } from "@/stores/useUIStore";
import { CommandPalette } from "@/components/composed/CommandPalette";
import { KeyboardShortcutsModal } from "@/components/composed/KeyboardShortcutsModal";

interface ShortcutsProviderProps {
  children: React.ReactNode;
}

/**
 * Provider that sets up global keyboard shortcuts and manages
 * the command palette and shortcuts modal.
 */
export function ShortcutsProvider({ children }: ShortcutsProviderProps) {
  const navigate = useNavigate();
  const { toggleSidebar, theme, setTheme, powerUserMode, setPowerUserMode } =
    useUIStore();

  const [commandPaletteOpen, setCommandPaletteOpen] = React.useState(false);
  const [shortcutsModalOpen, setShortcutsModalOpen] = React.useState(false);

  // Track "g" key for go-to sequences
  const [waitingForGoTo, setWaitingForGoTo] = React.useState(false);
  const goToTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearGoToState = React.useCallback(() => {
    setWaitingForGoTo(false);
    if (goToTimeoutRef.current) {
      clearTimeout(goToTimeoutRef.current);
      goToTimeoutRef.current = null;
    }
  }, []);

  // Define all keyboard shortcuts
  const shortcuts: KeyboardShortcut[] = React.useMemo(
    () => [
      // Command Palette
      {
        key: "k",
        meta: true,
        action: () => setCommandPaletteOpen(true),
      },
      // Also support Ctrl+K on Windows/Linux
      {
        key: "k",
        ctrl: true,
        action: () => setCommandPaletteOpen(true),
      },

      // New conversation
      {
        key: "n",
        meta: true,
        action: () => navigate({ to: "/conversations" }),
      },

      // Toggle sidebar
      {
        key: "\\",
        meta: true,
        action: toggleSidebar,
      },

      // Toggle dark mode
      {
        key: "d",
        meta: true,
        shift: true,
        action: () => setTheme(theme === "dark" ? "light" : "dark"),
      },

      // Toggle power user mode
      {
        key: "p",
        meta: true,
        shift: true,
        action: () => setPowerUserMode(!powerUserMode),
      },

      // Show shortcuts modal
      {
        key: "?",
        shift: true,
        action: () => setShortcutsModalOpen(true),
      },

      // Go-to sequence: "g" followed by another key
      {
        key: "g",
        action: () => {
          setWaitingForGoTo(true);
          // Clear after 1 second if no second key pressed
          goToTimeoutRef.current = setTimeout(clearGoToState, 1000);
        },
        enabled: !waitingForGoTo,
      },

      // Go to Home
      {
        key: "h",
        action: () => {
          if (waitingForGoTo) {
            navigate({ to: "/" });
            clearGoToState();
          }
        },
        enabled: waitingForGoTo,
      },

      // Go to Conversations
      {
        key: "c",
        action: () => {
          if (waitingForGoTo) {
            navigate({ to: "/conversations" });
            clearGoToState();
          }
        },
        enabled: waitingForGoTo,
      },

      // Go to Agents
      {
        key: "a",
        action: () => {
          if (waitingForGoTo) {
            navigate({ to: "/agents" });
            clearGoToState();
          }
        },
        enabled: waitingForGoTo,
      },

      // Go to Waiting (agents waiting for input/approvals)
      {
        key: "w",
        action: () => {
          if (waitingForGoTo) {
            navigate({ to: "/agents", search: { status: "waiting" } });
            clearGoToState();
          }
        },
        enabled: waitingForGoTo,
      },

      // Escape to close go-to mode
      {
        key: "Escape",
        action: clearGoToState,
        enabled: waitingForGoTo,
      },
    ],
    [
      navigate,
      toggleSidebar,
      theme,
      setTheme,
      powerUserMode,
      setPowerUserMode,
      waitingForGoTo,
      clearGoToState,
    ]
  );

  // Register all shortcuts
  useKeyboardShortcuts(shortcuts);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (goToTimeoutRef.current) {
        clearTimeout(goToTimeoutRef.current);
      }
    };
  }, []);

  return (
    <>
      {children}

      <CommandPalette
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onShowShortcuts={() => {
          setCommandPaletteOpen(false);
          setShortcutsModalOpen(true);
        }}
      />

      <KeyboardShortcutsModal
        open={shortcutsModalOpen}
        onOpenChange={setShortcutsModalOpen}
      />
    </>
  );
}

export default ShortcutsProvider;

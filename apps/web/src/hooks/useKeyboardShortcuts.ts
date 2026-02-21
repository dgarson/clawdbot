
import * as React from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  allowInInputs?: boolean;
  preventDefault?: boolean;
  enabled?: boolean;
  action: () => void;
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {return false;}
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {return true;}
  return target.isContentEditable;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcut[]
) {
  const shortcutsRef = React.useRef(shortcuts);

  React.useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) {return;}

      const activeShortcuts = shortcutsRef.current.filter(
        (s) => s.enabled !== false
      );

      if (activeShortcuts.length === 0) {return;}
      if (!activeShortcuts.some((s) => s.allowInInputs) && isTypingTarget(e.target)) {
        return;
      }

      const key = e.key.toLowerCase();
      const match = activeShortcuts.find((s) => {
        if (s.key.toLowerCase() !== key) {return false;}
        if ((s.ctrl ?? false) !== e.ctrlKey) {return false;}
        if ((s.meta ?? false) !== e.metaKey) {return false;}
        if ((s.shift ?? false) !== e.shiftKey) {return false;}
        if ((s.alt ?? false) !== e.altKey) {return false;}
        return true;
      });

      if (!match) {return;}
      if (match.preventDefault !== false) {e.preventDefault();}
      match.action();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

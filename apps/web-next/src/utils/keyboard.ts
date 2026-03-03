/**
 * Keyboard Navigation Utilities
 * 
 * Common patterns for keyboard accessibility in React components.
 * These utilities implement WAI-ARIA best practices.
 */

// ==================== Focus Styles ====================

/**
 * Standard focus-visible styles for Tailwind CSS
 * Use on all interactive elements
 */
export const focusStyles = {
  base: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950",
  button: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500",
  input: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:border-violet-500",
  link: "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2",
};

// ==================== Keyboard Event Helpers ====================

/**
 * Check if event is a keyboard activation (Enter or Space)
 */
export function isActivationKey(e: React.KeyboardEvent): boolean {
  return e.key === 'Enter' || e.key === ' ';
}

/**
 * Check if event is an Escape key
 */
export function isEscapeKey(e: React.KeyboardEvent | KeyboardEvent): boolean {
  return e.key === 'Escape';
}

/**
 * Check if event is an arrow key
 */
export function isArrowKey(e: React.KeyboardEvent): boolean {
  return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key);
}

/**
 * Prevent default and stop propagation for keyboard events
 */
export function preventKeyboardEvent(e: React.KeyboardEvent): void {
  e.preventDefault();
  e.stopPropagation();
}

// ==================== Focus Management ====================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'button:not([disabled])',
    '[href]',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabIndex]:not([tabIndex="-1"])',
  ].join(', ');

  return Array.from(container.querySelectorAll<HTMLElement>(selector));
}

/**
 * Focus the first focusable element in a container
 */
export function focusFirst(container: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[0].focus();
    return true;
  }
  return false;
}

/**
 * Focus the last focusable element in a container
 */
export function focusLast(container: HTMLElement): boolean {
  const focusable = getFocusableElements(container);
  if (focusable.length > 0) {
    focusable[focusable.length - 1].focus();
    return true;
  }
  return false;
}

// ==================== Focus Trap Class ====================

/**
 * Class-based focus trap for imperative usage
 */
export class FocusTrap {
  private container: HTMLElement;
  private previousFocus: HTMLElement | null = null;
  private handleKeyDown: (e: KeyboardEvent) => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.handleKeyDown = this.trapFocus.bind(this);
  }

  activate(): void {
    // Save current focus
    this.previousFocus = document.activeElement as HTMLElement;

    // Move focus to container
    if (!focusFirst(this.container)) {
      this.container.focus();
    }

    // Add event listener
    document.addEventListener('keydown', this.handleKeyDown);
  }

  deactivate(): void {
    // Remove event listener
    document.removeEventListener('keydown', this.handleKeyDown);

    // Restore focus
    if (this.previousFocus) {
      this.previousFocus.focus();
    }
  }

  private trapFocus(e: KeyboardEvent): void {
    if (e.key !== 'Tab') return;

    const focusable = getFocusableElements(this.container);
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      // Shift+Tab
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      // Tab
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

// ==================== Keyboard Shortcuts ====================

interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: (e: KeyboardEvent) => void;
}

/**
 * Create a keyboard shortcut manager
 */
export function createShortcutManager() {
  const shortcuts: KeyboardShortcut[] = [];

  function register(shortcut: KeyboardShortcut): () => void {
    shortcuts.push(shortcut);
    return () => {
      const index = shortcuts.indexOf(shortcut);
      if (index > -1) shortcuts.splice(index, 1);
    };
  }

  function handle(e: KeyboardEvent): void {
    for (const shortcut of shortcuts) {
      const keyMatch = e.key.toLowerCase() === shortcut.key.toLowerCase();
      const ctrlMatch = shortcut.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const metaMatch = shortcut.meta ? e.metaKey : true;
      const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey;
      const altMatch = shortcut.alt ? e.altKey : !e.altKey;

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch && altMatch) {
        e.preventDefault();
        shortcut.handler(e);
        break;
      }
    }
  }

  return { register, handle };
}

// ==================== Type Exports ====================

export type { KeyboardShortcut };

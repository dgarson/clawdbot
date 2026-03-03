import { useEffect, useRef, RefObject } from 'react';

/**
 * Traps focus within a container element (for modals, dialogs, etc.)
 * 
 * @param isOpen - Whether the trap is active
 * @param containerRef - Ref to the container element
 * @returns void
 * 
 * @example
 * const modalRef = useRef<HTMLDivElement>(null);
 * useFocusTrap(isOpen, modalRef);
 * 
 * <div ref={modalRef} role="dialog" aria-modal="true">
 *   {modalContent}
 * </div>
 */
export function useFocusTrap<T extends HTMLElement>(
  isOpen: boolean,
  containerRef: RefObject<T | null>
): void {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    // Save current focus
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Move focus to container
    const focusable = containerRef.current.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabIndex]:not([tabIndex="-1"])'
    );
    
    if (focusable.length > 0) {
      focusable[0].focus();
    } else {
      containerRef.current.focus();
    }

    // Trap focus
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabIndex]:not([tabIndex="-1"])'
      );
      
      if (focusableElements.length === 0) return;

      const first = focusableElements[0];
      const last = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleTab);

    return () => {
      window.removeEventListener('keydown', handleTab);
      // Restore focus
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [isOpen, containerRef]);
}

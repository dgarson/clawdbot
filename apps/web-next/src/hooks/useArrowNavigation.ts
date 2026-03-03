import { useState, useCallback, useMemo } from 'react';

/**
 * Handles arrow key navigation for lists, menus, grids
 * 
 * @param itemCount - Number of items in the list
 * @param onSelect - Callback when item is selected (Enter/Space)
 * @param options - Configuration options
 * @returns Object with focusedIndex and event handlers
 * 
 * @example
 * const { focusedIndex, handleKeyDown, resetFocus } = useArrowNavigation(
 *   items.length,
 *   (index) => console.log('Selected:', items[index])
 * );
 * 
 * <ul onKeyDown={handleKeyDown}>
 *   {items.map((item, i) => (
 *     <li
 *       key={item.id}
 *       tabIndex={i === focusedIndex ? 0 : -1}
 *       className={i === focusedIndex ? 'focused' : ''}
 *     >
 *       {item.name}
 *     </li>
 *   ))}
 * </ul>
 */
interface ArrowNavigationOptions {
  /** Enable horizontal navigation (for grids) */
  horizontal?: boolean;
  /** Number of columns (for grids) */
  columns?: number;
  /** Wrap from last to first item */
  wrap?: boolean;
  /** Initial focused index */
  initialIndex?: number;
  /** Callback when focus changes */
  onFocusChange?: (index: number) => void;
}

export function useArrowNavigation(
  itemCount: number,
  onSelect: (index: number) => void,
  options: ArrowNavigationOptions = {}
) {
  const {
    horizontal = false,
    columns = 1,
    wrap = true,
    initialIndex = 0,
    onFocusChange,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(initialIndex);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex = focusedIndex;

      switch (e.key) {
        case 'ArrowDown':
          if (horizontal) return;
          e.preventDefault();
          newIndex = focusedIndex + 1;
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : focusedIndex;
          }
          break;

        case 'ArrowUp':
          if (horizontal) return;
          e.preventDefault();
          newIndex = focusedIndex - 1;
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0;
          }
          break;

        case 'ArrowRight':
          if (!horizontal && columns === 1) return;
          e.preventDefault();
          newIndex = focusedIndex + 1;
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : focusedIndex;
          }
          break;

        case 'ArrowLeft':
          if (!horizontal && columns === 1) return;
          e.preventDefault();
          newIndex = focusedIndex - 1;
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0;
          }
          break;

        case 'Enter':
        case ' ':
          e.preventDefault();
          onSelect(focusedIndex);
          return;

        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;

        case 'End':
          e.preventDefault();
          newIndex = itemCount - 1;
          break;

        case 'PageDown':
          e.preventDefault();
          newIndex = Math.min(focusedIndex + 10, itemCount - 1);
          break;

        case 'PageUp':
          e.preventDefault();
          newIndex = Math.max(focusedIndex - 10, 0);
          break;

        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        setFocusedIndex(newIndex);
        onFocusChange?.(newIndex);
      }
    },
    [focusedIndex, itemCount, horizontal, columns, wrap, onSelect, onFocusChange]
  );

  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex);
  }, [initialIndex]);

  const setFocus = useCallback((index: number) => {
    if (index >= 0 && index < itemCount) {
      setFocusedIndex(index);
      onFocusChange?.(index);
    }
  }, [itemCount, onFocusChange]);

  return useMemo(
    () => ({
      focusedIndex,
      handleKeyDown,
      resetFocus,
      setFocus,
    }),
    [focusedIndex, handleKeyDown, resetFocus, setFocus]
  );
}

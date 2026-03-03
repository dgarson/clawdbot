import { useState, useCallback, useRef, useEffect, useMemo } from 'react';

/**
 * Implements roving tabIndex pattern for composite widgets
 * (tab lists, menu bars, listboxes, grids)
 * 
 * Only one element in the group has tabIndex=0, others have tabIndex=-1.
 * Arrow keys move focus within the group.
 * 
 * @param itemCount - Number of items in the composite widget
 * @param options - Configuration options
 * @returns Object with focusedIndex, tabIndex, and event handlers
 * 
 * @example
 * const { focusedIndex, getTabIndex, handleKeyDown, handleFocus } = useRovingTabIndex(
 *   tabs.length,
 *   { orientation: 'horizontal' }
 * );
 * 
 * <div role="tablist" onKeyDown={handleKeyDown}>
 *   {tabs.map((tab, i) => (
 *     <button
 *       key={tab.id}
 *       role="tab"
 *       tabIndex={getTabIndex(i)}
 *       onFocus={() => handleFocus(i)}
 *       onClick={() => activateTab(i)}
 *     >
 *       {tab.label}
 *     </button>
 *   ))}
 * </div>
 */

interface RovingTabIndexOptions {
  /** Orientation: 'horizontal', 'vertical', or 'both' (for grids) */
  orientation?: 'horizontal' | 'vertical' | 'both';
  /** Number of columns (for grids with orientation='both') */
  columns?: number;
  /** Enable wrapping from last to first */
  wrap?: boolean;
  /** Initial focused index */
  initialIndex?: number;
  /** Callback when focus changes */
  onFocusChange?: (index: number) => void;
}

export function useRovingTabIndex(
  itemCount: number,
  options: RovingTabIndexOptions = {}
) {
  const {
    orientation = 'horizontal',
    columns = 1,
    wrap = true,
    initialIndex = 0,
    onFocusChange,
  } = options;

  const [focusedIndex, setFocusedIndex] = useState(initialIndex);
  const itemRefs = useRef<Map<number, HTMLElement>>(new Map());

  const getTabIndex = useCallback(
    (index: number) => (index === focusedIndex ? 0 : -1),
    [focusedIndex]
  );

  const registerItem = useCallback((index: number, element: HTMLElement | null) => {
    if (element) {
      itemRefs.current.set(index, element);
    } else {
      itemRefs.current.delete(index);
    }
  }, []);

  const focusItem = useCallback(
    (index: number) => {
      const item = itemRefs.current.get(index);
      if (item) {
        item.focus();
        setFocusedIndex(index);
        onFocusChange?.(index);
      }
    },
    [onFocusChange]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      let newIndex = focusedIndex;
      let shouldPreventDefault = true;

      switch (e.key) {
        case 'ArrowRight':
          if (orientation === 'vertical') return;
          e.preventDefault();
          newIndex = focusedIndex + 1;
          if (newIndex >= itemCount) {
            newIndex = wrap ? 0 : focusedIndex;
          }
          break;

        case 'ArrowLeft':
          if (orientation === 'vertical') return;
          e.preventDefault();
          newIndex = focusedIndex - 1;
          if (newIndex < 0) {
            newIndex = wrap ? itemCount - 1 : 0;
          }
          break;

        case 'ArrowDown':
          if (orientation === 'horizontal') return;
          e.preventDefault();
          if (orientation === 'both' && columns > 1) {
            // Grid navigation
            newIndex = focusedIndex + columns;
            if (newIndex >= itemCount) {
              newIndex = wrap ? newIndex % itemCount : focusedIndex;
            }
          } else {
            // Vertical list navigation
            newIndex = focusedIndex + 1;
            if (newIndex >= itemCount) {
              newIndex = wrap ? 0 : focusedIndex;
            }
          }
          break;

        case 'ArrowUp':
          if (orientation === 'horizontal') return;
          e.preventDefault();
          if (orientation === 'both' && columns > 1) {
            // Grid navigation
            newIndex = focusedIndex - columns;
            if (newIndex < 0) {
              newIndex = wrap ? itemCount + newIndex : 0;
            }
          } else {
            // Vertical list navigation
            newIndex = focusedIndex - 1;
            if (newIndex < 0) {
              newIndex = wrap ? itemCount - 1 : 0;
            }
          }
          break;

        case 'Home':
          e.preventDefault();
          newIndex = 0;
          break;

        case 'End':
          e.preventDefault();
          newIndex = itemCount - 1;
          break;

        default:
          return;
      }

      if (newIndex !== focusedIndex) {
        focusItem(newIndex);
      }
    },
    [focusedIndex, itemCount, orientation, columns, wrap, focusItem]
  );

  const handleFocus = useCallback(
    (index: number) => {
      setFocusedIndex(index);
      onFocusChange?.(index);
    },
    [onFocusChange]
  );

  const resetFocus = useCallback(() => {
    setFocusedIndex(initialIndex);
    focusItem(initialIndex);
  }, [initialIndex, focusItem]);

  return useMemo(
    () => ({
      focusedIndex,
      getTabIndex,
      registerItem,
      handleKeyDown,
      handleFocus,
      resetFocus,
      focusItem,
    }),
    [focusedIndex, getTabIndex, registerItem, handleKeyDown, handleFocus, resetFocus, focusItem]
  );
}

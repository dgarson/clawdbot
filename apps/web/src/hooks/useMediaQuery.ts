import { useSyncExternalStore } from "react";

/**
 * Subscribes to a CSS media query and returns whether it matches.
 *
 * @param query - The CSS media query string (e.g., "(min-width: 768px)")
 * @returns Whether the media query currently matches
 *
 * @example
 * ```tsx
 * const isMobile = useMediaQuery("(max-width: 767px)");
 * const isTablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
 * const isDesktop = useMediaQuery("(min-width: 1024px)");
 * const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
 * const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
 *
 * return isMobile ? <MobileNav /> : <DesktopNav />;
 * ```
 */
export function useMediaQuery(query: string): boolean {
  const getServerSnapshot = () => false;

  const getSnapshot = () => {
    if (typeof window === "undefined" || !window.matchMedia) {return false;}
    return window.matchMedia(query).matches;
  };

  const subscribe = (onStoreChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) {return () => {};}

    const mediaQueryList = window.matchMedia(query);
    const handler = () => onStoreChange();

    if (mediaQueryList.addEventListener) {
      mediaQueryList.addEventListener("change", handler);
      return () => mediaQueryList.removeEventListener("change", handler);
    }

    mediaQueryList.addListener(handler);
    return () => mediaQueryList.removeListener(handler);
  };

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/**
 * Common breakpoint hooks for convenience
 */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}

export function useIsTablet(): boolean {
  return useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
}

export function useIsDesktop(): boolean {
  return useMediaQuery("(min-width: 1024px)");
}

export function useIsLargeDesktop(): boolean {
  return useMediaQuery("(min-width: 1280px)");
}

export function usePrefersDarkMode(): boolean {
  return useMediaQuery("(prefers-color-scheme: dark)");
}

export function usePrefersReducedMotion(): boolean {
  return useMediaQuery("(prefers-reduced-motion: reduce)");
}

export function usePrefersContrast(): boolean {
  return useMediaQuery("(prefers-contrast: more)");
}

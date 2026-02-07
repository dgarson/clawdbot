import { useEffect, useRef } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * Lightweight parallax for desktop only.
 * Animates transform: translate3d on supplied refs based on scroll position.
 * Disabled on mobile, touch devices, and when reduced motion is preferred.
 */
export function useParallaxLite(
  enabled: boolean,
  heroRef: React.RefObject<HTMLElement | null>
) {
  const reducedMotion = useReducedMotion();
  const rafId = useRef<number | null>(null);
  const latestScrollY = useRef(0);
  const isHeroVisible = useRef(true);

  useEffect(() => {
    if (!enabled || reducedMotion) return;

    // Only enable on pointer devices with hover
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!canHover) return;

    const hero = heroRef.current;
    if (!hero) return;

    // Track hero visibility to avoid unnecessary updates
    const visibilityObserver = new IntersectionObserver(
      ([entry]) => {
        isHeroVisible.current = entry.isIntersecting;
      },
      { threshold: 0 }
    );
    visibilityObserver.observe(hero);

    const onScroll = () => {
      latestScrollY.current = window.scrollY;
      if (rafId.current != null || !isHeroVisible.current) return;

      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        const floaters = hero.querySelectorAll<HTMLElement>("[data-parallax]");
        const y = latestScrollY.current;
        floaters.forEach((el) => {
          const speed = parseFloat(el.dataset.parallax ?? "0.06");
          el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
        });
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId.current != null) window.cancelAnimationFrame(rafId.current);
      visibilityObserver.disconnect();
    };
  }, [enabled, reducedMotion, heroRef]);
}

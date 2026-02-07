import { useEffect } from "react";
import { useReducedMotion } from "./useReducedMotion";

/**
 * IntersectionObserver-based scroll reveal.
 * Targets elements with `data-reveal` attribute; sets `data-reveal="visible"` once.
 * Respects prefers-reduced-motion: renders everything visible immediately.
 */
export function useRevealOnScroll(root?: Element | null) {
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    const container = root ?? document;
    const targets = Array.from(
      container.querySelectorAll<HTMLElement>("[data-reveal]")
    );
    if (targets.length === 0) return;

    // Reduced motion: show everything immediately
    if (reducedMotion) {
      targets.forEach((el) => el.setAttribute("data-reveal", "visible"));
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          el.setAttribute("data-reveal", "visible");
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" }
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root, reducedMotion]);
}

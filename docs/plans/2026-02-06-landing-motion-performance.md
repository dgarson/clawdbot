# Landing Motion and Performance Plan (Keep the Vibe, Lose the Jank)

**Date:** 2026-02-06  
**Applies to:** `/landing` and `/unlock` in `apps/web/*`

This document describes how to keep the premium “ambient intelligence” feel (aurora backgrounds, subtle motion, progressive disclosure) while minimizing CPU/GPU cost.

---

## 1) Performance goals (concrete)

1. Maintain smooth scrolling on mid-tier laptops and mobile devices.
2. Avoid continuous expensive effects (blur/filter repaints, heavy shadows).
3. Prefer animations that are compositor-friendly:
   - `transform` and `opacity` only
4. Respect user preferences:
   - `prefers-reduced-motion: reduce` disables continuous and scroll-linked motion

---

## 2) Animation principles (what we animate, and what we never animate)

### Safe to animate (preferred)

- `opacity`
- `transform` (`translate3d`, `scale`, small rotates)

### Avoid animating (expensive / jank-prone)

- `filter` (blur, brightness)
- `backdrop-filter`
- `box-shadow` (especially large glows)
- `background-position` on large elements
- layout-affecting properties (`top`, `left`, `height`, `width`)

If you need a glow that “changes”, animate the opacity of a pseudo-element instead of animating box-shadow.

---

## 3) “Aurora + mesh” background (performance-friendly recipe)

### Baseline (static)

- Use a static gradient stack for the background.
- Apply it to a single element that never changes size.

### Optional motion (transform-only drift)

If you want subtle background movement:

- Put the mesh on a pseudo-element.
- Animate it with a slow `transform` drift (e.g., 20–40s).
- Keep opacity low.

Constraints:

- One animated background layer only.
- Disable it when `prefers-reduced-motion: reduce`.

---

## 4) Floating “agent cards” (keep, but make it cheap)

Instead of scroll-coupled parallax by default, prefer:

### Default: keyframe float loops

- Each card uses a slow `transform: translate3d()` loop.
- Slightly different phase/direction per card to avoid a “marching” look.
- Hover interactions are transform-only.

### Optional: “parallax-lite” (desktop only, rAF throttled)

If scroll-linked parallax is desired:

- Enable only on:
  - pointer devices that support hover
  - wider viewports
  - when reduced motion is not set
- Update transforms in `requestAnimationFrame` (not per scroll event).
- Update only while the hero is in view (IntersectionObserver enables/disables loop).

This keeps the feature without paying the cost on mobile or when it won’t be noticed.

Pseudocode sketch (React-ish, transform-only):

```ts
function useParallaxLite(enabled: boolean) {
  const rafId = useRef<number | null>(null);
  const latestScrollY = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const onScroll = () => {
      latestScrollY.current = window.scrollY;
      if (rafId.current != null) return;
      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        // Update a tiny number of elements only:
        // element.style.transform = `translate3d(0, ${latestScrollY.current * 0.06}px, 0)`;
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId.current != null) window.cancelAnimationFrame(rafId.current);
    };
  }, [enabled]);
}
```

---

## 5) Scroll reveal: progressive disclosure without heavy frameworks

### Approach

Use one IntersectionObserver per page (or per section) and toggle a CSS class:

- Initial: `opacity: 0; transform: translateY(16px)`
- Visible: `opacity: 1; transform: translateY(0)`

### Constraints

- Reveal only once (unobserve after first intersect).
- Keep transitions short (300–600ms).
- Stagger only within small groups (3–8 children), not across the entire page.

### Reduced motion

When reduced motion is enabled:

- Render everything in its final state (no transitions).

Pseudocode sketch (single observer, reveal-once):

```ts
function useRevealOnScroll(root?: Element | null) {
  useEffect(() => {
    const targets = Array.from((root ?? document).querySelectorAll<HTMLElement>("[data-reveal]"));
    if (targets.length === 0) return;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) {
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
      { threshold: 0.12, rootMargin: "0px 0px -10% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [root]);
}
```

---

## 6) Glassmorphism: “glass where it matters”, with fallbacks

`backdrop-filter: blur()` can be expensive and is not universally supported.

Recommendation:

- Use glass only for:
  - hero deliverable preview card
  - a single control/approval mock card
- Provide fallback:
  - same layout, with a higher-opacity background and no blur

Never animate blur. If you want a “focus” effect, animate a border opacity or a glow pseudo-element.

---

## 7) Page-level performance tricks (low risk, high reward)

1. **Lazy load below-the-fold sections**
   - Use route-level code splitting or component lazy loading for heavy sections (e.g., video modal).

2. **`content-visibility: auto` for deep sections**
   - Apply to sections far below the fold to reduce initial render cost.

3. **Containment**
   - Use `contain: layout paint` on large sections when possible to limit paint invalidation.

4. **Image hygiene**
   - Compress images, set explicit width/height, and avoid huge background images.

---

## 8) What to measure (so we don’t guess)

Before shipping:

- Record a Performance profile while scrolling the full page.
- Confirm:
  - no long “Recalculate Style” spikes
  - no continuous paints from blur-heavy layers
  - stable FPS during scroll

In DevTools:

- Check “Layers” (too many layers can hurt)
- Check “Rendering → Paint flashing” (avoid constant repaint areas)

---

## 9) Implementation checklist (motion/perf)

- Implement “aurora” as static gradients + optional transform drift (reduced motion safe).
- Replace blur-based entrance animations with transform/opacity entrances.
- Make floating cards float by keyframes by default; add optional parallax-lite only on desktop.
- Use IntersectionObserver reveals that unobserve after first visible.
- Guard all motion behind `prefers-reduced-motion`.
- Limit glass to 1–2 elements per viewport with fallbacks.

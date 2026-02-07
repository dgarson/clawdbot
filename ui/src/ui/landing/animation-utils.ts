/**
 * Animation utilities for the landing page
 */

/**
 * Intersection Observer for scroll-triggered animations
 */
export function createScrollObserver(options: IntersectionObserverInit = {}): IntersectionObserver {
  const defaultOptions: IntersectionObserverInit = {
    root: null,
    rootMargin: "0px 0px -10% 0px",
    threshold: 0.1,
    ...options,
  };

  return new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
      }
    });
  }, defaultOptions);
}

/**
 * Parallax scroll effect with rAF throttling for smooth 60fps performance.
 * Also manages the `in-viewport` class on parallax layers to only
 * apply `will-change: transform` when visible (saves GPU memory).
 */
export function initParallax(container: HTMLElement): () => void {
  const layers = container.querySelectorAll<HTMLElement>(".parallax-layer");
  let rafId = 0;

  // Cache computed parallax speeds so we don't read getComputedStyle on every frame
  const speeds = new Map<HTMLElement, number>();
  layers.forEach((layer) => {
    const speed = parseFloat(getComputedStyle(layer).getPropertyValue("--parallax-speed") || "0.5");
    speeds.set(layer, speed);
  });

  // Track viewport visibility of parallax layers
  let visibilityObserver: IntersectionObserver | null = null;
  if ("IntersectionObserver" in window) {
    visibilityObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("in-viewport");
          } else {
            entry.target.classList.remove("in-viewport");
          }
        }
      },
      { rootMargin: "50px 0px", threshold: 0 },
    );
    layers.forEach((layer) => visibilityObserver!.observe(layer));
  } else {
    // Fallback: always mark as in-viewport
    layers.forEach((layer) => layer.classList.add("in-viewport"));
  }

  function updateParallax() {
    const scrollY = window.scrollY;
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top + scrollY;
    const relativeScroll = scrollY - containerTop;

    layers.forEach((layer) => {
      // Only update layers that are in/near the viewport
      if (!layer.classList.contains("in-viewport")) return;
      const speed = speeds.get(layer) ?? 0.5;
      const yOffset = relativeScroll * speed;
      layer.style.setProperty("--parallax-y", `${yOffset}px`);
    });
  }

  function onScroll() {
    if (rafId) return; // already scheduled
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      updateParallax();
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  updateParallax();

  return () => {
    window.removeEventListener("scroll", onScroll);
    if (rafId) cancelAnimationFrame(rafId);
    visibilityObserver?.disconnect();
  };
}

/**
 * Text rotation animation controller
 */
export class TextRotator {
  private element: HTMLElement;
  private texts: string[];
  private currentIndex = 0;
  private interval: number;
  private timerId?: ReturnType<typeof setInterval>;

  constructor(element: HTMLElement, texts: string[], interval = 3000) {
    this.element = element;
    this.texts = texts;
    this.interval = interval;
  }

  start(): void {
    this.render();
    this.timerId = setInterval(() => this.next(), this.interval);
  }

  stop(): void {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private next(): void {
    this.currentIndex = (this.currentIndex + 1) % this.texts.length;
    this.animate();
  }

  private animate(): void {
    this.element.style.animation = "textRotateOut 0.4s ease-in forwards";

    setTimeout(() => {
      this.render();
      this.element.style.animation = "textRotateIn 0.4s ease-out forwards";
    }, 400);
  }

  private render(): void {
    this.element.textContent = this.texts[this.currentIndex];
  }
}

/**
 * Smooth scroll to anchor
 */
export function smoothScrollTo(target: string | HTMLElement): void {
  const element = typeof target === "string" ? document.querySelector(target) : target;

  if (element) {
    element.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }
}

/**
 * Staggered animation for multiple elements
 */
export function staggerAnimation(
  elements: NodeListOf<Element> | Element[],
  animationClass: string,
  staggerMs = 100,
): void {
  Array.from(elements).forEach((el, index) => {
    setTimeout(() => {
      el.classList.add(animationClass);
    }, index * staggerMs);
  });
}

/**
 * Debounce utility for scroll handlers
 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Throttle utility for scroll handlers
 */
export function throttle<T extends (...args: unknown[]) => void>(
  fn: T,
  limit: number,
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

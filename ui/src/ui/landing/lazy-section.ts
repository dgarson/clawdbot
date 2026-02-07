/**
 * Lazy Section Loader for Landing Page
 *
 * Uses IntersectionObserver to defer loading below-fold section modules
 * until they're near the viewport. This reduces initial bundle parse
 * time and speeds up First Contentful Paint (FCP).
 *
 * The approach leverages Custom Element "upgrade" semantics: we render
 * section tags immediately (e.g. <landing-features>) but only load
 * the defining module when the element enters the viewport. The browser
 * automatically upgrades the element once the module registers it.
 */

type ImportFn = () => Promise<unknown>;

interface LazySectionEntry {
  importFn: ImportFn;
  loaded: boolean;
  loading: boolean;
}

/** Registry of section tag names → their dynamic import functions */
const registry = new Map<string, LazySectionEntry>();

/** IntersectionObserver shared across all lazy sections */
let sharedObserver: IntersectionObserver | null = null;

/** Elements waiting for their module to load */
const pendingElements = new Map<Element, string>();

/**
 * Register a section for lazy loading.
 * Call this before the landing page renders.
 */
export function registerLazySection(tagName: string, importFn: ImportFn): void {
  if (registry.has(tagName)) return;
  registry.set(tagName, { importFn, loaded: false, loading: false });
}

/**
 * Observe an element for lazy-loading its corresponding section module.
 * Should be called after the element is in the DOM.
 */
export function observeSection(element: Element, tagName: string): void {
  const entry = registry.get(tagName);
  if (!entry) return;

  // Already loaded — nothing to do
  if (entry.loaded) return;

  // If IntersectionObserver isn't available, load immediately
  if (!("IntersectionObserver" in window)) {
    loadSection(tagName);
    return;
  }

  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const ioEntry of entries) {
          if (ioEntry.isIntersecting) {
            const sectionTag = pendingElements.get(ioEntry.target);
            if (sectionTag) {
              loadSection(sectionTag);
              sharedObserver?.unobserve(ioEntry.target);
              pendingElements.delete(ioEntry.target);
            }
          }
        }

        // Clean up observer when no more pending elements
        if (pendingElements.size === 0 && sharedObserver) {
          sharedObserver.disconnect();
          sharedObserver = null;
        }
      },
      {
        // Start loading when section is within 300px of the viewport
        rootMargin: "300px 0px",
        threshold: 0,
      },
    );
  }

  pendingElements.set(element, tagName);
  sharedObserver.observe(element);
}

/**
 * Trigger loading of a section module.
 */
async function loadSection(tagName: string): Promise<void> {
  const entry = registry.get(tagName);
  if (!entry || entry.loaded || entry.loading) return;

  entry.loading = true;
  try {
    await entry.importFn();
    entry.loaded = true;
  } catch (err) {
    console.error(`[lazy-section] Failed to load ${tagName}:`, err);
    entry.loading = false;
    // Retry once after a short delay
    setTimeout(async () => {
      if (entry.loaded) return;
      entry.loading = true;
      try {
        await entry.importFn();
        entry.loaded = true;
      } catch (retryErr) {
        console.error(`[lazy-section] Retry failed for ${tagName}:`, retryErr);
        entry.loading = false;
      }
    }, 2000);
  }
}

/**
 * Eagerly load all remaining sections (e.g. after user interaction).
 * Useful for prefetching on idle.
 */
export function preloadAllSections(): void {
  for (const [tagName] of registry) {
    loadSection(tagName);
  }
}

/**
 * Clean up the shared observer. Call on landing page disconnect.
 */
export function cleanupLazyObserver(): void {
  if (sharedObserver) {
    sharedObserver.disconnect();
    sharedObserver = null;
  }
  pendingElements.clear();
}

// ── Register all below-fold sections ──

registerLazySection("landing-features", () => import("./sections/features-section"));
registerLazySection("landing-understanding", () => import("./sections/understanding-section"));
registerLazySection("landing-control", () => import("./sections/control-section"));
registerLazySection("landing-activity", () => import("./sections/activity-section"));
registerLazySection("landing-social-proof", () => import("./sections/social-proof-section"));
registerLazySection("landing-footer", () => import("./sections/footer-section"));

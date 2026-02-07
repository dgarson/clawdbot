/**
 * SEO Meta Tag Manager for Clawdbrain Landing Page
 *
 * Provides utilities to dynamically update meta tags, Open Graph tags,
 * Twitter card tags, and JSON-LD structured data for SEO optimization.
 *
 * The static/default meta tags are defined in ui/index.html.
 * This module provides runtime utilities for dynamic updates
 * (e.g., when navigating between views within the SPA).
 */

/** SEO metadata configuration */
export interface SeoMeta {
  title?: string;
  description?: string;
  canonicalUrl?: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: string;
  twitterCard?: "summary" | "summary_large_image";
  keywords?: string[];
  noIndex?: boolean;
}

/** Default SEO values for the landing page */
export const LANDING_SEO_DEFAULTS: Required<
  Pick<SeoMeta, "title" | "description" | "canonicalUrl" | "ogType" | "twitterCard" | "keywords">
> = {
  title: "Clawdbrain — Autonomous AI Agent Orchestration Platform",
  description:
    "Orchestrate autonomous AI agents with persistent memory, human-in-the-loop approvals, and full observability. Coordinate specialized agents to plan, execute, and verify work across your stack.",
  canonicalUrl: "https://clawdbrain.com",
  ogType: "website",
  twitterCard: "summary_large_image",
  keywords: [
    "AI agents",
    "autonomous agents",
    "agent orchestration",
    "AI orchestration platform",
    "human-in-the-loop",
    "AI observability",
    "agentic workflows",
    "LLM agents",
    "multi-agent systems",
  ],
};

/**
 * Update document meta tags for SEO.
 * Merges provided values with defaults.
 */
export function updateSeoMeta(meta: SeoMeta): void {
  const title = meta.title ?? LANDING_SEO_DEFAULTS.title;
  const description = meta.description ?? LANDING_SEO_DEFAULTS.description;
  const canonicalUrl = meta.canonicalUrl ?? LANDING_SEO_DEFAULTS.canonicalUrl;
  const ogType = meta.ogType ?? LANDING_SEO_DEFAULTS.ogType;
  const twitterCard = meta.twitterCard ?? LANDING_SEO_DEFAULTS.twitterCard;
  const keywords = meta.keywords ?? LANDING_SEO_DEFAULTS.keywords;

  // Title
  document.title = title;
  setMetaTag("name", "title", title);

  // Description
  setMetaTag("name", "description", description);

  // Robots
  if (meta.noIndex) {
    setMetaTag("name", "robots", "noindex, nofollow");
  } else {
    setMetaTag("name", "robots", "index, follow");
  }

  // Canonical URL
  setCanonicalUrl(canonicalUrl);

  // Open Graph
  setMetaTag("property", "og:title", title);
  setMetaTag("property", "og:description", description);
  setMetaTag("property", "og:url", canonicalUrl);
  setMetaTag("property", "og:type", ogType);
  if (meta.ogImage) {
    setMetaTag("property", "og:image", meta.ogImage);
  }
  if (meta.ogImageAlt) {
    setMetaTag("property", "og:image:alt", meta.ogImageAlt);
  }

  // Twitter Card
  setMetaTag("name", "twitter:card", twitterCard);
  setMetaTag("name", "twitter:title", title);
  setMetaTag("name", "twitter:description", description);
  setMetaTag("name", "twitter:url", canonicalUrl);
  if (meta.ogImage) {
    setMetaTag("name", "twitter:image", meta.ogImage);
  }
  if (meta.ogImageAlt) {
    setMetaTag("name", "twitter:image:alt", meta.ogImageAlt);
  }

  // Keywords
  if (keywords.length) {
    setMetaTag("name", "keywords", keywords.join(", "));
  }
}

/**
 * Reset meta tags to landing page defaults.
 */
export function resetSeoMeta(): void {
  updateSeoMeta({
    title: LANDING_SEO_DEFAULTS.title,
    description: LANDING_SEO_DEFAULTS.description,
    canonicalUrl: LANDING_SEO_DEFAULTS.canonicalUrl,
    ogType: LANDING_SEO_DEFAULTS.ogType,
    twitterCard: LANDING_SEO_DEFAULTS.twitterCard,
    keywords: LANDING_SEO_DEFAULTS.keywords,
  });
}

/**
 * Inject or update a JSON-LD structured data block.
 * Uses a data-seo-id attribute to identify and update existing blocks.
 */
export function injectJsonLd(id: string, data: Record<string, unknown>): void {
  const selector = `script[type="application/ld+json"][data-seo-id="${id}"]`;
  let script = document.querySelector(selector) as HTMLScriptElement | null;
  if (!script) {
    script = document.createElement("script");
    script.type = "application/ld+json";
    script.setAttribute("data-seo-id", id);
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify(data);
}

/**
 * Remove a JSON-LD structured data block by id.
 */
export function removeJsonLd(id: string): void {
  const selector = `script[type="application/ld+json"][data-seo-id="${id}"]`;
  document.querySelector(selector)?.remove();
}

/**
 * Set the canonical URL link element.
 */
function setCanonicalUrl(url: string): void {
  let link = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = url;
}

/**
 * Set or create a meta tag by attribute type and name.
 */
function setMetaTag(
  attr: "name" | "property",
  name: string,
  content: string,
): void {
  const selector = `meta[${attr}="${name}"]`;
  let el = document.querySelector(selector) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.content = content;
}

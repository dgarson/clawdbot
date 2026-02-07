import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  updateSeoMeta,
  resetSeoMeta,
  injectJsonLd,
  removeJsonLd,
  LANDING_SEO_DEFAULTS,
  type SeoMeta,
} from "./seo-meta";

describe("seo-meta", () => {
  /** Remove all meta tags and canonical link we create during tests */
  function cleanupHead(): void {
    const selectors = [
      'meta[name="title"]',
      'meta[name="description"]',
      'meta[name="robots"]',
      'meta[name="keywords"]',
      'meta[name="twitter:card"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
      'meta[name="twitter:url"]',
      'meta[name="twitter:image"]',
      'meta[name="twitter:image:alt"]',
      'meta[property="og:title"]',
      'meta[property="og:description"]',
      'meta[property="og:url"]',
      'meta[property="og:type"]',
      'meta[property="og:image"]',
      'meta[property="og:image:alt"]',
      'link[rel="canonical"]',
      'script[type="application/ld+json"][data-seo-id]',
    ];
    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    }
  }

  beforeEach(() => {
    cleanupHead();
  });

  afterEach(() => {
    cleanupHead();
  });

  it("LANDING_SEO_DEFAULTS should have correct values", () => {
    expect(LANDING_SEO_DEFAULTS.title).toContain("Clawdbrain");
    expect(LANDING_SEO_DEFAULTS.description).toContain("autonomous AI agents");
    expect(LANDING_SEO_DEFAULTS.canonicalUrl).toBe("https://clawdbrain.com");
    expect(LANDING_SEO_DEFAULTS.ogType).toBe("website");
    expect(LANDING_SEO_DEFAULTS.twitterCard).toBe("summary_large_image");
    expect(LANDING_SEO_DEFAULTS.keywords).toContain("AI agents");
  });

  it("updateSeoMeta should set document title", () => {
    updateSeoMeta({ title: "Test Title" });
    expect(document.title).toBe("Test Title");
  });

  it("updateSeoMeta should set meta name=title", () => {
    updateSeoMeta({ title: "Test Title" });
    const el = document.querySelector('meta[name="title"]') as HTMLMetaElement;
    expect(el).not.toBeNull();
    expect(el.content).toBe("Test Title");
  });

  it("updateSeoMeta should set meta name=description", () => {
    updateSeoMeta({ description: "A great description" });
    const el = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(el).not.toBeNull();
    expect(el.content).toBe("A great description");
  });

  it("updateSeoMeta should set canonical URL", () => {
    updateSeoMeta({ canonicalUrl: "https://example.com/page" });
    const el = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    expect(el).not.toBeNull();
    expect(el.href).toBe("https://example.com/page");
  });

  it("updateSeoMeta should set Open Graph tags", () => {
    const meta: SeoMeta = {
      title: "OG Title",
      description: "OG Description",
      ogImage: "https://example.com/og.png",
      ogImageAlt: "OG image alt text",
      ogType: "article",
    };
    updateSeoMeta(meta);

    expect(
      (document.querySelector('meta[property="og:title"]') as HTMLMetaElement)?.content,
    ).toBe("OG Title");
    expect(
      (document.querySelector('meta[property="og:description"]') as HTMLMetaElement)?.content,
    ).toBe("OG Description");
    expect(
      (document.querySelector('meta[property="og:image"]') as HTMLMetaElement)?.content,
    ).toBe("https://example.com/og.png");
    expect(
      (document.querySelector('meta[property="og:image:alt"]') as HTMLMetaElement)?.content,
    ).toBe("OG image alt text");
    expect(
      (document.querySelector('meta[property="og:type"]') as HTMLMetaElement)?.content,
    ).toBe("article");
  });

  it("updateSeoMeta should set Twitter Card tags", () => {
    const meta: SeoMeta = {
      title: "Twitter Title",
      description: "Twitter Desc",
      twitterCard: "summary",
      ogImage: "https://example.com/tw.png",
      ogImageAlt: "Twitter alt",
    };
    updateSeoMeta(meta);

    expect(
      (document.querySelector('meta[name="twitter:card"]') as HTMLMetaElement)?.content,
    ).toBe("summary");
    expect(
      (document.querySelector('meta[name="twitter:title"]') as HTMLMetaElement)?.content,
    ).toBe("Twitter Title");
    expect(
      (document.querySelector('meta[name="twitter:description"]') as HTMLMetaElement)?.content,
    ).toBe("Twitter Desc");
    expect(
      (document.querySelector('meta[name="twitter:image"]') as HTMLMetaElement)?.content,
    ).toBe("https://example.com/tw.png");
    expect(
      (document.querySelector('meta[name="twitter:image:alt"]') as HTMLMetaElement)?.content,
    ).toBe("Twitter alt");
  });

  it("updateSeoMeta should set keywords", () => {
    updateSeoMeta({ keywords: ["ai", "agents", "orchestration"] });
    const el = document.querySelector('meta[name="keywords"]') as HTMLMetaElement;
    expect(el).not.toBeNull();
    expect(el.content).toBe("ai, agents, orchestration");
  });

  it("updateSeoMeta should set robots noindex when specified", () => {
    updateSeoMeta({ noIndex: true });
    const el = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    expect(el).not.toBeNull();
    expect(el.content).toBe("noindex, nofollow");
  });

  it("updateSeoMeta should set robots index by default", () => {
    updateSeoMeta({});
    const el = document.querySelector('meta[name="robots"]') as HTMLMetaElement;
    expect(el).not.toBeNull();
    expect(el.content).toBe("index, follow");
  });

  it("updateSeoMeta should use defaults for missing values", () => {
    updateSeoMeta({});
    expect(document.title).toBe(LANDING_SEO_DEFAULTS.title);
    expect(
      (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content,
    ).toBe(LANDING_SEO_DEFAULTS.description);
  });

  it("updateSeoMeta should update existing meta tags rather than duplicate", () => {
    updateSeoMeta({ title: "First" });
    updateSeoMeta({ title: "Second" });
    const tags = document.querySelectorAll('meta[name="title"]');
    expect(tags.length).toBe(1);
    expect((tags[0] as HTMLMetaElement).content).toBe("Second");
  });

  it("updateSeoMeta should update existing canonical rather than duplicate", () => {
    updateSeoMeta({ canonicalUrl: "https://a.com" });
    updateSeoMeta({ canonicalUrl: "https://b.com" });
    const links = document.querySelectorAll('link[rel="canonical"]');
    expect(links.length).toBe(1);
    expect((links[0] as HTMLLinkElement).href).toBe("https://b.com/");
  });

  it("resetSeoMeta should restore defaults", () => {
    updateSeoMeta({ title: "Custom Title", description: "Custom Desc" });
    resetSeoMeta();
    expect(document.title).toBe(LANDING_SEO_DEFAULTS.title);
    expect(
      (document.querySelector('meta[name="description"]') as HTMLMetaElement)?.content,
    ).toBe(LANDING_SEO_DEFAULTS.description);
  });

  describe("JSON-LD", () => {
    it("injectJsonLd should create a new script element", () => {
      injectJsonLd("test-schema", { "@context": "https://schema.org", "@type": "WebSite", name: "Test" });
      const script = document.querySelector('script[data-seo-id="test-schema"]');
      expect(script).not.toBeNull();
      expect(JSON.parse(script!.textContent!)).toEqual({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Test",
      });
    });

    it("injectJsonLd should update existing script element", () => {
      injectJsonLd("test-schema", { "@type": "WebSite", name: "First" });
      injectJsonLd("test-schema", { "@type": "WebSite", name: "Second" });
      const scripts = document.querySelectorAll('script[data-seo-id="test-schema"]');
      expect(scripts.length).toBe(1);
      expect(JSON.parse(scripts[0].textContent!).name).toBe("Second");
    });

    it("removeJsonLd should remove the script element", () => {
      injectJsonLd("test-schema", { "@type": "WebSite" });
      expect(document.querySelector('script[data-seo-id="test-schema"]')).not.toBeNull();
      removeJsonLd("test-schema");
      expect(document.querySelector('script[data-seo-id="test-schema"]')).toBeNull();
    });

    it("removeJsonLd should not throw for non-existent id", () => {
      expect(() => removeJsonLd("nonexistent")).not.toThrow();
    });
  });
});

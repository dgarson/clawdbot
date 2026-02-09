import { describe, expect, it, beforeEach } from "vitest";
import { shouldProcessNotionEvent, resetNotionDedup } from "./notion-dedup.js";

describe("shouldProcessNotionEvent", () => {
  beforeEach(() => {
    resetNotionDedup();
  });

  it("allows first event for an entity", () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 30_000)).toBe(true);
  });

  it("deduplicates same entity+type within window", () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 30_000)).toBe(true);
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 30_000)).toBe(false);
  });

  it("allows same entity with different event type", () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 30_000)).toBe(true);
    expect(shouldProcessNotionEvent("page-1", "page.properties_updated", 30_000)).toBe(true);
  });

  it("allows different entities with same event type", () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 30_000)).toBe(true);
    expect(shouldProcessNotionEvent("page-2", "page.content_updated", 30_000)).toBe(true);
  });

  it("allows event after window expires", async () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 10)).toBe(true);
    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 10)).toBe(true);
  });

  it("window of 0 effectively disables dedup (always allows)", () => {
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 0)).toBe(true);
    // With window=0, the timestamp check (now - lastSeen < 0) is always false
    expect(shouldProcessNotionEvent("page-1", "page.content_updated", 0)).toBe(true);
  });
});

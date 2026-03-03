import { describe, expect, it, vi } from "vitest";
import type {
  PromptSectionContext,
  PromptSectionRegistration,
} from "../plugins/types.prompt-sections.js";
import {
  collectPluginPromptSections,
  getSlotContent,
  isCoreSlotReplaced,
  type PluginPromptSection,
} from "./system-prompt.plugin-sections.js";

const testCtx: PromptSectionContext = { agentId: "test", sessionKey: "test:main" };

function makeSection(
  overrides: Partial<PromptSectionRegistration> & { name: string },
): PromptSectionRegistration {
  return {
    pluginId: overrides.pluginId ?? "test-plugin",
    name: overrides.name,
    builder: overrides.builder ?? vi.fn(() => `content from ${overrides.name}`),
    priority: overrides.priority ?? 100,
    slot: overrides.slot ?? "end",
    condition: overrides.condition,
    addHeading: overrides.addHeading ?? false,
  };
}

describe("collectPluginPromptSections", () => {
  it("returns empty array for empty sections", async () => {
    expect(await collectPluginPromptSections(testCtx, [])).toEqual([]);
  });

  it("returns empty array for undefined-ish input", async () => {
    // The function guards !sections as well.
    expect(await collectPluginPromptSections(testCtx, undefined as never)).toEqual([]);
  });

  it("sorts sections by priority (lower first)", async () => {
    const sections = [
      makeSection({ name: "high", priority: 200, builder: vi.fn(() => "high") }),
      makeSection({ name: "low", priority: 10, builder: vi.fn(() => "low") }),
      makeSection({ name: "mid", priority: 100, builder: vi.fn(() => "mid") }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);
    expect(result.map((r) => r.name)).toEqual(["low", "mid", "high"]);
  });

  it("skips sections where condition returns false", async () => {
    const sections = [
      makeSection({ name: "included", condition: () => true }),
      makeSection({ name: "excluded", condition: () => false }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("included");
  });

  it("skips sections where builder returns empty string", async () => {
    const result = await collectPluginPromptSections(testCtx, [
      makeSection({ name: "empty", builder: vi.fn(() => "") }),
    ]);
    expect(result).toEqual([]);
  });

  it("skips sections where builder returns null", async () => {
    const result = await collectPluginPromptSections(testCtx, [
      makeSection({ name: "null", builder: vi.fn(() => null) }),
    ]);
    expect(result).toEqual([]);
  });

  it("skips sections where builder returns undefined", async () => {
    const result = await collectPluginPromptSections(testCtx, [
      makeSection({ name: "undef", builder: vi.fn(() => undefined) }),
    ]);
    expect(result).toEqual([]);
  });

  it("adds heading when addHeading=true", async () => {
    const sections = [
      makeSection({ name: "My Section", addHeading: true, builder: vi.fn(() => "body text") }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("## My Section\n\nbody text");
  });

  it("no heading when addHeading=false", async () => {
    const sections = [
      makeSection({ name: "My Section", addHeading: false, builder: vi.fn(() => "body text") }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);
    expect(result).toHaveLength(1);
    expect(result[0].content).toBe("body text");
  });

  it("handles builder that throws (skips it, no crash)", async () => {
    const sections = [
      makeSection({
        name: "broken",
        builder: vi.fn(() => {
          throw new Error("plugin crash");
        }),
      }),
      makeSection({ name: "healthy", builder: vi.fn(() => "ok") }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("healthy");
  });

  it("slot collision: two sections targeting same replace slot — warns and keeps only first", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const sections = [
      makeSection({
        name: "first-safety",
        pluginId: "plugin-a",
        priority: 10,
        slot: "replace:safety",
        builder: vi.fn(() => "safety v1"),
      }),
      makeSection({
        name: "second-safety",
        pluginId: "plugin-b",
        priority: 20,
        slot: "replace:safety",
        builder: vi.fn(() => "safety v2"),
      }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("first-safety");
    expect(result[0].content).toBe("safety v1");

    expect(warnSpy).toHaveBeenCalledOnce();
    expect(warnSpy.mock.calls[0][0]).toContain("second-safety");
    expect(warnSpy.mock.calls[0][0]).toContain("replace:safety");
    expect(warnSpy.mock.calls[0][0]).toContain("first-safety");

    warnSpy.mockRestore();
  });

  it("different replace slots (replace:safety and replace:runtime) — no collision", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const sections = [
      makeSection({
        name: "custom-safety",
        priority: 10,
        slot: "replace:safety",
        builder: vi.fn(() => "safety"),
      }),
      makeSection({
        name: "custom-runtime",
        priority: 20,
        slot: "replace:runtime",
        builder: vi.fn(() => "runtime"),
      }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);

    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["custom-safety", "custom-runtime"]);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it("non-replace slots (end, after:identity) — both kept, no collision warning", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const sections = [
      makeSection({
        name: "section-a",
        priority: 10,
        slot: "end",
        builder: vi.fn(() => "a"),
      }),
      makeSection({
        name: "section-b",
        priority: 20,
        slot: "end",
        builder: vi.fn(() => "b"),
      }),
      makeSection({
        name: "section-c",
        priority: 30,
        slot: "after:identity",
        builder: vi.fn(() => "c"),
      }),
    ];

    const result = await collectPluginPromptSections(testCtx, sections);

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.name)).toEqual(["section-a", "section-b", "section-c"]);
    expect(warnSpy).not.toHaveBeenCalled();

    warnSpy.mockRestore();
  });
});

describe("getSlotContent", () => {
  const sections: PluginPromptSection[] = [
    { name: "a", content: "content-a", slot: "end" },
    { name: "b", content: "content-b", slot: "after:identity" },
    { name: "c", content: "content-c", slot: "end" },
  ];

  it("filters by slot correctly", () => {
    expect(getSlotContent(sections, "end")).toEqual(["content-a", "content-c"]);
    expect(getSlotContent(sections, "after:identity")).toEqual(["content-b"]);
    expect(getSlotContent(sections, "after:safety")).toEqual([]);
  });

  it("returns empty array for undefined sections", () => {
    expect(getSlotContent(undefined, "end")).toEqual([]);
  });
});

describe("isCoreSlotReplaced", () => {
  const sections: PluginPromptSection[] = [
    { name: "safety-override", content: "custom", slot: "replace:safety" },
    { name: "extra", content: "extra", slot: "end" },
  ];

  it("returns true when a section exists for the replace slot", () => {
    expect(isCoreSlotReplaced(sections, "replace:safety")).toBe(true);
  });

  it("returns false when no section exists for the replace slot", () => {
    expect(isCoreSlotReplaced(sections, "replace:runtime")).toBe(false);
  });

  it("returns false for undefined sections", () => {
    expect(isCoreSlotReplaced(undefined, "replace:safety")).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { PromptContributorRegistry } from "./registry.js";

describe("PromptContributorRegistry trace", () => {
  it("gracefully degrades when classification is missing", () => {
    const registry = new PromptContributorRegistry();
    registry.register(
      {
        id: "always",
        tags: [],
        priority: 10,
        contribute: () => ({ heading: "## Always", content: "shared section" }),
      },
      "builtin",
    );
    registry.register(
      {
        id: "topic-coding",
        tags: [{ dimension: "topic", value: "coding" }],
        priority: 20,
        contribute: () => ({ heading: "## Coding", content: "coding section" }),
      },
      "plugin",
    );

    const { text, trace } = registry.assembleWithTrace({
      agentId: "agent-a",
      availableTools: new Set<string>(),
      promptMode: "full",
      runtime: "pi",
      workspaceDir: "/tmp",
    });

    expect(text).toContain("## Always");
    expect(text).not.toContain("## Coding");
    expect(trace.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "always", selected: true, reason: "included" }),
        expect.objectContaining({ id: "topic-coding", selected: false, reason: "tag-miss" }),
      ]),
    );
  });

  it("tracks multiple classification candidates and contributor outcomes", () => {
    const registry = new PromptContributorRegistry();
    registry.register(
      {
        id: "common-flagged",
        tags: [{ dimension: "flag", value: "*" }],
        priority: 5,
        contribute: () => ({ heading: "## Common", content: "common safeguards" }),
      },
      "config",
    );
    registry.register(
      {
        id: "topic-ops",
        tags: [{ dimension: "topic", value: "ops" }],
        priority: 10,
        contribute: () => ({ heading: "## Ops", content: "ops guidance" }),
      },
      "plugin",
    );
    registry.register(
      {
        id: "broken",
        tags: [],
        priority: 20,
        contribute: () => {
          throw new Error("boom");
        },
      },
      "workspace",
    );

    const { text, trace } = registry.assembleWithTrace({
      agentId: "agent-b",
      classification: {
        topic: "ops",
        complexity: "complex",
        domain: ["kubernetes"],
        flags: ["security-sensitive", "multi-file"],
        classifiedAt: Date.now(),
      },
      availableTools: new Set<string>(["exec"]),
      promptMode: "full",
      runtime: "pi",
      workspaceDir: "/tmp",
    });

    expect(text).toContain("## Common");
    expect(text).toContain("## Ops");
    expect(trace.selectedIds).toEqual(expect.arrayContaining(["common-flagged", "topic-ops"]));
    expect(trace.decisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "common-flagged", selected: true, reason: "included" }),
        expect.objectContaining({ id: "topic-ops", selected: true, reason: "included" }),
        expect.objectContaining({ id: "broken", selected: false, reason: "contribute-error" }),
      ]),
    );
  });
});

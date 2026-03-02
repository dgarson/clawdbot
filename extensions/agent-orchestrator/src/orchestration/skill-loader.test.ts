import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadOrchestrateSkill, parseSkillRoleInstructions } from "./skill-loader.js";

describe("parseSkillRoleInstructions", () => {
  it("extracts all five role sections", () => {
    const content = `# Orchestrate

Some intro text.

## Orchestrator Role

Orchestrator instructions here.
More orchestrator text.

## Lead Role

Lead instructions here.

## Scout Role

Scout instructions.

## Builder Role

Builder instructions.

## Reviewer Role

Reviewer instructions.

## Common Mistakes

This is not a role section.`;

    const result = parseSkillRoleInstructions(content);
    expect(result.orchestrator).toContain("Orchestrator instructions here");
    expect(result.orchestrator).toContain("More orchestrator text");
    expect(result.lead).toContain("Lead instructions here");
    expect(result.scout).toContain("Scout instructions");
    expect(result.builder).toContain("Builder instructions");
    expect(result.reviewer).toContain("Reviewer instructions");
    // "Common Mistakes" should not leak into reviewer
    expect(result.reviewer).not.toContain("Common Mistakes");
  });

  it("returns empty object for content with no role sections", () => {
    const result = parseSkillRoleInstructions("# Just a title\n\nSome text.");
    expect(Object.keys(result)).toHaveLength(0);
  });

  it("handles case-insensitive headers", () => {
    const content = `## ORCHESTRATOR ROLE\n\nContent here.`;
    const result = parseSkillRoleInstructions(content);
    expect(result.orchestrator).toContain("Content here");
  });

  it("stops role section at next ## header", () => {
    const content = `## Scout Role\n\nScout text.\n\n## Some Other Section\n\nNot scout.`;
    const result = parseSkillRoleInstructions(content);
    expect(result.scout).toBe("Scout text.");
  });
});

describe("loadOrchestrateSkill", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "skill-loader-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads skill from .agents/skills/orchestrate/SKILL.md", () => {
    const skillDir = path.join(tmpDir, ".agents", "skills", "orchestrate");
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillDir, "SKILL.md"),
      "## Orchestrator Role\n\nTest orchestrator content.\n\n## Builder Role\n\nTest builder.",
    );

    const result = loadOrchestrateSkill(tmpDir);
    expect(result).toBeDefined();
    expect(result!.orchestrator).toContain("Test orchestrator content");
    expect(result!.builder).toContain("Test builder");
  });

  it("returns undefined when skill file does not exist", () => {
    const result = loadOrchestrateSkill(tmpDir);
    expect(result).toBeUndefined();
  });
});

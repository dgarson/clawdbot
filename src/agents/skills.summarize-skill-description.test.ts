import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseFrontmatter } from "./skills/frontmatter.js";

describe("skills/summarize frontmatter", () => {
  it("mentions podcasts, local files, and transcription use cases", () => {
    const skillPath = path.join(process.cwd(), "skills", "summarize", "SKILL.md");
    const raw = fs.readFileSync(skillPath, "utf-8");
    const frontmatter = parseFrontmatter(raw);
    const sourceText = (frontmatter.description || raw).toLowerCase();
    expect(sourceText).toContain("transcrib");
    expect(sourceText).toContain("podcast");
    expect(sourceText).toContain("local files");
    if (frontmatter.description) {
      expect(frontmatter.description).not.toContain("summarize.sh");
    }
  });
});

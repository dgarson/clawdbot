import type { ContributorContext, PromptContributor, PromptSection } from "../types.js";

export function createSkillsContributor(params: {
  skillsPrompt: string | undefined;
  readToolName: string;
}): PromptContributor {
  return {
    id: "builtin:skills",
    tags: [],
    priority: 20,
    shouldContribute(ctx: ContributorContext): boolean {
      return (
        ctx.promptMode !== "minimal" && ctx.promptMode !== "none" && !!params.skillsPrompt?.trim()
      );
    },
    contribute(_ctx: ContributorContext): PromptSection | null {
      const trimmed = params.skillsPrompt?.trim();
      if (!trimmed) {
        return null;
      }
      return {
        content: [
          "## Skills (mandatory)",
          "Before replying: scan <available_skills> <description> entries.",
          `- If exactly one skill clearly applies: read its SKILL.md at <location> with \`${params.readToolName}\`, then follow it.`,
          "- If multiple could apply: choose the most specific one, then read/follow it.",
          "- If none clearly apply: do not read any SKILL.md.",
          "Constraints: never read more than one skill up front; only read after selecting.",
          trimmed,
        ].join("\n"),
      };
    },
  };
}

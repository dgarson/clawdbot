import type { ContributorContext, PromptContributor, PromptSection } from "../types.js";

export function createDocsContributor(params: {
  docsPath: string | undefined;
  readToolName: string;
}): PromptContributor {
  return {
    id: "builtin:docs",
    tags: [],
    priority: 40,
    shouldContribute(ctx: ContributorContext): boolean {
      return ctx.promptMode !== "minimal" && ctx.promptMode !== "none" && !!params.docsPath?.trim();
    },
    contribute(_ctx: ContributorContext): PromptSection | null {
      const docsPath = params.docsPath?.trim();
      if (!docsPath) {
        return null;
      }
      return {
        content: [
          "## Documentation",
          `OpenClaw docs: ${docsPath}`,
          "Mirror: https://docs.openclaw.ai",
          "Source: https://github.com/openclaw/openclaw",
          "Community: https://discord.com/invite/clawd",
          "Find new skills: https://clawhub.com",
          "For OpenClaw behavior, commands, config, or architecture: consult local docs first.",
          "When diagnosing issues, run `openclaw status` yourself when possible; only ask the user if you lack access (e.g., sandboxed).",
        ].join("\n"),
      };
    },
  };
}

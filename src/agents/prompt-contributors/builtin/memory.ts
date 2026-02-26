import type { ContributorContext, PromptContributor, PromptSection } from "../types.js";

export function createMemoryContributor(): PromptContributor {
  return {
    id: "builtin:memory",
    tags: [],
    priority: 25,
    shouldContribute(ctx: ContributorContext): boolean {
      if (ctx.promptMode === "minimal" || ctx.promptMode === "none") {
        return false;
      }
      return ctx.availableTools.has("memory_search") || ctx.availableTools.has("memory_get");
    },
    contribute(ctx: ContributorContext): PromptSection | null {
      const lines = [
        "## Memory Recall",
        "Before answering anything about prior work, decisions, dates, people, preferences, or todos: run memory_search on MEMORY.md + memory/*.md; then use memory_get to pull only the needed lines. If low confidence after search, say you checked.",
      ];
      if (ctx.memoryCitationsMode === "off") {
        lines.push(
          "Citations are disabled: do not mention file paths or line numbers in replies unless the user explicitly asks.",
        );
      } else {
        lines.push(
          "Citations: include Source: <path#line> when it helps the user verify memory snippets.",
        );
      }
      return { content: lines.join("\n") };
    },
  };
}

import type { ContributorContext, PromptContributor, PromptSection } from "../types.js";

export function createVoiceContributor(params: { ttsHint: string | undefined }): PromptContributor {
  return {
    id: "builtin:voice",
    tags: [],
    priority: 55,
    shouldContribute(ctx: ContributorContext): boolean {
      return ctx.promptMode !== "minimal" && ctx.promptMode !== "none" && !!params.ttsHint?.trim();
    },
    contribute(_ctx: ContributorContext): PromptSection | null {
      const hint = params.ttsHint?.trim();
      if (!hint) {
        return null;
      }
      return {
        content: `## Voice (TTS)\n${hint}`,
      };
    },
  };
}

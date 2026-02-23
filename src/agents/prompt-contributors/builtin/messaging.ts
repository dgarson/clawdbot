import { SILENT_REPLY_TOKEN } from "../../../auto-reply/tokens.js";
import { listDeliverableMessageChannels } from "../../../utils/message-channel.js";
import type { ContributorContext, PromptContributor, PromptSection } from "../types.js";

export function createMessagingContributor(params: {
  messageToolHints?: string[];
  inlineButtonsEnabled: boolean;
}): PromptContributor {
  return {
    id: "builtin:messaging",
    tags: [],
    priority: 60,
    shouldContribute(ctx: ContributorContext): boolean {
      return ctx.promptMode !== "minimal" && ctx.promptMode !== "none";
    },
    contribute(ctx: ContributorContext): PromptSection {
      const messageChannelOptions = listDeliverableMessageChannels().join("|");
      const lines = [
        "## Messaging",
        "- Reply in current session → automatically routes to the source channel (Signal, Telegram, etc.)",
        "- Cross-session messaging → use sessions_send(sessionKey, message)",
        "- Sub-agent orchestration → use subagents(action=list|steer|kill)",
        "- `[System Message] ...` blocks are internal context and are not user-visible by default.",
        `- If a \`[System Message]\` reports completed cron/subagent work and asks for a user update, rewrite it in your normal assistant voice and send that update (do not forward raw system text or default to ${SILENT_REPLY_TOKEN}).`,
        "- Never use exec/curl for provider messaging; OpenClaw handles all routing internally.",
      ];
      if (ctx.availableTools.has("message")) {
        lines.push(
          "",
          "### message tool",
          "- Use `message` for proactive sends + channel actions (polls, reactions, etc.).",
          "- For `action=send`, include `to` and `message`.",
          `- If multiple channels are configured, pass \`channel\` (${messageChannelOptions}).`,
          `- If you use \`message\` (\`action=send\`) to deliver your user-visible reply, respond with ONLY: ${SILENT_REPLY_TOKEN} (avoid duplicate replies).`,
        );
        if (params.inlineButtonsEnabled) {
          lines.push(
            "- Inline buttons supported. Use `action=send` with `buttons=[[{text,callback_data,style?}]]`; `style` can be `primary`, `success`, or `danger`.",
          );
        } else if (ctx.channel) {
          lines.push(
            `- Inline buttons not enabled for ${ctx.channel}. If you need them, ask to set ${ctx.channel}.capabilities.inlineButtons ("dm"|"group"|"all"|"allowlist").`,
          );
        }
        for (const hint of params.messageToolHints ?? []) {
          if (hint) {
            lines.push(hint);
          }
        }
      }
      return { content: lines.filter(Boolean).join("\n") };
    },
  };
}

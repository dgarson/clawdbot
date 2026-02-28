/**
 * before_prompt_build hook — injects an inbox notification into the agent's
 * system prompt when unread mail is waiting.
 *
 * Respects the per-agent `inboxOnlyDuringHeartbeat` delivery policy:
 * when true, the notification is suppressed during active user conversations
 * (non-heartbeat prompts) and only injected on background/heartbeat wakes.
 *
 * Before counting unread mail, expired processing leases are treated as
 * effectively unread in the count — they will be recovered on the next
 * mail(action='inbox') call.
 */

import type {
  PluginHookAgentContext,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
} from "../../../src/plugins/types.js";
import { type ResolvedInterAgentMailConfig, resolveDeliveryPolicy } from "./config.js";
import { countUnread, mailboxPath } from "./store.js";

type HookDeps = {
  stateDir: string;
  config: ResolvedInterAgentMailConfig;
};

/**
 * Returns the hook handler to register with api.on("before_prompt_build", ...).
 */
export function createBeforePromptBuildHook(deps: HookDeps) {
  return async (
    event: PluginHookBeforePromptBuildEvent,
    ctx: PluginHookAgentContext,
  ): Promise<PluginHookBeforePromptBuildResult | void> => {
    const agentId = ctx.agentId?.trim();
    if (!agentId) return;

    const policy = resolveDeliveryPolicy(deps.config, agentId);

    // If inboxOnlyDuringHeartbeat is set, suppress notification when the
    // current run appears to be a direct user message (non-empty prompt that
    // isn't a system event marker). Heartbeat prompts are empty strings or
    // contain the HEARTBEAT_OK sentinel.
    if (policy.inboxOnlyDuringHeartbeat) {
      const prompt = event.prompt?.trim() ?? "";
      const isHeartbeatOrSystem =
        !prompt ||
        prompt === "HEARTBEAT_OK" ||
        prompt.startsWith("[inter-agent-mail]") ||
        prompt.startsWith("[system]");
      if (!isHeartbeatOrSystem) {
        return;
      }
    }

    const filePath = mailboxPath(deps.stateDir, agentId);
    const now = Date.now();
    const summary = await countUnread(filePath, now);
    if (summary.total === 0) return;

    const urgentNote =
      summary.urgent > 0 ? ` (${summary.urgent} urgent — claim and act on these first)` : "";
    const notification =
      `[inter-agent-mail] You have ${summary.total} unread message${summary.total === 1 ? "" : "s"}${urgentNote}. ` +
      `Use mail(action='inbox') to claim and read them. ` +
      `Always call mail(action='ack', message_ids=[...]) after processing each message.`;

    return { prependContext: notification };
  };
}

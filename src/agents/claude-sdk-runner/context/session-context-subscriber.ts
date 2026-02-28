/**
 * Built-in core subscriber for the before_session_create hook.
 *
 * Replicates the channel/thread context injection and channel tool registration
 * that previously lived inline in createClaudeSdkSession(). Registered at gateway
 * initialisation (see src/plugins/loader.ts) with high priority so it runs before
 * any plugin-provided subscribers.
 *
 * Plugins follow the same pattern: implement a handler with the same signature and
 * register it via api.on("before_session_create", handler).
 */

import { createSubsystemLogger } from "../../../logging/subsystem.js";
import type {
  PluginHookBeforeSessionCreateEvent,
  PluginHookBeforeSessionCreateResult,
} from "../../../plugins/types.js";
import { buildChannelSnapshot } from "./channel-snapshot.js";
import { buildThreadContextWithTelemetry } from "./thread-context.js";

const log = createSubsystemLogger("agent/claude-sdk");

export function coreSessionContextSubscriber(
  event: PluginHookBeforeSessionCreateEvent,
): PluginHookBeforeSessionCreateResult {
  if (!event.structuredContextInput) {
    log.warn(
      `coreSessionContextSubscriber: no structuredContextInput — channel context will be missing sessionKey=${event.sessionKey ?? "unknown"} platform=${event.platform ?? "unknown"} channelId=${event.channelId ?? "unknown"}`,
    );
    return {};
  }

  const input = event.structuredContextInput;
  const snapshot = buildChannelSnapshot(input);
  const snapshotJson = JSON.stringify(snapshot, null, 2);
  const { threadContext: thread, budgetUtilization } = buildThreadContextWithTelemetry(
    input.thread ?? null,
  );
  if (event.diagnosticsEnabled && budgetUtilization) {
    log.debug(
      `structured context thread budget: sessionKey=${event.sessionKey ?? "unknown"} threadBudgetTokens=${budgetUtilization.threadBudgetTokens} actualTokens=${budgetUtilization.actualTokens} messagesTruncated=${budgetUtilization.messagesTruncated} channelSnapshotChars=${snapshotJson.length}`,
    );
  }

  // Build the channel context / thread context / tool guidance section.
  // Note: no leading "\n\n" — the caller (createClaudeSdkSession) prepends "\n\n"
  // when joining sections returned by all subscribers.
  const parts = ["### Channel Context", "```json", snapshotJson, "```"];
  if (thread) {
    parts.push("\n### Thread Context", "```json", JSON.stringify(thread, null, 2), "```");
  }
  if (input.channelType === "direct") {
    // DMs: thread fetching works but channel.context returns empty (no adjacent message snapshot).
    parts.push(
      "\n### Channel Tools",
      "You have a tool for progressive context discovery in this DM:",
      "",
      "- **channel.messages** — fetch a specific thread by ID. Use it when a message references a thread you want to read in full.",
      "",
      "Note: **channel.context** is available but returns empty results in DMs since there is no adjacent message snapshot. Use channel.messages for thread-level lookups.",
    );
  } else {
    parts.push(
      "\n### Channel Tools",
      "You have two tools for progressive context discovery:",
      "",
      "- **channel.context** — keyword/intent search across channel messages. Use it when you need broader context, want to understand the history behind a reference, or are unsure whether you have enough information to answer confidently.",
      "- **channel.messages** — fetch a specific thread or set of messages by ID. Use it when a message in the snapshot references a thread you want to read in full.",
      "",
      "**When to reach for these tools:**",
      "- You see a reference (e.g. 'the rollout', 'that PR', 'last week's incident') but lack enough context to answer accurately → use channel.context.",
      "- You are asked about a thread and only have the root message → use channel.messages with the thread_id.",
      "- Your conversation history has been compacted and you sense you are missing relevant prior context → use channel.context to reconstruct it rather than guessing.",
      "- You are uncertain about a fact that plausibly exists in recent channel history → prefer a quick channel.context lookup over a hedged non-answer.",
      "",
      "Prefer a confident, grounded answer backed by a tool call over a vague reply that forces the user to repeat themselves.",
    );
  }

  return {
    systemPromptSections: [parts.join("\n")],
  };
}

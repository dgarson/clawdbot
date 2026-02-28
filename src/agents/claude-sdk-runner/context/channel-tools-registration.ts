/**
 * Built-in tool factory that registers channel.context and channel.messages.
 *
 * Returns the two channel tools when structuredContextInput is present (Slack/channel
 * sessions), and an empty array otherwise (Pi sessions, no structured context).
 *
 * Registered in src/plugins/loader.ts alongside the coreSessionContextSubscriber hook.
 * Tool factories that close over structuredContextInput are invoked by resolvePluginTools()
 * which threads the per-message context through from attempt.ts → createOpenClawCodingTools()
 * → createOpenClawTools() → resolvePluginTools().
 */

import type { AnyAgentTool } from "../../../agents/tools/common.js";
import type { OpenClawPluginToolFactory } from "../../../plugins/types.js";
import type { ClaudeSdkCompatibleTool } from "../types.js";
import { buildChannelTools } from "./tools.js";

/** Adapt ClaudeSdkCompatibleTool[] to AnyAgentTool[] at the factory boundary.
 *  ClaudeSdkCompatibleTool is structurally compatible with the SDK tool server
 *  consumer (createClaudeSdkMcpToolServer) but omits the `label` property
 *  required by AnyAgentTool. This adapter adds a default label so the cast
 *  is type-safe. */
function toAgentTools(tools: ClaudeSdkCompatibleTool[]): AnyAgentTool[] {
  return tools.map((t) => ({ ...t, label: t.name })) as unknown as AnyAgentTool[];
}

export const channelToolsFactory: OpenClawPluginToolFactory = (ctx) => {
  if (!ctx.structuredContextInput) {
    return [];
  }
  return toAgentTools(buildChannelTools(ctx.structuredContextInput));
};

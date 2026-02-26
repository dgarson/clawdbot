import { Type } from "@sinclair/typebox";
import { BLUEBUBBLES_GROUP_ACTIONS } from "../../channels/plugins/bluebubbles-actions.js";
import {
  listChannelMessageActions,
  supportsChannelMessageButtons,
  supportsChannelMessageButtonsForChannel,
  supportsChannelMessageCards,
  supportsChannelMessageCardsForChannel,
} from "../../channels/plugins/message-actions.js";
import {
  CHANNEL_MESSAGE_ACTION_NAMES,
  type ChannelMessageActionName,
} from "../../channels/plugins/types.js";
import type { OpenClawConfig } from "../../config/config.js";
import { loadConfig } from "../../config/config.js";
import { GATEWAY_CLIENT_IDS, GATEWAY_CLIENT_MODES } from "../../gateway/protocol/client-info.js";
import { getToolResult, runMessageAction } from "../../infra/outbound/message-action-runner.js";
import { normalizeTargetForProvider } from "../../infra/outbound/target-normalization.js";
import { normalizeAccountId } from "../../routing/session-key.js";
import { stripReasoningTagsFromText } from "../../shared/text/reasoning-tags.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import { resolveSessionAgentId } from "../agent-scope.js";
import { listChannelSupportedActions } from "../channel-tools.js";
import { channelTargetSchema, channelTargetsSchema, stringEnum } from "../schema/typebox.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult, readNumberParam, readStringParam } from "./common.js";
import { resolveGatewayOptions } from "./gateway.js";

const AllMessageActions = CHANNEL_MESSAGE_ACTION_NAMES;
const EXPLICIT_TARGET_ACTIONS = new Set<ChannelMessageActionName>([
  "send",
  "sendWithEffect",
  "sendAttachment",
  "reply",
  "thread-reply",
  "broadcast",
]);

function actionNeedsExplicitTarget(action: ChannelMessageActionName): boolean {
  return EXPLICIT_TARGET_ACTIONS.has(action);
}
function buildRoutingSchema() {
  return {
    channel: Type.Optional(Type.String()),
    target: Type.Optional(channelTargetSchema({ description: "Target channel/user id or name." })),
    targets: Type.Optional(channelTargetsSchema()),
    accountId: Type.Optional(Type.String()),
    dryRun: Type.Optional(Type.Boolean()),
  };
}

const discordComponentEmojiSchema = Type.Object({
  name: Type.String(),
  id: Type.Optional(Type.String()),
  animated: Type.Optional(Type.Boolean()),
});

const discordComponentOptionSchema = Type.Object({
  label: Type.String(),
  value: Type.String(),
  description: Type.Optional(Type.String()),
  emoji: Type.Optional(discordComponentEmojiSchema),
  default: Type.Optional(Type.Boolean()),
});

const discordComponentButtonSchema = Type.Object({
  label: Type.String(),
  style: Type.Optional(stringEnum(["primary", "secondary", "success", "danger", "link"])),
  url: Type.Optional(Type.String()),
  emoji: Type.Optional(discordComponentEmojiSchema),
  disabled: Type.Optional(Type.Boolean()),
  allowedUsers: Type.Optional(
    Type.Array(
      Type.String({
        description: "Discord user ids or names allowed to interact with this button.",
      }),
    ),
  ),
});

const discordComponentSelectSchema = Type.Object({
  type: Type.Optional(stringEnum(["string", "user", "role", "mentionable", "channel"])),
  placeholder: Type.Optional(Type.String()),
  minValues: Type.Optional(Type.Number()),
  maxValues: Type.Optional(Type.Number()),
  options: Type.Optional(Type.Array(discordComponentOptionSchema)),
});

const discordComponentBlockSchema = Type.Object({
  type: Type.String(),
  text: Type.Optional(Type.String()),
  texts: Type.Optional(Type.Array(Type.String())),
  accessory: Type.Optional(
    Type.Object({
      type: Type.String(),
      url: Type.Optional(Type.String()),
      button: Type.Optional(discordComponentButtonSchema),
    }),
  ),
  spacing: Type.Optional(stringEnum(["small", "large"])),
  divider: Type.Optional(Type.Boolean()),
  buttons: Type.Optional(Type.Array(discordComponentButtonSchema)),
  select: Type.Optional(discordComponentSelectSchema),
  items: Type.Optional(
    Type.Array(
      Type.Object({
        url: Type.String(),
        description: Type.Optional(Type.String()),
        spoiler: Type.Optional(Type.Boolean()),
      }),
    ),
  ),
  file: Type.Optional(Type.String()),
  spoiler: Type.Optional(Type.Boolean()),
});

const discordComponentModalFieldSchema = Type.Object({
  type: Type.String(),
  name: Type.Optional(Type.String()),
  label: Type.String(),
  description: Type.Optional(Type.String()),
  placeholder: Type.Optional(Type.String()),
  required: Type.Optional(Type.Boolean()),
  options: Type.Optional(Type.Array(discordComponentOptionSchema)),
  minValues: Type.Optional(Type.Number()),
  maxValues: Type.Optional(Type.Number()),
  minLength: Type.Optional(Type.Number()),
  maxLength: Type.Optional(Type.Number()),
  style: Type.Optional(stringEnum(["short", "paragraph"])),
});

const discordComponentModalSchema = Type.Object({
  title: Type.String(),
  triggerLabel: Type.Optional(Type.String()),
  triggerStyle: Type.Optional(stringEnum(["primary", "secondary", "success", "danger", "link"])),
  fields: Type.Array(discordComponentModalFieldSchema),
});

const discordComponentMessageSchema = Type.Object(
  {
    text: Type.Optional(Type.String()),
    reusable: Type.Optional(
      Type.Boolean({
        description: "Allow components to be used multiple times until they expire.",
      }),
    ),
    container: Type.Optional(
      Type.Object({
        accentColor: Type.Optional(Type.String()),
        spoiler: Type.Optional(Type.Boolean()),
      }),
    ),
    blocks: Type.Optional(Type.Array(discordComponentBlockSchema)),
    modal: Type.Optional(discordComponentModalSchema),
  },
  {
    description:
      "Discord components v2 payload. Set reusable=true to keep buttons, selects, and forms active until expiry.",
  },
);

function buildSendSchema(options: {
  includeButtons: boolean;
  includeCards: boolean;
  includeComponents: boolean;
}) {
  const props: Record<string, unknown> = {
    message: Type.Optional(Type.String()),
    effectId: Type.Optional(
      Type.String({
        description: "Message effect name/id for sendWithEffect (e.g., invisible ink).",
      }),
    ),
    effect: Type.Optional(
      Type.String({ description: "Alias for effectId (e.g., invisible-ink, balloons)." }),
    ),
    media: Type.Optional(
      Type.String({
        description: "Media URL or local path. data: URLs are not supported here, use buffer.",
      }),
    ),
    filename: Type.Optional(Type.String()),
    buffer: Type.Optional(
      Type.String({
        description: "Base64 payload for attachments (optionally a data: URL).",
      }),
    ),
    contentType: Type.Optional(Type.String()),
    mimeType: Type.Optional(Type.String()),
    caption: Type.Optional(Type.String()),
    path: Type.Optional(Type.String()),
    filePath: Type.Optional(Type.String()),
    replyTo: Type.Optional(Type.String()),
    threadId: Type.Optional(Type.String()),
    asVoice: Type.Optional(Type.Boolean()),
    silent: Type.Optional(Type.Boolean()),
    quoteText: Type.Optional(
      Type.String({ description: "Quote text for Telegram reply_parameters" }),
    ),
    bestEffort: Type.Optional(Type.Boolean()),
    gifPlayback: Type.Optional(Type.Boolean()),
    buttons: Type.Optional(
      Type.Array(
        Type.Array(
          Type.Object({
            text: Type.String(),
            callback_data: Type.String(),
            style: Type.Optional(stringEnum(["danger", "success", "primary"])),
          }),
        ),
        {
          description: "Telegram inline keyboard buttons (array of button rows)",
        },
      ),
    ),
    card: Type.Optional(
      Type.Object(
        {},
        {
          additionalProperties: true,
          description: "Adaptive Card JSON object (when supported by the channel)",
        },
      ),
    ),
    components: Type.Optional(discordComponentMessageSchema),
  };
  if (!options.includeButtons) {
    delete props.buttons;
  }
  if (!options.includeCards) {
    delete props.card;
  }
  if (!options.includeComponents) {
    delete props.components;
  }
  return props;
}

function buildReactionSchema() {
  return {
    messageId: Type.Optional(
      Type.String({
        description:
          "Target message ID. Format varies by channel: Slack message ts (epoch decimal), Discord snowflake, Telegram message_id integer.",
      }),
    ),
    emoji: Type.Optional(
      Type.String({
        description:
          "Emoji to react with. Slack: shortcode without colons (e.g. 'eyes'); Discord/Telegram: unicode or shortcode.",
      }),
    ),
    remove: Type.Optional(
      Type.Boolean({
        description:
          "If true, remove the reaction. If emoji is unset and remove=true, removes all of the agent's own reactions from the message.",
      }),
    ),
    targetAuthor: Type.Optional(
      Type.String({
        description: "Author username or ID to filter reactions by (iMessage/BlueBubbles only).",
      }),
    ),
    targetAuthorUuid: Type.Optional(
      Type.String({
        description: "Author UUID to filter reactions by (iMessage/BlueBubbles only).",
      }),
    ),
    groupId: Type.Optional(
      Type.String({
        description:
          "Group/chat ID for reaction targeting (iMessage/BlueBubbles group chats only).",
      }),
    ),
  };
}

function buildFetchSchema() {
  return {
    limit: Type.Optional(
      Type.Number({
        description:
          "Number of messages to return (default: 20). Use smaller values for a quick scan, larger for deep context.",
      }),
    ),
    before: Type.Optional(
      Type.String({
        description:
          "Message timestamp (ts) to fetch messages before this point. For Slack: epoch decimal (e.g. '1234567890.123456'); for Discord: snowflake ID.",
      }),
    ),
    after: Type.Optional(
      Type.String({
        description:
          "Message timestamp (ts) to fetch messages after this point. For Slack: epoch decimal; for Discord: snowflake ID.",
      }),
    ),
    around: Type.Optional(
      Type.String({
        description:
          "Message timestamp to fetch messages around this point (returns a window before and after). Slack/Discord format varies.",
      }),
    ),
    fromMe: Type.Optional(
      Type.Boolean({
        description: "If true, filter to only messages sent by the agent itself.",
      }),
    ),
    includeArchived: Type.Optional(
      Type.Boolean({
        description:
          "If true, include archived channels/threads in results (e.g. Slack archived channels, Discord archived threads).",
      }),
    ),
    threadId: Type.Optional(
      Type.String({
        description:
          "Thread root message ID/timestamp to fetch thread replies (Slack: thread root ts; Discord: use threadId for thread channels).",
      }),
    ),
  };
}

function buildPollSchema() {
  return {
    pollQuestion: Type.Optional(
      Type.String({
        description: "Poll question/prompt text (required for poll creation).",
      }),
    ),
    pollOption: Type.Optional(
      Type.Array(Type.String(), {
        description:
          "Poll answer options (2-10 items depending on channel; required for poll creation).",
      }),
    ),
    pollDurationHours: Type.Optional(
      Type.Number({
        description:
          "Poll duration in hours (Discord: 1-168; Telegram: defaults to 1 day if unset).",
      }),
    ),
    pollMulti: Type.Optional(
      Type.Boolean({
        description:
          "Allow multiple selections per voter (Discord only; Telegram/Slack support single-choice only).",
      }),
    ),
  };
}

function buildChannelTargetSchema() {
  return {
    channelId: Type.Optional(
      Type.String({ description: "Channel id filter (search/thread list/event create)." }),
    ),
    channelIds: Type.Optional(
      Type.Array(Type.String({ description: "Channel id filter (repeatable)." })),
    ),
    guildId: Type.Optional(Type.String({ description: "Discord guild/server ID." })),
    userId: Type.Optional(
      Type.String({
        description: "User ID to filter by (Discord member, Telegram user, Slack user).",
      }),
    ),
    authorId: Type.Optional(
      Type.String({
        description: "Filter results to messages authored by this user ID.",
      }),
    ),
    authorIds: Type.Optional(
      Type.Array(Type.String(), {
        description: "Filter results to messages authored by any of these user IDs.",
      }),
    ),
    roleId: Type.Optional(
      Type.String({
        description: "Discord role ID (for roleInfo and role mutations).",
      }),
    ),
    roleIds: Type.Optional(
      Type.Array(Type.String(), {
        description: "Discord role IDs filter (for member list queries by role).",
      }),
    ),
    participant: Type.Optional(
      Type.String({
        description: "Participant JID/identifier in group message (BlueBubbles/iMessage groups).",
      }),
    ),
  };
}

function buildStickerSchema() {
  return {
    emojiName: Type.Optional(
      Type.String({
        description: "Emoji name for sticker search (e.g. 'smile', 'fire').",
      }),
    ),
    stickerId: Type.Optional(
      Type.Array(Type.String(), {
        description: "Discord sticker ID(s) to send.",
      }),
    ),
    stickerName: Type.Optional(
      Type.String({
        description: "Sticker pack or name filter for search.",
      }),
    ),
    stickerDesc: Type.Optional(
      Type.String({
        description: "Sticker description filter for search.",
      }),
    ),
    stickerTags: Type.Optional(
      Type.String({
        description: "Comma-separated tags for sticker search.",
      }),
    ),
  };
}

function buildThreadSchema() {
  return {
    threadName: Type.Optional(
      Type.String({
        description: "Name/topic for the new thread (Discord, Slack, Telegram forum threads).",
      }),
    ),
    autoArchiveMin: Type.Optional(
      Type.Number({
        description:
          "Auto-archive timeout in minutes after inactivity (Discord: 60/1440/4320/10080; Slack: 3600).",
      }),
    ),
  };
}

function buildEventSchema() {
  return {
    query: Type.Optional(
      Type.String({
        description: "Search query for event lookup (Discord scheduled event search).",
      }),
    ),
    eventName: Type.Optional(
      Type.String({
        description: "Event name/title (required for event creation).",
      }),
    ),
    eventType: Type.Optional(
      Type.String({
        description:
          "Event type: Discord uses 'STAGE_INSTANCE', 'VOICE', or 'EXTERNAL'; Telegram uses 'event'.",
      }),
    ),
    startTime: Type.Optional(
      Type.String({
        description: "Event start time in ISO 8601 format (e.g. '2025-02-21T10:00:00Z').",
      }),
    ),
    endTime: Type.Optional(
      Type.String({
        description: "Event end time in ISO 8601 format.",
      }),
    ),
    desc: Type.Optional(
      Type.String({
        description: "Event description/details text.",
      }),
    ),
    location: Type.Optional(
      Type.String({
        description: "Event location string (Discord EXTERNAL events only).",
      }),
    ),
    durationMin: Type.Optional(
      Type.Number({
        description: "Event duration in minutes (Telegram only; defaults to 60 if unset).",
      }),
    ),
    until: Type.Optional(
      Type.String({
        description: "Recurrence end date in ISO 8601 format (Telegram recurring events only).",
      }),
    ),
  };
}

function buildModerationSchema() {
  return {
    reason: Type.Optional(
      Type.String({
        description:
          "Moderation reason logged to audit trail (Discord timeout/kick/ban; max 512 chars).",
      }),
    ),
    deleteDays: Type.Optional(
      Type.Number({
        description:
          "Days of message history to delete when banning (Discord ban only; 0-7, default 0).",
      }),
    ),
  };
}

function buildGatewaySchema() {
  return {
    gatewayUrl: Type.Optional(
      Type.String({
        description: "Custom gateway URL override for this request.",
      }),
    ),
    gatewayToken: Type.Optional(
      Type.String({
        description: "Custom gateway authentication token override for this request.",
      }),
    ),
    timeoutMs: Type.Optional(
      Type.Number({
        description: "Request timeout in milliseconds (default: 30000).",
      }),
    ),
  };
}

function buildPresenceSchema() {
  return {
    activityType: Type.Optional(
      Type.String({
        description: "Activity type: playing, streaming, listening, watching, competing, custom.",
      }),
    ),
    activityName: Type.Optional(
      Type.String({
        description: "Activity name shown in sidebar (e.g. 'with fire'). Ignored for custom type.",
      }),
    ),
    activityUrl: Type.Optional(
      Type.String({
        description:
          "Streaming URL (Twitch or YouTube). Only used with streaming type; may not render for bots.",
      }),
    ),
    activityState: Type.Optional(
      Type.String({
        description:
          "State text. For custom type this is the status text; for others it shows in the flyout.",
      }),
    ),
    status: Type.Optional(
      Type.String({ description: "Bot status: online, dnd, idle, invisible." }),
    ),
  };
}

function buildChannelManagementSchema() {
  return {
    name: Type.Optional(
      Type.String({
        description: "Channel or group name (for create/edit operations).",
      }),
    ),
    type: Type.Optional(
      Type.Number({
        description:
          "Discord channel type integer (0=text, 2=voice, 4=category, 13=stage, 15=forum).",
      }),
    ),
    parentId: Type.Optional(
      Type.String({
        description: "Discord parent category ID (organises channel under a category).",
      }),
    ),
    topic: Type.Optional(
      Type.String({
        description:
          "Channel topic/description shown in channel header (Discord text channels, Slack).",
      }),
    ),
    position: Type.Optional(
      Type.Number({
        description: "Channel sort position in channel list (Discord only; 0-indexed).",
      }),
    ),
    nsfw: Type.Optional(
      Type.Boolean({
        description: "Mark channel as NSFW/age-restricted (Discord text/voice channels only).",
      }),
    ),
    rateLimitPerUser: Type.Optional(
      Type.Number({
        description: "Slowmode: seconds required between each user's messages (Discord; 0-21600).",
      }),
    ),
    categoryId: Type.Optional(
      Type.String({
        description: "Discord category ID (alias for parentId).",
      }),
    ),
    clearParent: Type.Optional(
      Type.Boolean({
        description: "Clear the parent/category when supported by the provider.",
      }),
    ),
  };
}

function buildMessageToolSchemaProps(options: {
  includeButtons: boolean;
  includeCards: boolean;
  includeComponents: boolean;
}) {
  return {
    ...buildRoutingSchema(),
    ...buildSendSchema(options),
    ...buildReactionSchema(),
    ...buildFetchSchema(),
    ...buildPollSchema(),
    ...buildChannelTargetSchema(),
    ...buildStickerSchema(),
    ...buildThreadSchema(),
    ...buildEventSchema(),
    ...buildModerationSchema(),
    ...buildGatewaySchema(),
    ...buildChannelManagementSchema(),
    ...buildPresenceSchema(),
  };
}

function buildMessageToolSchemaFromActions(
  actions: readonly string[],
  options: { includeButtons: boolean; includeCards: boolean; includeComponents: boolean },
) {
  const props = buildMessageToolSchemaProps(options);
  return Type.Object({
    action: stringEnum(actions),
    ...props,
  });
}

const MessageToolSchema = buildMessageToolSchemaFromActions(AllMessageActions, {
  includeButtons: true,
  includeCards: true,
  includeComponents: true,
});

type MessageToolOptions = {
  agentAccountId?: string;
  agentSessionKey?: string;
  config?: OpenClawConfig;
  currentChannelId?: string;
  currentChannelProvider?: string;
  currentThreadTs?: string;
  replyToMode?: "off" | "first" | "all";
  hasRepliedRef?: { value: boolean };
  sandboxRoot?: string;
  requireExplicitTarget?: boolean;
  requesterSenderId?: string;
};

function resolveMessageToolSchemaActions(params: {
  cfg: OpenClawConfig;
  currentChannelProvider?: string;
  currentChannelId?: string;
}): string[] {
  const currentChannel = normalizeMessageChannel(params.currentChannelProvider);
  if (currentChannel) {
    const scopedActions = filterActionsForContext({
      actions: listChannelSupportedActions({
        cfg: params.cfg,
        channel: currentChannel,
      }),
      channel: currentChannel,
      currentChannelId: params.currentChannelId,
    });
    const withSend = new Set<string>(["send", ...scopedActions]);
    return Array.from(withSend);
  }
  const actions = listChannelMessageActions(params.cfg);
  return actions.length > 0 ? actions : ["send"];
}

function resolveIncludeComponents(params: {
  cfg: OpenClawConfig;
  currentChannelProvider?: string;
}): boolean {
  const currentChannel = normalizeMessageChannel(params.currentChannelProvider);
  if (currentChannel) {
    return currentChannel === "discord";
  }
  // Components are currently Discord-specific.
  return listChannelSupportedActions({ cfg: params.cfg, channel: "discord" }).length > 0;
}

function buildMessageToolSchema(params: {
  cfg: OpenClawConfig;
  currentChannelProvider?: string;
  currentChannelId?: string;
}) {
  const currentChannel = normalizeMessageChannel(params.currentChannelProvider);
  const actions = resolveMessageToolSchemaActions(params);
  const includeButtons = currentChannel
    ? supportsChannelMessageButtonsForChannel({ cfg: params.cfg, channel: currentChannel })
    : supportsChannelMessageButtons(params.cfg);
  const includeCards = currentChannel
    ? supportsChannelMessageCardsForChannel({ cfg: params.cfg, channel: currentChannel })
    : supportsChannelMessageCards(params.cfg);
  const includeComponents = resolveIncludeComponents(params);
  return buildMessageToolSchemaFromActions(actions.length > 0 ? actions : ["send"], {
    includeButtons,
    includeCards,
    includeComponents,
  });
}

function resolveAgentAccountId(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }
  return normalizeAccountId(trimmed);
}

function filterActionsForContext(params: {
  actions: ChannelMessageActionName[];
  channel?: string;
  currentChannelId?: string;
}): ChannelMessageActionName[] {
  const channel = normalizeMessageChannel(params.channel);
  if (!channel || channel !== "bluebubbles") {
    return params.actions;
  }
  const currentChannelId = params.currentChannelId?.trim();
  if (!currentChannelId) {
    return params.actions;
  }
  const normalizedTarget =
    normalizeTargetForProvider(channel, currentChannelId) ?? currentChannelId;
  const lowered = normalizedTarget.trim().toLowerCase();
  const isGroupTarget =
    lowered.startsWith("chat_guid:") ||
    lowered.startsWith("chat_id:") ||
    lowered.startsWith("chat_identifier:") ||
    lowered.startsWith("group:");
  if (isGroupTarget) {
    return params.actions;
  }
  return params.actions.filter((action) => !BLUEBUBBLES_GROUP_ACTIONS.has(action));
}

function buildMessageToolDescription(options?: {
  config?: OpenClawConfig;
  currentChannel?: string;
  currentChannelId?: string;
}): string {
  const baseDescription = "Send, delete, and manage messages via channel plugins.";

  // If we have a current channel, show only its supported actions
  if (options?.currentChannel) {
    const channelActions = filterActionsForContext({
      actions: listChannelSupportedActions({
        cfg: options.config,
        channel: options.currentChannel,
      }),
      channel: options.currentChannel,
      currentChannelId: options.currentChannelId,
    });
    if (channelActions.length > 0) {
      // Always include "send" as a base action
      const allActions = new Set(["send", ...channelActions]);
      const actionList = Array.from(allActions).toSorted().join(", ");
      return `${baseDescription} Current channel (${options.currentChannel}) supports: ${actionList}.`;
    }
  }

  // Fallback to generic description with all configured actions
  if (options?.config) {
    const actions = listChannelMessageActions(options.config);
    if (actions.length > 0) {
      return `${baseDescription} Supports actions: ${actions.join(", ")}.`;
    }
  }

  return `${baseDescription} Supports actions: send, delete, react, poll, pin, threads, and more.`;
}

export function createMessageTool(options?: MessageToolOptions): AnyAgentTool {
  const agentAccountId = resolveAgentAccountId(options?.agentAccountId);
  const schema = options?.config
    ? buildMessageToolSchema({
        cfg: options.config,
        currentChannelProvider: options.currentChannelProvider,
        currentChannelId: options.currentChannelId,
      })
    : MessageToolSchema;
  const description = buildMessageToolDescription({
    config: options?.config,
    currentChannel: options?.currentChannelProvider,
    currentChannelId: options?.currentChannelId,
  });

  return {
    label: "Message",
    name: "message",
    description,
    parameters: schema,
    execute: async (_toolCallId, args, signal) => {
      // Check if already aborted before doing any work
      if (signal?.aborted) {
        const err = new Error("Message send aborted");
        err.name = "AbortError";
        throw err;
      }
      // Shallow-copy so we don't mutate the original event args (used for logging/dedup).
      const params = { ...(args as Record<string, unknown>) };

      // Strip reasoning tags from text fields — models may include <think>…</think>
      // in tool arguments, and the messaging tool send path has no other tag filtering.
      for (const field of ["text", "content", "message", "caption"]) {
        if (typeof params[field] === "string") {
          params[field] = stripReasoningTagsFromText(params[field]);
        }
      }

      const cfg = options?.config ?? loadConfig();
      const action = readStringParam(params, "action", {
        required: true,
      }) as ChannelMessageActionName;
      const requireExplicitTarget = options?.requireExplicitTarget === true;
      if (requireExplicitTarget && actionNeedsExplicitTarget(action)) {
        const explicitTarget =
          (typeof params.target === "string" && params.target.trim().length > 0) ||
          (typeof params.to === "string" && params.to.trim().length > 0) ||
          (typeof params.channelId === "string" && params.channelId.trim().length > 0) ||
          (Array.isArray(params.targets) &&
            params.targets.some((value) => typeof value === "string" && value.trim().length > 0));
        if (!explicitTarget) {
          throw new Error(
            "Explicit message target required for this run. Provide target/targets (and channel when needed).",
          );
        }
      }

      const accountId = readStringParam(params, "accountId") ?? agentAccountId;
      if (accountId) {
        params.accountId = accountId;
      }

      const gatewayResolved = resolveGatewayOptions({
        gatewayUrl: readStringParam(params, "gatewayUrl", { trim: false }),
        gatewayToken: readStringParam(params, "gatewayToken", { trim: false }),
        timeoutMs: readNumberParam(params, "timeoutMs"),
      });
      const gateway = {
        url: gatewayResolved.url,
        token: gatewayResolved.token,
        timeoutMs: gatewayResolved.timeoutMs,
        clientName: GATEWAY_CLIENT_IDS.GATEWAY_CLIENT,
        clientDisplayName: "agent",
        mode: GATEWAY_CLIENT_MODES.BACKEND,
      };

      const toolContext =
        options?.currentChannelId ||
        options?.currentChannelProvider ||
        options?.currentThreadTs ||
        options?.replyToMode ||
        options?.hasRepliedRef
          ? {
              currentChannelId: options?.currentChannelId,
              currentChannelProvider: options?.currentChannelProvider,
              currentThreadTs: options?.currentThreadTs,
              replyToMode: options?.replyToMode,
              hasRepliedRef: options?.hasRepliedRef,
              // Direct tool invocations should not add cross-context decoration.
              // The agent is composing a message, not forwarding from another chat.
              skipCrossContextDecoration: true,
            }
          : undefined;

      const result = await runMessageAction({
        cfg,
        action,
        params,
        defaultAccountId: accountId ?? undefined,
        requesterSenderId: options?.requesterSenderId,
        gateway,
        toolContext,
        sessionKey: options?.agentSessionKey,
        agentId: options?.agentSessionKey
          ? resolveSessionAgentId({ sessionKey: options.agentSessionKey, config: cfg })
          : undefined,
        sandboxRoot: options?.sandboxRoot,
        abortSignal: signal,
      });

      const toolResult = getToolResult(result);
      if (toolResult) {
        return toolResult;
      }
      return jsonResult(result.payload);
    },
  };
}

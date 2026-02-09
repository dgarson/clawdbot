/**
 * TelegramRichMessage MCP Tool
 *
 * Sends rich formatted messages to Telegram using semantic patterns.
 * Analogous to SlackRichMessage but renders to Telegram InlineKeyboardMarkup + HTML.
 *
 * Delegates to rich-patterns.ts for pattern rendering, then sends via
 * sendMessageTelegram with reply_markup and parse_mode: 'HTML'.
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import type { TelegramPatternType } from "../rich-patterns.js";
import { jsonResult } from "../../agents/tools/common.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { renderPattern } from "../rich-patterns.js";
import { reactMessageTelegram, sendMessageTelegram } from "../send.js";

const log = createSubsystemLogger("telegram/rich-message-tool");

const PatternType = Type.Unsafe<string>({
  type: "string",
  enum: [
    "multiple_choice",
    "confirmation",
    "task_proposal",
    "action_items",
    "status",
    "progress",
    "info_grid",
  ],
});

const RichMessageInput = Type.Object({
  to: Type.String({
    description: "Recipient: Telegram chat_id (numeric) or @username",
  }),
  pattern: PatternType,
  params: Type.Any({
    description: "Pattern-specific parameters (structure varies by pattern type)",
  }),
  reactions: Type.Optional(
    Type.Array(Type.String(), {
      description: "Optional emoji reactions to add after sending.",
    }),
  ),
  replyToMessageId: Type.Optional(
    Type.Number({
      description: "Optional message ID to reply to (for threading)",
    }),
  ),
});

interface TelegramRichMessageToolOpts {
  accountId?: string;
}

export function createTelegramRichMessageTool(
  opts: TelegramRichMessageToolOpts = {},
): AnyAgentTool {
  return {
    name: "TelegramRichMessage",
    label: "Telegram Rich Message",
    parameters: RichMessageInput,
    description: `Send rich formatted messages to Telegram using semantic patterns.

Available patterns:

**multiple_choice**: Ask a question with inline keyboard buttons
- params: { question: string, options: Array<{ text, value, description? }>, actionIdPrefix: string, allowMultiple?: boolean }

**confirmation**: Simple yes/no confirmation with inline buttons
- params: { title: string, message: string, actionIdPrefix: string, confirmLabel?: string, cancelLabel?: string, style?: 'primary' | 'danger' }

**task_proposal**: Present a task with accept/reject buttons
- params: { title: string, description: string, details?: Array<{ label, value }>, actionIdPrefix: string, acceptLabel?: string, rejectLabel?: string, modifyLabel?: string }

**action_items**: Display action items with toggle checkboxes
- params: { title: string, items: Array<{ id, text, completed?, details? }>, actionIdPrefix: string, showCheckboxes?: boolean }

**status**: Status message (text-only, no buttons)
- params: { title: string, message: string, status: 'success' | 'warning' | 'error' | 'info', details?: string[], timestamp?: string }

**progress**: Progress bar (text-only, no buttons)
- params: { title: string, current: number, total: number, description?: string, showPercentage?: boolean }

**info_grid**: Key-value information grid (text-only)
- params: { title: string, items: Array<{ label, value }> }

Optional: provide \`reactions\` (emoji strings) to add after sending.

Note: Messages are sent with HTML formatting and InlineKeyboardMarkup for interactive patterns.`,
    execute: async (_toolCallId, args) => {
      const { to, pattern, params, reactions, replyToMessageId } = args;

      try {
        const result = renderPattern(pattern as TelegramPatternType, params ?? {});

        // Build buttons array for sendMessageTelegram
        const buttons =
          result.keyboard.length > 0
            ? result.keyboard.map((row) =>
                row.map((btn) => ({
                  text: btn.text,
                  callback_data: btn.callback_data,
                })),
              )
            : undefined;

        const sendResult = await sendMessageTelegram(to, result.html, {
          accountId: opts.accountId,
          textMode: "html",
          buttons,
          replyToMessageId,
          plainText: result.plainText,
        });

        // Add reactions if provided
        if (Array.isArray(reactions) && reactions.length > 0) {
          for (const emoji of reactions) {
            const trimmedEmoji = typeof emoji === "string" ? emoji.trim() : "";
            if (!trimmedEmoji) {
              continue;
            }
            try {
              await reactMessageTelegram(sendResult.chatId, sendResult.messageId, trimmedEmoji, {
                accountId: opts.accountId,
              });
            } catch (err) {
              log.warn(
                `Failed to add reaction "${trimmedEmoji}": ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }

        return jsonResult({
          success: true,
          messageId: sendResult.messageId,
          chatId: sendResult.chatId,
          pattern,
          hasKeyboard: (buttons?.length ?? 0) > 0,
        });
      } catch (error) {
        log.error(
          `TelegramRichMessage failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return jsonResult({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

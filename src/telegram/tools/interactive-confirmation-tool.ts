/**
 * AskTelegramConfirmation MCP Tool
 *
 * Sends a Confirm/Cancel prompt via Telegram inline keyboard and blocks
 * until the user responds or the timeout expires.
 *
 * Analogous to AskSlackConfirmation.
 */

import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import { jsonResult } from "../../agents/tools/common.js";
import { getCallbackRouter } from "../../channels/telegram/callback-router.js";
import { createSubsystemLogger } from "../../logging/subsystem.js";
import { encodeCallbackData, escapeHtml } from "../rich-patterns.js";
import { editMessageTelegram, sendMessageTelegram } from "../send.js";
import { telegramResponseStore } from "./response-store.js";

const log = createSubsystemLogger("telegram/ask-confirmation");

const InteractiveConfirmationInput = Type.Object({
  to: Type.String({
    description: "Recipient: Telegram chat_id (numeric) or @username",
  }),
  title: Type.String({
    description: "Title of the confirmation prompt",
  }),
  message: Type.String({
    description: "The message/question to confirm",
  }),
  confirmLabel: Type.Optional(
    Type.String({
      description: "Label for the confirm button (default: 'Confirm')",
      default: "Confirm",
    }),
  ),
  cancelLabel: Type.Optional(
    Type.String({
      description: "Label for the cancel button (default: 'Cancel')",
      default: "Cancel",
    }),
  ),
  style: Type.Optional(
    Type.Unsafe<"primary" | "danger">({
      type: "string",
      enum: ["primary", "danger"],
      description:
        "Style of the confirm button: 'primary' (green) or 'danger' (red). Default: 'primary'",
      default: "primary",
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({
      description:
        "How long to wait for a response before timing out (default: 300 seconds / 5 minutes)",
      default: 300,
      minimum: 10,
      maximum: 3600,
    }),
  ),
  replyToMessageId: Type.Optional(
    Type.Number({
      description: "Optional message ID to reply to (for threading)",
    }),
  ),
});

interface TelegramConfirmationToolOpts {
  accountId?: string;
}

export function createTelegramInteractiveConfirmationTool(
  opts: TelegramConfirmationToolOpts = {},
): AnyAgentTool {
  return {
    name: "AskTelegramConfirmation",
    label: "Ask Telegram Confirmation",
    parameters: InteractiveConfirmationInput,
    description: `Ask for a simple Yes/No confirmation on Telegram and WAIT for the user's response.

This tool sends a confirmation prompt with Confirm/Cancel inline buttons and blocks execution until the user responds or the timeout expires.

Use cases:
- Get approval before executing a destructive action
- Confirm user intent before proceeding
- Simple binary decisions

The tool returns whether the user confirmed or cancelled.

Note: This tool BLOCKS until answered or timeout. Use appropriate timeout values.`,
    execute: async (_toolCallId, args) => {
      const {
        to,
        title,
        message,
        confirmLabel = "Confirm",
        cancelLabel = "Cancel",
        style = "primary",
        timeoutSeconds = 300,
        replyToMessageId,
      } = args;

      const confirmationId = crypto.randomBytes(8).toString("hex");
      const prefix = `cfm_${confirmationId}`;

      const confirmEmoji = style === "danger" ? "🔴" : "✅";
      const html = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}`;

      const buttons = [
        [
          {
            text: `${confirmEmoji} ${confirmLabel}`,
            callback_data: encodeCallbackData(prefix, "yes"),
          },
          {
            text: `❌ ${cancelLabel}`,
            callback_data: encodeCallbackData(prefix, "no"),
          },
        ],
      ];

      // Register callback handler before sending
      const responsePromise = telegramResponseStore.waitForResponse(
        confirmationId,
        timeoutSeconds * 1000,
      );

      const router = getCallbackRouter();
      const cleanup = router.register({
        id: confirmationId,
        prefix,
        mode: "one-shot",
        timeoutMs: timeoutSeconds * 1000,
        handler: (event) => {
          const isConfirm = event.actionId === "yes";
          telegramResponseStore.recordResponse(confirmationId, {
            answered: true,
            selectedValues: [isConfirm ? "confirm" : "cancel"],
            userId: event.userId,
            username: event.username,
            timestamp: Date.now(),
          });
        },
      });

      try {
        const sendResult = await sendMessageTelegram(to, html, {
          accountId: opts.accountId,
          textMode: "html",
          buttons,
          replyToMessageId,
          plainText: `${title}\n\n${message}`,
        });

        const response = await responsePromise;

        if (!response) {
          cleanup();
          return jsonResult({
            answered: false,
            confirmed: false,
            timedOut: true,
            error: "No response received (internal error)",
          });
        }

        // Update message to show result
        const isConfirmed = response.selectedValues?.[0] === "confirm";
        if (!response.timedOut && sendResult.messageId) {
          const statusEmoji = isConfirmed ? "✅" : "❌";
          const statusText = isConfirmed ? "Confirmed" : "Cancelled";
          const respondent = response.username
            ? `@${response.username}`
            : response.userId || "user";
          const updatedHtml = `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}\n\n${statusEmoji} <i>${statusText} by ${escapeHtml(respondent)}</i>`;

          try {
            await editMessageTelegram(sendResult.chatId, sendResult.messageId, updatedHtml, {
              accountId: opts.accountId,
              textMode: "html",
              buttons: [], // Remove inline keyboard
            });
          } catch {
            // Edit might fail if message was deleted — not critical
          }
        }

        if (response.timedOut) {
          // Try to remove the keyboard on timeout
          try {
            await editMessageTelegram(
              sendResult.chatId,
              sendResult.messageId,
              `<b>${escapeHtml(title)}</b>\n\n${escapeHtml(message)}\n\n⏱️ <i>Timed out</i>`,
              {
                accountId: opts.accountId,
                textMode: "html",
                buttons: [],
              },
            );
          } catch {
            // Ignore edit failures
          }

          return jsonResult({
            answered: false,
            confirmed: false,
            timedOut: true,
            messageId: sendResult.messageId,
            chatId: sendResult.chatId,
          });
        }

        return jsonResult({
          answered: true,
          confirmed: isConfirmed,
          cancelled: !isConfirmed,
          respondedBy: response.userId,
          respondedByName: response.username,
          messageId: sendResult.messageId,
          chatId: sendResult.chatId,
          timedOut: false,
        });
      } catch (error) {
        cleanup();
        telegramResponseStore.cancel(confirmationId);
        log.error(
          `AskTelegramConfirmation failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return jsonResult({
          answered: false,
          confirmed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

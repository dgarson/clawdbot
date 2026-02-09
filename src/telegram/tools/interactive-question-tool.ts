/**
 * AskTelegramQuestion MCP Tool
 *
 * Sends an interactive question via Telegram inline keyboard and blocks
 * until the user responds or the timeout expires.
 *
 * Supports single-choice (radio) and multi-choice (checkbox) modes.
 * Analogous to AskSlackQuestion.
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

const log = createSubsystemLogger("telegram/ask-question");

const InteractiveQuestionInput = Type.Object({
  to: Type.String({
    description: "Recipient: Telegram chat_id (numeric) or @username",
  }),
  question: Type.String({
    description: "The question to ask the user",
  }),
  options: Type.Array(
    Type.Object({
      text: Type.String({ description: "Display text for this option" }),
      value: Type.String({ description: "Value to return if selected" }),
      description: Type.Optional(
        Type.String({ description: "Optional description for this option" }),
      ),
    }),
    {
      description: "Available answer options (2-10 options)",
      minItems: 2,
      maxItems: 10,
    },
  ),
  allowMultiple: Type.Optional(
    Type.Boolean({
      description: "Allow selecting multiple options (default: false, single choice)",
      default: false,
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({
      description:
        "How long to wait for an answer before timing out (default: 300 seconds / 5 minutes)",
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

interface TelegramQuestionToolOpts {
  accountId?: string;
}

export function createTelegramInteractiveQuestionTool(
  opts: TelegramQuestionToolOpts = {},
): AnyAgentTool {
  return {
    name: "AskTelegramQuestion",
    label: "Ask Telegram Question",
    parameters: InteractiveQuestionInput,
    description: `Ask an interactive question on Telegram and WAIT for the user's response.

This tool sends a question with inline keyboard buttons and blocks execution until the user answers or the timeout expires.

Use cases:
- Get user approval/rejection for a proposed action
- Let user choose between multiple options
- Collect structured input during a workflow

Single choice: user taps one option, immediately resolves.
Multi choice: user taps options (toggle on/off), then taps "✅ Done" to submit.

The tool returns the user's selection(s) or indicates if the question timed out.

Note: This tool BLOCKS until answered or timeout. Use appropriate timeout values.`,
    execute: async (_toolCallId, args) => {
      const {
        to,
        question,
        options,
        allowMultiple = false,
        timeoutSeconds = 300,
        replyToMessageId,
      } = args;

      const questionId = crypto.randomBytes(8).toString("hex");
      const prefix = allowMultiple ? `mq_${questionId}` : `sq_${questionId}`;

      // Build HTML question text
      const html = `<b>${escapeHtml(question)}</b>`;

      // Track multi-select selections
      const multiSelections = new Set<string>();

      // Build inline keyboard
      const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
      const buttonsPerRow = options.length <= 4 ? 1 : 2;

      for (let i = 0; i < options.length; i++) {
        const opt = options[i];
        const btn = {
          text: opt.text,
          callback_data: encodeCallbackData(`${prefix}_opt`, opt.value),
        };
        const rowIndex = Math.floor(i / buttonsPerRow);
        if (!buttons[rowIndex]) {
          buttons[rowIndex] = [];
        }
        buttons[rowIndex].push(btn);
      }

      // Add "Done" button for multi-select
      if (allowMultiple) {
        buttons.push([
          {
            text: "✅ Done",
            callback_data: encodeCallbackData(`${prefix}_done`, "submit"),
          },
        ]);
      }

      // Register callback handler before sending
      const responsePromise = telegramResponseStore.waitForResponse(
        questionId,
        timeoutSeconds * 1000,
      );

      const router = getCallbackRouter();

      if (allowMultiple) {
        // Multi-select: toggle mode for options, one-shot for "Done"
        const optionCleanup = router.register({
          id: `${questionId}_opt`,
          prefix: `${prefix}_opt`,
          mode: "toggle",
          timeoutMs: timeoutSeconds * 1000,
          handler: (event) => {
            const value = event.actionId;
            if (multiSelections.has(value)) {
              multiSelections.delete(value);
            } else {
              multiSelections.add(value);
            }
            // Note: In a real implementation, we'd update the message to show
            // selected/deselected state. For now, the selection tracking suffices.
          },
        });

        router.register({
          id: `${questionId}_done`,
          prefix: `${prefix}_done`,
          mode: "one-shot",
          timeoutMs: timeoutSeconds * 1000,
          handler: (event) => {
            // Deregister the option toggle handler
            optionCleanup();

            telegramResponseStore.recordResponse(questionId, {
              answered: true,
              selectedValues: [...multiSelections],
              userId: event.userId,
              username: event.username,
              timestamp: Date.now(),
            });
          },
        });
      } else {
        // Single-select: one-shot handler
        router.register({
          id: questionId,
          prefix: `${prefix}_opt`,
          mode: "one-shot",
          timeoutMs: timeoutSeconds * 1000,
          handler: (event) => {
            telegramResponseStore.recordResponse(questionId, {
              answered: true,
              selectedValues: [event.actionId],
              userId: event.userId,
              username: event.username,
              timestamp: Date.now(),
            });
          },
        });
      }

      try {
        const sendResult = await sendMessageTelegram(to, html, {
          accountId: opts.accountId,
          textMode: "html",
          buttons,
          replyToMessageId,
          plainText: `${question}\n\nOptions:\n${options.map((o: { text: string }, i: number) => `${i + 1}. ${o.text}`).join("\n")}`,
        });

        const response = await responsePromise;

        if (!response) {
          return jsonResult({
            answered: false,
            timedOut: true,
            error: "No response received (internal error)",
          });
        }

        // Update message to show selected answer
        if (!response.timedOut && sendResult.messageId) {
          const selectedTexts =
            response.selectedValues
              ?.map((v) => {
                const opt = options.find((o: { value: string }) => o.value === v);
                return opt?.text ?? v;
              })
              .join(", ") ?? "none";
          const respondent = response.username
            ? `@${response.username}`
            : response.userId || "user";
          const updatedHtml = `<b>${escapeHtml(question)}</b>\n\n✅ <i>Answered by ${escapeHtml(respondent)}: ${escapeHtml(selectedTexts)}</i>`;

          try {
            await editMessageTelegram(sendResult.chatId, sendResult.messageId, updatedHtml, {
              accountId: opts.accountId,
              textMode: "html",
              buttons: [], // Remove inline keyboard
            });
          } catch {
            // Edit failure is not critical
          }
        }

        if (response.timedOut) {
          try {
            await editMessageTelegram(
              sendResult.chatId,
              sendResult.messageId,
              `<b>${escapeHtml(question)}</b>\n\n⏱️ <i>Timed out</i>`,
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
            timedOut: true,
            messageId: sendResult.messageId,
            chatId: sendResult.chatId,
          });
        }

        return jsonResult({
          answered: true,
          selectedValues: response.selectedValues,
          respondedBy: response.userId,
          respondedByName: response.username,
          messageId: sendResult.messageId,
          chatId: sendResult.chatId,
          timedOut: false,
        });
      } catch (error) {
        telegramResponseStore.cancel(questionId);
        log.error(
          `AskTelegramQuestion failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return jsonResult({
          answered: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

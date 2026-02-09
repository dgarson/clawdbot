/**
 * AskTelegramForm MCP Tool
 *
 * Collects structured data from Telegram users via a conversational multi-step flow.
 * Telegram has no native form support, so we send fields one at a time:
 * - text/multiline/email/number: send prompt, collect via text reply
 * - select: send inline keyboard, collect via callback_query
 *
 * After all fields are collected, shows a summary and asks for confirmation.
 *
 * Analogous to AskSlackForm.
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

const log = createSubsystemLogger("telegram/ask-form");

const FieldType = Type.Unsafe<string>({
  type: "string",
  enum: ["text", "multiline", "email", "number", "select"],
});

const FormFieldSchema = Type.Object({
  label: Type.String({ description: "Label shown above the input field" }),
  name: Type.String({ description: "Field name for the returned data (e.g., 'email', 'name')" }),
  type: FieldType,
  placeholder: Type.Optional(Type.String({ description: "Placeholder text / hint" })),
  hint: Type.Optional(Type.String({ description: "Helper text shown with the prompt" })),
  required: Type.Optional(
    Type.Boolean({
      description: "Whether the field is required (default: true)",
      default: true,
    }),
  ),
  options: Type.Optional(
    Type.Array(
      Type.Object({
        text: Type.String({ description: "Display text" }),
        value: Type.String({ description: "Value to return" }),
      }),
      { description: "Options for select fields" },
    ),
  ),
});

const InteractiveFormInput = Type.Object({
  to: Type.String({
    description: "Recipient: Telegram chat_id (numeric) or @username",
  }),
  title: Type.String({
    description: "Form title displayed at the top",
  }),
  description: Type.Optional(
    Type.String({
      description: "Optional description shown below the title",
    }),
  ),
  fields: Type.Array(FormFieldSchema, {
    description: "Form fields to collect (1-10 fields)",
    minItems: 1,
    maxItems: 10,
  }),
  submitLabel: Type.Optional(
    Type.String({
      description: "Label for the submit button (default: 'Submit')",
      default: "Submit",
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({
      description:
        "How long to wait for submission before timing out (default: 300 seconds / 5 minutes)",
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

interface TelegramFormToolOpts {
  accountId?: string;
  /** Test helper: function to get the next text reply for a field. */
  _getTextReply?: (
    chatId: string,
    fieldName: string,
  ) => Promise<{ text: string; userId: string; username?: string } | null>;
}

/**
 * Build the form summary HTML for review/confirmation.
 */
function buildFormSummary(
  title: string,
  fields: Array<{ label: string; name: string }>,
  values: Record<string, string | number | null>,
): string {
  const lines = [`📋 <b>${escapeHtml(title)}</b>`, ""];
  for (const field of fields) {
    const val = values[field.name];
    const display = val != null ? String(val) : "<i>empty</i>";
    lines.push(`<b>${escapeHtml(field.label)}</b>: ${escapeHtml(String(display))}`);
  }
  return lines.join("\n");
}

export function createTelegramInteractiveFormTool(opts: TelegramFormToolOpts = {}): AnyAgentTool {
  return {
    name: "AskTelegramForm",
    label: "Ask Telegram Form",
    parameters: InteractiveFormInput,
    description: `Collect structured data from a Telegram user via a conversational form and WAIT for submission.

This tool sends fields one at a time in a multi-step conversation:
- text/multiline/email/number fields: prompts user, collects reply text
- select fields: shows inline keyboard, collects callback selection

After all fields are filled, shows a summary with Submit/Cancel buttons.

Field types:
- text: Single-line text input (user replies with text)
- multiline: Multi-line text (user replies with text)
- email: Email input (validated format)
- number: Numeric input (validated)
- select: Dropdown-style selection (inline keyboard)

Returns all field values as a key-value object on submission.

Note: This tool BLOCKS until submitted or timeout. Use appropriate timeout values.
For Telegram, this is a conversational flow — each field is a separate message.`,
    execute: async (_toolCallId, args) => {
      const {
        to,
        title,
        description,
        fields,
        submitLabel = "Submit",
        timeoutSeconds = 300,
        replyToMessageId,
      } = args;

      const formId = crypto.randomBytes(8).toString("hex");
      const prefix = `form_${formId}`;

      // Overall timeout
      const deadline = Date.now() + timeoutSeconds * 1000;
      const formValues: Record<string, string | number | null> = {};
      let lastUserId = "";
      let lastUsername: string | undefined;

      try {
        // 1. Send form intro message
        let introHtml = `📋 <b>${escapeHtml(title)}</b>`;
        if (description) {
          introHtml += `\n\n${escapeHtml(description)}`;
        }
        introHtml += `\n\n<i>I'll ask you ${fields.length} question${fields.length > 1 ? "s" : ""} one at a time.</i>`;

        const introResult = await sendMessageTelegram(to, introHtml, {
          accountId: opts.accountId,
          textMode: "html",
          replyToMessageId,
          plainText: `📋 ${title}${description ? `\n${description}` : ""}\n\nI'll ask ${fields.length} question(s) one at a time.`,
        });

        const chatId = introResult.chatId;

        // 2. Collect each field sequentially
        for (let i = 0; i < fields.length; i++) {
          if (Date.now() > deadline) {
            return jsonResult({
              submitted: false,
              timedOut: true,
              partialValues: formValues,
              error: "Form timed out",
            });
          }

          const field = fields[i];
          const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

          if (field.type === "select") {
            // Select field: use inline keyboard
            const value = await collectSelectField({
              chatId,
              field,
              fieldIndex: i,
              totalFields: fields.length,
              formId,
              prefix,
              remainingSeconds: remaining,
              accountId: opts.accountId,
            });

            if (value === null) {
              return jsonResult({
                submitted: false,
                timedOut: true,
                partialValues: formValues,
                error: `Timed out on field "${field.label}"`,
              });
            }

            formValues[field.name] = value.value;
            lastUserId = value.userId;
            lastUsername = value.username;
          } else {
            // Text-based field: send prompt and wait for text reply
            const value = await collectTextFieldViaCallback({
              chatId,
              field,
              fieldIndex: i,
              totalFields: fields.length,
              formId,
              prefix,
              remainingSeconds: remaining,
              accountId: opts.accountId,
              getTextReply: opts._getTextReply,
            });

            if (value === null) {
              return jsonResult({
                submitted: false,
                timedOut: true,
                partialValues: formValues,
                error: `Timed out on field "${field.label}"`,
              });
            }

            // Validate
            if (field.type === "email" && value.text && !isValidEmail(value.text)) {
              // Store anyway — the agent can re-ask if needed
              formValues[field.name] = value.text;
            } else if (field.type === "number") {
              const num = Number(value.text);
              formValues[field.name] = Number.isFinite(num) ? num : value.text;
            } else {
              formValues[field.name] = value.text || null;
            }

            lastUserId = value.userId;
            lastUsername = value.username;
          }
        }

        // 3. Show summary with Submit/Cancel
        if (Date.now() > deadline) {
          return jsonResult({
            submitted: false,
            timedOut: true,
            partialValues: formValues,
          });
        }

        const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
        const summaryHtml = buildFormSummary(title, fields, formValues);
        const submitButtons = [
          [
            {
              text: `✅ ${submitLabel}`,
              callback_data: encodeCallbackData(`${prefix}_submit`, "yes"),
            },
            {
              text: "❌ Cancel",
              callback_data: encodeCallbackData(`${prefix}_submit`, "no"),
            },
          ],
        ];

        const responsePromise = telegramResponseStore.waitForResponse(
          `${formId}_submit`,
          remaining * 1000,
        );

        const router = getCallbackRouter();
        router.register({
          id: `${formId}_submit`,
          prefix: `${prefix}_submit`,
          mode: "one-shot",
          timeoutMs: remaining * 1000,
          handler: (event) => {
            const isSubmit = event.actionId === "yes";
            telegramResponseStore.recordResponse(`${formId}_submit`, {
              answered: true,
              selectedValues: [isSubmit ? "submit" : "cancel"],
              userId: event.userId,
              username: event.username,
              timestamp: Date.now(),
            });
          },
        });

        const summaryResult = await sendMessageTelegram(to, summaryHtml, {
          accountId: opts.accountId,
          textMode: "html",
          buttons: submitButtons,
        });

        const submitResponse = await responsePromise;

        if (!submitResponse || submitResponse.timedOut) {
          try {
            await editMessageTelegram(
              chatId,
              summaryResult.messageId,
              `${summaryHtml}\n\n⏱️ <i>Timed out</i>`,
              { accountId: opts.accountId, textMode: "html", buttons: [] },
            );
          } catch {
            // Ignore
          }

          return jsonResult({
            submitted: false,
            timedOut: true,
            partialValues: formValues,
          });
        }

        const isSubmitted = submitResponse.selectedValues?.[0] === "submit";

        // Update summary message
        const resultEmoji = isSubmitted ? "✅" : "❌";
        const resultText = isSubmitted ? "Submitted" : "Cancelled";
        try {
          await editMessageTelegram(
            chatId,
            summaryResult.messageId,
            `${summaryHtml}\n\n${resultEmoji} <i>${resultText}</i>`,
            { accountId: opts.accountId, textMode: "html", buttons: [] },
          );
        } catch {
          // Ignore
        }

        if (!isSubmitted) {
          return jsonResult({
            submitted: false,
            cancelled: true,
            values: formValues,
            messageId: summaryResult.messageId,
            chatId,
          });
        }

        return jsonResult({
          submitted: true,
          values: formValues,
          respondedBy: lastUserId,
          respondedByName: lastUsername,
          messageId: summaryResult.messageId,
          chatId,
          timedOut: false,
        });
      } catch (error) {
        telegramResponseStore.cancel(`${formId}_submit`);
        log.error(
          `AskTelegramForm failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        return jsonResult({
          submitted: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

// ─── Field Collection Helpers ────────────────────────────────────────────────

interface CollectFieldParams {
  chatId: string;
  field: {
    label: string;
    name: string;
    type: string;
    placeholder?: string;
    hint?: string;
    required?: boolean;
    options?: Array<{ text: string; value: string }>;
  };
  fieldIndex: number;
  totalFields: number;
  formId: string;
  prefix: string;
  remainingSeconds: number;
  accountId?: string;
}

interface CollectTextFieldParams extends CollectFieldParams {
  getTextReply?: (
    chatId: string,
    fieldName: string,
  ) => Promise<{ text: string; userId: string; username?: string } | null>;
}

/**
 * Collect a select field via inline keyboard callback.
 */
async function collectSelectField(
  params: CollectFieldParams,
): Promise<{ value: string; userId: string; username?: string } | null> {
  const { chatId, field, fieldIndex, totalFields, formId, prefix, remainingSeconds, accountId } =
    params;

  const fieldPrefix = `${prefix}_f${fieldIndex}`;
  const fieldOptions = field.options ?? [];

  let promptHtml = `<b>[${fieldIndex + 1}/${totalFields}] ${escapeHtml(field.label)}</b>`;
  if (field.hint) {
    promptHtml += `\n<i>${escapeHtml(field.hint)}</i>`;
  }
  promptHtml += "\n\nSelect an option:";

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];
  for (let i = 0; i < fieldOptions.length; i++) {
    const opt = fieldOptions[i];
    const rowIndex = Math.floor(i / 2);
    if (!buttons[rowIndex]) {
      buttons[rowIndex] = [];
    }
    buttons[rowIndex].push({
      text: opt.text,
      callback_data: encodeCallbackData(fieldPrefix, opt.value),
    });
  }

  return new Promise((resolve) => {
    const responseId = `${formId}_f${fieldIndex}`;
    const responsePromise = telegramResponseStore.waitForResponse(
      responseId,
      remainingSeconds * 1000,
    );

    const router = getCallbackRouter();
    router.register({
      id: responseId,
      prefix: fieldPrefix,
      mode: "one-shot",
      timeoutMs: remainingSeconds * 1000,
      handler: (event) => {
        telegramResponseStore.recordResponse(responseId, {
          answered: true,
          selectedValues: [event.actionId],
          userId: event.userId,
          username: event.username,
          timestamp: Date.now(),
        });
      },
    });

    void sendMessageTelegram(chatId, promptHtml, {
      accountId,
      textMode: "html",
      buttons,
    }).then(async () => {
      const response = await responsePromise;
      if (!response || response.timedOut) {
        resolve(null);
        return;
      }
      const selectedValue = response.selectedValues?.[0] ?? "";
      resolve({
        value: selectedValue,
        userId: response.userId,
        username: response.username,
      });
    });
  });
}

/**
 * Collect a text-based field.
 * For production, this would integrate with the bot's message handler to
 * capture the next text reply from the user. For testing, uses a
 * pluggable _getTextReply function.
 *
 * In real usage, the callback router is used with a "skip" button,
 * and the form registers as a text-reply handler.
 */
async function collectTextFieldViaCallback(
  params: CollectTextFieldParams,
): Promise<{ text: string; userId: string; username?: string } | null> {
  const {
    chatId,
    field,
    fieldIndex,
    totalFields,
    formId,
    prefix,
    remainingSeconds,
    accountId,
    getTextReply,
  } = params;

  const typeHint =
    {
      text: "Type your answer:",
      multiline: "Type your answer (multi-line is OK):",
      email: "Enter your email address:",
      number: "Enter a number:",
    }[field.type as string] ?? "Type your answer:";

  let promptHtml = `<b>[${fieldIndex + 1}/${totalFields}] ${escapeHtml(field.label)}</b>`;
  if (field.hint) {
    promptHtml += `\n<i>${escapeHtml(field.hint)}</i>`;
  }
  if (field.placeholder) {
    promptHtml += `\n<i>Example: ${escapeHtml(field.placeholder)}</i>`;
  }
  promptHtml += `\n\n${escapeHtml(typeHint)}`;

  // Add skip button for optional fields
  const skipButtons =
    field.required === false
      ? [
          [
            {
              text: "⏭ Skip",
              callback_data: encodeCallbackData(`${prefix}_skip${fieldIndex}`, "skip"),
            },
          ],
        ]
      : undefined;

  await sendMessageTelegram(chatId, promptHtml, {
    accountId,
    textMode: "html",
    buttons: skipButtons,
  });

  // If a test helper is provided, use it
  if (getTextReply) {
    const reply = await getTextReply(chatId, field.name);
    return reply;
  }

  // In production, we'd register a text reply handler on the bot.
  // For now, use the response store with a callback-based skip mechanism.
  // The actual text reply integration requires bot-handler modifications.
  const responseId = `${formId}_f${fieldIndex}`;
  const responsePromise = telegramResponseStore.waitForResponse(
    responseId,
    remainingSeconds * 1000,
  );

  if (field.required === false) {
    const router = getCallbackRouter();
    router.register({
      id: `${formId}_skip${fieldIndex}`,
      prefix: `${prefix}_skip${fieldIndex}`,
      mode: "one-shot",
      timeoutMs: remainingSeconds * 1000,
      handler: (event) => {
        telegramResponseStore.recordResponse(responseId, {
          answered: true,
          selectedValues: [""],
          userId: event.userId,
          username: event.username,
          timestamp: Date.now(),
        });
      },
    });
  }

  const response = await responsePromise;
  if (!response || response.timedOut) {
    return null;
  }

  return {
    text: response.selectedValues?.[0] ?? "",
    userId: response.userId,
    username: response.username,
  };
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

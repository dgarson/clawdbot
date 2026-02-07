/**
 * MCP tool for getting simple confirmation (Yes/No) from Slack users
 * Uses buttons and waits for user interaction
 */

import { Type } from "@sinclair/typebox";
import crypto from "node:crypto";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import { jsonResult } from "../../agents/tools/common.js";
import { globalHandlerRegistry } from "../blocks/interactive.js";
import { confirmation } from "../blocks/patterns.js";
import { sendMessageSlack } from "../send.js";
import { globalResponseStore } from "./response-store.js";

const InteractiveConfirmationInput = Type.Object({
  to: Type.String({
    description:
      "Recipient: Slack channel (e.g., '#general') or user (e.g., '@username' or user ID)",
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
  threadTs: Type.Optional(
    Type.String({
      description: "Optional thread timestamp to send confirmation in a thread",
    }),
  ),
});

interface InteractiveConfirmationToolOpts {
  accountId?: string;
  sessionKey?: string;
}

export function createSlackInteractiveConfirmationTool(
  opts: InteractiveConfirmationToolOpts = {},
): AnyAgentTool {
  return {
    name: "AskSlackConfirmation",
    label: "Ask Slack Confirmation",
    parameters: InteractiveConfirmationInput,
    description: `Ask for a simple Yes/No confirmation on Slack and WAIT for the user's response.

This tool sends a confirmation prompt with Confirm/Cancel buttons and blocks execution until the user responds or the timeout expires.

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
        threadTs,
      } = args;

      // Generate unique confirmation ID
      const confirmationId = crypto.randomBytes(16).toString("hex");
      const actionIdPrefix = `confirm_${confirmationId}`;

      // Build confirmation blocks using the existing pattern
      const blocks = confirmation({
        title,
        message,
        actionIdPrefix,
        confirmLabel,
        cancelLabel,
        style,
      });

      // Register handler for the response
      const responsePromise = globalResponseStore.waitForResponse(
        confirmationId,
        timeoutSeconds * 1000,
      );

      // Handler for confirm button
      const confirmActionId = `${actionIdPrefix}_confirm`;
      const cancelActionId = `${actionIdPrefix}_cancel`;

      const handleResponse =
        (isConfirmed: boolean) => async (params: { userId: string; userName?: string }) => {
          // Record response
          globalResponseStore.recordResponse(confirmationId, {
            answered: true,
            selectedValues: [isConfirmed ? "confirm" : "cancel"],
            userId: params.userId,
            userName: params.userName,
            timestamp: Date.now(),
          });

          // Unregister handlers
          globalHandlerRegistry.unregister(new RegExp(`^${confirmActionId}$`));
          globalHandlerRegistry.unregister(new RegExp(`^${cancelActionId}$`));
        };

      globalHandlerRegistry.register(new RegExp(`^${confirmActionId}$`), handleResponse(true));
      globalHandlerRegistry.register(new RegExp(`^${cancelActionId}$`), handleResponse(false));

      try {
        // Send the confirmation
        const result = await sendMessageSlack(to, `${title}: ${message}`, {
          blocks,
          threadTs,
          accountId: opts.accountId,
        });

        // Wait for response
        const response = await responsePromise;

        if (!response) {
          return jsonResult({
            answered: false,
            confirmed: false,
            timedOut: true,
            error: "No response received (internal error)",
          });
        }

        if (response.timedOut) {
          return jsonResult({
            answered: false,
            confirmed: false,
            timedOut: true,
            messageId: result.messageId,
            channelId: result.channelId,
          });
        }

        const isConfirmed = response.selectedValues?.[0] === "confirm";

        return jsonResult({
          answered: true,
          confirmed: isConfirmed,
          cancelled: !isConfirmed,
          respondedBy: response.userId,
          respondedByName: response.userName,
          messageId: result.messageId,
          channelId: result.channelId,
          timedOut: false,
        });
      } catch (error) {
        // Clean up on error
        globalResponseStore.cancel(confirmationId);
        globalHandlerRegistry.unregister(new RegExp(`^${confirmActionId}$`));
        globalHandlerRegistry.unregister(new RegExp(`^${cancelActionId}$`));

        return jsonResult({
          answered: false,
          confirmed: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    },
  };
}

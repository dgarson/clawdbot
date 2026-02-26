/**
 * MCP tool for getting simple confirmation (Yes/No) from Slack users
 * Uses buttons and waits for user interaction
 */

import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import { jsonResult } from "../../agents/tools/common.js";
import { askSlackConfirmation } from "../interactive/confirmation.js";

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
        confirmLabel,
        cancelLabel,
        style,
        timeoutSeconds,
        threadTs,
      } = args;

      const result = await askSlackConfirmation({
        to,
        title,
        message,
        confirmLabel,
        cancelLabel,
        style,
        timeoutSeconds,
        threadTs,
        accountId: opts.accountId,
      });

      return jsonResult(result);
    },
  };
}

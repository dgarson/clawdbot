import { Type } from "@sinclair/typebox";
import type { AnyAgentTool } from "../../agents/tools/common.js";
import { jsonResult } from "../../agents/tools/common.js";
import { askDiscordConfirmation } from "../interactive/confirmation.js";

const InteractiveConfirmationInput = Type.Object({
  to: Type.String({
    description: "The channel ID or user ID to send the confirmation to.",
  }),
  title: Type.String({
    description: "The title of the confirmation message.",
  }),
  message: Type.String({
    description: "The body text of the confirmation message.",
  }),
  confirmLabel: Type.Optional(
    Type.String({
      description: "Label for the confirm button. Default: 'Confirm'",
    }),
  ),
  cancelLabel: Type.Optional(
    Type.String({
      description: "Label for the cancel button. Default: 'Cancel'",
    }),
  ),
  style: Type.Optional(
    Type.String({
      description: "Style of the confirm button ('primary' or 'danger'). Default: 'primary'",
      enum: ["primary", "danger"],
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({
      description: "How long to wait for a response in seconds. Default: 300 (5 minutes).",
    }),
  ),
});

export type InteractiveConfirmationToolOpts = {
  accountId?: string;
};

export function createDiscordInteractiveConfirmationTool(
  opts: InteractiveConfirmationToolOpts = {},
): AnyAgentTool {
  return {
    name: "AskDiscordConfirmation",
    label: "Ask Discord Confirmation",
    parameters: InteractiveConfirmationInput,
    description: `Ask for a simple Yes/No confirmation on Discord and WAIT for the user's response.

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
      } = args;

      const result = await askDiscordConfirmation({
        to,
        title,
        message,
        confirmLabel,
        cancelLabel,
        style,
        timeoutSeconds,
        accountId: opts.accountId,
      });

      return jsonResult(result);
    },
  };
}

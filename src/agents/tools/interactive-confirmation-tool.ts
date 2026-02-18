import { Type } from "@sinclair/typebox";
import type { ChannelInteractiveAdapter } from "../../channels/plugins/types.interactive.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const InteractiveConfirmationSchema = Type.Object({
  to: Type.String({ description: "Target channel or user ID" }),
  title: Type.String({ description: "Short title for the confirmation" }),
  message: Type.String({ description: "Detailed message explaining what is being confirmed" }),
  confirmLabel: Type.Optional(
    Type.String({ description: 'Label for confirm button (default: "Approve")' }),
  ),
  cancelLabel: Type.Optional(
    Type.String({ description: 'Label for cancel button (default: "Deny")' }),
  ),
  style: Type.Optional(
    Type.Union([Type.Literal("primary"), Type.Literal("danger")], {
      description: 'Button style (default: "primary")',
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({ description: "Seconds to wait for response (default: 300)" }),
  ),
  threadId: Type.Optional(Type.String({ description: "Thread ID for threaded replies" })),
  accountId: Type.Optional(Type.String({ description: "Account ID override" })),
});

export function createInteractiveConfirmationTool(opts?: {
  resolveAdapter?: (channel: string) => ChannelInteractiveAdapter | undefined;
}): AnyAgentTool {
  return {
    label: "Ask Confirmation",
    name: "ask_confirmation",
    description:
      "Ask the user for approval (yes/no confirmation) and wait for their response. Sends interactive Approve/Deny buttons in channels that support them (Slack, Discord). Returns whether the user confirmed or denied.",
    parameters: InteractiveConfirmationSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const to = readStringParam(params, "to", { required: true });
      const title = readStringParam(params, "title", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const confirmLabel = readStringParam(params, "confirmLabel") ?? "Approve";
      const cancelLabel = readStringParam(params, "cancelLabel") ?? "Deny";
      const style = readStringParam(params, "style") as "primary" | "danger" | undefined;
      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" ? params.timeoutSeconds : 300;
      const threadId = readStringParam(params, "threadId");
      const accountId = readStringParam(params, "accountId");

      const adapter = opts?.resolveAdapter?.(to);
      if (!adapter) {
        throw new Error(
          `No interactive prompt adapter available for target "${to}". The channel may not support interactive prompts.`,
        );
      }

      const confirmationId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const response = await adapter.askConfirmation({
        to,
        confirmation: {
          id: confirmationId,
          title,
          message,
          confirmLabel,
          cancelLabel,
          style: style ?? "primary",
          timeoutMs: timeoutSeconds * 1000,
        },
        threadId: threadId ?? undefined,
        accountId: accountId ?? undefined,
      });

      return jsonResult(response);
    },
  };
}

import { Type } from "@sinclair/typebox";
import type { ChannelInteractiveAdapter } from "../../channels/plugins/types.interactive.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const InteractivePromptSchema = Type.Object({
  to: Type.String({ description: "Target channel or user ID" }),
  question: Type.String({ description: "The question to ask" }),
  options: Type.Array(
    Type.Object({
      value: Type.String({ description: "Machine-readable value returned on selection" }),
      label: Type.String({ description: "Human-readable label shown to user" }),
      description: Type.Optional(
        Type.String({ description: "Additional context for this option" }),
      ),
    }),
    { description: "Available choices (2-10 options)", minItems: 2 },
  ),
  allowMultiple: Type.Optional(
    Type.Boolean({ description: "Allow selecting multiple options (default: false)" }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({ description: "Seconds to wait for response (default: 300)" }),
  ),
  threadId: Type.Optional(Type.String({ description: "Thread ID for threaded replies" })),
  accountId: Type.Optional(Type.String({ description: "Account ID override" })),
});

export function createInteractivePromptTool(opts?: {
  resolveAdapter?: (channel: string) => ChannelInteractiveAdapter | undefined;
}): AnyAgentTool {
  return {
    label: "Ask Question",
    name: "ask_question",
    description:
      "Ask the user a multiple-choice question and wait for their response. Sends interactive buttons in channels that support them (Slack, Discord), falls back to numbered text options otherwise. Returns the user's selection(s).",
    parameters: InteractivePromptSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const to = readStringParam(params, "to", { required: true });
      const questionText = readStringParam(params, "question", { required: true });
      const options = params.options as Array<{
        value: string;
        label: string;
        description?: string;
      }>;
      const allowMultiple = params.allowMultiple === true;
      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" ? params.timeoutSeconds : 300;
      const threadId = readStringParam(params, "threadId");
      const accountId = readStringParam(params, "accountId");

      if (!options || options.length < 2) {
        throw new Error("At least 2 options are required.");
      }

      const adapter = opts?.resolveAdapter?.(to);
      if (!adapter) {
        throw new Error(
          `No interactive prompt adapter available for target "${to}". The channel may not support interactive prompts.`,
        );
      }

      const questionId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const response = await adapter.askQuestion({
        to,
        question: {
          id: questionId,
          text: questionText,
          options,
          allowMultiple,
          timeoutMs: timeoutSeconds * 1000,
        },
        threadId: threadId ?? undefined,
        accountId: accountId ?? undefined,
      });

      return jsonResult(response);
    },
  };
}

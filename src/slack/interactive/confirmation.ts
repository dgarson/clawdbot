/**
 * Reusable Slack confirmation logic
 */
import crypto from "node:crypto";
import { globalHandlerRegistry } from "../blocks/interactive.js";
import { confirmation } from "../blocks/patterns.js";
import { sendMessageSlack } from "../send.js";
import { globalResponseStore } from "../tools/response-store.js";

export type AskSlackConfirmationOptions = {
  to: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  style?: "primary" | "danger";
  timeoutSeconds?: number;
  threadTs?: string;
  accountId?: string;
};

export type AskSlackConfirmationResult = {
  confirmed: boolean;
  answered: boolean;
  timedOut: boolean;
  cancelled: boolean;
  respondedBy?: string;
  respondedByName?: string;
  messageId?: string;
  channelId?: string;
  error?: string;
};

export async function askSlackConfirmation(
  opts: AskSlackConfirmationOptions,
): Promise<AskSlackConfirmationResult> {
  const {
    to,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    style = "primary",
    timeoutSeconds = 300,
    threadTs,
    accountId,
  } = opts;

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
      accountId,
    });

    // Wait for response
    const response = await responsePromise;

    if (!response) {
      return {
        answered: false,
        confirmed: false,
        timedOut: true,
        cancelled: false,
        error: "No response received (internal error)",
      };
    }

    if (response.timedOut) {
      return {
        answered: false,
        confirmed: false,
        timedOut: true,
        cancelled: false,
        messageId: result.messageId,
        channelId: result.channelId,
      };
    }

    const isConfirmed = response.selectedValues?.[0] === "confirm";

    return {
      answered: true,
      confirmed: isConfirmed,
      cancelled: !isConfirmed,
      timedOut: false,
      respondedBy: response.userId,
      respondedByName: response.userName,
      messageId: result.messageId,
      channelId: result.channelId,
    };
  } catch (error) {
    // Clean up on error
    globalResponseStore.cancel(confirmationId);
    globalHandlerRegistry.unregister(new RegExp(`^${confirmActionId}$`));
    globalHandlerRegistry.unregister(new RegExp(`^${cancelActionId}$`));

    return {
      answered: false,
      confirmed: false,
      timedOut: false,
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

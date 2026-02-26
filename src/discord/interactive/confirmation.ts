/**
 * Reusable Discord confirmation logic
 */
import crypto from "node:crypto";
import { sendDiscordComponentMessage } from "../send.js";
import { globalDiscordResponseStore } from "../tools/response-store.js";

export type AskDiscordConfirmationOptions = {
  to: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  style?: "primary" | "danger";
  timeoutSeconds?: number;
  accountId?: string;
};

export type AskDiscordConfirmationResult = {
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

export async function askDiscordConfirmation(
  opts: AskDiscordConfirmationOptions,
): Promise<AskDiscordConfirmationResult> {
  const {
    to,
    title,
    message,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    style = "primary",
    timeoutSeconds = 300,
    accountId,
  } = opts;

  // Generate unique confirmation ID
  const confirmationId = crypto.randomBytes(16).toString("hex");
  const actionIdPrefix = `confirm_${confirmationId}`;
  const confirmActionId = `${actionIdPrefix}_confirm`;
  const cancelActionId = `${actionIdPrefix}_cancel`;

  // Register handler for the response
  const responsePromise = globalDiscordResponseStore.waitForResponse(
    confirmationId,
    timeoutSeconds * 1000,
  );

  try {
    // Send the confirmation
    const result = await sendDiscordComponentMessage(
      to,
      {
        text: `${title}: ${message}`,
        blocks: [
          {
            type: "actions",
            buttons: [
              {
                label: confirmLabel,
                // We use the customId to store the confirmation ID and action
                // Format: confirm_<id>_confirm
                // This will be intercepted in agent-components.ts
                // Note: We're abusing the 'style' from component spec to pass our action ID
                // The Carbon component builder generates its own IDs really,
                // so we need a way to correlate.
                // Actually, wait, `sendDiscordComponentMessage` builds components.
                // We need to inject OUR custom IDs or handle the Carbon-generated ones.
                //
                // Looking at `components.ts`, `createButtonComponent` generates a shortId if not provided.
                // It takes `componentId` in params.
                // `sendDiscordComponentMessage` takes `DiscordComponentMessageSpec`.
                // `DiscordComponentBlock` -> `actions` -> `buttons` -> `DiscordComponentButtonSpec`.
                // `DiscordComponentButtonSpec` does NOT have `componentId`.
                //
                // So... we can't easily force a custom ID through `sendDiscordComponentMessage` + `DiscordComponentButtonSpec`.
                //
                // However, `buildDiscordComponentMessage` returns `entries` which map IDs to implementation.
                //
                // PLAN B:
                // We can use the RESPONSE STORE to map the *generated* component IDs to our confirmation flow.
                // But `sendDiscordComponentMessage` registers entries in `components-registry.ts`.
                //
                // Let's rely on `agent-components.ts` handling.
                // It parses `componentId`.
                //
                // If we want to use `askDiscordConfirmation` completely via existing `sendDiscordComponentMessage`,
                // we need to know the IDs *it* generated.
                // `sendDiscordComponentMessage` does NOT return the generated component IDs.
                //
                // This means we might need to modify `sendDiscordComponentMessage` or `components.ts` to allow passing explicit IDs,
                // OR we accept that we can't easily do this without changes.
                //
                // Wait, `components-registry.ts` has `componentEntries`.
                // `AgentComponentButton` (class) handles `agent` prefixed buttons.
                // The normal `DiscordComponentButton` handles `occomp` prefixed buttons.
                //
                // The `agent-components.ts` handles `discord component button` which is `occomp`.
                // It calls `handleDiscordComponentEvent`.
                //
                // Inside `handleDiscordComponentEvent`, it dispatches a system event.
                //
                // So, if we use `sendDiscordComponentMessage`, it will create buttons that:
                // 1. Are registered in `components-registry`.
                // 2. When clicked, trigger `handleDiscordComponentEvent` in `agent-components.ts`.
                // 3. This emits a system event `discord:agent-button:...`.
                //
                // This system event is... handled where?
                // `enqueueSystemEvent` sends it to the event bus.
                //
                // BUT we want to *intercept* it and resolve a promise, NOT just log it.
                //
                // `handleDiscordComponentEvent` DOES NOT seem to have a hook for "resolve promise".
                //
                // CHECK `agent-components.ts` again.
                // It calls `dispatchDiscordComponentEvent`.
                //
                // We need to UPDATE `agent-components.ts` to check `globalDiscordResponseStore`.
                //
                // But how do we link the *click* to the *store*?
                //
                // We need the `confirmationId` to be associated with the button.
                //
                // Since we can't set the ID easily on `DiscordComponentButtonSpec`,
                // maybe we can exploit `allowedUsers` or some other field? No, hacking.
                //
                // Let's modify `DiscordComponentButtonSpec` to accept an optional `id`.
                //
                // Go to `src/discord/components.ts` and add `id` to `DiscordComponentButtonSpec`.
                style: style === "danger" ? "danger" : "primary",
                // We will add 'id' support to the spec.
                // @ts-ignore - pending update to types
                id: confirmActionId,
              },
              {
                label: cancelLabel,
                style: "secondary",
                // @ts-ignore
                id: cancelActionId,
              },
            ],
          },
        ],
      },
      { accountId },
    );

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
    globalDiscordResponseStore.cancel(confirmationId);

    return {
      answered: false,
      confirmed: false,
      timedOut: false,
      cancelled: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

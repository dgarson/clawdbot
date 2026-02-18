import type { Block, KnownBlock } from "@slack/web-api";
import type {
  ChannelInteractiveAdapter,
  InteractivePromptConfirmation,
  InteractivePromptQuestion,
  InteractivePromptResponse,
} from "../channels/plugins/types.interactive.js";
import type { SystemEvent } from "../infra/system-events.js";
import { button, mrkdwn, section, actions, header } from "./blocks/builders.js";
import type { SlackSendResult } from "./send.js";

const OPENCLAW_ACTION_PREFIX = "openclaw:";
const DEFAULT_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const POLL_INTERVAL_MS = 500;

type SlackInteractiveAdapterDeps = {
  sendMessageSlack: (
    to: string,
    message: string,
    opts?: { blocks?: (Block | KnownBlock)[]; threadTs?: string; accountId?: string },
  ) => Promise<SlackSendResult>;
  pollSystemEvents: (sessionKey: string) => SystemEvent[];
};

function buildQuestionBlocks(question: InteractivePromptQuestion): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [];

  blocks.push(section({ text: mrkdwn(question.text) }) as unknown as KnownBlock);

  const buttons = question.options.map((opt) =>
    button({
      text: opt.label,
      actionId: `${OPENCLAW_ACTION_PREFIX}question:${question.id}:${opt.value}`,
      value: opt.value,
    }),
  );

  blocks.push(actions({ elements: buttons }) as unknown as KnownBlock);

  return blocks;
}

function buildConfirmationBlocks(
  confirmation: InteractivePromptConfirmation,
): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [];

  if (confirmation.title) {
    // NOTE: header() takes (text: string, blockId?: string), NOT a params object
    blocks.push(header(confirmation.title) as unknown as KnownBlock);
  }

  blocks.push(section({ text: mrkdwn(confirmation.message) }) as unknown as KnownBlock);

  const confirmBtn = button({
    text: confirmation.confirmLabel ?? "Approve",
    actionId: `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:confirm`,
    value: "confirm",
    style: confirmation.style ?? "primary",
  });

  const cancelBtn = button({
    text: confirmation.cancelLabel ?? "Deny",
    actionId: `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:cancel`,
    value: "cancel",
  });

  blocks.push(actions({ elements: [confirmBtn, cancelBtn] }) as unknown as KnownBlock);

  return blocks;
}

function matchInteractionEvent(
  events: SystemEvent[],
  actionPrefix: string,
): { actionId: string; selectedValues: string[]; userId?: string; userName?: string } | null {
  for (const event of events) {
    if (!event.text.includes("Slack interaction:")) {
      continue;
    }
    try {
      const jsonStart = event.text.indexOf("{");
      if (jsonStart < 0) {
        continue;
      }
      const payload = JSON.parse(event.text.slice(jsonStart));
      if (typeof payload.actionId === "string" && payload.actionId.startsWith(actionPrefix)) {
        return {
          actionId: payload.actionId,
          selectedValues: payload.selectedValues ?? [payload.value].filter(Boolean),
          userId: payload.userId,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function waitForInteraction(params: {
  actionPrefix: string;
  timeoutMs: number;
  pollSystemEvents: (sessionKey: string) => SystemEvent[];
  sessionKey: string;
}): Promise<InteractivePromptResponse> {
  const deadline = Date.now() + params.timeoutMs;

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() >= deadline) {
        resolve({
          answered: false,
          timedOut: true,
          timestamp: Date.now(),
        });
        return;
      }

      const events = params.pollSystemEvents(params.sessionKey);
      const match = matchInteractionEvent(events, params.actionPrefix);

      if (match) {
        resolve({
          answered: true,
          timedOut: false,
          selectedValues: match.selectedValues,
          confirmed: match.selectedValues.includes("confirm")
            ? true
            : match.selectedValues.includes("cancel")
              ? false
              : undefined,
          respondedBy: match.userId ? { id: match.userId, name: match.userName } : undefined,
          timestamp: Date.now(),
        });
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });
}

export function createSlackInteractiveAdapter(
  deps: SlackInteractiveAdapterDeps,
): ChannelInteractiveAdapter {
  return {
    askQuestion: async (params) => {
      const question = params.question;
      const timeoutMs = question.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const blocks = buildQuestionBlocks(question);
      const fallbackText = `${question.text}\n${question.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;

      await deps.sendMessageSlack(params.to, fallbackText, {
        blocks,
        threadTs: params.threadId,
        accountId: params.accountId,
      });

      const actionPrefix = `${OPENCLAW_ACTION_PREFIX}question:${question.id}:`;

      return waitForInteraction({
        actionPrefix,
        timeoutMs,
        pollSystemEvents: deps.pollSystemEvents,
        sessionKey: params.to,
      });
    },

    askConfirmation: async (params) => {
      const confirmation = params.confirmation;
      const timeoutMs = confirmation.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const blocks = buildConfirmationBlocks(confirmation);
      const fallbackText = `${confirmation.title}: ${confirmation.message}`;

      await deps.sendMessageSlack(params.to, fallbackText, {
        blocks,
        threadTs: params.threadId,
        accountId: params.accountId,
      });

      const actionPrefix = `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:`;

      return waitForInteraction({
        actionPrefix,
        timeoutMs,
        pollSystemEvents: deps.pollSystemEvents,
        sessionKey: params.to,
      });
    },
  };
}

import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import type { SlackExecApprovalConfig } from "../../config/types.slack.js";
import { buildGatewayConnectionDetails } from "../../gateway/call.js";
import { GatewayClient } from "../../gateway/client.js";
import type { EventFrame } from "../../gateway/protocol/index.js";
import type { ExecApprovalDecision, ExecApprovalRequest } from "../../infra/exec-approvals.js";
import { peekSystemEventEntries } from "../../infra/system-events.js";
import { logDebug, logError } from "../../logger.js";
import { normalizeAccountId, resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import type { RuntimeEnv } from "../../runtime.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeMessageChannel,
} from "../../utils/message-channel.js";
import { actions, button, divider, header, mrkdwn, section } from "../blocks/builders.js";
import type { SlackBlock } from "../blocks/types.js";
import { sendMessageSlack } from "../send.js";

export type { ExecApprovalRequest };

const APPROVAL_ACTION_PREFIX = "openclaw:question:";
const POLL_INTERVAL_MS = 500;

export function buildExecApprovalActionId(
  requestId: string,
  decision: ExecApprovalDecision,
): string {
  return `${APPROVAL_ACTION_PREFIX}${requestId}:${decision}`;
}

export function buildExecApprovalBlocks(request: ExecApprovalRequest): SlackBlock[] {
  const cmd = request.request.command;
  const preview = cmd.length > 800 ? `${cmd.slice(0, 800)}...` : cmd;

  const metaLines: string[] = [];
  if (request.request.cwd) {
    metaLines.push(`*CWD:* ${request.request.cwd}`);
  }
  if (request.request.host) {
    metaLines.push(`*Host:* ${request.request.host}`);
  }
  if (request.request.agentId) {
    metaLines.push(`*Agent:* ${request.request.agentId}`);
  }

  const blocks: SlackBlock[] = [
    header("Exec Approval Required"),
    section({ text: mrkdwn(`*Command:*\n\`\`\`\n${preview}\n\`\`\``) }),
  ];

  if (metaLines.length > 0) {
    blocks.push(section({ text: mrkdwn(metaLines.join("\n")) }));
  }

  blocks.push(divider());
  blocks.push(
    actions({
      elements: [
        button({
          text: "Allow once",
          actionId: buildExecApprovalActionId(request.id, "allow-once"),
          value: "allow-once",
          style: "primary",
        }),
        button({
          text: "Always allow",
          actionId: buildExecApprovalActionId(request.id, "allow-always"),
          value: "allow-always",
        }),
        button({
          text: "Deny",
          actionId: buildExecApprovalActionId(request.id, "deny"),
          value: "deny",
          style: "danger",
        }),
      ],
    }),
  );

  return blocks;
}

/** Extract Slack channel ID from a session key like "agent:main:slack:channel:C1234567890" */
export function extractSlackChannelId(sessionKey?: string | null): string | null {
  if (!sessionKey) {
    return null;
  }
  const match = sessionKey.match(/slack:(?:channel|group):([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

export type SlackExecApprovalHandlerOpts = {
  botToken: string;
  accountId: string;
  config: SlackExecApprovalConfig;
  gatewayUrl?: string;
  cfg: OpenClawConfig;
  runtime?: RuntimeEnv;
};

export class SlackExecApprovalHandler {
  private gatewayClient: GatewayClient | null = null;
  private opts: SlackExecApprovalHandlerOpts;
  private started = false;

  constructor(opts: SlackExecApprovalHandlerOpts) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.started) {
      return;
    }
    this.started = true;

    const config = this.opts.config;
    if (!config.enabled) {
      logDebug("slack exec approvals: disabled");
      return;
    }

    if (!config.approvers || config.approvers.length === 0) {
      logDebug("slack exec approvals: no approvers configured");
      return;
    }

    logDebug("slack exec approvals: starting handler");

    const { url: gatewayUrl } = buildGatewayConnectionDetails({
      config: this.opts.cfg,
      url: this.opts.gatewayUrl,
    });

    this.gatewayClient = new GatewayClient({
      url: gatewayUrl,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: "Slack Exec Approvals",
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      scopes: ["operator.approvals"],
      onEvent: (evt) => this.handleGatewayEvent(evt),
      onHelloOk: () => {
        logDebug("slack exec approvals: connected to gateway");
      },
      onConnectError: (err) => {
        logError(`slack exec approvals: connect error: ${err.message}`);
      },
      onClose: (code, reason) => {
        logDebug(`slack exec approvals: gateway closed: ${code} ${reason}`);
      },
    });

    this.gatewayClient.start();
  }

  async stop(): Promise<void> {
    if (!this.started) {
      return;
    }
    this.started = false;

    this.gatewayClient?.stop();
    this.gatewayClient = null;

    logDebug("slack exec approvals: stopped");
  }

  private handleGatewayEvent(evt: EventFrame): void {
    if (evt.event === "exec.approval.requested") {
      const request = evt.payload as ExecApprovalRequest;
      void this.handleApprovalRequested(request);
    }
  }

  shouldHandle(request: ExecApprovalRequest): boolean {
    const config = this.opts.config;
    if (!config.enabled) {
      return false;
    }
    if (!config.approvers || config.approvers.length === 0) {
      return false;
    }

    if (!this.isForThisAccount(request)) {
      return false;
    }

    // Check agent filter
    if (config.agentFilter?.length) {
      if (!request.request.agentId) {
        return false;
      }
      if (!config.agentFilter.includes(request.request.agentId)) {
        return false;
      }
    }

    // Check session filter (substring or regex match)
    if (config.sessionFilter?.length) {
      const session = request.request.sessionKey;
      if (!session) {
        return false;
      }
      const matches = config.sessionFilter.some((p) => {
        try {
          return session.includes(p) || new RegExp(p).test(session);
        } catch {
          return session.includes(p);
        }
      });
      if (!matches) {
        return false;
      }
    }

    return true;
  }

  private isForThisAccount(request: ExecApprovalRequest): boolean {
    const sessionKey = request.request.sessionKey?.trim();
    if (!sessionKey) {
      return true;
    }
    try {
      const agentId = resolveAgentIdFromSessionKey(sessionKey);
      const storePath = resolveStorePath(this.opts.cfg.session?.store, { agentId });
      const store = loadSessionStore(storePath);
      const entry = store[sessionKey];
      const channel = normalizeMessageChannel(entry?.origin?.provider ?? entry?.lastChannel);
      if (channel && channel !== "slack") {
        return false;
      }
      const accountId = entry?.origin?.accountId ?? entry?.lastAccountId;
      if (!accountId) {
        return true;
      }
      return normalizeAccountId(accountId) === normalizeAccountId(this.opts.accountId);
    } catch {
      return true;
    }
  }

  private async handleApprovalRequested(request: ExecApprovalRequest): Promise<void> {
    if (!this.shouldHandle(request)) {
      return;
    }

    const channelId = extractSlackChannelId(request.request.sessionKey);
    if (!channelId) {
      logError(
        `slack exec approvals: cannot extract channel id from "${request.request.sessionKey ?? "(none)"}"`,
      );
      return;
    }

    const blocks = buildExecApprovalBlocks(request);
    const preview = request.request.command.slice(0, 100);
    const fallbackText = `\uD83D\uDD12 Exec approval required for: ${preview}`;

    try {
      await sendMessageSlack(channelId, fallbackText, {
        blocks,
        accountId: this.opts.accountId,
      });
    } catch (err) {
      logError(`slack exec approvals: failed to post message for ${request.id}: ${String(err)}`);
      return;
    }

    const timeoutMs = Math.max(0, request.expiresAtMs - Date.now());
    const sessionKey = request.request.sessionKey ?? "";
    if (!sessionKey) {
      logDebug(`slack exec approvals: no session key for ${request.id}, cannot poll`);
      return;
    }

    const actionPrefix = `${APPROVAL_ACTION_PREFIX}${request.id}:`;
    const approvers = this.opts.config.approvers ?? [];

    logDebug(`slack exec approvals: polling for decision on ${request.id}`);

    const decision = await pollForApprovalDecision({
      sessionKey,
      actionPrefix,
      timeoutMs,
      approvers,
    });

    if (!decision) {
      logDebug(`slack exec approvals: approval ${request.id} timed out or no authorized click`);
      return;
    }

    if (!this.gatewayClient) {
      logError(`slack exec approvals: gateway client not available to resolve ${request.id}`);
      return;
    }

    logDebug(`slack exec approvals: resolving ${request.id} with ${decision}`);
    try {
      await this.gatewayClient.request("exec.approval.resolve", {
        id: request.id,
        decision,
      });
    } catch (err) {
      logError(`slack exec approvals: failed to resolve ${request.id}: ${String(err)}`);
    }
  }
}

async function pollForApprovalDecision(params: {
  sessionKey: string;
  actionPrefix: string;
  timeoutMs: number;
  approvers: string[];
}): Promise<ExecApprovalDecision | null> {
  const deadline = Date.now() + params.timeoutMs;

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }

      const events = peekSystemEventEntries(params.sessionKey);
      for (const event of events) {
        if (!event.text.includes("Slack interaction:")) {
          continue;
        }
        try {
          const jsonStart = event.text.indexOf("{");
          if (jsonStart < 0) {
            continue;
          }
          const payload = JSON.parse(event.text.slice(jsonStart)) as {
            actionId?: string;
            userId?: string;
          };
          if (typeof payload.actionId !== "string") {
            continue;
          }
          if (!payload.actionId.startsWith(params.actionPrefix)) {
            continue;
          }
          if (params.approvers.length > 0 && !params.approvers.includes(payload.userId ?? "")) {
            continue;
          }
          const raw = payload.actionId.slice(params.actionPrefix.length);
          if (raw !== "allow-once" && raw !== "allow-always" && raw !== "deny") {
            continue;
          }
          resolve(raw as ExecApprovalDecision);
          return;
        } catch {
          continue;
        }
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });
}

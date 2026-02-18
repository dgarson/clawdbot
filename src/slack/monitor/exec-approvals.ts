import type { OpenClawConfig } from "../../config/config.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import type { SlackExecApprovalConfig } from "../../config/types.slack.js";
import { buildGatewayConnectionDetails } from "../../gateway/call.js";
import { GatewayClient } from "../../gateway/client.js";
import type { EventFrame } from "../../gateway/protocol/index.js";
import type { ExecApprovalRequest } from "../../infra/exec-approvals.js";
import { logDebug, logError } from "../../logger.js";
import { normalizeAccountId, resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import type { RuntimeEnv } from "../../runtime.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  normalizeMessageChannel,
} from "../../utils/message-channel.js";

export type { ExecApprovalRequest };

/** Extract Slack channel ID from a session key like "agent:main:slack:channel:C1234567890" */
export function extractSlackChannelId(sessionKey?: string | null): string | null {
  if (!sessionKey) {
    return null;
  }
  const match = sessionKey.match(/slack:(?:channel|group):([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

export type SlackExecApprovalHandlerOpts = {
  token: string;
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

  private async handleApprovalRequested(_request: ExecApprovalRequest): Promise<void> {
    // Stub — implemented in Task 5
  }
}

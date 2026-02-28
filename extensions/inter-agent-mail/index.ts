/**
 * inter-agent-mail plugin
 *
 * Exposes two agent tools:
 *   - "mail"        — unified inbox/ack/send/forward/recipients (always opt-in)
 *   - "bounce_mail" — return-to-sender with reason + confidence (separate opt-in)
 *
 * Also registers a before_prompt_build hook that notifies agents when they have
 * unread mail, and a CLI `openclaw mail` command for operator mailbox management.
 *
 * All tools are optional (must be explicitly allowlisted per agent).
 * Sender identity is always sourced from ctx.agentId; callers cannot spoof it.
 */

import type {
  AnyAgentTool,
  OpenClawPluginApi,
  PluginHookAfterToolCallEvent,
  PluginHookToolContext,
} from "../../src/plugins/types.js";
import { registerMailCli } from "./src/cli.js";
import { createInterAgentMailConfigSchema, parsePluginConfig } from "./src/config.js";
import {
  createBeforeToolCallEnforcementHook,
  consumeLastInboxClaimedCount,
  trackInboxResult,
  _getRunState,
} from "./src/enforcement.js";
import { createBeforePromptBuildHook } from "./src/hook.js";
import { countUnread, mailboxPath } from "./src/store.js";
import { createBounceMailTool, createMailTool } from "./src/tools.js";

const plugin = {
  id: "inter-agent-mail",
  name: "Inter-Agent Mail",
  description:
    "Secure asynchronous messaging between agents with ACLs, urgency levels, tags, forwarding chains, and at-least-once delivery guarantees via processing leases.",
  configSchema: createInterAgentMailConfigSchema(),

  register(api: OpenClawPluginApi) {
    // ── Resolve plugin config ───────────────────────────────────────────────

    const parsed = parsePluginConfig(api.pluginConfig);
    if (!parsed.ok) {
      api.logger.error(`[inter-agent-mail] Invalid plugin config: ${parsed.message}`);
      return;
    }
    const config = parsed.value;

    // ── Resolve stateDir ────────────────────────────────────────────────────
    // Captured when the service starts; tools/hook read it lazily.

    let stateDir: string | null = null;

    api.registerService({
      id: "inter-agent-mail",
      async start(ctx) {
        stateDir = ctx.stateDir;
        ctx.logger.info(`[inter-agent-mail] mailbox root: ${stateDir}`);
      },
      async stop(_ctx) {
        stateDir = null;
      },
    });

    // ── Unified "mail" tool ─────────────────────────────────────────────────

    api.registerTool(
      (_ctx) => {
        const dir = stateDir ?? resolveStateDirFallback();
        return createMailTool({
          stateDir: dir,
          config,
          api: api.runtime as Parameters<typeof createMailTool>[0]["api"],
        }) as unknown as AnyAgentTool;
      },
      { name: "mail", optional: true },
    );

    // ── Opt-in "bounce_mail" tool ────────────────────────────────────────────
    // Separate allowlist entry: agents must be granted both "mail" AND "bounce_mail"
    // for bouncing to be available. bounce_enabled in delivery policy is an additional
    // runtime guard but the allowlist is the primary gate.

    api.registerTool(
      (_ctx) => {
        const dir = stateDir ?? resolveStateDirFallback();
        return createBounceMailTool({
          stateDir: dir,
          config,
          api: api.runtime as Parameters<typeof createBounceMailTool>[0]["api"],
        }) as unknown as AnyAgentTool;
      },
      { name: "bounce_mail", optional: true },
    );

    // ── Hook: inject inbox notification into agent system prompt ────────────

    api.on(
      "before_prompt_build",
      createBeforePromptBuildHook({
        get stateDir() {
          return stateDir ?? resolveStateDirFallback();
        },
        config,
      }),
    );

    // ── Hook: enforce inbox check before tool calls ──────────────────────────

    if (config.defaultEnforcement !== "none") {
      api.logger.info(
        `[inter-agent-mail] Enforcement "${config.defaultEnforcement}" active. "mail" tool MUST be allowlisted for all enforced agents.`,
      );

      api.on(
        "before_tool_call",
        createBeforeToolCallEnforcementHook({
          get stateDir() {
            return stateDir ?? resolveStateDirFallback();
          },
          config,
        }),
      );

      // Track inbox claim results for ack enforcement (strict mode)
      api.on(
        "after_tool_call",
        (event: PluginHookAfterToolCallEvent, ctx: PluginHookToolContext) => {
          if (event.toolName !== "mail") return;
          const action = (event.params as Record<string, unknown>)?.action;
          if (action !== "inbox") return;

          const agentId = ctx.agentId?.trim();
          const sessionKey = ctx.sessionKey?.trim();
          if (!agentId || !sessionKey) return;

          // Use side-channel count set by the tool itself (avoids fragile regex)
          const claimedCount = consumeLastInboxClaimedCount(agentId, sessionKey);
          if (claimedCount > 0) {
            trackInboxResult(agentId, sessionKey, claimedCount);
          }
        },
      );
    }

    // ── Hook: enforce pending acks before session end (strict mode only) ───

    if (config.defaultEnforcement === "strict") {
      api.on("before_session_end", async (_event, ctx) => {
        const agentId = ctx.agentId?.trim();
        const sessionKey = ctx.sessionKey?.trim();
        if (!agentId || !sessionKey) return;

        const state = _getRunState(agentId, sessionKey);

        // Check for pending acks first
        if (state && state.pendingAckCount > 0) {
          return {
            continuationPrompt:
              `[inter-agent-mail] You have ${state.pendingAckCount} claimed message${state.pendingAckCount !== 1 ? "s" : ""} ` +
              `pending acknowledgment. Call mail(action='ack', message_ids=[...]) to acknowledge them before finishing.`,
            reason: `${state.pendingAckCount} unacked messages at run end`,
          };
        }

        // Check for unread non-urgent mail that was deferred during the run
        const dir = stateDir ?? resolveStateDirFallback();
        const filePath = mailboxPath(dir, agentId);
        const summary = await countUnread(filePath, Date.now());
        if (summary.total > 0) {
          return {
            continuationPrompt:
              `[inter-agent-mail] You have ${summary.total} unread message${summary.total !== 1 ? "s" : ""} in your inbox. ` +
              `Call mail(action='inbox') to claim and process them before finishing.`,
            reason: `${summary.total} unread messages at run end`,
          };
        }
      });
    }

    // ── CLI: openclaw mail list / delete ────────────────────────────────────

    api.registerCli(registerMailCli, { commands: ["mail"] });
  },
};

export default plugin;

// ── Fallback stateDir when service hasn't started (e.g. unit tests) ─────────

function resolveStateDirFallback(): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) return env;
  return process.cwd();
}

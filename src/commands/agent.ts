import type { EmbeddedPiRunResult } from "../agents/pi-embedded-runner/types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { ExecutionRequest, ExecutionResult, MessageContext } from "../execution/index.js";
import type { AgentCommandOpts } from "./agent/types.js";
import { listAgentIds, resolveAgentDir, resolveAgentWorkspaceDir } from "../agents/agent-scope.js";
import { resolveAgentTimeoutMs } from "../agents/timeout.js";
import { ensureAgentWorkspace } from "../agents/workspace.js";
import { formatCliCommand } from "../cli/command-format.js";
import { type CliDeps, createDefaultDeps } from "../cli/deps.js";
import { loadConfig } from "../config/config.js";
import { resolveAgentIdFromSessionKey } from "../config/sessions.js";
import { createDefaultExecutionKernel } from "../execution/index.js";
import { normalizeAgentId } from "../routing/session-key.js";
import { defaultRuntime, type RuntimeEnv } from "../runtime.js";
import { deliverAgentCommandResult } from "./agent/delivery.js";
import { resolveAgentRunContext } from "./agent/run-context.js";
import { resolveSession } from "./agent/session.js";

export async function agentCommand(
  opts: AgentCommandOpts,
  runtime: RuntimeEnv = defaultRuntime,
  deps: CliDeps = createDefaultDeps(),
) {
  const body = (opts.message ?? "").trim();
  if (!body) {
    throw new Error("Message (--message) is required");
  }
  if (!opts.to && !opts.sessionId && !opts.sessionKey && !opts.agentId) {
    throw new Error("Pass --to <E.164>, --session-id, or --agent to choose a session");
  }

  const cfg = loadConfig();

  // --- Agent ID validation ---
  const agentIdOverrideRaw = opts.agentId?.trim();
  const agentIdOverride = agentIdOverrideRaw ? normalizeAgentId(agentIdOverrideRaw) : undefined;
  if (agentIdOverride) {
    const knownAgents = listAgentIds(cfg);
    if (!knownAgents.includes(agentIdOverride)) {
      throw new Error(
        `Unknown agent id "${agentIdOverrideRaw}". Use "${formatCliCommand("openclaw agents list")}" to see configured agents.`,
      );
    }
  }
  if (agentIdOverride && opts.sessionKey) {
    const sessionAgentId = resolveAgentIdFromSessionKey(opts.sessionKey);
    if (sessionAgentId !== agentIdOverride) {
      throw new Error(
        `Agent id "${agentIdOverrideRaw}" does not match session key agent "${sessionAgentId}".`,
      );
    }
  }

  // --- Workspace + agent directory resolution ---
  const sessionAgentId = agentIdOverride ?? resolveAgentIdFromSessionKey(opts.sessionKey?.trim());
  const agentDir = resolveAgentDir(cfg, sessionAgentId);
  const agentCfg = cfg.agents?.defaults;
  const workspaceDirRaw = resolveAgentWorkspaceDir(cfg, sessionAgentId);
  const workspace = await ensureAgentWorkspace({
    dir: workspaceDirRaw,
    ensureBootstrapFiles: !agentCfg?.skipBootstrap,
  });
  const workspaceDir = workspace.dir;

  // --- Timeout resolution ---
  const timeoutSecondsRaw =
    opts.timeout !== undefined ? Number.parseInt(String(opts.timeout), 10) : undefined;
  if (
    timeoutSecondsRaw !== undefined &&
    (Number.isNaN(timeoutSecondsRaw) || timeoutSecondsRaw <= 0)
  ) {
    throw new Error("--timeout must be a positive integer (seconds)");
  }
  const timeoutMs = resolveAgentTimeoutMs({ cfg, overrideSeconds: timeoutSecondsRaw });

  // --- Session resolution ---
  const { sessionId, sessionKey, sessionEntry } = resolveSession({
    cfg,
    to: opts.to,
    sessionId: opts.sessionId,
    sessionKey: opts.sessionKey,
    agentId: agentIdOverride,
  });
  const runId = opts.runId?.trim() || sessionId;

  // --- Build ExecutionRequest ---
  const request: ExecutionRequest = {
    agentId: sessionAgentId ?? "main",
    sessionId,
    sessionKey,
    runId,
    workspaceDir,
    agentDir,
    config: cfg,
    spawnedBy: opts.spawnedBy ?? sessionEntry?.spawnedBy,
    prompt: body,
    images: opts.images as ExecutionRequest["images"],
    extraSystemPrompt: opts.extraSystemPrompt,
    timeoutMs,
    messageContext: buildMessageContext(opts),
  };

  // --- Execute via kernel ---
  const kernel = createDefaultExecutionKernel();
  const result = await kernel.execute(request);

  if (!result.success) {
    throw new Error(result.error?.message ?? "Execution failed");
  }

  // --- Deliver result using existing delivery pipeline ---
  const legacyResult = mapExecutionResultToLegacy(result);
  return deliverAgentCommandResult({
    cfg,
    deps,
    runtime,
    opts,
    sessionEntry,
    result: legacyResult,
    payloads: legacyResult.payloads ?? [],
  });
}

/**
 * Build MessageContext from CLI opts for the ExecutionRequest.
 */
function buildMessageContext(opts: AgentCommandOpts): MessageContext | undefined {
  const runContext = resolveAgentRunContext(opts);
  if (!runContext.messageChannel && !opts.accountId && !opts.groupId && !opts.threadId) {
    return undefined;
  }
  return {
    channel: runContext.messageChannel,
    accountId: runContext.accountId,
    groupId: runContext.groupId,
    groupChannel: runContext.groupChannel,
    groupSpace: runContext.groupSpace,
    threadId: opts.threadId,
  };
}

/**
 * Map ExecutionResult to the legacy EmbeddedPiRunResult format
 * required by deliverAgentCommandResult.
 */
function mapExecutionResultToLegacy(result: ExecutionResult): EmbeddedPiRunResult {
  return {
    payloads: result.payloads.map((p) => ({
      text: p.text,
      mediaUrl: p.mediaUrl,
      mediaUrls: p.mediaUrls,
      replyToId: p.replyToId,
      isError: p.isError,
    })),
    meta: {
      durationMs: result.usage.durationMs,
      aborted: result.aborted,
      agentMeta: {
        sessionId: "",
        provider: result.runtime.provider ?? "",
        model: result.runtime.model ?? "",
        usage: {
          input: result.usage.inputTokens,
          output: result.usage.outputTokens,
          cacheRead: result.usage.cacheReadTokens,
          cacheWrite: result.usage.cacheWriteTokens,
          total: result.usage.inputTokens + result.usage.outputTokens,
        },
      },
    },
    didSendViaMessagingTool: result.didSendViaMessagingTool,
  };
}

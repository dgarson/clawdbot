import type { OpenClawConfig } from "../config/config.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import type {
  ExecApprovalForwardingConfig,
  ExecApprovalForwardTarget,
} from "../config/types.approvals.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { parseAgentSessionKey } from "../routing/session-key.js";
import { isDeliverableMessageChannel, normalizeMessageChannel } from "../utils/message-channel.js";
import type {
  ExecApprovalDecision,
  ExecApprovalRequest,
  ExecApprovalResolved,
} from "./exec-approvals.js";
import { deliverOutboundPayloads } from "./outbound/deliver.js";
import { resolveSessionDeliveryTarget } from "./outbound/targets.js";

const log = createSubsystemLogger("gateway/exec-approvals");

export type { ExecApprovalRequest, ExecApprovalResolved };

type ForwardTarget = ExecApprovalForwardTarget & { source: "session" | "target" };

type PendingApproval = {
  request: ExecApprovalRequest;
  targets: ForwardTarget[];
  escalationTargets: ForwardTarget[];
  timeoutId: NodeJS.Timeout | null;
  escalationTimeoutId: NodeJS.Timeout | null;
};

export type ExecApprovalForwarder = {
  handleRequested: (request: ExecApprovalRequest) => Promise<void>;
  handleResolved: (resolved: ExecApprovalResolved) => Promise<void>;
  stop: () => void;
};

export type ExecApprovalForwarderDeps = {
  getConfig?: () => OpenClawConfig;
  deliver?: typeof deliverOutboundPayloads;
  nowMs?: () => number;
  resolveSessionTarget?: (params: {
    cfg: OpenClawConfig;
    request: ExecApprovalRequest;
  }) => ExecApprovalForwardTarget | null;
};

const DEFAULT_MODE = "session" as const;

function normalizeMode(mode?: ExecApprovalForwardingConfig["mode"]) {
  return mode ?? DEFAULT_MODE;
}

function normalizeEscalationDelayMs(value: number | undefined): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.trunc(value));
}

function matchSessionFilter(sessionKey: string, patterns: string[]): boolean {
  return patterns.some((pattern) => {
    try {
      return sessionKey.includes(pattern) || new RegExp(pattern).test(sessionKey);
    } catch {
      return sessionKey.includes(pattern);
    }
  });
}

function shouldForward(params: {
  config?: ExecApprovalForwardingConfig;
  request: ExecApprovalRequest;
}): boolean {
  const config = params.config;
  if (!config?.enabled) {
    return false;
  }
  if (config.agentFilter?.length) {
    const agentId =
      params.request.request.agentId ??
      parseAgentSessionKey(params.request.request.sessionKey)?.agentId;
    if (!agentId) {
      return false;
    }
    if (!config.agentFilter.includes(agentId)) {
      return false;
    }
  }
  if (config.sessionFilter?.length) {
    const sessionKey = params.request.request.sessionKey;
    if (!sessionKey) {
      return false;
    }
    if (!matchSessionFilter(sessionKey, config.sessionFilter)) {
      return false;
    }
  }
  return true;
}

function buildTargetKey(target: ExecApprovalForwardTarget): string {
  const channel = normalizeMessageChannel(target.channel) ?? target.channel;
  const accountId = target.accountId ?? "";
  const threadId = target.threadId ?? "";
  return [channel, target.to, accountId, threadId].join(":");
}

// Discord has component-based exec approvals; skip the text fallback there.
function shouldSkipDiscordForwarding(target: ExecApprovalForwardTarget): boolean {
  const channel = normalizeMessageChannel(target.channel) ?? target.channel;
  return channel === "discord";
}

function formatApprovalCommand(command: string): { inline: boolean; text: string } {
  if (!command.includes("\n") && !command.includes("`")) {
    return { inline: true, text: `\`${command}\`` };
  }

  let fence = "```";
  while (command.includes(fence)) {
    fence += "`";
  }
  return { inline: false, text: `${fence}\n${command}\n${fence}` };
}

function buildRequestMessage(request: ExecApprovalRequest, nowMs: number) {
  const lines: string[] = ["🔒 Exec approval required", `ID: ${request.id}`];
  const command = formatApprovalCommand(request.request.command);
  if (command.inline) {
    lines.push(`Command: ${command.text}`);
  } else {
    lines.push("Command:");
    lines.push(command.text);
  }
  if (request.request.cwd) {
    lines.push(`CWD: ${request.request.cwd}`);
  }
  if (request.request.host) {
    lines.push(`Host: ${request.request.host}`);
  }
  if (request.request.agentId) {
    lines.push(`Agent: ${request.request.agentId}`);
  }
  if (request.request.security) {
    lines.push(`Security: ${request.request.security}`);
  }
  if (request.request.ask) {
    lines.push(`Ask: ${request.request.ask}`);
  }
  const expiresIn = Math.max(0, Math.round((request.expiresAtMs - nowMs) / 1000));
  lines.push(`Expires in: ${expiresIn}s`);
  lines.push("Reply with: /approve <id> allow-once|allow-always|deny");
  return lines.join("\n");
}

function decisionLabel(decision: ExecApprovalDecision): string {
  if (decision === "allow-once") {
    return "allowed once";
  }
  if (decision === "allow-always") {
    return "allowed always";
  }
  return "denied";
}

function buildResolvedMessage(resolved: ExecApprovalResolved) {
  const base = `✅ Exec approval ${decisionLabel(resolved.decision)}.`;
  const by = resolved.resolvedBy ? ` Resolved by ${resolved.resolvedBy}.` : "";
  return `${base}${by} ID: ${resolved.id}`;
}

function buildExpiredMessage(request: ExecApprovalRequest) {
  return `⏱️ Exec approval expired. ID: ${request.id}`;
}

function buildEscalationMessage(request: ExecApprovalRequest, message?: string) {
  return `${message || "⚠️ Exec approval not resolved after timeout."} ID: ${request.id}`;
}

function defaultResolveSessionTarget(params: {
  cfg: OpenClawConfig;
  request: ExecApprovalRequest;
}): ExecApprovalForwardTarget | null {
  const sessionKey = params.request.request.sessionKey?.trim();
  if (!sessionKey) {
    return null;
  }
  const parsed = parseAgentSessionKey(sessionKey);
  const agentId = parsed?.agentId ?? params.request.request.agentId ?? "main";
  const storePath = resolveStorePath(params.cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];
  if (!entry) {
    return null;
  }
  const target = resolveSessionDeliveryTarget({ entry, requestedChannel: "last" });
  if (!target.channel || !target.to) {
    return null;
  }
  if (!isDeliverableMessageChannel(target.channel)) {
    return null;
  }
  return {
    channel: target.channel,
    to: target.to,
    accountId: target.accountId,
    threadId: target.threadId,
  };
}

async function deliverToTargets(params: {
  cfg: OpenClawConfig;
  targets: ForwardTarget[];
  text: string;
  deliver: typeof deliverOutboundPayloads;
  shouldSend?: () => boolean;
}) {
  const deliveries = params.targets.map(async (target) => {
    if (params.shouldSend && !params.shouldSend()) {
      return;
    }
    const channel = normalizeMessageChannel(target.channel) ?? target.channel;
    if (!isDeliverableMessageChannel(channel)) {
      return;
    }
    try {
      await params.deliver({
        cfg: params.cfg,
        channel,
        to: target.to,
        accountId: target.accountId,
        threadId: target.threadId,
        payloads: [{ text: params.text }],
      });
    } catch (err) {
      log.error(`exec approvals: failed to deliver to ${channel}:${target.to}: ${String(err)}`);
    }
  });
  await Promise.allSettled(deliveries);
}

function collectTargets(params: {
  config?: ExecApprovalForwardingConfig;
  mode: ReturnType<typeof normalizeMode>;
  request: ExecApprovalRequest;
  resolveSessionTarget: ExecApprovalForwarderDeps["resolveSessionTarget"];
  cfg: OpenClawConfig;
  source: "session" | "target" | "escalation";
  seen?: Set<string>;
}) {
  const { config, mode, request, resolveSessionTarget, cfg, source, seen: sharedSeen } = params;
  const seen = sharedSeen ?? new Set<string>();
  const targets: ForwardTarget[] = [];

  if ((mode === "session" || mode === "both") && source === "session") {
    const sessionTarget = resolveSessionTarget({ cfg, request });
    if (sessionTarget) {
      const key = buildTargetKey(sessionTarget);
      if (!seen.has(key)) {
        seen.add(key);
        targets.push({ ...sessionTarget, source: "session" });
      }
    }
  }

  if ((mode === "targets" || mode === "both") && source === "target") {
    const explicitTargets = config?.targets ?? [];
    for (const target of explicitTargets) {
      const key = buildTargetKey(target);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      targets.push({ ...target, source: "target" });
    }
  }

  if (source === "escalation") {
    const escalationTargets = config?.escalation?.escalationTargets ?? [];
    for (const target of escalationTargets) {
      const key = buildTargetKey(target);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      targets.push({ ...target, source: "target" });
    }
  }

  return { targets: targets.filter((target) => !shouldSkipDiscordForwarding(target)), seen };
}

export function createExecApprovalForwarder(
  deps: ExecApprovalForwarderDeps = {},
): ExecApprovalForwarder {
  const getConfig = deps.getConfig ?? loadConfig;
  const deliver = deps.deliver ?? deliverOutboundPayloads;
  const nowMs = deps.nowMs ?? Date.now;
  const resolveSessionTarget = deps.resolveSessionTarget ?? defaultResolveSessionTarget;
  const pending = new Map<string, PendingApproval>();

  const handleRequested = async (request: ExecApprovalRequest) => {
    const cfg = getConfig();
    const config = cfg.approvals?.exec;
    if (!shouldForward({ config, request })) {
      return;
    }

    const mode = normalizeMode(config?.mode);
    const seen = new Set<string>();
    const { targets: sessionTargets } = collectTargets({
      config,
      mode,
      request,
      resolveSessionTarget,
      cfg,
      source: "session",
      seen,
    });
    const { targets: explicitTargets } = collectTargets({
      config,
      mode,
      request,
      resolveSessionTarget,
      cfg,
      source: "target",
      seen,
    });
    const targets = [...sessionTargets, ...explicitTargets];

    const { targets: escalationTargets } = collectTargets({
      config,
      mode,
      request,
      resolveSessionTarget,
      cfg,
      source: "escalation",
      seen,
    });

    if (targets.length === 0 && escalationTargets.length === 0) {
      return;
    }

    const expiresInMs = Math.max(0, request.expiresAtMs - nowMs());
    const expirationId = setTimeout(() => {
      const entry = pending.get(request.id);
      if (!entry) {
        return;
      }
      pending.delete(request.id);
      const expiredText = buildExpiredMessage(request);
      void deliverToTargets({
        cfg,
        targets: entry.targets,
        text: expiredText,
        deliver,
      });
    }, expiresInMs);
    expirationId.unref?.();

    const escalationDelayMs = normalizeEscalationDelayMs(config?.escalation?.afterTimeoutMs);
    const escalationDelayClamped =
      escalationTargets.length > 0 && escalationDelayMs > 0
        ? Math.min(expiresInMs, escalationDelayMs)
        : 0;

    let escalationTimeoutId: NodeJS.Timeout | null = null;
    if (escalationDelayClamped > 0) {
      escalationTimeoutId = setTimeout(() => {
        const entry = pending.get(request.id);
        if (!entry) {
          return;
        }
        const escalationText = buildEscalationMessage(request, config?.escalation?.message);
        void deliverToTargets({
          cfg,
          targets: entry.escalationTargets,
          text: escalationText,
          deliver,
        });
      }, escalationDelayClamped);
      escalationTimeoutId.unref?.();
    }

    const pendingEntry: PendingApproval = {
      request,
      targets,
      escalationTargets,
      timeoutId: expirationId,
      escalationTimeoutId,
    };
    pending.set(request.id, pendingEntry);

    if (pending.get(request.id) !== pendingEntry) {
      return;
    }

    const text = buildRequestMessage(request, nowMs());
    await deliverToTargets({
      cfg,
      targets,
      text,
      deliver,
      shouldSend: () => pending.get(request.id) === pendingEntry,
    });
  };

  const handleResolved = async (resolved: ExecApprovalResolved) => {
    const entry = pending.get(resolved.id);
    if (!entry) {
      return;
    }
    if (entry.timeoutId) {
      clearTimeout(entry.timeoutId);
    }
    if (entry.escalationTimeoutId) {
      clearTimeout(entry.escalationTimeoutId);
    }
    pending.delete(resolved.id);

    const cfg = getConfig();
    const text = buildResolvedMessage(resolved);
    await deliverToTargets({ cfg, targets: entry.targets, text, deliver });
  };

  const stop = () => {
    for (const entry of pending.values()) {
      if (entry.timeoutId) {
        clearTimeout(entry.timeoutId);
      }
      if (entry.escalationTimeoutId) {
        clearTimeout(entry.escalationTimeoutId);
      }
    }
    pending.clear();
  };

  return { handleRequested, handleResolved, stop };
}

export function shouldForwardExecApproval(params: {
  config?: ExecApprovalForwardingConfig;
  request: ExecApprovalRequest;
}): boolean {
  return shouldForward(params);
}

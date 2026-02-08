import type { CommandHandler } from "./commands-types.js";
import { callGateway } from "../../gateway/call.js";
import { logVerbose } from "../../globals.js";
import {
  GATEWAY_CLIENT_MODES,
  GATEWAY_CLIENT_NAMES,
  isInternalMessageChannel,
} from "../../utils/message-channel.js";

const COMMAND = "/approve";

const DECISION_ALIASES: Record<string, "allow-once" | "allow-always" | "deny"> = {
  allow: "allow-once",
  once: "allow-once",
  "allow-once": "allow-once",
  allowonce: "allow-once",
  always: "allow-always",
  "allow-always": "allow-always",
  allowalways: "allow-always",
  deny: "deny",
  reject: "deny",
  block: "deny",
};

type ParsedApproveCommand =
  | { ok: true; id: string; decision: "allow-once" | "allow-always" | "deny" }
  | { ok: false; error: string };

function parseApproveCommand(raw: string): ParsedApproveCommand | null {
  const trimmed = raw.trim();
  if (!trimmed.toLowerCase().startsWith(COMMAND)) {
    return null;
  }
  const rest = trimmed.slice(COMMAND.length).trim();
  if (!rest) {
    return { ok: false, error: "Usage: /approve <id> allow-once|allow-always|deny" };
  }
  const tokens = rest.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) {
    return { ok: false, error: "Usage: /approve <id> allow-once|allow-always|deny" };
  }

  const first = tokens[0].toLowerCase();
  const second = tokens[1].toLowerCase();

  if (DECISION_ALIASES[first]) {
    return {
      ok: true,
      decision: DECISION_ALIASES[first],
      id: tokens.slice(1).join(" ").trim(),
    };
  }
  if (DECISION_ALIASES[second]) {
    return {
      ok: true,
      decision: DECISION_ALIASES[second],
      id: tokens[0],
    };
  }
  return { ok: false, error: "Usage: /approve <id> allow-once|allow-always|deny" };
}

function buildResolvedByLabel(params: Parameters<CommandHandler>[0]): string {
  const channel = params.command.channel;
  const sender = params.command.senderId ?? "unknown";
  return `${channel}:${sender}`;
}

function formatApprovalResolveError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const normalized = message.toLowerCase();
  if (normalized.includes("unknown approval id") || normalized.includes("request hash mismatch")) {
    return "Failed to submit approval. This approval may have already been resolved or expired.";
  }
  return `Failed to submit approval: ${message}`;
}

type PendingToolApproval = {
  id: string;
  requestHash: string;
};

async function findCanonicalApproval(
  resolvedBy: string,
  approvalId: string,
): Promise<PendingToolApproval | null> {
  try {
    const result = await callGateway<{
      approvals: Array<{ id: string; requestHash: string }>;
    }>({
      method: "tool.approvals.get",
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: `Chat approval lookup (${resolvedBy})`,
      mode: GATEWAY_CLIENT_MODES.BACKEND,
    });
    const match = result.approvals?.find((a) => a.id === approvalId);
    return match ? { id: match.id, requestHash: match.requestHash } : null;
  } catch {
    return null;
  }
}
export const handleApproveCommand: CommandHandler = async (params, allowTextCommands) => {
  if (!allowTextCommands) {
    return null;
  }
  const normalized = params.command.commandBodyNormalized;
  const parsed = parseApproveCommand(normalized);
  if (!parsed) {
    return null;
  }
  if (!params.command.isAuthorizedSender) {
    logVerbose(
      `Ignoring /approve from unauthorized sender: ${params.command.senderId || "<unknown>"}`,
    );
    return { shouldContinue: false };
  }

  if (!parsed.ok) {
    return { shouldContinue: false, reply: { text: parsed.error } };
  }

  if (isInternalMessageChannel(params.command.channel)) {
    const scopes = params.ctx.GatewayClientScopes ?? [];
    const hasApprovals = scopes.includes("operator.approvals") || scopes.includes("operator.admin");
    if (!hasApprovals) {
      logVerbose("Ignoring /approve from gateway client missing operator.approvals.");
      return {
        shouldContinue: false,
        reply: {
          text: "❌ /approve requires operator.approvals for gateway clients.",
        },
      };
    }
  }

  const resolvedBy = buildResolvedByLabel(params);
  const toolApproval = await findCanonicalApproval(resolvedBy, parsed.id);

  try {
    if (toolApproval) {
      await callGateway({
        method: "tool.approval.resolve",
        params: {
          id: parsed.id,
          decision: parsed.decision,
          requestHash: toolApproval.requestHash,
        },
        clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        clientDisplayName: `Chat approval (${resolvedBy})`,
        mode: GATEWAY_CLIENT_MODES.BACKEND,
      });
    } else {
      await callGateway({
        method: "exec.approval.resolve",
        params: { id: parsed.id, decision: parsed.decision },
        clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
        clientDisplayName: `Chat approval (${resolvedBy})`,
        mode: GATEWAY_CLIENT_MODES.BACKEND,
      });
    }
  } catch (err) {
    return {
      shouldContinue: false,
      reply: {
        text: `❌ ${formatApprovalResolveError(err)}`,
      },
    };
  }

  return {
    shouldContinue: false,
    reply: {
      text: `✅ ${toolApproval ? "Tool" : "Exec"} approval ${parsed.decision} submitted for ${
        parsed.id
      }.`,
    },
  };
};

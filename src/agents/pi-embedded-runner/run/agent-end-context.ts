import type { EmbeddedRunAttemptParams } from "./types.js";

type AgentEndContextParams = Pick<
  EmbeddedRunAttemptParams,
  | "messageProvider"
  | "messageTo"
  | "messageThreadId"
  | "groupId"
  | "groupChannel"
  | "groupSpace"
  | "currentChannelId"
  | "currentThreadTs"
>;

export type AgentEndHookMetadata = {
  channelType?: string;
  channelId?: string;
  threadTs?: string;
};

function normalize(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeLower(value: string | undefined | null): string | undefined {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

function hasGroupHints(params: AgentEndContextParams): boolean {
  return Boolean(
    normalize(params.groupId ?? undefined) ??
    normalize(params.groupChannel ?? undefined) ??
    normalize(params.groupSpace ?? undefined),
  );
}

function extractRouteTarget(messageTo: string | undefined): string | undefined {
  const trimmed = normalize(messageTo);
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.startsWith("channel:")) {
    const value = trimmed.slice("channel:".length).trim();
    return value || undefined;
  }
  if (trimmed.startsWith("user:")) {
    const value = trimmed.slice("user:".length).trim();
    return value || undefined;
  }
  return trimmed;
}

function resolveChannelType(params: AgentEndContextParams): string | undefined {
  const provider = normalizeLower(params.messageProvider);
  const to = normalizeLower(params.messageTo);
  const channelId = normalize(params.currentChannelId);

  if (hasGroupHints(params)) {
    return "group";
  }

  // Pattern-based route hints used by many channels.
  if (to) {
    if (to.startsWith("channel:") || to.includes(":group:") || to.includes(":channel:")) {
      return "group";
    }
    if (to.startsWith("user:") || to.startsWith("dm:")) {
      return "dm";
    }
    if (to.endsWith("@g.us")) {
      return "group";
    }
  }

  // Provider-specific hints when route target is ambiguous.
  if (provider === "slack" && channelId) {
    if (channelId.startsWith("D")) {
      return "dm";
    }
    if (channelId.startsWith("C") || channelId.startsWith("G")) {
      return "group";
    }
  }

  if (provider === "telegram") {
    if (params.messageThreadId != null && params.messageThreadId !== "") {
      return "group";
    }
    if (to?.startsWith("-")) {
      return "group";
    }
    if (to) {
      return "dm";
    }
  }

  if (provider === "whatsapp" || provider === "web") {
    if (to?.endsWith("@g.us")) {
      return "group";
    }
    if (to?.endsWith("@c.us") || to?.startsWith("+")) {
      return "dm";
    }
  }

  if (to) {
    return "dm";
  }

  return undefined;
}

function resolveThreadTs(params: AgentEndContextParams): string | undefined {
  const currentThreadTs = normalize(params.currentThreadTs);
  if (currentThreadTs) {
    return currentThreadTs;
  }
  const provider = normalizeLower(params.messageProvider);
  if (provider === "slack" && params.messageThreadId != null && params.messageThreadId !== "") {
    return String(params.messageThreadId);
  }
  return undefined;
}

export function resolveAgentEndHookMetadata(params: AgentEndContextParams): AgentEndHookMetadata {
  const channelId = normalize(params.currentChannelId) ?? extractRouteTarget(params.messageTo);
  const threadTs = resolveThreadTs(params);
  const channelType = resolveChannelType(params);
  return {
    channelType,
    channelId,
    threadTs,
  };
}

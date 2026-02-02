import type { Agent } from "@/stores/useAgentStore";

export type AgentModelConfig =
  | string
  | {
      primary?: string;
      fallbacks?: string[];
    };

export type AgentIdentityConfig = {
  name?: string;
  theme?: string;
  emoji?: string;
  avatar?: string;
  [key: string]: unknown;
};

export type AgentConfigEntry = {
  id: string;
  default?: boolean;
  name?: string;
  model?: AgentModelConfig;
  runtime?: "pi" | "claude";
  claudeSdkOptions?: {
    provider?: "anthropic" | "zai" | "openrouter";
    models?: {
      opus?: string;
      sonnet?: string;
      haiku?: string;
      subagent?: string;
    };
  };
  identity?: AgentIdentityConfig;
  [key: string]: unknown;
};

export type AgentsConfigBlock = {
  list?: AgentConfigEntry[];
  [key: string]: unknown;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeModelRef(model?: AgentModelConfig): string | undefined {
  if (!model) {return undefined;}
  if (typeof model === "string") {return model;}
  if (isPlainObject(model)) {
    const primary = model.primary;
    return typeof primary === "string" && primary.trim().length > 0 ? primary : undefined;
  }
  return undefined;
}

function mergeModelConfig(existing: unknown, nextModel?: string): AgentModelConfig | undefined {
  if (!nextModel) {return (existing as AgentModelConfig | undefined) ?? undefined;}
  if (isPlainObject(existing)) {
    return {
      ...(existing as Record<string, unknown>),
      primary: nextModel,
    } as AgentModelConfig;
  }
  return nextModel;
}

export function getAgentsBlock(config?: unknown): AgentsConfigBlock | undefined {
  if (!isPlainObject(config)) {return undefined;}
  const agents = config.agents;
  if (!isPlainObject(agents)) {return undefined;}
  return agents as AgentsConfigBlock;
}

export function getAgentsList(config?: unknown): AgentConfigEntry[] {
  const agents = getAgentsBlock(config);
  const list = agents?.list;
  if (!Array.isArray(list)) {return [];}
  return list.filter((entry): entry is AgentConfigEntry => {
    return isPlainObject(entry) && typeof entry.id === "string";
  });
}

export function mapAgentEntryToAgent(entry: AgentConfigEntry): Agent {
  const modelRef = normalizeModelRef(entry.model);
  const name = entry.name ?? entry.identity?.name ?? entry.id;
  return {
    id: entry.id,
    name,
    role: "Assistant",
    model: modelRef,
    runtime: entry.runtime,
    claudeSdkOptions: entry.claudeSdkOptions,
    avatar: entry.identity?.avatar,
    status: "offline",
    description: undefined,
    tags: [],
    taskCount: 0,
  };
}

export function buildAgentEntry(
  update: Partial<Agent> & { id: string },
  existing?: AgentConfigEntry
): AgentConfigEntry {
  const next: AgentConfigEntry = {
    ...existing,
    id: update.id,
  };

  if (update.name !== undefined) {
    next.name = update.name;
  }

  if (update.model !== undefined) {
    next.model = mergeModelConfig(existing?.model, update.model);
  }

  if (update.runtime !== undefined) {
    next.runtime = update.runtime;
  }

  if (update.runtime !== undefined) {
    if (update.runtime === "pi") {
      delete next.claudeSdkOptions;
    } else if (update.claudeSdkOptions !== undefined) {
      next.claudeSdkOptions = update.claudeSdkOptions;
    }
  }

  if (update.avatar !== undefined || update.name !== undefined) {
    const identity: AgentIdentityConfig = {
      ...(isPlainObject(existing?.identity) ? existing?.identity : {}),
    };
    if (update.name !== undefined) {identity.name = update.name;}
    if (update.avatar !== undefined) {identity.avatar = update.avatar;}
    next.identity = identity;
  }

  return next;
}

export function buildAgentsPatch(config: unknown, nextList: AgentConfigEntry[]) {
  const agents = getAgentsBlock(config);
  return {
    agents: {
      ...agents,
      list: nextList,
    },
  };
}

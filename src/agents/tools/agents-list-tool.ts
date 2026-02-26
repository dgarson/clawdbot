import { Type } from "@sinclair/typebox";
import { loadConfig } from "../../config/config.js";
import {
  DEFAULT_AGENT_ID,
  normalizeAgentId,
  parseAgentSessionKey,
} from "../../routing/session-key.js";
import { resolveAgentConfig } from "../agent-scope.js";
import {
  buildModelAliasIndex,
  parseModelRef,
  resolveDefaultModelForAgent,
  resolveModelRefFromString,
  resolveSubagentSpawnModelSelection,
} from "../model-selection.js";
import type { AnyAgentTool } from "./common.js";
import { jsonResult } from "./common.js";
import { resolveInternalSessionKey, resolveMainSessionAlias } from "./sessions-helpers.js";

const AgentsListToolSchema = Type.Object({
  model: Type.Optional(Type.String()),
});

type RequestedModelRef = {
  provider: string;
  model?: string;
  raw: string;
};

type AgentListEntry = {
  id: string;
  name?: string;
  configured: boolean;
  subagentModel?: string;
  capableForRequestedModel?: boolean;
};

function resolveRequestedModelRef(params: {
  rawModel: unknown;
  cfg: ReturnType<typeof loadConfig>;
  defaultProvider: string;
}): RequestedModelRef | undefined {
  if (typeof params.rawModel !== "string") {
    return undefined;
  }
  const trimmed = params.rawModel.trim();
  if (!trimmed) {
    return undefined;
  }

  const parsedProviderOnly = trimmed.match(/^([a-z0-9][a-z0-9._-]*)\s*$/i);
  if (parsedProviderOnly && !trimmed.includes("/")) {
    const provider = parsedProviderOnly[1]?.trim().toLowerCase();
    if (provider) {
      return { provider, raw: trimmed };
    }
  }

  const aliasIndex = buildModelAliasIndex({
    cfg: params.cfg,
    defaultProvider: params.defaultProvider,
  });
  const resolved = resolveModelRefFromString({
    raw: trimmed,
    defaultProvider: params.defaultProvider,
    aliasIndex,
  });
  if (!resolved) {
    return undefined;
  }
  return {
    provider: resolved.ref.provider,
    model: resolved.ref.model,
    raw: trimmed,
  };
}

export function createAgentsListTool(opts?: {
  agentSessionKey?: string;
  /** Explicit agent ID override for cron/hook sessions. */
  requesterAgentIdOverride?: string;
}): AnyAgentTool {
  return {
    label: "Agents",
    name: "agents_list",
    description: "List agent ids you can target with sessions_spawn (based on allowlists).",
    parameters: AgentsListToolSchema,
    execute: async (_toolCallId, args) => {
      const cfg = loadConfig();
      const { mainKey, alias } = resolveMainSessionAlias(cfg);
      const requesterInternalKey =
        typeof opts?.agentSessionKey === "string" && opts.agentSessionKey.trim()
          ? resolveInternalSessionKey({
              key: opts.agentSessionKey,
              alias,
              mainKey,
            })
          : alias;
      const requesterAgentId = normalizeAgentId(
        opts?.requesterAgentIdOverride ??
          parseAgentSessionKey(requesterInternalKey)?.agentId ??
          DEFAULT_AGENT_ID,
      );

      const allowAgents = resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ?? [];
      const allowAny = allowAgents.some((value) => value.trim() === "*");
      const allowSet = new Set(
        allowAgents
          .filter((value) => value.trim() && value.trim() !== "*")
          .map((value) => normalizeAgentId(value)),
      );

      const configuredAgents = Array.isArray(cfg.agents?.list) ? cfg.agents?.list : [];
      const configuredIds = configuredAgents.map((entry) => normalizeAgentId(entry.id));
      const configuredNameMap = new Map<string, string>();
      for (const entry of configuredAgents) {
        const name = entry?.name?.trim() ?? "";
        if (!name) {
          continue;
        }
        configuredNameMap.set(normalizeAgentId(entry.id), name);
      }

      const globalDefault = resolveDefaultModelForAgent({ cfg, agentId: requesterAgentId });
      const requestedModel = resolveRequestedModelRef({
        rawModel: args?.model,
        cfg,
        defaultProvider: globalDefault.provider,
      });

      const allowed = new Set<string>();
      allowed.add(requesterAgentId);
      if (allowAny) {
        for (const id of configuredIds) {
          allowed.add(id);
        }
      } else {
        for (const id of allowSet) {
          allowed.add(id);
        }
      }

      const all = Array.from(allowed);
      const rest = all
        .filter((id) => id !== requesterAgentId)
        .toSorted((a, b) => a.localeCompare(b));
      const ordered = [requesterAgentId, ...rest];
      const agents: AgentListEntry[] = ordered.map((id) => {
        const subagentModel = resolveSubagentSpawnModelSelection({ cfg, agentId: id });
        const parsedSubagentModel = parseModelRef(subagentModel, globalDefault.provider);
        let capableForRequestedModel: boolean | undefined;
        if (requestedModel) {
          capableForRequestedModel =
            parsedSubagentModel?.provider === requestedModel.provider &&
            (!requestedModel.model || parsedSubagentModel.model === requestedModel.model);
        }
        return {
          id,
          name: configuredNameMap.get(id),
          configured: configuredIds.includes(id),
          subagentModel,
          capableForRequestedModel,
        };
      });

      return jsonResult({
        requester: requesterAgentId,
        allowAny,
        requestedModel,
        agents,
      });
    },
  };
}

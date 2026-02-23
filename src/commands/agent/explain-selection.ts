import {
  listAgentIds,
  resolveAgentModelPrimary,
  resolveEffectiveModelFallbacks,
} from "../../agents/agent-scope.js";
import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import { loadModelCatalog } from "../../agents/model-catalog.js";
import {
  buildAllowedModelSet,
  isCliProvider,
  modelKey,
  normalizeModelRef,
  resolveConfiguredModelRef,
  type ModelRef,
} from "../../agents/model-selection.js";
import { formatCliCommand } from "../../cli/command-format.js";
import { loadConfig } from "../../config/config.js";
import { resolveAgentIdFromSessionKey, type SessionEntry } from "../../config/sessions.js";
import { normalizeAgentId } from "../../routing/session-key.js";
import type { RuntimeEnv } from "../../runtime.js";
import { resolveSession } from "./session.js";

type AgentExplainSelectionOpts = {
  to?: string;
  sessionId?: string;
  sessionKey?: string;
  agent?: string;
  json?: boolean;
};

type OverrideResolution = {
  provider: string;
  model: string;
  key: string;
  allowed: boolean;
};

type ExplainResult = {
  agentId: string;
  sessionId: string;
  sessionKey?: string;
  selected: ModelRef;
  defaultConfigured: ModelRef;
  storedOverride?: {
    providerOverride?: string;
    modelOverride?: string;
    resolved?: OverrideResolution;
  };
  allowlist: {
    enabled: boolean;
    size: number;
  };
  fallback: {
    configured?: string[];
    enabled: boolean;
  };
  trace?: SessionEntry["modelSelectionTrace"];
  steps: Array<{
    source: "config.default" | "agent.primary" | "session.override" | "allowlist.guard" | "final";
    detail: string;
  }>;
};

function resolveAgentAwareDefaultModel(params: {
  cfg: ReturnType<typeof loadConfig>;
  agentId: string;
}): { model: ModelRef; agentModelPrimary?: string } {
  const agentModelPrimary = resolveAgentModelPrimary(params.cfg, params.agentId);
  const cfgForModelSelection = agentModelPrimary
    ? {
        ...params.cfg,
        agents: {
          ...params.cfg.agents,
          defaults: {
            ...params.cfg.agents?.defaults,
            model: {
              ...(typeof params.cfg.agents?.defaults?.model === "object"
                ? params.cfg.agents.defaults.model
                : undefined),
              primary: agentModelPrimary,
            },
          },
        },
      }
    : params.cfg;

  const configuredDefaultRef = resolveConfiguredModelRef({
    cfg: cfgForModelSelection,
    defaultProvider: DEFAULT_PROVIDER,
    defaultModel: DEFAULT_MODEL,
  });
  return {
    model: normalizeModelRef(configuredDefaultRef.provider, configuredDefaultRef.model),
    agentModelPrimary,
  };
}

function renderExplainResultText(result: ExplainResult): string {
  const lines: string[] = [];
  lines.push(`Agent: ${result.agentId}`);
  lines.push(`Session: ${result.sessionId}${result.sessionKey ? ` (${result.sessionKey})` : ""}`);
  lines.push(`Selected model: ${result.selected.provider}/${result.selected.model}`);
  lines.push(
    `Configured default: ${result.defaultConfigured.provider}/${result.defaultConfigured.model}`,
  );
  if (result.storedOverride?.modelOverride) {
    if (result.storedOverride.resolved) {
      const resolved = result.storedOverride.resolved;
      lines.push(
        `Session override: ${resolved.provider}/${resolved.model} (${resolved.allowed ? "applied" : "ignored"})`,
      );
    } else {
      lines.push(`Session override: ${result.storedOverride.modelOverride} (invalid)`);
    }
  } else {
    lines.push("Session override: none");
  }
  lines.push(
    `Allowlist: ${result.allowlist.enabled ? `enabled (${result.allowlist.size} entries)` : "disabled"}`,
  );
  lines.push(
    `Fallbacks: ${result.fallback.enabled ? (result.fallback.configured ?? []).join(", ") : "none configured"}`,
  );

  lines.push("");
  lines.push("Decision steps:");
  for (const step of result.steps) {
    lines.push(`- ${step.source}: ${step.detail}`);
  }

  if (result.trace) {
    lines.push("");
    lines.push(
      `Last persisted trace: run=${result.trace.runId ?? "n/a"}, generatedAt=${new Date(result.trace.generatedAt).toISOString()}, selected=${result.trace.selected.provider}/${result.trace.selected.model}${result.trace.active ? `, active=${result.trace.active.provider}/${result.trace.active.model}` : ""}`,
    );
  }

  return lines.join("\n");
}

export async function agentExplainSelectionCommand(
  opts: AgentExplainSelectionOpts,
  runtime: RuntimeEnv,
) {
  if (!opts.to && !opts.sessionId && !opts.sessionKey && !opts.agent) {
    throw new Error(
      "Pass --to <E.164>, --session-id, --session-key, or --agent to resolve selection",
    );
  }

  const cfg = loadConfig();
  const agentIdOverrideRaw = opts.agent?.trim();
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

  const sessionResolution = resolveSession({
    cfg,
    to: opts.to,
    sessionId: opts.sessionId,
    sessionKey: opts.sessionKey,
    agentId: agentIdOverride,
  });
  const sessionAgentId =
    agentIdOverride ?? resolveAgentIdFromSessionKey(sessionResolution.sessionKey?.trim());

  const { model: defaultRef, agentModelPrimary } = resolveAgentAwareDefaultModel({
    cfg,
    agentId: sessionAgentId,
  });

  const hasAllowlist =
    Boolean(cfg.agents?.defaults?.models) &&
    Object.keys(cfg.agents?.defaults?.models ?? {}).length > 0;
  const storedProviderOverride = sessionResolution.sessionEntry?.providerOverride?.trim();
  const storedModelOverride = sessionResolution.sessionEntry?.modelOverride?.trim();
  const hasStoredOverride = Boolean(storedModelOverride || storedProviderOverride);

  let selected = defaultRef;
  let allowlistSize = 0;
  let storedOverrideResolution: OverrideResolution | undefined;

  if (hasAllowlist || hasStoredOverride) {
    const catalog = await loadModelCatalog({ config: cfg });
    const allowed = buildAllowedModelSet({
      cfg,
      catalog,
      defaultProvider: defaultRef.provider,
      defaultModel: defaultRef.model,
    });
    allowlistSize = allowed.allowedKeys.size;

    if (storedModelOverride) {
      const candidateProvider = storedProviderOverride || defaultRef.provider;
      const normalized = normalizeModelRef(candidateProvider, storedModelOverride);
      const key = modelKey(normalized.provider, normalized.model);
      const allowedOverride =
        isCliProvider(normalized.provider, cfg) ||
        allowed.allowedKeys.size === 0 ||
        allowed.allowedKeys.has(key);
      storedOverrideResolution = {
        provider: normalized.provider,
        model: normalized.model,
        key,
        allowed: allowedOverride,
      };
      if (allowedOverride) {
        selected = normalized;
      }
    }
  }

  const fallbackConfigured = resolveEffectiveModelFallbacks({
    cfg,
    agentId: sessionAgentId,
    hasSessionModelOverride: Boolean(storedModelOverride),
  });

  const result: ExplainResult = {
    agentId: sessionAgentId,
    sessionId: sessionResolution.sessionId,
    sessionKey: sessionResolution.sessionKey,
    selected,
    defaultConfigured: defaultRef,
    storedOverride: {
      providerOverride: storedProviderOverride,
      modelOverride: storedModelOverride,
      resolved: storedOverrideResolution,
    },
    allowlist: {
      enabled: hasAllowlist,
      size: allowlistSize,
    },
    fallback: {
      configured: fallbackConfigured,
      enabled: (fallbackConfigured?.length ?? 0) > 0,
    },
    trace: sessionResolution.sessionEntry?.modelSelectionTrace,
    steps: [
      {
        source: "config.default",
        detail: `Configured default ${defaultRef.provider}/${defaultRef.model}.`,
      },
      {
        source: "agent.primary",
        detail: agentModelPrimary
          ? `Applied per-agent primary override ${agentModelPrimary}.`
          : "No per-agent primary override.",
      },
      {
        source: "session.override",
        detail: storedOverrideResolution
          ? storedOverrideResolution.allowed
            ? `Applied session override ${storedOverrideResolution.key}.`
            : `Ignored disallowed session override ${storedOverrideResolution.key}.`
          : storedModelOverride
            ? "Session override present but invalid."
            : "No session model override.",
      },
      {
        source: "allowlist.guard",
        detail: hasAllowlist
          ? `Allowlist active (${allowlistSize} keys).`
          : "No model allowlist configured.",
      },
      {
        source: "final",
        detail: `Selected ${selected.provider}/${selected.model}.`,
      },
    ],
  };

  if (opts.json) {
    runtime.log(JSON.stringify(result, null, 2));
    return;
  }

  runtime.log(renderExplainResultText(result));
}

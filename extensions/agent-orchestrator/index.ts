/**
 * agent-orchestrator plugin
 *
 * Wires together two layers:
 *   1. Mail — inter-agent messaging tools, inbox hook, and CLI
 *   2. Orchestration — role boundaries, spawn validation, priming, model overrides
 *
 * Feature flags (from plugin config):
 *   - mail.enabled (default: true) — registers mail tools and mail hooks
 *   - orchestration.enabled (default: true) — registers orchestration hooks (implies mail)
 *
 * All tools are optional (must be explicitly allowlisted per agent).
 */

import type { AnyAgentTool, OpenClawPluginApi } from "../../src/plugins/types.js";
import { registerMailCli } from "./src/mail/cli.js";
import { parsePluginConfig, type ResolvedInterAgentMailConfig } from "./src/mail/config.js";
import { createBeforePromptBuildHook } from "./src/mail/hook.js";
import { createBounceMailTool, createMailTool } from "./src/mail/tools.js";
import { shouldBlockTool } from "./src/orchestration/boundaries.js";
import { extractRoleFromLabel, validateSpawn } from "./src/orchestration/lifecycle.js";
import { buildRoleContext } from "./src/orchestration/priming.js";
import { ROLE_MODEL_OVERRIDES } from "./src/orchestration/roles.js";
import { createOrchestratorStore, type OrchestratorStore } from "./src/store.js";
import { DEFAULT_ORCHESTRATOR_CONFIG, type OrchestratorConfig } from "./src/types.js";

// ── Config parsing ───────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseOrchestratorConfig(raw: unknown): OrchestratorConfig {
  if (raw == null) return { ...DEFAULT_ORCHESTRATOR_CONFIG };
  if (!isRecord(raw)) return { ...DEFAULT_ORCHESTRATOR_CONFIG };

  const defaults = DEFAULT_ORCHESTRATOR_CONFIG;

  // Parse mail section
  const rawMail = isRecord(raw.mail) ? raw.mail : {};
  const mail = {
    enabled: typeof rawMail.enabled === "boolean" ? rawMail.enabled : defaults.mail.enabled,
  };

  // Parse orchestration section
  const rawOrch = isRecord(raw.orchestration) ? raw.orchestration : {};
  const orchestration = {
    enabled:
      typeof rawOrch.enabled === "boolean" ? rawOrch.enabled : defaults.orchestration.enabled,
    maxDepth:
      typeof rawOrch.maxDepth === "number" ? rawOrch.maxDepth : defaults.orchestration.maxDepth,
    maxConcurrentAgents:
      typeof rawOrch.maxConcurrentAgents === "number"
        ? rawOrch.maxConcurrentAgents
        : defaults.orchestration.maxConcurrentAgents,
    watchdogIntervalMs:
      typeof rawOrch.watchdogIntervalMs === "number"
        ? rawOrch.watchdogIntervalMs
        : defaults.orchestration.watchdogIntervalMs,
    staleThresholdMs:
      typeof rawOrch.staleThresholdMs === "number"
        ? rawOrch.staleThresholdMs
        : defaults.orchestration.staleThresholdMs,
  };

  return { mail, orchestration };
}

// ── Plugin definition ────────────────────────────────────────────────────────

const plugin = {
  id: "agent-orchestrator",
  name: "Agent Orchestrator",
  description:
    "Multi-agent task decomposition with role-based boundaries and inter-agent messaging",

  register(api: OpenClawPluginApi) {
    const config = parseOrchestratorConfig(api.pluginConfig);

    // ── Service: store lifecycle ────────────────────────────────────────────

    let stateDir: string | null = null;
    let store: OrchestratorStore | null = null;

    api.registerService({
      id: "agent-orchestrator",
      async start(ctx) {
        stateDir = ctx.stateDir;
        store = createOrchestratorStore(stateDir);
        ctx.logger.info(`[agent-orchestrator] started, stateDir: ${stateDir}`);
      },
      async stop(_ctx) {
        if (store) {
          await store.flushAll();
          store = null;
        }
        stateDir = null;
      },
    });

    // ── Mail layer ─────────────────────────────────────────────────────────

    if (config.mail.enabled || config.orchestration.enabled) {
      // Parse mail-specific config (best effort — fall back to defaults)
      const mailParsed = parsePluginConfig(api.pluginConfig);
      let mailConfig: ResolvedInterAgentMailConfig;
      if (mailParsed.ok) {
        mailConfig = mailParsed.value;
      } else {
        api.logger.warn(
          `[agent-orchestrator] mail config parse failed: ${mailParsed.message}; using defaults`,
        );
        // parsePluginConfig(undefined) always returns ok:true with defaults
        mailConfig = (
          parsePluginConfig(undefined) as { ok: true; value: ResolvedInterAgentMailConfig }
        ).value;
      }

      // Mail tool (optional, requires allowlisting)
      api.registerTool(
        (_ctx) => {
          const dir = stateDir ?? resolveStateDirFallback();
          return createMailTool({
            stateDir: dir,
            config: mailConfig,
            api: api.runtime as Parameters<typeof createMailTool>[0]["api"],
          }) as unknown as AnyAgentTool;
        },
        { name: "mail", optional: true },
      );

      // Bounce mail tool (optional, separate allowlist entry)
      api.registerTool(
        (_ctx) => {
          const dir = stateDir ?? resolveStateDirFallback();
          return createBounceMailTool({
            stateDir: dir,
            config: mailConfig,
            api: api.runtime as Parameters<typeof createBounceMailTool>[0]["api"],
          }) as unknown as AnyAgentTool;
        },
        { name: "bounce_mail", optional: true },
      );

      // Hook: inbox notifications (priority 100 — runs early)
      api.on(
        "before_prompt_build",
        createBeforePromptBuildHook({
          get stateDir() {
            return stateDir ?? resolveStateDirFallback();
          },
          config: mailConfig,
        }),
        { priority: 100 },
      );

      // CLI: openclaw mail list / delete
      api.registerCli(registerMailCli, { commands: ["mail"] });
    }

    // ── Orchestration layer ────────────────────────────────────────────────

    if (config.orchestration.enabled) {
      // Hook: role boundary enforcement (priority 50)
      api.on(
        "before_tool_call",
        (event, ctx) => {
          if (!store || !ctx.sessionKey) return;
          const state = store.get(ctx.sessionKey);
          if (!state?.role) return;

          const result = shouldBlockTool(state.role, event.toolName);

          // Update activity timestamp
          store.update(ctx.sessionKey, (s) => {
            s.lastActivity = Date.now();
          });

          if (result) {
            return { block: true, blockReason: result.reason };
          }
        },
        { priority: 50 },
      );

      // Hook: spawn validation
      api.on("subagent_spawning", (event, ctx) => {
        if (!store) return;

        const childRole = extractRoleFromLabel(event.label);
        if (!childRole) return { status: "ok" as const };

        const parentKey = ctx.requesterSessionKey;
        const parentState = parentKey ? store.get(parentKey) : undefined;
        const parentRole = parentState?.role ?? "orchestrator";
        const parentDepth = parentState?.depth ?? 0;

        // Count active agents
        const allKeys = store.keys();
        let activeCount = 0;
        for (const key of allKeys) {
          const s = store.get(key);
          if (s?.status === "active") activeCount++;
        }

        const validation = validateSpawn(
          parentRole,
          childRole,
          parentDepth,
          config.orchestration.maxDepth,
          activeCount,
          config.orchestration.maxConcurrentAgents,
        );

        if (!validation.allowed) {
          return { status: "error" as const, error: validation.reason };
        }

        // Register child in store
        store.update(event.childSessionKey, (s) => {
          s.role = childRole;
          s.depth = parentDepth + 1;
          s.parentSessionKey = parentKey;
          s.status = "active";
          s.lastActivity = Date.now();
        });

        return { status: "ok" as const };
      });

      // Hook: record spawned agent
      api.on("subagent_spawned", (event) => {
        if (!store) return;
        store.update(event.childSessionKey, (s) => {
          s.status = "active";
        });
      });

      // Hook: update state on stopping
      api.on("subagent_stopping", (event) => {
        if (!store) return;
        const state = store.get(event.childSessionKey);
        if (state) {
          store.update(event.childSessionKey, (s) => {
            s.status = "completed";
          });
        }
      });

      // Hook: clean up ended agent
      api.on("subagent_ended", (event) => {
        if (!store) return;
        store.update(event.targetSessionKey, (s) => {
          s.status = "completed";
        });
      });

      // Hook: role context injection (priority 90 — after mail at 100)
      api.on(
        "before_prompt_build",
        (_event, ctx) => {
          if (!store || !ctx.sessionKey) return;
          const state = store.get(ctx.sessionKey);
          if (!state?.role) return;

          // Build fleet members list from all active sessions
          const allKeys = store.keys();
          const fleetMembers: Array<{ role: string; sessionKey: string; status: string }> = [];
          for (const key of allKeys) {
            const s = store.get(key);
            if (s?.status === "active" && s.role) {
              fleetMembers.push({
                role: s.role,
                sessionKey: key,
                status: s.status,
              });
            }
          }

          const context = buildRoleContext(state.role, state.taskDescription, fleetMembers);
          if (context) {
            return { prependContext: context };
          }
        },
        { priority: 90 },
      );

      // Hook: model override per role
      api.on("before_model_resolve", (_event, ctx) => {
        if (!store || !ctx.sessionKey) return;
        const state = store.get(ctx.sessionKey);
        if (!state?.role) return;

        const modelOverride = ROLE_MODEL_OVERRIDES[state.role];
        if (modelOverride) {
          return { modelOverride };
        }
      });

      // Hook: activity tracking
      api.on("after_tool_call", (_event, ctx) => {
        if (!store || !ctx.sessionKey) return;
        store.update(ctx.sessionKey, (s) => {
          s.lastActivity = Date.now();
        });
      });
    }
  },
};

export default plugin;

// ── Fallback stateDir when service hasn't started (e.g. unit tests) ──────────

function resolveStateDirFallback(): string {
  const env = process.env.OPENCLAW_STATE_DIR?.trim();
  if (env) return env;
  return process.cwd();
}

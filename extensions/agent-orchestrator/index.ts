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
import { registerOrchestratorCli } from "./src/cli/index.js";
import { registerMailCli } from "./src/mail/cli.js";
import { parsePluginConfig, type ResolvedInterAgentMailConfig } from "./src/mail/config.js";
import { createBeforePromptBuildHook } from "./src/mail/hook.js";
import { createBounceMailTool, createMailTool } from "./src/mail/tools.js";
import { checkToolAccess } from "./src/orchestration/boundaries.js";
import { extractRoleFromLabel, validateSpawn } from "./src/orchestration/lifecycle.js";
import { buildRoleContext } from "./src/orchestration/priming.js";
import { ROLE_MODEL_OVERRIDES } from "./src/orchestration/roles.js";
import { createOrchestratorStore, type OrchestratorStore } from "./src/store.js";
import { createAgentStatusTool, createDecomposeTaskTool } from "./src/tools/index.js";
import {
  DEFAULT_ORCHESTRATOR_CONFIG,
  type AgentRole,
  type OrchestratorConfig,
  type PendingSpawnIntent,
} from "./src/types.js";

// ── Config parsing ───────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function readIntegerOption(raw: unknown, fallback: number, min: number): number {
  if (typeof raw !== "number" || !Number.isFinite(raw)) return fallback;
  const value = Math.trunc(raw);
  return value >= min ? value : fallback;
}

function readBooleanOption(raw: unknown, fallback: boolean): boolean {
  return typeof raw === "boolean" ? raw : fallback;
}

function extractMailConfigInput(raw: unknown): Record<string, unknown> | undefined {
  if (!isRecord(raw)) return undefined;

  const root = raw;
  const nested = isRecord(root.mail) ? root.mail : undefined;
  const read = (key: "rules" | "mailbox_acls" | "delivery_policies"): unknown =>
    nested && key in nested ? nested[key] : root[key];

  const section: Record<string, unknown> = {};
  const rules = read("rules");
  const acls = read("mailbox_acls");
  const policies = read("delivery_policies");
  if (rules !== undefined) section.rules = rules;
  if (acls !== undefined) section.mailbox_acls = acls;
  if (policies !== undefined) section.delivery_policies = policies;

  return Object.keys(section).length > 0 ? section : undefined;
}

function parseOrchestratorConfig(raw: unknown): OrchestratorConfig {
  if (raw == null) return { ...DEFAULT_ORCHESTRATOR_CONFIG };
  if (!isRecord(raw)) return { ...DEFAULT_ORCHESTRATOR_CONFIG };

  const defaults = DEFAULT_ORCHESTRATOR_CONFIG;

  // Parse mail section
  const rawMail = isRecord(raw.mail) ? raw.mail : {};
  const rawLogging = isRecord(rawMail.logging) ? rawMail.logging : {};
  const rawLogEvents = isRecord(rawLogging.events) ? rawLogging.events : {};
  const mail: OrchestratorConfig["mail"] = {
    enabled: typeof rawMail.enabled === "boolean" ? rawMail.enabled : defaults.mail.enabled,
    logging: {
      enabled: readBooleanOption(rawLogging.enabled, defaults.mail.logging.enabled),
      includeBodyPreview: readBooleanOption(
        rawLogging.includeBodyPreview,
        defaults.mail.logging.includeBodyPreview,
      ),
      bodyPreviewChars: readIntegerOption(
        rawLogging.bodyPreviewChars,
        defaults.mail.logging.bodyPreviewChars,
        0,
      ),
      events: {
        send: readBooleanOption(rawLogEvents.send, defaults.mail.logging.events.send),
        receipt: readBooleanOption(rawLogEvents.receipt, defaults.mail.logging.events.receipt),
        forward: readBooleanOption(rawLogEvents.forward, defaults.mail.logging.events.forward),
        ack: readBooleanOption(rawLogEvents.ack, defaults.mail.logging.events.ack),
        bounce: readBooleanOption(rawLogEvents.bounce, defaults.mail.logging.events.bounce),
      },
    },
  };
  const legacyRaw = raw;
  const mailRules = "rules" in rawMail ? rawMail.rules : legacyRaw.rules;
  const mailAcls = "mailbox_acls" in rawMail ? rawMail.mailbox_acls : legacyRaw.mailbox_acls;
  const mailPolicies =
    "delivery_policies" in rawMail ? rawMail.delivery_policies : legacyRaw.delivery_policies;
  if (mailRules !== undefined) {
    mail.rules = mailRules as OrchestratorConfig["mail"]["rules"];
  }
  if (mailAcls !== undefined) {
    mail.mailbox_acls = mailAcls as OrchestratorConfig["mail"]["mailbox_acls"];
  }
  if (mailPolicies !== undefined) {
    mail.delivery_policies = mailPolicies as OrchestratorConfig["mail"]["delivery_policies"];
  }

  // Parse orchestration section
  const rawOrch = isRecord(raw.orchestration) ? raw.orchestration : {};
  const orchestration = {
    enabled:
      typeof rawOrch.enabled === "boolean" ? rawOrch.enabled : defaults.orchestration.enabled,
    maxDepth: readIntegerOption(rawOrch.maxDepth, defaults.orchestration.maxDepth, 0),
    maxConcurrentAgents: readIntegerOption(
      rawOrch.maxConcurrentAgents,
      defaults.orchestration.maxConcurrentAgents,
      1,
    ),
    watchdogIntervalMs: readIntegerOption(
      rawOrch.watchdogIntervalMs,
      defaults.orchestration.watchdogIntervalMs,
      1,
    ),
    staleThresholdMs: readIntegerOption(
      rawOrch.staleThresholdMs,
      defaults.orchestration.staleThresholdMs,
      1,
    ),
  };

  return { mail, orchestration };
}

function isPendingSpawnIntent(value: unknown): value is PendingSpawnIntent {
  if (!isRecord(value)) return false;
  if (typeof value.role !== "string") return false;
  if (typeof value.label !== "string" || value.label.trim().length === 0) return false;
  if (typeof value.taskDescription !== "string" || value.taskDescription.trim().length === 0) {
    return false;
  }
  if (value.fileScope !== undefined) {
    if (!Array.isArray(value.fileScope) || value.fileScope.some((v) => typeof v !== "string")) {
      return false;
    }
  }
  if (value.modelOverride !== undefined && typeof value.modelOverride !== "string") {
    return false;
  }
  return true;
}

function consumePendingSpawnIntent(params: {
  store: OrchestratorStore;
  parentSessionKey?: string;
  parentIntents: PendingSpawnIntent[] | undefined;
  childRole: AgentRole;
  childLabel?: string;
}): PendingSpawnIntent | undefined {
  const intents = params.parentIntents ?? [];
  if (intents.length === 0) return undefined;

  const childLabel = params.childLabel?.trim();
  let intentIndex = -1;

  if (childLabel) {
    intentIndex = intents.findIndex(
      (intent) => intent.role === params.childRole && intent.label === childLabel,
    );
  }

  if (intentIndex < 0) {
    const roleMatches = intents.filter((intent) => intent.role === params.childRole);
    if (roleMatches.length === 1) {
      intentIndex = intents.indexOf(roleMatches[0]);
    }
  }

  if (intentIndex < 0) return undefined;
  const picked = intents[intentIndex];
  if (!picked) return undefined;

  if (params.parentSessionKey) {
    params.store.update(params.parentSessionKey, (state) => {
      const current = Array.isArray(state.pendingSpawnIntents)
        ? state.pendingSpawnIntents.filter(isPendingSpawnIntent)
        : [];
      const removeIndex = current.findIndex(
        (intent) =>
          intent.role === picked.role &&
          intent.label === picked.label &&
          intent.taskDescription === picked.taskDescription &&
          intent.modelOverride === picked.modelOverride,
      );
      if (removeIndex >= 0) current.splice(removeIndex, 1);
      if (current.length > 0) {
        state.pendingSpawnIntents = current;
      } else {
        delete state.pendingSpawnIntents;
      }
    });
  }

  return picked;
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
      // Parse mail-specific config (best effort — fall back to defaults).
      // Extract only the keys parsePluginConfig understands; the orchestrator plugin
      // config also contains top-level "mail" and "orchestration" keys that would
      // otherwise trigger the "unknown config key" guard in parsePluginConfig and
      // silently discard any valid rules/acls/policies.
      const mailRawConfig = extractMailConfigInput(api.pluginConfig);
      const mailParsed = parsePluginConfig(mailRawConfig);
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
            trace: config.mail.logging,
            logger: api.logger,
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
            trace: config.mail.logging,
            logger: api.logger,
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
      // ── Orchestration tools ───────────────────────────────────────────────

      // decompose_task (optional, requires allowlisting)
      api.registerTool(
        (ctx) => {
          if (!store) return null;
          return createDecomposeTaskTool({
            store,
            config,
            sessionKey: ctx.sessionKey ?? "",
          }) as unknown as AnyAgentTool;
        },
        { name: "decompose_task", optional: true },
      );

      // agent_status (optional, requires allowlisting)
      api.registerTool(
        (_ctx) => {
          if (!store) return null;
          return createAgentStatusTool({ store, config }) as unknown as AnyAgentTool;
        },
        { name: "agent_status", optional: true },
      );

      // CLI: openclaw orchestrator status / inspect / tree / health / kill / reset / config
      api.registerCli(registerOrchestratorCli, { commands: ["orchestrator"] });

      // ── Orchestration hooks ───────────────────────────────────────────────

      // Hook: role boundary + file scope enforcement (priority 50)
      api.on(
        "before_tool_call",
        (event, ctx) => {
          if (!store || !ctx.sessionKey) return;
          const state = store.get(ctx.sessionKey);
          if (!state?.role) return;

          const result = checkToolAccess(state.role, event.toolName, state.fileScope, event.params);

          // Note: activity tracking is handled exclusively in the after_tool_call hook below
          // so that lastActivity only advances when a tool actually executes, not when blocked.

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
        // Not an orchestrated role — let the gateway handle it normally without registering.
        // Returning undefined (no opinion) is correct here; an explicit { status: "ok" }
        // would imply this agent is tracked, but it won't be, making it invisible to fleet
        // tracking and stale detection.
        if (!childRole) return;

        const parentKey = ctx.requesterSessionKey;
        const parentState = parentKey ? store.get(parentKey) : undefined;
        const parentRole = parentState?.role ?? "orchestrator";
        const parentDepth = parentState?.depth ?? 0;
        const parentIntents = Array.isArray(parentState?.pendingSpawnIntents)
          ? parentState.pendingSpawnIntents.filter(isPendingSpawnIntent)
          : undefined;

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

        const pendingIntent = consumePendingSpawnIntent({
          store,
          parentSessionKey: parentKey,
          parentIntents,
          childRole,
          childLabel: event.label,
        });

        // Register child in store
        store.update(event.childSessionKey, (s) => {
          s.role = childRole;
          s.depth = parentDepth + 1;
          s.parentSessionKey = parentKey;
          s.status = "active";
          s.lastActivity = Date.now();
          if (pendingIntent?.taskDescription) {
            s.taskDescription = pendingIntent.taskDescription;
          } else {
            delete s.taskDescription;
          }
          if (pendingIntent?.fileScope) {
            s.fileScope = pendingIntent.fileScope;
          } else {
            delete s.fileScope;
          }
          const explicitModel = pendingIntent?.modelOverride?.trim();
          if (explicitModel) {
            s.modelOverride = explicitModel;
          } else {
            delete s.modelOverride;
          }
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

        const modelOverride = state.modelOverride?.trim() || ROLE_MODEL_OVERRIDES[state.role];
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

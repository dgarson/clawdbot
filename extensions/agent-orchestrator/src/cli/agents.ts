/**
 * Agent fleet management CLI commands:
 *   orchestrator status   — fleet overview
 *   orchestrator agents   — alias for status
 *   orchestrator inspect  — single agent detail
 *   orchestrator kill     — mark agent as stale
 *   orchestrator reset    — clear all state
 *   orchestrator config   — show orchestrator config
 */

import type { Command } from "commander";
import type { OpenClawPluginCliContext } from "../../../../src/plugins/types.js";
import { ROLE_MODEL_OVERRIDES } from "../orchestration/roles.js";
import {
  type AgentRole,
  DEFAULT_ORCHESTRATOR_CONFIG,
  ROLE_BLOCKED_TOOLS,
  SPAWN_RULES,
} from "../types.js";
import {
  clearSessions,
  formatRelativeTime,
  readAllSessions,
  resolveStateDir,
  truncate,
  writeSession,
} from "./shared.js";

export function registerAgentCommands(parent: Command, ctx: OpenClawPluginCliContext): void {
  // ── status ──────────────────────────────────────────────────────────────
  const statusAction = createStatusAction(ctx);

  parent
    .command("status")
    .description("Show fleet overview — all known agent sessions.")
    .option("--json", "Output raw JSON.")
    .option("--active-only", "Only show active agents.")
    .action(statusAction);

  // ── agents (alias for status) ───────────────────────────────────────────
  parent
    .command("agents")
    .description("Alias for 'status' — show fleet overview.")
    .option("--json", "Output raw JSON.")
    .option("--active-only", "Only show active agents.")
    .action(statusAction);

  // ── inspect ─────────────────────────────────────────────────────────────
  parent
    .command("inspect <session-key>")
    .description("Show detailed info for a single agent session.")
    .option("--json", "Output raw JSON.")
    .action((sessionKey: string, opts: { json?: boolean }) => {
      const stateDir = resolveStateDir(ctx);
      const sessions = readAllSessions(stateDir);
      const state = sessions.get(sessionKey);

      if (!state) {
        process.stderr.write(`Session '${sessionKey}' not found.\n`);
        process.exitCode = 1;
        return;
      }

      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ sessionKey, ...state }, null, 2)}\n`);
        return;
      }

      const role = state.role ?? "unknown";
      const modelOverride = ROLE_MODEL_OVERRIDES[role as AgentRole] ?? "(default)";
      const blockedTools = ROLE_BLOCKED_TOOLS[role as AgentRole]?.join(", ") ?? "none";
      const spawnableRoles = SPAWN_RULES[role as AgentRole]?.join(", ") ?? "none";
      const lastActivityIso = state.lastActivity
        ? new Date(state.lastActivity).toISOString()
        : "n/a";
      const lastActivityRel = state.lastActivity
        ? formatRelativeTime(Date.now() - state.lastActivity)
        : "n/a";

      const lines = [
        `Session:       ${sessionKey}`,
        `Role:          ${role}`,
        `Depth:         ${state.depth ?? "n/a"}`,
        `Status:        ${state.status ?? "unknown"}`,
        `Parent:        ${state.parentSessionKey ?? "(root)"}`,
        `Task:          ${state.taskDescription ?? "(none)"}`,
        `File scope:    ${state.fileScope?.join(", ") ?? "(unrestricted)"}`,
        `Model:         ${modelOverride}`,
        `Blocked tools: ${blockedTools}`,
        `Can spawn:     ${spawnableRoles}`,
        `Last activity: ${lastActivityIso} (${lastActivityRel})`,
      ];

      process.stdout.write(lines.join("\n") + "\n");
    });

  // ── kill ────────────────────────────────────────────────────────────────
  parent
    .command("kill <session-key>")
    .description("Mark an agent session as stale in the store.")
    .option("--reason <text>", "Reason for marking as stale.")
    .action((sessionKey: string, opts: { reason?: string }) => {
      const stateDir = resolveStateDir(ctx);
      const sessions = readAllSessions(stateDir);
      const state = sessions.get(sessionKey);

      if (!state) {
        process.stderr.write(`Session '${sessionKey}' not found.\n`);
        process.exitCode = 1;
        return;
      }

      if (state.status === "stale") {
        process.stdout.write(`Session '${sessionKey}' is already marked as stale.\n`);
        return;
      }

      state.status = "stale";
      writeSession(stateDir, sessionKey, state);

      const reasonSuffix = opts.reason ? ` (reason: ${opts.reason})` : "";
      process.stdout.write(`Marked session '${sessionKey}' as stale${reasonSuffix}.\n`);
    });

  // ── reset ───────────────────────────────────────────────────────────────
  parent
    .command("reset")
    .description("Clear all orchestrator session state.")
    .option("--confirm", "Required flag to prevent accidental reset.")
    .option("--keep-completed", "Only clear active/stale sessions, keep completed history.")
    .action((opts: { confirm?: boolean; keepCompleted?: boolean }) => {
      if (!opts.confirm) {
        process.stderr.write(
          "Pass --confirm to clear orchestrator state. This cannot be undone.\n",
        );
        process.exitCode = 1;
        return;
      }

      const stateDir = resolveStateDir(ctx);
      const removed = clearSessions(stateDir, opts.keepCompleted === true);

      if (removed === 0) {
        process.stdout.write("No sessions to clear.\n");
      } else {
        const suffix = opts.keepCompleted ? " (kept completed sessions)" : "";
        process.stdout.write(`Cleared ${removed} session(s)${suffix}.\n`);
      }
    });

  // ── config ──────────────────────────────────────────────────────────────
  parent
    .command("config")
    .description("Show current orchestrator configuration.")
    .option("--json", "Output raw JSON.")
    .action((opts: { json?: boolean }) => {
      // Merge defaults with any user-provided config
      const userConfig = (ctx.config as Record<string, unknown>)["agent-orchestrator"] as
        | Record<string, unknown>
        | undefined;
      const merged = {
        ...DEFAULT_ORCHESTRATOR_CONFIG,
        ...userConfig,
      };

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
        return;
      }

      const lines = [
        "Orchestrator Configuration",
        "─".repeat(40),
        `  mail.enabled:                  ${merged.mail?.enabled ?? true}`,
        `  orchestration.enabled:         ${merged.orchestration?.enabled ?? true}`,
        `  orchestration.maxDepth:        ${merged.orchestration?.maxDepth ?? DEFAULT_ORCHESTRATOR_CONFIG.orchestration.maxDepth}`,
        `  orchestration.maxConcurrent:   ${merged.orchestration?.maxConcurrentAgents ?? DEFAULT_ORCHESTRATOR_CONFIG.orchestration.maxConcurrentAgents}`,
        `  orchestration.watchdogMs:      ${merged.orchestration?.watchdogIntervalMs ?? DEFAULT_ORCHESTRATOR_CONFIG.orchestration.watchdogIntervalMs}`,
        `  orchestration.staleThresholdMs:${merged.orchestration?.staleThresholdMs ?? DEFAULT_ORCHESTRATOR_CONFIG.orchestration.staleThresholdMs}`,
      ];

      process.stdout.write(lines.join("\n") + "\n");
    });
}

// ── helpers ─────────────────────────────────────────────────────────────────

function createStatusAction(ctx: OpenClawPluginCliContext) {
  return (opts: { json?: boolean; activeOnly?: boolean }) => {
    const stateDir = resolveStateDir(ctx);
    const sessions = readAllSessions(stateDir);

    // Apply active-only filter
    const entries = [...sessions.entries()].filter(([, state]) => {
      if (opts.activeOnly && state.status !== "active") return false;
      return true;
    });

    if (opts.json) {
      const obj = Object.fromEntries(entries);
      process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
      return;
    }

    if (entries.length === 0) {
      process.stdout.write("No agent sessions found.\n");
      return;
    }

    // Header
    const header =
      "SESSION KEY".padEnd(24) +
      "ROLE".padEnd(14) +
      "DEPTH".padEnd(7) +
      "STATUS".padEnd(12) +
      "LAST ACTIVITY".padEnd(16) +
      "TASK";
    process.stdout.write(header + "\n");
    process.stdout.write("─".repeat(header.length) + "\n");

    for (const [key, state] of entries) {
      const role = (state.role ?? "unknown").padEnd(14);
      const depth = String(state.depth ?? "-").padEnd(7);
      const status = (state.status ?? "unknown").padEnd(12);
      const lastActivity = state.lastActivity
        ? formatRelativeTime(Date.now() - state.lastActivity).padEnd(16)
        : "n/a".padEnd(16);
      const task = truncate(state.taskDescription ?? "", 40);

      process.stdout.write(`${key.padEnd(24)}${role}${depth}${status}${lastActivity}${task}\n`);
    }

    process.stdout.write(`\nTotal: ${entries.length} session(s)\n`);
  };
}

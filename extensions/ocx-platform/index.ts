/**
 * OCX Platform plugin — shared ops tools for the OpenClaw control plane.
 *
 * Registers:
 *   ocx_ops — unified query/explain/scores tool for cross-domain run investigation
 *             (event ledger + scorecard + health + session quality scores)
 *
 * CLI commands:
 *   openclaw ops query / explain
 *   openclaw scores list / set
 */

import { onDiagnosticEvent } from "openclaw/plugin-sdk";
import type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginDefinition,
} from "../../src/plugins/types.js";
import { registerOcxPlatformCli } from "./src/cli.js";
import { createOcxOpsTool } from "./src/ops.js";
import { appendScore } from "./src/score-store.js";

// Module-level stateDir — set by the service lifecycle hook and closed over by
// tool factories and the diagnostic event subscriber.
let stateDir: string | null = null;

const plugin: OpenClawPluginDefinition = {
  id: "ocx-platform",
  name: "OCX Platform",
  description:
    "Shared ops tools for the OpenClaw control plane. " +
    "Provides ocx_ops for cross-extension incident investigation and session quality scores.",

  register(api: OpenClawPluginApi) {
    // Capture stateDir once the service starts
    api.registerService({
      id: "ocx-platform",
      start(ctx) {
        stateDir = ctx.stateDir;
      },
      stop() {
        stateDir = null;
      },
    });

    // Persist session.score diagnostic events to JSONL for historical querying.
    // The unsubscribe function is intentionally not called on stop — the subscriber
    // is process-scoped and low overhead; the stateDir guard prevents writes after stop.
    onDiagnosticEvent((evt) => {
      if (evt.type !== "session.score") return;
      if (!stateDir) return;
      const dir = stateDir; // close over current value
      appendScore(dir, {
        ts: evt.ts,
        seq: evt.seq,
        type: "session.score",
        sessionId: evt.sessionId,
        agentId: evt.agentId,
        score: evt.score,
        rubric: evt.rubric,
        tags: evt.tags,
        evaluatorId: evt.evaluatorId,
        data: evt.data,
      }).catch((err) => {
        api.logger.warn(`ocx-platform: failed to persist session.score: ${String(err)}`);
      });
    });

    // ocx_ops — unified query/explain/scores tool for control-plane investigation
    api.registerTool(
      () => {
        if (!stateDir) return null;
        return createOcxOpsTool(stateDir) as unknown as AnyAgentTool;
      },
      { name: "ocx_ops" },
    );

    // CLI commands: openclaw ops ... / openclaw scores ...
    api.registerCli(registerOcxPlatformCli, { commands: ["ops", "scores"] });
  },
};

export default plugin;

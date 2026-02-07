import type { OpenClawConfig } from "openclaw/plugin-sdk";
import crypto from "node:crypto";
import type { MeridiaTraceEvent } from "../../src/meridia/types.js";
import { createBackend } from "../../src/meridia/db/index.js";
import { resolveMeridiaDir } from "../../src/meridia/paths.js";
import { resolveMeridiaPluginConfig } from "../../src/meridia/config.js";
import { generateReconstitution } from "../../src/meridia/reconstitute.js";
import { resolveTraceJsonlPath, appendJsonl } from "../../src/meridia/storage.js";

type WorkspaceBootstrapFile = {
  filename: string;
  content: string;
  role: "system" | "user";
};

type HookEvent = {
  type: string;
  action: string;
  timestamp: Date;
  sessionKey?: string;
  context?: unknown;
};

function resolveHookConfig(
  cfg: OpenClawConfig | undefined,
  hookKey: string,
): Record<string, unknown> | undefined {
  const entry = cfg?.hooks?.internal?.entries?.[hookKey] as Record<string, unknown> | undefined;
  return entry && typeof entry === "object" ? entry : undefined;
}

function readPositiveNumber(
  hookCfg: Record<string, unknown> | undefined,
  key: string,
  fallback: number,
): number {
  if (!hookCfg) return fallback;
  const val = hookCfg[key];
  if (typeof val === "number" && Number.isFinite(val) && val > 0) {
    return val;
  }
  if (typeof val === "string") {
    const parsed = Number(val.trim());
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return fallback;
}

const handler = async (event: HookEvent): Promise<void> => {
  if (event.type !== "agent" || event.action !== "bootstrap") {
    return;
  }

  const context = (event.context ?? null) as {
    bootstrapFiles?: WorkspaceBootstrapFile[];
    cfg?: OpenClawConfig;
    sessionKey?: string;
  } | null;

  if (!context || !Array.isArray(context.bootstrapFiles)) {
    return;
  }

  const cfg = context.cfg;
  const hookCfg = resolveHookConfig(cfg, "meridia-reconstitution");
  if (hookCfg?.enabled === false) {
    return;
  }

  const maxTokens = readPositiveNumber(hookCfg, "maxTokens", 2000);
  const lookbackHours = readPositiveNumber(hookCfg, "lookbackHours", 48);
  const minScore = readPositiveNumber(hookCfg, "minScore", 0.6);

  try {
    const result = await generateReconstitution({
      config: cfg,
      maxTokens,
      lookbackHours,
      minScore,
    });

    if (!result || !result.text) {
      return;
    }

    context.bootstrapFiles.push({
      filename: "MERIDIA-CONTEXT.md",
      content: result.text,
      role: "system",
    });

    const ts = new Date().toISOString();
    const traceEvent: MeridiaTraceEvent = {
      id: crypto.randomUUID(),
      ts,
      kind: "bootstrap_inject",
      session: { key: context.sessionKey ?? event.sessionKey },
      decision: { decision: "capture" },
    };

    const meridiaDir = resolveMeridiaDir(cfg, "meridia-reconstitution");
    const tracePath = resolveTraceJsonlPath({ meridiaDir, date: event.timestamp });
    const writeTraceJsonl = resolveMeridiaPluginConfig(cfg).debug.writeTraceJsonl;
    try {
      const backend = createBackend({ cfg, hookKey: "meridia-reconstitution" });
      backend.insertTraceEvent(traceEvent);
    } catch {
      // ignore
    }
    if (writeTraceJsonl) {
      await appendJsonl(tracePath, traceEvent);
    }
  } catch (err) {
    // Non-fatal — session starts without experiential context
    console.error(
      `[meridia-reconstitution] Failed: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
};

export default handler;

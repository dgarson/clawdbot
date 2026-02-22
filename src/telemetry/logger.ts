/**
 * Structured pino logger for OpenClaw telemetry.
 *
 * Provides per-agent and gateway log files in JSONL format with:
 * - Daily rotation via pino-roll
 * - 50 MB max per file
 * - 30-day retention (automatic cleanup of old rotated files)
 *
 * Log paths:
 *   Gateway:  ~/.openclaw/logs/gateway.jsonl
 *   Agent:    ~/.openclaw/logs/agents/{agentId}/YYYY-MM-DD.jsonl
 *
 * IMPORTANT: never writes to existing ~/.openclaw/*.log files.
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pino, { type Logger } from "pino";

const OPENCLAW_DIR = path.join(os.homedir(), ".openclaw");
const LOGS_DIR = path.join(OPENCLAW_DIR, "logs");
const AGENTS_LOGS_DIR = path.join(LOGS_DIR, "agents");
const GATEWAY_LOG_FILE = "gateway.jsonl";

/** Max file size before rotation (50 MB). */
const MAX_FILE_SIZE = "50m";
/** Number of days to retain old log files. */
const RETENTION_DAYS = 30;

// Cache loggers to avoid creating multiple transports for the same target.
const agentLoggers = new Map<string, Logger>();
let gatewayLogger: Logger | undefined;

/**
 * Ensure a directory exists (sync, best-effort).
 */
function ensureDirSync(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Build a pino transport config targeting pino-roll.
 */
function buildRollTransport(filePath: string) {
  return {
    target: "pino-roll",
    options: {
      file: filePath,
      frequency: "daily",
      size: MAX_FILE_SIZE,
      limit: { count: RETENTION_DAYS },
      mkdir: true,
    },
  };
}

/**
 * Get a structured logger for a specific agent.
 *
 * Logs are written to `~/.openclaw/logs/agents/{agentId}/agent.jsonl`
 * (pino-roll handles daily rotation + numbering).
 */
export function getAgentLogger(agentId: string): Logger {
  const existing = agentLoggers.get(agentId);
  if (existing) {
    return existing;
  }

  const agentLogDir = path.join(AGENTS_LOGS_DIR, agentId);
  ensureDirSync(agentLogDir);

  const basePath = path.join(agentLogDir, "agent.jsonl");

  const logger = pino(
    {
      level: "trace",
      base: { agentId },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport(buildRollTransport(basePath)),
  );

  agentLoggers.set(agentId, logger);
  return logger;
}

/**
 * Get the structured gateway logger.
 *
 * Logs are written to `~/.openclaw/logs/gateway.jsonl`.
 */
export function getGatewayLogger(): Logger {
  if (gatewayLogger) {
    return gatewayLogger;
  }

  ensureDirSync(LOGS_DIR);
  const filePath = path.join(LOGS_DIR, GATEWAY_LOG_FILE);

  gatewayLogger = pino(
    {
      level: "trace",
      base: { component: "gateway" },
      timestamp: pino.stdTimeFunctions.isoTime,
    },
    pino.transport(buildRollTransport(filePath)),
  );

  return gatewayLogger;
}

/**
 * Flush and close all telemetry loggers.
 * Call on graceful shutdown.
 */
export async function flushLoggers(): Promise<void> {
  const flushPromises: Array<Promise<void>> = [];

  for (const [, logger] of agentLoggers) {
    flushPromises.push(
      new Promise<void>((resolve) => {
        logger.flush();
        setTimeout(resolve, 200);
      }),
    );
  }

  if (gatewayLogger) {
    flushPromises.push(
      new Promise<void>((resolve) => {
        gatewayLogger?.flush();
        setTimeout(resolve, 200);
      }),
    );
  }

  await Promise.all(flushPromises);
}

/**
 * Reset all cached loggers (for tests).
 * @internal
 */
export function resetLoggersForTest(): void {
  agentLoggers.clear();
  gatewayLogger = undefined;
}

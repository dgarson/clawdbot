/**
 * Automation-specific logging utilities.
 *
 * Provides structured logging with automation-specific context.
 */

import type { Logger } from "../types.js";

/**
 * Create a logger with automation-specific context.
 *
 * @param baseLogger - Base logger to wrap
 * @param context - Context to include in all log messages
 * @returns Logger with automation context
 */
export function createAutomationLogger(
  baseLogger: Logger,
  context: {
    automationId?: string;
    automationName?: string;
    runId?: string;
  },
): Logger {
  return {
    debug: (obj: unknown, msg?: string) => {
      const objData = typeof obj === "object" && obj !== null ? obj : {};
      baseLogger.debug({ ...objData, ...context }, msg ?? "");
    },
    info: (obj: unknown, msg?: string) => {
      const objData = typeof obj === "object" && obj !== null ? obj : {};
      baseLogger.info({ ...objData, ...context }, msg ?? "");
    },
    warn: (obj: unknown, msg?: string) => {
      const objData = typeof obj === "object" && obj !== null ? obj : {};
      baseLogger.warn({ ...objData, ...context }, msg ?? "");
    },
    error: (obj: unknown, msg?: string) => {
      const objData = typeof obj === "object" && obj !== null ? obj : {};
      baseLogger.error({ ...objData, ...context }, msg ?? "");
    },
  };
}

/**
 * Log prefixes for different automation types.
 */
export const AUTOMATION_TYPE_LOG_PREFIX: Record<import("../types.js").AutomationTypeKind, string> =
  {
    "smart-sync-fork": "SyncFork",
    "custom-script": "Script",
    webhook: "Webhook",
  };

/**
 * Create a formatted log prefix for an automation.
 */
export function formatAutomationPrefix(automation: {
  type: import("../types.js").AutomationTypeKind;
  name: string;
}): string {
  const typePrefix = AUTOMATION_TYPE_LOG_PREFIX[automation.type];
  return `${typePrefix}: ${automation.name}`;
}

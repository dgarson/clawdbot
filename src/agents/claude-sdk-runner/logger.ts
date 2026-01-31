import { createSubsystemLogger, type SubsystemLogger } from "../../logging/subsystem.js";

const baseLogger = createSubsystemLogger("agent/claude-sdk");

/**
 * Check if Claude SDK debug logging is enabled via env var.
 * When disabled, debug/trace calls are no-ops (info/warn/error still work).
 */
function isClaudeSdkLoggingEnabled(): boolean {
  const val = process.env.CLAUDE_SDK_LOGGING_ENABLED;
  return val === "1" || val === "true";
}

/**
 * Claude SDK runner logger with env-var gating for debug/trace output.
 * Set CLAUDE_SDK_LOGGING_ENABLED=1 to enable verbose debug logging.
 */
export const log: SubsystemLogger = {
  subsystem: baseLogger.subsystem,
  trace: (message, meta) => {
    if (isClaudeSdkLoggingEnabled()) {
      baseLogger.trace(message, meta);
    }
  },
  debug: (message, meta) => {
    if (isClaudeSdkLoggingEnabled()) {
      baseLogger.debug(message, meta);
    }
  },
  info: baseLogger.info.bind(baseLogger),
  warn: baseLogger.warn.bind(baseLogger),
  error: baseLogger.error.bind(baseLogger),
  fatal: baseLogger.fatal.bind(baseLogger),
  raw: baseLogger.raw.bind(baseLogger),
  child: (name) => baseLogger.child(name),
};

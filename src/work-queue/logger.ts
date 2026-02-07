import type { OpenClawConfig } from "../config/config.js";
import { isDebuggingEnabled } from "../config/types.debugging.js";

export type WorkQueueLogger = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
  debug: (msg: string) => void;
};

/**
 * Create a work queue logger that gates debug() logs on config.
 *
 * Debug logs only emit when:
 *   debugging.channels.workqueue.verbose === true
 *
 * Info/warn/error logs always emit.
 */
export function createWorkQueueLogger(config: OpenClawConfig): WorkQueueLogger {
  const shouldDebug =
    isDebuggingEnabled(config.debugging, "workqueue") &&
    config.debugging?.channels?.workqueue?.verbose === true;

  return {
    info: (msg: string) => console.log(`[work-queue] ${msg}`),
    warn: (msg: string) => console.warn(`[work-queue] ${msg}`),
    error: (msg: string) => console.error(`[work-queue] ${msg}`),
    debug: (msg: string) => {
      if (shouldDebug) {
        console.debug(`[work-queue] ${msg}`);
      }
    },
  };
}

import type { OpenClawConfig } from "../config/config.js";
import { isChannelPropertyEnabled } from "../config/types.debugging.js";

export type WorkQueueLogger = {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
};

/**
 * Create a work queue logger that gates debug() logs on config.
 *
 * Debug logs only emit when:
 *   debugging.channels.workqueue.verbose === true
 *
 * Info/warn/error logs always emit.
 *
 * Accepts a config getter so the logger picks up hot-reloaded config
 * without needing to be recreated.
 */
export function createWorkQueueLogger(getConfig: () => OpenClawConfig): WorkQueueLogger {
  return {
    info: (msg: string) => console.log(`[work-queue] ${msg}`),
    warn: (msg: string) => console.warn(`[work-queue] ${msg}`),
    error: (msg: string) => console.error(`[work-queue] ${msg}`),
    debug: (msg: string) => {
      if (isChannelPropertyEnabled(getConfig().debugging, "workqueue", "verbose")) {
        console.debug(`[work-queue] ${msg}`);
      }
    },
  };
}

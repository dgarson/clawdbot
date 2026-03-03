/**
 * runtime.cron namespace implementation (#7).
 *
 * Interval-based in-process scheduler. Each plugin gets its own scheduler
 * whose timers are cleaned up on gateway_stop via `shutdownAllCronJobs()`.
 */

import type { PluginCronNamespace } from "./types.cron.js";

type SchedulerEntry = {
  intervalMs: number;
  timer: ReturnType<typeof setInterval>;
};

// All active schedulers, keyed by pluginId.
const allSchedulers = new Map<string, Map<string, SchedulerEntry>>();

/**
 * Shut down all cron timers across all plugins.
 * Call this on gateway_stop to avoid timers outliving the process.
 */
export function shutdownAllCronJobs(): void {
  for (const [, schedules] of allSchedulers) {
    for (const [, entry] of schedules) {
      clearInterval(entry.timer);
    }
    schedules.clear();
  }
  allSchedulers.clear();
}

export function createPluginCronScheduler(pluginId: string): PluginCronNamespace {
  if (!allSchedulers.has(pluginId)) {
    allSchedulers.set(pluginId, new Map());
  }
  const schedules = allSchedulers.get(pluginId)!;

  return {
    schedule(id: string, intervalMs: number, handler: () => void | Promise<void>): void {
      // Cancel previous schedule with same id (dedup/replace).
      const existing = schedules.get(id);
      if (existing) {
        clearInterval(existing.timer);
      }
      const timer = setInterval(() => {
        try {
          const result = handler();
          if (result instanceof Promise) {
            result.catch((err) => {
              console.warn(`[cron:${pluginId}/${id}] handler error: ${String(err)}`);
            });
          }
        } catch (err) {
          console.warn(`[cron:${pluginId}/${id}] handler error: ${String(err)}`);
        }
      }, intervalMs);
      schedules.set(id, { intervalMs, timer });
    },

    cancel(id: string): void {
      const entry = schedules.get(id);
      if (entry) {
        clearInterval(entry.timer);
        schedules.delete(id);
      }
    },

    list(): string[] {
      return Array.from(schedules.keys());
    },
  };
}

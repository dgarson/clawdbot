/**
 * Schedule computation for automations.
 *
 * Reuses the CronService schedule computation logic to determine
 * when automations should next run.
 */

import type { AutomationSchedule } from "./types.js";
import { computeNextRunAtMs as cronComputeNextRunAtMs } from "../cron/schedule.js";

/**
 * Compute the next run time for an automation schedule.
 *
 * @param schedule - The automation schedule definition
 * @param nowMs - Current timestamp in milliseconds
 * @returns Next run timestamp in milliseconds, or undefined if no future runs
 */
export function computeNextRunAtMs(
  schedule: AutomationSchedule,
  nowMs: number,
): number | undefined {
  // Reuse CronService's schedule computation logic
  // Convert AutomationSchedule to CronSchedule format (types are identical)
  return cronComputeNextRunAtMs(schedule as never, nowMs);
}

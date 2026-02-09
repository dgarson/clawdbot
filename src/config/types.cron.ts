import type { CronDeliveryDefaults } from "../cron/types.js";

export type CronConfig = {
  enabled?: boolean;
  store?: string;
  maxConcurrentRuns?: number;
  /** Optional default delivery route applied to cron jobs when enabled. */
  defaultDelivery?: CronDeliveryDefaults;
};

/**
 * Alert suppression: per-signal cooldown and max-per-hour.
 *
 * Default suppressions:
 *   token_spike  15 min cooldown, 4/hour
 *   error_burst  10 min cooldown, 6/hour
 *   tool_loop     5 min cooldown, 12/hour
 *   cost_spike   60 min cooldown, 1/hour
 */

import type { SuppressionRule } from "../types.js";

// =============================================================================
// Suppression State
// =============================================================================

type AlertRecord = {
  signalKind: string;
  timestamp: number;
};

/** Per-agent, per-signal alert history. */
const alertHistory = new Map<string, AlertRecord[]>();

// =============================================================================
// Suppression Engine
// =============================================================================

export type SuppressionEngine = {
  /** Check whether an alert for signalKind should be suppressed for agentId. */
  shouldSuppress(agentId: string, signalKind: string): boolean;

  /** Record that an alert was emitted. */
  recordAlert(agentId: string, signalKind: string): void;

  /** Clear all suppression state. */
  reset(): void;
};

export function createSuppressionEngine(rules: SuppressionRule[]): SuppressionEngine {
  const ruleMap = new Map<string, SuppressionRule>();
  for (const rule of rules) {
    ruleMap.set(rule.signalKind, rule);
  }

  const agentKey = (agentId: string, signalKind: string) => `${agentId}:${signalKind}`;

  return {
    shouldSuppress(agentId, signalKind) {
      const rule = ruleMap.get(signalKind);
      if (!rule) {
        // No suppression rule for this signal kind; allow it
        return false;
      }

      const key = agentKey(agentId, signalKind);
      const records = alertHistory.get(key);
      if (!records || records.length === 0) {
        return false;
      }

      const now = Date.now();

      // Check cooldown: last alert must be older than cooldownMinutes
      const lastAlert = records[records.length - 1];
      const cooldownMs = rule.cooldownMinutes * 60 * 1000;
      if (now - lastAlert.timestamp < cooldownMs) {
        return true;
      }

      // Check max per hour
      const oneHourAgo = now - 60 * 60 * 1000;
      const alertsInHour = records.filter((r) => r.timestamp > oneHourAgo).length;
      if (alertsInHour >= rule.maxPerHour) {
        return true;
      }

      return false;
    },

    recordAlert(agentId, signalKind) {
      const key = agentKey(agentId, signalKind);
      let records = alertHistory.get(key);
      if (!records) {
        records = [];
        alertHistory.set(key, records);
      }

      records.push({ signalKind, timestamp: Date.now() });

      // Prune old records (keep last 2 hours)
      const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000;
      const pruneIndex = records.findIndex((r) => r.timestamp > twoHoursAgo);
      if (pruneIndex > 0) {
        records.splice(0, pruneIndex);
      }
    },

    reset() {
      alertHistory.clear();
    },
  };
}

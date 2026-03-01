type Logger = { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
import type { BudgetManagerConfig } from "./config.js";
import type { BudgetAlert, BudgetAllocation, BudgetUsage } from "./types.js";

/**
 * Tracks which thresholds have already been alerted to avoid duplicate alerts.
 * Key format: "scope:dimension:threshold"
 */
const alertedThresholds = new Set<string>();

/**
 * In-memory store of active alert objects, keyed by "level:id".
 * Each scope maps to an array of alerts emitted during the current window.
 */
const activeAlertsByScope = new Map<string, BudgetAlert[]>();

/** Build a scope key for the active alerts map. */
function alertScopeKey(scope: { level: string; id: string }): string {
  return `${scope.level}:${scope.id}`;
}

/**
 * Check budget usage against alert thresholds and emit alerts for newly crossed ones.
 * Returns any new alerts that were triggered.
 */
export function checkAlerts(
  allocation: BudgetAllocation,
  usage: BudgetUsage,
  logger: Logger,
): BudgetAlert[] {
  const alerts: BudgetAlert[] = [];
  const thresholds = allocation.alertAt;

  for (const [dimension, pct] of Object.entries(usage.utilizationPct)) {
    for (const threshold of thresholds) {
      if (pct >= threshold) {
        const key = `${allocation.scope.level}:${allocation.scope.id}:${dimension}:${threshold}`;
        if (!alertedThresholds.has(key)) {
          alertedThresholds.add(key);

          const alert: BudgetAlert = {
            scope: allocation.scope,
            threshold,
            dimension,
            currentPct: pct,
            timestamp: new Date().toISOString(),
          };

          alerts.push(alert);

          // Store in active alerts map
          const sk = alertScopeKey(allocation.scope);
          const existing = activeAlertsByScope.get(sk) ?? [];
          existing.push(alert);
          activeAlertsByScope.set(sk, existing);

          logger.warn(
            `budget-manager: alert - ${allocation.scope.level}/${allocation.scope.id} ` +
              `${dimension} at ${(pct * 100).toFixed(1)}% (threshold: ${(threshold * 100).toFixed(0)}%)`,
          );
        }
      }
    }
  }

  return alerts;
}

/**
 * Deliver alerts via the configured delivery channel.
 */
export async function deliverAlerts(
  alerts: BudgetAlert[],
  config: BudgetManagerConfig,
  logger: Logger,
): Promise<void> {
  if (alerts.length === 0) return;

  if (config.alertDelivery === "webhook" && config.alertWebhookUrl) {
    try {
      await fetch(config.alertWebhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alerts }),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      logger.warn(`budget-manager: failed to deliver alert webhook: ${String(err)}`);
    }
  }

  // For "broadcast" delivery, the caller (tracker) should emit events via the gateway.
  // We log here as a fallback.
  for (const alert of alerts) {
    logger.info(
      `budget-manager: budget alert delivered - ` +
        `${alert.scope.level}/${alert.scope.id} ${alert.dimension} ` +
        `at ${(alert.currentPct * 100).toFixed(1)}%`,
    );
  }
}

/** Get all active (not yet cleared) alerts across every scope. */
export function getActiveAlerts(): BudgetAlert[] {
  const all: BudgetAlert[] = [];
  for (const alerts of activeAlertsByScope.values()) {
    all.push(...alerts);
  }
  return all;
}

/**
 * Remove alerts that belong to a previous budget window.
 * Alerts whose timestamp is before `windowStart` are discarded,
 * and the matching dedup keys in `alertedThresholds` are also cleared
 * so new alerts can fire in the fresh window.
 */
export function clearExpiredAlerts(windowStart: string): void {
  const boundary = new Date(windowStart).getTime();

  for (const [scopeKey, alerts] of activeAlertsByScope) {
    const kept = alerts.filter((a) => new Date(a.timestamp).getTime() >= boundary);
    if (kept.length === 0) {
      activeAlertsByScope.delete(scopeKey);
    } else {
      activeAlertsByScope.set(scopeKey, kept);
    }
  }

  // Also prune the dedup set: remove keys whose alerts have been dropped.
  // Rebuild a set of still-active dedup keys from the remaining alerts.
  const stillActive = new Set<string>();
  for (const alerts of activeAlertsByScope.values()) {
    for (const a of alerts) {
      stillActive.add(`${a.scope.level}:${a.scope.id}:${a.dimension}:${a.threshold}`);
    }
  }

  for (const key of alertedThresholds) {
    if (!stillActive.has(key)) {
      alertedThresholds.delete(key);
    }
  }
}

/**
 * Reset alerted thresholds when a new window starts.
 * Call this at the beginning of each window period.
 */
export function resetAlerts(): void {
  alertedThresholds.clear();
  activeAlertsByScope.clear();
}

/**
 * Plugin configuration type and defaults for the budget manager.
 */

export type BudgetManagerConfig = {
  /** Enforcement mode: read-only (track only), soft (warn/degrade), hard (may block) */
  enforcement: "read-only" | "soft" | "hard";
  /** Default window kind for new scopes */
  defaultWindow: "hourly" | "daily" | "weekly" | "monthly";
  /** Filename (relative to state dir) for model pricing data */
  priceTableFile: string;
  /** How to deliver budget threshold alerts */
  alertDelivery: "broadcast" | "webhook";
  /** Webhook URL when alertDelivery = "webhook" */
  alertWebhookUrl: string;
  /** Filename (relative to state dir) for the budget scope hierarchy */
  hierarchyFile: string;
};

export const DEFAULT_CONFIG: BudgetManagerConfig = {
  enforcement: "read-only",
  defaultWindow: "daily",
  priceTableFile: "price-table.json",
  alertDelivery: "broadcast",
  alertWebhookUrl: "",
  hierarchyFile: "budget-hierarchy.json",
};

/** Merge raw plugin config with defaults. */
export function resolveConfig(raw: Record<string, unknown> | undefined): BudgetManagerConfig {
  const cfg = raw ?? {};
  return {
    enforcement: isEnforcement(cfg.enforcement) ? cfg.enforcement : DEFAULT_CONFIG.enforcement,
    defaultWindow: isDefaultWindow(cfg.defaultWindow)
      ? cfg.defaultWindow
      : DEFAULT_CONFIG.defaultWindow,
    priceTableFile:
      typeof cfg.priceTableFile === "string" ? cfg.priceTableFile : DEFAULT_CONFIG.priceTableFile,
    alertDelivery: isAlertDelivery(cfg.alertDelivery)
      ? cfg.alertDelivery
      : DEFAULT_CONFIG.alertDelivery,
    alertWebhookUrl:
      typeof cfg.alertWebhookUrl === "string"
        ? cfg.alertWebhookUrl
        : DEFAULT_CONFIG.alertWebhookUrl,
    hierarchyFile:
      typeof cfg.hierarchyFile === "string" ? cfg.hierarchyFile : DEFAULT_CONFIG.hierarchyFile,
  };
}

function isEnforcement(v: unknown): v is BudgetManagerConfig["enforcement"] {
  return v === "read-only" || v === "soft" || v === "hard";
}

function isDefaultWindow(v: unknown): v is BudgetManagerConfig["defaultWindow"] {
  return v === "hourly" || v === "daily" || v === "weekly" || v === "monthly";
}

function isAlertDelivery(v: unknown): v is BudgetManagerConfig["alertDelivery"] {
  return v === "broadcast" || v === "webhook";
}

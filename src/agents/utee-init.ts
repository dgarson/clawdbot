/**
 * UTEE initialization from OpenClaw configuration.
 *
 * This module handles reading UTEE config and enabling/disabling the observability layer.
 */

import type { OpenClawConfig } from "../config/types.openclaw.js";
import { logInfo } from "../logger.js";
import { disableUtee, enableUtee, isUteeEnabled } from "./utee-adapter.js";

/**
 * Initialize UTEE from OpenClaw configuration.
 * Should be called during gateway startup.
 */
export function initUteeFromConfig(cfg?: OpenClawConfig): void {
  const uteeConfig = cfg?.utee;
  const enabled = uteeConfig?.enabled ?? false;

  if (enabled && !isUteeEnabled()) {
    enableUtee();
    logInfo("[UTEE] Phase 1 initialized from config");
  } else if (!enabled && isUteeEnabled()) {
    disableUtee();
    logInfo("[UTEE] Phase 1 disabled from config");
  }
}

/**
 * Update UTEE state when config changes (e.g., config reload).
 */
export function updateUteeFromConfig(cfg?: OpenClawConfig): void {
  initUteeFromConfig(cfg);
}

/**
 * Input validation utilities for automations.
 *
 * Provides validation functions for automation creation and update inputs.
 */

import type {
  AutomationConfig,
  AutomationCreate,
  AutomationPatch,
  AutomationSchedule,
  AutomationTypeKind,
} from "../types.js";

/**
 * Validate an automation schedule.
 * @throws Error if schedule is invalid
 */
export function validateSchedule(schedule: AutomationSchedule): void {
  if (schedule.kind === "at") {
    if (typeof schedule.atMs !== "number" || schedule.atMs < 0) {
      throw new Error("schedule.atMs must be a non-negative number");
    }
  } else if (schedule.kind === "every") {
    if (typeof schedule.everyMs !== "number" || schedule.everyMs < 1) {
      throw new Error("schedule.everyMs must be a positive number");
    }
    if (schedule.anchorMs !== undefined) {
      if (typeof schedule.anchorMs !== "number" || schedule.anchorMs < 0) {
        throw new Error("schedule.anchorMs must be a non-negative number");
      }
    }
  } else if (schedule.kind === "cron") {
    if (typeof schedule.expr !== "string" || schedule.expr.trim().length === 0) {
      throw new Error("schedule.expr is required for cron schedules");
    }
  } else {
    throw new Error(`Unknown schedule kind: ${(schedule as { kind: string }).kind}`);
  }
}

/**
 * Validate automation configuration matches the declared type.
 * @throws Error if config doesn't match type
 */
export function validateConfigMatchesType(
  type: AutomationTypeKind,
  config: AutomationConfig,
): void {
  if (config.type !== type) {
    throw new Error(
      `Automation type "${type}" requires config.type "${type}", got "${config.type}"`,
    );
  }
}

/**
 * Validate smart-sync-fork configuration.
 */
export function validateSmartSyncForkConfig(
  config: Extract<AutomationConfig, { type: "smart-sync-fork" }>,
): void {
  if (!config.forkRepoUrl || typeof config.forkRepoUrl !== "string") {
    throw new Error("smart-sync-fork requires forkRepoUrl");
  }
  if (!config.upstreamRepoUrl || typeof config.upstreamRepoUrl !== "string") {
    throw new Error("smart-sync-fork requires upstreamRepoUrl");
  }
  if (!config.forkBranch || typeof config.forkBranch !== "string") {
    throw new Error("smart-sync-fork requires forkBranch");
  }
  if (!config.upstreamBranch || typeof config.upstreamBranch !== "string") {
    throw new Error("smart-sync-fork requires upstreamBranch");
  }
  if (!config.strategy || !["merge", "rebase", "cherry-pick"].includes(config.strategy)) {
    throw new Error("smart-sync-fork requires a valid strategy (merge, rebase, or cherry-pick)");
  }
  if (
    !config.conflictResolution ||
    !["fail", "prefer-theirs", "prefer-ours"].includes(config.conflictResolution)
  ) {
    throw new Error(
      "smart-sync-fork requires a valid conflictResolution (fail, prefer-theirs, prefer-ours)",
    );
  }
  if (config.createPullRequest && !config.authToken) {
    throw new Error("smart-sync-fork with createPullRequest requires authToken");
  }
}

/**
 * Validate custom-script configuration.
 */
export function validateCustomScriptConfig(
  config: Extract<AutomationConfig, { type: "custom-script" }>,
): void {
  if (!config.script || typeof config.script !== "string") {
    throw new Error("custom-script requires script (file path)");
  }
  if (
    config.timeoutMs !== undefined &&
    (typeof config.timeoutMs !== "number" || config.timeoutMs <= 0)
  ) {
    throw new Error("custom-script timeoutMs must be a positive number");
  }
}

/**
 * Validate webhook configuration.
 */
export function validateWebhookConfig(
  config: Extract<AutomationConfig, { type: "webhook" }>,
): void {
  if (!config.url || typeof config.url !== "string") {
    throw new Error("webhook requires url");
  }
  if (!config.method || !["GET", "POST", "PUT", "PATCH", "DELETE"].includes(config.method)) {
    throw new Error("webhook requires valid method (GET, POST, PUT, PATCH, DELETE)");
  }
  if (
    config.timeoutMs !== undefined &&
    (typeof config.timeoutMs !== "number" || config.timeoutMs <= 0)
  ) {
    throw new Error("webhook timeoutMs must be a positive number");
  }
  if (
    config.retryPolicy?.maxAttempts !== undefined &&
    (typeof config.retryPolicy.maxAttempts !== "number" || config.retryPolicy.maxAttempts < 1)
  ) {
    throw new Error("webhook retryPolicy.maxAttempts must be at least 1");
  }
  if (
    config.retryPolicy?.initialDelayMs !== undefined &&
    (typeof config.retryPolicy.initialDelayMs !== "number" || config.retryPolicy.initialDelayMs < 0)
  ) {
    throw new Error("webhook retryPolicy.initialDelayMs must be non-negative");
  }
  if (
    config.retryPolicy?.maxDelayMs !== undefined &&
    (typeof config.retryPolicy.maxDelayMs !== "number" || config.retryPolicy.maxDelayMs < 0)
  ) {
    throw new Error("webhook retryPolicy.maxDelayMs must be non-negative");
  }
}

/**
 * Validate automation creation input.
 */
export function validateAutomationCreate(input: AutomationCreate): void {
  if (!input.name || typeof input.name !== "string" || input.name.trim().length === 0) {
    throw new Error("name is required");
  }

  validateSchedule(input.schedule);
  validateConfigMatchesType(input.type, input.config);

  switch (input.type) {
    case "smart-sync-fork":
      validateSmartSyncForkConfig(
        input.config as Extract<AutomationConfig, { type: "smart-sync-fork" }>,
      );
      break;
    case "custom-script":
      validateCustomScriptConfig(
        input.config as Extract<AutomationConfig, { type: "custom-script" }>,
      );
      break;
    case "webhook":
      validateWebhookConfig(input.config as Extract<AutomationConfig, { type: "webhook" }>);
      break;
  }
}

/**
 * Validate automation patch input.
 * Only validates fields that are present in the patch.
 */
export function validateAutomationPatch(patch: AutomationPatch): void {
  if (
    patch.name !== undefined &&
    (typeof patch.name !== "string" || patch.name.trim().length === 0)
  ) {
    throw new Error("name must be a non-empty string");
  }

  if (patch.schedule) {
    validateSchedule(patch.schedule);
  }

  if (patch.type && patch.config) {
    validateConfigMatchesType(patch.type, patch.config);

    switch (patch.type) {
      case "smart-sync-fork":
        validateSmartSyncForkConfig(
          patch.config as Extract<AutomationConfig, { type: "smart-sync-fork" }>,
        );
        break;
      case "custom-script":
        validateCustomScriptConfig(
          patch.config as Extract<AutomationConfig, { type: "custom-script" }>,
        );
        break;
      case "webhook":
        validateWebhookConfig(patch.config as Extract<AutomationConfig, { type: "webhook" }>);
        break;
    }
  }

  if (patch.tags !== undefined && !Array.isArray(patch.tags)) {
    throw new Error("tags must be an array");
  }
}

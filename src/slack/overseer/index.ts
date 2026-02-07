/**
 * Slack Overseer integration module.
 *
 * Provides a bridge between the Overseer system and Slack for:
 * - Activity notifications (status changes)
 * - Escalations (stalled tasks)
 * - Decision requests (user input)
 */

export * from "./bridge.js";
export * from "./blocks.js";
export * from "./config.js";
export * from "./decisions.js";

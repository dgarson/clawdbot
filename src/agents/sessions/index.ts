/**
 * Session adapter module.
 *
 * Provides a unified interface for reading and writing session history
 * across different runtime formats (Pi-Agent, Claude Code SDK).
 */

export type { SessionAdapter, SessionAdapterFactory } from "./session-adapter.js";
export type {
  AssistantContent,
  NormalizedContent,
  NormalizedImageContent,
  NormalizedMessage,
  NormalizedTextContent,
  NormalizedThinking,
  NormalizedToolCall,
  NormalizedToolResultContent,
  SessionMetadata,
  UsageInfo,
} from "./types.js";

export {
  createPiSessionAdapter,
  PiSessionAdapter,
  type PiSessionAdapterOptions,
} from "./pi-session-adapter.js";

import type { SessionAdapter } from "./session-adapter.js";
import { createPiSessionAdapter } from "./pi-session-adapter.js";

/**
 * Factory function to create the appropriate session adapter.
 *
 * Note: CCSDK adapter will be added in a future PR when Claude Agent SDK
 * runtime implementation is complete.
 */
export function createSessionAdapter(
  runtime: "pi-agent" | "ccsdk",
  sessionFile: string,
  options: {
    sessionId: string;
    cwd?: string;
    version?: string;
    gitBranch?: string;
    slug?: string;
  },
): SessionAdapter {
  if (runtime === "ccsdk") {
    // CCSDK adapter not yet implemented - throw informative error
    throw new Error("CCSDK session adapter not yet implemented. Use Pi-Agent adapter for now.");
  }
  return createPiSessionAdapter(sessionFile, options);
}

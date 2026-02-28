import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

/**
 * Session Scratchpad extension.
 *
 * The scratchpad tool (session.scratchpad) and its prompt injection are
 * implemented directly in create-session.ts because they require closure
 * over session-scoped state (scratchpad content, sessionManager).
 *
 * This extension exists as a registration point and can be extended to
 * add CLI commands (e.g. `openclaw scratchpad show`) or cross-session
 * scratchpad persistence in the future.
 *
 * Configuration: agents.defaults.claudeSdk.scratchpad
 *   enabled: boolean (default: true)
 *   maxChars: number (default: 8000)
 */
const scratchpadPlugin = {
  id: "scratchpad",
  name: "Session Scratchpad",
  description: "Persistent working memory for Claude SDK sessions that survives auto-compaction",
  kind: "agent",
  configSchema: emptyPluginConfigSchema(),
  register(_api: OpenClawPluginApi) {
    // Core implementation lives in create-session.ts.
    // Future: add CLI commands, cross-session persistence, or analytics here.
  },
};

export default scratchpadPlugin;

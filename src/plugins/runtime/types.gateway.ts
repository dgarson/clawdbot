/**
 * Gateway dispatcher type for `runtime.gateway` (P1).
 * Extracted from runtime/types.ts to keep that file focused on the core
 * PluginRuntime interface shape.
 */

/**
 * In-process gateway dispatcher injected after the full handler map is assembled.
 * Plugins are fully trusted (same process), so no operator scope checks apply.
 */
export type PluginGatewayDispatcher = <T = Record<string, unknown>>(
  method: string,
  params: Record<string, unknown>,
  opts?: { pluginId?: string },
) => Promise<T>;

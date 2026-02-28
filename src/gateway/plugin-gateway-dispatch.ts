/**
 * In-process gateway dispatch for plugins.
 *
 * Plugins run in the same process as the gateway and are fully trusted. This
 * module provides a direct function-call path into the gateway method handler
 * map, bypassing WebSocket/credential overhead entirely.
 *
 * The dispatcher is wired during gateway startup (after the full handler map
 * is assembled) by calling `createPluginGatewayDispatcher` and passing the
 * result to `setGatewayDispatcher` in the plugin runtime.
 */
import type { PluginGatewayDispatcher } from "../plugins/runtime/types.js";
import type { GatewayRequestContext, GatewayRequestHandlers } from "./server-methods/types.js";

/** Synthetic client identity prefix for plugin-originated gateway calls. */
const PLUGIN_CLIENT_ORIGIN = "plugin" as const;

/**
 * Create an in-process gateway dispatcher that plugins can use via
 * `runtime.gateway.call(method, params)`.
 *
 * The dispatcher:
 * - Looks up the method in the full handler map (core + plugin-registered).
 * - Invokes the handler directly with a synthetic request context.
 * - Returns the response payload on success, throws on error.
 * - Preserves plugin identity in the connect.clientName for logging/auditing.
 */
export function createPluginGatewayDispatcher(params: {
  /** Full merged handler map (core + plugin + exec-approval handlers). */
  allHandlers: GatewayRequestHandlers;
  /** Live gateway request context captured at startup. */
  context: GatewayRequestContext;
}): PluginGatewayDispatcher {
  const { allHandlers, context } = params;

  return function pluginGatewayDispatch<T = Record<string, unknown>>(
    method: string,
    requestParams: Record<string, unknown>,
    opts?: { pluginId?: string },
  ): Promise<T> {
    const handler = allHandlers[method];
    if (!handler) {
      return Promise.reject(new Error(`plugin gateway dispatch: unknown method "${method}"`));
    }

    const callerId = opts?.pluginId
      ? `${PLUGIN_CLIENT_ORIGIN}:${opts.pluginId}`
      : PLUGIN_CLIENT_ORIGIN;
    context.logGateway.debug(`plugin dispatch: ${callerId} → ${method}`);

    return new Promise<T>((resolve, reject) => {
      const respond = (
        ok: boolean,
        payload?: unknown,
        error?: { code?: string | number; message?: string },
      ) => {
        if (ok) {
          resolve((payload ?? {}) as T);
        } else {
          const msg = error?.message ?? `gateway method "${method}" failed`;
          reject(new Error(msg));
        }
      };

      try {
        // Pass client: null to bypass external auth checks (authorizeGatewayMethod
        // short-circuits to null when !client?.connect). Plugins are fully trusted
        // in-process — the same trust level as the gateway calling itself internally.
        const result = handler({
          req: {
            type: "req" as const,
            id: `plugin-dispatch-${Date.now()}`,
            method,
            params: requestParams,
          },
          params: requestParams,
          client: null,
          isWebchatConnect: () => false,
          respond,
          context,
        });
        // Handler may return a promise or be synchronous.
        if (result instanceof Promise) {
          result.catch(reject);
        }
      } catch (err) {
        reject(err);
      }
    });
  };
}

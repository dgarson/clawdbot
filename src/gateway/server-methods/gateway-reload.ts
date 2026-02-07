import type { GatewayRequestHandlers } from "./types.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateGatewayReloadParams,
} from "../protocol/index.js";

export const gatewayReloadHandlers: GatewayRequestHandlers = {
  "gateway.reload": async ({ params, respond, context }) => {
    if (!validateGatewayReloadParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid gateway.reload params: ${formatValidationErrors(validateGatewayReloadParams.errors)}`,
        ),
      );
      return;
    }

    if (!context.triggerConfigReload) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          "gateway.reload not available (reload handlers not initialized)",
        ),
      );
      return;
    }

    const forceRestart = Boolean((params as { forceRestart?: unknown }).forceRestart);
    const graceful = Boolean((params as { graceful?: unknown }).graceful);
    const gracefulTimeoutMsRaw = (params as { gracefulTimeoutMs?: unknown }).gracefulTimeoutMs;
    const gracefulTimeoutMs =
      typeof gracefulTimeoutMsRaw === "number" && Number.isFinite(gracefulTimeoutMsRaw)
        ? Math.max(0, Math.floor(gracefulTimeoutMsRaw))
        : undefined;

    try {
      const result = await context.triggerConfigReload({
        forceRestart,
        graceful,
        gracefulTimeoutMs,
      });

      // Serialize the plan for the response (convert Set to Array)
      const serializedPlan = {
        changedPaths: result.plan.changedPaths,
        restartGateway: result.plan.restartGateway,
        restartReasons: result.plan.restartReasons,
        hotReasons: result.plan.hotReasons,
        reloadHooks: result.plan.reloadHooks,
        restartBrowserControl: result.plan.restartBrowserControl,
        restartCron: result.plan.restartCron,
        restartHeartbeat: result.plan.restartHeartbeat,
        restartChannels: Array.from(result.plan.restartChannels),
        noopPaths: result.plan.noopPaths,
      };

      respond(
        true,
        {
          ok: true,
          mode: result.mode === "noop" ? "hot" : result.mode,
          plan: serializedPlan,
          graceful: result.graceful,
          restart: result.restart,
        },
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, `gateway.reload failed: ${String(err)}`),
      );
    }
  },
};

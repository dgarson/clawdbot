import { Type } from "@sinclair/typebox";

export const GatewayReloadParamsSchema = Type.Object(
  {
    sessionKey: Type.Optional(Type.String({ description: "Optional tracking session key" })),
    note: Type.Optional(Type.String({ description: "Optional audit trail note" })),
    forceRestart: Type.Optional(
      Type.Boolean({ description: "Force restart even if hot-reload is possible" }),
    ),
    graceful: Type.Optional(
      Type.Boolean({ description: "Wait for running agents to complete before restart" }),
    ),
    gracefulTimeoutMs: Type.Optional(
      Type.Integer({
        minimum: 0,
        maximum: 300000,
        description: "Graceful drain timeout in milliseconds (default: 30000)",
      }),
    ),
  },
  { additionalProperties: false },
);

export const GatewayReloadResultSchema = Type.Object(
  {
    ok: Type.Boolean(),
    mode: Type.Union([Type.Literal("hot"), Type.Literal("restart")]),
    plan: Type.Object({
      changedPaths: Type.Array(Type.String()),
      restartGateway: Type.Boolean(),
      restartReasons: Type.Array(Type.String()),
      hotReasons: Type.Array(Type.String()),
      reloadHooks: Type.Boolean(),
      restartBrowserControl: Type.Boolean(),
      restartCron: Type.Boolean(),
      restartHeartbeat: Type.Boolean(),
      restartChannels: Type.Array(Type.String()),
      noopPaths: Type.Array(Type.String()),
    }),
    graceful: Type.Optional(
      Type.Object({
        enabled: Type.Boolean(),
        runningAgents: Type.Number(),
        timeoutMs: Type.Number(),
        drained: Type.Boolean(),
      }),
    ),
    restart: Type.Optional(
      Type.Object({
        scheduled: Type.Boolean(),
        delayMs: Type.Optional(Type.Number()),
        reason: Type.String(),
      }),
    ),
  },
  { additionalProperties: false },
);

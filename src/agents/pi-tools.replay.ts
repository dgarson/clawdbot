import type { ReplayInterceptor } from "../replay/interceptor.js";
import type { AnyAgentTool } from "./tools/common.js";

const REPLAY_INTERCEPTOR_WRAPPED = Symbol("replayInterceptorWrapped");

export function wrapToolWithReplayInterceptor(
  tool: AnyAgentTool,
  interceptor?: ReplayInterceptor,
): AnyAgentTool {
  const execute = tool.execute;
  if (!execute || !interceptor) {
    return tool;
  }

  const toolName = tool.name || "tool";
  const wrapped: AnyAgentTool = {
    ...tool,
    execute: async (...args: unknown[]) => {
      const toolCallId = typeof args[0] === "string" ? args[0] : undefined;
      const params = args[1];
      return await interceptor.execute({
        toolName,
        toolCallId,
        params,
        invoke: async () =>
          await (execute as (...callArgs: unknown[]) => Promise<unknown>)(...args),
      });
    },
  };

  Object.defineProperty(wrapped, REPLAY_INTERCEPTOR_WRAPPED, {
    value: true,
    enumerable: true,
  });

  return wrapped;
}

export function isToolWrappedWithReplayInterceptor(tool: AnyAgentTool): boolean {
  const tagged = tool as unknown as Record<symbol, unknown>;
  return tagged[REPLAY_INTERCEPTOR_WRAPPED] === true;
}

export const __testing = {
  REPLAY_INTERCEPTOR_WRAPPED,
};

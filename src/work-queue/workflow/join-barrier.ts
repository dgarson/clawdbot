import type {
  GatewayCallFn,
  JoinBarrierEntry,
  JoinBarrierResult,
  WorkflowLogger,
} from "./types.js";
import { readLatestAssistantReply } from "../../agents/tools/agent-step.js";

/**
 * Wait for multiple subagent runs to complete, reading their final replies.
 * Uses Promise.allSettled so partial failures don't block the entire barrier.
 */
export async function awaitJoinBarrier(opts: {
  entries: JoinBarrierEntry[];
  timeoutMs: number;
  callGateway: GatewayCallFn;
  log: WorkflowLogger;
}): Promise<JoinBarrierResult[]> {
  const { entries, timeoutMs, callGateway, log } = opts;

  const waitPromises = entries.map(async (entry): Promise<JoinBarrierResult> => {
    try {
      const wait = await callGateway<{
        status?: string;
        error?: string;
      }>({
        method: "agent.wait",
        params: {
          runId: entry.runId,
          timeoutMs,
        },
        timeoutMs: timeoutMs + 5000,
      });

      const status: JoinBarrierResult["status"] =
        wait?.status === "ok" ? "ok" : wait?.status === "timeout" ? "timeout" : "error";

      let reply: string | undefined;
      if (status === "ok" || status === "timeout") {
        try {
          reply = await readLatestAssistantReply({ sessionKey: entry.sessionKey });
        } catch (err) {
          log.debug(`join-barrier: failed to read reply for ${entry.label}: ${String(err)}`);
        }
      }

      return {
        entry,
        status,
        reply,
        error: wait?.error,
      };
    } catch (err) {
      log.error(`join-barrier: error waiting for ${entry.label}: ${String(err)}`);
      return {
        entry,
        status: "error",
        error: String(err),
      };
    }
  });

  const settled = await Promise.allSettled(waitPromises);

  return settled.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    }
    // Rejected promise (shouldn't happen since we catch inside, but handle defensively).
    return {
      entry: entries[index],
      status: "error" as const,
      error: String(result.reason),
    };
  });
}

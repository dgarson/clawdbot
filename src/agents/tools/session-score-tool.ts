/**
 * session_score built-in tool (#10).
 *
 * Allows an agent to emit a structured quality score for itself or a named session
 * into the diagnostic event pipeline. Scores feed async evaluators, OTel dashboards,
 * and cost-optimization workflows.
 *
 * The tool is lightweight: it never makes an LLM call and simply emits a
 * `session.score` diagnostic event via `emitDiagnosticEvent`.
 */

import { Type } from "@sinclair/typebox";
import { emitDiagnosticEvent } from "../../infra/diagnostic-events.js";
import { jsonResult } from "./common.js";
import type { AnyAgentTool } from "./common.js";

const SessionScoreToolSchema = Type.Object({
  score: Type.Number({
    description:
      "Normalized quality score in the range 0.0 (worst) to 1.0 (best). Be calibrated: 0.5 is mediocre, 0.8 is good, 1.0 is exceptional.",
    minimum: 0,
    maximum: 1,
  }),
  rubric: Type.String({
    description:
      'The dimension being scored. Use a concise snake_case label such as "tool_selection", "task_completion", "response_quality", or "code_correctness".',
  }),
  sessionId: Type.Optional(
    Type.String({
      description:
        "Session to score. Omit to score the current session. Use a subagent session ID to score peer/child work.",
    }),
  ),
  tags: Type.Optional(
    Type.Array(Type.String(), {
      description:
        'Classification tags for filtering and aggregation (e.g. ["correct", "efficient", "no_hallucination"]).',
    }),
  ),
  note: Type.Optional(
    Type.String({
      description: "Short free-text explanation of the score rationale (≤280 chars).",
    }),
  ),
});

export function createSessionScoreTool(params: {
  agentId?: string;
  sessionKey?: string;
  sessionId?: string;
}): AnyAgentTool {
  return {
    name: "session_score",
    label: "session_score",
    description:
      "Emit a quality score for this session or a named session into the async evaluation pipeline. " +
      "Use after completing a task to record how well it went across a specific rubric dimension. " +
      "Scores are durable (diagnostic events) and feed OTel dashboards and cost-optimization workflows.",
    parameters: SessionScoreToolSchema,
    execute: async (
      _toolCallId: string,
      p: {
        score: number;
        rubric: string;
        sessionId?: string;
        tags?: string[];
        note?: string;
      },
    ) => {
      const score = Math.max(0, Math.min(1, p.score));
      const rubric = String(p.rubric || "").trim();
      if (!rubric) {
        return jsonResult({ ok: false, error: "rubric is required" });
      }

      emitDiagnosticEvent({
        type: "session.score",
        sessionId: p.sessionId ?? params.sessionId,
        agentId: params.agentId,
        score,
        rubric,
        tags: p.tags,
        evaluatorId: params.agentId,
        data: p.note ? { note: p.note } : undefined,
      });

      return jsonResult({
        ok: true,
        score,
        rubric,
        tags: p.tags,
        sessionId: p.sessionId ?? params.sessionId,
      });
    },
  };
}

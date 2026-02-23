import { describe, expect, it } from "vitest";
import {
  checkReplaySequence,
  createDeterministicReplayClock,
  runReplayScenario,
  type DeterministicReplayStep,
} from "./runner.js";

describe("deterministic replay runner", () => {
  const baseSteps: DeterministicReplayStep[] = [
    { category: "llm", type: "llm.request", data: { model: "test" } },
    {
      category: "tool",
      type: "tool.request",
      data: { tool: "search", query: "replay" },
    },
    { category: "message", type: "message.outbound", data: { text: "done" } },
  ];

  it("produces stable fingerprints for identical deterministic runs", () => {
    const clock = createDeterministicReplayClock("2026-02-23T00:00:00.000Z", 25);
    const first = runReplayScenario({
      replayId: "run-1",
      sessionId: "session-1",
      agentId: "agent-1",
      steps: baseSteps,
      now: clock,
    });

    const second = runReplayScenario({
      replayId: "run-1",
      sessionId: "session-1",
      agentId: "agent-1",
      steps: baseSteps,
      now: createDeterministicReplayClock("2026-02-23T00:00:00.000Z", 25),
    });

    expect(first.events).toHaveLength(3);
    expect(second.events).toHaveLength(3);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.jsonl.split("\n")[0]).toContain('"seq":0');
    expect(first.fingerprint).toBe(first.manifest.eventFingerprint);
  });

  it("can validate expected event sequence constraints", () => {
    const result = runReplayScenario({
      replayId: "run-2",
      sessionId: "session-2",
      agentId: "agent-1",
      steps: baseSteps,
      now: createDeterministicReplayClock("2026-02-23T00:00:00.000Z", 1),
    });

    const check = checkReplaySequence({
      actual: result.events,
      expected: [
        { category: "llm", type: "llm.request" },
        { category: "tool", type: "tool.request" },
        { category: "message", type: "message.outbound" },
      ],
    });

    expect(check.ok).toBe(true);
    expect(check.actualLength).toBe(3);
    expect(check.expectedLength).toBe(3);
  });
});

import { describe, expect, it } from "vitest";
import type { MemClawdIngestEvent } from "../src/contracts/events.js";
import {
  runIngestionPipeline,
  DEFAULT_INGESTION_STAGES,
  type StageHandler,
} from "../src/pipeline/orchestrator.js";

function makeEvent(overrides?: Partial<MemClawdIngestEvent>): MemClawdIngestEvent {
  return {
    id: "evt-test-1",
    type: "agent.memory",
    source: "hook",
    agentId: "main",
    occurredAt: new Date().toISOString(),
    payload: { records: [{ id: "rec-1", text: "hello world" }] },
    ...overrides,
  };
}

describe("ingestion pipeline orchestrator", () => {
  it("runs all default stages in order", async () => {
    const event = makeEvent();
    const result = await runIngestionPipeline(event);
    expect(result.status).toBe("completed");
    expect(result.stages).toEqual(DEFAULT_INGESTION_STAGES);
    expect(result.runId).toBe(event.id);
    expect(result.completedAt).toBeDefined();
  });

  it("passes records through handlers in sequence", async () => {
    const callOrder: string[] = [];
    const handler: StageHandler = async (input, ctx) => {
      callOrder.push(ctx.stage);
      return input;
    };

    const result = await runIngestionPipeline(makeEvent(), {
      stages: ["normalize", "extract", "embed"],
      handlers: {
        normalize: handler,
        extract: handler,
        embed: handler,
      },
    });

    expect(result.status).toBe("completed");
    expect(callOrder).toEqual(["normalize", "extract", "embed"]);
  });

  it("handler can transform records", async () => {
    const enrichHandler: StageHandler = async (input) => {
      return input.map((r) => ({ ...r, enriched: true }));
    };

    const result = await runIngestionPipeline(makeEvent(), {
      stages: ["enrich"],
      handlers: { enrich: enrichHandler },
    });

    expect(result.status).toBe("completed");
    expect(result.stageResults).toHaveLength(1);
    expect(result.stageResults![0].ok).toBe(true);
    const output = result.stageResults![0].output;
    const first = Array.isArray(output)
      ? (output[0] as { enriched?: boolean } | undefined)
      : undefined;
    expect(first?.enriched).toBe(true);
  });

  it("stops on handler error and returns failed status", async () => {
    const failHandler: StageHandler = async () => {
      throw new Error("stage failed");
    };

    const result = await runIngestionPipeline(makeEvent(), {
      stages: ["normalize", "extract", "embed"],
      handlers: { extract: failHandler },
    });

    expect(result.status).toBe("failed");
    expect(result.errors).toHaveLength(1);
    expect(result.errors![0].message).toBe("stage failed");
    expect(result.errors![0].retryable).toBe(true);
    // Should have 2 stage results (normalize + failed extract)
    expect(result.stageResults).toHaveLength(2);
    expect(result.stageResults![0].ok).toBe(true);
    expect(result.stageResults![1].ok).toBe(false);
  });

  it("handles events with no records gracefully", async () => {
    const event = makeEvent({ payload: {} });
    const result = await runIngestionPipeline(event);
    expect(result.status).toBe("completed");
  });

  it("tracks stage duration", async () => {
    const slowHandler: StageHandler = async (input) => {
      await new Promise((r) => setTimeout(r, 10));
      return input;
    };

    const result = await runIngestionPipeline(makeEvent(), {
      stages: ["normalize"],
      handlers: { normalize: slowHandler },
    });

    expect(result.status).toBe("completed");
    expect(result.stageResults).toHaveLength(1);
    expect(result.stageResults![0].durationMs).toBeGreaterThanOrEqual(5);
  });

  it("skips stages without handlers (passthrough)", async () => {
    const result = await runIngestionPipeline(makeEvent(), {
      stages: ["normalize", "extract"],
      // No handlers provided — should passthrough
    });

    expect(result.status).toBe("completed");
    expect(result.stageResults).toHaveLength(2);
    expect(result.stageResults![0].ok).toBe(true);
    expect(result.stageResults![1].ok).toBe(true);
  });
});

import { performance } from "node:perf_hooks";
import type { MemClawdIngestEvent } from "../contracts/events.js";
import type {
  MemClawdIngestRun,
  MemClawdIngestionStage,
  MemClawdStageResult,
} from "../contracts/ingest.js";
import type { MemoryContentObject } from "../models/memory.js";

export const DEFAULT_INGESTION_STAGES: MemClawdIngestionStage[] = [
  "normalize",
  "extract",
  "classify",
  "enrich",
  "entity_extract",
  "embed",
  "graph_write",
  "vector_index",
  "audit",
];

export type StageHandlerContext = {
  event: MemClawdIngestEvent;
  runId: string;
  stage: MemClawdIngestionStage;
};

export type StageHandler = (
  input: MemoryContentObject[],
  context: StageHandlerContext,
) => Promise<MemoryContentObject[]>;

export type OrchestratorOptions = {
  stages?: MemClawdIngestionStage[];
  handlers?: Partial<Record<MemClawdIngestionStage, StageHandler>>;
};

const coerceInitialRecords = (event: MemClawdIngestEvent): MemoryContentObject[] => {
  const payload = event.payload as Record<string, unknown>;
  const records = Array.isArray(payload?.records) ? payload.records : [];
  return records.filter(
    (record): record is MemoryContentObject => !!record && typeof record === "object",
  );
};

export const runIngestionPipeline = async (
  event: MemClawdIngestEvent,
  options: OrchestratorOptions = {},
): Promise<MemClawdIngestRun> => {
  const stages = options.stages ?? DEFAULT_INGESTION_STAGES;
  const stageResults: MemClawdStageResult[] = [];
  let currentRecords = coerceInitialRecords(event);

  for (const stage of stages) {
    const handler = options.handlers?.[stage];
    const startedAt = performance.now();

    try {
      if (handler) {
        currentRecords = await handler(currentRecords, { event, runId: event.id, stage });
      }

      stageResults.push({
        stage,
        ok: true,
        durationMs: performance.now() - startedAt,
        output: currentRecords,
      });
    } catch (error) {
      stageResults.push({
        stage,
        ok: false,
        durationMs: performance.now() - startedAt,
        error: {
          code: "upstream_error",
          message: error instanceof Error ? error.message : "Unknown pipeline error",
          retryable: true,
        },
      });

      return {
        runId: event.id,
        eventId: event.id,
        status: "failed",
        stages,
        stageResults,
        errors: stageResults
          .map((result) => result.error)
          .filter((result): result is NonNullable<MemClawdStageResult["error"]> => !!result),
        startedAt: event.occurredAt,
        completedAt: new Date().toISOString(),
      };
    }
  }

  return {
    runId: event.id,
    eventId: event.id,
    status: "completed",
    stages,
    stageResults,
    startedAt: event.occurredAt,
    completedAt: new Date().toISOString(),
  };
};

# Compaction and Retry Model for CSDK

## Goal

Match existing compaction behavior and retry semantics without changing orchestration in `run.ts`.

Baseline references:
- `agent-runtime/review/codex/06-callbacks-compaction-path.md`
- `src/agents/pi-embedded-subscribe.handlers.compaction.ts`
- `src/agents/pi-embedded-runner/run.ts`

## Compaction signals to map

Use CSDK signals to trigger normalized events:
- compact boundary/system message
- pre-compact hook signal
- post-compact completion signal

Map to existing events:
- `auto_compaction_start`
- `auto_compaction_end` (`willRetry` true/false)

## Required semantics

- increment compaction count on each start.
- create/resolve compaction wait promise exactly like current subscribe layer.
- on retry (`willRetry=true`), reset assistant/tool local buffers before replay.
- run `before_compaction` and `after_compaction` hooks at equivalent lifecycle points.

## Retry ownership

Keep retry ownership in existing `run.ts` loop.

CSDK attempt must provide enough signal for orchestrator decisions:
- compaction count
- prompt error vs assistant error context
- whether timeout occurred during compaction

## Timeout interaction

Preserve current behavior:
- if timeout hits during compaction, mark `timedOutDuringCompaction`.
- snapshot selection should prefer pre-compaction snapshot when safe.

## Include

- adapter-level explicit state transitions for compaction start/end.
- a single source of truth for compaction pending/in-flight flags.
- debug logging for compaction decision traces with runId/sessionId.

## Avoid

- double compaction events for one compact cycle.
- resolving compaction wait promise too early.
- swallowing compaction timeout classification.

---
summary: "Kickoff scaffold for evaluation harness foundation and extension guide"
owner: "dgarson"
status: "in-progress"
last_updated: "2026-02-23"
title: "Evaluation Harness Kickoff"
---

# Evaluation Harness Kickoff

## Context

We need a lightweight, additive harness for running repeatable evaluation cases and writing baseline reports to disk. This kickoff establishes the core model + runner contract, then documents how future suites should plug in.

## Shipped in this kickoff

- `src/evals/types.ts`
  - evaluation case model (`EvaluationCase`)
  - runner interface (`EvaluationRunner`)
  - run report types (`EvaluationRunReport`, `EvaluationCaseRun`)
- `src/evals/runner.ts`
  - `BasicEvaluationRunner` sequential execution engine
  - standardized error-to-failed-case conversion
  - optional report write hook via `reportOutput`
- `src/evals/report.ts`
  - run id builder
  - default report path resolver: `<baseDir>/reports/evals/<runId>.json`
  - report writer utility
- `src/evals/sample-case.ts`
  - one sample smoke evaluation case
- Initial tests:
  - `src/evals/runner.test.ts`
  - `src/evals/report.test.ts`
  - `src/evals/sample-case.test.ts`

## How to extend with new evaluation suites

1. **Add a new case file** under `src/evals/` (or `src/evals/<suite>/` once suites grow).
2. Export one or more `EvaluationCase` objects with stable IDs:
   - `id`: globally unique, deterministic (example: `routing.dm-thread-reply`)
   - `suite`: logical grouping (`routing`, `memory`, `tools`, etc.)
   - `title`: human-readable case name
   - `run(context)`: returns `{ pass, summary, score?, details? }`
3. **Keep case logic hermetic** where possible:
   - deterministic inputs
   - no dependence on wall-clock randomness unless explicitly required
4. **Add tests** for new cases and runner behavior changes.
5. **Run targeted tests** before opening PR:
   - `pnpm vitest run src/evals/*.test.ts`

## Next steps (follow-up workstream)

- Add a CLI entrypoint for executing suites by id/tag.
- Add machine-readable aggregate summaries (pass-rate, per-suite breakdown).
- Support parallel case execution with bounded concurrency.
- Add optional junit/jsonl export adapters for CI ingestion.
- Define canonical eval datasets and fixtures for core product surfaces.

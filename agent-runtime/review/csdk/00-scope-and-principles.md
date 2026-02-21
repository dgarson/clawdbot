# CSDK Runtime Scope and Principles

## Objective

Add a new agent runtime `csdk` (Claude Agent SDK) with behavior parity to the current Pi runtime, while preserving all existing caller entrypoints and plugin hook contracts.

Primary target surfaces from existing baseline docs:
- `agent-runtime/review/codex/00-high-level-entrypoints-and-callbacks.md`
- `agent-runtime/review/codex/10-parity-matrix-and-risks.md`

## Hard constraints

- Keep current public runtime entrypoints unchanged:
  - `runEmbeddedPiAgent`
  - `queueEmbeddedPiMessage`
  - `abortEmbeddedPiRun`
  - `waitForEmbeddedPiRunEnd`
- Keep hook signatures and names in `src/plugins/hooks.ts` unchanged.
- Keep run control plane behavior in `src/agents/pi-embedded-runner/runs.ts` unchanged.
- Prefer runtime-selective behavior over public type churn.
- Minimize new imports across existing files by centralizing adaptation.

## Runtime design baseline

The best low-risk seam is below orchestration and above transport:
- Keep `runEmbeddedPiAgent` and the retry/fallback/compaction envelope intact.
- Add runtime dispatch where attempts are executed.
- Build a `csdk` adapter that emits existing normalized subscription events.

This mirrors the direction in:
- `agent-runtime/review/codex/01-run-embedded-pi-agent.md`
- `agent-runtime/review/codex/02-subscribe-embedded-pi-session.md`
- `agent-runtime/review/codex/09-adapter-patterns-csdk.md`

## TypeScript SDK assumptions for POC

- Use V1 `query()` for initial POC parity.
  - V2 is preview and should not be the primary parity path.
- Use streaming input mode for queue/steer parity.
- Enable partial assistant events to preserve current stream granularity.
- Map SDK compact boundary and hook signals into existing compaction lifecycle.

## Include

- Runtime dispatch at a single orchestration point.
- Adapter-level event normalization into existing handler switch:
  - `message_start`
  - `message_update`
  - `message_end`
  - `tool_execution_start`
  - `tool_execution_update`
  - `tool_execution_end`
  - `auto_compaction_start`
  - `auto_compaction_end`
  - `agent_start`
  - `agent_end`
- Queue/abort/wait semantics backed by SDK streaming input + interrupt.
- Fallback policy that defaults to Pi on pre-stream initialization failures.

## Avoid

- Renaming or replacing Pi public entrypoints.
- Changing plugin hook signatures, names, or call semantics.
- Parallel callback pipelines that bypass existing subscribe handlers.
- Introducing V2-only SDK behavior into the first parity milestone.
- Broad refactors across unrelated files.

## Success definition

- Existing Pi callers remain unchanged.
- Existing Pi tests remain green.
- New `csdk` parity tests prove callback ordering and payload equivalence at integration boundaries.
- `csdk` failures can cleanly fall back to Pi or fail with existing shaped error behavior.

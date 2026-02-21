# Adapter Pattern Notes for `csdk` Runtime Integration

## Objective

Achieve parity with Pi runtime behavior while minimizing file churn and importer changes.

## Strategy 1: Add a runtime adapter under `src/agents/`

Create a minimal transport adapter in the current agent package path that translates `csdk` provider/session events into OpenClaw callback events consumed by existing `subscribe` handlers.

### Why this keeps changes minimal

- Most callers continue importing `runEmbeddedPiAgent` without changing signatures.
- Existing handler modules remain unchanged in shape.
- Hook and control APIs stay stable.

### Suggested shape

- `src/agents/csdk-adapter.ts`
- exports:
  - `startCsdkSession`
  - `adaptCsdkEventToOpenClawCallbacks`
  - optional helpers for tool-result event normalization

## Strategy 2: Add runtime dispatch near attempt execution

In `src/agents/pi-embedded-runner/run/attempt.ts`, gate the call to `subscribe` with a runtime selector from params:

- existing: `subscribeEmbeddedPiSession(...)`
- new branch: `subscribeCsdkSession(...)` for `runtime === 'csdk'`

This minimizes file touch count to one orchestration site.

## Strategy 3: Preserve public API via lightweight facade

`src/agents/pi-embedded.ts` and `src/agents/pi-embedded-runner.ts` should remain mostly unchanged. Add runtime-aware behavior behind param values only.

## Strategy 4: Keep hook contract untouched

Do not alter hook names or signatures in `src/plugins/hooks.ts`.

Any new provider-specific data should be carried in existing context fields rather than new callback signatures.

## Strategy 5: Keep control plane unchanged

`queueEmbeddedPiMessage`, `abortEmbeddedPiRun`, `waitForEmbeddedPiRunEnd`, `isEmbeddedPiRunStreaming`, and active-run maps remain provider-agnostic.

## Required parity checks for POC

- Prompt building, hook invocation order, and tool approval flow for side-effect tools are unchanged.
- Tool execute start/update/end and tool-result emission timing is unchanged.
- Messaging tool telemetry and result fields are preserved.
- Compaction flow still triggers before/after hooks and retries correctly.
- Abort/queue/wait behavior continues to work via existing APIs.

## Minimal touch list

- `src/agents/pi-embedded-runner/run/attempt.ts` for runtime branching.
- One adapter file in `src/agents/` for csdk transport plumbing.
- Optional tiny type/shared utility additions in existing run param types if runtime discriminator is not already present.

## Non-goals for first POC

- Do not alter plugin/tool registration semantics.
- Do not alter the `hooks.ts` API.
- Do not alter existing payload formatting contracts unless parity gaps require it.

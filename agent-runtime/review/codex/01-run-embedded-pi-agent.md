# Mid-Level Document: `runEmbeddedPiAgent`

## Scope

This document covers the behavior of `runEmbeddedPiAgent` as the primary execution entry point for agent runs.

## File boundaries

- `src/agents/pi-embedded.ts` (re-export façade)
- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-embedded-runner/run/types.ts`

## Control flow

1. Resolve session/workspace/runtime configuration and compute a run-local context.
2. Select provider and model.
3. Resolve hooks and apply `before_model_resolve`.
4. Build or override the prompt and model configuration.
5. Start attempt orchestration loop.
6. On each attempt, call `runEmbeddedAttempt`.
7. On model/model-availability failures, apply fallback/retry or profile rotation.
8. On compaction errors, trigger compaction hooks and continuation strategy.
9. Aggregate attempt payloads and metadata.
10. Return `EmbeddedPiRunResult`.

## Inputs and invariants

- Required identifiers: `sessionId`, `sessionFile`, `workspaceDir`, `prompt`, `provider`, `model`, `runId`, `timeoutMs`.
- Session/thread routing controls (session key, message key, subagent flags) flow through to controls and callbacks.
- Tooling flags include messaging/tool disabling and explicit target enforcement in higher layers.

## Attempt loop semantics

- `runEmbeddedAttempt` returns a structured result with payload accumulation and termination state.
- Attempts can terminate due to success, compaction, profile/auth rotation, timeout, or explicit abort.
- The loop can be retried when compaction or transient auth/profile issues demand a re-ask.
- The orchestration enforces finalization hooks even on failure paths.

## Callback behavior at this layer

- `before_model_resolve`: runs before provider/model finalization.
- `before_agent_start`: legacy compatibility boundary before attempt orchestration.
- `before_prompt_build`: called before prompt finalization.
- `llm_input`: called with provider input envelope.
- `agent_end`: receives outcome and summary context.
- `llm_output`: receives final payload and model output metadata.
- `before_compaction` / `after_compaction`: compaction boundaries.
- `after_tool_call`: fed from tool completion events.

## State and result shaping

- Payloads are normalized into an output list to align with response stream and downstream consumers.
- `meta` includes provider/model/run diagnostics and tool lifecycle telemetry.
- Messaging tool flags are surfaced in result fields so external systems can infer whether a message tool was used.

## Error and control behavior

- Aborts are checked via run control plane and cancellation signal.
- Timeout values propagate down to provider and subscription control.
- The result contract should remain stable so existing tests, e.g., result-field assertions, remain valid.

## Suggested `csdk` integration points

- Replace only the provider/transport-specific bits in `runEmbeddedAttempt` + `subscribe` boundary.
- Keep this orchestration and hook envelope intact so all callers use the same `runEmbeddedPiAgent` contract.
- Add runtime discriminator handling in params without changing the external function signature.

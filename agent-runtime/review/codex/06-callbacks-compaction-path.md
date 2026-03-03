# Mid-Level Document: Callback Path (Compaction and Recovery)

## Scope

Compaction in OpenClaw is a recovery mechanism for overflow and model context constraints. This path must be reproduced with `csdk`.

## File boundaries

- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`
- `src/agents/pi-embedded-runner/run/payloads.ts`
- `src/agents/pi-embedded-subscribe.handlers.compaction.ts`

## Trigger conditions

- Context overflow or stream-level compaction markers.
- Provider-level compaction requests.
- Certain error/retry conditions from attempt path.

## Callback ordering

1. `before_compaction` hook before compaction request is executed.
2. Compaction starts and updates attempt prompt/working set.
3. Compaction completes and emits any compaction-related stream events.
4. `after_compaction` hook executes with compaction result metadata.
5. Run loop continues or exits based on compaction outcome.

## Result and payload shaping

- Compaction events can alter payload accumulation and final output ordering.
- Final payloads should remain consistent with stream-reasoning semantics and callback ordering.

## Suggested `csdk` adapter pattern

- Map csdk overflow/rewrite signals to the same compaction hook boundaries.
- Preserve compaction start/end callback timing to avoid regressions in tests that rely on retry behavior.

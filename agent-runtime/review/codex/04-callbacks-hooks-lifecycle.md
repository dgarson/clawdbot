# Mid-Level Document: Callback Path (Hook Lifecycle)

## Scope

Hook callbacks are execution-time policy and observability points. They are critical for parity with `pi` behavior.

## File boundaries

- `src/plugins/hooks.ts`
- `src/agents/pi-embedded-runner/run.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts`

## Hook surface used by runtime

- `before_model_resolve`
- `before_agent_start`
- `before_prompt_build`
- `llm_input`
- `agent_end`
- `llm_output`
- `before_compaction`
- `after_compaction`
- `after_tool_call`

## Execution ordering constraints

1. `before_model_resolve` must occur before provider/model is finalized.
2. `before_agent_start` should wrap the attempt startup boundary.
3. `before_prompt_build` must be executed before final prompt assembly.
4. `llm_input` executes with the final request payload.
5. For each tool result event, `after_tool_call` runs post-tool execution.
6. `before_compaction` occurs before compaction-triggered replay/re-query.
7. `after_compaction` executes after compaction reconciliation.
8. `agent_end` and `llm_output` run during finalization.

## Error behavior

- Hook failures are exceptions in the runtime path and should block or degrade according to current Pi semantics (no broad suppression in core orchestration).
- Hook output must remain stable enough to support existing plugin expectations.

## Suggested `csdk` approach

- Treat `csdk` as an alternate provider execution path but keep hook order unchanged.
- Introduce minimal shim that ensures all hook calls are made even when transport-level data differs.

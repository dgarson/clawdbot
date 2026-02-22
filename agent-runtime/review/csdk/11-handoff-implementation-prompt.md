# Handoff Prompt for a New Implementation Session

Use the following prompt as-is in a new coding session.

```text
You are implementing `csdk` runtime support in OpenClaw with parity to existing Pi behavior.

Workspace:
- /Users/openclaw/openclaw

Read these docs first:
- /Users/openclaw/openclaw/agent-runtime/review/codex/00-high-level-entrypoints-and-callbacks.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/01-run-embedded-pi-agent.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/02-subscribe-embedded-pi-session.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/03-run-control-plane.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/04-callbacks-hooks-lifecycle.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/05-callbacks-tool-and-approval.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/06-callbacks-compaction-path.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/07-callbacks-streaming-output.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/08-callbacks-errors-and-payloads.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/09-adapter-patterns-csdk.md
- /Users/openclaw/openclaw/agent-runtime/review/codex/10-parity-matrix-and-risks.md

Then use this SDK-specific set as implementation source of truth:
- /Users/openclaw/openclaw/agent-runtime/review/csdk/README.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/00-scope-and-principles.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/01-runtime-dispatch-and-compatibility.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/02-typescript-sdk-mode-selection.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/03-event-normalization-contract.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/04-callback-parity-and-ordering.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/05-tools-approvals-and-hooks.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/06-compaction-and-retry-model.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/07-control-plane-queue-abort-wait.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/08-error-and-payload-shaping.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/09-test-strategy-and-acceptance.md
- /Users/openclaw/openclaw/agent-runtime/review/csdk/10-phased-implementation-plan.md

External SDK references to follow:
- https://platform.claude.com/docs/en/agent-sdk/typescript
- https://platform.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- https://platform.claude.com/docs/en/agent-sdk/streaming-output
- https://platform.claude.com/docs/en/agent-sdk/permissions
- https://platform.claude.com/docs/en/agent-sdk/user-input
- https://platform.claude.com/docs/en/agent-sdk/hooks
- https://platform.claude.com/docs/en/agent-sdk/stop-reasons
- https://platform.claude.com/docs/en/agent-sdk/typescript-v2-preview

Implementation objectives:
1. Add runtime dispatch at the attempt call site in `src/agents/pi-embedded-runner/run.ts`.
2. Keep Pi as default runtime and preserve all existing caller contracts.
3. Implement `src/agents/pi-embedded-runner/run/attempt-csdk.ts` returning `EmbeddedRunAttemptResult`.
4. Implement `src/agents/csdk-adapter.ts` to normalize SDK events into existing subscribe handler event types.
5. Preserve hook signatures and behavior in `src/plugins/hooks.ts`.
6. Preserve run control plane semantics in `src/agents/pi-embedded-runner/runs.ts`.
7. Preserve tool approval semantics and messaging telemetry fields.
8. Preserve compaction callbacks and retry behavior.
9. Preserve error and payload shaping semantics.
10. Add focused tests for adapter ordering + integration parity.

Constraints:
- Minimal file churn.
- No unrelated refactors.
- Prefer reuse of existing handlers over new parallel callback pipelines.
- Avoid SDK V2 for initial parity path.

Expected deliverables in this session:
- Code changes implementing the runtime branch and CSDK attempt path.
- New adapter and tests.
- Test run output summary for targeted suites.
- Short risk list for remaining parity gaps.

If any hook/tool/compaction semantic cannot be matched exactly, stop and report the specific mismatch with file/line references and proposed fallback behavior before proceeding.
```

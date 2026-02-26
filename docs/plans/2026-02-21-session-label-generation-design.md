# Design: LLM-Generated Session Labels

**Date:** 2026-02-21
**Branch:** `ux-llm-generated-session-labels`
**Status:** Approved

## Problem

Most sessions in the session list have no label or description. While users can manually set labels, the majority remain unlabeled, making it hard to identify sessions at a glance. The overhead of generating a label automatically has been acceptable to skip by default, but it should be opt-in for those who want it.

## Goal

After the first user message of a new session, if enabled, asynchronously ask an LLM for a short (sub-80 character) display name and store it as the session's `label`. The label should be visible long before a potentially long agent run finishes.

## Non-Goals

- No per-agent overrides (global `agents.defaults` only)
- No retroactive labeling of existing sessions
- No auto-refresh/regeneration once a label is set
- Not enabled by default

## Config

New field under `agents.defaults`:

```yaml
agents:
  defaults:
    sessionLabels:
      enabled: true # opt-in; default false
      model: "anthropic/claude-haiku-4-5" # optional; defaults to agent's configured model
      maxLength: 79 # optional; default 79
      prompt: "..." # optional; override the label generation prompt
```

The `model` field uses the same `provider/model` string format used elsewhere in the config. When omitted, the agent's configured primary model is used via the existing `resolveDefaultModelForAgent` path, ensuring provider-agnostic behavior.

## Architecture

### Trigger: Early `"input"` agent event

The earliest point in the processing pipeline where both the user message (`prompt`) and the `sessionKey` are simultaneously available is in `src/agents/pi-embedded-runner/run.ts`, right after `hookCtx` is constructed (around line 227), before any `before_model_resolve` or `before_agent_start` plugin hooks fire.

A minimal addition (~4 lines) emits a new `"input"` stream event on the existing `AgentEventPayload` bus:

```ts
emitAgentEvent({
  runId: params.runId,
  stream: "input",
  data: { prompt: params.prompt },
  sessionKey: params.sessionKey,
});
```

This event is already structured (it carries `runId`, `sessionKey`, `stream`, `ts`, `data`) and is consumed by subscribing via the existing `onAgentEvent` function. The change is non-breaking: no existing subscriber is affected.

### Service: `src/sessions/session-auto-label.ts`

A standalone module registered at gateway startup. Subscribes to `onAgentEvent` and handles `stream === "input"` events:

1. Check `agents.defaults.sessionLabels.enabled` — skip if not enabled
2. Check session key — skip cron runs (`isCronRunSessionKey`) and subagent sessions (`isSubagentSessionKey`)
3. Check in-flight set — skip if label generation is already running for this session key (race guard)
4. Load session entry — skip if `label` is already set (idempotency guard)
5. Skip if prompt is empty (e.g. media-only message)
6. Fire async LLM call (non-blocking; agent run continues unblocked)
7. On success: write label via `updateSessionStoreEntry`
8. On failure: log and clear in-flight entry (will retry on next message since label stays unset)

### LLM Call

Uses `complete()` from `@mariozechner/pi-ai` — the same lightweight single-turn API used by `image-tool.ts`. No session transcript is involved; this is a single-turn stateless call.

- **Model:** `resolveDefaultModelForAgent` + optional `sessionLabels.model` override
- **Auth:** `getApiKeyForModel` (provider-agnostic)
- **Max tokens:** 50 (short labels need very few tokens)
- **Prompt input:** first message truncated to 500 chars
- **Default system prompt:** `"Generate a concise title (max N characters) for the conversation below. Reply with ONLY the title text, no quotes, no punctuation at the end."`
- **Output:** trimmed, truncated to `maxLength`, validated non-empty

### Timing

For a fast provider (e.g. Haiku, Gemini Flash), label generation completes in 1–3 seconds. For a typical 5–30 minute agent run, the label is available for the vast majority of the session lifetime.

### Idempotency & Race Conditions

- In-memory `Set<string>` of in-flight session keys prevents concurrent duplicate calls for the same session
- Once `label` is written to the session store, future `input` events for the session are no-ops
- If generation fails: `label` stays unset; generation is retried on the next message (desirable for transient errors)

## Files Changed

| File                                      | Nature          | Description                                                         |
| ----------------------------------------- | --------------- | ------------------------------------------------------------------- |
| `src/config/types.agent-defaults.ts`      | schema          | Add `sessionLabels?: SessionLabelsConfig` to `AgentDefaultsConfig`  |
| `src/config/zod-schema.agent-defaults.ts` | schema          | Add `sessionLabels` Zod object schema to `AgentDefaultsSchema`      |
| `src/config/schema.labels.ts`             | labels          | Add UI field label entries for `agents.defaults.sessionLabels.*`    |
| `src/sessions/session-label.ts`           | schema-adjacent | Raise `SESSION_LABEL_MAX_LENGTH` from 64 to 79                      |
| `src/agents/pi-embedded-runner/run.ts`    | core (minimal)  | Emit `"input"` agent event early in `runEmbeddedPiAgent` (~4 lines) |
| `src/sessions/session-auto-label.ts`      | **new file**    | Auto-label service: event subscriber + async LLM call + store write |
| `src/gateway/server-startup.ts`           | core (minimal)  | Call `registerSessionAutoLabel()` at startup (~2 lines)             |

## Skipped Cases

Label generation is skipped when:

- `sessionLabels.enabled` is not `true`
- Session already has a `label` value
- Session key is a cron run (`isCronRunSessionKey`)
- Session key is a subagent session (`isSubagentSessionKey`)
- In-flight generation already running for this session key
- Prompt is empty after trimming

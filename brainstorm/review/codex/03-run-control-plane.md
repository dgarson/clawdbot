# Mid-Level Document: Run Control Plane (Streaming, Queue, Abort, Wait)

## Scope

This document covers the control surface used by `runEmbeddedPiAgent` and all callers that need run lifecycle external control.

## File boundaries

- `src/agents/pi-embedded-runner/runs.ts`
- `src/agents/pi-embedded-runner/run/attempt.ts` (integration points)
- `src/gateway/server-methods/sessions.ts`
- `src/auto-reply/reply/commands-*.ts`
- `src/commands/agent.ts` (CLI abort paths)

## Core state

- Run sessions are keyed by `sessionId`.
- Active run maps hold subscription handles, stream queues, and abort signal state.
- The control plane is separate from transport logic so multiple callers can enqueue/abort without reaching into subscription internals.

## API behavior

- `setActiveEmbeddedRun(sessionId, queueHandle, sessionKey)` registers active streaming handle.
- `queueEmbeddedPiMessage(sessionId, text)` enqueues text into an active run queue.
- `isEmbeddedPiRunStreaming(sessionId)` returns stream-active boolean.
- `abortEmbeddedPiRun(sessionId)` sends abort to active run and returns whether there was an active target.
- `waitForEmbeddedPiRunEnd(sessionId, timeoutMs)` waits for termination with bounded timeout.
- `clearActiveEmbeddedRun(sessionId, queueHandle, sessionKey)` removes handle.

## External integration touchpoints

- Gateway session termination endpoints call abort and wait.
- CLI and auto-reply command paths call queue/abort based on runtime control state.
- Subagent tools and followups reuse this control plane for child session steering.

## Callback and error propagation

- Abort signals are expected to map to stream completion or error path handled upstream.
- Waiters must tolerate timeout to avoid hanging control requests.
- Queue attempts on inactive session return false and do not mutate state.

## Suggested `csdk` integration points

- Reuse this control plane unchanged.
- Ensure the `csdk` runner populates the same active-handle and queue semantics that `runEmbeddedAttempt` expects.
- Add no new control API entry points unless another caller requires them.

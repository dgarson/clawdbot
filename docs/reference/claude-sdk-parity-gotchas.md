---
summary: "Maintainer checklist and gotchas for Claude SDK parity behavior in OpenClaw"
read_when:
  - You are reviewing Claude SDK runner changes
  - You are debugging tool call pairing, steer, or compaction behavior
title: "Claude SDK Parity Gotchas"
---

# Claude SDK Parity Gotchas

This page is for maintainers and reviewers.

For the architecture first view, see [Claude SDK Runtime](/concepts/claude-sdk-runtime).

## Hard invariants

1. Tool pairing is ID only from SDK `tool_use` messages.
2. Do not use handler `extra` fields for tool ID resolution.
3. Every tool execution emits start and end events, including failure paths.
4. Tool failures still persist `toolResult` entries (`isError: true`) to transcript and runtime mirror.
5. Runtime mirror must include user, assistant, and toolResult entries.

## Known intentional non parity

1. Pre compaction callback is synthetic because SDK exposes only `compact_boundary`.
2. Steering is queued to next turn, not mid turn interruption and resume.

## Easy regression patterns

1. Reintroducing by name fallback for tool pairing.
2. Throwing on missing tool ID without emitting external lifecycle events.
3. Clearing tool correlation state before all turn events are translated and persisted.
4. Hardcoding assistant metadata to Anthropic when provider is non Anthropic.

## Reviewer quick checks

1. `mcp-tool-server.ts` consumes queued `tool_use` IDs and has a structured missing ID error path.
2. `event-adapter.ts` remembers tool uses and emits progress/summary updates with stable IDs.
3. `create-session.ts` clears turn local tool correlation state only after the prompt loop.
4. `create-session.ts` steer path only queues `pendingSteer`; no mid turn interrupt loop.

## Tests that should move with behavior

- `src/agents/claude-sdk-runner/__tests__/event-contract.test.ts`
- `src/agents/claude-sdk-runner/__tests__/mcp-tool-server.test.ts`
- `src/agents/claude-sdk-runner/__tests__/session-lifecycle.test.ts`
- `src/plugins/wired-hooks-compaction.test.ts`

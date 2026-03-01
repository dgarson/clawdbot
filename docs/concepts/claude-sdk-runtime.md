---
summary: "How the Claude Agent SDK runtime works in OpenClaw, including parity mapping and intentional differences from Pi"
read_when:
  - You are changing src/agents/claude-sdk-runner/*
  - You need to compare Pi and Claude runtime behavior
  - You are debugging tool lifecycle pairing or compaction events
title: "Claude SDK Runtime"
---

# Claude SDK Runtime

This page is the high level map for the Claude Agent SDK runtime in OpenClaw.

If you want implementation details and reviewer checklists, see
[Claude SDK parity gotchas](/reference/claude-sdk-parity-gotchas).

## Quick model

1. OpenClaw keeps a local runtime mirror (`messages`) for hooks, snapshots, and UX.
2. Claude SDK server side session state is still authoritative for model context.
3. Tool lifecycle events come from the MCP bridge (`mcp-tool-server.ts`), not from assistant content translation.

## Turn flow

1. `prompt()` appends a user message to runtime mirror and session transcript.
2. `query()` streams SDK messages.
3. `event-adapter` translates assistant/system/result messages into Pi style events.
4. Assistant `tool_use` blocks are queued by ID for deterministic pairing.
5. MCP tool execution consumes queued tool_use IDs and emits start/update/end events.
6. Tool results are appended to runtime mirror and persisted to transcript.

## Runtime selection and failover

OpenClaw can run a turn in either Claude SDK runtime or Pi runtime.

> Important policy disclaimer (Anthropic): Anthropic still PROHIBITS using Claude subscription credentials with the Agent SDK except for personal, non-business experimentation and learning (including exploring and developing multi-agent systems for learning purposes). Full-time autonomous use, or any business/revenue-generating use, is strictly prohibited. If your usage goes beyond that narrow personal-learning scope, switch to Anthropic API billing (API key) before continuing.

- Runtime selection rules:
  - `claude-pro` / `claude-max` with a `claude-*` model ID use Claude SDK runtime.
  - Non-`claude-*` model IDs use Pi runtime (even if provider is `claude-pro` / `claude-max`).
  - `agents.defaults.claudeSdk.supportedProviders` can add non-keychain provider IDs (for example `zai`, `minimax`) as Claude SDK candidates.
- Within Claude SDK runtime, OpenClaw rotates auth profiles first, then Claude SDK provider candidates.
- If all Claude SDK candidates are unavailable or cooling down, OpenClaw automatically falls back to Pi runtime for the same turn.
- For `claude-pro` / `claude-max`, OpenClaw registers a synthetic auth profile
  (`<provider>:system-keychain`) so cooldown tracking can survive session boundaries.
- If system-keychain auth resolution fails before the attempt starts, OpenClaw
  immediately retries the same turn on Pi runtime.
- If auth/profile failover is exhausted after retries, OpenClaw follows the
  normal model fallback path.
- If a stored Claude SDK resume session ID is stale/invalid, OpenClaw clears it
  and retries once with a fresh Claude SDK session before surfacing an error.
- Claude overflow retries are gated by compaction evidence. If no compaction
  signal is observed, OpenClaw fails fast with a context-overflow remediation
  message instead of burning repeated retries.

This keeps session continuity while preserving the broader Pi failover path.

Example:

```json5
{
  agents: {
    defaults: {
      claudeSdk: {
        provider: "zai",
        supportedProviders: ["claude-pro", "zai", "minimax"],
      },
      model: {
        primary: "claude-pro/claude-sonnet-4-5",
        fallbacks: ["zai/GLM-4.7", "minimax/MiniMax-M2.5"],
      },
    },
  },
}
```

## Parity map

| Area                   | Behavior                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| History mirror         | Includes user, assistant, and toolResult messages in runtime mirror                           |
| Tool pairing           | ID only from SDK `tool_use`; no by name fallback                                              |
| Missing tool ID        | Structured pairing failure + start/end + error toolResult                                     |
| System prompt override | `setSystemPrompt` is supported at runtime                                                     |
| Steering               | Next turn only; no mid turn interruption                                                      |
| Compaction             | SDK `compact_boundary` mapped to synthetic `auto_compaction_start` then `auto_compaction_end` |
| Hook history snapshot  | Claude turns build a sanitized/limited local history snapshot for hook context parity         |
| Metadata               | Assistant/session messages include provider, api, model, stopReason, errorMessage             |

## Intentional differences from Pi

- No true SDK pre compaction callback exists. OpenClaw synthesizes start/end at the same boundary.
- Steer injection is next turn only to avoid partial transcript fragmentation risk from interrupt and resume loops.

## Maintainer checklist

Hard invariants:

1. Tool pairing is ID-only from SDK `tool_use` messages.
2. Do not use handler `extra` fields for tool ID resolution.
3. Every tool execution emits start and end events, including failure paths.
4. Tool failures still persist `toolResult` entries (`isError: true`) to transcript and runtime mirror.
5. Runtime mirror must include user, assistant, and `toolResult` entries.

Regression patterns to watch:

1. Reintroducing by-name fallback for tool pairing.
2. Throwing on missing tool ID without emitting external lifecycle events.
3. Clearing tool correlation state before all turn events are translated and persisted.
4. Hardcoding assistant metadata to Anthropic when provider is non-Anthropic.

Quick code checks:

1. `mcp-tool-server.ts` consumes queued `tool_use` IDs and has a structured missing-ID error path.
2. `event-adapter.ts` remembers tool uses and emits progress/summary updates with stable IDs.
3. `create-session.ts` clears turn-local tool correlation state only after the prompt loop.
4. `create-session.ts` steer path only queues `pendingSteer` (no mid-turn interrupt loop).

Tests that should move with behavior:

- `src/agents/claude-sdk-runner/event-adapter.test.ts`
- `src/agents/claude-sdk-runner/mcp-tool-server.test.ts`
- `src/agents/claude-sdk-runner/create-session.test.ts`
- `src/agents/claude-sdk-runner/prepare-session.test.ts`
- `src/agents/pi-embedded-runner/claude-sdk-runtime-failover.test.ts`
- `src/plugins/wired-hooks-compaction.test.ts`

## Related docs

- [Agent Runtime](/concepts/agent)
- [Agent Loop](/concepts/agent-loop)
- [Session Management Deep Dive](/reference/session-management-compaction)
- [Claude SDK parity gotchas](/reference/claude-sdk-parity-gotchas)

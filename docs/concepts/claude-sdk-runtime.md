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

## Parity map

| Area                   | Behavior                                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------- |
| History mirror         | Includes user, assistant, and toolResult messages in runtime mirror                           |
| Tool pairing           | ID only from SDK `tool_use`; no by name fallback                                              |
| Missing tool ID        | Structured pairing failure + start/end + error toolResult                                     |
| System prompt override | `setSystemPrompt` is supported at runtime                                                     |
| Steering               | Next turn only; no mid turn interruption                                                      |
| Compaction             | SDK `compact_boundary` mapped to synthetic `auto_compaction_start` then `auto_compaction_end` |
| Metadata               | Assistant/session messages include provider, api, model, stopReason, errorMessage             |

## Intentional differences from Pi

- No true SDK pre compaction callback exists. OpenClaw synthesizes start/end at the same boundary.
- Steer injection is next turn only to avoid partial transcript fragmentation risk from interrupt and resume loops.

## Related docs

- [Agent Runtime](/concepts/agent)
- [Agent Loop](/concepts/agent-loop)
- [Session Management Deep Dive](/reference/session-management-compaction)
- [Claude SDK parity gotchas](/reference/claude-sdk-parity-gotchas)

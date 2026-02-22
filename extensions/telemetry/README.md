# @openclaw/telemetry — Phase 1

Structured telemetry event capture for OpenClaw agent sessions, model usage, and cost attribution.

## What It Does

Captures four event types via the OpenClaw plugin hook system:

| Event           | Hook                              | What it captures                              |
| --------------- | --------------------------------- | --------------------------------------------- |
| `session_start` | `session_start` lifecycle hook    | Agent session begins                          |
| `session_end`   | `session_end` lifecycle hook      | Session duration, message count               |
| `agent_end`     | `agent_end` lifecycle hook        | Success/failure, duration, error messages     |
| `model_usage`   | `onDiagnosticEvent` (model.usage) | Token counts, model, provider, estimated cost |

Events are written as JSONL (one JSON object per line) to a configurable sink.

## Configuration

Add to your OpenClaw config under `diagnostics`:

```yaml
diagnostics:
  enabled: true
  telemetry:
    enabled: true # default: true (when diagnostics.enabled)
    file: ~/.openclaw/telemetry/events.jsonl # default path
    stdout: false # also print to stdout (default: false)
```

## Event Schema

Each event is a JSON object with the following structure:

```json
{
  "eventId": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-02-21T20:30:00.000Z",
  "agentId": "xavier",
  "sessionKey": "agent:xavier:cron:abc123",
  "sessionKind": "cron",
  "eventType": "model_usage",
  "model": "anthropic/claude-sonnet-4-6",
  "provider": "anthropic",
  "inputTokens": 1500,
  "outputTokens": 300,
  "cacheReadTokens": 800,
  "totalTokens": 2600,
  "estimatedCostUsd": 0.012,
  "durationMs": 3200
}
```

## File Structure

```
extensions/telemetry/
├── index.ts                # Plugin entry: registers the telemetry service
├── openclaw.plugin.json    # Plugin manifest
├── package.json
├── README.md
└── src/
    ├── types.ts            # TypeScript interfaces for events and config
    ├── sink.ts             # JSONL file/stdout writer
    └── hooks.ts            # Hook registrations (session, agent, model.usage)
```

## Phase 2 (Planned)

- SQLite storage with indexed queries
- CLI commands: `openclaw telemetry costs`, `openclaw telemetry errors`
- Agent-facing `telemetry_query` tool
- Cost estimation with pricing table
- Retention/cleanup

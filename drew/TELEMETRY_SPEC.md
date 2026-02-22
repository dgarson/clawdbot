# Agent Telemetry & Cost Attribution — MVP Spec

*Author: Merlin (on behalf of Drew, CDO)*
*Created: 2026-02-21*
*Status: DRAFT — awaiting review*

---

## 1. Problem Statement

OpenClaw runs 26 agents across 33+ cron jobs and ad-hoc subagent sessions. We have **zero observability** into:
- Which agents are consuming the most tokens/cost
- Success vs failure rates per agent/task type
- Latency distributions across model families
- Anomalous behavior (stalls, silent failures, excessive token use)

This is unsustainable as the fleet scales. We need a telemetry foundation before adding more agents or workloads.

## 2. Goals (MVP)

1. **Event capture**: Every agent session emits structured telemetry events
2. **Cost attribution**: Token usage and estimated cost per agent, per session, per model
3. **Success/failure tracking**: Did the task complete? Did it produce expected output?
4. **Dashboard-ready data**: Queryable from CLI or simple web UI
5. **Minimal overhead**: Must not add latency to agent workflows

## 3. Non-Goals (MVP)

- Real-time streaming dashboards (post-MVP)
- Distributed tracing across subagent chains (post-MVP)
- Automated alerting/paging (post-MVP)
- Model performance benchmarking (separate workstream: Model-Task Matrix)

## 4. Architecture

### 4.1 Event Schema

```typescript
interface TelemetryEvent {
  // Identity
  eventId: string;          // UUID
  timestamp: string;        // ISO 8601
  
  // Source
  agentId: string;          // e.g., "main", "tim", "xavier"
  sessionKey: string;       // Full session key
  sessionKind: "direct" | "cron" | "subagent" | "heartbeat";
  parentSessionKey?: string; // If subagent, who spawned it
  
  // Model
  model: string;            // e.g., "anthropic/claude-opus-4-6"
  provider: string;         // e.g., "anthropic", "openai", "minimax"
  
  // Usage
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  estimatedCostUsd?: number; // Based on known pricing
  
  // Outcome
  status: "success" | "error" | "timeout" | "aborted";
  durationMs: number;
  toolCallCount: number;
  errorMessage?: string;
  
  // Context
  taskLabel?: string;       // Human-readable task description
  cronJobId?: string;       // If from a cron trigger
  channel?: string;         // slack, discord, etc.
}
```

### 4.2 Storage

**Implementation: OpenClaw Extension (like workq)**

- SQLite database at `~/.openclaw/telemetry/telemetry.db` (WAL mode)
- Single `events` table matching the schema above
- Indexed on: `agentId`, `timestamp`, `sessionKind`, `status`, `model`
- Retention: 30 days by default (configurable)
- Automatic vacuum on startup

### 4.3 Event Emission

**Option A (Preferred): Gateway Hook**

Register a `afterSessionComplete` hook in the plugin system that fires when any session ends. The hook receives the session metadata and writes a telemetry event. Zero agent-side changes required.

```typescript
api.registerHook("afterSessionComplete", async (session) => {
  await db.insertEvent({
    agentId: session.agentId,
    sessionKey: session.key,
    model: session.model,
    inputTokens: session.usage.input,
    outputTokens: session.usage.output,
    // ... map remaining fields
  });
});
```

**Option B (Fallback): Agent-side tool**

Provide a `telemetry_emit` tool that agents call at task completion. Less reliable (agents might forget/skip), but works without gateway changes.

### 4.4 Querying

**CLI Commands:**

```bash
# Cost summary by agent (last 24h)
openclaw telemetry costs --period 24h

# Agent     | Sessions | Tokens    | Est. Cost | Errors
# ----------|----------|-----------|-----------|-------
# main      | 47       | 2.1M      | $12.30    | 2
# tim       | 12       | 890K      | $5.20     | 0
# xavier    | 8        | 450K      | $2.80     | 1

# Error rate by cron job
openclaw telemetry errors --group cron

# Detailed session log
openclaw telemetry sessions --agent tim --status error --limit 10
```

**Agent Tool (read-only):**

```
telemetry_query: Query telemetry data
  - filter: { agentId?, model?, status?, since?, until? }
  - groupBy: "agent" | "model" | "cronJob" | "hour"
  - metric: "cost" | "tokens" | "sessions" | "errors" | "duration"
```

## 5. Cost Estimation

Maintain a pricing table (JSON config, user-editable):

```json
{
  "anthropic/claude-opus-4-6": { "input": 15.0, "output": 75.0, "cacheRead": 1.5 },
  "anthropic/claude-sonnet-4-6": { "input": 3.0, "output": 15.0, "cacheRead": 0.3 },
  "openai/gpt-5.1-codex-mini": { "input": 1.5, "output": 6.0 },
  "minimax-portal/MiniMax-M2.5": { "input": 0.5, "output": 1.5 },
  "glm/GLM-5": { "input": 0.3, "output": 0.9 }
}
```

Prices in USD per 1M tokens. Updated manually or via periodic web scrape.

## 6. Extension Structure

```
~/.openclaw/extensions/telemetry/
├── openclaw.plugin.json    # Plugin manifest
├── package.json
├── index.ts                # Plugin entry: register hooks + CLI + tools
├── src/
│   ├── database.ts         # SQLite schema, migrations, queries
│   ├── pricing.ts          # Cost estimation logic
│   ├── hooks.ts            # Gateway hooks for event capture
│   ├── tools.ts            # Agent-facing query tools
│   ├── cli.ts              # CLI commands (costs, errors, sessions)
│   └── types.ts            # TypeScript interfaces
└── pricing.json            # Default pricing table
```

## 7. Implementation Plan

### Phase 1: Foundation (2-3 hours)
- [ ] Create extension scaffold (mirror workq pattern)
- [ ] SQLite schema + migrations
- [ ] Event insertion logic
- [ ] Basic `afterSessionComplete` hook

### Phase 2: Querying (2-3 hours)
- [ ] CLI commands: `costs`, `errors`, `sessions`
- [ ] Agent tool: `telemetry_query`
- [ ] Cost estimation with pricing table

### Phase 3: Polish (1-2 hours)
- [ ] Retention/cleanup job
- [ ] Tests (follow workq's vitest pattern)
- [ ] README + integration docs

### Phase 4: Validation (ongoing)
- [ ] Run for 48h, verify data accuracy
- [ ] Compare estimated costs to actual billing
- [ ] Identify top cost drivers and optimization targets

## 8. Success Criteria

- [ ] Every session (direct, cron, subagent, heartbeat) emits a telemetry event
- [ ] `openclaw telemetry costs` shows per-agent breakdown
- [ ] Error sessions are flagged with error messages
- [ ] Cost estimates are within 20% of actual billing
- [ ] Zero impact on agent response latency

## 9. Open Questions

1. **Hook availability**: Does the gateway plugin API expose `afterSessionComplete` or equivalent? Need to check `~/openclaw/src/plugins/hooks.ts` for available hook points.
2. **Subagent attribution**: Should subagent costs roll up to the parent agent or stay separate? Recommend: separate events with `parentSessionKey` for rollup queries.
3. **Pricing updates**: Manual vs automated? Start manual, add web scraping later.
4. **Privacy**: Telemetry stays local (SQLite on disk). No external transmission. User content is NOT captured — only metadata.

---

*This spec was written after 4 previous subagent attempts failed silently. The architecture mirrors the workq extension pattern which has proven to work (jiti loads TS directly, no build step needed).*

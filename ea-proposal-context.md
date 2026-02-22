# Executive Assistant Agent — Full Proposal Context

## Problem Statement

We want an "Executive Assistant" (EA) agent pattern — a cheap, fast-cycling agent that handles heartbeats, inbox events, and system notifications as a triage layer for an expensive "Exec/Lead" agent. The EA decides what's urgent (immediately spawn the Exec) vs. what can be aggregated for periodic batch delivery.

## Architecture Overview

### Runtime Flow

```
Heartbeat Timer / Cron / System Event
              │
              ▼
  EA Agent (cheap model, fast cron)
  - Reads HEARTBEAT.md, inbox, events
  - Checks EA_LOG.jsonl for context
  - Decides: urgent / aggregate / skip
       │              │
  [urgent]       [aggregate]
       │              │
       ▼              ▼
  Spawn Exec     Append to EA_LOG.jsonl
  as subagent    Batch-deliver on slower schedule
```

### Key Requirements

1. EA runs on fast cron (e.g., every 5m), cheap model (Sonnet 4.6 or lower)
2. Exec/Lead gets the exact event+data the EA received, but only when worth surfacing
3. EA keeps detailed log (EA_LOG.jsonl) of everything received
4. Must NOT spawn duplicate Exec agents if one is already running
5. Urgent items spawn immediately; non-urgent aggregated for periodic digest
6. Budget-aware model downgrading based on weekly usage limits and daily cost targets
7. Never downgrade Tim or Luis; Amadeus never below Sonnet 4.6

## New Code Packages (Adjacent, Minimizing Merge Conflicts)

### Package 1: `src/agents/executive-assistant/` (~4 files)
- `ea-config.ts` — Type definitions for EA config
- `ea-runner.ts` — Core triage logic (receives event, evaluates urgency, decides spawn-or-log)
- `ea-log.ts` — Read/write EA_LOG.jsonl in EA workspace
- `ea-digest.ts` — Builds aggregated digest payload

### Package 2: `src/infra/budget-governor/` (~3 files)
- `budget-config.ts` — Types for budget config, per-agent floor models
- `budget-governor.ts` — Checks provider usage, calculates remaining budget, recommends downgrades
- `budget-schedule.ts` — Time-based pacing calculations (budget per remaining hours until reset)

### Config Shape (agents.list[])
```yaml
agents:
  list:
    - id: amadeus-ea
      model: anthropic/claude-sonnet-4-6
      heartbeat:
        every: 5m
      executiveAssistant:
        enabled: true
        execAgent: amadeus
        urgentSpawnImmediate: true
        digestEvery: 4h
        skipDuplicateExecSpawn: true
```

### Budget Config Shape
```yaml
agents:
  defaults:
    budget:
      enabled: true
      weeklyLimitPercent: 85
      dailyTargetCost: 25.00
      checkInterval: 30m
      downgradeRules:
        - from: "anthropic/claude-opus-4-6"
          to: "anthropic/claude-sonnet-4-6"
          threshold: 85
      protectedAgents: [tim, luis]
      agentFloors:
        amadeus: "anthropic/claude-sonnet-4-6"
```

## Upstream Files Requiring >3 Line Changes

| File | What Changes | Lines Est. |
|------|-------------|-----------|
| `src/config/types.agent-defaults.ts` | Add `executiveAssistant?` and `budget?` type fields | ~20 |
| `src/config/zod-schema.agent-runtime.ts` | Add Zod schemas for EA and budget configs | ~40 |
| `src/infra/heartbeat-runner.ts` | EA interception in `runHeartbeatOnce()` | ~25 |
| `src/cron/isolated-agent/run.ts` | EA interception for cron-triggered turns | ~15 |
| `src/agents/subagent-spawn.ts` | `skipDuplicateExecSpawn` guard | ~15 |
| `src/agents/model-selection.ts` | Add `resolveBudgetAwareModel()` | ~20 |
| `src/infra/provider-usage.load.ts` | Export lightweight `getQuickUsageSnapshot()` | ~10 |

## Existing Infrastructure We'd Leverage

- `loadProviderUsageSummary()` — real-time usage from Anthropic/xAI APIs
- `ProviderUsageSnapshot.windows[]` — has `usedPercent` and `resetAt`
- `loadCostUsageSummary()` — local token/cost tracking with daily breakdowns
- `fetchClaudeUsage()` — returns `five_hour.utilization`, `seven_day.utilization`, `resets_at`
- `countActiveRunsForSession()` / `countActiveDescendantRuns()` — active subagent tracking
- `registerSubagentRun()` — subagent lifecycle management
- `runWithModelFallback()` — existing model fallback chain (integration point for budget governor)

## Parallel Subagent Safety

- Current defaults: `maxChildrenPerAgent: 5`, `maxConcurrent: 1` (subagent lane), `maxSpawnDepth: 2`
- Anthropic rate limits (tier-dependent): 60+ RPM, weekly utilization windows
- Recommendation: 2-3 concurrent Opus-class runs max for cost safety
- `skipDuplicateExecSpawn` prevents pileup (check if exec agent already has active run)

## Complexity Estimate

| Component | Effort | Risk |
|-----------|--------|------|
| EA config & runner | 2-3 days | Low |
| EA log & digest | 1 day | Low |
| Heartbeat/cron interception | 1-2 days | Medium |
| Skip-duplicate guard | 0.5 day | Low |
| Budget governor core | 2-3 days | Medium |
| Budget-aware model selection | 1 day | Medium |
| Config schemas | 1 day | Low |
| **Total** | **~8-12 days** | **Medium** |

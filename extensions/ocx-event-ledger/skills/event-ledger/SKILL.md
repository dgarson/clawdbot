# Event Ledger Skill

Use this skill when querying canonical run/session events, retention tiers, and incident timelines.

---

## Query Pattern

1. Start with a run-level summary to get the high-level outcome.
2. Filter by family and/or type to narrow to relevant event categories.
3. Apply time range bounds when the run summary gives you a known window.
4. Correlate using lineage/session identifiers to join subagent chains.
5. Export a minimal evidence bundle for incident review.

---

## Canonical Query Patterns

**Query by runId (most common — start here):**

```
event_ledger.query({ runId: "<runId>", limit: 100 })
```

Returns all events for a single agent run. Add `family` to narrow scope.

**Query by family within a run:**

```
event_ledger.query({ runId: "<runId>", family: "tool", limit: 50 })
```

Use when investigating a specific domain (e.g., all tool calls, all budget decisions).

**Query by agentId across runs:**

```
event_ledger.query({ agentId: "<agentId>", family: "session", limit: 100 })
```

Use when the symptom is agent-level and spans multiple runs (e.g., recurring errors, session overflow).

**Query by sessionKey (subagent chains):**

```
event_ledger.query({ sessionKey: "<sessionKey>", limit: 100 })
```

Returns events from all runs that share a session, including subagent runs. Useful when a delegation chain broke and you need to trace across multiple `runId` values.

**Time range query (incident window):**

```
event_ledger.query({
  agentId: "<agentId>",
  from: "2024-01-15T14:00:00Z",
  to: "2024-01-15T14:30:00Z",
  limit: 200
})
```

Combine with `family` to isolate event categories within the window.

**Paginated query (large result sets):**

```
// First page
event_ledger.query({ runId: "<runId>", limit: 100 })
// Subsequent pages — use nextCursor from previous response
event_ledger.query({ runId: "<runId>", limit: 100, cursor: "<nextCursor>" })
```

`nextCursor` is `undefined` when no more results remain.

**Run summary (materialized aggregate):**

```
event_ledger.run_summary({ runId: "<runId>" })
```

Returns `RunSummary` with `outcome`, `model`, `provider`, `inputTokens`, `outputTokens`, `estimatedCostUsd`, `toolCalls`, `toolFailures`, and timing. Faster than querying raw events when you only need the high-level outcome.

---

## Event Family Reference

| Family          | What it covers                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------- |
| `model`         | LLM call lifecycle: request sent, response received, token counts, model used, provider.        |
| `tool`          | Tool call lifecycle: invocation, result, success/failure, call ID, tool name.                   |
| `session`       | Session open/close, session type (main/subagent/cron), depth, overflow signals.                 |
| `message`       | Inbound and outbound message events, channel, classification label.                             |
| `subagent`      | Subagent spawn, delegation, completion, outcome summary.                                        |
| `prompt`        | Prompt composition events: contributors applied, token pressure, omitted optional contributors. |
| `budget`        | Admission decisions (allow/degrade/block), threshold alerts, usage increments.                  |
| `orchestration` | Work item state transitions, sprint events, delegation records, escalations.                    |
| `evaluation`    | Scorecard produced, disqualifier triggered, human override applied.                             |
| `system`        | Plugin lifecycle, storage flush, retention cleanup, configuration reload.                       |

**Filtering by `type` within a family:** each family has multiple specific event types (e.g., `model.response`, `tool.call`, `budget.admission_decision`). Omit `type` to get all events in a family; add `type` to narrow to a specific event kind.

---

## Lineage and Causal ID Usage Guide

The `EventEnvelope` carries up to five causal IDs. Use the right one for the join you need:

**`runId`** — the most important. Every event belongs to exactly one run. Use as the primary filter for all run-scoped queries. Never substitute another ID when `runId` is known.

**`lineageId`** — the `runId` of the root ancestor in a subagent chain. When an agent spawns a subagent, the subagent's events carry its own `runId` but share the same `lineageId` as the parent. Use to reconstruct the full execution tree across multiple `runId` values:

```
event_ledger.query({ lineageId: "<rootRunId>", limit: 200 })
```

This returns events from the root run and all its descendant subagent runs.

**`sessionKey`** — scoped to the conversation session, which may include multiple sequential runs (e.g., a cron trigger that fires multiple times, or a user session with back-and-forth). Use when you need to see all runs within one logical session, not just one run.

**`agentId`** — the agent's stable identity across all sessions and runs. Use for health and aggregation queries, not for run-level incident investigation. Combining `agentId` with a time range is the standard pattern for agent-level trend analysis.

**`traceId` / `spanId`** — OTel distributed trace context, populated only when `ocx-observability` is active. Use to correlate event-ledger records with observability spans. Do not assume these are present; check before using as a join key.

---

## Retention Tier Guidance

The ledger operates three storage tiers with configurable boundaries:

| Tier | Default window                                   | Best for                                      |
| ---- | ------------------------------------------------ | --------------------------------------------- |
| Hot  | Recent hours (`hotRetentionHours`, default ~24h) | Live incident response, immediate diagnostics |
| Warm | Recent days (`warmRetentionDays`, default ~7d)   | Post-incident review, trend analysis          |
| Cold | Long-term (`coldRetentionDays`, default ~90d)    | Compliance, retrospectives, model comparison  |

**Practical decision guide:**

- If the incident happened in the last hour: query normally — data is in hot tier.
- If the incident happened 1–7 days ago: data may be in warm tier; verify your query window covers the right time range using `from`/`to` filters.
- If the incident happened more than 7 days ago: data is in cold tier; some query paths may be slower. Use specific `runId` or narrow `from`/`to` bounds to avoid full-scan performance issues.
- If events are missing entirely: check `hotRetentionHours` and `warmRetentionDays` config before concluding it is an ingest failure. The event may have been legitimately expired.

The `system` family events include retention cleanup records — query `family: "system"` to see what was pruned and when.

---

## Event Hygiene Rules for Extensions Emitting Events

Extensions that emit events to the ledger via `emitAgentEvent()` must follow these rules:

1. **Always include `runId`.** Every emitted event must carry a `runId`. Events without `runId` cannot be joined to run summaries or correlated in investigation workflows.

2. **Propagate `lineageId` and `sessionKey` from the triggering context.** Do not generate new values for these fields; copy them from the agent run context so that subagent chains remain joinable.

3. **Use the correct `family`.** Map your event to the closest existing family (see table above). Do not invent new family values — unknown families are dropped by the ledger's ingest filter.

4. **Keep payloads compact and structured.** Use typed key-value pairs in `data`; avoid embedding large blobs, full message bodies, or unbounded arrays. Recurring events (e.g., per-token-chunk events) with large payloads will exhaust hot tier storage quickly.

5. **Use `traceId` and `spanId` only when a live OTel context is active.** Do not generate synthetic trace IDs — leave these fields absent if no OTel trace is in scope. Fake trace IDs break span correlation in observability tooling.

6. **Do not emit the same logical event twice.** Deduplication is the emitter's responsibility. The ledger appends every event it receives; there is no idempotency key.

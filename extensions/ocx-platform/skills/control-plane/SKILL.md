# OCX Platform — Control Plane Operator Runbook

Use this skill when investigating cross-extension incidents. It covers the causal ID model that links records across extensions, three canonical investigation workflows, and hygiene rules for safe root-cause analysis.

---

## Causal ID Quick Reference

Every record emitted by an OCX extension carries one or more of these IDs. Understanding which ID to use as your join key is the first step in any investigation.

| ID           | Scope                            | When to use it                                                                                                                      |
| ------------ | -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `runId`      | Single agent run                 | Primary key for run-level data: events, summaries, budget entries, scorecards. Always start here.                                   |
| `agentId`    | Agent identity across runs       | Health evaluations, reaper records, stats windows, aggregated scores. Use when the symptom is agent-level rather than run-level.    |
| `sessionKey` | Session (may span multiple runs) | Delegation records, session-scoped budget checks, session overflows. Use when multiple runs share a conversation or subagent chain. |
| `lineageId`  | Root run of a subagent chain     | Joining subagent events back to the originating parent run. Equals `runId` of the top-level ancestor.                               |
| `traceId`    | OTel distributed trace           | Correlating event-ledger records with observability spans. Only populated when `ocx-observability` is active.                       |

Rule of thumb: **start with `runId`, broaden to `agentId` or `sessionKey` only when run-level data is inconclusive.**

---

## Where to Start — Symptom Quick-Reference

| Symptom                                    | First tool to call                                        |
| ------------------------------------------ | --------------------------------------------------------- |
| Run returned degraded model or was blocked | `event_ledger.query` with `runId` and `family: "budget"`  |
| Run never started or was silently dropped  | `event_ledger.query` with `runId` and `family: "session"` |
| Agent was paused, throttled, or terminated | `ocx_observability.health_timeline` for `agentId`         |
| Scorecard shows unexpectedly low score     | `ocx_evaluation.scorecard` with `runId`                   |
| Tool calls failing at high rate            | `event_ledger.query` with `runId` and `family: "tool"`    |
| Budget alert fired but run looks normal    | `ocx_budget.usage` scoped to the relevant `BudgetScope`   |
| Routing sent run to wrong model            | `ocx_routing.explain` with `runId`                        |
| Subagent chain broke mid-delegation        | `ocx_orchestration.delegation` filtered by `sessionKey`   |

---

## Workflow 1: "Why was this run blocked or degraded?"

Use when a run completed with a degraded model, was blocked at admission, or emitted unexpected budget events.

**Step 1 — Pull the run summary.**

```
event_ledger.run_summary({ runId: "<runId>" })
```

Check `outcome`, `model`, `provider`, `estimatedCostUsd`, and `toolFailures`. A degraded model shows as a different `model` than the agent's configured default.

**Step 2 — Query budget events for this run.**

```
event_ledger.query({
  runId: "<runId>",
  family: "budget",
  limit: 50
})
```

Look for events with `type: "admission_decision"`. The `data` payload will contain an `AdmissionDecision` — check `decision` ("allow" / "degrade" / "block"), `limitScope`, and `degradeModel`.

**Step 3 — Check budget usage at the blocking scope.**

```
ocx_budget.usage({ scopeLevel: "<level>", scopeId: "<id>" })
```

Use the `limitScope` from Step 2. Compare `utilizationPct` against the allocation's `alertAt` thresholds and `breachAction`. Confirm the window boundaries (`windowStart`, `windowEnd`) to rule out stale data.

**Step 4 — Explain the routing decision.**

```
ocx_routing.explain({ runId: "<runId>" })
```

Verify which `RoutingPolicy` matched (by `id` and `priority`), what `target.model` it selected, and whether any `budget_remaining` conditions influenced the match. A `budget_remaining: lt` condition can silently redirect runs to a cheaper model without a hard block.

**Step 5 — Confirm in the event timeline.**

```
event_ledger.query({
  runId: "<runId>",
  family: "model",
  limit: 20
})
```

Verify the model used matches the routing explanation. Discrepancies between `model` in the run summary and the routing target indicate a late-stage override (e.g., fallback after quota error).

---

## Workflow 2: "Why did this agent get reaped?"

Use when an agent was paused, throttled, cancelled, or terminated by the reaper.

**Step 1 — Pull the health timeline for the agent.**

```
ocx_observability.health_timeline({ agentId: "<agentId>", windowMinutes: 60 })
```

Look for state transitions: `healthy` → `degraded` → `stuck` / `rogue` / `zombie`. Note `stateChangedAt` and the `signals` that drove each transition. Pay attention to `severity: "critical"` signals — these directly trigger reaper policies.

**Step 2 — Identify the reaper policy that fired.**

```
ocx_observability.reaper_actions({ agentId: "<agentId>" })
```

Each `ReaperActionRecord` includes `state` (the health state that triggered it), `action` (what was done), `executedAt`, and `confirmed`. Match `executedAt` to the state transition time from Step 1 to confirm causality.

**Step 3 — Check the anomaly signals that caused the state change.**

The `HealthSignal` entries on each `HealthEvaluation` include `kind`, `value`, `threshold`, and `message`. Common culprits:

- `token_spike` — token usage exceeded `movingAvgTokens * tokenSpikeMultiplier`
- `tool_loop` — same tool called more than `toolLoopCallThreshold` times in the window
- `error_burst` — `errorsInWindow / totalRunsInWindow` exceeded `errorRateThreshold`
- `heartbeat_timeout` — no heartbeat within `heartbeatTimeoutMinutes` (zombie)

**Step 4 — Correlate with the event timeline.**

```
event_ledger.query({
  agentId: "<agentId>",
  from: "<stateChangedAt minus 10 minutes>",
  to: "<executedAt>",
  limit: 100
})
```

Look for the specific `tool` or `model` events that drove the anomaly signal. If the reaper fired on `tool_loop`, you should see the repeated tool calls in the `family: "tool"` events.

**Step 5 — Check whether confirmation was required.**

If `ReaperActionRecord.pendingConfirmation = true` and `confirmed = false`, the action was held pending operator approval. If the action was destructive (`cancel_run`, `terminate_session`) and `requireConfirmation` was `true` in the policy, verify that confirmation was actually obtained before proceeding with any remediation.

---

## Workflow 3: "Why did this run score low?"

Use when a scorecard shows a low `overallScore` or triggered a disqualifier.

**Step 1 — Pull the scorecard.**

```
ocx_evaluation.scorecard({ runId: "<runId>" })
```

Inspect `overallScore`, `criteriaScores`, `confidence`, `disqualified`, and `disqualifierTriggered`. If `disqualified: true`, the score is automatically 0 — identify the disqualifier before looking at criteria.

**Step 2 — Check tool intelligence.**

The `Scorecard.toolIntelligence` field contains a `ToolIntelligenceReport`. Key fields:

- `effectivenessScore` — overall tool use quality (0–100)
- `wastedCalls` — tool call IDs whose results were never referenced
- `repeatedCalls` — same tool called with near-identical parameters (`paramSimilarity > 0.8` is suspicious)
- `corrections` — cases where the agent retried with a different tool after failure

High `wastedCalls` or `repeatedCalls` counts are common root causes for low scores.

**Step 3 — Check the judge profile and classification.**

```
ocx_evaluation.judge_profile({ id: "<scorecard.judgeProfileId>" })
```

Verify `matchLabels` align with `scorecard.classificationLabel`. A misclassified run (e.g., classified as `simple` but the task was `multi-step`) may have been evaluated against the wrong criteria weights.

**Step 4 — Check routing classification for the run.**

```
ocx_routing.explain({ runId: "<runId>" })
```

Confirm the `ClassificationResult.label` and `confidence`. Low confidence classifications (below 0.7) are prone to misrouting and mis-evaluation.

**Step 5 — Correlate with the event timeline for anomalies.**

```
event_ledger.query({
  runId: "<runId>",
  family: "tool",
  limit: 100
})
```

Cross-reference `wastedCalls` and `repeatedCalls` call IDs against the event timeline to find the exact timestamps. If the tool failures cluster in a short window, check whether a budget degradation (Workflow 1) occurred at the same time and forced the agent to a weaker model mid-run.

---

## Key Rules

1. **Use `runId` consistently across all queries.** Switching to `agentId` or `sessionKey` mid-investigation without documenting why introduces ambiguity. Note the join key at the top of your incident note.

2. **Check retention tiers before declaring missing data an ingest failure.** Hot tier covers recent hours; warm tier covers recent days; cold tier covers long-term archival. Query the appropriate tier for the time range in question. If the event timestamp falls outside the configured `hotRetentionHours`, the record may have been promoted to warm/cold storage and may not appear in the default query window.

3. **Require evidence from at least two sources before taking destructive action.** Cancelling a run or terminating a session based solely on a single health signal or a single event is unsafe. Confirm with at least one corroborating source (e.g., event timeline + reaper record, or budget usage + admission decision).

4. **Do not act on `pendingConfirmation` records without operator sign-off.** If the reaper held an action pending confirmation, that gate exists for a reason. Bypassing it by manually executing the same action circumvents the policy's `requireConfirmation` intent.

5. **Preserve causal IDs in incident notes.** Record `runId`, `agentId`, `sessionKey`, and `traceId` (if present) at the start of every investigation. These are the join keys for any future retrospective or audit.

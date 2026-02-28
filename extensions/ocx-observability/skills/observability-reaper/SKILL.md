# Observability Reaper — Skill Guide

The `ocx-observability` extension gives operators continuous visibility into running agents: it emits OpenTelemetry spans, metrics, and logs through an OTLP bridge, evaluates each agent's runtime statistics against configurable health criteria every 30 seconds, and runs a reaper policy engine that can automatically alert, throttle, pause, cancel, or terminate agents that drift into unhealthy states. It is used by platform operators and orchestrating agents that need to detect and contain runaway, stuck, or zombie agents before they exhaust budget or corrupt shared state.

## Actions at a Glance

| Gateway Method                  | What it does                                       | Destructive? |
| ------------------------------- | -------------------------------------------------- | ------------ |
| `observability.health`          | Get current health evaluation for all agents       | No           |
| `observability.health.history`  | Get health evaluation history (optional agentId)   | No           |
| `observability.anomalies`       | Get all active anomaly signals across agents       | No           |
| `observability.reaper.policies` | Read or update reaper policies per trigger state   | No           |
| `observability.reaper.history`  | List past reaper actions and pending confirmations | No           |
| `observability.reaper.confirm`  | Confirm a pending destructive action by ID         | YES          |

## Health State Machine

An agent moves through five states. The monitor re-evaluates every 30 seconds (configurable via `healthCheckIntervalSeconds`).

| State      | Meaning                                                                                                                        | Default reaper response                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- |
| `healthy`  | All signals within thresholds; agent is operating normally.                                                                    | None                                                                            |
| `degraded` | Warning signals active (error rate > 20%, budget > 80%, consecutive tool failures > 5). Not critical; reaper does not trigger. | None (monitor only)                                                             |
| `stuck`    | No agent events for 15 minutes, or heartbeat timeout exceeded.                                                                 | Alert (broadcast); no confirmation required                                     |
| `rogue`    | Token spike (3x 60-min moving average) or tool loop (same tool > 10 calls in 5 min).                                           | Alert + throttle (30 s delay) + cancel_run; confirmation required before cancel |
| `zombie`   | No heartbeat for 10 minutes with an active session still open.                                                                 | Alert + terminate_session; confirmation required before terminate               |

State transitions are logged and emit an OTel log record (`health.<state>` event type) on every change.

## Anomaly Detection

Six rules run on each health evaluation cycle. A rule fires a signal if its threshold is exceeded; the signal feeds the state machine and may advance the agent toward a worse state.

| Rule kind          | Severity         | Trigger                                                      | Default cooldown |
| ------------------ | ---------------- | ------------------------------------------------------------ | ---------------- |
| `token_spike`      | critical         | Window tokens > 60-min moving average x 3.0                  | 15 min, max 4/hr |
| `error_burst`      | warning/critical | Error rate > 20% in 30-min window (critical at 2x threshold) | 10 min, max 6/hr |
| `tool_loop`        | critical         | Same tool called > 10 times in 5 minutes                     | 5 min, max 12/hr |
| `cost_spike`       | warning          | Current cost window > previous cost window x 3.0             | 60 min, max 1/hr |
| `session_overflow` | warning          | Active sessions > configured session maximum                 | 15 min           |
| `unusual_model`    | info             | Model used that is not in the agent's configured model list  | 15 min           |

A **suppression window** prevents alert fatigue: after a signal fires for a given agent, the same signal kind is muted for its cooldown period and capped per hour. The reaper is only invoked if the suppression engine allows the alert through. Suppression does not prevent health state changes from being recorded — it only gates the reaper and broadcast.

## Querying Health and Anomalies

Get the current health snapshot for all agents:

```
gateway.call('observability.health')
// Returns: { agents: [{ agentId, state, signals, evaluatedAt, ... }] }
```

Get historical evaluations (useful for spotting trends):

```
gateway.call('observability.health.history', { agentId: 'my-agent', limit: 50 })
```

Get all active anomaly signals across the fleet:

```
gateway.call('observability.anomalies')
// Returns: { anomalies: [{ agentId, kind, severity, value, threshold, message }] }
```

Read current reaper policies and any pending confirmations:

```
gateway.call('observability.reaper.history', { limit: 20 })
// Returns: { history: [...], pending: [...] }
```

## The Reaper Workflow

```
health monitor fires
  └─ anomaly signal detected
       └─ suppression check passes
            └─ state transitions to stuck / rogue / zombie
                 └─ policy engine matches trigger state
                      ├─ non-destructive actions execute immediately
                      │    (alert, throttle, pause)
                      └─ destructive actions STOP here
                           └─ pending confirmation created
                                └─ HUMAN must call observability.reaper.confirm
```

### Before You Reap — Checklist

Before confirming a `cancel_run` or `terminate_session`, verify:

1. The anomaly signal is genuine — check `observability.anomalies` for current signal values and thresholds; compare against recent history from `observability.health.history`.
2. The agent is not mid-transaction or holding a lock another agent depends on.
3. Check `ocx-orchestration` (if active) for open work items assigned to this agent; reassign before terminating.
4. Confirm the `agentId` and `sessionKey` in the pending record exactly match the agent you intend to stop.
5. For `cancel_run`: the active run is broadcast-cancelled; the session remains open and the agent may accept new runs.
6. For `terminate_session`: the session is permanently ended. The agent cannot recover its state; any in-flight work is lost.

Confirm a pending destructive action by ID:

```
gateway.call('observability.reaper.confirm', { confirmationId: '<id from pending>' })
```

## Suppression Windows — Managing False Positives

If a rule fires during a known burst (deployment, backfill job, load test), reduce sensitivity by updating the policy for that trigger state to drop destructive actions temporarily, or by raising a threshold in config.

Replace the rogue policy with an alert-only version during a planned load test:

```
gateway.call('observability.reaper.policies', {
  triggerState: 'rogue',
  policy: {
    triggerState: 'rogue',
    actions: [{ kind: 'alert', target: 'broadcast' }],
    requireConfirmation: true
  }
})
```

To tune anomaly thresholds permanently, update config keys such as `tokenSpikeMultiplier`, `toolLoopCallThreshold`, or `errorRateThreshold` in the plugin config and restart the gateway. Adjust `suppressionCooldownMinutes` or `maxAlertsPerHour` to control per-signal alert frequency without changing detection sensitivity.

## OTel Telemetry

When an OTLP endpoint is configured (`otlpEndpoint`, default `http://localhost:4318`), the extension exports:

**Spans** — one `agent_run` root span per run, with child spans for `llm_call`, `tool_call`, `subagent_run`, `model_resolve`, and `prompt_compose`. Spans carry attributes: `agent.id`, `llm.model`, `llm.tokens.input`, `llm.tokens.output`, `llm.cost_usd`, `tool.name`, `tool.duration_ms`.

**Metrics** — token counts, cost, tool call counts, tool durations, tool failures, run durations, message counts, escalation counts, and budget utilization. All metrics carry an `agent.id` label.

**Logs** — structured log records for: `tool.error`, `system.error`, `health.<state>`, `session.compaction`, `budget.admission.blocked`, `model.fallback`, `subagent.ended.failed`. Each record includes `agentId` and contextual attributes.

If the OTLP endpoint is unavailable at startup, health monitoring and reaper policies continue running — only telemetry export is disabled. Check gateway logs for `OTEL exporter failed to start`.

## Key Rules

1. **Read before acting** — always call `observability.health` and `observability.anomalies` before deciding whether to engage the reaper; never trigger based on a single stale observation.
2. **Destructive actions require explicit confirmation** — `cancel_run` and `terminate_session` are never executed automatically unless `requireConfirmation: false` is explicitly set in a custom policy; always confirm via `observability.reaper.confirm` with the specific confirmation ID from the pending record.
3. **`terminate_session` is irreversible** — the session cannot be recovered after termination; ensure in-flight work is reassigned before confirming.
4. **Suppression gates the reaper, not the state machine** — health state changes are always recorded; suppression only prevents redundant alerts and reaper invocations within the cooldown window.
5. **`degraded` does not trigger the reaper** — warning-level signals produce a `degraded` state but no policy matches it; use `observability.health` to monitor degraded agents and intervene manually.
6. **Tune thresholds before weakening policies** — prefer raising `tokenSpikeMultiplier` or `toolLoopCallThreshold` to reduce noise rather than removing destructive actions from a policy or setting `requireConfirmation: false`.
7. **Custom policies replace defaults per trigger state** — calling `observability.reaper.policies` with a full policy object overwrites the default for that `triggerState`; always preserve `requireConfirmation: true` on any policy that includes destructive actions unless you have explicit operator approval to remove it.

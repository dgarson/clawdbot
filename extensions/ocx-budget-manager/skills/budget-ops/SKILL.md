# Budget Manager — Skill Guide

The `ocx-budget-manager` extension tracks token consumption and cost across all agent runs, enforces configurable spending limits at each level of the scope hierarchy, fires alerts as thresholds are crossed, and can degrade or block runs that exceed their budget. It is used by operators and orchestrators to prevent runaway spending, enforce team or project quotas, and generate audit-ready usage reports.

## Actions at a Glance

| Gateway Method         | What it does                                     | Required params               |
| ---------------------- | ------------------------------------------------ | ----------------------------- |
| `budget.usage`         | Current usage vs limit for a scope               | `level`, `id`                 |
| `budget.usage.history` | Raw ledger entries over a time range             | `level`, `id`, `from?`, `to?` |
| `budget.allocations`   | List all allocations, get one, or set/update one | `action`, `level?`, `id?`     |
| `budget.burn_rate`     | Current burn rate and projected exhaustion time  | `level`, `id`                 |
| `budget.alerts`        | Active threshold alerts across all scopes        | —                             |

## Enforcement Modes

Three modes control what the system does when a limit is reached:

- **`read-only`** — tracking only. The ledger accumulates usage but no run is ever blocked or degraded. Use this when onboarding a new scope to observe actual spend before setting hard limits.
- **`soft`** — warns and degrades, but never blocks. If a scope's `breachAction` is `block` and the global mode is `soft`, the extension falls back to degrading the model instead (if `degradeModel` is set) or allows the run with a warning. Safe for teams that must not be hard-stopped.
- **`hard`** — full enforcement. A `block` breachAction hard-rejects the run with a user-visible error. A `degrade` breachAction switches the model. `warn` always allows but logs.

The global enforcement mode acts as a ceiling: it can only relax what an individual allocation requests, never tighten it. Set the ceiling in plugin config (`enforcement`); set per-scope behavior via `breachAction` on each allocation.

## Scope Hierarchy

Scopes form a five-level tree: `system` → `organization` → `team` → `agent` → `session`. Every run resolves its applicable scopes bottom-up (session → agent → team → org → system) and each level is checked independently. The first scope whose utilization hits 100% determines the outcome for that run.

Practical rules:

- A limit set at `team` constrains all agents in that team regardless of their individual limits.
- Setting a limit at `agent` is additive to, not a replacement for, team or org limits — all applicable scopes must pass admission.
- `session` scope is the finest grain; use it for one-off experiments or sandboxed evaluations with tight caps.
- `system` scope is the backstop for all traffic; set a conservative system-level limit as a safety net.

## Budget Windows

| Window    | Resets when                         | Best for                                        |
| --------- | ----------------------------------- | ----------------------------------------------- |
| `hourly`  | Top of each hour                    | Rate-limiting burst traffic; real-time guards   |
| `daily`   | Midnight (default)                  | Typical cost governance; dev team quotas        |
| `weekly`  | Start of each week                  | Moderate-volume teams with weekly reporting     |
| `monthly` | First of each month                 | Billing alignment; executive budget cycles      |
| `sprint`  | Tied to a named sprint ID           | Project budgets; sprint-scoped experiments      |
| `rolling` | Continuously trailing (ms duration) | Smoothed rate limits; sustained throughput caps |

When in doubt, start with `daily`. Use `rolling` when you need to prevent short bursts rather than just day-level overages. Use `sprint` when budget approval is project-gated.

## Checking Current Usage

```
budget.usage(level='team', id='platform-eng')
```

Returns `usage` (current window totals and `utilizationPct` per dimension) alongside `allocation` (the configured limits and window). Key fields:

- `utilizationPct` — map of dimension to fraction consumed (0–1). Values at or above `1.0` mean the limit is exhausted.
- `windowStart` / `windowEnd` — the boundaries of the current window.
- `runCount` — total runs accepted in the window.

To see projected exhaustion before acting on a budget decision:

```
budget.burn_rate(level='team', id='platform-eng')
```

Returns `burnRate` per dimension with `current` (fraction used), `projected` (fraction at window end if rate holds), and `exhaustsAt` (ISO timestamp when the budget will run out at the current rate).

## Interpreting an Admission Decision

Before each run the extension evaluates all applicable scopes bottom-up and returns one of three decisions:

- **`allow`** — all scopes are within budget. The run proceeds normally.
- **`degrade`** — a scope limit was hit and `breachAction` is `degrade` (or global mode is `soft` with a `degradeModel` configured). The run proceeds but the model is overridden to `degradeModel`. The `limitScope` field in the event identifies which scope triggered the downgrade.
- **`block`** — a scope limit was hit, `breachAction` is `block`, and enforcement mode is `hard`. The run is rejected with a user-visible message identifying the exhausted scope. No tokens are consumed.

The admission outcome is emitted on the `budget` event stream (`family: "budget"`, `type: "budget.admission"`) for every run. Orchestrators can subscribe to this stream to log or react to admission outcomes in real time.

## Alert and Breach Response Flow

Alerts fire when utilization crosses an `alertAt` threshold (as a fraction of the limit, e.g. `[0.75, 0.90, 1.0]`). Each crossing produces a `BudgetAlert` record with the scope, dimension, threshold crossed, and current utilization.

Delivery is controlled by `alertDelivery`:

- **`broadcast`** — alert is distributed to subscribed agents via the gateway event bus.
- **`webhook`** — alert is POSTed to `alertWebhookUrl` as JSON.

When you receive an alert or see utilization approaching the limit:

1. Call `budget.burn_rate` to confirm the rate is sustained (not a transient spike).
2. If the rate is sustained and the work is legitimate, call `budget.allocations` with `action='set'` to raise the limit or widen the window.
3. If the limit should hold, notify the relevant team that capacity is nearly exhausted and that subsequent runs may be degraded or blocked.
4. After the window resets, check `budget.usage.history` to review whether the window boundary resolved the pressure or the pattern recurs.

## Mid-Run Guard

The mid-run guard hook fires during an active run at periodic checkpoints. If usage crosses a limit while a run is in flight, the guard can request early termination. This prevents a single large run from consuming the entire remaining budget of a scope.

The decision follows the same `breachAction` logic: `warn` logs and continues, `degrade` is not applicable mid-run (the model is already chosen), and `block` in `hard` mode signals the run to abort at the next safe checkpoint.

Mid-run aborts are non-destructive: work completed before the checkpoint is preserved. Design long-running agents to checkpoint progress so a mid-run block does not discard valuable partial results.

## Safe Rollout: Onboarding a New Team

1. Start with `enforcement: "read-only"` (the default). The ledger accumulates real usage without any blocking.
2. After one or two full windows, call `budget.usage.history` to understand actual token and cost patterns.
3. Set an initial allocation 20–30% above observed peak usage with `breachAction: "warn"`. This catches surprises without disrupting work.

```
budget.allocations(action='set', level='team', id='new-team', limits={maxCostUsd: 50}, breachAction='warn', alertAt=[0.75, 0.90])
```

4. After a week in `warn` mode with no unexpected spikes, switch to `enforcement: "soft"` and add a `degradeModel` fallback on the team allocation.
5. Move to `enforcement: "hard"` only when hard blocking is required by policy and the team has operated stably under `soft` for at least one billing window.

## Incident Response: Agent Hits Budget Unexpectedly

1. Check active alerts for context: `budget.alerts()`
2. Identify which scope blocked or degraded the run — the `budget.admission` event on the `budget` stream contains `scope` (e.g. `team/platform-eng`).
3. Pull current usage: `budget.usage(level='team', id='platform-eng')`
4. Confirm with burn rate that this is real exhaustion and not a data anomaly: `budget.burn_rate(level='team', id='platform-eng')`
5. Pull history to find the culprit run(s): `budget.usage.history(level='agent', id='<agentId>', from='<windowStart>')`
6. If the limit is genuinely too low and the work is legitimate, raise it with `budget.allocations(action='set', ...)` and document the change.
7. If the spend looks anomalous (e.g. a loop, a prompt inflating tokens beyond expectation), fix the root cause before raising the limit.
8. After resolution, tighten `alertAt` thresholds to get earlier warning in subsequent windows.

## Key Rules

1. **Start in `read-only` mode.** Never set hard limits on a new scope before observing real usage — you will block legitimate work.
2. **Always set `alertAt` thresholds.** A limit without alerts means the first signal of a budget problem is a blocked run.
3. **Scope limits are independent and cumulative.** Passing agent-level admission does not guarantee team-level admission; all applicable scopes must pass.
4. **`soft` mode never hard-blocks.** If policy requires guaranteed blocking, use `hard` enforcement — `soft` falls back to allowing when no `degradeModel` is configured.
5. **Mid-run aborts preserve completed work but cannot undo already-spent tokens.** Checkpoint long agents to minimize wasted cost on an abort.
6. **Raising a limit is always safe; lowering it mid-window is not.** A limit decrease takes effect immediately and can trigger sudden blocks if utilization is already near the new lower value.
7. **Use `sprint` windows for project-gated budgets.** Tying budget windows to sprint IDs makes it easy to close out spend at project milestones without waiting for a calendar boundary.

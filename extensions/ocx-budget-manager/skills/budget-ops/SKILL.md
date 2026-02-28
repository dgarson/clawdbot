# Budget Ops Skill

Use this skill for budget guardrail rollout, quota triage, and cost enforcement policy.

## Rollout Ladder

1. `read-only`: observe spend and token patterns.
2. `soft`: warn/degrade, but do not hard block.
3. `hard`: block only after stable alerting and documented exception flow.

## Operating Loop

1. Review scope hierarchy and ownership.
2. Validate price table freshness.
3. Review threshold alerts.
4. Apply targeted adjustments (not broad global cuts).

## Breach Response

When scope is over budget:

- Confirm whether spike is expected (launch, incident, backfill).
- Route lower-priority traffic to cheaper models.
- Defer non-critical workloads.
- Document exception window if temporary override is required.

## Guardrails

- Never move directly from `read-only` to broad `hard` enforcement.
- Prefer per-scope tuning over global enforcement shocks.
- Keep alerts actionable (owner + scope + remaining window).

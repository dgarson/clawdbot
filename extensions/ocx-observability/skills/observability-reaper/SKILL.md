# Observability Reaper Skill

Use this skill to evaluate health anomalies and safely execute reaper actions.

## Priority Order

1. Validate signal quality (not noise/suppression gap).
2. Confirm severity and blast radius.
3. Execute least-destructive action first.
4. Require confirmation for destructive actions.

## Action Ladder

- `alert` / notify
- throttle or isolate workload
- cancel run (only with clear evidence)
- terminate session (last resort)

## Confirmation Standard

Before destructive action, capture:

- triggering indicators,
- impact statement,
- rollback/recovery plan.

## False-Positive Handling

- Tune anomaly thresholds after incident review.
- Add suppression windows for known maintenance periods.
- Track recurring noisy rules and refactor them.

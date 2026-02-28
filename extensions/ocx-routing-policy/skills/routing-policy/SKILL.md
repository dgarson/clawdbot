# Routing Policy Skill

Use this skill when tuning model routing and prompt contributor behavior for cost/latency/quality balance.

## Safe Tuning Sequence

1. Baseline current behavior (no policy edits mid-incident).
2. Adjust one variable at a time:
   - classifier model,
   - heuristic confidence threshold,
   - default model fallback.
3. Validate with representative prompts.
4. Roll out gradually and monitor regressions.

## Decision Rules

- Prefer heuristic route when confidence is clearly above threshold.
- Fall back to LLM classification only for ambiguous tasks.
- Keep a stable default model for unmatched routes.

## Policy Design Tips

- Keep policies explicit and narrow.
- Avoid overlapping match criteria unless precedence is documented.
- Tag policy intent (cost-optimized, latency-optimized, quality-first).

## Failure Recovery

If routing quality drops:

1. Revert last policy change.
2. Lower routing complexity (fewer branch rules).
3. Increase use of default model until confidence recovers.

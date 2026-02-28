# Evaluation Ops Skill

Use this skill to run asynchronous quality evaluation, interpret scorecards, and escalate quality risk.

## Evaluation Cycle

1. Ensure judge profile/model is valid for the task domain.
2. Score recent runs in small batches.
3. Track low-score clusters by task/tool/model.
4. Escalate only repeated or high-impact regressions.

## Interpreting Results

- One low score = signal to inspect.
- Repeated low scores in same path = routing/prompt/tool defect candidate.
- Divergence between heuristic and LLM judge = calibration review needed.

## Calibration Practice

- Revisit quality threshold regularly.
- Keep representative benchmark set current.
- Separate “style disagreements” from true task failure.

## Retention & Hygiene

- Retain enough scorecards for trend analysis.
- Purge stale records per retention policy.
- Record root-cause labels for major failures.

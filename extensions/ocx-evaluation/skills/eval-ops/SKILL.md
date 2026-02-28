# Evaluation — Skill Guide

`ocx-evaluation` scores every completed agent run after the fact, producing a
scorecard with weighted quality criteria, tool efficiency analysis, and
model-comparison data. Scoring is asynchronous: runs finish, then the background
worker picks them up in batches (default every 30 s, up to 10 per cycle) and
scores each one against the best-matching judge profile. Operators and
orchestration agents use this data to compare models, spot regressions, and
tune routing policy. Human reviewers can override any score when automated
judgment is wrong.

## Actions at a Glance

| Gateway Method                   | What it does                                      | Required params                                  |
| -------------------------------- | ------------------------------------------------- | ------------------------------------------------ |
| `evaluation.scorecards.query`    | Retrieve scored runs (filter by run, agent, time) | at least one of: `runId`, `agentId`, `from`/`to` |
| `evaluation.scorecards.override` | Annotate a scorecard with a human-reviewed score  | `runId`, `overrideScore`, `annotator`, `reason`  |
| `evaluation.judges.list`         | List all configured judge profiles                | —                                                |
| `evaluation.judges.set`          | Create or update a judge profile                  | `profile` object with `id`, `name`, `criteria`   |
| `evaluation.model_comparison`    | Aggregate score/cost/efficiency by model          | `classificationLabel`, `from`, `to`              |
| `evaluation.tool_report`         | Tool intelligence report for a specific run       | `runId`                                          |

## Scoring Pipeline

Scoring is fire-and-forget from the agent's perspective. The pipeline is:

1. Agent lifecycle hooks (`llm_input`, `llm_output`, `after_tool_call`,
   `agent_end`) collect run data in memory as the run progresses.
2. On `agent_end` the completed run is moved to the unscored queue.
3. The background worker polls the queue every `pollIntervalMs` (default 30 s)
   and pulls up to `batchSize` (default 10) runs per cycle.
4. For each run, the worker picks the judge profile whose `matchLabels` covers
   the run's classification label, runs the appropriate scoring method, builds
   a tool intelligence report, persists the scorecard, and emits two events:
   - `evaluation.model_feedback` — always; consumed by routing-policy for
     feedback loops.
   - `evaluation.quality_risk` — only when `overallScore` is below
     `qualityRiskThreshold` (default 40).

Scoring is non-blocking. A run that has no matching judge profile is silently
skipped (logged at info level).

## Judge Profiles

A judge profile controls how runs are matched and scored.

**`matchLabels`** — the profile applies to any run whose `classificationLabel`
is in this list. Labels come from `ocx-routing-policy` (`simple`, `code`,
`complex`, `multi-step`) or fall back to `"general"` when routing-policy is not
active. A profile with `matchLabels: ["simple", "code"]` scores both task types.

**`method`** selects the scoring engine:

| Method      | How it works                                                              | Confidence |
| ----------- | ------------------------------------------------------------------------- | ---------- |
| `heuristic` | Deterministic — scores `response_time`, `token_efficiency`, `tool_count`  | 0.9        |
| `llm`       | LLM-driven criteria assessment (requires provider wiring; currently stub) | 0.1 stub   |
| `hybrid`    | LLM for quality criteria, heuristic for efficiency criteria               | averaged   |

**Use `heuristic` profiles until LLM invocation is wired to provider
infrastructure.** Profiles with `method: "llm"` or `"hybrid"` currently return
low-confidence fallback scores (0.1 confidence) and a warning is logged at
startup.

**Criteria and weights** — each criterion has a `weight`; weights are normalised
to sum to 1.0 before computing the weighted average. Heuristic criteria
recognised by the engine are `response_time`, `token_efficiency`, and
`tool_count`. Unknown criterion ids score at the midpoint of the profile's
scale.

**Disqualifiers** — string patterns in the `disqualifiers` list. If any trigger,
`disqualified: true` and `overallScore` is set to `scale.min` regardless of
criteria scores.

**`version`** — increment whenever criteria change. Historical scorecards store
the version at the time of scoring so old and new results remain comparable.

### List profiles

```
gateway: evaluation.judges.list
```

### Create or update a profile

```
gateway: evaluation.judges.set
params:
  profile:
    id: "efficiency-simple"
    version: 1
    name: "Efficiency — Simple Tasks"
    matchLabels: ["simple"]
    method: "heuristic"
    criteria:
      - id: "response_time"
        name: "Response Time"
        description: "Penalises runs over 10 s"
        weight: 2
      - id: "token_efficiency"
        name: "Token Efficiency"
        description: "Output/input token ratio"
        weight: 1
      - id: "tool_count"
        name: "Tool Usage"
        description: "Fewer tool calls = better for simple tasks"
        weight: 1
    disqualifiers: []
    scale: { min: 0, max: 100 }
```

## Retrieving a Scorecard

```
gateway: evaluation.scorecards.query
params:
  runId: "run-abc123"
```

To retrieve all scorecards for an agent in a time window:

```
gateway: evaluation.scorecards.query
params:
  agentId: "agent-xyz"
  from: "2026-02-01T00:00:00Z"
  to: "2026-02-28T23:59:59Z"
  limit: 50
```

Supported filters: `runId`, `agentId`, `from`, `to`, `classificationLabel`,
`model`, `limit`.

## Interpreting a Scorecard

| Field                                  | What it means                                                                   |
| -------------------------------------- | ------------------------------------------------------------------------------- |
| `overallScore`                         | Weighted average of criteria scores, on the profile's `scale` (usually 0–100)   |
| `criteriaScores`                       | Per-criterion breakdown keyed by criterion id                                   |
| `confidence`                           | 0–1; heuristic = 0.9, LLM stub = 0.1; low confidence = treat as indicative only |
| `disqualified`                         | `true` if a disqualifier triggered; `overallScore` is forced to `scale.min`     |
| `disqualifierTriggered`                | Which disqualifier pattern matched                                              |
| `reasoning`                            | LLM judge narrative (only present for `llm`/`hybrid` method)                    |
| `humanOverride`                        | Present if a reviewer annotated the score; use `overrideScore` for decisions    |
| `judgeProfileVersion`                  | Profile version active at scoring time                                          |
| `costUsd`, `totalTokens`, `durationMs` | Raw run metrics stored for model comparison                                     |

A score below 40 (the default `qualityRiskThreshold`) triggers a
`evaluation.quality_risk` event. A score at `scale.min` combined with
`disqualified: true` means the run failed a hard criterion — inspect
`disqualifierTriggered` before drawing quality conclusions from `criteriaScores`.

## Model Comparison

Compare models on the same task class to find the best cost/quality tradeoff:

```
gateway: evaluation.model_comparison
params:
  classificationLabel: "code"
  from: "2026-02-01T00:00:00Z"
  to: "2026-02-28T23:59:59Z"
```

The response groups scorecards by `(model, provider)` and returns for each:
`avgScore`, `avgCostUsd`, `avgTokens`, `avgDurationMs`, and `scorePerDollar`
(score divided by cost — the primary efficiency metric). Higher `scorePerDollar`
means better quality per unit cost. Use a minimum run count (at least 20–30 runs
per model) before trusting the averages.

## Human Override

Override when automated scoring is clearly wrong — for example, when a heuristic
profile penalises a legitimately slow complex task, or when a disqualifier fires
on a false positive.

```
gateway: evaluation.scorecards.override
params:
  runId: "run-abc123"
  overrideScore: 78
  annotator: "alice"
  reason: "Heuristic penalised a legitimately multi-step task; quality was high."
```

The override is stored in `humanOverride` on the scorecard. Downstream consumers
should prefer `humanOverride.overrideScore` over `overallScore` when present.
Override only when you have direct knowledge of the run quality. Do not use
overrides to mask a systemic scoring problem — fix the judge profile instead.

## Tool Intelligence Report

Each scored run with tool calls gets a `toolIntelligence` block in its
scorecard. Retrieve it directly:

```
gateway: evaluation.tool_report
params:
  runId: "run-abc123"
```

Key fields to inspect:

| Field                | What to investigate                                                          |
| -------------------- | ---------------------------------------------------------------------------- |
| `wastedCalls`        | Tool calls whose results were never referenced in subsequent output; each    |
|                      | wasted call costs tokens and latency with zero benefit — reduce or eliminate |
| `repeatedCalls`      | Near-duplicate calls with high `paramSimilarity`; indicates the agent looped |
|                      | or lacked memory of prior results — review prompt or tool output handling    |
| `corrections`        | Calls where the agent retried with a different tool for the same goal;       |
|                      | normal occasionally but frequent corrections suggest poor tool selection     |
| `effectivenessScore` | 0–100 summary; below 60 warrants inspection of wasted/repeated call lists    |
| `failedCalls`        | High failure rate may indicate external dependency issues, not agent quality |

## Triage: Consistently Low Scores

When an agent or model scores below the quality risk threshold repeatedly:

1. Check `confidence` — if it is 0.1, the LLM judge is not wired; scores are
   not meaningful. Switch the profile to `method: "heuristic"`.
2. Check `disqualified` — if `true`, read `disqualifierTriggered` and verify
   the disqualifier pattern is correctly defined.
3. Check `criteriaScores` — identify which criteria are dragging down the
   overall score and whether the weights reflect actual priority.
4. Check `toolIntelligence.effectivenessScore` — if low, the agent may be
   making redundant or wasteful calls rather than producing low-quality output.
5. Run `evaluation.model_comparison` across a longer time window — a single
   bad batch can skew averages; verify the trend holds over 30+ runs.
6. If scores are systematically wrong for a task type, the judge profile's
   criteria or thresholds need calibration, not the agent.

## Calibration Cadence

Review and update judge profiles when:

- A new task classification is added (add a profile with matching `matchLabels`).
- Heuristic thresholds no longer reflect actual SLO targets (response time
  targets shift, token budget changes).
- Human overrides accumulate on the same criterion — the criterion is
  consistently mis-scored and the weight or definition needs adjustment.
- A profile version bump is needed: increment `version` before saving the
  updated profile via `evaluation.judges.set`. Existing scorecards retain their
  original `judgeProfileVersion` so historical comparisons remain valid.

Do not change criteria weights mid-experiment. Freeze the profile version for
the duration of a model comparison, then bump after the comparison concludes.

## Key Rules

1. **Heuristic profiles only — until LLM invocation is wired.** Profiles with
   `method: "llm"` or `"hybrid"` return 0.1-confidence stub scores and must not
   be treated as quality signals.
2. **Scoring is async.** A scorecard may not exist immediately after a run
   completes. Allow at least one poll cycle (30 s default) before querying.
3. **Prefer `humanOverride.overrideScore` when present.** Automated scores are
   starting points; human annotation is authoritative.
4. **Bump `version` when criteria change.** Do not reuse a profile version
   number after modifying criteria — historical scorecards will be misread.
5. **`disqualified: true` means score is forced to minimum.** Do not average
   disqualified runs into model comparison results without explicit handling.
6. **Use `scorePerDollar` for routing decisions, not `avgScore` alone.** A
   cheaper model with a lower but acceptable score often dominates on efficiency.
7. **Fix the judge profile before overriding repeatedly.** If the same criterion
   is wrong for five consecutive runs, calibrate the profile; do not paper over
   it with manual overrides.

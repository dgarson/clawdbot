# Agent Quality/Success Score Framework
*Author: Amadeus (CAIO)*
*Date: 2026-02-21*
*Context: Robert's DATA_ANALYTICS_REQUIREMENTS.md needs a standardized quality metric as the ROI denominator*

---

## 1. Design Constraints

The quality score must be:
- **Automatable** — no human ratings in the loop for routine scoring. Manual eval is too expensive at 33+ cron sessions/day + ad-hoc work.
- **Cheap to compute** — spending $1 to evaluate a $0.12 session defeats the purpose. Score computation cost must be <5% of session cost.
- **Session-scoped** — joins cleanly with Robert's cost-per-session metric via `session_id`.
- **Comparable across task types** — a 0.85 on a code task and a 0.85 on a chat task should mean roughly equivalent quality, even though the underlying signals differ.
- **Decomposable** — the composite score breaks down into components for diagnostic purposes (why did this session score poorly?).

---

## 2. Scoring Architecture: Composite Score (0.0 – 1.0)

The quality score `Q` is a weighted composite of **4 signal categories**, each scored 0.0–1.0:

```
Q = w₁·Completion + w₂·Execution + w₃·Efficiency + w₄·Outcome
```

### 2.1 Signal Category: Completion (did the session accomplish its goal?)

| Signal | How to capture | Score contribution |
|--------|---------------|-------------------|
| Session ended normally (not error/timeout/abort) | `session.terminationReason` | 0.0 (error/abort) or 1.0 (normal) |
| Agent produced substantive output (not just HEARTBEAT_OK / NO_REPLY) | Message content analysis (length + tool use) | 0.0–1.0 scaled |
| No unresolved user corrections | Detect "no, I meant..." / re-asks in transcript | 1.0 (none) → 0.5 (corrected) → 0.2 (repeated corrections) |

**Composite:** Average of signals present.

### 2.2 Signal Category: Execution (how well did the agent execute?)

| Signal | How to capture | Score contribution |
|--------|---------------|-------------------|
| Tool call success rate | `successful_calls / total_calls` | 0.0–1.0 ratio |
| First-attempt tool success | `first_attempt_successes / total_calls` (no retries needed) | 0.0–1.0 ratio |
| No error recovery loops | Detect retry patterns in transcript | 1.0 (clean) → 0.5 (recovered) → 0.2 (persistent errors) |
| Sub-agent spawn success | `completed_subagents / spawned_subagents` | 0.0–1.0 ratio (1.0 if no spawns) |

**Composite:** Weighted average — tool success rate has highest weight (0.5), first-attempt (0.25), error recovery (0.15), sub-agents (0.1).

### 2.3 Signal Category: Efficiency (was the session resource-appropriate?)

| Signal | How to capture | Score contribution |
|--------|---------------|-------------------|
| Token efficiency | `output_tokens / input_tokens` ratio — higher is better (more output per context) | Normalized 0.0–1.0 against task-type baseline |
| Turn count efficiency | Turns to completion vs task-type baseline | 1.0 (at/below baseline) → linear decay |
| Compaction events | Count of compaction triggers | 1.0 (none) → 0.8 (1) → 0.5 (2+) |
| Model appropriateness | Was the model tier justified by task complexity? | 1.0 (matched) → 0.7 (over-provisioned) → 0.5 (severely over-provisioned) |

**Composite:** Equal weights.

**Note on model appropriateness:** This requires the intent classifier (INTEL-01) to retroactively classify the task and compare against the model used. Without the classifier, this signal is omitted and weight redistributed.

### 2.4 Signal Category: Outcome (did the work produce measurable results?)

| Signal | How to capture | Score contribution |
|--------|---------------|-------------------|
| Artifact produced | File written, PR opened, message sent, cron job created, etc. | 0.0 (nothing) or 1.0 (artifact exists) |
| External system state changed | GitHub API (PR merged, issue closed), workq (item status changed) | 0.0–1.0 based on outcome |
| Downstream acceptance | PR approved, workq item marked done, no follow-up corrections | 0.0–1.0 |

**Composite:** Weighted — artifact produced (0.3), state changed (0.4), downstream acceptance (0.3). If no external systems involved (pure chat), weight redistributes to Completion.

---

## 3. Task-Type Weighting Profiles

The category weights (w₁–w₄) vary by task type. Task type is determined by session metadata (trigger type, agent role, tools used).

| Task Type | Completion (w₁) | Execution (w₂) | Efficiency (w₃) | Outcome (w₄) |
|-----------|-----------------|-----------------|------------------|---------------|
| **Coding** (PR, implementation) | 0.15 | 0.20 | 0.15 | **0.50** |
| **Operations** (cron, monitoring) | 0.20 | 0.30 | **0.30** | 0.20 |
| **Research/Analysis** | 0.25 | 0.15 | 0.20 | **0.40** |
| **Chat/Advisory** | **0.40** | 0.20 | 0.25 | 0.15 |
| **Discovery/Creative** | 0.30 | 0.15 | 0.20 | **0.35** |
| **Heartbeat/Maintenance** | 0.30 | 0.25 | **0.35** | 0.10 |

**Rationale:**
- Coding sessions: outcome is king — did the PR land?
- Operations: efficiency matters most — was this worth the compute?
- Research: outcome (produced a useful artifact) + completion (answered the question)
- Chat: completion dominates — did the conversation resolve the user's need?
- Discovery: outcome (produced a proposal/prototype) but completion matters too
- Heartbeat: efficiency is critical — these should be cheap and fast

---

## 4. Special Cases

### 4.1 Empty/Idle Sessions
Sessions that produce only HEARTBEAT_OK or NO_REPLY get a fixed score:
- HEARTBEAT_OK with no work needed: **Q = 0.80** (correctly identified nothing to do — good, but low value)
- NO_REPLY in group chat (correctly stayed silent): **Q = 0.75**
- Empty session (error/crash/no output): **Q = 0.0**

### 4.2 Cron Sessions
Cron sessions are evaluated with an additional "was this cron job worth running?" meta-signal:
- Cron that triggered meaningful work: normal scoring applies
- Cron that correctly detected nothing to do and exited fast: Q = 0.80 × efficiency bonus
- Cron that burned tokens to say "nothing to report": Q penalized by cost (the Tim 15-min check problem)

### 4.3 Sub-Agent Chains
Parent session quality incorporates sub-agent quality:
- Parent Q includes a "delegation quality" signal: did spawned sub-agents succeed?
- Sub-agent sessions scored independently for their own ROI
- Parent is not penalized for sub-agent costs (those are separate session costs), only for delegation effectiveness

---

## 5. Scoring Tiers (Human-Readable)

| Score Range | Label | Interpretation |
|------------|-------|----------------|
| 0.90–1.00 | **Excellent** | High-value session, clean execution, clear outcome |
| 0.75–0.89 | **Good** | Solid work, minor inefficiencies or execution hiccups |
| 0.60–0.74 | **Acceptable** | Got the job done but with notable waste or quality issues |
| 0.40–0.59 | **Poor** | Significant problems — worth investigating |
| 0.00–0.39 | **Failed** | Session did not deliver value; cost was likely wasted |

---

## 6. ROI Calculation (for Robert)

With this quality score, Robert's Model Efficiency Ratio becomes:

```
ROI = Q / Cost_session
```

Example:
- Opus session: Q=0.92, Cost=$0.47 → ROI = 1.96
- Sonnet session: Q=0.85, Cost=$0.12 → ROI = 7.08
- MiniMax session: Q=0.70, Cost=$0.03 → ROI = 23.33

This lets us answer: "Is Opus worth 4x the cost of Sonnet?" Only if Q_opus > 4 × Q_sonnet for that task type. Usually it isn't — which is the quantitative argument for model right-sizing.

**Cost-Quality Frontier:** Plot Q vs Cost for all sessions. The optimal models are on the Pareto frontier (highest Q for a given cost, or lowest cost for a given Q). Models/agents consistently below the frontier are candidates for reassignment.

---

## 7. Implementation Approach

### Phase 1: Retroactive Scoring (immediate, no code changes)
- Parse existing session transcripts (JSONL files)
- Extract: tool call results, termination reasons, message patterns, token counts
- Compute Q scores retroactively for last 7 days of sessions
- Output: CSV/JSONL that Robert can join with cost data
- **Cost:** Cheap — just transcript parsing, no API calls
- **Timeline:** Can prototype in a few hours with a script

### Phase 2: Real-Time Scoring (requires telemetry extension)
- Integrate with TEL-01 (telemetry extension) to compute Q at session close
- Store Q score in telemetry DB alongside cost data
- Hook into session lifecycle: on session end → compute Q → emit telemetry event
- **Depends on:** TEL-01 implementation

### Phase 3: Intent-Aware Scoring (requires INTEL-01)
- Use intent classifier to determine task type automatically
- Apply task-type-specific weights
- Enable model appropriateness signal
- Feed Q scores back into dynamic model router (closed loop)
- **Depends on:** INTEL-01 (intent classifier)

---

## 8. What This Does NOT Measure

Be explicit about blind spots:
- **Subjective quality** — Is the writing good? Is the code elegant? This requires human judgment or expensive LLM-as-judge evaluation. Not in scope for automated scoring.
- **Correctness** — Did the agent give the *right* answer? We measure completion and execution, not factual accuracy. Correctness evaluation is a separate, harder problem.
- **User satisfaction** — We infer satisfaction from absence of corrections, but don't measure it directly. Could add optional thumbs-up/down in future.
- **Long-term value** — A research session might score low on immediate outcome but produce insights that matter weeks later. The score is session-scoped and present-tense.

These gaps are acceptable for v1. Each can be addressed incrementally as the system matures.

---

## 9. Validation Plan

Before we trust Q scores for real decisions:
1. Compute Q for 50–100 historical sessions across diverse task types
2. Manually review a sample of 20 sessions and assign human quality ratings (1-5 scale)
3. Correlate automated Q with human ratings — target Pearson r > 0.7
4. Identify and fix systematic biases (e.g., does Q overvalue chat vs coding?)
5. Calibrate weights iteratively until correlation is satisfactory
6. Publish calibrated weights as the v1 standard

---

## 10. Open Questions for Robert

1. **Granularity:** Do you need Q per-session only, or also per-message within a session? Per-session is much cheaper.
2. **Reporting cadence:** Daily digest? Real-time dashboard? Weekly summary?
3. **Cost attribution for sub-agents:** When Agent A spawns Agents B, C, D — is the total cost attributed to A, or split? I'd recommend split (each session has its own cost + Q), with A getting a "delegation quality" component.
4. **Threshold for investigation:** At what Q score do you want automatic alerts? I'd suggest Q < 0.40 triggers a flag.

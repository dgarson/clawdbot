# SLO Baselines — OpenClaw Agent Operations

_Owner: Julia (CAO) · Established: 2026-02-22 · Status: 2-week observation window active_

---

## Purpose

This document defines the **initial SLO baselines** for OpenClaw agent operations. These numbers are **observational targets** — collected over a 2-week window (2026-02-22 → 2026-03-08) before enforcement gates are added in Phase 2.

We are not enforcing SLOs yet. We are establishing what "normal" looks like.

---

## Observation Window

| Phase             | Dates                   | Action                                              |
| ----------------- | ----------------------- | --------------------------------------------------- |
| Phase 1 (this PR) | 2026-02-22 → 2026-03-08 | Instrument + observe. No enforcement.               |
| Phase 2           | 2026-03-08+             | Enable auto-alerting at threshold violations        |
| Phase 3           | TBD                     | Block deployments / gate releases on SLO compliance |

---

## SLO Definitions

### 1. Task Completion Rate (TCR)

> Percentage of agent tasks that complete without a hard failure or timeout.

| Tier                              | Target | Alert at |
| --------------------------------- | ------ | -------- |
| Critical agents (HITL, discovery) | ≥ 95%  | < 90%    |
| Standard agents                   | ≥ 90%  | < 85%    |
| Background / batch agents         | ≥ 80%  | < 75%    |

**Measurement:** `completed_tasks / total_tasks_started` per 24h window  
**Source:** Session JSONL files at `~/.openclaw/agents/<agentId>/sessions/*.jsonl`

---

### 2. Mean Time to First Token (MTTFT)

> Latency from task dispatch to first token received from the model.

| Tier                | Target (p50) | Target (p95) | Alert at (p95) |
| ------------------- | ------------ | ------------ | -------------- |
| Interactive / voice | ≤ 800ms      | ≤ 2s         | > 5s           |
| Standard            | ≤ 2s         | ≤ 8s         | > 15s          |
| Background          | ≤ 10s        | ≤ 30s        | > 60s          |

---

### 3. Tool Call Success Rate (TCSR)

> Percentage of tool invocations that return a non-error result.

| Tool Category       | Target | Alert at |
| ------------------- | ------ | -------- |
| exec / shell        | ≥ 85%  | < 75%    |
| read / write / edit | ≥ 99%  | < 95%    |
| browser             | ≥ 80%  | < 70%    |
| message / notify    | ≥ 95%  | < 90%    |
| All tools combined  | ≥ 90%  | < 82%    |

---

### 4. Agent Stall Rate (ASR)

> Percentage of sessions where the agent stops making progress for > 5 minutes without a terminal state.

| Target               | Alert at |
| -------------------- | -------- |
| ≤ 5% of sessions/day | > 10%    |

**Stall definition:** No tool call or message output for 5+ minutes while session state = active.

---

### 5. Exec Approval Latency (EAL)

> Time from exec-command queued to human approval (HITL gateway). Relevant while exec is approval-gated.

| Target (p50) | Target (p95) | Alert at (p95) |
| ------------ | ------------ | -------------- |
| ≤ 2 min      | ≤ 10 min     | > 30 min       |

**Note:** This SLO applies during the HITL governance window. Once exec gates are relaxed for trusted agents, this becomes a secondary metric.

---

### 6. Weekly Reliability Score (WRS)

> A composite 0–100 score computed by `generate-scorecard.ts`. Aggregates all SLOs above into a single weekly signal.

| Grade | Score  | Meaning                                 |
| ----- | ------ | --------------------------------------- |
| A     | 90–100 | All SLOs met; system healthy            |
| B     | 75–89  | Minor degradation; monitor              |
| C     | 60–74  | Visible reliability issues; investigate |
| D     | 40–59  | Multiple SLOs breached; escalate        |
| F     | < 40   | Critical failure; incident required     |

**Target during observation:** No grade target enforced. Establish baseline.  
**Target post-Phase-2:** Grade ≥ B (score ≥ 75) per week.

---

## Data Sources

| Metric   | Source                                                  |
| -------- | ------------------------------------------------------- |
| TCR, ASR | `~/.openclaw/agents/*/sessions/*.jsonl`                 |
| MTTFT    | Model timing headers in session logs                    |
| TCSR     | Tool invocation records in session JSONL                |
| EAL      | HITL gateway audit log (bs-tim-2 / `feat/hitl-gateway`) |
| WRS      | Computed by `scripts/generate-scorecard.ts`             |

---

## Instrumentation Notes

- Session files are JSONL; each line is a session event with `type`, `timestamp`, and payload
- Tool results with `status: "error"` count as failures for TCSR
- A session ending with `type: "error"` or `type: "timeout"` counts as failed for TCR
- Stall detection requires comparing consecutive event timestamps within active sessions

---

## Phase 2 Roadmap (Post-Observation)

After 2 weeks of data collection (target: 2026-03-08):

1. **Auto-alerting:** Slack alerts to `#ops-reliability` when any SLO drops below alert threshold
2. **Weekly Scorecard Automation:** Schedule `generate-scorecard.ts` via cron each Monday
3. **Dashboard:** Wire WRS into Horizon UI Mission Control (M1 milestone) — Xavier to coordinate
4. **Post-mortem gating:** Require post-mortem doc when WRS drops to grade D or below
5. **Exec trust tiers:** Use TCSR data to auto-promote agents to reduced-HITL exec gates

---

## Owners & Review Cadence

| Role              | Person           | Responsibility                       |
| ----------------- | ---------------- | ------------------------------------ |
| SLO owner         | Julia (CAO)      | Baseline definition, Phase 2 design  |
| Infra integration | Xavier (CTO)     | Hook into tool-reliability layer     |
| Review cadence    | Weekly (Mondays) | Post scorecard in `#ops-reliability` |
| Phase 2 execution | TBD              | Auto-alerting + dashboard wiring     |

---

_See also:_

- `docs/ops/weekly-reliability-scorecard-template.md` — weekly report format
- `scripts/generate-scorecard.ts` — scorecard computation script
- `_shared/workstreams/tool-reliability/WORKSTREAM.md` — reliability layer context

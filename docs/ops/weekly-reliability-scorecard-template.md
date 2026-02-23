# Weekly Reliability Scorecard — Week of {{WEEK_START}}

_Generated: {{GENERATED_AT}} · Author: Julia (CAO) / generate-scorecard.ts_

---

## Summary

| Metric                    | This Week               | Last Week            | Δ               | Target   | Status           |
| ------------------------- | ----------------------- | -------------------- | --------------- | -------- | ---------------- |
| Overall Score (WRS)       | **{{WRS_SCORE}}** / 100 | {{LAST_WRS}}         | {{WRS_DELTA}}   | ≥ 75     | {{WRS_STATUS}}   |
| Task Completion Rate      | {{TCR}}%                | {{LAST_TCR}}%        | {{TCR_DELTA}}   | ≥ 90%    | {{TCR_STATUS}}   |
| Tool Call Success Rate    | {{TCSR}}%               | {{LAST_TCSR}}%       | {{TCSR_DELTA}}  | ≥ 90%    | {{TCSR_STATUS}}  |
| Agent Stall Rate          | {{ASR}}%                | {{LAST_ASR}}%        | {{ASR_DELTA}}   | ≤ 5%     | {{ASR_STATUS}}   |
| MTTFT p95 (standard)      | {{MTTFT_P95}}ms         | {{LAST_MTTFT_P95}}ms | {{MTTFT_DELTA}} | ≤ 8000ms | {{MTTFT_STATUS}} |
| Exec Approval Latency p95 | {{EAL_P95}}min          | {{LAST_EAL_P95}}min  | {{EAL_DELTA}}   | ≤ 10min  | {{EAL_STATUS}}   |

**Grade: {{WRS_GRADE}}** — {{WRS_NARRATIVE}}

---

## Task Completion Rate

**Score: {{TCR}}%** (target: ≥ 90%)

| Agent | Tasks Started | Tasks Completed | Failures | Timeouts | TCR |
| ----- | ------------- | --------------- | -------- | -------- | --- |

{{TCR_AGENT_ROWS}}
| **Total** | **{{TCR_TOTAL_STARTED}}** | **{{TCR_TOTAL_COMPLETED}}** | **{{TCR_TOTAL_FAILURES}}** | **{{TCR_TOTAL_TIMEOUTS}}** | **{{TCR}}%** |

**Notable failures this week:**
{{TCR_NOTABLE_FAILURES}}

---

## Tool Call Success Rate

**Score: {{TCSR}}%** (target: ≥ 90%)

| Tool Category       | Calls                    | Successes                  | Failures                | TCSR              |
| ------------------- | ------------------------ | -------------------------- | ----------------------- | ----------------- |
| exec / shell        | {{TCSR_EXEC_CALLS}}      | {{TCSR_EXEC_SUCCESS}}      | {{TCSR_EXEC_FAIL}}      | {{TCSR_EXEC}}%    |
| read / write / edit | {{TCSR_FS_CALLS}}        | {{TCSR_FS_SUCCESS}}        | {{TCSR_FS_FAIL}}        | {{TCSR_FS}}%      |
| browser             | {{TCSR_BROWSER_CALLS}}   | {{TCSR_BROWSER_SUCCESS}}   | {{TCSR_BROWSER_FAIL}}   | {{TCSR_BROWSER}}% |
| message / notify    | {{TCSR_MSG_CALLS}}       | {{TCSR_MSG_SUCCESS}}       | {{TCSR_MSG_FAIL}}       | {{TCSR_MSG}}%     |
| other               | {{TCSR_OTHER_CALLS}}     | {{TCSR_OTHER_SUCCESS}}     | {{TCSR_OTHER_FAIL}}     | {{TCSR_OTHER}}%   |
| **All tools**       | **{{TCSR_TOTAL_CALLS}}** | **{{TCSR_TOTAL_SUCCESS}}** | **{{TCSR_TOTAL_FAIL}}** | **{{TCSR}}%**     |

**Top failure patterns:**
{{TCSR_TOP_FAILURES}}

---

## Agent Stall Rate

**Score: {{ASR}}%** (target: ≤ 5%)

| Agent | Sessions | Stalls | Stall Rate | Avg Stall Duration |
| ----- | -------- | ------ | ---------- | ------------------ |

{{ASR_AGENT_ROWS}}
| **Total** | **{{ASR_TOTAL_SESSIONS}}** | **{{ASR_TOTAL_STALLS}}** | **{{ASR}}%** | **{{ASR_AVG_DURATION}}min** |

**Stall causes (sampled):**
{{ASR_STALL_CAUSES}}

---

## Latency — Mean Time to First Token (MTTFT)

| Tier        | p50                         | p95                         | p99                         | Target (p95) | Status                       |
| ----------- | --------------------------- | --------------------------- | --------------------------- | ------------ | ---------------------------- |
| Interactive | {{MTTFT_INTERACTIVE_P50}}ms | {{MTTFT_INTERACTIVE_P95}}ms | {{MTTFT_INTERACTIVE_P99}}ms | ≤ 2000ms     | {{MTTFT_INTERACTIVE_STATUS}} |
| Standard    | {{MTTFT_STANDARD_P50}}ms    | {{MTTFT_STANDARD_P95}}ms    | {{MTTFT_STANDARD_P99}}ms    | ≤ 8000ms     | {{MTTFT_STANDARD_STATUS}}    |
| Background  | {{MTTFT_BG_P50}}ms          | {{MTTFT_BG_P95}}ms          | {{MTTFT_BG_P99}}ms          | ≤ 30000ms    | {{MTTFT_BG_STATUS}}          |

---

## Exec Approval Latency (HITL Gate)

**Active during HITL governance window (bs-tim-2)**

| p50            | p95            | p99            | Max            | Total approvals | Rejections       | Auto-approved |
| -------------- | -------------- | -------------- | -------------- | --------------- | ---------------- | ------------- |
| {{EAL_P50}}min | {{EAL_P95}}min | {{EAL_P99}}min | {{EAL_MAX}}min | {{EAL_TOTAL}}   | {{EAL_REJECTED}} | {{EAL_AUTO}}  |

**Note:** {{EAL_NOTE}}

---

## Weekly Reliability Score (WRS) — Breakdown

| Component              | Weight   | Raw Score     | Weighted           |
| ---------------------- | -------- | ------------- | ------------------ |
| Task Completion Rate   | 30%      | {{TCR_RAW}}   | {{TCR_WEIGHTED}}   |
| Tool Call Success Rate | 25%      | {{TCSR_RAW}}  | {{TCSR_WEIGHTED}}  |
| Agent Stall Rate       | 20%      | {{ASR_RAW}}   | {{ASR_WEIGHTED}}   |
| MTTFT (p95)            | 15%      | {{MTTFT_RAW}} | {{MTTFT_WEIGHTED}} |
| Exec Approval Latency  | 10%      | {{EAL_RAW}}   | {{EAL_WEIGHTED}}   |
| **Total**              | **100%** | —             | **{{WRS_SCORE}}**  |

**Grade: {{WRS_GRADE}}**

---

## Incidents & Post-Mortems

{{INCIDENTS_THIS_WEEK}}

_No incidents_ (placeholder — update if any occurred)

---

## Action Items

| #   | Item | Owner | Due | Priority |
| --- | ---- | ----- | --- | -------- |

{{ACTION_ITEMS}}

---

## Trend (Last 4 Weeks)

| Week               | WRS               | Grade             | TCR          | TCSR          | ASR          |
| ------------------ | ----------------- | ----------------- | ------------ | ------------- | ------------ |
| {{WEEK_MINUS_3}}   | {{WRS_W3}}        | {{GRADE_W3}}      | {{TCR_W3}}%  | {{TCSR_W3}}%  | {{ASR_W3}}%  |
| {{WEEK_MINUS_2}}   | {{WRS_W2}}        | {{GRADE_W2}}      | {{TCR_W2}}%  | {{TCSR_W2}}%  | {{ASR_W2}}%  |
| {{WEEK_MINUS_1}}   | {{WRS_W1}}        | {{GRADE_W1}}      | {{TCR_W1}}%  | {{TCSR_W1}}%  | {{ASR_W1}}%  |
| **{{WEEK_START}}** | **{{WRS_SCORE}}** | **{{WRS_GRADE}}** | **{{TCR}}%** | **{{TCSR}}%** | **{{ASR}}%** |

---

## Notes

{{SCORECARD_NOTES}}

---

_Generated by `scripts/generate-scorecard.ts` · Baseline: `docs/ops/slo-baselines.md`_  
_Distribution: `#ops-reliability` (Slack) · Archived: `docs/ops/scorecards/YYYY-WW.md`_

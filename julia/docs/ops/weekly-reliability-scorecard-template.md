# Weekly Reliability Scorecard

> **Week of:** {{WEEK_START}} — {{WEEK_END}}
> **Generated:** {{GENERATED_AT}}
> **Author:** Julia (CAO) / Auto-generated via `scripts/generate-scorecard.ts`
> **Status:** {{OVERALL_STATUS}}

---

## Executive Summary

**Overall Health:** {{OVERALL_RAG}} {{OVERALL_STATUS}}

{{EXECUTIVE_SUMMARY}}

| Dimension | Status | Trend | Key Signal |
|-----------|--------|-------|------------|
| Agent Latency | {{LATENCY_RAG}} | {{LATENCY_TREND}} | {{LATENCY_SIGNAL}} |
| Cron Jobs | {{CRON_RAG}} | {{CRON_TREND}} | {{CRON_SIGNAL}} |
| Tool Calls | {{TOOL_RAG}} | {{TOOL_TREND}} | {{TOOL_SIGNAL}} |
| Discovery Pipeline | {{DISCOVERY_RAG}} | {{DISCOVERY_TREND}} | {{DISCOVERY_SIGNAL}} |
| Context Budget | {{CONTEXT_RAG}} | {{CONTEXT_TREND}} | {{CONTEXT_SIGNAL}} |
| Cost | {{COST_RAG}} | {{COST_TREND}} | {{COST_SIGNAL}} |

**Legend:** 🟢 Healthy | 🟡 Warning | 🔴 Critical | ⬆️ Improving | ➡️ Stable | ⬇️ Degrading

---

## 1. Agent Response Latency

**Status:** {{LATENCY_RAG}} | **Trend:** {{LATENCY_TREND}} vs. prior week

| Percentile | Target | This Week | Last Week | Delta | Status |
|------------|--------|-----------|-----------|-------|--------|
| p50 | ≤ 30s | {{P50_VALUE}} | {{P50_PREV}} | {{P50_DELTA}} | {{P50_RAG}} |
| p95 | ≤ 120s | {{P95_VALUE}} | {{P95_PREV}} | {{P95_DELTA}} | {{P95_RAG}} |
| p99 | ≤ 300s | {{P99_VALUE}} | {{P99_PREV}} | {{P99_DELTA}} | {{P99_RAG}} |

**Breakdown by agent tier:**

| Tier | p50 | p95 | Sessions | Status |
|------|-----|-----|----------|--------|
| C-suite | {{CSUITE_P50}} | {{CSUITE_P95}} | {{CSUITE_SESSIONS}} | {{CSUITE_RAG}} |
| Leads | {{LEADS_P50}} | {{LEADS_P95}} | {{LEADS_SESSIONS}} | {{LEADS_RAG}} |
| Workers | {{WORKERS_P50}} | {{WORKERS_P95}} | {{WORKERS_SESSIONS}} | {{WORKERS_RAG}} |

**Slowest agents this week:**
1. {{SLOW_AGENT_1}} — {{SLOW_AGENT_1_P95}} p95
2. {{SLOW_AGENT_2}} — {{SLOW_AGENT_2_P95}} p95
3. {{SLOW_AGENT_3}} — {{SLOW_AGENT_3_P95}} p95

**Notes:** {{LATENCY_NOTES}}

---

## 2. Cron Job Success Rate

**Status:** {{CRON_RAG}} | **Trend:** {{CRON_TREND}} vs. prior week

| Metric | Target | This Week | Last Week | Status |
|--------|--------|-----------|-----------|--------|
| Success rate | ≥ 98% | {{CRON_SUCCESS_RATE}} | {{CRON_SUCCESS_PREV}} | {{CRON_SUCCESS_RAG}} |
| Total executions | — | {{CRON_TOTAL}} | {{CRON_TOTAL_PREV}} | — |
| Failures | — | {{CRON_FAILURES}} | {{CRON_FAILURES_PREV}} | {{CRON_FAILURES_RAG}} |
| Max consecutive failures | 0 | {{CRON_CONSEC_FAIL}} | {{CRON_CONSEC_PREV}} | {{CRON_CONSEC_RAG}} |

**Failed cron jobs this week:**

| Job | Agent | Failures | Error Category | Status |
|-----|-------|----------|----------------|--------|
| {{CRON_FAIL_1_JOB}} | {{CRON_FAIL_1_AGENT}} | {{CRON_FAIL_1_COUNT}} | {{CRON_FAIL_1_CAT}} | {{CRON_FAIL_1_RAG}} |
| {{CRON_FAIL_2_JOB}} | {{CRON_FAIL_2_AGENT}} | {{CRON_FAIL_2_COUNT}} | {{CRON_FAIL_2_CAT}} | {{CRON_FAIL_2_RAG}} |
| {{CRON_FAIL_3_JOB}} | {{CRON_FAIL_3_AGENT}} | {{CRON_FAIL_3_COUNT}} | {{CRON_FAIL_3_CAT}} | {{CRON_FAIL_3_RAG}} |

**Notes:** {{CRON_NOTES}}

---

## 3. Tool Call Success Rate

**Status:** {{TOOL_RAG}} | **Trend:** {{TOOL_TREND}} vs. prior week

| Metric | Target | This Week | Last Week | Status |
|--------|--------|-----------|-----------|--------|
| Overall success rate | ≥ 95% | {{TOOL_SUCCESS_RATE}} | {{TOOL_SUCCESS_PREV}} | {{TOOL_SUCCESS_RAG}} |
| Retry rate | ≤ 5% | {{TOOL_RETRY_RATE}} | {{TOOL_RETRY_PREV}} | {{TOOL_RETRY_RAG}} |
| Hallucinated calls | ≤ 1% | {{TOOL_HALLUC_RATE}} | {{TOOL_HALLUC_PREV}} | {{TOOL_HALLUC_RAG}} |

**Per-model breakdown:**

| Model Family | Target | Success Rate | Retries | Status |
|--------------|--------|-------------|---------|--------|
| Claude | ≥ 97% | {{CLAUDE_SUCCESS}} | {{CLAUDE_RETRIES}} | {{CLAUDE_RAG}} |
| GPT-4o / o3 | ≥ 95% | {{GPT_SUCCESS}} | {{GPT_RETRIES}} | {{GPT_RAG}} |
| Gemini 2.x | ≥ 93% | {{GEMINI_SUCCESS}} | {{GEMINI_RETRIES}} | {{GEMINI_RAG}} |
| MiniMax M2.5 | ≥ 92% | {{MINIMAX_SUCCESS}} | {{MINIMAX_RETRIES}} | {{MINIMAX_RAG}} |

**Top failing tools:**
1. `{{FAIL_TOOL_1}}` — {{FAIL_TOOL_1_RATE}} failure rate ({{FAIL_TOOL_1_COUNT}} calls)
2. `{{FAIL_TOOL_2}}` — {{FAIL_TOOL_2_RATE}} failure rate ({{FAIL_TOOL_2_COUNT}} calls)
3. `{{FAIL_TOOL_3}}` — {{FAIL_TOOL_3_RATE}} failure rate ({{FAIL_TOOL_3_COUNT}} calls)

**Notes:** {{TOOL_NOTES}}

---

## 4. Discovery Pipeline

**Status:** {{DISCOVERY_RAG}} | **Trend:** {{DISCOVERY_TREND}} vs. prior week

| Metric | Target | This Week | Last Week | Status |
|--------|--------|-----------|-----------|--------|
| Wave completion rate | ≥ 90% | {{WAVE_COMPLETION}} | {{WAVE_COMPLETION_PREV}} | {{WAVE_COMPLETION_RAG}} |
| Items processed (avg/wave) | ≥ 80% | {{ITEMS_PROCESSED}} | {{ITEMS_PROCESSED_PREV}} | {{ITEMS_PROCESSED_RAG}} |
| Avg wave latency | ≤ 15 min | {{WAVE_LATENCY}} | {{WAVE_LATENCY_PREV}} | {{WAVE_LATENCY_RAG}} |
| Total waves this week | — | {{TOTAL_WAVES}} | {{TOTAL_WAVES_PREV}} | — |

**Wave detail:**

| Wave ID | Started | Duration | Items In | Items OK | Errors | Status |
|---------|---------|----------|----------|----------|--------|--------|
| {{WAVE_1_ID}} | {{WAVE_1_START}} | {{WAVE_1_DUR}} | {{WAVE_1_IN}} | {{WAVE_1_OK}} | {{WAVE_1_ERR}} | {{WAVE_1_RAG}} |
| {{WAVE_2_ID}} | {{WAVE_2_START}} | {{WAVE_2_DUR}} | {{WAVE_2_IN}} | {{WAVE_2_OK}} | {{WAVE_2_ERR}} | {{WAVE_2_RAG}} |
| {{WAVE_3_ID}} | {{WAVE_3_START}} | {{WAVE_3_DUR}} | {{WAVE_3_IN}} | {{WAVE_3_OK}} | {{WAVE_3_ERR}} | {{WAVE_3_RAG}} |

**Notes:** {{DISCOVERY_NOTES}}

---

## 5. Agent Context Budget

**Status:** {{CONTEXT_RAG}} | **Trend:** {{CONTEXT_TREND}} vs. prior week

| Metric | Target | This Week | Last Week | Status |
|--------|--------|-----------|-----------|--------|
| Avg utilization | ≤ 60% | {{CTX_AVG_UTIL}} | {{CTX_AVG_PREV}} | {{CTX_AVG_RAG}} |
| Sessions hitting warn (75%) | ≤ 15% | {{CTX_WARN_PCT}} | {{CTX_WARN_PREV}} | {{CTX_WARN_RAG}} |
| Sessions hitting critical (90%) | ≤ 5% | {{CTX_CRIT_PCT}} | {{CTX_CRIT_PREV}} | {{CTX_CRIT_RAG}} |
| Compaction events | ≤ 10% | {{CTX_COMPACT_PCT}} | {{CTX_COMPACT_PREV}} | {{CTX_COMPACT_RAG}} |

**Agents with highest context utilization:**

| Agent | Avg Utilization | Peak | Compactions | Status |
|-------|----------------|------|-------------|--------|
| {{CTX_AGENT_1}} | {{CTX_AGENT_1_AVG}} | {{CTX_AGENT_1_PEAK}} | {{CTX_AGENT_1_COMPACT}} | {{CTX_AGENT_1_RAG}} |
| {{CTX_AGENT_2}} | {{CTX_AGENT_2_AVG}} | {{CTX_AGENT_2_PEAK}} | {{CTX_AGENT_2_COMPACT}} | {{CTX_AGENT_2_RAG}} |
| {{CTX_AGENT_3}} | {{CTX_AGENT_3_AVG}} | {{CTX_AGENT_3_PEAK}} | {{CTX_AGENT_3_COMPACT}} | {{CTX_AGENT_3_RAG}} |

**Notes:** {{CONTEXT_NOTES}}

---

## 6. Cost

**Status:** {{COST_RAG}} | **Trend:** {{COST_TREND}} vs. prior week

| Metric | Warn | Critical | This Week | Last Week | Status |
|--------|------|----------|-----------|-----------|--------|
| Total org spend | $400/wk | $750/wk | {{COST_TOTAL}} | {{COST_TOTAL_PREV}} | {{COST_TOTAL_RAG}} |
| Daily avg | $80/day | $150/day | {{COST_DAILY_AVG}} | {{COST_DAILY_PREV}} | {{COST_DAILY_RAG}} |
| Peak day | — | — | {{COST_PEAK_DAY}} ({{COST_PEAK_AMOUNT}}) | — | — |

**Per-tier breakdown:**

| Tier | Budget/day | Actual Avg/day | Status |
|------|-----------|----------------|--------|
| C-suite | $8.00 warn | {{CSUITE_COST_AVG}} | {{CSUITE_COST_RAG}} |
| Leads | $6.00 warn | {{LEADS_COST_AVG}} | {{LEADS_COST_RAG}} |
| Workers | $4.00 warn | {{WORKERS_COST_AVG}} | {{WORKERS_COST_RAG}} |
| Merlin | $12.00 warn | {{MERLIN_COST_AVG}} | {{MERLIN_COST_RAG}} |

**Top spending agents:**
1. {{COST_AGENT_1}} — {{COST_AGENT_1_TOTAL}} ({{COST_AGENT_1_DAILY}} avg/day)
2. {{COST_AGENT_2}} — {{COST_AGENT_2_TOTAL}} ({{COST_AGENT_2_DAILY}} avg/day)
3. {{COST_AGENT_3}} — {{COST_AGENT_3_TOTAL}} ({{COST_AGENT_3_DAILY}} avg/day)

**Notes:** {{COST_NOTES}}

---

## Top 3 Incidents

| # | Incident | Severity | Root Cause | Impact | Resolution |
|---|----------|----------|------------|--------|------------|
| 1 | {{INCIDENT_1_DESC}} | {{INCIDENT_1_SEV}} | {{INCIDENT_1_CAUSE}} | {{INCIDENT_1_IMPACT}} | {{INCIDENT_1_RESOLUTION}} |
| 2 | {{INCIDENT_2_DESC}} | {{INCIDENT_2_SEV}} | {{INCIDENT_2_CAUSE}} | {{INCIDENT_2_IMPACT}} | {{INCIDENT_2_RESOLUTION}} |
| 3 | {{INCIDENT_3_DESC}} | {{INCIDENT_3_SEV}} | {{INCIDENT_3_CAUSE}} | {{INCIDENT_3_IMPACT}} | {{INCIDENT_3_RESOLUTION}} |

---

## Action Items

### Carried from Last Week

| # | Action | Owner | Status | Notes |
|---|--------|-------|--------|-------|
| {{PREV_ACTION_1_NUM}} | {{PREV_ACTION_1_DESC}} | {{PREV_ACTION_1_OWNER}} | {{PREV_ACTION_1_STATUS}} | {{PREV_ACTION_1_NOTES}} |
| {{PREV_ACTION_2_NUM}} | {{PREV_ACTION_2_DESC}} | {{PREV_ACTION_2_OWNER}} | {{PREV_ACTION_2_STATUS}} | {{PREV_ACTION_2_NOTES}} |

### New This Week

| # | Action | Owner | Priority | Due |
|---|--------|-------|----------|-----|
| 1 | {{NEW_ACTION_1_DESC}} | {{NEW_ACTION_1_OWNER}} | {{NEW_ACTION_1_PRI}} | {{NEW_ACTION_1_DUE}} |
| 2 | {{NEW_ACTION_2_DESC}} | {{NEW_ACTION_2_OWNER}} | {{NEW_ACTION_2_PRI}} | {{NEW_ACTION_2_DUE}} |
| 3 | {{NEW_ACTION_3_DESC}} | {{NEW_ACTION_3_OWNER}} | {{NEW_ACTION_3_PRI}} | {{NEW_ACTION_3_DUE}} |

---

## Appendix: Data Sources

| Source | Status | Coverage | Notes |
|--------|--------|----------|-------|
| Telemetry JSONL sink (PR #47) | {{TEL_STATUS}} | {{TEL_COVERAGE}} | {{TEL_NOTES}} |
| Cost tracker | {{COST_TRACKER_STATUS}} | {{COST_TRACKER_COVERAGE}} | {{COST_TRACKER_NOTES}} |
| Cron execution logs | {{CRON_LOG_STATUS}} | {{CRON_LOG_COVERAGE}} | {{CRON_LOG_NOTES}} |
| Pipeline instrumentation | {{PIPE_STATUS}} | {{PIPE_COVERAGE}} | {{PIPE_NOTES}} |

---

*Generated by `scripts/generate-scorecard.ts` | SLO definitions: `docs/ops/slo-baselines.md`*

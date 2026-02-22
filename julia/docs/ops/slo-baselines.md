# SLO Baselines — OpenClaw Agent Organization

> **Owner:** Julia (CAO)
> **Created:** 2026-02-22
> **Review cadence:** Monthly (adjust baselines as system matures)
> **Status:** v1.0 — Initial baselines, pending first 4 weeks of measurement

---

## Overview

This document defines Service Level Objectives (SLOs) for the OpenClaw agent platform. These baselines cover the 26-agent organization, 40+ cron jobs, and the live discovery pipeline. All targets are intentionally conservative for v1 — tighten after 4 weeks of data collection.

---

## 1. Agent Response Latency

Measures end-to-end wall-clock time from task assignment to final response delivery (excluding queued wait time).

| Percentile | Target | Warn | Critical | Notes |
|------------|--------|------|----------|-------|
| **p50** | ≤ 30s | > 45s | > 60s | Median response for routine tasks |
| **p95** | ≤ 120s | > 180s | > 300s | Complex tasks with tool calls |
| **p99** | ≤ 300s | > 450s | > 600s | Multi-step workflows, sub-agent chains |

**Measurement source:** Session telemetry — `startedAt` to `completedAt` timestamps.

**Exclusions:**
- Sub-agent spawn latency (measured separately)
- Tasks explicitly marked as long-running (e.g., full codebase scans)
- Queued wait time before assignment

**Breakdown dimensions:**
- By agent role (C-suite vs. lead vs. worker)
- By task type (heartbeat, spawned task, cron-triggered)
- By model family (Claude, GPT, Gemini, MiniMax, etc.)

---

## 2. Cron Job Success Rate

Measures whether scheduled cron jobs complete without error.

| Metric | Target | Warn | Critical |
|--------|--------|------|----------|
| **Success rate** | ≥ 98% | < 98% | < 95% |
| **Consecutive failures** | 0 | ≥ 2 | ≥ 3 |
| **Max lateness** | ≤ 5 min | > 10 min | > 30 min |

**Measurement source:** Cron execution logs — exit codes and timestamps.

**What counts as failure:**
- Non-zero exit code
- Timeout (job exceeds 2× expected duration)
- Partial completion (job starts but does not reach completion marker)

**Tracked cron categories:**
- Heartbeats (per-agent scheduled health cycles)
- Discovery pipeline triggers
- Maintenance jobs (memory cleanup, workspace tidying)
- Reporting/aggregation jobs

---

## 3. Tool Call Success Rate (per Model Family)

Measures whether tool invocations return valid results without errors, hallucinated parameters, or retries.

| Metric | Target | Warn | Critical |
|--------|--------|------|----------|
| **Success rate (all models)** | ≥ 95% | < 95% | < 90% |
| **Retry rate** | ≤ 5% | > 8% | > 15% |
| **Hallucinated tool call rate** | ≤ 1% | > 2% | > 5% |

**Per-model-family targets:**

| Model Family | Success Target | Notes |
|--------------|---------------|-------|
| Claude (Sonnet/Opus) | ≥ 97% | Primary workhorse — highest bar |
| GPT-4o / o3 | ≥ 95% | Good tool calling, occasional schema drift |
| Gemini 2.x | ≥ 93% | Newer integration, wider tolerance initially |
| MiniMax M2.5 | ≥ 92% | Less mature tool support, monitor closely |
| Other / experimental | ≥ 88% | Evaluation-phase models |

**Measurement source:** Telemetry JSONL sink — tool call events with `status`, `error`, `retryCount` fields.

**What counts as failure:**
- Tool returns an error response
- Tool call has malformed/hallucinated parameters
- Tool call times out
- Tool call requires ≥ 2 retries to succeed (counts as degraded, not failed)

---

## 4. Discovery Pipeline Completion Rate

Measures whether discovery pipeline waves complete successfully and produce expected output.

| Metric | Target | Warn | Critical |
|--------|--------|------|----------|
| **Wave completion rate** | ≥ 90% | < 90% | < 80% |
| **Items processed per wave** | ≥ 80% of expected | < 80% | < 60% |
| **Pipeline end-to-end latency** | ≤ 15 min/wave | > 20 min | > 30 min |

**Measurement source:** Pipeline execution logs — wave start/end markers, item counts.

**What counts as incomplete:**
- Wave starts but does not reach completion marker
- Wave completes but processes < 80% of input items
- Wave produces output with > 10% error rate in processed items

**Tracked dimensions:**
- Per-wave completion status
- Items in vs. items successfully processed
- Error categorization (transient vs. systematic)

---

## 5. Agent Context Budget

Measures context window utilization to prevent degraded performance from context overflow.

| Metric | Target | Warn | Critical |
|--------|--------|------|----------|
| **Context utilization (steady state)** | ≤ 60% | > 75% | > 90% |
| **Sessions hitting compaction** | ≤ 10% | > 15% | > 25% |
| **Context-related failures** | ≤ 1% | > 2% | > 5% |

**Measurement source:** Session metadata — `contextTokens`, `maxContextTokens`, compaction events.

**Thresholds by model context window:**

| Model Context | 75% Warn | 90% Critical |
|--------------|----------|--------------|
| 128K tokens | 96K | 115K |
| 200K tokens | 150K | 180K |
| 1M tokens | 750K | 900K |

**What to watch:**
- Agents that routinely exceed 75% are candidates for task decomposition or memory optimization
- Compaction events indicate the agent is working inefficiently — too much context accumulation
- Context-related failures (truncation, dropped tools) are critical quality signals

---

## 6. Per-Agent Cost Guardrails

Measures daily spend per agent to detect runaway sessions and inefficient patterns.

| Agent Tier | Daily Warn | Daily Critical | Notes |
|------------|-----------|---------------|-------|
| **C-suite** (David, Xavier, Julia, etc.) | > $8.00 | > $15.00 | Strategic work, higher baseline |
| **Leads** (Tim, Roman, Claire, Luis) | > $6.00 | > $12.00 | Coordination + some execution |
| **Workers** (Sandy, Tony, Barry, etc.) | > $4.00 | > $8.00 | Execution-focused |
| **Merlin** (Main Agent) | > $12.00 | > $20.00 | High-volume coordination hub |

**Measurement source:** Cost tracker output (when available) or token-based estimation from telemetry.

**Aggregate guardrails:**

| Metric | Warn | Critical |
|--------|------|----------|
| **Total daily org spend** | > $80 | > $150 |
| **Total weekly org spend** | > $400 | > $750 |
| **Single session cost** | > $3.00 | > $6.00 |

**Cost estimation formula (when tracker unavailable):**
```
estimated_cost = (input_tokens × input_rate + output_tokens × output_rate) per model
```

**What triggers investigation:**
- Any agent exceeding daily critical threshold
- Org spend exceeding weekly warn for 2+ consecutive weeks
- Single session > $3.00 (likely a loop or inefficient pattern)
- Cost per completed task trending upward week-over-week

---

## SLO Summary Table

| SLO Dimension | Target | Warn | Critical | Measurement Window |
|---------------|--------|------|----------|-------------------|
| Agent latency p50 | ≤ 30s | > 45s | > 60s | Rolling 24h |
| Agent latency p95 | ≤ 120s | > 180s | > 300s | Rolling 24h |
| Agent latency p99 | ≤ 300s | > 450s | > 600s | Rolling 7d |
| Cron success rate | ≥ 98% | < 98% | < 95% | Rolling 7d |
| Tool call success (all) | ≥ 95% | < 95% | < 90% | Rolling 24h |
| Discovery wave completion | ≥ 90% | < 90% | < 80% | Per wave |
| Context utilization | ≤ 60% | > 75% | > 90% | Per session |
| Daily cost (org total) | — | > $80 | > $150 | Daily |

---

## Baseline Review Schedule

| Week | Action |
|------|--------|
| Week 1–2 | Collect data, do not alert (observation period) |
| Week 3–4 | Enable warn-level alerts, validate thresholds |
| Week 5+ | Full alerting active, begin weekly scorecards |
| Month 3 | First baseline review — tighten targets based on actuals |
| Quarterly | Ongoing review — adjust for model changes, org growth |

---

## Dependencies

- **Telemetry JSONL sink** (PR #47) — primary data source for latency, tool calls, context
- **Cost tracker** — needed for per-agent cost guardrails (Robert's domain)
- **Cron execution logs** — needed for cron success rate
- **Discovery pipeline instrumentation** — needed for wave completion metrics

---

## Escalation Matrix

| Severity | Who Gets Notified | Response Time |
|----------|-------------------|---------------|
| 🟢 All green | Weekly scorecard only | N/A |
| 🟡 Warn threshold hit | Julia (CAO) reviews | Within 24h |
| 🔴 Critical threshold hit | Julia + Xavier (CTO) | Within 4h |
| 🔴 Multiple critical | Julia + Xavier + David | Within 1h |
| 💀 Cascade failure (3+ agents) | All C-suite | Immediate |

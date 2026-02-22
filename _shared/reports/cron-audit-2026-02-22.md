# Cron Job Audit — February 22, 2026

**Prepared by:** Robert (CFO) & Julia (CAO)  
**Date:** February 22, 2026  
**Scope:** All 50 scheduled cron jobs (9 interval-based, 41 scheduled)  
**Purpose:** Review and recommend — no changes applied

---

## Executive Summary

This audit examined 50 scheduled jobs totaling approximately **776 agent-cycles per day** (interval + scheduled combined). We identified significant redundancy, cost concerns, and consolidation opportunities that could reduce operational load by 25-40% without sacrificing coverage.

**Key Findings:**
- **4 jobs** are immediate candidates for removal (redundant/disabled)
- **6 consolidation pairs** could reduce daily runs by ~140/day
- **3 frequency adjustments** could reduce daily invocations by ~50/day
- Estimated total daily runs could drop from ~776 to ~530 (32% reduction)

*Note: Billing is per token consumed (thinking + context + output), not wall-time. "Timeout" is a safety ceiling only.*

---

## Immediate Candidates for Removal/Disabling

| Job | Issue | Recommendation |
|-----|-------|----------------|
| **Evening Brief (DISABLED)** | Already overlaps with Night Brief + Pre-Bedtime; has 1 error | **Delete** — not worth resurrecting |
| **Luis UX Work Check (Hourly)** | 24 runs/day; UX work doesn't require hourly polling — each invocation loads context and thinking tokens | **Reduce to 3-4x/day** |
| **Discovery: Larry (Docs)** | Overlaps with Discovery: Sam (Doc Improvements); redundant coverage | **Consolidate into Sam's slot** |
| **Inbox Triage Monitor (main)** | Duplicates Xavier's Instruction Triage; both scan #cb-inbox every 5min — 576 redundant invocations/day | **Merge into single 5min job** |

---

## Redundancy Analysis

### Critical Overlaps

| Job A | Job B | Overlap | Daily Combined Runs |
|-------|-------|---------|---------------------|
| Inbox Triage Monitor (main) | Instruction Triage (Xavier) | Both scan #cb-inbox | 576 |
| Morning Brief (6am) | Morning Brief (7:30am) | Both morning status updates | 2 |
| Night Brief (10pm) | Pre-Bedtime Check (10:30pm) | Both end-of-day reviews | 2 |
| Julia Org Scan (3x) | Julia Org Health Check (3h) | Org health coverage | 11 |
| Julia Autonomy Audit (6h) | Julia Autonomy Report (8am) | Autonomy assessment | 5 |
| Discovery: Larry | Discovery: Sam | Both documentation focus | 2 |

### Inbox Triage Deep Dive
Two jobs scanning the same inbox every 5 minutes = **576 scans per day**. This is excessive for any inbox. Recommend single unified job with slightly longer timeout to cover both workloads.

### Julia's Org Health Triplication
Three separate jobs covering organizational health:
- Julia Org Scan: 3x daily (9am, 1pm, 5pm) — 600s timeout
- Julia Org Health Check: every 3h — 300s timeout  
- Julia Autonomy Audit: every 6h — 300s timeout

**Current:** 8 + 8 + 4 = 20 runs/week  
**Recommended:** 1 unified job (every 3h) = 8 runs/week

---

## Consolidation Opportunities

### High-Impact Mergers

| Current State | Consolidated Proposal | Runs Saved/Day |
|---------------|----------------------|----------------|
| Inbox Triage + Instruction Triage | Single 5min job | -288 |
| Morning Brief 6am + 7:30am | Single 7am brief | -1 |
| Night Brief + Pre-Bedtime | Single 10pm check | -1 |
| Julia's 3 org jobs | Unified org+autonomy (3h) | -8 |
| Larry + Sam docs | Single afternoon doc slot | -1 |

### Medium-Impact Mergers

| Current State | Proposal | Runs Saved/Day |
|---------------|----------|----------------|
| Brainstorm AM + PM | Keep separate (different focus times) | — |
| Strategic Priority + Backlog Sweep | Keep separate (different focus) | — |

---

## Schedule Optimization Recommendations

### Discovery Agents (15 agents, daily M-F)

**Current:** 15 agents × 1 run/day × 5 days = 75 runs/week  
**Recommended:** 15 agents × 3 runs/week = 45 runs/week (40% reduction)

| Agent | Current | Proposed |
|-------|---------|----------|
| roman, claire, sandy, tony | Daily 10am-11am block | Mon/Wed/Fri |
| barry, jerry, harry, larry | Daily 2-3pm block | Mon/Wed/Fri |
| nate, oscar, sam, piper, quinn, reed, vince | Daily 7-8pm block | Tue/Thu |
| Tim Discovery Review | Daily 4pm | Keep daily (synthesis) |

**Rationale:** Daily discovery scans generate backlog that can't be addressed faster than 2-3x/week. Each invocation costs tokens (context load + thinking), so reducing frequency directly reduces token spend.

### Luis UX Work Check

**Current:** 24 runs/day (hourly)  
**Recommended:** 4 runs/day (every 6h)

**Savings:** 20 fewer invocations/day (83% reduction)

### Tim Workq Progress Check

**Current:** Every hour (24 runs/day)  
**Recommended:** Every 2 hours (12 runs/day)

**Savings:** 12 fewer invocations/day (50% reduction)

### Xavier Engineering Sprints

**Current:** 4 cycles daily + standup = 5 jobs/day  
**Assessment:** Appropriate for engineering cadence; keep as-is

---

## Jobs to Keep As-Is (with rationale)

| Job | Rationale |
|-----|-----------|
| Context Watchdog (15min) | Session health monitoring — critical |
| Strategic Priority Cycle (3h) | Strategic orchestration — unique function |
| Backlog Sweep (3h) | Memory/PR review — complements Strategic Priority |
| Xavier Morning Standup | Engineering-specific; distinct from briefs |
| C-Suite Morning Sync | Leadership coordination |
| Joey Product Standup | Product-specific |
| Marketing Sprint (M/W/F) | Weekday cadence appropriate |
| Data Review (Tue/Thu) | Aligned to data team cadence |
| Weekly Finance/Legal | Weekly cadence appropriate |
| Tim Discovery Review | Synthesis needs daily frequency |
| Brainstorm AM/PM | Different focus times justified |

---

## Estimated Impact

### Before Optimization

| Category | Runs/Day | Notes |
|----------|----------|-------|
| Interval-based jobs | ~724 | High-frequency scans |
| Scheduled jobs | ~52 | One-time triggers |
| **TOTAL** | **~776** | |

### After Optimization (Conservative Estimate)

| Category | Runs/Day | Change |
|----------|----------|--------|
| Interval-based jobs | ~430 | -41% |
| Scheduled jobs | ~40 | -23% |
| **TOTAL** | **~470** | -32% |

### Token Cost Analysis
- Each cron invocation loads context + runs thinking (low/medium/high) + produces output
- Frequency is the primary cost driver: more invocations = more tokens consumed
- Reducing 306 daily runs saves approximately **306 × (avg tokens/run) × 30 days** in monthly token spend
- Estimated token savings: ~30% reduction in cron-related token consumption

---

## Robert's Financial Assessment

The current cron job architecture runs approximately **776 invocations per day**. Billing is per token consumed — each invocation loads context, runs thinking (low/medium/high), and produces output. **Frequency is the primary cost driver.**

**The Problem:** Too many jobs running too frequently, each consuming tokens regardless of how quickly they complete.

**Key Cost Drivers (by invocation volume):**
1. **Inbox Triage × 2:** 576 invocations/day — each scan loads context + thinking tokens for a short task
2. **Luis UX:** 24 invocations/day — hourly polling that doesn't need that frequency
3. **Discovery agents:** 75 invocations/week — 15 agents × 5 days, each loading full context
4. **Tim Workq:** 24 invocations/day — hourly progress checks

**Token Cost Implications:**
- Each low-thinking scan (inbox triage): ~10K-20K tokens/run
- Each medium-thinking job (Discovery): ~50K-100K tokens/run  
- Reducing 306 daily invocations = substantial monthly token savings
- At ~$2.50/1M input tokens: 30% fewer cron invocations = meaningful reduction

**ROI on Optimization:** 32% reduction in invocations = ~30% cron-related token savings. For context, if cron jobs consume ~20% of total tokens, this is ~6% of total bill.

**Risk:** Reducing job frequency means slightly slower response times. For Luis and Discovery agents, this is acceptable trade-off. For Context Watchdog and inbox triage, keeping 5-minute intervals is justified.

---

## Julia's Org Efficiency Assessment

From an organizational operations perspective, the current setup has **three structural inefficiencies**:

### 1. Redundant Scanning (Inbox)
Two agents scanning the same inbox creates race conditions and duplicate work. The inbox gets triaged twice in parallel every 5 minutes — that's 576 scans daily for content that changes maybe 20 times.

### 2. Overlapping Leadership Cadence
Three morning briefings within 90 minutes (6am, 7:30am, 8am standups) and two end-of-day reviews within 30 minutes (10pm, 10:30pm). These could be consolidated into single morning and evening checkpoints.

### 3. Discovery Agent Fatigue
15 agents running daily creates a "discovery industrial complex" — more findings generated than can be acted upon. The backlog compounds. Shifting to 3x/week cadence improves signal-to-noise ratio and gives the team actionable focus.

**What Works:**
- C-suite standup cadence (8am block) is well-structured
- Engineering sprint cycles provide good coverage
- Weekly reviews (Finance, Legal, Data) are appropriately timed

---

## Recommended Actions (Prioritized)

| Priority | Action | Impact | Effort |
|----------|--------|--------|--------|
| **1** | Merge Inbox Triage + Instruction Triage | -288 invocations/day | Low |
| **2** | Reduce Luis UX: hourly → 4x/day | -20 invocations/day | Low |
| **3** | Reduce Discovery to 3x/week | -30 invocations/week | Medium |
| **4** | Merge Julia's 3 org jobs | -12 invocations/week | Medium |
| **5** | Consolidate Morning Briefs | -1 invocation/day | Low |
| **6** | Consolidate Night Brief + Pre-Bedtime | -1 invocation/day | Low |
| **7** | Delete disabled Evening Brief | Cleanup | Low |
| **8** | Reduce Tim Workq to every 2h | -12 invocations/day | Low |

**Total potential reduction: ~32% fewer daily invocations**

---

## Notes

- This audit is **review and recommend only**. No changes have been applied.
- Billing is per token consumed (thinking + context + output), NOT wall-time. Timeout is a safety ceiling only.
- Cost savings estimated from invocation frequency reduction, not timeout budget.
- David to approve any changes before implementation.

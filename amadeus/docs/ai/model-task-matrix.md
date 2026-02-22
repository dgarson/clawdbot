# Model-Task Performance Matrix

> **Status:** Phase 1 — Initial Specification  
> **Last Updated:** 2026-02-22  
> **Owner:** Amadeus (CAIO)

## Purpose

This document establishes a living performance matrix for OpenClaw's 26 agents across 6+ model families. It enables data-driven model routing decisions by quantifying cost vs. quality tradeoffs for each task type.

---

## Task Taxonomy

OpenClaw tasks are classified into 7 primary categories:

| ID | Task Type | Description | Example |
|----|-----------|-------------|---------|
| T1 | **Reasoning** | Multi-step logical deduction, chain-of-thought, problem decomposition | Debugging root cause, planning complex workflows |
| T2 | **Code Generation** | Writing, refactoring, or modifying code in any language | Agent code, scripts, SQL queries |
| T3 | **Summarization** | Condensing long context into concise, accurate summaries | Meeting notes, document synthesis |
| T4 | **Search Synthesis** | Web research + synthesis into coherent answers | Technical research, competitor analysis |
| T5 | **Creative** | Ideation, brainstorming, narrative generation | Feature proposals, marketing copy |
| T6 | **Structured Output** | Producing JSON/YAML/markdown with strict schema | API responses, config files, data extraction |
| T7 | **Tool-Call Reliability** | Accurate tool selection and parameter usage | Function calling, API integration |

---

## Scoring Rubric

### Primary Metrics

| Metric | Scale | Description |
|--------|-------|-------------|
| **Accuracy** | 1–5 | Quality of output: 1=fail, 3=acceptable, 5=exemplar |
| **Latency** | buckets | p50/p95 response time in seconds |
| **Cost/1K tokens** | $ | Input + output cost per 1K tokens |
| **Tool Reliability** | % | % of tool calls with correct syntax and parameters |

### Latency Buckets

| Bucket | Range | Label |
|--------|-------|-------|
| L1 | < 2s | Fast |
| L2 | 2–5s | Normal |
| L3 | 5–15s | Slow |
| L4 | > 15s | Very Slow |

### Accuracy Grade Thresholds

| Grade | Score | Interpretation |
|-------|-------|----------------|
| A | 4.5–5.0 | Production-ready, best-in-class |
| B | 3.5–4.4 | Acceptable for production |
| C | 2.5–3.4 | Usable with review |
| D | 1.5–2.4 | Requires significant rework |
| F | 1.0–1.4 | Unusable |

---

## Model Families

| Alias | Full Model ID | Provider | Context (K) | Strengths |
|-------|---------------|----------|-------------|-----------|
| `minimax-m2.5` | MiniMax-M2.5 | MiniMax | 32K | Cost efficiency, fast iteration |
| `GLM-5` | GLM-5-Series | Zhipu | 128K | Long context, reasoning |
| `Grok-4` | Grok-4 | xAI | 131K | Creative, personality |
| `Claude-Sonnet-4.6` | Claude Sonnet 4.6 | Anthropic/OpenRouter | 200K | Balanced, tool use |
| `Claude-Opus-4.6` | Claude Opus 4.6 | Anthropic/OpenRouter | 200K | Highest quality, reasoning |
| `Claude-Haiku-3.5` | Claude Haiku 3.5 | Anthropic/OpenRouter | 200K | Fast, cheap |

---

## Phase 1: Best-Guess Baseline Assignments

> ⚠️ **These are initial hypotheses based on general model knowledge, NOT empirical data.** Live evaluation (Phase 2) will validate/invalidate these assignments.

### Best-Guess Matrix (Model × Task)

| Model | T1 Reasoning | T2 Code Gen | T3 Summarization | T4 Search Synth | T5 Creative | T6 Structured | T7 Tool-Call |
|-------|-------------|-------------|------------------|-----------------|-------------|---------------|--------------|
| **MiniMax M2.5** | B | B | B | C | B | B | C |
| **GLM-5** | B+ | B | B+ | B | C+ | B | B |
| **Grok-4** | B | C+ | B | B+ | A | C+ | C |
| **Claude Sonnet 4.6** | A- | A- | A | A- | B+ | A- | A- |
| **Claude Opus 4.6** | A | A | A | A | A- | A | A |
| **Claude Haiku 3.5** | C+ | C+ | B | C+ | C | C+ | B |

### Rationale Notes

- **MiniMax M2.5**: Strong cost-performance for routine tasks; weaker on complex reasoning and tool use
- **GLM-5**: Good long-context handling; creative tasks less polished
- **Grok-4**: Excellent creative generation; tool-call reliability inconsistent
- **Claude Sonnet 4.6**: Best balance of quality, cost, and tool reliability for production
- **Claude Opus 4.6**: Highest capability ceiling; use for highest-stakes tasks only (cost premium)
- **Claude Haiku 3.5**: Fast/cheap for simple tasks; not for complex reasoning

---

## Empty Matrix Template (for Phase 2+)

| Model | T1 Reasoning | T2 Code Gen | T3 Summarization | T4 Search Synth | T5 Creative | T6 Structured | T7 Tool-Call | Notes |
|-------|-------------|-------------|------------------|-----------------|-------------|---------------|--------------|-------|
| **MiniMax M2.5** | | | | | | | | |
| **GLM-5** | | | | | | | | |
| **Grok-4** | | | | | | | | |
| **Claude Sonnet 4.6** | | | | | | | | |
| **Claude Opus 4.6** | | | | | | | | |
| **Claude Haiku 3.5** | | | | | | | | |

---

## Evaluation Workflow (Phase 2)

1. **Collect outputs** from discovery runs (JSONL format)
2. **Run harness** → `scripts/model-eval-harness.ts`
3. **Score outputs** against rubric (accuracy 1-5, latency, cost, tool %)
4. **Populate matrix** with empirical data
5. **Update recommendations** based on evidence

---

## Future Enhancements

- [ ] Add per-agent performance breakdown
- [ ] Track cost-per-session by model
- [ ] Include benchmark-specific scores (HumanEval, MMLU, etc.)
- [ ] Add latency percentiles (p50, p95, p99)
- [ ] Include qualitative observations from eval reviews

---

## References

- Evaluation harness: `scripts/model-eval-harness.ts`
- Raw eval reports: `reports/model-eval-*.json`
- Agent assignments: `AGENTS.md`

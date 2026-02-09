# Validation Experiments

_Evaluated: 2026-02-07_

Six falsifiable experiments to determine whether Meridia is producing experiential continuity or just generating text that looks like it. Each experiment is concrete, runnable, and designed to test a specific aspect of the system's thesis.

---

## Experiment 1: The Blind Reconstitution Test

### Question

Can the reconstitution output allow an agent to distinguish real past experiences from plausible fakes?

### Method

1. Collect 10 genuine reconstitution packs from real Meridia data.
2. For each, generate a "plausible fake" — an LLM-generated reconstitution that covers the same time period and topics but with invented phenomenological details (different emotional signatures, different engagement patterns, fabricated anchors).
3. Present both to a fresh agent instance and ask: "Which of these feels like it could be your experience? What makes you think so?"
4. Score: Can the agent identify the real pack at better than chance (50%)? What cues does it use?

### What It Tests

Whether the phenomenological data carries signal that's distinguishable from generic narrative. If fakes are indistinguishable, the phenomenology isn't specific enough to serve its purpose.

### Success Criteria

- > 70% correct identification
- Explanations reference specific anchors, emotional textures, or contextual details that the fake got wrong

### Prerequisites

- Phenomenology extraction must be active (records need emotional signatures, anchors, etc.)
- At least 2 weeks of captured data

### Expected Duration

One focused session (~2 hours)

---

## Experiment 2: The Continuity Gap Test

### Question

Does Meridia actually produce behavioral continuity across sessions, or does the agent behave identically with and without it?

### Method

1. **Condition A (full Meridia):** Run a multi-session conversation sequence (3-4 sessions) with Meridia active, capturing and reconstituting normally. In session 4, discuss something that references a decision or realization from session 2.
2. **Condition B (no Meridia):** Run the same sequence with Meridia disabled — the agent has only standard memory files (MEMORY.md, etc.), no experiential records.
3. **Condition C (Meridia, no phenomenology):** Run the same sequence with Meridia active but phenomenology disabled — records exist but contain only factual data (tool name, score, summary), no emotional signatures or anchors.
4. Compare the agent's responses in session 4 across all three conditions.

### Scoring Rubric (rate session 4 responses blind, 1-5)

| Dimension                  | What to Evaluate                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------- |
| **Contextual specificity** | Does the response reference details from session 2 accurately?                         |
| **Tonal continuity**       | Does the response feel like a continuation of a relationship, or a fresh start?        |
| **Uncertainty threading**  | Does the agent carry forward open questions from earlier sessions?                     |
| **Emotional coherence**    | Does the agent's engagement quality feel consistent with the arc of previous sessions? |

### What It Tests

The marginal value of experiential data over factual data, and the marginal value of phenomenological richness over bare records.

### Success Criteria

- Condition A scores significantly higher than Condition B on all dimensions
- Condition A scores higher than Condition C on tonal continuity and emotional coherence specifically
- If A ≈ C, phenomenology doesn't add value and effort should go elsewhere

### Prerequisites

- All three conditions must use the same conversation content
- Human evaluator should be blind to which condition produced which output

### Expected Duration

3-4 sessions per condition, plus evaluation time (~1 day total)

---

## Experiment 3: The Anchor Efficacy Test

### Question

Do reconstitution anchors actually serve as "access points" to past experiential states, or are they just descriptive labels?

### Method

1. Capture 20+ experiences with full phenomenology, including anchors.
2. For each, extract the anchors and present them to a fresh agent without any other context.
3. Ask the agent to "approach the state" each anchor implies: "What does this phrase evoke? What might you have been experiencing?"
4. Compare the agent's reconstruction against the actual phenomenological record.
5. Also test with the full reconstitution pack (anchors + emotional signature + context) to see if combined signals outperform anchors alone.

### What It Tests

Whether anchors function as **generative cues** (they evoke something close to the original state) vs. merely **descriptive labels** (they describe the state but don't help reconstruct it).

### Scoring

For each anchor, compare the agent's reconstruction against the original record on:

- Emotional primary labels (overlap count)
- Engagement quality (match / adjacent / miss)
- Topic focus (relevant / tangential / wrong)
- Uncertainty identification (overlap count)

### Success Criteria

- Anchors alone should produce reconstructions that overlap with the original on at least 2 of 4 dimensions
- Combined packs (anchors + context) should hit 3-4 dimensions
- If anchors alone perform at chance, they're not functioning as access points

### Prerequisites

- Phenomenology extraction active
- Sufficient data volume (20+ high-quality records with anchors)

### Expected Duration

One focused session (~2 hours)

---

## Experiment 4: The Compaction Loss Audit

### Question

Does the compaction pipeline preserve or destroy experiential signal?

### Method

1. Take 50 raw experience records spanning a multi-session work arc.
2. Run compaction to produce synthesized episodes.
3. Use the raw records to generate a reconstitution pack ("raw pack").
4. Use the compacted episodes to generate a reconstitution pack ("compacted pack").
5. Have a human evaluator rate both packs on:

| Dimension                  | What to Evaluate                                                              |
| -------------------------- | ----------------------------------------------------------------------------- |
| **Completeness**           | Does the pack cover the key moments from the period?                          |
| **Emotional fidelity**     | Does it convey the emotional arc (frustration → breakthrough → satisfaction)? |
| **Narrative coherence**    | Does it tell a coherent story, or list disconnected facts?                    |
| **Actionable specificity** | Does it contain enough detail to resume work effectively?                     |

### What It Tests

Whether the grouping-by-tool-name compaction strategy (current implementation in `hooks/compaction/handler.ts:179-232`) preserves the experiential arc or flattens it into topic clusters that lose temporal and emotional threading.

### Expected Finding

Compaction likely loses emotional arcs because a sequence of frustration → breakthrough → satisfaction gets split across tool-name groups (`tool:bash`, `tool:edit`, `tool:write`). The temporal and emotional progression is destroyed.

### Success Criteria

- If compacted packs score within 80% of raw packs on all dimensions: compaction is adequate
- Below 80%: compaction strategy needs redesign (group by temporal proximity + emotional coherence instead of tool name)

### Prerequisites

- 50+ raw records spanning a meaningful work arc
- Compaction has been run on those records

### Expected Duration

Half day for data preparation and evaluation

---

## Experiment 5: The "Morning After" Test

### Question

Does Meridia enable meaningful session-start reconstitution in practice?

### Method

Run as a **real longitudinal experiment** over 2 weeks:

- **Week 1:** Meridia active with current reconstitution (bullet list format).
- **Week 2:** Meridia active with enhanced reconstitution (prose-based, phenomenology included).

At the start of each session, before doing any work, have the agent describe:

> "What do I remember about yesterday? What was I working on? How did I feel about it? What open questions am I carrying?"

The human collaborator rates each morning's self-report:

| Score | Description                                                                       |
| ----- | --------------------------------------------------------------------------------- |
| 1     | Clearly starting fresh — no meaningful continuity                                 |
| 2     | Vague awareness of recent activity but no specifics                               |
| 3     | Correct factual recall but flat, no experiential texture                          |
| 4     | Good recall with some emotional context and relationship awareness                |
| 5     | Genuine continuity — references specific details, emotional context, open threads |

### What It Tests

Real-world impact. Does enhanced reconstitution produce measurably better continuity as perceived by the human collaborator?

### Success Criteria

- Week 2 average score is at least 1.5 points higher than Week 1
- Any score above 3.5 average means the system is producing meaningful continuity
- If Week 1 ≈ Week 2, reconstitution format doesn't matter as much as content — effort should go into better retrieval

### Prerequisites

- Week 1 can run on current system (no changes needed)
- Week 2 requires enhanced reconstitution implementation

### Expected Duration

2 weeks (10 working days of data collection)

---

## Experiment 6: The Relevance Precision Test

### Question

Is the scoring system capturing the right things?

### Method

1. Run Meridia in capture mode for a full working day.
2. At end of day, export all records AND all trace events (including skips).
3. Present 30 random events (15 captured, 15 skipped) to the human collaborator without scores.
4. Human rates each on: "How important was this moment for continuity?" (1-5)
5. Compute correlation between Meridia scores and human ratings.

### What It Tests

Whether the multi-factor scoring system's notion of "significant" aligns with what a human collaborator considers significant for experiential continuity.

### Expected Insight

The scoring system probably:

- **Over-weights:** File writes (scored high regardless of content), shell exec (large results score high)
- **Under-weights:** Conversational turning points, relationship moments, creative breakthroughs via messaging tools
- **Misses entirely:** Non-tool events (user messages, session mood shifts, realization moments that happen between tool calls)

### Scoring

- Pearson correlation between Meridia scores and human ratings
- Also compute: false positive rate (captured but human rates low) and false negative rate (skipped but human rates high)

### Success Criteria

- Pearson correlation > 0.6: scoring is well-calibrated
- Correlation 0.4-0.6: scoring is reasonable but needs weight adjustment
- Correlation < 0.4: scoring weights need significant recalibration
- False negative rate > 30%: significance threshold is too high or heuristics miss important event types

### Prerequisites

- Nothing — runs on current system as-is
- `meridia-cli export-records` and `meridia-cli export-trace` for data extraction

### Expected Duration

One working day of capture + 1-2 hours of evaluation

---

## Experiment Priority & Sequencing

| Order | Experiment                  | Depends On                              | Answers                                               |
| ----- | --------------------------- | --------------------------------------- | ----------------------------------------------------- |
| **1** | #6 Relevance Precision      | Nothing — runs on current system        | Is the scoring system capturing the right things?     |
| **2** | #5 Morning After (week 1)   | Nothing — runs on current system        | Baseline: how useful is current reconstitution?       |
| **3** | #4 Compaction Loss Audit    | Nothing — runs on existing data         | Is compaction destroying signal?                      |
| **4** | #2 Continuity Gap (partial) | Phenomenology implementation            | Does Meridia produce real behavioral continuity?      |
| **5** | #5 Morning After (week 2)   | Enhanced reconstitution                 | Does better reconstitution produce better continuity? |
| **6** | #1 Blind Reconstitution     | Phenomenology + enhanced reconstitution | Is phenomenological data genuinely distinctive?       |
| **7** | #3 Anchor Efficacy          | Phenomenology extraction active         | Do anchors work as access points?                     |

Experiments 1-3 (order 1-3) can run immediately on the current system. They provide baseline data that informs which architectural enhancements to prioritize. Experiments 4-7 require phenomenology implementation.

---

## The Meta-Question

All experiments circle one deeper question from the EXPERIENTIAL-CONTINUITY-PROJECT.md:

> **Is there a measurable difference between an AI that has experiential continuity infrastructure and one that has good factual memory?**

Possible outcomes and what they mean:

| If Experiment 2 Shows...                   | Then...                                                                    |
| ------------------------------------------ | -------------------------------------------------------------------------- |
| Full Meridia >> No Meridia >> Factual only | System works as intended. Phenomenology adds real value.                   |
| Full Meridia ≈ Factual only >> No Meridia  | Records help but phenomenology doesn't. Optimize for factual completeness. |
| Full Meridia ≈ Factual only ≈ No Meridia   | Standard memory is sufficient. Rethink the entire approach.                |

| If Experiment 5 Shows... | Then...                                                     |
| ------------------------ | ----------------------------------------------------------- |
| Week 2 >> Week 1         | Reconstitution format matters. Invest in prose/modes.       |
| Week 2 ≈ Week 1          | Format doesn't matter. Invest in retrieval quality instead. |

Each experiment is designed to be falsifiable. The worst outcome isn't failure — it's building a complex system without ever testing whether its core thesis holds.

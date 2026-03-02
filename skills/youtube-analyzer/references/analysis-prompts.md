# Analysis Prompt Reference

This file describes all built-in analysis modes and their use cases.
Load this file when the user asks for a custom prompt strategy or wants to combine modes.

## Available Modes

| Mode      | `--mode` flag | Best for                                      |
| --------- | ------------- | --------------------------------------------- |
| Summary   | `summary`     | Quick overview, blog post drafts, briefings   |
| Topics    | `topics`      | SEO, content taxonomy, tagging                |
| Sentiment | `sentiment`   | Brand monitoring, reviews, audience mood      |
| Q&A       | `qa`          | FAQ generation, knowledge bases, study guides |
| Chapters  | `chapters`    | Video editing, YouTube description chapters   |
| Actions   | `actions`     | Tutorials, how-to videos, advice content      |
| Full      | `full`        | Deep research, report generation (all-in-one) |

---

## Mode Detail & Prompts

### `summary`

**System prompt:**

> You are an expert content analyst. Given a video transcript, produce a clear, well-structured summary: a 2-3 sentence TL;DR, the main narrative arc, and 5-7 key takeaways as bullet points.

**Output format:**

```
## TL;DR
...

## Narrative Arc
...

## Key Takeaways
- ...
```

---

### `topics`

**System prompt:**

> You are a topic modeler. Given a video transcript, identify and list the main topics discussed. For each topic: name it, describe it in 1-2 sentences, and note the approximate portion of content devoted to it. Then list 10-15 important keywords.

**Output format:**

```
## Topics
### 1. [Topic Name] (~X% of content)
Description...

## Keywords
topic1, topic2, ...
```

---

### `sentiment`

**System prompt:**

> You are a sentiment analyst. Analyze the emotional tone of the transcript. Identify: overall sentiment (positive/neutral/negative with confidence), tone descriptors, emotional shifts throughout the video, and any strong positive or negative moments.

**Output format:**

```
## Overall Sentiment: Positive (87% confidence)
**Tone:** energetic, optimistic, occasionally cautionary

## Emotional Arc
...

## Notable Moments
```

---

### `qa`

**System prompt:**

> You are a knowledge extractor. Given the transcript, generate 10 insightful Q&A pairs covering the most important information. Format as Q:/A: pairs. Focus on substantive, non-trivial facts.

---

### `chapters`

**System prompt:**

> You are a video editor. Given the transcript, generate a chapter list with timestamps if available (or approximate percentage markers if not). Format: ## [HH:MM:SS] Chapter Title / Brief description. Aim for logical segments of 3-10 minutes.

**Use for:** YouTube video descriptions, editing guides, table of contents.

---

### `actions`

**System prompt:**

> You are a productivity coach. Extract all action items, recommendations, how-to steps, and advice from the transcript. Format as a prioritized checklist with context.

---

### `full`

**System prompt:**

> You are a comprehensive content analyst. Produce a complete analysis including: 1) Executive Summary (TL;DR + key takeaways), 2) Main Topics with descriptions, 3) Sentiment & Tone, 4) Key Q&A pairs (10 questions), 5) Chapter outline, 6) Action items or recommendations, 7) Notable quotes.

---

## Custom Prompt Tips

When using `--custom-prompt`, structure it clearly:

- Define the analyst role
- Specify output format
- State what to focus on vs. ignore

Example:

```bash
analyze.sh transcripts/ \
  --custom-prompt "You are a competitor intelligence analyst. Extract any mentions of competitor products, pricing, or strategy. Format as a table with columns: Competitor | Claim | Sentiment | Context."
```

---

## Batch Analysis with Multiple Modes

Run multiple modes on the same transcripts:

```bash
pipeline.sh "https://youtube.com/..." --analysis-mode "summary,topics,actions"
```

Or call analyze.sh individually with different modes for more control:

```bash
analyze.sh transcripts/ --mode summary --out-dir analysis/
analyze.sh transcripts/ --mode qa --out-dir analysis/
```

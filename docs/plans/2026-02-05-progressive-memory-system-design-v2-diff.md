# Progressive Memory System - V2 Diff vs 2026-02-04 Design

**Date**: 2026-02-05  
**Compared docs**:

- Prior design: `docs/plans/2026-02-04-progressive-memory-system-design.md`
- New design: `docs/plans/2026-02-05-progressive-memory-system-design-v2.md`

This doc explains what is different in V2 and why.

## 1. Executive Summary

The 2026-02-04 design establishes the right direction (structured store, lean index, additive tools), but it leaves ambiguous or underspecified several critical elements:

- How session transcripts become a searchable source without ballooning storage and context.
- How the always-loaded index actually gets injected into the system prompt.
- What "domain files" are for and how to avoid duplicating large blobs of text.

V2 tightens these areas by introducing explicit transcript-derived "episode" records, a pointer-first strategy for transcript recall, and a concrete system-prompt index provider contract.

## 2. Key Differences (High Impact)

### 2.1 Transcript Search Is First-Class (But Reduced)

Prior design:

- Mentions noisy transcripts as a problem, but does not specify a progressive-memory-native transcript retrieval model.
- Mentions a future "cross-session consolidation" cron, but it is an enhancement, not a core data path.

V2:

- Makes transcript search a core part of progressive recall via **episode records** (reduced previews + pointers).
- Keeps transcripts canonical and avoids storing large reprints elsewhere.

Why:

- Operator requirement: transcripts should be searchable, but we must not replicate large verbose JSON outside canonical transcript JSONL.
- Practicality: recall quality improves when we can retrieve recent conversational context with guardrails.

### 2.2 Pointer-First Recall for Transcripts

Prior design:

- Uses legacy `memory_search` fallback semantics but does not address that transcripts are not readable via `memory_get`.
- Does not define how transcript hits should be represented to avoid context blowups.

V2:

- Defines transcript results as pointers with bounded previews and internal citations.
- Allows optional "open transcript for top hits" at query time to render a short snippet, without persisting a second full copy.

Why:

- Prevents token blowups and eliminates the "memory equals logs" confusion.
- Keeps derived storage materially smaller and more privacy-conscious.

### 2.3 System Prompt Index Injection Is Explicit

Prior design:

- States "modify system prompt to inject index," but does not define the integration point.

V2:

- Specifies an "index provider" contract:
  - Prefer cached `memory/MEMORY-INDEX.md` if fresh.
  - Otherwise generate from `progressive.db` and cache.
  - If unavailable, omit progressive index and rely on legacy fallback guidance.

Why:

- Without an explicit integration point, partial implementations tend to exist "on disk" but never reach the agent prompt.

### 2.4 Domain File Generation Is De-Emphasized

Prior design:

- Requires writing `memory/domains/<category>.md` for human readability and backward compatibility with `memory_search`.

V2:

- Treats Markdown exports as optional and bounded, not mandatory for correctness.
- Makes the structured store the primary retrieval surface; legacy `memory_search` remains as fallback, not as a mirror target.

Why:

- Mandatory domain file export creates duplication pressure and risks recreating a "monolithic memory" problem in another folder.
- If exports exist, they should be compact and intentional, not a raw dump.

## 3. Differences Table (Detailed)

| Area                           | 2026-02-04 Design                                                             | V2 Design                                                                   | Why V2 Changes It                                                       |
| ------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Transcript search              | Mentioned as noisy; search mostly framed as legacy `memory_search` capability | First-class in progressive via reduced episodes + pointers                  | Transcripts are useful, but need strong reduction and clear semantics   |
| Derived transcript persistence | Not specified                                                                 | Explicit "no raw copies" rule; reduced previews and optional summaries only | Prevents storage and context blowups; meets operator constraint         |
| Recall output                  | Structured entries for progressive; fallback to legacy described              | Adds explicit output shape for transcript hits (pointers, budgeted preview) | Keeps responses small and actionable                                    |
| System prompt index            | Target <1500 tokens and injected                                              | Adds concrete index provider and caching strategy                           | Ensures the index actually reaches the prompt                           |
| Domain files                   | Required for backward compatibility                                           | Optional exports; avoid mirroring everything into Markdown                  | Avoids reintroducing monolithic memory via exports                      |
| Tool roles                     | `memory_recall` primary; `memory_search` fallback                             | Same, but defines explicit merge and budgeting across sources               | Prevents retrieval from being accidental or unbounded                   |
| Compaction flush               | Described as existing; not integrated into progressive store                  | Flush prefers structured `memory_store` with fallback to daily note         | Converts "last chance before compaction" into durable structured memory |
| Failure and fallback           | Rollback plan focuses on tools and prompt changes                             | Adds operational failure modes per subsystem (FTS, embeddings, store)       | Makes degradation behavior explicit and testable                        |

## 4. What V2 Intentionally Leaves Open

V2 is more specific about integration points and data shapes, but it does not commit to:

- Exact config keys for transcript inclusion (private vs group defaults).
- Exact episode windowing thresholds and budgets.
- Whether a future replacement of `memory_search` should directly query the progressive store.

These are implementation choices that should be validated with real workloads and privacy constraints.

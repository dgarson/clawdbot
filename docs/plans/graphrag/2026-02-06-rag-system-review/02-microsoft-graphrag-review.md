# Reference Review: `microsoft/graphrag`

Repository: https://github.com/microsoft/graphrag

## What It Is

GraphRAG is a mature indexing/query framework for transforming unstructured corpora into a knowledge model (entities, relationships, communities, reports) and querying it with multiple retrieval strategies.

## Core Design

### Indexing architecture

GraphRAG has a pipeline-driven architecture with configurable workflows:

1. Document ingestion/chunking -> `TextUnit`
2. Entity/relationship extraction
3. Optional claim extraction (`Covariate`)
4. Community detection (hierarchical Leiden)
5. Community report generation
6. Embedding of text units/entities/reports

Output artifacts are persisted as structured tables (Parquet by default), with vector indexes in configured vector stores.

### Query architecture

GraphRAG supports multiple retrieval modes:

- `local`: entity-centric mixed retrieval (entities/relations/text/community reports)
- `global`: map-reduce over community reports for dataset-wide questions
- `drift`: hybrid iterative approach mixing global and local exploration
- `basic`: vector-RAG baseline

### Extensibility model

Factory pattern across major subsystems:

- LLM providers
- Input readers
- Cache
- Storage
- Vector store
- Pipelines/workflows

This is one of GraphRAG's strongest design decisions.

## UX Layer

- Primary interface is CLI + Python APIs.
- Includes an optional Streamlit-based "Unified Search" demo for retrieval comparison and community report browsing.
- Visualization guidance is oriented around external tools (e.g., Gephi) and demo UIs rather than an integrated product UI.

## Strengths

- Strongly documented knowledge model and dataflow.
- Multiple retrieval modes with clear intended use cases.
- Good separation between indexing pipeline and query engine.
- Mature ecosystem around evaluation, prompt tuning, and operational caveats.

## Weaknesses

- Indexing is expensive and can be slow/costly at scale.
- Pipeline is better for corpus indexing than high-frequency incremental conversational memory.
- Community-report-heavy global workflows may be too expensive for turn-by-turn agent runtime.
- Python-first operational model introduces stack split for Node/TypeScript systems.

## What We Should Take

- Clear typed output artifacts and knowledge model discipline.
- Retrieval mode split (`local` vs `global` vs `drift`) instead of one generic search path.
- Configurable workflow/factory architecture.
- Evaluation and prompt-tuning workflow rigor.

## What We Should Not Take As-Is

- Full map-reduce global-query path as default runtime behavior for agent conversations.
- Heavy report generation in the hot path.

## Fit for Clawdbrain

GraphRAG is a strong methodological reference. The best reuse is conceptual architecture and evaluation rigor, not a direct lift of its full pipeline into Clawdbrain's runtime path.

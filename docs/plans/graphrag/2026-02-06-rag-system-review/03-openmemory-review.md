# Reference Review: `OpenMemory`

Repository: https://github.com/CaviraOSS/OpenMemory

## What It Is

OpenMemory is an agent-memory platform with:

- Local-first SDKs (Python + Node)
- Optional backend API server
- MCP server support
- VS Code extension integration
- Connectors (GitHub, Notion, Google Drive/Sheets/Slides, OneDrive, web crawler)

It positions itself as "cognitive memory" rather than plain vector retrieval.

## Core Design

### Memory model

OpenMemory uses two complementary memory systems:

- Contextual memory (sectored memory, HSG-style)
- Temporal facts (subject-predicate-object with validity windows)

Its sector model (episodic, semantic, procedural, emotional, reflective) combines salience/decay/reinforcement in scoring and lifecycle behavior.

### Storage and retrieval

- Metadata store: SQLite/Postgres
- Vector backends: backend-dependent, optional Valkey mode in JS stack
- Waypoint graph linking for associative traversal
- Temporal fact APIs for point-in-time queries and timeline operations

### Ingestion and connectors

- Document and URL ingestion
- Multi-provider embedding support (OpenAI, Gemini, AWS, Ollama, synthetic/local)
- Connector adapters for external systems

## UX Layer

OpenMemory has the strongest UX surface among the reviewed systems:

- SDK-first DX (Node/Python)
- API server mode
- MCP mode for assistant tools
- VS Code extension with auto-capture workflows
- Dashboard-oriented server route surfaces

## Strengths

- Productized interfaces across SDK/API/MCP/editor.
- Practical multi-mode deployment model (embedded or centralized).
- Temporal facts model is useful for changing truths/preferences.
- Explainability emphasis (trace/recall rationale) is directionally strong.

## Weaknesses

- Architecture breadth introduces operational and conceptual complexity quickly.
- Some positioning/performance claims are hard to independently validate from docs alone.
- Sector model is useful but can become overfit/over-engineered early if adopted wholesale.
- Waypoint-style linking is lighter than full graph analytics/path semantics.

## What We Should Take

- Dual memory mode: contextual recall + temporal fact store.
- First-class explainability in retrieval results.
- Strong UX distribution pattern: SDK + API + MCP + editor integration.
- User partitioning and multi-tenant boundaries as default constraints.

## What We Should Not Take As-Is

- Full sector taxonomy and behavior complexity in phase 1.
- Platform breadth before core retrieval quality and correctness are stable.

## Fit for Clawdbrain

OpenMemory is highly useful as a product-surface and memory-lifecycle reference. For Clawdbrain, we should borrow the dual-mode memory concept and explainability model while keeping a tighter initial architecture.

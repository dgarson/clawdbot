# Cross-System Comparison: External References

## At-a-Glance Matrix

| Dimension        | openclaw-memory-template      | microsoft/graphrag                             | OpenMemory                                      |
| ---------------- | ----------------------------- | ---------------------------------------------- | ----------------------------------------------- |
| Primary shape    | Workspace/template discipline | Research-grade indexing + retrieval framework  | Productized memory engine platform              |
| Runtime model    | File + scripts                | Pipeline + query engine                        | SDK/API/MCP + optional dashboard                |
| Graph depth      | Minimal (not core)            | Strong KG artifacts + community hierarchy      | Lightweight waypoint graph + temporal facts     |
| Temporal support | Basic timestamps/logs         | Present in outputs; not primary runtime focus  | First-class (temporal facts + validity windows) |
| Retrieval styles | Basic semantic RAG guidance   | Local/Global/DRIFT/Basic                       | Hybrid contextual + factual queries             |
| UX maturity      | CLI/template only             | CLI + optional Streamlit demo                  | SDK + API + MCP + VS Code extension             |
| Ops footprint    | Very low                      | Moderate to high                               | Moderate (can be local or centralized)          |
| Best fit         | Solo workflow hygiene         | Corpus intelligence and structured exploration | Agent product memory with strong interfaces     |

## Major Differences

1. Indexing philosophy:

- GraphRAG is heavy pre-indexing and rich artifact production.
- OpenMemory is continuous agent-memory operations with lifecycle dynamics.
- openclaw-memory-template is organizational/operational scaffolding.

2. Query philosophy:

- GraphRAG explicitly separates query intent by mode (local/global/drift).
- OpenMemory emphasizes cognitive blending (salience/recency/importance + sectoring).
- openclaw-memory-template remains simple semantic retrieval guidance.

3. UX/product layer:

- OpenMemory leads on practical integration surfaces.
- GraphRAG offers strong demo tooling but less productized daily-runtime UX.
- openclaw-memory-template is script-first, no major UI runtime.

## What Clawdbrain Should Adopt by Layer

### Data and modeling

- From GraphRAG: explicit typed artifacts + evaluation-friendly outputs.
- From OpenMemory: temporal facts and changing-truth handling.

### Retrieval orchestration

- From GraphRAG: mode-specific retrieval paths (not one-size-fits-all).
- From OpenMemory: recency/salience/reinforcement signals in final ranking.

### UX and platform

- From OpenMemory: unified SDK/API/MCP/editor surface mindset.
- From openclaw-memory-template: low-friction workflows and daily operational hygiene.

## What Not to Copy Directly

- GraphRAG's heavy map-reduce/report path as default per-turn runtime.
- OpenMemory's full cognitive taxonomy complexity in the first release.
- Template-level architecture claims without hard runtime integration.

## Net Takeaway

No single reference is a complete fit. The target Clawdbrain design should be a hybrid:

- GraphRAG discipline for modeling/retrieval architecture
- OpenMemory discipline for UX surfaces + temporal memory behavior
- openclaw-memory-template discipline for operational workflow and durable markdown memory habits

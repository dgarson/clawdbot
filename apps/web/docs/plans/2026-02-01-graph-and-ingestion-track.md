# Graph + Ingestion/RAG Track (Separate From Agent-Config MVP)

**Date:** 2026-02-01
**Status:** Draft
**Scope:** Future track (do not mix into the Agent Configuration MVP)

This document exists to prevent scope creep. Graph DB integration and ingestion/retrieval work are valuable, but they carry significant security, operational, and product risks. They require a separate MVP and must not block the Agent Configuration UX.

## Relationship to Agent Configuration MVP

The Agent Configuration MVP focuses on:
- System defaults + per-agent overrides
- Provider connection UX
- Toolsets + permissions UX
- Power user workflows (command palette/shortcuts, raw config, import/export)

Graph + ingestion/RAG work is a separate track.

Canonical scope boundary: `apps/web/ux-opus-design/00-CANONICAL-CONFIG-AND-TERMS.md`.

## Track MVP (Minimal, Shippable)

The smallest “real value” MVP for this track:

1) **Memory Audit Trail UI (collapsed by default)**
   - Show what content the system captured and why (source attribution).
   - Enable deletion/redaction workflows.
   - See: `apps/web/docs/plans/2026-02-01-entity-relationships-and-memory-audit-trail.md`.

2) **Lightweight Entity Relationships (no external graph DB)**
   - Link existing domain objects (Agents, Rituals, Goals, Memories, Sessions).
   - Provide “Related items” chips/panels in the web UI.
   - Store in existing persistence (SQLite/JSON) until scale requires more.

Everything beyond this is post-MVP.

## Explicit Non-Goals (for this track MVP)
- External graph DB operations (Neo4j/Graphiti) in v1.
- Web crawler ingestion.
- Multimodal ingestion (audio/video) beyond basic file upload handling.
- Hybrid retrieval (vector + graph) with query analysis/rank fusion.

## Risks (Why This Track Must Be Separate)

### Security
- Crawlers introduce SSRF and data exfiltration risk.
- Ingestion of files/media creates sensitive-data retention obligations.
- Entity extraction can inadvertently store PII and sensitive relationships.
- Graph exploration UIs can leak sensitive cross-entity links.

### Operational / Cost
- Background jobs need queues, retry/backpressure, and observability.
- Embeddings and extraction are expensive and hard to bound without budgets.
- External DBs introduce deployment and migration complexity.

### Product
- “Smart” extraction can be wrong; correcting wrong entities/links needs UX.
- Users may not trust a system that “remembers” without visibility or control.

## Security Requirements (Minimum Before Shipping Anything)

1) **Consent + transparency**
   - Clear UI for what is stored, where it came from, and how to delete it.

2) **Access controls**
   - If/when multi-user arrives: enforce per-user/workspace permissions.

3) **PII handling**
   - Redaction workflows, retention policy defaults, and “export/delete my data” primitives.

4) **Crawler hardening (if/when added)**
   - URL allowlists, robots.txt honoring, strict SSRF protections, rate limits, content-type limits.

## Next Docs (Future)

If/when we re-activate the full graph/RAG proposals, create separate docs that:
- Define a job system (queue, retries, budgets).
- Define a storage model and migration path.
- Define a user-facing trust model (visibility levels, corrections, audit trails).


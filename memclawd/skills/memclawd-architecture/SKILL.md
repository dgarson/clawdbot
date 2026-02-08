# Skill: MemClawd architecture, context, and flow patterns

## Purpose

Use this skill when extending or integrating with MemClawd’s pipeline, storage adapters, or API surface. It provides architectural context and development flow patterns so changes stay consistent with the service boundaries.

## Architecture overview

- **API layer** (`src/api/server.ts`): Hono routes for ingest/query/graph/experiential endpoints.
- **Contracts** (`src/contracts/*`): Integration boundary types. Treat these as stable interfaces.
- **Pipeline** (`src/pipeline/orchestrator.ts`): Stage runner that sequences normalize → extract → classify → enrich → entity_extract → embed → graph_write → vector_index → audit.
- **Storage adapters** (`src/storage/interfaces.ts`): Graph/vector/embedder/entity/temporal/query interfaces; concrete adapters plug in here.
- **Config schema** (`src/config/schema.ts`): TypeBox schema for server/auth/pipeline/storage/models/observability.

## Development flow patterns

1. **Start with contracts**: update `src/contracts/*` first when adding new API fields or storage behaviors.
2. **Align config + stages**: keep pipeline stage keys identical across contracts, config schema, and orchestrator.
3. **Add adapters**: implement concrete adapters in `src/storage/` and thread them into the orchestrator.
4. **Expose endpoints**: wire new functionality into Hono routes with stub-friendly responses first.
5. **Test locally**: add focused vitest coverage near contracts or orchestration changes.

## Integration patterns

- Prefer async ingest (`/v1/ingest`) for production throughput.
- Use sync ingest only for debugging or single-event verification.
- Request context packs via `/v1/context-pack` when you need enriched, merged memory artifacts.

## Guardrails

- Keep route handlers stubbed unless implementing full behavior.
- Avoid `any`; define explicit types and reuse contracts.
- Maintain snake_case ingestion stage identifiers across the entire codebase.

## Useful references

- `memclawd/docs/usage-examples.md`
- `memclawd/src/contracts/ingest.ts`
- `memclawd/src/pipeline/orchestrator.ts`

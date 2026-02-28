# Event Ledger Skill

Use this skill when querying canonical run/session events, retention tiers, and incident timelines.

## Query Pattern

1. Start with run-level summary.
2. Filter by family/type/time window.
3. Correlate with lineage/session identifiers.
4. Export minimal evidence bundle for incident review.

## Retention Awareness

- Hot tier: fast recent diagnostics.
- Warm tier: operational history.
- Cold tier: long-term archival/compliance.

Always check retention boundaries before assuming missing data is an ingest failure.

## Event Hygiene

- Keep event payloads compact and structured.
- Preserve causal IDs (`runId`, `sessionKey`, `traceId`, `spanId`) when present.
- Avoid unbounded payload growth in recurring events.

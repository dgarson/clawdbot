# Skill: When and how to use MemClawd

## Purpose

Use this skill when you need to ingest agent events into the MemClawd Memory Composition Service or query memory context from it. This skill focuses on choosing MemClawd as the integration point and using the HTTP API/client safely.

## When to use MemClawd

- You have structured agent events (tool usage, compaction, session end, etc.) that should be normalized and stored in a dedicated memory service.
- You need hybrid search results or context packs derived from prior agent activity.
- You want to keep memory processing asynchronous and decoupled from the core agent runtime.

## When not to use MemClawd

- You only need in-process transient memory for a single runtime execution.
- You do not have a stable agent/session identity to anchor memory.

## Inputs

- `MemClawdIngestEvent` for ingestion.
- `MemClawdQueryRequest` for search and context packs.
- Optional API key (Bearer auth).

## Outputs

- Ingest: `MemClawdIngestResponse` (async) or `MemClawdIngestRun` (sync).
- Query: `MemClawdQueryResult` and optional `MemClawdContextPackResult`.

## Minimal integration workflow

1. Instantiate a client pointing at the MemClawd base URL.
2. Send ingest events using `/v1/ingest` (async) or `/v1/ingest/sync` (blocking).
3. Poll `/v1/ingest/:runId` if you need run status.
4. Query with `/v1/query` and request a context pack if needed.

## Quick example

```ts
import { MemclawdClient } from "memclawd/src/api/client.js";

const client = new MemclawdClient({ baseUrl: "http://localhost:8080" });

await client.ingest({
  id: "evt-001",
  type: "agent.tool_use",
  occurredAt: new Date().toISOString(),
  agentId: "agent-123",
  sessionId: "session-456",
  payload: { toolName: "web.search", input: { query: "memory" }, output: {} },
});

const result = await client.query({
  agentId: "agent-123",
  query: "recent memory",
  maxResults: 5,
});

console.log(result);
```

## Safety checks

- Always populate `agentId` and `sessionId` so memory can be scoped correctly.
- Keep event payloads structured and avoid leaking secrets.
- Use async ingest for high-throughput pipelines; only use sync ingest for debugging.

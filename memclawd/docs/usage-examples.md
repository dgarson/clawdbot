# MemClawd Usage Examples

## Quick client integration

```ts
import { MemclawdClient } from "../src/api/client.js";

const client = new MemclawdClient({
  baseUrl: "http://localhost:8080",
  apiKey: "dev-api-key",
});

const ingestResponse = await client.ingest({
  id: "evt-001",
  type: "agent.tool_use",
  occurredAt: new Date().toISOString(),
  agentId: "agent-123",
  sessionId: "session-456",
  payload: {
    toolName: "web.search",
    input: { query: "MemClawd" },
    output: { result: "Memory Composition Service" },
  },
});

const ingestRun = await client.ingestRun(ingestResponse.runId);

const queryResponse = await client.query({
  agentId: "agent-123",
  query: "What did we learn about MemClawd?",
  maxResults: 5,
  includeContextPack: true,
  filters: { tags: ["memory"] },
});

console.log({ ingestRun, queryResponse });
```

## Curl stubs

```bash
curl -X POST http://localhost:8080/v1/ingest \
  -H "Content-Type: application/json" \
  -d '{"event":{"id":"evt-002","type":"agent.session_end","occurredAt":"2024-01-01T00:00:00Z","agentId":"agent-123","sessionId":"session-456","payload":{}}}'
```

```bash
curl -X POST http://localhost:8080/v1/query \
  -H "Content-Type: application/json" \
  -d '{"agentId":"agent-123","query":"Recent sessions","maxResults":3}'
```

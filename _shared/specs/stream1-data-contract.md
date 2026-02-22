# Stream 1 Data Contract — Dashboard Telemetry Layer

**Generated:** 2026-02-22 00:15 MST
**Owner:** Luis (Dashboard Lead)
**Consumer:** Horizon UI (UsageDashboard, Agent Activity, Cost Analysis)
**Producer:** Gateway API + Prometheus + Loki

---

## 1. Data Schema Overview

Four core metric families for dashboard consumption:

| Metric | Type | Unit | Purpose |
|--------|------|------|---------|
| `agent_throughput` | Counter | sessions/min | Active session velocity |
| `queue_aging_seconds` | Histogram | seconds | Task queue wait time distribution |
| `tool_failure_rate` | Gauge | percentage | Tool call failure % (5m window) |
| `cost_per_deliverable_usd` | Counter | USD | Cumulative cost per completed task |

---

## 2. Endpoint/Spec Table

### 2.1 Prometheus Metrics Endpoint

| Field | Value |
|-------|-------|
| **Path** | `GET /metrics` |
| **Protocol** | Prometheus text exposition format |
| **Auth** | None (internal network) or Bearer token (production) |
| **Refresh cadence** | 15s (Grafana default) |
| **Port** | 9090 (Prometheus scraper) or 3000 (gateway direct) |

### 2.2 JSON API Endpoint (Dashboard-Specific)

| Field | Value |
|-------|-------|
| **Path** | `GET /api/v1/telemetry/dashboard` |
| **Protocol** | JSON |
| **Auth** | Bearer token (session JWT) |
| **Refresh cadence** | 30s (client polling) or WebSocket push |
| **Cache** | 10s server-side |

### 2.3 Log Aggregation Endpoint

| Field | Value |
|-------|-------|
| **Path** | `GET /api/v1/telemetry/logs` |
| **Protocol** | JSONL streaming |
| **Auth** | Bearer token (admin scope) |
| **Filters** | `?agent=tony&since=2026-02-22T00:00:00Z` |
| **Max rows** | 1000 (pagination via `&offset=N`) |

---

## 3. Metric Definitions (Prometheus Format)

### 3.1 Agent Throughput

```promql
# TYPE openclaw_agent_throughput counter
openclaw_agent_throughput_total{agent="tony",model="codex-spark",kind="main"} 142
openclaw_agent_throughput_total{agent="claire",model="codex-medium",kind="main"} 89
openclaw_agent_throughput_total{agent="sandy",model="codex-spark",kind="subagent"} 34
```

**Labels:**
- `agent` — agent ID (tony, claire, sandy, etc.)
- `model` — model identifier (codex-spark, minimax-m25, etc.)
- `kind` — session type (`main`, `subagent`, `cron`, `hook`)

**Dashboard query:**
```promql
sum(rate(openclaw_agent_throughput_total[5m])) by (agent)
```

### 3.2 Queue Aging

```promql
# TYPE openclaw_queue_aging_seconds histogram
openclaw_queue_aging_seconds_bucket{agent="tony",le="1"} 45
openclaw_queue_aging_seconds_bucket{agent="tony",le="5"} 89
openclaw_queue_aging_seconds_bucket{agent="tony",le="10"} 112
openclaw_queue_aging_seconds_bucket{agent="tony",le="30"} 134
openclaw_queue_aging_seconds_bucket{agent="tony",le="60"} 142
openclaw_queue_aging_seconds_bucket{agent="tony",le="+Inf"} 145
openclaw_queue_aging_seconds_sum{agent="tony"} 1247.3
openclaw_queue_aging_seconds_count{agent="tony"} 145
```

**Labels:**
- `agent` — agent ID
- `le` — histogram bucket boundary (seconds)

**Dashboard query (P95 wait time):**
```promql
histogram_quantile(0.95, sum(rate(openclaw_queue_aging_seconds_bucket[5m])) by (le, agent))
```

### 3.3 Tool Failure Rate

```promql
# TYPE openclaw_tool_failure_rate gauge
openclaw_tool_failure_rate{agent="tony",tool="browser"} 0.023
openclaw_tool_failure_rate{agent="sandy",tool="exec"} 0.015
openclaw_tool_failure_rate{agent="claire",tool="read"} 0.004
```

**Labels:**
- `agent` — agent ID
- `tool` — tool name (browser, exec, read, write, etc.)

**Dashboard query:**
```promql
openclaw_tool_failure_rate{agent="tony"}
```

**Note:** This is a pre-computed gauge (5m window). Raw calculation:
```promql
sum(rate(openclaw_tool_calls_total{status="error"}[5m])) by (agent, tool)
  / sum(rate(openclaw_tool_calls_total[5m])) by (agent, tool)
```

### 3.4 Cost per Deliverable

```promql
# TYPE openclaw_cost_per_deliverable_usd counter
openclaw_cost_per_deliverable_usd_total{agent="tony",deliverable_type="pr"} 12.47
openclaw_cost_per_deliverable_usd_total{agent="sandy",deliverable_type="pr"} 8.92
openclaw_cost_per_deliverable_usd_total{agent="claire",deliverable_type="review"} 3.21
```

**Labels:**
- `agent` — agent ID
- `deliverable_type` — `pr`, `review`, `merge`, `deploy`, `incident_fix`

**Dashboard query:**
```promql
sum(openclaw_cost_per_deliverable_usd_total) by (deliverable_type)
```

---

## 4. JSON API Schema

### 4.1 Dashboard Summary Endpoint

**Request:**
```http
GET /api/v1/telemetry/dashboard HTTP/1.1
Authorization: Bearer <token>
Accept: application/json
```

**Response (200 OK):**
```json
{
  "timestamp": "2026-02-22T00:15:00Z",
  "window": "5m",
  "agents": [
    {
      "id": "tony",
      "model": "codex-spark",
      "throughput": 2.8,
      "throughput_unit": "sessions/min",
      "queue_aging_p95": 4.2,
      "queue_aging_unit": "seconds",
      "tool_failure_rate": 0.023,
      "cost_per_deliverable": {
        "pr": 12.47,
        "review": 0.0
      },
      "active_sessions": 3
    },
    {
      "id": "sandy",
      "model": "codex-spark",
      "throughput": 1.5,
      "throughput_unit": "sessions/min",
      "queue_aging_p95": 2.1,
      "queue_aging_unit": "seconds",
      "tool_failure_rate": 0.015,
      "cost_per_deliverable": {
        "pr": 8.92,
        "review": 0.0
      },
      "active_sessions": 1
    }
  ],
  "aggregate": {
    "total_throughput": 8.4,
    "avg_queue_aging_p95": 3.1,
    "avg_tool_failure_rate": 0.018,
    "total_cost_usd": 127.43
  }
}
```

### 4.2 Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO 8601 | Data snapshot time (UTC) |
| `window` | string | Aggregation window (e.g., "5m", "1h") |
| `agents[].id` | string | Agent identifier |
| `agents[].model` | string | Model backend (codex-spark, minimax-m25, etc.) |
| `agents[].throughput` | number | Sessions completed per minute |
| `agents[].queue_aging_p95` | number | P95 queue wait time in seconds |
| `agents[].tool_failure_rate` | number | Tool failure rate (0.0-1.0) |
| `agents[].cost_per_deliverable` | object | Map of deliverable type → USD |
| `agents[].active_sessions` | integer | Currently active session count |
| `aggregate.total_throughput` | number | Sum of all agent throughput |
| `aggregate.avg_queue_aging_p95` | number | Average P95 across agents |
| `aggregate.avg_tool_failure_rate` | number | Average failure rate across agents |
| `aggregate.total_cost_usd` | number | Cumulative cost (all agents, all deliverables) |

---

## 5. Sample Payloads

### 5.1 WebSocket Push (Real-Time)

**Connection:**
```javascript
const ws = new WebSocket('wss://gateway.openclaw.ai/api/v1/telemetry/stream');
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // data format matches JSON API response above
};
```

**Push message (every 30s):**
```json
{
  "type": "telemetry_update",
  "timestamp": "2026-02-22T00:15:30Z",
  "payload": {
    /* matches JSON API response */
  }
}
```

### 5.2 Alert Payload (Threshold Breach)

```json
{
  "type": "alert",
  "severity": "warning",
  "timestamp": "2026-02-22T00:15:45Z",
  "metric": "tool_failure_rate",
  "agent": "tony",
  "value": 0.087,
  "threshold": 0.05,
  "message": "Tool failure rate for tony exceeded 5% threshold"
}
```

---

## 6. Contract Assumptions

### 6.1 Guaranteed Properties

| Assumption | Guarantee |
|------------|-----------|
| **Freshness** | Dashboard data ≤ 30s stale |
| **Completeness** | All active agents appear in response |
| **Consistency** | Same query within 10s returns identical result |
| **Cardinality** | Max 50 agents, 20 tools per agent (bounded) |
| **Precision** | Currency values rounded to 4 decimal places |

### 6.2 Known Gaps (Current)

| Gap | Impact | Mitigation |
|-----|--------|------------|
| **No historical data** | Cannot render trends >24h | Query Prometheus directly for historical |
| **No per-session granularity** | Cannot drill into individual sessions | Use Loki log query for session details |
| **Cost attribution incomplete** | Subagent costs not rolled up to parent | Manual aggregation required |
| **No model latency breakdown** | Cannot compare model response times | Add `model_latency_seconds` histogram (P2) |
| **Queue aging only for queued tasks** | Running tasks not tracked | Add `task_duration_seconds` histogram (P2) |

### 6.3 Backward Compatibility

| Change Type | Policy |
|-------------|--------|
| Add new field | ✅ Allowed (clients ignore unknown fields) |
| Remove field | ❌ Deprecated first, 30-day notice |
| Change field type | ❌ Create new field, deprecate old |
| Add new label | ✅ Allowed (filters ignore missing labels) |
| Change aggregation window | ❌ Require explicit client opt-in |

---

## 7. Implementation Checklist

### Gateway Side (Producer)
```
[ ] Implement /metrics endpoint with 4 metric families
[ ] Implement /api/v1/telemetry/dashboard JSON endpoint
[ ] Add cost tracking to session completion hook
[ ] Add queue aging histogram to task dispatcher
[ ] Test with Prometheus scraper (15s interval)
```

### Dashboard Side (Consumer)
```
[ ] Update UsageDashboard.tsx to consume JSON API
[ ] Add fallback to Prometheus direct query if JSON API unavailable
[ ] Implement 30s polling with exponential backoff on error
[ ] Add error boundary for telemetry data fetch failures
[ ] Cache last successful response for offline display
```

---

## 8. File References

| Artifact | Absolute Path |
|----------|---------------|
| **This contract** | `/Users/openclaw/.openclaw/workspace/_shared/specs/stream1-data-contract.md` |
| OBS stack spec | `/Users/openclaw/.openclaw/workspace/_shared/OBS_STACK_SPEC.md` |
| Usage dashboard (current) | `/Users/openclaw/.openclaw/workspace/clawdbot/apps/web-next/src/views/UsageDashboard.tsx` |
| UEEE adapter (metrics source) | `/Users/openclaw/openclaw/worktrees/utee-phase1/src/agents/utee-adapter.ts` |

---

## 9. Quick Reference for Luis

**To mock dashboard locally:**
```bash
# Start mock telemetry API
cat > /tmp/mock-telemetry.json << 'EOF'
{"timestamp":"2026-02-22T00:15:00Z","window":"5m","agents":[{"id":"tony","model":"codex-spark","throughput":2.8,"throughput_unit":"sessions/min","queue_aging_p95":4.2,"queue_aging_unit":"seconds","tool_failure_rate":0.023,"cost_per_deliverable":{"pr":12.47},"active_sessions":3}],"aggregate":{"total_throughput":8.4,"avg_queue_aging_p95":3.1,"avg_tool_failure_rate":0.018,"total_cost_usd":127.43}}
EOF

python3 -m http.server 9999 --directory /tmp
# Then curl http://127.0.0.1:9999/mock-telemetry.json
```

**Prometheus query for testing:**
```bash
# Assuming Prometheus running at localhost:9090
curl 'http://127.0.0.1:9090/api/v1/query?query=sum(rate(openclaw_agent_throughput_total[5m]))%20by%20(agent)'
```

---

**Document version:** 1.0
**Last updated:** 2026-02-22 00:15 MST
**Next review:** Post-P1 implementation (target: 2026-02-23)

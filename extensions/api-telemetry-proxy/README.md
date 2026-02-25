# API Telemetry & Proxy Extension

A unified pattern for tracking ALL API usage across OpenClaw, including core LLM calls, TTS services (ElevenLabs), specialized compute (Nano Banana), and web search APIs.

## Why a Proxy Architecture?

Splitting API routing and telemetry to a dedicated Proxy (e.g., LiteLLM, Helicone, Portkey, or a custom API Gateway) provides significant architectural advantages:

1. **Reduced Codebase Complexity:** OpenClaw doesn't need to implement custom token-counting, rate-limiting, and cost-calculation logic for every new provider (TTS, Video, Search).
2. **Unified Auditing & Telemetry:** All outgoing requests pass through a single choke point, making it trivial to log exactly what was sent, the latency, and the cost.
3. **Centralized Rate Limiting & Quotas:** You can enforce a weekly budget of $50 across _all_ skills and agents without writing budget-enforcement code in each OpenClaw tool.
4. **Zero-Downtime Key Rotation:** You update keys in the proxy, not in OpenClaw configs.
5. **Caching:** The proxy can cache identical TTS or LLM requests, saving money without OpenClaw knowing.

## How this Plugin Integrates

This plugin takes advantage of the OpenClaw Plugin/Extensions architecture by:

1. **Registering a Hook** (`before_tool_call` or custom `api:request`) to track intended usage before it happens.
2. **Registering an HTTP Route** (`/api/proxy/telemetry`) to allow the external Proxy to webhook asynchronously back to OpenClaw with final cost data.
3. **Emitting Standardized Telemetry** that the `apps/web-next` UI can visualize in the `ApiUsageDashboard`.

## Setup

```json
{
  "plugins": {
    "api-telemetry-proxy": {
      "proxyUrl": "https://api.your-proxy.internal",
      "enforceBudgets": true,
      "weeklyLimitUsd": 500
    }
  }
}
```

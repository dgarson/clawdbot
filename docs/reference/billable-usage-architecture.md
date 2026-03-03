---
title: Billable Usage Architecture
summary: "A shared pattern for measuring usage that consumes paid API credits across runtimes, tools, and providers."
---

# Goals

Track all billable API usage (weekly and monthly), including:

- model calls
- direct provider API calls
- skills and sidecar tools (for example TTS)
- future media/multimodal endpoints

# Common event shape

Use one canonical event schema everywhere:

- `source`: where call originated (`runtime.model`, `tts.summarize`, `skill.nano-banana`, etc.)
- `category`: `llm`, `tts`, `image`, `video`, `embeddings`, or `other`
- `provider`: `anthropic`, `openai`, `elevenlabs`, etc.
- `operation`: endpoint/action (`completion`, `tts.summary`, `image.generate`)
- `usage`: tokens/chars/seconds/images when known
- `cost.usd`: exact billable cost when known
- `requestCount`
- `metadata`: success/failure tags and optional dimensions

Implementation scaffold lives in `src/infra/billable-usage.ts` and `src/infra/billable-usage-collector.ts`.

# Limits and budgets

Define limits by:

- window: `week` or `month`
- unit: `usd`, `tokens`, `characters`, `requests`, `seconds`, `images`
- optional scope filters (`provider`, `category`, `source`, `operation`)

Evaluate continuously and emit statuses:

- `used`
- `remaining`
- `ratio`
- `exceeded`

# Plugin or extension shape

Short answer: **yes for ingestion/export, no for full enforcement**.

A plugin or extension is a good fit for:

- subscribing to normalized usage records
- forwarding usage to your telemetry stack
- custom reporting and dashboards
- non-blocking alerts

A plugin or extension is not ideal for:

- guaranteed global enforcement across every process that can spend money
- hard-stop budget gates before upstream provider calls
- org-wide quota policy when calls bypass OpenClaw runtime

Practical split:

- keep the event normalization contract in core (`src/infra/billable-usage.ts`)
- use a plugin/extension for sink integrations and local policy hints
- use a proxy for authoritative budget enforcement and cross-runtime auditing

This gives you incremental adoption now, while keeping the path open for strict controls later.

# Proxy architecture (recommended for full coverage)

A proxy is useful when some billable calls bypass OpenClaw internals.

## What you gain

- centralized accounting across all apps/runtimes (OpenClaw, scripts, skills, external workers)
- policy enforcement before spend happens (hard blocks, soft warnings, quota routing)
- uniform retry/rate-limit behavior
- request/response audit log with consistent redaction policy
- easier chargeback (per team, feature, channel, tenant)
- decoupled release cadence (update billing rules without shipping core client changes)

## What can move out of the OpenClaw fork

- provider-specific usage parsing and cost mapping
- budget windows and gating logic
- spend dashboards and rollups
- anomaly detection and cost alerts
- provider fallback/routing policies based on budget state

This reduces complexity in the fork while preserving capability, because OpenClaw can emit normalized usage events and delegate quota/audit enforcement to the proxy.

## What becomes feasible with proxy-first design

- global org-level monthly caps across many deployments
- emergency kill-switches for expensive endpoints
- dynamic model routing by remaining budget
- real-time cost SLOs and forecast alerts
- consistent compliance/audit trails independent of app runtime

## End-to-end test flow

1. Enable diagnostics:
   - `openclaw config set diagnostics.enabled true`
2. Start gateway and run billable actions (model chats, TTS, provider APIs).
3. Query summary:
   - `openclaw gateway usage-billable --days 7`
4. Try quota evaluation:
   - `openclaw gateway usage-billable --days 7 --limits-json '[{"id":"weekly-usd","window":"week","unit":"usd","max":25}]'`

The monitor writes normalized records to `~/.openclaw/logs/billable-usage.jsonl`.

# Migration path

1. Instrument existing diagnostic events into normalized billable records.
2. Persist records in one sink (jsonl, queue, or warehouse).
3. Enable budget checks in read-only mode.
4. Add warn-only gates.
5. Promote selected limits to hard enforcement.
6. Move provider integrations behind a proxy for any surface not fully observable from OpenClaw.

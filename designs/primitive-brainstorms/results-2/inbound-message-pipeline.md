# Inbound Message Pipeline Primitive Plan

## Goal

Introduce a shared inbound message pipeline primitive that standardizes the auto-reply ingress flow across channels and reduces duplicated preflight, gating, history, and dispatch logic.

## Current patterns and complexity

- Discord message processing assembles media, computes mention gating, builds envelopes, manages history context, applies reply prefix logic, and dispatches replies in a single channel specific path that mirrors other channels in structure but diverges in implementation detail.
- Slack message preparation includes allowlist checks, pairing flows, mention gating, history handling, and route resolution before it dispatches any reply work, with many of the same steps as Discord but in a different organization.
- Signal inbound handling repeats envelope formatting, history context construction, route resolution, reply prefix setup, typing callbacks, and reply dispatch with a separate event handler stack.
- Web auto-reply implements its own inbound pipeline with chunking, mention gating, history, and dispatch, which adds another parallel flow to maintain alongside the channel specific handlers.

## Proposed primitive

Create an `InboundPipeline` primitive that orchestrates shared steps in a consistent order and lets channels provide channel specific adapters for the few parts that must vary.

### Responsibilities

- Normalize inbound messages into a shared envelope structure.
- Apply allowlist and pairing gates.
- Apply mention gating and command authorization.
- Load and format conversation history when configured.
- Build reply prefix context and resolve typing callbacks.
- Dispatch auto-reply using shared dispatchers with channel specific deliverers.

### Proposed API shape

- `createInboundPipeline({ channel, deps })` returns:
  - `runInbound({ rawMessage, context, adapter })`
- `adapter` handles:
  - extracting sender, channel, and thread metadata
  - parsing attachments and media
  - defining channel specific reply delivery

### Example usage

- Channel monitors call `runInbound` with adapter implementations for Discord, Slack, Signal, Web, and extension channels.

## Integration plan

1. Add a new `src/channels/inbound/pipeline.ts` that coordinates common steps using existing helpers for envelope formatting, history, dispatch, and reply prefix handling.
2. Extract reusable helpers from Discord, Slack, Signal, and Web auto-reply into adapter interfaces so channel monitors only implement channel specific logic.
3. Migrate the Discord pipeline first and keep the existing functions intact behind the adapter to avoid regressions.
4. Migrate Slack preparation and dispatch next, reusing the adapter interfaces for allowlist and pairing gates.
5. Migrate Signal inbound handling with adapter driven message formatting and reply dispatch integration.
6. Migrate Web auto-reply to the shared pipeline, validating that chunking and mention gating remain identical to current behavior.
7. Add regression tests that compare pipeline outputs with existing channel specific tests and integrate into per-channel suites.

## Expected impact

- Reduces channel specific code size and cognitive load.
- Ensures new channel plugins inherit safe defaults and reliable gating behavior.
- Makes future auto-reply changes and bug fixes easier to apply across all channels.

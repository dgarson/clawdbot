# Tool Result Event Pipeline Primitive Plan

## Goal

Create a shared tool result event pipeline primitive that standardizes how tool result events are emitted, enriched, filtered, and persisted across core and plugin hooks.

## Current patterns and complexity

- The internal hook system exposes generic event payloads and relies on each hook to parse context and enforce gating logic, which results in repetitive parsing and configuration handling across hooks.
- Hooks documentation describes tool result hooks and plugin hook behaviors, but the actual payload structure and gating responsibilities are distributed across hook implementations and plugin code.
- The Meridia experiential capture hook includes its own buffering, rate limiting, config parsing, and tool result extraction logic in a large handler, which demonstrates the complexity of per hook tool result handling today.

## Proposed primitive

Introduce a `ToolResultPipeline` primitive that provides a consistent event envelope and helper utilities for tool result hooks.

### Responsibilities

- Normalize tool result event payloads into a typed structure.
- Provide common gating helpers for rate limits, configuration checks, and session context resolution.
- Offer standardized persistence helpers for JSONL traces and per session buffers.
- Provide a consistent metadata schema for tool name, call id, timing, and error markers.

### Proposed API shape

- `createToolResultPipeline({ config, storage, logger })`
  - `normalize(event)` returns `ToolResultEvent`
  - `applyGates(event, gates)` returns `{ allowed, reason }`
  - `record(event, writers)` persists structured events

### Example usage

- Hooks register a short handler that calls `normalize`, applies gates, and uses shared persistence helpers, while custom heuristics remain hook specific.

## Integration plan

1. Add a new module `src/hooks/tool-result-pipeline.ts` that builds on `InternalHookEvent` and exposes normalized tool result helpers.
2. Update docs and type definitions to expose the normalized event shape to plugin hooks.
3. Refactor Meridia experiential capture hook to use the shared pipeline for normalization, gating, and buffer handling while keeping its scoring logic intact.
4. Add a reference implementation in a bundled hook to demonstrate the API shape and guide plugin authors.
5. Add tests for normalization, gating, and persistence helpers to ensure compatibility with existing hooks.

## Expected impact

- Shrinks hook implementations by extracting repeated parsing and persistence logic.
- Makes tool result hooks more reliable with consistent metadata and gating behavior.
- Encourages plugin hooks to follow a shared event contract instead of ad hoc parsing.

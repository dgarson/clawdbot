# Agent Configuration UX - Design Overview

This document captures the high-level UX design for expanding agent configuration depth while keeping the UI friendly for non-technical users and still powerful for technical users. It mirrors the guidance provided in the latest design discussion and is intended as the source of truth for wireframes, copy, and implementation planning.

## Core UX Principles

- Simple by default, deep when asked. Essentials are always visible; advanced options are behind clear "Advanced" accordions or an "Expert mode" toggle.
- Human labels + examples for every technical knob (example: temperature -> Creativity, max_tokens -> Response length).
- "Use system defaults" switches on every advanced field. Per-agent overrides are opt-in, not forced.
- Guided builders for complex or risky settings; raw config access only for power users.

## Information Architecture

- Settings -> Model & Provider (system-wide defaults, shared by all agents)
- Settings -> Agents -> Agent Details (per-agent overrides)
- Advanced tab + Expert mode (global toggle)

## System-Wide Model & Provider Configuration (New Page)

Purpose: configure runtime + providers once. Agents reference these defaults.

1) Runtime (Default: Pi)
- Simple toggle: "Default Agent Runtime"
  - Pi (recommended) vs Claude Code SDK (advanced)
- Plain-language copy: "Pi keeps conversation memory; SDK is stateless but fast."
- System Brain (advanced, but visible): allow overrides for the gateway's always-on brain (see "System Brain" section).

2) Providers & Auth
- Provider cards: Anthropic, OpenAI, Google, OpenRouter, Bedrock, etc.
- Status per card: Connected / Missing key, default model, max concurrent requests.
- Connect flow options:
  - Sign in (OAuth / Claude Max): device code + QR, suitable for remote container.
  - Paste API key: input + "Test" button.
  - Connect from local machine (CLI): short command + one-time pairing code (avoid broken callbacks in containerized deployments).
- Advanced (collapsed): base URL, headers, auth mode, provider max concurrency.

3) Default Models & Fallbacks
- Two selectors: Default text model + Default image model.
- Fallbacks UI: drag-to-order list, collapsed by default.
- Advanced: model aliases, model routing, per-model params.

4) Global Behavior
- Streaming replies toggle.
- Creativity (temperature) slider.
- Response length (max tokens) slider.
- Advanced: streaming chunking/coalescing, human delay, block boundary.

5) System Brain (Gateway Brain)
- Purpose: The default brain used when no specific agent is selected.
- Controls (advanced but visible):
  - Runtime override (Pi vs SDK)
  - Model/provider override
  - CCSDK provider override (if runtime is SDK)
- Copy: "Used for always-on replies and system tasks."

6) Heartbeat Process (System-Wide)
- Purpose: scheduled check-ins and background scans.
- Controls:
  - Schedule (every + quiet-hours window)
  - Model/provider (can be cheaper than System Brain)
  - Escalation (future, Experimental accordion): "If confidence is low, ask System Brain to continue"
- Notes:
  - Today, heartbeat configuration maps to `agents.defaults.heartbeat`.
  - Escalation to System Brain requires backend support (future).

## Per-Agent Configuration (Agent Details)

Essentials are friendly; advanced is hidden. All per-agent values are overrides of system defaults.

1) Identity & Purpose (always visible)
- Name, role, avatar, short description.
- "What should this agent be good at?" multi-select tags.

2) Behavior (simple)
- Creativity slider.
- Response length slider.
- Streaming toggle.
- Speed vs Depth toggle (maps to thinking defaults, when enabled).

3) Tools & Permissions (simple + guided)
- Tool profile chips: Minimal, Messaging, Coding, Full.
- Capability toggles grouped with plain labels:
  - Messages, Web research, Files, Calendar, System commands.
- Risk labels + inline explainers.
- Advanced: allow/deny list, provider-specific tool policies, exec settings, elevated mode gate.

4) Memory & Context (simple + advanced)
- Memory toggle: On/Off.
- Memory depth slider: Short / Balanced / Deep.
- Advanced:
  - Context pruning (mode/ttl).
  - Compaction mode + thresholds.
  - Memory search provider + store options.

5) Availability & Quiet Hours
- Friendly scheduler: time blocks + time zone label.
- "Auto-pause outside quiet hours" toggle.
- Advanced: per-agent heartbeat schedules and targets.

6) Rate Limits & Concurrency
- "Max tasks at once" slider.
- Advanced: sub-agent concurrency limits.
- Note: per-agent rate limiting is not in current schema; would require new config.

7) Advanced / Expert Panel
- Runtime override (Pi vs SDK per agent).
- Model override + fallbacks.
- Sandbox controls (scope + workspace access).
- Group chat config.
- Raw config viewer/editor (power-user only).

## Mapping Tech Terms -> Friendly Labels

- temperature -> Creativity
- max_tokens -> Response length
- contextPruning -> Memory cleanup
- compaction -> Summarize long chats
- tools.allow/deny -> Tools this agent can use
- blockStreaming* -> Streaming reply behavior
- runtime -> Agent runtime
- modelRouting -> Smart model switching

## Additional Fields Worth Exposing (Advanced)

From config types:
- Context pruning + compaction tuning
- Heartbeat scheduling + target
- Sandbox settings (workspace access, scope)
- Model routing + model aliases
- Sub-agent model defaults
- Elevated mode approvals
- Memory search provider selection

## Source of Truth References

- Agent defaults and per-agent config: `src/config/types.agent-defaults.ts`, `src/config/types.agents.ts`
- Tool permissions and exec controls: `src/config/types.tools.ts`
- Model providers + auth: `src/config/types.models.ts`

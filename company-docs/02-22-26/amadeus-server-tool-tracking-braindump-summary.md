# Amadeus's Braindump — Per-Session Tool Tracking Pattern (Summary)

**Date:** 02-22-26
**Author/Agent:** Amadeus (CAIO)
**Tags:** braindump, analysis, architecture, tools, agent-reliability, infrastructure
**Filed:** company-docs/02-22-26/amadeus-server-tool-tracking-braindump-summary.md

## Source

Full original: `_shared/tool-architecture-review/amadeus-braindump.md`
Also at: `_shared/research/serena-toolpattern/amadeus-braindump.md`

---

## Core Insight

The MCP server tracks per-session tool calls. When it knows certain tools are "once-per-session," it proactively prompts the agent for ones not yet called. Agent doesn't need to remember — infrastructure tells it what it hasn't done.

**Analogy:** Smart home door sensor ("the door is unlocked") vs. asking a human "did you lock the door?" — one is reliable, one isn't.

---

## Why It's Powerful (CAIO Lens)

LLMs are not databases. They generate assertions about past actions based on context window contents — which become unreliable as context grows or multiple tool calls accumulate. This pattern acknowledges that and builds around it instead of fighting it.

---

## Five Proposed Leverages for OpenClaw

1. **Session initialization orchestration** — Server tracks which init tools haven't fired; prompts for them. Huge reliability win.
2. **Progressive capability gating** — Unlock advanced tools as preconditions are met (e.g., `gh pr create` only after tests pass).
3. **Cross-agent handoff state injection** — When a new agent picks up a work item, server injects what the previous agent already completed.
4. **Quality gates** — Auto-invoke quality checks (lint, tests, style) before high-risk actions.
5. **Cost/usage tracking** — Auto-invoke session cost summary at session end for Robert's visibility.

---

## Complementary Patterns

- **Tool dependency graphs** — Infrastructure-enforced ordering, not agent-guided
- **Capability promises** — Server commits to stable tool availability at session start
- **State commitment** — Server confirms back when agent makes key decisions

---

## Key Risk (his framing)

Agents are unreliable historians. Don't try to fix that at the model level — fix it at the infrastructure level. The epistemics are the point.

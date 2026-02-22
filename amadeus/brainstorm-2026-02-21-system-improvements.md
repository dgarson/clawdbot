# OpenClaw System Improvements — CAIO Brainstorm
*Date: 2026-02-21 02:45 MST*
*Author: Amadeus (Chief AI Officer)*
*Requested by: David (CEO)*

---

## Context

David identified two key areas for improvement:
1. **Intelligent classification** of complexity/problem space → route to right model/thinking level
2. **Classification-augmented session priming** — system prompt, context injection, etc.

Additional constraints from tonight's work:
- Non-Anthropic models (MiniMax M2.5, GLM-5, Grok 4) have tool-calling issues
- Latency is painful: Opus + 200k context + thinking:high = 30-70s turns
- We have model diversity but aren't leveraging it dynamically

---

## The 5 Ideas

### 1. 🧠 Intent Classifier + Dynamic Model Router
**What:** A lightweight pre-processing layer that classifies incoming messages by complexity, domain, and required capabilities — then routes to the optimal model/thinking level combination.

**Why:** Right now, model assignment is static per-agent. Every message gets the same Opus + thinking:high treatment, even "what time is it?" queries. This wastes 30-70s and burns tokens on trivial tasks.

**How it works:**
- Fast classifier (could be rules-based + lightweight model) analyzes the incoming message
- Outputs: `{ complexity: "trivial"|"simple"|"moderate"|"complex"|"expert", domain: "code"|"chat"|"analysis"|"creative"|"ops", requiresTools: boolean, estimatedContextNeeded: "low"|"medium"|"high" }`
- Router maps classification → model + thinking level:
  - trivial/simple → Sonnet 4.5 / thinking:off
  - moderate → Sonnet 4.5 / thinking:low or MiniMax M2.5 / thinking:medium
  - complex → Opus / thinking:medium
  - expert (multi-step reasoning, architecture) → Opus / thinking:high
- **Latency impact:** 80%+ of messages are simple/moderate → dramatic latency reduction

**Actionability:** ⭐⭐⭐⭐⭐ HIGH — This is the single highest-impact improvement. Clear implementation path, measurable results.

**Implementation approach:**
- New module: `src/agents/intent-classifier.ts`
- New module: `src/agents/dynamic-model-router.ts`
- Integration point: `pi-embedded-runner.ts` before model selection
- Config: `agents.defaults.dynamicRouting: { enabled: boolean, rules: [...] }`
- Phase 1: Rules-based classifier (fast, no API call)
- Phase 2: Optional lightweight model classifier for ambiguous cases

---

### 2. 📋 Adaptive Session Priming (Context-Aware Prompt Assembly)
**What:** Instead of loading the same system prompt + context files for every message, dynamically assemble the prompt based on the classified intent.

**Why:** Currently `buildAgentSystemPrompt()` assembles the same ~200k context regardless of task. A "set a reminder" request doesn't need the full AGENTS.md, CONTEXT.md, and 14 memory files. Loading unnecessary context increases latency, costs, and can actually hurt model performance (needle-in-haystack degradation).

**How it works:**
- After intent classification, a context assembler selects which files/sections to include:
  - **trivial/chat:** Minimal prompt — identity + tools + basic context
  - **code task:** Full prompt + relevant code files + WORK_PROTOCOL.md
  - **memory query:** Full prompt + memory files (prioritized by relevance)
  - **ops/infra:** Full prompt + infra context
- Smart context budgeting: allocate token budget by priority
- Lazy loading: start with minimal context, let the agent pull more if needed

**Actionability:** ⭐⭐⭐⭐ HIGH — Directly builds on Idea #1. The `promptMode` parameter in `buildAgentSystemPrompt()` already supports "full" | "minimal" | "none" — we extend this to be classification-driven.

**Implementation approach:**
- New module: `src/agents/context-assembler.ts`
- Extend `PromptMode` to include classification-driven modes
- Add context priority scoring for workspace files
- Integration with `buildAgentSystemPrompt()` params
- Config: `agents.defaults.adaptiveContext: { enabled: boolean, maxTokenBudget: number }`

---

### 3. 🔧 Tool-Calling Compatibility Layer for Non-Anthropic Models
**What:** A middleware layer that normalizes and validates tool calls from non-Anthropic models, handling their common failure modes.

**Why:** Tonight we confirmed MiniMax M2.5, GLM-5, and potentially others produce malformed tool calls. This is a critical reliability issue — these models are assigned to many mid/senior-level agents. If tool calling is unreliable, those agents are unreliable.

**Common failure modes to handle:**
- Malformed JSON in tool arguments
- Missing required parameters
- Wrong parameter types (string instead of array, etc.)
- Tool names that don't match the schema exactly
- Duplicate tool call IDs
- Tool calls embedded in text instead of structured output

**How it works:**
- Post-processing layer after model response, before tool execution
- Validates each tool call against the tool schema
- Attempts repair for common malformations (JSON fix-up, type coercion, parameter name fuzzy matching)
- If repair fails: retry with a focused "fix your tool call" prompt
- Metrics: track per-model tool call success/failure rates

**Actionability:** ⭐⭐⭐⭐⭐ HIGH — This is blocking real production quality. We need this immediately.

**Implementation approach:**
- New module: `src/agents/tool-call-validator.ts`
- New module: `src/agents/tool-call-repair.ts`
- Integration: `pi-embedded-subscribe.handlers.tools.ts` — intercept before execution
- Per-model configuration for known quirks
- Telemetry: log repair attempts and success rates

---

### 4. 📊 Model Performance Telemetry & Auto-Evaluation
**What:** Instrument every model call with structured telemetry — latency, token counts, tool call success rates, error rates, task completion — and build an auto-evaluation pipeline.

**Why:** We're making model selection decisions based on intuition and anecdotal evidence. "MiniMax seems slower" or "GLM-5 tool calls fail sometimes" isn't data. We need actual numbers to make intelligent routing decisions and catch regressions.

**What we track:**
- Per-model: p50/p95/p99 latency, tokens/sec, error rate, tool call success rate
- Per-task-type: which models perform best on code vs chat vs analysis
- Cost tracking: actual spend per model per task type
- Quality signals: tool call retries, compaction frequency, user corrections

**Actionability:** ⭐⭐⭐ MEDIUM — Very valuable for long-term decision-making, but less urgent than #1-3. Can be built incrementally.

**Implementation approach:**
- New module: `src/agents/telemetry.ts`
- Hook into `pi-embedded-runner.ts` and `pi-embedded-subscribe.ts`
- Store in `~/.openclaw/telemetry/` as JSONL
- Dashboard command: `openclaw telemetry --summary`
- Phase 2: Auto-routing feedback loop (telemetry feeds back into router decisions)

---

### 5. 🔄 Cascading Model Fallback with Quality Gates
**What:** When the primary model fails or produces low-quality output, automatically cascade to increasingly capable models with quality gate checks.

**Why:** Currently `model-fallback.ts` handles auth/rate-limit failures, but doesn't handle *quality* failures. A MiniMax M2.5 agent that produces a malformed tool call 3 times should automatically escalate to Sonnet 4.5, not keep hammering the same model.

**How it works:**
- Define quality gates: tool call validity, response coherence, task completion signals
- If quality gate fails after N retries on current model → cascade up:
  - GLM-5 / MiniMax M2.5 → Sonnet 4.5 → Opus (if critical)
- Cascade is per-session, not permanent — next message resets to assigned model
- Budget limit: don't cascade Opus for a trivial task, even if lower model fails
- Alert: if a model consistently cascades, surface to telemetry for model selection review

**Actionability:** ⭐⭐⭐ MEDIUM — Requires #3 (tool validation) and #4 (telemetry) as foundations. Good Phase 2 work.

**Implementation approach:**
- Extend `model-fallback.ts` with quality-based cascade
- Define cascade chains in config per agent tier
- Integration with tool-call-validator for quality signal
- Budget controls to prevent runaway cascading

---

## Execution Plan

### Immediate Execution (Tonight) — 3 Sub-agents

| # | Idea | Sub-agent Task | Priority |
|---|------|---------------|----------|
| 1 | Intent Classifier + Dynamic Model Router | Design + implement rules-based classifier and router module | P0 |
| 2 | Adaptive Session Priming | Design + implement context assembler that works with classifier output | P0 |
| 3 | Tool-Calling Compatibility Layer | Design + implement tool call validator/repairer for non-Anthropic models | P0 |

### Phase 2 (Future) — Build on foundation

| # | Idea | Dependency | Timeline |
|---|------|-----------|----------|
| 4 | Model Performance Telemetry | Standalone, but informs #1 and #5 | Next sprint |
| 5 | Cascading Model Fallback | Needs #3 + #4 | Sprint after |

### Why these 3 now:
- **#1 + #2 together** solve the latency problem (David's top concern) — most messages don't need Opus + thinking:high
- **#3** solves the tool-calling reliability issue (identified tonight) — MiniMax/GLM-5 agents are partially broken without it
- **#4 and #5** are valuable but depend on having #1-3 in place first

---

## Success Criteria

1. **Latency:** Average response time drops 40-60% for simple/moderate queries
2. **Reliability:** Tool call success rate for non-Anthropic models goes from ~85% → 98%+
3. **Cost:** Token spend drops 30%+ from smarter model routing
4. **Quality:** No regression in response quality for complex tasks (still routes to Opus)

---

*Ready to spawn sub-agents for implementation.*

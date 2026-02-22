# MODEL_SELECTION_POLICY.md — Cost-Effective Model Selection

*Created: 2026-02-21*
*Owner: Merlin (Main) — enforced by all managerial/lead agents*

---

## Purpose

Every time an agent spawns a sub-agent (`sessions_spawn`), selects a model for a task, or delegates work, they MUST consciously choose the **cheapest model that can reliably complete the task**. Defaulting to expensive models out of habit is waste. Effectiveness comes first, but cost is a close second.

## Decision Framework

**Priority order: (1) Effectiveness → (2) Cost → (3) Speed**

### Tier 1: Premium Models — Use Sparingly
**Models:** `anthropic/claude-opus-4-6`, `xai/grok-4`
**Cost:** $$$$$
**Use when:**
- Architecture design, system design, complex trade-off analysis
- Multi-step reasoning requiring deep context (>50k tokens of context needed)
- Novel problem-solving with no clear pattern to follow
- Strategic decisions, business analysis, product strategy
- Writing that requires nuance, persuasion, or creativity
- Complex debugging requiring understanding of large systems
- Code review of critical/security-sensitive components

**Never use for:** Routine tasks, simple Q&A, mechanical work, status checks

### Tier 2: Strong General Purpose
**Models:** `anthropic/claude-sonnet-4-6`, `openai/gpt-5.2`
**Cost:** $$$
**Use when:**
- Moderate complexity coding tasks (new features with some design decisions)
- Code review of standard PRs
- Writing documentation with technical depth
- Multi-file refactoring with judgment calls
- Summarization of complex topics
- Agent orchestration requiring nuanced delegation

**Never use for:** Merge conflict resolution, simple file edits, status checks, formatting

### Tier 3: Cost-Effective Workhorses — DEFAULT CHOICE
**Models:** `minimax-portal/MiniMax-M2.5`, `zai/glm-5`, `google/gemini-3.1-pro-preview`
**Cost:** $$
**Use when:**
- Merge conflict resolution
- Simple to moderate coding tasks with clear patterns
- Test writing with clear specifications
- Documentation updates, README changes
- Data formatting, JSON/YAML manipulation
- Build fixes, linting, dependency updates
- Git operations (branch management, cherry-picks, rebases)
- Straightforward bug fixes with clear reproduction steps
- Boilerplate generation

**This tier should handle 60-70% of spawned work.**

### Tier 4: Fast/Cheap — High Volume Work
**Models:** `google/gemini-3-flash-preview`, `zai/glm-4.7-flash`, `openai-codex/gpt-5.3-codex-spark`, `openai-codex/gpt-5.1-codex-mini`
**Cost:** $
**Use when:**
- Simple text transformations
- File searching, grep-and-report tasks
- Status checks and verifications
- Formatting and linting fixes
- Simple template generation
- One-shot Q&A that doesn't require deep reasoning
- Heartbeat/monitoring tasks

---

## Quick Reference: Common Tasks → Model Tier

| Task | Tier | Example Models |
|---|---|---|
| Architecture/design decisions | T1 | opus, grok-4 |
| Strategic analysis | T1 | opus |
| Complex code review | T1-T2 | opus, sonnet |
| New feature implementation | T2 | sonnet, gpt-5.2 |
| Standard code review | T2-T3 | sonnet, MiniMax-M2.5 |
| Merge conflict resolution | T3 | MiniMax-M2.5, GLM-5 |
| Branch management/git ops | T3 | MiniMax-M2.5, GLM-5 |
| Build fixes | T3 | MiniMax-M2.5, GLM-5 |
| Test writing (clear spec) | T3 | MiniMax-M2.5, GLM-5 |
| Doc updates | T3 | MiniMax-M2.5, GLM-5 |
| Simple bug fixes | T3 | MiniMax-M2.5, GLM-5 |
| Status checks / verification | T4 | gemini-flash, codex-spark |
| Text formatting | T4 | gemini-flash, codex-spark |
| Simple Q&A | T4 | gemini-flash, codex-spark |

---

## Rules for Managers/Leads (Main, Xavier, Amadeus, Julia, Stephan)

1. **ALWAYS specify `model` in `sessions_spawn`** — never rely on the default.
2. **Start with the lowest viable tier.** If unsure between T2 and T3, try T3 first.
3. **Document your model choice reasoning** if using T1 for spawned work (one line is fine: "Using opus because X requires complex architectural judgment").
4. **Track model usage patterns** — if a T3 model consistently fails at a task type, escalate the task category to T2 in this doc.
5. **Review this policy monthly** — as models improve, tasks shift tiers.

## Rules for All Agents

1. When spawning sub-agents, consider the task complexity honestly.
2. Don't use sonnet/opus for work that GLM-5 or MiniMax can handle.
3. If a task fails on a cheaper model, retry on the next tier up — don't jump straight to opus.
4. Log model selection decisions in daily memory for pattern analysis.

---

## Anti-Patterns (Don't Do This)

❌ Spawning sonnet for merge conflict resolution
❌ Using opus for git branch management
❌ Defaulting to the same model for every spawn without thinking
❌ Using T1 models for status checks or verifications
❌ Omitting the `model` parameter in `sessions_spawn` (relies on default, which may be expensive)

---

*This policy is a living document. Update it as we learn which models handle which tasks well.*

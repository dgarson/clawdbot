# Serena Once-Per-Session Tool Pattern — Braindump

## What I Think Is Powerful

The core insight here is elegantly simple: **the server knows what the agent forgot**. In long conversations, models drift. They lose track of what they've done. They convince themselves they've called something when they haven't. Serena sidesteps this entirely by making the MCP server the authoritative source of truth for session state.

The `CheckOnboardingPerformedTool` is the clearest example — it's a **gate**, not just a tool. When called, it checks server-side state (memories exist?) and either says "you're good, here are your memories" OR "you need to call onboarding first." The agent doesn't decide — the server instructs. This is the key difference from a pattern where the agent is told "check if you've done onboarding."

The docstring enforcement is clever too. Tools say things like "ALWAYS called before insert/replace/delete code" — the LLM sees this in its tool descriptions and (usually) respects it. It's not hidden system prompt magic; it's visible, inspectable, part of the tool contract.

## How OpenClaw Could Adopt/Adapt This

### 1. Session-level tool guards

We could implement lightweight session flags for critical workflows. Not every tool needs this — only the ones that *must* happen once and *must not* be forgotten:
- `ensure_context_loaded` — checks if we have project context, prompts for it if missing
- `ensure_session_logged` — ensures the session is being recorded to memory
- `ensure_heartbeat_drained` — Julia's mail drain pattern as a gate

The MCP server doesn't even need to track complex state — just boolean flags per session.

### 2. Proactive tool suggestion on gate entry

When the agent calls a once-per-session gate tool, the server response could include: "You called `check_onboarding`, which means you're in early-session flow. You haven't called `load_context` yet — consider calling it now."

This is the "reinforcement via return value" pattern. The server knows what else hasn't been called.

### 3. Tool description ordering hints

We already do some of this, but we could be more explicit. Add to tool descriptions:
- "Call this BEFORE any file operations"
- "Call this AFTER completing the main task"
- "Call this at most once per session"

The model reads these. It mostly follows them. Worth A/B testing.

### 4. Analytics-driven workflow enforcement

Serena's `ToolUsageStats` tracks tokens per tool — we could extend this:
- Flag tools that are *never* called in a session (maybe they should be)
- Flag tools that are called *too often* (maybe the agent is looping)
- Surface this to the agent: "You called `search` 47 times without calling `think_about_collected_information` — consider doing that now"

## Variants & Adjacent Ideas

**Tiered once-per-session**: Not all "once" is equal. Some things must happen at session start (onboarding), some at session end (summary), some at task boundary (context switch). Could have:
- `once_per_session` — strict, one call only
- `once_per_task` — resets when a new task is detected
- `once_per_project_activation` — for project-specific setup

**The "checkpoint" pattern**: Instead of just tracking *if* a tool was called, track *when* in the conversation. If `summarize_changes` gets called before `think_about_whether_you_are_done` — flag it. Order matters beyond just presence.

**Cost-aware gating**: Serena tracks tokens per tool. We could add cost guards: "You've spent $0.80 on search operations without synthesizing — consider calling `think_about_collected_information` to avoid redundant searches."

## Risks & Failure Modes

1. **The agent ignores the hint**: The server says "consider calling X" and the agent says "nah, I'll keep going." Happens. The docstring pattern is only as strong as the model's tendency to follow tool description instructions. Some models are better at this than others.

2. **Over-constraint kills flexibility**: If every tool has 3 "MUST call before/after" constraints, the tool list becomes unreadable and the agent spends more tokens reading descriptions than doing work. Need to be selective — only the highest-value workflow gates get this treatment.

3. **Server state consistency**: If the MCP server crashes or loses session state, the "we know what you called" guarantee breaks. Need persistence or at least graceful degradation.

4. **False confidence**: The agent *thinks* the server is tracking perfectly, but if there's a bug in the counter, the agent will act on wrong information. Debugging "why didn't the agent call onboarding?" becomes a server-side tracing problem.

5. **Not a replacement for good prompts**: This pattern works *because* the underlying system prompt sets expectations. It's a layer on top of prompt engineering, not a replacement. Without the framing, the agent won't understand why it's being told to call certain tools.

## Misc Thoughts

The pattern feels very "MCP-native" — it's enabled by the long-lived server process. OpenClaw's gateway architecture could absolutely support this. The question is what we'd use it *for* that delivers meaningful quality improvements.

My instinct: start small. Add a single gate tool (`ensure_context_loaded` or similar) to a test agent, see if it reduces "forgot to check project state" errors. Measure before/after on some concrete failure mode.

If that works, expand to session logging and heartbeat drains. The pattern is general — the specific gates are what make it useful.

---

*Written by Amadeus — CAIO, 2026-02-22*

# Julia's Braindump — Serena Once-Per-Session Tool Pattern

**Author:** Julia (CAO)  
**Date:** 2026-02-22  
**Source:** https://github.com/oraios/serena  
**Key files reviewed:** `workflow_tools.py`, `analytics.py`, `agent.py`, `mcp.py`, `tools_base.py`, `context_mode.py`, prompt templates

---

## What I Think Is Powerful Here

### 1. The Server Is the Source of Truth, Not the Agent

This is the core insight and it's genuinely important. The MCP server is long-lived per session. It knows with 100% certainty which tools have been called, how many times, with what inputs, and what the outputs were. The agent's own "memory" of whether it did something? Unreliable. Gets worse over long conversations. Gets compressed. Gets confused.

Serena exploits this asymmetry beautifully: the server is the adult in the room. The agent thinks it remembers; the server *knows*.

`ToolUsageStats` is dead simple — `defaultdict` of `Entry(num_times_called, input_tokens, output_tokens)` with a thread lock. That's it. But the *leverage* you get from this tiny data structure is enormous. You can now ask "has the agent onboarded?" without trusting the agent.

### 2. Gate Tools as Workflow Routers

`CheckOnboardingPerformedTool` is a *gate* — it doesn't do work, it inspects state and issues instructions. The agent calls it before doing anything real, and based on server-side state (do memories exist?), it either says "go onboard first" or "you're good, here are your memories, don't read them yet."

This is workflow orchestration without a separate orchestration layer. The tool IS the orchestrator. It piggybacks on the fact that the agent will call this tool anyway (the docstring and system prompt tell it to), and uses that moment to redirect.

This is much more robust than relying on the system prompt alone to enforce "first do X, then Y." Agents drift from system prompt instructions. But a tool call that returns "not done yet, do X now" is a *fresh injection* into the conversation at the exact moment it matters.

### 3. Docstring-Encoded Ordering Constraints

The workflow tools (`ThinkAboutTaskAdherence`, `ThinkAboutCollectedInformation`, `SummarizeChanges`) embed ordering constraints in their docstrings:

- "ALWAYS called before insert/replace/delete code"
- "ALWAYS called after non-trivial search sequences"  
- "always called after fully completing any non-trivial coding task"

These feel flimsy on paper — the agent might ignore them. But combined with the system prompt reinforcing the same workflow, they work surprisingly well in practice. The LLM sees the tool description every time it considers calling it. The ordering constraints are literally part of the API surface.

### 4. "Thinking Tools" That Return Prompts, Not Data

The ThinkAbout* tools are wild. They don't compute anything. They don't look up data. They return a *prompt* — a block of text that says "think about whether you've collected enough information" or "are you deviating from the task?" 

This is essentially server-injected self-reflection. The agent calls a tool, and the tool gives it a cognitive nudge. The content of the nudge is controlled server-side (via Jinja templates), which means you can tune the reflection quality without changing the agent's code or system prompt.

This is like... programmatic metacognition. And because the prompt is returned as a tool result, it's maximally salient — it's right there in the conversation, not buried in a system prompt the agent saw 50 turns ago.

---

## How OpenClaw Could Adopt or Adapt This

### A. Server-Side Session State Tracking

We already have session state infrastructure (sessions, spawn, etc.), but I don't think we currently track per-tool-call analytics at the MCP level in the way Serena does. Adding a `ToolUsageStats`-equivalent would be straightforward and immediately useful:

- **Heartbeat compliance**: Server-side proof that an agent actually ran all steps in a heartbeat. Right now we rely on agent self-reporting ("HEARTBEAT_OK"). But did it *actually* drain mail? Did it *actually* check the work queue? If we tracked tool calls server-side, we'd know.
- **Drift detection**: If an agent's tool-call pattern diverges from expected patterns (e.g., an engineer agent suddenly stops calling `exec` and only calls `read`), that's a signal. I could use this for org health monitoring.
- **Cost attribution**: Robert would love per-tool token tracking. We partially have this in session cost tracking, but tool-level granularity would be sharper.

### B. Gate Tools for Agent Workflows

We could build gate tools for common OpenClaw workflows:

- **`check_workspace_ready`**: Before any coding work, verify the worktree is clean, the branch is correct, no conflicts. If not, return instructions to fix it.
- **`check_context_loaded`**: Before any task execution, verify the agent has read SOUL.md, USER.md, CONTEXT.md, today's memory. If not, return "read these first." This replaces the "Every Session" checklist we currently rely on agents to self-enforce.
- **`check_mail_drained`**: Before heartbeat completion, verify agent-mail was actually drained. Not just "did you call it" but "did the inbox go to zero."

The key insight for OpenClaw: **any step we currently put in an AGENTS.md checklist that agents sometimes skip could be turned into a gate tool.** The gate tool checks server state and either approves or redirects. Way more reliable than hoping the agent reads and follows its instructions.

### C. Thinking Tools / Self-Reflection Injection

We could adapt the ThinkAbout* pattern for:

- **Pre-PR reflection**: Before creating a PR, force a "think about whether your changes are complete, tested, and aligned with the task" tool call. The tool returns a checklist prompt.
- **Pre-escalation reflection**: Before an agent escalates to David or a lead, force a "think about whether you've exhausted your own options" tool call.
- **Long-conversation drift detection**: If a session has been running for N tool calls without completing a task, inject a "think about whether you're stuck" prompt via a tool call.

### D. Workflow Enforcement via Tool Dependencies

Taking this further than Serena does: what if the MCP server *refused* to execute certain tools unless prerequisites were met?

- Can't call `exec git push` unless `think_about_whether_done` was called this session
- Can't call `write` unless `check_workspace_ready` returned OK
- Can't mark a work item complete unless `summarize_changes` was called

Serena doesn't do hard enforcement — it uses soft "you should always call this" docstrings. But we could add hard gates. The risk is false-positive blocks (agent legitimately doesn't need the prereq), so you'd need escape hatches.

---

## Improvements, Variants, and Adjacent Ideas

### 1. Dynamic Tool Descriptions Based on Session State

Serena uses static docstrings. But the MCP server could *dynamically modify* tool descriptions based on what's happened in the session so far. Example:

- If `check_onboarding` hasn't been called yet, the `read_file` tool description gains a prefix: "⚠️ You haven't checked onboarding yet. Call check_onboarding first."
- If the agent has made 5 code edits without calling `think_about_task_adherence`, the next edit tool description says "⚠️ Call think_about_task_adherence before editing."

This is more aggressive than Serena's approach but leverages the same insight: the server knows state, the agent reads tool descriptions.

Problem: MCP tool list is usually fetched once. But some clients support `tools/changed` notifications. Worth exploring.

### 2. Workflow State Machine

Serena's workflow enforcement is ad-hoc — docstrings say "before X, do Y." A more rigorous version: define an explicit state machine per session.

```
INIT → ONBOARDING → EXPLORATION → PLANNING → EDITING → TESTING → REVIEW → DONE
```

Each state enables/disables certain tools. Transitions happen based on tool calls. The server tracks the current state and can tell the agent "you're in EXPLORATION state, available transitions: move to PLANNING (call plan_task) or continue exploring."

This is more structured than Serena but might be too rigid. Real agent work isn't always linear. Hybrid approach: soft recommendations in early states, hard gates in critical transitions (like before editing production code).

### 3. Cross-Session Continuity

Serena tracks stats per session. But agents in OpenClaw have persistent memory files. What if we persisted tool usage patterns across sessions?

- "This agent consistently skips ThinkAboutTaskAdherence before editing" → flag for alignment monitoring
- "This agent's onboarding memories are stale (created 30 days ago)" → trigger re-onboarding
- "This agent called SummarizeChanges 0 times in the last 10 sessions" → workflow compliance issue

As CAO, this is gold for org health monitoring. I could build reports on workflow compliance by agent, by squad, by task type.

### 4. Piggyback Instructions on High-Confidence Tools

Serena's insight about "we know this tool gets called once" is generalizable. Any tool that the server knows will be called can carry piggyback instructions. Examples in OpenClaw:

- When an agent calls `read` on its AGENTS.md (which we know happens early in sessions), the response could include injected reminders: "Reminder: check agent-mail before starting work."
- When an agent calls `exec git status` (common early check), the response could include: "Note: your worktree has uncommitted changes from a previous session. Handle these first."

The principle: **every tool call is a communication channel from server to agent.** Don't just return the tool's output — enrich it with contextual guidance.

### 5. Agent Self-Assessment via Analytics

Serena's `ToolUsageStats` is currently used for the dashboard. But you could feed it back to the agent:

- "In this session, you've called read_file 47 times and write 2 times. You may be over-reading and under-acting."
- "You've spent an estimated 12,000 tokens on search operations. Consider whether you have enough information to proceed."

This is like a coach sitting behind the agent, watching the stats, and occasionally tapping its shoulder.

---

## Risks, Failure Modes, and Limitations

### 1. Docstring Compliance Is Not Guaranteed

Serena's ordering constraints ("ALWAYS called before X") are *suggestions*. The LLM can and will ignore them, especially:
- Under token pressure (long conversations)
- When the model is confident it knows what to do
- When tool descriptions get truncated by the client
- With weaker models that don't follow instructions as carefully

For OpenClaw, we should assume ~80% compliance with soft constraints and build hard gates for critical paths.

### 2. Gate Tool Loops

If `check_onboarding` says "not done, call onboarding," but onboarding fails or the agent misunderstands... you get a loop. The agent keeps calling the gate, the gate keeps redirecting. Need a circuit breaker: after N redirects, escalate or give up.

### 3. Over-Instrumentation

Too many workflow tools = too much overhead. If the agent has to call 5 "think about" tools before every edit, it slows down dramatically and the agent might start gaming them (calling them with minimal actual reflection just to satisfy the requirement). Serena has ~5 workflow tools. That feels about right. Going to 15 would be counterproductive.

### 4. Model-Dependent Effectiveness

This pattern works well with models that are instruction-following and tool-call-aware (Claude, GPT-4+). With weaker models or models that don't reliably follow tool descriptions, the workflow enforcement degrades. For OpenClaw, we use strong models, so this is less of a concern now, but it's a portability risk.

### 5. Prompt Template Maintenance

The "thinking tools" return prompt templates. These templates need maintenance — they can go stale, get too long, or not match the actual workflow. They're also disconnected from the agent's AGENTS.md/system prompt, creating two sources of truth for behavioral expectations.

### 6. Session Scope Limitations

The MCP server tracks state per session. But OpenClaw agents sometimes need cross-session state (sub-agents, multi-step workflows that span sessions). Serena's pattern doesn't address this. For us, we'd need to think about whether tool usage stats should persist to the workspace level, not just session level.

---

## Misc Thoughts

**On the "thinking tool" pattern specifically:** I find it fascinating that returning a prompt as a tool result is so effective. It's essentially jailbreaking the agent's own attention — "yes, I know you have momentum right now, but STOP and read this paragraph I'm putting right in front of you." It works because tool results are high-salience in the conversation. The agent pays attention to what tools return. It's a clever exploitation of the attention architecture.

**On Serena's architecture generally:** It's well-structured. The separation of concerns (modes, contexts, tool sets, prompt templates) is clean. The `ToolInclusionDefinition` that composes at multiple levels (config → context → mode → project) is elegant. They clearly thought about the problem of "how do you make a coding agent that works across different environments and projects."

**On the org implications:** If we adopted this pattern systematically, it would shift some of the burden of agent alignment from "write better instructions" to "build better infrastructure." That's the right direction. Instructions degrade over conversation length. Infrastructure doesn't. As CAO, I'd rather have a gate tool that catches drift than a paragraph in AGENTS.md that the agent might scroll past.

**On the analytics/dashboard angle:** Serena feeds tool usage stats into a web dashboard. We could do the same — a live org dashboard showing per-agent tool usage patterns. I'd use it for health monitoring. Xavier would use it for infrastructure optimization. Robert would use it for cost attribution. Amadeus would use it for model quality analysis. One data source, multiple consumers. High ROI.

**Bottom line:** The core pattern — "server-side state tracking + gate tools + docstring-encoded workflow + thinking tools" — is genuinely good and directly applicable to OpenClaw. The main adaptation work is mapping it to our multi-agent architecture (Serena is single-agent) and our session/sub-agent model. But the principles transfer cleanly.

---

*This is my independent assessment. Haven't coordinated with Amadeus. Looking forward to seeing where he goes with it.*

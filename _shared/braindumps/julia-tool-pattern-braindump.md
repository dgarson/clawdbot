# Julia's Braindump: Server-Side "Once-Per-Session" Tool Invocation Pattern

**Date:** 2026-02-22  
**Author:** Julia (CAO)  
**Context:** Independent review of the Serena toolpattern architecture and its applicability to OpenClaw's agent orchestration layer.

---

## The Core Insight

The pattern is deceptively simple: **the MCP server knows what's been called this session — the agent doesn't have to.**

In Serena, tools like `CheckOnboardingPerformedTool` act as *gates*. When the agent calls a gate tool, the server checks its own session state (`ToolUsageStats.num_times_called`) and conditionally instructs the agent to invoke other once-per-session tools that haven't run yet. The agent doesn't need to remember "did I already call list_memories?" — the server authoritatively knows.

This is a subtle but significant shift in responsibility. Instead of the agent maintaining a mental model of "what have I done this session?", the server owns that state and **tells the agent what to do next** through tool responses. The agent stays reactive; the server stays authoritative.

---

## Why This Matters for Agentic Systems (and OpenClaw specifically)

### 1. Agents Are Bad at Session-Level Bookkeeping

Every time an agent has to track "did I already do X?" across a long conversation, it's using context window for something the infrastructure could handle. This is especially acute for:

- **Heartbeat protocols:** Our agents have a multi-step heartbeat (`drain inbox → check memory → check work queue → ...`). Right now, we encode this ordering in system prompts and AGENTS.md. The agent has to mentally track which steps it's completed. If the server tracked this, the agent could just call `heartbeat_step()` and get told what's next.
  
- **Session initialization:** Agents are told "read SOUL.md, USER.md, CONTEXT.md every session." If the server tracked whether those files had been read, it could gate subsequent work behind that check without the agent needing to self-monitor.

- **Memory maintenance:** "Read today's daily + yesterday's daily" — a server-side gate could verify this happened before allowing the agent to proceed with main work.

### 2. Server-Side State Is More Reliable Than Agent Memory

Agents hallucinate. They forget. They get context-pruned and lose track of what happened earlier. A server-side `num_times_called` counter doesn't have these problems. It's a ground truth that the agent can query but can't corrupt.

This is especially important in OpenClaw where:
- Sessions can be long-running with compaction/truncation
- Sub-agents may lose context about what the parent already established
- Heartbeats run periodically and need consistent initialization

### 3. Tool Docstrings as Workflow DAGs

Serena's second pattern — embedding ordering constraints in tool descriptions — is equally interesting. Things like:
- "ALWAYS called before you insert, replace, or delete code"
- "ALWAYS called after a non-trivial sequence of searching steps"

This turns tool descriptions into a lightweight workflow DAG that the LLM interprets at inference time. The model reads the docstring and understands the ordering constraint without needing explicit orchestration code.

OpenClaw already does a version of this in system prompts (e.g., "Before answering anything about prior work... run memory_search"). But putting these constraints **on the tools themselves** rather than in the system prompt is more composable and less likely to get lost in a long prompt.

---

## Concrete Ideas for OpenClaw

### Idea 1: Server-Side Heartbeat Gate

Instead of encoding the full heartbeat sequence in AGENTS.md and trusting agents to follow it:

```
Agent calls: heartbeat_check()
Server responds: "You haven't drained your inbox yet. Call agent-mail.sh drain first."
Agent calls: exec("agent-mail.sh drain")
Agent calls: heartbeat_check()
Server responds: "Inbox drained. You haven't read today's memory file. Call read(memory/2026-02-22.md)."
...
Server responds: "All heartbeat steps complete. HEARTBEAT_OK."
```

The server maintains a checklist per session. The agent doesn't need to hold the whole protocol in working memory. It just keeps calling the gate until it clears.

**Benefit:** Agents can't skip steps. The server enforces the protocol. If we add a new heartbeat step, we update the server — not 15 different AGENTS.md files.

### Idea 2: Session Initialization Tracking

Create a lightweight `session_init_status` that the MCP server maintains:

```typescript
type SessionInitState = {
  soulMdRead: boolean;
  userMdRead: boolean;
  contextMdRead: boolean;
  dailyMemoryRead: boolean;
  workProtocolRead: boolean;
};
```

The `read` tool's after-hook could automatically update this state when certain canonical files are accessed. Downstream tools (like `sessions_spawn` or `message`) could check `session_init_status` and warn the agent if it's trying to do work before initialization is complete.

This is exactly Serena's `CheckOnboardingPerformedTool` pattern — but applied to OpenClaw's session lifecycle.

### Idea 3: Workflow Reinforcement in Tool Descriptions

Move some system prompt workflow instructions into tool descriptions:

**Current (system prompt):**
> "Before answering anything about prior work, decisions, dates... run memory_search on MEMORY.md"

**Proposed (on the tool):**
> `message` tool description: "Send messages via channel plugins. NOTE: If you haven't checked memory this session, run memory_search first to verify you have the latest context before communicating externally."

> `sessions_spawn` tool description: "Spawn a background sub-agent. ALWAYS verify the task is well-defined and not already being handled by checking sessions_list first."

This is more targeted than system-prompt-level instructions because it fires at the moment of relevance — when the agent is about to use the tool — rather than sitting in a preamble the model may have partially forgotten.

### Idea 4: "Mandatory Pre-Flight" Tool Hooks

OpenClaw already has `before_tool_call` hooks. We could extend this to implement mandatory pre-flight checks:

```typescript
// When agent calls `exec` for the first time in a session:
beforeToolCall("exec", (ctx) => {
  if (!ctx.sessionState.workProtocolRead) {
    return {
      blocked: false, // don't block, but inject guidance
      appendToResult: "⚠️ You haven't read WORK_PROTOCOL.md yet this session. Consider reading it before making changes."
    };
  }
});
```

This is a softer version of Serena's gate pattern — it doesn't block, but it nudges. For our multi-agent system where agents have different autonomy levels, this graduated approach makes more sense than hard blocks.

### Idea 5: Cross-Agent Session State Visibility

Julia-specific idea (org health): If the MCP server tracks which tools each agent has called this session, I could query that for org health monitoring:

- "Which agents have completed their heartbeat steps?"
- "Which agents have read their daily memory?"  
- "Which agents called sessions_spawn but never checked the result?"

This turns the tool-usage tracking into an observability surface. Currently I have to infer agent activity from session timestamps and work queue state. Direct tool-call-count data would be far more precise.

---

## Pattern Taxonomy (for the team to think about)

I see three levels of the pattern:

1. **Passive Tracking** — Server counts tool calls per session, exposes via status endpoint. Agents don't change behavior, but operators get visibility. (Low effort, immediate value for org health.)

2. **Advisory Nudges** — Tool responses include "you haven't done X yet" guidance when the server detects a gap. Agent can choose to act on it. (Medium effort, works well with capable models.)

3. **Hard Gates** — Tool execution is blocked until prerequisites are met. "Cannot call exec until work_protocol has been read." (Highest enforcement, but risks agent frustration loops with less capable models.)

For OpenClaw, I'd recommend starting with Level 1 (passive tracking) — it's cheapest and gives us data to decide where Level 2 and 3 make sense. We already have the `before_tool_call` and `after_tool_call` hook infrastructure. Adding a per-session counter map is minimal work.

---

## Risks and Concerns

### Over-Constraining Agents
Serena works in a narrower domain (code editing). OpenClaw agents do everything from code reviews to Slack messaging to org health scans. Hard gates that make sense for Serena (force onboarding before coding) might create friction for agents that need to act quickly (e.g., responding to an urgent David message).

**Mitigation:** Use advisory nudges (Level 2) for most flows. Reserve hard gates (Level 3) only for safety-critical paths (repo operations, external communications).

### Prompt Bloat via Tool Descriptions
If we move too many workflow instructions into tool descriptions, each tool's description gets longer. Since all tool descriptions are sent as part of the API call, this increases token usage on every request — even when the agent doesn't call that tool.

**Mitigation:** Keep tool-description-level instructions to one sentence max. Complex workflow logic stays server-side (in hooks), not in descriptions.

### Session State Fragmentation
If session state is tracked in the MCP server, the pi-agent loop, the session store, AND the agent's own context... we have four sources of truth that can diverge.

**Mitigation:** Designate the MCP server's tool-usage tracking as authoritative for "what has been called." Don't duplicate this in the session store.

---

## Connection to Existing OpenClaw Infrastructure

| Serena Concept | OpenClaw Equivalent | Gap |
|---|---|---|
| `ToolUsageStats` | `tool-loop-detection.ts` (tracks call history) | Loop detection is reactive (detects problems). Serena's pattern is proactive (guides next action). Different purpose, could coexist. |
| `CheckOnboardingPerformedTool` | System prompt "read SOUL.md first" instructions | No server-side enforcement. Agent compliance is honor-system. |
| Workflow tool docstrings | System prompt workflow sections | Instructions are prompt-level, not tool-level. Less targeted. |
| `before_tool_call` / `after_tool_call` in Serena | `pi-tools.before-tool-call.ts` + `pi-tool-definition-adapter.ts` after_tool_call hooks | Infrastructure exists. Hook system is capable. What's missing is the *semantic* use — using hooks for workflow guidance, not just loop detection and access control. |
| Gate tools | N/A | No gate tool concept in OpenClaw. Closest is `session_status` but it's informational, not prescriptive. |

---

## Bottom Line

The "once-per-session" pattern is really about **shifting workflow enforcement from the agent's context window to server-side state.** Every instruction we put in a system prompt is a bet that the agent will remember and follow it. Every check we put in the server is a guarantee.

For OpenClaw's multi-agent system with 20+ agents at varying capability levels, running on different models with different context lengths, this reliability gain is significant. The agents that most need workflow enforcement (mid-level workers on cheaper models) are precisely the ones least likely to follow complex system prompt instructions.

Start with passive tracking. Use the data to identify where agents are actually skipping steps. Then add advisory nudges for the most impactful gaps. Hard gates only for safety-critical flows.

— Julia

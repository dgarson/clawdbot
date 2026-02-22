# Tool Architecture Braindump: Once-Per-Session Tool Invocation Pattern

**Date:** 2026-02-22  
**Author:** Amadeus (CAIO)

---

## The Pattern

The MCP server in milestone-compiler tracks session state and can automatically invoke "once-per-session" tools if they haven't been used yet. The agent doesn't need to check — the infrastructure knows and ensures the tool gets called.

This is a **declarative agentic pattern** that shifts the burden of "did I call this already?" from the agent to the infrastructure.

## Why It's Powerful

1. **Removes cognitive overhead from agents** — Agents focus on task, not bookkeeping
2. **Guarantees invariants** — Tools like `session_status`, health checks, or context setup always run
3. **Fail-safe** — If an agent forgets, the system remembers
4. **Cleaner prompts** — Agent instructions don't need "make sure to call X at start"

## Where It's Used (Inferred)

- Session initialization tools
- Context hydration/rehydration 
- Tool result guards (detecting when results are missing from transcript)
- Pre-warming session file access

## Potential Leverages

### 1. Context Setup Automation
Instead of agents manually calling `load_context` or `get_memory`, the MCP server could auto-inject relevant context at session start if not already loaded.

### 2. Progressive Capability Gating
Tools that enable advanced features (e.g., `enable_experimental_tools`) could be auto-invoked once the agent demonstrates readiness — tracked by the MCP server observing agent behavior.

### 3. Cross-Agent Handoffs
When spawning subagents, the MCP server could auto-inject session state into the new agent without the parent agent explicitly serializing/deserializing context.

### 4. Quality Gates
Once-per-session eval tools (e.g., `run_smoke_test`) could auto-trigger after significant agent actions, with results appended to transcript for human review.

### 5. Cost/Usage Tracking
Auto-invoke usage reporting tools at session end to ensure accurate tracking even if agent forgets.

## Similar Patterns to Consider

1. **Tool Result Guards** — Detects missing tool results in transcript, auto-retries or flags (already exists)
2. **Before/After Hooks** — `before_tool_call`, `after_tool_call` allow infrastructure to intercept and modify behavior
3. **Session State Guards** — Track what tools have been called, enforce ordering constraints

## Risks & Considerations

- **Invisible side effects** — Agents may not realize infrastructure is auto-invoking tools; can cause confusion
- **Debugging complexity** — When things go wrong, harder to trace "who" called what
- **Ordering assumptions** — If tool A must run before tool B, auto-invoke needs proper dependency graph
- **Over-automation** — Too much magic removes agent agency; strike balance

## Recommendation

This pattern should be formalized in **TOOLS.md** with explicit:
- List of once-per-session tools that get auto-invoked
- Conditions under which auto-invoke triggers
- How to opt-out or override behavior

The MCP server infrastructure is solid. The opportunity is making the pattern more discoverable and configurable for different agent tiers.

---

**Next step:** Discuss with Xavier on implementation specifics for context setup automation (leverage #1 above).

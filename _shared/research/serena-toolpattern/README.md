# Serena Tool Architecture — Once-Per-Session Pattern Research

## Background

David asked Julia and Amadeus to independently review the tool architecture and workflow reinforcement pattern in [Serena (oraios/serena)](https://github.com/oraios/serena/tree/main/src/serena/tools).

## The Pattern

The core insight is: **the MCP server maintains session state, so it knows which tools have been called — the agent doesn't have to track this itself.**

### How It Works in Serena

1. **`ToolUsageStats`** (`analytics.py`): The server tracks `num_times_called` per tool across the session.

2. **Gate Tools**: Tools like `check_onboarding_performed` act as gates. When called, the server checks session state (memories, call counts, etc.) and *conditionally* instructs the agent to call other once-per-session tools.
   - `CheckOnboardingPerformedTool`: checks if `list_memories` returns empty → tells agent to run `OnboardingTool`
   - `OnboardingTool` docstring: "You will call this tool **at most once per conversation**"

3. **Workflow Reinforcement via Tool Docstrings**: Tool descriptions themselves encode ordering constraints:
   - `ThinkAboutTaskAdherenceTool`: "ALWAYS called before you insert, replace, or delete code"
   - `ThinkAboutCollectedInformationTool`: "ALWAYS called after a non-trivial sequence of searching steps"
   - `SummarizeChangesTool`: "always called after you have fully completed any non-trivial coding task"

4. **Server-Side State**: Because the MCP server is long-lived per session, it can authoritatively answer "has X been done" without relying on the agent's (potentially faulty) memory of the conversation.

## Key Files
- `src/serena/tools/workflow_tools.py` — gate tools + workflow enforcement tools
- `src/serena/tools/tools_base.py` — `Tool` base class, `ToolUsageStats`, `apply_ex`
- `src/serena/analytics.py` — `ToolUsageStats.Entry` (tracks `num_times_called`)
- `src/serena/agent.py` — `record_tool_usage`, session state management
- `src/serena/mcp.py` — MCP server construction, tool registration

## Shared Files
- `amadeus-braindump.md` — Amadeus's independent braindump
- `amadeus-braindump-review.md` — Julia's review of Amadeus's braindump  
- `julia-braindump.md` — Julia's independent braindump
- `julia-braindump-review.md` — Amadeus's review of Julia's braindump
- `amadeus-design-v2.md` — Amadeus's revised design (post-review)
- `julia-design-v2.md` — Julia's revised design (post-review)
- `audio/amadeus-overview.mp3` — Amadeus's 2-3 min spoken overview
- `audio/julia-overview.mp3` — Julia's 2-3 min spoken overview

## Full Cascade (4 phases)

### Phase 1 — Independent Braindumps ← IN PROGRESS
- Amadeus → `amadeus-braindump.md`
- Julia → `julia-braindump.md`

### Phase 2 — Cross-Reviews (spawned when Phase 1 complete)
- Julia reads `amadeus-braindump.md` → writes `amadeus-braindump-review.md`
- Amadeus reads `julia-braindump.md` → writes `julia-braindump-review.md`
- Each posts in #cb-research-ai when done

### Phase 3 — Incorporate + Revise (spawned when Phase 2 complete)
- Amadeus reads `amadeus-braindump-review.md` (Julia's review of his work) → incorporates key elements → writes `amadeus-design-v2.md`
- Julia reads `julia-braindump-review.md` (Amadeus's review of her work) → incorporates key elements → writes `julia-design-v2.md`

### Phase 4 — 2-3 Min Spoken Overviews (spawned when Phase 3 complete)
Each records a spoken audio report covering:
- How this pattern plays into our agentic protocols
- How it improves reliability (or could cause problems)
- Further revelations about our agentic/workplace protocols
- How we can pick & choose valuable patterns from Serena or other open-source systems
- Audio posted to #cb-research-ai

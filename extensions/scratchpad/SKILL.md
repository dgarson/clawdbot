# Session Scratchpad

Persistent working memory that survives context compaction. Use it to keep your plan, key findings, and decisions visible across a long conversation.

## When to use the scratchpad

| Situation                                                         | Use scratchpad?                                  |
| ----------------------------------------------------------------- | ------------------------------------------------ |
| You formulate a multi-step plan                                   | Yes — save it immediately                        |
| You discover a key fact (error message, config value, root cause) | Yes — append it                                  |
| You complete a step of your plan                                  | Yes — replace with updated plan (mark step done) |
| You're answering a simple question                                | No — no state to persist                         |
| You're on turn 1-3 of a short task                                | No — compaction hasn't happened yet              |
| You realize you've lost context from earlier turns                | Yes — reconstruct what you know and save it      |

## How to use

### Save a plan (replace mode)

```
session.scratchpad({
  content: "## Plan\n1. Fix the auth bug in login.ts\n2. Add test for edge case\n3. Update docs",
  mode: "replace"
})
```

### Add a finding (append mode)

```
session.scratchpad({
  content: "- Root cause: token expiry check uses UTC but cookie uses local time",
  mode: "append"
})
```

### Update after completing a step (replace mode)

```
session.scratchpad({
  content: "## Plan\n1. ~~Fix the auth bug in login.ts~~ DONE\n2. Add test for edge case <-- current\n3. Update docs\n\n## Findings\n- Root cause: timezone mismatch in token expiry",
  mode: "replace"
})
```

## What to put in the scratchpad

**Good scratchpad content:**

- Multi-step plans with current progress
- Key findings that inform later steps
- Important values (file paths, config keys, error messages)
- Decisions made and their rationale
- Constraints or requirements gathered from the user

**Bad scratchpad content:**

- Full file contents (too large, use tools to re-read)
- Conversation history (already in context)
- Speculative ideas you haven't committed to
- Verbose explanations (keep it terse)

## Structuring scratchpad content

Keep it scannable. Use this template:

```
## Plan
1. [Step] — status
2. [Step] — status

## Key Findings
- [Finding]
- [Finding]

## Decisions
- [Decision]: [rationale]
```

## Budget

The scratchpad has a character budget (default: 8000 chars). If you exceed it:

- **Replace mode**: content is truncated with a warning
- **Append mode**: the append is rejected — use replace to rewrite more concisely

When approaching the budget, summarize and consolidate rather than appending more.

## How it works

- Scratchpad content is prepended to every message you receive, wrapped in `[Session Scratchpad]` / `[End Scratchpad]` markers
- It persists across auto-compaction — even if earlier turns are dropped, the scratchpad remains
- It's stored in the session log (JSONL) so it survives process restarts
- It is NOT included in persisted message history — only the SDK sees it

## Don't use the scratchpad for

- Cross-session memory (use `memory_search` / `memory_get` instead)
- Storing data for the user to see (use normal replies)
- Large data dumps (use tools to re-fetch when needed)

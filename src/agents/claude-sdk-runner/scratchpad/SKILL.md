# Session Scratchpad

Persistent working memory that survives context compaction. Three separate spaces keep different kinds of state organised without mixing them together.

## The three spaces

| Space | Max         | Purpose                                                                      |
| ----- | ----------- | ---------------------------------------------------------------------------- |
| notes | 4,000 chars | Unstructured working memory: findings, decisions, constraints, partial state |
| plan  | 2,000 chars | Current multi-step plan as a concise ordered list                            |
| refs  | 50 items    | Atomic references: file paths, URLs, PR links, identifiers                   |

All three are prepended to every message you receive (only non-empty spaces are included).

## Actions

| Action         | Parameters            | Effect                                                                               |
| -------------- | --------------------- | ------------------------------------------------------------------------------------ |
| `set_notes`    | `content` (str)       | Replace notes entirely                                                               |
| `append_notes` | `content` (str)       | Append to notes; **rejected** if combined would exceed 4,000 chars — notes unchanged |
| `set_plan`     | `content` (str)       | Replace plan entirely                                                                |
| `refs.add`     | `ref` (non-empty str) | Add one ref; drops oldest atomically if already at 50                                |
| `refs.remove`  | `ref` (non-empty str) | Remove one ref by exact match; returns error if not found                            |
| `refs.set`     | `items` (str[])       | Replace all refs; caps to first 50; non-strings silently dropped                     |

## When to write

| Situation                                             | Action                                        |
| ----------------------------------------------------- | --------------------------------------------- |
| Form a multi-step plan                                | `set_plan` immediately                        |
| Discover a key fact (error, config value, root cause) | `append_notes` or `set_notes`                 |
| Identify a file or URL you'll need again              | `refs.add`                                    |
| Complete a plan step                                  | `set_plan` with updated status                |
| notes or plan getting full                            | `set_notes` / `set_plan` with tighter summary |

**Don't write:** full file contents, conversation history, speculative ideas, the user's original request.

## Usage examples

### Set a plan

```
session.scratchpad({ action: "set_plan", content: "1. Fix auth bug\n2. Add test\n3. Update docs" })
```

### Append a finding

```
session.scratchpad({ action: "append_notes", content: "Root cause: timezone mismatch in token expiry" })
```

### Track a file

```
session.scratchpad({ action: "refs.add", ref: "src/auth/login.ts" })
```

### Remove a ref once done

```
session.scratchpad({ action: "refs.remove", ref: "src/auth/login.ts" })
```

### Replace all refs

```
session.scratchpad({ action: "refs.set", items: ["src/auth/login.ts", "https://github.com/org/repo/issues/42"] })
```

### Update plan as steps complete

```
session.scratchpad({
  action: "set_plan",
  content: "1. ~~Fix auth bug~~ DONE\n2. Add test <-- current\n3. Update docs"
})
```

## Budget enforcement

- **notes** — `set_notes` truncates to 4,000 chars and warns in response; `append_notes` rejects if combined would exceed 4,000 (notes unchanged; use `set_notes` to overwrite with a summary).
- **plan** — `set_plan` truncates to 2,000 chars and warns in response.
- **refs (add)** — `refs.add` drops the oldest entry when at capacity (atomic — never truncates a string mid-value).
- **refs (set)** — `refs.set` silently caps to the first 50 items; non-string entries are silently dropped.

## How it works

- Each space is persisted to the session JSONL under its own key (`openclaw:scratchpad:notes`, `openclaw:scratchpad:plan`, `openclaw:scratchpad:refs`).
- The old single-key format (`openclaw:scratchpad`) is recognised for backwards compatibility and loaded into notes on first use.
- Content is prepended to each SDK message (not saved to persisted message history).
- Survives auto-compaction and process restarts.

## Auto-trigger nudges (opt-in)

All triggers are **off by default** (value `0`). Set a positive integer to enable.

| Config key                          | Type    | Trigger                                                                                                                                |
| ----------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `scratchpad.nudgeAfterTurns`        | int ≥ 0 | When scratchpad is empty after N turns, nudge to populate it                                                                           |
| `scratchpad.nudgeOnPlanDetected`    | int ≥ 0 | When assistant outputs plan-like patterns (numbered lists, "Step N", task lists with 3+ items) and scratchpad is empty, nudge (1 = on) |
| `scratchpad.nudgeAfterCompaction`   | int ≥ 0 | After context compaction, nudge to save/review scratchpad (1 = on)                                                                     |
| `scratchpad.nudgeTurnsSinceLastUse` | int ≥ 0 | When scratchpad has content but hasn't been updated in N turns, nudge to review                                                        |

Nudges are injected as `[Hint: ...]` lines prepended to the next user message via `pendingSteer`. They are transient — trigger state (turn counts, flags) resets on gateway restart but scratchpad content persists.

## Not for

- Cross-session memory (use `memory_search` / `memory_get` instead)
- Storing data the user should see (use normal replies)
- Large data dumps (re-fetch with tools when needed)

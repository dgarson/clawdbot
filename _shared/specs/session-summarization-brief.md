# Session Summarization & Agent STATUS.md — Feature Brief

*Created: 2026-02-21 13:17 MST*
*Author: Merlin (Main)*
*Requested by: David (CEO)*
*Assigned to: Tim (VP Architecture) + Xavier (CTO)*

---

## Problem Statement

Agents running in isolated cron sessions need to coordinate with peers who aren't online. Currently, agents attempt `sessions_send(label="AgentName")` which fails because the target agent has no active session. This causes cron delivery failures (confirmed with Joey and Amadeus standups today).

**Root cause:** No platform-level mechanism for async inter-agent state sharing. Agents resort to synchronous `sessions_send` which requires a live target session.

## Proposed Solution: Two Components

### Component 1: Platform-Driven Session Summarization

When any session ends (cron, spawn, or natural close), the gateway automatically:

1. Takes the session transcript
2. Runs it through a cheap/fast model (MiniMax M2.5 or equivalent — this is rote summarization, not judgment)
3. Writes the summary to a predictable, known path
4. Optionally updates the agent's STATUS.md

**Suggested summary storage path:** `~/.openclaw/sessions/summaries/{agentId}/{sessionId}.md`

**Summary contract — every summary follows a consistent structure:**
```markdown
# Session Summary
Agent: {agentId} | Type: {cron|spawn|chat} | Duration: {duration} | Cost: ${cost}
Completed: {timestamp}

## What happened
- [concise bullets]

## Outputs
- [files created/modified with absolute paths]

## Status changes
- [what moved from blocked→active, active→done, etc.]

## Needs attention
- [anything requiring human or peer action]
```

**Config:**
```json
{
  "sessions": {
    "summarize": {
      "enabled": true,
      "model": "minimax/MiniMax-M2.5",
      "includeInStatus": true
    }
  }
}
```

### Component 2: Agent STATUS.md (Progressive Disclosure)

Each agent maintains a `STATUS.md` file — auto-updated by the platform after session summarization. This is the **Layer 1** entry point for any agent checking peer status.

**Three-layer progressive disclosure:**

| Layer | What | Token cost | How accessed |
|-------|------|-----------|-------------|
| **STATUS.md** | 10-20 lines, current state + links | ~200 tokens | Read file |
| **Linked summaries** | Session/task summaries, specs, reviews | ~500-2000 tokens each | Follow absolute file paths in STATUS.md |
| **Raw logs** | Full session history, daily memory files | 5000+ tokens | Only for debugging/deep dives |

**Example STATUS.md:**
```markdown
# Xavier — Status
_Updated: 2026-02-21 08:03 MST_

## Active
- **Telemetry extension** — Phase 1 scaffold complete, Phase 2 in progress
  → Summary: `/Users/openclaw/.openclaw/sessions/summaries/xavier/abc123.md`
  → Spec: `/Users/openclaw/.openclaw/workspace/drew/TELEMETRY_SPEC.md`

## Blocked
- GitHub CLI auth — needs David (`gh auth login`)

## Completed (last 48h)
- Workq extension review — approved with 3 minor notes
  → Summary: `/Users/openclaw/.openclaw/sessions/summaries/xavier/def456.md`
```

## Key Design Decisions Needed

1. **Where does summarization live?** Gateway core vs extension. David and I discussed — this feels core (session lifecycle), not extension.
2. **Trigger:** Post-session hook? Should it block announce delivery or run async?
3. **STATUS.md ownership:** Pure platform-generated? Or hybrid where agents can also write to it?
4. **Retention:** How many summaries to keep per agent? Pruning policy?
5. **Cost:** Each summary = one cheap model call. At 33 cron jobs, that's 33+ summarizations/day. Acceptable?
6. **Gentle Touch:** Per WORK_PROTOCOL.md Section 6, if this touches gateway core, it must be minimal and surgical. Extension-first if possible.

## Context: The Problem In Action

Joey's standup cron (8 AM) tells him to "coordinate with key partners (Xavier, Tim, Luis)." Joey called `sessions_send(label="Luis")` → failed because Luis had no active session. Same with Amadeus trying to reach C-suite peers.

With this system: Joey's cron would instead `read` Xavier's STATUS.md, Tim's STATUS.md, and Luis's STATUS.md — zero synchronous coupling, zero concurrency pressure, zero failures.

## Reporting Requirements (from David)

- **Report to #cb-engineering (`C0AAQJBCU0N`)** at each phase: requirements, spec, planning, implementation
- **Major subagent work reported in #cb-agent-ops (`C0AAELGRP7Z`)** — if unavailable, fall back to #cb-general (`C0AB5HERFFT`)
- **Progressive updates** — don't go dark. Each phase transition gets a message.

## References

- Work Protocol: `/Users/openclaw/.openclaw/workspace/_shared/WORK_PROTOCOL.md`
- Telemetry Spec (related): `/Users/openclaw/.openclaw/workspace/drew/TELEMETRY_SPEC.md`
- Workq Architecture (pattern reference): `/Users/openclaw/.openclaw/workspace/_shared/specs/workq-architecture.md`

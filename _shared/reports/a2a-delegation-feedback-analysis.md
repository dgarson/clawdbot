# A2A Delegation & Feedback Cycle — Problem Analysis & Solutions

*Date: 2026-02-21*
*Author: Merlin (Main Agent)*
*Requested by: David (CEO)*

---

## Executive Summary

Our agent-to-agent (A2A) delegation system has six major problems, ranging from infrastructure gaps that cause silent failures to architectural design issues that burn tokens without producing value. This report documents each problem with root cause analysis and proposes 1-3 solutions per problem, including complexity and consequences.

**The six major problems:**

1. **Broken Cross-Agent Delegation Chains** — Agents can't delegate to the agents they need
2. **Silent Subagent Failures** — Work disappears without notification
3. **Runaway No-Op Polling** — Massive token waste on empty work queues
4. **Context Overflow Killing Cron Sessions** — Agents die before producing output
5. **Announce/Delivery Failures** — Results generated but never delivered
6. **No Feedback Loop Closure** — Results can't be read by the delegating agent

---

## Problem 1: Broken Cross-Agent Delegation Chains

### What's happening
Xavier (CTO) is configured as the engineering leader who should delegate work to Tim, Roman, Claire, Sandy, Tony, Barry, Jerry, Harry, Larry, Luis. **But Xavier's `subagents.allowAgents` only includes C-suite agents + main.** He cannot spawn any engineering agents.

Same pattern affects other leadership roles: Amadeus can only spawn C-suite. Joey (TPM) has no agent config at all — he doesn't exist in the agents list.

### Evidence
```
xavier: canSpawn=['julia', 'amadeus', 'stephan', 'drew', 'robert', 'tyler', 'main']
amadeus: canSpawn=['julia', 'xavier', 'stephan', 'drew', 'robert', 'tyler', 'main']
```

Xavier's ORCHESTRATION.md says he should "spawn sub-agents for your direct reports" (Tim, Roman, Claire, Sandy, Tony, Barry, Jerry, Harry, Larry, Luis), but he literally can't reach any of them.

Meanwhile, Tim can spawn his engineering team correctly:
```
tim: canSpawn=['xavier', 'julia', 'roman', 'claire', 'sandy', 'tony', 'barry', 'jerry', 'harry', 'larry', 'main']
```

Joey (Principal TPM) is referenced in cron jobs and orchestration docs but has **zero config** — no model, no workspace, no spawn permissions.

### Root Cause
The `allowAgents` lists were configured to match the C-suite peer group rather than the operational reporting structure. The org chart says Xavier → Tim → Engineers, but the spawn permissions say Xavier → C-suite only.

### Impact
- Xavier's 4x daily Eng Sprint Cycles **cannot delegate work to anyone who can execute it**
- The entire cascading delegation model (Xavier → Tim → Engineers) is broken at the first hop
- Amadeus's AI research delegation is similarly broken — can't reach the agents who'd implement
- Joey has cron jobs running but literally doesn't exist as a configured agent

### Solutions

**Solution A: Align spawn permissions to org chart** *(Recommended)*
- Update Xavier's `allowAgents` to include Tim, Roman, Claire, Sandy, Tony, Barry, Jerry, Harry, Larry, Luis
- Update Amadeus's `allowAgents` to include Tim + relevant engineers
- Create Joey's agent config with appropriate model and spawn permissions
- Complexity: **Low** (~15 min, config changes only)
- Consequences: Immediately enables the delegation chains as designed. No code changes needed.

**Solution B: Hub-and-spoke through Tim**
- Keep Xavier → C-suite only, but add Tim to Xavier's list
- Xavier delegates TO Tim, Tim delegates TO engineers
- Complexity: **Low** (one config change)
- Consequences: Adds an extra hop of latency. Tim becomes a bottleneck. But matches the tiered review model in WORK_PROTOCOL.md.

**Solution C: Flat delegation — everyone can spawn everyone**
- Set `allowAgents: ["*"]` for all agents
- Complexity: **Trivial** (one default change)
- Consequences: Eliminates the permission problem entirely but loses any access control. Any agent could spawn expensive Opus agents. Increases risk of cost runaway.

---

## Problem 2: Silent Subagent Failures

### What's happening
When a parent agent spawns a subagent to do work, the subagent can fail silently — completing or erroring without the parent ever knowing. The delegating agent writes "spawned telemetry-spec subagent" in its summary, moves on, and the result is never checked.

### Evidence
From memory/2026-02-21.md:
> "After 4 failed subagent attempts across cycles 2-4, wrote the spec directly"
> "Lesson learned: Simple specs should be written directly, not delegated to subagents that may fail silently."

Strategic Priority Cycle #2 spawned `telemetry-spec` and `workq-build-activation` subagents. The cycle completed with "spawned, waiting for results." By Cycle #3, the agents had "been running 6+ minutes — long for their tasks. Will monitor." By Cycle #4, they apparently completed but the telemetry spec file was never written. **Four cycles of delegation, zero output, and nobody noticed until manual inspection.**

### Root Cause
Multiple contributing factors:
1. **Cron sessions are isolated** — each cron run is a fresh session. The cycle that spawned the subagent ends, and the next cycle has no way to verify what the subagent actually produced.
2. **`sessions_spawn` announces completion but completion ≠ success** — a subagent can "complete" by timing out, hitting context overflow, or producing no meaningful output.
3. **No output verification** — there's no mechanism for "spawn agent X to create file Y, then verify file Y exists."
4. **Subagent result inspection is blocked** — the `sessions_list` call shows token counts but `sessions_history` for cross-agent sessions returns nothing useful due to visibility restrictions.

### Impact
- Work gets "delegated" but never done — creates an illusion of productivity
- Parent agents report "in-flight" work that's actually dead
- Failures compound across cycles — each cycle thinks the previous one handled it
- The telemetry spec took 4 cycles (~12+ hours) before a human-like "just do it yourself" override

### Solutions

**Solution A: Output-verified delegation pattern** *(Recommended)*
- Change delegation prompts to include a verification step: "After spawning, wait for completion, then verify the expected output exists (file, PR, commit)"
- Add a `--verify-file` or `--verify-command` option to `sessions_spawn` that runs a check after the subagent completes
- Complexity: **Medium** (prompt changes + optional platform feature)
- Consequences: Catches failures at delegation time rather than N cycles later. Adds latency to the delegating agent's session (it has to wait for verification).

**Solution B: Result handoff file protocol**
- Every subagent writes a `RESULT.md` (or JSON) in a known location when done: success/failure, files created, errors encountered
- Parent/next-cycle reads the result file before declaring work complete
- Complexity: **Low** (convention + prompt changes)
- Consequences: Relies on agents following the convention. Non-Anthropic models (MiniMax, GLM) may not reliably follow complex file-writing protocols.

**Solution C: Platform-level completion webhook**
- OpenClaw adds a post-completion hook that runs a verification command and reports pass/fail alongside the announce message
- Complexity: **High** (core platform change)
- Consequences: Most reliable solution but requires gateway code changes. Worth building as a feature.

---

## Problem 3: Runaway No-Op Polling (Massive Token Waste)

### What's happening
Tim's workq progress check runs every 15 minutes and has been generating identical "no changes, board complete" messages for **over 10 hours straight**. The WORKBOARD.md file has grown to contain **60+ identical coordination notes**, each consuming tokens to read and write.

### Evidence
The workq cron (ID: `9b51578b`) has been running every 15 minutes since at least 2:48 AM MST. Every single run:
1. Reads the entire WORKBOARD.md (~massive file now with 60+ coordination notes)
2. Reads WORK_PROTOCOL.md
3. Checks `subagents list` and `sessions_list`
4. Writes an identical "no changes" note to WORKBOARD.md
5. Logs to Tim's memory file

Each run consumes 16,000-34,000 total tokens. At 4 runs/hour for 10+ hours, that's **40+ runs × ~25,000 tokens = ~1,000,000 tokens burned on literally nothing.**

The WORKBOARD.md file is now a massive document where 80% of the content is identical "no-op" coordination notes that make the file increasingly expensive to read on each subsequent run.

### Root Cause
1. **No idle detection** — The cron prompt doesn't tell Tim to stop checking when the board is complete
2. **No state awareness** — Each cron run is isolated. Tim can't remember that he checked 15 minutes ago and nothing changed.
3. **Append-only logging** — Each run appends to WORKBOARD.md, making the file grow quadratically (each run reads all previous notes + adds one more)
4. **The cron schedule has no end condition** — "every 15m" means forever, whether there's work or not

### Impact
- ~1M+ tokens/day burned on zero-value polling
- WORKBOARD.md file bloat makes every read more expensive (positive feedback loop)
- Tim's model (Codex 5.3) isn't free — this is real API cost
- Crowds out useful work — Tim's cron slot is always occupied with no-ops

### Solutions

**Solution A: Smart idle backoff + file rotation** *(Recommended)*
- Change the cron prompt: "If the board is 100% done and no new work has appeared in 3 consecutive checks, respond with HEARTBEAT_OK and stop appending notes"
- Add a max-notes policy: keep only the last 5 coordination notes, archive/delete older ones
- Or: disable the cron entirely when no project is active; re-enable when new work arrives
- Complexity: **Low** (prompt edit + optional cron disable)
- Consequences: Immediately stops the token burn. Risk: if new work appears and the cron is disabled, there's a delay in picking it up.

**Solution B: Event-driven triggers instead of polling**
- Replace the 15-minute poll with a file-watch or webhook trigger: only run Tim's check when WORKBOARD.md actually changes
- Complexity: **Medium** (requires OpenClaw to support file-change triggers, not just time-based cron)
- Consequences: Eliminates polling entirely. More architecturally sound but requires platform work.

**Solution C: Cron auto-suspend on idle**
- Platform feature: if a cron job returns HEARTBEAT_OK (or similar signal) N times in a row, automatically disable it and notify the admin
- Complexity: **Medium** (platform change)
- Consequences: Solves the problem generically for all crons, not just this one.

---

## Problem 4: Context Overflow Killing Cron Sessions

### What's happening
Multiple agents (Xavier, Luis) are hitting "Context overflow: prompt too large for the model" errors that kill their cron sessions instantly (2-3 seconds, zero useful output).

### Evidence
- Xavier Morning Standup: `"Context overflow: prompt too large for the model"` — completed in **2,855ms** with zero output. The entire standup was wasted.
- Luis UX Work Check: Same error, **2,388ms**, zero output. The next run then consumed **584,924ms** (nearly 10 minutes) on Opus doing recovery.
- Xavier runs through OpenRouter (`anthropic/claude-opus-4-6`) which may have different context limits than direct Anthropic.

### Root Cause
1. **Workspace file injection** — Agent workspace files (AGENTS.md, SOUL.md, IDENTITY.md, MEMORY.md, TOOLS.md, etc.) are injected into every session's system prompt. As these files grow, the base prompt size grows.
2. **Accumulated memory files** — Each agent's memory files grow daily. Luis has been doing extensive UX work all day, meaning his workspace context could be enormous.
3. **No context budget management** — There's no mechanism to measure or limit the total injected context before starting a session.
4. **Model-specific limits** — OpenRouter-routed models may have different context windows than the same model accessed directly.

### Impact
- Cron sessions fail instantly without any useful work
- The next cron run often "recovers" by using a higher-cost model path (Opus direct vs OpenRouter)
- Zero visibility into WHY context overflowed — no debugging information provided
- Leadership standup missed entirely = the team has no direction for the day

### Solutions

**Solution A: Context budget guards + workspace trimming** *(Recommended)*
- Audit all agent workspace files and trim oversized ones (WORKBOARD.md coordination notes are a major contributor)
- Set a policy: workspace memory files should be rotated/summarized weekly
- Add a pre-flight context size check to cron sessions: if injected context > 80% of model limit, log a warning and truncate lower-priority files
- Complexity: **Medium** (manual cleanup now + policy + optional platform feature)
- Consequences: Requires ongoing maintenance but prevents the immediate crashes. The platform pre-flight check would make this self-healing.

**Solution B: Lazy workspace loading**
- Instead of injecting all workspace files into every session, inject only a file index. Let the agent `read` files it actually needs.
- Complexity: **High** (platform architecture change)
- Consequences: Dramatically reduces base context size. But agents lose the "always available" context that makes them effective. Trade-off between cost and capability.

**Solution C: Tiered file injection by session type**
- Cron sessions get minimal injection (AGENTS.md + task-specific context only)
- Interactive sessions get full injection
- Sub-agent sessions get only the files relevant to their task
- Complexity: **Medium** (platform feature + config)
- Consequences: Most context-efficient approach. Requires defining "minimal" vs "full" injection profiles per agent.

---

## Problem 5: Announce/Delivery Failures

### What's happening
Cron sessions complete their work — sometimes substantial, valuable work — but the results are never delivered to Slack because the delivery mechanism fails. The agent does the work, the status shows `error`, and the error is "cron announce delivery failed."

### Evidence
- **Joey Product Standup:** Agent spent 6 minutes, consumed 87K input tokens, produced a full standup... then failed delivery with: `"Session Send: with label Luis, timeout 30 failed: No session found with label: Luis"`. Joey tried to send work to Luis via `sessions_send(label="Luis")` — but Luis had no active session with that label.
- **Amadeus C-Suite Morning Sync:** Full 4-minute sync completed, comprehensive summary produced (we can see it in the run log)... delivery failed. Same "cron announce delivery failed" error.
- **Strategic Priority Cycle:** Earlier runs show `"cron delivery target is missing"` — the announce target wasn't configured correctly.

### Root Cause
Two distinct failure modes:
1. **Agents misusing `sessions_send` as delegation** — Joey tried to `sessions_send(label="Luis")` to hand off work. But `sessions_send` requires an active session with that label. Isolated cron sessions don't have persistent labels that other crons can find.
2. **Announce channel misconfiguration** — The "delivery target is missing" error suggests the cron's announce channel (Slack #cb-inbox) isn't always properly resolved.

### Impact
- Work is done but invisible — David never sees the standup, the sync, or the priority list
- Agents believe they've communicated when they haven't
- The error status on the cron masks the fact that the WORK was successful — only DELIVERY failed
- Creates a false impression that agents are broken when they're actually producing good output

### Solutions

**Solution A: Fix delivery + teach agents the right delegation pattern** *(Recommended)*
- Ensure all cron jobs have correct announce config pointing to Slack #cb-inbox
- Update agent prompts: "Do NOT use sessions_send to delegate work. Use sessions_spawn to create a new subagent session. sessions_send is only for messaging an already-active session."
- Separate work status from delivery status in cron run reports
- Complexity: **Low** (config fix + prompt updates)
- Consequences: Immediately fixes the delivery problem. Agents need to learn the correct pattern.

**Solution B: Platform retry with fallback**
- If announce delivery fails, retry 2-3 times with backoff
- If all retries fail, write the result to a file (`~/workspace/undelivered/<timestamp>.md`) so it's not lost
- Complexity: **Medium** (platform change)
- Consequences: No more lost work. Even if delivery ultimately fails, the output is preserved.

---

## Problem 6: No Feedback Loop Closure (Cross-Agent Visibility)

### What's happening
When Agent A spawns Agent B to do work, Agent A cannot read Agent B's session history or results. The delegating agent is blind to what the subagent actually did, said, or produced.

### Evidence
From memory/2026-02-21.md:
> "Executive Consultation (Cycle #3: Julia, Tyler, Amadeus) — Spawned brainstorms for the 3 C-suite not consulted in Cycle #2. All completed within ~30s on GLM-5. However, **session visibility restrictions prevented reading cross-agent responses — can only see token counts.**"

> "Cross-agent session history is restricted — can't read brainstorm outputs from other agents. Consider enabling `tools.sessions.visibility=all` for the main agent."

The Strategic Priority Cycle spawns executive brainstorm sessions, waits for completion, then **cannot read what the executives said**. The entire consultation loop is:
1. Spawn brainstorm → ✅
2. Wait for completion → ✅
3. Read the result → ❌ BLOCKED
4. Synthesize into priorities → ❌ IMPOSSIBLE

### Root Cause
`tools.sessions.visibility` is not configured for any agent (defaults to restricted). This means:
- Agent A can spawn Agent B
- Agent A can see Agent B's session exists and its token count
- Agent A **cannot** read Agent B's actual messages or output
- This makes the entire "spawn → collect → synthesize" pattern useless

### Impact
- Executive brainstorm sessions are fire-and-forget — the results are generated but never consumed
- The Strategic Priority Cycle's entire "consult executives" step is theatrical — it spawns sessions, waits for them, but can't read the responses
- Any multi-agent synthesis workflow is broken at the "collect results" step
- Massive token waste: we're paying for executive consultations that nobody reads

### Solutions

**Solution A: Enable cross-agent session visibility for leadership** *(Recommended)*
- Set `tools.sessions.visibility: "all"` for `main`, `xavier`, `amadeus`, `tim`, `joey`
- These are the agents that orchestrate and need to read results
- Complexity: **Low** (config change)
- Consequences: Leadership agents can read any subagent's output. Slightly reduces isolation guarantees but these agents already have `tools.allow: ["*"]`.

**Solution B: File-based result handoff (workaround)**
- Change brainstorm prompts: "Write your brainstorm output to `~/workspace/<your-name>/brainstorm-<date>.md`"
- Parent agent reads the file instead of the session history
- Complexity: **Low** (prompt changes)
- Consequences: Works around the visibility restriction but adds fragility — agents must follow the convention. Non-Anthropic models are less reliable at complex multi-step file operations.

**Solution C: Structured result protocol in spawn**
- Extend `sessions_spawn` with a `resultPath` parameter: the subagent must write its final result to that path
- Platform enforces/extracts the result and makes it available to the parent
- Complexity: **High** (platform feature)
- Consequences: Most robust solution. Makes the "spawn → result" contract explicit and platform-enforced.

---

## Summary: Priority & Dependency Map

| # | Problem | Severity | Token Waste | Fix Complexity | Recommended Fix |
|---|---------|----------|-------------|----------------|-----------------|
| 1 | Broken delegation chains | **Critical** | Low | **Low** | Align spawn permissions to org chart |
| 2 | Silent subagent failures | **High** | High | **Medium** | Output-verified delegation + result files |
| 3 | Runaway no-op polling | **High** | **~1M+ tokens/day** | **Low** | Smart idle backoff + WORKBOARD cleanup |
| 4 | Context overflow crashes | **High** | Medium | **Medium** | Context budget guards + workspace trimming |
| 5 | Announce/delivery failures | **Medium** | Medium | **Low** | Fix config + teach correct delegation pattern |
| 6 | No feedback loop closure | **Critical** | High | **Low** | Enable session visibility for leadership |

### Recommended Execution Order
1. **Problems 1, 5, 6** — Config/prompt fixes, <1 hour total, unblocks the entire system
2. **Problem 3** — Stop the token hemorrhage, 30 minutes
3. **Problem 4** — Workspace trimming + context management, 1-2 hours
4. **Problem 2** — Output verification pattern, requires prompt redesign + testing

### Systemic Root Cause

All six problems share a common root: **the A2A system was designed on paper (ORCHESTRATION.md, DISCOVERY.md) without validating the platform primitives it depends on.** The org chart assumes Xavier can delegate to Tim, but nobody checked if the config allows it. The Priority Cycle assumes brainstorm results can be read, but nobody tested cross-agent visibility. Tim's polling cron assumes work will always exist, but nobody added an exit condition.

The fix isn't just patching these six issues — it's establishing a **pre-flight validation step** for any new orchestration design: before coding the prompts, verify that every delegation path, every read operation, and every delivery channel actually works.

---

*Report generated from analysis of: cron run history (40+ runs), agent configs (25 agents), session logs, workspace files, and ORCHESTRATION.md/DISCOVERY.md design docs.*

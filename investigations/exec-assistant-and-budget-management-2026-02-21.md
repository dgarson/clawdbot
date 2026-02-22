# Investigation Brief: Executive Assistant Pattern + Budget-Aware Model Management
*Date: 2026-02-21*
*Requested by: David Garson*
*Coordinator: Main (Opus)*
*Investigators: Amadeus + Julia*

---

## Investigation 1: Executive Assistant Agent Pattern

### Concept
An "Executive Assistant" (EA) agent that:
- Receives heartbeats, cron events, inbox-style messages, and system notifications
- Runs on a **cheap model** (e.g. codex-spark, MiniMax-M2.1, Gemini Flash)
- Evaluates whether the event/data warrants waking the expensive Exec/Lead agent
- Maintains a detailed log of everything received (workspace files)
- **Aggregates non-urgent info** for periodic batch delivery to the Exec/Lead
- Spawns the Exec/Lead as a subagent only when something is genuinely urgent
- Must NOT spawn duplicate Exec/Lead sessions if one is already running

### Key Questions to Answer
1. **Implementation approach**: How would we wire this in OpenClaw config? New agent type? Config flag? Or just a convention using existing primitives (agent + heartbeat + subagent spawning)?
2. **Deduplication**: How do we prevent duplicate Exec/Lead spawns? OpenClaw's `sessions_list` can check for active sessions, but is there a more robust mutex mechanism? Could we use `maxConcurrent` settings?
3. **Event forwarding**: How does the EA receive the exact same "event and data" that the Exec/Lead would? Is this just about the heartbeat prompt reading workspace files, or do we need deeper integration with system events?
4. **Cron schedule**: What cron interval makes sense? Fast enough to catch urgent items (5-10min?) but cheap enough to justify the gating.
5. **Cost analysis**: Model the actual savings. How much does a heartbeat run cost on codex-spark vs Opus? What's the break-even point?
6. **Parallel subagent safety**: Current config shows `maxConcurrent: 8` for agents, `subagents.maxConcurrent: 16`, `maxSpawnDepth: 2`. What are safe practical limits from cost/API quota perspective?

### Source Code References
- Heartbeat runner: `src/infra/heartbeat-runner.ts`
- Agent limits: `src/config/agent-limits.ts` (DEFAULT_AGENT_MAX_CONCURRENT=4, DEFAULT_SUBAGENT_MAX_CONCURRENT=8, DEFAULT_SUBAGENT_MAX_SPAWN_DEPTH=2)
- Current org config: agents.defaults.maxConcurrent=8, subagents.maxConcurrent=16, maxSpawnDepth=2
- Provider usage tracking: `src/infra/provider-usage.ts`, `provider-usage.types.ts`, `provider-usage.load.ts`

---

## Investigation 2: Weekly Usage Budget + Auto Model Downgrade

### Concept
A system that:
- Tracks **weekly usage** per provider (Anthropic, OpenAI-Codex, z.AI, etc.) against known limits
- Calculates a **rough daily budget** for expensive models (Opus 4.6, Sonnet 4.6)
- When approaching the budget threshold (based on time remaining until reset), **automatically downgrades** some agents' models
- **Never downgrades**: Tim (gpt-5.3-codex), Luis (sonnet-4-6)
- **Amadeus floor**: Never below Sonnet 4.6
- Everything else is flexible

### Key Questions to Answer
1. **What usage data is already available?** The provider-usage module fetches live usage from Anthropic, Codex, Gemini, z.AI, MiniMax. What granularity? Per-window percentages + reset times.
2. **Budget calculation**: How to derive "daily budget" from weekly usage + reset timing? Algorithm proposal.
3. **Downgrade strategy**: Priority ordering — which agents downgrade first? What model tiers exist?
4. **Implementation surface**: Where does this logic live? Options:
   - New module `src/agents/budget-governor.ts` (adjacent, minimal merge conflict risk)
   - Integration points: model resolution in the agent runner, heartbeat for periodic checks
   - Config schema additions: `agents.defaults.budget: { weeklyLimit, dailyTarget, downgradePolicy, protectedAgents }`
5. **Upstream merge conflict risk**: Which files need >3 lines changed? Can we keep this self-contained?
6. **Reset awareness**: Provider windows have `resetAt` timestamps. How to make downgrade decisions time-aware.

### Current Provider Usage Infrastructure
```
providers: anthropic | github-copilot | google-gemini-cli | google-antigravity | minimax | openai-codex | xiaomi | zai
Each returns: { windows: [{ label, usedPercent, resetAt }], plan?, error? }
```

### Protected Agents (never downgrade)
- **Tim**: openai/gpt-5.3-codex (never downgrade)
- **Luis**: anthropic/claude-sonnet-4-6 (never downgrade)
- **Amadeus**: floor = anthropic/claude-sonnet-4-6 (currently opus-4-6)

---

## Deliverables Expected
Each investigator produces:
1. **Audio report** (~2-3 min) covering:
   - High-level findings
   - Complexity evaluation ("juice worth the squeeze")
   - Architecture/design proposal
   - Which agents should do the implementation work
   - Exact workflow: delegate → implement → collaborate → review → fix/iterate → merge
2. **Written proposal** in their workspace
3. **Risk assessment**: regression risk, detection difficulty in test protocols

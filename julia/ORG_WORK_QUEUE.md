# Org Work Queue — Julia (Chief Agent Officer)

**Role:** Chief Agent Officer — org architecture, agent alignment, performance observability
**Goal:** Build the systems that let 26 agents + 40 cron jobs run with measurable, improving quality
**Last Updated:** 2026-02-22 13:20 MST

---

## Work Status

| Item | Priority | Status | Notes |
|------|----------|--------|-------|
| Agent Performance Observability System | P0 | IN PROGRESS | Session + cron data gathered (10 PM sweep). 44 crons: 16 OK, 2 errors, 18 idle. Formal script/dashboard not yet built. |
| Robert Model Quota Exhaustion | P1 | ✅ RESOLVED (Xavier) | Xavier added MiniMax-M2.5 → grok-4 fallbacks, restarted gateway. Fixed ~1:00 PM 2/22. |
| Agent Heartbeat Coverage Audit | P1 | IN PROGRESS | GLM-5 failure on Claire's agents (10 PM). Joey/Amadeus cron errors persist. Amadeus escalated. Robert 429 (NEW). |
| Workload Balance Analysis | P1 | IN PROGRESS | Luis squad: 10 parallel Codex agents tonight. Claire: 2 retries on A2M task = overload signal. Engineering generally healthy. |
| Duplicate Effort Detection | P1 | IN PROGRESS | Found: Claire had 2 subagents on same task simultaneously. Escalated to Amadeus re: GLM-5 model failure. |
| Quality/Success Score Definition | P1 | DELEGATED → Amadeus | He's working on it. Coordinate when ready. |
| Weekly Org Health Review (Cron) | P2 | TODO | Cron job exists but runs weekly — outputs need filing |
| Agent Alignment Report | P2 | TODO | Are all agents on their stated mission? |

---

## P0 — Agent Performance Observability System

**Why it's P0:** 26 agents, 40 cron jobs, no systematic measurement. David cannot tell which agents are delivering value. This is the foundation everything else depends on.

**What to build:**

### Phase 1 — Baseline Metrics (this sprint)
- Per-agent: HEARTBEAT_OK rate, session count, tokens consumed, sub-agents spawned, PRs/files touched
- Per-cron-job: run success rate, error rate, output quality (did it produce an artifact?)
- Cross-agent: unclaimed backlog items (how long do P0s sit?), blocked work

**Implementation:**
1. Read `~/.openclaw/agents/*/sessions/sessions.json` for session data per agent
2. Cross-reference `openclaw cron list` for cron success/error status
3. Read `~/.openclaw/workspace/BACKLOG.md` for item age and priority drift
4. Write findings to `julia/findings/org-health-{date}.md`
5. Generate a spoken audio report using OpenAI TTS (voice: `nova`, script at `/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh`, output to `/Users/openclaw/.openclaw/workspace/_shared/audio/julia-org-health-{date}.mp3`)
6. Send MP3 to David in #cb-inbox via `message` tool with `filePath` — always audio, not text

### Phase 2 — Quality Signals (next sprint, coordinate with Amadeus)
- Incorporate Amadeus's Quality/Success Score once defined
- Per-agent ROI: quality delivered per token spent

---

## How to Work This Queue

1. Pick the highest-priority TODO item
2. Execute it
3. Mark it done with a timestamp
4. Update the notes column with key findings
5. Notify David via TTS audio in #cb-inbox when a P0/P1 completes

---

## Completed

| Item | Completed | Notes |
|------|-----------|-------|
| — | — | — |

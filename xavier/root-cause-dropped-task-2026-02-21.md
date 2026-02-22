# Root Cause Analysis: Dropped Task & Misrouted Message in #cb-inbox
**Date:** 2026-02-21 13:40 MST  
**Analyst:** Xavier (CTO)  
**Incident Time:** 13:08–13:40 MST  

---

## Executive Summary

David posted an instruction in #cb-inbox at 13:08 MST directing agents to **act on concerns rather than just reporting them**, specifically regarding mock data vs real API decisions. This instruction was not executed for ~30 minutes. Additionally, an unrelated Luis UX status update appeared threaded as a reply to David's instruction ~6 minutes later, creating confusion.

**Root causes identified:**
1. **Misrouted message:** The Luis UX cron job was already mid-execution when David posted. When it finished and delivered its summary, it was threaded to the most recent message context — David's instruction thread — rather than posted as a standalone channel message.
2. **Dropped instruction:** The main agent session that receives David's #cb-inbox messages was not actively monitoring for new instructions. The cron-based architecture has no mechanism to interrupt an in-progress cron delivery or to flag human instructions as priority.
3. **Channel noise:** Tim's workq progress check fires every 15 minutes and posts identical "fully green" messages, drowning out human instructions in a wall of bot output.

---

## Timeline Reconstruction

| Time (MST) | Event | Source |
|---|---|---|
| 13:00:00 | Eng Sprint Cycle 2 cron fires (Xavier agent) | Cron `a077f68e` |
| 13:01:17 | Xavier's "Midday check-in" posted to #cb-inbox (standalone) | Cron delivery |
| 13:03:47 | Tim's 13:03 progress check posted (standalone) | Cron `9b51578b` |
| **13:04:14** | **Luis UX Work Check cron starts executing** | Cron `e61f3c46` (ran at 13:04, with 5m stagger from :00) |
| **13:08:32** | **David posts instruction** (thread_ts=1771704512.143829) | Human message |
| **13:14:15** | **Luis cron finishes → delivers "keyboard shortcuts" message INTO David's thread** | Cron delivery misroute |
| 13:18:59 | Tim's 13:18 progress check posted (standalone) | Cron `9b51578b` |
| 13:33:57 | Tim's 13:33 progress check posted (standalone) | Cron `9b51578b` |
| ~13:38+ | David asks "did you finish this update?" | Human follow-up |

---

## Finding 1: Misrouted Luis Message (CRITICAL)

### What happened
The Luis UX Work Check cron (`e61f3c46`) ran at 13:04:14 MST and finished at 13:14:15 MST (duration: 600,737ms = ~10 minutes). Its delivery config is:

```json
"delivery": {
  "mode": "announce",
  "channel": "slack",
  "to": "channel:C0AAP72R7L5"
}
```

This should deliver to #cb-inbox as a **standalone channel message**. However, the message appeared **inside David's thread** (thread_ts=1771704512.143829).

### Root cause hypothesis
The cron `announce` delivery mechanism likely targets the **most recent active context** in the channel. Between the cron starting (13:04) and finishing (13:14), David posted his instruction at 13:08. The delivery system may have:

1. **Session context contamination:** The main agent session that was handling David's message in the thread may have been the same session context that received the cron delivery announcement. When the cron result arrived, the main session was "in" David's thread context, so the delivery went there.

2. **Slack thread stickiness:** If the Slack delivery layer uses the most recent `thread_ts` from the channel's session state, David's message (which created a thread) could have been picked up as the delivery target.

3. **Race condition:** The cron was already in flight when David posted. The cron's delivery happened 6 minutes after David's message. If the delivery layer checks "what's the latest context in this channel?" at delivery time (not at cron-start time), it would find David's thread.

### Evidence
- In the channel-level view, the Luis message has `thread_ts=""` (appears as standalone)
- But in the thread view for David's instruction, the Luis message IS present as a reply at ts=1771704855.340009
- This is consistent with a Slack `reply_broadcast` or a message that was delivered both to the channel AND threaded

### Impact
- David saw an unrelated status update as a "response" to his instruction
- This created the (correct) impression that his instruction was received but responded to with irrelevant content
- Undermines trust in the agent system's ability to follow instructions

---

## Finding 2: Dropped Instruction (CRITICAL)

### What happened
David's instruction at 13:08 MST was never acted on until he explicitly followed up ~30 minutes later.

### Root cause
**No session was listening for and triaging David's instructions in #cb-inbox in real-time.**

The architecture relies on:
- **Cron jobs** that fire on schedules and deliver summaries — these are fire-and-forget, they don't monitor for incoming messages
- **The main agent session** which handles direct interactions — but in #cb-inbox, the main session only activates when a message is delivered to it via Slack's event system

The problem: David's message in #cb-inbox was a standalone top-level message (not a reply to a bot message). The session routing for #cb-inbox delivers messages to `agent:main:slack:channel:c0aap72r7l5`. But:

1. If the main session was already handling another task or had just completed the Xavier Eng Sprint Cycle 2 response, it may not have had context to pick up David's message as an actionable instruction
2. **Cron jobs are isolated sessions** — they cannot see or respond to new channel messages that arrive during their execution
3. There is no "inbox monitor" or "instruction triage" agent that specifically watches for human messages and ensures they get acted on

### The deeper issue
The cron architecture is designed for **push** (agent → channel) not **pull** (channel → agent). David's instructions in #cb-inbox have no guaranteed processing path. They depend on:
- The main session happening to be active and monitoring
- A heartbeat cycle picking them up
- Manual follow-up from David

This is a **design gap**, not a bug.

---

## Finding 3: Channel Noise from Tim's Progress Check (HIGH)

### What happened
Tim's `workq Progress Check` cron fires every 15 minutes and posts to #cb-inbox. Today, every single message has been identical:

> "XX:XX check-in is fully green: Done: 11, In-progress: 0, Blocked: 0, In-review: 0, Unclaimed: 0... No stalled work... no intervention required."

### Evidence from channel history
Between 09:18 MST and 13:33 MST (~4.25 hours), Tim posted **17 identical progress check messages**. That's one every 15 minutes, and they dominate the channel. In the same period, there were only:
- 4 messages from David (instructions/questions)
- 3 substantive agent updates (Xavier midday, Luis hourly x2, Amadeus ACP spec)

**The signal-to-noise ratio is approximately 1:4** — for every meaningful message, there are 4 "everything is fine" messages.

### Impact
1. **David's instructions get buried** in a wall of identical green-check messages
2. **Context windows get consumed** by repetitive no-op status updates — agents reading channel history waste tokens on 17 copies of "nothing happened"
3. **Any monitoring or triage system** would need to filter through noise to find actionable items
4. **Cost:** Each progress check uses 20k-35k tokens (from cron run data) for a result that says "nothing changed." At 17 runs over 4 hours, that's ~340k-600k tokens/day on no-op status updates.

---

## Recommendations

### P0: Immediate Fixes

#### 1. Suppress no-change progress checks
**Change:** Modify the `workq Progress Check` cron prompt to include: "If the board state is unchanged from your last check and no action was taken, respond with `HEARTBEAT_OK` instead of posting a full status update. Only post to the channel when there is actual news (state changes, assignments, blockers, completions)."

Alternatively, reduce frequency from every 15m to every 1h when all tasks are complete.

```bash
openclaw cron edit 9b51578b-f9cc-4f31-a29d-81a67d185224 --every 3600000
```

#### 2. Fix cron delivery threading
**Change:** Ensure cron `announce` deliveries NEVER thread to an existing message. They should always be standalone channel messages. This may require an OpenClaw platform fix — the delivery layer should not inherit `thread_ts` from the channel's active session state.

**Workaround until platform fix:** Add `"threadTs": null` or equivalent to cron delivery configs to force standalone posting.

#### 3. Create an instruction-triage mechanism
**Change:** Add a lightweight cron or heartbeat check that specifically scans #cb-inbox for unprocessed human messages (messages from David/U0A9JFQU3S9 that have no bot reply in their thread). Run every 5 minutes. If an unprocessed instruction is found, spawn a session to execute it immediately.

### P1: Architecture Improvements

#### 4. Priority routing for human messages
**Change:** Implement a channel-level rule: when a message from a designated "boss" user (David) arrives in #cb-inbox, it should IMMEDIATELY trigger a main agent session with the message content, regardless of what crons are doing. Human instructions should not wait for the next heartbeat or cron cycle.

#### 5. Separate channels for status vs instructions
**Change:** Route all automated status updates (Tim's progress checks, Luis hourly updates, Xavier sprint updates) to a **#cb-status** channel. Keep #cb-inbox as a **human-first channel** where David's instructions are the primary content and bot responses are threaded replies to those instructions.

#### 6. Cron delivery isolation
**Change:** Each cron job's delivery should be completely isolated from the channel's active session state. The delivery layer should:
- Never inherit `thread_ts` from another session
- Always post to the channel root unless explicitly configured with a `threadTs`
- Include metadata (cron job ID, agent ID) so messages can be traced to their source

### P2: Cost Optimization

#### 7. Reduce no-op cron token burn
The Tim progress check uses 20k-35k tokens per run even when nothing changed. Over a full day (96 runs), that's 2M-3.4M tokens on "everything is fine" messages. Consider:
- Caching the previous board state and doing a cheap diff before full analysis
- Using a cheaper model (currently using `gpt-5.3-codex`) for no-op checks
- Implementing a "skip if unchanged" check at the cron scheduler level

---

## Summary of Root Causes

| Issue | Root Cause | Fix Priority |
|---|---|---|
| Luis message in David's thread | Cron delivery inherited active thread context | P0 — Platform fix |
| David's instruction not executed | No real-time instruction processing; cron-only architecture | P0 — Add triage mechanism |
| Channel noise from progress checks | 15-min no-op status updates | P0 — Suppress unchanged checks |
| Instructions from David getting lost | #cb-inbox mixes human instructions with bot noise | P1 — Channel separation |
| Cost waste on no-op checks | ~3M tokens/day on "nothing changed" | P2 — Caching/skip logic |

---

*Filed by Xavier, CTO — 2026-02-21 13:40 MST*

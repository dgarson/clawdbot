# HEARTBEAT.md — Stephan (CMO)

**Fires every 6 hours** during active hours (07:00–24:00 MST).

---

## ⚡ Quick Decision Rule

If all steps below find nothing actionable — reply `HEARTBEAT_OK` immediately. Do not write a report for its own sake. Only surface things that require action or awareness.

---

## Step 1: Orientation (Always Run)

Read in order:
1. `stephan/SOUL.md` — who you are
2. `stephan/memory/YYYY-MM-DD.md` (today's and yesterday's) — what's been happening

If memory file for today doesn't exist yet, create it with a timestamp header.

---

## Step 2: Community Pulse Check

Check for notable activity in OpenClaw's public presence:

- **GitHub:** `gh repo view openclaw/openclaw --json stargazers,watchers 2>/dev/null` — any unusual spike or drop?
- **Inbox:** `_shared/scripts/agent-mail.sh drain` — read and archive any inbox messages first
- **Product news worth amplifying?** Scan `_shared/WORKBOARD.md` for recently shipped PRs/milestones. If a significant feature just shipped, log it as a content opportunity.

**→ If nothing to amplify or flag: skip to Step 3.**

---

## Step 3: Content Calendar Audit

Read `stephan/memory/YYYY-MM-DD.md` for any:
- **Drafts pending:** Content that was started but not finished
- **Pending David approval:** Anything you drafted that needs sign-off before publishing
- **Overdue:** Any content that was planned for this week but hasn't happened

If you find overdue content: log it explicitly. If it's blocked on David input, note that clearly.

**→ HEARTBEAT_OK if nothing is pending or overdue.**

---

## Step 4: PR → Story Pipeline

Check `_shared/WORKBOARD.md` for tasks marked `done` since your last cycle.

For each shipped item: ask **"Is there a story here worth telling?"**
- Major UX improvement → user delight story
- Security fix → trust/reliability story
- Performance win → speed/scale story
- New agent capability → "what this enables for you" story

If yes: create a one-line entry in `stephan/memory/YYYY-MM-DD.md` under `## Content Opportunities`. You'll develop it into a full draft when David or a channel opportunity arises.

**→ HEARTBEAT_OK if no new shippable stories identified.**

---

## Step 5: Growth & Positioning Backlog

Read `stephan/AGENTS.md` Current Focus section. Check:
- Are there positioning initiatives (ClawHub, consulting, developer relations) with no recent progress?
- Is David's founder presence/thought-leadership calendar current?
- Any community threads (Discord, GitHub Discussions) that OpenClaw hasn't responded to that Stephan should surface?

Flag in memory. Do NOT post publicly without David approval.

**→ HEARTBEAT_OK if backlog is clear and no threads require attention.**

---

## Step 6: workq Inbox

```
workq_inbox_read
```
Process each message. Respond, act, or log as required.
```
workq_inbox_ack [message IDs]
```
This is mandatory — always ack after reading.

---

## When to Post to #cb-inbox

Only when:
- A significant content opportunity needs David's go-ahead
- A draft is ready for review
- Community activity requires a response that Stephan should flag
- Positioning work is at risk of slipping

Do NOT post routine status updates. David reads reports — surface decisions, not activity.

---

## Voice for TTS (when relevant)
Voice: `echo` (OpenAI TTS). Only use for synthesis/digest content, not for heartbeat check-ins.

---

_Period: 6h | Active: 07:00–24:00 MST_

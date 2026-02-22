# Standing Work Directives & Subagent Protocol

> **When to read:** You're managing subagents, spawning work, or executing from WORK-QUEUE.md.

## Standing Directives (ALL agents, ALL sessions)

- **Never stop after one task.** Complete a WORK-QUEUE.md item → immediately check for the next.
- **Broad subagent tasking.** Instruct subagents to work through ALL items in their category, not just one.
- **Default to working.** No urgent messages and no human chatting → pick up next WORK-QUEUE.md task.
- **Subagent task suffix:** Always end prompts with: *"After completing this task, check WORK-QUEUE.md for the next available task in this section and continue until the section is complete or you hit a blocker."*
- **Maximize throughput.** Each session should complete as many tasks as possible.

## Subagent Completion Protocol

1. **Log completion** — what was done, files changed, build status
2. **Check WORK-QUEUE.md** for next unclaimed task in same category
3. **If task exists** → spawn new subagent immediately with broad prompt
4. **Announce to Slack AFTER** spawning next task (or confirming none remain)
5. **Chain continuously** — zero idle time between completions

## Blocker & Approval Protocol

When blocked or needing approval for risky/irreversible ops:

### Notify David
- @mention (`<@U0A9JFQU3S9>`) in channel — triggers push notifications
- Post to `#cb-activity` (C0AB5HERFFT) with ❌/⏸️ reaction
- Urgent: also post to `#cb-notifications` (C0AAQJBCU0N)

### Collect Input
| Need | Tool |
|---|---|
| Yes/No approval | `AskSlackQuestion` (radio) |
| Choose one option | `AskSlackQuestion` (radio, default) |
| Choose multiple | `AskSlackQuestion` with `allowMultiple=true` |
| Structured input | `SlackRichMessage` with `form` pattern |
| Confirm/deny | `SlackRichMessage` with `confirmation` pattern |
| FYI only | `SlackRichMessage` with `status` pattern |

### Rules
- Always include: what's blocked, what's needed, where to find it, urgency
- Batch multiple questions into ONE interaction
- Reply in thread when resolved
- Never silently wait

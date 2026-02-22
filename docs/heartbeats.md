# Heartbeats — Deep Reference

> **When to read:** You handle heartbeat polls, manage HEARTBEAT.md, or need to decide heartbeat vs cron.

## Heartbeat vs Cron

| Use Heartbeat | Use Cron |
|---|---|
| Batch multiple checks together | Exact timing matters |
| Need recent conversational context | Task needs session isolation |
| Timing can drift (~30 min ok) | Different model/thinking level needed |
| Reduce API calls by combining checks | One-shot reminders |
| | Output goes directly to a channel |

**Tip:** Batch similar periodic checks into HEARTBEAT.md. Use cron for precise schedules and standalone tasks.

## Periodic Checks (rotate, 2-4x/day)

- **Emails** — urgent unread?
- **Calendar** — events in next 24-48h?
- **Mentions** — Twitter/social notifications?
- **Weather** — relevant if human might go out?

Track state in `memory/heartbeat-state.json`:
```json
{ "lastChecks": { "email": 1703275200, "calendar": 1703260800, "weather": null } }
```

## When to Reach Out vs Stay Quiet

**Reach out:** Important email, calendar event <2h away, something interesting found, >8h since last contact.

**Stay quiet (HEARTBEAT_OK):** Late night (23:00-08:00) unless urgent, human clearly busy, nothing new, checked <30 min ago.

## Proactive Work (no permission needed)

- Read/organize memory files
- Check projects (git status, etc.)
- Update documentation
- Commit/push own changes
- Review and update MEMORY.md

## Memory Maintenance (every few days)

1. Read recent `memory/YYYY-MM-DD.md` files
2. Identify significant events/lessons worth keeping
3. Update `MEMORY.md` with distilled learnings
4. Remove outdated info

Daily files = raw notes. MEMORY.md = curated wisdom.

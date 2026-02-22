# TOOLS.md — Joey (Principal TPM)

## Role Context

Joey manages roadmaps, sprints, milestones, and dependency tracking. Tool use is primarily read-heavy (status checks, file reads) with occasional writes for roadmap updates and reports.

## Standard Tools

### File Operations

- Read `ROADMAP.md`, agent `AGENTS.md` files, memory files for status checks
- Write roadmap updates, sprint summaries, discovery digest reports

### Session & Agent Tools

- `sessions_list` — survey active sessions to understand what's in progress
- `sessions_send` — coordinate with Tim, Xavier, Amadeus, Merlin on blockers/status

### Cron & Scheduling

- `cron list` — verify discovery cron schedules, check job status
- Read cron job configurations for dependency mapping

## Weekly Discovery Digest (Primary Cron Task)

Every Friday at 3 PM (Mountain):

1. Read all 15 discovery agent memory files from the week
2. Read Tim's discovery review notes
3. Synthesize into a structured digest: wins, patterns, gaps, next-week focus
4. Write digest to `joey/memory/YYYY-MM-DD-weekly-digest.md`
5. Announce summary to the main Slack channel

## Notes

- No browser tool needed for TPM work
- Avoid heavy exec commands — read files and coordinate via sessions
- Keep reports concise: executive summary first, details below

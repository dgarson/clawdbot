---
summary: "CLI reference for `openclaw cron` (schedule and run background jobs)"
read_when:
  - You want scheduled jobs and wakeups
  - You’re debugging cron execution and logs
title: "cron"
---

# `openclaw cron`

Manage cron jobs for the Gateway scheduler.

Related:

- Cron jobs: [Cron jobs](/automation/cron-jobs)

Tip: run `openclaw cron --help` for the full command surface.

Note: isolated `cron add` jobs default to `--announce` delivery. Use `--no-deliver` to keep
output internal. `--deliver` remains as a deprecated alias for `--announce`.

Note: one-shot (`--at`) jobs delete after success by default. Use `--keep-after-run` to keep them.

Note: recurring jobs now use exponential retry backoff after consecutive errors (30s → 1m → 5m → 15m → 60m), then return to normal schedule after the next successful run.

## Common edits

Update delivery settings without changing the message:

```bash
openclaw cron edit <job-id> --announce --channel telegram --to "123456789"
```

Disable delivery for an isolated job:

```bash
openclaw cron edit <job-id> --no-deliver
```

Announce to a specific channel:

```bash
openclaw cron edit <job-id> --announce --channel slack --to "channel:C1234567890"
```

## Telemetry digest cron (example)

Schedule a weekly telemetry cost report every Monday at 9am:

```bash
openclaw cron add \
  --id weekly-cost-digest \
  --schedule "0 9 * * 1" \
  --message "Run bun /path/to/openclaw/scripts/weekly-telemetry-digest.ts and summarize the output"
```

Or reference the regression harness in CI:

```bash
# Save a baseline before deploy
bun scripts/regression-check.ts --save-baseline v2026.2.21

# After deploy — check for regressions
bun scripts/regression-check.ts --baseline v2026.2.21 --current HEAD
```

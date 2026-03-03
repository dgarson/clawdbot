---
summary: "CLI reference for `openclaw system` (system events, heartbeat, presence)"
read_when:
  - You want to enqueue a system event without creating a cron job
  - You need to enable or disable heartbeats
  - You want to inspect system presence entries
title: "system"
---

# `openclaw system`

System-level helpers for the Gateway: enqueue system events, control heartbeats,
and view presence.

## Common commands

```bash
openclaw system event --text "Check for urgent follow-ups" --mode now
openclaw system heartbeat enable
openclaw system heartbeat last
openclaw system presence
openclaw system watchdog run --config ~/.openclaw/watchdog.json
```

## `system event`

Enqueue a system event on the **main** session. The next heartbeat will inject
it as a `System:` line in the prompt. Use `--mode now` to trigger the heartbeat
immediately; `next-heartbeat` waits for the next scheduled tick.

Flags:

- `--text <text>`: required system event text.
- `--mode <mode>`: `now` or `next-heartbeat` (default).
- `--json`: machine-readable output.

## `system heartbeat last|enable|disable`

Heartbeat controls:

- `last`: show the last heartbeat event.
- `enable`: turn heartbeats back on (use this if they were disabled).
- `disable`: pause heartbeats.

Flags:

- `--json`: machine-readable output.

## `system presence`

List the current system presence entries the Gateway knows about (nodes,
instances, and similar status lines).

Flags:

- `--json`: machine-readable output.

## `system watchdog run`

Run a lightweight watchdog loop that:

- checks whether the gateway service is healthy
- scans recent gateway logs for configured error patterns and extracts a PID to kill
- restores `openclaw.json` from backups when config parsing is invalid
- tracks branch drift in the deployment checkout and publishes system-status alerts
- runs fallback git repair + rebuild + restart when normal recovery fails

Flags:

- `--config <path>`: watchdog config path (JSON/JSON5, default `~/.openclaw/watchdog.json`).
- `--once`: run one cycle and exit.
- `--interval <ms>`: override polling interval.
- `--branch-interval <ms>`: override branch-check interval.
- `--json`: print one JSON object per cycle.

Example config:

```json
{
  "intervalMs": 30000,
  "branchCheckIntervalMs": 3600000,
  "deploymentDir": "~/openclaw",
  "expectedBranch": "dgarson/fork",
  "gitRemote": "origin",
  "gitRemoteBranch": "dgarson/fork",
  "logPaths": [
    "~/.openclaw/logs/gateway.log",
    "~/.openclaw/logs/gateway.err.log",
    "/tmp/openclaw-gateway.log"
  ],
  "errorKillRules": [
    {
      "name": "duplicate gateway port bind",
      "match": "address already in use|EADDRINUSE|duplicate gateway",
      "pid": "pid[:= ]\\s*(\\d+)"
    }
  ],
  "systemStatus": {
    "channel": "slack",
    "targets": ["channel:C1234567890"],
    "notifyOnHealthy": false,
    "llmSummary": {
      "enabled": false,
      "model": "gpt-4.1-mini"
    },
    "tts": {
      "enabled": false,
      "model": "gpt-4o-mini-tts",
      "voice": "alloy"
    }
  },
  "recovery": {
    "enabled": true,
    "stashBeforeRepair": true
  }
}
```

## Notes

- Requires a running Gateway reachable by your current config (local or remote).
- System events are ephemeral and not persisted across restarts.

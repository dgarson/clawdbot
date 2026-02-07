---
name: session-end
description: "Archive Meridia session buffer on /new and /stop"
metadata:
  {
    "openclaw":
      {
        "emoji": "📦",
        "events": ["command:new", "command:stop"],
        "requires": { "config": ["hooks.internal.entries.session-end.enabled"] },
        "install": [{ "id": "meridia", "kind": "plugin", "label": "Meridia plugin" }],
      },
  }
---

# Session End (Meridia)

Builds a session summary from the Meridia session buffer on `/new` and `/stop`.

## Behavior

- Writes a JSON summary artifact under `sessions/<date>/...json`
- Computes a naive session relevance score (0..1) from:
  - number of captured experiences
  - whether an error was observed
  - overall tool activity
- Records a `session_end` Meridia experience record with the summary
- If Graphiti is enabled and the relevance score exceeds the configured threshold, ingests a
  `session:<sessionId>:summary` episode into Graphiti via `GraphitiClient.ingestEpisodes()`

## Config

This hook reads the following config keys:

- `min_session_significance_threshold` / `minSessionSignificanceThreshold` (default: `0.55`)

If not provided, the default threshold is used.

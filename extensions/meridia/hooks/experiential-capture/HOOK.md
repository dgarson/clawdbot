---
name: experiential-capture
description: "Capture significant tool results as Meridia experiential records"
metadata:
  {
    "openclaw":
      {
        "emoji": "🧠",
        "events": ["agent:tool:result"],
        "requires": { "config": ["hooks.internal.entries.experiential-capture.enabled"] },
        "install": [{ "id": "meridia", "kind": "plugin", "label": "Meridia plugin" }],
      },
  }
---

# Experiential Capture (Meridia)

Captures significant tool results into Meridia records (SQLite + optional trace JSONL).

## Configuration

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "experiential-capture": {
          "enabled": true,
          "dir": "~/.openclaw/meridia",
          "min_significance_threshold": 0.6,
          "max_captures_per_hour": 10,
          "min_interval_ms": 300000,
          "evaluation_model": "google/gemini-3-flash-preview",
          "evaluation_timeout_ms": 3500,
          "graphiti": {
            "enabled": false,
            "minSignificanceForGraph": 0.7,
            "groupId": "meridia-experiences"
          }
        }
      }
    }
  }
}
```

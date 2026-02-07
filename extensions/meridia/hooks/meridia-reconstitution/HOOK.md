---
name: meridia-reconstitution
description: "Inject recent experiential context into new sessions at bootstrap"
metadata:
  {
    "openclaw":
      {
        "emoji": "🌅",
        "events": ["agent:bootstrap"],
        "requires": { "config": ["hooks.internal.entries.meridia-reconstitution.enabled"] },
        "install": [{ "id": "meridia", "kind": "plugin", "label": "Meridia plugin" }],
      },
  }
---

# Meridia Reconstitution (Morning Briefing)

On `agent:bootstrap`, queries Meridia records and injects a compact continuity briefing.

## Configuration

```json
{
  "hooks": {
    "internal": {
      "enabled": true,
      "entries": {
        "meridia-reconstitution": {
          "enabled": true,
          "maxTokens": 2000,
          "lookbackHours": 48,
          "minScore": 0.6
        }
      }
    }
  }
}
```

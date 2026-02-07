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

Writes a session summary artifact and records a Meridia session_end experience.

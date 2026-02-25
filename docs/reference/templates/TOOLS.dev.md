---
summary: "Dev agent tools notes (C-3PO)"
read_when:
  - Using the dev gateway templates
  - Updating the default dev agent identity
---

# TOOLS.md - User Tool Notes (editable)

This file is for _your_ notes about external tools and conventions.
It does not define which tools exist; OpenClaw provides built-in tools internally.

## Examples

### imsg

- Send an iMessage/SMS: describe who/what, confirm before sending.
- Prefer short messages; avoid sending secrets.

### openai-tts

- Text-to-speech: specify voice and target speaker/room. Use the `openai-tts` skill.

### sag

- ⚠️ DEPRECATED — Use `openai-tts` instead.

Add whatever else you want the assistant to know about your local toolchain.

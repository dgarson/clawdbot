# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- **Provider**: OpenAI TTS (`tts-1-hd`) — canonical script: `/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh`
- **Merlin's voice**: `fable` (warm British — fits the character)
- **Output path**: always write to `/Users/openclaw/.openclaw/workspace/_shared/audio/` — **never `/tmp/`** (Slack rejects attachments outside workspace)
- Do NOT use `sag` (ElevenLabs), macOS `say`, or Edge TTS — OpenAI TTS is the standard
- Attach generated MP3s via `filePath` parameter in the `message` tool — never post raw `MEDIA:` paths
- See the `openai-tts` skill for full docs and voice table
- **Hard limit: 3900 chars max** — always `wc -c` the script before calling speak.sh; trim prose if over, never split/stitch
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

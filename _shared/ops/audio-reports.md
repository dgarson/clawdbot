# Audio Reports

> Read when: generating audio updates, status reports, or voice messages for David.

## When to Use

David is often driving. Default to audio for status updates and notifications.
Audio > walls of text for async communication to David.

## Generate Audio

```bash
_shared/scripts/openai-tts.sh \
  --model tts-1-hd \
  --voice fable \
  --output _shared/audio/<descriptive-name>.mp3 \
  "<your text here>"
```

- Default voice: `fable`
- Output: always to `_shared/audio/` — **never to `/tmp/`**
- Model: `tts-1-hd`

## Post to Slack

Post to `#cb-notifications` (channel ID: `C0AAQJBCU0N`) with the `filePath` parameter.

David is often driving — default to this channel for audio delivery.

## Per-Agent Voices

Each agent has a configured voice. Check your AGENTS.md `## Voice` section or `SOUL.md` for:
- Voice name and ElevenLabs ID
- `sag -v "<VoiceName>" "<text>"` command shorthand

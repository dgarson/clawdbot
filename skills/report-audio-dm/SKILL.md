---
name: report-audio-dm
description: Generate reports with a default 1-2 minute audio summary, archive audio files in one shared location, and DM the recording in Slack. Use for daily/weekly reports, status updates, recaps, incident summaries, or any request that says "report" unless the user explicitly asks for text-only or a different audio duration.
---

# Report Audio DM

Default behavior for report requests:

- Always create a 1-2 minute audio summary unless user explicitly opts out.
- Always save the audio to the shared archive root.
- Always DM the audio file to Slack (`user:<id>` target).
- Use OpenAI TTS by default (`gpt-4o-mini-tts`, `alloy` unless overridden).

## Required inputs

- `OPENAI_API_KEY` (required)
- `REPORT_SLACK_TARGET` (required, must be `user:<SLACK_USER_ID>`)
- `REPORT_AUDIO_ARCHIVE_DIR` (optional, default: `~/.openclaw/reports/audio`)
- `REPORT_TTS_MODEL` (optional, default: `gpt-4o-mini-tts`)
- `REPORT_TTS_VOICE` (optional, default: `alloy`)

If required values are missing, ask once and stop.

## Canonical script

Use this script for all report audio generation and delivery:

`skills/report-audio-dm/scripts/generate-report-audio.sh`

Quick usage:

```bash
skills/report-audio-dm/scripts/generate-report-audio.sh \
  --topic "build health" \
  --report-type daily \
  --duration-tag 1-2min \
  --text-file /tmp/report-summary.txt
```

The script handles:

- OpenAI TTS generation (`/v1/audio/speech`)
- Archive pathing in `YYYY/MM/DD`
- Canonical filename:
  `YYYYMMDD-HHMMSS__<report_type>__<topic_slug>.mp3`
- Slack DM send with one retry

Voice catalog:

`skills/report-audio-dm/scripts/generate-report-audio.sh --list-voices`

Supported OpenAI voice names:

- `alloy` - balanced neutral everyday tone, male
- `ash` - warm crisp conversational style, male
- `ballad` - expressive smooth story pacing, female
- `cedar` - grounded steady professional delivery, male
- `coral` - clear polished friendly cadence, female
- `echo` - deep resonant authoritative narration, male
- `fable` - lively dramatic audiobook energy, male
- `juniper` - bright articulate confident delivery, female
- `marin` - calm premium broadcast presence, female
- `nova` - upbeat modern customer-facing energy, female
- `onyx` - bold weighty high-impact delivery, male
- `sage` - composed warm instructional cadence, male
- `shimmer` - soft intimate gentle expressiveness, female
- `verse` - cinematic rhythmic presenter style, male

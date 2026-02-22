---
name: openai-tts
description: Generate speech audio from text using the OpenAI TTS API. Use for audio reports, voice updates, and any TTS output sent to Slack or other channels.
homepage: https://platform.openai.com/docs/guides/text-to-speech
metadata:
  {
    "openclaw":
      {
        "emoji": "🔊",
        "requires": { "bins": ["curl", "jq"], "env": ["OPENAI_API_KEY"] },
        "primaryEnv": "OPENAI_API_KEY",
      },
  }
---

# OpenAI TTS

Generate speech audio via OpenAI's `/v1/audio/speech` endpoint.

**This is the preferred TTS method for all audio reports.** Use it whenever David asks for an audio report, voice summary, or spoken update.

## Canonical script

```
/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh
```

This is the shared script used by all agents. Do not use the `sag` (ElevenLabs) CLI, macOS `say`, or Edge TTS.

## Quick start

```bash
SCRIPT=/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh

# Basic — text argument
$SCRIPT -v fable -o /Users/openclaw/.openclaw/workspace/_shared/audio/report.mp3 "Hello, here is your update."

# Pipe from stdin
echo "Long report text..." | $SCRIPT -v fable -o /Users/openclaw/.openclaw/workspace/_shared/audio/report.mp3

# Higher quality model
$SCRIPT -v onyx -m tts-1-hd -o /Users/openclaw/.openclaw/workspace/_shared/audio/report.mp3 "Text here"

# Control speed
$SCRIPT -v nova -s 1.1 -o /Users/openclaw/.openclaw/workspace/_shared/audio/report.mp3 "Text here"
```

## Flags

| Flag              | Default      | Description                                                    |
| ----------------- | ------------ | -------------------------------------------------------------- |
| `-v` / `--voice`  | `alloy`      | Voice name (see table below)                                   |
| `-o` / `--output` | _(required)_ | Output file path — **must be inside `~/.openclaw/workspace/`** |
| `-m` / `--model`  | `tts-1-hd`   | Model: `tts-1` (fast) or `tts-1-hd` (quality)                  |
| `-s` / `--speed`  | `1.0`        | Speed: 0.25–4.0                                                |
| `-f` / `--format` | `mp3`        | Format: `mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`             |

## ⚠️ Output path — critical

**Always write output to a workspace directory, never `/tmp/`.**
Slack and other channel integrations will reject attachments from `/tmp/` due to path policy.

Use:

```
/Users/openclaw/.openclaw/workspace/_shared/audio/<label>.mp3
~/.openclaw/workspace/<agent>/audio/<label>.mp3
```

## Available voices

| Voice     | Character                      |
| --------- | ------------------------------ |
| `alloy`   | Neutral, balanced              |
| `ash`     | Clear, crisp male              |
| `ballad`  | Warm male                      |
| `coral`   | Warm female                    |
| `echo`    | Clear, analytical male         |
| `fable`   | Warm British male              |
| `nova`    | Energetic, professional female |
| `onyx`    | Deep, authoritative male       |
| `sage`    | Measured, thoughtful           |
| `shimmer` | Warm female                    |
| `verse`   | Expressive male                |

Each agent has a specific assigned voice in their `TOOLS.md`. Use your assigned voice unless David asks for something different.

## Audio report pattern

1. Write report text to a variable or file
2. Run `openai-tts.sh` with your assigned `-v` voice, output to workspace dir
3. Send to Slack via `message` tool with `filePath` pointing to the generated MP3
4. **Never** post raw `MEDIA:` paths — always use the `filePath` attachment parameter
5. Keep the accompanying Slack message concise — the audio carries the content

## Full example

```bash
SCRIPT=/Users/openclaw/.openclaw/workspace/_shared/scripts/openai-tts.sh
OUT=/Users/openclaw/.openclaw/workspace/_shared/audio/status-$(date +%Y%m%d-%H%M%S).mp3

$SCRIPT -v fable -m tts-1-hd -o "$OUT" "Here is your weekly status update..."

# Then in your message tool:
# action: send
# channel: slack
# channelId: C0AAQJBCU0N   (#cb-notifications)
# message: "Weekly status — audio attached"
# filePath: <value of $OUT>
```

## Long reports (> API limit)

Split into parts and concatenate with ffmpeg:

```bash
$SCRIPT -v fable -o /Users/openclaw/.openclaw/workspace/_shared/audio/p1.mp3 "Part 1 text..."
$SCRIPT -v fable -o /Users/openclaw/.openclaw/workspace/_shared/audio/p2.mp3 "Part 2 text..."
ffmpeg -i "concat:/Users/openclaw/.openclaw/workspace/_shared/audio/p1.mp3|/Users/openclaw/.openclaw/workspace/_shared/audio/p2.mp3" \
  -acodec copy /Users/openclaw/.openclaw/workspace/_shared/audio/full-report.mp3
```

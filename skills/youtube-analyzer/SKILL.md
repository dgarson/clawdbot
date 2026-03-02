---
name: youtube-analyzer
description: >
  Crawl YouTube videos (single video, playlist, or channel), extract audio with yt-dlp,
  transcribe via OpenAI Whisper API, and run LLM-powered analysis. Analysis modes include
  summary, topic extraction, sentiment, Q&A generation, chapter creation, action items, and
  a full comprehensive report. Use when the user wants to process or analyze YouTube content,
  transcribe a YouTube video to text, batch-analyze a playlist or channel, extract key
  information from videos, generate summaries or Q&A from video content, or do competitor
  and audience intelligence on YouTube videos.
metadata:
  openclaw:
    emoji: "🎬"
    requires:
      bins: ["yt-dlp", "ffmpeg", "curl", "python3"]
      env: ["OPENAI_API_KEY"]
    install:
      - id: brew-yt-dlp
        kind: brew
        formula: yt-dlp
        bins: ["yt-dlp"]
        label: "Install yt-dlp (brew)"
---

# YouTube Analyzer

Full pipeline: **YouTube URL → audio download → Whisper transcription → LLM analysis**.

## Quick Start

### One-liner (full pipeline)

```bash
{baseDir}/scripts/pipeline.sh "https://youtu.be/VIDEO_ID" --out-dir ./yt-output
```

### With specific analysis modes

```bash
{baseDir}/scripts/pipeline.sh "https://youtu.be/VIDEO_ID" \
  --analysis-mode "summary,topics,qa" \
  --out-dir ./yt-output
```

### Playlist or channel (limit to 10 videos)

```bash
{baseDir}/scripts/pipeline.sh "https://youtube.com/playlist?list=PL..." \
  --playlist-limit 10 \
  --analysis-mode "summary,actions" \
  --out-dir ./playlist-output
```

---

## Pipeline Stages

The pipeline runs three stages in sequence. Each can be skipped via flags.

### Stage 1 — Download (`yt_download.sh`)

Downloads audio-only (16 kHz m4a, optimal for Whisper) using yt-dlp.

```bash
{baseDir}/scripts/yt_download.sh "https://youtu.be/..." --out-dir ./audio
{baseDir}/scripts/yt_download.sh "https://youtu.be/..." --format mp3
{baseDir}/scripts/yt_download.sh "https://youtube.com/playlist?list=..." --playlist-limit 20
{baseDir}/scripts/yt_download.sh "https://youtu.be/..." --video   # download video+audio
{baseDir}/scripts/yt_download.sh "https://youtu.be/..." --dry-run  # preview only
```

Saves `.info.json` metadata alongside each audio file.

### Stage 2 — Transcribe (`transcribe.sh`)

Sends audio files to OpenAI Whisper API. Outputs `.txt` transcript per file.

```bash
{baseDir}/scripts/transcribe.sh ./audio/                  # whole directory
{baseDir}/scripts/transcribe.sh ./audio/video.m4a         # single file
{baseDir}/scripts/transcribe.sh ./audio/ --language en
{baseDir}/scripts/transcribe.sh ./audio/ --prompt "Speaker: Lex Fridman, guest: Sam Altman"
{baseDir}/scripts/transcribe.sh ./audio/ --json           # also save raw Whisper JSON
```

Files >24 MB are skipped with a split command hint (ffmpeg segment).

### Stage 3 — Analyze (`analyze.sh`)

Runs LLM analysis on `.txt` transcripts. Outputs `.{mode}.md` markdown files.

```bash
{baseDir}/scripts/analyze.sh ./transcripts/ --mode summary
{baseDir}/scripts/analyze.sh ./transcripts/ --mode full
{baseDir}/scripts/analyze.sh ./transcripts/ --mode sentiment --model gpt-4o
{baseDir}/scripts/analyze.sh ./transcripts/ --custom-prompt "Extract all product names mentioned."
{baseDir}/scripts/analyze.sh ./transcripts/ --force   # re-run even if output exists
```

---

## Analysis Modes

| Mode        | Flag               | Output                                  |
| ----------- | ------------------ | --------------------------------------- |
| `summary`   | `--mode summary`   | TL;DR, narrative arc, key takeaways     |
| `topics`    | `--mode topics`    | Topic list with descriptions + keywords |
| `sentiment` | `--mode sentiment` | Tone, emotional arc, positive/negative  |
| `qa`        | `--mode qa`        | 10 Q&A pairs from the content           |
| `chapters`  | `--mode chapters`  | Timestamped chapter list                |
| `actions`   | `--mode actions`   | Action items, how-to steps, advice      |
| `full`      | `--mode full`      | All of the above in one report          |

See `references/analysis-prompts.md` for prompt details and custom prompt examples.

---

## Common Patterns

### Skip download (transcribe existing audio files)

```bash
{baseDir}/scripts/pipeline.sh --skip-download --out-dir ./yt-output
```

### Skip download + transcription (re-analyze existing transcripts)

```bash
{baseDir}/scripts/pipeline.sh --skip-download --skip-transcribe \
  --analysis-mode "topics,sentiment" --out-dir ./yt-output
```

### Age-gated or private videos

```bash
{baseDir}/scripts/yt_download.sh "https://youtu.be/..." --cookies ~/cookies.txt
```

Export cookies from browser using the "Get cookies.txt LOCALLY" extension.

---

## Requirements

- **`yt-dlp`** — `brew install yt-dlp`
- **`ffmpeg`** — `brew install ffmpeg`
- **`OPENAI_API_KEY`** — for Whisper + GPT analysis

Set the API key:

```bash
export OPENAI_API_KEY="sk-..."
```

Or configure in `~/.openclaw/openclaw.json`:

```json5
{
  skills: {
    "youtube-analyzer": { apiKey: "sk-..." },
  },
}
```

---

## Output Structure

```
yt-output/
├── audio/
│   ├── 20240315_dQw4w9WgXcQ_Video Title.m4a
│   └── 20240315_dQw4w9WgXcQ_Video Title.info.json
├── transcripts/
│   └── 20240315_dQw4w9WgXcQ_Video Title.txt
└── analysis/
    ├── 20240315_dQw4w9WgXcQ_Video Title.summary.md
    ├── 20240315_dQw4w9WgXcQ_Video Title.topics.md
    └── 20240315_dQw4w9WgXcQ_Video Title.full.md
```

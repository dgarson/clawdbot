#!/usr/bin/env bash
# pipeline.sh — Full end-to-end pipeline: download → transcribe → analyze.
# Wraps yt_download.sh, transcribe.sh, and analyze.sh in one command.
#
# Usage:
#   pipeline.sh <youtube-url-or-file> [options]
#
# Options:
#   --out-dir <dir>      Root output directory (default: ./yt-pipeline)
#   --analysis-mode <m>  Analysis mode(s), comma-separated (default: full)
#                        Options: summary|topics|sentiment|qa|chapters|actions|full
#   --whisper-model <m>  Whisper model (default: whisper-1)
#   --llm-model <m>      LLM for analysis (default: gpt-4o)
#   --language <lang>    Force language for Whisper (e.g., en)
#   --playlist-limit N   Cap playlist/channel to N videos
#   --video              Download video+audio (default: audio-only)
#   --skip-download      Skip download; transcribe existing files in --out-dir
#   --skip-transcribe    Skip transcription; analyze existing .txt files
#   --cookies <file>     Netscape cookies file for age-gated videos
#   --api-key <key>      OpenAI API key (overrides OPENAI_API_KEY)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

URL=""
OUT_DIR="./yt-pipeline"
ANALYSIS_MODES="full"
WHISPER_MODEL="whisper-1"
LLM_MODEL="gpt-4o"
LANGUAGE=""
PLAYLIST_LIMIT=""
VIDEO_MODE=false
SKIP_DOWNLOAD=false
SKIP_TRANSCRIBE=false
COOKIES=""
API_KEY="${OPENAI_API_KEY:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)          OUT_DIR="$2";          shift 2 ;;
    --analysis-mode)    ANALYSIS_MODES="$2";   shift 2 ;;
    --whisper-model)    WHISPER_MODEL="$2";    shift 2 ;;
    --llm-model)        LLM_MODEL="$2";        shift 2 ;;
    --language)         LANGUAGE="$2";         shift 2 ;;
    --playlist-limit)   PLAYLIST_LIMIT="$2";   shift 2 ;;
    --video)            VIDEO_MODE=true;        shift ;;
    --skip-download)    SKIP_DOWNLOAD=true;     shift ;;
    --skip-transcribe)  SKIP_TRANSCRIBE=true;   shift ;;
    --cookies)          COOKIES="$2";           shift 2 ;;
    --api-key)          API_KEY="$2";           shift 2 ;;
    -*)                 echo "Unknown option: $1" >&2; exit 1 ;;
    *)                  URL="$1";               shift ;;
  esac
done

if [[ -z "$URL" ]] && ! $SKIP_DOWNLOAD; then
  echo "Usage: $0 <youtube-url> [options]" >&2
  exit 1
fi
if [[ -z "$API_KEY" ]]; then
  echo "ERROR: OPENAI_API_KEY not set." >&2; exit 1
fi

AUDIO_DIR="${OUT_DIR}/audio"
TRANSCRIPT_DIR="${OUT_DIR}/transcripts"
ANALYSIS_DIR="${OUT_DIR}/analysis"
mkdir -p "$AUDIO_DIR" "$TRANSCRIPT_DIR" "$ANALYSIS_DIR"

log() { echo "[pipeline] $*"; }

# --- STEP 1: Download ---
if ! $SKIP_DOWNLOAD; then
  log "Step 1/3 — Downloading audio from: $URL"
  DOWNLOAD_ARGS=("$URL" --out-dir "$AUDIO_DIR")
  $VIDEO_MODE && DOWNLOAD_ARGS+=(--video)
  [[ -n "$PLAYLIST_LIMIT" ]] && DOWNLOAD_ARGS+=(--playlist-limit "$PLAYLIST_LIMIT")
  [[ -n "$COOKIES" ]] && DOWNLOAD_ARGS+=(--cookies "$COOKIES")
  bash "${SCRIPT_DIR}/yt_download.sh" "${DOWNLOAD_ARGS[@]}"
else
  log "Step 1/3 — [skipped] Using existing files in $AUDIO_DIR"
fi

# --- STEP 2: Transcribe ---
if ! $SKIP_TRANSCRIBE; then
  log "Step 2/3 — Transcribing audio → text"
  TRANSCRIBE_ARGS=("$AUDIO_DIR" --out-dir "$TRANSCRIPT_DIR" --model "$WHISPER_MODEL" --api-key "$API_KEY")
  [[ -n "$LANGUAGE" ]] && TRANSCRIBE_ARGS+=(--language "$LANGUAGE")
  bash "${SCRIPT_DIR}/transcribe.sh" "${TRANSCRIBE_ARGS[@]}"
else
  log "Step 2/3 — [skipped] Using existing transcripts in $TRANSCRIPT_DIR"
fi

# --- STEP 3: Analyze ---
log "Step 3/3 — Running analysis (modes: $ANALYSIS_MODES)"
IFS=',' read -ra MODES <<< "$ANALYSIS_MODES"
for mode in "${MODES[@]}"; do
  mode="$(echo "$mode" | tr -d ' ')"
  log "  → mode: $mode"
  bash "${SCRIPT_DIR}/analyze.sh" "$TRANSCRIPT_DIR" \
    --mode "$mode" \
    --model "$LLM_MODEL" \
    --out-dir "$ANALYSIS_DIR" \
    --api-key "$API_KEY"
done

# --- Summary ---
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║        Pipeline Complete ✓               ║"
echo "╠══════════════════════════════════════════╣"
echo "║  Audio:      $AUDIO_DIR"
echo "║  Transcripts: $TRANSCRIPT_DIR"
echo "║  Analysis:   $ANALYSIS_DIR"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Analysis files:"
find "$ANALYSIS_DIR" -name "*.md" 2>/dev/null | sort | while read -r f; do
  echo "  • $f"
done

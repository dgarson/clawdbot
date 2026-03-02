#!/usr/bin/env bash
# transcribe.sh — Transcribe an audio file (or all audio in a directory) via
# OpenAI Whisper API.  Outputs a .txt transcript alongside each audio file.
#
# Usage:
#   transcribe.sh <audio-file-or-dir> [options]
#
# Options:
#   --model <model>      Whisper model (default: whisper-1)
#   --language <lang>    ISO 639-1 language code, e.g. en (auto-detect if omitted)
#   --prompt <text>      Optional context hint for Whisper (names, jargon, etc.)
#   --out-dir <dir>      Write transcripts here (default: same dir as audio)
#   --json               Save raw Whisper JSON response alongside .txt
#   --api-key <key>      Override OPENAI_API_KEY env var
#   --max-size-mb N      Skip files larger than N MB (default: 24, API limit is 25)

set -euo pipefail

TARGET=""
MODEL="whisper-1"
LANGUAGE=""
PROMPT=""
OUT_DIR=""
JSON_MODE=false
API_KEY="${OPENAI_API_KEY:-}"
MAX_SIZE_MB=24

while [[ $# -gt 0 ]]; do
  case "$1" in
    --model)       MODEL="$2";       shift 2 ;;
    --language)    LANGUAGE="$2";    shift 2 ;;
    --prompt)      PROMPT="$2";      shift 2 ;;
    --out-dir)     OUT_DIR="$2";     shift 2 ;;
    --json)        JSON_MODE=true;   shift ;;
    --api-key)     API_KEY="$2";     shift 2 ;;
    --max-size-mb) MAX_SIZE_MB="$2"; shift 2 ;;
    -*)            echo "Unknown option: $1" >&2; exit 1 ;;
    *)             TARGET="$1";      shift ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <audio-file-or-dir> [options]" >&2
  exit 1
fi

if [[ -z "$API_KEY" ]]; then
  echo "ERROR: OPENAI_API_KEY not set. Pass --api-key or export OPENAI_API_KEY." >&2
  exit 1
fi

# Collect files to process
AUDIO_EXTS=("m4a" "mp3" "wav" "ogg" "opus" "flac" "webm" "mp4")

collect_files() {
  local target="$1"
  if [[ -f "$target" ]]; then
    echo "$target"
  elif [[ -d "$target" ]]; then
    for ext in "${AUDIO_EXTS[@]}"; do
      find "$target" -maxdepth 2 -iname "*.${ext}" 2>/dev/null
    done | sort
  else
    echo "ERROR: Not a file or directory: $target" >&2
    exit 1
  fi
}

FILES=$(collect_files "$TARGET")

if [[ -z "$FILES" ]]; then
  echo "No audio files found in: $TARGET" >&2
  exit 1
fi

transcribe_file() {
  local audio="$1"
  local base
  base="$(basename "$audio")"
  local stem="${base%.*}"

  # Determine output path
  local dest_dir
  if [[ -n "$OUT_DIR" ]]; then
    dest_dir="$OUT_DIR"
    mkdir -p "$dest_dir"
  else
    dest_dir="$(dirname "$audio")"
  fi

  local out_txt="${dest_dir}/${stem}.txt"
  local out_json="${dest_dir}/${stem}.whisper.json"

  # Skip if already transcribed
  if [[ -f "$out_txt" ]]; then
    echo "  [skip] $base — transcript already exists"
    return 0
  fi

  # Check file size
  local size_mb
  size_mb=$(du -m "$audio" | cut -f1)
  if (( size_mb > MAX_SIZE_MB )); then
    echo "  [skip] $base — ${size_mb}MB exceeds limit of ${MAX_SIZE_MB}MB" >&2
    echo "         Consider splitting with: ffmpeg -i \"$audio\" -f segment -segment_time 600 -c copy out_%03d.m4a"
    return 0
  fi

  echo "  Transcribing: $base (${size_mb}MB) → $out_txt"

  # Build curl args
  local CURL_ARGS=(
    -s
    -X POST
    https://api.openai.com/v1/audio/transcriptions
    -H "Authorization: Bearer ${API_KEY}"
    -F "file=@${audio}"
    -F "model=${MODEL}"
    -F "response_format=verbose_json"
  )
  [[ -n "$LANGUAGE" ]] && CURL_ARGS+=(-F "language=${LANGUAGE}")
  [[ -n "$PROMPT" ]]   && CURL_ARGS+=(-F "prompt=${PROMPT}")

  local response
  response=$(curl "${CURL_ARGS[@]}")

  # Check for API error
  if echo "$response" | grep -q '"error"'; then
    echo "  ERROR from Whisper API:" >&2
    echo "$response" | python3 -c "import sys,json; e=json.load(sys.stdin).get('error',{}); print(e.get('message','unknown error'))" >&2
    return 1
  fi

  # Extract plain text
  echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text',''))" > "$out_txt"

  # Save raw JSON if requested
  if $JSON_MODE; then
    echo "$response" > "$out_json"
    echo "    JSON saved: $out_json"
  fi

  echo "    Done: $out_txt"
}

echo "=== Whisper Transcription ==="
echo "Model: $MODEL"
echo ""

while IFS= read -r f; do
  [[ -n "$f" ]] && transcribe_file "$f"
done <<< "$FILES"

echo ""
echo "Transcription complete."

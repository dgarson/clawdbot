#!/usr/bin/env bash
#
# openai-tts.sh — OpenAI TTS wrapper for all agents
#
# Usage:
#   openai-tts.sh -v <voice> -o <output.mp3> "Text to speak"
#   openai-tts.sh -v alloy -o /Users/openclaw/.openclaw/workspace/_shared/audio/speech.mp3 "Hello world"
#   echo "Long text" | openai-tts.sh -v nova -o /Users/openclaw/.openclaw/workspace/_shared/audio/speech.mp3
#
# ⚠️  OUTPUT PATH: Always write to a workspace directory (e.g. ~/.openclaw/workspace/).
#     DO NOT use /tmp/ — Slack and other channel integrations will reject attachments
#     from /tmp/ as the path is outside the allowed directory policy.
#
# Voices: alloy, ash, ballad, coral, echo, fable, nova, onyx, sage, shimmer
# Models: tts-1 (fast), tts-1-hd (quality)
#

set -euo pipefail

VOICE="alloy"
MODEL="tts-1-hd"
OUTPUT=""
SPEED="1.0"
FORMAT="mp3"

usage() {
  cat <<EOF
Usage: openai-tts.sh [options] "text"
   or: echo "text" | openai-tts.sh [options]

Options:
  -v, --voice <name>    Voice: alloy|ash|ballad|coral|echo|fable|nova|onyx|sage|shimmer (default: alloy)
  -o, --output <path>   Output file path (required)
  -m, --model <model>   Model: tts-1 or tts-1-hd (default: tts-1-hd)
  -s, --speed <float>   Speed: 0.25 to 4.0 (default: 1.0)
  -f, --format <fmt>    Format: mp3|opus|aac|flac|wav|pcm (default: mp3)
  -h, --help            Show this help
EOF
  exit 1
}

# Parse args
while [[ $# -gt 0 ]]; do
  case "$1" in
    -v|--voice)  VOICE="$2"; shift 2 ;;
    -o|--output) OUTPUT="$2"; shift 2 ;;
    -m|--model)  MODEL="$2"; shift 2 ;;
    -s|--speed)  SPEED="$2"; shift 2 ;;
    -f|--format) FORMAT="$2"; shift 2 ;;
    -h|--help)   usage ;;
    --)          shift; break ;;
    -*)          echo "Unknown option: $1" >&2; usage ;;
    *)           break ;;
  esac
done

# Get text from args or stdin
if [[ $# -gt 0 ]]; then
  TEXT="$*"
elif [[ ! -t 0 ]]; then
  TEXT="$(cat)"
else
  echo "Error: No text provided" >&2
  usage
fi

if [[ -z "$OUTPUT" ]]; then
  echo "Error: Output path required (-o)" >&2
  usage
fi

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Error: OPENAI_API_KEY not set" >&2
  exit 1
fi

# Ensure output directory exists
mkdir -p "$(dirname "$OUTPUT")"

# Build JSON payload
PAYLOAD=$(jq -n \
  --arg model "$MODEL" \
  --arg input "$TEXT" \
  --arg voice "$VOICE" \
  --arg format "$FORMAT" \
  --argjson speed "$SPEED" \
  '{model: $model, input: $input, voice: $voice, response_format: $format, speed: $speed}')

# Call OpenAI TTS API
HTTP_CODE=$(curl -s -w "%{http_code}" \
  -o "$OUTPUT" \
  "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Error: OpenAI TTS API returned HTTP $HTTP_CODE" >&2
  cat "$OUTPUT" >&2
  rm -f "$OUTPUT"
  exit 1
fi

# Verify file was created and has content
FILE_SIZE=$(wc -c < "$OUTPUT" | tr -d ' ')
if [[ "$FILE_SIZE" -lt 100 ]]; then
  echo "Error: Output file is suspiciously small ($FILE_SIZE bytes)" >&2
  exit 1
fi

echo "$OUTPUT"

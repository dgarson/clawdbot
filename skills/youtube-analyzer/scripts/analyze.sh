#!/usr/bin/env bash
# analyze.sh — Run LLM analysis on a transcript file (or all transcripts in a dir).
# Reads prompts from references/analysis-prompts.md or accepts inline mode names.
#
# Usage:
#   analyze.sh <transcript-file-or-dir> [options]
#
# Options:
#   --mode <mode>        Analysis mode (default: summary)
#                        Options: summary|topics|sentiment|qa|chapters|actions|full
#   --model <model>      OpenAI model to use (default: gpt-4o)
#   --custom-prompt <p>  Override with a custom prompt string
#   --out-dir <dir>      Write analysis files here (default: same as transcript)
#   --api-key <key>      Override OPENAI_API_KEY
#   --max-tokens N       Max response tokens (default: 2048)
#   --force              Re-analyze even if output already exists

set -euo pipefail

TARGET=""
MODE="summary"
MODEL="gpt-4o"
CUSTOM_PROMPT=""
OUT_DIR=""
API_KEY="${OPENAI_API_KEY:-}"
MAX_TOKENS=2048
FORCE=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --mode)          MODE="$2";          shift 2 ;;
    --model)         MODEL="$2";         shift 2 ;;
    --custom-prompt) CUSTOM_PROMPT="$2"; shift 2 ;;
    --out-dir)       OUT_DIR="$2";       shift 2 ;;
    --api-key)       API_KEY="$2";       shift 2 ;;
    --max-tokens)    MAX_TOKENS="$2";    shift 2 ;;
    --force)         FORCE=true;         shift ;;
    -*)              echo "Unknown option: $1" >&2; exit 1 ;;
    *)               TARGET="$1";        shift ;;
  esac
done

if [[ -z "$TARGET" ]]; then
  echo "Usage: $0 <transcript-file-or-dir> [options]" >&2
  exit 1
fi
if [[ -z "$API_KEY" ]]; then
  echo "ERROR: OPENAI_API_KEY not set." >&2; exit 1
fi

# --- Prompts by mode ---
get_system_prompt() {
  local mode="$1"
  case "$mode" in
    summary)
      echo "You are an expert content analyst. Given a video transcript, produce a clear, well-structured summary: a 2-3 sentence TL;DR, the main narrative arc, and 5-7 key takeaways as bullet points."
      ;;
    topics)
      echo "You are a topic modeler. Given a video transcript, identify and list the main topics discussed. For each topic: name it, describe it in 1-2 sentences, and note the approximate portion of content devoted to it. Then list 10-15 important keywords."
      ;;
    sentiment)
      echo "You are a sentiment analyst. Analyze the emotional tone of the transcript. Identify: overall sentiment (positive/neutral/negative with confidence), tone descriptors, emotional shifts throughout the video, and any strong positive or negative moments."
      ;;
    qa)
      echo "You are a knowledge extractor. Given the transcript, generate 10 insightful Q&A pairs covering the most important information. Format as:\nQ: [question]\nA: [answer]\n\nFocus on substantive, non-trivial facts."
      ;;
    chapters)
      echo "You are a video editor. Given the transcript, generate a chapter list with timestamps if available (or approximate percentage markers if not). Format: ## [HH:MM:SS] Chapter Title\nBrief description. Aim for logical segments of 3-10 minutes."
      ;;
    actions)
      echo "You are a productivity coach. Extract all action items, recommendations, how-to steps, and advice from the transcript. Format as a prioritized checklist with context."
      ;;
    full)
      echo "You are a comprehensive content analyst. Given the transcript, produce a complete analysis including: 1) Executive Summary (TL;DR + key takeaways), 2) Main Topics with descriptions, 3) Sentiment & Tone, 4) Key Q&A pairs (10 questions), 5) Chapter outline, 6) Action items or recommendations, 7) Notable quotes."
      ;;
    *)
      echo "Analyze the following transcript and provide a comprehensive breakdown." ;;
  esac
}

analyze_file() {
  local transcript="$1"
  local base
  base="$(basename "$transcript" .txt)"

  local dest_dir
  if [[ -n "$OUT_DIR" ]]; then
    dest_dir="$OUT_DIR"
    mkdir -p "$dest_dir"
  else
    dest_dir="$(dirname "$transcript")"
  fi

  local out_file="${dest_dir}/${base}.${MODE}.md"

  if [[ -f "$out_file" ]] && ! $FORCE; then
    echo "  [skip] $base.${MODE}.md already exists (use --force to re-run)"
    return 0
  fi

  local content
  content="$(cat "$transcript")"
  if [[ -z "$content" ]]; then
    echo "  [skip] $base — transcript is empty" >&2
    return 0
  fi

  local sys_prompt
  if [[ -n "$CUSTOM_PROMPT" ]]; then
    sys_prompt="$CUSTOM_PROMPT"
  else
    sys_prompt="$(get_system_prompt "$MODE")"
  fi

  echo "  Analyzing: $(basename "$transcript") [mode=$MODE] → $(basename "$out_file")"

  # Build JSON payload
  local payload
  payload=$(python3 - <<PYEOF
import json, sys
sys_prompt = """${sys_prompt}"""
user_msg = "Transcript:\n\n${content//\"/\\\"}"
payload = {
    "model": "${MODEL}",
    "max_tokens": ${MAX_TOKENS},
    "messages": [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": user_msg}
    ]
}
print(json.dumps(payload))
PYEOF
)

  local response
  response=$(curl -s -X POST https://api.openai.com/v1/chat/completions \
    -H "Authorization: Bearer ${API_KEY}" \
    -H "Content-Type: application/json" \
    -d "$payload")

  if echo "$response" | grep -q '"error"'; then
    echo "  ERROR from OpenAI:" >&2
    echo "$response" | python3 -c "import sys,json; e=json.load(sys.stdin).get('error',{}); print(e.get('message','unknown error'))" >&2
    return 1
  fi

  # Write markdown output with header
  {
    echo "# Analysis: $base"
    echo "**Mode:** $MODE  |  **Model:** $MODEL  |  **Generated:** $(date -u '+%Y-%m-%d %H:%M UTC')"
    echo ""
    echo "$response" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['choices'][0]['message']['content'])"
  } > "$out_file"

  echo "    Saved: $out_file"
}

# Collect transcripts
collect_transcripts() {
  if [[ -f "$TARGET" ]]; then
    echo "$TARGET"
  elif [[ -d "$TARGET" ]]; then
    find "$TARGET" -maxdepth 2 -name "*.txt" ! -name "*.whisper.*" 2>/dev/null | sort
  fi
}

echo "=== YouTube Video Analysis ==="
echo "Mode:  $MODE"
echo "Model: $MODEL"
echo ""

TRANSCRIPTS=$(collect_transcripts)
if [[ -z "$TRANSCRIPTS" ]]; then
  echo "No .txt transcripts found in: $TARGET" >&2; exit 1
fi

while IFS= read -r f; do
  [[ -n "$f" ]] && analyze_file "$f"
done <<< "$TRANSCRIPTS"

echo ""
echo "Analysis complete."

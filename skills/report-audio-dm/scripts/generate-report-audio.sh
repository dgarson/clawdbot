#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  generate-report-audio.sh --topic "Build health" [options]

Required:
  --topic <text>             Report topic used in filename slug
  One of:
    --text <text>            Summary text to synthesize
    --text-file <path>       File containing summary text

Options:
  --report-type <type>       daily|weekly|incident|status|custom (default: status)
  --voice <voice>            OpenAI voice id (default: REPORT_TTS_VOICE or alloy)
  --model <model>            OpenAI model (default: REPORT_TTS_MODEL or gpt-4o-mini-tts)
  --archive-dir <path>       Archive root (default: REPORT_AUDIO_ARCHIVE_DIR or ~/.openclaw/reports/audio)
  --slack-target <target>    DM target user:<id> (default: REPORT_SLACK_TARGET)
  --list-voices              Print supported OpenAI voices and exit
  -h, --help                 Show this help

Required env:
  OPENAI_API_KEY

Default archive output:
  <archive-root>/YYYY/MM/DD/YYYYMMDD-HHMMSS__<report_type>__<topic_slug>.mp3
EOF
  exit 2
}

list_voices() {
  cat <<'EOF'
- alloy - balanced neutral everyday narration (male)
- ash - warm crisp conversational delivery (male)
- ballad - expressive smooth story-like pacing (female)
- cedar - grounded steady professional tone (male)
- coral - clear polished friendly cadence (female)
- echo - deep resonant authoritative narration (male)
- fable - lively dramatic audiobook-style performance (male)
- juniper - bright articulate confident speaking (female)
- marin - calm premium broadcast-like presence (female)
- nova - upbeat modern customer-facing energy (female)
- onyx - bold weighty high-impact delivery (male)
- sage - composed warm instructional cadence (male)
- shimmer - soft intimate gentle expressiveness (female)
- verse - cinematic rhythmic presenter style (male)
EOF
}

have() {
  command -v "$1" >/dev/null 2>&1
}

slugify() {
  local s
  s="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
  s="${s:0:48}"
  if [[ -z "$s" ]]; then
    s="report"
  fi
  printf '%s' "$s"
}

sanitize_tag() {
  local s
  s="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9._-]+/-/g; s/^-+//; s/-+$//')"
  if [[ -z "$s" ]]; then
    s="1-2min"
  fi
  printf '%s' "$s"
}

if [[ $# -eq 0 ]]; then
  usage
fi

topic=""
input_text=""
input_file=""
report_type="status"
voice="${REPORT_TTS_VOICE:-alloy}"
model="${REPORT_TTS_MODEL:-gpt-4o-mini-tts}"
archive_root="${REPORT_AUDIO_ARCHIVE_DIR:-$HOME/.openclaw/reports/audio}"
slack_target="${REPORT_SLACK_TARGET:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --topic)
      topic="${2:-}"
      shift 2
      ;;
    --text)
      input_text="${2:-}"
      shift 2
      ;;
    --text-file)
      input_file="${2:-}"
      shift 2
      ;;
    --report-type)
      report_type="${2:-}"
      shift 2
      ;;
    --voice)
      voice="${2:-}"
      shift 2
      ;;
    --model)
      model="${2:-}"
      shift 2
      ;;
    --archive-dir)
      archive_root="${2:-}"
      shift 2
      ;;
    --slack-target)
      slack_target="${2:-}"
      shift 2
      ;;
    --list-voices)
      list_voices
      exit 0
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown arg: $1" >&2
      usage
      ;;
  esac
done

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "Missing OPENAI_API_KEY" >&2
  exit 1
fi
if [[ -z "$topic" ]]; then
  echo "Missing --topic" >&2
  usage
fi
if [[ -n "$input_text" && -n "$input_file" ]]; then
  echo "Use only one of --text or --text-file" >&2
  exit 1
fi
if [[ -n "$input_file" ]]; then
  if [[ ! -f "$input_file" ]]; then
    echo "Text file not found: $input_file" >&2
    exit 1
  fi
  input_text="$(<"$input_file")"
fi
if [[ -z "$input_text" ]]; then
  echo "Missing summary text. Provide --text or --text-file." >&2
  exit 1
fi
if [[ ! "$report_type" =~ ^(daily|weekly|incident|status|custom)$ ]]; then
  echo "Invalid --report-type: $report_type" >&2
  exit 1
fi
if [[ "$slack_target" != user:* ]]; then
  echo "Missing or invalid Slack DM target. Set --slack-target or REPORT_SLACK_TARGET=user:<id>" >&2
  exit 1
fi

if ! have jq || ! have curl || ! have openclaw; then
  echo "Missing required command(s). Need: jq, curl, openclaw" >&2
  exit 1
fi

topic_slug="$(slugify "$topic")"
day_dir="$(date +%Y/%m/%d)"
timestamp="$(date +%Y%m%d-%H%M%S)"
out_dir="$archive_root/$day_dir"
out_file="$out_dir/${timestamp}__${report_type}__${topic_slug}.mp3"
mkdir -p "$out_dir"

payload="$(jq -n \
  --arg model "$model" \
  --arg voice "$voice" \
  --arg input "$input_text" \
  '{model:$model, voice:$voice, input:$input, format:"mp3"}')"

curl -sS --fail-with-body "https://api.openai.com/v1/audio/speech" \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  -H "Content-Type: application/json" \
  --data "$payload" \
  --output "$out_file"

if [[ ! -s "$out_file" ]]; then
  echo "Audio generation failed: output is empty ($out_file)" >&2
  exit 1
fi

send_msg="Report audio summary attached. File: $(basename "$out_file")"
if ! openclaw message send --channel slack --target "$slack_target" --message "$send_msg" --media "$out_file"; then
  sleep 2
  openclaw message send --channel slack --target "$slack_target" --message "$send_msg" --media "$out_file"
fi

echo "$out_file"

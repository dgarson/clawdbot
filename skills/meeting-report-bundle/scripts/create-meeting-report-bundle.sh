#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  create-meeting-report-bundle.sh --topic "Weekly sync" [options]

Required:
  --topic <text>
  One of:
    --report-text <text>
    --report-file <path>

Optional:
  --audio-text <text>
  --audio-file <path>
  --meeting-type <sync|planning|review|retro|incident|custom>   (default: sync)
  --audience <team|exec|mixed>                                   (default: team)
  --risk <low|medium|high>                                       (default: low)
  --decisions <count>                                            (default: 0)
  --blockers <count>                                             (default: 0)
  --detail <auto|brief|standard|deep>                           (default: auto)
  --duration-tag <tag>                                           (default: 1-2min)
  --archive-dir <path>                                           (default: ~/.openclaw/reports/meetings)
  --audio-archive-dir <path>                                     (default: ~/.openclaw/reports/audio)
  --slack-target <user:id>                                       (or REPORT_SLACK_TARGET env)
  --voice <voice>
  --model <model>
  -h, --help

Required env:
  OPENAI_API_KEY
EOF
  exit 2
}

have() {
  command -v "$1" >/dev/null 2>&1
}

slugify() {
  local s
  s="$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')"
  s="$(printf '%s' "$s" | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//; s/-{2,}/-/g')"
  s="${s:0:64}"
  if [[ -z "$s" ]]; then
    s="meeting-report"
  fi
  printf '%s' "$s"
}

count_words() {
  printf '%s' "$1" | wc -w | awk '{print $1}'
}

word_targets() {
  case "$1" in
    brief) echo "400-700|90-120|120" ;;
    standard) echo "800-1400|140-220|220" ;;
    deep) echo "1600-2800|180-300|300" ;;
    *) echo "800-1400|140-220|220" ;;
  esac
}

resolve_detail_auto() {
  local score=0
  local meeting_type="$1"
  local audience="$2"
  local risk="$3"
  local decisions="$4"
  local blockers="$5"

  if [[ "$meeting_type" == "incident" ]]; then
    score=$((score + 3))
  fi
  if [[ "$audience" == "exec" ]]; then
    score=$((score + 2))
  elif [[ "$audience" == "mixed" ]]; then
    score=$((score + 1))
  fi
  if [[ "$risk" == "high" ]]; then
    score=$((score + 2))
  elif [[ "$risk" == "medium" ]]; then
    score=$((score + 1))
  fi
  if (( decisions >= 4 )); then
    score=$((score + 1))
  fi
  if (( blockers >= 1 )); then
    score=$((score + 1))
  fi

  if (( score >= 6 )); then
    echo "deep"
  elif (( score >= 3 )); then
    echo "standard"
  else
    echo "brief"
  fi
}

derive_audio_script() {
  local report_text="$1"
  local max_words="$2"
  printf '%s' "$report_text" \
    | sed -E 's/\[([^]]+)\]\(([^)]+)\)/\1/g; s/[`*_>#-]+/ /g; s/[[:space:]]+/ /g' \
    | awk -v n="$max_words" '{
        c=0;
        for (i=1; i<=NF; i++) {
          if (c < n) {
            printf "%s%s", $i, (c+1 < n ? " " : "");
            c++;
          }
        }
      }'
}

if [[ $# -eq 0 ]]; then
  usage
fi

topic=""
report_text=""
report_file=""
audio_text=""
audio_file=""
meeting_type="sync"
audience="team"
risk="low"
decisions=0
blockers=0
detail_requested="auto"
duration_tag="1-2min"
archive_root="${HOME}/.openclaw/reports/meetings"
audio_archive_root="${HOME}/.openclaw/reports/audio"
slack_target="${REPORT_SLACK_TARGET:-}"
voice=""
model=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --topic) topic="${2:-}"; shift 2 ;;
    --report-text) report_text="${2:-}"; shift 2 ;;
    --report-file) report_file="${2:-}"; shift 2 ;;
    --audio-text) audio_text="${2:-}"; shift 2 ;;
    --audio-file) audio_file="${2:-}"; shift 2 ;;
    --meeting-type) meeting_type="${2:-}"; shift 2 ;;
    --audience) audience="${2:-}"; shift 2 ;;
    --risk) risk="${2:-}"; shift 2 ;;
    --decisions) decisions="${2:-}"; shift 2 ;;
    --blockers) blockers="${2:-}"; shift 2 ;;
    --detail) detail_requested="${2:-}"; shift 2 ;;
    --duration-tag) duration_tag="${2:-}"; shift 2 ;;
    --archive-dir) archive_root="${2:-}"; shift 2 ;;
    --audio-archive-dir) audio_archive_root="${2:-}"; shift 2 ;;
    --slack-target) slack_target="${2:-}"; shift 2 ;;
    --voice) voice="${2:-}"; shift 2 ;;
    --model) model="${2:-}"; shift 2 ;;
    -h|--help) usage ;;
    *) echo "Unknown arg: $1" >&2; usage ;;
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
if [[ -n "$report_text" && -n "$report_file" ]]; then
  echo "Use only one of --report-text or --report-file" >&2
  exit 1
fi
if [[ -z "$report_text" && -z "$report_file" ]]; then
  echo "Provide --report-text or --report-file" >&2
  exit 1
fi
if [[ -n "$report_file" ]]; then
  if [[ ! -f "$report_file" ]]; then
    echo "Report file not found: $report_file" >&2
    exit 1
  fi
  report_text="$(<"$report_file")"
fi
if [[ -n "$audio_text" && -n "$audio_file" ]]; then
  echo "Use only one of --audio-text or --audio-file" >&2
  exit 1
fi
if [[ -n "$audio_file" ]]; then
  if [[ ! -f "$audio_file" ]]; then
    echo "Audio script file not found: $audio_file" >&2
    exit 1
  fi
  audio_text="$(<"$audio_file")"
fi

if [[ ! "$meeting_type" =~ ^(sync|planning|review|retro|incident|custom)$ ]]; then
  echo "Invalid --meeting-type: $meeting_type" >&2
  exit 1
fi
if [[ ! "$audience" =~ ^(team|exec|mixed)$ ]]; then
  echo "Invalid --audience: $audience" >&2
  exit 1
fi
if [[ ! "$risk" =~ ^(low|medium|high)$ ]]; then
  echo "Invalid --risk: $risk" >&2
  exit 1
fi
if [[ ! "$detail_requested" =~ ^(auto|brief|standard|deep)$ ]]; then
  echo "Invalid --detail: $detail_requested" >&2
  exit 1
fi
if [[ ! "$decisions" =~ ^[0-9]+$ ]] || [[ ! "$blockers" =~ ^[0-9]+$ ]]; then
  echo "--decisions and --blockers must be non-negative integers" >&2
  exit 1
fi
if [[ "$slack_target" != user:* ]]; then
  echo "Missing or invalid Slack DM target. Use --slack-target user:<id> or REPORT_SLACK_TARGET" >&2
  exit 1
fi

if ! have jq || ! have openclaw; then
  echo "Missing required command(s). Need: jq and openclaw" >&2
  exit 1
fi

detail_selected="$detail_requested"
if [[ "$detail_requested" == "auto" ]]; then
  detail_selected="$(resolve_detail_auto "$meeting_type" "$audience" "$risk" "$decisions" "$blockers")"
fi

targets="$(word_targets "$detail_selected")"
md_target="${targets%%|*}"
rest="${targets#*|}"
audio_target="${rest%%|*}"
audio_max_words="${rest##*|}"

if [[ -z "$audio_text" ]]; then
  audio_text="$(derive_audio_script "$report_text" "$audio_max_words")"
fi

report_word_count="$(count_words "$report_text")"
audio_word_count="$(count_words "$audio_text")"

timestamp="$(date +%Y%m%d-%H%M%S)"
day_dir="$(date +%Y/%m/%d)"
slug="$(slugify "$topic")"
bundle_dir="$archive_root/$day_dir/${timestamp}__${slug}"
mkdir -p "$bundle_dir"

report_path="$bundle_dir/report.md"
audio_script_path="$bundle_dir/audio-script.txt"
meta_path="$bundle_dir/meta.json"
bundle_audio_path="$bundle_dir/audio-summary.mp3"

printf '%s\n' "$report_text" >"$report_path"
printf '%s\n' "$audio_text" >"$audio_script_path"

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/../../.." && pwd)"
audio_tool="$repo_root/skills/report-audio-dm/scripts/generate-report-audio.sh"

if [[ ! -x "$audio_tool" ]]; then
  echo "Audio tool is missing or not executable: $audio_tool" >&2
  exit 1
fi

audio_report_type="custom"
if [[ "$meeting_type" == "incident" ]]; then
  audio_report_type="incident"
fi

audio_cmd=(
  "$audio_tool"
  --topic "$topic"
  --report-type "$audio_report_type"
  --duration-tag "$duration_tag"
  --text-file "$audio_script_path"
  --archive-dir "$audio_archive_root"
  --slack-target "$slack_target"
)

if [[ -n "$voice" ]]; then
  audio_cmd+=(--voice "$voice")
fi
if [[ -n "$model" ]]; then
  audio_cmd+=(--model "$model")
fi

audio_output_path="$("${audio_cmd[@]}")"
if [[ ! -f "$audio_output_path" ]]; then
  echo "Audio generation failed. Output path not found: $audio_output_path" >&2
  exit 1
fi

cp "$audio_output_path" "$bundle_audio_path"

jq -n \
  --arg timestamp "$timestamp" \
  --arg topic "$topic" \
  --arg slug "$slug" \
  --arg meetingType "$meeting_type" \
  --arg audience "$audience" \
  --arg risk "$risk" \
  --arg detailRequested "$detail_requested" \
  --arg detailSelected "$detail_selected" \
  --arg mdTargetWords "$md_target" \
  --arg audioTargetWords "$audio_target" \
  --argjson decisionCount "$decisions" \
  --argjson blockerCount "$blockers" \
  --arg reportPath "$report_path" \
  --arg audioScriptPath "$audio_script_path" \
  --arg audioPath "$bundle_audio_path" \
  --arg audioArchivePath "$audio_output_path" \
  --arg slackTarget "$slack_target" \
  --argjson reportWordCount "$report_word_count" \
  --argjson audioWordCount "$audio_word_count" \
  '{
    timestamp: $timestamp,
    topic: $topic,
    slug: $slug,
    meetingType: $meetingType,
    audience: $audience,
    risk: $risk,
    decisionCount: $decisionCount,
    blockerCount: $blockerCount,
    detailRequested: $detailRequested,
    detailSelected: $detailSelected,
    targets: {
      markdownWords: $mdTargetWords,
      audioWords: $audioTargetWords
    },
    observed: {
      markdownWords: $reportWordCount,
      audioWords: $audioWordCount
    },
    files: {
      reportMd: $reportPath,
      audioScript: $audioScriptPath,
      bundleAudio: $audioPath,
      archivedAudio: $audioArchivePath
    },
    delivery: {
      slackTarget: $slackTarget
    }
  }' >"$meta_path"

echo "bundle_dir=$bundle_dir"
echo "report_md=$report_path"
echo "audio_script=$audio_script_path"
echo "audio_summary=$bundle_audio_path"
echo "meta_json=$meta_path"

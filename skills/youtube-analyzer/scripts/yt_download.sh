#!/usr/bin/env bash
# yt_download.sh — Download audio (or video) from a YouTube URL using yt-dlp.
# Handles single videos, playlists, and channel URLs.
#
# Usage:
#   yt_download.sh <url> [options]
#
# Options:
#   --out-dir <dir>     Output directory (default: ./yt-downloads)
#   --format <fmt>      Audio format: mp3|m4a|wav|opus (default: m4a)
#   --quality <q>       Audio quality: 0 (best) – 9 (worst) (default: 0)
#   --video             Download video+audio instead of audio-only
#   --playlist-limit N  Max items from a playlist/channel (default: unlimited)
#   --cookies <file>    Netscape cookies file for age-gated/private videos
#   --dry-run           Print what would be downloaded without downloading

set -euo pipefail

URL=""
OUT_DIR="./yt-downloads"
FORMAT="m4a"
QUALITY="0"
VIDEO_MODE=false
PLAYLIST_LIMIT=""
COOKIES=""
DRY_RUN=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out-dir)   OUT_DIR="$2";        shift 2 ;;
    --format)    FORMAT="$2";         shift 2 ;;
    --quality)   QUALITY="$2";        shift 2 ;;
    --video)     VIDEO_MODE=true;     shift ;;
    --playlist-limit) PLAYLIST_LIMIT="$2"; shift 2 ;;
    --cookies)   COOKIES="$2";        shift 2 ;;
    --dry-run)   DRY_RUN=true;        shift ;;
    -*)          echo "Unknown option: $1" >&2; exit 1 ;;
    *)           URL="$1";            shift ;;
  esac
done

if [[ -z "$URL" ]]; then
  echo "Usage: $0 <youtube-url> [options]" >&2
  exit 1
fi

if ! command -v yt-dlp &>/dev/null; then
  echo "ERROR: yt-dlp not found. Install with: brew install yt-dlp" >&2
  exit 1
fi

mkdir -p "$OUT_DIR"

# Build base args
ARGS=(
  --ignore-errors
  --no-warnings
  --progress
  --output "${OUT_DIR}/%(upload_date)s_%(id)s_%(title)s.%(ext)s"
)

# Playlist/channel limit
[[ -n "$PLAYLIST_LIMIT" ]] && ARGS+=(--playlist-end "$PLAYLIST_LIMIT")

# Cookies
[[ -n "$COOKIES" ]] && ARGS+=(--cookies "$COOKIES")

if $VIDEO_MODE; then
  # Best video + audio, merged into mp4
  ARGS+=(
    --format "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best"
    --merge-output-format mp4
  )
else
  # Audio-only extraction
  ARGS+=(
    --format "bestaudio"
    --extract-audio
    --audio-format "$FORMAT"
    --audio-quality "$QUALITY"
    --postprocessor-args "ffmpeg:-ar 16000"   # 16 kHz — optimal for Whisper
  )
fi

if $DRY_RUN; then
  ARGS+=(--simulate --print filename)
  echo "=== DRY RUN — files that would be downloaded ==="
fi

# Write metadata JSON alongside each file for later reference
ARGS+=(--write-info-json)

echo "Downloading: $URL"
echo "Output dir:  $OUT_DIR"
yt-dlp "${ARGS[@]}" "$URL"

echo ""
echo "Done. Files saved to: $OUT_DIR"

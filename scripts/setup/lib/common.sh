#!/usr/bin/env bash
# ============================================================================
# common.sh — Shared utilities for OpenClaw setup scripts
# ============================================================================
# Logging, state tracking, progress indicators, error handling.
# Source this file; do not execute directly.
# ============================================================================
set -euo pipefail

# ── Guard against double-sourcing ───────────────────────────────────────────
[[ -n "${_OPENCLAW_COMMON_LOADED:-}" ]] && return 0
readonly _OPENCLAW_COMMON_LOADED=1

# ── Paths ───────────────────────────────────────────────────────────────────
readonly OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
readonly OPENCLAW_STATE_FILE="${OPENCLAW_HOME}/setup-state.json"
readonly OPENCLAW_SETUP_LOG="${OPENCLAW_HOME}/setup.log"

# ── Colors & Symbols ───────────────────────────────────────────────────────
if [[ -t 1 ]]; then
  readonly C_RED='\033[0;31m'
  readonly C_GREEN='\033[0;32m'
  readonly C_YELLOW='\033[1;33m'
  readonly C_BLUE='\033[0;34m'
  readonly C_CYAN='\033[0;36m'
  readonly C_MAGENTA='\033[0;35m'
  readonly C_BOLD='\033[1m'
  readonly C_DIM='\033[2m'
  readonly C_RESET='\033[0m'
  readonly SYM_OK='✓'
  readonly SYM_FAIL='✗'
  readonly SYM_SKIP='⊘'
  readonly SYM_ARROW='→'
  readonly SYM_GEAR='⚙'
  readonly SYM_WARN='⚠'
  readonly SYM_INFO='ℹ'
else
  readonly C_RED='' C_GREEN='' C_YELLOW='' C_BLUE='' C_CYAN=''
  readonly C_MAGENTA='' C_BOLD='' C_DIM='' C_RESET=''
  readonly SYM_OK='[OK]' SYM_FAIL='[FAIL]' SYM_SKIP='[SKIP]'
  readonly SYM_ARROW='->' SYM_GEAR='[*]' SYM_WARN='[!]' SYM_INFO='[i]'
fi

# ── Global flags (set by setup.sh) ─────────────────────────────────────────
DRY_RUN="${DRY_RUN:-false}"
FORCE="${FORCE:-false}"
VERBOSE="${VERBOSE:-false}"
SETUP_INTERACTIVE="${SETUP_INTERACTIVE:-true}"

# ── Logging ─────────────────────────────────────────────────────────────────

_ts() { date '+%Y-%m-%d %H:%M:%S'; }

_log_file() {
  mkdir -p "$(dirname "$OPENCLAW_SETUP_LOG")"
  echo "[$(_ts)] $*" >> "$OPENCLAW_SETUP_LOG" 2>/dev/null || true
}

log_info() {
  echo -e "${C_BLUE}${SYM_INFO}${C_RESET} $*"
  _log_file "INFO: $*"
}

log_ok() {
  echo -e "${C_GREEN}${SYM_OK}${C_RESET} $*"
  _log_file "OK: $*"
}

log_warn() {
  echo -e "${C_YELLOW}${SYM_WARN}${C_RESET} $*"
  _log_file "WARN: $*"
}

log_error() {
  echo -e "${C_RED}${SYM_FAIL}${C_RESET} $*" >&2
  _log_file "ERROR: $*"
}

log_step() {
  echo -e "\n${C_BOLD}${C_CYAN}${SYM_GEAR} $*${C_RESET}"
  _log_file "STEP: $*"
}

log_substep() {
  echo -e "  ${C_DIM}${SYM_ARROW}${C_RESET} $*"
  _log_file "  SUB: $*"
}

log_skip() {
  echo -e "${C_DIM}${SYM_SKIP} $* (already done)${C_RESET}"
  _log_file "SKIP: $*"
}

log_dry() {
  echo -e "${C_MAGENTA}[dry-run]${C_RESET} Would: $*"
  _log_file "DRY: $*"
}

log_verbose() {
  [[ "$VERBOSE" == "true" ]] && echo -e "${C_DIM}  $*${C_RESET}"
  _log_file "VERBOSE: $*"
}

die() {
  log_error "$@"
  exit 1
}

# ── State Management ───────────────────────────────────────────────────────
# State is stored as JSON: { "steps": { "<name>": { "done": true, "ts": "...", "os": "..." } } }

_ensure_state_file() {
  mkdir -p "$(dirname "$OPENCLAW_STATE_FILE")"
  if [[ ! -f "$OPENCLAW_STATE_FILE" ]]; then
    echo '{"version":1,"steps":{}}' > "$OPENCLAW_STATE_FILE"
  fi
}

# Check if a step has been completed
step_done() {
  local step_name="$1"
  _ensure_state_file
  if command -v jq &>/dev/null; then
    jq -e ".steps[\"$step_name\"].done == true" "$OPENCLAW_STATE_FILE" &>/dev/null
  else
    # Fallback: grep-based check (less robust but works without jq)
    grep -q "\"$step_name\".*\"done\".*true" "$OPENCLAW_STATE_FILE" 2>/dev/null
  fi
}

# Mark a step as completed
step_mark_done() {
  local step_name="$1"
  local detail="${2:-}"
  _ensure_state_file

  local ts
  ts="$(_ts)"
  local os_name="${DETECTED_OS:-unknown}"

  if command -v jq &>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    jq --arg name "$step_name" \
       --arg ts "$ts" \
       --arg os "$os_name" \
       --arg detail "$detail" \
       '.steps[$name] = {"done": true, "ts": $ts, "os": $os, "detail": $detail}' \
       "$OPENCLAW_STATE_FILE" > "$tmp" && mv "$tmp" "$OPENCLAW_STATE_FILE"
  else
    # Fallback: python-based JSON update
    python3 -c "
import json, sys
with open('$OPENCLAW_STATE_FILE', 'r') as f:
    data = json.load(f)
data.setdefault('steps', {})['$step_name'] = {
    'done': True, 'ts': '$ts', 'os': '$os_name', 'detail': '$detail'
}
with open('$OPENCLAW_STATE_FILE', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null || log_warn "Failed to persist step '$step_name' to state file"
  fi

  _log_file "MARK_DONE: $step_name ($detail)"
}

# Clear a step (re-run it)
step_clear() {
  local step_name="$1"
  _ensure_state_file

  if command -v jq &>/dev/null; then
    local tmp
    tmp="$(mktemp)"
    jq --arg name "$step_name" 'del(.steps[$name])' \
       "$OPENCLAW_STATE_FILE" > "$tmp" && mv "$tmp" "$OPENCLAW_STATE_FILE"
  else
    python3 -c "
import json
with open('$OPENCLAW_STATE_FILE', 'r') as f:
    data = json.load(f)
data.get('steps', {}).pop('$step_name', None)
with open('$OPENCLAW_STATE_FILE', 'w') as f:
    json.dump(data, f, indent=2)
" 2>/dev/null || true
  fi
}

# Clear all state
step_clear_all() {
  _ensure_state_file
  echo '{"version":1,"steps":{}}' > "$OPENCLAW_STATE_FILE"
  log_info "All setup state cleared"
}

# Show current state
step_show_state() {
  _ensure_state_file
  if command -v jq &>/dev/null; then
    jq '.steps | to_entries | sort_by(.value.ts) | .[] |
      "\(.value.ts // "?") | \(if .value.done then "✓" else "✗" end) | \(.key)\(if .value.detail != "" then " (\(.value.detail))" else "" end)"' \
      -r "$OPENCLAW_STATE_FILE"
  else
    python3 -c "
import json
with open('$OPENCLAW_STATE_FILE') as f:
    data = json.load(f)
for k, v in sorted(data.get('steps', {}).items(), key=lambda x: x[1].get('ts', '')):
    mark = '✓' if v.get('done') else '✗'
    detail = f\" ({v['detail']})\" if v.get('detail') else ''
    print(f\"{v.get('ts', '?')} | {mark} | {k}{detail}\")
" 2>/dev/null
  fi
}

# ── Run-or-skip pattern ────────────────────────────────────────────────────
# Usage: run_step "step_name" "Description" function_to_call [args...]
run_step() {
  local step_name="$1"
  local description="$2"
  shift 2

  log_step "$description"

  # Check if already done (unless --force)
  if [[ "$FORCE" != "true" ]] && step_done "$step_name"; then
    log_skip "$description"
    return 0
  fi

  if [[ "$DRY_RUN" == "true" ]]; then
    log_dry "$description"
    return 0
  fi

  # Run the step function
  if "$@"; then
    step_mark_done "$step_name" "$description"
    log_ok "$description"
    return 0
  else
    local rc=$?
    log_error "$description failed (exit code $rc)"
    log_error "Fix the issue and re-run setup.sh to resume from this step."
    return $rc
  fi
}

# ── Utility Functions ──────────────────────────────────────────────────────

# Check if a command exists
has_cmd() {
  command -v "$1" &>/dev/null
}

# Get minimum version compare: returns 0 if $1 >= $2
version_gte() {
  local have="$1" need="$2"
  # Use sort -V for version comparison
  printf '%s\n%s\n' "$need" "$have" | sort -V | head -n1 | grep -qx "$need"
}

# Retry a command with exponential backoff
retry() {
  local max_attempts="${1:-3}"
  local delay="${2:-2}"
  shift 2
  local attempt=1

  while true; do
    if "$@"; then
      return 0
    fi
    if (( attempt >= max_attempts )); then
      log_error "Command failed after $max_attempts attempts: $*"
      return 1
    fi
    log_warn "Attempt $attempt/$max_attempts failed, retrying in ${delay}s..."
    sleep "$delay"
    (( attempt++ ))
    (( delay *= 2 ))
  done
}

# Prompt for yes/no (default yes)
confirm() {
  local msg="${1:-Continue?}"
  if [[ "$SETUP_INTERACTIVE" != "true" ]]; then
    return 0  # Non-interactive: assume yes
  fi
  read -r -p "$(echo -e "${C_YELLOW}?${C_RESET} ${msg} [Y/n] ")" response
  [[ -z "$response" || "$response" =~ ^[Yy] ]]
}

# Ensure a directory exists
ensure_dir() {
  local dir="$1"
  if [[ ! -d "$dir" ]]; then
    log_substep "Creating directory: $dir"
    mkdir -p "$dir"
  fi
}

# Run a command, capturing output (for verbose)
run_cmd() {
  log_verbose "Running: $*"
  if [[ "$VERBOSE" == "true" ]]; then
    "$@" 2>&1 | tee -a "$OPENCLAW_SETUP_LOG"
  else
    "$@" >> "$OPENCLAW_SETUP_LOG" 2>&1
  fi
}

# Run with sudo when needed, prompting cleanly
sudo_run() {
  if [[ $EUID -eq 0 ]]; then
    "$@"
  else
    log_substep "Requires sudo: $*"
    sudo "$@"
  fi
}

# ── Progress Bar ───────────────────────────────────────────────────────────

_PROGRESS_TOTAL=0
_PROGRESS_CURRENT=0

progress_init() {
  _PROGRESS_TOTAL="$1"
  _PROGRESS_CURRENT=0
}

progress_tick() {
  (( _PROGRESS_CURRENT++ )) || true
  local pct=$(( _PROGRESS_CURRENT * 100 / _PROGRESS_TOTAL ))
  local bar_len=30
  local filled=$(( pct * bar_len / 100 ))
  local empty=$(( bar_len - filled ))
  local bar
  bar="$(printf '%0.s█' $(seq 1 $filled 2>/dev/null) 2>/dev/null || true)"
  bar+="$(printf '%0.s░' $(seq 1 $empty 2>/dev/null) 2>/dev/null || true)"
  printf "\r  ${C_CYAN}[%s]${C_RESET} %3d%% (%d/%d) %s" \
    "$bar" "$pct" "$_PROGRESS_CURRENT" "$_PROGRESS_TOTAL" "${1:-}"
  if (( _PROGRESS_CURRENT >= _PROGRESS_TOTAL )); then
    echo ""  # Final newline
  fi
}

# ── Banner ─────────────────────────────────────────────────────────────────

print_banner() {
  echo -e "${C_BOLD}${C_CYAN}"
  cat << 'BANNER'
   ___                    ____ _                
  / _ \ _ __   ___ _ __  / ___| | __ ___      __
 | | | | '_ \ / _ \ '_ \| |   | |/ _` \ \ /\ / /
 | |_| | |_) |  __/ | | | |___| | (_| |\ V  V / 
  \___/| .__/ \___|_| |_|\____|_|\__,_| \_/\_/  
       |_|                                        
BANNER
  echo -e "${C_RESET}"
  echo -e "  ${C_DIM}Host Setup • Progressive • Resumable${C_RESET}"
  echo ""
}

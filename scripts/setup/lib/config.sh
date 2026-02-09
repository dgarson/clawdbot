#!/usr/bin/env bash
# ============================================================================
# config.sh — OpenClaw configuration initialization
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_CONFIG_LOADED:-}" ]] && return 0
readonly _OPENCLAW_CONFIG_LOADED=1

# ── Repository Setup ─────────────────────────────────────────────────────

OPENCLAW_REPO_DIR="${OPENCLAW_REPO_DIR:-}"

detect_repo() {
  # Try to find the repo in common locations
  local -a search_paths=(
    "$HOME/clawd/clawdbot"
    "$HOME/clawd/openclaw"
    "$HOME/openclaw"
    "$HOME/clawdbot"
    "$HOME/dev/openclaw"
    "$HOME/dev/clawdbot"
  )

  # If running from within the repo, use that
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  if [[ -f "${script_dir}/package.json" ]] && grep -q '"openclaw"' "${script_dir}/package.json" 2>/dev/null; then
    OPENCLAW_REPO_DIR="$script_dir"
    log_substep "Repo detected (script location): $OPENCLAW_REPO_DIR"
    return 0
  fi

  for path in "${search_paths[@]}"; do
    if [[ -f "${path}/package.json" ]] && grep -q '"openclaw"' "${path}/package.json" 2>/dev/null; then
      OPENCLAW_REPO_DIR="$path"
      log_substep "Repo detected: $OPENCLAW_REPO_DIR"
      return 0
    fi
  done

  log_warn "OpenClaw repository not found in standard locations"
  OPENCLAW_REPO_DIR=""
  return 1
}

clone_repo() {
  if [[ -n "$OPENCLAW_REPO_DIR" ]] && [[ -d "$OPENCLAW_REPO_DIR/.git" ]]; then
    log_substep "Repo already exists at $OPENCLAW_REPO_DIR"

    # Update to latest
    log_substep "Pulling latest changes..."
    (cd "$OPENCLAW_REPO_DIR" && git pull --ff-only 2>/dev/null) || log_warn "git pull failed (non-fatal)"
    return 0
  fi

  local target="${OPENCLAW_REPO_DIR:-$HOME/openclaw}"
  OPENCLAW_REPO_DIR="$target"

  log_substep "Cloning OpenClaw repository to $target..."
  git clone https://github.com/openclaw/clawdbrain.git "$target"

  log_substep "Repository cloned to $target"
}

# ── Build the project ────────────────────────────────────────────────────

build_project() {
  if [[ -z "$OPENCLAW_REPO_DIR" ]] || [[ ! -d "$OPENCLAW_REPO_DIR" ]]; then
    die "No repo directory set — cannot build"
  fi

  cd "$OPENCLAW_REPO_DIR"

  # Install Node dependencies
  log_substep "Installing Node dependencies (pnpm install)..."
  pnpm install --frozen-lockfile 2>&1 | tail -n5

  # Build the project
  log_substep "Building OpenClaw (pnpm build)..."
  OPENCLAW_A2UI_SKIP_MISSING=1 pnpm build 2>&1 | tail -n5

  # Build UI
  log_substep "Building UI (pnpm ui:build)..."
  OPENCLAW_PREFER_PNPM=1 pnpm ui:build 2>&1 | tail -n5

  log_substep "Build complete"
}

# ── OpenClaw Configuration ───────────────────────────────────────────────

initialize_config() {
  ensure_dir "$OPENCLAW_HOME"
  ensure_dir "${OPENCLAW_HOME}/workspace"
  ensure_dir "${OPENCLAW_HOME}/logs"
  ensure_dir "${OPENCLAW_HOME}/services"

  # Generate gateway token if not exists
  local token_file="${OPENCLAW_HOME}/.gateway-token"
  if [[ ! -f "$token_file" ]]; then
    local token
    if has_cmd openssl; then
      token="$(openssl rand -hex 32)"
    else
      token="$(python3 -c 'import secrets; print(secrets.token_hex(32))')"
    fi
    echo "$token" > "$token_file"
    chmod 600 "$token_file"
    log_substep "Generated gateway token (saved to $token_file)"
  else
    log_substep "Gateway token already exists"
  fi

  # Create .env file for the repo
  if [[ -n "$OPENCLAW_REPO_DIR" ]] && [[ -d "$OPENCLAW_REPO_DIR" ]]; then
    local env_file="${OPENCLAW_REPO_DIR}/.env"
    if [[ ! -f "$env_file" ]] && [[ -f "${OPENCLAW_REPO_DIR}/openclaw.env.example" ]]; then
      cp "${OPENCLAW_REPO_DIR}/openclaw.env.example" "$env_file"
      log_substep "Created .env from example template"
    fi
  fi

  # Write setup metadata
  local metadata_file="${OPENCLAW_HOME}/setup-metadata.json"
  if has_cmd jq; then
    jq -n \
      --arg os "$DETECTED_OS" \
      --arg distro "$DETECTED_DISTRO" \
      --arg distro_ver "$DETECTED_DISTRO_VER" \
      --arg arch "$DETECTED_ARCH_NORM" \
      --arg gpu "$HAS_GPU" \
      --arg gpu_model "${GPU_MODEL:-none}" \
      --arg setup_ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      --arg repo "$OPENCLAW_REPO_DIR" \
      '{os: $os, distro: $distro, distro_version: $distro_ver, arch: $arch,
        gpu: ($gpu == "true"), gpu_model: $gpu_model, setup_timestamp: $setup_ts,
        repo_dir: $repo}' \
      > "$metadata_file"
  else
    python3 -c "
import json
data = {
    'os': '$DETECTED_OS',
    'distro': '$DETECTED_DISTRO',
    'distro_version': '$DETECTED_DISTRO_VER',
    'arch': '$DETECTED_ARCH_NORM',
    'gpu': $([[ "$HAS_GPU" == "true" ]] && echo 'True' || echo 'False'),
    'gpu_model': '${GPU_MODEL:-none}',
    'setup_timestamp': '$(date -u +%Y-%m-%dT%H:%M:%SZ)',
    'repo_dir': '$OPENCLAW_REPO_DIR'
}
with open('$metadata_file', 'w') as f:
    json.dump(data, f, indent=2)
"
  fi

  log_substep "Configuration initialized at $OPENCLAW_HOME"
}

# ── Shell profile integration ────────────────────────────────────────────

setup_shell_profile() {
  local profile_snippet='
# OpenClaw
export OPENCLAW_HOME="${OPENCLAW_HOME:-$HOME/.openclaw}"
export PATH="${OPENCLAW_HOME}/venv/bin:${PATH}"
'

  local -a profile_files=()

  case "$DETECTED_OS" in
    macos)
      profile_files=("$HOME/.zshrc" "$HOME/.bash_profile")
      ;;
    linux)
      profile_files=("$HOME/.bashrc" "$HOME/.profile")
      [[ -f "$HOME/.zshrc" ]] && profile_files+=("$HOME/.zshrc")
      ;;
  esac

  for profile in "${profile_files[@]}"; do
    if [[ -f "$profile" ]] && grep -q 'OPENCLAW_HOME' "$profile" 2>/dev/null; then
      log_verbose "OpenClaw already in $profile"
      continue
    fi

    if [[ -f "$profile" ]]; then
      echo "$profile_snippet" >> "$profile"
      log_substep "Added OpenClaw env to $profile"
    fi
  done
}

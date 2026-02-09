#!/usr/bin/env bash
# ============================================================================
# node-setup.sh — Node.js, pnpm, and Bun installation
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_NODE_SETUP_LOADED:-}" ]] && return 0
readonly _OPENCLAW_NODE_SETUP_LOADED=1

readonly REQUIRED_NODE_VERSION="22.12.0"
readonly REQUIRED_PNPM_VERSION="10.0.0"

# ── Node.js ────────────────────────────────────────────────────────────────

_get_node_version() {
  node --version 2>/dev/null | sed 's/^v//' || echo "0.0.0"
}

install_node() {
  local current_version
  current_version="$(_get_node_version)"

  if has_cmd node && version_gte "$current_version" "$REQUIRED_NODE_VERSION"; then
    log_substep "Node.js already installed: v${current_version} (>= ${REQUIRED_NODE_VERSION})"
    return 0
  fi

  if has_cmd node; then
    log_substep "Node.js v${current_version} is too old (need >= ${REQUIRED_NODE_VERSION})"
  fi

  case "$DETECTED_OS" in
    macos)
      _install_node_macos
      ;;
    linux)
      _install_node_linux
      ;;
  esac

  # Verify
  current_version="$(_get_node_version)"
  if ! version_gte "$current_version" "$REQUIRED_NODE_VERSION"; then
    die "Node.js installation failed: got v${current_version}, need >= v${REQUIRED_NODE_VERSION}"
  fi

  log_substep "Node.js v${current_version} installed successfully"
}

_install_node_macos() {
  if has_cmd brew; then
    log_substep "Installing Node.js 22 via Homebrew..."
    brew install node@22
    brew link --overwrite node@22 2>/dev/null || true
  else
    _install_node_via_nvm
  fi
}

_install_node_linux() {
  # Use NodeSource repository for latest Node 22
  log_substep "Installing Node.js 22 via NodeSource..."

  # Check if NodeSource repo already configured
  if [[ -f /etc/apt/sources.list.d/nodesource.list ]] || \
     [[ -d /usr/share/keyrings ]] && ls /usr/share/keyrings/nodesource* &>/dev/null; then
    log_verbose "NodeSource repo already configured"
  else
    curl -fsSL https://deb.nodesource.com/setup_22.x | sudo_run bash -
  fi

  sudo_run apt-get install -y --no-install-recommends nodejs

  # Also install corepack
  if has_cmd corepack; then
    log_verbose "corepack already available"
  fi
}

_install_node_via_nvm() {
  log_substep "Installing Node.js via nvm (fallback)..."

  if [[ ! -d "${NVM_DIR:-$HOME/.nvm}" ]]; then
    curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
  fi

  export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
  # shellcheck source=/dev/null
  [[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh"

  nvm install 22
  nvm use 22
  nvm alias default 22
}

# ── pnpm ───────────────────────────────────────────────────────────────────

_get_pnpm_version() {
  pnpm --version 2>/dev/null || echo "0.0.0"
}

install_pnpm() {
  # First, enable corepack (ships with Node 22+)
  if has_cmd corepack; then
    log_substep "Enabling corepack..."
    corepack enable 2>/dev/null || sudo_run corepack enable 2>/dev/null || true
  fi

  local current_version
  current_version="$(_get_pnpm_version)"

  if has_cmd pnpm && version_gte "$current_version" "$REQUIRED_PNPM_VERSION"; then
    log_substep "pnpm already installed: v${current_version}"
    return 0
  fi

  log_substep "Installing pnpm..."

  # Try corepack first (preferred)
  if has_cmd corepack; then
    corepack prepare pnpm@latest --activate 2>/dev/null || true
  fi

  # Verify, fallback to npm install
  if ! has_cmd pnpm; then
    npm install -g pnpm@latest
  fi

  current_version="$(_get_pnpm_version)"
  if ! has_cmd pnpm; then
    die "pnpm installation failed"
  fi

  log_substep "pnpm v${current_version} installed successfully"
}

# ── Bun ────────────────────────────────────────────────────────────────────

install_bun() {
  if has_cmd bun; then
    log_substep "Bun already installed: $(bun --version 2>/dev/null)"
    return 0
  fi

  log_substep "Installing Bun..."
  curl -fsSL https://bun.sh/install | bash

  # Ensure bun is on PATH for this session
  export BUN_INSTALL="${BUN_INSTALL:-$HOME/.bun}"
  export PATH="$BUN_INSTALL/bin:$PATH"

  if ! has_cmd bun; then
    die "Bun installation failed — 'bun' not found on PATH"
  fi

  log_substep "Bun $(bun --version 2>/dev/null) installed successfully"
}

# ── Verify all JS toolchain ───────────────────────────────────────────────

verify_js_toolchain() {
  local ok=true

  if ! has_cmd node; then
    log_error "node not found"
    ok=false
  else
    log_substep "node: v$(_get_node_version)"
  fi

  if ! has_cmd pnpm; then
    log_error "pnpm not found"
    ok=false
  else
    log_substep "pnpm: v$(_get_pnpm_version)"
  fi

  if ! has_cmd bun; then
    log_warn "bun not found (optional but recommended)"
  else
    log_substep "bun: v$(bun --version 2>/dev/null)"
  fi

  [[ "$ok" == "true" ]]
}

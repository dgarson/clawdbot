#!/usr/bin/env bash
# ============================================================================
# packages-macos.sh — macOS-specific package installation via Homebrew
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_PACKAGES_MACOS_LOADED:-}" ]] && return 0
readonly _OPENCLAW_PACKAGES_MACOS_LOADED=1

# ── Xcode Command Line Tools ──────────────────────────────────────────────

install_xcode_cli_tools() {
  if xcode-select -p &>/dev/null; then
    log_substep "Xcode CLI tools already installed"
    return 0
  fi

  log_substep "Installing Xcode Command Line Tools..."
  log_substep "A dialog may appear — click 'Install' to proceed"

  # Trigger the install dialog
  xcode-select --install 2>/dev/null || true

  # Wait for installation (the dialog is async)
  local max_wait=600  # 10 minutes
  local waited=0
  while ! xcode-select -p &>/dev/null; do
    if (( waited >= max_wait )); then
      die "Xcode CLI tools installation timed out after ${max_wait}s. Please install manually and re-run."
    fi
    sleep 5
    (( waited += 5 ))
    log_verbose "Waiting for Xcode CLI tools... (${waited}s)"
  done

  log_substep "Xcode CLI tools installed successfully"
}

# ── Homebrew ───────────────────────────────────────────────────────────────

install_homebrew() {
  if has_cmd brew; then
    log_substep "Homebrew already installed: $(brew --version | head -n1)"

    # Update Homebrew (non-fatal)
    log_substep "Updating Homebrew..."
    brew update 2>/dev/null || log_warn "brew update failed (non-fatal)"
    return 0
  fi

  log_substep "Installing Homebrew..."
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

  # Ensure brew is on PATH for the rest of this session
  if [[ -f /opt/homebrew/bin/brew ]]; then
    eval "$(/opt/homebrew/bin/brew shellenv)"
  elif [[ -f /usr/local/bin/brew ]]; then
    eval "$(/usr/local/bin/brew shellenv)"
  fi

  if ! has_cmd brew; then
    die "Homebrew installation succeeded but 'brew' not found on PATH"
  fi

  log_substep "Homebrew installed: $(brew --version | head -n1)"
}

# ── Core packages (macOS) ─────────────────────────────────────────────────

install_packages_macos_core() {
  log_substep "Installing core packages via Homebrew..."

  local -a to_install=()

  for pkg in "${CORE_PACKAGES[@]}"; do
    local brew_pkg="$pkg"
    # Map generic names to Homebrew formula names
    case "$pkg" in
      openssl) brew_pkg="openssl@3" ;;
    esac

    if brew list "$brew_pkg" &>/dev/null; then
      log_verbose "Already installed: $brew_pkg"
    else
      to_install+=("$brew_pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    log_substep "Installing: ${to_install[*]}"
    brew install "${to_install[@]}"
  else
    log_substep "All core packages already present"
  fi
}

# ── Extra packages (macOS) ─────────────────────────────────────────────────

install_packages_macos_extra() {
  log_substep "Installing extra packages via Homebrew..."

  local -a to_install=()

  for pkg in "${EXTRA_PACKAGES[@]}"; do
    local brew_pkg="$pkg"
    case "$pkg" in
      fd-find) brew_pkg="fd" ;;
    esac

    if brew list "$brew_pkg" &>/dev/null; then
      log_verbose "Already installed: $brew_pkg"
    else
      to_install+=("$brew_pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    log_substep "Installing: ${to_install[*]}"
    brew install "${to_install[@]}" || log_warn "Some extra packages failed to install (non-fatal)"
  else
    log_substep "All extra packages already present"
  fi
}

# ── macOS-specific extras ──────────────────────────────────────────────────

install_macos_extras() {
  # ffmpeg (for video processing pipelines)
  if ! brew list ffmpeg &>/dev/null; then
    log_substep "Installing ffmpeg..."
    brew install ffmpeg
  fi

  # Playwright system deps aren't needed on macOS (bundled with the npm package)
  log_substep "macOS extras complete"
}

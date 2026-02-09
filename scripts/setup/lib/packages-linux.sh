#!/usr/bin/env bash
# ============================================================================
# packages-linux.sh — Linux/Ubuntu package installation via apt
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_PACKAGES_LINUX_LOADED:-}" ]] && return 0
readonly _OPENCLAW_PACKAGES_LINUX_LOADED=1

# ── Build essentials ───────────────────────────────────────────────────────

install_build_essential() {
  log_substep "Installing build tools..."

  local -a to_install=()

  for pkg in "${BUILD_DEPS_LINUX[@]}"; do
    if dpkg -s "$pkg" &>/dev/null; then
      log_verbose "Already installed: $pkg"
    else
      to_install+=("$pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    sudo_run apt-get update -qq
    sudo_run apt-get install -y --no-install-recommends "${to_install[@]}"
  else
    log_substep "All build dependencies already present"
  fi
}

# ── apt update ─────────────────────────────────────────────────────────────

update_apt() {
  log_substep "Updating apt package lists..."
  sudo_run apt-get update -qq

  # Ensure apt-transport-https and friends
  sudo_run apt-get install -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    gnupg \
    lsb-release \
    software-properties-common
}

# ── Core packages (Linux) ─────────────────────────────────────────────────

install_packages_linux_core() {
  log_substep "Installing core packages via apt..."

  local -a to_install=()

  for pkg in "${CORE_PACKAGES[@]}"; do
    local apt_pkg="$pkg"
    case "$pkg" in
      openssl) apt_pkg="openssl" ;;
    esac

    if dpkg -s "$apt_pkg" &>/dev/null; then
      log_verbose "Already installed: $apt_pkg"
    else
      to_install+=("$apt_pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    log_substep "Installing: ${to_install[*]}"
    sudo_run apt-get install -y --no-install-recommends "${to_install[@]}"
  else
    log_substep "All core packages already present"
  fi
}

# ── Extra packages (Linux) ─────────────────────────────────────────────────

install_packages_linux_extra() {
  log_substep "Installing extra packages via apt..."

  local -a to_install=()

  for pkg in "${EXTRA_PACKAGES[@]}"; do
    local apt_pkg="$pkg"
    case "$pkg" in
      ripgrep) apt_pkg="ripgrep" ;;
      fd-find) apt_pkg="fd-find" ;;
      gh)
        # GitHub CLI needs its own repo
        if ! has_cmd gh; then
          _install_gh_cli_linux
        fi
        continue
        ;;
    esac

    if dpkg -s "$apt_pkg" &>/dev/null; then
      log_verbose "Already installed: $apt_pkg"
    else
      to_install+=("$apt_pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    log_substep "Installing: ${to_install[*]}"
    sudo_run apt-get install -y --no-install-recommends "${to_install[@]}" \
      || log_warn "Some extra packages failed to install (non-fatal)"
  else
    log_substep "All extra packages already present"
  fi
}

# ── GitHub CLI (Linux) ─────────────────────────────────────────────────────

_install_gh_cli_linux() {
  if has_cmd gh; then
    log_verbose "GitHub CLI already installed"
    return 0
  fi

  log_substep "Installing GitHub CLI..."

  # Official GitHub CLI install method
  local keyring="/usr/share/keyrings/githubcli-archive-keyring.gpg"
  if [[ ! -f "$keyring" ]]; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | sudo_run tee "$keyring" > /dev/null
    sudo_run chmod go+r "$keyring"
  fi

  local sources_file="/etc/apt/sources.list.d/github-cli.list"
  if [[ ! -f "$sources_file" ]]; then
    echo "deb [arch=$(dpkg --print-architecture) signed-by=$keyring] https://cli.github.com/packages stable main" \
      | sudo_run tee "$sources_file" > /dev/null
    sudo_run apt-get update -qq
  fi

  sudo_run apt-get install -y --no-install-recommends gh
}

# ── Linux-specific extras ─────────────────────────────────────────────────

install_linux_extras() {
  local -a extras=(
    ffmpeg          # Video/audio processing
    libvips-dev     # Sharp (image processing) native dependency
    pciutils        # lspci for GPU detection
  )

  # Playwright system dependencies
  local -a playwright_deps=(
    libnss3
    libnspr4
    libatk1.0-0t64
    libatk-bridge2.0-0t64
    libcups2t64
    libdrm2
    libdbus-1-3
    libxkbcommon0
    libatspi2.0-0t64
    libxcomposite1
    libxdamage1
    libxfixes3
    libxrandr2
    libgbm1
    libpango-1.0-0
    libasound2t64
  )

  # Combine and filter already-installed
  local -a to_install=()
  for pkg in "${extras[@]}" "${playwright_deps[@]}"; do
    if ! dpkg -s "$pkg" &>/dev/null; then
      to_install+=("$pkg")
    fi
  done

  if (( ${#to_install[@]} > 0 )); then
    log_substep "Installing Linux extras + Playwright deps: ${#to_install[@]} packages"
    sudo_run apt-get install -y --no-install-recommends "${to_install[@]}" \
      || log_warn "Some extra packages failed (non-fatal, may need Ubuntu 24+ for some)"
  fi
}

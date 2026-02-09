#!/usr/bin/env bash
# ============================================================================
# packages.sh — Shared package installation orchestration
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_PACKAGES_LOADED:-}" ]] && return 0
readonly _OPENCLAW_PACKAGES_LOADED=1

# ── Core packages required on all platforms ────────────────────────────────
# These are the minimum tools needed for OpenClaw to function.
readonly -a CORE_PACKAGES=(
  git
  curl
  wget
  jq
  openssl
  unzip
  rsync
)

# Additional tools that are nice-to-have
readonly -a EXTRA_PACKAGES=(
  htop
  tree
  ripgrep
  fd-find      # fd on macOS, fd-find on Ubuntu
  gh           # GitHub CLI
  tmux
)

# ── Build dependencies ─────────────────────────────────────────────────────
readonly -a BUILD_DEPS_LINUX=(
  build-essential
  gcc
  g++
  make
  cmake
  pkg-config
  libssl-dev
  libffi-dev
  zlib1g-dev
  libbz2-dev
  libreadline-dev
  libsqlite3-dev
  libncurses-dev
  liblzma-dev
  libgdbm-dev
  libgdbm-compat-dev
  tk-dev
  uuid-dev
)

# ── Install core packages (delegates to OS-specific) ──────────────────────

install_build_tools() {
  case "$DETECTED_OS" in
    macos)  install_xcode_cli_tools ;;
    linux)  install_build_essential ;;
  esac
}

install_package_manager() {
  case "$DETECTED_OS" in
    macos)  install_homebrew ;;
    linux)  update_apt ;;
  esac
}

install_core_packages() {
  case "$DETECTED_OS" in
    macos)  install_packages_macos_core ;;
    linux)  install_packages_linux_core ;;
  esac
}

install_extra_packages() {
  case "$DETECTED_OS" in
    macos)  install_packages_macos_extra ;;
    linux)  install_packages_linux_extra ;;
  esac
}

# ── Verification helpers ───────────────────────────────────────────────────

verify_core_packages() {
  local missing=()
  for pkg in "${CORE_PACKAGES[@]}"; do
    local cmd="$pkg"
    # Map package names to actual commands
    case "$pkg" in
      openssl) cmd="openssl" ;;
      *)       cmd="$pkg" ;;
    esac
    if ! has_cmd "$cmd"; then
      missing+=("$pkg")
    fi
  done

  if (( ${#missing[@]} > 0 )); then
    log_warn "Missing core tools: ${missing[*]}"
    return 1
  fi
  return 0
}

#!/usr/bin/env bash
# ============================================================================
# detect.sh — OS, architecture, and capability detection
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_DETECT_LOADED:-}" ]] && return 0
readonly _OPENCLAW_DETECT_LOADED=1

# Exported after detection
DETECTED_OS=""          # "macos" | "linux"
DETECTED_DISTRO=""      # "ubuntu" | "debian" | "fedora" | "arch" | "unknown"
DETECTED_DISTRO_VER=""  # e.g. "24.04"
DETECTED_ARCH=""        # "x86_64" | "arm64" | "aarch64"
DETECTED_ARCH_NORM=""   # Normalized: "amd64" | "arm64"
HAS_GPU=false           # true if NVIDIA GPU detected
GPU_MODEL=""            # e.g. "NVIDIA GeForce RTX 5090"
HAS_DOCKER=false
HAS_SUDO=false

detect_os() {
  local uname_s
  uname_s="$(uname -s)"

  case "$uname_s" in
    Darwin)
      DETECTED_OS="macos"
      DETECTED_DISTRO="macos"
      DETECTED_DISTRO_VER="$(sw_vers -productVersion 2>/dev/null || echo 'unknown')"
      ;;
    Linux)
      DETECTED_OS="linux"
      if [[ -f /etc/os-release ]]; then
        # shellcheck source=/dev/null
        . /etc/os-release
        DETECTED_DISTRO="${ID:-unknown}"
        DETECTED_DISTRO_VER="${VERSION_ID:-unknown}"
      elif [[ -f /etc/lsb-release ]]; then
        # shellcheck source=/dev/null
        . /etc/lsb-release
        DETECTED_DISTRO="${DISTRIB_ID,,}"
        DETECTED_DISTRO_VER="${DISTRIB_RELEASE:-unknown}"
      else
        DETECTED_DISTRO="unknown"
        DETECTED_DISTRO_VER="unknown"
      fi
      ;;
    *)
      die "Unsupported operating system: $uname_s"
      ;;
  esac
}

detect_arch() {
  DETECTED_ARCH="$(uname -m)"

  case "$DETECTED_ARCH" in
    x86_64|amd64)   DETECTED_ARCH_NORM="amd64" ;;
    arm64|aarch64)   DETECTED_ARCH_NORM="arm64" ;;
    *)               DETECTED_ARCH_NORM="$DETECTED_ARCH" ;;
  esac
}

detect_gpu() {
  HAS_GPU=false
  GPU_MODEL=""

  if [[ "$DETECTED_OS" == "linux" ]]; then
    # Check for NVIDIA GPU via lspci
    if has_cmd lspci; then
      local gpu_line
      gpu_line="$(lspci 2>/dev/null | grep -i 'vga\|3d\|display' | grep -i nvidia | head -n1 || true)"
      if [[ -n "$gpu_line" ]]; then
        HAS_GPU=true
        GPU_MODEL="$(echo "$gpu_line" | sed 's/.*: //')"
      fi
    fi

    # Also check nvidia-smi
    if has_cmd nvidia-smi; then
      HAS_GPU=true
      GPU_MODEL="${GPU_MODEL:-$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -n1 || echo 'NVIDIA GPU')}"
    fi
  elif [[ "$DETECTED_OS" == "macos" ]]; then
    # macOS doesn't have NVIDIA GPUs in modern hardware, but check anyway
    if system_profiler SPDisplaysDataType 2>/dev/null | grep -qi nvidia; then
      HAS_GPU=true
      GPU_MODEL="$(system_profiler SPDisplaysDataType 2>/dev/null | grep 'Chipset Model' | head -n1 | sed 's/.*: //' || echo 'NVIDIA GPU')"
    fi
  fi
}

detect_docker() {
  HAS_DOCKER=false
  if has_cmd docker && docker info &>/dev/null; then
    HAS_DOCKER=true
  fi
}

detect_sudo() {
  HAS_SUDO=false
  if [[ $EUID -eq 0 ]]; then
    HAS_SUDO=true
  elif has_cmd sudo; then
    # Test if sudo is available without a password (or with cached creds)
    if sudo -n true 2>/dev/null; then
      HAS_SUDO=true
    else
      # We can ask for password interactively
      HAS_SUDO=true
    fi
  fi
}

# Run all detection and report
run_detection() {
  log_step "Detecting environment"

  detect_os
  detect_arch
  detect_gpu
  detect_docker
  detect_sudo

  log_substep "OS:       ${C_BOLD}${DETECTED_OS}${C_RESET} (${DETECTED_DISTRO} ${DETECTED_DISTRO_VER})"
  log_substep "Arch:     ${C_BOLD}${DETECTED_ARCH}${C_RESET} (${DETECTED_ARCH_NORM})"

  if [[ "$HAS_GPU" == "true" ]]; then
    log_substep "GPU:      ${C_GREEN}${GPU_MODEL}${C_RESET}"
  else
    log_substep "GPU:      ${C_DIM}None detected${C_RESET}"
  fi

  log_substep "Docker:   $(if [[ "$HAS_DOCKER" == "true" ]]; then echo "${C_GREEN}available${C_RESET}"; else echo "${C_DIM}not found${C_RESET}"; fi)"
  log_substep "Sudo:     $(if [[ "$HAS_SUDO" == "true" ]]; then echo "${C_GREEN}available${C_RESET}"; else echo "${C_DIM}not available${C_RESET}"; fi)"

  # Validate supported configurations
  case "${DETECTED_OS}:${DETECTED_DISTRO}" in
    macos:macos)
      log_ok "macOS detected — using Homebrew-based setup"
      ;;
    linux:ubuntu|linux:debian)
      log_ok "Debian/Ubuntu detected — using apt-based setup"
      ;;
    linux:fedora|linux:rhel|linux:centos|linux:rocky|linux:almalinux)
      log_warn "RHEL-family detected — apt steps will be skipped, manual package install may be needed"
      ;;
    linux:arch|linux:manjaro)
      log_warn "Arch-family detected — apt steps will be skipped, manual package install may be needed"
      ;;
    *)
      log_warn "Untested OS/distro: ${DETECTED_OS}/${DETECTED_DISTRO} — proceeding with best effort"
      ;;
  esac

  step_mark_done "os_detected" "${DETECTED_OS}/${DETECTED_DISTRO} ${DETECTED_DISTRO_VER} (${DETECTED_ARCH_NORM})"
}

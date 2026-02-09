#!/usr/bin/env bash
# ============================================================================
# gpu-setup.sh — NVIDIA GPU driver and CUDA toolkit installation (Linux only)
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_GPU_SETUP_LOADED:-}" ]] && return 0
readonly _OPENCLAW_GPU_SETUP_LOADED=1

# ── NVIDIA Driver Check ───────────────────────────────────────────────────

_nvidia_driver_installed() {
  has_cmd nvidia-smi && nvidia-smi &>/dev/null
}

_cuda_installed() {
  has_cmd nvcc || [[ -d /usr/local/cuda ]]
}

# ── NVIDIA Drivers ─────────────────────────────────────────────────────────

install_nvidia_drivers() {
  if [[ "$DETECTED_OS" != "linux" ]]; then
    log_substep "NVIDIA driver installation only applies to Linux — skipping"
    return 0
  fi

  if [[ "$HAS_GPU" != "true" ]]; then
    log_substep "No NVIDIA GPU detected — skipping driver installation"
    return 0
  fi

  if _nvidia_driver_installed; then
    local driver_ver
    driver_ver="$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -n1)"
    log_substep "NVIDIA driver already installed: v${driver_ver}"
    return 0
  fi

  log_substep "Installing NVIDIA drivers..."

  case "$DETECTED_DISTRO" in
    ubuntu|debian)
      _install_nvidia_drivers_ubuntu
      ;;
    *)
      log_warn "Automatic NVIDIA driver installation not supported for $DETECTED_DISTRO"
      log_warn "Please install drivers manually and re-run setup"
      return 1
      ;;
  esac
}

_install_nvidia_drivers_ubuntu() {
  # Use the ubuntu-drivers utility for automatic selection
  if ! has_cmd ubuntu-drivers; then
    sudo_run apt-get install -y --no-install-recommends ubuntu-drivers-common
  fi

  log_substep "Detecting recommended driver..."
  local recommended
  recommended="$(ubuntu-drivers devices 2>/dev/null | grep 'recommended' | head -n1 | awk '{print $3}' || true)"

  if [[ -n "$recommended" ]]; then
    log_substep "Installing recommended driver: $recommended"
    sudo_run apt-get install -y --no-install-recommends "$recommended"
  else
    # Fallback: install latest nvidia-driver
    log_substep "No recommendation found, installing nvidia-driver-570..."
    sudo_run apt-get install -y --no-install-recommends nvidia-driver-570
  fi

  log_warn "A REBOOT may be required for the NVIDIA driver to take effect."
  log_warn "After reboot, re-run this setup script to continue from where it left off."
}

# ── CUDA Toolkit ───────────────────────────────────────────────────────────

install_cuda_toolkit() {
  if [[ "$DETECTED_OS" != "linux" ]]; then
    log_substep "CUDA installation only applies to Linux — skipping"
    return 0
  fi

  if [[ "$HAS_GPU" != "true" ]]; then
    log_substep "No NVIDIA GPU detected — skipping CUDA"
    return 0
  fi

  if _cuda_installed; then
    local cuda_ver
    cuda_ver="$(nvcc --version 2>/dev/null | grep 'release' | sed 's/.*release //' | sed 's/,.*//' || echo 'unknown')"
    log_substep "CUDA toolkit already installed: v${cuda_ver}"
    return 0
  fi

  log_substep "Installing CUDA toolkit..."

  case "$DETECTED_DISTRO" in
    ubuntu|debian)
      _install_cuda_ubuntu
      ;;
    *)
      log_warn "Automatic CUDA installation not supported for $DETECTED_DISTRO"
      log_warn "Please install CUDA manually: https://developer.nvidia.com/cuda-downloads"
      return 1
      ;;
  esac
}

_install_cuda_ubuntu() {
  # Add NVIDIA CUDA repository
  local arch="$DETECTED_ARCH_NORM"
  local distro_code
  distro_code="ubuntu$(echo "$DETECTED_DISTRO_VER" | tr -d '.')"

  # Download and install the CUDA keyring
  local keyring_url="https://developer.download.nvidia.com/compute/cuda/repos/${distro_code}/${arch/amd64/x86_64}/cuda-keyring_1.1-1_all.deb"
  local keyring_deb="/tmp/cuda-keyring.deb"

  if [[ ! -f /usr/share/keyrings/cuda-archive-keyring.gpg ]] && \
     ! dpkg -s cuda-keyring &>/dev/null; then
    log_substep "Adding CUDA repository..."
    retry 3 2 curl -fsSL -o "$keyring_deb" "$keyring_url"
    sudo_run dpkg -i "$keyring_deb"
    rm -f "$keyring_deb"
    sudo_run apt-get update -qq
  fi

  # Install CUDA toolkit (not the full cuda package which includes drivers)
  log_substep "Installing cuda-toolkit-12-8..."
  sudo_run apt-get install -y --no-install-recommends cuda-toolkit-12-8

  # Set up environment
  _setup_cuda_env
}

_setup_cuda_env() {
  local cuda_path="/usr/local/cuda"
  local profile_file="$HOME/.profile"

  if [[ -d "$cuda_path" ]]; then
    # Add to current session
    export PATH="${cuda_path}/bin:${PATH}"
    export LD_LIBRARY_PATH="${cuda_path}/lib64:${LD_LIBRARY_PATH:-}"

    # Persist to profile
    if ! grep -q 'CUDA_HOME' "$profile_file" 2>/dev/null; then
      {
        echo ""
        echo "# CUDA Toolkit"
        echo "export CUDA_HOME=${cuda_path}"
        echo "export PATH=\${CUDA_HOME}/bin:\${PATH}"
        echo "export LD_LIBRARY_PATH=\${CUDA_HOME}/lib64:\${LD_LIBRARY_PATH:-}"
      } >> "$profile_file"
      log_substep "CUDA environment variables added to $profile_file"
    fi
  fi
}

# ── cuDNN ──────────────────────────────────────────────────────────────────

install_cudnn() {
  if [[ "$DETECTED_OS" != "linux" ]] || [[ "$HAS_GPU" != "true" ]]; then
    return 0
  fi

  if dpkg -s libcudnn9-cuda-12 &>/dev/null 2>/dev/null || \
     dpkg -s libcudnn8 &>/dev/null 2>/dev/null; then
    log_substep "cuDNN already installed"
    return 0
  fi

  log_substep "Installing cuDNN..."
  sudo_run apt-get install -y --no-install-recommends \
    libcudnn9-cuda-12 libcudnn9-dev-cuda-12 2>/dev/null \
    || sudo_run apt-get install -y --no-install-recommends \
      libcudnn8 libcudnn8-dev 2>/dev/null \
    || log_warn "cuDNN installation failed (may need manual install from NVIDIA)"
}

# ── Verify GPU Setup ─────────────────────────────────────────────────────

verify_gpu_setup() {
  if [[ "$HAS_GPU" != "true" ]]; then
    log_substep "No GPU — skipping verification"
    return 0
  fi

  local ok=true

  if _nvidia_driver_installed; then
    log_substep "nvidia-smi: $(nvidia-smi --query-gpu=driver_version,name --format=csv,noheader 2>/dev/null | head -n1)"
  else
    log_error "NVIDIA driver not working — nvidia-smi failed"
    ok=false
  fi

  if _cuda_installed; then
    log_substep "CUDA: $(nvcc --version 2>/dev/null | grep 'release' | sed 's/.*release //' | sed 's/,.*//' || echo 'installed')"
  else
    log_warn "CUDA toolkit not found (optional for some workloads)"
  fi

  [[ "$ok" == "true" ]]
}

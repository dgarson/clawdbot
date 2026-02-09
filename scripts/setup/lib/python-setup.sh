#!/usr/bin/env bash
# ============================================================================
# python-setup.sh — Python, pip, virtualenv, and requirements installation
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_PYTHON_SETUP_LOADED:-}" ]] && return 0
readonly _OPENCLAW_PYTHON_SETUP_LOADED=1

readonly REQUIRED_PYTHON_VERSION="3.11.0"
readonly OPENCLAW_VENV_DIR="${OPENCLAW_HOME}/venv"

# ── Python Installation ───────────────────────────────────────────────────

_get_python_version() {
  python3 --version 2>/dev/null | sed 's/Python //' || echo "0.0.0"
}

install_python() {
  local current_version
  current_version="$(_get_python_version)"

  if has_cmd python3 && version_gte "$current_version" "$REQUIRED_PYTHON_VERSION"; then
    log_substep "Python already installed: v${current_version} (>= ${REQUIRED_PYTHON_VERSION})"
    return 0
  fi

  case "$DETECTED_OS" in
    macos)
      _install_python_macos
      ;;
    linux)
      _install_python_linux
      ;;
  esac

  current_version="$(_get_python_version)"
  if ! version_gte "$current_version" "$REQUIRED_PYTHON_VERSION"; then
    die "Python installation failed: got v${current_version}, need >= v${REQUIRED_PYTHON_VERSION}"
  fi

  log_substep "Python v${current_version} installed"
}

_install_python_macos() {
  log_substep "Installing Python 3.11+ via Homebrew..."
  if has_cmd brew; then
    brew install python@3.12
    # Ensure python3 points to the Homebrew version
    brew link --overwrite python@3.12 2>/dev/null || true
  else
    die "Homebrew not available — cannot install Python. Install Homebrew first."
  fi
}

_install_python_linux() {
  log_substep "Installing Python 3.12 via apt..."

  # On Ubuntu 24.04, python3.12 is the default
  if dpkg -s python3 &>/dev/null; then
    local ver
    ver="$(_get_python_version)"
    if version_gte "$ver" "$REQUIRED_PYTHON_VERSION"; then
      log_substep "System python3 v${ver} is sufficient"
      # Ensure pip and venv modules
      sudo_run apt-get install -y --no-install-recommends \
        python3-pip \
        python3-venv \
        python3-dev
      return 0
    fi
  fi

  # Try deadsnakes PPA for newer Python
  if ! dpkg -s python3.12 &>/dev/null; then
    log_substep "Adding deadsnakes PPA for Python 3.12..."
    sudo_run add-apt-repository -y ppa:deadsnakes/ppa 2>/dev/null || true
    sudo_run apt-get update -qq
    sudo_run apt-get install -y --no-install-recommends \
      python3.12 \
      python3.12-venv \
      python3.12-dev \
      python3-pip
  fi

  # Set python3.12 as the default python3 via update-alternatives
  if has_cmd python3.12; then
    sudo_run update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.12 1 2>/dev/null || true
  fi
}

# ── Virtual Environment ───────────────────────────────────────────────────

setup_python_venv() {
  if [[ -d "$OPENCLAW_VENV_DIR" ]] && [[ -f "$OPENCLAW_VENV_DIR/bin/python" ]]; then
    log_substep "Virtual environment already exists: $OPENCLAW_VENV_DIR"

    # Verify it works
    if "$OPENCLAW_VENV_DIR/bin/python" --version &>/dev/null; then
      return 0
    else
      log_warn "Existing venv is broken, recreating..."
      rm -rf "$OPENCLAW_VENV_DIR"
    fi
  fi

  log_substep "Creating Python virtual environment at $OPENCLAW_VENV_DIR..."
  python3 -m venv "$OPENCLAW_VENV_DIR"

  # Upgrade pip inside the venv
  "$OPENCLAW_VENV_DIR/bin/pip" install --upgrade pip setuptools wheel 2>&1 | tail -n1

  log_substep "Virtual environment created and pip upgraded"
}

# ── Requirements Installation ─────────────────────────────────────────────

install_python_requirements() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  local req_dir="${script_dir}/requirements"
  local pip="$OPENCLAW_VENV_DIR/bin/pip"

  if [[ ! -f "$pip" ]]; then
    die "Python venv not found at $OPENCLAW_VENV_DIR — run venv setup first"
  fi

  # Install core requirements
  if [[ -f "${req_dir}/python-core.txt" ]]; then
    log_substep "Installing core Python dependencies..."
    "$pip" install -r "${req_dir}/python-core.txt" 2>&1 | tail -n3
  fi

  # Install GPU requirements (only on Linux with GPU)
  if [[ "$HAS_GPU" == "true" ]] && [[ -f "${req_dir}/python-gpu.txt" ]]; then
    log_substep "Installing GPU/ML Python dependencies..."
    "$pip" install -r "${req_dir}/python-gpu.txt" 2>&1 | tail -n3
  fi

  # Install dev requirements (optional)
  if [[ -f "${req_dir}/python-dev.txt" ]]; then
    log_substep "Installing dev Python dependencies..."
    "$pip" install -r "${req_dir}/python-dev.txt" 2>&1 | tail -n3
  fi

  # Install any project-level requirements found in the repo
  _install_project_requirements "$pip"

  log_substep "Python dependencies installed"
}

_install_project_requirements() {
  local pip="$1"
  local repo_dir="${OPENCLAW_REPO_DIR:-}"

  if [[ -z "$repo_dir" ]] || [[ ! -d "$repo_dir" ]]; then
    return 0
  fi

  # Find and install requirements.txt files in the repo
  local found=0
  while IFS= read -r -d '' reqfile; do
    log_substep "Installing from: $(realpath --relative-to="$repo_dir" "$reqfile" 2>/dev/null || echo "$reqfile")"
    "$pip" install -r "$reqfile" 2>&1 | tail -n2
    (( found++ ))
  done < <(find "$repo_dir" -maxdepth 3 -name "requirements*.txt" ! -path "*/node_modules/*" ! -path "*/.venv/*" -print0 2>/dev/null)

  # Find and install pyproject.toml projects
  while IFS= read -r -d '' pyproject; do
    local proj_dir
    proj_dir="$(dirname "$pyproject")"
    log_substep "Installing from pyproject.toml: $(realpath --relative-to="$repo_dir" "$proj_dir" 2>/dev/null || echo "$proj_dir")"
    "$pip" install -e "$proj_dir" 2>&1 | tail -n2
    (( found++ ))
  done < <(find "$repo_dir" -maxdepth 3 -name "pyproject.toml" ! -path "*/node_modules/*" ! -path "*/.venv/*" -print0 2>/dev/null)

  if (( found > 0 )); then
    log_substep "Installed $found project-level Python dependency set(s)"
  fi
}

# ── Verify Python Setup ──────────────────────────────────────────────────

verify_python_setup() {
  local ok=true
  local python="$OPENCLAW_VENV_DIR/bin/python"
  local pip="$OPENCLAW_VENV_DIR/bin/pip"

  if [[ ! -f "$python" ]]; then
    log_error "Python venv not found at $OPENCLAW_VENV_DIR"
    ok=false
  else
    log_substep "Python venv: $("$python" --version 2>/dev/null)"
    log_substep "pip packages: $("$pip" list --format=columns 2>/dev/null | wc -l | tr -d ' ') installed"
  fi

  [[ "$ok" == "true" ]]
}

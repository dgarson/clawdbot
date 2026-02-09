#!/usr/bin/env bash
# ============================================================================
#  OpenClaw Host Setup — Progressive & Resumable
# ============================================================================
#
#  Usage:
#    ./setup.sh                 # Full interactive setup
#    ./setup.sh --dry-run       # Preview what would happen
#    ./setup.sh --force         # Re-run all steps (ignore state)
#    ./setup.sh --status        # Show current setup state
#    ./setup.sh --reset         # Clear all state and start fresh
#    ./setup.sh --services      # Only generate/link/start services
#    ./setup.sh --verify        # Verify current installation
#    ./setup.sh --verbose       # Show detailed output
#    ./setup.sh --non-interactive # No prompts (assume defaults)
#    ./setup.sh --skip-gpu      # Skip GPU/CUDA setup
#    ./setup.sh --skip-python   # Skip Python/pip setup
#    ./setup.sh --skip-services # Skip service generation
#    ./setup.sh --repo /path    # Set repo directory explicitly
#
#  State is tracked in ~/.openclaw/setup-state.json
#  Each step is idempotent and can be safely re-run.
#
#  Supports: macOS (Homebrew), Linux/Ubuntu 24 (apt)
# ============================================================================
set -euo pipefail

# Resolve script directory
SETUP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── Source all library modules ─────────────────────────────────────────────
source "${SETUP_DIR}/lib/common.sh"
source "${SETUP_DIR}/lib/detect.sh"
source "${SETUP_DIR}/lib/packages.sh"
source "${SETUP_DIR}/lib/packages-macos.sh"
source "${SETUP_DIR}/lib/packages-linux.sh"
source "${SETUP_DIR}/lib/node-setup.sh"
source "${SETUP_DIR}/lib/python-setup.sh"
source "${SETUP_DIR}/lib/gpu-setup.sh"
source "${SETUP_DIR}/lib/config.sh"
source "${SETUP_DIR}/lib/services.sh"
source "${SETUP_DIR}/lib/services-macos.sh"
source "${SETUP_DIR}/lib/services-linux.sh"

# ── Parse arguments ───────────────────────────────────────────────────────

SKIP_GPU=false
SKIP_PYTHON=false
SKIP_SERVICES=false
MODE="full"  # full | status | reset | services | verify

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)       DRY_RUN=true ;;
    --force)         FORCE=true ;;
    --verbose|-v)    VERBOSE=true ;;
    --non-interactive) SETUP_INTERACTIVE=false ;;
    --status)        MODE="status" ;;
    --reset)         MODE="reset" ;;
    --services)      MODE="services" ;;
    --verify)        MODE="verify" ;;
    --skip-gpu)      SKIP_GPU=true ;;
    --skip-python)   SKIP_PYTHON=true ;;
    --skip-services) SKIP_SERVICES=true ;;
    --repo)
      shift
      OPENCLAW_REPO_DIR="$1"
      ;;
    --help|-h)
      head -n 25 "$0" | tail -n 20
      exit 0
      ;;
    *)
      die "Unknown argument: $1 (use --help for usage)"
      ;;
  esac
  shift
done

# ── Mode: status ──────────────────────────────────────────────────────────

if [[ "$MODE" == "status" ]]; then
  print_banner
  echo -e "${C_BOLD}Setup State:${C_RESET}"
  echo -e "${C_DIM}──────────────────────────────────────────${C_RESET}"
  step_show_state
  echo ""

  # Also show service status if detection works
  run_detection 2>/dev/null || true
  show_service_status 2>/dev/null || true
  exit 0
fi

# ── Mode: reset ───────────────────────────────────────────────────────────

if [[ "$MODE" == "reset" ]]; then
  print_banner
  if confirm "This will clear ALL setup state. Are you sure?"; then
    step_clear_all
    log_ok "State cleared. Run setup.sh again to start fresh."
  fi
  exit 0
fi

# ── Banner ────────────────────────────────────────────────────────────────

print_banner

if [[ "$DRY_RUN" == "true" ]]; then
  echo -e "${C_MAGENTA}${C_BOLD}  ─── DRY RUN MODE ───${C_RESET}"
  echo ""
fi

if [[ "$FORCE" == "true" ]]; then
  echo -e "${C_YELLOW}${C_BOLD}  ─── FORCE MODE (re-running all steps) ───${C_RESET}"
  echo ""
fi

# ============================================================================
# STEP 1: Detect environment
# ============================================================================
run_step "os_detected" "Detecting environment" run_detection

# ============================================================================
# STEP 2: Build tools (Xcode CLI / build-essential)
# ============================================================================
run_step "build_tools" "Installing build tools" install_build_tools

# ============================================================================
# STEP 3: Package manager (Homebrew / apt update)
# ============================================================================
run_step "package_manager" "Setting up package manager" install_package_manager

# ============================================================================
# STEP 4: Core packages (git, curl, jq, etc.)
# ============================================================================
run_step "core_packages" "Installing core packages" install_core_packages

# ============================================================================
# STEP 5: Extra packages (htop, ripgrep, gh, etc.)
# ============================================================================
run_step "extra_packages" "Installing extra packages" install_extra_packages

# ============================================================================
# STEP 6: OS-specific extras (ffmpeg, playwright deps, etc.)
# ============================================================================
_install_os_extras() {
  case "$DETECTED_OS" in
    macos)  install_macos_extras ;;
    linux)  install_linux_extras ;;
  esac
}
run_step "os_extras" "Installing OS-specific extras" _install_os_extras

# ============================================================================
# STEP 7: Node.js
# ============================================================================
run_step "node_installed" "Installing Node.js 22+" install_node

# ============================================================================
# STEP 8: pnpm
# ============================================================================
run_step "pnpm_installed" "Installing pnpm" install_pnpm

# ============================================================================
# STEP 9: Bun
# ============================================================================
run_step "bun_installed" "Installing Bun" install_bun

# ============================================================================
# STEP 10: Python (optional)
# ============================================================================
if [[ "$SKIP_PYTHON" != "true" ]]; then
  run_step "python_installed" "Installing Python 3.11+" install_python

  # STEP 11: Python virtual environment
  run_step "python_venv" "Setting up Python virtual environment" setup_python_venv

  # STEP 12: Python requirements
  run_step "python_deps" "Installing Python dependencies" install_python_requirements
fi

# ============================================================================
# STEP 13: GPU setup (Linux only, optional)
# ============================================================================
if [[ "$SKIP_GPU" != "true" ]] && [[ "$DETECTED_OS" == "linux" ]] && [[ "$HAS_GPU" == "true" ]]; then
  run_step "gpu_drivers" "Installing NVIDIA drivers" install_nvidia_drivers
  run_step "cuda_toolkit" "Installing CUDA toolkit" install_cuda_toolkit
  run_step "cudnn" "Installing cuDNN" install_cudnn
fi

# ============================================================================
# STEP 14: Detect/clone repository
# ============================================================================
_setup_repo() {
  detect_repo || true
  if [[ -z "$OPENCLAW_REPO_DIR" ]]; then
    if confirm "OpenClaw repo not found. Clone it?"; then
      clone_repo
    else
      log_warn "Skipping repo setup — some features will not work"
      return 0
    fi
  fi
}
run_step "repo_setup" "Setting up OpenClaw repository" _setup_repo

# ============================================================================
# STEP 15: Build the project
# ============================================================================
if [[ -n "${OPENCLAW_REPO_DIR:-}" ]] && [[ -d "${OPENCLAW_REPO_DIR:-}" ]]; then
  run_step "repo_built" "Building OpenClaw" build_project
fi

# ============================================================================
# STEP 16: Initialize configuration
# ============================================================================
run_step "config_initialized" "Initializing OpenClaw configuration" initialize_config

# ============================================================================
# STEP 17: Shell profile integration
# ============================================================================
run_step "shell_profile" "Setting up shell profile" setup_shell_profile

# ============================================================================
# STEP 18-20: Services (optional)
# ============================================================================
if [[ "$SKIP_SERVICES" != "true" ]] || [[ "$MODE" == "services" ]]; then
  run_step "services_generated" "Generating service files" generate_services
  run_step "services_linked" "Linking services to OS startup" link_services

  if confirm "Start OpenClaw services now?"; then
    run_step "services_started" "Starting services" start_services
  fi
fi

# ============================================================================
# Verification / Summary
# ============================================================================

echo ""
echo -e "${C_BOLD}${C_GREEN}════════════════════════════════════════════${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}  OpenClaw Setup Complete!${C_RESET}"
echo -e "${C_BOLD}${C_GREEN}════════════════════════════════════════════${C_RESET}"
echo ""

# Quick verification
log_step "Verification Summary"

verify_js_toolchain || true

if [[ "$SKIP_PYTHON" != "true" ]]; then
  verify_python_setup || true
fi

if [[ "$HAS_GPU" == "true" ]]; then
  verify_gpu_setup || true
fi

show_service_status 2>/dev/null || true

echo -e "${C_BOLD}Key Paths:${C_RESET}"
echo -e "  Config:     ${C_CYAN}${OPENCLAW_HOME}${C_RESET}"
echo -e "  Repo:       ${C_CYAN}${OPENCLAW_REPO_DIR:-not set}${C_RESET}"
echo -e "  Venv:       ${C_CYAN}${OPENCLAW_VENV_DIR:-${OPENCLAW_HOME}/venv}${C_RESET}"
echo -e "  Services:   ${C_CYAN}${OPENCLAW_SERVICES_DIR:-${OPENCLAW_HOME}/services}${C_RESET}"
echo -e "  State:      ${C_CYAN}${OPENCLAW_STATE_FILE}${C_RESET}"
echo -e "  Log:        ${C_CYAN}${OPENCLAW_SETUP_LOG}${C_RESET}"
echo ""
echo -e "${C_DIM}Re-run this script at any time to update or resume.${C_RESET}"
echo -e "${C_DIM}Use --status to see current state, --force to re-run all steps.${C_RESET}"
echo ""

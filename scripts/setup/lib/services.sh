#!/usr/bin/env bash
# ============================================================================
# services.sh — Service generation orchestration (delegates to OS-specific)
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_SERVICES_LOADED:-}" ]] && return 0
readonly _OPENCLAW_SERVICES_LOADED=1

# ── Service definitions ───────────────────────────────────────────────────
# Each service is defined as: NAME|DESCRIPTION|COMMAND|WORKING_DIR|ENV_VARS
# These are the services we generate and manage.

readonly OPENCLAW_SERVICES_DIR="${OPENCLAW_HOME}/services"

# Get the service list based on what's been installed
get_service_definitions() {
  local repo_dir="${OPENCLAW_REPO_DIR:-$HOME/openclaw}"
  local node_bin
  node_bin="$(which node 2>/dev/null || echo '/usr/bin/node')"

  # Core gateway service (always)
  echo "openclaw-gateway|OpenClaw AI Gateway|${node_bin} openclaw.mjs gateway --allow-unconfigured|${repo_dir}|NODE_ENV=production"

  # Auth monitor (Linux only, timer-based)
  if [[ "$DETECTED_OS" == "linux" ]] && [[ -f "${repo_dir}/scripts/auth-monitor.sh" ]]; then
    echo "openclaw-auth-monitor|OpenClaw Auth Expiry Monitor|${repo_dir}/scripts/auth-monitor.sh|${repo_dir}|WARN_HOURS=2"
  fi
}

# ── Generate all services ─────────────────────────────────────────────────

generate_services() {
  ensure_dir "$OPENCLAW_SERVICES_DIR"

  log_substep "Generating service files..."

  case "$DETECTED_OS" in
    macos)  generate_services_macos ;;
    linux)  generate_services_linux ;;
  esac
}

# ── Link services to OS startup ───────────────────────────────────────────

link_services() {
  log_substep "Linking services to OS startup..."

  case "$DETECTED_OS" in
    macos)  link_services_macos ;;
    linux)  link_services_linux ;;
  esac
}

# ── Start services ────────────────────────────────────────────────────────

start_services() {
  log_substep "Starting services..."

  case "$DETECTED_OS" in
    macos)  start_services_macos ;;
    linux)  start_services_linux ;;
  esac
}

# ── Stop services ─────────────────────────────────────────────────────────

stop_services() {
  log_substep "Stopping services..."

  case "$DETECTED_OS" in
    macos)  stop_services_macos ;;
    linux)  stop_services_linux ;;
  esac
}

# ── Service status ────────────────────────────────────────────────────────

show_service_status() {
  case "$DETECTED_OS" in
    macos)  status_services_macos ;;
    linux)  status_services_linux ;;
  esac
}

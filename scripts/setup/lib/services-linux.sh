#!/usr/bin/env bash
# ============================================================================
# services-linux.sh — systemd unit generation and management
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_SERVICES_LINUX_LOADED:-}" ]] && return 0
readonly _OPENCLAW_SERVICES_LINUX_LOADED=1

# User-level systemd directory
readonly SYSTEMD_USER_DIR="$HOME/.config/systemd/user"

# ── Generate systemd unit files ───────────────────────────────────────────

generate_services_linux() {
  ensure_dir "$SYSTEMD_USER_DIR"
  ensure_dir "$OPENCLAW_SERVICES_DIR"

  local repo_dir="${OPENCLAW_REPO_DIR:-$HOME/openclaw}"
  local node_bin
  node_bin="$(which node 2>/dev/null || echo '/usr/bin/node')"
  local current_user
  current_user="$(whoami)"

  # ── Gateway service ──────────────────────────────────────────────────
  local gateway_unit="${OPENCLAW_SERVICES_DIR}/openclaw-gateway.service"

  cat > "$gateway_unit" << UNIT
[Unit]
Description=OpenClaw AI Gateway
Documentation=https://docs.openclaw.ai
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${node_bin} openclaw.mjs gateway --allow-unconfigured
WorkingDirectory=${repo_dir}
Restart=on-failure
RestartSec=10
StartLimitIntervalSec=300
StartLimitBurst=5

# Environment
Environment=NODE_ENV=production
Environment=HOME=${HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin:${HOME}/.bun/bin:${HOME}/.nvm/versions/node/v22/bin

# Logging
StandardOutput=append:${OPENCLAW_HOME}/logs/gateway.log
StandardError=append:${OPENCLAW_HOME}/logs/gateway-error.log

# Security hardening
NoNewPrivileges=yes
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=${OPENCLAW_HOME} ${repo_dir}
PrivateTmp=yes

# Resource limits
LimitNOFILE=65536
LimitNPROC=4096

[Install]
WantedBy=default.target
UNIT

  log_substep "Generated: ${gateway_unit}"

  # ── Auth monitor service (oneshot, triggered by timer) ───────────────
  if [[ -f "${repo_dir}/scripts/auth-monitor.sh" ]]; then
    local auth_unit="${OPENCLAW_SERVICES_DIR}/openclaw-auth-monitor.service"

    cat > "$auth_unit" << UNIT
[Unit]
Description=OpenClaw Auth Expiry Monitor
After=network.target

[Service]
Type=oneshot
ExecStart=${repo_dir}/scripts/auth-monitor.sh
WorkingDirectory=${repo_dir}
Environment=WARN_HOURS=2
Environment=HOME=${HOME}
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
UNIT

    log_substep "Generated: ${auth_unit}"

    # ── Auth monitor timer ─────────────────────────────────────────────
    local auth_timer="${OPENCLAW_SERVICES_DIR}/openclaw-auth-monitor.timer"

    cat > "$auth_timer" << UNIT
[Unit]
Description=Run OpenClaw Auth Monitor every 30 minutes

[Timer]
OnCalendar=*:0/30
Persistent=true
RandomizedDelaySec=60

[Install]
WantedBy=timers.target
UNIT

    log_substep "Generated: ${auth_timer}"
  fi

  # ── vLLM service (if GPU present) ────────────────────────────────────
  if [[ "$HAS_GPU" == "true" ]]; then
    local vllm_unit="${OPENCLAW_SERVICES_DIR}/openclaw-vllm.service"
    local vllm_venv="${OPENCLAW_HOME}/venv"

    cat > "$vllm_unit" << UNIT
[Unit]
Description=OpenClaw vLLM Inference Server
Documentation=https://docs.vllm.ai
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${vllm_venv}/bin/python -m vllm.entrypoints.openai.api_server \\
    --model Qwen/Qwen2.5-VL-7B-Instruct \\
    --host 0.0.0.0 \\
    --port 8000 \\
    --max-model-len 32768 \\
    --gpu-memory-utilization 0.85

WorkingDirectory=${OPENCLAW_HOME}
Restart=on-failure
RestartSec=30
StartLimitIntervalSec=600
StartLimitBurst=3

Environment=HOME=${HOME}
Environment=CUDA_HOME=/usr/local/cuda
Environment=PATH=${vllm_venv}/bin:/usr/local/cuda/bin:/usr/local/bin:/usr/bin:/bin
Environment=LD_LIBRARY_PATH=/usr/local/cuda/lib64

StandardOutput=append:${OPENCLAW_HOME}/logs/vllm.log
StandardError=append:${OPENCLAW_HOME}/logs/vllm-error.log

# GPU access
SupplementaryGroups=video render

# Resource limits
LimitNOFILE=65536
LimitMEMLOCK=infinity

[Install]
WantedBy=default.target
UNIT

    log_substep "Generated: ${vllm_unit} (GPU inference server)"
  fi

  ensure_dir "${OPENCLAW_HOME}/logs"
}

# ── Link units to systemd ────────────────────────────────────────────────

link_services_linux() {
  ensure_dir "$SYSTEMD_USER_DIR"
  local linked=0

  local -a unit_files=()
  for ext in service timer; do
    for f in "${OPENCLAW_SERVICES_DIR}"/*."${ext}"; do
      [[ -f "$f" ]] && unit_files+=("$f")
    done
  done

  for unit_file in "${unit_files[@]}"; do
    local basename
    basename="$(basename "$unit_file")"
    local target="${SYSTEMD_USER_DIR}/${basename}"

    if [[ -L "$target" ]] && [[ "$(readlink "$target")" == "$unit_file" ]]; then
      log_verbose "Already linked: $basename"
    elif [[ -f "$target" ]]; then
      log_warn "Existing unit at $target — backing up and replacing"
      cp "$target" "${target}.bak.$(date +%s)"
      ln -sf "$unit_file" "$target"
      (( linked++ ))
    else
      ln -sf "$unit_file" "$target"
      (( linked++ ))
    fi
  done

  # Reload systemd to pick up new units
  systemctl --user daemon-reload 2>/dev/null || true

  log_substep "Linked $linked unit(s) to ${SYSTEMD_USER_DIR}"

  # Enable lingering so user services run without login
  if has_cmd loginctl; then
    local current_user
    current_user="$(whoami)"
    if ! loginctl show-user "$current_user" --property=Linger 2>/dev/null | grep -q "yes"; then
      log_substep "Enabling user lingering (services run without login)..."
      sudo_run loginctl enable-linger "$current_user" 2>/dev/null || true
    fi
  fi
}

# ── Start services ────────────────────────────────────────────────────────

start_services_linux() {
  for unit_file in "${SYSTEMD_USER_DIR}"/openclaw-*.service; do
    [[ -f "$unit_file" ]] || continue

    local unit_name
    unit_name="$(basename "$unit_file")"

    # Skip oneshot services (they're triggered by timers)
    if grep -q 'Type=oneshot' "$unit_file" 2>/dev/null; then
      log_verbose "Skipping oneshot service: $unit_name (timer-triggered)"
      continue
    fi

    log_substep "Enabling and starting: $unit_name"
    systemctl --user enable "$unit_name" 2>/dev/null || true
    systemctl --user restart "$unit_name" 2>/dev/null || log_warn "Failed to start $unit_name"
  done

  # Enable timers
  for timer_file in "${SYSTEMD_USER_DIR}"/openclaw-*.timer; do
    [[ -f "$timer_file" ]] || continue

    local timer_name
    timer_name="$(basename "$timer_file")"

    log_substep "Enabling timer: $timer_name"
    systemctl --user enable "$timer_name" 2>/dev/null || true
    systemctl --user start "$timer_name" 2>/dev/null || log_warn "Failed to start $timer_name"
  done
}

# ── Stop services ─────────────────────────────────────────────────────────

stop_services_linux() {
  for unit_file in "${SYSTEMD_USER_DIR}"/openclaw-*.service; do
    [[ -f "$unit_file" ]] || continue

    local unit_name
    unit_name="$(basename "$unit_file")"

    if systemctl --user is-active "$unit_name" &>/dev/null; then
      log_substep "Stopping: $unit_name"
      systemctl --user stop "$unit_name" 2>/dev/null || true
    fi
  done

  for timer_file in "${SYSTEMD_USER_DIR}"/openclaw-*.timer; do
    [[ -f "$timer_file" ]] || continue

    local timer_name
    timer_name="$(basename "$timer_file")"

    systemctl --user stop "$timer_name" 2>/dev/null || true
  done
}

# ── Status ────────────────────────────────────────────────────────────────

status_services_linux() {
  echo -e "\n${C_BOLD}OpenClaw Services (systemd user units):${C_RESET}"
  echo -e "${C_DIM}──────────────────────────────────────────${C_RESET}"

  local found=false

  local -a status_files=()
  for ext in service timer; do
    for f in "${SYSTEMD_USER_DIR}"/openclaw-*."${ext}"; do
      [[ -f "$f" ]] && status_files+=("$f")
    done
  done

  for unit_file in "${status_files[@]}"; do
    found=true

    local unit_name
    unit_name="$(basename "$unit_file")"

    local status
    status="$(systemctl --user is-active "$unit_name" 2>/dev/null || echo 'inactive')"

    case "$status" in
      active)
        local pid
        pid="$(systemctl --user show "$unit_name" --property=MainPID --value 2>/dev/null || echo '?')"
        echo -e "  ${C_GREEN}● ${unit_name}${C_RESET} (PID: ${pid})"
        ;;
      activating)
        echo -e "  ${C_YELLOW}◐ ${unit_name}${C_RESET} (starting...)"
        ;;
      failed)
        echo -e "  ${C_RED}● ${unit_name}${C_RESET} (FAILED)"
        ;;
      *)
        echo -e "  ${C_DIM}○ ${unit_name}${C_RESET} (${status})"
        ;;
    esac
  done

  if [[ "$found" != "true" ]]; then
    echo -e "  ${C_DIM}No OpenClaw services found${C_RESET}"
  fi
  echo ""
}

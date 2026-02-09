#!/usr/bin/env bash
# ============================================================================
# services-macos.sh — macOS LaunchAgent plist generation and management
# ============================================================================
set -euo pipefail

[[ -n "${_OPENCLAW_SERVICES_MACOS_LOADED:-}" ]] && return 0
readonly _OPENCLAW_SERVICES_MACOS_LOADED=1

readonly LAUNCHAGENTS_DIR="$HOME/Library/LaunchAgents"

# ── Generate plist files ──────────────────────────────────────────────────

generate_services_macos() {
  ensure_dir "$LAUNCHAGENTS_DIR"

  local repo_dir="${OPENCLAW_REPO_DIR:-$HOME/openclaw}"
  local node_bin
  node_bin="$(which node 2>/dev/null || echo '/usr/local/bin/node')"
  local pnpm_bin
  pnpm_bin="$(which pnpm 2>/dev/null || echo '/usr/local/bin/pnpm')"

  # ── Gateway plist ────────────────────────────────────────────────────
  local gateway_plist="${OPENCLAW_SERVICES_DIR}/ai.openclaw.gateway.plist"
  local gateway_log="${OPENCLAW_HOME}/logs/gateway.log"
  local gateway_err="${OPENCLAW_HOME}/logs/gateway-error.log"
  ensure_dir "${OPENCLAW_HOME}/logs"

  cat > "$gateway_plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.gateway</string>

    <key>ProgramArguments</key>
    <array>
        <string>${node_bin}</string>
        <string>openclaw.mjs</string>
        <string>gateway</string>
        <string>--allow-unconfigured</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${repo_dir}</string>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>ThrottleInterval</key>
    <integer>10</integer>

    <key>StandardOutPath</key>
    <string>${gateway_log}</string>

    <key>StandardErrorPath</key>
    <string>${gateway_err}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PATH</key>
        <string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:${HOME}/.bun/bin</string>
        <key>HOME</key>
        <string>${HOME}</string>
    </dict>

    <!-- Prevent system sleep while gateway is running -->
    <key>ProcessType</key>
    <string>Interactive</string>
</dict>
</plist>
PLIST

  log_substep "Generated: ${gateway_plist}"

  # ── Caffeinate wrapper plist (keeps macOS awake) ─────────────────────
  local caffeinate_plist="${OPENCLAW_SERVICES_DIR}/ai.openclaw.caffeinate.plist"

  cat > "$caffeinate_plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>ai.openclaw.caffeinate</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/caffeinate</string>
        <string>-ism</string>
        <string>-w</string>
        <string>0</string>
    </array>

    <key>RunAtLoad</key>
    <true/>

    <key>KeepAlive</key>
    <true/>

    <key>StandardOutPath</key>
    <string>${OPENCLAW_HOME}/logs/caffeinate.log</string>

    <key>StandardErrorPath</key>
    <string>${OPENCLAW_HOME}/logs/caffeinate-error.log</string>
</dict>
</plist>
PLIST

  log_substep "Generated: ${caffeinate_plist}"
}

# ── Link plists to LaunchAgents ───────────────────────────────────────────

link_services_macos() {
  local linked=0

  for plist_file in "${OPENCLAW_SERVICES_DIR}"/*.plist; do
    [[ -f "$plist_file" ]] || continue

    local basename
    basename="$(basename "$plist_file")"
    local target="${LAUNCHAGENTS_DIR}/${basename}"

    if [[ -L "$target" ]] && [[ "$(readlink "$target")" == "$plist_file" ]]; then
      log_verbose "Already linked: $basename"
    elif [[ -f "$target" ]]; then
      log_warn "Existing plist at $target — backing up and replacing"
      cp "$target" "${target}.bak.$(date +%s)"
      ln -sf "$plist_file" "$target"
      (( linked++ ))
    else
      ln -sf "$plist_file" "$target"
      (( linked++ ))
    fi
  done

  log_substep "Linked $linked service(s) to ${LAUNCHAGENTS_DIR}"
}

# ── Start services ────────────────────────────────────────────────────────

start_services_macos() {
  for plist_file in "${LAUNCHAGENTS_DIR}"/ai.openclaw.*.plist; do
    [[ -f "$plist_file" ]] || continue

    local label
    label="$(basename "$plist_file" .plist)"

    # Check if already loaded
    if launchctl print "gui/${UID}/${label}" &>/dev/null; then
      log_substep "Service already running: $label"
      # Restart it to pick up any config changes
      launchctl kickstart -k "gui/${UID}/${label}" 2>/dev/null || true
    else
      log_substep "Starting: $label"
      launchctl bootstrap "gui/${UID}" "$plist_file" 2>/dev/null \
        || launchctl load "$plist_file" 2>/dev/null \
        || log_warn "Failed to start $label"
    fi
  done
}

# ── Stop services ─────────────────────────────────────────────────────────

stop_services_macos() {
  for plist_file in "${LAUNCHAGENTS_DIR}"/ai.openclaw.*.plist; do
    [[ -f "$plist_file" ]] || continue

    local label
    label="$(basename "$plist_file" .plist)"

    if launchctl print "gui/${UID}/${label}" &>/dev/null; then
      log_substep "Stopping: $label"
      launchctl bootout "gui/${UID}/${label}" 2>/dev/null \
        || launchctl unload "$plist_file" 2>/dev/null \
        || log_warn "Failed to stop $label"
    fi
  done
}

# ── Status ────────────────────────────────────────────────────────────────

status_services_macos() {
  echo -e "\n${C_BOLD}OpenClaw Services (macOS LaunchAgents):${C_RESET}"
  echo -e "${C_DIM}──────────────────────────────────────────${C_RESET}"

  local found=false
  for plist_file in "${LAUNCHAGENTS_DIR}"/ai.openclaw.*.plist; do
    [[ -f "$plist_file" ]] || continue
    found=true

    local label
    label="$(basename "$plist_file" .plist)"

    if launchctl print "gui/${UID}/${label}" &>/dev/null; then
      local pid
      pid="$(launchctl print "gui/${UID}/${label}" 2>/dev/null | grep 'pid =' | awk '{print $NF}' || echo '?')"
      echo -e "  ${C_GREEN}● ${label}${C_RESET} (PID: ${pid})"
    else
      echo -e "  ${C_RED}○ ${label}${C_RESET} (stopped)"
    fi
  done

  if [[ "$found" != "true" ]]; then
    echo -e "  ${C_DIM}No OpenClaw services found${C_RESET}"
  fi
  echo ""
}

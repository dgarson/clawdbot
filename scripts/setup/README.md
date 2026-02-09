# OpenClaw Host Setup Scripts

Progressive, resumable, idempotent setup scripts for configuring macOS and Linux/Ubuntu 24 hosts to run OpenClaw.

## Quick Start

```bash
# Full interactive setup
./scripts/setup/setup.sh

# Preview what would happen (no changes)
./scripts/setup/setup.sh --dry-run

# Non-interactive (CI/automation)
./scripts/setup/setup.sh --non-interactive
```

## Architecture

```
scripts/setup/
├── setup.sh                    # Main entry point — orchestrates everything
├── lib/
│   ├── common.sh               # Logging, state tracking, progress, colors
│   ├── detect.sh               # OS/architecture/GPU detection
│   ├── packages.sh             # Shared package install orchestration
│   ├── packages-macos.sh       # macOS: Homebrew, Xcode CLI tools
│   ├── packages-linux.sh       # Linux: apt, build-essential
│   ├── node-setup.sh           # Node.js 22+, pnpm, Bun
│   ├── python-setup.sh         # Python 3.11+, venv, pip requirements
│   ├── gpu-setup.sh            # NVIDIA drivers, CUDA, cuDNN (Linux)
│   ├── config.sh               # OpenClaw configuration initialization
│   ├── services.sh             # Service generation orchestration
│   ├── services-macos.sh       # macOS LaunchAgent plist generation
│   └── services-linux.sh       # Linux systemd unit generation
└── requirements/
    ├── python-core.txt         # Core Python deps (all platforms)
    ├── python-gpu.txt          # GPU/ML deps (Linux + NVIDIA only)
    └── python-dev.txt          # Development deps (optional)
```

## Design Principles

### Progressive & Resumable

Every step is tracked in `~/.openclaw/setup-state.json`. If the script is interrupted (Ctrl+C, reboot, error), simply re-run it — completed steps are automatically skipped.

```bash
# Check what's been done
./scripts/setup/setup.sh --status

# Clear state and start fresh
./scripts/setup/setup.sh --reset
```

### Idempotent

Every step checks whether it's already satisfied before executing. Running the script multiple times produces the same result.

### Cross-Platform

| Component        | macOS                      | Linux/Ubuntu 24             |
| ---------------- | -------------------------- | --------------------------- |
| Build tools      | Xcode CLI Tools            | build-essential, gcc, cmake |
| Package manager  | Homebrew                   | apt                         |
| Node.js          | `brew install node@22`     | NodeSource repo             |
| Python           | `brew install python@3.12` | apt + deadsnakes PPA        |
| GPU drivers      | N/A                        | ubuntu-drivers              |
| CUDA             | N/A                        | NVIDIA CUDA repo            |
| Services         | LaunchAgents (plist)       | systemd user units          |
| Sleep prevention | caffeinate LaunchAgent     | N/A                         |

## Steps

The setup runs these steps in order:

| #   | Step                 | Description                             |
| --- | -------------------- | --------------------------------------- |
| 1   | `os_detected`        | Detect OS, arch, GPU, Docker            |
| 2   | `build_tools`        | Xcode CLI Tools / build-essential       |
| 3   | `package_manager`    | Homebrew / apt update                   |
| 4   | `core_packages`      | git, curl, jq, openssl, etc.            |
| 5   | `extra_packages`     | htop, ripgrep, fd, gh, tmux             |
| 6   | `os_extras`          | ffmpeg, Playwright deps                 |
| 7   | `node_installed`     | Node.js 22+                             |
| 8   | `pnpm_installed`     | pnpm package manager                    |
| 9   | `bun_installed`      | Bun runtime                             |
| 10  | `python_installed`   | Python 3.11+                            |
| 11  | `python_venv`        | Virtual environment at ~/.openclaw/venv |
| 12  | `python_deps`        | pip requirements (core + gpu + dev)     |
| 13  | `gpu_drivers`        | NVIDIA driver (Linux only)              |
| 14  | `cuda_toolkit`       | CUDA toolkit (Linux only)               |
| 15  | `cudnn`              | cuDNN (Linux only)                      |
| 16  | `repo_setup`         | Detect or clone OpenClaw repo           |
| 17  | `repo_built`         | pnpm install + build                    |
| 18  | `config_initialized` | Directories, gateway token, .env        |
| 19  | `shell_profile`      | PATH + env vars in shell profile        |
| 20  | `services_generated` | Generate plist/systemd files            |
| 21  | `services_linked`    | Symlink to OS service directories       |
| 22  | `services_started`   | Enable and start services               |

## Services Generated

### macOS (LaunchAgents)

- **`ai.openclaw.gateway`** — Main OpenClaw gateway service
  - Auto-starts at login
  - Restarts on crash (10s throttle)
  - Logs to `~/.openclaw/logs/gateway.log`

- **`ai.openclaw.caffeinate`** — Prevents system sleep
  - Uses `caffeinate -ism` to keep the machine awake
  - Useful when running 24/7 with lid closed on AC power

### Linux (systemd user units)

- **`openclaw-gateway.service`** — Main OpenClaw gateway
  - Runs as user service (no root required)
  - Auto-restarts on failure
  - Security hardening (NoNewPrivileges, ProtectSystem)
  - Logs to `~/.openclaw/logs/gateway.log`

- **`openclaw-auth-monitor.service/timer`** — Auth expiry checks
  - Runs every 30 minutes via systemd timer
  - Checks for expiring auth tokens

- **`openclaw-vllm.service`** — vLLM inference server (GPU hosts)
  - Only generated when NVIDIA GPU is detected
  - Pre-configured for Qwen2.5-VL-7B
  - GPU memory utilization at 85%

## Flags

| Flag                | Description                            |
| ------------------- | -------------------------------------- |
| `--dry-run`         | Preview actions without making changes |
| `--force`           | Re-run all steps, ignoring state       |
| `--verbose` / `-v`  | Show detailed command output           |
| `--non-interactive` | Skip all confirmation prompts          |
| `--status`          | Show current setup state               |
| `--reset`           | Clear all state                        |
| `--services`        | Only run service generation/linking    |
| `--verify`          | Verify current installation            |
| `--skip-gpu`        | Skip GPU/CUDA setup                    |
| `--skip-python`     | Skip Python/pip setup                  |
| `--skip-services`   | Skip service generation                |
| `--repo /path`      | Set repo directory explicitly          |

## Files & State

| Path                              | Purpose                       |
| --------------------------------- | ----------------------------- |
| `~/.openclaw/setup-state.json`    | Step completion tracking      |
| `~/.openclaw/setup.log`           | Full setup log                |
| `~/.openclaw/setup-metadata.json` | Host metadata (OS, GPU, etc.) |
| `~/.openclaw/venv/`               | Python virtual environment    |
| `~/.openclaw/services/`           | Generated service files       |
| `~/.openclaw/logs/`               | Service runtime logs          |
| `~/.openclaw/.gateway-token`      | Gateway authentication token  |

## Extending

To add a new step:

1. Create the step function in the appropriate `lib/*.sh` file
2. Add `run_step "step_name" "Description" function_name` in `setup.sh`
3. The state system handles idempotency automatically

To add platform-specific behavior, use the pattern:

```bash
case "$DETECTED_OS" in
  macos)  do_macos_thing ;;
  linux)  do_linux_thing ;;
esac
```

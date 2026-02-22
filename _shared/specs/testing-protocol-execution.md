# OpenClaw Testing Protocol: Execution Plan & Gateway Isolation

> **Document Focus:** Practical execution steps, test gateway isolation strategy, and verification checklist.
> **Companion Document:** See Amadeus's work for testing philosophy, regression categories, and verification criteria.

---

## 1. Pre-Test Checklist: Git Operations, Merge & Conflict Resolution

### 1.1 Initial Setup

```bash
# Navigate to the OpenClaw repository
cd /Users/openclaw/chat-builder-work

# Verify you're on main and up-to-date
git checkout main
git pull origin main

# Verify clean working tree
git status
# Should show: "nothing to commit, working tree clean"
```

### 1.2 Fetch Latest Origin

```bash
# Fetch all remotes (ensures we have the latest refs)
git fetch --all --prune

# Verify remotes are configured correctly
git remote -v
# Should show origin pointing to openclaw/openclaw
```

### 1.3 Create a Test Worktree (CRITICAL)

**ALWAYS use a new git worktree for testing — never work on `main` directly.**

```bash
# Create a new worktree for the test branch
# This keeps your main checkout clean and allows parallel testing
git worktree add ../openclaw-test-branch main

# Navigate to the test worktree
cd ../openclaw-test-branch
```

### 1.4 Merge the Feature Branch

```bash
# Fetch the latest from the fork remote (if not already present)
# The dgarson/fork branch should be available via origin or a separate remote

# Attempt the merge
git merge origin/dgarson/fork --no-edit

# Check the result
git status
```

### 1.5 Handle Merge Conflicts (If Any)

**If merge succeeds cleanly:**
```bash
# Verify the merge commit
git log -1 --oneline
# Proceed to Section 2
```

**If merge conflicts occur:**

```bash
# List conflicted files
git diff --name-only --diff-filter=U

# For each conflicted file, resolve manually:
# 1. Open the file in your editor
# 2. Look for <<<<<<< HEAD markers
# 3. Resolve the conflict (prefer incoming changes for new features,
#    but preserve main's fixes if they're more recent)
# 4. Remove the conflict markers

# After resolving each file:
git add <resolved-file-path>

# Verify all conflicts are resolved:
git status
# Should show "all conflicts fixed but you are still merging"

# Complete the merge
git commit -m "Merge dgarson/fork into main for testing

Resolved conflicts in:
- <list-files-with-conflicts>

Test plan: <link-to-test-plan>"
```

### 1.6 Verify Merge Integrity

```bash
# Ensure the code compiles
pnpm install
pnpm build

# Run quick lint check
pnpm lint

# If build fails, fix issues before proceeding
```

---

## 2. Test Gateway Isolation Strategy

### 2.1 The Problem

The production `openclaw-gateway` must stay running to serve live sessions. We need to run a **separate test gateway** that:
- Uses a **different port** (avoid port conflicts)
- Uses a **different state directory** (avoid data corruption)
- Has **isolated configuration** (won't interfere with production)
- Disables **channels, cron, and other services** that require external resources

### 2.2 Isolation Mechanisms

The OpenClaw gateway supports multiple isolation mechanisms:

| Mechanism | Environment Variable | Config Option | Purpose |
|-----------|---------------------|---------------|---------|
| Port | `OPENCLAW_GATEWAY_PORT` | `gateway.port` | Different listening port |
| State Directory | `OPENCLAW_STATE_DIR` | N/A | Isolated session/config storage |
| Config Path | `OPENCLAW_CONFIG_PATH` | N/A | Separate config file |
| Profile | `OPENCLAW_PROFILE` / `--profile` | N/A | Named profile isolation |
| Skip Channels | `OPENCLAW_SKIP_CHANNELS=1` | N/A | Disable all channel integrations |
| Skip Cron | `OPENCLAW_SKIP_CRON=1` | `cron.enabled: false` | Disable scheduled jobs |
| Skip Browser Control | `OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1` | N/A | Disable browser control server |
| Skip Canvas Host | `OPENCLAW_SKIP_CANVAS_HOST=1` | N/A | Disable canvas hosting |
| Skip Gmail Watcher | `OPENCLAW_SKIP_GMAIL_WATCHER=1` | N/A | Disable Gmail polling |
| Minimal Gateway | `OPENCLAW_TEST_MINIMAL_GATEWAY=1` | N/A | Minimal startup for tests |

### 2.3 Recommended Isolation Strategy: Dedicated Test Profile

**Option A: Using `--profile test` (Recommended)**

The `--profile` flag automatically isolates `OPENCLAW_STATE_DIR` and `OPENCLAW_CONFIG_PATH`:

```bash
# Profile "test" creates:
# - State dir: ~/.openclaw-test
# - Config path: ~/.openclaw-test/openclaw.json
# - Port: Can override with OPENCLAW_GATEWAY_PORT

openclaw --profile test gateway run \
  --port 18790 \
  --bind loopback \
  --allow-unconfigured \
  --dev
```

**Option B: Manual Environment Isolation**

```bash
# Create a temporary test state directory
TEST_STATE_DIR=$(mktemp -d)/.openclaw-test
mkdir -p "$TEST_STATE_DIR"

# Set up isolated environment
export OPENCLAW_STATE_DIR="$TEST_STATE_DIR"
export OPENCLAW_CONFIG_PATH="$TEST_STATE_DIR/openclaw.json"
export OPENCLAW_GATEWAY_PORT=18790
export OPENCLAW_SKIP_CHANNELS=1
export OPENCLAW_SKIP_CRON=1
export OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1
export OPENCLAW_SKIP_CANVAS_HOST=1
export OPENCLAW_SKIP_GMAIL_WATCHER=1
export OPENCLAW_SKIP_PROVIDERS=1
export OPENCLAW_TEST_MINIMAL_GATEWAY=1
```

### 2.4 Test Gateway Configuration

Create a minimal test config at `$OPENCLAW_CONFIG_PATH`:

```json
{
  "gateway": {
    "mode": "local",
    "port": 18790,
    "bind": "loopback",
    "auth": {
      "mode": "token",
      "token": "test-gateway-token-for-regression-testing"
    }
  },
  "cron": {
    "enabled": false
  },
  "channels": {
    "slack": { "enabled": false },
    "discord": { "enabled": false },
    "telegram": { "enabled": false },
    "whatsapp": { "enabled": false }
  },
  "agents": {
    "list": [
      {
        "id": "test-agent",
        "name": "Test Agent"
      }
    ]
  }
}
```

---

## 3. Practical Commands: Start/Stop Test Gateway

### 3.1 Start Test Gateway (Foreground)

```bash
# Method 1: Using profile flag (simplest)
openclaw --profile test gateway run \
  --port 18790 \
  --bind loopback \
  --allow-unconfigured \
  --dev

# Method 2: Using explicit environment variables
OPENCLAW_STATE_DIR=/tmp/openclaw-test-state \
OPENCLAW_CONFIG_PATH=/tmp/openclaw-test-state/openclaw.json \
OPENCLAW_GATEWAY_PORT=18790 \
OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CRON=1 \
OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
  openclaw gateway run \
    --port 18790 \
    --bind loopback \
    --allow-unconfigured \
    --token "test-gateway-token"
```

### 3.2 Start Test Gateway (Background)

```bash
# Start in background and capture PID
OPENCLAW_STATE_DIR=/tmp/openclaw-test-state \
OPENCLAW_CONFIG_PATH=/tmp/openclaw-test-state/openclaw.json \
OPENCLAW_GATEWAY_PORT=18790 \
OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CRON=1 \
  openclaw gateway run --port 18790 --bind loopback --allow-unconfigured &
TEST_GATEWAY_PID=$!

# Wait for gateway to be ready
sleep 3

# Verify gateway is listening
curl -s http://127.0.0.1:18790/health || echo "Gateway not ready"
```

### 3.3 Stop Test Gateway

```bash
# If running in foreground: Ctrl+C

# If running in background:
kill $TEST_GATEWAY_PID

# Or use the gateway stop command (if using service management)
openclaw --profile test gateway stop

# Force kill if needed
kill -9 $TEST_GATEWAY_PID

# Verify port is free
lsof -i :18790 || echo "Port 18790 is free"
```

### 3.4 Quick Test Gateway Script

Create a helper script for convenience:

```bash
#!/bin/bash
# scripts/test-gateway.sh

set -e

TEST_PORT="${TEST_PORT:-18790}"
TEST_STATE_DIR="${TEST_STATE_DIR:-/tmp/openclaw-test-state}"
TEST_TOKEN="${TEST_TOKEN:-test-gateway-token}"

# Cleanup function
cleanup() {
  echo "Stopping test gateway..."
  if [ -n "$GATEWAY_PID" ]; then
    kill $GATEWAY_PID 2>/dev/null || true
  fi
  echo "Cleaning up test state..."
  rm -rf "$TEST_STATE_DIR"
}
trap cleanup EXIT

# Create test state directory
mkdir -p "$TEST_STATE_DIR"

# Create minimal test config
cat > "$TEST_STATE_DIR/openclaw.json" << EOF
{
  "gateway": {
    "mode": "local",
    "port": $TEST_PORT,
    "bind": "loopback",
    "auth": { "mode": "token", "token": "$TEST_TOKEN" }
  },
  "cron": { "enabled": false }
}
EOF

echo "Starting test gateway on port $TEST_PORT..."

# Start gateway with isolated environment
OPENCLAW_STATE_DIR="$TEST_STATE_DIR" \
OPENCLAW_CONFIG_PATH="$TEST_STATE_DIR/openclaw.json" \
OPENCLAW_GATEWAY_PORT="$TEST_PORT" \
OPENCLAW_SKIP_CHANNELS=1 \
OPENCLAW_SKIP_CRON=1 \
OPENCLAW_SKIP_BROWSER_CONTROL_SERVER=1 \
OPENCLAW_SKIP_CANVAS_HOST=1 \
  openclaw gateway run \
    --port "$TEST_PORT" \
    --bind loopback \
    --allow-unconfigured \
    --token "$TEST_TOKEN" &
GATEWAY_PID=$!

# Wait for gateway to start
echo "Waiting for gateway to start..."
for i in {1..30}; do
  if curl -s "http://127.0.0.1:$TEST_PORT/health" > /dev/null 2>&1; then
    echo "Gateway ready on port $TEST_PORT"
    break
  fi
  sleep 1
done

# Keep script running until interrupted
wait $GATEWAY_PID
```

---

## 4. Verification Checklist

### 4.1 Gateway Startup Verification

```bash
# Check gateway process is running
ps aux | grep "openclaw gateway" | grep -v grep

# Check port is bound
lsof -i :18790
# Or: netstat -an | grep 18790

# Health check via HTTP
curl -s http://127.0.0.1:18790/health | jq .

# WebSocket health check via CLI
openclaw gateway health --url ws://127.0.0.1:18790 --token "test-gateway-token"

# Or use the smoke test script
bun scripts/dev/gateway-smoke.ts \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"
```

### 4.2 Session Handling Verification

```bash
# Create a test session
curl -X POST http://127.0.0.1:18790/api/session \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-gateway-token" \
  -d '{"sessionKey": "test-session"}'

# List sessions
openclaw sessions list --url ws://127.0.0.1:18790 --token "test-gateway-token"

# Send a test message (requires model provider configured)
# This tests the full request path
```

### 4.3 Tool Execution Verification

```bash
# Test tool execution via gateway RPC
openclaw gateway call health \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"

# Test system presence
openclaw gateway call system-presence \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"

# Test node.list (should return empty if no nodes connected)
openclaw gateway call node.list \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"
```

### 4.4 Heartbeat Cycle Verification

The heartbeat system runs periodically and can be triggered on-demand:

```bash
# Check that heartbeats are NOT running in test mode
# (OPENCLAW_TEST_MINIMAL_GATEWAY=1 disables heartbeat runner)

# For full gateway testing (with heartbeats):
# Remove OPENCLAW_TEST_MINIMAL_GATEWAY=1 and monitor logs for:
# - "heartbeat: polling..." messages
# - "heartbeat: wake requested" messages

# Trigger a manual heartbeat via gateway RPC
openclaw gateway call heartbeat.request \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"
```

### 4.5 Cron Scheduling Verification

In test mode, cron is disabled (`OPENCLAW_SKIP_CRON=1`). To verify cron works:

```bash
# Enable cron in test config
jq '.cron.enabled = true' "$TEST_STATE_DIR/openclaw.json" > tmp.json && mv tmp.json "$TEST_STATE_DIR/openclaw.json"

# Restart gateway (cron reads config on startup)
# Kill and restart...

# Verify cron is running
openclaw gateway call cron.list \
  --url ws://127.0.0.1:18790 \
  --token "test-gateway-token"
```

---

## 5. Running the Existing Test Suite

### 5.1 Test Configuration Files

OpenClaw uses Vitest with multiple configuration files:

| Config File | Purpose | Command |
|-------------|---------|---------|
| `vitest.config.ts` | Main config (unit tests) | `pnpm test` |
| `vitest.unit.config.ts` | Unit tests only | `pnpm test:unit` |
| `vitest.e2e.config.ts` | End-to-end tests | `pnpm test:e2e` |
| `vitest.gateway.config.ts` | Gateway-specific tests | `pnpm test:gateway` |
| `vitest.extensions.config.ts` | Extension tests | `pnpm test:extensions` |
| `vitest.live.config.ts` | Live API tests | `pnpm test:live` |

### 5.2 Running Unit Tests

```bash
# Run all unit tests
pnpm test

# Run unit tests in watch mode
pnpm test -- --watch

# Run specific test file
pnpm test src/gateway/server.test.ts

# Run tests matching a pattern
pnpm test -- --grep "gateway"
```

### 5.3 Running Gateway Tests

```bash
# Gateway tests use isolated test fixtures automatically
# (see src/gateway/test-helpers.server.ts)

pnpm test:gateway

# Or using vitest directly:
npx vitest run --config vitest.gateway.config.ts
```

### 5.4 Running E2E Tests

```bash
# E2E tests may require longer timeouts
pnpm test:e2e

# Run a specific e2e test
npx vitest run test/gateway.multi.e2e.test.ts --config vitest.e2e.config.ts
```

### 5.5 Running All Tests

```bash
# Full test suite (as CI runs it)
pnpm build && pnpm check && pnpm test

# Or the CI-equivalent:
pnpm run test:ci  # If defined in package.json
```

### 5.6 Test Coverage

```bash
# Generate coverage report
pnpm test -- --coverage

# Coverage report will be in coverage/
```

---

## 6. Manual Smoke Test Checklist

### 6.1 Basic Gateway Smoke Test

- [ ] Gateway starts without errors
- [ ] Gateway listens on expected port (18790)
- [ ] Health endpoint returns OK (`/health`)
- [ ] WebSocket connection succeeds
- [ ] Authentication works (token mode)
- [ ] Gateway responds to `health` RPC call
- [ ] Gateway responds to `system-presence` RPC call
- [ ] Graceful shutdown on SIGTERM

### 6.2 Session Management Smoke Test

- [ ] Create new session succeeds
- [ ] List sessions shows created session
- [ ] Session persistence across gateway restart (if not using temp dir)
- [ ] Session cleanup on delete

### 6.3 Agent Execution Smoke Test

- [ ] Agent responds to simple prompt
- [ ] Tool execution works (e.g., `read` tool)
- [ ] Tool errors are handled gracefully
- [ ] Token usage is tracked
- [ ] Session logs are written

### 6.4 Integration Smoke Tests (If Channels Enabled)

- [ ] Slack channel connects (if configured)
- [ ] Message received triggers agent
- [ ] Agent response sent to channel
- [ ] Reactions/threads work correctly

### 6.5 Node/Device Smoke Tests (If Nodes Available)

- [ ] Node can connect to gateway
- [ ] `node.list` shows connected node
- [ ] `node.invoke` executes command on node
- [ ] Node camera/screen capture works

### 6.6 Regression-Specific Tests

Based on the changes in the merged branch, add specific tests:

- [ ] **[Add specific test for feature/fix 1]**
- [ ] **[Add specific test for feature/fix 2]**
- [ ] **[Add specific test for edge case 1]**

---

## 7. Tear Down Test Environment

### 7.1 Stop Test Gateway

```bash
# If running in foreground: Ctrl+C

# If running in background:
kill $TEST_GATEWAY_PID 2>/dev/null || true

# Verify process is stopped
ps aux | grep "openclaw gateway" | grep -v grep || echo "Gateway stopped"
```

### 7.2 Clean Up Test State

```bash
# Remove test state directory
rm -rf "$TEST_STATE_DIR"

# Or if using profile:
rm -rf ~/.openclaw-test

# Clean up any temp files
rm -rf /tmp/openclaw-test-*
```

### 7.3 Remove Test Worktree

```bash
# Navigate out of the test worktree
cd /Users/openclaw/chat-builder-work

# Remove the test worktree
git worktree remove ../openclaw-test-branch --force

# Verify worktree is removed
git worktree list
```

### 7.4 Verify Production Gateway Is Unaffected

```bash
# Check production gateway is still running
openclaw gateway status

# Verify production port (default: 18789) is still bound
lsof -i :18789

# Quick smoke test of production gateway
curl -s http://127.0.0.1:18789/health | jq .
```

---

## 8. Troubleshooting

### 8.1 Port Already in Use

```bash
# Find what's using the port
lsof -i :18790

# Kill the process if it's a stale gateway
kill -9 <PID>

# Or use a different port
TEST_PORT=18791 openclaw gateway run --port 18791 ...
```

### 8.2 Config Not Loading

```bash
# Verify config path is correct
echo $OPENCLAW_CONFIG_PATH

# Check config is valid JSON
jq . "$OPENCLAW_CONFIG_PATH"

# Verify state dir exists
ls -la "$OPENCLAW_STATE_DIR"
```

### 8.3 Gateway Lock Error

The gateway uses a lock file to prevent multiple instances. If you see `GatewayLockError`:

```bash
# Find and remove stale lock files
rm -rf /tmp/openclaw-*/gateway.*.lock

# Or wait for lock to expire (stale after 30 seconds)
```

### 8.4 Tests Failing Due to Environment

```bash
# Ensure test environment is clean
unset OPENCLAW_PROFILE
unset OPENCLAW_STATE_DIR
unset OPENCLAW_CONFIG_PATH

# Run tests in isolation
npx vitest run --single-thread --config vitest.gateway.config.ts
```

### 8.5 Build Failures After Merge

```bash
# Clean build artifacts
rm -rf dist/ node_modules/.cache

# Reinstall dependencies
pnpm install

# Rebuild
pnpm build
```

---

## Appendix A: Environment Variables Reference

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENCLAW_PROFILE` | Named profile for isolation | `test` |
| `OPENCLAW_STATE_DIR` | State directory path | `/tmp/.openclaw-test` |
| `OPENCLAW_CONFIG_PATH` | Config file path | `/tmp/.openclaw-test/openclaw.json` |
| `OPENCLAW_GATEWAY_PORT` | Gateway listening port | `18790` |
| `OPENCLAW_GATEWAY_TOKEN` | Auth token override | `test-token` |
| `OPENCLAW_SKIP_CHANNELS` | Disable channel integrations | `1` |
| `OPENCLAW_SKIP_CRON` | Disable cron scheduler | `1` |
| `OPENCLAW_SKIP_PROVIDERS` | Alias for SKIP_CHANNELS | `1` |
| `OPENCLAW_SKIP_BROWSER_CONTROL_SERVER` | Disable browser control | `1` |
| `OPENCLAW_SKIP_CANVAS_HOST` | Disable canvas hosting | `1` |
| `OPENCLAW_SKIP_GMAIL_WATCHER` | Disable Gmail watcher | `1` |
| `OPENCLAW_TEST_MINIMAL_GATEWAY` | Minimal gateway for tests | `1` |
| `OPENCLAW_BUNDLED_PLUGINS_DIR` | Custom plugins directory | `/tmp/no-plugins` |
| `OPENCLAW_NIX_MODE` | Nix mode flag | `1` |

---

## Appendix B: Gateway CLI Quick Reference

```bash
# Start gateway (foreground)
openclaw gateway run --port 18790 --bind loopback --allow-unconfigured

# Start gateway with dev profile
openclaw --profile dev gateway run

# Check gateway status
openclaw gateway status

# Call gateway RPC
openclaw gateway call health --url ws://127.0.0.1:18790 --token <token>

# Stop gateway service
openclaw gateway stop

# Discover gateways on network
openclaw gateway discover

# Probe gateway reachability
openclaw gateway probe
```

---

## Appendix C: Related Files in Codebase

- **Gateway CLI**: `src/cli/gateway-cli/`
- **Gateway Server**: `src/gateway/server*.ts`
- **Gateway Config Types**: `src/config/types.gateway.ts`
- **Test Helpers**: `src/gateway/test-helpers.server.ts`, `src/gateway/test-helpers.mocks.ts`
- **E2E Test Examples**: `test/gateway.multi.e2e.test.ts`
- **Profile Isolation**: `src/cli/profile.ts`
- **Path Resolution**: `src/config/paths.ts`
- **Gateway Lock**: `src/infra/gateway-lock.ts`

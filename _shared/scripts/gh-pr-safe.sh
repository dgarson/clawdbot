#!/usr/bin/env bash
# gh-pr-safe.sh — Wrapper around `gh pr create` that blocks upstream PRs
#
# Drop this in PATH before `gh` or alias `gh` to use it.
# Alternatively, agents should use this instead of raw `gh pr create`.
#
# Usage: Same as `gh pr create` — all args are passed through.
# Safety: Blocks any --repo targeting openclaw/openclaw.

set -euo pipefail

# Check if any arg targets upstream
for arg in "$@"; do
  if [[ "$arg" == "openclaw/openclaw" ]]; then
    echo "❌ BLOCKED: Cannot open PRs against openclaw/openclaw (upstream)." >&2
    echo "   PRs must target dgarson/clawdbot (origin)." >&2
    echo "   Replace --repo openclaw/openclaw with --repo dgarson/clawdbot" >&2
    exit 1
  fi
done

# Pass through to real gh
exec gh "$@"

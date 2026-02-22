# Release Workflow

> Read when: publishing npm packages, releasing plugins, or cutting a changelog entry.
> **Also read:** `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` before any release work.

## Pre-Release Checks

```bash
node --import tsx scripts/release-check.ts
pnpm release:check
pnpm test:install:smoke   # or: OPENCLAW_INSTALL_SMOKE_SKIP_NONROOT=1 pnpm test:install:smoke
```

## NPM + 1Password Publish

All `op` commands and `npm publish` must run inside a fresh tmux session.

```bash
tmux new -s release-$(date +%Y%m%d-%H%M%S)
eval "$(op signin --account my.1password.com)"   # app unlocked + integration on

# Get OTP
op read 'op://Private/Npmjs/one-time password?attribute=otp'

# Publish from package dir
npm publish --access public --otp="<otp>"

# Verify (no local npmrc side effects)
npm view <pkg> version --userconfig "$(mktemp)"

# Kill tmux session after publish
```

## Plugin Release Fast Path (No Core Publish)

For releasing already-on-npm plugins only. Source list: `docs/reference/RELEASING.md` under "Current npm plugin list".

```bash
tmux new -d -s release-plugins-$(date +%Y%m%d-%H%M%S)
eval "$(op signin --account my.1password.com)"

# Per plugin: compare local version to npm; publish only if versions differ
npm view @openclaw/<name> version
npm publish --access public --otp="<otp>"   # only when versions differ

# Post-check
npm view @openclaw/<name> version --userconfig "$(mktemp)"
```

**Never** run publish from repo root unless explicitly requested.

## Changelog Release Notes

- User-facing changes only; no internal/meta notes (no version alignment, appcast reminders, release process)
- Keep top version entries sorted: `### Changes` first, then `### Fixes` (deduped, user-facing fixes first)
- Pure test additions/fixes: generally no changelog entry unless they alter user-facing behavior

## Mac Beta Release Tags

```bash
# Tag format: vYYYY.M.D-beta.N
# Release title: openclaw YYYY.M.D-beta.N
# Attach: OpenClaw-YYYY.M.D.zip + OpenClaw-YYYY.M.D.dSYM.zip (+ .dmg if available)
# Release notes: from CHANGELOG.md version section (Changes + Fixes, no title duplicate)
```

Release guardrail: **never change version numbers without operator's explicit consent.**
Always ask permission before any `npm publish` or release step.

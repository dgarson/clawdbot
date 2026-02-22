# Repository Guidelines — dgarson/clawdbot

Repo: https://github.com/openclaw/openclaw
GitHub comments: use literal multiline strings or `-F - <<'EOF'`; never embed `"\\n"`.

## Project Structure

- Source: `src/` (CLI `src/cli`, commands `src/commands`, web `src/provider-web.ts`, infra `src/infra`, media `src/media`)
- Tests: colocated `*.test.ts`
- Docs: `docs/`. Built output: `dist/`
- Plugins: `extensions/*` (workspace packages). Plugin deps in extension `package.json` only. Avoid `workspace:*` in `dependencies`; put `openclaw` in `devDependencies`/`peerDependencies`.
- Installers: sibling repo `../openclaw.ai` (`public/install.sh`, etc.)
- Channels: consider ALL built-in + extension channels when refactoring shared logic. Core: `src/{telegram,discord,slack,signal,imessage,web,channels,routing}`. Extensions: `extensions/*`. Docs: `docs/channels/`.
- New channels/extensions/apps/docs → update `.github/labeler.yml` + create matching labels.

## Docs (Mintlify)

- Hosted at docs.openclaw.ai. Internal links: root-relative, no `.md` (e.g., `[Config](/configuration)`).
- Cross-refs: anchors on root-relative paths. Avoid em dashes/apostrophes in headings (breaks anchors).
- External replies: full `https://docs.openclaw.ai/...` URLs. README: absolute URLs.
- Generic content only — no personal device names/paths. Read mintlify skill when working on docs.
- i18n: `docs/zh-CN/**` is generated. Pipeline: English → glossary → `scripts/docs-i18n`. See `docs/.i18n/README.md`.

## Build & Dev

- Node **22+**. Prefer Bun for TS execution (`bun <file.ts>`). Node for built output.
- `pnpm install` | `pnpm build` | `pnpm tsgo` | `pnpm check` | `pnpm format` / `pnpm format:fix`
- `pnpm test` (vitest) | `pnpm test:coverage` | `pnpm dev` | `pnpm openclaw ...`
- Pre-commit: `prek install`. Mac packaging: `scripts/package-mac-app.sh`.
- Missing deps? Run install, rerun once. Still fails? Report command + error.

## Coding Style

- TypeScript (ESM), strict typing, no `any`/`@ts-nocheck`. Oxlint + Oxfmt (`pnpm check`).
- No prototype mutation for class behavior — use explicit inheritance/composition.
- Brief comments for tricky logic. Files under ~700 LOC guideline. Extract helpers > "V2" copies.
- Naming: **OpenClaw** (product/headings), `openclaw` (CLI/package/paths/config).

## Testing

- Vitest, V8 coverage 70%. Match source names `*.test.ts`, e2e `*.e2e.test.ts`. Workers ≤16.
- Live: `CLAWDBOT_LIVE_TEST=1 pnpm test:live`. Docker: `pnpm test:docker:live-models`. Full: `docs/testing.md`.
- Changelog: user-facing changes only. Test-only additions don't need entries.
- Prefer real devices over simulators.

## Commits & PRs

- Commit via `scripts/committer "<msg>" <file...>`. Concise action-oriented messages.
- Full PR workflow: `.agents/skills/PR_WORKFLOW.md`. Templates: `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/`.
- `sync` = commit dirty, `git pull --rebase`, push.

## Release

- Channels: stable (`vYYYY.M.D`, npm `latest`), beta (`vYYYY.M.D-beta.N`, npm `beta`), dev (`main` HEAD).
- Pre-tag: `pnpm release:check`, `pnpm test:install:smoke`. Read `docs/reference/RELEASING.md` + `docs/platforms/mac/release.md`.
- Version locations: `package.json`, `apps/android/app/build.gradle.kts`, `apps/ios/Sources/Info.plist`, `apps/macos/.../Info.plist`, `docs/install/updating.md`, `docs/platforms/mac/release.md`. NOT `appcast.xml` (Sparkle releases only).
- No version changes without operator consent. No npm publish without permission.

## Security

- Creds: `~/.openclaw/credentials/`. Sessions: `~/.openclaw/sessions/`. Env vars: `~/.profile`.
- Never commit real phone numbers, videos, live config. Use fake placeholders.
- GHSA: read `SECURITY.md` first. Fetch/patch/publish via `gh api`. Write description via heredoc (no `"\\n"`). Verify `state=published`.

## Multi-Agent Safety

- No `git stash` create/apply/drop unless requested (includes `--autostash`)
- No worktree create/remove/modify unless requested
- No branch switching unless requested
- "push" → may `git pull --rebase` (never discard others' work). "commit" → scope to your changes. "commit all" → grouped chunks.
- Unrecognized files → keep going, commit only yours. Focus reports on your edits.
- Lint/format churn: auto-resolve formatting-only. Ask only for semantic changes.

## Agent Notes

- "makeup" = "mac app". Never edit `node_modules`.
- New `AGENTS.md` → also add `CLAUDE.md` symlink.
- CLI progress: `src/cli/progress.ts`. Status: `src/terminal/table.ts`. Palette: `src/terminal/palette.ts` (no hardcoded colors).
- Gateway: runs as menubar app only. Restart via app or `scripts/restart-mac.sh`. macOS logs: `./scripts/clawlog.sh`.
- SwiftUI: prefer `Observation` (`@Observable`) over `ObservableObject`.
- Connection providers: update all UI surfaces + docs + status/config forms.
- "Restart iOS/Android" = rebuild + relaunch. Device checks before simulators.
- Session files: `~/.openclaw/agents/<agentId>/sessions/*.jsonl`. No macOS rebuilds over SSH.
- No streaming/partial replies to external messaging (WhatsApp, Telegram). Final only.
- Tool schemas: no `Type.Union`/`anyOf`/`oneOf`. Use `stringEnum`/`Type.Optional`. No raw `format` property.
- Patched deps (`pnpm.patchedDependencies`): exact versions, no `^`/`~`. Patching requires approval.
- Never update Carbon dependency.
- Bug investigations: read dep source + local code before concluding.

## NPM Publish (1Password)

All `op` commands in fresh tmux. Sign in: `eval "$(op signin --account my.1password.com)"`. OTP: `op read 'op://Private/Npmjs/one-time password?attribute=otp'`. Publish from package dir. Verify: `npm view <pkg> version --userconfig "$(mktemp)"`. Kill tmux after.

Plugin fast path: release only already-on-npm plugins per `docs/reference/RELEASING.md`. Compare local vs npm version, publish only when different. Never publish from repo root.

## workq Inbox
You have a workq inbox. During any idle check or when triggered, call `workq_inbox_read`
to check for pending messages from other agents or the system. After processing each
message, call `workq_inbox_ack` with the message IDs — this is mandatory.


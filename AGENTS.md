# Repository Guidelines

> ## ⛔⛔⛔ ABSOLUTE HARD RULE — READ FIRST ⛔⛔⛔
>
> **NEVER open a pull request, create or edit issues, or perform any GitHub management actions against `github.com/openclaw/openclaw` (the public upstream). This is a zero-exception rule.**
>
> - All PRs go to `dgarson/clawdbot` (origin), targeting the megabranch (`feat/<project>`).
> - Issue management, comments, and reviews happen in `dgarson/clawdbot`, never in `openclaw/openclaw`.
> - If you are about to run any `gh` command targeting `openclaw/openclaw`, **stop immediately**.

- Repo: https://github.com/openclaw/openclaw
- GitHub issues/comments/PR comments: use literal multiline strings or `-F - <<'EOF'` (or `$'...'`) for real newlines; never embed `\n`.

## Project Structure & Module Organization

- Source: `src/` — CLI: `src/cli`, commands: `src/commands`, web provider: `src/provider-web.ts`, infra: `src/infra`, media: `src/media`. Tests: colocated `*.test.ts`. Docs: `docs/`. Built output: `dist/`.
- Extensions/plugins: `extensions/*` (workspace packages). Plugin-only deps stay in extension `package.json`. Runtime deps in `dependencies`; avoid `workspace:*` there — put `openclaw` in `devDependencies`/`peerDependencies` (runtime resolves via jiti alias).
- Installers: `../openclaw.ai` repo (`public/install.sh`, `public/install-cli.sh`, `public/install.ps1`).
- Channels: update **all** built-in + extension channels when refactoring shared logic. Core: `src/{telegram,discord,slack,signal,imessage,web,channels,routing}`; docs: `docs/channels/`. Extensions: `extensions/{msteams,matrix,zalo,zalouser,voice-call}`.
- When adding channels/extensions, update `.github/labeler.yml` and create matching GitHub labels.

## Docs Linking (Mintlify)

- Hosted on Mintlify (`docs.openclaw.ai`). Read the mintlify skill when working on docs.
- Internal links: root-relative, no `.md`/`.mdx` — e.g. `[Config](/configuration)`, `[Hooks](/configuration#hooks)`.
- Headings/anchors: avoid em dashes and apostrophes (break Mintlify anchor links).
- When Peter asks for links, use full `https://docs.openclaw.ai/...` URLs; append these to any reply where you touch docs.
- README: use absolute `https://docs.openclaw.ai/...` URLs (required for GitHub rendering).
- Content: no personal device names/hostnames; use placeholders like `user@gateway-host`.

## Docs i18n (zh-CN)

- `docs/zh-CN/**` is generated; do not edit unless explicitly asked.
- Pipeline: update English → adjust `docs/.i18n/glossary.zh-CN.json` → run `scripts/docs-i18n` → targeted fixes only if instructed. See `docs/.i18n/README.md`.
- If pipeline is slow, ping @jospalmbier on Discord; don't hack around it.

## exe.dev VM ops (general)

- Access: `ssh exe.dev` → `ssh vm-name`. SSH flaky: use web terminal or Shelley; keep tmux for long ops.
- Update: `sudo npm i -g openclaw@latest`. Config: `openclaw config set ...`; set `gateway.mode=local`. Discord token: raw only (no `DISCORD_BOT_TOKEN=` prefix).
- Restart: `pkill -9 -f openclaw-gateway || true; nohup openclaw gateway run --bind loopback --port 18789 --force > /tmp/openclaw-gateway.log 2>&1 &`
- Verify: `openclaw channels status --probe`, `ss -ltnp | rg 18789`, `tail -n 120 /tmp/openclaw-gateway.log`.

## Build, Test, and Development Commands

- Runtime: Node **22+**. Install: `pnpm install` (also `bun install`; keep `pnpm-lock.yaml` in sync).
- If deps are missing, run the PM install command and retry once; if still failing, report the command and first actionable error.
- Pre-commit hooks: `prek install`. Prefer Bun for TS execution: `bun <file.ts>` / `bunx <tool>`.
- Dev CLI: `pnpm openclaw ...` or `pnpm dev`. Node for built output (`dist/*`).
- Mac packaging: `scripts/package-mac-app.sh`. See `docs/platforms/mac/release.md`.
- Build/typecheck: `pnpm build` / `pnpm tsgo`
- Lint/format: `pnpm check` / `pnpm format` (check) / `pnpm format:fix` (write)
- Test: `pnpm test` (vitest); coverage: `pnpm test:coverage`

## Coding Style & Naming Conventions

- Language: TypeScript (ESM). Strict typing; no `any`. Run `pnpm check` before commits.
- Never add `@ts-nocheck` or disable `no-explicit-any`; fix root causes.
- No prototype mutation (`applyPrototypeMixins`, `Object.defineProperty` on `.prototype`, exporting `Class.prototype`). Use explicit inheritance/composition. Requires explicit approval if unavoidable.
- In tests, prefer per-instance stubs over prototype-level patching unless documented why.
- Brief comments for tricky logic. Files under ~700 LOC (guideline). Extract helpers; use existing CLI option and DI patterns (`createDefaultDeps`).
- Naming: **OpenClaw** for product/docs headings; `openclaw` for CLI, package, paths, config keys.

## Release Channels (Naming)

- stable: tagged releases only (e.g. `vYYYY.M.D`), npm dist-tag `latest`.
- beta: prerelease tags `vYYYY.M.D-beta.N`, npm dist-tag `beta` (may skip macOS app).
- dev: moving head on `main` (no tag).

## Testing Guidelines

- Framework: Vitest, V8 coverage ≥70% lines/branches/functions/statements. Files: `*.test.ts`; e2e: `*.e2e.test.ts`.
- Run `pnpm test` before pushing when you touch logic. Max 16 workers.
- Live tests: `CLAWDBOT_LIVE_TEST=1 pnpm test:live` (OpenClaw); `LIVE=1 pnpm test:live` (+ provider). Docker: `pnpm test:docker:{live-models,live-gateway,onboard}`. See `docs/testing.md`.
- Changelog: user-facing changes only. Pure test fixes don't need entries unless behavior changes.
- Mobile: prefer connected real devices over simulators.

## Commit & Pull Request Guidelines

**Full maintainer PR workflow:** `.agents/skills/PR_WORKFLOW.md` — triage, quality bar, rebase rules, conventions, `review-pr` > `prepare-pr` > `merge-pr`. Follow when no other workflow is specified.

- **⛔ Never target `main`** — always target the megabranch (`feat/<project>`). See `_shared/ops/safety-and-branch-rules.md`.
- Create commits via `scripts/committer "<msg>" <file...>`; avoid manual `git add`/`git commit`.
- Concise, action-oriented messages (e.g. `CLI: add verbose flag to send`). Group related changes.
- PR template: `.github/pull_request_template.md`. Issue templates: `.github/ISSUE_TEMPLATE/`.

## Shorthand Commands

- `sync`: if dirty, commit all (sensible Conventional Commit message), then `git pull --rebase`; stop on conflicts; otherwise `git push`.

## Git Notes

- Policy-blocked `git branch -d/-D`: use `git update-ref -d refs/heads/<branch>`.
- Bulk PR close/reopen affecting >5 PRs: confirm with user (exact count + scope) first.

## Security & Configuration Tips

- Web provider creds: `~/.openclaw/credentials/`; rerun `openclaw login` if logged out.
- Pi sessions: `~/.openclaw/sessions/` (not configurable). Env vars: `~/.profile`.
- Never commit real phone numbers, videos, or live config. Use obvious placeholders.
- Before any release: read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md`.

## GHSA (Repo Advisory) Patch/Publish

Read `SECURITY.md` first, then follow `_shared/ops/ghsa-workflow.md`.

## Troubleshooting

- Rebrand/migration issues or legacy warnings: `openclaw doctor` (see `docs/gateway/doctor.md`).

## Agent Ops Reference

Shared operational protocols in `_shared/ops/`. Read `_shared/ops/index.md` first.

| File | Read when |
| --- | --- |
| `_shared/ops/safety-and-branch-rules.md` | **Required** at task start — branch/safety rules |
| `_shared/ops/worker-workflow.md` | Any IC task — megabranch → branch → PR → notify |
| `_shared/ops/megabranch-workflow.md` | Creating/managing megabranches |
| `_shared/ops/review-protocol.md` | Handling PR review feedback |
| `_shared/ops/sessions-spawn.md` | Delegating via sessions_spawn/send |
| `_shared/ops/blocker-escalation.md` | Reporting blockers |
| `_shared/ops/memory-discipline.md` | Daily notes, curating MEMORY.md |
| `_shared/ops/audio-reports.md` | TTS reports |
| `_shared/ops/release-workflow.md` | NPM publish, plugin release, changelog |
| `_shared/ops/org-hierarchy.md` | Org structure, escalation paths |
| `_shared/MEGA_BRANCHES.md` | Active megabranches registry |
| `_shared/WORK_PROTOCOL.md` | Cross-agent coordination protocol |
| `_shared/WORKBOARD.md` | Active workboard |

## Agent-Specific Notes

- Vocabulary: "makeup" = "mac app". Never edit `node_modules`. Skill notes go in `tools.md` or `AGENTS.md`.
- When adding a new `AGENTS.md`: `ln -s AGENTS.md CLAUDE.md`.
- Signal "update fly": `fly ssh console -a flawd-bot -C "bash -lc 'cd /data/clawd/openclaw && git pull --rebase origin main'"` then `fly machines restart e825232f34d058 -a flawd-bot`.
- Print the full URL at the end of any GitHub Issue or PR task.
- High-confidence answers only: verify in code; do not guess. Bug investigations: read source of relevant npm deps and local code before concluding.
- Never update the Carbon dependency.
- Patched deps (`pnpm.patchedDependencies`): exact versions (no `^`/`~`). Patching requires explicit approval.
- CLI progress: `src/cli/progress.ts` (`osc-progress` + `@clack/prompts`); no hand-rolled spinners. Status: `src/terminal/table.ts`; `status --all` = read-only, `status --deep` = probes.
- macOS gateway: menubar app only (no LaunchAgent). Restart via app or `scripts/restart-mac.sh`; verify/kill: `launchctl print gui/$UID | grep openclaw`. No ad-hoc tmux; kill tunnels before handoff. Logs: `./scripts/clawlog.sh` (passwordless sudo for `/usr/bin/log`).
- Follow shared guardrails if available locally; otherwise this repo's guidance applies.
- SwiftUI: prefer `@Observable`/`@Bindable`; no new `ObservableObject`; migrate existing when touching related code.
- New connections: update all UI surfaces + docs (macOS, web, mobile, onboarding) and add status + config forms.
- Version locations: see `_shared/ops/version-locations.md`. "Bump everywhere" excludes `appcast.xml` (only for Sparkle releases).
- iOS/Android "restart" = rebuild + reinstall + relaunch (not kill/relaunch). Prefer real devices over simulators.
- iOS Team ID: `security find-identity -p codesigning -v`. Fallback: `defaults read com.apple.dt.Xcode IDEProvisioningTeamIdentifiers`.
- A2UI bundle hash (`src/canvas-host/a2ui/.bundle.hash`): auto-generated; regenerate via `pnpm canvas:a2ui:bundle` when needed; commit separately.
- Release signing/notary: keys managed outside repo. Notary env vars: `APP_STORE_CONNECT_ISSUER_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_API_KEY_P8`.
- Tool schema guardrails: no `Type.Union`/`anyOf`/`oneOf`/`allOf`; use `stringEnum`/`optionalStringEnum`, `Type.Optional`. No raw `format` key. Top-level: `type:"object"` with `properties`.
- Session files: `~/.openclaw/agents/<agentId>/sessions/*.jsonl` (newest unless specified; SSH via Tailscale for remote).
- No macOS rebuilds over SSH. Never stream partial replies to WhatsApp/Telegram — final only.
- Voice wake: command stays `openclaw-mac agent --message "${text}" --thinking low` (already shell-escaped). launchd PATH must include `$HOME/Library/pnpm`.
- `openclaw message send` with `!`: use heredoc to avoid escaping. No version bumps without explicit consent; ask before any publish/release step.
- Lobster seam: `src/terminal/palette.ts` (no hardcoded colors); apply to onboarding/config prompts.
- Lint/format churn: auto-resolve formatting-only diffs; include in same commit if already committing. Only ask for semantic changes.

### Multi-agent safety

- No `git stash` ops (including `--autostash`), worktree create/remove/modify, or branch switching unless explicitly requested.
- "push": `git pull --rebase` first (never discard others' work). "commit": your changes only. "commit all": grouped chunks.
- Unrecognized files: keep going; commit only yours; note "other files present" only if relevant.
- Focus reports on your edits; skip guardrail disclaimers unless blocked. Multiple agents OK per session.

## Release (NPM Publish, Plugins, Changelog)

> **Full workflow:** `_shared/ops/release-workflow.md`. Always read `docs/reference/RELEASING.md` and `docs/platforms/mac/release.md` before release work.

## Merlin — Task Delegation (Orchestration)

> **Full protocol:** `_shared/ops/sessions-spawn.md` — sessions_spawn vs sessions_send, when to spawn, syntax, monitoring, inbox management.

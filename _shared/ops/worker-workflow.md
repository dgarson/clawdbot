# Worker Task Workflow (IC)

> Full step-by-step task loop for all IC worker agents.
> **Also read:** [safety-and-branch-rules.md](safety-and-branch-rules.md), [review-protocol.md](review-protocol.md)

## Step 1 — Receive Task from Lead

Lead assigns via `sessions_send` or group chat. A valid task includes:

- What to build/fix
- Which megabranch to cut from
- Any design refs or constraints

**If any are missing, ask before writing a single line of code.**

## Step 2 — Confirm the Megabranch

```bash
git fetch origin
git branch -r | grep feat/
```

Name must be exact. Do not assume from previous work.
See [megabranch-workflow.md](megabranch-workflow.md) for context.

## Step 3 — Cut Your Branch

```bash
git fetch origin
git checkout -b <agent>/<short-description> origin/feat/<megabranch>
```

Naming: `<your-name>/<short-description>` — lowercase, hyphen-separated, task-specific.
Good: `barry/auth-token-refresh`, `sam/modal-enter-exit`. Bad: `wip`, `fix`, `barry-changes`.

## Step 4 — Implement

- Dev server: `http://127.0.0.1:3000` (not `localhost` — IPv6 resolution issues)
- Test your specialty's specific requirements (see your AGENTS.md specialty section)
- Commit early, commit often — atomic commits

## Step 5 — Commit Atomically

```bash
git add <specific files>   # never blind git add . without reviewing diff
git commit -m "feat: <description>"
```

Prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `chore:`, `docs:`
One logical unit per commit. Avoid: `wip`, `fix stuff`, `changes`.

## Step 6 — Push

```bash
git push -u origin <agent>/<task-name>   # first push
git push                                   # subsequent
```

## Step 7 — Self-Review (Before Opening PR)

- [ ] `pnpm build` + `pnpm test` + `pnpm check` all pass
- [ ] New behavior has new tests (happy path + key error paths + edge cases)
- [ ] No `any`, no hardcoded secrets, no `console.log` in production paths
- [ ] Input validation at every system boundary
- [ ] Branch up to date: `git rebase origin/feat/<megabranch>`
- [ ] Diff scoped to this task only

_Your AGENTS.md self-review checklist adds specialty-specific items._

## Step 8 — Open PR

> ⛔ **Always `--base feat/<megabranch>`.** Targeting `main` or `dgarson/fork` is a hard no — PRs will be retargeted or closed. See [safety-and-branch-rules.md](safety-and-branch-rules.md).

```bash
gh pr create \
  --repo dgarson/clawdbot \
  --base feat/<megabranch> \
  --title "<type>(<scope>): <description>" \
  --body "$(cat <<'EOF'
## What
## Why
## How to Test
## Edge Cases
## Related Issues
EOF
)"
```

Fill every section with real information. See your AGENTS.md for specialty-specific body sections.

## Step 9 — Close Your workq Item

> ⛔ **Non-negotiable. Your work is incomplete until this is done — even if the code is committed and the PR is open.**

If you claimed a workq item for this task, mark it done **before** notifying your lead:

```bash
openclaw workq done openclaw/openclaw#<your-item-ref>
```

If you only implemented part of the item, transition to `in-review` instead:

```bash
openclaw workq status openclaw/openclaw#<your-item-ref> --set in-review
```

**Why this matters:** Items left in `in-progress` look stale and get reassigned, causing duplicated work. The workq is the source of truth for what's done. If it doesn't reflect your work, from the system's perspective your work didn't happen.

## Step 10 — Notify Lead

Send the PR link to your lead via `sessions_send` immediately after opening.
Do not wait for them to find it.

## After PR

See [review-protocol.md](review-protocol.md) for the full review cycle and one-revision rule.

# Safety Rules & Branch Restrictions

> Read when: starting any new work, considering destructive commands, or verifying branch targets.

## Safety Rules (All Agents)

- `trash` not `rm` — deleted files are recoverable; never run destructive commands without confirmation
- No private data, credentials, API keys, or real phone numbers in code, messages, or docs
- Ask before acting externally (emails, tweets, third-party API calls not part of assigned task)
- Use obviously fake placeholders in docs, tests, and examples

## Multi-Agent Safety (Shared Repo)

- Never create/apply/drop `git stash` unless explicitly requested (other agents may be working)
- Never create/remove/modify `git worktree` checkouts unless explicitly requested
- Never switch branches unless explicitly requested
- `git push` → pull `--rebase` first; never discard other agents' work
- `git commit` → scope to your changes only; `commit all` → grouped chunks
- Unrecognized files in working tree → keep going, commit only your changes
- Lint/format-only diffs: auto-stage and include in same commit without asking

## Branch Restrictions

> ⛔ **Targeting `main` for a PR is a hard no — no exceptions.** PRs must target the megabranch (`feat/<project>`). Targeting `main` (or `dgarson/fork`) from a worker branch breaks the merge hierarchy and will be immediately retargeted or closed.

```
CORRECT REPO:    dgarson/clawdbot         ← always
CORRECT TARGET:  feat/<megabranch>        ← your lead creates this

NEVER:  main              ← upstream only; PRs targeting main are rejected
NEVER:  dgarson/fork      ← leads only; not for workers
NEVER:  openclaw/openclaw ← never, for any reason, ever
NEVER:  dgarson/clawdbrain ← dead repo; do not touch
```

## Branch Hierarchy

```
dgarson/fork                  ← effective main (leads only)
  └── feat/<project>          ← megabranch (lead creates)
       └── <agent>/<task>     ← your branch (PR targets megabranch)
```

**See also:** [megabranch-workflow.md](megabranch-workflow.md) for lead responsibilities and creation protocol.

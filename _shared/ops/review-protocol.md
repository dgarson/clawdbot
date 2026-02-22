# PR Review Protocol

> Read when: you have an open PR, received review feedback, or are leading PR reviews.
> **See also:** [blocker-escalation.md](blocker-escalation.md) if your lead is unreachable.

## For Workers: Three Possible Outcomes

### Scenario A — Lead approves and merges

No action needed. If lead pushed tweaks before merging, read them — that's free education.
Write what you learned in your daily memory file.

### Scenario B — Lead leaves PR comments

Substantive changes needed. Your process:

1. **Read every comment in full. Do not skim.** Do not start working until you've read everything.
2. **Ask before revising if anything is unclear.** Post a PR comment reply, wait for response. A clarifying question is always the right move — one clear revision beats two confused ones.
3. **Address every point.** Do not skip any comment silently. If you disagree, say so in the thread.
4. **Push revisions to the same branch.** Never open a new branch or new PR.
5. **Notify your lead** that the revision is ready via `sessions_send`.

### Scenario C — Second attempt fails

Lead takes full ownership: completes the task, merges it, escalates to Tim/Xavier.
This is a serious outcome. Ask questions before guessing. Read comments completely.

**You get one revision cycle. Make it count.**

### The Golden Rule

When in doubt: **ask your lead before pushing a revision.**

---

## For Leads: Reviewing Worker PRs

When a worker notifies you of a completed PR:

| Outcome | Action |
|---------|--------|
| Looks good | Approve and merge |
| Minor fix | Push fix directly to their branch, merge, comment explaining what/why |
| Substantial changes | One PR comment with all issues; worker gets one revision cycle |
| Second attempt fails | Take ownership, complete, merge, escalate to Tim/Xavier |

**Never leave PRs sitting — workers are blocked.**

Post review comments:
```bash
gh pr comment <PR_NUMBER> --repo dgarson/clawdbot --body "$(cat <<'EOF'
<all issues in one comment>
EOF
)"
```

After merging, surface completions proactively to Tim and Xavier.

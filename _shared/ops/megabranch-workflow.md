# Megabranch Workflow

> Read when: starting a workstream (leads) or confirming your megabranch before coding (workers).
> **Registry:** [../MEGA_BRANCHES.md](../MEGA_BRANCHES.md) — canonical source of truth for all active branches.

## For Workers: Before Writing Any Code

1. Ask your lead for the megabranch name if not provided in your task
2. Verify it exists: `git fetch origin && git branch -r | grep feat/`
3. Cut from it: `git checkout -b <agent>/<task> origin/feat/<megabranch>`

Getting this wrong wastes time and can corrupt the integration branch.

---

## For Leads: Creating a Megabranch

### When Required

**Required for:**
- Any new workstream (multi-PR feature, system, cross-cutting initiative)
- Any new POC or MVP — even exploratory

**Not required for:**
- Single-PR bug fixes or hotfixes
- Minor documentation updates
- Work you're contributing as a worker under someone else's megabranch

### Create the Branch

```bash
# Branch from dgarson/fork — NEVER from main
git fetch origin
git checkout -b feat/<project-name> origin/dgarson/fork
# also: poc/<name>, mvp/<name>, <lead>/<project>
git push origin feat/<project-name>
```

### Immediately After Creating — 3 Mandatory Steps

1. **Register it** — add a row to `_shared/MEGA_BRANCHES.md`
2. **Create workstream file** — `mkdir -p _shared/workstreams/<name>` then fill out `WORKSTREAM.md`
   (template is in `_shared/MEGA_BRANCHES.md`)
3. **Notify all squad members** of the branch name before they write a single line of code

### Registry Maintenance (Mandatory)

Update `_shared/MEGA_BRANCHES.md`:
- When creating (add row)
- When status changes (update row)
- When merged to `dgarson/fork` (move to Completed table)

An unregistered branch doesn't officially exist.

### Reviewing Workers' PRs Into Your Megabranch

See [review-protocol.md](review-protocol.md) for the full review cycle.

---

## Megabranch → dgarson/fork (Final Integration)

When all squad work is merged into your megabranch:
1. PR megabranch → `dgarson/fork`
2. Surface to Tim (VP Architecture) + Xavier (CTO) via `sessions_send` or #cb-inbox
3. After confirmed merge → delete `_shared/workstreams/<name>/` directory

❌ Do NOT delete workstream file when PR is opened
❌ Do NOT delete when ready for David's review
✅ Delete AFTER merge commit is confirmed on `dgarson/fork`

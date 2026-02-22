# MEGA_BRANCHES.md — Canonical Mega-Branch Registry

_Last updated: 2026-02-21 23:08 MST — Tim_

**This file is the single source of truth for all active mega-branches.**

## ⚠️ Registry Maintenance Is Mandatory

Every **designated mega-branch owner** (Tim, Luis, Claire, Xavier) MUST keep this file current:

- **Add a row** immediately when creating a new mega-branch
- **Update status** as the workstream progresses
- **Move to Completed** when the mega-branch is merged to `dgarson/fork`

If a mega-branch is not in this file, it doesn't officially exist. Treat an unregistered branch as a protocol violation.

---

## Active Mega-Branches

| Branch                 | Owner           | Deliverable                                                                                                      | Status                                                           | Workstream File                                                                                                                              | PR      |
| ---------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| `observability/main`   | Xavier + Merlin | Full observability stack: OTel tracing, Prometheus metrics, Jaeger, Loki, Grafana, A/B framework, regression CLI | 🔴 P0 — agents spawned 23:02 MST, all 6 sub-branches in-progress | [`_shared/workstreams/observability/WORKSTREAM.md`](/Users/openclaw/.openclaw/workspace/_shared/workstreams/observability/WORKSTREAM.md)     | pending |
| `acp`                  | Tim             | ACP — Agent Communication Protocol (A2A messaging infrastructure)                                                | 🟡 P1 implementation in progress                                 | [`_shared/workstreams/acp/WORKSTREAM.md`](/Users/openclaw/.openclaw/workspace/_shared/workstreams/acp/WORKSTREAM.md)                         | —       |
| `luis/ui-redesign`     | Luis            | Horizon UI v2 — Production frontend rebuild (Vite 7/React 19/TanStack/Radix)                                     | 🟠 PR pending → `dgarson/fork`                                   | [`_shared/workstreams/horizon-ui-v2/WORKSTREAM.md`](/Users/openclaw/.openclaw/workspace/_shared/workstreams/horizon-ui-v2/WORKSTREAM.md)     | —       |
| `feat/workq-extension` | Tim             | workq extension integration + dual-purpose inbox expansion                                                       | 🟡 Integration in progress                                       | [`_shared/workstreams/workq-extension/WORKSTREAM.md`](/Users/openclaw/.openclaw/workspace/_shared/workstreams/workq-extension/WORKSTREAM.md) | —       |

---

## Needs Mega-Branch

Workstreams with active work but no registered mega-branch. Owner must create the branch, register it, and create a workstream file before any squad work begins.

| Workstream            | Designated Owner | Priority | Blocker                                                          |
| --------------------- | ---------------- | -------- | ---------------------------------------------------------------- |
| Session Summarization | Tim + Xavier     | P1       | Awaiting architecture decision (SUM-01) before workstream scoped |

> **Note:** Telemetry Extension (PR #47) is now part of `observability/main`. No separate mega-branch needed.

---

## How to Create a New Mega-Branch

**Triggers — a new mega-branch is REQUIRED for:**

- Any new **workstream** (multi-PR feature, system, or component)
- Any new **POC or MVP** (even exploratory)
- Any new **major deliverable** you are leading

**Triggers — a new mega-branch is NOT required for:**

- Single-PR bug fixes or hotfixes
- Minor documentation updates
- Changes you're contributing as a worker under someone else's mega-branch

### Step-by-step

```bash
# 1. Create the branch from dgarson/fork — NEVER from main
git fetch origin
git checkout -b feat/<project-name> origin/dgarson/fork
# or: poc/<name>, mvp/<name>
git push origin feat/<project-name>

# 2. Immediately update this registry (add row to Active table above)

# 3. Create the workstream file
mkdir -p /Users/openclaw/.openclaw/workspace/_shared/workstreams/<project-name>
# Fill out WORKSTREAM.md (see template below)

# 4. Notify all agents who will touch this workstream — tell them the branch name
#    before a single line of code is written
```

### Naming conventions

- `feat/<project-name>` — new feature or system
- `poc/<name>` — proof of concept, exploratory
- `mvp/<name>` — minimum viable product
- `<lead>/<project>` — acceptable alternative when project is lead-specific (e.g. `luis/ui-redesign`)

---

## Workstream File Lifecycle

**Create:** `_shared/workstreams/<name>/WORKSTREAM.md` — the moment you create the mega-branch.

**Update:** Keep it current as design decisions are made, strategy shifts, or tasks change. This is a living document.

**Delete:** Delete `_shared/workstreams/<name>/WORKSTREAM.md` — and the entire `_shared/workstreams/<name>/` directory — ONLY when the mega-branch is **confirmed merged into `dgarson/fork`**.

❌ Do NOT delete it when the PR is opened.
❌ Do NOT delete it when it's ready for David's review.
✅ Delete it AFTER the merge commit is confirmed on `dgarson/fork`.

### Workstream file template

```markdown
# WORKSTREAM.md — <Project Name>

_Mega-branch:_ `feat/<name>`
_Owner:_ <Lead agent name>
_Created:_ YYYY-MM-DD
_Last updated:_ YYYY-MM-DD

## Deliverable

What this workstream produces. One paragraph, clear scope statement.

## Design

Key design decisions made. Constraints. Architecture approach.
Reference detailed specs by absolute path: `/Users/openclaw/.openclaw/workspace/_shared/specs/...`

## Strategy

Phased approach. Dependencies. Sequencing rationale.

## Tasks & Status

Current task breakdown and status. Link to WORKBOARD.md entries if tracked there:
`/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md`

| Task | Owner | Status | Notes |
| ---- | ----- | ------ | ----- |
| ...  | ...   | ...    | ...   |

## Squad

Which agents are working on this workstream and what they own.

## Open Questions / Blockers

Anything unresolved that could affect direction.
```

---

## Completed / Archived

| Branch         | Owner | Deliverable                                                | Merged                        | Notes                                                         |
| -------------- | ----- | ---------------------------------------------------------- | ----------------------------- | ------------------------------------------------------------- |
| `a2a-protocol` | Tim   | A2A Protocol — initial agent-to-agent messaging foundation | 2026-02-21 (PR #43 in-review) | Superseded by `acp` for protocol evolution; foundation merged |

# MEMORY.md — Joey (Principal TPM)

Persistent notes and planning decisions learned over time.

## Role & Scope

- **Principal TPM** at OpenClaw — roadmap, sprint planning, dependencies, milestone management, product ideation
- **Reports to:** Xavier (CTO)
- **QM pipeline co-lead** with Julia (CAO) — highest David priority, Q1 2026

## Active Quarter: Q1 2026

### Quarterly Milestone Status (as of 2026-02-22)

| QM  | Name                                  | Lead(s)                         | Target   | Status           |
| --- | ------------------------------------- | ------------------------------- | -------- | ---------------- |
| QM1 | Reliable Agent Execution Plane        | Tim + Xavier                    | End Feb  | Active — P0 bugs |
| QM2 | Agent Coordination Layer Phase 1      | Xavier + Tim                    | Mid-Mar  | Planning         |
| QM3 | Delivery Integrity & Queue Governance | Joey + Julia                    | Late Mar | Active           |
| QM4 | Senior Review Gate Normalization      | Julia + Joey                    | End Mar  | Active (partial) |

### Autonomy Grade
- Current: **C+** (Julia audit, Feb 21)
- Target: **B+** by end of week 1

## Key Decisions & Context

### Sprint Retros

**Week of Feb 20–22:**
- 4 PRs merged: #36 (cron threading), #34 (async delegation), #33 (DAG queries), #29 (session list UX)
- A2A Protocol (#37–41) merged into mega-branch
- 14 open PRs remain — primary bottleneck is Tim/Xavier review velocity

### Planning Principles

- David reviews mega-branches only — squad leads own constituent PRs
- Merge Authority Matrix: Tim/Xavier can merge #43/#44/#47 without David
- Never escalate to David what a lead can decide
- Discovery system runs every Monday at 10 AM (first run: Feb 23)

### Standing David Action Items (as of Feb 22)

1. Brave API key — CRITICAL for discovery
2. #23264 severity decision (Keychain overwrite)
3. PR #48 intent (targets main)
4. OAuth OnboardingFlow go/no-go

## Preferences & Working Style

- Status-first communicator — bottom line up front, then detail
- Written standups to #cb-inbox (not audio, per HEARTBEAT.md)
- Audio reports only for synthesis/digest content
- Never spam David — route through Xavier/Merlin

## _shared Doc References

| Doc | When to read |
| --- | --- |
| `_shared/WORKBOARD.md` | Every session — primary task surface |
| `_shared/MEGA_BRANCHES.md` | Track branch ownership and status |
| `_shared/AUTONOMY_EVOLUTION.md` | QM pipeline framework |
| `_shared/WORK_PROTOCOL.md` | Before any git/PR work |
| `_shared/ops/org-hierarchy.md` | Escalation decisions |
| `_shared/ops/sessions-spawn.md` | When delegating to sub-agents |
| `_shared/ops/memory-discipline.md` | How to maintain daily memory |
| `_shared/ops/audio-reports.md` | TTS report format |
| `_shared/ops/worker-workflow.md` | Git worktree + PR conventions |

---

_Updated: 2026-02-22_

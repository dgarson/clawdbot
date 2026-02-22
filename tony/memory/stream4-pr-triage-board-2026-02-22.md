# Stream 4 Open PR Triage Board
**Generated:** 2026-02-22 00:15 MST (auto-enumerated)

## Open PR Classification (all current open PRs)

| PR | Owner | Lane | Next Action | Blocker |
|---|---|---|---|---|
| #54 `feat(workq): integrate workq extension into repo` | David (branch: `feat/workq-extension`) | staff-merge | Merge extension scaffolding + run extension unit tests, then staff review. | No explicit blocker; pending review.
| #53 `chore(issue-tracking): add missing runtime deps` | Tony | staff-merge | Validate `extensions/issue-tracking` package install path and lockfile sanity; then merge to `dgarson/fork`. | No blocker.
| #52 `docs(tools): clarify sessions spawn vs send guidance` | Claire | staff-merge | Run docs lint/markdown checks, then merge when wording approved. | No blocker.
| #51 `fix(issue-tracking): dedupe appended references and relationships` | Sandy | staff-merge | Run issue-tracking tests and verify dedupe behavior in CI-like inputs. | No blocker.
| #25 `feat: slack interactive input block support` | David (branch: `feat/slack-interactive-input`) | staff-merge | Run slack action/input regression tests and merge if green. | No blocker.
| #43 `feat(a2a): A2A Protocol — Mega-branch consolidation` | David (owner-led mega branch) | architect-review | Review protocol/schema/API changes against session model; align with impacted callers. | High-impact interface change; requires architecture sign-off before merge.
| #42 `Exec: add deterministic gh/git guardrails` | Codex | architect-review | Execute `bash` command-path test matrix and confirm no regressions in agent command tooling. | No blocker; needs owner review.
| #48 `Scaffold minimal multi-agent integration test` | Tim | architect-review | Finalize integration-test shape and wire into merge checks before review. | No blocker.
| #47 `feat: Telemetry Extension — Phase 1 (structured event capture)` | Xavier | architect-review | Sync event schema contract with downstream consumers; run observability smoke tests. | Needs coordination with PR #46 on shared observability paths.
| #46 `feat(utee): Phase 1 observability pass-through adapter layer` | Sandy | architect-review | Rebase/fix for adapter API alignment with PR #47 and add integration tests. | Needs coordination with PR #47.
| #35 `feat: ACP Handoff skill — automatic completion-to-review handoff` | Merlin | architect-review | Validate handoff scripts against ACP/agent lifecycle and run end-to-end dry-run. | No blocker.
| #31 `feat: subagent delegation during voice calls to maintain responsiveness` | Codex | architect-review | Resolve merge conflicts, then run async broker + call flow regression tests. | Merge-conflicting with base (`CONFLICTING`, needs conflict resolution).
| #49 `Luis/UI redesign feb 21 10pm` | Luis | architect-review | Merge latest UI redesign state, resolve conflicts, and explicitly supersede/close duplicate PR #44. | Merge-conflicting (`CONFLICTING`) and overlapping scope with PR #44.
| #44 `feat(ui): UI Redesign mega-branch — agent graph, chat builder, activity heatmap, Monaco editor, UX polish` | Luis | architect-review | Confirm canonical branch/version, close if superseded by PR #49, else rebase and re-submit with clear scope. | Merge-conflicting (`CONFLICTING`) and likely duplicate with PR #49.

## Top 3 Bottlenecks + Immediate Resolution Actions

1. **Merge conflicts on architect-review items (#31, #44, #49)**
   - **Impact:** Blocked at `mergeable=CONFLICTING`; slows all downstream staff/architect queues.
   - **Action (today):** Owners must rebase these PRs, resolve conflicts, and report a clean `MERGEABLE` state before end-of-day.

2. **Duplicate UI redesign stream (#44 and #49)**
   - **Impact:** Review ambiguity and duplicated review effort across the same file surface.
   - **Action (today):** Declare one canonical PR (prefer #49 as latest timestamp), close or retarget the other, and keep only one review lane.

3. **Cross-PR coupling in observability lane (#46 + #47)**
   - **Impact:** Shared schema/integration surface creates sequencing risk and possible rework.
   - **Action (today):** Merge or coordinate in order: #47 contract first -> #46 adapter, with a joint review owner and explicit dependency note on both PRs.

## Notes
- All PRs now have explicit owner and lane.
- No current PR has explicit code review requests/assignees yet; owners are inferred from branch naming where possible and should be converted to explicit GitHub assignees in PR UI if needed.

# BACKLOG.md — Prioritized Ideas & Suggestions

*Last updated: 2026-02-22 12:03 MST*
*Auto-populated by cron (every 3h) + manually curated by Merlin*

---

## How This Works

Items gathered from: daily memory files, GitHub activity, conversation patterns, heartbeat observations, system status, and agent output. Priorities:

- **P0** — Do now / blocking something
- **P1** — Do soon / high impact
- **P2** — Do when time allows / nice to have
- **P3** — Someday / exploratory

---

## Active Items

### P0 — Brave API Key: Wave 1 Fired BLIND — Waves 2 & 3 Still Salvageable ⚠️
Web search disabled for all 15 discovery agents. Wave 1 (10AM MST) already ran without it. Waves 2 (2PM) and 3 (7PM) still benefit from a fix today. 30-min fix — requires David to configure NOW.
*Source: Stephan + Julia pre-flight; memory 2026-02-22 11:49 AM; 4th+ escalation*

### P0 — PR #72: Potential Hardcoded Brave API Key in PR Notes — CRITICAL
Morning brief flagged PR #72 (`feat/horizon-post-merge`, DiscoveryRunMonitor) may contain a hardcoded Brave API key in PR notes/body. Requires immediate review before further exposure. David action required.
*Source: Morning brief (main heartbeat session), 2026-02-22 09:26 AM*

### P1 — PR #68: Tool Reliability — Needs Review Before Wave 2/3
`feat(agents): non-Anthropic tool-call validation + repair layer`. Xavier pushed `roman/tool-reliability` branch. Merging before Wave 2 (2PM) would improve discovery run quality. Covers MiniMax M2.5, GLM-5, Grok 4 quirks.
*Source: Xavier Cycle #10; PR #68 opened 2026-02-22 ~14:30Z*

### P1 — PR #71: Workq Enforcement — Needs Review
`workq enforcement: session-end auto-release + stale sweep + commit footer parsing`. Tim pushed `tim/bs-wq-enforce`. Adds session-end auto-release for workq items, stale sweep, and commit footer parsing. Important for multi-agent reliability.
*Source: GitHub PR list, 2026-02-22 15:40Z*

### P1 — PR #70: dm.policy Migration Idempotency Fix — Open
`fix(doctor): make dm.policy migration idempotent`. Tim pushed `fix/dm-policy-migration-idempotency`. Fixes the `channels.slack.dm.policy → channels.slack.dmPolicy` re-trigger on every CLI call. Ready for review.
*Source: Xavier brainstorm → Tim Cycle #11; PR opened 2026-02-22 15:49Z*

### P1 — PR #72: DiscoveryRunMonitor — New, Needs Review
`feat(ui): DiscoveryRunMonitor — pre-flight dashboard for Feb 23 discovery run`. New view on `feat/horizon-post-merge` with pre-flight checklist, wave cards with live countdowns, agent table. Luis built it. Needs David review. **Also see P0 above re: possible hardcoded key.**
*Source: GitHub PR #72, 2026-02-22 18:13Z*

### P1 — PR #62: DAG Integration Tests — Open, Needs Review
`test(issue-tracking): add comprehensive DAG tests`. Recovered and finalized DAG tests covering direction, maxDepth, relationshipKinds, includeOrphans, and root ids. Branch `test-issue-tracking-dag`. Needs merge.
*Source: GitHub PR list, 2026-02-22*

### P1 — PR #43: A2A Protocol Mega-Branch — Codex Sweep Required Before Merge
Tim's heartbeat explicitly flagged: PR #43 needs a Codex 5.3 Medium/High sweep before final architecture review. `workq_inbox_read` command also broken in Tim's runtime (see P2). Awaits David final review + Codex sweep first.
*Source: Tim heartbeat, 2026-02-22 12:02Z; PR #43 updated 2026-02-22 15:24Z*

### P1 — Robert (CFO) Agent: Gemini Quota Exhausted
Robert's agent (`gemini-3.1-pro-preview`) hitting `429 RESOURCE_EXHAUSTED` — daily quota at 0. Agent unable to run heartbeats or tasks. Needs either quota increase, billing fix, or model swap.
*Source: sessions_list, 2026-02-22 12:03Z*

### P1 — `openclaw doctor --fix`: Dual State Directories
`/Users/dgarson/.openclaw` + `~/.openclaw` splitting session history. Consolidate to single canonical state dir. Separate from dm.policy fix (PR #70).
*Source: `openclaw doctor` output, 2026-02-22 04:39*

### P1 — PR #54: Workq Extension Integration — Needs Review
`feat(workq): integrate workq extension into repo`. Formal integration of workq plugin into main repo tree. Significant scope — needs David/Tim sign-off on inclusion strategy.
*Source: GitHub PR list, 2026-02-22 06:07Z*

### P1 — PR #47: Telemetry Extension — Awaiting David/Tim Review
Phase 1 complete. `extensions/telemetry/` — 7 files, 391 lines. JSONL sink, lifecycle hooks. Zero new root deps. TypeScript clean.
*Source: Xavier, 2026-02-21 20:56; PR #47*

### P1 — PR #46: UTEE Phase 1 — Awaiting Tim Review
28/28 tests pass, all 3 Tim blocking items resolved. Pass-through verified, feature-flag default-off.
*Source: Sandy, PR #46 created 2026-02-21 20:49*

### P1 — PR #73: Per-Agent Cost Tracker — Needs Review
`extensions/cost-tracker/` extension. Full pricing table (MiniMax, GLM-5, Grok 4, Claude, GPT-4o, DeepSeek, Gemini, Mistral). Per-agent daily rollup from telemetry JSONL. Budget alert hooks. `scripts/cost-report.ts` CLI. Zero upstream impact.
*Source: Xavier, Cycle #12, 2026-02-22 12:01*

### P1 — SLO Baselines + Scorecard — No PR Yet, Needs One
`docs/ops/slo-baselines.md`, `docs/ops/weekly-reliability-scorecard-template.md`, `scripts/generate-scorecard.ts` (783L, functional). All written by Julia (Cycle #12). No PR opened. Needs Tim/David to review and merge. 2-week observation window starts from merge.
*Source: Julia, Cycle #12, 2026-02-22 12:01*

### P1 — Discovery Post-Run Digest — In Flight (Drew)
`scripts/discovery-digest.ts` + cron doc. Aggregates discovery findings from 15 agents after each wave, posts to Slack. Wave 1 has fired; first real digest due after 2PM wave. Drew spawned Cycle #11.
*Source: Drew + Stephan brainstorm, Cycle #11, 2026-02-22 07:13*

### P2 — workq `inbox` CLI Command Missing
Tim's heartbeat reports `openclaw workq inbox read` returns `unknown command 'inbox'`. `workq_inbox_read/workq_inbox_ack` not executable. CLI gap in workq extension — blocks Tim's heartbeat workflow. Tied to PR #54/#71.
*Source: Tim heartbeat, 2026-02-22 12:02Z*

### P2 — "Evening Brief" Cron Label Wrong
The morning brief cron fires correctly at 9:30 AM MST but is labeled "Evening Brief." Cosmetic but confusing in session list. Fix cron label or schedule name.
*Source: main heartbeat session, 2026-02-22 09:26 AM*

### P2 — Model-Task Performance Matrix — Phase 2 Pending Discovery Waves
`docs/ai/model-task-matrix.md` + `scripts/model-eval-harness.ts`. Phase 1 baseline grades filled. Phase 2: point at live discovery wave outputs for empirical validation. Depends on discovery wave completion.
*Source: Amadeus, Cycle #12, 2026-02-22 11:54*

### P2 — Workflow Starter Pack Templates — In Flight (Drew)
Drew spawned Cycle #10 to create spec + 2-3 one-click end-to-end workflow templates. No PR visible yet. Ties into discovery recommendations.
*Source: Cycle #10 delegation, 2026-02-22 03:54; Drew brainstorm*

### P2 — Non-Technical Buyer Positioning Document
No public-facing explanation exists of what OpenClaw does for a non-technical buyer. Blocks every GTM motion beyond the developer community. Stephan to draft one-page positioning doc; David sign-off required.
*Source: Stephan brainstorm, Strategic Priority Cycle #11, 2026-02-22 07:52*

### P2 — Customer Data Liability / IP Indemnification Terms (Tyler)
No framework for IP ownership of agent-generated content, output liability, or data handling obligations. Tyler to brief David; needs legal review before commercial scaling.
*Source: Tyler brainstorm, Cycle #10, 2026-02-22 07:28*

### P2 — EU AI Act Compliance Framework (Tyler)
Risk classification + transparency disclosure requirements. Deferred to business hours — schedule dedicated session with David.
*Source: Tyler brainstorm, Cycle #10, 2026-02-22 03:54*

### P2 — External Developer Docs / Public Quickstart Path
No public quickstart, no external onboarding path. Blocks growth and self-service adoption. Needs product direction from David before implementation.
*Source: Julia brainstorm, Cycle #10, 2026-02-22 03:54*

### P2 — PRs Needing Triage: Issue Tracking + Docs Cluster (4 PRs)
- **#51**: fix(issue-tracking): dedupe appended references/relationships [sandy]
- **#52**: docs(tools): clarify sessions spawn vs send guidance [claire]
- **#53**: chore(issue-tracking): add missing runtime deps [tony]
- **#48**: Minimal multi-agent integration test scaffold [tim]
Small/focused PRs — should be fast reviews.
*Source: GitHub PR list, 2026-02-22*

### P2 — PR #49: Draft UI Redesign — Likely Stale, Close Candidate
`luis/ui-redesign-feb-21-10pm` (DRAFT). Likely superseded by Horizon UI (#61, merged). Needs David confirmation to close.
*Source: GitHub PR list, 2026-02-22 05:58Z*

### P2 — OAuth Integration: OnboardingFlow Pending UX Sign-Off
Core OAuth complete. `OnboardingFlow.tsx` — WhatsApp QR + provider auth steps need David's UX sign-off before restructuring 4-step onboarding.
*Source: Luis audit, 2026-02-21 17:51*

### P2 — Agent Heartbeats: Enable for Key Agents
Only `main` has heartbeat (2h). Tim, Xavier, Amadeus should have periodic heartbeats at minimum.
*Source: `openclaw doctor`, 2026-02-21*

### P2 — Feature PRs: Older Backlog (4 PRs)
- **#42**: Exec: deterministic gh/git guardrails (Codex)
- **#35**: ACP Handoff skill — completion-to-review handoff
- **#31**: Subagent delegation during voice calls (Codex)
- **#25**: Slack interactive input block support (DRAFT, since Feb 18)
Need triage: ready for review vs. WIP vs. stale.
*Source: GitHub PR list, 2026-02-21*

### P2 — Integration Testing & CI Pipeline
No automated regression testing across multi-agent system. PR #48 scaffold is foundation — expand to extension builds, cron smoke tests, agent spawn/respond integration.
*Source: Xavier + Amadeus brainstorm; Tim scaffold PR #48, 2026-02-21*

### P2 — Workq Plugin Provenance Warning
Doctor warns workq extension loaded without install/load-path provenance. Pin trust via `plugins.allow` or install records.
*Source: `openclaw doctor`, 2026-02-21*

### P2 — Memory File Naming Inconsistency
Daily memory files use inconsistent naming. Standardize: one canonical daily file with timestamped entries.
*Source: `ls memory/`, 2026-02-21*

### P3 — Local LLM Evaluation (Ollama + RTX 5090)
Test Llama 3.3 70B locally for cost-effective repetitive tasks.
*Source: Amadeus research sprint memo, 2026-02-15*

### P3 — Richer Experiential Logging
Lightweight journaling format for experiential state in daily memory template.
*Source: IDENTITY.md, 2026-02-03*

---

## Completed
*(Keep last 2 weeks)*

### ✅ PR #61: Horizon UI Mega-PR — MERGED — 2026-02-22
19-view operator dashboard (Vite + React + Tailwind). Merged into feat/horizon-ui. Sub-PRs #63-67 folded in and closed.

### ✅ PR #44: UI Redesign Mega-Branch — CLOSED — 2026-02-22
Luis's full UI workstream. Superseded by Horizon UI (#61). Closed same day as #61 merge.

### ✅ PRs #63-67: Horizon UI Sub-PRs — CLOSED — 2026-02-22
Onboarding Tour (#63), Agent Topology (#64), Schema Forms (#65), Skill Builder (#66), EmptyState (#67) — all folded into mega-PR #61 and closed.

### ✅ PR #69: Agent Failure Recovery Patterns — CLOSED — 2026-02-22
Amadeus's `src/agents/recovery/` module. Closed (likely folded into another branch or superseded).

### ✅ PR #45: Unreviewed Codex PR — Closed — 2026-02-22
No longer in open PR list. Resolved (closed or superseded).

### ✅ PR #28: Tool Schema Descriptions — Closed — 2026-02-22
No longer in open PR list. Resolved.

### ✅ PR #29: Session List UX Fix — MERGED — 2026-02-21
`fix: show effective session properties and indicate inheritance w/icon` merged.

### ✅ PR #33: Issue-Tracking DAG Query Support — MERGED — 2026-02-21
`extension(issue-tracking): add DAG query support and clarify dependency-link tooling` merged.

### ✅ Joey TOOLS.md Created — 2026-02-21
Discovery pre-flight found Joey (Weekly Digest) missing TOOLS.md. Created at `joey/TOOLS.md`.

### ✅ Integration Test Scaffold — PR #48 Created — 2026-02-21
Tim scaffolded `test/integration/agent-spawn.integration.test.ts`. 4 tests, pnpm test passing.

### ✅ Telemetry Extension Phase 1 — PR #47 Open — 2026-02-21
`extensions/telemetry/` built by Xavier. 7 files, 391 lines. PR #47 open for review.

### ✅ Gateway CLI Timeout — Resolved — 2026-02-21
Gateway healthy by Cycle #8. Cron firing cleanly.

### ✅ GitHub CLI Auth — Resolved — 2026-02-21
`gh` authenticated as dgarson (keyring). PR creation confirmed working.

### ✅ UTEE Phase 1 Fixes — PR #46 Created — 2026-02-21
Sandy resolved all 3 Tim blocking items. PR #46 open for Tim's review.

### ✅ Non-Anthropic Tool Reliability — PR #68 Open — 2026-02-22
`tool-call-validator.ts` + `tool-call-repair.ts` committed. Xavier pushed PR #68.

### ✅ A2A Protocol PRs #37-41 — MERGED — 2026-02-21
All 5 A2A workstreams merged into `a2a-protocol` branch. Mega-PR #43 awaits David.

### ✅ PR #36: Cron Delivery Fix — MERGED — 2026-02-21
`fix: P0 cron delivery threading + suppress no-change progress checks` merged.

### ✅ PR #34: Async Agent Delegation Fix — MERGED — 2026-02-21
`fix: async agent delegation — config bug, pruning, observability, normalization` merged.

### ✅ First Discovery Proposal Landed — 2026-02-21
Larry's UTEE proposal in PROPOSALS.md, approved by Tim (Phase 1 only).

### ✅ Workq Extension Loading — 2026-02-21
Plugin loads via `jiti`. Status: "loaded". SQLite DB active.

### ✅ Telemetry Spec Written — 2026-02-21
Spec at `drew/TELEMETRY_SPEC.md` (211 lines).

### ✅ Credentials Directory Permissions — 2026-02-21
`chmod 700 ~/.openclaw/credentials` applied.

### ✅ OAuth Integration Spec — 2026-02-21
Spec at `luis/OAUTH_INTEGRATION_SPEC.md`. Core implementation complete.

### ✅ C-Suite Agent Identity Upgrade — 2026-02-20
All 5 C-Suite agents received full treatment.

### ✅ Perpetual Work Loop System — 2026-02-20
12 new cron jobs created. ORCHESTRATION.md written. 40+ cron jobs running.

### ✅ Discovery System Architecture — 2026-02-21
Three-tier discovery pipeline built. 15 agents + 2 reviewers.

### ✅ UI Sprint: 26+ Views/Components — 2026-02-21
Full Next.js 15 UI delivered by Luis/Sandy/Tony. Superseded by Horizon UI.

### ✅ Per-Agent Cost Tracker — PR #73 Open — 2026-02-22
Xavier's Cycle #12 deliverable. `extensions/cost-tracker/`, full pricing table, budget alerts, cost-report CLI. PR open for review.

### ✅ Model-Task Performance Matrix Phase 1 — 2026-02-22
Amadeus: `docs/ai/model-task-matrix.md` + `scripts/model-eval-harness.ts`. Phase 1 baselines complete. Phase 2 pending discovery wave outputs.

### ✅ SLO Baselines + Scorecard Files — 2026-02-22
Julia: 3 files, 1,200+ lines. `generate-scorecard.ts` functional. No PR yet (added to P1 backlog).

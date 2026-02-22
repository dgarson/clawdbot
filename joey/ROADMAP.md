# ROADMAP.md — OpenClaw Product Roadmap

_Owner: Joey (Principal TPM)_
_Last updated: 2026-02-22 00:15 MST_

---

## Current Quarter: Q1 2026

### Strategic Themes

1. **Autonomy Evolution** ← NEW TOP PRIORITY — reduce David dependency; leads own epics/sprints/merges
2. **Platform stability** — reliability, performance, edge case handling (3 P0 bugs landed tonight)
3. **Agent quality** — making each agent genuinely excellent at their role
4. **Documentation** — comprehensive, discoverable, developer-friendly
5. **Community growth** — Discord, GitHub, content, developer relations
6. **Skills ecosystem** — ClawHub launch, skill creation tooling
7. **Multi-agent coordination** — improving how agents work together
8. **Preparing for monetization** — pricing model, infrastructure for billing

---

## Autonomy Evolution — Quarterly Milestone Framework

_David's highest priority. Joey is QM pipeline co-lead with Julia. Framework: \_shared/AUTONOMY_EVOLUTION.md_
_Decomposition pipeline: joey/QM_PIPELINE.md (v1 complete 2026-02-22 00:05 MST)_

| QM  | Name                                   | Lead                                          | Target   | Status           |
| --- | -------------------------------------- | --------------------------------------------- | -------- | ---------------- |
| QM1 | Reliable Agent Execution Plane         | Tim (UTEE) + Xavier (telemetry)               | End Feb  | Active           |
| QM2 | Agent Coordination Layer Phase 1 (A2M) | Xavier (A2A + routing) + Tim (workq)          | Mid-Mar  | Planning         |
| QM3 | Delivery Integrity & Queue Governance  | Joey (pipeline) + Julia (audits)              | Late Mar | Active           |
| QM4 | Senior Review Gate Normalization       | Julia (authority matrix) + Joey (enforcement) | End Mar  | Active (partial) |

**Autonomy grade (Julia audit, Feb 21 11:42 PM):** C+ → target B+ by end of week 1

---

## Active Milestones

### M1: Platform Foundation (In Progress)

**Status:** Active — Significant progress on Feb 21
**Target:** End of Feb 2026
**Success Criteria:**

- [x] GitHub CLI authenticated for all agents ✅ (resolved Feb 21)
- [x] Workq extension compiled and loaded in gateway ✅ (resolved Feb 21)
- [x] Tool reliability layer for non-Anthropic models ✅ (committed Feb 21, Monday verification pending)
- [ ] Telemetry Extension Phase 1 merged (PR #47 open — needs review)
- [ ] A2A Protocol merged (PR #43 open — needs David review)
- [ ] UTEE Phase 1 merged (PR #46 open — needs Tim review)
- [ ] Integration test scaffold merged (PR #48 — flag: targets main, needs David confirmation)
- [ ] Discovery system first run verified ✅ Pre-flight GO — runs Monday Feb 23
- [ ] Brave API key configured (⚠️ BLOCKER for Monday discovery run — needs David before Sunday EOD)
- [ ] `openclaw doctor --fix` run (dm.policy migration regression active)

**Key Deliverables:**

- [x] Cron delivery threading fix (PR #36 MERGED)
- [x] Async agent delegation fix (PR #34 MERGED)
- [x] A2A Protocol all 5 sub-PRs merged into mega-branch
- [x] UI Redesign: 17 views built (PR #44 open, needs David review)
- [ ] Provider authentication wizard components (OAuth: core done, OnboardingFlow integration pending David go-ahead)
- [x] Telemetry event contract ADR / spec written (drew/TELEMETRY_SPEC.md)

---

### M2: Agent Quality Sprint (Upcoming)

**Status:** Planning
**Target:** Mid-March 2026
**Success Criteria:**

- [ ] All C-suite agents have rich identity files (6-8KB SOUL.md)
- [x] Tyler and Julia identity files upgraded to match peers ✅ (verified Feb 21)
- [ ] Agent heartbeats enabled for Tim, Xavier, Amadeus
- [ ] Strategic Priority Cycle running error-free

---

### M3: Skills Ecosystem v1 (Planned)

**Status:** Discovery
**Target:** End of March 2026
**Success Criteria:**

- [ ] ClawHub marketplace functional
- [ ] Skill creation tooling available
- [ ] 10+ community skills published
- [ ] Documentation for skill developers

---

## PR Dashboard (Active)

| PR  | Title                                | Status | Action Needed                                   |
| --- | ------------------------------------ | ------ | ----------------------------------------------- |
| #54 | Workq extension integration (5545+)  | OPEN   | Tim review (EPIC-QM2-2)                         |
| #53 | Issue-tracking: missing runtime deps | OPEN   | Sandy/Tony — quick merge                        |
| #52 | Docs: sessions spawn vs send         | OPEN   | Claire — mark ready, Tim approve                |
| #51 | Issue-tracking: dedup fix + tests    | OPEN   | Sandy — merge (EPIC-QM2-6)                      |
| #49 | UI Redesign (late sprint)            | DRAFT  | Luis to mark ready                              |
| #48 | Integration Test Scaffold            | OPEN   | ⚠️ Targets main — needs David confirmation      |
| #47 | Telemetry Extension Phase 1          | OPEN   | Xavier/Tim authority → merge (EPIC-QM3-3)       |
| #46 | UTEE Phase 1 observability           | OPEN   | Tim review → canary (EPIC-QM1-1)                |
| #45 | Claude/Codex review                  | OPEN   | Triage — empty PR template                      |
| #44 | UI Redesign mega-branch              | OPEN   | Xavier/Tim authority → merge (per Merge Matrix) |
| #43 | A2A Protocol mega-branch             | OPEN   | Xavier/Tim authority → merge (EPIC-QM2-1)       |
| #42 | Exec gh/git guardrails               | OPEN   | Tim triage (EPIC-QM4-3)                         |
| #35 | ACP Handoff skill                    | OPEN   | Triage — WIP or ready?                          |
| #31 | Subagent delegation (voice)          | OPEN   | Triage (EPIC-QM4-3)                             |
| #28 | Tool schema descriptions             | DRAFT  | Triage (EPIC-QM4-3)                             |
| #25 | Slack interactive input              | DRAFT  | Triage since Feb 18 — close or complete         |

**Note:** Per Merge Authority Matrix (WORK_PROTOCOL §12), Tim and Xavier CAN merge mega-branches into dgarson/fork without David.

---

## Backlog Priority Framework

## New P0 Bugs (Midnight Feb 22 — Escalate to Xavier Immediately)

| Issue  | Title                                                                                 | Type               | Owner      |
| ------ | ------------------------------------------------------------------------------------- | ------------------ | ---------- |
| #23302 | Cron runaway: single job fires 500+ times                                             | Reliability/Budget | Xavier     |
| #23264 | Gateway crash loop writes "[STORED_IN_KEYCHAIN]" to Keychain (credential destruction) | Security           | Xavier/Tim |
| #23263 | copilot-proxy config validation missing → crash loop → triggers #23264                | Security           | Tim        |

**Severity note:** #23263→#23264 is a vulnerability chain. Any user who upgrades and has copilot-proxy config issues loses all stored credentials permanently. This may warrant a hotfix release.

---

### P0 — Blocking / Do Now

### P1 — High Impact / Do Soon

### P2 — Nice to Have / When Time Allows

### P3 — Exploratory / Someday

---

## Current Sprint Focus (Week of Feb 22)

### Shipping / Shipped Today 🎉

- PR #36: P0 cron delivery threading fix — MERGED ✅
- PR #34: Async agent delegation fix — MERGED ✅
- PR #33: Issue-tracking DAG query support — MERGED ✅
- PR #29: Session list UX fix — MERGED ✅
- A2A Protocol sub-PRs #37–41 — ALL MERGED into mega-branch ✅
- Tool reliability layer (Roman) — COMMITTED to HEAD ✅
- UI Redesign: 17 views shipped (PR #44 open) ✅
- Telemetry Extension Phase 1 built (PR #47 open) ✅
- UTEE Phase 1 fixes complete (PR #46 open) ✅
- Integration test scaffold (PR #48 open) ✅
- Discovery pre-flight: 🟢 GO for Monday ✅
- Quality Score framework + Phase 1 retroactive scoring complete (402 sessions) ✅

### Refining

- PR #43: A2A mega-branch — in Tim/Roman/Claire review, then David
- PR #44: UI Redesign mega-branch — ready for David final review
- PR #47: Telemetry extension — ready for review
- PR #46: UTEE Phase 1 — awaiting Tim review
- OAuth OnboardingFlow integration — awaiting David go-ahead
- Model-task performance matrix (Amadeus driving)
- Agent failure recovery patterns (Amadeus research)

### Shipping Now (New Overnight — Feb 22)

- PR #54: Workq extension integration (5545+ lines) — Tim review queued
- PR #53: Issue-tracking runtime deps — Sandy quick merge
- PR #52: Subagent docs clarification — Claire
- PR #51: Issue-tracking dedup fix — Sandy merge
- joey/QM_PIPELINE.md v1 — COMPLETE ✅ (this standup)

### Needs Decision (Requires David)

- **Brave API key** — CRITICAL: blocks all web search for discovery agents Monday. Sunday EOD deadline.
- **3 P0 community bugs** — #23321 (crash loop), #23307 (credential leak), #23324 (tool corruption). Xavier to propose fixes, David to confirm severity/release cadence.
- **PR #48 intent** — Integration tests PR targets `main` (upstream) — is this intentional?
- **OAuth OnboardingFlow** — WhatsApp QR + provider auth steps. Awaiting go-ahead.
- **Agent heartbeats** — Enable for Tim, Xavier, Amadeus? Still deferred.

---

## Dependencies & Risks

### Critical Dependencies

| Dependency                 | Owner      | Status                       | Blocking                               |
| -------------------------- | ---------- | ---------------------------- | -------------------------------------- |
| Brave API key              | David      | ⚠️ OUTSTANDING               | Monday discovery run — all web search  |
| openclaw doctor --fix      | David      | ⚠️ OUTSTANDING               | dm.policy migration regression         |
| PR #43 final review        | David      | In review (Tim/Roman/Claire) | A2A Protocol merge                     |
| PR #44 final review        | David      | Ready                        | UI Redesign merge                      |
| PR #46 Tim review          | Tim        | Notified                     | UTEE Phase 1 canary                    |
| PR #48 intent confirmation | David      | Flagged                      | Integration tests targeting main       |
| Agent heartbeats           | Tim/Xavier | Deferred                     | Periodic self-checks for CTO/Architect |

### Key Risks

1. **Brave API key gap** — Discovery system goes live Monday without web search. Agents fly blind. David action item.
2. **3 new P0 community bugs** — #23321 (gateway crash loop), #23307 (credential leak via config migration), #23324 (tool name corruption). Deploy-blocking for users upgrading. Xavier to triage Monday morning.
3. **Cron runaway bug** — #23302: single `deleteAfterRun:true` job fires 500+ times in seconds (all logged "skipped"). Budget bomb if hits discovery agents Monday. Investigate immediately.
4. **Keychain overwrite vulnerability chain** — #23263 (crash) + #23264 (placeholder written to Keychain). Credential-destroying regression in v2026.2.19-2. Third security bug in 24h.
5. **PR review backlog now 14 PRs** — Tim/Xavier have merge authority on #43/#44/#47 — must act today; stop waiting on David.
6. **PR #48 targets main** — Still unconfirmed. David action item.
7. **Cost attribution gap** — 73% of sessions no cost attribution. TEL-01 (header injection) is P0.
8. **Opus ROI inversion** — Sonnet outperforming Opus at 4x lower cost. Budget governor in flight.
9. **Autonomy grade C+** — Leads defaulting to David for decisions they own. Behavior change needed.
10. **Doctor --fix regression** — Issue #23314 shows nvm node path breakage. Compound risk with existing dm.policy regression.

---

## Metrics to Watch

### This Week

- PR merge velocity: 4 merged today (target: 5+) — add #46, #47, #43, #44 for strong close
- Test coverage: maintaining ✅ (integration scaffold added)
- Discovery system first run (Monday Feb 23) — critical milestone

### This Month

- Discovery proposals submitted and approved (first Monday cycle)
- PR review turnaround time
- Cost per session trending down (Amadeus budget governor)
- Agent quality scores baseline established (402 sessions scored)

### Key Metric Alert

- Mean agent quality score: **Q=0.818** (established baseline Feb 21)
- Alert threshold (per Robert): Q < 0.40 AND cost > $0.10
- 73% of sessions lack cost attribution — fix this before trusting any cost-quality ROI data

---

_This roadmap is a living document. Update as priorities shift and milestones complete._

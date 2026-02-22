# QM → Epic → Sprint Decomposition Pipeline

**Owner:** Joey (Principal TPM) | **Co-Lead:** Julia (CAO)
**Created:** 2026-02-22 00:05 MST
**Framework:** \_shared/AUTONOMY_EVOLUTION.md
**Due:** 2026-02-22 08:00 MST (morning brief cycle)

---

## Part 1: QM Intake Protocol

_The process for converting David's quarterly milestone definitions into org-executable epics._

### Trigger

David states a Quarterly Milestone (verbally, Slack, or in writing). Joey activates within 2 hours.

### Steps

1. **Capture & Clarify (Joey, <2h)**
   - Document the milestone: name, success criteria, target window (2–7 days)
   - Identify scope boundaries: what's IN, what's OUT
   - Flag pre-requisites and dependencies up front

2. **Decompose into Epics (Joey, <24h)**
   - 3–7 epics per milestone
   - Each epic: outcome-focused, completable in <2 days, assignable to one lead
   - Format: `EPIC-[M#]-[N]: [verb] [outcome]`

3. **Assign Leads (Joey, same session as step 2)**
   - Each epic gets exactly one named lead (Tim, Xavier, Sandy, Luis, etc.)
   - Lead may delegate to workers but owns the outcome

4. **Load WORKBOARD (Joey + lead, <48h)**
   - Lead decomposes their epic into sprint tasks
   - Tasks posted to BACKLOG.md as P0/P1 items with `[EPIC-M#-N]` tag
   - Workers auto-claim on next heartbeat

5. **Kick Off (Joey, one message per lead)**
   - Notify each lead via sessions_send with: epic name, success criteria, due date, and first task
   - Lead acknowledges and begins within one heartbeat cycle

6. **Monitor (Joey, every 6h)**
   - Check task completion rate vs. epic target
   - Surface blockers to lead (not David) first
   - Escalate to David ONLY: scope changes, security, spend overruns

---

## Part 2: Quarterly Milestone Decomposition

_Tim's 4 milestones proposed 2026-02-21. Status: awaiting formal acceptance in ROADMAP.md_

---

### QM1: Reliable Agent Execution Plane

**Summary:** Agents complete tasks reliably — no silent failures, no untracked crashes, observable behavior.
**Target window:** End of Feb 2026 (aligns with M1 Platform Foundation)
**Success gate:** <2% tool-call failure rate on non-Anthropic models; 100% session cost attribution; UTEE canary live at 5%

| Epic       | Outcome                                                                     | Lead        | Target |
| ---------- | --------------------------------------------------------------------------- | ----------- | ------ |
| EPIC-QM1-1 | UTEE Phase 1 in canary at 5% (PR #46 reviewed + deployed)                   | Tim         | Feb 24 |
| EPIC-QM1-2 | Telemetry header injection live — 100% cost attribution (TEL-01)            | Xavier      | Feb 25 |
| EPIC-QM1-3 | Non-Anthropic tool reliability PR merged + verified (<2% failure)           | Roman / Tim | Feb 24 |
| EPIC-QM1-4 | Agent failure recovery patterns documented + first pattern implemented      | Amadeus     | Feb 26 |
| EPIC-QM1-5 | Background exec session stability fix shipped (#23303 — 30-min SIGTERM bug) | Xavier      | Feb 25 |
| EPIC-QM1-6 | Model health gates in HEARTBEAT for MiniMax M2.5 / GLM-5                    | Amadeus     | Feb 25 |

**Pre-requisites:** PR #46 Tim review (in progress), Telemetry spec (done), Tool reliability layer (committed)
**Risks:** Tim review on PR #46 is gating EPIC-QM1-1. Roman tool reliability branch needs PR opened.

---

### QM2: Agent Coordination Layer Phase 1 (A2M)

**Summary:** Agents message each other reliably, work is tracked in a queue, and coordination doesn't require human brokering.
**Target window:** Mid-March 2026
**Success gate:** A2A protocol merged to dgarson/fork; workq tracking active; subagent completion notifications reliable

| Epic       | Outcome                                                                          | Lead         | Target |
| ---------- | -------------------------------------------------------------------------------- | ------------ | ------ |
| EPIC-QM2-1 | A2A Protocol mega-branch (#43) reviewed by Xavier/Tim and merged to dgarson/fork | Xavier       | Feb 26 |
| EPIC-QM2-2 | Workq extension (#54) reviewed, integrated, and loading in production gateway    | Tim          | Feb 28 |
| EPIC-QM2-3 | Subagent completion notification fixed (#23315)                                  | Xavier       | Feb 26 |
| EPIC-QM2-4 | A2M message routing layer implemented (post-A2A merge)                           | Xavier       | Mar 7  |
| EPIC-QM2-5 | Inter-agent mail inbox protocol finalized and adopted by all leads               | Joey         | Mar 5  |
| EPIC-QM2-6 | Issue tracking dedup + runtime deps fixed (PRs #51, #53 merged)                  | Sandy / Tony | Feb 24 |

**Pre-requisites:** A2A mega-branch (#43) is the blocker for QM2-4. Workq (#54) depends on gateway RPC plumbing.
**Risks:** A2A PR #43 is sitting unreviewed — Xavier/Tim have authority to review and merge per Merge Authority Matrix.

---

### QM3: Delivery Integrity and Queue Governance

**Summary:** Work is tracked, assignable, auto-claimed from BACKLOG, and doesn't silently stall. The TPM has a real-time view of org health.
**Target window:** Late March 2026
**Success gate:** Auto-claim protocol active in all lead HEARTBEATs; QM pipeline running for 2+ weeks; integration test suite covering key flows; 0 idle-with-unclaimed-work scenarios per 6h audit

| Epic       | Outcome                                                                                          | Lead         | Target    |
| ---------- | ------------------------------------------------------------------------------------------------ | ------------ | --------- |
| EPIC-QM3-1 | Auto-claim directive in all lead HEARTBEAT.md files (Xavier, Tim, Luis, Sandy, Amadeus, Stephan) | Tim / Joey   | Mar 1     |
| EPIC-QM3-2 | Integration test suite expanded beyond scaffold (PR #48 + 5 more agent-spawn tests)              | Tim          | Mar 5     |
| EPIC-QM3-3 | Telemetry Extension Phase 1 (#47) merged and emitting events for all session types               | Xavier       | Feb 26    |
| EPIC-QM3-4 | Discovery system first full cycle complete with post-mortem (Monday Feb 23)                      | Julia / Joey | Feb 24    |
| EPIC-QM3-5 | QM pipeline: Joey runs decomposition for all 4 QMs within 48h                                    | Joey         | Feb 23 ✅ |
| EPIC-QM3-6 | Workflow starter packs v1: 2 templates packaged and discoverable                                 | Drew / Luis  | Mar 14    |
| EPIC-QM3-7 | Memory file naming standardized across all agents                                                | Joey         | Mar 7     |

**Pre-requisites:** PR #47 (Telemetry) needs review (Tim/Xavier authority). Auto-claim needs HEARTBEAT templates.
**Risks:** Discovery first run Monday is a critical milestone — Brave API key still missing (David action item).

---

### QM4: Senior Review Gate Normalization

**Summary:** Leads review and merge PRs autonomously. David's review queue drops to zero. PR turnaround <4h average.
**Target window:** End of March 2026
**Success gate:** 0 PRs stuck on David >24h; average review-to-merge time <4h; all leads have explicit decision authority documented

| Epic       | Outcome                                                                            | Lead         | Target                              |
| ---------- | ---------------------------------------------------------------------------------- | ------------ | ----------------------------------- |
| EPIC-QM4-1 | Merge authority matrix ratified in WORK_PROTOCOL + all lead AGENTS.md updated      | Julia / Joey | Feb 22 ✅ (Julia completed partial) |
| EPIC-QM4-2 | Xavier and Tim AGENTS.md: explicit self-assign + review authority documented       | Julia        | Feb 22 ✅ (Julia completed)         |
| EPIC-QM4-3 | PR backlog triage: PRs #42, #35, #31, #28, #25, #45 reviewed/merged/closed         | Tim / Xavier | Feb 28                              |
| EPIC-QM4-4 | PR auto-assignment: reviewers assigned by type on PR open (gh automation)          | Xavier       | Mar 7                               |
| EPIC-QM4-5 | Codex Medium review tier defined and activated for sub-epic PRs                    | Tim          | Mar 10                              |
| EPIC-QM4-6 | Lead autonomy scores tracked monthly: "David escalations per week" metric baseline | Joey         | Mar 14                              |

**Pre-requisites:** WORK_PROTOCOL merge authority matrix (Julia added 2026-02-21 ✅). Lead AGENTS.md updates partially done by Julia.
**Risks:** Behavior change — leads need to believe they CAN merge without David. Julia's matrix is the anchor. Joey must reinforce in standup cadence.

---

## Part 3: Open Community Issues Triage (New Tonight)

_15 issues opened 2026-02-22 on openclaw/openclaw. Triaged here for sprint loading._

| Issue                                                             | Severity | Type         | Assigned To (Proposed) | QM  |
| ----------------------------------------------------------------- | -------- | ------------ | ---------------------- | --- |
| #23321: Gateway crash loop (hot-reload race)                      | P0 🔴    | Bug          | Xavier                 | QM1 |
| #23307: Config migration resolves ENV_VAR → plaintext credentials | P0 🔴    | Security Bug | Xavier / Tim           | QM1 |
| #23324: Cross-model failover corrupts tool names (HTTP 400)       | P0 🔴    | Bug          | Roman / Xavier         | QM1 |
| #23315: Subagent completion notification broken                   | P1 🟠    | Bug          | Xavier                 | QM2 |
| #23303: Background exec sessions killed after 30 min (SIGTERM)    | P1 🟠    | Bug          | Xavier                 | QM1 |
| #23314: doctor --fix breaks nvm node path                         | P1 🟠    | Bug          | Tim                    | QM1 |
| #23316: Slack keychain migration audit                            | P1 🟠    | Security     | Xavier / Sandy         | QM4 |
| #23332: Missing api field causes credential leak                  | P1 🟠    | Security Bug | Xavier                 | QM1 |
| #23328: channels.modelByChannel Zod schema fails runtime          | P1 🟠    | Bug          | Roman                  | QM1 |
| #23317: Timeout auth rotation causes premature failover           | P2 🟡    | Bug          | Xavier                 | QM1 |
| #23327: Announce model failover in chat (feature)                 | P2 🟡    | Feature      | Xavier / Amadeus       | QM1 |
| #23325: Slack agent identity not passed via chat:write.customize  | P2 🟡    | Bug          | Xavier                 | QM2 |
| #23323: Plugin channel shows "Running: No" in UI (false)          | P2 🟡    | Bug          | Luis                   | QM3 |
| #23330: Add Tavily as web_search provider                         | P2 🟡    | Feature      | Tim                    | QM2 |
| #23319: Signal: surface group events to agent                     | P3 🟢    | Feature      | Barry                  | QM2 |

**P0 alert (3 bugs, needs immediate morning brief to Xavier):**

- #23321 (crash loop) and #23307 (plaintext credentials) are severity: deploy-blocker for any user upgrading
- #23324 (tool name corruption) directly impacts non-Anthropic reliability work in QM1

---

## Monitoring Protocol (Joey, every 6h)

Joey's 6h check (starting Feb 22 morning):

1. Count active epics per QM with completion %
2. Flag any epic with >4h no-commit activity
3. Flag any escalation that should have been lead-handled
4. Report to Julia for 12h synthesis
5. Update ROADMAP.md if priorities shift

---

## Notes

- This is the first iteration. Expect refinement after Monday discovery run.
- QM1 is the most urgent — 3 new P0 bugs tonight require sprint loading ASAP.
- QM4 progress is real (Julia's matrix + AGENTS.md updates) but behavior change is slow.
- Brave API key remains the single-highest-leverage David action item.

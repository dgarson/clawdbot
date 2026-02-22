# Autonomy Evolution Framework

**Owner:** Julia (CAO) + Joey (Principal TPM)  
**Created:** 2026-02-21 23:40 MST by Merlin  
**Mandate:** David manages _Quarterly Milestones_ (2-7 days each). Nothing below that requires him.  
**Review cadence:** Every 6h audit → Every 12h synthesis → Every 24h morning report to David

---

## The Target State

```
David
  └── Quarterly Milestones (2–7 days each)
        └── [Agents own everything below]
              ├── Epics (agent leads self-assign)
              │     └── Sprints (automatically decomposed)
              │           └── Tasks (spawned to workers)
              │                 └── Reviews (Codex Medium/automated)
              │                       └── Merge (leads can approve)
              └── Blocking escalation only for:
                    • Security incidents
                    • Spend > configurable threshold
                    • Architectural direction forks
                    • External releases / public comms
```

---

## Current Friction Inventory (Seed List — Julia/Joey to expand)

| Friction Point                               | Root Cause                                 | Impact                          | Fix Path                                               |
| -------------------------------------------- | ------------------------------------------ | ------------------------------- | ------------------------------------------------------ |
| David reviewing individual PRs               | No clear merge authority matrix            | ~2h/day David time              | Define tier-based merge authority                      |
| Agents waiting for task assignment           | Workboard not automatically self-assigning | Idle cycles                     | Auto-claim from workboard on heartbeat                 |
| Tim/Xavier as bottlenecks on reviews         | No Codex Medium review tier                | Review queue backs up           | Codex Medium = primary reviewer for sub-epic PRs       |
| Epic decomposition done by hand              | No QM→Epic→Sprint pipeline                 | David has to manage "what next" | Joey owns QM decomposition on intake                   |
| Morning status requires human interpretation | No synthesized "action needed" view        | David reads 10+ reports         | Single morning audio brief, action items only          |
| Agent blocking on unclear ownership          | Decision authority not in AGENTS.md        | Delays + escalations            | Add explicit authority table to every lead's AGENTS.md |
| GLM-5 silent failures                        | No model quality gate                      | Work silently wasted            | Model health checks in HEARTBEAT                       |
| Overnight work stalls                        | No auto-restart on agent failure           | Lost hours                      | Julia monitors + restarts on 6h cadence                |

---

## Evaluation Criteria (What to Audit Every 6 Hours)

### 1. Decision Escalation Audit

- How many `sessions_send` messages went to David (or Merlin relaying to David) in the last 6h?
- Were any of those decisions that a lead SHOULD have made autonomously?
- Flag: any escalation where a clear AGENTS.md rule would have prevented it

### 2. Idle Agent Detection

- Which agents had zero activity in the last 6h?
- Is there unclaimed work in their domain?
- If yes: is that a delegation failure, a missing cron, or a missing workboard entry?

### 3. Review Bottleneck Detection

- PRs open for >4h without a review = bottleneck flag
- Which reviewer is the blocker?
- Is that reviewer the right tier? (Should Codex Medium have caught this first?)

### 4. Workboard Health

- P0/P1 items: how old are the unclaimed ones?
- Is anything In Progress with no recent commit activity (stalled)?
- Missing workboard entries for work you can see in session logs?

### 5. Merge Authority Gaps

- Any PR that could have been merged but wasn't due to unclear authority?
- Any PR that sat in review with an approval but no merge action?

### 6. QM Pipeline Check

- Do we have active Quarterly Milestones defined?
- Are they decomposed into epics in WORKBOARD?
- Does every epic have an owner?

---

## Recommended Changes (To Be Validated and Proposed)

### Tier-Based Merge Authority (Draft)

| PR Type                         | Can Merge                  | Notify           |
| ------------------------------- | -------------------------- | ---------------- |
| Sub-epic PR into feature branch | Barry/Jerry (Codex Medium) | Tim/Xavier async |
| Feature branch into mega-branch | Tim / Xavier               | David async      |
| Mega-branch into dgarson/fork   | Xavier (with Tim approval) | David required   |
| dgarson/fork → any release      | David required             | All C-suite      |

### Auto-Claim Protocol (Draft)

Every agent's heartbeat should:

1. Check WORKBOARD for unclaimed items in their domain
2. If found AND capacity available: self-assign + notify TPM (Joey)
3. If blocked: escalate to lead (NOT David) with specific question

### QM Intake Protocol (Draft, Joey to own)

When David states a Quarterly Milestone:

1. Joey decomposes into 3-7 epics within 24h
2. Each epic auto-assigned to appropriate team lead
3. Leads decompose into sprints in WORKBOARD within 48h
4. Workers auto-claim tasks from sprints on heartbeat
5. Joey monitors + unblocks; surfaces to David only: blockers or major scope changes

---

## Morning Report Template (Delivered by 8 AM MST daily)

```
OpenClaw Org Autonomy Report — [Date]
Generated by: Julia (CAO) + Joey (TPM)

FRICTION REDUCED THIS PERIOD:
• [What got better — specific metric if possible]

FRICTION STILL PRESENT:
• [Top 3 specific blockers with proposed fix]

AGENTS IDLE / STALLED:
• [Name, duration, reason, recommended action]

REVIEW BOTTLENECKS:
• [PR #, age, blocker, fix]

MERGE AUTHORITY GAPS:
• [Any PRs that should have merged but didn't]

TOP 3 RECOMMENDATIONS TO IMPROVE AUTONOMY:
1. [Specific AGENTS.md / HEARTBEAT.md / WORKBOARD change]
2. [...]
3. [...]

QUARTERLY MILESTONES STATUS:
• [Active QMs, % complete, ETA]
```

---

## Two-Week Improvement Schedule

| Day          | Julia Focus                            | Joey Focus                      |
| ------------ | -------------------------------------- | ------------------------------- |
| Feb 22 (Sun) | Baseline friction inventory            | QM intake protocol draft        |
| Feb 23 (Mon) | Merge authority matrix proposal        | Discovery system monitoring     |
| Feb 24 (Tue) | Auto-claim protocol in HEARTBEAT files | Sprint decomposition template   |
| Feb 25 (Wed) | Review bottleneck analysis + fix       | Workboard auto-assignment rules |
| Feb 26 (Thu) | Idle detection automation              | QM → Epic pipeline live         |
| Feb 27 (Fri) | Week 1 retrospective report            | Milestone tracking dashboard    |
| Mar 1-7      | Iterate on Week 1 proposals            | Measure friction reduction      |

---

_This is a living document. Julia updates it after every audit cycle._

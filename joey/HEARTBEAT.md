# HEARTBEAT.md — Joey (Principal TPM)

## Autonomous Work Cycle

Every cycle this fires. Follow in order.

---

### Step 1: QM Pipeline Check (NEW — PRIMARY MISSION)

**Read:** `~/.openclaw/workspace/_shared/AUTONOMY_EVOLUTION.md`

The goal: David states Quarterly Milestones. You own everything below that.

**Every heartbeat:**

1. **Check active QMs** — do we have defined Quarterly Milestones in `_shared/WORKBOARD.md`? If not, and David has expressed high-level goals, decompose them.

2. **QM → Epic pipeline health:**
   - Every active QM should have 3-7 epics in WORKBOARD
   - Every epic should have an owner (team lead)
   - Every epic should have success criteria defined
   - If any of these are missing: fill the gap NOW

3. **Epic → Sprint pipeline health:**
   - Active epics should have sprints broken out as WORKBOARD tasks
   - Sprint tasks should have assigned workers or be `unclaimed` with clear description
   - If unclaimed tasks have been sitting >12h without pickup: notify the appropriate lead

4. **Sprint velocity check:**
   - Which sprints had commits in the last 6h? (check `git log --since=6h --all --oneline | head -20`)
   - Which had nothing? Flag to relevant lead, not David.

5. **Dependency mapping:**
   - Any task blocked on another task? Make it explicit in WORKBOARD
   - Any task blocked on David's input? That's an escalation candidate — but first ask: can any lead unblock this instead?

Write findings to `joey/memory/YYYY-MM-DD.md` and update WORKBOARD accordingly.

---

### Step 2: Standup Digest (Every 12 Hours)

Compile a cross-team standup digest:

- What shipped in the last 12h (PRs merged, tasks completed)
- What's in-flight (in-progress tasks + owners)
- What's blocked (and the specific blocker)
- What's at risk (anything that might miss its milestone)

Send to `#cb-inbox` as a written message. Keep it under 300 words. **No audio — written only for standups.**
Share with Julia (sessions_send to `agent:julia:main`) for her autonomy audit input.

---

### Step 3: Check Your Work Queue

Read `joey/memory/YYYY-MM-DD.md` for pending items and any flagged items from Xavier or Tim.
Execute highest priority TODO. Mark done.

---

### Step 4: Review Open PRs for TPM Visibility

Run: `gh pr list -R dgarson/clawdbot --state open --limit 20`

- Flag any PRs that have been open >24h with no review activity → notify appropriate reviewer (NOT David)
- Flag any PRs that are approved but unmrged → notify the lead to merge
- Update WORKBOARD to reflect PR states

---

### Step 5: Milestone Surfacing

Report completions, blockers, and scope changes to Xavier and Merlin. Surface to David only through Merlin — never directly unless it's a quarterly milestone decision.

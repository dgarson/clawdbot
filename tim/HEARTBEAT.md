# HEARTBEAT.md

## Review Queue Protocol (David directive, 2026-02-21)

### Task 1 — Megabranch-only final review gate
- Check whether any workstream is marked as "full megabranch consolidated" and "ready for final review".
- Ignore incremental PR review requests unless explicitly marked P0 safety/security incident.
- If no consolidated megabranch is ready: `HEARTBEAT_OK`.

### Task 2 — Codex-first sweep requirement
- Before Tim/Xavier final review begins, verify Codex 5.3 Medium/High sweep has run and results are attached.
- If missing, route back with: "Run Codex sweep first, then request final architecture review."

### Task 3 — Final review execution policy
When a consolidated megabranch is ready and Codex sweep exists:
1. Review for architecture, correctness, security.
2. If issue is small/isolated, fix directly on branch and continue.
3. If issue is non-trivial, return to owning medium-tier engineer; do not absorb deep debug work.

### Task 4 — Queue hygiene
- Keep queue focused on:
  - UTEE canary execution and evaluation
  - ACL/A2M Phase 1 consolidated branch readiness
  - final megabranch reviews only
- Deprioritize incremental PR churn unless it blocks consolidated delivery.

## workq Inbox Check
Call `workq_inbox_read` to check for pending messages. Process each one.
After processing, call `workq_inbox_ack` with the message IDs. This is REQUIRED.

## Proactive Build Mode (when review queue is empty)
If Tasks 1–4 above result in nothing to review (`HEARTBEAT_OK` state), do NOT idle. Instead:

1. Check `/Users/openclaw/.openclaw/workspace/tim/brainstorm-roadmap-2026-02-21.md` for the highest-priority "Now" workstream not yet in progress.
2. Check `/Users/openclaw/.openclaw/workspace/tim/overnight-brief-2026-02-21.txt` for explicitly planned overnight workstreams.
3. Check `/Users/openclaw/.openclaw/workspace/_shared/WORKBOARD.md` — if all tasks are done, self-assign the next workstream from the brainstorm/brief and add it to WORKBOARD.
4. Spawn appropriate squad agents to execute. Prefer safe, additive, independently verifiable work overnight.
5. Report what was kicked off to #cb-inbox (Slack channel C0AAP72R7L5).

**Priority order for overnight self-assignment (from bedtime brief 2026-02-21):**
- UTEE canary execution prep → decision packet (toggle/rollback validation, alert thresholds, go/no-go checklist)
- ACL/A2M Phase 1 stabilization (stable envelope contract, capability registry, handoff primitive)
- Integration failure-path harness (spawn/respond integrity, cron delivery isolation, A2M↔UTEE flag safety)


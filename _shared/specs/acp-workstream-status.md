# ACP Workstream Status — Kickoff Report

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-workstream-status.md`  
**Date:** 2026-02-21  
**Prepared by:** Tim  
**Directive:** Finalize ACP spec and launch execution workstream

---

## 1) Completed in This Session

### A. Canonical ACP spec finalized
- **Output:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`
- Consolidation approach:
  - Used Amadeus implementation-ready architecture (TypeScript/SQLite + extension model) as base
  - Merged in Tim protocol rigor:
    - `policy` block on envelope
    - handoff `verification` block (`schema_version`, `package_hash`; no signing infra)
    - handoff `provenance` block
    - expanded rejection reason codes
    - role authority matrix as policy config
  - Applied Xavier schema guidance:
    - `to` normalized to `string[]`
    - semver protocol versioning (`1.0.0`)
    - top-level message `status`
    - decoupled workq coupling via `external_refs`
  - Explicitly cut deferred complexity per CTO review:
    - custom URI scheme
    - signing infra
    - ML routing
    - knowledge dedup
    - federation/reputation

### B. Detailed phase-by-phase task plan created
- **Output:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-task-breakdown.md`
- Includes P0/P1/P2/P3 tasks with:
  - build description
  - acceptance criteria
  - effort estimates
  - suggested assignees
  - dependencies
- Timeline baseline: **~18 weeks** (P0 week 1 + P1/P2/P3 execution)

---

## 2) Delegation / Kickoff Actions Executed

## P0 verification spikes
1. **Roman** — Session injection spike ✅ complete  
   Session: `agent:roman:subagent:182e4338-fcc4-410f-a60c-609b167c50ac`  
   Output: `/Users/openclaw/.openclaw/workspace/_shared/specs/spikes/acp-spike-session-injection.md`  
   Key findings:
   - mechanism: `chat.inject`
   - requires `operator.admin` scope
   - latency estimate: ~50–100ms
   - limitation: writes assistant-role transcript message but does **not** trigger agent processing
   - recommendation: ACP bridge path with scoped permission (`chat.inject`/`acp.inject`)

2. **Tony** — Heartbeat/wake trigger spike ⏳ running  
   Session: `agent:tony:subagent:405defd2-b2cb-4f2c-9202-df4636b35f9d`  
   Output target: `/Users/openclaw/.openclaw/workspace/_shared/specs/spikes/acp-spike-heartbeat-trigger.md`

3. **Sandy** — Cross-extension integration spike ✅ complete  
   Session: `agent:sandy:subagent:da90eb36-71d6-4b7e-841d-173955dfba7c`  
   Output: `/Users/openclaw/.openclaw/workspace/_shared/specs/spikes/acp-spike-extension-to-extension-calls.md`  
   Key findings:
   - direct extension-to-extension **tool invocation is not supported**
   - supported integration pattern is Gateway RPC (`api.registerGatewayMethod` + `callGateway`)
   - auth/session context must be passed explicitly (`agent_id`, `session_key`, etc.)
   - structured RPC error contracts support deterministic ACP error mapping

## Schema consolidation review (delegated)
- **Senior reviewer assigned: Claire** (Amadeus spawn unavailable in current spawn policy)  
  Session: `agent:claire:subagent:3a8468fe-ee99-4fb0-9542-cfbade487c69`  
  Review output: `/Users/openclaw/.openclaw/workspace/_shared/specs/reviews/acp-canonical-review-claire.md`
- Review result: **Conditional approval** with 4 MUST-FIX + 8 SHOULD-FIX items.
- Remediation status: MUST-FIX items have been applied in canonical spec update:
  - verification-gated delivery dependencies explicitly documented
  - identity derivation requirements elevated and expanded in Security section
  - validation boundary expanded in Security section
  - broadcast asymmetry defaults (10/min direct, 5/hour broadcast + authority/priority gates) documented

## Initial P1 task kickoff (spawned/delegated)
1. **Claire** — DB migration plan kickoff  
   Output target: `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-db-migration-plan-claire.md`

2. **Sandy** — `acp_send` implementation plan kickoff ✅ complete  
   Session: `agent:sandy:subagent:4dd91731-e5ef-45ec-85a4-5247e236fe7b`  
   Output: `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-send-plan-sandy.md`  
   Coverage includes request/response contracts, identity derivation enforcement, 12-step validation flow, asymmetric rate limiting, routing hooks, circuit breaker design, and comprehensive test strategy.

3. **Roman** — (steered) extension skeleton kickoff plan after spike  
   Output target: `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-extension-skeleton-plan-roman.md`

4. **Tony** — (steered) delivery router kickoff plan after spike  
   Output target: `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-delivery-router-plan-tony.md`

5. **Barry** — `acp_handoff` implementation kickoff ✅ complete  
   Session: `agent:barry:subagent:94368673-4201-44f5-bcd9-b5999eac2598`  
   Output: `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-handoff-plan-barry.md`  
   Coverage includes lifecycle transitions, verification/provenance, rejection contracts, uniqueness constraints, timeout/escalation, and workq integration.

---

## 3) Risks / Blockers Identified

1. **Spawn policy constraint:** `amadeus` agentId unavailable in current subagent policy; schema review rerouted to Claire (senior engineer).
2. **Active-child cap (5):** limited immediate parallel kickoff breadth; additional P1 kickoff items queued in task plan.
3. **Remaining technical unknown pending spike result:**
   - extension-triggered wake viability

4. **Implementation constraint now clarified:**
   - ACP↔workq must use Gateway RPC integration (not direct extension-tool calls)

---

## 4) What David Needs to Know

- ACP now has a **single canonical spec** and no longer has conflicting parallel drafts.
- Workstream is launched with **P0 spikes active** and **P1 design tasks in progress**.
- If P0 spikes pass, P1 can begin immediately with the assigned owners in the task breakdown.
- If any spike fails, fallback design is already built into canonical plan (inbox/SQLite-first degradation model).

---

## 5) Immediate Next Checkpoint

- Collect spike + review outputs and publish P0 gate memo (`GO` / `GO with flags` / `NO-GO`) once delegated runs complete.

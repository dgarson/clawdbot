# ACP Canonical Spec — Schema Consolidation Review

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/reviews/acp-canonical-review-claire.md`  
**Date:** 2026-02-21  
**Reviewer:** Claire (Senior Engineering Review)  
**Spec Reviewed:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`

---

## Executive Summary

The canonical ACP spec dated 2026-02-21 is **READY FOR IMPLEMENTATION** with minor fixes. It consolidates Amadeus and Tim's work effectively and addresses most of Xavier's requirements. The schema design is sound, indexing strategy is appropriate, and the phasing (P0→P1→P2→P3) aligns with recommendations.

**Approval Status:** ✅ **CONDITIONAL APPROVAL** — Address MUST-FIX items before P0 exit.

---

## 1) MUST-FIX Findings

These items block P0 exit and must be resolved before engineering work begins.

### 1.1 Session Injection Verification (Critical)

**Xavier Requirement:** Spike session injection in week 1. If it doesn't work, fall back to inbox files only.

**Canonical Spec Status:** ❌ NOT ADDRESSED

The spec references delivery channels but does not explicitly call out the verification spike requirement or fallback strategy. The canonical spec assumes session injection works without documenting the dependency.

**Recommendation:** Add explicit section:
> **Verification Spike Required:** Session injection delivery channel (§10) requires week-1 verification spike. Fallback: inbox-only delivery if spike fails.

---

### 1.2 Heartbeat/Wake Trigger Verification (Critical)

**Xavier Requirement:** Spike heartbeat trigger from extensions early. The "wake on urgent message" flow depends on this.

**Canonical Spec Status:** ❌ NOT ADDRESSED

Delivery model (§10) describes wake triggers but does not flag this as an unverified dependency requiring a spike.

**Recommendation:** Add verification requirement alongside session injection spike.

---

### 1.3 Agent Identity Anti-Spoofing — Implementation Detail

**Xavier Requirement:** "The ACP extension MUST derive `from` from the calling session context, NOT accept it as a user-supplied parameter."

**Canonical Spec Status:** ⚠️ PARTIALLY ADDRESSED

§4 (Envelope Constraints) states "`from` in request payloads is ignored/rejected; runtime injects true sender." This is correct but belongs in §12 (Security) for visibility, not buried in constraints.

**Recommendation:** Move identity derivation requirement to §12 with explicit enforcement description.

---

### 1.4 Input Validation Boundary — Explicit Placement

**Xavier Requirement:** "Validation must happen in the ACP extension's tool handlers, before persistence."

**Canonical Spec Status:** ⚠️ PARTIALLY ADDRESSED

§4 (Envelope Constraints) mentions validation boundary but should be expanded in §12 (Security).

**Recommendation:** Add §12.4:
> **Validation Boundary:** All ACP tool handlers MUST validate incoming payloads against JSON Schema before any database write. Malformed messages are rejected with descriptive error codes. Validation failures are logged but not persisted.

---

### 1.5 Broadcast Rate Limit Tighter Than Direct

**Xavier Requirement:** "Broadcast rate limits should be tighter than direct message limits."

**Canonical Spec Status:** ❌ NOT ADDRESSED

§10 (Delivery Model) references rate limiting but does not specify differential limits for broadcast vs. direct.

**Recommendation:** Add to §12 or §10:
> **Rate Limit Asymmetry:** Broadcast messages (`to: ["*"]`) are rate-limited more strictly than direct messages (e.g., 5/hour vs. 10/minute). Coordinator role or `high` priority required for broadcast.

---

## 2) SHOULD-FIX Findings

These items improve spec quality but don't block implementation.

### 2.1 Message Ordering / Sequence Field

**Xavier Requirement:** "Add a `sequence` field to negotiation messages within a thread."

**Canonical Spec Status:** ⚠️ PARTIALLY ADDRESSED

The envelope has `sequence?: number` field (§4) with note: "required for negotiation messages; optional otherwise." This is correct.

**Recommendation:** Consider adding example in §5 showing sequence usage for `task.*` messages.

---

### 2.2 Idempotency Checking

**Xavier Requirement:** "Add idempotency checking: agents should check message IDs against a local 'processed' set."

**Canonical Spec Status:** ❌ NOT ADDRESSED

§12 (Security) mentions rate limiting but not idempotency.

**Recommendation:** Add to §12:
> **Idempotency:** Agents should track processed message IDs locally. Duplicate deliveries (e.g., session inject + inbox file) must be detected and deduplicated to prevent double-processing.

---

### 2.3 Message Size Limit (4KB)

**Xavier Requirement:** "Add a max payload size (e.g., 4KB for inline content)."

**Canonical Spec Status:** ✅ ADDRESSED

§4 (Envelope Constraints): "Inline payload max 4KB; larger content must use artifact refs."

This is correctly implemented.

---

### 2.4 Handoff Timeout

**Xavier Requirement:** "Add a handoff timeout: if not completed within N hours, auto-escalate to coordinator."

**Canonical Spec Status:** ❌ NOT ADDRESSED

§7.2 (Handoff State Machine) mentions SLA but doesn't specify timeout enforcement.

**Recommendation:** Add to §7.2:
> **Timeout Enforcement:** Handoffs not completed within configured SLA (default: 24 hours) auto-escalate to the coordinator role. Implement via periodic cleanup job.

---

### 2.5 Circular Handoff Prevention

**Xavier Requirement:** "Add a `handoff_chain` field that tracks previous owners. Reject handoffs that create cycles."

**Canonical Spec Status:** ❌ NOT ADDRESSED

§7 (Handoff Protocol) mentions cycle prevention but doesn't specify implementation.

**Recommendation:** Add to §7.2:
> **Cycle Prevention:** Track `handoff_chain: string[]` of previous owners in handoff package. Database query rejects handoffs where new recipient already exists in chain.

---

### 2.6 Retention Policy (90 Days)

**Xavier Requirement:** "Specify: messages older than 90 days are archived."

**Canonical Spec Status:** ⚠️ PARTIALLY ADDRESSED

§12 states "active messages retained 90 days" but doesn't specify archive mechanism.

**Recommendation:** Add migration step in §9 or §12:
> **Retention Policy:** Messages older than 90 days exported to JSONL audit log and removed from active `messages` table. Handoff and decision records retained indefinitely.

---

### 2.7 Graceful Degradation Details

**Xavier Requirement:** "ACP failures must not block normal agent operation."

**Canonical Spec Status:** ⚠️ PARTIALLY ADDRESSED

§12 (Security, Safety, and Reliability) states "Graceful degradation: ACP failures must not block normal agent operation."

**Recommendation:** Add operational details:
> **Degradation Mode:** If SQLite DB unavailable, fall back to inbox file rendering. If inbox delivery fails, log error and continue. ACP tool errors return clear error messages without crashing the agent.

---

### 2.8 Extension-to-Extension Tool Calls Verification

**Xavier Requirement:** "Spike extension-to-extension tool calls (ACP calling workq_claim/release)."

**Canonical Spec Status:** ❌ NOT ADDRESSED

Not mentioned in canonical spec.

**Recommendation:** Add to verification spike list alongside session injection.

---

## 3) Items Correctly Addressed

The following Xavier requirements are already satisfied in the canonical spec:

| Requirement | Canonical Spec Location |
|-------------|------------------------|
| Single `acp` protocol with semver | §3, §4 (`version: "1.0.0"`) |
| SQLite primary + JSONL audit | §8.2, §9.1 |
| Storage: `_shared/teamspaces/<id>/` | §8.1 |
| `from` derived from session | §4, §12 |
| `to` as `string[]` (never union) | §4 |
| Policy block required | §4 |
| Payload cap 4KB | §4 |
| `status` field on envelope | §4 (`ACPMessageStatus`) |
| Handoff in P1 (not P2) | §2, §5 |
| Role authority matrix | §8.4 |
| Unique constraint on active handoffs | §9 (SQLite schema) |
| JSON Schema validation files | Mentioned in §15 |

---

## 4) P0 Exit Criteria Review

Per §15, P0 exit requires:

| Criterion | Status |
|-----------|--------|
| Canonical spec approved | ✅ Done (this review) |
| JSON Schemas exist + golden tests | ⚠️ NOT VERIFIED — Need to confirm files exist |
| Session injection spike | ❌ NOT DOCUMENTED in spec |
| Heartbeat/wake trigger spike | ❌ NOT DOCUMENTED in spec |
| Extension-to-extension tool calls spike | ❌ NOT DOCUMENTED in spec |
| Failed spike fallback designs | ❌ NOT DOCUMENTED |

**Gap:** The canonical spec must document verification spikes and fallback designs before P0 can be marked complete.

---

## 5) Approval Recommendation

### ✅ CONDITIONAL APPROVAL

The canonical spec is **substantially complete** and ready for implementation, but requires the following before P0 exit:

**Required Actions (MUST-FIX):**

1. Add verification spike documentation (§15 or new §16):
   - Session injection feasibility
   - Heartbeat/wake trigger feasibility  
   - Extension-to-extension tool calls feasibility
   - Fallback designs for each failed spike

2. Move identity derivation to §12 (Security) with enforcement description

3. Add validation boundary section to §12

4. Add broadcast rate limit asymmetry to §10 or §12

**Suggested Improvements (SHOULD-FIX):**

5. Add idempotency requirement to §12
6. Add handoff timeout enforcement to §7.2
7. Add handoff cycle prevention via chain tracking
8. Document retention/archival mechanism for 90-day policy

**Once MUST-FIX items are addressed, this spec is APPROVED for P1 implementation.**

---

## 6) Schema Quality Assessment

The SQLite schema (§9) is well-designed:

| Aspect | Assessment |
|--------|------------|
| Table structure | ✅ Matches TypeScript interfaces |
| JSON encoding | ✅ Appropriate use of JSON columns |
| Indexes | ✅ Covers common query patterns |
| Foreign keys | ✅ ON DELETE CASCADE for cleanup |
| Constraints | ✅ Unique constraint on active handoffs |
| Defaults | ✅ Appropriate use of DEFAULT expressions |

**No schema changes required.** The migration plan (`/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-db-migration-plan-claire.md`) correctly outlines the implementation path.

---

**Reviewer:** Claire  
**Date:** 2026-02-21  
**Recommendation:** CONDITIONAL APPROVAL — Address MUST-FIX items before engineering kickoff

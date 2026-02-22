# bs-tim-2: Human Approval Gateway (HITL Gateway)

**File:** `_shared/specs/bs-tim-2-hitl-gateway.md`  
**Date:** 2026-02-22  
**Status:** Draft for Tim review  
**Parent Issue:** `openclaw/openclaw#bs-tim-2`

---

## 1. Purpose & Scope

This document defines the architecture for a policy-driven **Human-in-the-Loop (HITL) Gateway** that gates tool executions based on approval policies. The system extends the existing `exec-approval` infrastructure to support generic tool request approval with configurable policies, timeouts, escalation, and audit trails.

The HITL Gateway provides:
- Policy-based gating for arbitrary tool requests (not just exec)
- Configurable approval workflows per tool/category
- Timeout and escalation handling
- Actor authorization boundaries
- Deterministic audit trails

---

## 2. Relationship to Existing Infrastructure

The HITL Gateway builds on and integrates with:

| Component | Integration Point |
|-----------|-------------------|
| `ExecApprovalManager` | Reused for request lifecycle management |
| `exec-approvals.ts` | Policy configuration and allowlist |
| `ExecApprovalForwarder` | Notification delivery to human channels |
| `ACPPolicy` (`human_gate`) | Message-level approval flag |
| Gateway `node-invoke` | Tool invocation interception |

**Key Distinction:**
- **Existing exec approvals:** Shell command approval only
- **HITL Gateway:** Generic tool request approval with extensible policy model

---

## 3. Approval Policy Model

### 3.1 Policy Configuration

```typescript
export type HitlPolicy = {
  /** Policy identifier */
  id: string;
  
  /** Human-readable name */
  name: string;
  
  /** Tool or category this policy applies to */
  target: HitlPolicyTarget[];
  
  /** Approval requirement level */
  gate: HitlGateLevel;
  
  /** Timeout for approval response */
  timeoutMs: number;
  
  /** Escalation config if timeout occurs */
  escalation?: HitlEscalation;
  
  /** Actor authorization requirements */
  authorization: HitlAuthorization;
  
  /** Audit configuration */
  audit: HitlAuditConfig;
};

export type HitlPolicyTarget =
  | { type: "tool"; toolName: string }
  | { type: "category"; category: string }
  | { type: "pattern"; pattern: string };  // glob pattern

export type HitlGateLevel =
  | "none"           // No approval required
  | "advisory"      // Request approval but allow override
  | "required"      // Block until approved
  | "strict";       // Require explicit approval + additional verification

export type HitlEscalation = {
  /** Escalate after timeoutMs */
  afterTimeoutMs: number;
  
  /** Who to notify/escalate to */
  escalateTo: string[];
  
  /** Fallback action if escalation also times out */
  fallbackAction: "allow-once" | "deny" | "block";
};

export type HitlAuthorization = {
  /** Minimum role required to approve */
  minApproverRole: "operator" | "admin" | "owner";
  
  /** Approver must be different from requester */
  requireDifferentActor: boolean;
  
  /** Required approvals count */
  requiredApprovals: number;
};

export type HitlAuditConfig = {
  /** Log all approval requests */
  logRequests: boolean;
  
  /** Log approval decisions */
  logDecisions: boolean;
  
  /** Log denial reasons */
  logDenials: boolean;
  
  /** Persist to durable audit store */
  persistDurable: boolean;
  
  /** Channels to forward approval requests to */
  forwardChannels?: HitlForwardTarget[];
};

export type HitlForwardTarget = {
  channel: string;
  to: string;
  accountId?: string;
  threadId?: string;
};
```

### 3.2 Policy Resolution

Policies are resolved in priority order:
1. Exact tool name match (`target.type: "tool"`)
2. Category match (`target.type: "category"`)
3. Pattern match (`target.type: "pattern"`)
4. Default fallback (if no match)

### 3.3 Default Policies

```typescript
export const DEFAULT_HITL_POLICIES: HitlPolicy[] = [
  {
    id: "default-exec",
    name: "Shell Command Execution",
    target: [{ type: "category", category: "exec" }],
    gate: "required",
    timeoutMs: 120_000,
    authorization: {
      minApproverRole: "operator",
      requireDifferentActor: true,
      requiredApprovals: 1,
    },
    audit: {
      logRequests: true,
      logDecisions: true,
      logDenials: true,
      persistDurable: true,
    },
  },
  {
    id: "default-file-write",
    name: "File Write Operations",
    target: [{ type: "pattern", pattern: "file:write*" }],
    gate: "required",
    timeoutMs: 60_000,
    authorization: {
      minApproverRole: "operator",
      requireDifferentActor: true,
      requiredApprovals: 1,
    },
    audit: {
      logRequests: true,
      logDecisions: true,
      logDenials: true,
      persistDurable: true,
    },
  },
];
```

---

## 4. Request Envelope

### 4.1 HitlRequest Envelope

```typescript
export type HitlRequest = {
  /** Unique request identifier (UUIDv7) */
  id: string;
  
  /** Tool being requested */
  tool: string;
  
  /** Tool arguments (sanitized) */
  arguments: Record<string, unknown>;
  
  /** Requester identity */
  requester: HitlActor;
  
  /** Request timestamp */
  requestedAtMs: number;
  
  /** Policy that triggered this request */
  policyId: string;
  
  /** Request TTL */
  expiresAtMs: number;
  
  /** Current state */
  status: HitlRequestStatus;
  
  /** Approval decisions */
  decisions: HitlDecision[];
  
  /** Audit trail */
  audit: HitlAuditEntry[];
};

export type HitlActor = {
  /** Session key of the actor */
  sessionKey: string;
  
  /** Display name */
  displayName: string;
  
  /** Role at time of request */
  role: "user" | "operator" | "admin" | "owner";
  
  /** Device/client info */
  deviceId?: string;
  clientId?: string;
  connId?: string;
};

export type HitlRequestStatus =
  | "pending"      // Awaiting approval
  | "approved"     // Approved and ready to execute
  | "denied"       // Denied
  | "expired"      // Timed out
  | "escalated"    // Escalated to additional approvers
  | "executing"    // Approved and being executed
  | "completed"    // Execution completed
  | "failed";      // Execution failed

export type HitlDecision = {
  /** Approver identity */
  actor: HitlActor;
  
  /** Decision */
  decision: "approve" | "deny";
  
  /** Optional reason */
  reason?: string;
  
  /** Timestamp */
  decidedAtMs: number;
  
  /** Approval type */
  type: "explicit" | "escalation" | "timeout-fallback";
};

export type HitlAuditEntry = {
  /** Event type */
  event: HitlAuditEvent;
  
  /** Actor involved (may be system) */
  actor: HitlActor | null;
  
  /** Event timestamp */
  timestampMs: number;
  
  /** Additional data */
  data?: Record<string, unknown>;
};

export type HitlAuditEvent =
  | "request.created"
  | "request.pending"
  | "request.escalated"
  | "decision.approved"
  | "decision.denied"
  | "request.expired"
  | "execution.started"
  | "execution.completed"
  | "execution.failed";
```

---

## 5. Approval States & Transitions

### 5.1 State Machine

```
                    +-------------+
                    |   PENDING   |
                    +------+------+
                           |
            +--------------+--------------+
            |              |              |
      [approved]    [denied]       [expired]
            |              |              |
            v              v              v
     +------------+ +------------+ +------------+
     |  APPROVED  | |   DENIED   | |  EXPIRED   |
     +----+------+ +----+-------+ +------------+
          |
    [execution]
          |
          v
   +-------------+
   | EXECUTING   |
   +------+------+
          |
    +-----+-----+
    |           |
[complete]  [failed]
    |           |
    v           v
 +--------+ +--------+
 |COMPLETE| | FAILED |
 +--------+ +--------+
```

### 5.2 Valid Transitions

| From | To | Trigger |
|------|-----|---------|
| PENDING | APPROVED | Required approvals received |
| PENDING | DENIED | Any denial received |
| PENDING | EXPIRED | Timeout exceeded |
| PENDING | ESCALATED | Timeout with escalation configured |
| ESCALATED | APPROVED | Escalation approvals received |
| ESCALATED | DENIED | Any denial received |
| ESCALATED | EXPIRED | Escalation timeout exceeded |
| APPROVED | EXECUTING | Tool execution begins |
| EXECUTING | COMPLETED | Tool completed successfully |
| EXECUTING | FAILED | Tool execution failed |

---

## 6. Timeout & Escalation

### 6.1 Timeout Handling

```typescript
export interface HitlTimeoutConfig {
  /** Initial approval timeout */
  initialTimeoutMs: number;
  
  /** What happens on timeout */
  onTimeout: "expire" | "escalate" | "auto-deny";
  
  /** Escalation config (if onTimeout is escalate) */
  escalation?: HitlEscalation;
}
```

### 6.2 Escalation Flow

```
PENDING (timeout expires)
       |
       v
ESCALATED ---> Notify escalateTo[]
       |
       v
  [wait escalationTimeoutMs]
       |
       +-----> [approved] ---> APPROVED
       |
       +-----> [denied] ---> DENIED
       |
       +-----> [timeout] ---> fallbackAction
```

---

## 7. Actor Authorization Boundaries

### 7.1 Roles & Permissions

```typescript
export type HitlRole = "user" | "operator" | "admin" | "owner";

export const HITL_ROLE_HIERARCHY: Record<HitlRole, number> = {
  user: 0,
  operator: 1,
  admin: 2,
  owner: 3,
};

export function canApprove(approver: HitlActor, minRole: HitlRole): boolean {
  return HITL_ROLE_HIERARCHY[approver.role] >= HITL_ROLE_HIERARCHY[minRole];
}

export function canBypass(actor: HitlActor, policy: HitlPolicy): boolean {
  // Owner can always bypass advisory gates
  if (policy.gate === "advisory" && actor.role === "owner") {
    return true;
  }
  return false;
}
```

### 7.2 Authorization Rules

1. **Requester ≠ Approver:** By default, approver must be different from requester (configurable)
2. **Role Minimum:** Approver must meet `minApproverRole` threshold
3. **Multi-party:** If `requiredApprovals > 1`, multiple distinct approvers required

### 7.3 Security Boundaries

- **No self-approval:** Even owners cannot approve their own requests (enforced at gateway)
- **Device binding:** Approval IDs bound to device/client to prevent replay attacks
- **Argument integrity:** Tool arguments captured at request time, validated before execution

---

## 8. Audit Trail Requirements

### 8.1 Audit Events

All HITL operations emit audit events:

```typescript
export type HitlAuditRecord = {
  /** Event ID */
  id: string;
  
  /** Request ID this audit belongs to */
  requestId: string;
  
  /** Event type */
  event: HitlAuditEvent;
  
  /** Actor (null if system) */
  actor: HitlActor | null;
  
  /** Timestamp (ISO8601) */
  timestamp: string;
  
  /** Event data */
  data: Record<string, unknown>;
  
  /** Hash for integrity */
  hash: string;
};
```

### 8.2 Audit Storage

- **Primary:** SQLite database (same as exec-approvals)
- **Export:** JSONL for compliance/export
- **Retention:** Configurable (default: 90 days)

### 8.3 Required Audit Events

| Event | Required Fields |
|-------|-----------------|
| `request.created` | requester, tool, arguments, policyId |
| `request.pending` | timeoutMs |
| `decision.approved` | approver, reason |
| `decision.denied` | approver, reason |
| `request.expired` | timeoutMs, escalationAttempted |
| `execution.started` | approvedBy |
| `execution.completed` | result |
| `execution.failed` | error |

---

## 9. Integration Points

### 9.1 Gateway Integration

The HITL Gateway intercepts tool invocations at the gateway layer:

```typescript
// In gateway node-invoke handler
async function handleToolInvocation(params: {
  tool: string;
  arguments: Record<string, unknown>;
  requester: HitlActor;
}): Promise<HitlResult> {
  
  // 1. Resolve policy for tool
  const policy = resolveHitlPolicy(params.tool);
  if (!policy || policy.gate === "none") {
    return executeTool(params);
  }
  
  // 2. Create HITL request
  const request = createHitlRequest({
    tool: params.tool,
    arguments: params.arguments,
    requester: params.requester,
    policy,
  });
  
  // 3. If advisory and requester can bypass, execute directly
  if (policy.gate === "advisory" && canBypass(params.requester, policy)) {
    return executeTool(params);
  }
  
  // 4. Require approval
  if (policy.gate === "required" || policy.gate === "strict") {
    const decision = await waitForApproval(request, policy.timeoutMs);
    if (!decision.approved) {
      throw new HitlDeniedError(decision.reason);
    }
  }
  
  // 5. Execute tool
  return executeTool(params);
}
```

### 9.2 Forwarding Integration

Requests are forwarded to configured channels using existing `ExecApprovalForwarder`:

```typescript
const forwarder = new ExecApprovalForwarder(config);
await forwarder.sendApprovalRequest({
  requestId: request.id,
  tool: request.tool,
  arguments: request.arguments,
  requester: request.requester.displayName,
  policy: request.policyId,
  timeout: request.expiresAtMs - request.requestedAtMs,
});
```

---

## 10. Failure Modes

| Failure Mode | Behavior | Recovery |
|--------------|----------|----------|
| Gateway crash during pending approval | Request expires, audit logged | Resubmit request |
| Approval message delivery fails | Retry with exponential backoff | Manual re-notification |
| Tool execution fails post-approval | Return error, audit logged | Retry with new request |
| Duplicate request submitted | Detect via requestId, reject | Use existing pending request |
| System clock skew | Use monotonic time for timeouts | NTP sync |

---

## 11. Backward Compatibility

### 11.1 Existing Exec Approvals

The HITL Gateway is additive:
- Existing `exec-approval` functionality continues to work unchanged
- New policies can target exec tools via the HITL Gateway
- Policy resolution prefers existing exec-approval for exec tools (configurable)

### 11.2 Migration Path

1. **Phase 1:** Deploy HITL Gateway alongside existing exec-approvals
2. **Phase 2:** Enable HITL policies for non-exec tools
3. **Phase 3:** Migrate exec tools to HITL policies
4. **Phase 4:** Deprecate legacy exec-approval config

---

## 12. Questions for Tim

1. **Policy Storage:** Should HITL policies be stored in the same `exec-approvals.json` or a separate file?
2. **Default Gate Level:** Should the default for new tools be `none` (opt-in) or `required` (opt-out)?
3. **Backward Compatibility:** Should the existing exec-approval remain as-is, or should it be a compatibility shim over HITL?
4. **Strict Mode:** What additional verification should `strict` gate level require (e.g., 2FA, multiple approvers)?
5. **Escalation Channels:** Are there specific channels (Slack, Discord) that should be default escalation targets?

---

## Appendix A: Sequence Diagrams

### A.1 Basic Approval Flow

```
+--------+          +--------+          +--------+          +--------+
| Agent  |          |Gateway |          |Forwarder|         | Human  |
+--------+          +--------+          +--------+         +--------+
    |                   |                   |                   |
    | invoke(tool)      |                   |                   |
    |------------------>|                   |                   |
    |                   | resolvePolicy()   |                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |                   | createRequest()   |                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |                   | forwardRequest()  |                   |
    |                   |------------------>|                   |
    |                   |                   | sendToChannel()   |
    |                   |                   |------------------->|
    |                   |                   |                   |
    |  pending          |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
    |                   |                   |    approve()      |
    |                   |                   |<------------------|
    |                   |                   |                   |
    |                   |    decision()     |                   |
    |                   |<------------------|                   |
    |                   |                   |                   |
    |                   | executeTool()     |                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |  result          |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
```

### A.2 Timeout & Escalation Flow

```
+--------+          +--------+          +--------+          +--------+
| Agent  |          |Gateway |          |Forwarder|         | Human  |
+--------+          +--------+          +--------+         +--------+
    |                   |                   |                   |
    | invoke(tool)      |                   |                   |
    |------------------>|                   |                   |
    |                   | ... (approval flow) ...             |
    |                   |                   |                   |
    |  pending          |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
    |                   |    (timeout)      |                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |                   | escalateRequest() |                   |
    |                   |------------------>|                   |
    |                   |                   | sendEscalation()  |
    |                   |                   |------------------->|
    |                   |                   |                   |
    |  escalated        |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
    |                   |                   |    approve()     |
    |                   |                   |<------------------|
    |                   |                   |                   |
    |                   |    decision()    |                   |
    |                   |<-----------------|                   |
    |                   |                   |                   |
    |                   | executeTool()    |                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |  result          |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
```

### A.3 Denial Flow

```
+--------+          +--------+          +--------+          +--------+
| Agent  |          |Gateway |          |Forwarder|         | Human  |
+--------+          +--------+          +--------+         +--------+
    |                   |                   |                   |
    | invoke(tool)      |                   |                   |
    |------------------>|                   |                   |
    |                   | ... (approval flow) ...             |
    |                   |                   |                   |
    |  pending          |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
    |                   |                   |    deny()        |
    |                   |                   |<------------------|
    |                   |                   |                   |
    |                   |    decision()    |                   |
    |                   |<-----------------|                   |
    |                   |                   |                   |
    |                   | rejectExecution()                   |
    |                   |----+              |                   |
    |                   |<---+              |                   |
    |                   |                   |                   |
    |  error: denied    |                   |                   |
    |<------------------|                   |                   |
    |                   |                   |                   |
```

# bs-tim-2 Implementation Plan

## Overview

This document outlines the implementation plan for the Human Approval Gateway (HITL Gateway) including migration strategy and acceptance tests.

---

## Implementation Phases

### Phase 1: Core Infrastructure (Week 1)

**Goal:** Establish the HITL request lifecycle management

#### 1.1 Extend ExecApprovalManager

- **Location:** `src/gateway/exec-approval-manager.ts`
- **Changes:**
  - Rename `ExecApprovalRequestPayload` → `HitlRequestPayload` (generic)
  - Add `tool` field to support non-exec tools
  - Add `category` field for policy matching

```typescript
// New fields in HitlRequestPayload
export type HitlRequestPayload = {
  tool?: string;        // Tool name (e.g., "file.write", "http.request")
  category?: string;    // Tool category (e.g., "exec", "data", "network")
  command?: string;    // Keep for backward compat with exec
  cwd?: string | null;
  // ... existing fields
};
```

#### 1.2 Create HitlRequestStore

- **New file:** `src/gateway/hitl-request-store.ts`
- **Purpose:** SQLite-backed storage for HITL requests
- **Schema:**

```sql
CREATE TABLE hitl_requests (
  id TEXT PRIMARY KEY,
  tool TEXT NOT NULL,
  arguments TEXT,  -- JSON
  requester_session TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  policy_id TEXT NOT NULL,
  status TEXT NOT NULL,
  expires_at_ms INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);

CREATE TABLE hitl_decisions (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  actor_session TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  decided_at_ms INTEGER NOT NULL,
  type TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES hitl_requests(id)
);

CREATE TABLE hitl_audit (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  event TEXT NOT NULL,
  actor_session TEXT,
  actor_role TEXT,
  data TEXT,  -- JSON
  timestamp_ms INTEGER NOT NULL,
  hash TEXT NOT NULL,
  FOREIGN KEY (request_id) REFERENCES hitl_requests(id)
);
```

#### 1.3 Create HitlPolicyEngine

- **New file:** `src/gateway/hitl-policy-engine.ts`
- **Purpose:** Policy resolution and matching
- **Responsibilities:**
  - Load policies from config
  - Resolve policy for given tool
  - Validate authorization

---

### Phase 2: Gateway Integration (Week 2)

**Goal:** Integrate HITL gating into tool execution pipeline

#### 2.1 Create HitlGateway

- **New file:** `src/gateway/hitl-gateway.ts`
- **Public API:**

```typescript
export class HitlGateway {
  constructor(
    private policyEngine: HitlPolicyEngine,
    private requestStore: HitlRequestStore,
    private approvalManager: ExecApprovalManager,
    private forwarder: ExecApprovalForwarder,
  ) {}

  async checkAndGate(params: {
    tool: string;
    arguments: Record<string, unknown>;
    requester: HitlActor;
  }): Promise<HitlGateResult>;

  async recordDecision(requestId: string, decision: HitlDecision): Promise<void>;

  async getRequest(requestId: string): Promise<HitlRequest | null>;
}
```

#### 2.2 Integrate with node-invoke

- **Modify:** `src/gateway/node-invoke.ts` (or relevant handler)
- **Add:** HITL check before tool execution
- **Flow:**
  1. Intercept tool invocation
  2. Resolve applicable policy
  3. If gate required → create request, wait for approval
  4. Execute or reject

---

### Phase 3: Policy Configuration (Week 3)

**Goal:** User-configurable policies

#### 3.1 Policy Schema

- **New file:** `src/config/hitl-policies.ts`
- **Schema:** YAML/JSON configuration

```yaml
# ~/.openclaw/hitl-policies.yaml
policies:
  - id: "exec-default"
    name: "Shell Command Execution"
    target:
      - type: "category"
        value: "exec"
    gate: "required"
    timeoutMs: 120000
    authorization:
      minApproverRole: "operator"
      requireDifferentActor: true
      requiredApprovals: 1

  - id: "file-write"
    name: "File Write Operations"
    target:
      - type: "tool"
        value: "file.write"
      - type: "tool"
        value: "file.create"
    gate: "required"
    timeoutMs: 60000

  - id: "http-sensitive"
    name: "Sensitive HTTP Requests"
    target:
      - type: "pattern"
        value: "http.request:*"
    gate: "advisory"
    timeoutMs: 30000
```

#### 3.2 Policy CLI

- **New file:** `src/cli/hitl-policies-cli.ts`
- **Commands:**
  - `hitl policies list` - List policies
  - `hitl policies add <policy>` - Add policy
  - `hitl policies remove <id>` - Remove policy

---

### Phase 4: Audit & Compliance (Week 4)

**Goal:** Complete audit trail

#### 4.1 Audit Events

- **Emit events:** All state transitions logged
- **Durable storage:** SQLite + JSONL export

#### 4.2 Audit CLI

- **Commands:**
  - `hitl audit list --request-id <id>` - List audit for request
  - `hitl audit export --from <date> --to <date>` - Export audit log

---

## Migration Strategy

### Backward Compatibility

1. **Exec approvals unchanged:** Existing exec-approval system continues to work
2. **Opt-in migration:** New HITL policies can be enabled per-tool
3. **Gradual rollout:** Enable for non-critical tools first

### Migration Checklist

- [ ] Deploy Phase 1 infrastructure (no behavior change)
- [ ] Configure first HITL policy for test tool
- [ ] Verify approval flow works
- [ ] Enable for production tools (start with read-only)
- [ ] Monitor and adjust timeouts
- [ ] Expand to write operations
- [ ] Deprecate legacy exec-approval when HITL coverage complete

### Rollback Plan

- If HITL causes issues, disable per-policy via config
- Fallback to existing exec-approval remains available

---

## Acceptance Tests

### Unit Tests

#### T1: Policy Resolution

```typescript
describe("HitlPolicyEngine", () => {
  it("resolves exact tool name match", () => {
    const policy = engine.resolve("file.write");
    expect(policy.id).toBe("file-write");
  });

  it("resolves category match when no exact match", () => {
    const policy = engine.resolve("custom.exec-tool");
    expect(policy.category).toBe("exec");
  });

  it("returns null for tools with no policy and default is none", () => {
    const policy = engine.resolve("unknown-tool");
    expect(policy.gate).toBe("none");
  });
});
```

#### T2: Authorization

```typescript
describe("HitlAuthorization", () => {
  it("allows operator to approve for minRole=operator", () => {
    const canApprove = checkAuthorization({
      approver: { role: "operator" },
      policy: { minApproverRole: "operator" },
    });
    expect(canApprove).toBe(true);
  });

  it("denies user for minRole=admin", () => {
    const canApprove = checkAuthorization({
      approver: { role: "user" },
      policy: { minApproverRole: "admin" },
    });
    expect(canApprove).toBe(false);
  });

  it("rejects self-approval when required", () => {
    const canApprove = checkAuthorization({
      approver: { sessionKey: "same" },
      requester: { sessionKey: "same" },
      policy: { requireDifferentActor: true },
    });
    expect(canApprove).toBe(false);
  });
});
```

#### T3: State Transitions

```typescript
describe("HitlRequest State Machine", () => {
  it("transitions PENDING → APPROVED on approval", () => {
    const request = createPendingRequest();
    const result = applyDecision(request, { decision: "approve" });
    expect(result.status).toBe("approved");
  });

  it("transitions PENDING → DENIED on denial", () => {
    const request = createPendingRequest();
    const result = applyDecision(request, { decision: "deny" });
    expect(result.status).toBe("denied");
  });

  it("transitions PENDING → EXPIRED on timeout", () => {
    const request = createPendingRequest({ expiresAtMs: Date.now() - 1 });
    const result = expireRequest(request);
    expect(result.status).toBe("expired");
  });

  it("rejects invalid transition PENDING → COMPLETED", () => {
    const request = createPendingRequest();
    expect(() => {
      applyDecision(request, { decision: "complete" });
    }).toThrow("Invalid transition");
  });
});
```

### Integration Tests

#### T4: End-to-End Approval Flow

```typescript
describe("HITL Gateway E2E", () => {
  it("approves and executes tool", async () => {
    // 1. Invoke tool
    const { requestId } = await gateway.checkAndGate({
      tool: "file.read",
      arguments: { path: "/tmp/test.txt" },
      requester: { sessionKey: "user-1", role: "user" },
    });

    // 2. Wait for approval
    await gateway.recordDecision(requestId, {
      actor: { sessionKey: "operator-1", role: "operator" },
      decision: "approve",
    });

    // 3. Verify execution occurred
    expect(toolExecutor.execute).toHaveBeenCalled();
  });

  it("denies and rejects tool", async () => {
    const { requestId } = await gateway.checkAndGate({
      tool: "file.write",
      arguments: { path: "/etc/passwd" },
      requester: { sessionKey: "user-1", role: "user" },
    });

    await gateway.recordDecision(requestId, {
      actor: { sessionKey: "operator-1", role: "operator" },
      decision: "deny",
      reason: "Dangerous path",
    });

    expect(toolExecutor.execute).not.toHaveBeenCalled();
  });

  it("times out and expires request", async () => {
    jest.useFakeTimers();
    
    const { requestId } = await gateway.checkAndGate({
      tool: "exec.run",
      arguments: { command: "ls" },
      requester: { sessionKey: "user-1", role: "user" },
    });

    jest.advanceTimersByTime(120001);

    const request = await gateway.getRequest(requestId);
    expect(request.status).toBe("expired");
  });
});
```

### Performance Tests

#### T5: Concurrency

```typescript
describe("HITL Concurrency", () => {
  it("handles 100 concurrent approval requests", async () => {
    const requests = Array(100).fill(null).map((_, i) =>
      gateway.checkAndGate({
        tool: "file.read",
        arguments: { path: `/tmp/${i}.txt` },
        requester: { sessionKey: `user-${i}`, role: "user" },
      })
    );

    const results = await Promise.all(requests);
    expect(results.length).toBe(100);
  });
});
```

---

## Files to Create/Modify

### New Files

| File | Purpose |
|------|---------|
| `src/gateway/hitl-request-store.ts` | SQLite storage for HITL requests |
| `src/gateway/hitl-policy-engine.ts` | Policy resolution engine |
| `src/gateway/hitl-gateway.ts` | Main HITL gateway class |
| `src/config/hitl-policies.ts` | Policy configuration schema |
| `src/cli/hitl-policies-cli.ts` | CLI for managing policies |
| `src/gateway/hitl-audit.ts` | Audit trail management |
| `test/gateway/hitl-gateway.test.ts` | Unit tests |
| `test/gateway/hitl-policy-engine.test.ts` | Policy tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/gateway/exec-approval-manager.ts` | Extend for generic tool support |
| `src/gateway/node-invoke.ts` | Add HITL gating |
| `src/config/types.approvals.ts` | Add HITL types |
| `src/config/zod-schema.approvals.ts` | Add HITL schema |

---

## Timeline Estimate

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 1 week | Core infrastructure |
| Phase 2 | 1 week | Gateway integration |
| Phase 3 | 1 week | Policy configuration |
| Phase 4 | 1 week | Audit & compliance |
| **Total** | **4 weeks** | Production-ready HITL Gateway |

---

## Open Questions for Tim

1. **Storage location:** Single SQLite file or separate for HITL?
2. **Policy defaults:** Should new tools default to `gate: "none"` or `gate: "required"`?
3. **Phase 1 scope:** Should we start with exec tools only or include file operations?
4. **Escalation targets:** Pre-configure Slack/Discord channels?

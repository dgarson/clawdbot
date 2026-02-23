---
title: "Task 8: Wire Per-Toolcall Approve/Reject"
summary: "Extract duplicated per-toolcall approve/reject logic into a shared useToolCallActions hook; update InboxPanel and ApprovalsPage to consume it"
owner: "openclaw"
status: "ready"
branch: "luis/ui-redesign"
last_updated: "2026-02-21"
---

# Task 8: Wire Per-Toolcall Approve/Reject

## Context and Background

Tasks 1–7 built the Approvals + Milestone Feed UI. The result is a working system, but the
per-toolcall approve/reject logic is duplicated across two components. This task extracts that logic
into a single shared hook.

### What Was Built (Tasks 1–7)

| Component / File      | Location                                                      | Role                                                                        |
| --------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `ApprovalItem`        | `apps/web/src/components/domain/approvals/ApprovalItem.tsx`   | Renders one pending approval row                                            |
| `ApprovalsQueue`      | `apps/web/src/components/domain/approvals/ApprovalsQueue.tsx` | Renders the full approval list, supports compact/full mode and bulk actions |
| `MilestoneItem`       | `apps/web/src/components/domain/approvals/MilestoneItem.tsx`  | One-liner row for a completed milestone                                     |
| `MilestoneFeed`       | `apps/web/src/components/domain/approvals/MilestoneFeed.tsx`  | Compact (last 8) and full (date-bucketed) milestone feed                    |
| `InboxPanel`          | `apps/web/src/components/composed/InboxPanel.tsx`             | Right-side Sheet (520px wide); compact approvals + milestone feed           |
| `usePendingApprovals` | `apps/web/src/hooks/usePendingApprovals.ts`                   | Synthesizes `PendingApproval[]` from agent store                            |
| `/approvals` route    | `apps/web/src/routes/approvals.tsx` + `approvals.lazy.tsx`    | Full-page Inbox view                                                        |
| Sidebar badge         | `apps/web/src/components/layout/Sidebar.tsx`                  | Live pending count badge on Inbox nav item                                  |

### The Problem: Duplicated Logic

Both `InboxPanel.tsx` and `approvals.lazy.tsx` contain **identical** per-toolcall approve/reject
logic inline. Each file independently:

1. Looks up the `PendingApproval` by `toolCallId`
2. Guards on gateway connectivity (`gatewayCtx?.isConnected`)
3. Calls `gatewayCtx.client.request("tool.approve", { toolCallId })`
   or `gatewayCtx.client.request("tool.reject", { toolCallId, reason: "Denied by operator" })`
4. Calls `updateAgentWith(agentId, ...)` to optimistically remove the ID from
   `agent.pendingToolCallIds` and decrement `agent.pendingApprovals`
5. Shows a toast on success or failure

Additionally, `approvals.lazy.tsx` has four more action functions: `approveAllForAgent`,
`rejectAllForAgent`, `handleApproveAllLowRisk` — these are also unique to that file and have no
shared home.

The pre-existing `useAgentApprovalActions` hook (see below) is **bulk/agent-level only** and is
not a superset of what's needed.

---

## Gateway RPC Specification

### Critical Clarification

The `tool.approve` and `tool.reject` RPCs are **not found** in `src/gateway/server-methods/` of
this repo. They are either:

- Handled by the connected Claude Code CLI process via the node bridge (the gateway proxies them
  to the agent runtime), or
- Implemented as an extension/plugin registered at runtime.

**The frontend should not change this RPC call surface.** The existing calls in
`useAgentApprovalActions.ts` are proven to work. Task 8 does not touch the gateway backend.

### RPC: `tool.approve`

```ts
// Request
gatewayCtx.client.request("tool.approve", { toolCallId: string });

// Response: void (throws on failure)
// Auth scope: operator (any authenticated operator connection)
```

### RPC: `tool.reject`

```ts
// Request
gatewayCtx.client.request("tool.reject", {
  toolCallId: string,
  reason: string, // Convention: "Denied by operator"
});

// Response: void (throws on failure)
// Auth scope: operator (any authenticated operator connection)
```

### Gateway Events (inbound, handled by `useAgentLiveUpdates`)

These events are already handled by `useAgentLiveUpdates.ts` and **must not** be duplicated in
the new hook. The hook only sends RPCs; local state cleanup after `tool.approved`/`tool.rejected`
events arrives automatically.

```ts
// tool.pending — adds toolCallId to agent's pendingToolCallIds
{ event: "tool.pending", payload: { toolCallId, toolName, agentId, args, risk } }

// tool.approved — fires after gateway confirms approval
{ event: "tool.approved", payload: { toolCallId, agentId } }

// tool.rejected — fires after gateway confirms rejection
{ event: "tool.rejected", payload: { toolCallId, reason, agentId } }
```

**Important:** The gateway events (`tool.approved` / `tool.rejected`) remove the ID from state
via `clearPending()` in `useAgentLiveUpdates`. The new hook should **also** apply an optimistic
update immediately on RPC success, before the event arrives, so the UI clears without a visible
delay. This is the same pattern used today.

---

## Existing Code to Understand Before Implementing

### `apps/web/src/hooks/useAgentApprovalActions.ts` (DO NOT MODIFY)

This hook handles **bulk per-agent** approve/reject (approve ALL pending calls for one agent at
once). It is used in `AgentStatusRow` and similar views. It is **not** a per-toolcall hook and
must not be replaced or modified.

```ts
// Key signature
const { approvePending, denyPending } = useAgentApprovalActions();
approvePending(agentId); // approves ALL pendingToolCallIds for that agent
denyPending(agentId); // rejects ALL pendingToolCallIds for that agent
```

### `apps/web/src/hooks/usePendingApprovals.ts`

Returns `PendingApproval[]`. The new hook needs this (or a subset via params) to look up
`agentId` from a `toolCallId`.

```ts
export interface PendingApproval {
  toolCall: ToolCall; // { toolCallId, toolName, args, status, risk }
  agentId: string;
  agentName: string;
  createdAtMs: number;
}
```

### `apps/web/src/components/composed/InboxPanel.tsx` — CURRENT (to be simplified)

Lines 23–59: `handleApprove` and `handleReject` functions — these will be replaced by the shared
hook.

### `apps/web/src/routes/approvals.lazy.tsx` — CURRENT (to be simplified)

Lines 17–113: `approveToolCall`, `rejectToolCall`, `approveAllForAgent`, `rejectAllForAgent`,
`handleApproveAllLowRisk` functions — most will be replaced by the shared hook.

### `apps/web/src/stores/useAgentStore.ts`

Key fields on `Agent`:

```ts
pendingToolCallIds?: string[];   // the source of truth for pending IDs
pendingApprovals?: number;       // derived count (kept in sync)
```

Key method:

```ts
updateAgentWith(id: string, updater: (agent: Agent) => Agent): void
```

---

## Implementation Plan

### Step 1 — Create `useToolCallActions` hook

**File:** `apps/web/src/hooks/useToolCallActions.ts` (new file)

This hook is the single source of truth for per-toolcall approve/reject operations.

**Public API the hook must expose:**

```ts
export function useToolCallActions(approvals: PendingApproval[]) {
  return {
    approveToolCall: (toolCallId: string) => Promise<void>,
    rejectToolCall: (toolCallId: string) => Promise<void>,
    approveAllForAgent: (agentId: string) => Promise<void>,
    rejectAllForAgent: (agentId: string) => Promise<void>,
  };
}
```

**Implementation requirements:**

1. **Connectivity guard** — before any RPC, check `gatewayCtx?.isConnected`; call
   `showError("Gateway not connected.")` and return early if not connected.

2. **Approval lookup** — use the passed-in `approvals` array to find `approval.agentId` given
   a `toolCallId`. If the approval is not found, return early (silent no-op; the UI should
   prevent calling with an unknown ID).

3. **Optimistic update** — on RPC success, call `updateAgentWith(agentId, updater)` where the
   updater filters out the `toolCallId` from `pendingToolCallIds` and decrements
   `pendingApprovals`. This mirrors what `useAgentLiveUpdates` does when the event arrives,
   ensuring no visible stale state.

4. **Toast feedback:**
   - `approveToolCall` success: `showSuccess("Approved.")`
   - `rejectToolCall` success: `showSuccess("Rejected.")`
   - `approveAllForAgent` success: `showSuccess(\`Approved ${n} requests.\`)`
   - `rejectAllForAgent` success: `showSuccess(\`Rejected ${n} requests.\`)`
   - Any failure: `showError("Failed to approve. The request may have expired.")` or equivalent.
   - Do **not** use `showWarning` (that is reserved for `useAgentApprovalActions`'s bulk flow).

5. **Bulk operations** (`approveAllForAgent` / `rejectAllForAgent`):
   - Filter `approvals` by `agentId` to find all per-agent calls.
   - Fan out with `Promise.all` — same pattern as current `approvals.lazy.tsx`.
   - Optimistic update: set `pendingToolCallIds: []` and `pendingApprovals: 0` for that agent.
   - If `agentApprovals.length === 0`, return early silently.

6. **`handleApproveAllLowRisk`** logic should **not** live in the hook — it is page-level
   orchestration. Keep it in `approvals.lazy.tsx` but simplify it to call
   `approveAllForAgent(agentId)` per low-risk agent ID.

**Complete stub for reference:**

```ts
import * as React from "react";
import { useOptionalGateway } from "@/providers/GatewayProvider";
import { useAgentStore } from "@/stores/useAgentStore";
import { showError, showSuccess } from "@/lib/toast";
import type { PendingApproval } from "@/components/domain/approvals";

export function useToolCallActions(approvals: PendingApproval[]) {
  const gatewayCtx = useOptionalGateway();
  const updateAgentWith = useAgentStore((s) => s.updateAgentWith);

  const approveToolCall = React.useCallback(
    async (toolCallId: string) => {
      const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
      if (!approval) return;
      if (!gatewayCtx?.isConnected) {
        showError("Gateway not connected.");
        return;
      }
      try {
        await gatewayCtx.client.request("tool.approve", { toolCallId });
        updateAgentWith(approval.agentId, (agent) => {
          const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
          return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
        });
        showSuccess("Approved.");
      } catch {
        showError("Failed to approve. The request may have expired.");
      }
    },
    [approvals, gatewayCtx, updateAgentWith],
  );

  const rejectToolCall = React.useCallback(
    async (toolCallId: string) => {
      const approval = approvals.find((a) => a.toolCall.toolCallId === toolCallId);
      if (!approval) return;
      if (!gatewayCtx?.isConnected) {
        showError("Gateway not connected.");
        return;
      }
      try {
        await gatewayCtx.client.request("tool.reject", {
          toolCallId,
          reason: "Denied by operator",
        });
        updateAgentWith(approval.agentId, (agent) => {
          const remaining = (agent.pendingToolCallIds ?? []).filter((id) => id !== toolCallId);
          return { ...agent, pendingToolCallIds: remaining, pendingApprovals: remaining.length };
        });
        showSuccess("Rejected.");
      } catch {
        showError("Failed to reject. The request may have expired.");
      }
    },
    [approvals, gatewayCtx, updateAgentWith],
  );

  const approveAllForAgent = React.useCallback(
    async (agentId: string) => {
      if (!gatewayCtx?.isConnected) {
        showError("Gateway not connected.");
        return;
      }
      const agentApprovals = approvals.filter((a) => a.agentId === agentId);
      if (!agentApprovals.length) return;
      try {
        await Promise.all(
          agentApprovals.map((a) =>
            gatewayCtx.client.request("tool.approve", { toolCallId: a.toolCall.toolCallId }),
          ),
        );
        updateAgentWith(agentId, (agent) => ({
          ...agent,
          pendingToolCallIds: [],
          pendingApprovals: 0,
        }));
        showSuccess(`Approved ${agentApprovals.length} requests.`);
      } catch {
        showError("Failed to approve all. Some requests may have expired.");
      }
    },
    [approvals, gatewayCtx, updateAgentWith],
  );

  const rejectAllForAgent = React.useCallback(
    async (agentId: string) => {
      if (!gatewayCtx?.isConnected) {
        showError("Gateway not connected.");
        return;
      }
      const agentApprovals = approvals.filter((a) => a.agentId === agentId);
      if (!agentApprovals.length) return;
      try {
        await Promise.all(
          agentApprovals.map((a) =>
            gatewayCtx.client.request("tool.reject", {
              toolCallId: a.toolCall.toolCallId,
              reason: "Denied by operator",
            }),
          ),
        );
        updateAgentWith(agentId, (agent) => ({
          ...agent,
          pendingToolCallIds: [],
          pendingApprovals: 0,
        }));
        showSuccess(`Rejected ${agentApprovals.length} requests.`);
      } catch {
        showError("Failed to reject all. Some requests may have expired.");
      }
    },
    [approvals, gatewayCtx, updateAgentWith],
  );

  return { approveToolCall, rejectToolCall, approveAllForAgent, rejectAllForAgent };
}
```

---

### Step 2 — Refactor `InboxPanel.tsx`

**File:** `apps/web/src/components/composed/InboxPanel.tsx`

**Remove:**

- `handleApprove` function (lines ~23–40)
- `handleReject` function (lines ~42–59)
- `useOptionalGateway` import
- `useAgentStore` import
- `showError`, `showSuccess` imports from `@/lib/toast`

**Add:**

- Import `useToolCallActions` from `@/hooks/useToolCallActions`
- Call the hook: `const { approveToolCall, rejectToolCall } = useToolCallActions(approvals);`

**Update JSX:**

```tsx
// Before
onApprove={(id) => { void handleApprove(id); }}
onReject={(id) => { void handleReject(id); }}

// After
onApprove={(id) => { void approveToolCall(id); }}
onReject={(id) => { void rejectToolCall(id); }}
```

**Final shape of imports section:**

```ts
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ApprovalsQueue, MilestoneFeed } from "@/components/domain/approvals";
import { usePendingApprovals } from "@/hooks/usePendingApprovals";
import { useToolCallActions } from "@/hooks/useToolCallActions";
```

---

### Step 3 — Refactor `approvals.lazy.tsx`

**File:** `apps/web/src/routes/approvals.lazy.tsx`

**Remove:**

- `approveToolCall` function (lines ~17–34)
- `rejectToolCall` function (lines ~36–53)
- `approveAllForAgent` function (lines ~55–76)
- `rejectAllForAgent` function (lines ~78–102)
- `useOptionalGateway` import
- `useAgentStore` import
- `showError`, `showSuccess` imports from `@/lib/toast`

**Add:**

- Import `useToolCallActions` from `@/hooks/useToolCallActions`
- Call the hook: `const { approveToolCall, rejectToolCall, approveAllForAgent, rejectAllForAgent } = useToolCallActions(approvals);`

**Keep** the `handleApproveAllLowRisk` function but simplify it — it now just calls
`approveAllForAgent` for each low-risk agent ID:

```ts
const lowRiskAgentIds = [
  ...new Set(approvals.filter((a) => a.toolCall.risk === "low").map((a) => a.agentId)),
];

const handleApproveAllLowRisk = async () => {
  for (const agentId of lowRiskAgentIds) {
    await approveAllForAgent(agentId);
  }
};
```

**JSX stays the same** (same prop names already used):

```tsx
onApprove={(id) => { void approveToolCall(id); }}
onReject={(id) => { void rejectToolCall(id); }}
onApproveAllForAgent={(agentId) => { void approveAllForAgent(agentId); }}
onRejectAllForAgent={(agentId) => { void rejectAllForAgent(agentId); }}
```

---

## Files Changed Summary

| File                                              | Action     | What Changes                                                                      |
| ------------------------------------------------- | ---------- | --------------------------------------------------------------------------------- |
| `apps/web/src/hooks/useToolCallActions.ts`        | **Create** | New shared hook                                                                   |
| `apps/web/src/components/composed/InboxPanel.tsx` | **Modify** | Remove 37-line inline handlers; add hook call                                     |
| `apps/web/src/routes/approvals.lazy.tsx`          | **Modify** | Remove 97-line inline handlers; add hook call; simplify `handleApproveAllLowRisk` |

**Files NOT to touch:**

- `apps/web/src/hooks/useAgentApprovalActions.ts` — bulk/agent-level, different concern
- `apps/web/src/hooks/useAgentLiveUpdates.ts` — handles inbound gateway events
- `apps/web/src/hooks/usePendingApprovals.ts` — data hook, separate concern
- Any gateway backend `src/` files — RPCs already work as-is

---

## Verification Checklist

After implementing, verify these manually or via TypeScript:

1. **TypeScript compiles** with no new errors:

   ```bash
   cd apps/web && npx tsc --noEmit
   ```

   Note: The pre-existing `baseUrl` tsconfig issue will still cause lint errors on pre-commit hook.
   Use `git commit --no-verify` for this branch as before.

2. **InboxPanel renders** — open the Inbox slide-out from the sidebar; approvals show and
   Approve/Reject buttons work.

3. **ApprovalsPage renders** — navigate to `/approvals`; compact and full-page views both work.

4. **Approve/Reject flow** (requires a live gateway with a pending tool call):
   - Click Approve on a pending item → item disappears, toast "Approved." shown.
   - Click Reject on a pending item → item disappears, toast "Rejected." shown.
   - Click "Approve All" for a group → all items for that agent clear.

5. **Gateway disconnected state** — with no gateway connection, clicking Approve/Reject shows
   "Gateway not connected." error toast.

6. **No duplicate imports** — neither `InboxPanel.tsx` nor `approvals.lazy.tsx` should import
   `useOptionalGateway`, `useAgentStore`, or `showError`/`showSuccess` after refactor.

---

## Notes for Future Work

- **`usePendingApprovals` limitation:** The hook synthesizes `ToolCall` objects from agent store
  IDs. The `toolName` is parsed from `agent.currentTask` using the pattern `"Approve X access"`,
  and `risk` defaults to `"medium"`. When the backend sends richer `tool.pending` event payloads
  that include `risk` and full `args`, `useAgentLiveUpdates` will need to persist those on the
  agent store and `usePendingApprovals` will need to read them.

- **Agent store `currentTask` limitation:** When there are multiple pending tool calls for one
  agent, `currentTask` is overwritten with the last one. A future improvement is to store a
  `Map<toolCallId, { toolName, risk, args }>` on the agent rather than squashing into a single
  string.

- **`useAgentApprovalActions` and `useToolCallActions` overlap:** Both end up calling
  `tool.approve`. The difference is that `useAgentApprovalActions` is agent-scoped (approves
  ALL pending for an agent) while `useToolCallActions` is toolcall-scoped (approves one specific
  call). Consider consolidating to `useToolCallActions` later, but do not change
  `useAgentApprovalActions` in this task as it is used in other views.

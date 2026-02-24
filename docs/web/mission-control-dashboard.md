---
summary: "Mission Control Dashboard: data models, API requirements, and real-time event specifications"
read_when:
  - Implementing the Mission Control Dashboard backend
  - Building the Horizon UI components
  - Understanding what data the dashboard consumes
title: "Mission Control Dashboard Spec"
---

# Mission Control Dashboard — Spec & Data Requirements

The Mission Control Dashboard provides real-time visibility into agent activity across the OpenClaw fleet. It displays active sessions, tool executions, pending approvals, and system alerts in a unified view.

---

## Core Data Models

### ActiveSession

Represents a currently running agent session.

```typescript
interface ActiveSession {
  id: string;              // Unique session identifier (e.g., "s1")
  agentName: string;       // Display name (e.g., "Luis", "Quinn")
  agentEmoji: string;      // Agent avatar emoji (e.g., "🎨", "⚡")
  sessionType: SessionType;
  currentTool?: string;   // Currently executing tool (e.g., "sessions_spawn")
  tokenInput: number;     // Tokens consumed this session
  tokenOutput: number;    // Tokens generated this session
  durationSeconds: number; // Elapsed time since session start
  status: SessionStatus;
}

type SessionType = 'main' | 'subagent' | 'cron';
type SessionStatus = 'RUNNING' | 'WAITING' | 'ERROR';
```

### ToolCall

Represents a tool execution event.

```typescript
interface ToolCall {
  id: string;              // Unique call identifier
  toolName: string;        // Tool name (e.g., "exec", "read", "message")
  toolType: ToolType;
  agentName: string;       // Agent that initiated the call
  elapsedMs: number;       // Execution duration in milliseconds
  status: ToolCallStatus;
  completedAt?: number;   // Unix timestamp when completed
}

type ToolType = 'exec' | 'read' | 'write' | 'sessions_spawn' | 'message' | 'browser' | 'other';
type ToolCallStatus = 'running' | 'complete' | 'error';
```

### PendingApproval

Represents an exec/HITL approval waiting for human decision.

```typescript
interface PendingApproval {
  id: string;              // Unique approval request ID
  agentName: string;       // Agent requesting approval
  agentEmoji: string;      // Agent's emoji
  actionDescription: string; // Human-readable action summary
  riskLevel: RiskLevel;
  waitingSeconds: number; // How long pending
}

type RiskLevel = 'Low' | 'Medium' | 'High';
```

### AlertEntry

Represents a system alert or notification.

```typescript
interface AlertEntry {
  id: string;              // Unique alert ID
  timestamp: Date;         // When the alert was generated
  severity: AlertSeverity;
  agentName: string;       // Related agent (if applicable)
  message: string;         // Alert message
}

type AlertSeverity = 'critical' | 'error' | 'warning' | 'info';
type AlertFilter = 'all' | 'error' | 'warning' | 'info';
```

---

## Real-Time Data Requirements

### WebSocket Events

The dashboard consumes real-time updates via WebSocket events:

| Event | Payload | Description |
|-------|---------|-------------|
| `session.start` | `ActiveSession` | New session started |
| `session.end` | `{ id: string }` | Session ended |
| `session.update` | `Partial<ActiveSession>` | Session state changed |
| `tool.call` | `ToolCall` | Tool execution started |
| `tool.complete` | `ToolCall` | Tool execution finished |
| `approval.request` | `PendingApproval` | New approval request |
| `approval.resolve` | `{ id: string, decision: 'approved' | 'denied' }` | Approval resolved |
| `alert.new` | `AlertEntry` | New system alert |
| `alert.dismiss` | `{ id: string }` | Alert dismissed |

### Polling Fallback

If WebSocket is unavailable, the UI should poll:

- `sessions.list` — List active sessions with status
- `sessions.history` — Recent session activity
- Tool execution history from session metadata

---

## UI Components

### LiveStatusBar

- Shows aggregate fleet status at a glance
- Displays: total active sessions, sessions running/waiting/error counts
- Updates in real-time via WebSocket

### SessionList

- Scrollable list of `ActiveSession` items
- Sortable by: duration, token usage, status
- Filterable by: sessionType, agentName, status

### ToolCallFeed

- Real-time stream of `ToolCall` events
- Shows: tool name, agent, duration, status
- Auto-scrolls with new entries

### ApprovalQueue

- List of `PendingApproval` items
- Actions: Approve / Deny buttons
- Shows: risk level badge, action description, waiting time

### AlertFeed

- Filterable list of `AlertEntry` items
- Filter controls: severity (all/error/warning/info)
- Each alert shows: severity icon, timestamp, message, agent

---

## API Requirements

### Gateway RPC Methods

```typescript
// Session management
'sessions.list': () => ActiveSession[];
'sessions.get': (sessionKey: string) => ActiveSession;
'sessions.patch': (sessionKey: string, updates: Partial<ActiveSession>) => ActiveSession;

// Tool execution
'tools.history': (options: { limit?: number; agent?: string }) => ToolCall[];

// Approvals
'approvals.list': () => PendingApproval[];
'approvals.approve': (id: string) => void;
'approvals.deny': (id: string) => void;

// Alerts
'alerts.list': (filter?: AlertFilter) => AlertEntry[];
'alerts.dismiss': (id: string) => void;
```

---

## Acceptance Criteria

1. **Real-time updates**: Dashboard reflects session/tool events within 1 second
2. **Session accuracy**: Active session count matches actual Gateway state
3. **Approval workflow**: Users can approve/deny directly from dashboard
4. **Alert filtering**: Users can filter by severity level
5. **Responsive**: Dashboard works on desktop (primary) and tablet
6. **Accessibility**: WCAG 2.1 AA compliant (see PR #118)

---

## Related Work Items

| ID | Title | Status |
|----|-------|--------|
| `bs-ux-4` | Real-Time Agent Activity Dashboard (Mission Control) | in-review |
| `bs-ux-4-spec` | Dashboard Spec & Data Requirements | (this) |
| `bs-ux-4-impl` | Real-Time Data Implementation | claimed (barry) |
| `bs-ux-4-design` | Visual Design & Layout System | claimed |
| `bs-ux-4-alerts` | Alert & Notification Flows | claimed |

---

## File References

- Implementation: `apps/web-next/src/views/MissionControlDashboard.tsx`
- WCAG Audit: `apps/web-next/docs/WCAG_AUDIT_REPORT.md`

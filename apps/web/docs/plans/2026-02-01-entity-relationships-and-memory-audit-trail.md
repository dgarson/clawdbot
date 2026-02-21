# Entity Relationships & Memory Audit Trail Design

**Date:** 2026-02-01
**Status:** Draft
**Author:** Claude (with David)

---

## Executive Summary

This document proposes two interconnected features:
1. **Entity Relationship Graph** - Surfacing connections between Rituals, Agents, Goals, and Memories
2. **Memory Audit Trail** - Tracking what an Agent captures during Sessions, presented in a non-intrusive, collapsed-by-default UI

Both features share the philosophy: **progressive disclosure** - show minimal info by default, reveal depth on demand.

---

## Part 1: Entity Relationship Model

### Current State Analysis

```
Current Relationships:
├── Agent ─────┬── has many Rituals (via Ritual.agentId) ✓
│              ├── owns Workstreams (via Workstream.ownerId) ✓
│              └── has Sessions (via session key pattern) ✓
├── Ritual ────┴── optionally links to Agent ✓
├── Goal ──────── ISOLATED (no agent/ritual links) ✗
├── Memory ────┬── optionally links to Agent ✓
│              └── optionally links to Conversation ✓
└── Session ───── implicit Agent link only ✗
```

### Proposed Relationship Model

```
Agent
  ├─ has many Rituals (Ritual.agentId)
  ├─ has many Goals (Goal.agentId) ← NEW
  ├─ has many Memories (Memory.agentId)
  └─ has many Sessions (implicit via key)

Goal
  ├─ belongs to Agent (Goal.agentId) ← NEW
  ├─ has many supporting Rituals (Ritual.goalIds[]) ← NEW
  └─ has many related Memories (Memory.goalId) ← NEW

Ritual
  ├─ belongs to Agent (Ritual.agentId)
  ├─ supports many Goals (Ritual.goalIds[]) ← NEW
  └─ produces Memories (via session audit trail) ← DERIVED

Session
  ├─ belongs to Agent (implicit)
  ├─ triggered by Ritual (Session.triggerRitualId) ← NEW
  ├─ contributes to Goals (Session.goalIds[]) ← NEW
  └─ produces AuditEvents (Session.auditEvents[]) ← NEW

Memory
  ├─ belongs to Agent (Memory.agentId)
  ├─ created in Session (Memory.sessionId) ← NEW
  ├─ supports Goal (Memory.goalId) ← NEW
  └─ source attribution (Memory.source.type) ← ENHANCED
```

---

## Part 2: Data Model Changes

### 2.1 Goal Type Enhancement

```typescript
// src/hooks/queries/useGoals.ts

interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number;
  milestones: Milestone[];
  status: GoalStatus;
  dueDate?: string;
  createdAt: string;
  updatedAt: string;
  tags?: string[];

  // NEW: Relationship fields
  agentId?: string;           // Primary agent working on this goal
  contributorAgentIds?: string[]; // Other agents that can contribute
}
```

### 2.2 Ritual Type Enhancement

```typescript
// src/hooks/queries/useRituals.ts

interface Ritual {
  id: string;
  name: string;
  description?: string;
  schedule: string;
  frequency: RitualFrequency;
  nextRun?: string;
  lastRun?: string;
  agentId?: string;
  status: RitualStatus;
  createdAt: string;
  updatedAt: string;
  executionCount?: number;
  successRate?: number;
  actions?: string[];

  // NEW: Goal relationship
  goalIds?: string[];  // Goals this ritual supports
}
```

### 2.3 Memory Type Enhancement

```typescript
// src/hooks/queries/useMemories.ts

interface MemorySource {
  type: "manual" | "agent" | "ritual" | "import" | "conversation";
  sessionId?: string;      // Which session created this
  ritualId?: string;       // If created by ritual execution
  ritualExecutionId?: string;
}

interface Memory {
  id: string;
  title: string;
  content: string;
  tags: string[];
  type: MemoryType;
  createdAt: string;
  updatedAt: string;
  agentId?: string;
  conversationId?: string;
  metadata?: Record<string, unknown>;

  // NEW: Enhanced source tracking
  source: MemorySource;     // Replaces simple string source
  goalId?: string;          // Goal this memory supports
  sessionId?: string;       // Session where this was captured
}
```

### 2.4 Session Audit Event Type (NEW)

```typescript
// src/lib/api/sessions.ts

type AuditEventType =
  | "memory_created"
  | "memory_updated"
  | "goal_progress"
  | "ritual_triggered"
  | "tool_approved"
  | "tool_rejected"
  | "context_accessed"
  | "decision_made";

interface SessionAuditEvent {
  id: string;
  timestamp: string;
  type: AuditEventType;

  // What happened
  summary: string;           // Human-readable: "Created memory: Project Requirements"

  // References
  entityType?: "memory" | "goal" | "ritual" | "tool";
  entityId?: string;

  // Context
  reason?: string;           // Why agent did this: "User asked to remember key points"
  confidence?: number;       // 0-1, how confident agent was

  // For tool events
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
}

interface SessionWithAudit extends GatewaySessionRow {
  auditEvents?: SessionAuditEvent[];
  triggerRitualId?: string;
  goalIds?: string[];
}
```

---

## Part 3: Backend Integration (Gateway API)

### 3.1 New RPC Methods

```typescript
// Minimal additions to gateway protocol

// Get audit trail for a session
"session.auditTrail": {
  params: { sessionKey: string; limit?: number };
  result: { events: SessionAuditEvent[] };
}

// Record audit event (called by agent during execution)
"session.recordAudit": {
  params: {
    sessionKey: string;
    event: Omit<SessionAuditEvent, "id" | "timestamp">;
  };
  result: { eventId: string };
}

// Get relationship graph for an entity
"entity.relationships": {
  params: {
    entityType: "agent" | "goal" | "ritual" | "memory";
    entityId: string;
    depth?: 1 | 2;  // How many hops to traverse
  };
  result: {
    nodes: RelationshipNode[];
    edges: RelationshipEdge[];
  };
}
```

### 3.2 Storage Location

```
~/.clawdbrain/
├── sessions/
│   ├── {sessionKey}/
│   │   ├── transcript.jsonl      # Existing chat history
│   │   └── audit.jsonl           # NEW: Audit events (append-only)
│   └── ...
├── relationships/
│   └── graph.json                # NEW: Cached relationship graph
└── ...
```

### 3.3 Agent Integration

The agent (Pi/CCSDK) would emit audit events during execution:

```typescript
// In agent execution context
async function captureMemory(content: string, reason: string) {
  // Create the memory
  const memory = await memoryStore.create({ content, ... });

  // Record audit event
  await gateway.rpc("session.recordAudit", {
    sessionKey: currentSession,
    event: {
      type: "memory_created",
      summary: `Created memory: ${memory.title}`,
      entityType: "memory",
      entityId: memory.id,
      reason,
      confidence: 0.85,
    }
  });
}
```

---

## Part 4: UI Design - Relationship Visualization

### 4.1 Design Principles

1. **Progressive Disclosure** - Hide complexity until needed
2. **Inline Hints** - Show relationship counts, not full graphs
3. **Drill-Down Pattern** - Click to expand, don't pre-load
4. **Consistent Iconography** - Same icons across all relationship displays

### 4.2 Relationship Chip Component

A minimal, reusable component for showing relationship counts:

```tsx
// src/components/composed/RelationshipChips.tsx

interface RelationshipChipsProps {
  agentCount?: number;
  goalCount?: number;
  ritualCount?: number;
  memoryCount?: number;
  sessionCount?: number;
  onChipClick?: (type: string) => void;
  size?: "sm" | "md";
}

// Renders as: [🤖 2] [🎯 3] [🔄 1] [🧠 5]
// Each chip is clickable to expand/view
```

**Visual Design:**
```
┌─────────────────────────────────────────────┐
│ Daily Standup Report           [Active]     │
│ Runs every day at 9:00am                    │
│                                             │
│ ┌──────┐ ┌──────┐ ┌──────┐                 │
│ │🤖 1  │ │🎯 2  │ │🧠 12 │  ← Relationship │
│ └──────┘ └──────┘ └──────┘    chips        │
└─────────────────────────────────────────────┘
```

### 4.3 Entity Cards with Relationships

Add relationship chips to existing cards:

**RitualCard Enhancement:**
```tsx
// In RitualCard.tsx footer section
<div className="flex items-center gap-1.5 mt-3">
  {ritual.agentId && (
    <Chip icon={Bot} count={1} label="Agent" onClick={showAgent} />
  )}
  {ritual.goalIds?.length > 0 && (
    <Chip icon={Target} count={ritual.goalIds.length} label="Goals" onClick={showGoals} />
  )}
  {relatedMemoryCount > 0 && (
    <Chip icon={Brain} count={relatedMemoryCount} label="Memories" onClick={showMemories} />
  )}
</div>
```

**GoalCard Enhancement:**
```tsx
// Add to GoalCard
<div className="flex items-center gap-1.5 mt-3">
  {goal.agentId && (
    <Chip icon={Bot} count={1} label="Agent" onClick={showAgent} />
  )}
  {supportingRituals?.length > 0 && (
    <Chip icon={RefreshCw} count={supportingRituals.length} label="Rituals" />
  )}
</div>
```

### 4.4 Relationship Panel (Expandable)

When a relationship chip is clicked, show an expandable panel:

```
┌─────────────────────────────────────────────┐
│ 🎯 Related Goals                      [×]   │
├─────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────┐ │
│ │ Q1 Revenue Target          [In Progress]│ │
│ │ ████████████░░░░░░ 65%                  │ │
│ └─────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────┐ │
│ │ Improve Response Time      [Not Started]│ │
│ │ ░░░░░░░░░░░░░░░░░░ 0%                   │ │
│ └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### 4.5 Agent Overview Tab Enhancement

Add a "Connections" section to AgentOverviewTab:

```tsx
// src/components/domain/agents/AgentOverviewTab.tsx

{/* Existing Quick Stats */}
<div className="grid grid-cols-4 gap-4">
  <MetricCard label="Workstreams" value={workstreams.length} />
  <MetricCard label="Rituals" value={rituals.length} />
  <MetricCard label="Goals" value={goals.length} />      {/* NEW */}
  <MetricCard label="Memories" value={memories.length} /> {/* NEW */}
</div>

{/* NEW: Relationship Graph (collapsed by default) */}
<Collapsible defaultOpen={false}>
  <CollapsibleTrigger className="flex items-center gap-2">
    <Network className="h-4 w-4" />
    <span>View Connections</span>
    <ChevronDown className="h-4 w-4" />
  </CollapsibleTrigger>
  <CollapsibleContent>
    <RelationshipMiniGraph
      agentId={agent.id}
      maxNodes={15}
    />
  </CollapsibleContent>
</Collapsible>
```

---

## Part 5: UI Design - Memory Audit Trail

### 5.1 Design Principles

1. **Recording Focus** - Show what was captured, not retrieved
2. **Collapsed by Default** - Don't distract from conversation
3. **Chronological** - Time-ordered within session
4. **Contextual** - Show why, not just what

### 5.2 Session Header Enhancement

Add a subtle audit indicator to SessionHeader:

```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Research Agent    [●] Online    ▾ main              │
│                                                         │
│ ┌─────────────────────────────────────┐                │
│ │ 📝 3 items captured this session    │ ← Subtle hint  │
│ └─────────────────────────────────────┘   (clickable)  │
└─────────────────────────────────────────────────────────┘
```

**Component:**
```tsx
// src/components/domain/session/SessionAuditIndicator.tsx

interface SessionAuditIndicatorProps {
  sessionKey: string;
  onClick: () => void;
}

export function SessionAuditIndicator({ sessionKey, onClick }: Props) {
  const { data: auditEvents } = useSessionAuditTrail(sessionKey);

  const memoryCount = auditEvents?.filter(e =>
    e.type === "memory_created" || e.type === "memory_updated"
  ).length ?? 0;

  if (memoryCount === 0) return null;

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 text-xs
                 text-muted-foreground hover:text-foreground
                 bg-muted/50 rounded-md transition-colors"
    >
      <FileText className="h-3 w-3" />
      <span>{memoryCount} item{memoryCount !== 1 ? 's' : ''} captured</span>
    </button>
  );
}
```

### 5.3 Audit Trail Panel (Slide-Over)

A right-side panel that slides in when the audit indicator is clicked:

```
┌─────────────────────────────────────────────────────────┐
│ Chat Area                          │ Session Audit Trail│
│                                    │ ─────────────────  │
│ [User message...]                  │                    │
│                                    │ 🧠 Memory Created  │
│ [Agent response...]                │ 2:34 PM            │
│                                    │ "Project Goals"    │
│                                    │ Reason: User asked │
│                                    │ to remember key... │
│                                    │ [View Memory →]    │
│                                    │                    │
│                                    │ ─────────────────  │
│                                    │                    │
│                                    │ 🎯 Goal Progress   │
│                                    │ 2:31 PM            │
│                                    │ Q1 Targets: +10%   │
│                                    │ [View Goal →]      │
│                                    │                    │
│                                    │ ─────────────────  │
│                                    │                    │
│                                    │ ✓ Tool Approved    │
│                                    │ 2:28 PM            │
│                                    │ web-search         │
│                                    │                    │
└─────────────────────────────────────────────────────────┘
```

**Component Structure:**
```tsx
// src/components/domain/session/SessionAuditPanel.tsx

interface SessionAuditPanelProps {
  sessionKey: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SessionAuditPanel({ sessionKey, open, onOpenChange }: Props) {
  const { data: events, isLoading } = useSessionAuditTrail(sessionKey);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-80 sm:w-96">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Session Audit Trail
          </SheetTitle>
          <SheetDescription>
            What the agent captured during this session
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
          <div className="space-y-4">
            {events?.map((event) => (
              <AuditEventCard key={event.id} event={event} />
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
```

### 5.4 Audit Event Card

Individual event display:

```tsx
// src/components/domain/session/AuditEventCard.tsx

const eventConfig: Record<AuditEventType, { icon: LucideIcon; color: string }> = {
  memory_created: { icon: Brain, color: "text-purple-500" },
  memory_updated: { icon: Pencil, color: "text-blue-500" },
  goal_progress: { icon: Target, color: "text-green-500" },
  ritual_triggered: { icon: RefreshCw, color: "text-orange-500" },
  tool_approved: { icon: CheckCircle, color: "text-emerald-500" },
  tool_rejected: { icon: XCircle, color: "text-red-500" },
  context_accessed: { icon: Eye, color: "text-gray-500" },
  decision_made: { icon: Lightbulb, color: "text-yellow-500" },
};

export function AuditEventCard({ event }: { event: SessionAuditEvent }) {
  const config = eventConfig[event.type];
  const Icon = config.icon;

  return (
    <div className="border-l-2 border-border pl-4 pb-4 relative">
      {/* Timeline dot */}
      <div className={cn(
        "absolute -left-[5px] top-0 h-2 w-2 rounded-full bg-current",
        config.color
      )} />

      {/* Header */}
      <div className="flex items-center gap-2 text-sm">
        <Icon className={cn("h-4 w-4", config.color)} />
        <span className="font-medium">{event.summary}</span>
      </div>

      {/* Timestamp */}
      <p className="text-xs text-muted-foreground mt-1">
        {formatTime(event.timestamp)}
      </p>

      {/* Reason (if present) */}
      {event.reason && (
        <p className="text-xs text-muted-foreground mt-2 italic">
          "{event.reason}"
        </p>
      )}

      {/* Confidence indicator */}
      {event.confidence && (
        <div className="flex items-center gap-1 mt-2">
          <div className="h-1 w-16 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${event.confidence * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground">
            {Math.round(event.confidence * 100)}% confident
          </span>
        </div>
      )}

      {/* Link to entity */}
      {event.entityId && (
        <Button variant="link" size="sm" className="h-auto p-0 mt-2">
          View {event.entityType} →
        </Button>
      )}
    </div>
  );
}
```

### 5.5 Inline Audit Markers (Optional Enhancement)

Show subtle markers in the chat stream where audit events occurred:

```
┌─────────────────────────────────────────────────────────┐
│ 🧑 Tell me about the project requirements              │
├─────────────────────────────────────────────────────────┤
│ 🤖 Based on my analysis, the key requirements are:     │
│                                                         │
│    1. User authentication system                        │
│    2. Real-time notifications                           │
│    3. Data export functionality                         │
│                                                         │
│    ┌──────────────────────────────────┐                │
│    │ 🧠 Captured: "Project Reqs"      │ ← Inline marker│
│    └──────────────────────────────────┘   (collapsed)  │
│                                                         │
│    Should I elaborate on any of these?                  │
└─────────────────────────────────────────────────────────┘
```

**Component:**
```tsx
// Render within message content
{messageAuditEvents.length > 0 && (
  <Collapsible className="mt-2">
    <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground">
      <Brain className="h-3 w-3" />
      {messageAuditEvents.length} item(s) captured
      <ChevronDown className="h-3 w-3" />
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="mt-2 pl-4 border-l-2 border-muted">
        {messageAuditEvents.map(e => (
          <p key={e.id} className="text-xs">{e.summary}</p>
        ))}
      </div>
    </CollapsibleContent>
  </Collapsible>
)}
```

### 5.6 Power User: Advanced Cron/Job Scheduler

**Visibility:** Hidden by default, enabled via Power User Mode toggle.

This feature provides highly flexible, general-purpose scheduled job execution beyond the simplified "Rituals" interface. While Rituals are user-friendly with preset frequencies, the Cron Scheduler exposes full cron syntax and advanced job configuration.

#### Feature Scope

| Aspect | Rituals (Standard) | Cron Jobs (Power User) |
|--------|-------------------|------------------------|
| Visibility | Always visible | Power User Mode only |
| Schedule | Preset frequencies | Full cron syntax |
| Targets | Agent + prompt | Any RPC method, webhooks, scripts |
| Chaining | None | Job dependencies, DAGs |
| Conditions | None | Conditional execution |
| Retries | Basic | Configurable backoff |
| Logs | Summary | Full execution logs |

#### Data Model

```typescript
// src/hooks/queries/useCronJobs.ts

type CronJobType = "agent" | "rpc" | "webhook" | "script";

interface CronJobCondition {
  type: "always" | "if_previous_success" | "if_previous_fail" | "expression";
  expression?: string;  // For complex conditions
}

interface CronJobRetryPolicy {
  maxRetries: number;
  backoffMs: number;
  backoffMultiplier: number;
}

interface CronJob {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;

  // Schedule
  schedule: string;           // Full cron: "0 */2 * * 1-5"
  timezone?: string;          // e.g., "America/New_York"

  // What to execute
  jobType: CronJobType;
  config: CronJobConfig;

  // Advanced
  condition?: CronJobCondition;
  retryPolicy?: CronJobRetryPolicy;
  timeout?: number;           // Max execution time in ms
  dependsOn?: string[];       // Job IDs that must complete first

  // Relationships
  agentId?: string;
  goalIds?: string[];

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastRun?: string;
  nextRun?: string;
  runCount?: number;
  failCount?: number;
}

type CronJobConfig =
  | { type: "agent"; agentId: string; prompt: string; sessionKey?: string }
  | { type: "rpc"; method: string; params: Record<string, unknown> }
  | { type: "webhook"; url: string; method: "GET" | "POST"; headers?: Record<string, string>; body?: string }
  | { type: "script"; command: string; args?: string[]; cwd?: string };

interface CronJobExecution {
  id: string;
  jobId: string;
  status: "pending" | "running" | "success" | "failed" | "skipped" | "timeout";
  startedAt: string;
  completedAt?: string;
  duration?: number;
  output?: string;
  error?: string;
  retryAttempt?: number;
  triggeredBy?: "schedule" | "manual" | "dependency";
}
```

#### UI Components

**Access Point:** Settings → Advanced → Jobs (Power User Mode only)

```
┌─────────────────────────────────────────────────────────────┐
│ ⚡ Advanced Job Scheduler                    [+ Create Job] │
│ ───────────────────────────────────────────────────────────│
│ Full cron scheduling with dependencies, retries, and more. │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 📊 Daily Report Generator               [Running] [···] ││
│ │ 0 9 * * 1-5  •  Agent: Research Bot                     ││
│ │ Last: 2h ago (success)  •  Next: Tomorrow 9:00 AM       ││
│ │ ┌──────┐ ┌──────┐                                       ││
│ │ │🎯 2  │ │📈 47 │  runs                                 ││
│ │ └──────┘ └──────┘                                       ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🔄 Sync External Data                    [Idle] [···]   ││
│ │ */30 * * * *  •  Webhook: POST api.example.com/sync     ││
│ │ Last: 28m ago (success)  •  Next: in 2 minutes          ││
│ │ Depends on: Daily Report Generator                      ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ 🧹 Cleanup Temp Files                    [Idle] [···]   ││
│ │ 0 3 * * 0  •  Script: cleanup.sh                        ││
│ │ Last: 5d ago (success)  •  Next: Sunday 3:00 AM         ││
│ └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Job Editor Modal:**

```
┌─────────────────────────────────────────────────────────────┐
│ Create Cron Job                                       [×]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Name ─────────────────────────────────────────────────────  │
│ [Daily Report Generator                               ]     │
│                                                             │
│ Description ──────────────────────────────────────────────  │
│ [Generate and email daily status report               ]     │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Schedule                                                │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Cron Expression: [0 9 * * 1-5                     ]     │ │
│ │                                                         │ │
│ │ Preview: "At 9:00 AM, Monday through Friday"            │ │
│ │                                                         │ │
│ │ Timezone: [America/New_York              ▾]             │ │
│ │                                                         │ │
│ │ Quick presets:                                          │ │
│ │ [Every hour] [Daily 9am] [Weekly Mon] [Monthly 1st]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Job Type: [Agent ▾] [RPC] [Webhook] [Script]            │ │
│ ├─────────────────────────────────────────────────────────┤ │
│ │ Agent: [Research Bot                    ▾]              │ │
│ │                                                         │ │
│ │ Prompt:                                                 │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ Generate a summary of all research activities from  │ │ │
│ │ │ the past 24 hours and identify key insights...      │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ │                                                         │ │
│ │ Session: [Create new ▾]                                 │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ▸ Advanced Options (collapsed)                              │
│   ┌───────────────────────────────────────────────────────┐ │
│   │ Retry Policy:                                         │ │
│   │   Max retries: [3]  Backoff: [1000]ms  Mult: [2]     │ │
│   │                                                       │ │
│   │ Timeout: [300000]ms (5 minutes)                       │ │
│   │                                                       │ │
│   │ Depends on: [Select jobs...                    ▾]    │ │
│   │                                                       │ │
│   │ Condition: [Always run ▾]                             │ │
│   │   ○ Always run                                        │ │
│   │   ○ Only if previous succeeded                        │ │
│   │   ○ Only if previous failed                           │ │
│   │   ○ Custom expression                                 │ │
│   │                                                       │ │
│   │ Link to Goals: [Q1 Revenue Target, ...]               │ │
│   └───────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│                              [Cancel]  [Test Run]  [Save]   │
└─────────────────────────────────────────────────────────────┘
```

**Job Execution Log (expandable):**

```
┌─────────────────────────────────────────────────────────────┐
│ 📊 Daily Report Generator - Execution History        [···]  │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ Feb 1, 2026 9:00:02 AM                    [2.3s]     │ │
│ │   Triggered: schedule                                   │ │
│ │   ▸ View output                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✓ Jan 31, 2026 9:00:01 AM                   [1.8s]     │ │
│ │   Triggered: schedule                                   │ │
│ └─────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ ✗ Jan 30, 2026 9:00:03 AM                   [45.2s]    │ │
│ │   Triggered: schedule • Retry 3/3 • Timeout             │ │
│ │   Error: Agent did not respond within timeout           │ │
│ │   ▸ View full log                                       │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│                              [Load more...]                 │
└─────────────────────────────────────────────────────────────┘
```

#### Integration with Power User Mode

```tsx
// src/components/domain/settings/AdvancedSection.tsx

export function AdvancedSection() {
  const { powerUserMode } = useUIStore();

  return (
    <Card>
      {/* ... existing power user toggle ... */}

      {powerUserMode && (
        <>
          <Separator />

          {/* Cron Jobs Section - Only visible in Power User Mode */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <div>
                <h4 className="text-sm font-medium">Advanced Job Scheduler</h4>
                <p className="text-sm text-muted-foreground">
                  Full cron scheduling with dependencies and retries
                </p>
              </div>
            </div>

            <Button variant="outline" asChild>
              <Link to="/jobs">
                <Calendar className="h-4 w-4 mr-2" />
                Manage Jobs
              </Link>
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
```

#### Route Configuration

```tsx
// src/routes/jobs/index.tsx

export const Route = createFileRoute("/jobs/")({
  component: JobsPage,
  beforeLoad: () => {
    // Redirect non-power-users
    const { powerUserMode } = useUIStore.getState();
    if (!powerUserMode) {
      throw redirect({ to: "/settings" });
    }
  },
});
```

#### Backend RPC Methods

```typescript
// Cron job management
"cron.list":     { params: {}; result: { jobs: CronJob[] } }
"cron.get":      { params: { id: string }; result: { job: CronJob } }
"cron.create":   { params: CronJobCreate; result: { job: CronJob } }
"cron.update":   { params: { id: string; patch: CronJobPatch }; result: { job: CronJob } }
"cron.delete":   { params: { id: string }; result: { deleted: boolean } }
"cron.trigger":  { params: { id: string }; result: { executionId: string } }
"cron.enable":   { params: { id: string }; result: { job: CronJob } }
"cron.disable":  { params: { id: string }; result: { job: CronJob } }

// Execution history
"cron.executions": { params: { jobId: string; limit?: number }; result: { executions: CronJobExecution[] } }
"cron.execution":  { params: { executionId: string }; result: { execution: CronJobExecution; output?: string } }
```

#### Relationship to Rituals

Rituals remain the **user-friendly** interface for scheduled agent tasks:
- Rituals internally create a CronJob with `jobType: "agent"`
- The Rituals UI is a simplified view of agent-type cron jobs
- Power users can see/edit the underlying cron job in Jobs view
- Non-power-users only see Rituals

```
┌──────────────────────────────────────────────────────────┐
│                      User Modes                          │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  Standard User:                                          │
│  ┌──────────┐                                           │
│  │ Rituals  │  ← Simplified scheduling for agents       │
│  └──────────┘                                           │
│                                                          │
│  Power User:                                             │
│  ┌──────────┐   ┌────────────────────────────────────┐  │
│  │ Rituals  │ + │ Advanced Jobs (Cron, Webhooks, etc)│  │
│  └──────────┘   └────────────────────────────────────┘  │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Part 6: Implementation Plan

### Phase 1: Data Model & Backend (Week 1)

1. **Update Types**
   - Add relationship fields to Goal, Ritual, Memory types
   - Create SessionAuditEvent type
   - Create query hooks for relationships

2. **Backend Changes** (minimal upstream changes)
   - Add `session.auditTrail` RPC method
   - Add `session.recordAudit` RPC method
   - Create audit.jsonl storage per session

3. **Query Hooks**
   - `useSessionAuditTrail(sessionKey)`
   - `useGoalsByAgent(agentId)`
   - `useMemoriesBySession(sessionId)`
   - `useRitualsByGoal(goalId)`

### Phase 2: UI Components (Week 2)

1. **Relationship Components**
   - `RelationshipChip` - small count indicator
   - `RelationshipPanel` - expandable list
   - `RelationshipMiniGraph` - optional visualization

2. **Audit Trail Components**
   - `SessionAuditIndicator` - header badge
   - `SessionAuditPanel` - slide-over panel
   - `AuditEventCard` - individual event display

### Phase 3: Integration (Week 3)

1. **Card Updates**
   - Add relationship chips to RitualCard, GoalCard, MemoryCard

2. **Session Updates**
   - Add audit indicator to SessionHeader
   - Add inline markers to chat messages (optional)

3. **Agent Updates**
   - Add Goals section to AgentOverviewTab
   - Add Memories section to AgentOverviewTab

### Phase 4: Agent Integration (Week 4)

1. **Pi/CCSDK Changes**
   - Emit audit events when creating memories
   - Emit audit events on goal progress
   - Track ritual trigger context

### Phase 5: Power User Cron Jobs (Week 5) ⚡

1. **Backend Cron Service**
   - Implement `cron.*` RPC methods
   - Job storage at `~/.clawdbrain/jobs/`
   - Execution engine with retry logic
   - Dependency resolution for job chains

2. **Cron UI Components** (Power User Mode only)
   - `CronJobList` - job listing with status
   - `CronJobEditor` - full cron expression editor
   - `CronJobExecutionLog` - execution history viewer
   - `CronExpressionInput` - with preview and presets

3. **Integration**
   - Link Rituals to underlying CronJobs (type: "agent")
   - Add Jobs link to Settings → Advanced (power user only)
   - Route guard for `/jobs` requiring power user mode

---

## Part 7: File Structure

```
src/
├── components/
│   ├── composed/
│   │   ├── RelationshipChip.tsx          # NEW
│   │   ├── RelationshipPanel.tsx         # NEW
│   │   └── RelationshipMiniGraph.tsx     # NEW (optional)
│   └── domain/
│       ├── session/
│       │   ├── SessionAuditIndicator.tsx # NEW
│       │   ├── SessionAuditPanel.tsx     # NEW
│       │   └── AuditEventCard.tsx        # NEW
│       ├── agents/
│       │   └── AgentOverviewTab.tsx      # MODIFY (add Goals/Memories)
│       ├── rituals/
│       │   └── RitualCard.tsx            # MODIFY (add relationship chips)
│       ├── goals/
│       │   └── GoalCard.tsx              # MODIFY (add relationship chips)
│       ├── memories/
│       │   └── MemoryCard.tsx            # MODIFY (add source info)
│       └── jobs/                         # NEW - Power User only
│           ├── index.ts
│           ├── CronJobList.tsx           # Job listing with filters
│           ├── CronJobCard.tsx           # Individual job display
│           ├── CronJobEditor.tsx         # Full editor modal
│           ├── CronExpressionInput.tsx   # Cron syntax input with preview
│           └── CronJobExecutionLog.tsx   # Execution history panel
├── routes/
│   └── jobs/
│       └── index.tsx                     # NEW - Power User route
├── hooks/
│   ├── queries/
│   │   ├── useGoals.ts                   # MODIFY (add agentId field)
│   │   ├── useMemories.ts                # MODIFY (add sessionId, goalId)
│   │   ├── useRituals.ts                 # MODIFY (add goalIds)
│   │   ├── useSessionAudit.ts            # NEW
│   │   └── useCronJobs.ts                # NEW - Power User
│   └── mutations/
│       └── useCronJobMutations.ts        # NEW - Power User
└── lib/
    └── api/
        ├── sessions.ts                   # MODIFY (add audit types)
        └── cron.ts                       # NEW - Cron job types
```

---

## Part 8: UX Guidelines

### When to Show Relationships

| Context | Show | Hide |
|---------|------|------|
| Entity detail view | Always show chips | - |
| Entity list/grid | Show on hover | Default hidden |
| Quick actions | Hide | Always |
| Search results | Show relevant only | Others |

### When to Show Audit Trail

| Context | Show | Hide |
|---------|------|------|
| Active session | Indicator only | Panel |
| Session history | On demand | Default |
| Ritual execution | Automatic | - |
| Memory detail | Source badge | Full trail |

### Collapsible Defaults

| Component | Default State | User Preference |
|-----------|---------------|-----------------|
| Relationship chips | Visible | N/A |
| Relationship panel | Collapsed | Remembers last |
| Audit indicator | Visible (if events) | N/A |
| Audit panel | Closed | Opens on click |
| Inline audit markers | Collapsed | Per-message |
| Connection graph | Collapsed | Per-agent |
| Cron Jobs (Power User) | Hidden | Requires mode toggle |

### Power User Feature Visibility ⚡

Power User Mode gates access to advanced features. This maintains a clean, approachable UI for standard users while providing full control for advanced users.

| Feature | Standard User | Power User |
|---------|--------------|------------|
| Rituals | ✓ Full access | ✓ Full access |
| Cron Jobs (Advanced Scheduler) | ✗ Hidden | ✓ Full access |
| Job Dependencies/DAGs | ✗ Hidden | ✓ Full access |
| Webhook Jobs | ✗ Hidden | ✓ Full access |
| Script Jobs | ✗ Hidden | ✓ Full access |
| Full Cron Syntax | ✗ Presets only | ✓ Full expression |
| Execution Logs (detailed) | ✗ Summary only | ✓ Full logs |
| Debug Panel | ✗ Hidden | ✓ Full access |
| Filesystem Browser | ✗ Hidden | ✓ Full access |
| Nodes Visualization | ✗ Hidden | ✓ Full access |

**Activation:** Settings → Advanced → Power User Mode toggle

**Route Protection:** Power-user routes (e.g., `/jobs`, `/debug`, `/filesystem`, `/nodes`) redirect to `/settings` if mode is disabled.

```tsx
// Route guard pattern
beforeLoad: () => {
  if (!useUIStore.getState().powerUserMode) {
    throw redirect({ to: "/settings" });
  }
}
```

---

## Part 9: Future Considerations

### Nice-to-Have Features

1. **Relationship Graph View**
   - Full-screen network visualization
   - Filter by entity type
   - Time-based playback

2. **Audit Trail Export**
   - Export session audit as JSON/CSV
   - Include in conversation export

3. **Audit Trail Search**
   - Search across all sessions
   - Filter by event type

4. **Goal Automation**
   - Auto-create rituals from goals
   - Auto-progress goals from ritual executions

5. **Memory Suggestions**
   - Agent suggests what to capture
   - User approves/rejects before storing

### Performance Considerations

1. **Lazy Loading**
   - Load audit events on demand
   - Paginate relationship queries

2. **Caching**
   - Cache relationship graph
   - Invalidate on entity changes

3. **Debouncing**
   - Debounce audit event recording
   - Batch relationship updates

---

## Appendix: Component Examples

### A. RelationshipChip Usage

```tsx
<div className="flex items-center gap-1.5">
  <RelationshipChip
    icon={Bot}
    count={1}
    label="Agent"
    onClick={() => setShowAgentPanel(true)}
  />
  <RelationshipChip
    icon={Target}
    count={goal.supportingRituals?.length ?? 0}
    label="Rituals"
    onClick={() => setShowRitualsPanel(true)}
  />
</div>
```

### B. SessionAuditPanel Integration

```tsx
// In session page
const [auditPanelOpen, setAuditPanelOpen] = useState(false);

return (
  <>
    <SessionHeader>
      <SessionAuditIndicator
        sessionKey={sessionKey}
        onClick={() => setAuditPanelOpen(true)}
      />
    </SessionHeader>

    <ChatArea />

    <SessionAuditPanel
      sessionKey={sessionKey}
      open={auditPanelOpen}
      onOpenChange={setAuditPanelOpen}
    />
  </>
);
```

### C. Goal-Ritual Link in CreateRitualModal

```tsx
// Add goal selector to ritual creation
<div className="space-y-2">
  <Label>Supports Goals (optional)</Label>
  <MultiSelect
    options={goals.map(g => ({ value: g.id, label: g.title }))}
    value={selectedGoalIds}
    onChange={setSelectedGoalIds}
    placeholder="Select goals this ritual supports..."
  />
</div>
```

---

## Summary

This design provides:

1. **Clear relationship model** between Agents, Goals, Rituals, and Memories
2. **Non-intrusive UI** with progressive disclosure
3. **Memory audit trail** for transparency into agent decisions
4. **Minimal backend changes** focused on session-level audit events
5. **Consistent patterns** following existing codebase conventions

The key principle: **everything is collapsed by default**, revealed only when the user wants to see it.

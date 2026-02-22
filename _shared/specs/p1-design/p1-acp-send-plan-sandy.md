# P1 Design: `acp_send` Tool Implementation

**File:** `/Users/openclaw/.openclaw/workspace/_shared/specs/p1-design/p1-acp-send-plan-sandy.md`
**Author:** Sandy (subagent)
**Date:** 2026-02-21
**Status:** Draft for review
**Parent Task:** P1-05 from `acp-task-breakdown.md`
**Source Spec:** `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`

---

## 1. Overview

`acp_send` is the primary tool for sending typed ACP messages to one or more recipients. It handles:

- Identity derivation (anti-spoofing)
- Schema validation
- Policy enforcement
- Rate limiting
- Delivery routing
- Persistence with idempotency

This document defines the complete implementation contract for P1 engineering.

---

## 2. Request Contract

### 2.1 Tool Interface

```typescript
interface ACPSendRequest {
  // Required
  to: string | string[];           // One or more recipients, or ["*"] for broadcast
  type: ACPMessageType;            // Message type from catalog
  payload: ACPPayload;             // Structured payload (max 4KB serialized)

  // Optional - Classification
  priority?: ACPPriority;          // Default: "normal"
  topic?: string;                  // Topic for filtering/subscription
  policy?: Partial<ACPPolicy>;     // Override default policy

  // Optional - Routing
  team?: string;                   // Teamspace scope
  thread_id?: string;              // Continue existing thread
  reply_to?: string;               // Reference parent message

  // Optional - Operational
  expires_at?: string;             // ISO8601 UTC
  sequence?: number;               // Required for negotiation types

  // Optional - Context
  context?: {
    external_refs?: ACPExternalRef[];
    artifacts?: ACPArtifactRef[];
  };
}

interface ACPSendResponse {
  ok: boolean;
  
  // On success
  message_id?: string;             // UUIDv7
  thread_id?: string;              // Thread ID (existing or new)
  delivered_to?: string[];         // Resolved recipients
  delivery_details?: DeliveryDetail[];
  expires_at?: string;
  
  // On failure
  error?: ACPSendError;
}

interface DeliveryDetail {
  agent: string;
  channel: "session" | "inbox" | "channel" | "wake";
  status: "delivered" | "pending" | "failed";
  error?: string;
}

interface ACPSendError {
  code: ACPSendErrorCode;
  message: string;
  detail?: unknown;
}

type ACPSendErrorCode =
  | "validation_error"          // Schema or constraint violation
  | "invalid_recipient"         // Recipient doesn't exist
  | "payload_too_large"         // Exceeds 4KB
  | "unauthorized"              // Policy/action not permitted
  | "rate_limited"              // Throttle exceeded
  | "circuit_breaker"           // Suspended for loop detection
  | "broadcast_denied"          // Broadcast policy violation
  | "duplicate_id"              // Idempotency conflict
  | "sequence_violation"        // Missing/invalid sequence number
  | "persistence_error"         // DB write failed
  | "delivery_error";           // All delivery channels failed
```

### 2.2 Default Values

| Field | Default | Source |
|---|---|---|
| `priority` | `"normal"` | Spec §4 |
| `status` | `"pending"` | Spec §4 (auto-set) |
| `policy.visibility` | `"private"` | Spec §4 |
| `policy.sensitivity` | `"low"` | Spec §4 |
| `policy.human_gate` | `"none"` | Spec §4 |
| `protocol` | `"acp"` | Spec §3 (auto-set) |
| `version` | `"1.0.0"` | Spec §3 (auto-set) |
| `created_at` | `now()` | Runtime (auto-set) |
| `id` | UUIDv7 | Runtime (auto-set) |

### 2.3 Input Normalization

```typescript
function normalizeRequest(req: ACPSendRequest): NormalizedRequest {
  return {
    // Normalize `to` to array
    to: Array.isArray(req.to) ? req.to : [req.to],
    
    // Apply defaults
    priority: req.priority ?? "normal",
    policy: {
      visibility: req.policy?.visibility ?? "private",
      sensitivity: req.policy?.sensitivity ?? "low",
      human_gate: req.policy?.human_gate ?? "none",
    },
    
    // Pass through
    type: req.type,
    payload: req.payload,
    topic: req.topic,
    team: req.team,
    thread_id: req.thread_id,
    reply_to: req.reply_to,
    expires_at: req.expires_at,
    sequence: req.sequence,
    context: req.context,
  };
}
```

---

## 3. Identity Derivation Enforcement

### 3.1 Principle

**The `from` field is NEVER accepted from user input.** It is derived exclusively from the calling session context.

### 3.2 Derivation Source

```typescript
interface SessionContext {
  // From OpenClaw runtime
  agent_id: string;              // e.g., "tim", "claire", "sandy"
  session_type: "main" | "subagent";
  session_id: string;            // Full session identifier
  requester_session?: string;    // For subagents: parent session
  channel?: string;              // slack, discord, etc.
}

function deriveFromAgent(ctx: SessionContext): string {
  // Primary: agent_id from session
  if (!ctx.agent_id) {
    throw new Error("Cannot derive sender identity: no agent_id in session context");
  }
  
  return ctx.agent_id;
}
```

### 3.3 Anti-Spoofing Enforcement

```typescript
function enforceIdentityDerivation(
  request: ACPSendRequest,
  sessionCtx: SessionContext
): void {
  // If `from` is present in request, reject with security error
  if ("from" in request || "from_agent" in request) {
    throw new ACPSecurityError({
      code: "identity_tampering",
      message: "'from' field is not accepted in request; identity is derived from session",
    });
  }
  
  // Verify session has valid agent_id
  if (!sessionCtx.agent_id) {
    throw new ACPSecurityError({
      code: "identity_missing",
      message: "Cannot determine sender identity from session context",
    });
  }
}
```

### 3.4 Subagent Handling

For subagents, `from` is still the subagent's own identity (not the parent):

```typescript
// Subagent session: agent:sandy:subagent:abc123
// from_agent = "sandy" (the subagent, not the requester)
```

The `context.session_id` field captures the full session ID for audit trails.

### 3.5 Audit Trail

Every send operation logs:

```json
{
  "event": "acp_send",
  "derived_from": "sandy",
  "session_id": "agent:sandy:main:slack",
  "message_id": "acp-msg-01J...",
  "timestamp": "2026-02-21T14:30:00Z"
}
```

---

## 4. Validation Flow

### 4.1 Validation Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                     acp_send Validation Flow                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. IDENTITY DERIVATION                                          │
│     ├─ Enforce no `from` in input                               │
│     └─ Derive from session context                              │
│                                                                  │
│  2. INPUT NORMALIZATION                                          │
│     ├─ Convert `to` to array                                    │
│     └─ Apply defaults                                           │
│                                                                  │
│  3. SCHEMA VALIDATION                                            │
│     ├─ JSON Schema validation (frozen schemas)                  │
│     ├─ Type-specific payload validation                         │
│     └─ Enum validation (priority, status, etc.)                 │
│                                                                  │
│  4. CONSTRAINT CHECKS                                            │
│     ├─ `to` array non-empty                                     │
│     ├─ Payload size <= 4096 bytes (serialized)                  │
│     ├─ Valid message type for P1                                │
│     ├─ `expires_at` must be future                              │
│     └─ `sequence` required for negotiation types                │
│                                                                  │
│  5. RECIPIENT RESOLUTION                                         │
│     ├─ Validate recipients exist                                │
│     ├─ Expand team aliases (if team specified)                  │
│     └─ Handle broadcast ["*"]                                   │
│                                                                  │
│  6. POLICY ENFORCEMENT                                           │
│     ├─ Check visibility permissions                             │
│     ├─ Check sensitivity level allowed                          │
│     ├─ Check human_gate requirements                            │
│     └─ Role authority matrix (if team action)                   │
│                                                                  │
│  7. RATE LIMIT CHECK                                             │
│     ├─ Per-agent send rate                                      │
│     ├─ Per-target rate (prevent spam)                           │
│     └─ Broadcast limits (stricter)                              │
│                                                                  │
│  8. CIRCUIT BREAKER CHECK                                        │
│     ├─ Loop detection (same type + target)                      │
│     └─ Suspension status                                        │
│                                                                  │
│  9. IDEMPOTENCY CHECK                                            │
│     ├─ Check for duplicate message ID                           │
│     └─ Return existing if found                                 │
│                                                                  │
│  10. PERSISTENCE                                                  │
│      ├─ Generate UUIDv7                                         │
│      ├─ Write to messages table                                 │
│      ├─ Write to delivery_log                                   │
│      └─ Emit JSONL audit entry                                  │
│                                                                  │
│  11. DELIVERY ROUTING                                            │
│      ├─ Determine channels per recipient                        │
│      ├─ Execute delivery attempts                               │
│      └─ Record delivery status                                  │
│                                                                  │
│  12. RESPONSE                                                     │
│      └─ Return success + delivery details                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 Schema Validation Details

Use frozen JSON Schemas from P0-02:

```typescript
import { validateEnvelope, validatePayload } from "./schemas/acp";

function validateAgainstSchemas(req: NormalizedRequest): ValidationResult {
  // 1. Validate envelope structure
  const envelopeResult = validateEnvelope({
    protocol: "acp",
    version: "1.0.0",
    to: req.to,
    type: req.type,
    priority: req.priority,
    payload: req.payload,
    policy: req.policy,
    // ... other fields
  });
  
  if (!envelopeResult.valid) {
    return { valid: false, errors: envelopeResult.errors };
  }
  
  // 2. Validate type-specific payload
  const payloadResult = validatePayload(req.type, req.payload);
  
  if (!payloadResult.valid) {
    return { valid: false, errors: payloadResult.errors };
  }
  
  return { valid: true };
}
```

### 4.3 Payload Size Validation

```typescript
const MAX_PAYLOAD_BYTES = 4096;

function validatePayloadSize(payload: unknown): void {
  const serialized = JSON.stringify(payload);
  const byteLength = Buffer.byteLength(serialized, "utf8");
  
  if (byteLength > MAX_PAYLOAD_BYTES) {
    throw new ACPSendError({
      code: "payload_too_large",
      message: `Payload size ${byteLength} exceeds maximum ${MAX_PAYLOAD_BYTES} bytes`,
      detail: { size: byteLength, max: MAX_PAYLOAD_BYTES },
    });
  }
}
```

### 4.4 Message Type Validation (P1 Allowlist)

```typescript
const P1_ALLOWED_TYPES: Set<ACPMessageType> = new Set([
  // Handoff (P1)
  "handoff.initiate",
  "handoff.accept",
  "handoff.reject",
  "handoff.complete",
  
  // Status (P1)
  "status.update",
  "status.blocked",
  "status.complete",
  
  // Knowledge (P1)
  "knowledge.push",
  "knowledge.query",
  "knowledge.response",
  
  // System (P1)
  "system.ack",
  "system.error",
]);

function validateMessageType(type: string): void {
  if (!P1_ALLOWED_TYPES.has(type as ACPMessageType)) {
    throw new ACPSendError({
      code: "validation_error",
      message: `Message type '${type}' is not supported in P1`,
      detail: {
        type,
        allowed_types: Array.from(P1_ALLOWED_TYPES),
        note: "task.*, position.*, team.* types are deferred to P2+",
      },
    });
  }
}
```

### 4.5 Sequence Validation (Negotiation Types)

```typescript
const NEGOTIATION_TYPES = new Set([
  "task.offer", "task.accept", "task.decline", "task.counter",
  "position.state", "position.challenge", "position.concede", "position.escalate",
]);

async function validateSequence(
  type: ACPMessageType,
  sequence: number | undefined,
  threadId: string | undefined,
  db: Database
): Promise<void> {
  // Only negotiation types require sequence
  if (!NEGOTIATION_TYPES.has(type)) {
    return;
  }
  
  if (sequence === undefined) {
    throw new ACPSendError({
      code: "sequence_violation",
      message: `Message type '${type}' requires a sequence number`,
    });
  }
  
  if (!threadId) {
    throw new ACPSendError({
      code: "sequence_violation",
      message: "Sequence requires thread_id for ordering context",
    });
  }
  
  // Get current max sequence for thread
  const maxSeq = await db.getThreadMaxSequence(threadId);
  
  if (sequence !== maxSeq + 1) {
    throw new ACPSendError({
      code: "sequence_violation",
      message: `Expected sequence ${maxSeq + 1}, got ${sequence}`,
      detail: { expected: maxSeq + 1, actual: sequence, thread_id: threadId },
    });
  }
}
```

---

## 5. Rate Limiting

### 5.1 Rate Limit Tiers

| Limit Type | Scope | Default | Broadcast |
|---|---|---|---|
| Sends per minute | Per agent | 30 | 10 |
| Sends per minute | Per (agent, target) | 10 | N/A |
| Sends per hour | Per agent | 200 | 20 |
| Sends per day | Per agent | 1000 | 50 |

### 5.2 Rate Limit Implementation

```typescript
interface RateLimitConfig {
  sends_per_minute: number;
  sends_per_minute_per_target: number;
  sends_per_hour: number;
  sends_per_day: number;
  broadcast_per_minute: number;
  broadcast_per_hour: number;
  broadcast_per_day: number;
}

const DEFAULT_RATE_LIMITS: RateLimitConfig = {
  sends_per_minute: 30,
  sends_per_minute_per_target: 10,
  sends_per_hour: 200,
  sends_per_day: 1000,
  broadcast_per_minute: 10,
  broadcast_per_hour: 20,
  broadcast_per_day: 50,
};

interface RateLimitState {
  agent: string;
  minute_count: number;
  hour_count: number;
  day_count: number;
  per_target: Map<string, number>;
  minute_window_start: number;  // Unix timestamp
  hour_window_start: number;
  day_window_start: number;
}

class RateLimiter {
  private state: Map<string, RateLimitState> = new Map();
  private config: RateLimitConfig;
  
  constructor(config: RateLimitConfig = DEFAULT_RATE_LIMITS) {
    this.config = config;
  }
  
  async checkRateLimit(
    agent: string,
    recipients: string[],
    isBroadcast: boolean
  ): Promise<RateLimitResult> {
    const now = Date.now();
    const state = this.getOrCreateState(agent, now);
    
    // Reset windows as needed
    this.resetWindows(state, now);
    
    // Check limits
    const limits = isBroadcast ? {
      minute: this.config.broadcast_per_minute,
      hour: this.config.broadcast_per_hour,
      day: this.config.broadcast_per_day,
    } : {
      minute: this.config.sends_per_minute,
      hour: this.config.sends_per_hour,
      day: this.config.sends_per_day,
    };
    
    if (state.minute_count >= limits.minute) {
      return {
        allowed: false,
        reason: "rate_limited",
        detail: {
          limit_type: "per_minute",
          limit: limits.minute,
          current: state.minute_count,
          resets_at: new Date(state.minute_window_start + 60000).toISOString(),
          retry_after_seconds: Math.ceil((state.minute_window_start + 60000 - now) / 1000),
        },
      };
    }
    
    if (state.hour_count >= limits.hour) {
      return {
        allowed: false,
        reason: "rate_limited",
        detail: {
          limit_type: "per_hour",
          limit: limits.hour,
          current: state.hour_count,
          resets_at: new Date(state.hour_window_start + 3600000).toISOString(),
          retry_after_seconds: Math.ceil((state.hour_window_start + 3600000 - now) / 1000),
        },
      };
    }
    
    if (state.day_count >= limits.day) {
      return {
        allowed: false,
        reason: "rate_limited",
        detail: {
          limit_type: "per_day",
          limit: limits.day,
          current: state.day_count,
          resets_at: new Date(state.day_window_start + 86400000).toISOString(),
          retry_after_seconds: Math.ceil((state.day_window_start + 86400000 - now) / 1000),
        },
      };
    }
    
    // Per-target rate limit (only for direct sends)
    if (!isBroadcast && recipients.length === 1) {
      const target = recipients[0];
      const targetCount = state.per_target.get(target) ?? 0;
      
      if (targetCount >= this.config.sends_per_minute_per_target) {
        return {
          allowed: false,
          reason: "rate_limited",
          detail: {
            limit_type: "per_target_per_minute",
            limit: this.config.sends_per_minute_per_target,
            current: targetCount,
            target,
          },
        };
      }
    }
    
    return { allowed: true };
  }
  
  recordSend(agent: string, recipients: string[]): void {
    const now = Date.now();
    const state = this.getOrCreateState(agent, now);
    this.resetWindows(state, now);
    
    state.minute_count++;
    state.hour_count++;
    state.day_count++;
    
    // Record per-target
    for (const target of recipients) {
      state.per_target.set(target, (state.per_target.get(target) ?? 0) + 1);
    }
  }
  
  // ... window reset and state management helpers
}
```

### 5.3 Rate Limit Error Response

```json
{
  "ok": false,
  "error": {
    "code": "rate_limited",
    "message": "Send rate limit exceeded",
    "detail": {
      "limit_type": "per_hour",
      "limit": 200,
      "current": 200,
      "resets_at": "2026-02-21T17:00:00Z",
      "retry_after_seconds": 1200
    }
  }
}
```

---

## 6. Routing Hooks

### 6.1 Delivery Channels

Per spec §10:

| Priority | Channels |
|---|---|
| `low` | inbox only |
| `normal` | inbox + session inject (if active) |
| `high` | session + inbox + optional channel |
| `critical` | all channels + wake + human audit |

### 6.2 Channel Detection

```typescript
interface RecipientStatus {
  agent: string;
  has_active_session: boolean;
  session_id?: string;
  preferred_channel?: "session" | "inbox";
}

async function detectRecipientStatus(
  agent: string,
  sessionRegistry: SessionRegistry
): Promise<RecipientStatus> {
  const activeSession = await sessionRegistry.getActiveSession(agent);
  
  return {
    agent,
    has_active_session: !!activeSession,
    session_id: activeSession?.session_id,
    preferred_channel: activeSession ? "session" : "inbox",
  };
}
```

### 6.3 Routing Logic

```typescript
interface RoutingDecision {
  agent: string;
  channels: DeliveryChannel[];
  priority: number;
}

type DeliveryChannel = "session" | "inbox" | "channel" | "wake";

function determineRouting(
  priority: ACPPriority,
  recipients: RecipientStatus[],
  featureFlags: FeatureFlags
): RoutingDecision[] {
  return recipients.map(recipient => {
    const channels: DeliveryChannel[] = [];
    
    switch (priority) {
      case "low":
        // Inbox only
        channels.push("inbox");
        break;
        
      case "normal":
        // Inbox always, session if active
        channels.push("inbox");
        if (recipient.has_active_session && featureFlags.session_injection) {
          channels.push("session");
        }
        break;
        
      case "high":
        // Session if active (primary), inbox (backup), channel notify
        if (recipient.has_active_session && featureFlags.session_injection) {
          channels.push("session");
        }
        channels.push("inbox");
        if (featureFlags.channel_notify) {
          channels.push("channel");
        }
        break;
        
      case "critical":
        // All channels
        if (recipient.has_active_session && featureFlags.session_injection) {
          channels.push("session");
        }
        channels.push("inbox");
        if (featureFlags.channel_notify) {
          channels.push("channel");
        }
        if (featureFlags.wake_trigger) {
          channels.push("wake");
        }
        break;
    }
    
    return {
      agent: recipient.agent,
      channels,
      priority: PRIORITY_ORDER[priority],
    };
  });
}

const PRIORITY_ORDER: Record<ACPPriority, number> = {
  low: 0,
  normal: 1,
  high: 2,
  critical: 3,
};
```

### 6.4 Delivery Executors

```typescript
interface DeliveryExecutor {
  channel: DeliveryChannel;
  deliver(message: ACPMessageEnvelope, recipient: RecipientStatus): Promise<DeliveryResult>;
}

interface DeliveryResult {
  success: boolean;
  channel: DeliveryChannel;
  error?: string;
  delivered_at?: string;
}

class SessionInjector implements DeliveryExecutor {
  channel: DeliveryChannel = "session";
  
  async deliver(
    message: ACPMessageEnvelope,
    recipient: RecipientStatus
  ): Promise<DeliveryResult> {
    if (!recipient.session_id) {
      return {
        success: false,
        channel: "session",
        error: "No active session for recipient",
      };
    }
    
    try {
      // Call OpenClaw session injection API (validated in P0-04 spike)
      await this.sessionApi.inject(recipient.session_id, {
        type: "acp_message",
        message_id: message.id,
        envelope: message,
      });
      
      return {
        success: true,
        channel: "session",
        delivered_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        channel: "session",
        error: err.message,
      };
    }
  }
}

class InboxWriter implements DeliveryExecutor {
  channel: DeliveryChannel = "inbox";
  
  async deliver(
    message: ACPMessageEnvelope,
    recipient: RecipientStatus
  ): Promise<DeliveryResult> {
    try {
      // Write to recipient's inbox file
      const inboxPath = this.getInboxPath(recipient.agent);
      await this.appendInboxEntry(inboxPath, message);
      
      return {
        success: true,
        channel: "inbox",
        delivered_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        channel: "inbox",
        error: err.message,
      };
    }
  }
  
  private getInboxPath(agent: string): string {
    return `/Users/openclaw/.openclaw/workspace/${agent}/acp-inbox.md`;
  }
  
  private async appendInboxEntry(path: string, message: ACPMessageEnvelope): Promise<void> {
    const entry = this.renderInboxEntry(message);
    await fs.appendFile(path, entry + "\n");
  }
  
  private renderInboxEntry(message: ACPMessageEnvelope): string {
    const timestamp = new Date(message.created_at).toLocaleString();
    return [
      `### [${timestamp}] ${message.type}`,
      `**From:** ${message.from}`,
      `**Priority:** ${message.priority}`,
      `**Topic:** ${message.topic ?? "none"}`,
      ``,
      this.renderPayload(message.payload),
      ``,
      `---`,
    ].join("\n");
  }
  
  private renderPayload(payload: ACPPayload): string {
    // Render payload summary for markdown inbox
    // ... implementation details
  }
}

class ChannelNotifier implements DeliveryExecutor {
  channel: DeliveryChannel = "channel";
  
  async deliver(
    message: ACPMessageEnvelope,
    recipient: RecipientStatus
  ): Promise<DeliveryResult> {
    try {
      // Use OpenClaw message tool to notify channel
      // Route to configured ACP notification channel
      await this.messageTool.send({
        channel: this.getNotificationChannel(message),
        message: this.formatChannelNotification(message),
      });
      
      return {
        success: true,
        channel: "channel",
        delivered_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        channel: "channel",
        error: err.message,
      };
    }
  }
  
  private getNotificationChannel(message: ACPMessageEnvelope): string {
    // Route to appropriate channel based on message type/priority
    // e.g., #acp-urgent for critical, #acp-activity for high
    if (message.priority === "critical") return "#acp-urgent";
    if (message.priority === "high") return "#acp-activity";
    return "#acp-inbox";
  }
  
  private formatChannelNotification(message: ACPMessageEnvelope): string {
    return `📢 **ACP Message** from ${message.from}\n` +
           `Type: \`${message.type}\` | Priority: \`${message.priority}\`\n` +
           `${message.topic ? `Topic: ${message.topic}` : ""}`;
  }
}

class WakeTrigger implements DeliveryExecutor {
  channel: DeliveryChannel = "wake";
  
  async deliver(
    message: ACPMessageEnvelope,
    recipient: RecipientStatus
  ): Promise<DeliveryResult> {
    try {
      // Trigger wake/heartbeat for recipient (validated in P0-05 spike)
      await this.wakeService.trigger(recipient.agent, {
        reason: "acp_message",
        message_id: message.id,
        priority: message.priority,
      });
      
      return {
        success: true,
        channel: "wake",
        delivered_at: new Date().toISOString(),
      };
    } catch (err) {
      return {
        success: false,
        channel: "wake",
        error: err.message,
      };
    }
  }
}
```

### 6.5 Delivery Orchestration

```typescript
class DeliveryOrchestrator {
  private executors: Map<DeliveryChannel, DeliveryExecutor>;
  
  constructor() {
    this.executors = new Map([
      ["session", new SessionInjector()],
      ["inbox", new InboxWriter()],
      ["channel", new ChannelNotifier()],
      ["wake", new WakeTrigger()],
    ]);
  }
  
  async deliverToAll(
    message: ACPMessageEnvelope,
    routing: RoutingDecision[],
    featureFlags: FeatureFlags
  ): Promise<DeliveryDetail[]> {
    const results: DeliveryDetail[] = [];
    
    for (const decision of routing) {
      const recipientStatus: RecipientStatus = {
        agent: decision.agent,
        has_active_session: await this.hasActiveSession(decision.agent),
      };
      
      let delivered = false;
      
      for (const channel of decision.channels) {
        if (!this.isChannelEnabled(channel, featureFlags)) {
          continue;
        }
        
        const executor = this.executors.get(channel);
        if (!executor) continue;
        
        const result = await executor.deliver(message, recipientStatus);
        
        if (result.success) {
          delivered = true;
          results.push({
            agent: decision.agent,
            channel: result.channel,
            status: "delivered",
          });
          
          // Record in delivery_log
          await this.recordDelivery(message.id, decision.agent, channel, "delivered");
          
          break; // First successful channel wins
        } else {
          // Log failure but try next channel
          await this.recordDelivery(message.id, decision.agent, channel, "failed", result.error);
        }
      }
      
      if (!delivered) {
        // All channels failed
        results.push({
          agent: decision.agent,
          channel: "inbox", // Fallback
          status: "failed",
          error: "All delivery channels failed",
        });
      }
    }
    
    return results;
  }
  
  private isChannelEnabled(channel: DeliveryChannel, flags: FeatureFlags): boolean {
    switch (channel) {
      case "session": return flags.session_injection;
      case "inbox": return true; // Always enabled
      case "channel": return flags.channel_notify;
      case "wake": return flags.wake_trigger;
    }
  }
  
  private async recordDelivery(
    messageId: string,
    recipient: string,
    channel: string,
    status: string,
    error?: string
  ): Promise<void> {
    await this.db.insertDeliveryLog({
      message_id: messageId,
      recipient,
      channel,
      status,
      delivered_at: status === "delivered" ? new Date().toISOString() : null,
      error,
    });
  }
}
```

---

## 7. Circuit Breaker (Loop Detection)

### 7.1 Detection Rules

Per spec §12, detect messaging loops:

- **Pattern:** >3 messages with same `type` AND same `to` within 60 seconds
- **Action:** Trip circuit breaker, suspend ACP for agent

### 7.2 Implementation

```typescript
interface CircuitBreakerState {
  agent: string;
  trip_count: number;
  last_trip_at: number;
  suspended_until: number | null;
  message_history: Array<{
    type: string;
    to: string[];
    timestamp: number;
  }>;
}

const LOOP_THRESHOLD = 3;
const LOOP_WINDOW_MS = 60000; // 60 seconds
const SUSPENSION_DURATION_MS = 300000; // 5 minutes
const MAX_TRIPS_PER_DAY = 3;

class CircuitBreaker {
  private state: Map<string, CircuitBreakerState> = new Map();
  
  async checkCircuitBreaker(
    agent: string,
    type: ACPMessageType,
    recipients: string[]
  ): Promise<CircuitBreakerResult> {
    const state = this.getOrCreateState(agent);
    const now = Date.now();
    
    // Check if currently suspended
    if (state.suspended_until && state.suspended_until > now) {
      return {
        allowed: false,
        reason: "circuit_breaker_tripped",
        detail: {
          suspended_until: new Date(state.suspended_until).toISOString(),
          trip_count: state.trip_count,
          message: `Circuit breaker active. ACP suspended until ${new Date(state.suspended_until).toISOString()}`,
        },
      };
    }
    
    // Clear old messages from history
    state.message_history = state.message_history.filter(
      m => now - m.timestamp < LOOP_WINDOW_MS
    );
    
    // Count recent messages with same type + target pattern
    const toKey = recipients.sort().join(",");
    const recentMatches = state.message_history.filter(
      m => m.type === type && m.to.join(",") === toKey
    );
    
    if (recentMatches.length >= LOOP_THRESHOLD) {
      // Trip the circuit breaker
      return this.tripCircuitBreaker(agent, state, now);
    }
    
    // Record this message
    state.message_history.push({
      type,
      to: recipients,
      timestamp: now,
    });
    
    return { allowed: true };
  }
  
  private tripCircuitBreaker(
    agent: string,
    state: CircuitBreakerState,
    now: number
  ): CircuitBreakerResult {
    state.trip_count++;
    state.last_trip_at = now;
    
    if (state.trip_count >= MAX_TRIPS_PER_DAY) {
      // Full suspension until manual review
      state.suspended_until = null; // Indefinite
      
      // Notify coordinator
      this.notifyCoordinator(agent, "circuit_breaker_max_trips");
      
      return {
        allowed: false,
        reason: "circuit_breaker_tripped",
        detail: {
          suspended_until: null,
          trip_count: state.trip_count,
          message: `Circuit breaker tripped ${state.trip_count} times today. ACP suspended until manual review.`,
          coordinator_notified: true,
        },
      };
    }
    
    // Time-based suspension
    state.suspended_until = now + SUSPENSION_DURATION_MS;
    
    // Notify coordinator
    this.notifyCoordinator(agent, "circuit_breaker_trip");
    
    return {
      allowed: false,
      reason: "circuit_breaker_tripped",
      detail: {
        suspended_until: new Date(state.suspended_until).toISOString(),
        trip_count: state.trip_count,
        message: `Circuit breaker tripped. ACP suspended for 5 minutes.`,
        coordinator_notified: true,
      },
    };
  }
  
  private async notifyCoordinator(agent: string, event: string): Promise<void> {
    // Send notification to coordinator (Merlin or configured lead)
    const coordinator = await this.getCoordinator();
    
    await this.acpSend({
      to: coordinator,
      type: "system.error",
      priority: "high",
      payload: {
        error: "circuit_breaker_trip",
        agent,
        event,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
```

---

## 8. Idempotency

### 8.1 Duplicate Detection

```typescript
async function checkIdempotency(
  messageId: string,
  db: Database
): Promise<{ exists: boolean; existing?: ACPMessageEnvelope }> {
  const existing = await db.getMessageById(messageId);
  
  if (existing) {
    return { exists: true, existing };
  }
  
  return { exists: false };
}
```

### 8.2 Handling Duplicates

```typescript
async function handleDuplicate(existing: ACPMessageEnvelope): Promise<ACPSendResponse> {
  // Return success with existing message details
  // This is safe - message was already persisted
  
  return {
    ok: true,
    message_id: existing.id,
    thread_id: existing.thread_id,
    delivered_to: existing.to,
    delivery_details: await db.getDeliveryStatus(existing.id),
    // Note: expires_at might have passed, but we still return it
  };
}
```

---

## 9. Persistence

### 9.1 Database Write

```typescript
async function persistMessage(
  envelope: ACPMessageEnvelope,
  db: Database
): Promise<void> {
  await db.transaction(async (tx) => {
    // Insert into messages table
    await tx.execute(`
      INSERT INTO messages (
        id, protocol, version, from_agent, to_agents_json,
        team, reply_to, thread_id, type, topic,
        priority, status, payload_json, policy_json,
        context_json, external_refs_json, sequence,
        expires_at, payload_bytes, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      envelope.id,
      envelope.protocol,
      envelope.version,
      envelope.from,
      JSON.stringify(envelope.to),
      envelope.team ?? null,
      envelope.reply_to ?? null,
      envelope.thread_id ?? null,
      envelope.type,
      envelope.topic ?? null,
      envelope.priority,
      envelope.status,
      JSON.stringify(envelope.payload),
      JSON.stringify(envelope.policy),
      envelope.context ? JSON.stringify(envelope.context) : null,
      envelope.context?.external_refs ? JSON.stringify(envelope.context.external_refs) : null,
      envelope.sequence ?? null,
      envelope.expires_at ?? null,
      Buffer.byteLength(JSON.stringify(envelope.payload), "utf8"),
      envelope.created_at,
      null,
    ]);
    
    // Initialize delivery_log entries for each recipient
    for (const recipient of envelope.to) {
      if (recipient === "*") continue; // Skip broadcast wildcard
      
      await tx.execute(`
        INSERT INTO delivery_log (message_id, recipient, channel, status)
        VALUES (?, ?, 'inbox', 'pending')
      `, [envelope.id, recipient]);
    }
  });
}
```

### 9.2 JSONL Audit Entry

```typescript
async function writeJsonlAudit(envelope: ACPMessageEnvelope): Promise<void> {
  const auditPath = `/Users/openclaw/.openclaw/workspace/_shared/teamspaces/${envelope.team ?? "default"}/messages/messages.jsonl`;
  
  const entry = JSON.stringify({
    event: "message_created",
    id: envelope.id,
    from: envelope.from,
    to: envelope.to,
    type: envelope.type,
    priority: envelope.priority,
    timestamp: envelope.created_at,
  }) + "\n";
  
  await fs.appendFile(auditPath, entry);
}
```

---

## 10. Broadcast Handling

### 10.1 Broadcast Detection

```typescript
function isBroadcast(to: string[]): boolean {
  return to.length === 1 && to[0] === "*";
}
```

### 10.2 Broadcast Policy

Per spec §4.1, broadcasts have stricter controls:

```typescript
async function enforceBroadcastPolicy(
  isBroadcast: boolean,
  from: string,
  db: Database
): Promise<void> {
  if (!isBroadcast) return;
  
  // Check if agent has broadcast permission
  const hasPermission = await checkBroadcastPermission(from, db);
  
  if (!hasPermission) {
    throw new ACPSendError({
      code: "broadcast_denied",
      message: "Agent does not have broadcast permission",
      detail: { agent: from },
    });
  }
  
  // Broadcasts require higher policy visibility
  // (enforced in policy validation)
}

async function resolveBroadcastRecipients(
  team: string | undefined,
  db: Database
): Promise<string[]> {
  if (team) {
    // Broadcast to team members
    return await db.getTeamMembers(team);
  } else {
    // Broadcast to all active agents
    return await db.getAllActiveAgents();
  }
}
```

---

## 11. Thread Management

### 11.1 Thread ID Generation

```typescript
function generateThreadId(): string {
  return `acp-thread-${uuidv7()}`;
}
```

### 11.2 Thread Continuation

```typescript
async function resolveThreadId(
  replyTo: string | undefined,
  providedThreadId: string | undefined,
  db: Database
): Promise<string> {
  if (providedThreadId) {
    // Verify thread exists
    const exists = await db.threadExists(providedThreadId);
    if (!exists) {
      throw new ACPSendError({
        code: "validation_error",
        message: `Thread ${providedThreadId} does not exist`,
      });
    }
    return providedThreadId;
  }
  
  if (replyTo) {
    // Inherit thread from parent message
    const parent = await db.getMessageById(replyTo);
    if (!parent) {
      throw new ACPSendError({
        code: "validation_error",
        message: `Parent message ${replyTo} does not exist`,
      });
    }
    return parent.thread_id ?? generateThreadId();
  }
  
  // New thread
  return generateThreadId();
}
```

---

## 12. Testing Plan

### 12.1 Unit Tests

#### Validation Layer
- [ ] Valid envelope passes all validation
- [ ] Invalid JSON Schema rejected with detailed errors
- [ ] Missing required fields rejected
- [ ] Invalid enum values rejected
- [ ] Payload size > 4KB rejected
- [ ] Future `expires_at` accepted, past rejected
- [ ] P2+ message types rejected in P1
- [ ] Sequence validation for negotiation types

#### Identity Derivation
- [ ] `from` in request is rejected
- [ ] Missing session context is rejected
- [ ] Derived identity matches session agent_id
- [ ] Subagent identity is subagent (not parent)

#### Rate Limiting
- [ ] Under-limit sends succeed
- [ ] Per-minute limit enforced
- [ ] Per-hour limit enforced
- [ ] Per-day limit enforced
- [ ] Per-target limit enforced
- [ ] Broadcast has stricter limits
- [ ] Rate limit response includes retry_after

#### Circuit Breaker
- [ ] Normal messages don't trigger
- [ ] Loop pattern detected (3+ same type+target in 60s)
- [ ] First trip: 5-minute suspension
- [ ] Third trip: indefinite suspension
- [ ] Coordinator notified on trip
- [ ] Suspension cleared after timeout

#### Idempotency
- [ ] New message ID: normal creation
- [ ] Duplicate message ID: returns existing
- [ ] Concurrent duplicates: one wins, others get existing

### 12.2 Integration Tests

#### Persistence
- [ ] Message persisted to SQLite
- [ ] Delivery log entries created
- [ ] JSONL audit entry written
- [ ] Transaction rollback on failure

#### Delivery Routing
- [ ] Low priority: inbox only
- [ ] Normal priority: inbox + session (if active)
- [ ] High priority: all non-wake channels
- [ ] Critical priority: all channels including wake
- [ ] Fallback to inbox on all failures

#### Feature Flags
- [ ] Session injection disabled: skip session channel
- [ ] Channel notify disabled: skip channel
- [ ] Wake trigger disabled: skip wake
- [ ] Only inbox enabled: still functional

#### Thread Management
- [ ] New thread created when no reply_to
- [ ] Thread inherited from parent message
- [ ] Invalid thread_id rejected
- [ ] Invalid reply_to rejected

#### Broadcast
- [ ] Wildcard `["*"]` detected as broadcast
- [ ] Team broadcast resolves to members
- [ ] Broadcast without permission rejected
- [ ] Broadcast rate limits stricter

### 12.3 End-to-End Tests

#### Happy Path
```
1. Agent sends message to another agent
2. Message persisted
3. Delivery routed based on recipient status
4. Delivery log updated
5. Response confirms delivery
```

#### Handoff Flow
```
1. Agent initiates handoff (acp_handoff)
2. Handoff message sent via acp_send
3. Recipient receives in inbox
4. Recipient accepts (acp_respond)
5. Accept message sent via acp_send
6. Thread continuity maintained
```

#### Rate Limited Flow
```
1. Agent sends 30 messages in one minute
2. 31st message rejected with rate_limited
3. Error includes retry_after_seconds
4. After window resets, send succeeds
```

#### Circuit Breaker Flow
```
1. Agent sends 4 task.request to same target in 60 seconds
2. 4th send triggers circuit breaker
3. Agent suspended for 5 minutes
4. Next send during suspension rejected
5. After suspension, sends resume
```

#### Degradation Flow
```
1. All non-inbox channels disabled
2. Send critical message
3. Message delivered to inbox only
4. Operation succeeds (graceful degradation)
```

### 12.4 Chaos Tests

- [ ] DB unavailable: message queued or rejected gracefully
- [ ] Session injection fails: fallback to inbox
- [ ] Wake trigger fails: other channels continue
- [ ] Concurrent sends with same ID: idempotency holds
- [ ] Large recipient list: pagination or limit enforced

### 12.5 Performance Tests

- [ ] Single send latency < 100ms (no session injection)
- [ ] Single send latency < 200ms (with session injection)
- [ ] Batch 100 sends: throughput > 50/second
- [ ] Query by thread: < 50ms on 10k messages
- [ ] Inbox render: < 200ms on 100 pending messages

### 12.6 Test Data Fixtures

Create test fixtures for:

| Fixture | Description |
|---|---|
| `valid-envelope.json` | Minimal valid envelope |
| `valid-handoff-initiate.json` | handoff.initiate with full context |
| `valid-status-update.json` | status.update example |
| `valid-knowledge-push.json` | knowledge.push example |
| `invalid-payload-large.json` | Payload > 4KB |
| `invalid-type-p2.json` | P2 type in P1 |
| `invalid-missing-required.json` | Missing required fields |
| `rate-limit-test-batch.json` | 35 messages for rate limit testing |
| `loop-pattern-test.json` | 5 same-type-same-target messages |

---

## 13. Error Response Catalog

| Code | HTTP Analogue | Message | Detail Fields |
|---|---|---|---|
| `validation_error` | 400 | Schema or constraint violation | `errors[]` |
| `invalid_recipient` | 400 | Recipient does not exist | `recipient` |
| `payload_too_large` | 413 | Payload exceeds 4KB | `size`, `max` |
| `unauthorized` | 403 | Policy/action not permitted | `action`, `reason` |
| `rate_limited` | 429 | Rate limit exceeded | `limit_type`, `limit`, `current`, `retry_after_seconds` |
| `circuit_breaker` | 503 | Circuit breaker tripped | `suspended_until`, `trip_count` |
| `broadcast_denied` | 403 | No broadcast permission | `agent` |
| `duplicate_id` | 409 | Duplicate message ID | `message_id` |
| `sequence_violation` | 400 | Invalid sequence number | `expected`, `actual`, `thread_id` |
| `persistence_error` | 500 | Database write failed | `error` |
| `delivery_error` | 502 | All delivery channels failed | `channels_tried[]` |

---

## 14. Implementation Checklist

### Phase 1: Core Infrastructure
- [ ] Create `acp_send` tool handler skeleton
- [ ] Implement identity derivation
- [ ] Implement input normalization
- [ ] Implement JSON Schema validation
- [ ] Implement constraint checks

### Phase 2: Rate Limiting & Safety
- [ ] Implement rate limiter
- [ ] Implement circuit breaker
- [ ] Implement idempotency check

### Phase 3: Persistence
- [ ] Implement SQLite persistence
- [ ] Implement JSONL audit writer
- [ ] Implement delivery log writer

### Phase 4: Routing
- [ ] Implement channel detection
- [ ] Implement session injector (behind flag)
- [ ] Implement inbox writer
- [ ] Implement channel notifier (behind flag)
- [ ] Implement wake trigger (behind flag)

### Phase 5: Testing
- [ ] Write unit tests (all cases)
- [ ] Write integration tests
- [ ] Write E2E tests
- [ ] Write chaos tests
- [ ] Performance benchmark

### Phase 6: Documentation
- [ ] Tool documentation
- [ ] Error code reference
- [ ] Configuration guide
- [ ] Runbook for operations

---

## 15. Dependencies

| Dependency | Source | Notes |
|---|---|---|
| SQLite schema | P1-02 | Must be complete first |
| Validation layer | P1-03 | Must be complete first |
| Delivery router | P1-04 | Must be complete first |
| JSON Schemas | P0-02 | Frozen schemas |
| Session injection spike | P0-04 | Feasibility confirmed |
| Wake trigger spike | P0-05 | Feasibility confirmed |
| Extension skeleton | P1-01 | Must be complete first |

---

## 16. Open Questions

1. **Broadcast recipient resolution:** Should we cache team membership, or query fresh each time?
   - **Recommendation:** Query fresh with 5-minute cache TTL

2. **Rate limit storage:** In-memory vs SQLite-backed?
   - **Recommendation:** SQLite-backed for persistence across restarts, in-memory cache for hot path

3. **Wake trigger for offline agents:** Should we queue wake for when agent comes online?
   - **Recommendation:** No - wake is for online agents only. Offline gets inbox.

4. **Channel notification format:** What format for Slack/Discord?
   - **Recommendation:** Minimal summary with link to full message in inbox

---

## 17. Appendix: Type Definitions

All types reference the canonical spec at `/Users/openclaw/.openclaw/workspace/_shared/specs/acp-canonical-spec.md`:

- `ACPMessageType`
- `ACPPriority`
- `ACPMessageStatus`
- `ACPPolicy`
- `ACPExternalRef`
- `ACPMessageEnvelope`
- `ACPPayload`
- `ACPArtifactRef`

---

**End of Design Document**

*Ready for implementation upon approval.*

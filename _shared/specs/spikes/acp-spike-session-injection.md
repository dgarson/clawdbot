# Spike: Extension Session Injection via `chat.inject`

**Date:** 2026-02-21  
**Investigator:** roman  
**Status:** Complete

---

## Executive Summary

Extensions **can** inject system messages into active agent sessions using the existing `chat.inject` Gateway method. However, this method requires **ADMIN_SCOPE** (operator.admin), writes only **assistant-role** messages, and does not trigger agent processing.

---

## Mechanism / API Path

| Component | Details |
|-----------|---------|
| **Method** | `chat.inject` |
| **Path** | Gateway WebSocket or HTTP RPC |
| **Implementation** | `src/gateway/server-methods/chat.ts` → `appendAssistantTranscriptMessage()` |
| **Schema** | `src/gateway/protocol/schema/logs-chat.ts` → `ChatInjectParamsSchema` |

### Parameters

```typescript
{
  sessionKey: string;      // Required - Gateway session key
  message: string;         // Required - Content to inject
  label?: string;          // Optional - Prefix label (max 100 chars)
}
```

### Response

```typescript
{
  ok: boolean;
  messageId?: string;
  error?: string;
}
```

---

## Required Permissions

| Scope | Required | Notes |
|-------|----------|-------|
| `operator.admin` | **YES** | Defined in `src/gateway/method-scopes.ts` |

```typescript
// From METHOD_SCOPE_GROUPS:
[ADMIN_SCOPE]: [
  "chat.inject",
  // ... other admin methods
]
```

**Implication for Extensions:** Extensions running with standard operator tokens cannot call `chat.inject`. They would need admin-level credentials.

---

## Implementation Details

### Core Flow

1. **Session Resolution**: `loadSessionEntry(sessionKey)` → retrieves `storePath`, `entry.sessionId`
2. **Transcript Path**: `resolveSessionFilePath()` → locates JSONL transcript
3. **Message Construction**: Builds message with:
   - `role: "assistant"` (hardcoded)
   - `api: "openai-responses"`
   - `provider: "openclaw"`
   - `model: "gateway-injected"`
   - `parentId` chain maintained via `SessionManager.appendMessage()`
4. **Broadcast**: Fires `chat` event to webchat UI and node subscribers

### Key Code Paths

```
chat.inject handler → appendAssistantTranscriptMessage()
  → SessionManager.open(transcriptPath)
  → sessionManager.appendMessage(messageBody)
  → context.broadcast("chat", payload)
```

---

## Latency Observations

| Operation | Expected Latency | Notes |
|-----------|-----------------|-------|
| JSONL append | **< 50ms** | Synchronous file I/O |
| Broadcast | **< 10ms** | In-memory pub/sub |
| Total round-trip | **~50-100ms** | Depends on transcript size |

**Note:** No latency testing data in repo. Estimates based on code review of synchronous I/O patterns.

---

## Failure Modes

| Failure | Error Code | Recovery |
|---------|------------|----------|
| Session not found | `INVALID_REQUEST` | Validate sessionKey exists |
| No storePath configured | `INVALID_REQUEST` | Session must have disk storage |
| Transcript write failure | `UNAVAILABLE` | Disk I/O error, check permissions |
| Invalid params | `INVALID_REQUEST` | Schema validation |
| Label > 100 chars | `INVALID_REQUEST` | Truncation or reject |

---

## Limitations

1. **Role Fixed to Assistant**: Cannot inject user messages. Only `role: "assistant"` is supported.
2. **No Agent Trigger**: Message is written to transcript but **does not** invoke the agent. It's a passive append.
3. **Admin-Only**: Requires `operator.admin` scope - not available to standard operators.
4. **No Idempotency by Default**: Optional `idempotencyKey` available but not exposed in public params.
5. **No Rich Content**: Only text content block. No images/attachments in current schema.

---

## Alternative Approaches

### 1. `chat.send` (Current Workaround)
- **Pros:** Available with `WRITE_SCOPE`, triggers agent processing
- **Cons:** Agent processes the message; may not be desired for "system" injection

### 2. Plugin Hook: `before_prompt_build`
- **Pros:** Can modify prompts before agent processes them
- **Cons:** Only works during agent invocation; not for direct message injection

### 3. Custom Gateway Method
- **Pros:** Full control over behavior
- **Cons:** Requires new method registration, new permission scope

---

## Implementation Recommendation for ACP

### Option A: Expose `chat.inject` to ACP Bridge (Recommended)

**Rationale:** Minimal implementation, leverages existing infrastructure.

1. ACP bridge already calls Gateway methods (`chat.send`, `chat.history`)
2. Add `chat.inject` to allowed ACP methods
3. Require admin token for ACP connections (already typical)

```typescript
// In ACP bridge, add:
case "inject":
  return gateway.invoke("chat.inject", params);
```

**Permission Model:**
- ACP connections should use admin-scoped tokens
- Or add new `acp.inject` scope with appropriate limits

### Option B: New `acp.message` Method

**Rationale:** More control, explicit ACP semantics.

1. Create new `acp.inject` Gateway method
2. Define new scope `operator.acp` 
3. Allow ACP bridge to register sessions with injection capability

**Pros:** Cleaner semantics, explicit ACP intent  
**Cons:** More implementation work

---

## Spike Verdict

| Question | Answer |
|----------|--------|
| Can extensions inject messages? | **YES** - via `chat.inject` |
| Is it suitable for ACP? | **PARTIAL** - works but requires admin scope |
| Latency acceptable? | **YES** - ~50-100ms |
| Production-ready? | **YES** - used in production for cron timestamp injection |

### Recommended Next Steps

1. **Low Effort:** Document `chat.inject` for ACP usage with admin tokens
2. **Medium Effort:** Create `acp.inject` method with scoped permissions
3. **High Effort:** Add user-role message injection support if needed

---

## References

- Schema: `src/gateway/protocol/schema/logs-chat.ts`
- Handler: `src/gateway/server-methods/chat.ts` (line ~700)
- Scopes: `src/gateway/method-scopes.ts`
- Test: `src/gateway/server-methods/chat.inject.parentid.e2e.test.ts`

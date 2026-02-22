# Gateway Backend Contract — Horizon UI (web-next)
**Author:** Luis (subagent, on behalf of David)  
**Date:** 2026-02-21  
**Status:** FINAL — required for Tim to begin backend workstream  
**Priority:** BLOCKING — deadline midnight tonight

---

## Executive Summary

This document is the authoritative backend contract for the OpenClaw Gateway server to support the new **Horizon UI** (`apps/web-next`). The Horizon UI is a Next.js 15 + React app built by the Product & UI Squad. All method names, request shapes, response shapes, events, error codes, scopes, and snapshot data are derived directly from the UI source code.

**CRITICAL:** The `apps/web-next/src/hooks/useGateway.ts` currently has **protocol mismatches** with the actual gateway wire format. Section 1 defines the correct protocol. Tim must ensure the backend sends frames in this format. Luis's team will update the client hook to match — but both sides need to be aligned first.

---

## 1. Wire Protocol (WebSocket)

### Frame Format

All messages are JSON. There are **four frame types**:

#### 1.1 Request Frame (Client → Server)
```typescript
{
  type: "req",
  id: string,          // UUID (not integer — client MUST use UUID)
  method: string,
  params?: unknown
}
```

#### 1.2 Response Frame (Server → Client)
```typescript
{
  type: "res",
  id: string,          // matches request id
  ok: boolean,
  payload?: unknown,   // present if ok = true
  error?: {
    code: string,       // see Section 7: Error Codes
    message: string,
    details?: unknown,
    retryable?: boolean,
    retryAfterMs?: number
  }
}
```

#### 1.3 Event Frame (Server → Client, push)
```typescript
{
  type: "event",
  event: string,       // event name, e.g. "chat", "agent"
  payload?: unknown,
  seq?: number,        // monotonically increasing sequence number
  stateVersion?: { presence: number; health: number }
}
```

#### 1.4 Hello-OK Frame (Server → Client, after connect method)
```typescript
{
  type: "hello-ok",
  protocol: number,    // e.g. 3
  features?: {
    methods?: string[],
    events?: string[]
  },
  snapshot?: {         // see Section 8: Snapshot Data
    presence: PresenceEntry[],
    health: unknown,
    stateVersion: { presence: number; health: number },
    uptimeMs: number,
    configPath?: string,
    stateDir?: string,
    sessionDefaults?: SessionDefaults,
    authMode?: "none" | "token" | "password" | "trusted-proxy",
    updateAvailable?: { currentVersion: string; latestVersion: string; channel: string }
  },
  auth?: {
    deviceToken?: string,  // new device token to store
    role?: string,
    scopes?: string[],
    issuedAtMs?: number
  },
  policy?: {
    tickIntervalMs?: number
  }
}
```

### 1.5 Connection Handshake Flow

1. Client connects via WebSocket
2. **Server MUST send** `connect.challenge` event immediately:
   ```json
   { "type": "event", "event": "connect.challenge", "payload": { "nonce": "<string>" } }
   ```
3. Client sends `connect` method request with the nonce (see Section 2.1)
4. Server responds with `hello-ok` frame (not a normal `res` frame — special case)

**⚠️ NOTE FOR TIM:** The current `useGateway.ts` in `apps/web-next` treats the hello as `{ type: 'hello' }` and uses integer IDs and `result` field. Luis's team will fix the hook, but the server must implement the correct protocol above (UUID IDs, `payload` field, `hello-ok` type).

---

## 2. Connection & Auth

### 2.1 `connect`
**Scope:** `operator.admin`  
**Description:** Authenticate and establish session. Sent in response to `connect.challenge`.

**Request Params:**
```typescript
{
  minProtocol: number,    // e.g. 3
  maxProtocol: number,    // e.g. 3
  client: {
    id: string,           // e.g. "openclaw-control-ui"
    version: string,
    platform: string,     // e.g. "web"
    mode: string,         // e.g. "webchat"
    instanceId?: string
  },
  role: "operator",
  scopes: string[],       // e.g. ["operator.admin", "operator.approvals", "operator.pairing"]
  device?: {
    id: string,           // device UUID
    publicKey: string,    // base64 public key
    signature: string,    // base64 signature of payload
    signedAt: number,     // ms timestamp
    nonce?: string        // from connect.challenge
  },
  caps?: string[],        // e.g. ["tool-events"]
  auth?: {
    token?: string,
    password?: string
  },
  userAgent?: string,
  locale?: string
}
```

**Response:** `hello-ok` frame (see Section 1.4)

---

## 3. RPC Methods by Domain

---

### 3.1 HEALTH & STATUS

#### `health`
**Scope:** `operator.read`  
**Description:** System health snapshot.

**Request:** `{}`

**Response:**
```typescript
Record<string, unknown>   // free-form health data
```

---

#### `status`
**Scope:** `operator.read`  
**Description:** System status summary.

**Request:** `{}`

**Response:**
```typescript
Record<string, unknown>
```

---

#### `system-presence`
**Scope:** `operator.read`  
**Description:** List all connected instances.

**Request:** `{}`

**Response:** `PresenceEntry[]`
```typescript
type PresenceEntry = {
  instanceId?: string | null,
  host?: string | null,
  ip?: string | null,
  version?: string | null,
  platform?: string | null,
  deviceFamily?: string | null,
  modelIdentifier?: string | null,
  roles?: string[] | null,
  scopes?: string[] | null,
  mode?: string | null,
  lastInputSeconds?: number | null,
  reason?: string | null,
  text?: string | null,
  ts?: number | null
}
```

---

#### `last-heartbeat`
**Scope:** `operator.read`  
**Description:** Last heartbeat data.

**Request:** `{}`

**Response:** `unknown` (passed through to debug view)

---

### 3.2 AGENTS

#### `agents.list`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  defaultId: string,
  mainKey: string,
  scope: string,
  agents: Array<{
    id: string,
    name?: string,
    identity?: {
      name?: string,
      theme?: string,
      emoji?: string,
      avatar?: string,
      avatarUrl?: string
    }
  }>
}
```

---

#### `agent.identity.get`
**Scope:** `operator.read`

**Request:**
```typescript
{
  agentId?: string,   // omit for default/main agent
  sessionKey?: string
}
```

**Response:**
```typescript
{
  agentId: string,
  name: string,
  avatar: string,
  emoji?: string
}
```

---

#### `agents.create`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  agentId: string,
  name?: string,
  description?: string,
  files?: Array<{ name: string; content: string }>,
  templateId?: string
}
```

**Response:**
```typescript
{
  ok: true,
  agentId: string
}
```

---

#### `agents.update`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  agentId: string,
  name?: string,
  description?: string
}
```

**Response:**
```typescript
{ ok: true }
```

---

#### `agents.delete`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  agentId: string
}
```

**Response:**
```typescript
{ ok: true }
```

---

#### `agents.files.list`
**Scope:** `operator.read`

**Request:**
```typescript
{ agentId: string }
```

**Response:**
```typescript
{
  agentId: string,
  workspace: string,
  files: Array<{
    name: string,
    path: string,
    missing: boolean,
    size?: number,
    updatedAtMs?: number,
    content?: string
  }>
}
```

---

#### `agents.files.get`
**Scope:** `operator.read`

**Request:**
```typescript
{ agentId: string; name: string }
```

**Response:**
```typescript
{
  agentId: string,
  workspace: string,
  file: {
    name: string,
    path: string,
    missing: boolean,
    size?: number,
    updatedAtMs?: number,
    content?: string
  }
}
```

---

#### `agents.files.set`
**Scope:** `operator.admin`

**Request:**
```typescript
{ agentId: string; name: string; content: string }
```

**Response:**
```typescript
{
  ok: true,
  agentId: string,
  workspace: string,
  file: AgentFileEntry  // same shape as above
}
```

---

### 3.3 CHAT

#### `chat.history`
**Scope:** `operator.read`

**Request:**
```typescript
{
  sessionKey: string,
  limit?: number       // e.g. 200
}
```

**Response:**
```typescript
{
  messages?: Array<unknown>,   // Claude message objects
  thinkingLevel?: string
}
```

---

#### `chat.send`
**Scope:** `operator.write`

**Request:**
```typescript
{
  sessionKey: string,
  message: string,
  deliver?: boolean,         // false = don't deliver to channel
  idempotencyKey?: string,   // UUID for dedup
  attachments?: Array<{
    type: "image",
    mimeType: string,
    content: string           // base64
  }>
}
```

**Response:** `{}` (empty on success; listen for `chat` event stream)

---

#### `chat.abort`
**Scope:** `operator.write`

**Request:**
```typescript
{
  sessionKey: string,
  runId?: string
}
```

**Response:** `{}` or `{ ok: true }`

---

#### `chat.inject`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  sessionKey: string,
  message: string,
  role?: "user" | "assistant"
}
```

**Response:** `{}`

---

### 3.4 SESSIONS

#### `sessions.list`
**Scope:** `operator.read`

**Request:**
```typescript
{
  includeGlobal?: boolean,
  includeUnknown?: boolean,
  activeMinutes?: number,
  limit?: number
}
```

**Response:**
```typescript
{
  ts: number,
  path: string,
  count: number,
  defaults: {
    model: string | null,
    contextTokens: number | null
  },
  sessions: Array<{
    key: string,
    kind: "direct" | "group" | "global" | "unknown",
    label?: string,
    displayName?: string,
    surface?: string,
    subject?: string,
    room?: string,
    space?: string,
    updatedAt: number | null,
    sessionId?: string,
    systemSent?: boolean,
    abortedLastRun?: boolean,
    thinkingLevel?: string,
    verboseLevel?: string,
    reasoningLevel?: string,
    resolvedThinkingLevel?: string,
    resolvedVerboseLevel?: string,
    elevatedLevel?: string,
    inputTokens?: number,
    outputTokens?: number,
    totalTokens?: number,
    model?: string,
    modelProvider?: string,
    contextTokens?: number
  }>
}
```

---

#### `sessions.preview`
**Scope:** `operator.read`

**Request:**
```typescript
{ key: string }
```

**Response:**
```typescript
{
  key: string,
  messages?: Array<unknown>,
  summary?: string
}
```

---

#### `sessions.patch`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  key: string,
  label?: string | null,
  thinkingLevel?: string | null,
  verboseLevel?: string | null,
  reasoningLevel?: string | null
}
```

**Response:**
```typescript
{
  ok: true,
  path: string,
  key: string,
  entry: {
    sessionId: string,
    updatedAt?: number,
    thinkingLevel?: string,
    verboseLevel?: string,
    reasoningLevel?: string,
    elevatedLevel?: string
  }
}
```

---

#### `sessions.reset`
**Scope:** `operator.admin`

**Request:**
```typescript
{ key: string }
```

**Response:** `{ ok: true }`

---

#### `sessions.delete`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  key: string,
  deleteTranscript?: boolean
}
```

**Response:** `{ ok: true }`

---

#### `sessions.compact`
**Scope:** `operator.admin`

**Request:**
```typescript
{ key: string }
```

**Response:** `{ ok: true }`

---

#### `sessions.resolve`
**Scope:** `operator.read`

**Request:**
```typescript
{ key: string }
```

**Response:**
```typescript
{
  key: string,
  resolved?: string  // canonical session key
}
```

---

#### `sessions.usage`
**Scope:** `operator.read`

**Request:**
```typescript
{
  startDate: string,        // ISO date e.g. "2026-02-01"
  endDate: string,
  limit?: number,
  includeContextWeight?: boolean
}
```

**Response:**
```typescript
{
  sessions: Array<{
    key: string,
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    cost?: number,
    model?: string,
    provider?: string,
    messageCount?: number,
    // ...other fields
  }>,
  totals: {
    inputTokens: number,
    outputTokens: number,
    totalTokens: number,
    cost?: number
  }
}
```

---

#### `sessions.usage.timeseries`
**Scope:** `operator.read`

**Request:**
```typescript
{ key: string }
```

**Response:**
```typescript
{
  key: string,
  points: Array<{
    ts: number,
    inputTokens: number,
    outputTokens: number
  }>
}
```

---

#### `sessions.usage.logs`
**Scope:** `operator.read`

**Request:**
```typescript
{
  key: string,
  limit?: number
}
```

**Response:**
```typescript
{
  logs: Array<{
    ts: number,
    role: string,
    inputTokens?: number,
    outputTokens?: number,
    model?: string
  }>
}
```

---

### 3.5 CONFIG

#### `config.get`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  path?: string | null,
  exists?: boolean | null,
  raw?: string | null,         // raw YAML/JSON string
  hash?: string | null,        // SHA hash for optimistic concurrency
  parsed?: unknown,
  valid?: boolean | null,
  config?: Record<string, unknown> | null,
  issues?: Array<{ path: string; message: string }> | null
}
```

---

#### `config.set`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  raw: string,       // full config YAML/JSON string
  baseHash: string   // must match current hash (optimistic concurrency)
}
```

**Response:** `{ ok: true }` or updated `ConfigSnapshot`

**Error:** `INVALID_REQUEST` if hash mismatch or validation fails.

---

#### `config.apply`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  raw: string,
  baseHash: string,
  sessionKey?: string  // session to announce completion to
}
```

**Response:** `{ ok: true }` (Gateway restarts/reloads after applying)

---

#### `config.schema`
**Scope:** `operator.admin`

**Request:** `{}`

**Response:**
```typescript
{
  schema: unknown,         // JSON Schema object
  uiHints: Record<string, {
    label?: string,
    help?: string,
    group?: string,
    order?: number,
    advanced?: boolean,
    sensitive?: boolean,
    placeholder?: string,
    itemTemplate?: unknown
  }>,
  version: string,
  generatedAt: string
}
```

---

#### `config.patch`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  path: string,      // dot-notation config key e.g. "gateway.port"
  value: unknown,
  baseHash: string
}
```

**Response:** Updated `ConfigSnapshot`

---

### 3.6 CRON / AUTOMATIONS

#### `cron.status`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  enabled: boolean,
  jobs: number,
  nextWakeAtMs?: number | null
}
```

---

#### `cron.list`
**Scope:** `operator.read`

**Request:**
```typescript
{ includeDisabled?: boolean }
```

**Response:**
```typescript
{
  jobs: Array<{
    id: string,
    agentId?: string,
    name: string,
    description?: string,
    enabled: boolean,
    deleteAfterRun?: boolean,
    createdAtMs: number,
    updatedAtMs: number,
    schedule: CronSchedule,      // see types below
    sessionTarget: "main" | "isolated",
    wakeMode: "next-heartbeat" | "now",
    payload: CronPayload,
    delivery?: CronDelivery,
    state?: {
      nextRunAtMs?: number,
      runningAtMs?: number,
      lastRunAtMs?: number,
      lastStatus?: "ok" | "error" | "skipped",
      lastError?: string,
      lastDurationMs?: number
    }
  }>
}

type CronSchedule =
  | { kind: "at"; at: string }
  | { kind: "every"; everyMs: number; anchorMs?: number }
  | { kind: "cron"; expr: string; tz?: string }

type CronPayload =
  | { kind: "systemEvent"; text: string }
  | { kind: "agentTurn"; message: string; thinking?: string; timeoutSeconds?: number }

type CronDelivery = {
  mode: "none" | "announce" | "webhook",
  channel?: string,
  to?: string,
  bestEffort?: boolean
}
```

---

#### `cron.add`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  name: string,
  description?: string,
  agentId?: string,
  enabled: boolean,
  schedule: CronSchedule,
  sessionTarget: "main" | "isolated",
  wakeMode: "next-heartbeat" | "now",
  payload: CronPayload,
  delivery?: CronDelivery
}
```

**Response:** `{ ok: true }` or created `CronJob`

---

#### `cron.update`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  id: string,
  patch: {
    enabled?: boolean,
    name?: string,
    description?: string,
    schedule?: CronSchedule,
    payload?: CronPayload,
    delivery?: CronDelivery
  }
}
```

**Response:** `{ ok: true }`

---

#### `cron.remove`
**Scope:** `operator.admin`

**Request:**
```typescript
{ id: string }
```

**Response:** `{ ok: true }`

---

#### `cron.run`
**Scope:** `operator.admin`

**Request:**
```typescript
{ id: string; mode?: "force" }
```

**Response:** `{ ok: true }`

---

#### `cron.runs`
**Scope:** `operator.read`

**Request:**
```typescript
{ id: string; limit?: number }
```

**Response:**
```typescript
{
  entries: Array<{
    ts: number,
    jobId: string,
    status: "ok" | "error" | "skipped",
    durationMs?: number,
    error?: string,
    summary?: string,
    sessionId?: string,
    sessionKey?: string
  }>
}
```

---

### 3.7 SKILLS

#### `skills.status`
**Scope:** `operator.read`

**Request:**
```typescript
{ agentId?: string }
```

**Response:**
```typescript
{
  workspaceDir: string,
  managedSkillsDir: string,
  skills: Array<{
    name: string,
    description: string,
    source: string,
    filePath: string,
    baseDir: string,
    skillKey: string,
    bundled?: boolean,
    primaryEnv?: string,
    emoji?: string,
    homepage?: string,
    always: boolean,
    disabled: boolean,
    blockedByAllowlist: boolean,
    eligible: boolean,
    requirements: { bins: string[]; env: string[]; config: string[]; os: string[] },
    missing: { bins: string[]; env: string[]; config: string[]; os: string[] },
    configChecks: Array<{ path: string; satisfied: boolean }>,
    install: Array<{
      id: string,
      kind: "brew" | "node" | "go" | "uv",
      label: string,
      bins: string[]
    }>
  }>
}
```

---

#### `skills.install`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  name: string,
  installId: string,
  timeoutMs?: number
}
```

**Response:**
```typescript
{ message?: string }
```

---

#### `skills.update`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  skillKey: string,
  enabled?: boolean,
  apiKey?: string
}
```

**Response:** `{ ok: true }`

---

### 3.8 NODES

#### `node.list`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  nodes: Array<Record<string, unknown>>   // node info objects
}
```

---

#### `node.describe`
**Scope:** `operator.read`

**Request:**
```typescript
{ nodeId: string }
```

**Response:**
```typescript
{
  nodeId: string,
  name?: string,
  platform?: string,
  version?: string,
  capabilities?: string[],
  // ...additional fields
}
```

---

#### `node.invoke`
**Scope:** `operator.write`

**Request:**
```typescript
{
  nodeId: string,
  command: string,
  params?: unknown,
  timeoutMs?: number
}
```

**Response:**
```typescript
{ result?: unknown }
```

---

### 3.9 CHANNELS

#### `channels.status`
**Scope:** `operator.read`

**Request:**
```typescript
{
  probe?: boolean,
  timeoutMs?: number
}
```

**Response:**
```typescript
{
  ts: number,
  channelOrder: string[],
  channelLabels: Record<string, string>,
  channelDetailLabels?: Record<string, string>,
  channelSystemImages?: Record<string, string>,
  channelMeta?: Array<{ id: string; label: string; detailLabel: string; systemImage?: string }>,
  channels: Record<string, unknown>,
  channelAccounts: Record<string, Array<ChannelAccountSnapshot>>,
  channelDefaultAccountId: Record<string, string>
}
```

`ChannelAccountSnapshot` is a large type — see `ui/src/ui/types.ts` for full definition. Key fields:
```typescript
{
  accountId: string,
  name?: string | null,
  enabled?: boolean | null,
  configured?: boolean | null,
  connected?: boolean | null,
  running?: boolean | null,
  lastError?: string | null,
  lastConnectedAt?: number | null,
  // ...many optional status fields
}
```

---

#### `channels.logout`
**Scope:** `operator.admin`

**Request:**
```typescript
{ channel: string }   // e.g. "whatsapp"
```

**Response:** `{ ok: true }`

---

#### `web.login.start`
**Scope:** `operator.admin`  
**Description:** Start WhatsApp Web QR login flow.

**Request:**
```typescript
{
  force?: boolean,
  timeoutMs?: number
}
```

**Response:**
```typescript
{
  message?: string,
  qrDataUrl?: string    // base64-encoded PNG data URL: "data:image/png;base64,..."
}
```

---

#### `web.login.wait`
**Scope:** `operator.admin`  
**Description:** Wait for WhatsApp QR scan to complete.

**Request:**
```typescript
{ timeoutMs?: number }
```

**Response:**
```typescript
{
  message?: string,
  connected?: boolean
}
```

---

### 3.10 DEVICES & PAIRING

#### `device.pair.list`
**Scope:** `operator.pairing`

**Request:** `{}`

**Response:**
```typescript
{
  pending: Array<{
    requestId: string,
    deviceId: string,
    displayName?: string,
    role?: string,
    remoteIp?: string,
    isRepair?: boolean,
    ts?: number
  }>,
  paired: Array<{
    deviceId: string,
    displayName?: string,
    roles?: string[],
    scopes?: string[],
    remoteIp?: string,
    tokens?: Array<{
      role: string,
      scopes?: string[],
      createdAtMs?: number,
      rotatedAtMs?: number,
      revokedAtMs?: number,
      lastUsedAtMs?: number
    }>,
    createdAtMs?: number,
    approvedAtMs?: number
  }>
}
```

---

#### `device.pair.approve`
**Scope:** `operator.pairing`

**Request:**
```typescript
{ requestId: string }
```

**Response:** `{ ok: true }`

---

#### `device.pair.reject`
**Scope:** `operator.pairing`

**Request:**
```typescript
{ requestId: string }
```

**Response:** `{ ok: true }`

---

#### `device.pair.remove`
**Scope:** `operator.pairing`

**Request:**
```typescript
{ deviceId: string }
```

**Response:** `{ ok: true }`

---

#### `device.token.rotate`
**Scope:** `operator.pairing`

**Request:**
```typescript
{
  deviceId: string,
  role: string,
  scopes?: string[]
}
```

**Response:**
```typescript
{
  token: string,
  role?: string,
  deviceId?: string,
  scopes?: string[]
}
```

---

#### `device.token.revoke`
**Scope:** `operator.pairing`

**Request:**
```typescript
{
  deviceId: string,
  role: string
}
```

**Response:** `{ ok: true }`

---

### 3.11 EXEC APPROVALS

#### `exec.approval.request`
**Scope:** `operator.approvals`

**Request:**
```typescript
{
  command: string,
  cwd?: string,
  host?: string,
  security?: string,
  ask?: string,
  agentId?: string,
  resolvedPath?: string,
  sessionKey?: string
}
```

**Response:**
```typescript
{
  id: string,
  expiresAtMs: number
}
```

---

#### `exec.approval.waitDecision`
**Scope:** `operator.approvals`

**Request:**
```typescript
{
  id: string,
  timeoutMs?: number
}
```

**Response:**
```typescript
{
  decision: "allow" | "deny",
  resolvedBy?: string
}
```

---

#### `exec.approval.resolve`
**Scope:** `operator.approvals`

**Request:**
```typescript
{
  id: string,
  decision: "allow" | "deny"
}
```

**Response:** `{ ok: true }`

---

#### `exec.approvals.get`
**Scope:** `operator.admin`  
**Description:** Get the exec approvals config file for the gateway.

**Request:** `{}`

**Response:**
```typescript
{
  path: string,
  exists: boolean,
  hash: string,
  file: {
    version?: number,
    socket?: { path?: string },
    defaults?: {
      security?: string,
      ask?: string,
      askFallback?: string,
      autoAllowSkills?: boolean
    },
    agents?: Record<string, {
      security?: string,
      ask?: string,
      askFallback?: string,
      autoAllowSkills?: boolean,
      allowlist?: Array<{
        id?: string,
        pattern: string,
        lastUsedAt?: number,
        lastUsedCommand?: string,
        lastResolvedPath?: string
      }>
    }>
  }
}
```

---

#### `exec.approvals.set`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  file: ExecApprovalsFile,   // same shape as above
  baseHash: string
}
```

**Response:** `{ ok: true }`

---

#### `exec.approvals.node.get`
**Scope:** `operator.admin`

**Request:**
```typescript
{ nodeId: string }
```

**Response:** Same as `exec.approvals.get` but for the node.

---

#### `exec.approvals.node.set`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  nodeId: string,
  file: ExecApprovalsFile,
  baseHash: string
}
```

**Response:** `{ ok: true }`

---

### 3.12 MODELS

#### `models.list`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  models: Array<{
    id: string,
    name: string,
    provider: string,
    contextWindow?: number,
    description?: string,
    capabilities?: string[],
    speed?: "fast" | "medium" | "slow",
    cost?: "low" | "medium" | "high"
  }>
}
```

---

### 3.13 USAGE

#### `usage.cost`
**Scope:** `operator.read`

**Request:**
```typescript
{
  startDate: string,   // "YYYY-MM-DD"
  endDate: string
}
```

**Response:**
```typescript
{
  total: number,         // total cost in USD
  daily: Array<{
    date: string,
    cost: number,
    inputTokens: number,
    outputTokens: number
  }>,
  byModel?: Record<string, { cost: number; inputTokens: number; outputTokens: number }>,
  byProvider?: Record<string, { cost: number }>
}
```

---

#### `usage.status`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  today: { cost: number; messages: number; tokens: number },
  thisWeek: { cost: number; messages: number; tokens: number },
  thisMonth: { cost: number; messages: number; tokens: number }
}
```

---

### 3.14 LOGS

#### `logs.tail`
**Scope:** `operator.read`

**Request:**
```typescript
{
  cursor?: number,
  limit?: number,
  maxBytes?: number
}
```

**Response:**
```typescript
{
  file?: string,
  cursor?: number,
  size?: number,
  lines?: string[],     // raw log lines (JSONL format)
  truncated?: boolean,
  reset?: boolean       // true if cursor was reset (e.g. log rotated)
}
```

---

### 3.15 UPDATE

#### `update.run`
**Scope:** `operator.admin`

**Request:**
```typescript
{ sessionKey?: string }
```

**Response:** `{ ok: true }`

---

### 3.16 TTS

#### `tts.status`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  enabled: boolean,
  provider?: string
}
```

---

#### `tts.providers`
**Scope:** `operator.read`

**Request:** `{}`

**Response:**
```typescript
{
  providers: Array<{ id: string; name: string; configured: boolean }>
}
```

---

#### `tts.enable`
**Scope:** `operator.write`

**Request:** `{}`

**Response:** `{ ok: true }`

---

#### `tts.disable`
**Scope:** `operator.write`

**Request:** `{}`

**Response:** `{ ok: true }`

---

#### `tts.convert`
**Scope:** `operator.write`

**Request:**
```typescript
{
  text: string,
  provider?: string,
  voice?: string
}
```

**Response:**
```typescript
{
  audioUrl?: string,
  audioData?: string   // base64
}
```

---

#### `tts.setProvider`
**Scope:** `operator.write`

**Request:**
```typescript
{ provider: string }
```

**Response:** `{ ok: true }`

---

### 3.17 WIZARD (OAuth / Onboarding)

The wizard system drives interactive multi-step flows over WebSocket. Used for:
- First-run onboarding (`setup/` route)
- Provider OAuth authentication (`ProviderAuthManager` view)
- Adding new model providers

#### `wizard.start`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  mode?: "local" | "remote",
  workspace?: string
}
```

**Response:**
```typescript
{
  sessionId: string,
  done: boolean,
  step?: WizardStep,
  status?: "running" | "done" | "cancelled" | "error",
  error?: string
}
```

**⚠️ IMPLEMENTATION GAP:** The Horizon UI (`OAUTH_INTEGRATION_SPEC.md`) calls `wizard.start` with `mode: "add-provider"` to launch provider auth flows. The current server only supports `mode: "local" | "remote"`. **Tim needs to add `"add-provider"` mode support** or the UI will fall back to a different mechanism.

The UI also passes `provider?: string` in start params (e.g. `{ mode: "add-provider", provider: "minimax" }`). The current schema doesn't accept this.

---

#### `wizard.next`
**Scope:** `operator.admin`

**Request:**
```typescript
{
  sessionId: string,
  answer?: {
    stepId: string,
    value?: unknown
  }
}
```

**Response:**
```typescript
{
  done: boolean,
  step?: WizardStep,
  status?: "running" | "done" | "cancelled" | "error",
  error?: string
}
```

---

#### `wizard.cancel`
**Scope:** `operator.admin`

**Request:**
```typescript
{ sessionId: string }
```

**Response:**
```typescript
{
  status: "running" | "done" | "cancelled" | "error",
  error?: string
}
```

---

#### `wizard.status`
**Scope:** `operator.admin`

**Request:**
```typescript
{ sessionId: string }
```

**Response:**
```typescript
{
  status: "running" | "done" | "cancelled" | "error",
  error?: string
}
```

---

#### WizardStep Type

```typescript
type WizardStep = {
  id: string,
  type: "note" | "select" | "text" | "confirm" | "multiselect" | "progress" | "action",
  title?: string,
  message?: string,
  options?: Array<{
    value: unknown,
    label: string,
    hint?: string
  }>,
  initialValue?: unknown,
  placeholder?: string,
  sensitive?: boolean,        // hide input (passwords, tokens)
  executor?: "gateway" | "client"
}
```

**⚠️ IMPLEMENTATION GAP:** The Horizon UI expects additional step types:
- `"password"` — same as `"text"` with `sensitive: true` (UI already handles via `sensitive` flag — OK)
- `"info"` — maps to `"note"` (UI should handle both names)
- `"qr"` — for QR code display (WhatsApp, etc.) — **NOT in current server schema. Needed for OAuth flows.**
- `"device_code"` — for device code OAuth display — **NOT in current server schema. Needed for OAuth flows.**

**Recommendation:** Add `"qr"` and `"device_code"` step types to the server schema, with:
```typescript
// qr step
{ id, type: "qr", title?, message?, qrData: string }  // qrData = data URL or raw string

// device_code step
{ id, type: "device_code", title?, message?, verificationUrl: string, userCode: string, expiresAt?: number }
```

---

### 3.18 MISC / SYSTEM

#### `send`
**Scope:** `operator.write`  
**Description:** Send a message to an agent session (channel-level send).

**Request:**
```typescript
{
  sessionKey: string,
  message: string,
  to?: string
}
```

---

#### `set-heartbeats`
**Scope:** `operator.admin`

**Request:**
```typescript
{ enabled: boolean }
```

---

#### `system-event`
**Scope:** `operator.admin`

**Request:**
```typescript
{ text: string }
```

---

#### `push.test`
**Scope:** `operator.write`

**Request:** `{}`

**Response:** `{ ok: true }`

---

## 4. Push Events (Server → Client)

All events arrive as `GatewayEventFrame`:
```typescript
{ type: "event", event: string, payload?: unknown, seq?: number, stateVersion?: { presence: number; health: number } }
```

### 4.1 Connection Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `connect.challenge` | `{ nonce: string }` | Client uses nonce to sign `connect` request |

---

### 4.2 Chat Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `chat` | `ChatEventPayload` | Stream messages into chat view |

```typescript
type ChatEventPayload = {
  runId: string,
  sessionKey: string,
  state: "delta" | "final" | "aborted" | "error",
  message?: unknown,         // Claude message object (for delta/final)
  errorMessage?: string      // for error state
}
```

The `delta` state carries partial text in `message`. UI extracts text and appends to stream. `final` triggers history reload. `aborted` shows partial content. `error` shows error message.

---

### 4.3 Agent Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `agent` | `AgentEventPayload` | Tool stream cards (exec, web fetch, etc.) |

```typescript
type AgentEventPayload = {
  runId?: string,
  sessionKey?: string,
  kind?: "tool-start" | "tool-end" | "tool-stream",
  toolName?: string,
  toolInput?: unknown,
  toolOutput?: unknown,
  compactionStatus?: { compacted: boolean; contextTokens?: number },
  fallbackStatus?: { fallback: boolean; model?: string }
}
```

---

### 4.4 Presence Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `presence` | `{ presence: PresenceEntry[] }` | Update connected clients list |

---

### 4.5 Cron Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `cron` | `unknown` | Refresh cron jobs list |

---

### 4.6 Device Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `device.pair.requested` | `PendingDevice` | Show pairing notification, refresh devices |
| `device.pair.resolved` | `{ deviceId, requestId }` | Refresh devices list |

```typescript
type PendingDevice = {
  requestId: string,
  deviceId: string,
  displayName?: string,
  role?: string,
  remoteIp?: string,
  isRepair?: boolean,
  ts?: number
}
```

---

### 4.7 Exec Approval Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `exec.approval.requested` | `ExecApprovalRequest` | Show approval notification bar; auto-expire |
| `exec.approval.resolved` | `ExecApprovalResolved` | Remove from approval queue |

```typescript
type ExecApprovalRequest = {
  id: string,
  request: {
    command: string,
    cwd?: string | null,
    host?: string | null,
    security?: string | null,
    ask?: string | null,
    agentId?: string | null,
    resolvedPath?: string | null,
    sessionKey?: string | null
  },
  createdAtMs: number,
  expiresAtMs: number
}

type ExecApprovalResolved = {
  id: string,
  decision?: string | null,
  resolvedBy?: string | null,
  ts?: number | null
}
```

---

### 4.8 Health / Shutdown Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `health` | `unknown` | Update health indicators |
| `shutdown` | `unknown` | Show reconnection overlay |

---

### 4.9 Update Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `update.available` | `{ updateAvailable: { currentVersion, latestVersion, channel } \| null }` | Show update banner |

---

### 4.10 Tick Events

| Event | Payload | UI Behavior |
|-------|---------|-------------|
| `tick` | `unknown` | Keep-alive, trigger stale data refresh (interval controlled by `policy.tickIntervalMs` in hello-ok) |

---

## 5. Snapshot Data (`hello-ok.snapshot`)

The snapshot is delivered once on connect in the `hello-ok` frame. The UI uses it to hydrate initial state immediately without additional RPC calls.

```typescript
snapshot: {
  // Required
  presence: PresenceEntry[],
  health: unknown,           // health snapshot data
  stateVersion: { presence: number; health: number },
  uptimeMs: number,

  // Optional but highly recommended
  configPath?: string,
  stateDir?: string,
  sessionDefaults?: {
    defaultAgentId: string,     // e.g. "default"
    mainKey: string,            // e.g. "main"
    mainSessionKey: string,     // e.g. "agent:default:main"
    scope?: string
  },
  authMode?: "none" | "token" | "password" | "trusted-proxy",
  updateAvailable?: {
    currentVersion: string,
    latestVersion: string,
    channel: string
  }
}
```

**`sessionDefaults` is critical** — the UI uses `mainSessionKey` to resolve session key aliases (e.g. `"main"` → `"agent:default:main:slack:C0AAQJBCU0N"`). Without it, session key resolution breaks.

---

## 6. Auth Scope Reference

| Scope | What it grants |
|-------|---------------|
| `operator.read` | Read-only access (health, lists, history, config read) |
| `operator.write` | Write access (send messages, invoke, TTS, chat) |
| `operator.admin` | Full admin (config change, agents CRUD, skills, wizard, update) |
| `operator.approvals` | Exec approval queue (request/resolve) |
| `operator.pairing` | Device pairing management |

**Scope hierarchy:** `operator.admin` implies all other scopes. `operator.read` is implied by `operator.write`.

**Default scopes requested by UI:**
```typescript
["operator.admin", "operator.approvals", "operator.pairing"]
```

**Method scope mapping** (source of truth: `src/gateway/method-scopes.ts`):

```
READ_SCOPE:    health, status, logs.tail, channels.status, usage.status, usage.cost,
               tts.status, tts.providers, models.list, agents.list, agent.identity.get,
               skills.status, voicewake.get, sessions.list, sessions.preview,
               sessions.resolve, sessions.usage, sessions.usage.timeseries,
               sessions.usage.logs, cron.list, cron.status, cron.runs, system-presence,
               last-heartbeat, node.list, node.describe, chat.history, config.get,
               talk.config, agents.files.list, agents.files.get

WRITE_SCOPE:   send, poll, agent, agent.wait, wake, talk.mode, tts.enable, tts.disable,
               tts.convert, tts.setProvider, voicewake.set, node.invoke, chat.send,
               chat.abort, browser.request, push.test

ADMIN_SCOPE:   channels.logout, agents.create, agents.update, agents.delete,
               skills.install, skills.update, cron.add, cron.update, cron.remove, cron.run,
               sessions.patch, sessions.reset, sessions.delete, sessions.compact, connect,
               chat.inject, web.login.start, web.login.wait, set-heartbeats, system-event,
               agents.files.set
               + ALL "exec.approvals.*", "config.*", "wizard.*", "update.*" (prefix match)

APPROVALS_SCOPE: exec.approval.request, exec.approval.waitDecision, exec.approval.resolve

PAIRING_SCOPE: device.pair.*, device.token.*
```

---

## 7. Error Codes

Standard error codes used in `error.code` of response frames:

| Code | When Used |
|------|-----------|
| `INVALID_REQUEST` | Bad params, validation failure, hash mismatch, wizard not found |
| `UNAVAILABLE` | Service unavailable, wizard already running |
| `NOT_LINKED` | Channel not linked (WhatsApp etc.) |
| `NOT_PAIRED` | Device not paired |
| `AGENT_TIMEOUT` | Agent run timed out |

Error shape:
```typescript
{
  code: string,
  message: string,
  details?: unknown,
  retryable?: boolean,
  retryAfterMs?: number
}
```

**UI error handling patterns:**
- All errors are surfaced as `lastError: string` state (the `error.message` value)
- The UI does NOT currently branch on `error.code` — it just shows the message
- The approval queue auto-expires entries at `expiresAtMs`; no server-side push needed for expiry

---

## 8. Implementation Gaps & Known Issues

These are items where the Horizon UI expects behavior that differs from the current server, or where work is needed on the server side:

### 8.1 Protocol Mismatch in `useGateway.ts`
The `apps/web-next/src/hooks/useGateway.ts` currently has these bugs vs. the actual protocol:
- Uses integer IDs (`id: number`) instead of UUID strings
- Expects `result` field in responses instead of `payload`
- Treats hello as `{ type: 'hello' }` instead of `{ type: 'hello-ok' }`
- Does not implement the `connect.challenge` → `connect` handshake

**Action for Luis's team:** Fix `useGateway.ts` to use the correct protocol.  
**Action for Tim:** Ensure server strictly implements the protocol in Section 1. No changes needed here unless you want to support legacy clients.

### 8.2 Wizard `"add-provider"` Mode
The `ProviderAuthManager` view and `OnboardingFlow` call:
```typescript
wizard.start({ mode: "add-provider", provider: "minimax" })
```
The current server only supports `mode: "local" | "remote"`.

**Action for Tim:** Add `"add-provider"` mode to `wizard.start`. The UI will pass `provider` to pre-select the provider in the wizard flow. Map it to the appropriate CLI wizard runner.

### 8.3 Missing Wizard Step Types: `"qr"` and `"device_code"`
OAuth flows (Google Gemini, MiniMax portal, OpenAI Codex) need these step types to display QR codes and device codes to the user during the wizard.

**Action for Tim:** Extend `WizardStepSchema` to include:
- `"qr"` step with `{ qrData: string }` (data URL for QR display)
- `"device_code"` step with `{ verificationUrl: string; userCode: string; expiresAt?: number }`

### 8.4 `usage.status` Method
Referenced in `UI_SPEC.md` for the dashboard widgets. Exists in `method-scopes.ts` (READ_SCOPE) but unclear if there's a concrete implementation. The UI calls it for "Today / This Week / This Month" cost summaries on the dashboard.

**Action for Tim:** Confirm `usage.status` is implemented. If not, add it. Response shape expected:
```typescript
{
  today: { cost: number; messages: number; tokens: number },
  thisWeek: { cost: number; messages: number; tokens: number },
  thisMonth: { cost: number; messages: number; tokens: number }
}
```

### 8.5 `config.patch`
Referenced in UI_SPEC.md for individual settings updates (e.g., toggling a single config key without sending the entire raw config). Matches the `config.*` prefix (ADMIN scope). Implement if not yet done.

### 8.6 `agents.create` — `templateId` field
The UI Agent Builder passes `templateId` when creating from a template. The current server schema may not support this field. Gracefully ignore if not supported (the UI will fall back to passing explicit files).

---

## 9. Summary: Method Count by Feature Area

| Feature Area | Methods | Scope Required |
|-------------|---------|---------------|
| Connection/Health | `connect`, `health`, `status`, `system-presence`, `last-heartbeat` | admin/read |
| Agents | `agents.list`, `agents.create`, `agents.update`, `agents.delete`, `agent.identity.get`, `agents.files.*` | read/admin |
| Chat | `chat.send`, `chat.history`, `chat.abort`, `chat.inject` | read/write/admin |
| Sessions | `sessions.list`, `sessions.preview`, `sessions.patch`, `sessions.reset`, `sessions.delete`, `sessions.compact`, `sessions.resolve`, `sessions.usage`, `sessions.usage.*` | read/admin |
| Config | `config.get`, `config.set`, `config.apply`, `config.schema`, `config.patch` | read/admin |
| Cron | `cron.list`, `cron.status`, `cron.add`, `cron.update`, `cron.remove`, `cron.run`, `cron.runs` | read/admin |
| Skills | `skills.status`, `skills.install`, `skills.update` | read/admin |
| Nodes | `node.list`, `node.describe`, `node.invoke` | read/write |
| Channels | `channels.status`, `channels.logout`, `web.login.start`, `web.login.wait` | read/admin |
| Devices | `device.pair.*`, `device.token.*` | pairing |
| Exec Approvals | `exec.approval.*`, `exec.approvals.*` | approvals/admin |
| Models/Usage | `models.list`, `usage.cost`, `usage.status` | read |
| Logs | `logs.tail` | read |
| TTS | `tts.*` | read/write |
| Wizard | `wizard.start`, `wizard.next`, `wizard.cancel`, `wizard.status` | admin |
| Update | `update.run` | admin |
| Misc | `send`, `push.test`, `set-heartbeats`, `system-event` | write/admin |

**Total: ~60 methods**

Most are already implemented in the existing gateway server. The key NEW work for Tim is:
1. ✅ Confirm `usage.status` method exists and has the correct shape
2. 🆕 Add `"add-provider"` mode to `wizard.start`
3. 🆕 Add `"qr"` and `"device_code"` wizard step types
4. ✅ Confirm `config.patch` is implemented
5. 🤝 Align with Luis's team on the `useGateway.ts` protocol fix (critical for any end-to-end testing)

---

*Generated from full source analysis of `ui/src/ui/controllers/`, `ui/src/ui/gateway.ts`, `apps/web-next/src/hooks/`, `apps/web-next/src/types.ts`, `OAUTH_INTEGRATION_SPEC.md`, `UI_SPEC.md`, and `src/gateway/` server implementation.*

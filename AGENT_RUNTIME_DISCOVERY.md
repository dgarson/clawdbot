# Agent Runtime Abstraction Discovery

This document maps the current agent execution architecture to support multiple agent runtimes (Pi-Embedded and Claude Agent SDK) through a minimal wrapper/adapter layer.

## Executive Summary

The current system is built around the Pi-Embedded agent runtime from `@mariozechner/pi-coding-agent`. To support Claude Agent SDK as an alternative runtime without invasive cross-cutting changes, we propose an **Adapter Pattern** that:

1. Normalizes event emissions to a common `AgentEvent` schema
2. Provides a unified callback interface (`AgentRuntimeCallbacks`)
3. Wraps runtime-specific sessions with a common `AgentSession` interface
4. Preserves the existing call hierarchy (no new "AgentRuntime" class hierarchy)

---

## Current Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           ENTRY POINTS                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  CLI                         │  Gateway                │  Auto-Reply    │
│  src/commands/agent.ts       │  src/gateway/           │  src/auto-     │
│  agentCommand()              │  server-methods/        │  reply/        │
│                              │  chat.ts, agent.ts      │  dispatch.ts   │
└──────────────┬───────────────┴───────────┬─────────────┴───────┬────────┘
               │                           │                     │
               └───────────────┬───────────┘                     │
                               │                                 │
                               ▼                                 │
┌──────────────────────────────────────────────────────────────────────────┐
│                     AGENT RUNNER EXECUTION                               │
│                     src/auto-reply/reply/agent-runner-execution.ts       │
│                     runAgentTurnWithFallback()                           │
│                                                                          │
│  Responsibilities:                                                       │
│  • Wraps callbacks with typing signals                                   │
│  • Creates BlockReplyPipeline for streaming                              │
│  • Handles model fallback                                                │
│  • Invokes pi-embedded runner                                            │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     PI-EMBEDDED RUNNER                                   │
│                     src/agents/pi-embedded-runner/run.ts                 │
│                     runEmbeddedPiAgent()                                 │
│                                                                          │
│  Responsibilities:                                                       │
│  • Session management (create/resume)                                    │
│  • Model resolution & auth profile                                       │
│  • Context window validation                                             │
│  • Attempt execution with retry                                          │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     PI-EMBEDDED ATTEMPT                                  │
│                     src/agents/pi-embedded-runner/run/attempt.ts         │
│                     runEmbeddedAttempt()                                 │
│                                                                          │
│  Responsibilities:                                                       │
│  • Workspace setup                                                       │
│  • Tool creation (createOpenClawCodingTools)                             │
│  • System prompt building                                                │
│  • Session subscription (event handling)                                 │
│  • Prompt execution via activeSession.prompt()                           │
└───────────────────────────────────┬──────────────────────────────────────┘
                                    │
                                    ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                     PI-EMBEDDED SUBSCRIPTION                             │
│                     src/agents/pi-embedded-subscribe.ts                  │
│                     subscribeEmbeddedPiSession()                         │
│                                                                          │
│  Responsibilities:                                                       │
│  • Subscribe to pi-agent-core session events                             │
│  • Route events to handlers (lifecycle, tools, messages)                 │
│  • Invoke callbacks (onBlockReply, onToolResult, etc.)                   │
│  • Emit global AgentEvents                                               │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Event Emission Map

### Global Agent Event System

**Source:** `src/infra/agent-events.ts`

```typescript
type AgentEventStream = "lifecycle" | "tool" | "assistant" | "error" | "compaction" | (string & {});

type AgentEventPayload = {
  runId: string;           // Unique run identifier
  seq: number;             // Monotonic sequence per runId
  stream: AgentEventStream;
  ts: number;              // Event timestamp
  data: Record<string, unknown>;
  sessionKey?: string;     // Injected from context
};
```

### Event Streams & Data Schemas

| Stream | Phase/Event | Data Fields | Source Handler |
|--------|-------------|-------------|----------------|
| `lifecycle` | `start` | `{ phase: "start", startedAt }` | `handleAgentStart` |
| `lifecycle` | `end` | `{ phase: "end", endedAt, aborted? }` | `handleAgentEnd` |
| `lifecycle` | `error` | `{ phase: "error", error }` | CLI/Gateway fallback |
| `tool` | `start` | `{ phase: "start", name, toolCallId, args }` | `handleToolExecutionStart` |
| `tool` | `update` | `{ phase: "update", name, toolCallId, partialResult }` | `handleToolExecutionUpdate` |
| `tool` | `result` | `{ phase: "result", name, toolCallId, meta?, isError, result }` | `handleToolExecutionEnd` |
| `assistant` | (delta) | `{ text, delta?, mediaUrls? }` | `handleMessageUpdate` |
| `compaction` | `start` | `{ phase: "start" }` | `handleAutoCompactionStart` |
| `compaction` | `end` | `{ phase: "end", willRetry }` | `handleAutoCompactionEnd` |

### Pi-Agent-Core Event Types (Upstream)

These events originate from `@mariozechner/pi-agent-core` and are subscribed via `session.subscribe()`:

```typescript
// From pi-agent-core AgentEvent union
type AgentEvent =
  | { type: "agent_start" }
  | { type: "agent_end" }
  | { type: "message_start"; message: AgentMessage }
  | { type: "message_update"; assistantMessageEvent: TextDeltaEvent }
  | { type: "message_end"; message: AgentMessage }
  | { type: "tool_execution_start"; toolName: string; toolCallId: string; args: unknown }
  | { type: "tool_execution_update"; toolName: string; toolCallId: string; partialResult?: unknown }
  | { type: "tool_execution_end"; toolName: string; toolCallId: string; isError: boolean; result?: unknown }
  | { type: "auto_compaction_start" }
  | { type: "auto_compaction_end"; willRetry: boolean };
```

---

## Callback Propagation Flow

### Callback Interface Definitions

**Entry-level callbacks** (`src/auto-reply/types.ts`):

```typescript
type GetReplyOptions = {
  runId?: string;
  abortSignal?: AbortSignal;

  // Lifecycle callbacks
  onAgentRunStart?: (runId: string) => void;
  onReplyStart?: () => Promise<void> | void;
  onModelSelected?: (ctx: ModelSelectedContext) => void;

  // Streaming callbacks
  onPartialReply?: (payload: ReplyPayload) => Promise<void> | void;
  onReasoningStream?: (payload: ReplyPayload) => Promise<void> | void;
  onBlockReply?: (payload: ReplyPayload, context?: BlockReplyContext) => Promise<void> | void;
  onBlockReplyFlush?: () => Promise<void> | void;
  onToolResult?: (payload: ReplyPayload) => Promise<void> | void;

  // Typing/presence
  onTypingController?: (typing: TypingController) => void;

  // State tracking
  hasRepliedRef?: { value: boolean };
};
```

**Pi-embedded subscription callbacks** (`src/agents/pi-embedded-subscribe.types.ts`):

```typescript
type SubscribeEmbeddedPiSessionParams = {
  session: AgentSession;
  runId: string;

  // Streaming callbacks
  onPartialReply?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onReasoningStream?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onBlockReply?: (payload: {
    text?: string;
    mediaUrls?: string[];
    audioAsVoice?: boolean;
    replyToId?: string;
    replyToTag?: boolean;
    replyToCurrent?: boolean;
  }) => void | Promise<void>;
  onBlockReplyFlush?: () => void | Promise<void>;
  onToolResult?: (payload: { text?: string; mediaUrls?: string[] }) => void | Promise<void>;
  onAssistantMessageStart?: () => void | Promise<void>;

  // Generic event callback
  onAgentEvent?: (evt: { stream: string; data: Record<string, unknown> }) => void | Promise<void>;

  // Conditional emission
  shouldEmitToolResult?: () => boolean;
  shouldEmitToolOutput?: () => boolean;

  // Configuration
  blockReplyBreak?: "text_end" | "message_end";
  blockReplyChunking?: BlockReplyChunking;
  enforceFinalTag?: boolean;
  verboseLevel?: VerboseLevel;
  reasoningMode?: ReasoningLevel;
  toolResultFormat?: ToolResultFormat;
};
```

### Callback Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│ ENTRY POINT (CLI/Gateway/Auto-Reply)                                    │
│                                                                         │
│ Callbacks defined:                                                      │
│ • onAgentRunStart, onReplyStart, onModelSelected                        │
│ • onPartialReply, onBlockReply, onBlockReplyFlush                       │
│ • onReasoningStream, onToolResult                                       │
│ • onTypingController                                                    │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ AGENT RUNNER EXECUTION                                                  │
│ src/auto-reply/reply/agent-runner-execution.ts                          │
│                                                                         │
│ Wraps callbacks:                                                        │
│ • onPartialReply → adds typing signal start/stop                        │
│ • onBlockReply → adds context (replyToId, replyToTag)                   │
│ • Creates BlockReplyPipeline for markdown-aware chunking                │
│                                                                         │
│ Passes to runEmbeddedPiAgent():                                         │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ onPartialReply: (payload) => { typing.start(); opts.onPartial?.() } │ │
│ │ onAssistantMessageStart: () => { typingStarted = true }             │ │
│ │ onReasoningStream: (payload) => opts.onReasoningStream?.(payload)   │ │
│ │ onBlockReply: (payload) => blockReplyPipeline.onBlockReply(payload) │ │
│ │ onBlockReplyFlush: () => blockReplyPipeline.flush()                 │ │
│ │ onToolResult: (payload) => opts.onToolResult?.(payload)             │ │
│ │ onAgentEvent: (evt) => trackLifecyclePhase(evt)                     │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PI-EMBEDDED RUNNER                                                      │
│ src/agents/pi-embedded-runner/run.ts                                    │
│                                                                         │
│ Passes callbacks through to runEmbeddedAttempt() unchanged              │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PI-EMBEDDED ATTEMPT                                                     │
│ src/agents/pi-embedded-runner/run/attempt.ts                            │
│                                                                         │
│ Passes callbacks to subscribeEmbeddedPiSession():                       │
│ ┌─────────────────────────────────────────────────────────────────────┐ │
│ │ session: activeSession                                               │ │
│ │ runId: params.runId                                                  │ │
│ │ onPartialReply: params.onPartialReply                                │ │
│ │ onAssistantMessageStart: params.onAssistantMessageStart              │ │
│ │ onReasoningStream: params.onReasoningStream                          │ │
│ │ onBlockReply: params.onBlockReply                                    │ │
│ │ onBlockReplyFlush: params.onBlockReplyFlush                          │ │
│ │ onToolResult: params.onToolResult                                    │ │
│ │ onAgentEvent: params.onAgentEvent                                    │ │
│ │ shouldEmitToolResult: params.shouldEmitToolResult                    │ │
│ │ shouldEmitToolOutput: params.shouldEmitToolOutput                    │ │
│ │ blockReplyBreak: params.blockReplyBreak                              │ │
│ │ blockReplyChunking: params.blockReplyChunking                        │ │
│ │ verboseLevel: params.verboseLevel                                    │ │
│ │ reasoningMode: params.reasoningLevel                                 │ │
│ └─────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ PI-EMBEDDED SUBSCRIPTION                                                │
│ src/agents/pi-embedded-subscribe.ts                                     │
│                                                                         │
│ Creates event handler that invokes callbacks:                           │
│                                                                         │
│ Pi-Agent Event          →  Callback Invoked                             │
│ ─────────────────────────────────────────────────────────────────────── │
│ message_start           →  onAssistantMessageStart()                    │
│ message_update (text)   →  onPartialReply({ text, mediaUrls })          │
│                         →  emitAgentEvent({ stream: "assistant" })      │
│ message_end             →  blockChunker.drain() → onBlockReply()        │
│ tool_execution_start    →  onBlockReplyFlush()                          │
│                         →  emitAgentEvent({ stream: "tool" })           │
│                         →  onAgentEvent({ stream: "tool" })             │
│ tool_execution_update   →  emitAgentEvent({ stream: "tool" })           │
│ tool_execution_end      →  onToolResult({ text, mediaUrls })            │
│                         →  emitAgentEvent({ stream: "tool" })           │
│ agent_start             →  emitAgentEvent({ stream: "lifecycle" })      │
│                         →  onAgentEvent({ stream: "lifecycle" })        │
│ agent_end               →  blockChunker.drain() → onBlockReply()        │
│                         →  emitAgentEvent({ stream: "lifecycle" })      │
│ auto_compaction_start   →  emitAgentEvent({ stream: "compaction" })     │
│ auto_compaction_end     →  emitAgentEvent({ stream: "compaction" })     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Generalizable Properties

These properties flow into the Pi-Embedded agent and should be abstracted for any agent runtime:

### Core Execution Context

| Property | Type | Description | Generalizable |
|----------|------|-------------|---------------|
| `sessionId` | `string` | Unique session identifier | Yes |
| `sessionKey` | `string?` | Session key for routing | Yes |
| `runId` | `string` | Unique run identifier | Yes |
| `workspaceDir` | `string` | Working directory for tools | Yes |
| `agentDir` | `string?` | Agent-specific directory | Yes |
| `prompt` | `string` | User message/prompt | Yes |
| `images` | `ImageContent[]?` | Attached images | Yes |
| `abortSignal` | `AbortSignal?` | Cancellation signal | Yes |
| `timeoutMs` | `number` | Execution timeout | Yes |

### Model Configuration

| Property | Type | Description | Generalizable |
|----------|------|-------------|---------------|
| `provider` | `string?` | Model provider (anthropic, openai, etc.) | Yes |
| `model` | `string?` | Model identifier | Yes |
| `authProfileId` | `string?` | Auth profile for model | Yes |
| `thinkLevel` | `"off" \| "on" \| "extended"` | Thinking/reasoning mode | Yes (maps to different APIs) |
| `reasoningLevel` | `"off" \| "on" \| "stream"` | Reasoning output mode | Yes |

### Tool Configuration

| Property | Type | Description | Generalizable |
|----------|------|-------------|---------------|
| `disableTools` | `boolean?` | Disable all tools | Yes |
| `clientTools` | `ClientToolDefinition[]?` | External tools | Yes |
| `execOverrides` | `ExecToolDefaults?` | Bash execution settings | Yes |
| `bashElevated` | `ExecElevatedDefaults?` | Elevated execution settings | Yes |

### Messaging Context

| Property | Type | Description | Generalizable |
|----------|------|-------------|---------------|
| `messageChannel` | `string?` | Channel for messaging tools | Yes |
| `messageProvider` | `string?` | Provider for messaging tools | Yes |
| `agentAccountId` | `string?` | Agent's account ID | Yes |
| `messageTo` | `string?` | Default recipient | Yes |
| `messageThreadId` | `string \| number?` | Thread context | Yes |
| `groupId` | `string?` | Group context | Yes |

### Streaming Configuration

| Property | Type | Description | Generalizable |
|----------|------|-------------|---------------|
| `verboseLevel` | `VerboseLevel?` | Verbosity for tool output | Yes |
| `toolResultFormat` | `ToolResultFormat?` | Format for tool results | Yes |
| `blockReplyBreak` | `"text_end" \| "message_end"` | Block reply break point | Yes |
| `blockReplyChunking` | `BlockReplyChunking?` | Chunking configuration | Yes |
| `enforceFinalTag` | `boolean?` | Enforce final block tag | Yes |

### Callbacks (All Generalizable)

| Callback | Signature | Purpose |
|----------|-----------|---------|
| `onPartialReply` | `(payload: ReplyPayload) => void` | Streaming text delta |
| `onBlockReply` | `(payload: ReplyPayload, ctx?) => void` | Complete reply block |
| `onBlockReplyFlush` | `() => void` | Flush pending block |
| `onReasoningStream` | `(payload: ReplyPayload) => void` | Reasoning text delta |
| `onToolResult` | `(payload: ReplyPayload) => void` | Tool execution result |
| `onAssistantMessageStart` | `() => void` | Assistant message started |
| `onAgentEvent` | `(evt: AgentEvent) => void` | Generic agent event |
| `shouldEmitToolResult` | `() => boolean` | Control tool result emission |
| `shouldEmitToolOutput` | `() => boolean` | Control tool output emission |

---

## Tool System Abstraction

### Current Tool Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ createOpenClawCodingTools(options)                                      │
│ src/agents/pi-tools.ts                                                  │
│                                                                         │
│ Creates AnyAgentTool[] with:                                            │
│ • Coding tools (read, write, edit) from pi-coding-agent                 │
│ • Exec/Process tools (bash execution)                                   │
│ • Channel tools (Discord, Slack, etc.)                                  │
│ • OpenClaw tools (message, memory, browser)                             │
│ • Applies policy filtering (profile, provider, sandbox, etc.)           │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ toToolDefinitions(tools)                                                │
│ src/agents/pi-tool-definition-adapter.ts                                │
│                                                                         │
│ Converts AnyAgentTool[] → ToolDefinition[] for pi-coding-agent          │
│ Adapts execute() signature differences                                  │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ createAgentSession({ customTools: [...] })                              │
│ from @mariozechner/pi-coding-agent                                      │
│                                                                         │
│ Tools passed to agent session for execution during prompting            │
└─────────────────────────────────────────────────────────────────────────┘
```

### Tool Type Comparison

| Interface | Source | Key Properties |
|-----------|--------|----------------|
| `AnyAgentTool` | `@mariozechner/pi-agent-core` | `name`, `label`, `description`, `parameters`, `execute(toolCallId, params, signal, onUpdate)` |
| `ToolDefinition` | `@mariozechner/pi-coding-agent` | `name`, `label`, `description`, `parameters`, `execute(toolCallId, params, onUpdate, ctx, signal)` |
| Claude SDK Tool | `@anthropic-ai/sdk` | `name`, `description`, `input_schema`, (execution via callback) |

### Generalized Tool Interface

```typescript
interface AgentTool {
  name: string;
  description: string;
  parameters: JSONSchema;  // TypeBox or JSON Schema

  execute(ctx: ToolExecutionContext): Promise<ToolResult>;
}

interface ToolExecutionContext {
  toolCallId: string;
  params: Record<string, unknown>;
  signal: AbortSignal;
  onUpdate?: (partial: unknown) => void;
}

interface ToolResult {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mediaType: string }>;
  isError?: boolean;
}
```

---

## Claude Agent SDK Comparison

### Event Model Differences

| Pi-Agent Event | Claude SDK Equivalent |
|----------------|----------------------|
| `agent_start` | Run creation / first message |
| `message_start` | `content_block_start` with `type: "text"` |
| `message_update` | `content_block_delta` with `type: "text_delta"` |
| `message_end` | `content_block_stop` + `message_stop` |
| `tool_execution_start` | `content_block_start` with `type: "tool_use"` |
| `tool_execution_end` | Tool result provided in next turn |
| `agent_end` | `message_stop` with `stop_reason` |

### Session Interface Differences

| Pi-Agent Session | Claude SDK Equivalent |
|------------------|----------------------|
| `session.prompt(text)` | `client.messages.create({ messages: [...] })` |
| `session.subscribe(handler)` | Stream event handlers (`on("text")`, etc.) |
| `session.steer(text)` | Add message and re-prompt |
| `session.abort()` | `controller.abort()` via AbortController |
| `session.isStreaming` | Check stream state |
| `session.messages` | Maintain conversation history externally |

### Tool Execution Differences

| Aspect | Pi-Agent | Claude SDK |
|--------|----------|------------|
| Tool definition | Passed to session creation | Passed to each message request |
| Tool execution | Automatic (agent calls, SDK executes) | Manual (receive tool_use, execute, provide result) |
| Streaming updates | `onUpdate` callback during execution | N/A (tools execute between messages) |
| Result format | `AgentToolResult` with content array | `tool_result` content block |

---

## Proposed Adapter Pattern

### Design Goals

1. **Minimal Invasion**: No new class hierarchies or major refactors
2. **Parity**: Same end-to-end behavior for both runtimes
3. **Transparency**: Existing code paths remain unchanged for Pi runtime
4. **Extensibility**: Easy to add more runtimes in the future

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│ EXISTING CALL CHAIN (unchanged)                                         │
│                                                                         │
│ CLI/Gateway → agent-runner-execution → pi-embedded-runner               │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RUNTIME SELECTOR (new, minimal)                                         │
│ src/agents/runtime-selector.ts                                          │
│                                                                         │
│ function selectAgentRuntime(params: RunAgentParams): AgentRuntimeType   │
│                                                                         │
│ Based on:                                                               │
│ • params.runtime (explicit selection)                                   │
│ • params.model.provider (implicit: claude models → Claude SDK)          │
│ • config.agent.preferredRuntime                                         │
└───────────────────────────────────────┬─────────────────────────────────┘
                                        │
              ┌─────────────────────────┴─────────────────────────┐
              │                                                   │
              ▼                                                   ▼
┌─────────────────────────────────┐         ┌─────────────────────────────────┐
│ PI-EMBEDDED RUNTIME             │         │ CLAUDE SDK RUNTIME              │
│ (existing code, unchanged)      │         │ (new adapter)                   │
│                                 │         │                                 │
│ runEmbeddedPiAgent()            │         │ runClaudeAgentSdkAgent()        │
│ subscribeEmbeddedPiSession()    │         │ subscribeClaudeAgentSession()   │
└─────────────────────────────────┘         └─────────────────────────────────┘
              │                                                   │
              │                                                   │
              └─────────────────────────┬─────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ UNIFIED CALLBACKS & EVENTS                                              │
│ (same AgentEventPayload, same callback signatures)                      │
│                                                                         │
│ • emitAgentEvent({ stream, data, runId, seq })                          │
│ • onPartialReply, onBlockReply, onToolResult, etc.                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Adapter Components

#### 1. Runtime Type Definition

```typescript
// src/agents/runtime-types.ts

type AgentRuntimeType = "pi-embedded" | "claude-sdk";

interface AgentRuntimeParams {
  // Generalizable properties (see above)
  sessionId: string;
  runId: string;
  prompt: string;
  workspaceDir: string;
  model: ModelSelection;
  tools: AgentTool[];
  callbacks: AgentRuntimeCallbacks;
  abortSignal?: AbortSignal;
  // ... etc
}

interface AgentRuntimeCallbacks {
  onPartialReply?: (payload: ReplyPayload) => void | Promise<void>;
  onBlockReply?: (payload: ReplyPayload) => void | Promise<void>;
  onBlockReplyFlush?: () => void | Promise<void>;
  onReasoningStream?: (payload: ReplyPayload) => void | Promise<void>;
  onToolResult?: (payload: ReplyPayload) => void | Promise<void>;
  onAssistantMessageStart?: () => void | Promise<void>;
  onAgentEvent?: (evt: AgentEvent) => void | Promise<void>;
}

interface AgentRuntimeResult {
  payloads?: ReplyPayload[];
  meta: AgentRunMeta;
  didSendViaMessagingTool?: boolean;
  messagingToolSentTexts?: string[];
}
```

#### 2. Claude SDK Adapter

```typescript
// src/agents/claude-sdk-adapter/run.ts

export async function runClaudeAgentSdkAgent(
  params: AgentRuntimeParams
): Promise<AgentRuntimeResult> {
  // 1. Convert tools to Claude SDK format
  const claudeTools = toClaudeSdkTools(params.tools);

  // 2. Create message with tools
  const client = new Anthropic({ apiKey: params.model.apiKey });

  // 3. Agentic loop
  let messages: MessageParam[] = [{ role: "user", content: params.prompt }];

  while (true) {
    // Emit lifecycle start
    emitAgentEvent({ runId: params.runId, stream: "lifecycle", data: { phase: "start" } });

    // Stream response
    const stream = client.messages.stream({
      model: params.model.id,
      messages,
      tools: claudeTools,
      // ... other params
    });

    // Handle streaming events
    for await (const event of stream) {
      switch (event.type) {
        case "content_block_delta":
          if (event.delta.type === "text_delta") {
            params.callbacks.onPartialReply?.({ text: event.delta.text });
            emitAgentEvent({
              runId: params.runId,
              stream: "assistant",
              data: { delta: event.delta.text }
            });
          }
          break;
        // ... handle tool_use, etc.
      }
    }

    // Check for tool calls
    const toolCalls = extractToolCalls(stream.finalMessage);
    if (toolCalls.length === 0) break;

    // Execute tools
    for (const call of toolCalls) {
      emitAgentEvent({
        runId: params.runId,
        stream: "tool",
        data: { phase: "start", name: call.name, toolCallId: call.id, args: call.input }
      });

      const result = await executeToolCall(params.tools, call);

      emitAgentEvent({
        runId: params.runId,
        stream: "tool",
        data: { phase: "result", name: call.name, toolCallId: call.id, result }
      });
    }

    // Add tool results to messages and continue loop
    messages.push(...buildToolResultMessages(toolCalls, results));
  }

  // Emit lifecycle end
  emitAgentEvent({ runId: params.runId, stream: "lifecycle", data: { phase: "end" } });

  return buildResult(stream.finalMessage);
}
```

#### 3. Tool Adapter

```typescript
// src/agents/claude-sdk-adapter/tools.ts

export function toClaudeSdkTools(tools: AgentTool[]): Anthropic.Tool[] {
  return tools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters as Anthropic.Tool.InputSchema,
  }));
}

export async function executeClaudeSdkToolCall(
  tools: AgentTool[],
  call: ToolUseBlock,
  signal: AbortSignal
): Promise<ToolResult> {
  const tool = tools.find(t => t.name === call.name);
  if (!tool) {
    return { content: [{ type: "text", text: `Unknown tool: ${call.name}` }], isError: true };
  }

  return tool.execute({
    toolCallId: call.id,
    params: call.input as Record<string, unknown>,
    signal,
  });
}
```

---

## Integration Points Summary

### Files to Modify (Minimal Changes)

| File | Change Required |
|------|-----------------|
| `src/agents/pi-embedded-runner/run.ts` | Add runtime selection before `runEmbeddedAttempt` |
| `src/auto-reply/reply/agent-runner-execution.ts` | Pass runtime hint if explicitly requested |

### New Files Required

| File | Purpose |
|------|---------|
| `src/agents/runtime-types.ts` | Shared type definitions |
| `src/agents/runtime-selector.ts` | Runtime selection logic |
| `src/agents/claude-sdk-adapter/run.ts` | Claude SDK execution adapter |
| `src/agents/claude-sdk-adapter/tools.ts` | Tool conversion |
| `src/agents/claude-sdk-adapter/events.ts` | Event normalization |
| `src/agents/claude-sdk-adapter/session.ts` | Session management |

### Existing Files (Unchanged)

| File | Reason |
|------|--------|
| `src/agents/pi-embedded-subscribe.ts` | Pi-specific, no changes needed |
| `src/agents/pi-tools.ts` | Tool creation stays the same |
| `src/infra/agent-events.ts` | Event system stays the same |
| `src/gateway/server-chat.ts` | Gateway stays the same |
| All callback interfaces | Remain compatible |

---

## Migration Path

### Phase 1: Foundation
1. Create `src/agents/runtime-types.ts` with shared interfaces
2. Create `src/agents/runtime-selector.ts` with selection logic
3. Add `runtime` parameter to `RunEmbeddedPiAgentParams` (optional, defaults to "pi-embedded")

### Phase 2: Claude SDK Adapter
1. Create `src/agents/claude-sdk-adapter/` directory structure
2. Implement tool conversion (`tools.ts`)
3. Implement event normalization (`events.ts`)
4. Implement main run function (`run.ts`)
5. Add streaming support with callback invocation

### Phase 3: Integration
1. Wire runtime selector into `runEmbeddedPiAgent()` (or create parallel `runAgent()`)
2. Add config option `agent.preferredRuntime`
3. Add CLI flag `--runtime` for explicit selection
4. Test parity between runtimes

### Phase 4: Refinement
1. Handle edge cases (compaction, steering, abort)
2. Optimize for provider-specific features
3. Add telemetry/metrics per runtime

---

## Key Files Reference

| Category | Files |
|----------|-------|
| **Entry Points** | `src/commands/agent.ts`, `src/gateway/server-methods/chat.ts`, `src/auto-reply/dispatch.ts` |
| **Agent Runner** | `src/auto-reply/reply/agent-runner-execution.ts`, `src/auto-reply/reply/agent-runner.ts` |
| **Pi-Embedded** | `src/agents/pi-embedded-runner/run.ts`, `src/agents/pi-embedded-runner/run/attempt.ts` |
| **Subscription** | `src/agents/pi-embedded-subscribe.ts`, `src/agents/pi-embedded-subscribe.handlers.*.ts` |
| **Events** | `src/infra/agent-events.ts` |
| **Tools** | `src/agents/pi-tools.ts`, `src/agents/pi-tool-definition-adapter.ts` |
| **Types** | `src/agents/pi-embedded-runner/run/params.ts`, `src/agents/pi-embedded-subscribe.types.ts` |
| **Gateway** | `src/gateway/server-chat.ts`, `src/gateway/server-broadcast.ts` |

---

## Conclusion

The proposed adapter pattern minimizes changes to the existing codebase while enabling support for Claude Agent SDK. Key principles:

1. **Same events**: Both runtimes emit the same `AgentEventPayload` schema
2. **Same callbacks**: Both runtimes invoke the same callback signatures
3. **Same result format**: Both runtimes return `AgentRuntimeResult`
4. **Isolated adapters**: Each runtime has its own adapter directory
5. **Single entry point**: Selection happens once, then delegates to the appropriate adapter

This approach preserves the existing Pi-Embedded code path while adding Claude SDK support through a parallel adapter, avoiding the complexity of a shared base class or cross-cutting abstraction layer.

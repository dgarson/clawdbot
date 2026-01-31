# Agent Runtime Adapter: Single Entry Point Strategy

This document outlines the implementation strategy for supporting multiple agent runtimes (Pi-Embedded and Claude Agent SDK) through a single diverter point in `src/agents/pi-embedded-runner/run.ts`.

## Core Insight

The entire agent execution system funnels through one function:

```
runEmbeddedPiAgent(params: RunEmbeddedPiAgentParams): Promise<EmbeddedPiRunResult>
```

All callbacks, configuration, and context flow INTO this function as parameters. All streaming events and results flow OUT via callback invocations and the return value. This makes it the **only conflict point** for adding a second runtime.

---

## Why This Works: The Dependency Injection Pattern

### Callbacks Are Passed In, Not Hardcoded

The key architectural insight is that callbacks are **dependency-injected** via parameters:

```typescript
// Callers pass callbacks as data
await runEmbeddedPiAgent({
  prompt: "Hello",
  onPartialReply: (payload) => sendToUser(payload),  // Passed in
  onToolResult: (payload) => logTool(payload),       // Passed in
  onAgentEvent: (evt) => trackEvent(evt),            // Passed in
});
```

The adapter receives these callbacks and invokes them - it doesn't need to know where they came from or what they do.

### Upstream Event Emissions Are Wrapper Events

You might notice `emitAgentEvent()` is called in files **upstream** of `run.ts`:

| File | Event | When Emitted |
|------|-------|--------------|
| `agent-runner-execution.ts` | `lifecycle.start` | **Before** calling `runEmbeddedPiAgent` |
| `agent-runner-execution.ts` | `lifecycle.end` | **After** `runEmbeddedPiAgent` returns |
| `agent.ts` (CLI) | `lifecycle.end` | Fallback if agent didn't emit |

These are **bookkeeping wrappers**, not agent execution events:

```
caller: emitAgentEvent({ phase: "start" })     ← wrapper (before)
caller: await runEmbeddedPiAgent(params)       ← THE CALL
          └── adapter emits tool/assistant events ← execution (inside)
caller: emitAgentEvent({ phase: "end" })       ← wrapper (after)
```

The wrapper events happen **around** the call, not **inside** it. They work identically regardless of which runtime executes inside.

### The Diverter Receives Everything It Needs

When the diverter routes to the Claude SDK adapter:

1. **All callbacks are in `params`** - just invoke them at equivalent points
2. **All config is in `params`** - model, tools, workspace, etc.
3. **Result shape is defined** - return `EmbeddedPiRunResult`
4. **Event system is global** - just call `emitAgentEvent()`

The adapter is fully self-contained. No upstream changes needed.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CALLERS (unchanged)                           │
├─────────────────────────────────────────────────────────────────────────┤
│  agent-runner-execution.ts  │  agent.ts (CLI)  │  followup-runner.ts   │
│  agent-runner-memory.ts     │  isolated/run.ts │  extensions/*         │
└──────────────────────────────────────┬──────────────────────────────────┘
                                       │
                                       │ RunEmbeddedPiAgentParams
                                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    runEmbeddedPiAgent() - THE DIVERTER                  │
│                    src/agents/pi-embedded-runner/run.ts:72              │
│                                                                         │
│  if (params.runtime === "claude-sdk") {                                 │
│    return runClaudeSdkAgent(params);   ──────────────────────┐          │
│  }                                                           │          │
│  // existing Pi code continues...                            │          │
└───────────────────────────────────────┬──────────────────────┼──────────┘
                                        │                      │
                    ┌───────────────────┘                      │
                    ▼                                          ▼
┌────────────────────────────────────┐    ┌───────────────────────────────┐
│      PI-EMBEDDED (existing)        │    │     CLAUDE-SDK (new)          │
│                                    │    │                               │
│  runEmbeddedAttempt()              │    │  runClaudeSdkAgent()          │
│  subscribeEmbeddedPiSession()      │    │  src/agents/claude-sdk-       │
│  pi-embedded-subscribe.handlers.*  │    │  adapter/run.ts               │
└────────────────────────────────────┘    └───────────────────────────────┘
                    │                                          │
                    └───────────────────┬──────────────────────┘
                                        │
                                        │ EmbeddedPiRunResult
                                        ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CALLERS (unchanged)                           │
│                    Receive same result shape from either path           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## The Contract: RunEmbeddedPiAgentParams

This is the unified interface that both runtimes must accept. The Claude SDK adapter receives the exact same params object.

### Core Execution Context

```typescript
// src/agents/pi-embedded-runner/run/params.ts

interface RunEmbeddedPiAgentParams {
  // === Identity ===
  sessionId: string;                    // Unique session identifier
  sessionKey?: string;                  // Session routing key
  runId?: string;                       // Unique run identifier (generated if not provided)

  // === Runtime Selection (NEW) ===
  runtime?: "pi-embedded" | "claude-sdk";  // Explicit runtime selection

  // === Prompt & Input ===
  prompt: string;                       // User message
  images?: ImageInput[];                // Attached images

  // === Workspace ===
  workspaceDir: string;                 // Working directory for tools
  agentDir?: string;                    // Agent-specific config directory

  // === Model Configuration ===
  provider?: string;                    // Model provider (anthropic, openai, google, etc.)
  model?: string;                       // Model identifier
  authProfileId?: string;               // Auth profile for API access
  thinkLevel?: ThinkLevel;              // "off" | "on" | "extended"
  reasoningLevel?: ReasoningLevel;      // "off" | "on" | "stream"

  // === Tool Configuration ===
  disableTools?: boolean;               // Disable all tools
  clientTools?: ClientToolDefinition[]; // External/hosted tools
  execOverrides?: ExecToolDefaults;     // Bash execution settings
  bashElevated?: ExecElevatedDefaults;  // Elevated execution settings

  // === Messaging Context ===
  messageChannel?: string;              // Channel for messaging tools
  messageProvider?: string;             // Provider for messaging tools
  agentAccountId?: string;              // Agent's account ID
  messageTo?: string;                   // Default recipient
  messageThreadId?: string | number;    // Thread context
  groupId?: string | null;              // Group context

  // === Streaming Configuration ===
  verboseLevel?: VerboseLevel;          // Tool output verbosity
  toolResultFormat?: ToolResultFormat;  // "markdown" | "plain"
  blockReplyBreak?: "text_end" | "message_end";
  blockReplyChunking?: BlockReplyChunking;

  // === Callbacks (THE KEY INTERFACE) ===
  onPartialReply?: (payload: ReplyPayload) => void | Promise<void>;
  onBlockReply?: (payload: ReplyPayload) => void | Promise<void>;
  onBlockReplyFlush?: () => void | Promise<void>;
  onReasoningStream?: (payload: ReplyPayload) => void | Promise<void>;
  onToolResult?: (payload: ReplyPayload) => void | Promise<void>;
  onAssistantMessageStart?: () => void | Promise<void>;
  onAgentEvent?: (evt: AgentEvent) => void | Promise<void>;
  shouldEmitToolResult?: () => boolean;
  shouldEmitToolOutput?: () => boolean;

  // === Control ===
  abortSignal?: AbortSignal;            // Cancellation signal
  timeoutMs?: number;                   // Execution timeout
  config?: OpenClawConfig;              // Full config object
}
```

### Callback Payload Types

```typescript
// src/auto-reply/types.ts

interface ReplyPayload {
  text?: string;
  mediaUrls?: string[];
  audioAsVoice?: boolean;
  replyToId?: string;
  replyToTag?: boolean;
  replyToCurrent?: boolean;
}

interface AgentEvent {
  stream: "lifecycle" | "tool" | "assistant" | "compaction" | string;
  data: Record<string, unknown>;
}
```

---

## The Contract: EmbeddedPiRunResult

Both runtimes must return this shape:

```typescript
// src/agents/pi-embedded-runner/types.ts

interface EmbeddedPiRunResult {
  // === Response Content ===
  payloads?: ReplyPayload[];            // Final reply payloads

  // === Execution Metadata ===
  meta: EmbeddedPiAgentMeta;

  // === Messaging Tool Tracking ===
  didSendViaMessagingTool?: boolean;    // Did agent use messaging tools?
  messagingToolSentTexts?: string[];    // Texts sent via messaging tools
  messagingToolSentTargets?: Array<{    // Where messages were sent
    provider: string;
    to: string;
    threadId?: string;
  }>;

  // === Tool State ===
  toolMetas?: Array<{ toolName?: string; meta?: string }>;
  lastToolError?: { toolName: string; meta?: string; error?: string };

  // === Client Tools (for hosted tool execution) ===
  clientToolCall?: { name: string; params: Record<string, unknown> };
}

interface EmbeddedPiAgentMeta {
  model?: string;
  provider?: string;
  authProfileId?: string;
  usage?: UsageInfo;
  elapsed?: number;
  aborted?: boolean;
  error?: string;
  failoverReason?: FailoverReason;
}
```

---

## Implementation Strategy

### Phase 1: Add Runtime Parameter

Modify `RunEmbeddedPiAgentParams` to include runtime selection:

```typescript
// src/agents/pi-embedded-runner/run/params.ts

export interface RunEmbeddedPiAgentParams {
  // ... existing fields ...

  /**
   * Agent runtime to use. Defaults to "pi-embedded".
   * - "pi-embedded": Uses @mariozechner/pi-coding-agent (current behavior)
   * - "claude-sdk": Uses @anthropic-ai/sdk with agentic loop
   */
  runtime?: AgentRuntimeType;
}

export type AgentRuntimeType = "pi-embedded" | "claude-sdk";
```

### Phase 2: The 5-Line Diverter

Add the diverter at the top of `runEmbeddedPiAgent`:

```typescript
// src/agents/pi-embedded-runner/run.ts

import { runClaudeSdkAgent } from "../claude-sdk-adapter/run.js";

export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  // === RUNTIME DIVERTER (new) ===
  if (params.runtime === "claude-sdk") {
    return runClaudeSdkAgent(params);
  }

  // === EXISTING PI-EMBEDDED CODE (unchanged) ===
  const sessionLane = resolveSessionLane(params.sessionKey?.trim() || params.sessionId);
  // ... rest of existing implementation ...
}
```

### Phase 3: Claude SDK Adapter Package

Create the adapter in a new directory:

```
src/agents/claude-sdk-adapter/
├── run.ts              # Main entry point (runClaudeSdkAgent)
├── loop.ts             # Agentic loop implementation
├── tools.ts            # Tool conversion and execution
├── events.ts           # Event emission helpers
├── messages.ts         # Message/conversation management
└── types.ts            # Internal types (if needed)
```

---

## Claude SDK Adapter Implementation

### Main Entry Point

```typescript
// src/agents/claude-sdk-adapter/run.ts

import Anthropic from "@anthropic-ai/sdk";
import type { RunEmbeddedPiAgentParams } from "../pi-embedded-runner/run/params.js";
import type { EmbeddedPiRunResult } from "../pi-embedded-runner/types.js";
import { emitAgentEvent } from "../../infra/agent-events.js";
import { createOpenClawCodingTools } from "../pi-tools.js";
import { toClaudeSdkTools, executeToolCall } from "./tools.js";
import { runAgenticLoop } from "./loop.js";

export async function runClaudeSdkAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  const runId = params.runId ?? crypto.randomUUID();
  const started = Date.now();

  // Track state for result building
  const state = {
    payloads: [] as ReplyPayload[],
    assistantTexts: [] as string[],
    toolMetas: [] as Array<{ toolName?: string; meta?: string }>,
    lastToolError: undefined as EmbeddedPiRunResult["lastToolError"],
    messagingToolSentTexts: [] as string[],
    messagingToolSentTargets: [] as NonNullable<EmbeddedPiRunResult["messagingToolSentTargets"]>,
  };

  try {
    // 1. Create tools (reuse existing tool creation)
    const tools = params.disableTools
      ? []
      : createOpenClawCodingTools({
          workspaceDir: params.workspaceDir,
          config: params.config,
          modelProvider: params.provider,
          modelId: params.model,
          messageProvider: params.messageChannel ?? params.messageProvider,
          agentAccountId: params.agentAccountId,
          messageTo: params.messageTo,
          messageThreadId: params.messageThreadId,
          groupId: params.groupId,
          // ... other tool options
        });

    // 2. Convert to Claude SDK format
    const claudeTools = toClaudeSdkTools(tools);

    // 3. Create client
    const client = new Anthropic({
      apiKey: await resolveApiKey(params),
    });

    // 4. Run agentic loop
    const result = await runAgenticLoop({
      client,
      params,
      runId,
      tools,
      claudeTools,
      state,
    });

    return result;

  } catch (error) {
    // Emit error event
    emitAgentEvent({
      runId,
      stream: "lifecycle",
      data: { phase: "error", error: String(error) },
    });

    return {
      payloads: state.payloads,
      meta: {
        model: params.model,
        provider: params.provider,
        elapsed: Date.now() - started,
        error: String(error),
      },
      toolMetas: state.toolMetas,
      lastToolError: state.lastToolError,
    };
  }
}
```

### Agentic Loop

```typescript
// src/agents/claude-sdk-adapter/loop.ts

import Anthropic from "@anthropic-ai/sdk";
import type { MessageParam, ContentBlock, ToolUseBlock } from "@anthropic-ai/sdk/resources/messages";
import { emitAgentEvent } from "../../infra/agent-events.js";

interface LoopContext {
  client: Anthropic;
  params: RunEmbeddedPiAgentParams;
  runId: string;
  tools: AnyAgentTool[];
  claudeTools: Anthropic.Tool[];
  state: LoopState;
}

export async function runAgenticLoop(ctx: LoopContext): Promise<EmbeddedPiRunResult> {
  const { client, params, runId, tools, claudeTools, state } = ctx;
  const messages: MessageParam[] = [];

  // Add initial user message
  messages.push({
    role: "user",
    content: params.prompt,
    // TODO: handle images
  });

  // Emit lifecycle start
  emitAgentEvent({ runId, stream: "lifecycle", data: { phase: "start", startedAt: Date.now() } });
  params.onAgentEvent?.({ stream: "lifecycle", data: { phase: "start" } });

  let continueLoop = true;
  let finalMessage: Anthropic.Message | null = null;

  while (continueLoop) {
    // Stream the response
    const stream = client.messages.stream({
      model: params.model ?? "claude-sonnet-4-20250514",
      max_tokens: 8192,
      messages,
      tools: claudeTools.length > 0 ? claudeTools : undefined,
      // Map thinking level
      ...(params.thinkLevel === "extended" && {
        thinking: { type: "enabled", budget_tokens: 10000 },
      }),
    });

    // Notify assistant message start
    params.onAssistantMessageStart?.();

    // Handle streaming events
    let currentText = "";

    stream.on("text", (text) => {
      currentText += text;

      // Invoke callback
      params.onPartialReply?.({ text });

      // Emit event
      emitAgentEvent({
        runId,
        stream: "assistant",
        data: { delta: text, text: currentText },
      });
    });

    // Handle thinking/reasoning if enabled
    stream.on("thinking", (thinking) => {
      if (params.reasoningLevel === "stream") {
        params.onReasoningStream?.({ text: thinking });
      }
    });

    // Wait for completion
    finalMessage = await stream.finalMessage();

    // Extract tool calls
    const toolUseBlocks = finalMessage.content.filter(
      (block): block is ToolUseBlock => block.type === "tool_use"
    );

    if (toolUseBlocks.length === 0) {
      // No tool calls - we're done
      continueLoop = false;

      // Build final payload
      const textContent = finalMessage.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");

      if (textContent) {
        state.payloads.push({ text: textContent });
        state.assistantTexts.push(textContent);

        // Final block reply
        params.onBlockReply?.({ text: textContent });
      }
    } else {
      // Flush any pending block reply before tool execution
      params.onBlockReplyFlush?.();

      // Add assistant message to history
      messages.push({ role: "assistant", content: finalMessage.content });

      // Execute tools and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        // Emit tool start
        emitAgentEvent({
          runId,
          stream: "tool",
          data: { phase: "start", name: toolUse.name, toolCallId: toolUse.id, args: toolUse.input },
        });
        params.onAgentEvent?.({
          stream: "tool",
          data: { phase: "start", name: toolUse.name, toolCallId: toolUse.id },
        });

        // Execute tool
        const tool = tools.find((t) => t.name === toolUse.name);
        let result: ToolResult;

        if (!tool) {
          result = {
            content: [{ type: "text", text: `Unknown tool: ${toolUse.name}` }],
            isError: true,
          };
        } else {
          try {
            result = await tool.execute(
              toolUse.id,
              toolUse.input as Record<string, unknown>,
              params.abortSignal ?? new AbortController().signal,
              undefined, // onUpdate - could wire to onAgentEvent
            );
          } catch (err) {
            result = {
              content: [{ type: "text", text: String(err) }],
              isError: true,
            };
            state.lastToolError = {
              toolName: toolUse.name,
              error: String(err),
            };
          }
        }

        // Emit tool result
        emitAgentEvent({
          runId,
          stream: "tool",
          data: {
            phase: "result",
            name: toolUse.name,
            toolCallId: toolUse.id,
            isError: result.isError ?? false,
            result,
          },
        });

        // Invoke tool result callback
        const resultText = extractTextFromResult(result);
        if (resultText && params.shouldEmitToolResult?.()) {
          params.onToolResult?.({ text: resultText });
        }

        // Track tool meta
        state.toolMetas.push({ toolName: toolUse.name });

        // Track messaging tool usage
        if (isMessagingTool(toolUse.name)) {
          trackMessagingToolUsage(toolUse, result, state);
        }

        // Build tool result for next turn
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: formatResultForClaude(result),
          is_error: result.isError,
        });
      }

      // Add tool results to messages
      messages.push({ role: "user", content: toolResults });
    }

    // Check for abort
    if (params.abortSignal?.aborted) {
      continueLoop = false;
    }
  }

  // Emit lifecycle end
  emitAgentEvent({
    runId,
    stream: "lifecycle",
    data: { phase: "end", endedAt: Date.now() },
  });
  params.onAgentEvent?.({ stream: "lifecycle", data: { phase: "end" } });

  return {
    payloads: state.payloads,
    meta: {
      model: params.model,
      provider: params.provider ?? "anthropic",
      usage: finalMessage ? normalizeUsage(finalMessage.usage) : undefined,
      elapsed: Date.now() - ctx.started,
    },
    didSendViaMessagingTool: state.messagingToolSentTexts.length > 0,
    messagingToolSentTexts: state.messagingToolSentTexts,
    messagingToolSentTargets: state.messagingToolSentTargets,
    toolMetas: state.toolMetas,
    lastToolError: state.lastToolError,
  };
}
```

### Tool Conversion

```typescript
// src/agents/claude-sdk-adapter/tools.ts

import type Anthropic from "@anthropic-ai/sdk";
import type { AnyAgentTool } from "../pi-tools.types.js";

/**
 * Convert OpenClaw tools to Claude SDK format.
 * Tools are executed manually in the agentic loop, not by the SDK.
 */
export function toClaudeSdkTools(tools: AnyAgentTool[]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description ?? "",
    input_schema: tool.parameters as Anthropic.Tool.InputSchema,
  }));
}

/**
 * Format tool result for Claude SDK message format.
 */
export function formatResultForClaude(
  result: ToolResult
): string | Anthropic.ToolResultBlockParam.Content[] {
  if (!result.content || result.content.length === 0) {
    return result.isError ? "Error: No result" : "Success";
  }

  // Simple text result
  if (result.content.length === 1 && result.content[0].type === "text") {
    return result.content[0].text;
  }

  // Mixed content (text + images)
  return result.content.map((item) => {
    if (item.type === "text") {
      return { type: "text" as const, text: item.text };
    }
    if (item.type === "image") {
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: item.mediaType as "image/png" | "image/jpeg" | "image/gif" | "image/webp",
          data: item.data,
        },
      };
    }
    return { type: "text" as const, text: JSON.stringify(item) };
  });
}
```

---

## Event Emission Parity

Both runtimes emit events through the same global system:

```typescript
// Both runtimes use:
import { emitAgentEvent } from "../../infra/agent-events.js";

// Same event schema:
emitAgentEvent({
  runId: string,
  stream: "lifecycle" | "tool" | "assistant" | "compaction",
  data: {
    phase?: "start" | "end" | "error" | "update" | "result",
    // stream-specific fields...
  },
});
```

### Event Mapping: Pi-Embedded → Claude SDK

| Pi-Embedded Event | Claude SDK Equivalent |
|-------------------|----------------------|
| `agent_start` | Emit at loop start |
| `agent_end` | Emit at loop end |
| `message_start` | `stream.on("message")` start |
| `message_update` | `stream.on("text")` delta |
| `message_end` | `stream.finalMessage()` complete |
| `tool_execution_start` | Before `tool.execute()` |
| `tool_execution_update` | `onUpdate` callback from tool |
| `tool_execution_end` | After `tool.execute()` returns |

---

## Callback Invocation Parity

The Claude SDK adapter invokes callbacks at equivalent points:

| Callback | Pi-Embedded Invocation | Claude SDK Invocation |
|----------|------------------------|----------------------|
| `onAssistantMessageStart` | `message_start` event | Before streaming text |
| `onPartialReply` | `message_update` text delta | `stream.on("text")` |
| `onReasoningStream` | Reasoning text delta | `stream.on("thinking")` |
| `onBlockReply` | End of text block / agent end | Final text content |
| `onBlockReplyFlush` | Before tool execution | Before tool execution |
| `onToolResult` | `tool_execution_end` | After `tool.execute()` |
| `onAgentEvent` | All event types | All event types |

---

## Configuration & Runtime Selection

### Explicit Selection

```typescript
// Caller explicitly requests Claude SDK
await runEmbeddedPiAgent({
  runtime: "claude-sdk",
  prompt: "Hello",
  // ... other params
});
```

### Config-Based Selection

```typescript
// src/agents/pi-embedded-runner/run.ts

function resolveRuntime(params: RunEmbeddedPiAgentParams): AgentRuntimeType {
  // Explicit selection takes precedence
  if (params.runtime) {
    return params.runtime;
  }

  // Config-based preference
  if (params.config?.agent?.preferredRuntime) {
    return params.config.agent.preferredRuntime;
  }

  // Model-based heuristic (optional)
  // if (params.provider === "anthropic" && params.model?.includes("claude")) {
  //   return "claude-sdk";
  // }

  return "pi-embedded";
}
```

### CLI Flag

```bash
# Explicit runtime selection
openclaw agent --runtime claude-sdk "Hello world"
```

---

## Files Changed Summary

### Modified (1 file - the "Golden Hook")

| File | Change |
|------|--------|
| `src/agents/pi-embedded-runner/run.ts` | Add 5-line diverter + import |

### New Files (Claude SDK Adapter Package)

| File | Purpose |
|------|---------|
| `src/agents/claude-sdk-adapter/run.ts` | Main entry point |
| `src/agents/claude-sdk-adapter/loop.ts` | Agentic loop |
| `src/agents/claude-sdk-adapter/tools.ts` | Tool conversion |
| `src/agents/claude-sdk-adapter/events.ts` | Event helpers |
| `src/agents/claude-sdk-adapter/messages.ts` | Message management |

### Modified Types (optional)

| File | Change |
|------|--------|
| `src/agents/pi-embedded-runner/run/params.ts` | Add `runtime?: AgentRuntimeType` |

---

## Testing Strategy

### Unit Tests

```typescript
// src/agents/claude-sdk-adapter/run.test.ts

describe("runClaudeSdkAgent", () => {
  it("should invoke onPartialReply during streaming", async () => {
    const onPartialReply = vi.fn();
    await runClaudeSdkAgent({
      runtime: "claude-sdk",
      prompt: "Say hello",
      onPartialReply,
      // ... mock client
    });
    expect(onPartialReply).toHaveBeenCalled();
  });

  it("should emit tool events during execution", async () => {
    const events: AgentEvent[] = [];
    const unsubscribe = onAgentEvent((evt) => events.push(evt));

    await runClaudeSdkAgent({
      runtime: "claude-sdk",
      prompt: "Read file.txt",
      disableTools: false,
      // ... mock client that requests tool use
    });

    unsubscribe();
    expect(events.some((e) => e.stream === "tool")).toBe(true);
  });
});
```

### Integration Tests

```typescript
// src/agents/claude-sdk-adapter/run.integration.test.ts

describe("Claude SDK runtime parity", () => {
  it("should produce equivalent results to Pi runtime", async () => {
    const prompt = "What is 2 + 2?";

    const piResult = await runEmbeddedPiAgent({
      runtime: "pi-embedded",
      prompt,
      disableTools: true,
    });

    const claudeResult = await runEmbeddedPiAgent({
      runtime: "claude-sdk",
      prompt,
      disableTools: true,
    });

    // Both should have text response
    expect(piResult.payloads?.[0]?.text).toBeDefined();
    expect(claudeResult.payloads?.[0]?.text).toBeDefined();

    // Meta should have similar shape
    expect(claudeResult.meta.provider).toBe("anthropic");
  });
});
```

---

## Migration Checklist

- [ ] Add `runtime` field to `RunEmbeddedPiAgentParams`
- [ ] Create `src/agents/claude-sdk-adapter/` directory
- [ ] Implement `runClaudeSdkAgent()` with basic loop
- [ ] Wire tool creation (reuse `createOpenClawCodingTools`)
- [ ] Implement tool conversion (`toClaudeSdkTools`)
- [ ] Implement callback invocations (parity with Pi)
- [ ] Implement event emissions (parity with Pi)
- [ ] Add the 5-line diverter to `run.ts`
- [ ] Add unit tests for adapter
- [ ] Add integration tests for parity
- [ ] Add CLI `--runtime` flag (optional)
- [ ] Add config option `agent.preferredRuntime` (optional)
- [ ] Update documentation

---

## Key Principles

1. **Same params in**: Claude SDK adapter receives identical `RunEmbeddedPiAgentParams`
2. **Same callbacks invoked**: All callbacks are invoked at equivalent points
3. **Same events emitted**: Same `emitAgentEvent()` schema
4. **Same result out**: Returns identical `EmbeddedPiRunResult` shape
5. **Isolated adapter code**: All Claude SDK code lives in `claude-sdk-adapter/`
6. **Single conflict point**: Only `run.ts` needs modification (the diverter)
7. **Reuse existing tools**: `createOpenClawCodingTools()` works for both runtimes

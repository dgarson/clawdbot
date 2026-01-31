# Agent Runtime Integration: The Golden Hook Plan

This document outlines the architecture for integrating the **Claude Code SDK (CCSDK)** alongside the existing **Pi Runtime** using a "Least Invasive" approach. This strategy ensures zero merge conflicts with upstream changes by isolating 90% of the new logic and using a single, stable "Hook" for integration.

## 1. The Integration "Hook" (Target: `src/agents/pi-embedded-runner/run.ts`)

To avoid refactoring the entire system, we inject a diverter at the entry point of the agent execution. This is the **only** core file we modify.

### Code Snippet: The Diverter Hook
```typescript
// src/agents/pi-embedded-runner/run.ts

import { runClaudeAgent } from "../claude-runner/index.js";

export async function runEmbeddedPiAgent(
  params: RunEmbeddedPiAgentParams,
): Promise<EmbeddedPiRunResult> {
  // Divert execution if runtime is set to 'claude'
  // We use an environment variable or config field
  const runtime = (params.config as any)?.agent?.runtime || process.env.OPENCLAW_AGENT_RUNTIME;
  
  if (runtime === "claude") {
    return runClaudeAgent(params);
  }

  // ... Original Pi implementation remains untouched below ...
}
```

## 2. The Isolated Architecture (`src/agents/claude-runner/`)

All new logic lives in a new directory, ensuring that upstream updates to the Pi runner never conflict with our Claude-specific code.

```text
src/agents/claude-runner/
├── index.ts        # The main adapter (Entry Point)
├── events.ts       # Event normalization and Parity Logic
├── tools.ts        # Model Context Protocol (MCP) bridging
└── types.ts        # Local type extensions
```

## 3. Parity & Event Normalization

The rest of the system (UI, Gateway, Logging) expects a specific sequence of events. The `ClaudeEventHandler` in `events.ts` is responsible for translating CCSDK's turn-based events into Pi's streaming-based events.

### Interface: Event Normalization
The system expects these specific callbacks (defined in `RunEmbeddedPiAgentParams`) to fire in a precise order.

| Signal | Requirement | Implementation in `claude-runner` |
| :--- | :--- | :--- |
| **Start** | `onAssistantMessageStart()` | Fire immediately when the first CCSDK text block arrives. |
| **Text** | `onPartialReply({ text })` | Map CCSDK `text` blocks to this callback incrementally. |
| **Reasoning** | `onReasoningStream({ text })` | Extract `<think>` tags or CCSDK "thinking" blocks here. |
| **Tool Start** | `onAgentEvent({ stream: "tool" })` | **Crucial**: Fire *before* tool execution to show typing indicator. |
| **Tool End** | `onToolResult({ text })` | Fire once the tool returns data. |
| **Global Logs** | `emitAgentEvent({ stream: "lifecycle" })` | Manually call the global bus to keep CLI/logs in sync. |

### Code Snippet: Event Handler Shape
```typescript
// src/agents/claude-runner/events.ts

export class ClaudeEventHandler {
  constructor(private params: RunEmbeddedPiAgentParams) {}

  public handleCCSDKEvent(event: any) {
    if (event.type === 'message_start') {
      this.params.onAssistantMessageStart?.();
    }

    if (event.type === 'content_block_delta' && event.delta.type === 'text') {
      // Parity Logic: Strip thinking tags from main output
      const cleanText = this.stripThinking(event.delta.text);
      this.params.onPartialReply?.({ text: cleanText });
    }

    if (event.type === 'tool_use') {
      // Flush any pending text blocks before the tool starts
      this.flushPendingBlocks();
      
      // Notify UI: "Agent is using tool..."
      this.params.onAgentEvent?.({ 
        stream: "tool", 
        data: { name: event.name, phase: "start" } 
      });
    }
  }
}
```

## 4. Tool Bridging (MCP)

We reuse the existing OpenClaw tools but adapt them to the CCSDK's expected format.

### Code Snippet: Tool Adapter
```typescript
// src/agents/claude-runner/tools.ts
import { createOpenClawCodingTools } from "../pi-tools.js";

export function getClaudeTools(params: RunEmbeddedPiAgentParams) {
  const tools = createOpenClawCodingTools(params);
  
  return tools.map(t => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters, // JSON Schema parity
    handler: async (input: any) => {
      // Wrap existing tool handlers
      return await t.handler(input);
    }
  }));
}
```

## 5. Implementation Workflow (Conflict-Proof)

1.  **Dependency Addition**: Add SDK to `package.json`.
2.  **Isolated Build**: Implement `src/agents/claude-runner/` completely.
3.  **Test for Parity**: Write tests ensuring that `runClaudeAgent` returns the exact same `EmbeddedPiRunResult` shape as the original runner.
4.  **The Hook**: Apply the 5-line change to `src/agents/pi-embedded-runner/run.ts`.

### Parity Checklist for `EmbeddedPiRunResult`
The final return value must match this structure to satisfy upstream callers:
```typescript
export type EmbeddedPiRunResult = {
  payloads?: Array<{ text?: string; isError?: boolean }>;
  meta: {
    durationMs: number;
    agentMeta: { provider: string; model: string; usage?: any };
  };
  didSendViaMessagingTool?: boolean; // Required for Telegram/WhatsApp suppression
};
```

This plan guarantees that your changes are "invisible" to the main engine until enabled, making maintenance and upstream syncing trivial.

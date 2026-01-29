# PR 5: Claude Code SDK Runtime + UI Integration

## Summary

Implement the Claude Code SDK (CCSDK) agent runtime, integrate phase-aware streaming in the UI, and complete the multi-runtime feature.

## PR Description

```markdown
## Summary

- Implement full Claude Code SDK agent runtime
- Add phase-aware streaming (thinking vs text) in gateway
- Update UI to render thinking and text phases separately
- Add tool error state visualization
- Extend credential management for multi-platform secure storage
- Complete end-to-end multi-runtime support

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Pi agent continues working unchanged
- [ ] CCSDK agent executes correctly when configured
- [ ] Thinking content renders with visual separation
- [ ] Tool errors display correctly
- [ ] Gateway streaming handles both runtimes
- [ ] Credentials work on macOS/Linux/Windows

## Motivation

This PR completes the multi-runtime feature by:
1. Adding the CCSDK runtime as an alternative to Pi
2. Enabling extended thinking visualization
3. Supporting CCSDK's streaming patterns in the UI
4. Providing secure credential storage across platforms
```

## Files Changed

### CCSDK Runtime (New)
| File | Purpose |
|------|---------|
| `src/agents/claude-agent-sdk/index.ts` | Module exports |
| `src/agents/claude-agent-sdk/sdk-agent-runtime.ts` | Runtime implementation |
| `src/agents/claude-agent-sdk/sdk-runner.ts` | Core execution loop |
| `src/agents/claude-agent-sdk/sdk-runner.test.ts` | Runner tests |
| `src/agents/claude-agent-sdk/sdk-loader.ts` | SDK dynamic loading |
| `src/agents/claude-agent-sdk/provider-config.ts` | Provider configuration |
| `src/agents/claude-agent-sdk/system-prompt.ts` | Prompt construction |
| `src/agents/claude-agent-sdk/types.ts` | SDK-specific types |
| `src/agents/claude-agent-sdk/tool-bridge.ts` | Tool format conversion |
| `src/agents/claude-agent-sdk/tool-bridge.types.ts` | Tool bridge types |
| `src/agents/claude-agent-sdk/tool-bridge.test.ts` | Tool bridge tests |
| `src/agents/claude-agent-sdk/client-tool-bridge.ts` | Client tool support |
| `src/agents/claude-agent-sdk/sdk-hooks.ts` | Lifecycle hooks |
| `src/agents/claude-agent-sdk/sdk-hooks.test.ts` | Hook tests |
| `src/agents/claude-agent-sdk/sdk-history.ts` | History loading |
| `src/agents/claude-agent-sdk/sdk-history.test.ts` | History tests |
| `src/agents/claude-agent-sdk/sdk-session-history.ts` | Session continuity |
| `src/agents/claude-agent-sdk/sdk-session-transcript.ts` | Transcript writing |
| `src/agents/claude-agent-sdk/sdk-event-checks.ts` | Event validation |
| `src/agents/claude-agent-sdk/sdk-event-checks.test.ts` | Event tests |
| `src/agents/claude-agent-sdk/extract.ts` | Response extraction |
| `src/agents/claude-agent-sdk/extract.test.ts` | Extraction tests |
| `src/agents/claude-agent-sdk/error-handling.ts` | Error classification |
| `src/agents/claude-agent-sdk/error-handling.test.ts` | Error tests |

### Gateway Streaming
| File | Changes |
|------|---------|
| `src/gateway/server-chat.ts` | Phase buffer + thinking stream |
| `src/gateway/server-methods/chat.ts` | Broadcast + transcript logic |

### UI Changes
| File | Changes |
|------|---------|
| `ui/src/styles/chat/text.css` | Phase separator styles |
| `ui/src/styles/chat/tool-cards.css` | Error state styles |
| `ui/src/ui/app-gateway.ts` | Reset streaming state |
| `ui/src/ui/app-render.ts` | Pass phase data |
| `ui/src/ui/app-tool-stream.ts` | Tool error handling |
| `ui/src/ui/app-view-state.ts` | Phase state types |
| `ui/src/ui/app.ts` | Phase state properties |
| `ui/src/ui/chat/grouped-render.ts` | Phase-aware rendering |
| `ui/src/ui/chat/tool-cards.ts` | Error card rendering |
| `ui/src/ui/controllers/chat.ts` | Phase parsing |
| `ui/src/ui/types/chat-types.ts` | Error field type |
| `ui/src/ui/views/chat.ts` | Phase props |

### Credential Management
| File | Changes |
|------|---------|
| `src/agents/cli-credentials.ts` | Multi-platform storage |
| `src/agents/cli-credentials.test.ts` | Platform tests |

## Architecture

### CCSDK Runtime Flow

```
createCcSdkAgentRuntime()
         │
         ▼
    run(params)
         │
    ┌────┴────┐
    │         │
    ▼         ▼
Load      Build
History   Tools
    │         │
    └────┬────┘
         │
         ▼
   runSdkAgent()
         │
    ┌────┴────┐
    │         │
    ▼         ▼
 Stream    Track
 Events    Usage
    │         │
    └────┬────┘
         │
         ▼
 Append to Transcript
         │
         ▼
   Return Result
```

### Level Mapping

| Moltbot Level | CCSDK Level |
|---------------|-------------|
| `ThinkLevel.off` | `"off"` |
| `ThinkLevel.minimal` | `"minimal"` |
| `ThinkLevel.low` | `"low"` |
| `ThinkLevel.medium` | `"medium"` |
| `ThinkLevel.high` | `"high"` |

### Tool Bridge

Converts Moltbot tool schemas to CCSDK format:

```typescript
// Moltbot format (TypeBox)
{
  name: "browser_act",
  schema: Type.Object({
    url: Type.String({ description: "URL to open" }),
  }),
  execute: async (args) => { ... }
}

// CCSDK format
{
  name: "browser_act",
  description: "Browser automation tool",
  input_schema: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to open" },
    },
  },
}
```

### Phase-Aware Streaming

Gateway tracks phases separately:

```typescript
type StreamPhase = { type: "thinking" | "text"; content: string };

interface PhaseBuffer {
  phases: StreamPhase[];
  lastType: "thinking" | "text" | null;
}

// Merge consecutive same-type phases
function appendToPhaseBuffer(buffer: PhaseBuffer, type: string, content: string) {
  if (buffer.lastType === type && buffer.phases.length > 0) {
    buffer.phases[buffer.phases.length - 1].content += content;
  } else {
    buffer.phases.push({ type, content });
    buffer.lastType = type;
  }
}
```

### UI Phase Rendering

```typescript
function renderPhaseContent(phases: StreamPhase[]): TemplateResult[] {
  const hasMultipleTypes = hasMultiplePhaseTypes(phases);

  return phases.map(phase => html`
    <div class=${hasMultipleTypes
      ? (phase.type === "thinking" ? "chat-thinking-phase" : "chat-text-phase")
      : ""}>
      ${renderMarkdown(phase.content)}
    </div>
  `);
}
```

### Credential Storage

| Platform | Storage | Tool |
|----------|---------|------|
| macOS | Keychain | `security` CLI |
| Linux | Secret Service | `secret-tool` CLI |
| Windows | Credential Manager | PowerShell |
| Fallback | File | `~/.claude/.credentials.json` |

## Key Design Decisions

### 1. Dynamic SDK Loading

CCSDK is only loaded when configured:

```typescript
export async function createCcSdkAgentRuntime(context?: Context): AgentRuntime {
  const sdk = await loadSdk(); // Dynamic import
  if (!sdk) {
    throw new Error("Claude Code SDK not available");
  }
  return { kind: "ccsdk", run: ... };
}
```

### 2. Session Transcript Persistence

CCSDK writes to session transcript after each turn:

```typescript
// After tool calls complete
await appendSdkToolCallsToSessionTranscript(sessionFile, toolCalls);

// After assistant response
await appendSdkTurnPairToSessionTranscript(sessionFile, userMsg, assistantMsg, usage);
```

### 3. Thinking/Text Phase Separation

UI maintains phase boundaries for visual distinction:

```css
.chat-thinking-phase {
  border-left: 3px solid var(--accent);
  padding-left: 12px;
  opacity: 0.8;
}

.chat-text-phase {
  /* Normal styling */
}

/* Separator between phases */
.chat-thinking-phase + .chat-text-phase {
  border-top: 1px solid var(--border);
  padding-top: 8px;
  margin-top: 8px;
}
```

### 4. Tool Error Visualization

```typescript
// Tool card with error state
if (toolCard.isError) {
  return html`
    <div class="chat-tool-card chat-tool-card--error">
      <span class="status error">Failed</span>
      <span class="icon">✕</span>
      ${toolCard.errorText || "Tool failed with no error message."}
    </div>
  `;
}
```

### 5. Broadcast vs Transcript Separation

```typescript
// Gateway chat handler
if (!agentRunStarted) {
  // Commands: gateway owns transcript
  await appendToSessionTranscript(entry, message);
}
// Agent runs: runtime owns transcript

// Always broadcast to UI
await broadcastChatFinal({ ... });
```

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| SDK API changes | Medium | Version pin + adapter layer |
| Phase rendering bugs | Medium | Fallback to legacy rendering |
| Credential security | Medium | Platform-native storage |
| Tool bridge mismatches | Medium | Comprehensive test suite |
| Streaming race conditions | Medium | Event ordering tests |

## Dependencies

- PR 4: Unified Runtime Adapter (for failover integration)
- PR 3: AgentRuntime Interface (for contract)
- PR 2: Session Adapters (for transcript format)

## Testing Strategy

```typescript
describe("CcSdkAgentRuntime", () => {
  it("executes agent with CCSDK");
  it("maps thinking levels correctly");
  it("streams partial replies");
  it("persists session transcript");
});

describe("ToolBridge", () => {
  it("converts TypeBox schemas to CCSDK format");
  it("handles complex nested schemas");
  it("preserves descriptions");
});

describe("PhaseStreaming", () => {
  it("separates thinking from text");
  it("merges consecutive same-type phases");
  it("renders with visual separation");
});

describe("CredentialManagement", () => {
  it("reads from macOS Keychain");
  it("reads from Linux Secret Service");
  it("reads from Windows Credential Manager");
  it("falls back to file storage");
});
```

## Rollback Strategy

1. Set `agents.defaults.runtime: "pi"` globally
2. Remove CCSDK files if needed
3. UI gracefully handles missing phases
4. Credential fallback to file always works

## Future Work

- OAuth token refresh flow
- CCSDK model tier optimization
- Cross-runtime session migration
- MCP tool passthrough

---

*Estimated Review Time: 90 minutes*
*Merge Complexity: High (new runtime + UI)*

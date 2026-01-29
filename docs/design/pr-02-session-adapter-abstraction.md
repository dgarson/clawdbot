# PR 2: Session Adapter Abstraction

## Summary

Introduce a unified session adapter interface that normalizes session history across different formats, enabling future multi-runtime support.

## PR Description

```markdown
## Summary

- Create `SessionAdapter` interface for runtime-agnostic session management
- Implement `PiSessionAdapter` for existing Pi agent format (flat JSONL)
- Implement `CcSdkSessionAdapter` for Claude Code SDK format (tree JSONL)
- Define normalized message types for cross-format operations

## Test plan

- [ ] `pnpm build` passes
- [ ] `pnpm test` passes
- [ ] Pi agent sessions continue working unchanged
- [ ] New adapters correctly read/write their formats
- [ ] Normalized types preserve all content information

## Motivation

Different agent runtimes use incompatible session formats:
- Pi Agent: Flat JSONL with `SessionManager`
- Claude Code SDK: Tree-structured JSONL with UUID parentage

To support multiple runtimes, we need a common interface for session operations
without forcing format conversion at the storage layer.
```

## Files Changed

| File | Status | Purpose |
|------|--------|---------|
| `src/agents/sessions/index.ts` | New | Module exports |
| `src/agents/sessions/session-adapter.ts` | New | Abstract interface definition |
| `src/agents/sessions/types.ts` | New | Normalized message types |
| `src/agents/sessions/pi-session-adapter.ts` | New | Pi format implementation |
| `src/agents/sessions/ccsdk-session-adapter.ts` | New | CCSDK format implementation |

## Architecture

### SessionAdapter Interface

```typescript
interface SessionAdapter {
  readonly format: "pi-agent" | "ccsdk";
  readonly sessionFile: string;

  // Reading
  loadHistory(): Promise<NormalizedMessage[]>;
  getMetadata(): SessionMetadata;

  // Writing
  appendUserMessage(content: string, images?: NormalizedImageContent[]): Promise<string>;
  appendAssistantMessage(content: AssistantContent[], usage?: UsageInfo): Promise<string>;
  appendToolResult(toolCallId: string, result: NormalizedToolResultContent, isError?: boolean): Promise<string>;

  // Lifecycle
  flush(): Promise<void>;
  close(): Promise<void>;
}
```

### Normalized Types

```typescript
// Content blocks normalized across formats
type NormalizedContent =
  | NormalizedTextContent      // { type: "text", text: string }
  | NormalizedImageContent     // { type: "image", base64: string, mimeType: string }
  | NormalizedToolCall         // { type: "tool_call", id: string, name: string, args: object }
  | NormalizedThinking         // { type: "thinking", text: string }
  | NormalizedToolResultContent; // { type: "tool_result", toolCallId: string, result: string }

// Unified message envelope
interface NormalizedMessage {
  id: string;
  role: "user" | "assistant" | "tool_result";
  content: NormalizedContent[];
  timestamp?: number;
}
```

### Format Comparison

| Aspect | Pi Agent | CCSDK |
|--------|----------|-------|
| Structure | Flat JSONL | Tree JSONL (UUID parentage) |
| Tool calls | `toolCall` block | `tool_use` block |
| Tool results | Separate message | Inline or separate |
| Thinking | Text markers | Native `thinking` block |
| Metadata | Minimal | Rich (git branch, slug) |

## Key Design Decisions

### 1. No Cross-Format Conversion

Each adapter reads/writes its native format. Normalization is for internal processing only, not persistence. This:
- Preserves format-specific metadata
- Avoids lossy conversions
- Keeps each runtime in control of its storage

### 2. Lazy Loading

Adapters load session history on first `loadHistory()` call, not construction. This:
- Reduces startup latency
- Allows adapter creation without I/O
- Enables partial reads in future

### 3. ID Generation Strategy

```typescript
// Pi: Deterministic but unique
"pi-{timestamp}-{random4}"

// CCSDK: UUID v4-like
"xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx"
```

### 4. Thinking Block Handling

Pi adapter converts thinking blocks to text with markers for compatibility:
```typescript
// Input (normalized)
{ type: "thinking", text: "Let me consider..." }

// Output (Pi format)
{ type: "text", text: "<thinking>Let me consider...</thinking>" }
```

CCSDK preserves native thinking blocks.

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| Breaking Pi sessions | Low | Adapter wraps existing SessionManager |
| CCSDK format mismatch | Medium | Tests validate real SDK output |
| Thinking conversion loss | Low | Markers are reversible |

## Dependencies

None - new module with no external dependencies.

## Testing Strategy

```typescript
// Unit tests for each adapter
describe("PiSessionAdapter", () => {
  it("reads existing Pi session files");
  it("writes messages in Pi format");
  it("normalizes Pi content to unified types");
});

describe("CcSdkSessionAdapter", () => {
  it("reads tree-structured JSONL");
  it("tracks parent UUIDs correctly");
  it("handles inline tool results");
});

// Cross-adapter tests
describe("Normalization", () => {
  it("both adapters produce compatible NormalizedMessage");
  it("thinking blocks preserve semantics across formats");
});
```

## Rollback Strategy

Delete the `src/agents/sessions/` directory. No other code references these adapters yet.

## Future Work

- Session migration tooling (Pi → CCSDK)
- Session introspection API
- Cross-runtime session continuity

---

*Estimated Review Time: 30 minutes*
*Merge Complexity: Low (new code only)*

# SDK-Only Features (Missing from Pi Runtime)

> Features present in the Claude Agent SDK implementation that have no equivalent in the Pi Runtime.

---

### 1. Native Session Resume

**SDK location**: `sdk-runner.ts:601-604`

```typescript
if (params.claudeSessionId) {
  sdkOptions.resume = params.claudeSessionId;
}
```

Uses Claude Code's native `resume` option, avoiding re-serialization of conversation history on every request.

**Pi equivalent**: Pi manages history entirely client-side via session file read/write. More work, but gives more control over the session contents.

---

### 2. Claude Code Hooks System

**SDK location**: `sdk-hooks.ts` (428 lines)

Full hook lifecycle integration with Claude Code:

```typescript
type SdkHookEventName =
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "Notification"
  | "SessionStart"
  | "SessionEnd"
  | "UserPromptSubmit"
  | "Stop"
  | "SubagentStart"
  | "SubagentStop";
```

Gated by `hooksEnabled` in `SdkRuntimeContext` (`sdk-agent-runtime.ts:25`).

**Pi equivalent**: Pi uses direct callbacks and plugin hooks (`before_agent_start`/`agent_end`), but doesn't have the same granular hook taxonomy. No `PreToolUse`/`PostToolUse` hooks at the runtime level.

---

### 3. Platform Credential Store Resolution

**SDK location**: `sdk-runner-adapter.ts:109-362`

Elaborate platform-specific credential resolution:

- **macOS**: Keychain via `security find-generic-password`
- **Windows**: Credential Manager via PowerShell/DLL interop
- **Linux**: File-based credentials (`~/.claude/.credentials.json`)

**Pi equivalent**: Uses `authProfileStore` which is cross-platform but does not access OS-level credential stores.

---

### 4. Beta Feature Flags

**SDK location**: `sdk-runner.ts:649-654`, `sdk-runner.types.ts:196-203`

Supports `betas` arrays for opting into preview features:

```typescript
// Example: 1M context window on Sonnet 4/4.5
betas: ["context-1m-2025-08-07"];
```

**Pi equivalent**: Not supported. No mechanism for enabling API-level beta features.

---

### 5. Permission Mode

**SDK location**: `sdk-runner.types.ts:98`

Supports `permissionMode`:

- `"default"` — normal tool approval flow
- `"acceptEdits"` — auto-approve file edits
- `"bypassPermissions"` — skip all tool approvals

**Pi equivalent**: Not present. Tool approval is managed through `ToolPolicy` in the execution layer, but there's no single-switch permission mode.

---

### 6. Built-in Claude Code Tools

**SDK location**: `sdk-runner.types.ts:88-93`

Can selectively enable Claude Code's own built-in tools (`Read`, `Write`, `Bash`, `Glob`, etc.) alongside Clawdbrain's MCP-bridged tools. By default disabled (`[]`).

**Pi equivalent**: Not applicable — Pi directly instantiates all tools as native agent tools. There's no concept of dual tool systems.

---

### 7. `sdkOptions` Passthrough

**SDK location**: `sdk-agent-runtime.ts:31`, `sdk-runner.ts:576`

Arbitrary additional options passthrough with protected key enforcement (prevents overwriting critical options like `prompt`, `systemPrompt`, `abortController`).

**Pi equivalent**: No equivalent extensibility mechanism.

---

### 8. Turn Count Tracking

**SDK location**: `sdk-runner.ts:704-705, 784`

Explicitly tracks `turnCount` (assistant message boundaries) and `userMessageCount`, returned in `SdkRunnerMeta.turnCount`.

**Pi equivalent**: Not tracked in `EmbeddedPiRunMeta`.

---

### 9. Cost Estimation

**SDK location**: `sdk-runner.types.ts:247`

`SdkRunnerMeta` includes a `costUsd` field for per-run cost estimation.

**Pi equivalent**: Not present in Pi metadata.

---

### 10. MCP Tool Bridge with Schema Conversion

**SDK location**: `tool-bridge.ts` (736 lines)

Full schema conversion pipeline: TypeBox → JSON Schema → Zod. Bridges Clawdbrain's `AnyAgentTool` definitions to Claude Code's MCP-based custom tool system.

**Pi equivalent**: Not applicable — Pi uses native tool definitions directly.

---

### 11. Tool Bridge Diagnostics

**SDK location**: SDK result metadata

Returns detailed tool bridge diagnostics:

```typescript
bridge?: {
  toolCount: number;
  registeredTools: string[];
  skippedTools: string[];
}
```

**Pi equivalent**: No equivalent since Pi directly instantiates tools without a bridge.

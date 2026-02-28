# Session Scratchpad Extension — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `session.scratchpad` tool as an extension that lets the Claude SDK agent persist working state (plans, findings, decisions) across auto-compaction within a single session.

**Architecture:** A new `extensions/scratchpad/` extension registers a `before_session_create` hook that contributes the scratchpad tool and system prompt guidance. The tool is created per-session with closure over session state. Scratchpad content is stored in-memory on `ClaudeSdkEventAdapterState` and persisted to JSONL via `appendCustomEntry`. At each `prompt()` call, scratchpad content is prepended to the user message.

**Tech Stack:** TypeScript ESM, Vitest, existing `appendCustomEntry`/`getEntries` SessionManager API, existing `estimateTokens` from `context/budget.ts`, existing `before_session_create` hook infrastructure.

---

## Files at a Glance

### New Files

| File                                                             | Purpose                                                              |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| `extensions/scratchpad/package.json`                             | Extension manifest                                                   |
| `extensions/scratchpad/openclaw.plugin.json`                     | Plugin metadata                                                      |
| `extensions/scratchpad/index.ts`                                 | Plugin entry: registers `before_session_create` hook                 |
| `extensions/scratchpad/scratchpad-tool.ts`                       | Tool factory: creates `session.scratchpad` tool with session closure |
| `extensions/scratchpad/scratchpad-tool.test.ts`                  | Unit tests for scratchpad tool logic                                 |
| `src/agents/claude-sdk-runner/create-session.scratchpad.test.ts` | Integration tests for scratchpad injection at `prompt()`             |

### Modified Files

| File                                             | Change                                                                                |
| ------------------------------------------------ | ------------------------------------------------------------------------------------- |
| `src/agents/claude-sdk-runner/create-session.ts` | Add scratchpad state to adapter state, load from JSONL on init, prepend at `prompt()` |
| `src/agents/claude-sdk-runner/types.ts`          | Add `scratchpad?: string` to `ClaudeSdkEventAdapterState`                             |
| `src/config/zod-schema.agent-runtime.ts`         | Add `scratchpad` field to `ClaudeSdkConfigSchema`                                     |
| `src/config/types.agents.ts`                     | Update `ClaudeSdkConfig` type (auto-derived from Zod schema)                          |

---

## Task 1: Add scratchpad config to ClaudeSdkConfigSchema

**Files:**

- Modify: `src/config/zod-schema.agent-runtime.ts:20-30`

**Step 1: Write the failing test**

No dedicated test needed — config schema validation is covered by existing Zod schema tests. We'll verify via `pnpm tsgo` after the change.

**Step 2: Add scratchpad field to Zod schema**

In `src/config/zod-schema.agent-runtime.ts`, expand `ClaudeSdkConfigSchema`:

```typescript
export const ClaudeSdkConfigSchema = z
  .object({
    thinkingDefault: z.enum(["none", "low", "medium", "high"]).optional(),
    configDir: z.string().trim().min(1).optional(),
    scratchpad: z
      .object({
        enabled: z.boolean().optional(),
        maxTokens: z.number().int().positive().optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
  .optional();
```

Default behavior: when `scratchpad` is absent or `enabled` is undefined, scratchpad is enabled (opt-out). `maxTokens` defaults to 2000 when unset.

**Step 3: Verify types compile**

Run: `pnpm tsgo`
Expected: Clean exit, no errors. `ClaudeSdkConfig` type auto-updates via `z.infer`.

**Step 4: Commit**

```bash
scripts/committer "feat(config): add scratchpad field to ClaudeSdkConfigSchema" src/config/zod-schema.agent-runtime.ts
```

---

## Task 2: Add scratchpad state to ClaudeSdkEventAdapterState

**Files:**

- Modify: `src/agents/claude-sdk-runner/types.ts`

**Step 1: Add scratchpad field to state type**

Find `ClaudeSdkEventAdapterState` in `src/agents/claude-sdk-runner/types.ts` and add:

```typescript
/** Current scratchpad content. Updated by session.scratchpad tool. */
scratchpad?: string;
```

**Step 2: Verify types compile**

Run: `pnpm tsgo`
Expected: Clean exit.

**Step 3: Commit**

```bash
scripts/committer "feat(claude-sdk): add scratchpad field to ClaudeSdkEventAdapterState" src/agents/claude-sdk-runner/types.ts
```

---

## Task 3: Create the scratchpad tool factory

**Files:**

- Create: `extensions/scratchpad/scratchpad-tool.ts`
- Create: `extensions/scratchpad/scratchpad-tool.test.ts`

**Step 1: Write failing tests**

Create `extensions/scratchpad/scratchpad-tool.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { buildScratchpadTool, SCRATCHPAD_ENTRY_KEY } from "./scratchpad-tool.js";

function makeMockState() {
  return {
    scratchpad: undefined as string | undefined,
    appendCustomEntry: vi.fn(),
  };
}

describe("buildScratchpadTool", () => {
  it("returns a tool named session.scratchpad", () => {
    const tool = buildScratchpadTool({ state: makeMockState(), maxTokens: 2000 });
    expect(tool.name).toBe("session.scratchpad");
  });

  describe("replace mode", () => {
    it("replaces scratchpad content", async () => {
      const state = makeMockState();
      const tool = buildScratchpadTool({ state, maxTokens: 2000 });
      const result = await tool.execute({ content: "## Plan\n1. Fix X", mode: "replace" });
      expect(state.scratchpad).toBe("## Plan\n1. Fix X");
      expect(result).toContain("updated");
    });

    it("persists to JSONL via appendCustomEntry", async () => {
      const state = makeMockState();
      const tool = buildScratchpadTool({ state, maxTokens: 2000 });
      await tool.execute({ content: "my plan", mode: "replace" });
      expect(state.appendCustomEntry).toHaveBeenCalledWith(SCRATCHPAD_ENTRY_KEY, "my plan");
    });

    it("truncates content exceeding maxTokens", async () => {
      const state = makeMockState();
      const tool = buildScratchpadTool({ state, maxTokens: 10 }); // ~40 chars
      const longContent = "a".repeat(200);
      const result = await tool.execute({ content: longContent, mode: "replace" });
      expect(state.scratchpad!.length).toBeLessThan(200);
      expect(result).toContain("truncated");
    });
  });

  describe("append mode", () => {
    it("appends to existing scratchpad", async () => {
      const state = makeMockState();
      state.scratchpad = "line 1";
      const tool = buildScratchpadTool({ state, maxTokens: 2000 });
      await tool.execute({ content: "line 2", mode: "append" });
      expect(state.scratchpad).toBe("line 1\nline 2");
    });

    it("rejects append that would exceed budget", async () => {
      const state = makeMockState();
      state.scratchpad = "a".repeat(36); // ~9 tokens
      const tool = buildScratchpadTool({ state, maxTokens: 10 });
      const result = await tool.execute({ content: "b".repeat(20), mode: "append" });
      expect(result).toContain("exceed");
      // Scratchpad unchanged
      expect(state.scratchpad).toBe("a".repeat(36));
    });
  });

  describe("defaults", () => {
    it("defaults to replace mode when mode is omitted", async () => {
      const state = makeMockState();
      state.scratchpad = "old content";
      const tool = buildScratchpadTool({ state, maxTokens: 2000 });
      await tool.execute({ content: "new content" });
      expect(state.scratchpad).toBe("new content");
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run extensions/scratchpad/scratchpad-tool.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement the scratchpad tool factory**

Create `extensions/scratchpad/scratchpad-tool.ts`:

```typescript
import { estimateTokens } from "../../src/agents/claude-sdk-runner/context/budget.js";

export const SCRATCHPAD_ENTRY_KEY = "openclaw:scratchpad";
const DEFAULT_MAX_TOKENS = 2000;

export type ScratchpadState = {
  scratchpad?: string;
  appendCustomEntry: (key: string, value: unknown) => void;
};

export type ScratchpadToolOptions = {
  state: ScratchpadState;
  maxTokens?: number;
};

export function buildScratchpadTool(opts: ScratchpadToolOptions) {
  const maxTokens = opts.maxTokens ?? DEFAULT_MAX_TOKENS;
  const maxChars = maxTokens * 4; // estimateTokens uses ceil(len/4)

  return {
    name: "session.scratchpad" as const,
    description:
      "Persist important working state (plans, findings, decisions) that survives context compaction. " +
      "Content is prepended to each message you receive. Use mode 'replace' to overwrite or 'append' to add.",
    parameters: {
      type: "object" as const,
      properties: {
        content: {
          type: "string" as const,
          description: "The scratchpad content to save",
        },
        mode: {
          type: "string" as const,
          enum: ["replace", "append"],
          description:
            "replace: overwrite entire scratchpad. append: add to existing. Default: replace.",
        },
      },
      required: ["content"] as const,
    },
    async execute(input: { content: string; mode?: "replace" | "append" }): Promise<string> {
      const mode = input.mode ?? "replace";
      const { state } = opts;

      if (mode === "append") {
        const combined = state.scratchpad ? `${state.scratchpad}\n${input.content}` : input.content;
        const tokens = estimateTokens(combined);
        if (tokens > maxTokens) {
          return `Cannot append: would exceed scratchpad budget (${tokens} tokens > ${maxTokens} max). Current scratchpad is ${estimateTokens(state.scratchpad ?? "")} tokens. Use mode "replace" to rewrite, or reduce content.`;
        }
        state.scratchpad = combined;
      } else {
        let content = input.content;
        const tokens = estimateTokens(content);
        if (tokens > maxTokens) {
          content = content.slice(0, maxChars);
          state.scratchpad = content;
          try {
            state.appendCustomEntry(SCRATCHPAD_ENTRY_KEY, content);
          } catch {
            // Non-fatal
          }
          return `Scratchpad updated (truncated to ~${maxTokens} tokens from ${tokens}). Consider summarizing to stay within budget.`;
        }
        state.scratchpad = content;
      }

      try {
        state.appendCustomEntry(SCRATCHPAD_ENTRY_KEY, state.scratchpad);
      } catch {
        // Non-fatal — persistence failed but in-memory state is updated
      }

      const currentTokens = estimateTokens(state.scratchpad);
      return `Scratchpad ${mode === "append" ? "appended" : "updated"} (${currentTokens}/${maxTokens} tokens used).`;
    },
  };
}
```

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run extensions/scratchpad/scratchpad-tool.test.ts`
Expected: All tests PASS.

**Step 5: Commit**

```bash
scripts/committer "feat(scratchpad): add scratchpad tool factory with tests" extensions/scratchpad/scratchpad-tool.ts extensions/scratchpad/scratchpad-tool.test.ts
```

---

## Task 4: Create the extension scaffold

**Files:**

- Create: `extensions/scratchpad/package.json`
- Create: `extensions/scratchpad/openclaw.plugin.json`
- Create: `extensions/scratchpad/index.ts`

**Step 1: Create package.json**

```json
{
  "name": "@openclaw/scratchpad",
  "version": "2026.2.28",
  "private": true,
  "description": "Session scratchpad for Claude SDK — persists working memory across auto-compaction",
  "type": "module",
  "peerDependencies": {
    "openclaw": ">=2026.1.26"
  },
  "openclaw": {
    "extensions": ["./index.ts"]
  }
}
```

**Step 2: Create openclaw.plugin.json**

```json
{
  "id": "scratchpad",
  "kind": "agent",
  "configSchema": {
    "type": "object",
    "additionalProperties": false,
    "properties": {}
  }
}
```

**Step 3: Create index.ts**

The extension registers a `before_session_create` hook that contributes:

1. The `session.scratchpad` tool (with closure over session state)
2. A system prompt section explaining the scratchpad

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";
import { buildScratchpadTool, SCRATCHPAD_ENTRY_KEY } from "./scratchpad-tool.js";

const scratchpadPlugin = {
  id: "scratchpad",
  name: "Session Scratchpad",
  description: "Persistent working memory for Claude SDK sessions that survives auto-compaction",
  kind: "agent",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.on(
      "before_session_create",
      (event, _ctx) => {
        // Read scratchpad config from claudeSdk config.
        // Default: enabled unless explicitly disabled.
        const claudeSdkConfig = api.config.agents?.defaults?.claudeSdk;
        if (claudeSdkConfig === false) return {};
        const scratchpadConfig = (claudeSdkConfig as Record<string, unknown> | undefined)
          ?.scratchpad as { enabled?: boolean; maxTokens?: number } | undefined;
        if (scratchpadConfig?.enabled === false) return {};

        const maxTokens = scratchpadConfig?.maxTokens ?? 2000;

        // Build tool. The tool will be given access to session state via the
        // scratchpadState adapter that create-session.ts wires up.
        // For now, return the tool definition and system prompt section.
        // The actual state binding happens in create-session.ts when it
        // processes hook-contributed tools.

        const promptSection = [
          "## Session Scratchpad",
          "You have a persistent scratchpad tool (`session.scratchpad`) that survives context compaction.",
          "Use it to save: multi-step plans, key findings, important decisions, accumulated state.",
          "The scratchpad is prepended to each message you receive so you always see it.",
          `Budget: ~${maxTokens} tokens. Call with mode "replace" to overwrite, or "append" to add incrementally.`,
        ].join("\n");

        return {
          systemPromptSections: [promptSection],
          // Tool contribution: the actual tool instance is created in
          // create-session.ts because it needs closure over session-scoped
          // state (scratchpad content, sessionManager). We signal intent here
          // by returning metadata that create-session.ts checks.
          scratchpadConfig: { enabled: true, maxTokens },
        };
      },
      { priority: 900 },
    );
  },
};

export default scratchpadPlugin;
```

**Note:** The tool can't be fully created in the hook because it needs session state (`appendCustomEntry`, the mutable `scratchpad` string). The hook returns `scratchpadConfig` as a signal, and `create-session.ts` creates the actual tool. This is the same pattern issue the channel tools face — they're created via `buildChannelTools()` which takes `StructuredContextInput`.

**Alternative approach (simpler):** Skip the extension hook pattern entirely and build the scratchpad tool directly in `create-session.ts`, gated on config. This avoids the extension/core coupling problem. The system prompt section can also be added inline.

**Decision:** Use the simpler approach — build the scratchpad tool and system prompt section directly in `create-session.ts`, gated on `claudeSdk.scratchpad.enabled !== false`. The extension scaffold exists for future extensibility but the core implementation lives in `create-session.ts` where session state is accessible. This matches how `buildChannelTools()` works.

**Step 4: Commit**

```bash
scripts/committer "feat(scratchpad): add extension scaffold" extensions/scratchpad/package.json extensions/scratchpad/openclaw.plugin.json extensions/scratchpad/index.ts
```

---

## Task 5: Wire scratchpad into create-session.ts

**Files:**

- Modify: `src/agents/claude-sdk-runner/create-session.ts:310-400` (init) and `~508` (injection)

This is the core integration. Three changes:

### Step 1: Load scratchpad from JSONL on session init

In `createClaudeSdkSession()`, after the manifest is loaded from entries (~line 341), add:

```typescript
// Load scratchpad from session history (last openclaw:scratchpad entry).
const scratchpadEntry = [...allEntries]
  .toReversed()
  .find((e) => e.type === "custom" && e.customType === SCRATCHPAD_ENTRY_KEY);
const initialScratchpad =
  scratchpadEntry && typeof scratchpadEntry.data === "string" ? scratchpadEntry.data : undefined;
```

Import `SCRATCHPAD_ENTRY_KEY` from the scratchpad-tool module.

### Step 2: Initialize scratchpad on adapter state

At the state initialization (~line 344), add:

```typescript
scratchpad: initialScratchpad,
```

### Step 3: Create scratchpad tool and add to allTools

After the hook processing (~line 385), before `const allTools = [...]`:

```typescript
// Build scratchpad tool if enabled (default: on).
const claudeSdkConfig = params.claudeSdkConfig;
const scratchpadEnabled = claudeSdkConfig?.scratchpad?.enabled !== false;
const scratchpadTools: ClaudeSdkCompatibleTool[] = [];
if (scratchpadEnabled) {
  const maxTokens = claudeSdkConfig?.scratchpad?.maxTokens ?? 2000;
  const scratchpadState: ScratchpadState = {
    get scratchpad() {
      return state.scratchpad;
    },
    set scratchpad(v) {
      state.scratchpad = v;
    },
    appendCustomEntry: (key, value) => {
      if (params.sessionManager?.appendCustomEntry) {
        params.sessionManager.appendCustomEntry(key, value);
      }
    },
  };
  const tool = buildScratchpadTool({ state: scratchpadState, maxTokens });
  scratchpadTools.push(tool as unknown as ClaudeSdkCompatibleTool);
}

const allTools = [...params.tools, ...params.customTools, ...hookTools, ...scratchpadTools];
```

### Step 4: Add scratchpad system prompt section

If scratchpad is enabled, add the guidance to hookSections:

```typescript
if (scratchpadEnabled) {
  const maxTokens = claudeSdkConfig?.scratchpad?.maxTokens ?? 2000;
  hookSections.push(
    [
      "## Session Scratchpad",
      "You have a persistent scratchpad tool (`session.scratchpad`) that survives context compaction.",
      "Use it to save: multi-step plans, key findings, important decisions, accumulated state.",
      "The scratchpad is prepended to each message you receive so you always see it.",
      `Budget: ~${maxTokens} tokens. Call with mode "replace" to overwrite, or "append" to add incrementally.`,
    ].join("\n"),
  );
}
```

### Step 5: Prepend scratchpad at prompt() call

In the `prompt()` method, after the steer text prepend at line 508:

```typescript
effectivePrompt = steerText ? `${steerText}\n\n${effectivePrompt}` : effectivePrompt;

// Prepend scratchpad content if present
if (state.scratchpad) {
  effectivePrompt = `[Session Scratchpad - your persistent working memory]\n${state.scratchpad}\n[End Scratchpad]\n\n${effectivePrompt}`;
}
```

**Important:** The scratchpad is prepended to `effectivePrompt` (sent to SDK) but NOT to the persisted user content. The JSONL stores the raw user message; the scratchpad is a separate custom entry.

To achieve this, the prepend must happen between `effectivePrompt` assembly and `buildClaudePromptInput()`, but the `persistedUserContent` should use the pre-scratchpad `effectivePrompt`:

```typescript
effectivePrompt = steerText ? `${steerText}\n\n${effectivePrompt}` : effectivePrompt;
const persistedUserContent = buildPersistedUserContent(effectivePrompt, promptImages);

// Prepend scratchpad for SDK only (not persisted)
let sdkPrompt = effectivePrompt;
if (state.scratchpad) {
  sdkPrompt = `[Session Scratchpad - your persistent working memory]\n${state.scratchpad}\n[End Scratchpad]\n\n${sdkPrompt}`;
}
const claudePromptInput = buildClaudePromptInput(sdkPrompt, promptImages);
```

### Step 6: Pass claudeSdkConfig through params

Add `claudeSdkConfig` to `ClaudeSdkSessionParams` in `types.ts`:

```typescript
claudeSdkConfig?: ClaudeSdkConfig;
```

And wire it from `prepare-session.ts` where the config is available.

### Step 7: Run existing tests

Run: `pnpm vitest run src/agents/claude-sdk-runner/create-session.test.ts`
Expected: All existing tests PASS (scratchpad is opt-in and no existing test sets it).

### Step 8: Commit

```bash
scripts/committer "feat(scratchpad): wire scratchpad tool and injection into create-session" src/agents/claude-sdk-runner/create-session.ts src/agents/claude-sdk-runner/types.ts
```

---

## Task 6: Integration tests for scratchpad injection

**Files:**

- Create: `src/agents/claude-sdk-runner/create-session.scratchpad.test.ts`

**Step 1: Write integration tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SCRATCHPAD_ENTRY_KEY } from "../../../extensions/scratchpad/scratchpad-tool.js";

// Use the same mock setup pattern from create-session.test.ts

describe("scratchpad integration", () => {
  describe("tool registration", () => {
    it("registers session.scratchpad tool when config is default", async () => {
      // Create session with no explicit scratchpad config
      // Verify session.scratchpad appears in tool list
    });

    it("omits session.scratchpad when scratchpad.enabled is false", async () => {
      // Create session with claudeSdkConfig: { scratchpad: { enabled: false } }
      // Verify tool is not registered
    });
  });

  describe("prompt injection", () => {
    it("prepends scratchpad to SDK prompt but not persisted content", async () => {
      // Create session, call session.scratchpad tool to set content
      // Then call prompt() and verify:
      // - claudePromptInput contains [Session Scratchpad]
      // - persisted message does NOT contain [Session Scratchpad]
    });

    it("does not prepend when scratchpad is empty", async () => {
      // Create session, call prompt() without setting scratchpad
      // Verify no [Session Scratchpad] in prompt
    });
  });

  describe("session resume", () => {
    it("loads scratchpad from JSONL entries on session creation", async () => {
      // Create session with getEntries returning a scratchpad custom entry
      // Verify state.scratchpad is initialized
      // Call prompt() and verify scratchpad is prepended
    });
  });

  describe("persistence", () => {
    it("calls appendCustomEntry when scratchpad is updated", async () => {
      // Create session with appendCustomEntry mock
      // Call session.scratchpad tool
      // Verify appendCustomEntry called with SCRATCHPAD_ENTRY_KEY
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/agents/claude-sdk-runner/create-session.scratchpad.test.ts`
Expected: FAIL (tests reference real integration that needs Task 5 complete).

**Step 3: Implement stubs / fix until tests pass**

Iterate on the test implementation using the same mock patterns from `create-session.test.ts` (mock `query()`, mock `sessionManager`).

**Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/agents/claude-sdk-runner/create-session.scratchpad.test.ts`
Expected: All PASS.

**Step 5: Run full test suite**

Run: `pnpm test`
Expected: No regressions.

**Step 6: Commit**

```bash
scripts/committer "test(scratchpad): add integration tests for scratchpad injection and persistence" src/agents/claude-sdk-runner/create-session.scratchpad.test.ts
```

---

## Task 7: Wire claudeSdkConfig into prepare-session.ts

**Files:**

- Modify: `src/agents/claude-sdk-runner/prepare-session.ts`
- Modify: `src/agents/claude-sdk-runner/types.ts` (if needed for ClaudeSdkSessionParams)

**Step 1: Pass claudeSdkConfig from prepare-session to create-session**

Find where `createClaudeSdkSession()` is called in `prepare-session.ts` and add the `claudeSdkConfig` param:

```typescript
const session = await createClaudeSdkSession({
  // ... existing params ...
  claudeSdkConfig: agentConfig.claudeSdk || undefined,
});
```

**Step 2: Verify types compile**

Run: `pnpm tsgo`
Expected: Clean exit.

**Step 3: Run tests**

Run: `pnpm test`
Expected: All pass.

**Step 4: Commit**

```bash
scripts/committer "feat(scratchpad): wire claudeSdkConfig from prepare-session to create-session" src/agents/claude-sdk-runner/prepare-session.ts src/agents/claude-sdk-runner/types.ts
```

---

## Task 8: Simplify extension to documentation-only

Since the core implementation lives in `create-session.ts` (necessary for session state access), the `extensions/scratchpad/` extension scaffold serves as documentation and a future extensibility point. Simplify `index.ts` to a no-op that documents the pattern.

**Step 1: Update index.ts**

```typescript
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

/**
 * Session Scratchpad extension.
 *
 * The scratchpad tool (session.scratchpad) and its prompt injection are
 * implemented directly in create-session.ts because they require closure
 * over session-scoped state (scratchpad content, sessionManager).
 *
 * This extension exists as a registration point and can be extended to
 * add CLI commands (e.g. `openclaw scratchpad show`) or cross-session
 * scratchpad persistence in the future.
 *
 * Configuration: agents.defaults.claudeSdk.scratchpad
 *   enabled: boolean (default: true)
 *   maxTokens: number (default: 2000)
 */
const scratchpadPlugin = {
  id: "scratchpad",
  name: "Session Scratchpad",
  description: "Persistent working memory for Claude SDK sessions that survives auto-compaction",
  kind: "agent",
  configSchema: emptyPluginConfigSchema(),
  register(_api: OpenClawPluginApi) {
    // Core implementation lives in create-session.ts.
    // Future: add CLI commands, cross-session persistence, or analytics here.
  },
};

export default scratchpadPlugin;
```

**Step 2: Commit**

```bash
scripts/committer "docs(scratchpad): simplify extension to documentation-only scaffold" extensions/scratchpad/index.ts
```

---

## Task 9: Final verification

**Step 1: Type check**

Run: `pnpm tsgo`
Expected: Clean exit.

**Step 2: Lint/format**

Run: `pnpm check`
Expected: Clean or auto-fixable issues only.

Run: `pnpm format:fix`

**Step 3: Full test suite**

Run: `pnpm test`
Expected: All tests pass, no regressions.

**Step 4: Final commit (if format changes)**

```bash
scripts/committer "style: format" <changed files>
```

---

## Dependency Order

```
Task 1 (config schema)
    ↓
Task 2 (state type)
    ↓
Task 3 (tool factory + tests)
    ↓
Task 4 (extension scaffold)
    ↓
Task 7 (wire config in prepare-session)
    ↓
Task 5 (core integration in create-session) ← depends on 1, 2, 3, 7
    ↓
Task 6 (integration tests) ← depends on 5
    ↓
Task 8 (simplify extension)
    ↓
Task 9 (final verification)
```

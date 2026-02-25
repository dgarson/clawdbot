# Agent Runtime Interface — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Introduce a shared `AgentRuntime` interface so `attempt.ts` is runtime-agnostic, add `claude-max` as a first-class model provider with implicit auth, and port the Claude SDK runner module from `dgarson/fork`.

**Architecture:** Thin adapter pattern — `PiRuntimeAdapter` wraps Pi's `AgentSession`, `ClaudeSdkSession` implements `AgentRuntime` natively. Runtime is inferred from the model provider (`claude-max` → `claude-sdk` internal runtime) or `claudeSdk` config presence. Auth follows the `aws-sdk` pattern for implicit system-keychain credentials.

**Naming:**

- `claude-max` — user-facing model provider name (e.g. `model: "claude-max/claude-sonnet-4-6"`). Always `system-keychain` auth, no exceptions.
- `claude-sdk` — internal runtime mode, never exposed in config. Used in code as the runtime discriminator.

**Tech Stack:** TypeScript (ESM), Zod schemas, Vitest, `@anthropic-ai/claude-agent-sdk`, `@mariozechner/pi-coding-agent`

**Design doc:** `docs/plans/2026-02-24-agent-runtime-interface-design.md`

**Source for Claude SDK module:** `dgarson/fork` branch (use `git show dgarson/fork:<path>` to read files)

---

## Task 1: Create `AgentRuntime` interface

**Files:**

- Create: `src/agents/agent-runtime.ts`
- Test: `src/agents/agent-runtime.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/agent-runtime.test.ts
import { describe, expect, it } from "vitest";
import type { AgentRuntime, AgentRuntimeHints } from "./agent-runtime.js";

describe("AgentRuntime interface", () => {
  it("can be satisfied by a minimal mock object", () => {
    const hints: AgentRuntimeHints = {
      allowSyntheticToolResults: true,
      enforceFinalTag: true,
    };
    const mock: AgentRuntime = {
      subscribe: () => () => {},
      prompt: async () => {},
      steer: async () => {},
      abort: () => {},
      abortCompaction: () => {},
      dispose: () => {},
      replaceMessages: () => {},
      isStreaming: false,
      isCompacting: false,
      messages: [],
      sessionId: "test-session",
      runtimeHints: hints,
    };
    expect(mock.runtimeHints.allowSyntheticToolResults).toBe(true);
    expect(mock.runtimeHints.enforceFinalTag).toBe(true);
    expect(mock.sessionId).toBe("test-session");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/agent-runtime.test.ts`
Expected: FAIL — module `./agent-runtime.js` not found

**Step 3: Write the interface**

```typescript
// src/agents/agent-runtime.ts
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { EmbeddedPiSubscribeEvent } from "./pi-embedded-subscribe.handlers.types.js";

export interface AgentRuntime {
  subscribe(handler: (evt: EmbeddedPiSubscribeEvent) => void): () => void;
  prompt(
    text: string,
    options?: { images?: Array<{ type: string; media_type: string; data: string }> },
  ): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  abortCompaction(): void;
  dispose(): void;
  replaceMessages(messages: AgentMessage[]): void;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly messages: AgentMessage[];
  readonly sessionId: string;
  readonly runtimeHints: AgentRuntimeHints;
}

export interface AgentRuntimeHints {
  /** Whether to allow synthetic tool result repair in SessionManager. */
  allowSyntheticToolResults: boolean;
  /** Whether to enforce <final> tag extraction. */
  enforceFinalTag: boolean;
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/agents/agent-runtime.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add AgentRuntime interface and AgentRuntimeHints type" \
  src/agents/agent-runtime.ts src/agents/agent-runtime.test.ts
```

---

## Task 2: Add `system-keychain` auth mode for `claude-max` provider

**Files:**

- Modify: `src/agents/model-auth.ts` — add `"system-keychain"` to `ModelAuthMode`, update `resolveModelAuthMode()` and `resolveApiKeyForProvider()`
- Modify: `src/agents/pi-embedded-runner/run.ts` — expand the `aws-sdk` safety check to also allow `system-keychain`
- Test: `src/agents/model-auth.test.ts` — add tests for `claude-max` provider auth resolution

**Step 1: Write the failing test**

Add to `src/agents/model-auth.test.ts` (or create if missing):

```typescript
describe("resolveModelAuthMode", () => {
  it("returns system-keychain for claude-max provider", () => {
    const mode = resolveModelAuthMode("claude-max");
    expect(mode).toBe("system-keychain");
  });
});

describe("resolveApiKeyForProvider", () => {
  it("returns undefined apiKey with system-keychain mode for claude-max", async () => {
    const result = await resolveApiKeyForProvider({
      provider: "claude-max",
      // no store, no config — implicit auth
    });
    expect(result.apiKey).toBeUndefined();
    expect(result.mode).toBe("system-keychain");
    expect(result.source).toContain("system keychain");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/model-auth.test.ts`
Expected: FAIL — `"system-keychain"` not in ModelAuthMode / not returned

**Step 3: Add `system-keychain` to `ModelAuthMode`**

In `src/agents/model-auth.ts`, find the `ModelAuthMode` type and add `"system-keychain"`:

```typescript
export type ModelAuthMode =
  | "api-key"
  | "oauth"
  | "token"
  | "mixed"
  | "aws-sdk"
  | "system-keychain"
  | "unknown";
```

**Step 4: Update `resolveModelAuthMode()`**

Add an early return for `claude-max` provider:

```typescript
export function resolveModelAuthMode(
  provider?: string,
  cfg?: OpenClawConfig,
  store?: AuthProfileStore,
): ModelAuthMode | undefined {
  // claude-max always uses implicit auth from system keychain (~/.claude/ OAuth).
  // There is NEVER a case where claude-max uses a different auth mode.
  if (provider === "claude-max") return "system-keychain";
  // ... rest of existing logic
}
```

**Step 5: Update `resolveApiKeyForProvider()`**

Add early return before profile/env lookups. This is unconditional — `claude-max` never resolves an API key:

```typescript
// At the top of resolveApiKeyForProvider(), after parameter extraction:
if (provider === "claude-max") {
  return {
    apiKey: undefined,
    mode: "system-keychain" as const,
    source: "Claude Max (system keychain)",
  };
}
```

**Step 6: Update `run.ts` safety check**

In `src/agents/pi-embedded-runner/run.ts`, find the check (around line 429-434):

```typescript
// Before:
if (!apiKeyInfo.apiKey) {
  if (apiKeyInfo.mode !== "aws-sdk") {
    throw new Error(...);
  }
}

// After:
if (!apiKeyInfo.apiKey) {
  if (apiKeyInfo.mode !== "aws-sdk" && apiKeyInfo.mode !== "system-keychain") {
    throw new Error(...);
  }
}
```

**Step 7: Run tests**

Run: `pnpm vitest run src/agents/model-auth.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
scripts/committer "feat: add system-keychain auth mode for claude-max provider" \
  src/agents/model-auth.ts src/agents/model-auth.test.ts \
  src/agents/pi-embedded-runner/run.ts
```

---

## Task 3: Add `claude-max` stub model and provider-driven runtime resolution

**Files:**

- Create: `src/agents/claude-max-model.ts` — stub `Model<Api>` for `claude-max` provider
- Create: `src/agents/claude-max-model.test.ts`
- Modify: `src/agents/pi-embedded-runner/model.ts` — recognize `claude-max` in `resolveModel()`

**Step 1: Write the failing test**

```typescript
// src/agents/claude-max-model.test.ts
import { describe, expect, it } from "vitest";
import { createClaudeMaxStubModel } from "./claude-max-model.js";

describe("createClaudeMaxStubModel", () => {
  it("returns a Model-like object with the given modelId", () => {
    const model = createClaudeMaxStubModel("claude-sonnet-4-20250514");
    expect(model.provider).toBe("claude-max");
    expect(model.id).toBe("claude-sonnet-4-20250514");
    expect(model.contextWindow).toBeGreaterThan(0);
    expect(model.api).toBe("anthropic");
  });

  it("defaults context window to 200000", () => {
    const model = createClaudeMaxStubModel("claude-opus-4-6");
    expect(model.contextWindow).toBe(200_000);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/claude-max-model.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the stub model factory**

Read `src/agents/pi-embedded-runner/model.ts` to understand the `Model<Api>` shape, then create:

```typescript
// src/agents/claude-max-model.ts
import type { Api, Model } from "@mariozechner/pi-ai";

const DEFAULT_CONTEXT_WINDOW = 200_000;

/**
 * Creates a stub Model<Api> for the claude-max provider.
 * The Claude SDK subprocess handles actual model resolution;
 * this stub carries the model ID and context window through the pipeline.
 */
export function createClaudeMaxStubModel(modelId: string): Model<Api> {
  return {
    provider: "claude-max",
    id: modelId,
    name: modelId,
    api: "anthropic" as Api,
    contextWindow: DEFAULT_CONTEXT_WINDOW,
    maxTokens: DEFAULT_CONTEXT_WINDOW,
    reasoning: true,
    input: ["text", "image"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  } as Model<Api>;
}
```

Note: The exact `Model<Api>` shape must be verified by reading the type from `@mariozechner/pi-ai`. The above is based on the `ModelDefinitionConfig` fields. Adjust fields to match the actual type.

**Step 4: Wire into `resolveModel()`**

In `src/agents/pi-embedded-runner/model.ts`, add an early return:

```typescript
import { createClaudeMaxStubModel } from "../../claude-max-model.js";

export function resolveModel(provider, modelId, agentDir, cfg) {
  // claude-max: subprocess handles model resolution; return stub
  if (provider === "claude-max") {
    return {
      model: createClaudeMaxStubModel(modelId),
      authStorage: /* create minimal auth storage */,
      modelRegistry: /* create minimal registry */,
    };
  }
  // ... rest of existing logic
}
```

**Step 5: Run tests**

Run: `pnpm vitest run src/agents/claude-max-model.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
scripts/committer "feat: add claude-max stub model for provider-driven runtime" \
  src/agents/claude-max-model.ts src/agents/claude-max-model.test.ts \
  src/agents/pi-embedded-runner/model.ts
```

---

## Task 4: Add config schema changes (ClaudeSdkConfigSchema, remove `runtime` field)

**Files:**

- Modify: `src/config/zod-schema.agent-runtime.ts` — add `ClaudeSdkConfigSchema`, add `claudeSdk` to `AgentEntrySchema` (no `runtime` field)
- Modify: `src/config/zod-schema.agent-defaults.ts` — add `claudeSdk` to `AgentDefaultsSchema`
- Modify: `src/config/types.agents.ts` — add `claudeSdk` type
- Modify: `src/config/types.agent-defaults.ts` — add `claudeSdk` type

**Step 1: Add `ClaudeSdkConfigSchema` to `zod-schema.agent-runtime.ts`**

Port from `dgarson/fork` — add at the top of the file, before `HeartbeatSchema`:

```typescript
// ---------------------------------------------------------------------------
// Claude SDK runtime config
// ---------------------------------------------------------------------------

const thinkingDefaultsField = {
  thinkingDefault: z.enum(["none", "low", "medium", "high"]).optional(),
  /** @deprecated Use thinkingDefault instead. */
  thinkingLevel: z.enum(["none", "low", "medium", "high"]).optional(),
} as const;

export const ClaudeSdkConfigSchema = z
  .discriminatedUnion("provider", [
    z.object({ provider: z.literal("claude-sdk"), ...thinkingDefaultsField }).strict(),
    z.object({ provider: z.literal("anthropic"), ...thinkingDefaultsField }).strict(),
    z.object({ provider: z.literal("minimax"), ...thinkingDefaultsField }).strict(),
    z.object({ provider: z.literal("minimax-portal"), ...thinkingDefaultsField }).strict(),
    z.object({ provider: z.literal("zai"), ...thinkingDefaultsField }).strict(),
    z.object({ provider: z.literal("openrouter"), ...thinkingDefaultsField }).strict(),
    z
      .object({
        provider: z.literal("custom"),
        baseUrl: z.string().url(),
        apiKey: z.string().optional().register(sensitive),
        ...thinkingDefaultsField,
      })
      .strict(),
  ])
  .superRefine((val, ctx) => {
    if (!val?.thinkingDefault || !val.thinkingLevel) return;
    if (val.thinkingDefault !== val.thinkingLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["thinkingDefault"],
        message: "thinkingDefault and thinkingLevel must match when both are set",
      });
    }
  })
  .optional();

export type ClaudeSdkConfig = NonNullable<z.infer<typeof ClaudeSdkConfigSchema>>;
```

**Step 2: Add `claudeSdk` to `AgentEntrySchema`**

Inside the `.object({...})` block, add:

```typescript
claudeSdk: z.union([ClaudeSdkConfigSchema, z.literal(false)]).optional(),
```

Note: `z.literal(false)` allows per-agent opt-out when defaults enable Claude SDK.

**Step 3: Add same field to `AgentDefaultsSchema`**

In `src/config/zod-schema.agent-defaults.ts`, add:

```typescript
claudeSdk: ClaudeSdkConfigSchema,
```

(No `z.literal(false)` needed at the defaults level — only agents opt out.)

**Step 4: Update TypeScript types**

In `src/config/types.agents.ts`:

```typescript
import type { ClaudeSdkConfig } from "./zod-schema.agent-runtime.js";
// Add to agent config type:
claudeSdk?: ClaudeSdkConfig | false;
```

In `src/config/types.agent-defaults.ts`:

```typescript
claudeSdk?: ClaudeSdkConfig;
```

**Step 5: Run typecheck**

Run: `pnpm tsgo`
Expected: PASS (no type errors)

**Step 6: Commit**

```bash
scripts/committer "feat: add ClaudeSdkConfigSchema and claudeSdk field to agent config" \
  src/config/zod-schema.agent-runtime.ts \
  src/config/zod-schema.agent-defaults.ts \
  src/config/types.agents.ts \
  src/config/types.agent-defaults.ts
```

---

## Task 5: Port the Claude SDK runner module from `dgarson/fork`

**Files (all new — port from fork):**

- Create: `src/agents/claude-sdk-runner/index.ts`
- Create: `src/agents/claude-sdk-runner/types.ts`
- Create: `src/agents/claude-sdk-runner/create-session.ts`
- Create: `src/agents/claude-sdk-runner/prepare-session.ts`
- Create: `src/agents/claude-sdk-runner/event-adapter.ts`
- Create: `src/agents/claude-sdk-runner/mcp-tool-server.ts`
- Create: `src/agents/claude-sdk-runner/provider-env.ts`
- Create: `src/agents/claude-sdk-runner/schema-adapter.ts`
- Create: `src/agents/claude-sdk-runner/error-mapping.ts`
- Create: `src/agents/claude-sdk-runner/spawn-stdout-logging.ts`

**Step 1: Extract all files from fork**

For each file, run:

```bash
git show dgarson/fork:src/agents/claude-sdk-runner/<file> > src/agents/claude-sdk-runner/<file>
```

**Step 2: Modify `types.ts` — implement `AgentRuntime`**

Update `ClaudeSdkSession` type to extend `AgentRuntime`:

```typescript
import type { AgentRuntime, AgentRuntimeHints } from "../agent-runtime.js";

export type ClaudeSdkSession = AgentRuntime & {
  /** Claude Agent SDK server-side session ID, set after first prompt. */
  readonly claudeSdkSessionId: string | undefined;
};
```

Remove the `.agent` shim from the type — `replaceMessages` and `runtimeHints` are now top-level via `AgentRuntime`.

**Step 3: Modify `create-session.ts` — add `replaceMessages` and `runtimeHints` to session object**

In the session object returned by `createClaudeSdkSession()`:

```typescript
// Replace the old agent shim:
//   agent: { streamFn: undefined, replaceMessages(msgs) { ... } }
// With top-level methods:
replaceMessages(messages: AgentMessage[]) {
  state.messages = [...messages];
},

runtimeHints: {
  allowSyntheticToolResults: false,
  enforceFinalTag: false,
} satisfies AgentRuntimeHints,
```

**Step 4: Verify typecheck**

Run: `pnpm tsgo`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: port claude-sdk-runner module from dgarson/fork" \
  src/agents/claude-sdk-runner/index.ts \
  src/agents/claude-sdk-runner/types.ts \
  src/agents/claude-sdk-runner/create-session.ts \
  src/agents/claude-sdk-runner/prepare-session.ts \
  src/agents/claude-sdk-runner/event-adapter.ts \
  src/agents/claude-sdk-runner/mcp-tool-server.ts \
  src/agents/claude-sdk-runner/provider-env.ts \
  src/agents/claude-sdk-runner/schema-adapter.ts \
  src/agents/claude-sdk-runner/error-mapping.ts \
  src/agents/claude-sdk-runner/spawn-stdout-logging.ts
```

---

## Task 6: Port Claude SDK runner tests from `dgarson/fork`

**Files (all new — port from fork):**

- Create: `src/agents/claude-sdk-runner/__tests__/session-lifecycle.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/event-contract.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/mcp-tool-server.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/schema-adapter.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/error-mapping.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/provider-env.test.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/spawn-stdout-logging.test.ts`

**Step 1: Extract all test files from fork**

```bash
mkdir -p src/agents/claude-sdk-runner/__tests__
for f in session-lifecycle event-contract mcp-tool-server schema-adapter error-mapping provider-env spawn-stdout-logging; do
  git show "dgarson/fork:src/agents/claude-sdk-runner/__tests__/${f}.test.ts" > "src/agents/claude-sdk-runner/__tests__/${f}.test.ts"
done
```

**Step 2: Update tests that reference the old `.agent` shim**

In `session-lifecycle.test.ts`, find tests that access `session.agent.replaceMessages()` or `session.agent.streamFn` and update to use `session.replaceMessages()` directly.

**Step 3: Run the tests**

Run: `pnpm vitest run src/agents/claude-sdk-runner/__tests__/`
Expected: All PASS (may need import path adjustments)

**Step 4: Commit**

```bash
scripts/committer "test: port claude-sdk-runner tests from dgarson/fork" \
  src/agents/claude-sdk-runner/__tests__/
```

---

## Task 7: Create `PiRuntimeAdapter`

**Files:**

- Create: `src/agents/pi-embedded-runner/pi-runtime-adapter.ts`
- Test: `src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts`

**Step 1: Write the failing test**

```typescript
// src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts
import { describe, expect, it, vi } from "vitest";
import type { AgentRuntime } from "../../agent-runtime.js";

describe("PiRuntimeAdapter", () => {
  it("implements AgentRuntime interface", async () => {
    // This test verifies the adapter satisfies the interface at the type level
    // and delegates core methods to the wrapped session.
    const { createPiRuntimeAdapter } = await import("./pi-runtime-adapter.js");

    const mockSession = {
      subscribe: vi.fn(() => vi.fn()),
      prompt: vi.fn(async () => {}),
      steer: vi.fn(async () => {}),
      abort: vi.fn(),
      abortCompaction: vi.fn(),
      dispose: vi.fn(),
      isStreaming: false,
      isCompacting: false,
      messages: [],
      sessionId: "test-session",
      agent: {
        streamFn: vi.fn(),
        replaceMessages: vi.fn(),
      },
    };

    const adapter: AgentRuntime = createPiRuntimeAdapter({
      session: mockSession as any,
      runtimeHints: {
        allowSyntheticToolResults: true,
        enforceFinalTag: true,
      },
    });

    expect(adapter.sessionId).toBe("test-session");
    expect(adapter.runtimeHints.allowSyntheticToolResults).toBe(true);
    expect(adapter.runtimeHints.enforceFinalTag).toBe(true);

    adapter.replaceMessages([]);
    expect(mockSession.agent.replaceMessages).toHaveBeenCalledWith([]);

    adapter.abort();
    expect(mockSession.abort).toHaveBeenCalled();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the adapter**

```typescript
// src/agents/pi-embedded-runner/pi-runtime-adapter.ts
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { AgentRuntime, AgentRuntimeHints } from "../../agents/agent-runtime.js";
import type { EmbeddedPiSubscribeEvent } from "../pi-embedded-subscribe.handlers.types.js";

type PiAgentSession = {
  subscribe(handler: (evt: EmbeddedPiSubscribeEvent) => void): () => void;
  prompt(
    text: string,
    options?: { images?: Array<{ type: string; media_type: string; data: string }> },
  ): Promise<void>;
  steer(text: string): Promise<void>;
  abort(): void;
  abortCompaction(): void;
  dispose(): void;
  readonly isStreaming: boolean;
  readonly isCompacting: boolean;
  readonly messages: AgentMessage[];
  readonly sessionId: string;
  readonly agent: {
    streamFn: unknown;
    replaceMessages(messages: AgentMessage[]): void;
  };
};

export type PiRuntimeAdapterParams = {
  session: PiAgentSession;
  runtimeHints: AgentRuntimeHints;
};

export function createPiRuntimeAdapter(params: PiRuntimeAdapterParams): AgentRuntime {
  const { session, runtimeHints } = params;
  return {
    subscribe: (handler) => session.subscribe(handler),
    prompt: (text, options) => session.prompt(text, options),
    steer: (text) => session.steer(text),
    abort: () => session.abort(),
    abortCompaction: () => session.abortCompaction(),
    dispose: () => session.dispose(),
    replaceMessages: (messages) => session.agent.replaceMessages(messages),
    get isStreaming() {
      return session.isStreaming;
    },
    get isCompacting() {
      return session.isCompacting;
    },
    get messages() {
      return session.messages;
    },
    get sessionId() {
      return session.sessionId;
    },
    runtimeHints,
  };
}
```

Note: The streamFn wiring (Ollama, extra params, cache tracing, thinking drops, tool call ID sanitization, payload logging) stays in `attempt.ts` for now — it operates on `session.agent.streamFn` before the adapter wraps the session. Moving that wiring into the adapter is a follow-up refactor, not required for the initial interface unification.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
scripts/committer "feat: add PiRuntimeAdapter wrapping AgentSession as AgentRuntime" \
  src/agents/pi-embedded-runner/pi-runtime-adapter.ts \
  src/agents/pi-embedded-runner/pi-runtime-adapter.test.ts
```

---

## Task 8: Widen `SubscribeEmbeddedPiSessionParams.session` type

**Files:**

- Modify: `src/agents/pi-embedded-subscribe.types.ts` — change `session: AgentSession` to accept `AgentRuntime`

**Step 1: Update the session param type**

The current type:

```typescript
session: AgentSession;
```

`subscribeEmbeddedPiSession()` only uses `.subscribe()`, `.isCompacting`, and `.abortCompaction()` from the session (verified by grep). Widen to accept both:

```typescript
import type { AgentRuntime } from "./agent-runtime.js";

export type SubscribeEmbeddedPiSessionParams = {
  session: AgentRuntime;
  // ... rest unchanged
};
```

This works because `AgentRuntime` has all three methods. `AgentSession` (Pi) is still assignable to `AgentRuntime` through the adapter.

**Step 2: Run typecheck**

Run: `pnpm tsgo`
Expected: PASS — `AgentRuntime` is a superset of what the subscribe function uses

**Step 3: Run existing subscribe tests**

Run: `pnpm vitest run src/agents/pi-embedded-subscribe`
Expected: All PASS (existing tests pass mock objects that satisfy the interface)

**Step 4: Commit**

```bash
scripts/committer "refactor: widen subscribe session param to accept AgentRuntime" \
  src/agents/pi-embedded-subscribe.types.ts
```

---

## Task 9: Refactor `attempt.ts` — factory dispatch

**Files:**

- Modify: `src/agents/pi-embedded-runner/run/attempt.ts` — replace runtime branches with factory dispatch
- Modify: `src/agents/pi-embedded-runner/run/params.ts` — add `resolvedProviderAuth` (from fork)
- Modify: `src/agents/pi-embedded-runner/run/types.ts` — add `resolvedProviderAuth` (from fork)

**This is the most complex task. Read through carefully before implementing.**

**Step 1: Add runtime resolution function**

At the top of `attempt.ts` (replacing the fork's `resolveAgentRuntime`):

```typescript
import type { AgentRuntime } from "../../agent-runtime.js";
import type { ClaudeSdkConfig } from "../../../config/zod-schema.agent-runtime.js";
import { createPiRuntimeAdapter } from "../pi-runtime-adapter.js";
import { prepareClaudeSdkSession } from "../../claude-sdk-runner/prepare-session.js";

const CLAUDE_SDK_PROVIDERS = new Set(["claude-max"]);

function resolveClaudeSdkConfig(params: EmbeddedRunAttemptParams): ClaudeSdkConfig | undefined {
  const agentEntry = params.config?.agents?.list?.find((a) => a.id === params.agentId);
  // Per-agent explicit disable
  if (agentEntry?.claudeSdk === false) return undefined;
  // Per-agent > defaults > undefined (= Pi)
  return agentEntry?.claudeSdk || params.config?.agents?.defaults?.claudeSdk || undefined;
}

function resolveRuntime(params: EmbeddedRunAttemptParams): "pi" | "claude-sdk" {
  if (CLAUDE_SDK_PROVIDERS.has(params.provider)) return "claude-sdk";
  if (resolveClaudeSdkConfig(params)) return "claude-sdk";
  return "pi";
}
```

**Step 2: Replace the session creation block**

Find the current session creation (~line 687-699) and replace with:

```typescript
const runtime = resolveRuntime(params);
const claudeSdkConfig = resolveClaudeSdkConfig(params);

let agentRuntime: AgentRuntime;

if (runtime === "claude-sdk") {
  const claudeSdkSession = await prepareClaudeSdkSession(
    params,
    claudeSdkConfig ?? { provider: "claude-sdk" as const },
    sessionManager,
    resolvedWorkspace,
    agentDir,
    systemPromptText,
    builtInTools,
    allCustomTools,
  );
  agentRuntime = claudeSdkSession; // ClaudeSdkSession implements AgentRuntime
} else {
  ({ session } = await createAgentSession({
    cwd: resolvedWorkspace,
    agentDir,
    authStorage: params.authStorage,
    modelRegistry: params.modelRegistry,
    model: params.model,
    thinkingLevel: mapThinkingLevel(params.thinkLevel),
    tools: builtInTools,
    customTools: allCustomTools,
    sessionManager,
    settingsManager,
    resourceLoader,
  }));
  applySystemPromptOverrideToSession(session, systemPromptText);

  // ... existing Pi streamFn wiring stays here (unchanged) ...

  const transcriptPolicyHints = {
    allowSyntheticToolResults: transcriptPolicy.allowSyntheticToolResults,
    enforceFinalTag: params.enforceFinalTag ?? false,
  };
  agentRuntime = createPiRuntimeAdapter({
    session,
    runtimeHints: transcriptPolicyHints,
  });
}
```

**Step 3: Replace all downstream `session`/`activeSession` references**

After the factory block, all code uses `agentRuntime` instead of `activeSession`:

- `subscribeEmbeddedPiSession({ session: agentRuntime, ... })`
- `enforceFinalTag: agentRuntime.runtimeHints.enforceFinalTag`
- `agentRuntime.isStreaming`, `agentRuntime.isCompacting`
- `agentRuntime.abort()`, `agentRuntime.steer()`, `agentRuntime.prompt()`
- `agentRuntime.messages`, `agentRuntime.sessionId`
- `agentRuntime.replaceMessages(limited)` (instead of `activeSession.agent.replaceMessages()`)
- `agentRuntime.dispose()`

**Step 4: Update SessionManager creation**

```typescript
sessionManager = guardSessionManager(SessionManager.open(params.sessionFile), {
  agentId: sessionAgentId,
  sessionKey: params.sessionKey,
  inputProvenance: params.inputProvenance,
  allowSyntheticToolResults: agentRuntime.runtimeHints.allowSyntheticToolResults,
  allowedToolNames,
});
```

Note: `sessionManager` is created before the factory dispatch (it's needed by `prepareClaudeSdkSession`). The `allowSyntheticToolResults` value must be determined earlier — use `resolveRuntime()` and the transcript policy to compute it before the factory call.

**Step 5: Run typecheck**

Run: `pnpm tsgo`
Expected: Fix any type errors from the refactor

**Step 6: Run full test suite**

Run: `pnpm vitest run src/agents/pi-embedded-runner/`
Expected: All existing tests PASS

**Step 7: Commit**

```bash
scripts/committer "refactor: replace runtime branches in attempt.ts with AgentRuntime factory dispatch" \
  src/agents/pi-embedded-runner/run/attempt.ts \
  src/agents/pi-embedded-runner/run/params.ts \
  src/agents/pi-embedded-runner/run/types.ts
```

---

## Task 10: Wire `runtime` through `run.ts` without `runtime` param

**Files:**

- Modify: `src/agents/pi-embedded-runner/run.ts` — handle `claude-max` provider in model resolution and auth
- Modify: `src/agents/pi-embedded-runner/run/params.ts` — remove `runtime` field from params (if added)

**Step 1: Add claude-max provider handling in `run.ts`**

In the model resolution section, add early handling for `claude-max`:

```typescript
import { createClaudeMaxStubModel } from "../../claude-max-model.js";

// Before resolveModel() call:
if (CLAUDE_SDK_PROVIDERS.has(provider)) {
  model = createClaudeMaxStubModel(modelId);
  // Skip normal auth resolution — system-keychain mode
}
```

**Step 2: Handle `resolvedProviderAuth` passthrough**

When runtime is `claude-sdk` with a non-`claude-max` SDK provider (e.g. `anthropic` via `claudeSdk.provider`), the resolved API key must be passed through to `prepareClaudeSdkSession`. Add `resolvedProviderAuth` to `EmbeddedRunAttemptParams`:

```typescript
// In run/types.ts (ported from fork):
import type { ResolvedProviderAuth } from "../../model-auth.js";

export type EmbeddedRunAttemptParams = EmbeddedRunAttemptBase & {
  // ... existing fields ...
  resolvedProviderAuth?: ResolvedProviderAuth;
};
```

**Step 3: Run typecheck + tests**

Run: `pnpm tsgo && pnpm vitest run src/agents/pi-embedded-runner/`
Expected: PASS

**Step 4: Commit**

```bash
scripts/committer "feat: wire claude-max provider through run.ts model/auth resolution" \
  src/agents/pi-embedded-runner/run.ts \
  src/agents/pi-embedded-runner/run/params.ts
```

---

## Task 11: Full typecheck and test suite

**Step 1: Run full typecheck**

Run: `pnpm tsgo`
Expected: PASS — no type errors

**Step 2: Run full test suite**

Run: `pnpm test`
Expected: All tests PASS

**Step 3: Run lint/format**

Run: `pnpm check && pnpm format`
Fix any issues.

**Step 4: Final commit (if lint/format fixes needed)**

```bash
scripts/committer "chore: fix lint/format after agent runtime refactor" <files...>
```

---

## Task ordering and dependencies

```
Task 1 (AgentRuntime interface)
    ↓
Task 2 (system-keychain auth) ──────────┐
    ↓                                    │
Task 3 (claude-max stub model) ─────── │
    ↓                                    │
Task 4 (config schema) ─────────────────┤
    ↓                                    │
Task 5 (port SDK runner module) ←───────┘
    ↓
Task 6 (port SDK runner tests)
    ↓
Task 7 (PiRuntimeAdapter)
    ↓
Task 8 (widen subscribe session type)
    ↓
Task 9 (refactor attempt.ts) ← most complex, depends on everything above
    ↓
Task 10 (wire run.ts)
    ↓
Task 11 (full typecheck + test suite)
```

Tasks 2, 3, and 4 are independent of each other and can be parallelized.

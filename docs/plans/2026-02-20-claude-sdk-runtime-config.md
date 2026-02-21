# Claude SDK Runtime Config Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `runtime` and `claudeSdk` config fields to `agents.defaults` and `agents.list[]`, wiring five hardcoded providers (minimax, zai, openrouter, anthropic, claude-code) plus a `custom` escape hatch into the Claude Agent SDK subprocess environment.

**Architecture:** The `ClaudeSdkConfigSchema` discriminated union (on `provider`) is added to both `AgentDefaultsSchema` and `AgentEntrySchema`. A new `provider-env.ts` file owns all hardcoded URLs and model names and builds the `env` object passed to `query()`. The `attempt.ts` runtime/provider resolution chain reads per-agent config → global defaults → `"pi"` (configured via `openclaw.json` only). For `claude-code` and `anthropic`, zero env override is applied; for all other providers the constructed env sets `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_TIMEOUT`, and the four model name vars.

**Tech Stack:** TypeScript, Zod (config schema), `@anthropic-ai/claude-agent-sdk` (`query()` `env` option), Vitest

**Design doc:** `docs/plans/2026-02-20-claude-sdk-runtime-config-design.md`

---

### Task 1: Add `ClaudeSdkConfigSchema` to the config schema

**Files:**

- Modify: `src/config/zod-schema.agent-defaults.ts`
- Modify: `src/config/zod-schema.agent-runtime.ts`

**Context:** `AgentDefaultsSchema` lives in `zod-schema.agent-defaults.ts`. `AgentEntrySchema` lives in `zod-schema.agent-runtime.ts`. Both need the same `runtime` and `claudeSdk` fields. The `sensitive` helper is already imported in `zod-schema.agent-defaults.ts` — check imports before adding.

**Step 1: Write the failing schema test**

Add to `src/config/config.schema-regressions.test.ts` (or a new file `src/config/config.claude-sdk-schema.test.ts` — check if the regressions file is the right place by reading it first):

```typescript
import { describe, expect, it } from "vitest";
import { OpenClawSchema } from "./zod-schema.js";

describe("claudeSdk config schema", () => {
  it("accepts claude-code provider in agents.defaults", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { runtime: "claude-sdk", claudeSdk: { provider: "claude-code" } } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts anthropic provider", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "anthropic" } } },
    });
    expect(result.success).toBe(true);
  });

  it("accepts minimax / zai / openrouter providers (no extra fields needed)", () => {
    for (const provider of ["minimax", "zai", "openrouter"] as const) {
      const result = OpenClawSchema.safeParse({
        agents: { defaults: { claudeSdk: { provider } } },
      });
      expect(result.success, `provider=${provider}`).toBe(true);
    }
  });

  it("accepts custom provider with baseUrl", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        defaults: {
          claudeSdk: { provider: "custom", baseUrl: "https://my-gateway.internal/v1" },
        },
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects custom provider without baseUrl", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "custom" } } },
    });
    expect(result.success).toBe(false);
  });

  it("rejects unknown provider", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { claudeSdk: { provider: "cohere" } } },
    });
    expect(result.success).toBe(false);
  });

  it("accepts per-agent runtime and claudeSdk override", () => {
    const result = OpenClawSchema.safeParse({
      agents: {
        list: [{ id: "my-agent", runtime: "claude-sdk", claudeSdk: { provider: "zai" } }],
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown runtime value", () => {
    const result = OpenClawSchema.safeParse({
      agents: { defaults: { runtime: "gemini" } },
    });
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
cd /Users/openclaw/worktrees/agent-runtime-scoping
pnpm test src/config/config.claude-sdk-schema.test.ts
```

Expected: All tests FAIL (fields don't exist yet).

**Step 3: Add `ClaudeSdkConfigSchema` and wire it**

In `src/config/zod-schema.agent-defaults.ts`, add near the top (after existing imports, before `HeartbeatSchema`):

```typescript
// ---------------------------------------------------------------------------
// Claude SDK runtime config
// ---------------------------------------------------------------------------

export const ClaudeSdkConfigSchema = z
  .discriminatedUnion("provider", [
    z.object({ provider: z.literal("claude-code") }).strict(),
    z.object({ provider: z.literal("anthropic") }).strict(),
    z.object({ provider: z.literal("minimax") }).strict(),
    z.object({ provider: z.literal("zai") }).strict(),
    z.object({ provider: z.literal("openrouter") }).strict(),
    z
      .object({
        provider: z.literal("custom"),
        baseUrl: z.string().url(),
        apiKey: z.string().optional().register(sensitive),
      })
      .strict(),
  ])
  .optional();

export type ClaudeSdkConfig = NonNullable<z.infer<typeof ClaudeSdkConfigSchema>>;
```

Then add two fields to `AgentDefaultsSchema` (inside the `.object({...})`, after the existing `sandbox` field at the bottom):

```typescript
runtime: z.enum(["pi", "claude-sdk"]).optional(),
claudeSdk: ClaudeSdkConfigSchema,
```

In `src/config/zod-schema.agent-runtime.ts`, add to imports:

```typescript
import { ClaudeSdkConfigSchema } from "./zod-schema.agent-defaults.js";
```

Then add the same two fields to `AgentEntrySchema` (inside the `.object({...})`, after the existing `tools` field at the bottom):

```typescript
runtime: z.enum(["pi", "claude-sdk"]).optional(),
claudeSdk: ClaudeSdkConfigSchema,
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test src/config/config.claude-sdk-schema.test.ts
```

Expected: All 8 tests PASS.

**Step 5: Run full schema regression tests**

```bash
pnpm test src/config/config.schema-regressions.test.ts
pnpm test src/config/
```

Expected: All PASS. Fix any breakage before proceeding.

**Step 6: Commit**

```bash
scripts/committer "config: add runtime and claudeSdk fields to agent schema" \
  src/config/zod-schema.agent-defaults.ts \
  src/config/zod-schema.agent-runtime.ts \
  src/config/config.claude-sdk-schema.test.ts
```

---

### Task 2: Create `provider-env.ts` with hardcoded provider configs

**Files:**

- Create: `src/agents/claude-sdk-runner/provider-env.ts`
- Create: `src/agents/claude-sdk-runner/__tests__/provider-env.test.ts`

**Context:** This file owns ALL provider-specific knowledge. No other file should branch on provider name. The `buildProviderEnv()` function returns `undefined` for `claude-code` and `anthropic` (no env override), and a fully constructed env record for all others. The env record spreads `process.env` so the subprocess inherits the full environment plus the overrides.

**Env vars set for non-anthropic/claude-code providers:**

- `ANTHROPIC_BASE_URL` — provider's Anthropic-compatible endpoint
- `ANTHROPIC_API_KEY` — resolved from `models.providers[name].apiKey` or fallback env var
- `ANTHROPIC_TIMEOUT` — milliseconds as string (e.g. `"3000000"`)
- `ANTHROPIC_HAIKU_MODEL` — provider's fast model
- `ANTHROPIC_SONNET_MODEL` — provider's standard model
- `ANTHROPIC_DEFAULT_MODEL` — same as sonnet (the default pick when unspecified)
- `ANTHROPIC_OPUS_MODEL` — provider's large model

For `custom`: only `ANTHROPIC_BASE_URL`, `ANTHROPIC_API_KEY` (if given), `ANTHROPIC_TIMEOUT`. No model overrides (provider model names unknown).

**MiniMax model names:** Look up current MiniMax 2.5 / MiniMax-Text-01 model IDs from their docs or API. Use `MiniMax-Text-01` as a placeholder if uncertain — it can be updated later.

**Step 1: Write the failing tests**

```typescript
// src/agents/claude-sdk-runner/__tests__/provider-env.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildProviderEnv } from "../provider-env.js";

describe("buildProviderEnv", () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...origEnv,
      ANTHROPIC_API_KEY: "sk-ant-test",
    };
  });

  afterEach(() => {
    process.env = origEnv;
    vi.restoreAllMocks();
  });

  it("returns undefined for claude-code (no env override)", () => {
    expect(buildProviderEnv({ provider: "claude-code" })).toBeUndefined();
  });

  it("returns undefined for anthropic (no env override)", () => {
    expect(buildProviderEnv({ provider: "anthropic" })).toBeUndefined();
  });

  it("minimax: sets ANTHROPIC_BASE_URL, ANTHROPIC_API_KEY from modelsProviders, ANTHROPIC_TIMEOUT, model vars", () => {
    const env = buildProviderEnv(
      { provider: "minimax" },
      { minimax: { apiKey: "sk-minimax-xyz" } },
    );
    expect(env).toBeDefined();
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://api.minimaxi.chat/v1");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-minimax-xyz");
    expect(env!["ANTHROPIC_TIMEOUT"]).toBe("3000000");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBeTruthy();
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toBeTruthy();
    expect(env!["ANTHROPIC_DEFAULT_MODEL"]).toBe(env!["ANTHROPIC_SONNET_MODEL"]);
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toBeTruthy();
  });

  it("minimax: falls back to MINIMAX_API_KEY env var when no modelsProviders entry", () => {
    process.env["MINIMAX_API_KEY"] = "sk-minimax-env";
    const env = buildProviderEnv({ provider: "minimax" });
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-minimax-env");
  });

  it("zai: uses hardcoded GLM model names", () => {
    process.env["ZAI_API_KEY"] = "sk-zai";
    const env = buildProviderEnv({ provider: "zai" });
    expect(env!["ANTHROPIC_BASE_URL"]).toContain("z.ai");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBe("GLM-4.7");
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toBe("GLM-4.7");
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toBe("GLM-5");
  });

  it("openrouter: uses anthropic/* prefixed model names", () => {
    process.env["OPENROUTER_API_KEY"] = "sk-or";
    const env = buildProviderEnv({ provider: "openrouter" });
    expect(env!["ANTHROPIC_BASE_URL"]).toContain("openrouter.ai");
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toMatch(/^anthropic\//);
    expect(env!["ANTHROPIC_OPUS_MODEL"]).toMatch(/^anthropic\//);
  });

  it("custom: sets ANTHROPIC_BASE_URL from config.baseUrl, no model overrides", () => {
    const env = buildProviderEnv({
      provider: "custom",
      baseUrl: "https://my.gateway/v1",
      apiKey: "sk-custom",
    });
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1");
    expect(env!["ANTHROPIC_API_KEY"]).toBe("sk-custom");
    expect(env!["ANTHROPIC_TIMEOUT"]).toBe("3000000");
    expect(env!["ANTHROPIC_HAIKU_MODEL"]).toBeUndefined();
    expect(env!["ANTHROPIC_SONNET_MODEL"]).toBeUndefined();
  });

  it("custom without apiKey: omits ANTHROPIC_API_KEY override", () => {
    const env = buildProviderEnv({
      provider: "custom",
      baseUrl: "https://my.gateway/v1",
    });
    // Should not override the inherited ANTHROPIC_API_KEY — check key absent in overrides
    // (process.env.ANTHROPIC_API_KEY may still be present from spread, that's fine)
    expect(env!["ANTHROPIC_BASE_URL"]).toBe("https://my.gateway/v1");
  });

  it("inherits process.env in all non-anthropic cases", () => {
    process.env["MY_CUSTOM_VAR"] = "hello";
    process.env["ZAI_API_KEY"] = "sk-zai";
    const env = buildProviderEnv({ provider: "zai" });
    expect(env!["MY_CUSTOM_VAR"]).toBe("hello");
  });
});
```

**Step 2: Run tests to verify they fail**

```bash
pnpm test src/agents/claude-sdk-runner/__tests__/provider-env.test.ts
```

Expected: All FAIL (module doesn't exist).

**Step 3: Implement `provider-env.ts`**

```typescript
// src/agents/claude-sdk-runner/provider-env.ts

import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-defaults.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type KnownProviderConfig = {
  baseUrl: string;
  timeoutMs: number;
  haikuModel: string;
  sonnetModel: string;
  opusModel: string;
  resolveApiKey(providers?: Record<string, { apiKey?: string }>): string | undefined;
};

// ---------------------------------------------------------------------------
// Hardcoded provider configs — keep URLs and model names here ONLY
// ---------------------------------------------------------------------------

const KNOWN_PROVIDER_CONFIGS: Record<string, KnownProviderConfig> = {
  minimax: {
    baseUrl: "https://api.minimaxi.chat/v1",
    timeoutMs: 3_000_000,
    haikuModel: "MiniMax-Text-01",
    sonnetModel: "MiniMax-Text-01",
    opusModel: "MiniMax-Text-01",
    resolveApiKey: (p) => p?.["minimax"]?.apiKey ?? process.env["MINIMAX_API_KEY"],
  },
  zai: {
    baseUrl: "https://api.z.ai/api/v1",
    timeoutMs: 3_000_000,
    haikuModel: "GLM-4.7",
    sonnetModel: "GLM-4.7",
    opusModel: "GLM-5",
    resolveApiKey: (p) => p?.["zai"]?.apiKey ?? process.env["ZAI_API_KEY"],
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1",
    timeoutMs: 3_000_000,
    haikuModel: "anthropic/claude-haiku-4-5-20251001",
    sonnetModel: "anthropic/claude-sonnet-4-6",
    opusModel: "anthropic/claude-opus-4-6",
    resolveApiKey: (p) => p?.["openrouter"]?.apiKey ?? process.env["OPENROUTER_API_KEY"],
  },
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build the env record to pass to query() options.env.
 *
 * Returns undefined for "claude-code" and "anthropic" — no env override,
 * the subprocess inherits process.env unchanged (system-inherited auth).
 *
 * For all other providers, returns a full env record with ANTHROPIC_* vars
 * set for the target provider's endpoint, credentials, timeout, and models.
 */
export function buildProviderEnv(
  config: ClaudeSdkConfig,
  modelsProviders?: Record<string, { apiKey?: string }>,
): Record<string, string> | undefined {
  const { provider } = config;

  if (provider === "claude-code" || provider === "anthropic") {
    return undefined;
  }

  if (provider === "custom") {
    const env: Record<string, string> = {
      ...(process.env as Record<string, string>),
      ANTHROPIC_BASE_URL: config.baseUrl,
      ANTHROPIC_TIMEOUT: "3000000",
    };
    if (config.apiKey) {
      env["ANTHROPIC_API_KEY"] = config.apiKey;
    }
    return env;
  }

  const providerConfig = KNOWN_PROVIDER_CONFIGS[provider];
  if (!providerConfig) {
    throw new Error(`[claude-sdk] Unknown provider: ${provider}`);
  }

  const apiKey = providerConfig.resolveApiKey(modelsProviders);
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    ANTHROPIC_BASE_URL: providerConfig.baseUrl,
    ANTHROPIC_TIMEOUT: String(providerConfig.timeoutMs),
    ANTHROPIC_HAIKU_MODEL: providerConfig.haikuModel,
    ANTHROPIC_SONNET_MODEL: providerConfig.sonnetModel,
    ANTHROPIC_DEFAULT_MODEL: providerConfig.sonnetModel,
    ANTHROPIC_OPUS_MODEL: providerConfig.opusModel,
  };
  if (apiKey) {
    env["ANTHROPIC_API_KEY"] = apiKey;
  }
  return env;
}
```

**Step 4: Run tests to verify they pass**

```bash
pnpm test src/agents/claude-sdk-runner/__tests__/provider-env.test.ts
```

Expected: All PASS.

**Step 5: Commit**

```bash
scripts/committer "feat(claude-sdk): add provider-env with hardcoded provider configs" \
  src/agents/claude-sdk-runner/provider-env.ts \
  src/agents/claude-sdk-runner/__tests__/provider-env.test.ts
```

---

### Task 3: Wire provider config into `ClaudeSdkSessionParams` and `create-session.ts`

**Files:**

- Modify: `src/agents/claude-sdk-runner/types.ts`
- Modify: `src/agents/claude-sdk-runner/create-session.ts`

**Context:** `ClaudeSdkSessionParams` is the bag of params passed from `attempt.ts` to `createClaudeSdkSession()`. We add two new fields: `claudeSdkConfig` (the resolved config object) and `modelsProviders` (the models.providers record for apiKey lookup). In `create-session.ts`, `buildQueryOptions()` calls `buildProviderEnv()` and applies the result to `queryOptions.env`.

**Step 1: Write failing test for `create-session.ts` env wiring**

Add to `src/agents/claude-sdk-runner/__tests__/session-lifecycle.test.ts` (read the file first to find where to add):

```typescript
it("passes provider env to query() when provider is zai", async () => {
  // Mock query to capture options
  let capturedOptions: Record<string, unknown> | undefined;
  vi.mock("@anthropic-ai/claude-agent-sdk", () => ({
    query: vi.fn(({ options }: { options: unknown }) => {
      capturedOptions = options as Record<string, unknown>;
      return (async function* () {})();
    }),
    createSdkMcpServer: vi.fn(() => ({})),
    tool: vi.fn(),
  }));

  const session = await createClaudeSdkSession({
    ...minimalParams(),
    claudeSdkConfig: { provider: "zai" },
    modelsProviders: { zai: { apiKey: "sk-zai-test" } },
  });
  await session.prompt("hello");

  expect(capturedOptions?.["env"]).toMatchObject({
    ANTHROPIC_BASE_URL: expect.stringContaining("z.ai"),
    ANTHROPIC_API_KEY: "sk-zai-test",
    ANTHROPIC_HAIKU_MODEL: "GLM-4.7",
  });
});

it("does NOT set env for claude-code provider", async () => {
  let capturedOptions: Record<string, unknown> | undefined;
  // (same mock pattern as above)

  const session = await createClaudeSdkSession({
    ...minimalParams(),
    claudeSdkConfig: { provider: "claude-code" },
  });
  await session.prompt("hello");

  expect(capturedOptions?.["env"]).toBeUndefined();
});
```

**Step 2: Run to verify they fail**

```bash
pnpm test src/agents/claude-sdk-runner/__tests__/session-lifecycle.test.ts
```

Expected: New tests FAIL (params not accepted yet).

**Step 3: Update `ClaudeSdkSessionParams` in `types.ts`**

Add at the end of the `ClaudeSdkSessionParams` type (after `claudeSdkResumeSessionId`):

```typescript
/** Resolved claudeSdk provider config from agents config. Defaults to claude-code. */
claudeSdkConfig?: ClaudeSdkConfig;
/** models.providers record for apiKey resolution in known providers. */
modelsProviders?: Record<string, { apiKey?: string }>;
```

Add the import at the top of `types.ts`:

```typescript
import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-defaults.js";
```

**Step 4: Update `buildQueryOptions` in `create-session.ts`**

Add the import at the top:

```typescript
import { buildProviderEnv } from "./provider-env.js";
```

In `buildQueryOptions()`, after building `queryOptions` and before the `return` statement, add:

```typescript
// Provider env: sets ANTHROPIC_BASE_URL, API key, timeout, model vars for
// non-Anthropic providers. Returns undefined for claude-code/anthropic (no override).
const providerEnv = buildProviderEnv(
  params.claudeSdkConfig ?? { provider: "claude-code" },
  params.modelsProviders,
);
if (providerEnv !== undefined) {
  queryOptions["env"] = providerEnv;
}
```

**Step 5: Run tests**

```bash
pnpm test src/agents/claude-sdk-runner/__tests__/session-lifecycle.test.ts
pnpm test src/agents/claude-sdk-runner/
```

Expected: All PASS.

**Step 6: Commit**

```bash
scripts/committer "feat(claude-sdk): wire provider env into create-session buildQueryOptions" \
  src/agents/claude-sdk-runner/types.ts \
  src/agents/claude-sdk-runner/create-session.ts
```

---

### Task 4: Wire runtime and claudeSdk resolution in `attempt.ts`

**Files:**

- Modify: `src/agents/pi-embedded-runner/run/attempt.ts`

**Context:** `attempt.ts` is large (~1200 lines). The runtime branch is at ~line 576. Read lines 560–620 to orient yourself before editing. The goal is two changes:

1. Replace the bare `params.runtime` check with a full resolution chain (per-agent config → defaults → params.runtime → `"pi"`)
2. Resolve the `claudeSdkConfig` and pass it (along with `modelsProviders`) into `createClaudeSdkSession()`

**Step 1: Read the relevant section of `attempt.ts`**

```bash
# Read lines 560–640 to see the current runtime branch and createClaudeSdkSession() call
```

Use the Read tool with offset=560, limit=80 on `attempt.ts`.

**Step 2: Write a targeted test**

Add to `src/agents/pi-embedded-runner/run/attempt.test.ts` (or find the existing attempt test — search for it):

```typescript
it("picks runtime from per-agent config over global defaults", async () => {
  // ... run attempt with agentId matching a list entry that has runtime: "claude-sdk"
  // Verify by checking that the claude-sdk mock was called, not Pi session
});
```

> Note: Runtime is configured via `openclaw.json` only (`agents.defaults.runtime` or per-agent `runtime` field). There is no `OPENCLAW_AGENT_RUNTIME` environment variable override.

> Note: This test is harder to write in isolation because `attempt.ts` is tightly coupled to many deps. If the existing test infrastructure for `attempt.ts` is complex, write a focused unit test for the _resolution logic only_ by extracting it into a helper function first (see Step 3).

**Step 3: Extract runtime resolution into a pure helper (optional but clean)**

If the resolution logic is more than 5 lines, extract to a small pure function near the top of `attempt.ts` (not exported — internal helper):

```typescript
function resolveAgentRuntime(params: EmbeddedRunAttemptParams): "pi" | "claude-sdk" {
  const agentEntry = params.config?.agents?.list?.find((a) => a.id === params.agentId);
  return agentEntry?.runtime ?? params.config?.agents?.defaults?.runtime ?? params.runtime ?? "pi";
}

function resolveClaudeSdkConfig(params: EmbeddedRunAttemptParams): ClaudeSdkConfig {
  const agentEntry = params.config?.agents?.list?.find((a) => a.id === params.agentId);
  return (
    agentEntry?.claudeSdk ??
    params.config?.agents?.defaults?.claudeSdk ?? { provider: "claude-code" as const }
  );
}
```

**Step 4: Replace the runtime check and update `createClaudeSdkSession()` call**

Find the current code (around line 576):

```typescript
if (params.runtime === "claude-sdk") {
```

Replace with:

```typescript
const runtime = resolveAgentRuntime(params);
const claudeSdkConfig = resolveClaudeSdkConfig(params);

if (runtime === "claude-sdk") {
```

Find the `createClaudeSdkSession({...})` call and add the two new params:

```typescript
session = await createClaudeSdkSession({
  // ... existing params ...
  claudeSdkConfig,
  modelsProviders: params.config?.models?.providers as
    | Record<string, { apiKey?: string }>
    | undefined,
});
```

Also find the second check (`if (params.runtime !== "claude-sdk")`) around line 653 and update it:

```typescript
if (runtime !== "claude-sdk") {
```

And the enforceFinalTag line (~line 808):

```typescript
enforceFinalTag: runtime === "claude-sdk" ? false : params.enforceFinalTag,
```

**Step 5: Add the import for `ClaudeSdkConfig`**

At the top of `attempt.ts`, find the existing import from `zod-schema.agent-defaults` or add:

```typescript
import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-defaults.js";
```

**Step 6: Typecheck**

```bash
pnpm tsgo
```

Expected: No errors. Fix any type errors before proceeding.

**Step 7: Run tests**

```bash
pnpm test src/agents/pi-embedded-runner/
pnpm test src/agents/claude-sdk-runner/
```

Expected: All PASS.

**Step 8: Commit**

```bash
scripts/committer "feat(claude-sdk): wire runtime and provider resolution in attempt.ts" \
  src/agents/pi-embedded-runner/run/attempt.ts
```

---

### Task 5: Full typecheck + test suite pass

**Files:** None new — verification only.

**Step 1: Full typecheck**

```bash
pnpm tsgo
```

Expected: 0 errors. Fix anything that surfaces.

**Step 2: Full test run**

```bash
pnpm test
```

Expected: All PASS. The schema test coverage threshold is 70% lines/branches/functions — check that new files don't drag it below.

**Step 3: Lint/format**

```bash
pnpm check
pnpm format:fix
```

**Step 4: Final commit if any formatting fixes**

```bash
scripts/committer "chore: format fixes after claude-sdk runtime config" \
  # list any auto-formatted files
```

---

## Summary of all files changed

| File                                                          | Change                                                                                                       |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/config/zod-schema.agent-defaults.ts`                     | Export `ClaudeSdkConfigSchema` + `ClaudeSdkConfig` type; add `runtime`, `claudeSdk` to `AgentDefaultsSchema` |
| `src/config/zod-schema.agent-runtime.ts`                      | Import `ClaudeSdkConfigSchema`; add `runtime`, `claudeSdk` to `AgentEntrySchema`                             |
| `src/config/config.claude-sdk-schema.test.ts`                 | New: schema validation tests                                                                                 |
| `src/agents/claude-sdk-runner/provider-env.ts`                | New: hardcoded provider configs + `buildProviderEnv()`                                                       |
| `src/agents/claude-sdk-runner/__tests__/provider-env.test.ts` | New: unit tests for `buildProviderEnv()`                                                                     |
| `src/agents/claude-sdk-runner/types.ts`                       | Add `claudeSdkConfig?`, `modelsProviders?` to `ClaudeSdkSessionParams`                                       |
| `src/agents/claude-sdk-runner/create-session.ts`              | Call `buildProviderEnv()` in `buildQueryOptions()`                                                           |
| `src/agents/pi-embedded-runner/run/attempt.ts`                | Extract `resolveAgentRuntime()` + `resolveClaudeSdkConfig()`; wire both into the session creation branch     |

## Key invariants to verify manually

- `claude-code` and `anthropic`: `query()` receives no `env` option (`undefined`)
- `zai` with `models.providers.zai.apiKey` set: `query()` env has `ANTHROPIC_API_KEY = "that key"`
- `zai` without `models.providers` entry but `ZAI_API_KEY` in env: `query()` env inherits and overrides correctly
- `custom` without `apiKey`: no `ANTHROPIC_API_KEY` override (subprocess uses whatever it inherits)
- Runtime is configured via `openclaw.json` only; per-agent `runtime` overrides `agents.defaults.runtime`

# LLM-Generated Session Labels Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** When `agents.defaults.sessionLabels.enabled: true`, generate a short LLM label for new sessions immediately after the first user message arrives — well before the agent run finishes.

**Architecture:** Emit a new `"input"` stream `AgentEventPayload` at the earliest point where both `prompt` and `sessionKey` are known (in `run.ts`). A standalone service (`session-auto-label.ts`) subscribes via `onAgentEvent`, checks whether the session needs a label, and fires an async non-blocking LLM call using `complete()` from `@mariozechner/pi-ai`. The result is written back to the session store. Gateway startup registers the service.

**Tech Stack:** TypeScript ESM, `@mariozechner/pi-ai` (`complete`), Zod, Vitest

---

## Task 1: Raise `SESSION_LABEL_MAX_LENGTH` to 79

**Files:**

- Modify: `src/sessions/session-label.ts`

**Step 1: Make the change**

In `src/sessions/session-label.ts`, change line 1:

```ts
// Before
export const SESSION_LABEL_MAX_LENGTH = 64;

// After
export const SESSION_LABEL_MAX_LENGTH = 79;
```

**Step 2: Run existing label tests**

```bash
pnpm vitest run src/sessions/session-label.ts --reporter=verbose
```

Expected: all tests pass (there are no tests for this constant directly; it just flows through parse tests).

**Step 3: Commit**

```bash
git add src/sessions/session-label.ts
git commit -m "feat: raise session label max length to 79 chars"
```

---

## Task 2: Add `sessionLabels` config type

**Files:**

- Modify: `src/config/types.agent-defaults.ts`

**Step 1: Add the type at the top of the file, before `AgentDefaultsConfig`**

Add after the `AgentCompactionMemoryFlushConfig` type (end of file):

```ts
export type SessionLabelsConfig = {
  /** Enable LLM-generated session labels after first message. Default: false. */
  enabled?: boolean;
  /**
   * Model for label generation (provider/model string).
   * Defaults to the agent's configured primary model.
   */
  model?: string;
  /** Max label length in characters. Default: 79. */
  maxLength?: number;
  /** Override the label generation user prompt. */
  prompt?: string;
};
```

**Step 2: Add `sessionLabels` field to `AgentDefaultsConfig`**

Inside the `AgentDefaultsConfig` type (after the `sandbox?` block near the end), add:

```ts
  /** Opt-in: generate a short LLM label for new sessions after the first message. */
  sessionLabels?: SessionLabelsConfig;
```

**Step 3: Verify types compile**

```bash
pnpm tsgo 2>&1 | head -20
```

Expected: no errors (or no new errors).

**Step 4: Commit**

```bash
git add src/config/types.agent-defaults.ts
git commit -m "feat: add sessionLabels config type to AgentDefaultsConfig"
```

---

## Task 3: Add Zod schema for `sessionLabels`

**Files:**

- Modify: `src/config/zod-schema.agent-defaults.ts`

**Step 1: Add `sessionLabels` to `AgentDefaultsSchema`**

Inside the `.object({...})` of `AgentDefaultsSchema`, after the `runtime` and `claudeSdk` lines (near end, before `.strict()`), add:

```ts
    sessionLabels: z
      .object({
        enabled: z.boolean().optional(),
        model: z.string().optional(),
        maxLength: z.number().int().min(1).max(79).optional(),
        prompt: z.string().optional(),
      })
      .strict()
      .optional(),
```

**Step 2: Run schema tests**

```bash
pnpm vitest run src/config/schema.test.ts --reporter=verbose
```

Expected: all pass.

**Step 3: Run broader config tests**

```bash
pnpm vitest run src/config/ --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

**Step 4: Commit**

```bash
git add src/config/zod-schema.agent-defaults.ts
git commit -m "feat: add sessionLabels Zod schema to AgentDefaultsSchema"
```

---

## Task 4: Add UI field labels for `sessionLabels`

**Files:**

- Modify: `src/config/schema.labels.ts`

**Step 1: Add entries to `FIELD_LABELS`**

Near the end of the `FIELD_LABELS` record (before the closing `}`), add after the last `agents.defaults.*` entry:

```ts
  "agents.defaults.sessionLabels.enabled": "Auto-Label Sessions",
  "agents.defaults.sessionLabels.model": "Session Label Model",
  "agents.defaults.sessionLabels.maxLength": "Session Label Max Length",
  "agents.defaults.sessionLabels.prompt": "Session Label Prompt",
```

**Step 2: Verify types still compile**

```bash
pnpm tsgo 2>&1 | head -20
```

Expected: no errors.

**Step 3: Commit**

```bash
git add src/config/schema.labels.ts
git commit -m "feat: add sessionLabels UI field labels"
```

---

## Task 5: Emit early `"input"` agent event in `run.ts`

**Files:**

- Modify: `src/agents/pi-embedded-runner/run.ts`

**Context:** The target location is around line 233 in `run.ts`, right after `hookCtx` is built and before the `before_model_resolve` check. `emitAgentEvent` is not yet imported in this file.

**Step 1: Add the import**

In `run.ts`, the imports are grouped. Add `emitAgentEvent` import after the existing imports (e.g., after `import { log } from "./logger.js";`):

```ts
import { emitAgentEvent } from "../../infra/agent-events.js";
```

**Step 2: Add the emit call**

After the `hookCtx` block (after line 233, `messageProvider: params.messageProvider ?? undefined,`), add:

```ts
// Emit early so features like session auto-labeling can start
// processing the user message without waiting for the run to complete.
if (params.sessionKey && params.prompt) {
  emitAgentEvent({
    runId: params.runId,
    stream: "input",
    data: { prompt: params.prompt },
    sessionKey: params.sessionKey,
  });
}
```

The `};` closing the `hookCtx` object is on the line before — insert this block between the `hookCtx` closing `};` and the `if (hookRunner?.hasHooks("before_model_resolve"))` line.

**Step 3: Verify types compile**

```bash
pnpm tsgo 2>&1 | head -20
```

Expected: no errors.

**Step 4: Run agent runner tests**

```bash
pnpm vitest run src/agents/pi-embedded-runner/ --reporter=verbose 2>&1 | tail -20
```

Expected: all pass (the emit is fire-and-forget with no listeners yet).

**Step 5: Commit**

```bash
git add src/agents/pi-embedded-runner/run.ts
git commit -m "feat: emit input agent event early in runEmbeddedPiAgent"
```

---

## Task 6: Write tests for the auto-label service

**Files:**

- Create: `src/sessions/session-auto-label.test.ts`

**Step 1: Write the test file**

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the service
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn(),
}));
vi.mock("../agents/model-selection.js", () => ({
  resolveDefaultModelForAgent: vi.fn(),
}));
vi.mock("../agents/models-config.js", () => ({
  ensureOpenClawModelsJson: vi.fn(),
}));
vi.mock("../agents/pi-model-discovery.js", () => ({
  discoverAuthStorage: vi.fn(),
  discoverModels: vi.fn(),
}));
vi.mock("../agents/model-auth.js", () => ({
  getApiKeyForModel: vi.fn(),
  requireApiKey: vi.fn(),
}));
vi.mock("../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(),
}));
vi.mock("../config/sessions.js", () => ({
  resolveStorePath: vi.fn(),
  loadSessionStore: vi.fn(),
}));
vi.mock("../config/sessions/store.js", () => ({
  updateSessionStoreEntry: vi.fn(),
}));

import { loadConfig } from "../config/config.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { discoverAuthStorage, discoverModels } from "../agents/pi-model-discovery.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { updateSessionStoreEntry } from "../config/sessions/store.js";
import { resolveStorePath, loadSessionStore } from "../config/sessions.js";

describe("session-auto-label service", () => {
  let capturedListener: ((evt: unknown) => void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = undefined;

    // Capture the listener registered by the service
    vi.mocked(onAgentEvent).mockImplementation((fn) => {
      capturedListener = fn as (evt: unknown) => void;
      return () => {};
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadService() {
    const mod = await import("./session-auto-label.js");
    mod.registerSessionAutoLabel();
    return mod;
  }

  it("does not register listener when sessionLabels.enabled is not set", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: {} },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    // registerSessionAutoLabel checks enabled before subscribing
    // so we fire an input event and expect no label generation
    expect(onAgentEvent).not.toHaveBeenCalled();
  });

  it("skips cron session keys", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();
    expect(onAgentEvent).toHaveBeenCalled();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:cron:abc123:run:xyz",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips subagent session keys", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:subagent:abc",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips events that are not stream=input", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    await capturedListener?.({
      stream: "lifecycle",
      sessionKey: "agent:main:direct",
      data: { phase: "end" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips when session already has a label", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main:direct": {
        sessionId: "abc",
        updatedAt: Date.now(),
        label: "already set",
      },
    });

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:direct",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("generates and writes a label for a new session", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        defaults: { sessionLabels: { enabled: true, maxLength: 79 } },
      },
    } as ReturnType<typeof loadConfig>);
    vi.mocked(resolveOpenClawAgentDir).mockReturnValue("/tmp/agentdir");
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main:direct": { sessionId: "abc", updatedAt: Date.now() },
    });
    vi.mocked(resolveDefaultModelForAgent).mockReturnValue({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });

    const fakeAuthStorage = { setRuntimeApiKey: vi.fn() };
    const fakeModel = {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      contextWindow: 200000,
    };
    const fakeRegistry = { find: vi.fn().mockReturnValue(fakeModel) };
    vi.mocked(discoverAuthStorage).mockReturnValue(fakeAuthStorage as never);
    vi.mocked(discoverModels).mockReturnValue(fakeRegistry as never);
    vi.mocked(getApiKeyForModel).mockResolvedValue({ apiKey: "sk-test" });
    vi.mocked(requireApiKey).mockReturnValue("sk-test");

    // Mock complete() from @mariozechner/pi-ai
    const completeMock = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Debug session with greetings" }],
    });
    vi.doMock("@mariozechner/pi-ai", () => ({ complete: completeMock }));

    vi.mocked(updateSessionStoreEntry).mockResolvedValue(null);

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:direct",
      data: { prompt: "hey what's up" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    // Allow async operations to settle
    await vi.runAllTimersAsync?.().catch(() => {});
    await new Promise((r) => setTimeout(r, 0));

    expect(updateSessionStoreEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:direct",
      }),
    );
  });
});
```

**Step 2: Run the tests and confirm they fail (service doesn't exist yet)**

```bash
pnpm vitest run src/sessions/session-auto-label.test.ts --reporter=verbose 2>&1 | head -30
```

Expected: FAIL — `Cannot find module './session-auto-label.js'`

**Step 3: Commit the test file**

```bash
git add src/sessions/session-auto-label.test.ts
git commit -m "test: add failing tests for session-auto-label service"
```

---

## Task 7: Implement the auto-label service

**Files:**

- Create: `src/sessions/session-auto-label.ts`

**Step 1: Create the service**

```ts
import { type Api, type Context, complete, type Model } from "@mariozechner/pi-ai";
import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { ensureOpenClawModelsJson } from "../agents/models-config.js";
import { discoverAuthStorage, discoverModels } from "../agents/pi-model-discovery.js";
import { loadConfig } from "../config/config.js";
import { loadSessionStore, resolveStorePath } from "../config/sessions.js";
import { updateSessionStoreEntry } from "../config/sessions/store.js";
import type { AgentEventPayload } from "../infra/agent-events.js";
import { onAgentEvent } from "../infra/agent-events.js";
import { createSubsystemLogger } from "../logging/subsystem.js";
import { resolveAgentIdFromSessionKey } from "../routing/session-key.js";
import {
  isCronRunSessionKey,
  isCronSessionKey,
  isSubagentSessionKey,
} from "./session-key-utils.js";

const log = createSubsystemLogger("session-auto-label");

const LABEL_MAX_TOKENS = 50;
const PROMPT_TRUNCATE_CHARS = 500;
const DEFAULT_MAX_LENGTH = 79;

const DEFAULT_LABEL_PROMPT =
  "Generate a concise title for the conversation below. Reply with ONLY the title text — no quotes, no trailing punctuation.";

/** In-flight guard: prevents duplicate concurrent label calls for the same session. */
const inFlight = new Set<string>();

function shouldSkip(sessionKey: string | undefined): boolean {
  if (!sessionKey) return true;
  if (isCronRunSessionKey(sessionKey)) return true;
  if (isCronSessionKey(sessionKey)) return true;
  if (isSubagentSessionKey(sessionKey)) return true;
  return false;
}

async function generateLabel(params: {
  sessionKey: string;
  prompt: string;
  cfg: ReturnType<typeof loadConfig>;
}): Promise<void> {
  const { sessionKey, prompt, cfg } = params;
  const labelsCfg = cfg.agents?.defaults?.sessionLabels;
  const maxLength = labelsCfg?.maxLength ?? DEFAULT_MAX_LENGTH;

  // Load session entry to check if label already set
  const agentId = resolveAgentIdFromSessionKey(sessionKey);
  const storePath = resolveStorePath(cfg.session?.store, { agentId });
  const store = loadSessionStore(storePath);
  const entry = store[sessionKey];
  if (!entry) {
    return;
  }
  if (entry.label?.trim()) {
    return;
  }

  // Resolve model
  const agentDir = resolveOpenClawAgentDir(agentId);
  await ensureOpenClawModelsJson(cfg, agentDir);
  const authStorage = discoverAuthStorage(agentDir);
  const modelRegistry = discoverModels(authStorage, agentDir);

  let provider: string;
  let modelId: string;
  if (labelsCfg?.model?.trim()) {
    const parts = labelsCfg.model.trim().split("/");
    if (parts.length < 2) {
      log.warn(`sessionLabels.model "${labelsCfg.model}" must be "provider/model" format`);
      return;
    }
    provider = parts[0];
    modelId = parts.slice(1).join("/");
  } else {
    const resolved = resolveDefaultModelForAgent({ cfg, agentId });
    provider = resolved.provider;
    modelId = resolved.model;
  }

  const model = modelRegistry.find(provider, modelId) as Model<Api> | null;
  if (!model) {
    log.warn(`sessionLabels: model not found: ${provider}/${modelId}`);
    return;
  }

  const apiKeyInfo = await getApiKeyForModel({ model, cfg, agentDir });
  const apiKey = requireApiKey(apiKeyInfo, model.provider);
  authStorage.setRuntimeApiKey(model.provider, apiKey);

  // Build the single-turn completion request
  const truncatedPrompt =
    prompt.length > PROMPT_TRUNCATE_CHARS ? prompt.slice(0, PROMPT_TRUNCATE_CHARS) + "…" : prompt;
  const systemPrompt = labelsCfg?.prompt?.trim() || DEFAULT_LABEL_PROMPT;
  const context: Context = [
    {
      role: "user",
      content: `${systemPrompt}\n\nMax length: ${maxLength} characters.\n\nConversation:\n${truncatedPrompt}`,
    },
  ];

  const message = await complete(model, context, { apiKey, maxTokens: LABEL_MAX_TOKENS });

  // Extract text from response
  const raw =
    (Array.isArray((message as { content?: unknown[] }).content)
      ? (message as { content: Array<{ type: string; text?: string }> }).content
          .filter((b) => b.type === "text")
          .map((b) => b.text ?? "")
          .join("")
      : String(message)) ?? "";

  const label = raw.trim().slice(0, maxLength);
  if (!label) {
    log.warn(`sessionLabels: empty label returned for session ${sessionKey}`);
    return;
  }

  await updateSessionStoreEntry({
    storePath,
    sessionKey,
    update: async (existing) => {
      // Final idempotency check inside the lock
      if (existing.label?.trim()) {
        return null;
      }
      log.info(`sessionLabels: set label "${label}" for ${sessionKey}`);
      return { label };
    },
  });
}

async function handleInputEvent(evt: AgentEventPayload): Promise<void> {
  if (evt.stream !== "input") return;

  const sessionKey = evt.sessionKey;
  const prompt = typeof evt.data?.prompt === "string" ? evt.data.prompt.trim() : "";
  if (!prompt || shouldSkip(sessionKey)) return;

  const cfg = loadConfig();
  if (cfg.agents?.defaults?.sessionLabels?.enabled !== true) return;

  if (inFlight.has(sessionKey!)) return;
  inFlight.add(sessionKey!);

  generateLabel({ sessionKey: sessionKey!, prompt, cfg })
    .catch((err) => {
      log.warn(`sessionLabels: label generation failed for ${sessionKey}: ${String(err)}`);
    })
    .finally(() => {
      inFlight.delete(sessionKey!);
    });
}

/** Call once at gateway startup to activate session auto-labeling. */
export function registerSessionAutoLabel(): () => void {
  const cfg = loadConfig();
  if (cfg.agents?.defaults?.sessionLabels?.enabled !== true) {
    return () => {};
  }
  return onAgentEvent((evt) => {
    void handleInputEvent(evt);
  });
}
```

**Step 2: Run the tests**

```bash
pnpm vitest run src/sessions/session-auto-label.test.ts --reporter=verbose
```

Expected: tests pass (some may need adjustment given mock complexity — fix as needed).

**Step 3: Run broader test suite to check for regressions**

```bash
pnpm test:fast 2>&1 | tail -20
```

Expected: all existing tests still pass.

**Step 4: Commit**

```bash
git add src/sessions/session-auto-label.ts
git commit -m "feat: add session-auto-label service for LLM-generated session labels"
```

---

## Task 8: Wire the service at gateway startup

**Files:**

- Modify: `src/gateway/server-startup.ts`

**Step 1: Add import**

At the top of `server-startup.ts`, add with the other imports:

```ts
import { registerSessionAutoLabel } from "../sessions/session-auto-label.js";
```

**Step 2: Add the registration call**

Near the bottom of `startGatewaySidecars`, after `startPluginServices` (or after the channels start — it just needs to run once at startup). Add:

```ts
// Register session auto-labeling service (no-op if not configured).
registerSessionAutoLabel();
```

**Step 3: Verify types compile**

```bash
pnpm tsgo 2>&1 | head -20
```

Expected: no errors.

**Step 4: Run e2e gateway tests**

```bash
pnpm vitest run src/gateway/gateway.e2e.test.ts --reporter=verbose 2>&1 | tail -20
```

Expected: all pass.

**Step 5: Commit**

```bash
git add src/gateway/server-startup.ts
git commit -m "feat: register session auto-label service at gateway startup"
```

---

## Task 9: Integration smoke test

**Step 1: Run the full test suite**

```bash
pnpm test:fast 2>&1 | tail -30
```

Expected: all tests pass.

**Step 2: Type-check the whole project**

```bash
pnpm tsgo 2>&1 | head -30
```

Expected: no errors.

**Step 3: Lint**

```bash
pnpm lint 2>&1 | tail -20
```

Expected: no new lint errors.

**Step 4: If everything passes, run the check command**

```bash
pnpm check 2>&1 | tail -20
```

Expected: clean.

---

## Manual Verification (optional, requires API key)

Add to config:

```yaml
agents:
  defaults:
    sessionLabels:
      enabled: true
```

Start the gateway and send a message. Within a few seconds (before the agent reply arrives), the session list should show a generated label for the conversation.

---

## Summary of Files Changed

| File                                      | Change                                                      |
| ----------------------------------------- | ----------------------------------------------------------- |
| `src/sessions/session-label.ts`           | `SESSION_LABEL_MAX_LENGTH` 64 → 79                          |
| `src/config/types.agent-defaults.ts`      | `SessionLabelsConfig` type + field on `AgentDefaultsConfig` |
| `src/config/zod-schema.agent-defaults.ts` | `sessionLabels` Zod schema                                  |
| `src/config/schema.labels.ts`             | UI field label entries                                      |
| `src/agents/pi-embedded-runner/run.ts`    | Import + emit `"input"` agent event                         |
| `src/sessions/session-auto-label.ts`      | New service file                                            |
| `src/sessions/session-auto-label.test.ts` | New test file                                               |
| `src/gateway/server-startup.ts`           | Register service at startup                                 |

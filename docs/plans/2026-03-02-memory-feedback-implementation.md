# Agent End Hook Enrichment + Memory Feedback Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enrich the existing `agent_end` hook with full execution context (assistantTexts, toolMetas, sessionFile, systemPromptText), consolidate two redundant `before_prompt_build` handlers in the orchestrator, and add an ephemeral memory-feedback reflector that fires after every agent session.

**Architecture:** Extend `PluginHookAgentEndEvent` with four optional fields (backward-compatible), pass them in the existing `runAgentEnd` call in `attempt.ts`, then register an `agent_end` listener in the orchestrator extension that spawns a single-shot Anthropic API call to collect structured memory feedback and writes results to a per-session JSONL queue and the session transcript.

**Tech Stack:** TypeScript ESM, Vitest, `@anthropic-ai/sdk` (direct messages.create — not the agent SDK), existing `SessionRuntimeStore`, `OrchestratorSessionState` patterns.

**Worktree:** `~/dev/openclaw-worktrees/hooks-agent-end-hook-enrichment`
**Branch:** `dgarson/hooks-agent-end-hook-enrichment`
**Design doc:** `docs/plans/2026-03-02-memory-feedback-design.md`

---

## Task 1: Extend `PluginHookAgentEndEvent` with four optional fields

**Files:**

- Modify: `src/plugins/types.ts` (lines 453–474)

**Step 1: Write the failing type-check**

This is a type-only change — verify with `pnpm tsgo` before and after.

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: passes cleanly (baseline check)

**Step 2: Add the four optional fields**

In `src/plugins/types.ts`, find `PluginHookAgentEndEvent` and add after `lastAssistantMessage`:

```typescript
export type PluginHookAgentEndEvent = {
  messages: unknown[];
  success: boolean;
  error?: string;
  durationMs?: number;
  runId?: string;
  provider?: string;
  model?: string;
  usage?: {
    input?: number;
    output?: number;
    cacheRead?: number;
    cacheWrite?: number;
    total?: number;
  };
  toolCallCount?: number;
  toolNames?: string[]; // kept for backwards compatibility
  compactionCount?: number;
  stopReason?: string;
  lastAssistantMessage?: string;
  // New fields — all optional so existing consumers need no changes
  assistantTexts?: string[];
  toolMetas?: Array<{ toolName: string; meta?: string }>;
  sessionFile?: string;
  systemPromptText?: string;
};
```

**Step 3: Verify type-check passes**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no new errors

**Step 4: Commit**

```bash
scripts/committer "feat(plugins): add assistantTexts, toolMetas, sessionFile, systemPromptText to agent_end hook event" src/plugins/types.ts
```

---

## Task 2: Pass new fields in `runAgentEnd` call

**Files:**

- Modify: `src/agents/pi-embedded-runner/run/attempt.ts` (lines 1624–1652)

**Step 1: Locate the firing block**

The `agent_end` hook fires at `attempt.ts:1624`. The variables available at that point:

- `assistantTexts` — the array accumulated by the subscriber (already used for `lastAssistantMessage`)
- `toolMetas` — the raw tool metas array from the subscriber state
- `params.sessionFile` — the JSONL path passed into the attempt
- `systemPromptText` — tracked variable set during system prompt construction

**Step 2: Add the four fields to the `runAgentEnd` call**

Find the existing call (the object literal passed as the first arg to `runAgentEnd`) and add after `lastAssistantMessage: ...`:

```typescript
                assistantTexts: assistantTexts.length > 0 ? [...assistantTexts] : undefined,
                toolMetas: toolMetas.length > 0 ? toolMetas.map((m) => ({ toolName: m.toolName, meta: m.meta })) : undefined,
                sessionFile: params.sessionFile,
                systemPromptText: systemPromptText || undefined,
```

**Step 3: Type-check**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no errors

**Step 4: Run existing agent_end tests**

Run: `pnpm test -- --reporter=verbose src/agents/pi-embedded-runner 2>&1 | tail -30`
Expected: all pass

**Step 5: Commit**

```bash
scripts/committer "feat(runner): pass assistantTexts, toolMetas, sessionFile, systemPromptText in agent_end hook" src/agents/pi-embedded-runner/run/attempt.ts
```

---

## Task 3: Consolidate two `before_prompt_build` handlers into one

**Files:**

- Modify: `extensions/agent-orchestrator/index.ts` (lines 592–667)

**Context:** Two sequential handlers exist:

- Priority 95 (lines 592–618): assigns role from `agentRoles` config if session has no role yet
- Priority 90 (lines 620–667): reads role, injects role context, fleet status, memory nudge

The priority-95 block is a prerequisite for priority-90. Merging them eliminates a window (priorities 91–94) where the session has a role but no context injected.

**Step 1: Read the current implementations**

Read `extensions/agent-orchestrator/index.ts` lines 590–670 to confirm exact code before editing.

**Step 2: Write a test to verify the combined behavior before the merge**

In `extensions/agent-orchestrator/src/orchestration/lifecycle.test.ts`, confirm there is a test for `resolveAgentRoleFromConfig`. We are NOT testing the hook directly here — the integration test in Task 7 covers that.

Run: `pnpm test -- extensions/agent-orchestrator/src/orchestration/lifecycle.test.ts 2>&1 | tail -20`
Expected: passes (baseline)

**Step 3: Replace the two handlers with one**

Remove the entire priority-95 `api.on("before_prompt_build", ..., { priority: 95 })` block.

In the priority-90 handler, add the role-assignment logic as the first step inside the handler body:

```typescript
api.on(
  "before_prompt_build",
  (_event, ctx) => {
    if (!store || !ctx.sessionKey) return;

    // Step 1: Config-driven role bootstrap (was priority 95).
    // Assign role from agentRoles config if session has none yet.
    if (ctx.agentId && config.orchestration.agentRoles) {
      const existing = store.get(ctx.sessionKey);
      if (!existing?.role) {
        const role = resolveAgentRoleFromConfig(ctx.agentId, config.orchestration.agentRoles);
        if (role) {
          store.update(ctx.sessionKey, (s) => {
            s.role = role;
            s.depth = 0;
            s.status = "active";
            s.lastActivity = Date.now();
          });
          api.logger.info(
            `[agent-orchestrator] bootstrap: assigned role "${role}" to agent "${ctx.agentId}" (session: ${ctx.sessionKey})`,
          );
        }
      }
    }

    // Step 2: Role context injection (was priority 90).
    const state = store.get(ctx.sessionKey);
    if (!state?.role) return;

    let nudgeSuffix: string | undefined;
    if (state.memorySearchNudgePending) {
      nudgeSuffix =
        "[memory-search] You have not yet called memory_search. " +
        "Search your memory for context relevant to your current task before proceeding.";
      store.update(ctx.sessionKey, (s) => {
        s.memorySearchNudgePending = false;
      });
    }

    const allKeys = store.keys();
    const fleetMembers: Array<{ role: string; sessionKey: string; status: string }> = [];
    for (const key of allKeys) {
      const s = store.get(key);
      if (s?.status === "active" && s.role) {
        fleetMembers.push({ role: s.role, sessionKey: key, status: s.status });
      }
    }

    const context = buildRoleContext(
      state.role,
      state.taskDescription,
      fleetMembers,
      skillInstructions,
    );
    if (context || nudgeSuffix) {
      return {
        ...(context ? { prependContext: context } : {}),
        ...(nudgeSuffix ? { appendContext: nudgeSuffix } : {}),
      };
    }
  },
  { priority: 90 },
);
```

**Step 4: Type-check**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no errors

**Step 5: Run orchestrator tests**

Run: `pnpm test -- extensions/agent-orchestrator 2>&1 | tail -30`
Expected: all pass

**Step 6: Commit**

```bash
scripts/committer "refactor(agent-orchestrator): merge before_prompt_build handlers at priority 95+90 into single handler" extensions/agent-orchestrator/index.ts
```

---

## Task 4: Add `MemoryFeedbackConfig` type and config defaults

**Files:**

- Modify: `extensions/agent-orchestrator/src/types.ts`
- Modify: `extensions/agent-orchestrator/index.ts` (config parser + `OrchestratorConfig`)
- Modify: `extensions/agent-orchestrator/openclaw.plugin.json`

**Step 1: Add `MemoryFeedbackConfig` to `src/types.ts`**

At the end of the types block (after `OrchestratorEnforcementConfig`), add:

```typescript
export type MemoryFeedbackConfig = {
  enabled: boolean;
  model: string;
  autoWriteThreshold: number;
  maxContextMessages: number;
};
```

And add `memoryFeedback?: MemoryFeedbackConfig` to `OrchestratorConfig`:

```typescript
export type OrchestratorConfig = {
  mail: OrchestratorMailConfig;
  orchestration: { ... }; // unchanged
  enforcement?: OrchestratorEnforcementConfig;
  memoryFeedback?: MemoryFeedbackConfig;
};
```

**Step 2: Add the config parser in `index.ts`**

In `parseOrchestratorConfig`, after the `enforcement` parsing block, add:

```typescript
// Parse memoryFeedback config (optional)
const rawMf = isRecord(raw.memoryFeedback) ? raw.memoryFeedback : undefined;
if (rawMf) {
  result.memoryFeedback = {
    enabled: readBooleanOption(rawMf.enabled, false),
    model: typeof rawMf.model === "string" ? rawMf.model : "claude-haiku-4-5-20251001",
    autoWriteThreshold:
      typeof rawMf.autoWriteThreshold === "number" ? rawMf.autoWriteThreshold : 0.85,
    maxContextMessages:
      typeof rawMf.maxContextMessages === "number" ? rawMf.maxContextMessages : 50,
  };
}
```

**Step 3: Add `memoryFeedback` schema block to `openclaw.plugin.json`**

In the `configSchema.properties` object, add after `"enforcement"`:

```json
"memoryFeedback": {
  "type": "object",
  "description": "Ephemeral end-of-session memory reflection config.",
  "additionalProperties": false,
  "properties": {
    "enabled": { "type": "boolean" },
    "model": { "type": "string" },
    "autoWriteThreshold": { "type": "number" },
    "maxContextMessages": { "type": "integer" }
  }
}
```

**Step 4: Type-check**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no errors

**Step 5: Commit**

```bash
scripts/committer "feat(agent-orchestrator): add MemoryFeedbackConfig type and plugin config schema" extensions/agent-orchestrator/src/types.ts extensions/agent-orchestrator/index.ts extensions/agent-orchestrator/openclaw.plugin.json
```

---

## Task 5: Create `memory-reflector.ts` module

**Files:**

- Create: `extensions/agent-orchestrator/src/orchestration/memory-reflector.ts`
- Create: `extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts`

**Step 1: Write the failing tests first**

Create `extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import type { MemoryFeedbackConfig } from "../types.js";

// We mock the Anthropic client so no real API calls are made.
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: "tool_use",
            name: "memory_feedback",
            input: {
              would_have_helped: [
                {
                  query: "project auth pattern",
                  why: "Would have saved research time",
                  confidence: 0.9,
                },
              ],
              should_store: [
                {
                  name: "auth-decision",
                  body: "We use JWT",
                  group: "test-architecture",
                  confidence: 0.95,
                },
              ],
            },
          },
        ],
        stop_reason: "tool_use",
      }),
    },
  })),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    mkdir: vi.fn().mockResolvedValue(undefined),
    appendFile: vi.fn().mockResolvedValue(undefined),
  },
}));

const mockSessionManager = {
  appendCustomEntry: vi.fn(),
};

vi.mock("@mariozechner/pi-coding-agent", () => ({
  SessionManager: {
    open: vi.fn().mockReturnValue(mockSessionManager),
  },
}));

describe("runMemoryReflector", () => {
  const config: MemoryFeedbackConfig = {
    enabled: true,
    model: "claude-haiku-4-5-20251001",
    autoWriteThreshold: 0.85,
    maxContextMessages: 50,
  };

  it("returns early if not enabled", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      { ...config, enabled: false },
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      { assistantTexts: ["hello"], toolMetas: [], messages: [] },
    );
    expect(result).toBeUndefined();
  });

  it("returns early if no meaningful content", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      { assistantTexts: [], toolMetas: [], messages: [] },
    );
    expect(result).toBeUndefined();
  });

  it("calls Anthropic SDK and returns feedback", async () => {
    const { runMemoryReflector } = await import("./memory-reflector.js");
    const result = await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      {
        assistantTexts: ["I investigated the auth system and found JWT is used"],
        toolMetas: [{ toolName: "read_file", meta: "src/auth.ts" }],
        messages: [],
      },
    );
    expect(result).toBeDefined();
    expect(result?.would_have_helped).toHaveLength(1);
    expect(result?.should_store).toHaveLength(1);
    expect(result?.should_store[0].name).toBe("auth-decision");
  });

  it("writes feedback to queue file", async () => {
    const fs = await import("node:fs/promises");
    const { runMemoryReflector } = await import("./memory-reflector.js");
    vi.clearAllMocks();

    await runMemoryReflector(
      config,
      { agentId: "a1", sessionKey: "sk1", runId: "r1", stateDir: "/tmp/test" },
      {
        assistantTexts: ["completed task"],
        toolMetas: [{ toolName: "bash", meta: "ls" }],
        messages: [],
      },
    );

    expect(fs.default.appendFile).toHaveBeenCalledWith(
      expect.stringContaining("memory-feedback"),
      expect.stringContaining('"agentId":"a1"'),
    );
  });
});
```

**Step 2: Run the tests to confirm they fail**

Run: `pnpm test -- extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts 2>&1 | tail -20`
Expected: FAIL — "Cannot find module './memory-reflector.js'"

**Step 3: Install `@anthropic-ai/sdk` in the orchestrator extension**

```bash
cd ~/dev/openclaw-worktrees/hooks-agent-end-hook-enrichment/extensions/agent-orchestrator && pnpm add @anthropic-ai/sdk
```

Then return to the repo root:

```bash
cd ~/dev/openclaw-worktrees/hooks-agent-end-hook-enrichment
```

**Step 4: Create `memory-reflector.ts`**

Create `extensions/agent-orchestrator/src/orchestration/memory-reflector.ts`:

```typescript
/**
 * Ephemeral memory reflector — fires after agent_end.
 *
 * Makes a single Anthropic API call (not a full agent session) to collect
 * structured memory feedback, then writes to:
 *   1. {stateDir}/memory-feedback/{agentId}-{runId}.jsonl  (persistent queue)
 *   2. Session JSONL via SessionManager (shows in UI after run.end)
 */

import fs from "node:fs/promises";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { SessionManager } from "@mariozechner/pi-coding-agent";
import type { MemoryFeedbackConfig } from "../types.js";

export type ReflectorInput = {
  assistantTexts: string[];
  toolMetas: Array<{ toolName: string; meta?: string }>;
  messages: unknown[];
  sessionFile?: string;
  systemPromptText?: string;
};

export type ReflectorContext = {
  agentId: string;
  sessionKey: string;
  runId: string;
  stateDir: string;
};

export type MemoryFeedbackResult = {
  would_have_helped: Array<{ query: string; why: string; confidence: number }>;
  should_store: Array<{ name: string; body: string; group: string; confidence: number }>;
};

const MEMORY_FEEDBACK_TOOL = {
  name: "memory_feedback",
  description: "Report what persistent memory would have been useful in this session",
  input_schema: {
    type: "object" as const,
    properties: {
      would_have_helped: {
        type: "array",
        items: {
          type: "object",
          properties: {
            query: { type: "string" },
            why: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["query", "why", "confidence"],
        },
        description: "Information you would have wanted to retrieve from memory at the start",
      },
      should_store: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            body: { type: "string" },
            group: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["name", "body", "group", "confidence"],
        },
        description: "New facts that should be stored for future sessions",
      },
    },
    required: ["would_have_helped", "should_store"],
  },
} as const;

function buildContextSummary(input: ReflectorInput, maxMessages: number): string {
  const parts: string[] = [];

  if (input.systemPromptText) {
    parts.push(`## Agent role/task\n${input.systemPromptText.slice(0, 500)}`);
  }

  if (input.assistantTexts.length > 0) {
    parts.push(`## What the agent did\n${input.assistantTexts.join("\n---\n")}`);
  }

  if (input.toolMetas.length > 0) {
    const toolSummary = input.toolMetas
      .map((t) => `- ${t.toolName}${t.meta ? `: ${t.meta}` : ""}`)
      .join("\n");
    parts.push(`## Tools called\n${toolSummary}`);
  }

  const recentMessages = (input.messages as Array<{ role?: string; content?: unknown }>)
    .slice(-maxMessages)
    .filter((m) => m.role === "user" || m.role === "assistant");

  if (recentMessages.length > 0) {
    const msgSummary = recentMessages
      .map((m) => {
        const content = typeof m.content === "string" ? m.content.slice(0, 300) : "[structured]";
        return `[${m.role}] ${content}`;
      })
      .join("\n");
    parts.push(`## Recent conversation\n${msgSummary}`);
  }

  return parts.join("\n\n");
}

/**
 * Run the ephemeral memory reflector for a completed agent session.
 * Fire-and-forget: callers should not await or act on errors.
 */
export async function runMemoryReflector(
  config: MemoryFeedbackConfig,
  ctx: ReflectorContext,
  input: ReflectorInput,
): Promise<MemoryFeedbackResult | undefined> {
  if (!config.enabled) return undefined;

  // Skip if no meaningful content to reflect on
  if (input.assistantTexts.length === 0 && input.toolMetas.length === 0) {
    return undefined;
  }

  const contextSummary = buildContextSummary(input, config.maxContextMessages);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: config.model,
    max_tokens: 1024,
    system:
      "You are reviewing a completed agent session. " +
      "Your only job is to call memory_feedback exactly once with: " +
      "(1) what information from persistent memory would have helped this agent, " +
      "and (2) what new facts from this session should be stored for future sessions. " +
      "Be specific and concise. Only include high-confidence entries.",
    tools: [MEMORY_FEEDBACK_TOOL],
    tool_choice: { type: "any" },
    messages: [{ role: "user", content: contextSummary }],
  });

  // Extract the memory_feedback tool call result
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "memory_feedback",
  );
  if (!toolUse) return undefined;

  const result = toolUse.input as MemoryFeedbackResult;

  // Write to persistent feedback queue
  const feedbackDir = path.join(ctx.stateDir, "memory-feedback");
  await fs.mkdir(feedbackDir, { recursive: true });
  const queueEntry = JSON.stringify({
    agentId: ctx.agentId,
    sessionKey: ctx.sessionKey,
    runId: ctx.runId,
    timestamp: Date.now(),
    feedback: result,
  });
  await fs.appendFile(
    path.join(feedbackDir, `${ctx.agentId}-${ctx.runId}.jsonl`),
    queueEntry + "\n",
  );

  // Write to session transcript (shows in UI after run.end)
  if (input.sessionFile) {
    try {
      const sessionManager = SessionManager.open(input.sessionFile);
      sessionManager.appendCustomEntry("openclaw:memory-reflection", result);
    } catch {
      // Non-fatal — session file may be gone by now
    }
  }

  return result;
}
```

**Step 5: Run the tests**

Run: `pnpm test -- extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts 2>&1 | tail -30`
Expected: all 4 tests PASS

**Step 6: Type-check**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no errors

**Step 7: Commit**

```bash
scripts/committer "feat(agent-orchestrator): add ephemeral memory-reflector module with tests" extensions/agent-orchestrator/src/orchestration/memory-reflector.ts extensions/agent-orchestrator/src/orchestration/memory-reflector.test.ts extensions/agent-orchestrator/package.json
```

---

## Task 6: Wire `agent_end` listener in the orchestrator extension

**Files:**

- Modify: `extensions/agent-orchestrator/index.ts`

**Step 1: Import `runMemoryReflector`**

Near the top of `extensions/agent-orchestrator/index.ts`, with the other orchestration imports:

```typescript
import { runMemoryReflector } from "./src/orchestration/memory-reflector.js";
```

**Step 2: Register the `agent_end` listener**

After the `subagent_ended` handler (around line 585), add:

```typescript
// Hook: end-of-session memory reflection (fire-and-forget)
if (config.memoryFeedback?.enabled) {
  api.on("agent_end", (event, ctx) => {
    if (!ctx.agentId || !ctx.sessionKey || !stateDir) return;

    // Skip aborted runs with no content
    const assistantTexts = event.assistantTexts ?? [];
    const toolMetas = event.toolMetas ?? [];
    if (!event.success && assistantTexts.length === 0 && toolMetas.length === 0) return;

    runMemoryReflector(
      config.memoryFeedback!,
      {
        agentId: ctx.agentId,
        sessionKey: ctx.sessionKey,
        runId: event.runId ?? `${ctx.agentId}-${Date.now()}`,
        stateDir,
      },
      {
        assistantTexts,
        toolMetas,
        messages: event.messages,
        sessionFile: event.sessionFile,
        systemPromptText: event.systemPromptText,
      },
    ).catch((err) => {
      api.logger.warn(`[agent-orchestrator] memory-reflector failed: ${err}`);
    });
  });
}
```

**Step 3: Type-check**

Run: `pnpm tsgo 2>&1 | tail -5`
Expected: no errors

**Step 4: Run orchestrator tests**

Run: `pnpm test -- extensions/agent-orchestrator 2>&1 | tail -30`
Expected: all pass

**Step 5: Commit**

```bash
scripts/committer "feat(agent-orchestrator): wire agent_end listener for ephemeral memory reflection" extensions/agent-orchestrator/index.ts
```

---

## Task 7: Full test suite + final commit

**Step 1: Run the full test suite**

Run: `pnpm test 2>&1 | tail -40`
Expected: all existing tests pass (no regressions)

If memory pressure is a concern on this machine:

```bash
OPENCLAW_TEST_PROFILE=low OPENCLAW_TEST_SERIAL_GATEWAY=1 pnpm test 2>&1 | tail -40
```

**Step 2: Type-check everything**

Run: `pnpm tsgo 2>&1 | tail -10`
Expected: no errors

**Step 3: Lint**

Run: `pnpm check 2>&1 | tail -20`
Expected: no errors. If formatting-only issues, run `pnpm format:fix` and re-check.

**Step 4: Verify git log looks right**

Run: `git log --oneline -6`
Expected: 5 new commits on top of `09a1abeb7a`

**Step 5: Summary of what was built**

- `src/plugins/types.ts` — `PluginHookAgentEndEvent` has 4 new optional fields; `toolNames` preserved
- `src/agents/pi-embedded-runner/run/attempt.ts` — `runAgentEnd` passes all new fields; fires for channel replies, heartbeats, cron, queue-drain, and isolated runs
- `extensions/agent-orchestrator/index.ts` — single `before_prompt_build` handler at priority 90 (role bootstrap + context injection merged); `agent_end` listener fires ephemeral reflector when `memoryFeedback.enabled`
- `extensions/agent-orchestrator/src/orchestration/memory-reflector.ts` — ephemeral single-shot Anthropic messages.create call, writes to `{stateDir}/memory-feedback/` queue and session JSONL
- `extensions/agent-orchestrator/openclaw.plugin.json` — `memoryFeedback` schema block added

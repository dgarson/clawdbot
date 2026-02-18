# Channel-Agnostic Interactive Prompts — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add channel-agnostic interactive prompt support (multi-choice questions + approval confirmations) that agents can invoke and block on, with Slack as the first implementation.

**Architecture:** New `ChannelInteractiveAdapter` in the plugin contract with `interactivePrompts` capability flag. Slack implements this using Block Kit buttons via the existing `sendMessageSlack()` + system events infrastructure. Channel-agnostic agent tools dispatch to whichever channel supports it.

**Tech Stack:** TypeScript, @sinclair/typebox (tool schemas), @slack/web-api (Block Kit), existing system events infrastructure

---

## Task 1: Add Block Kit Type Definitions

**Files:**

- Create: `src/slack/blocks/types.ts`

**Step 1: Create the Block Kit types file**

Copy from `dgarson/src/slack/blocks/types.ts` into `src/slack/blocks/types.ts`. This file contains complete TypeScript type definitions for the Slack Block Kit API: text objects, composition objects, interactive elements, block types, and action payloads.

No modifications needed — the POC types are standalone with no imports from external modules.

**Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/slack/blocks/types.ts` or `pnpm check`
Expected: No type errors

**Step 3: Commit**

```bash
git add src/slack/blocks/types.ts
git commit -m "feat(slack): add Block Kit type definitions"
```

---

## Task 2: Add Block Kit Builders

**Files:**

- Create: `src/slack/blocks/builders.ts`
- Create: `src/slack/blocks/builders.test.ts`

**Step 1: Write the failing test**

Create `src/slack/blocks/builders.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { button, plainText, mrkdwn, section, actions, header, divider } from "./builders.js";

describe("Block Kit builders", () => {
  it("creates a plainText object", () => {
    const result = plainText("Hello");
    expect(result).toEqual({ type: "plain_text", text: "Hello" });
  });

  it("creates a mrkdwn object", () => {
    const result = mrkdwn("*bold*");
    expect(result).toEqual({ type: "mrkdwn", text: "*bold*" });
  });

  it("normalizes escaped newlines from LLM output", () => {
    const result = plainText("line1\\nline2");
    expect(result.text).toBe("line1\nline2");
  });

  it("creates a button element", () => {
    const result = button({ text: "Click", actionId: "btn_1", value: "clicked" });
    expect(result.type).toBe("button");
    expect(result.action_id).toBe("btn_1");
    expect(result.text).toEqual({ type: "plain_text", text: "Click" });
  });

  it("creates a section block", () => {
    const result = section({ text: mrkdwn("Hello") });
    expect(result.type).toBe("section");
  });

  it("creates an actions block", () => {
    const btn = button({ text: "Go", actionId: "go" });
    const result = actions({ elements: [btn] });
    expect(result.type).toBe("actions");
    expect(result.elements).toHaveLength(1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/slack/blocks/builders.test.ts`
Expected: FAIL — module not found

**Step 3: Create the builders file**

Copy from `dgarson/src/slack/blocks/builders.ts` into `src/slack/blocks/builders.ts`.

Key change needed: Update the import at the top to reference the local types:

```typescript
import type { PlainTextObject, MrkdwnObject, TextObject /* ... */ } from "./types.js";
```

The POC file already uses this import pattern, so it should work as-is.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/slack/blocks/builders.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/slack/blocks/builders.ts src/slack/blocks/builders.test.ts
git commit -m "feat(slack): add Block Kit builder functions with tests"
```

---

## Task 3: Add Block Kit Patterns

**Files:**

- Create: `src/slack/blocks/patterns.ts`

**Step 1: Create the patterns file**

Copy from `dgarson/src/slack/blocks/patterns.ts` into `src/slack/blocks/patterns.ts`.

Verify imports reference `./builders.js` and `./types.js` (should already be correct).

Key patterns used by the interactive adapter later:

- `multipleChoiceQuestion()` — used by `askQuestion`
- `confirmation()` — used by `askConfirmation`

**Step 2: Verify it compiles**

Run: `pnpm vitest run src/slack/blocks/builders.test.ts` (to ensure no import breakage)
Expected: PASS

**Step 3: Commit**

```bash
git add src/slack/blocks/patterns.ts
git commit -m "feat(slack): add Block Kit high-level patterns"
```

---

## Task 4: Add Block Validation

**Files:**

- Create: `src/slack/blocks/validation.ts`

**Step 1: Create the validation file**

Copy from `dgarson/src/slack/blocks/validation.ts` into `src/slack/blocks/validation.ts`.

Verify imports reference `./types.js`.

**Step 2: Commit**

```bash
git add src/slack/blocks/validation.ts
git commit -m "feat(slack): add Block Kit validation"
```

---

## Task 5: Move Existing Block Utilities into blocks/

**Files:**

- Move: `src/slack/blocks-fallback.ts` → `src/slack/blocks/fallback.ts`
- Move: `src/slack/blocks-input.ts` → `src/slack/blocks/input.ts`
- Move: `src/slack/blocks-fallback.test.ts` → `src/slack/blocks/fallback.test.ts`
- Move: `src/slack/blocks-input.test.ts` → `src/slack/blocks/input.test.ts`
- Move: `src/slack/blocks.test-helpers.ts` → `src/slack/blocks/test-helpers.ts`
- Modify: `src/slack/send.ts` (lines 18-19) — update import paths
- Modify: `src/slack/actions.ts` (lines 5-6) — update import paths
- Modify: `src/plugin-sdk/slack-message-actions.ts` (line 4) — update import path
- Modify: `src/agents/tools/slack-actions.ts` (line 19) — update import path

**Step 1: Move the files**

```bash
cd /Users/davidgarson/dev/openclaw
git mv src/slack/blocks-fallback.ts src/slack/blocks/fallback.ts
git mv src/slack/blocks-input.ts src/slack/blocks/input.ts
git mv src/slack/blocks-fallback.test.ts src/slack/blocks/fallback.test.ts
git mv src/slack/blocks-input.test.ts src/slack/blocks/input.test.ts
git mv src/slack/blocks.test-helpers.ts src/slack/blocks/test-helpers.ts
```

**Step 2: Update import paths in consumers**

In `src/slack/send.ts` (lines 18-19), change:

```typescript
// OLD
import { buildSlackBlocksFallbackText } from "./blocks-fallback.js";
import { validateSlackBlocksArray } from "./blocks-input.js";
// NEW
import { buildSlackBlocksFallbackText } from "./blocks/fallback.js";
import { validateSlackBlocksArray } from "./blocks/input.js";
```

In `src/slack/actions.ts`, change imports similarly:

```typescript
// Find the imports for blocks-fallback and blocks-input and update to ./blocks/fallback.js and ./blocks/input.js
```

In `src/plugin-sdk/slack-message-actions.ts` (line 4), change:

```typescript
// OLD
import { parseSlackBlocksInput } from "../slack/blocks-input.js";
// NEW
import { parseSlackBlocksInput } from "../slack/blocks/input.js";
```

In `src/agents/tools/slack-actions.ts` (line 19), change:

```typescript
// OLD
import { parseSlackBlocksInput } from "../../slack/blocks-input.js";
// NEW
import { parseSlackBlocksInput } from "../../slack/blocks/input.js";
```

**Step 3: Search for any other importers**

Run: `grep -r "blocks-fallback\|blocks-input" src/ --include="*.ts" -l` to find any files missed above. Update them.

Also check test files that may import from these:

- `src/slack/send.blocks.test.ts`
- `src/slack/actions.blocks.test.ts`

**Step 4: Run existing tests to verify nothing broke**

Run: `pnpm vitest run src/slack/`
Expected: All existing Slack tests pass

**Step 5: Commit**

```bash
git add -A src/slack/blocks/ src/slack/send.ts src/slack/actions.ts src/plugin-sdk/slack-message-actions.ts src/agents/tools/slack-actions.ts
git commit -m "refactor(slack): move block utilities into src/slack/blocks/"
```

---

## Task 6: Create Block Kit Barrel Export

**Files:**

- Create: `src/slack/blocks/index.ts`

**Step 1: Create the barrel export**

```typescript
export * from "./types.js";
export * from "./builders.js";
export * from "./patterns.js";
export * from "./validation.js";
export { buildSlackBlocksFallbackText } from "./fallback.js";
export { parseSlackBlocksInput, validateSlackBlocksArray } from "./input.js";
```

**Step 2: Commit**

```bash
git add src/slack/blocks/index.ts
git commit -m "feat(slack): add blocks barrel export"
```

---

## Task 7: Define Channel-Agnostic Interactive Types

**Files:**

- Create: `src/channels/plugins/types.interactive.ts`
- Modify: `src/channels/plugins/types.core.ts` (line 182)
- Modify: `src/channels/plugins/types.plugin.ts` (line 83)
- Modify: `src/channels/plugins/types.ts` (barrel export)

**Step 1: Write the failing test**

Create `src/channels/plugins/types.interactive.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type {
  ChannelInteractiveAdapter,
  InteractivePromptQuestion,
  InteractivePromptConfirmation,
  InteractivePromptResponse,
} from "./types.interactive.js";

describe("Interactive prompt types", () => {
  it("InteractivePromptQuestion is structurally valid", () => {
    const question: InteractivePromptQuestion = {
      id: "q1",
      text: "Pick one",
      options: [{ value: "a", label: "Option A" }],
    };
    expect(question.id).toBe("q1");
    expect(question.options).toHaveLength(1);
  });

  it("InteractivePromptConfirmation is structurally valid", () => {
    const confirmation: InteractivePromptConfirmation = {
      id: "c1",
      title: "Approve?",
      message: "Deploy to production?",
    };
    expect(confirmation.id).toBe("c1");
  });

  it("InteractivePromptResponse has expected shape", () => {
    const response: InteractivePromptResponse = {
      answered: true,
      timedOut: false,
      selectedValues: ["approve"],
      respondedBy: { id: "U123", name: "alice" },
      timestamp: Date.now(),
    };
    expect(response.answered).toBe(true);
    expect(response.selectedValues).toContain("approve");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/channels/plugins/types.interactive.test.ts`
Expected: FAIL — module not found

**Step 3: Create the types file**

Create `src/channels/plugins/types.interactive.ts`:

```typescript
export type InteractivePromptOption = {
  value: string;
  label: string;
  description?: string;
};

export type InteractivePromptQuestion = {
  id: string;
  text: string;
  options: InteractivePromptOption[];
  allowMultiple?: boolean;
  timeoutMs?: number;
};

export type InteractivePromptConfirmation = {
  id: string;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  style?: "primary" | "danger";
  timeoutMs?: number;
};

export type InteractivePromptResponse = {
  answered: boolean;
  timedOut: boolean;
  selectedValues?: string[];
  confirmed?: boolean;
  respondedBy?: { id: string; name?: string };
  timestamp: number;
};

export type ChannelInteractiveAdapter = {
  askQuestion: (params: {
    to: string;
    question: InteractivePromptQuestion;
    threadId?: string;
    accountId?: string;
  }) => Promise<InteractivePromptResponse>;

  askConfirmation: (params: {
    to: string;
    confirmation: InteractivePromptConfirmation;
    threadId?: string;
    accountId?: string;
  }) => Promise<InteractivePromptResponse>;
};
```

**Step 4: Add capability flag to ChannelCapabilities**

In `src/channels/plugins/types.core.ts`, line 181, add after `blockStreaming?: boolean;`:

```typescript
  interactivePrompts?: boolean;
```

**Step 5: Add adapter to ChannelPlugin**

In `src/channels/plugins/types.plugin.ts`:

Add import (after line 30):

```typescript
import type { ChannelInteractiveAdapter } from "./types.interactive.js";
```

Add property (after line 83, before closing `};`):

```typescript
  interactive?: ChannelInteractiveAdapter;
```

**Step 6: Add to barrel export**

In `src/channels/plugins/types.ts`, add after line 63:

```typescript
export type {
  ChannelInteractiveAdapter,
  InteractivePromptConfirmation,
  InteractivePromptOption,
  InteractivePromptQuestion,
  InteractivePromptResponse,
} from "./types.interactive.js";
```

**Step 7: Run test to verify it passes**

Run: `pnpm vitest run src/channels/plugins/types.interactive.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/channels/plugins/types.interactive.ts src/channels/plugins/types.interactive.test.ts src/channels/plugins/types.core.ts src/channels/plugins/types.plugin.ts src/channels/plugins/types.ts
git commit -m "feat(channels): add ChannelInteractiveAdapter abstraction and types"
```

---

## Task 8: Implement Slack Interactive Adapter

**Files:**

- Create: `src/slack/interactive-adapter.ts`
- Create: `src/slack/interactive-adapter.test.ts`

**Step 1: Write the failing test**

Create `src/slack/interactive-adapter.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSlackInteractiveAdapter } from "./interactive-adapter.js";
import { enqueueSystemEvent, resetSystemEventsForTest } from "../infra/system-events.js";

describe("Slack interactive adapter", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
  });

  it("askQuestion builds blocks with options as buttons", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });
    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: () => [],
    });

    // Start the question (will timeout quickly)
    const responsePromise = adapter.askQuestion({
      to: "C123",
      question: {
        id: "q1",
        text: "Pick a color",
        options: [
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
        ],
        timeoutMs: 100,
      },
    });

    const response = await responsePromise;
    expect(sendMock).toHaveBeenCalledOnce();
    // Verify blocks were passed to send
    const sendArgs = sendMock.mock.calls[0];
    expect(sendArgs[2]?.blocks).toBeDefined();
    // Should timeout since no response was given
    expect(response.timedOut).toBe(true);
    expect(response.answered).toBe(false);
  });

  it("askConfirmation builds confirm/cancel buttons", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });
    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: () => [],
    });

    const responsePromise = adapter.askConfirmation({
      to: "C123",
      confirmation: {
        id: "c1",
        title: "Deploy?",
        message: "Deploy to production?",
        timeoutMs: 100,
      },
    });

    const response = await responsePromise;
    expect(sendMock).toHaveBeenCalledOnce();
    expect(response.timedOut).toBe(true);
    expect(response.answered).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/slack/interactive-adapter.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the Slack interactive adapter**

Create `src/slack/interactive-adapter.ts`:

```typescript
import type { Block, KnownBlock } from "@slack/web-api";
import type {
  ChannelInteractiveAdapter,
  InteractivePromptConfirmation,
  InteractivePromptQuestion,
  InteractivePromptResponse,
} from "../channels/plugins/types.interactive.js";
import type { SystemEvent } from "../infra/system-events.js";
import { button, plainText, mrkdwn, section, actions, header } from "./blocks/builders.js";
import type { SlackSendResult } from "./send.js";

const OPENCLAW_ACTION_PREFIX = "openclaw:";
const DEFAULT_TIMEOUT_MS = 5 * 60_000; // 5 minutes
const POLL_INTERVAL_MS = 500;

type SlackInteractiveAdapterDeps = {
  sendMessageSlack: (
    to: string,
    message: string,
    opts?: { blocks?: (Block | KnownBlock)[]; threadTs?: string; accountId?: string },
  ) => Promise<SlackSendResult>;
  pollSystemEvents: (sessionKey: string) => SystemEvent[];
};

function buildQuestionBlocks(question: InteractivePromptQuestion): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [];

  blocks.push(section({ text: mrkdwn(question.text) }) as unknown as KnownBlock);

  const buttons = question.options.map((opt, index) =>
    button({
      text: opt.label,
      actionId: `${OPENCLAW_ACTION_PREFIX}question:${question.id}:${opt.value}`,
      value: opt.value,
    }),
  );

  blocks.push(actions({ elements: buttons }) as unknown as KnownBlock);

  return blocks;
}

function buildConfirmationBlocks(
  confirmation: InteractivePromptConfirmation,
): (Block | KnownBlock)[] {
  const blocks: (Block | KnownBlock)[] = [];

  if (confirmation.title) {
    blocks.push(header({ text: confirmation.title }) as unknown as KnownBlock);
  }

  blocks.push(section({ text: mrkdwn(confirmation.message) }) as unknown as KnownBlock);

  const confirmBtn = button({
    text: confirmation.confirmLabel ?? "Approve",
    actionId: `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:confirm`,
    value: "confirm",
    style: confirmation.style ?? "primary",
  });

  const cancelBtn = button({
    text: confirmation.cancelLabel ?? "Deny",
    actionId: `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:cancel`,
    value: "cancel",
  });

  blocks.push(actions({ elements: [confirmBtn, cancelBtn] }) as unknown as KnownBlock);

  return blocks;
}

function matchInteractionEvent(
  events: SystemEvent[],
  actionPrefix: string,
): { actionId: string; selectedValues: string[]; userId?: string; userName?: string } | null {
  for (const event of events) {
    if (!event.text.includes("Slack interaction:")) {
      continue;
    }
    try {
      const jsonStart = event.text.indexOf("{");
      if (jsonStart < 0) continue;
      const payload = JSON.parse(event.text.slice(jsonStart));
      if (typeof payload.actionId === "string" && payload.actionId.startsWith(actionPrefix)) {
        return {
          actionId: payload.actionId,
          selectedValues: payload.selectedValues ?? [payload.value].filter(Boolean),
          userId: payload.userId,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function waitForInteraction(params: {
  actionPrefix: string;
  timeoutMs: number;
  pollSystemEvents: (sessionKey: string) => SystemEvent[];
  sessionKey: string;
}): Promise<InteractivePromptResponse> {
  const deadline = Date.now() + params.timeoutMs;

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() >= deadline) {
        resolve({
          answered: false,
          timedOut: true,
          timestamp: Date.now(),
        });
        return;
      }

      const events = params.pollSystemEvents(params.sessionKey);
      const match = matchInteractionEvent(events, params.actionPrefix);

      if (match) {
        resolve({
          answered: true,
          timedOut: false,
          selectedValues: match.selectedValues,
          confirmed: match.selectedValues.includes("confirm")
            ? true
            : match.selectedValues.includes("cancel")
              ? false
              : undefined,
          respondedBy: match.userId ? { id: match.userId, name: match.userName } : undefined,
          timestamp: Date.now(),
        });
        return;
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });
}

export function createSlackInteractiveAdapter(
  deps: SlackInteractiveAdapterDeps,
): ChannelInteractiveAdapter {
  return {
    askQuestion: async (params) => {
      const question = params.question;
      const timeoutMs = question.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const blocks = buildQuestionBlocks(question);
      const fallbackText = `${question.text}\n${question.options.map((o, i) => `${i + 1}. ${o.label}`).join("\n")}`;

      await deps.sendMessageSlack(params.to, fallbackText, {
        blocks,
        threadTs: params.threadId,
        accountId: params.accountId,
      });

      const actionPrefix = `${OPENCLAW_ACTION_PREFIX}question:${question.id}:`;

      return waitForInteraction({
        actionPrefix,
        timeoutMs,
        pollSystemEvents: deps.pollSystemEvents,
        sessionKey: params.to,
      });
    },

    askConfirmation: async (params) => {
      const confirmation = params.confirmation;
      const timeoutMs = confirmation.timeoutMs ?? DEFAULT_TIMEOUT_MS;
      const blocks = buildConfirmationBlocks(confirmation);
      const fallbackText = `${confirmation.title}: ${confirmation.message}`;

      await deps.sendMessageSlack(params.to, fallbackText, {
        blocks,
        threadTs: params.threadId,
        accountId: params.accountId,
      });

      const actionPrefix = `${OPENCLAW_ACTION_PREFIX}confirm:${confirmation.id}:`;

      return waitForInteraction({
        actionPrefix,
        timeoutMs,
        pollSystemEvents: deps.pollSystemEvents,
        sessionKey: params.to,
      });
    },
  };
}
```

**Important:** The `waitForInteraction` function polls system events for matching interaction payloads. The existing `interactions.ts` already enqueues system events with the full interaction summary (including `actionId`, `selectedValues`, `userId`). This adapter parses those events to resolve the pending promise.

**Note:** The session key for polling needs to match what `interactions.ts` uses. Review `ctx.resolveSlackSystemEventSessionKey()` to understand the session key format and adjust `sessionKey` parameter accordingly during integration.

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/slack/interactive-adapter.test.ts`
Expected: PASS (the timeout tests should work since we set timeoutMs to 100ms)

**Step 5: Commit**

```bash
git add src/slack/interactive-adapter.ts src/slack/interactive-adapter.test.ts
git commit -m "feat(slack): implement ChannelInteractiveAdapter for Slack"
```

---

## Task 9: Create Channel-Agnostic AskQuestion Agent Tool

**Files:**

- Create: `src/agents/tools/interactive-prompt-tool.ts`
- Create: `src/agents/tools/interactive-prompt-tool.test.ts`

**Step 1: Write the failing test**

Create `src/agents/tools/interactive-prompt-tool.test.ts`:

```typescript
import { describe, expect, it, vi } from "vitest";
import { createInteractivePromptTool } from "./interactive-prompt-tool.js";

describe("Interactive prompt tool", () => {
  it("creates a tool with correct name and schema", () => {
    const tool = createInteractivePromptTool();
    expect(tool.name).toBe("ask_question");
    expect(tool.label).toBe("Ask Question");
    expect(tool.parameters).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/tools/interactive-prompt-tool.test.ts`
Expected: FAIL — module not found

**Step 3: Implement the tool**

Create `src/agents/tools/interactive-prompt-tool.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ChannelInteractiveAdapter } from "../../channels/plugins/types.interactive.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const InteractivePromptSchema = Type.Object({
  to: Type.String({ description: "Target channel or user ID" }),
  question: Type.String({ description: "The question to ask" }),
  options: Type.Array(
    Type.Object({
      value: Type.String({ description: "Machine-readable value returned on selection" }),
      label: Type.String({ description: "Human-readable label shown to user" }),
      description: Type.Optional(
        Type.String({ description: "Additional context for this option" }),
      ),
    }),
    { description: "Available choices (2-10 options)", minItems: 2 },
  ),
  allowMultiple: Type.Optional(
    Type.Boolean({ description: "Allow selecting multiple options (default: false)" }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({ description: "Seconds to wait for response (default: 300)" }),
  ),
  threadId: Type.Optional(Type.String({ description: "Thread ID for threaded replies" })),
  accountId: Type.Optional(Type.String({ description: "Account ID override" })),
});

export function createInteractivePromptTool(opts?: {
  resolveAdapter?: (channel: string) => ChannelInteractiveAdapter | undefined;
}): AnyAgentTool {
  return {
    label: "Ask Question",
    name: "ask_question",
    description:
      "Ask the user a multiple-choice question and wait for their response. Sends interactive buttons in channels that support them (Slack, Discord), falls back to numbered text options otherwise. Returns the user's selection(s).",
    parameters: InteractivePromptSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const to = readStringParam(params, "to", { required: true });
      const questionText = readStringParam(params, "question", { required: true });
      const options = params.options as Array<{
        value: string;
        label: string;
        description?: string;
      }>;
      const allowMultiple = params.allowMultiple === true;
      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" ? params.timeoutSeconds : 300;
      const threadId = readStringParam(params, "threadId");
      const accountId = readStringParam(params, "accountId");

      if (!options || options.length < 2) {
        throw new Error("At least 2 options are required.");
      }

      const adapter = opts?.resolveAdapter?.(to);
      if (!adapter) {
        throw new Error(
          `No interactive prompt adapter available for target "${to}". The channel may not support interactive prompts.`,
        );
      }

      const questionId = `q_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const response = await adapter.askQuestion({
        to,
        question: {
          id: questionId,
          text: questionText,
          options,
          allowMultiple,
          timeoutMs: timeoutSeconds * 1000,
        },
        threadId: threadId ?? undefined,
        accountId: accountId ?? undefined,
      });

      return jsonResult(response);
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/agents/tools/interactive-prompt-tool.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/tools/interactive-prompt-tool.ts src/agents/tools/interactive-prompt-tool.test.ts
git commit -m "feat(agents): add channel-agnostic AskQuestion tool"
```

---

## Task 10: Create Channel-Agnostic AskConfirmation Agent Tool

**Files:**

- Create: `src/agents/tools/interactive-confirmation-tool.ts`
- Create: `src/agents/tools/interactive-confirmation-tool.test.ts`

**Step 1: Write the failing test**

Create `src/agents/tools/interactive-confirmation-tool.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createInteractiveConfirmationTool } from "./interactive-confirmation-tool.js";

describe("Interactive confirmation tool", () => {
  it("creates a tool with correct name and schema", () => {
    const tool = createInteractiveConfirmationTool();
    expect(tool.name).toBe("ask_confirmation");
    expect(tool.label).toBe("Ask Confirmation");
    expect(tool.parameters).toBeDefined();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/agents/tools/interactive-confirmation-tool.test.ts`
Expected: FAIL

**Step 3: Implement the tool**

Create `src/agents/tools/interactive-confirmation-tool.ts`:

```typescript
import { Type } from "@sinclair/typebox";
import type { ChannelInteractiveAdapter } from "../../channels/plugins/types.interactive.js";
import { type AnyAgentTool, jsonResult, readStringParam } from "./common.js";

const InteractiveConfirmationSchema = Type.Object({
  to: Type.String({ description: "Target channel or user ID" }),
  title: Type.String({ description: "Short title for the confirmation" }),
  message: Type.String({ description: "Detailed message explaining what is being confirmed" }),
  confirmLabel: Type.Optional(
    Type.String({ description: 'Label for confirm button (default: "Approve")' }),
  ),
  cancelLabel: Type.Optional(
    Type.String({ description: 'Label for cancel button (default: "Deny")' }),
  ),
  style: Type.Optional(
    Type.Union([Type.Literal("primary"), Type.Literal("danger")], {
      description: 'Button style (default: "primary")',
    }),
  ),
  timeoutSeconds: Type.Optional(
    Type.Number({ description: "Seconds to wait for response (default: 300)" }),
  ),
  threadId: Type.Optional(Type.String({ description: "Thread ID for threaded replies" })),
  accountId: Type.Optional(Type.String({ description: "Account ID override" })),
});

export function createInteractiveConfirmationTool(opts?: {
  resolveAdapter?: (channel: string) => ChannelInteractiveAdapter | undefined;
}): AnyAgentTool {
  return {
    label: "Ask Confirmation",
    name: "ask_confirmation",
    description:
      "Ask the user for approval (yes/no confirmation) and wait for their response. Sends interactive Approve/Deny buttons in channels that support them (Slack, Discord). Returns whether the user confirmed or denied.",
    parameters: InteractiveConfirmationSchema,
    execute: async (_toolCallId, args) => {
      const params = args as Record<string, unknown>;
      const to = readStringParam(params, "to", { required: true });
      const title = readStringParam(params, "title", { required: true });
      const message = readStringParam(params, "message", { required: true });
      const confirmLabel = readStringParam(params, "confirmLabel") ?? "Approve";
      const cancelLabel = readStringParam(params, "cancelLabel") ?? "Deny";
      const style = readStringParam(params, "style") as "primary" | "danger" | undefined;
      const timeoutSeconds =
        typeof params.timeoutSeconds === "number" ? params.timeoutSeconds : 300;
      const threadId = readStringParam(params, "threadId");
      const accountId = readStringParam(params, "accountId");

      const adapter = opts?.resolveAdapter?.(to);
      if (!adapter) {
        throw new Error(
          `No interactive prompt adapter available for target "${to}". The channel may not support interactive prompts.`,
        );
      }

      const confirmationId = `c_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const response = await adapter.askConfirmation({
        to,
        confirmation: {
          id: confirmationId,
          title,
          message,
          confirmLabel,
          cancelLabel,
          style: style ?? "primary",
          timeoutMs: timeoutSeconds * 1000,
        },
        threadId: threadId ?? undefined,
        accountId: accountId ?? undefined,
      });

      return jsonResult(response);
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm vitest run src/agents/tools/interactive-confirmation-tool.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/agents/tools/interactive-confirmation-tool.ts src/agents/tools/interactive-confirmation-tool.test.ts
git commit -m "feat(agents): add channel-agnostic AskConfirmation tool"
```

---

## Task 11: Wire Slack Plugin — Capabilities + Interactive Adapter

**Files:**

- Modify: `extensions/slack/src/channel.ts` (lines 86-92, add capability + adapter)

**Step 1: Add interactive capability**

In `extensions/slack/src/channel.ts`, line 92 (inside `capabilities`), add:

```typescript
  capabilities: {
    chatTypes: ["direct", "channel", "thread"],
    reactions: true,
    threads: true,
    media: true,
    nativeCommands: true,
    interactivePrompts: true,  // ADD THIS
  },
```

**Step 2: Wire the interactive adapter**

This requires adding the adapter to the `slackPlugin` object. Add after the `actions:` block (after line 243):

```typescript
  interactive: {
    askQuestion: async (params) => {
      const { createSlackInteractiveAdapter } = await import("openclaw/plugin-sdk");
      // TODO: Wire with actual runtime dependencies
      // This is a placeholder — the actual wiring depends on how the runtime provides
      // sendMessageSlack and pollSystemEvents to the plugin context
      throw new Error("Slack interactive adapter not yet wired to runtime");
    },
    askConfirmation: async (params) => {
      throw new Error("Slack interactive adapter not yet wired to runtime");
    },
  },
```

**Important note:** The exact wiring depends on how the plugin runtime exposes `sendMessageSlack` and system event polling. This task establishes the contract; Task 12 handles the runtime wiring.

**Step 3: Verify it compiles**

Run: `pnpm check` or `npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add extensions/slack/src/channel.ts
git commit -m "feat(slack): wire interactive capability and adapter stub"
```

---

## Task 12: Wire Slack Runtime for Interactive Adapter

**Files:**

- Modify: `extensions/slack/src/runtime.ts` — add interactive methods
- Modify: `extensions/slack/src/channel.ts` — replace stub with runtime calls

**Step 1: Understand the runtime pattern**

Read `extensions/slack/src/runtime.ts` to understand how the Slack runtime provides access to `sendMessageSlack` and other channel functions. The pattern is:

```typescript
getSlackRuntime().channel.slack.sendMessageSlack(...)
```

**Step 2: Wire the interactive adapter to runtime**

In `extensions/slack/src/channel.ts`, replace the stub `interactive:` block with:

```typescript
  interactive: (() => {
    const { createSlackInteractiveAdapter } = require("openclaw/plugin-sdk");
    // Lazy-init so runtime is available when methods are called
    let adapter: ReturnType<typeof createSlackInteractiveAdapter> | null = null;
    const getAdapter = () => {
      if (!adapter) {
        adapter = createSlackInteractiveAdapter({
          sendMessageSlack: (to, message, opts) =>
            getSlackRuntime().channel.slack.sendMessageSlack(to, message, opts),
          pollSystemEvents: (sessionKey) => {
            const { peekSystemEvents } = require("openclaw/plugin-sdk");
            return peekSystemEvents(sessionKey);
          },
        });
      }
      return adapter;
    };
    return {
      askQuestion: (params) => getAdapter().askQuestion(params),
      askConfirmation: (params) => getAdapter().askConfirmation(params),
    };
  })(),
```

**Note:** The exact import pattern (`require` vs dynamic `import()`) and the availability of `peekSystemEvents` in the plugin SDK need to be verified. Adjust based on what's actually exported from `openclaw/plugin-sdk`.

**Step 3: Export the interactive adapter factory from plugin-sdk**

Check what `src/plugin-sdk/` exports and add `createSlackInteractiveAdapter` and `peekSystemEventEntries` to the exports if they're not already available.

**Step 4: Run Slack tests**

Run: `pnpm vitest run src/slack/ extensions/slack/`
Expected: All existing tests pass

**Step 5: Commit**

```bash
git add extensions/slack/src/channel.ts extensions/slack/src/runtime.ts
git commit -m "feat(slack): wire interactive adapter to runtime"
```

---

## Task 13: Integration Test — End-to-End Interactive Prompt

**Files:**

- Create: `src/slack/interactive-adapter.e2e.test.ts`

**Step 1: Write an integration test**

This test verifies the full flow: adapter sends blocks → mock interaction event → adapter resolves response.

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import { createSlackInteractiveAdapter } from "./interactive-adapter.js";
import {
  enqueueSystemEvent,
  resetSystemEventsForTest,
  peekSystemEventEntries,
} from "../infra/system-events.js";

describe("Slack interactive adapter e2e", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
  });

  it("resolves when matching interaction event arrives", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });

    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: (sessionKey) => peekSystemEventEntries(sessionKey).map((e) => e),
    });

    const responsePromise = adapter.askQuestion({
      to: "C123",
      question: {
        id: "test_q1",
        text: "Pick a color",
        options: [
          { value: "red", label: "Red" },
          { value: "blue", label: "Blue" },
        ],
        timeoutMs: 5000,
      },
    });

    // Simulate user clicking "Blue" button after a short delay
    setTimeout(() => {
      enqueueSystemEvent(
        `Slack interaction: ${JSON.stringify({
          interactionType: "block_action",
          actionId: "openclaw:question:test_q1:blue",
          actionType: "button",
          value: "blue",
          userId: "U456",
          channelId: "C123",
        })}`,
        { sessionKey: "C123" },
      );
    }, 200);

    const response = await responsePromise;
    expect(response.answered).toBe(true);
    expect(response.timedOut).toBe(false);
    expect(response.selectedValues).toContain("blue");
    expect(response.respondedBy?.id).toBe("U456");
  });

  it("resolves confirmation when user approves", async () => {
    const sendMock = vi.fn().mockResolvedValue({ messageId: "msg1", channelId: "C123" });

    const adapter = createSlackInteractiveAdapter({
      sendMessageSlack: sendMock,
      pollSystemEvents: (sessionKey) => peekSystemEventEntries(sessionKey).map((e) => e),
    });

    const responsePromise = adapter.askConfirmation({
      to: "C123",
      confirmation: {
        id: "test_c1",
        title: "Deploy?",
        message: "Deploy to production?",
        timeoutMs: 5000,
      },
    });

    setTimeout(() => {
      enqueueSystemEvent(
        `Slack interaction: ${JSON.stringify({
          interactionType: "block_action",
          actionId: "openclaw:confirm:test_c1:confirm",
          actionType: "button",
          value: "confirm",
          userId: "U789",
          channelId: "C123",
        })}`,
        { sessionKey: "C123" },
      );
    }, 200);

    const response = await responsePromise;
    expect(response.answered).toBe(true);
    expect(response.confirmed).toBe(true);
    expect(response.respondedBy?.id).toBe("U789");
  });
});
```

**Step 2: Run the integration test**

Run: `pnpm vitest run src/slack/interactive-adapter.e2e.test.ts`
Expected: PASS

**Step 3: Commit**

```bash
git add src/slack/interactive-adapter.e2e.test.ts
git commit -m "test(slack): add interactive adapter integration tests"
```

---

## Task 14: Clean Up — Remove dgarson/ Directory

**Files:**

- Remove: `dgarson/` (entire directory)

**Step 1: Verify all needed code has been integrated**

Checklist:

- [x] `dgarson/src/slack/blocks/types.ts` → `src/slack/blocks/types.ts`
- [x] `dgarson/src/slack/blocks/builders.ts` → `src/slack/blocks/builders.ts`
- [x] `dgarson/src/slack/blocks/patterns.ts` → `src/slack/blocks/patterns.ts`
- [x] `dgarson/src/slack/blocks/validation.ts` → `src/slack/blocks/validation.ts`
- [x] Interactive question/confirmation → channel-agnostic tools
- [x] Block fallback/input → moved to `src/slack/blocks/`
- [ ] `dgarson/src/slack/tools/rich-message-tool.ts` → optional Slack bonus tool (defer)
- [ ] `dgarson/src/slack/tools/interactive-form-tool.ts` → optional Slack bonus tool (defer)
- [ ] `dgarson/ux/` → out of scope (UX docs only)

**Step 2: Remove the directory**

```bash
rm -rf dgarson/
```

**Step 3: Run full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove dgarson/ POC directory after integration"
```

---

## Task 15: Final Verification

**Step 1: Run the full test suite**

Run: `pnpm test`
Expected: All tests pass

**Step 2: Run type checking**

Run: `pnpm check`
Expected: No type or format errors

**Step 3: Run linting**

Run: `pnpm lint` (or the project's lint command)
Expected: Clean

**Step 4: Verify the feature summary**

- New capability: `interactivePrompts` in `ChannelCapabilities`
- New adapter: `ChannelInteractiveAdapter` with `askQuestion` + `askConfirmation`
- New agent tools: `ask_question` + `ask_confirmation`
- Slack implementation: Block Kit buttons via existing send + system events
- Block Kit library: `src/slack/blocks/` with types, builders, patterns, validation
- Existing code: `blocks-fallback.ts` and `blocks-input.ts` consolidated into `blocks/`

---

## Summary of All Files Changed

### New Files (11)

- `src/channels/plugins/types.interactive.ts`
- `src/channels/plugins/types.interactive.test.ts`
- `src/slack/blocks/types.ts`
- `src/slack/blocks/builders.ts`
- `src/slack/blocks/builders.test.ts`
- `src/slack/blocks/patterns.ts`
- `src/slack/blocks/validation.ts`
- `src/slack/blocks/index.ts`
- `src/slack/interactive-adapter.ts`
- `src/slack/interactive-adapter.test.ts`
- `src/slack/interactive-adapter.e2e.test.ts`
- `src/agents/tools/interactive-prompt-tool.ts`
- `src/agents/tools/interactive-prompt-tool.test.ts`
- `src/agents/tools/interactive-confirmation-tool.ts`
- `src/agents/tools/interactive-confirmation-tool.test.ts`

### Moved Files (5)

- `src/slack/blocks-fallback.ts` → `src/slack/blocks/fallback.ts`
- `src/slack/blocks-input.ts` → `src/slack/blocks/input.ts`
- `src/slack/blocks-fallback.test.ts` → `src/slack/blocks/fallback.test.ts`
- `src/slack/blocks-input.test.ts` → `src/slack/blocks/input.test.ts`
- `src/slack/blocks.test-helpers.ts` → `src/slack/blocks/test-helpers.ts`

### Modified Files (6)

- `src/channels/plugins/types.core.ts` — add `interactivePrompts` capability
- `src/channels/plugins/types.plugin.ts` — add `interactive` adapter + import
- `src/channels/plugins/types.ts` — add barrel exports
- `src/slack/send.ts` — update import paths
- `src/slack/actions.ts` — update import paths
- `src/plugin-sdk/slack-message-actions.ts` — update import path
- `src/agents/tools/slack-actions.ts` — update import path
- `extensions/slack/src/channel.ts` — add capability + adapter

### Removed

- `dgarson/` (entire directory)

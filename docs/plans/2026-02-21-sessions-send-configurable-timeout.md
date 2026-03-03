# sessions_send Configurable Default Timeout

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `tools.sessions.sendTimeoutSeconds` config key so the default wait timeout for `sessions_send` is configurable, and bump the hardcoded fallback from 30s to 120s.

**Architecture:** The `sessions_send` tool already calls `loadConfig()` internally, so no extra config threading is needed. We add the field to the TypeScript type, the Zod schema, labels, and help text, then read it in the tool with `120` as the ultimate fallback. Four files total; one new unit test.

**Tech Stack:** TypeScript, Zod, Vitest

---

### Task 1: Add the type field

**Files:**

- Modify: `src/config/types.tools.ts`

The `ToolsConfig.sessions` block (line ~495) currently only has `visibility`. Add `sendTimeoutSeconds`.

**Step 1: Edit the type**

In `src/config/types.tools.ts`, find:

```ts
  sessions?: {
    visibility?: SessionsToolsVisibility;
  };
```

Change to:

```ts
  sessions?: {
    visibility?: SessionsToolsVisibility;
    /** Default timeout in seconds when sessions_send does not specify timeoutSeconds (default: 120). */
    sendTimeoutSeconds?: number;
  };
```

**Step 2: Commit**

```bash
scripts/committer "feat: add sendTimeoutSeconds to ToolsConfig.sessions type" src/config/types.tools.ts
```

---

### Task 2: Add the Zod schema field

**Files:**

- Modify: `src/config/zod-schema.agent-runtime.ts`

The `sessions` object in the tools schema is at roughly line 666. It currently looks like:

```ts
sessions: z
  .object({
    visibility: z.enum(["self", "tree", "agent", "all"]).optional(),
  })
  .strict()
  .optional(),
```

**Step 1: Edit the schema**

Add `sendTimeoutSeconds`:

```ts
sessions: z
  .object({
    visibility: z.enum(["self", "tree", "agent", "all"]).optional(),
    sendTimeoutSeconds: z.number().int().min(0).optional(),
  })
  .strict()
  .optional(),
```

**Step 2: Verify typecheck passes**

```bash
pnpm tsgo
```

Expected: no errors.

**Step 3: Commit**

```bash
scripts/committer "feat: add sendTimeoutSeconds to sessions Zod schema" src/config/zod-schema.agent-runtime.ts
```

---

### Task 3: Add labels and help text

**Files:**

- Modify: `src/config/schema.labels.ts`
- Modify: `src/config/schema.help.ts`

**Step 1: Add label**

In `src/config/schema.labels.ts`, after the `"tools.sessions.visibility"` entry (line ~85), add:

```ts
  "tools.sessions.sendTimeoutSeconds": "Session Send Default Timeout (s)",
```

**Step 2: Add help text**

In `src/config/schema.help.ts`, after the `"tools.sessions.visibility"` entry (line ~93), add:

```ts
  "tools.sessions.sendTimeoutSeconds":
    "Default timeout in seconds for sessions_send when the agent does not pass timeoutSeconds explicitly (default: 120). Set to 0 for fire-and-forget.",
```

**Step 3: Commit**

```bash
scripts/committer "feat: add sessions.sendTimeoutSeconds label and help text" src/config/schema.labels.ts src/config/schema.help.ts
```

---

### Task 4: Write the failing test

**Files:**

- Modify: `src/gateway/server-cron.test.ts` — no, wrong file
- Modify: `src/agents/tools/sessions.e2e.test.ts` — check if there's a unit test file first

Actually, look for an existing unit test for the timeout fallback logic. The closest is `src/gateway/server-cron.test.ts` (for cron) — for session send, add a new focused unit test file.

**Step 1: Create the test file**

Create `src/agents/tools/sessions-send-tool.timeout.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadConfigMock = vi.fn();
const callGatewayMock = vi.fn();

vi.mock("../../config/config.js", async () => {
  const actual =
    await vi.importActual<typeof import("../../config/config.js")>("../../config/config.js");
  return { ...actual, loadConfig: () => loadConfigMock() };
});

vi.mock("../../gateway/call.js", () => ({
  callGateway: (...args: unknown[]) => callGatewayMock(...args),
}));

// Must import after mocks
const { createSessionsSendTool } = await import("./sessions-send-tool.js");

const BASE_CFG = {
  session: { mainKey: "main" },
};

function makeGatewayReplies(runId = "run-1") {
  // agent dispatch → agent.wait → chat.history
  callGatewayMock
    .mockResolvedValueOnce({ runId }) // agent
    .mockResolvedValueOnce({ status: "ok" }) // agent.wait
    .mockResolvedValueOnce({ messages: [] }); // chat.history
}

describe("sessions_send default timeout", () => {
  beforeEach(() => {
    loadConfigMock.mockReset();
    callGatewayMock.mockReset();
  });

  it("uses 120s when no config and no param", async () => {
    loadConfigMock.mockReturnValue(BASE_CFG);
    makeGatewayReplies();

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    await tool.execute("tc-1", {
      sessionKey: "agent:main:slack:channel:abc",
      message: "hello",
    });

    // agent.wait call (second gateway call) must have timeoutMs: 120_000
    const waitCall = callGatewayMock.mock.calls[1];
    expect(waitCall[0]).toMatchObject({
      method: "agent.wait",
      params: expect.objectContaining({ timeoutMs: 120_000 }),
    });
  });

  it("uses config value when tools.sessions.sendTimeoutSeconds is set", async () => {
    loadConfigMock.mockReturnValue({
      ...BASE_CFG,
      tools: { sessions: { sendTimeoutSeconds: 300 } },
    });
    makeGatewayReplies();

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    await tool.execute("tc-2", {
      sessionKey: "agent:main:slack:channel:abc",
      message: "hello",
    });

    const waitCall = callGatewayMock.mock.calls[1];
    expect(waitCall[0]).toMatchObject({
      method: "agent.wait",
      params: expect.objectContaining({ timeoutMs: 300_000 }),
    });
  });

  it("explicit timeoutSeconds param overrides config", async () => {
    loadConfigMock.mockReturnValue({
      ...BASE_CFG,
      tools: { sessions: { sendTimeoutSeconds: 300 } },
    });
    makeGatewayReplies();

    const tool = createSessionsSendTool({ agentSessionKey: "agent:main:main" });
    await tool.execute("tc-3", {
      sessionKey: "agent:main:slack:channel:abc",
      message: "hello",
      timeoutSeconds: 60,
    });

    const waitCall = callGatewayMock.mock.calls[1];
    expect(waitCall[0]).toMatchObject({
      method: "agent.wait",
      params: expect.objectContaining({ timeoutMs: 60_000 }),
    });
  });
});
```

**Step 2: Run the test — expect failure**

```bash
pnpm vitest run src/agents/tools/sessions-send-tool.timeout.test.ts
```

Expected: FAIL — the first test will show `timeoutMs: 30_000` (old default), not `120_000`.

---

### Task 5: Implement the fix in the tool

**Files:**

- Modify: `src/agents/tools/sessions-send-tool.ts`

**Step 1: Find the timeout resolution block** (lines ~193–197):

```ts
const timeoutSeconds =
  typeof params.timeoutSeconds === "number" && Number.isFinite(params.timeoutSeconds)
    ? Math.max(0, Math.floor(params.timeoutSeconds))
    : 30;
```

**Step 2: Replace with config-aware version**

The `cfg` variable is already in scope (loaded at line 49). Replace those lines with:

```ts
const DEFAULT_SEND_TIMEOUT_SECONDS = 120;
const configDefault =
  typeof cfg.tools?.sessions?.sendTimeoutSeconds === "number" &&
  Number.isFinite(cfg.tools.sessions.sendTimeoutSeconds)
    ? Math.max(0, Math.floor(cfg.tools.sessions.sendTimeoutSeconds))
    : DEFAULT_SEND_TIMEOUT_SECONDS;
const timeoutSeconds =
  typeof params.timeoutSeconds === "number" && Number.isFinite(params.timeoutSeconds)
    ? Math.max(0, Math.floor(params.timeoutSeconds))
    : configDefault;
```

**Step 3: Run the tests — expect all three to pass**

```bash
pnpm vitest run src/agents/tools/sessions-send-tool.timeout.test.ts
```

Expected: all 3 PASS.

**Step 4: Run broader test suite to check for regressions**

```bash
pnpm test:fast
```

Expected: no new failures.

**Step 5: Commit everything**

```bash
scripts/committer "feat: configurable sessions_send default timeout (120s)" \
  src/agents/tools/sessions-send-tool.ts \
  src/agents/tools/sessions-send-tool.timeout.test.ts
```

---

### Task 6: Final typecheck and lint

**Step 1:**

```bash
pnpm check
```

Expected: no errors.

**Step 2: If clean, you're done.** If lint errors appear, fix and re-commit the affected files.

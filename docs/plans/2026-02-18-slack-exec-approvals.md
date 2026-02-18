# Slack Exec Approvals Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add `SlackExecApprovalHandler` so Slack gets Block Kit approve/deny buttons for exec approvals instead of the text-only fallback.

**Architecture:** A thin handler in `src/slack/monitor/exec-approvals.ts` that owns a `GatewayClient` (for `exec.approval.requested` events), posts Block Kit messages via `sendMessageSlack`, and polls `peekSystemEventEntries` for the button click (already enqueued by `registerSlackInteractionEvents`). When a click arrives from a configured approver, it calls `gatewayClient.request("exec.approval.resolve", ...)`. No changes to `interactions.ts`, `exec-approval-forwarder.ts`, or any gateway code.

**Tech Stack:** `@slack/web-api` Block Kit types, `src/slack/blocks/builders.ts`, `src/infra/system-events.ts` (`peekSystemEventEntries`), `src/gateway/client.ts` (`GatewayClient`), Vitest

---

### Task 1: Add `SlackExecApprovalConfig` type

**Files:**

- Modify: `src/config/types.slack.ts:163-174` (after the `dm?` field, before `channels?`)

**Step 1: Add the type and field**

In `src/config/types.slack.ts`, insert after line 163 (`dm?: SlackDmConfig;`):

```ts
export type SlackExecApprovalConfig = {
  /** Enable interactive Block Kit exec approvals for this Slack account. Default: false. */
  enabled?: boolean;
  /** Slack user IDs authorized to click approval buttons. Required if enabled. */
  approvers?: string[];
  /** Only forward approvals for these agent IDs. Omit = all agents. */
  agentFilter?: string[];
  /** Only forward approvals matching these session key patterns (substring or regex). */
  sessionFilter?: string[];
};
```

Then add a field to `SlackAccountConfig` after `dm?: SlackDmConfig;`:

```ts
  /** Interactive exec approval forwarding configuration. */
  execApprovals?: SlackExecApprovalConfig;
```

**Step 2: Verify no type errors**

```bash
cd /Users/davidgarson/dev/openclaw && npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

**Step 3: Commit**

```bash
git add src/config/types.slack.ts
git commit -m "feat(slack): add SlackExecApprovalConfig type"
```

---

### Task 2: Create handler skeleton with `extractSlackChannelId` + test

**Files:**

- Create: `src/slack/monitor/exec-approvals.ts`
- Create: `src/slack/monitor/exec-approvals.test.ts`

**Step 1: Write the failing test**

Create `src/slack/monitor/exec-approvals.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { extractSlackChannelId } from "./exec-approvals.js";

describe("extractSlackChannelId", () => {
  it("extracts channel ID from a channel session key", () => {
    expect(extractSlackChannelId("agent:main:slack:channel:C1234567890")).toBe("C1234567890");
  });

  it("extracts channel ID from a group session key", () => {
    expect(extractSlackChannelId("agent:main:slack:group:G0987654321")).toBe("G0987654321");
  });

  it("returns null for a DM session key (no channel: or group: prefix)", () => {
    // DMs use "slack:D123" without a channel/group segment — not appropriate for approvals
    expect(extractSlackChannelId("agent:main:slack:D1234567890")).toBeNull();
  });

  it("returns null for a Discord session key", () => {
    expect(extractSlackChannelId("agent:main:discord:channel:123456789")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(extractSlackChannelId(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(extractSlackChannelId(undefined)).toBeNull();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -20
```

Expected: FAIL — module not found.

**Step 3: Create the handler skeleton**

Create `src/slack/monitor/exec-approvals.ts`:

```ts
import { buildGatewayConnectionDetails } from "../../gateway/call.js";
import { GatewayClient } from "../../gateway/client.js";
import type { EventFrame } from "../../gateway/protocol/index.js";
import type { ExecApprovalDecision, ExecApprovalRequest } from "../../infra/exec-approvals.js";
import { peekSystemEventEntries } from "../../infra/system-events.js";
import { logDebug, logError } from "../../logger.js";
import { loadSessionStore, resolveStorePath } from "../../config/sessions.js";
import type { OpenClawConfig } from "../../config/config.js";
import { normalizeAccountId, resolveAgentIdFromSessionKey } from "../../routing/session-key.js";
import { normalizeMessageChannel } from "../../utils/message-channel.js";
import { sendMessageSlack } from "../send.js";
import { actions, button, divider, header, mrkdwn, section } from "../blocks/builders.js";
import type { SlackExecApprovalConfig } from "../../config/types.slack.js";
import type { Block, KnownBlock } from "@slack/web-api";
import { GATEWAY_CLIENT_MODES, GATEWAY_CLIENT_NAMES } from "../../utils/message-channel.js";

const APPROVAL_ACTION_PREFIX = "openclaw:question:";
const POLL_INTERVAL_MS = 500;

/** Extract Slack channel ID from a session key like "agent:main:slack:channel:C12345" */
export function extractSlackChannelId(sessionKey?: string | null): string | null {
  if (!sessionKey) return null;
  const match = sessionKey.match(/slack:(?:channel|group):([A-Z0-9]+)/i);
  return match ? match[1] : null;
}

export type SlackExecApprovalHandlerOpts = {
  accountId: string;
  botToken: string;
  config: SlackExecApprovalConfig;
  gatewayUrl?: string;
  cfg: OpenClawConfig;
};

export class SlackExecApprovalHandler {
  private gatewayClient: GatewayClient | null = null;
  private started = false;
  private opts: SlackExecApprovalHandlerOpts;

  constructor(opts: SlackExecApprovalHandlerOpts) {
    this.opts = opts;
  }

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    if (!this.opts.config.enabled) {
      logDebug("slack exec approvals: disabled");
      return;
    }
    if (!this.opts.config.approvers?.length) {
      logDebug("slack exec approvals: no approvers configured");
      return;
    }
    logDebug("slack exec approvals: starting handler");
    const { url: gatewayUrl } = buildGatewayConnectionDetails({
      config: this.opts.cfg,
      url: this.opts.gatewayUrl,
    });
    this.gatewayClient = new GatewayClient({
      url: gatewayUrl,
      clientName: GATEWAY_CLIENT_NAMES.GATEWAY_CLIENT,
      clientDisplayName: "Slack Exec Approvals",
      mode: GATEWAY_CLIENT_MODES.BACKEND,
      scopes: ["operator.approvals"],
      onEvent: (evt) => this.handleGatewayEvent(evt),
      onHelloOk: () => logDebug("slack exec approvals: connected to gateway"),
      onConnectError: (err) => logError(`slack exec approvals: connect error: ${err.message}`),
      onClose: (code, reason) =>
        logDebug(`slack exec approvals: gateway closed: ${code} ${reason}`),
    });
    this.gatewayClient.start();
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.gatewayClient?.stop();
    this.gatewayClient = null;
    logDebug("slack exec approvals: stopped");
  }

  private handleGatewayEvent(evt: EventFrame): void {
    if (evt.event === "exec.approval.requested") {
      void this.handleApprovalRequested(evt.payload as ExecApprovalRequest);
    }
  }

  shouldHandle(request: ExecApprovalRequest): boolean {
    const config = this.opts.config;
    if (!config.enabled) return false;
    if (!config.approvers?.length) return false;
    if (!this.isForThisAccount(request)) return false;
    if (config.agentFilter?.length) {
      if (!request.request.agentId) return false;
      if (!config.agentFilter.includes(request.request.agentId)) return false;
    }
    if (config.sessionFilter?.length) {
      const session = request.request.sessionKey;
      if (!session) return false;
      const matches = config.sessionFilter.some((p) => {
        try {
          return session.includes(p) || new RegExp(p).test(session);
        } catch {
          return session.includes(p);
        }
      });
      if (!matches) return false;
    }
    return true;
  }

  private isForThisAccount(request: ExecApprovalRequest): boolean {
    const sessionKey = request.request.sessionKey?.trim();
    if (!sessionKey) return true; // no session key → accept (can't filter)
    try {
      const agentId = resolveAgentIdFromSessionKey(sessionKey);
      const storePath = resolveStorePath(this.opts.cfg.session?.store, { agentId });
      const store = loadSessionStore(storePath);
      const entry = store[sessionKey];
      const channel = normalizeMessageChannel(entry?.origin?.provider ?? entry?.lastChannel);
      if (channel && channel !== "slack") return false;
      const accountId = entry?.origin?.accountId ?? entry?.lastAccountId;
      if (accountId) {
        return normalizeAccountId(accountId) === normalizeAccountId(this.opts.accountId);
      }
      return true;
    } catch {
      return true;
    }
  }

  private async handleApprovalRequested(_request: ExecApprovalRequest): Promise<void> {
    // Implemented in Task 5
  }
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -20
```

Expected: PASS (6 tests).

**Step 5: Commit**

```bash
git add src/slack/monitor/exec-approvals.ts src/slack/monitor/exec-approvals.test.ts
git commit -m "feat(slack): add SlackExecApprovalHandler skeleton with extractSlackChannelId"
```

---

### Task 3: Add `buildExecApprovalBlocks` + test

**Files:**

- Modify: `src/slack/monitor/exec-approvals.ts`
- Modify: `src/slack/monitor/exec-approvals.test.ts`

**Step 1: Write the failing tests**

Add to `src/slack/monitor/exec-approvals.test.ts`:

```ts
import { buildExecApprovalBlocks, buildExecApprovalActionId } from "./exec-approvals.js";
import type { ExecApprovalRequest } from "../../infra/exec-approvals.js";

const baseRequest: ExecApprovalRequest = {
  id: "req-1",
  request: {
    command: "rm -rf /tmp/old",
    cwd: "/home/user",
    agentId: "main",
    sessionKey: "agent:main:slack:channel:C1234567890",
  },
  createdAtMs: Date.now(),
  expiresAtMs: Date.now() + 120_000,
};

describe("buildExecApprovalActionId", () => {
  it("builds allow-once action ID", () => {
    expect(buildExecApprovalActionId("req-1", "allow-once")).toBe(
      "openclaw:question:req-1:allow-once",
    );
  });

  it("builds deny action ID", () => {
    expect(buildExecApprovalActionId("req-1", "deny")).toBe("openclaw:question:req-1:deny");
  });
});

describe("buildExecApprovalBlocks", () => {
  it("returns an array of blocks", () => {
    const blocks = buildExecApprovalBlocks(baseRequest);
    expect(blocks.length).toBeGreaterThan(0);
  });

  it("includes a header block", () => {
    const blocks = buildExecApprovalBlocks(baseRequest);
    expect(blocks.some((b) => (b as { type: string }).type === "header")).toBe(true);
  });

  it("includes an actions block with 3 buttons", () => {
    const blocks = buildExecApprovalBlocks(baseRequest);
    const actionsBlock = blocks.find((b) => (b as { type: string }).type === "actions") as
      | { type: string; elements: unknown[] }
      | undefined;
    expect(actionsBlock).toBeDefined();
    expect(actionsBlock!.elements).toHaveLength(3);
  });

  it("truncates very long commands", () => {
    const longCmd = "x".repeat(1000);
    const blocks = buildExecApprovalBlocks({
      ...baseRequest,
      request: { ...baseRequest.request, command: longCmd },
    });
    const sectionBlock = blocks.find((b) => (b as { type: string }).type === "section") as
      | { type: string; text: { text: string } }
      | undefined;
    expect(sectionBlock?.text.text.length).toBeLessThan(900);
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -20
```

Expected: FAIL — `buildExecApprovalBlocks` not exported.

**Step 3: Add block builders to the handler**

Add these exported functions to `src/slack/monitor/exec-approvals.ts` (before the class definition):

```ts
export function buildExecApprovalActionId(
  requestId: string,
  decision: ExecApprovalDecision,
): string {
  return `${APPROVAL_ACTION_PREFIX}${requestId}:${decision}`;
}

export function buildExecApprovalBlocks(request: ExecApprovalRequest): (Block | KnownBlock)[] {
  const cmd = request.request.command;
  const preview = cmd.length > 800 ? `${cmd.slice(0, 800)}...` : cmd;

  const metaLines: string[] = [];
  if (request.request.cwd) metaLines.push(`*CWD:* ${request.request.cwd}`);
  if (request.request.host) metaLines.push(`*Host:* ${request.request.host}`);
  if (request.request.agentId) metaLines.push(`*Agent:* ${request.request.agentId}`);

  const blocks: (Block | KnownBlock)[] = [
    header("🔒 Exec Approval Required") as unknown as KnownBlock,
    section({ text: mrkdwn(`*Command:*\n\`\`\`\n${preview}\n\`\`\``) }) as unknown as KnownBlock,
  ];

  if (metaLines.length > 0) {
    blocks.push(section({ text: mrkdwn(metaLines.join("\n")) }) as unknown as KnownBlock);
  }

  blocks.push(divider() as unknown as KnownBlock);
  blocks.push(
    actions({
      elements: [
        button({
          text: "Allow once",
          actionId: buildExecApprovalActionId(request.id, "allow-once"),
          value: "allow-once",
          style: "primary",
        }),
        button({
          text: "Always allow",
          actionId: buildExecApprovalActionId(request.id, "allow-always"),
          value: "allow-always",
        }),
        button({
          text: "Deny",
          actionId: buildExecApprovalActionId(request.id, "deny"),
          value: "deny",
          style: "danger",
        }),
      ],
    }) as unknown as KnownBlock,
  );

  return blocks;
}
```

**Step 4: Run tests to verify they pass**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -20
```

Expected: PASS.

**Step 5: Commit**

```bash
git add src/slack/monitor/exec-approvals.ts src/slack/monitor/exec-approvals.test.ts
git commit -m "feat(slack): add buildExecApprovalBlocks and action ID helpers"
```

---

### Task 4: Test `shouldHandle` filtering

**Files:**

- Modify: `src/slack/monitor/exec-approvals.test.ts`

The `shouldHandle` method is already implemented in the skeleton. Add tests to verify it.

**Step 1: Write the tests**

Add to `src/slack/monitor/exec-approvals.test.ts`:

```ts
import { SlackExecApprovalHandler } from "./exec-approvals.js";
import type { OpenClawConfig } from "../../config/config.js";

const minimalCfg = {} as OpenClawConfig;

function makeHandler(
  config: Partial<import("../../config/types.slack.js").SlackExecApprovalConfig>,
) {
  return new SlackExecApprovalHandler({
    accountId: "default",
    botToken: "xoxb-test",
    config: { enabled: true, approvers: ["U123"], ...config },
    cfg: minimalCfg,
  });
}

const basicRequest: ExecApprovalRequest = {
  id: "req-2",
  request: { command: "ls", sessionKey: null },
  createdAtMs: Date.now(),
  expiresAtMs: Date.now() + 60_000,
};

describe("SlackExecApprovalHandler.shouldHandle", () => {
  it("returns false when disabled", () => {
    const handler = makeHandler({ enabled: false });
    expect(handler.shouldHandle(basicRequest)).toBe(false);
  });

  it("returns false when no approvers configured", () => {
    const handler = makeHandler({ approvers: [] });
    expect(handler.shouldHandle(basicRequest)).toBe(false);
  });

  it("returns true for a basic request with enabled=true and approvers set", () => {
    const handler = makeHandler({});
    expect(handler.shouldHandle(basicRequest)).toBe(true);
  });

  it("returns false when agentFilter set and agent does not match", () => {
    const handler = makeHandler({ agentFilter: ["other-agent"] });
    const request = { ...basicRequest, request: { ...basicRequest.request, agentId: "main" } };
    expect(handler.shouldHandle(request)).toBe(false);
  });

  it("returns true when agentFilter set and agent matches", () => {
    const handler = makeHandler({ agentFilter: ["main"] });
    const request = { ...basicRequest, request: { ...basicRequest.request, agentId: "main" } };
    expect(handler.shouldHandle(request)).toBe(true);
  });

  it("returns false when sessionFilter set and session does not match", () => {
    const handler = makeHandler({ sessionFilter: ["production"] });
    const request = {
      ...basicRequest,
      request: { ...basicRequest.request, sessionKey: "agent:main:slack:channel:C123" },
    };
    expect(handler.shouldHandle(request)).toBe(false);
  });

  it("returns true when sessionFilter set and session matches", () => {
    const handler = makeHandler({ sessionFilter: ["slack:channel"] });
    const request = {
      ...basicRequest,
      request: { ...basicRequest.request, sessionKey: "agent:main:slack:channel:C123" },
    };
    expect(handler.shouldHandle(request)).toBe(true);
  });
});
```

**Step 2: Run tests**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -20
```

Expected: PASS.

**Step 3: Commit**

```bash
git add src/slack/monitor/exec-approvals.test.ts
git commit -m "test(slack): add shouldHandle coverage for SlackExecApprovalHandler"
```

---

### Task 5: Implement `handleApprovalRequested` with polling + test

**Files:**

- Modify: `src/slack/monitor/exec-approvals.ts`
- Modify: `src/slack/monitor/exec-approvals.test.ts`

**Step 1: Write the failing test**

Add to `src/slack/monitor/exec-approvals.test.ts`:

```ts
import { vi, beforeEach, afterEach } from "vitest";
import { enqueueSystemEvent, resetSystemEventsForTest } from "../../infra/system-events.js";

// We test the polling logic indirectly via a handler with a mocked gateway client.
// The handler is instantiated, we enqueue system events as if registerSlackInteractionEvents
// did it, and verify gatewayClient.request is called with the right decision.

describe("SlackExecApprovalHandler.handleApprovalRequested polling", () => {
  beforeEach(() => {
    resetSystemEventsForTest();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSystemEventsForTest();
  });

  it("resolves approval when a matching system event arrives", async () => {
    const mockResolve = vi.fn().mockResolvedValue(undefined);

    // Create handler and directly access its private method via any cast
    const handler = makeHandler({}) as unknown as {
      gatewayClient: { request: typeof mockResolve } | null;
      handleApprovalRequested: (req: ExecApprovalRequest) => Promise<void>;
    };
    handler.gatewayClient = { request: mockResolve };

    const request: ExecApprovalRequest = {
      id: "poll-test-1",
      request: { command: "echo hi", sessionKey: "agent:main:slack:channel:C_POLL" },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 5_000,
    };

    // Simulate sendMessageSlack succeeding (it hits the network; we bypass by
    // stubbing the module or accepting it will throw, but the handler catches it).
    // For a unit test we focus on the polling path; sendMessageSlack will throw
    // because there's no Slack token — that's fine, handler returns early.
    // To test the polling we need to stub sendMessageSlack too.

    // Instead, test pollForDecision behavior directly via enqueueSystemEvent + internal call.
    // Enqueue a button-click event before calling handleApprovalRequested.
    const sessionKey = "agent:main:slack:channel:C_POLL";
    const actionId = `openclaw:question:poll-test-1:allow-once`;
    enqueueSystemEvent(
      `Slack interaction: ${JSON.stringify({ actionId, userId: "U123", selectedValues: ["allow-once"] })}`,
      { sessionKey },
    );

    // Stub sendMessageSlack to avoid network call
    const sendModule = await import("../send.js");
    const sendSpy = vi
      .spyOn(sendModule, "sendMessageSlack")
      .mockResolvedValue({ messageId: "T123", channelId: "C_POLL" });

    await handler.handleApprovalRequested(request);

    expect(mockResolve).toHaveBeenCalledWith("exec.approval.resolve", {
      id: "poll-test-1",
      decision: "allow-once",
    });

    sendSpy.mockRestore();
  });

  it("does not resolve if userId is not in approvers", async () => {
    const mockResolve = vi.fn().mockResolvedValue(undefined);
    const handler = makeHandler({}) as unknown as {
      gatewayClient: { request: typeof mockResolve } | null;
      handleApprovalRequested: (req: ExecApprovalRequest) => Promise<void>;
    };
    handler.gatewayClient = { request: mockResolve };

    const request: ExecApprovalRequest = {
      id: "poll-test-2",
      request: { command: "ls", sessionKey: "agent:main:slack:channel:C_POLL2" },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 100, // very short timeout
    };

    const sessionKey = "agent:main:slack:channel:C_POLL2";
    enqueueSystemEvent(
      `Slack interaction: ${JSON.stringify({ actionId: "openclaw:question:poll-test-2:deny", userId: "U_NOT_APPROVER" })}`,
      { sessionKey },
    );

    const sendModule = await import("../send.js");
    const sendSpy = vi
      .spyOn(sendModule, "sendMessageSlack")
      .mockResolvedValue({ messageId: "T999", channelId: "C_POLL2" });

    // Advance timers past the timeout
    const pendingPromise = handler.handleApprovalRequested(request);
    vi.advanceTimersByTime(200);
    await pendingPromise;

    expect(mockResolve).not.toHaveBeenCalled();
    sendSpy.mockRestore();
  });
});
```

**Step 2: Run to verify it fails**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -30
```

Expected: FAIL — `handleApprovalRequested` is a no-op.

**Step 3: Implement `handleApprovalRequested` and `pollForDecision`**

Replace the `private async handleApprovalRequested(_request: ExecApprovalRequest): Promise<void> {}` stub in `exec-approvals.ts` with:

```ts
private async handleApprovalRequested(request: ExecApprovalRequest): Promise<void> {
  if (!this.shouldHandle(request)) return;

  const channelId = extractSlackChannelId(request.request.sessionKey);
  if (!channelId) {
    logError(
      `slack exec approvals: cannot extract channel id from "${request.request.sessionKey ?? "(none)"}"`,
    );
    return;
  }

  const blocks = buildExecApprovalBlocks(request);
  const preview = request.request.command.slice(0, 100);
  const fallbackText = `🔒 Exec approval required for: ${preview}`;

  try {
    await sendMessageSlack(channelId, fallbackText, {
      blocks,
      accountId: this.opts.accountId,
    });
  } catch (err) {
    logError(`slack exec approvals: failed to post message for ${request.id}: ${String(err)}`);
    return;
  }

  const timeoutMs = Math.max(0, request.expiresAtMs - Date.now());
  const sessionKey = request.request.sessionKey ?? "";
  if (!sessionKey) {
    logDebug(`slack exec approvals: no session key for ${request.id}, cannot poll`);
    return;
  }

  const actionPrefix = `${APPROVAL_ACTION_PREFIX}${request.id}:`;
  const approvers = this.opts.config.approvers ?? [];

  logDebug(`slack exec approvals: polling for decision on ${request.id}`);

  const decision = await pollForApprovalDecision({ sessionKey, actionPrefix, timeoutMs, approvers });

  if (!decision) {
    logDebug(`slack exec approvals: approval ${request.id} timed out or no authorized click`);
    return;
  }

  if (!this.gatewayClient) {
    logError(`slack exec approvals: gateway client not available to resolve ${request.id}`);
    return;
  }

  logDebug(`slack exec approvals: resolving ${request.id} with ${decision}`);
  try {
    await this.gatewayClient.request("exec.approval.resolve", {
      id: request.id,
      decision,
    });
  } catch (err) {
    logError(`slack exec approvals: failed to resolve ${request.id}: ${String(err)}`);
  }
}
```

Then add the standalone polling function (outside the class, after the exported helpers):

```ts
async function pollForApprovalDecision(params: {
  sessionKey: string;
  actionPrefix: string;
  timeoutMs: number;
  approvers: string[];
}): Promise<ExecApprovalDecision | null> {
  const deadline = Date.now() + params.timeoutMs;

  return new Promise((resolve) => {
    const poll = () => {
      if (Date.now() >= deadline) {
        resolve(null);
        return;
      }

      const events = peekSystemEventEntries(params.sessionKey);
      for (const event of events) {
        if (!event.text.includes("Slack interaction:")) continue;
        try {
          const jsonStart = event.text.indexOf("{");
          if (jsonStart < 0) continue;
          const payload = JSON.parse(event.text.slice(jsonStart)) as {
            actionId?: string;
            userId?: string;
          };
          if (typeof payload.actionId !== "string") continue;
          if (!payload.actionId.startsWith(params.actionPrefix)) continue;
          if (params.approvers.length > 0 && !params.approvers.includes(payload.userId ?? "")) {
            continue;
          }
          const raw = payload.actionId.slice(params.actionPrefix.length);
          if (raw !== "allow-once" && raw !== "allow-always" && raw !== "deny") continue;
          resolve(raw as ExecApprovalDecision);
          return;
        } catch {
          continue;
        }
      }

      setTimeout(poll, POLL_INTERVAL_MS);
    };

    poll();
  });
}
```

**Step 4: Run tests**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run src/slack/monitor/exec-approvals.test.ts 2>&1 | tail -30
```

Expected: PASS. If timer-related tests are flaky, verify `vi.useFakeTimers()` + `vi.advanceTimersByTime()` is correct.

**Step 5: Run full test suite to check for regressions**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run 2>&1 | tail -20
```

Expected: all previously passing tests still pass.

**Step 6: Commit**

```bash
git add src/slack/monitor/exec-approvals.ts src/slack/monitor/exec-approvals.test.ts
git commit -m "feat(slack): implement handleApprovalRequested with Block Kit + polling"
```

---

### Task 6: Wire into `monitorSlackProvider`

**Files:**

- Modify: `src/slack/monitor/provider.ts`

**Step 1: Add import**

At the top of `src/slack/monitor/provider.ts`, after the existing imports, add:

```ts
import { SlackExecApprovalHandler } from "./exec-approvals.js";
```

**Step 2: Add wiring after `registerSlackMonitorEvents`**

In `monitorSlackProvider`, after the line:

```ts
registerSlackMonitorEvents({ ctx, account, handleSlackMessage });
```

Add:

```ts
const execApprovalsConfig = slackCfg.execApprovals;
let execApprovalHandler: SlackExecApprovalHandler | null = null;
if (execApprovalsConfig?.enabled) {
  execApprovalHandler = new SlackExecApprovalHandler({
    accountId: account.accountId,
    botToken,
    config: execApprovalsConfig,
    cfg,
  });
  await execApprovalHandler.start();
}
```

**Step 3: Stop the handler on abort**

In the `finally` block at the bottom of `monitorSlackProvider` (after `await app.stop().catch(() => undefined)`), add:

```ts
await execApprovalHandler?.stop();
```

**Step 4: Type-check**

```bash
cd /Users/davidgarson/dev/openclaw && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors.

**Step 5: Run test suite**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run 2>&1 | tail -20
```

Expected: all pass.

**Step 6: Commit**

```bash
git add src/slack/monitor/provider.ts
git commit -m "feat(slack): wire SlackExecApprovalHandler into monitorSlackProvider"
```

---

### Task 7: Final check and cleanup

**Step 1: Run full type-check**

```bash
cd /Users/davidgarson/dev/openclaw && npx tsc --noEmit 2>&1
```

Expected: clean.

**Step 2: Run full test suite**

```bash
cd /Users/davidgarson/dev/openclaw && npx vitest run 2>&1 | tail -30
```

Expected: all pass.

**Step 3: Review files changed**

```bash
git diff main --stat
```

Expected: only these files changed:

- `src/config/types.slack.ts`
- `src/slack/monitor/exec-approvals.ts` (new)
- `src/slack/monitor/exec-approvals.test.ts` (new)
- `src/slack/monitor/provider.ts`
- `docs/plans/` (design + plan docs)

No changes to `interactions.ts`, `exec-approval-forwarder.ts`, or gateway code.

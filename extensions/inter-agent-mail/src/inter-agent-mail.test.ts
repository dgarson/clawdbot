/**
 * Tests for the inter-agent mail plugin.
 *
 * Covers:
 *  - Config parsing: valid, invalid, edge cases, null input
 *  - Routing rules: wildcard combinations, deny precedence, no-match
 *  - ACL helpers: owner, delegate, no access
 *  - Store: append, peek, claim (processing leases), ack, soft-delete, TTL recovery,
 *            special-char agent ids, newMessageId uniqueness, countUnread live processing
 *  - mail tool: all 5 actions — inbox/ack/send/forward/recipients
 *  - bounce_mail tool: routing, lineage, auto-ack, boundary confidence values
 *  - contacts module: resolveContacts and formatContacts unit tests
 *  - before_prompt_build hook: notification injection, heartbeat-only policy,
 *                              live-processing NOT counted, system prompt sentinels
 *  - Integration: full send → claim → ack → verify round-trip
 *  - Security: missing/whitespace agentId, identity spoofing attempts
 */

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawPluginToolContext } from "../../../src/plugins/types.js";
import {
  DEFAULT_PROCESSING_TTL_MS,
  isRoutingAllowed,
  parsePluginConfig,
  resolveDeliveryPolicy,
  resolveMailboxAcl,
  type ResolvedInterAgentMailConfig,
} from "./config.js";
import { formatContacts, resolveContacts } from "./contacts.js";
import {
  createBeforeToolCallEnforcementHook,
  trackInboxResult,
  setLastInboxClaimedCount,
  consumeLastInboxClaimedCount,
  _resetEnforcementState,
  _getRunState,
} from "./enforcement.js";
import { createBeforePromptBuildHook } from "./hook.js";
import {
  ackMessages,
  appendMessage,
  claimUnread,
  countUnread,
  mailboxPath,
  newMessageId,
  peekMessages,
  readMailbox,
  softDeleteMessages,
  type MailMessage,
} from "./store.js";
import { createBounceMailTool, createMailTool } from "./tools.js";

// ============================================================================
// Helpers
// ============================================================================

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "inter-agent-mail-test-"));
}

function makeMessage(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    id: newMessageId(),
    from: "agent-a",
    to: "agent-b",
    subject: "Test",
    body: "Hello",
    urgency: "normal",
    tags: [],
    status: "unread",
    created_at: Date.now(),
    read_at: null,
    deleted_at: null,
    processing_at: null,
    processing_expires_at: null,
    forwarded_from: null,
    lineage: [],
    ...overrides,
  };
}

function allowAllConfig(): ResolvedInterAgentMailConfig {
  return {
    allowRules: [{ from: "*", to: "*" }],
    denyRules: [],
    mailboxAcls: {},
    deliveryPolicies: {},
    defaultEnforcement: "none",
  };
}

function makeCtx(
  agentId: string,
  config?: ResolvedInterAgentMailConfig,
): OpenClawPluginToolContext {
  return {
    agentId,
    sessionKey: `sess-${agentId}`,
    config: config
      ? ({ agents: { list: [] } } as unknown as OpenClawPluginToolContext["config"])
      : undefined,
  };
}

/** Creates a mail tool with a no-op runtime. */
function makeMailTool(stateDir: string, config: ResolvedInterAgentMailConfig) {
  return createMailTool({ stateDir, config, api: { runtime: undefined } });
}

/** Creates a bounce tool with a no-op runtime. */
function makeBounceTool(stateDir: string, config: ResolvedInterAgentMailConfig) {
  return createBounceMailTool({ stateDir, config, api: { runtime: undefined } });
}

// ============================================================================
// Config parsing
// ============================================================================

describe("parsePluginConfig", () => {
  it("returns defaults for undefined input", () => {
    const result = parsePluginConfig(undefined);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.allowRules).toEqual([{ from: "*", to: "*" }]);
    expect(result.value.denyRules).toEqual([]);
    expect(result.value.mailboxAcls).toEqual({});
  });

  it("rejects unknown keys", () => {
    const result = parsePluginConfig({ unknown_key: true });
    expect(result.ok).toBe(false);
  });

  it("parses allow/deny rules", () => {
    const result = parsePluginConfig({
      rules: {
        allow: [{ from: "agent-a", to: "agent-b" }],
        deny: [{ from: "agent-x", to: "*" }],
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.allowRules).toEqual([{ from: "agent-a", to: "agent-b" }]);
    expect(result.value.denyRules).toEqual([{ from: "agent-x", to: "*" }]);
  });

  it("parses mailbox_acls", () => {
    const result = parsePluginConfig({
      mailbox_acls: { "agent-b": { "agent-c": "peek", "agent-d": "read_write" } },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mailboxAcls["agent-b"]?.["agent-c"]).toBe("peek");
    expect(result.value.mailboxAcls["agent-b"]?.["agent-d"]).toBe("read_write");
  });

  it("rejects invalid ACL level", () => {
    const result = parsePluginConfig({
      mailbox_acls: { "agent-b": { "agent-c": "superuser" } },
    });
    expect(result.ok).toBe(false);
  });

  it("parses delivery policies including new fields", () => {
    const result = parsePluginConfig({
      delivery_policies: {
        "agent-b": {
          wakeOnUrgent: false,
          inboxOnlyDuringHeartbeat: true,
          processing_ttl_ms: 60_000,
          bounce_enabled: true,
        },
      },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p = result.value.deliveryPolicies["agent-b"];
    expect(p?.wakeOnUrgent).toBe(false);
    expect(p?.processing_ttl_ms).toBe(60_000);
    expect(p?.bounce_enabled).toBe(true);
  });

  it("rejects invalid processing_ttl_ms", () => {
    const result = parsePluginConfig({
      delivery_policies: { "agent-b": { processing_ttl_ms: -1 } },
    });
    expect(result.ok).toBe(false);
  });
});

// ============================================================================
// ACL helpers
// ============================================================================

describe("isRoutingAllowed", () => {
  it("allows all with default wildcard rules", () => {
    const config = allowAllConfig();
    expect(isRoutingAllowed(config, "agent-a", "agent-b")).toBe(true);
    expect(isRoutingAllowed(config, "agent-x", "agent-y")).toBe(true);
  });

  it("deny takes precedence over allow", () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      denyRules: [{ from: "agent-bad", to: "*" }],
    };
    expect(isRoutingAllowed(config, "agent-bad", "agent-b")).toBe(false);
    expect(isRoutingAllowed(config, "agent-good", "agent-b")).toBe(true);
  });

  it("specific allow rule works", () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      allowRules: [{ from: "agent-a", to: "agent-b" }],
    };
    expect(isRoutingAllowed(config, "agent-a", "agent-b")).toBe(true);
    expect(isRoutingAllowed(config, "agent-a", "agent-c")).toBe(false);
    expect(isRoutingAllowed(config, "agent-x", "agent-b")).toBe(false);
  });
});

describe("resolveMailboxAcl", () => {
  it("returns 'owner' when caller is the mailbox owner", () => {
    const config = allowAllConfig();
    expect(resolveMailboxAcl(config, "agent-b", "agent-b")).toBe("owner");
  });

  it("returns null when no delegation exists", () => {
    const config = allowAllConfig();
    expect(resolveMailboxAcl(config, "agent-b", "agent-c")).toBe(null);
  });

  it("returns the configured ACL level for a delegate", () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "peek", "agent-d": "read_write" } },
    };
    expect(resolveMailboxAcl(config, "agent-b", "agent-c")).toBe("peek");
    expect(resolveMailboxAcl(config, "agent-b", "agent-d")).toBe("read_write");
    expect(resolveMailboxAcl(config, "agent-b", "agent-x")).toBe(null);
  });
});

describe("resolveDeliveryPolicy", () => {
  it("returns defaults when no policy configured", () => {
    const policy = resolveDeliveryPolicy(allowAllConfig(), "agent-x");
    expect(policy.wakeOnUrgent).toBe(true);
    expect(policy.inboxOnlyDuringHeartbeat).toBe(false);
    expect(policy.defaultUrgency).toBe("normal");
    expect(policy.processing_ttl_ms).toBe(DEFAULT_PROCESSING_TTL_MS);
    expect(policy.bounce_enabled).toBe(false);
  });

  it("overrides with configured values", () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      deliveryPolicies: {
        "agent-b": {
          wakeOnUrgent: false,
          inboxOnlyDuringHeartbeat: true,
          defaultUrgency: "high",
          processing_ttl_ms: 10_000,
          bounce_enabled: true,
        },
      },
    };
    const policy = resolveDeliveryPolicy(config, "agent-b");
    expect(policy.wakeOnUrgent).toBe(false);
    expect(policy.inboxOnlyDuringHeartbeat).toBe(true);
    expect(policy.defaultUrgency).toBe("high");
    expect(policy.processing_ttl_ms).toBe(10_000);
    expect(policy.bounce_enabled).toBe(true);
  });
});

// ============================================================================
// Store
// ============================================================================

describe("store", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns empty array for non-existent mailbox", async () => {
    const msgs = await readMailbox(mailboxPath(tmpDir, "agent-a"));
    expect(msgs).toEqual([]);
  });

  it("appends and reads messages", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const msg = makeMessage({ to: "agent-b" });
    await appendMessage(filePath, msg);
    const msgs = await readMailbox(filePath);
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.id).toBe(msg.id);
    expect(msgs[0]?.status).toBe("unread");
    expect(msgs[0]?.processing_at).toBeNull();
    expect(msgs[0]?.processing_expires_at).toBeNull();
  });

  describe("claimUnread (processing lease)", () => {
    it("transitions unread messages to processing", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      await appendMessage(filePath, makeMessage({ id: "m1", urgency: "normal" }));
      await appendMessage(filePath, makeMessage({ id: "m2", urgency: "urgent" }));

      const now = Date.now();
      const { messages, claimed } = await claimUnread(filePath, { ttlMs: 60_000, now });

      expect(claimed).toBe(2);
      expect(messages).toHaveLength(2);
      expect(messages.every((m) => m.status === "processing")).toBe(true);
      expect(messages.every((m) => m.processing_at === now)).toBe(true);
      expect(messages.every((m) => m.processing_expires_at === now + 60_000)).toBe(true);

      // Verify persisted to disk
      const stored = await readMailbox(filePath);
      expect(stored.every((m) => m.status === "processing")).toBe(true);
    });

    it("recovers expired processing messages back to unread", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      // Seed a message already in processing with an expired lease
      const expiredAt = Date.now() - 1;
      await appendMessage(
        filePath,
        makeMessage({
          id: "expired",
          status: "processing",
          processing_at: expiredAt - 1000,
          processing_expires_at: expiredAt,
        }),
      );

      const now = Date.now();
      const { messages, claimed, recovered } = await claimUnread(filePath, {
        ttlMs: 60_000,
        now,
      });

      // The expired message should be recovered → unread → then re-claimed
      expect(recovered).toBe(1);
      expect(claimed).toBe(1); // recovered → reclaimed as new processing
      expect(messages[0]?.id).toBe("expired");
      expect(messages[0]?.status).toBe("processing");
      expect(messages[0]?.processing_expires_at).toBe(now + 60_000);
    });

    it("does not claim messages that are still within their lease (not stale)", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      const futureExpiry = Date.now() + 120_000;
      await appendMessage(
        filePath,
        makeMessage({
          id: "live",
          status: "processing",
          processing_at: Date.now(),
          processing_expires_at: futureExpiry,
        }),
      );

      const { messages, claimed, recovered } = await claimUnread(filePath, {
        ttlMs: 60_000,
        now: Date.now(),
      });

      expect(recovered).toBe(0);
      expect(claimed).toBe(0);
      expect(messages).toHaveLength(0);
    });

    it("includes stale (live-processing) messages when include_stale=true", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      const futureExpiry = Date.now() + 120_000;
      await appendMessage(
        filePath,
        makeMessage({
          id: "stale",
          status: "processing",
          processing_at: Date.now(),
          processing_expires_at: futureExpiry,
        }),
      );

      const { messages, claimed } = await claimUnread(filePath, {
        ttlMs: 60_000,
        now: Date.now(),
        includeStale: true,
      });

      expect(claimed).toBe(0); // nothing new claimed
      expect(messages).toHaveLength(1);
      expect(messages[0]?.id).toBe("stale");
      expect(messages[0]?.status).toBe("processing"); // still processing
    });

    it("filters by urgency when claiming", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      await appendMessage(filePath, makeMessage({ id: "u", urgency: "urgent" }));
      await appendMessage(filePath, makeMessage({ id: "n", urgency: "normal" }));

      const { claimed, messages } = await claimUnread(filePath, {
        ttlMs: 60_000,
        filterUrgency: ["urgent"],
      });

      expect(claimed).toBe(1);
      expect(messages[0]?.id).toBe("u");
      // normal message stays unread
      const stored = await readMailbox(filePath);
      expect(stored.find((m) => m.id === "n")?.status).toBe("unread");
    });
  });

  describe("ackMessages (processing → read)", () => {
    it("transitions processing messages to read", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      const now = Date.now();
      await appendMessage(
        filePath,
        makeMessage({
          id: "p1",
          status: "processing",
          processing_at: now,
          processing_expires_at: now + 60_000,
        }),
      );

      const { updated } = await ackMessages(filePath, new Set(["p1"]), now);
      expect(updated).toBe(1);

      const stored = await readMailbox(filePath);
      const m = stored.find((s) => s.id === "p1");
      expect(m?.status).toBe("read");
      expect(m?.read_at).toBe(now);
      expect(m?.processing_at).toBeNull();
      expect(m?.processing_expires_at).toBeNull();
    });

    it("is idempotent for already-read messages (returns 0 updated)", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      await appendMessage(filePath, makeMessage({ id: "r1", status: "read" }));
      const { updated } = await ackMessages(filePath, new Set(["r1"]), Date.now());
      expect(updated).toBe(0);
    });

    it("does not ack deleted messages", async () => {
      const filePath = mailboxPath(tmpDir, "agent-b");
      await appendMessage(filePath, makeMessage({ id: "d1", status: "deleted" }));
      const { updated } = await ackMessages(filePath, new Set(["d1"]), Date.now());
      expect(updated).toBe(0);
    });
  });

  it("soft-deletes messages and does not double-count", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const msg = makeMessage({ id: "msg-del" });
    await appendMessage(filePath, msg);

    const { updated: first } = await softDeleteMessages(filePath, new Set(["msg-del"]), Date.now());
    expect(first).toBe(1);

    const { updated: second } = await softDeleteMessages(
      filePath,
      new Set(["msg-del"]),
      Date.now(),
    );
    expect(second).toBe(0); // already deleted

    const msgs = await readMailbox(filePath);
    expect(msgs[0]?.status).toBe("deleted");
  });

  it("peekMessages excludes deleted always", () => {
    const msgs: MailMessage[] = [
      makeMessage({ id: "a", status: "unread" }),
      makeMessage({ id: "b", status: "read" }),
      makeMessage({ id: "c", status: "deleted" }),
    ];
    const visible = peekMessages(msgs, {});
    expect(visible.map((m) => m.id)).toEqual(["a"]);
  });

  it("peekMessages includes read when includeRead=true", () => {
    const msgs: MailMessage[] = [
      makeMessage({ id: "a", status: "unread" }),
      makeMessage({ id: "b", status: "read" }),
      makeMessage({ id: "c", status: "deleted" }),
    ];
    const visible = peekMessages(msgs, { includeRead: true });
    expect(visible.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("peekMessages filters by urgency", () => {
    const msgs: MailMessage[] = [
      makeMessage({ id: "u", urgency: "urgent", status: "unread" }),
      makeMessage({ id: "n", urgency: "normal", status: "unread" }),
    ];
    const visible = peekMessages(msgs, { filterUrgency: ["urgent"] });
    expect(visible.map((m) => m.id)).toEqual(["u"]);
  });

  it("peekMessages filters by tag (any-of)", () => {
    const msgs: MailMessage[] = [
      makeMessage({ id: "a", tags: ["deploy", "prod"], status: "unread" }),
      makeMessage({ id: "b", tags: ["review"], status: "unread" }),
      makeMessage({ id: "c", tags: [], status: "unread" }),
    ];
    const visible = peekMessages(msgs, { filterTags: ["deploy"] });
    expect(visible.map((m) => m.id)).toEqual(["a"]);
  });

  it("countUnread counts expired processing as unread", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const expiredAt = Date.now() - 1;
    await appendMessage(filePath, makeMessage({ urgency: "urgent", status: "unread" }));
    await appendMessage(filePath, makeMessage({ urgency: "normal", status: "unread" }));
    await appendMessage(filePath, makeMessage({ urgency: "high", status: "read" }));
    await appendMessage(filePath, makeMessage({ status: "deleted" }));
    // Expired processing — should be counted as unread
    await appendMessage(
      filePath,
      makeMessage({
        urgency: "urgent",
        status: "processing",
        processing_expires_at: expiredAt,
      }),
    );

    const now = Date.now();
    const { total, urgent } = await countUnread(filePath, now);
    expect(total).toBe(3); // 2 unread + 1 expired processing
    expect(urgent).toBe(2); // 1 urgent unread + 1 expired urgent processing
  });

  it("handles concurrent appends without data loss", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const writes = Array.from({ length: 10 }, (_, i) =>
      appendMessage(filePath, makeMessage({ id: `msg-${i}` })),
    );
    await Promise.all(writes);
    const msgs = await readMailbox(filePath);
    expect(msgs).toHaveLength(10);
  });
});

// ============================================================================
// mail tool — action="send"
// ============================================================================

describe("mail tool — action='send'", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("delivers message to recipient mailbox as unread", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await tool.execute(
      { action: "send", to_agent_id: "agent-b", subject: "Hello", body: "World" },
      makeCtx("agent-a"),
    );

    const msgs = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(msgs).toHaveLength(1);
    expect(msgs[0]?.from).toBe("agent-a");
    expect(msgs[0]?.subject).toBe("Hello");
    expect(msgs[0]?.status).toBe("unread");
    expect(msgs[0]?.processing_at).toBeNull();
    expect(msgs[0]?.forwarded_from).toBeNull();
    expect(msgs[0]?.lineage).toEqual([]);
  });

  it("SECURITY: uses ctx.agentId as sender, ignores 'from' in params", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await tool.execute(
      {
        action: "send",
        to_agent_id: "agent-b",
        subject: "Spoofed",
        body: "body",
        from: "EVIL-AGENT",
      },
      makeCtx("agent-a"),
    );

    const msgs = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(msgs[0]?.from).toBe("agent-a");
  });

  it("SECURITY: rejects when agentId is missing from context", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await expect(
      tool.execute(
        { action: "send", to_agent_id: "agent-b", subject: "Hi", body: "body" },
        {
          agentId: undefined,
        },
      ),
    ).rejects.toThrow("agent identity not available");
  });

  it("enforces routing deny rules", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      denyRules: [{ from: "agent-a", to: "agent-b" }],
    };
    const tool = makeMailTool(tmpDir, config);
    await expect(
      tool.execute(
        { action: "send", to_agent_id: "agent-b", subject: "Hi", body: "body" },
        makeCtx("agent-a"),
      ),
    ).rejects.toThrow("Routing denied");
  });

  it("enqueues system event for urgent mail when wakeOnUrgent=true", async () => {
    const enqueueSpy = vi.fn().mockResolvedValue(undefined);
    const tool = createMailTool({
      stateDir: tmpDir,
      config: allowAllConfig(),
      api: { runtime: { system: { enqueueSystemEvent: enqueueSpy } } },
    });

    await tool.execute(
      {
        action: "send",
        to_agent_id: "agent-b",
        subject: "Critical",
        body: "body",
        urgency: "urgent",
      },
      makeCtx("agent-a"),
    );

    expect(enqueueSpy).toHaveBeenCalledOnce();
    expect(enqueueSpy.mock.calls[0]?.[0]).toMatchObject({ agentId: "agent-b", wakeMode: "now" });
  });

  it("does NOT enqueue system event for urgent mail when wakeOnUrgent=false", async () => {
    const enqueueSpy = vi.fn().mockResolvedValue(undefined);
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      deliveryPolicies: { "agent-b": { wakeOnUrgent: false } },
    };
    const tool = createMailTool({
      stateDir: tmpDir,
      config,
      api: { runtime: { system: { enqueueSystemEvent: enqueueSpy } } },
    });

    await tool.execute(
      {
        action: "send",
        to_agent_id: "agent-b",
        subject: "Urgent but no wake",
        body: "body",
        urgency: "urgent",
      },
      makeCtx("agent-a"),
    );

    expect(enqueueSpy).not.toHaveBeenCalled();
  });

  it("stores tags on message", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await tool.execute(
      {
        action: "send",
        to_agent_id: "agent-b",
        subject: "Tagged",
        body: "body",
        tags: ["deploy", "prod"],
      },
      makeCtx("agent-a"),
    );

    const msgs = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(msgs[0]?.tags).toEqual(["deploy", "prod"]);
  });
});

// ============================================================================
// mail tool — action="inbox" (claim-based read)
// ============================================================================

describe("mail tool — action='inbox'", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function seedMailbox(agentId: string, messages: Partial<MailMessage>[]) {
    const filePath = mailboxPath(tmpDir, agentId);
    for (const m of messages) {
      await appendMessage(filePath, makeMessage({ to: agentId, ...m }));
    }
  }

  it("claims unread messages as processing (never directly as read)", async () => {
    await seedMailbox("agent-b", [{ id: "u1" }, { id: "u2" }]);
    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute({ action: "inbox" }, makeCtx("agent-b"));

    // Result contains message content
    expect(result).toContain("u1");
    expect(result).toContain("u2");
    expect(result).toContain("ack"); // ack hint must be present

    // Messages are in "processing" state, NOT "read"
    const stored = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(stored.every((m) => m.status === "processing")).toBe(true);
    expect(stored.every((m) => m.processing_at !== null)).toBe(true);
    expect(stored.every((m) => m.processing_expires_at !== null)).toBe(true);
  });

  it("SECURITY: never returns deleted messages", async () => {
    await seedMailbox("agent-b", [{ id: "d1", status: "deleted" }]);
    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute({ action: "inbox" }, makeCtx("agent-b"));
    expect(result).not.toContain("d1");
    expect(result).toContain("empty");
  });

  it("SECURITY: denies access when caller has no ACL on another agent's mailbox", async () => {
    await seedMailbox("agent-b", [{ id: "u1" }]);
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await expect(
      tool.execute({ action: "inbox", mailbox_id: "agent-b" }, makeCtx("agent-c")),
    ).rejects.toThrow("Access denied");
  });

  it("peek delegate reads without changing message status", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "peek" } },
    };
    await seedMailbox("agent-b", [{ id: "u1" }]);
    const tool = makeMailTool(tmpDir, config);

    const result = await tool.execute(
      { action: "inbox", mailbox_id: "agent-b" },
      makeCtx("agent-c"),
    );
    expect(result).toContain("u1");

    // Message must still be unread — peek never changes status
    const stored = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(stored[0]?.status).toBe("unread");
  });

  it("read_mark delegate can claim messages (processing)", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "read_mark" } },
    };
    await seedMailbox("agent-b", [{ id: "u1" }]);
    const tool = makeMailTool(tmpDir, config);

    await tool.execute({ action: "inbox", mailbox_id: "agent-b" }, makeCtx("agent-c"));

    const stored = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(stored[0]?.status).toBe("processing");
  });

  it("auto-recovers expired processing leases before claiming", async () => {
    const expiredAt = Date.now() - 1;
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(
      filePath,
      makeMessage({
        id: "expired",
        status: "processing",
        processing_at: expiredAt - 1000,
        processing_expires_at: expiredAt,
      }),
    );

    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute({ action: "inbox" }, makeCtx("agent-b"));

    // Should have recovered and re-claimed the expired message
    expect(result).toContain("expired");
    expect(result).toContain("expired leases recovered");

    const stored = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(stored[0]?.status).toBe("processing");
  });

  it("filters by urgency", async () => {
    await seedMailbox("agent-b", [
      { id: "u1", urgency: "urgent" },
      { id: "n1", urgency: "normal" },
    ]);
    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute(
      { action: "inbox", filter_urgency: ["urgent"] },
      makeCtx("agent-b"),
    );

    expect(result).toContain("u1");
    expect(result).not.toContain("n1");
  });

  it("filters by tag", async () => {
    await seedMailbox("agent-b", [
      { id: "t1", tags: ["deploy"] },
      { id: "t2", tags: ["review"] },
    ]);
    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute(
      { action: "inbox", filter_tags: ["deploy"] },
      makeCtx("agent-b"),
    );

    expect(result).toContain("t1");
    expect(result).not.toContain("t2");
  });

  it("include_stale returns live-processing messages without re-claiming", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const futureExpiry = Date.now() + 120_000;
    await appendMessage(
      filePath,
      makeMessage({
        id: "stale",
        status: "processing",
        processing_at: Date.now(),
        processing_expires_at: futureExpiry,
      }),
    );

    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute({ action: "inbox", include_stale: true }, makeCtx("agent-b"));

    expect(result).toContain("stale");
    expect(result).toContain("in-progress");

    // Status unchanged — it was already processing and wasn't re-claimed
    const stored = await readMailbox(filePath);
    const m = stored.find((s) => s.id === "stale");
    expect(m?.processing_expires_at).toBe(futureExpiry); // lease expiry unchanged
  });
});

// ============================================================================
// mail tool — action="ack"
// ============================================================================

describe("mail tool — action='ack'", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("acks claimed messages and transitions them to read", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const now = Date.now();
    await appendMessage(
      filePath,
      makeMessage({
        id: "p1",
        status: "processing",
        processing_at: now,
        processing_expires_at: now + 60_000,
      }),
    );
    await appendMessage(
      filePath,
      makeMessage({
        id: "p2",
        status: "processing",
        processing_at: now,
        processing_expires_at: now + 60_000,
      }),
    );

    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute({ action: "ack", message_ids: ["p1"] }, makeCtx("agent-b"));

    expect(result).toContain("Acked 1");

    const stored = await readMailbox(filePath);
    expect(stored.find((m) => m.id === "p1")?.status).toBe("read");
    expect(stored.find((m) => m.id === "p2")?.status).toBe("processing");
  });

  it("requires message_ids", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await expect(tool.execute({ action: "ack" }, makeCtx("agent-b"))).rejects.toThrow(
      "message_ids is required",
    );
  });

  it("SECURITY: peek delegate cannot ack", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "peek" } },
    };
    const tool = makeMailTool(tmpDir, config);
    await expect(
      tool.execute(
        { action: "ack", message_ids: ["m1"], mailbox_id: "agent-b" },
        makeCtx("agent-c"),
      ),
    ).rejects.toThrow("read-only");
  });

  it("returns informative message when no matching processing messages found", async () => {
    const tool = makeMailTool(tmpDir, allowAllConfig());
    const result = await tool.execute(
      { action: "ack", message_ids: ["nonexistent"] },
      makeCtx("agent-b"),
    );
    expect(result).toContain("No in-progress messages");
  });
});

// ============================================================================
// mail tool — action="forward"
// ============================================================================

describe("mail tool — action='forward'", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function seedMessage(
    agentId: string,
    overrides: Partial<MailMessage> = {},
  ): Promise<MailMessage> {
    const msg = makeMessage({ to: agentId, ...overrides });
    await appendMessage(mailboxPath(tmpDir, agentId), msg);
    return msg;
  }

  it("creates a new message in the recipient's mailbox with correct lineage", async () => {
    const source = await seedMessage("agent-b", { id: "msg-orig", from: "agent-a" });
    const tool = makeMailTool(tmpDir, allowAllConfig());

    await tool.execute(
      {
        action: "forward",
        message_id: "msg-orig",
        to_agent_id: "agent-c",
        notes: "Please handle this.",
      },
      makeCtx("agent-b"),
    );

    const destMsgs = await readMailbox(mailboxPath(tmpDir, "agent-c"));
    expect(destMsgs).toHaveLength(1);
    const fwd = destMsgs[0]!;
    expect(fwd.from).toBe("agent-b");
    expect(fwd.to).toBe("agent-c");
    expect(fwd.forwarded_from).toBe("msg-orig");
    expect(fwd.lineage).toEqual(["msg-orig"]);
    expect(fwd.body).toContain("Please handle this.");
    expect(fwd.body).toContain(source.body);
  });

  it("builds multi-hop lineage correctly", async () => {
    await seedMessage("agent-b", {
      id: "msg-hop1",
      from: "agent-a",
      forwarded_from: "msg-orig",
      lineage: ["msg-orig"],
    });
    const tool = makeMailTool(tmpDir, allowAllConfig());

    await tool.execute(
      { action: "forward", message_id: "msg-hop1", to_agent_id: "agent-c" },
      makeCtx("agent-b"),
    );

    const destMsgs = await readMailbox(mailboxPath(tmpDir, "agent-c"));
    const fwd = destMsgs[0]!;
    expect(fwd.forwarded_from).toBe("msg-hop1");
    expect(fwd.lineage).toEqual(["msg-orig", "msg-hop1"]);
  });

  it("auto-acks the source message after forwarding", async () => {
    await seedMessage("agent-b", { id: "msg-src", status: "unread" });
    const tool = makeMailTool(tmpDir, allowAllConfig());

    await tool.execute(
      { action: "forward", message_id: "msg-src", to_agent_id: "agent-c" },
      makeCtx("agent-b"),
    );

    const srcMsgs = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(srcMsgs[0]?.status).toBe("read");
  });

  it("SECURITY: peek ACL cannot forward", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "peek" } },
    };
    await seedMessage("agent-b", { id: "msg-src" });
    const tool = makeMailTool(tmpDir, config);

    await expect(
      tool.execute(
        { action: "forward", message_id: "msg-src", to_agent_id: "agent-d", mailbox_id: "agent-b" },
        makeCtx("agent-c"),
      ),
    ).rejects.toThrow("read-only");
  });

  it("refuses to forward a deleted message", async () => {
    await seedMessage("agent-b", { id: "msg-del", status: "deleted" });
    const tool = makeMailTool(tmpDir, allowAllConfig());

    await expect(
      tool.execute(
        { action: "forward", message_id: "msg-del", to_agent_id: "agent-c" },
        makeCtx("agent-b"),
      ),
    ).rejects.toThrow("deleted");
  });

  it("enforces routing rules on the forward destination", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      denyRules: [{ from: "agent-b", to: "agent-forbidden" }],
    };
    await seedMessage("agent-b", { id: "msg-src" });
    const tool = makeMailTool(tmpDir, config);

    await expect(
      tool.execute(
        { action: "forward", message_id: "msg-src", to_agent_id: "agent-forbidden" },
        makeCtx("agent-b"),
      ),
    ).rejects.toThrow("Routing denied");
  });

  it("inherits urgency and tags when not overridden", async () => {
    await seedMessage("agent-b", { id: "msg-src", urgency: "high", tags: ["deploy"] });
    const tool = makeMailTool(tmpDir, allowAllConfig());
    await tool.execute(
      { action: "forward", message_id: "msg-src", to_agent_id: "agent-c" },
      makeCtx("agent-b"),
    );

    const dest = await readMailbox(mailboxPath(tmpDir, "agent-c"));
    expect(dest[0]?.urgency).toBe("high");
    expect(dest[0]?.tags).toEqual(["deploy"]);
  });
});

// ============================================================================
// mail tool — action="recipients" (contact book)
// ============================================================================

describe("mail tool — action='recipients'", () => {
  it("returns all known agents from config with routing status", async () => {
    const tmpDir = await makeTempDir();
    try {
      const config = allowAllConfig();
      const tool = createMailTool({
        stateDir: tmpDir,
        config,
        api: { runtime: undefined },
      });

      const ctx: OpenClawPluginToolContext = {
        agentId: "agent-a",
        config: {
          agents: {
            list: [
              { id: "agent-a", identity: { name: "Alice" } },
              { id: "agent-b", identity: { name: "Bob" } },
              { id: "agent-c" },
            ],
          },
        } as unknown as OpenClawPluginToolContext["config"],
      };

      const result = await tool.execute({ action: "recipients" }, ctx);
      // Self should not appear
      expect(result).not.toContain("agent-a");
      // Others should appear with names
      expect(result).toContain("agent-b");
      expect(result).toContain("Bob");
      expect(result).toContain("agent-c");
      expect(result).toContain("can send");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("fuzzy search filters by name or id", async () => {
    const tmpDir = await makeTempDir();
    try {
      const config = allowAllConfig();
      const tool = createMailTool({ stateDir: tmpDir, config, api: { runtime: undefined } });

      const ctx: OpenClawPluginToolContext = {
        agentId: "agent-a",
        config: {
          agents: {
            list: [
              { id: "agent-b", identity: { name: "Bob Smith" } },
              { id: "agent-c", identity: { name: "Carol Jones" } },
            ],
          },
        } as unknown as OpenClawPluginToolContext["config"],
      };

      const result = await tool.execute({ action: "recipients", search: "carol" }, ctx);
      expect(result).toContain("agent-c");
      expect(result).not.toContain("agent-b");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("marks blocked recipients with routing blocked", async () => {
    const tmpDir = await makeTempDir();
    try {
      const config: ResolvedInterAgentMailConfig = {
        ...allowAllConfig(),
        allowRules: [{ from: "agent-a", to: "agent-b" }],
      };
      const tool = createMailTool({ stateDir: tmpDir, config, api: { runtime: undefined } });

      const ctx: OpenClawPluginToolContext = {
        agentId: "agent-a",
        config: {
          agents: {
            list: [{ id: "agent-b" }, { id: "agent-c" }],
          },
        } as unknown as OpenClawPluginToolContext["config"],
      };

      const result = await tool.execute({ action: "recipients" }, ctx);
      expect(result).toContain("agent-b");
      expect(result).toContain("can send");
      expect(result).toContain("agent-c");
      expect(result).toContain("routing blocked");
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });
});

// ============================================================================
// bounce_mail tool
// ============================================================================

describe("bounce_mail tool", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  async function seedMessage(
    agentId: string,
    overrides: Partial<MailMessage> = {},
  ): Promise<MailMessage> {
    const msg = makeMessage({ to: agentId, ...overrides });
    await appendMessage(mailboxPath(tmpDir, agentId), msg);
    return msg;
  }

  it("creates a tagged bounce message back to the original sender", async () => {
    const src = await seedMessage("agent-b", { id: "msg-orig", from: "agent-a" });
    const tool = makeBounceTool(tmpDir, allowAllConfig());

    const result = await tool.execute(
      { message_id: "msg-orig", reason: "Not in my domain.", confidence: 0.9 },
      makeCtx("agent-b"),
    );

    expect(result).toContain("agent-a");
    expect(result).toContain(src.id);

    // Bounce message delivered to original sender's mailbox
    const senderMsgs = await readMailbox(mailboxPath(tmpDir, "agent-a"));
    expect(senderMsgs).toHaveLength(1);
    const bounce = senderMsgs[0]!;
    expect(bounce.from).toBe("agent-b");
    expect(bounce.to).toBe("agent-a");
    expect(bounce.tags).toContain("_bounce");
    expect(bounce.body).toContain("Not in my domain.");
    expect(bounce.body).toContain("90%");
    expect(bounce.forwarded_from).toBe("msg-orig");
    expect(bounce.lineage).toEqual(["msg-orig"]);
  });

  it("marks the source message as read after bouncing", async () => {
    await seedMessage("agent-b", { id: "msg-src", from: "agent-a" });
    const tool = makeBounceTool(tmpDir, allowAllConfig());

    await tool.execute(
      { message_id: "msg-src", reason: "Wrong agent.", confidence: 1.0 },
      makeCtx("agent-b"),
    );

    const srcMsgs = await readMailbox(mailboxPath(tmpDir, "agent-b"));
    expect(srcMsgs[0]?.status).toBe("read");
  });

  it("SECURITY: enforces routing rules for the bounce reply", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      allowRules: [{ from: "agent-a", to: "agent-b" }], // only a→b allowed
    };
    // agent-b received from agent-a, but routing b→a is blocked
    await seedMessage("agent-b", { id: "msg-src", from: "agent-a" });
    const tool = makeBounceTool(tmpDir, config);

    await expect(
      tool.execute(
        { message_id: "msg-src", reason: "Wrong.", confidence: 1.0 },
        makeCtx("agent-b"),
      ),
    ).rejects.toThrow("Routing denied");
  });

  it("rejects invalid confidence values", async () => {
    await seedMessage("agent-b", { id: "m1", from: "agent-a" });
    const tool = makeBounceTool(tmpDir, allowAllConfig());

    await expect(
      tool.execute({ message_id: "m1", reason: "reason", confidence: 1.5 }, makeCtx("agent-b")),
    ).rejects.toThrow("confidence");

    await expect(
      tool.execute({ message_id: "m1", reason: "reason", confidence: -0.1 }, makeCtx("agent-b")),
    ).rejects.toThrow("confidence");
  });

  it("refuses to bounce deleted messages", async () => {
    await seedMessage("agent-b", { id: "d1", from: "agent-a", status: "deleted" });
    const tool = makeBounceTool(tmpDir, allowAllConfig());

    await expect(
      tool.execute({ message_id: "d1", reason: "whatever", confidence: 0.5 }, makeCtx("agent-b")),
    ).rejects.toThrow("deleted");
  });

  it("SECURITY: peek delegate cannot bounce", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      mailboxAcls: { "agent-b": { "agent-c": "peek" } },
    };
    await seedMessage("agent-b", { id: "m1", from: "agent-a" });
    const tool = makeBounceTool(tmpDir, config);

    await expect(
      tool.execute(
        { message_id: "m1", reason: "reason", confidence: 0.5, mailbox_id: "agent-b" },
        makeCtx("agent-c"),
      ),
    ).rejects.toThrow("read-only");
  });
});

// ============================================================================
// before_prompt_build hook
// ============================================================================

describe("createBeforePromptBuildHook", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  it("returns prependContext when unread messages exist", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(filePath, makeMessage({ status: "unread" }));

    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config: allowAllConfig() });
    const result = await hook({ prompt: "heartbeat", messages: [] }, { agentId: "agent-b" });

    expect(result).toBeDefined();
    expect(result?.prependContext).toContain("1 unread message");
    expect(result?.prependContext).toContain("mail(action='inbox')");
    expect(result?.prependContext).toContain("ack");
  });

  it("mentions urgent count when urgent messages exist", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(filePath, makeMessage({ urgency: "urgent", status: "unread" }));
    await appendMessage(filePath, makeMessage({ urgency: "normal", status: "unread" }));

    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config: allowAllConfig() });
    const result = await hook({ prompt: "", messages: [] }, { agentId: "agent-b" });

    expect(result?.prependContext).toContain("2 unread");
    expect(result?.prependContext).toContain("1 urgent");
  });

  it("counts expired processing messages as unread in hook", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    const expiredAt = Date.now() - 1;
    await appendMessage(
      filePath,
      makeMessage({ status: "processing", processing_expires_at: expiredAt, urgency: "urgent" }),
    );

    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config: allowAllConfig() });
    const result = await hook({ prompt: "", messages: [] }, { agentId: "agent-b" });

    // Expired processing should be counted as unread
    expect(result).toBeDefined();
    expect(result?.prependContext).toContain("1 unread");
    expect(result?.prependContext).toContain("1 urgent");
  });

  it("returns nothing when mailbox is empty", async () => {
    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config: allowAllConfig() });
    const result = await hook({ prompt: "", messages: [] }, { agentId: "agent-b" });
    expect(result).toBeUndefined();
  });

  it("returns nothing when agentId is missing from context", async () => {
    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config: allowAllConfig() });
    const result = await hook({ prompt: "hi", messages: [] }, {});
    expect(result).toBeUndefined();
  });

  it("suppresses notification for user conversation when inboxOnlyDuringHeartbeat=true", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      deliveryPolicies: { "agent-b": { inboxOnlyDuringHeartbeat: true } },
    };
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(filePath, makeMessage({ status: "unread" }));

    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config });
    const result = await hook({ prompt: "Can you help me?", messages: [] }, { agentId: "agent-b" });
    expect(result).toBeUndefined();
  });

  it("injects notification during heartbeat even with inboxOnlyDuringHeartbeat=true", async () => {
    const config: ResolvedInterAgentMailConfig = {
      ...allowAllConfig(),
      deliveryPolicies: { "agent-b": { inboxOnlyDuringHeartbeat: true } },
    };
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(filePath, makeMessage({ status: "unread" }));

    const hook = createBeforePromptBuildHook({ stateDir: tmpDir, config });
    const result = await hook({ prompt: "", messages: [] }, { agentId: "agent-b" });
    expect(result?.prependContext).toContain("unread");
  });
});

// ============================================================================
// before_tool_call enforcement hook
// ============================================================================

describe("before_tool_call enforcement hook", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    _resetEnforcementState();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    _resetEnforcementState();
  });

  function makeEnforcementConfig(
    enforcement: "none" | "soft" | "strict",
  ): ResolvedInterAgentMailConfig {
    return { ...allowAllConfig(), defaultEnforcement: enforcement };
  }

  const toolCtx = (agentId: string, sessionKey = "sess-1") => ({
    agentId,
    sessionKey,
    toolName: "",
  });

  async function seedUnread(agentId: string, count = 1) {
    const filePath = mailboxPath(tmpDir, agentId);
    for (let i = 0; i < count; i++) {
      await appendMessage(filePath, makeMessage({ to: agentId, status: "unread" }));
    }
  }

  // ── enforcement="none" ──────────────────────────────────────────────────

  it("enforcement=none: never blocks any tool", async () => {
    await seedUnread("agent-b", 3);
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("none"),
    });

    const result = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(result).toBeUndefined();
  });

  // ── enforcement="soft" ──────────────────────────────────────────────────

  it("soft: blocks acting tools when unread mail exists", async () => {
    await seedUnread("agent-b", 2);
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    const result = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(result).toBeDefined();
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("2 unread messages");
    expect(result?.blockReason).toContain("mail(action='inbox')");
  });

  it("soft: allows thinking tools (read, glob, grep) even with unread mail", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    for (const toolName of ["read", "glob", "grep", "search", "web_search"]) {
      const result = await hook({ toolName, params: {} }, toolCtx("agent-b"));
      expect(result).toBeUndefined();
    }
  });

  it("soft: always allows mail tool (passthrough)", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    const result = await hook(
      { toolName: "mail", params: { action: "inbox" } },
      toolCtx("agent-b"),
    );
    expect(result).toBeUndefined();
  });

  it("soft: unblocks acting tools after mail(action=inbox) is called", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });
    const ctx = toolCtx("agent-b");

    // First: mail tool call sets mailChecked
    await hook({ toolName: "mail", params: { action: "inbox" } }, ctx);

    // Now write should be allowed
    const result = await hook({ toolName: "write", params: {} }, ctx);
    expect(result).toBeUndefined();
  });

  it("soft: does not block when mailbox is empty", async () => {
    // No mail seeded
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    const result = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(result).toBeUndefined();
  });

  it("soft: mentions urgent count in block reason", async () => {
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(
      filePath,
      makeMessage({ to: "agent-b", status: "unread", urgency: "urgent" }),
    );
    await appendMessage(
      filePath,
      makeMessage({ to: "agent-b", status: "unread", urgency: "normal" }),
    );

    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    const result = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("1 urgent");
  });

  // ── enforcement="strict" ────────────────────────────────────────────────

  it("strict: blocks ALL non-mail tools when unread mail exists", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });

    // Even thinking tools are blocked in strict mode
    const readResult = await hook({ toolName: "read", params: {} }, toolCtx("agent-b"));
    expect(readResult?.block).toBe(true);

    const writeResult = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(writeResult?.block).toBe(true);
  });

  it("strict: blocks terminal tools when pending acks exist", async () => {
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });
    const ctx = toolCtx("agent-b");

    // Simulate: agent checked inbox, then claimed 3 messages
    await hook({ toolName: "mail", params: { action: "inbox" } }, ctx);
    trackInboxResult("agent-b", "sess-1", 3);

    // Terminal tool should be blocked
    const result = await hook({ toolName: "send_message", params: {} }, ctx);
    expect(result?.block).toBe(true);
    expect(result?.blockReason).toContain("3 claimed messages");
    expect(result?.blockReason).toContain("ack");
  });

  it("strict: unblocks terminal tools after ack clears pending count", async () => {
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });
    const ctx = toolCtx("agent-b");

    // Simulate claim then ack
    await hook({ toolName: "mail", params: { action: "inbox" } }, ctx);
    trackInboxResult("agent-b", "sess-1", 2);
    await hook({ toolName: "mail", params: { action: "ack" } }, ctx);

    // Now terminal tools should pass
    const result = await hook({ toolName: "send_message", params: {} }, ctx);
    expect(result).toBeUndefined();
  });

  it("strict: allows non-terminal tools after inbox check even with pending acks", async () => {
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });
    const ctx = toolCtx("agent-b");

    await hook({ toolName: "mail", params: { action: "inbox" } }, ctx);
    trackInboxResult("agent-b", "sess-1", 1);

    // Non-terminal tools should be allowed (agent needs to read to process mail)
    const result = await hook({ toolName: "read", params: {} }, ctx);
    expect(result).toBeUndefined();
  });

  // ── Edge cases ──────────────────────────────────────────────────────────

  it("does nothing when agentId is missing", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });

    const result = await hook(
      { toolName: "write", params: {} },
      { agentId: undefined, sessionKey: "s1", toolName: "write" },
    );
    expect(result).toBeUndefined();
  });

  it("does nothing when sessionKey is missing", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });

    const result = await hook(
      { toolName: "write", params: {} },
      { agentId: "agent-b", sessionKey: undefined, toolName: "write" },
    );
    expect(result).toBeUndefined();
  });

  it("isolates state between different agent+session pairs", async () => {
    await seedUnread("agent-b");
    await seedUnread("agent-c");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });

    // agent-b checks inbox
    await hook({ toolName: "mail", params: { action: "inbox" } }, toolCtx("agent-b"));

    // agent-b can now use write
    const resultB = await hook({ toolName: "write", params: {} }, toolCtx("agent-b"));
    expect(resultB).toBeUndefined();

    // agent-c is still blocked (different agent, didn't check inbox)
    const resultC = await hook({ toolName: "write", params: {} }, toolCtx("agent-c"));
    expect(resultC?.block).toBe(true);
  });

  it("bounce_mail tool is always passthrough", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });

    const result = await hook({ toolName: "bounce_mail", params: {} }, toolCtx("agent-b"));
    expect(result).toBeUndefined();
  });
});

// ============================================================================
// Config parsing — defaultEnforcement
// ============================================================================

describe("config parsing — defaultEnforcement", () => {
  it("defaults to 'none' when not specified", () => {
    const result = parsePluginConfig({});
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.defaultEnforcement).toBe("none");
    }
  });

  it("accepts valid enforcement levels", () => {
    for (const level of ["none", "soft", "strict"]) {
      const result = parsePluginConfig({ defaultEnforcement: level });
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.defaultEnforcement).toBe(level);
      }
    }
  });

  it("rejects invalid enforcement level", () => {
    const result = parsePluginConfig({ defaultEnforcement: "aggressive" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.message).toContain("defaultEnforcement");
    }
  });

  it("rejects non-string enforcement value", () => {
    const result = parsePluginConfig({ defaultEnforcement: 42 });
    expect(result.ok).toBe(false);
  });
});

// ============================================================================
// Deadlock detection
// ============================================================================

describe("enforcement — deadlock detection", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    _resetEnforcementState();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    _resetEnforcementState();
  });

  function makeEnforcementConfig(
    enforcement: "none" | "soft" | "strict",
  ): ResolvedInterAgentMailConfig {
    return { ...allowAllConfig(), defaultEnforcement: enforcement };
  }

  const toolCtx = (agentId: string, sessionKey = "sess-1") => ({
    agentId,
    sessionKey,
    toolName: "",
  });

  async function seedUnread(agentId: string, count = 1) {
    const filePath = mailboxPath(tmpDir, agentId);
    for (let i = 0; i < count; i++) {
      await appendMessage(filePath, makeMessage({ to: agentId, status: "unread" }));
    }
  }

  it("fails open after 3 consecutive blocks (deadlock threshold)", async () => {
    await seedUnread("agent-b", 2);
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });
    const ctx = toolCtx("agent-b");

    // Block 3 times consecutively
    for (let i = 0; i < 3; i++) {
      const result = await hook({ toolName: "write", params: {} }, ctx);
      expect(result?.block).toBe(true);
    }

    // 4th call should fail-open (deadlock detected)
    const result = await hook({ toolName: "write", params: {} }, ctx);
    expect(result).toBeUndefined();

    // State should show mailChecked = true
    const state = _getRunState("agent-b", "sess-1");
    expect(state?.mailChecked).toBe(true);
    expect(state?.consecutiveBlocks).toBe(0);
  });

  it("resets consecutive blocks when mail tool is called", async () => {
    await seedUnread("agent-b");
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("strict"),
    });
    const ctx = toolCtx("agent-b");

    // Block twice
    await hook({ toolName: "write", params: {} }, ctx);
    await hook({ toolName: "write", params: {} }, ctx);
    expect(_getRunState("agent-b", "sess-1")?.consecutiveBlocks).toBe(2);

    // Call mail tool — resets counter
    await hook({ toolName: "mail", params: { action: "inbox" } }, ctx);
    expect(_getRunState("agent-b", "sess-1")?.consecutiveBlocks).toBe(0);
  });
});

// ============================================================================
// Periodic unread re-check
// ============================================================================

describe("enforcement — periodic unread re-check", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await makeTempDir();
    _resetEnforcementState();
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
    _resetEnforcementState();
  });

  function makeEnforcementConfig(
    enforcement: "none" | "soft" | "strict",
  ): ResolvedInterAgentMailConfig {
    return { ...allowAllConfig(), defaultEnforcement: enforcement };
  }

  const toolCtx = (agentId: string, sessionKey = "sess-1") => ({
    agentId,
    sessionKey,
    toolName: "",
  });

  it("re-checks after 60s but only re-triggers enforcement for urgent mail", async () => {
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });
    const ctx = toolCtx("agent-b");

    // First call: no mail → mailChecked = true
    const r1 = await hook({ toolName: "write", params: {} }, ctx);
    expect(r1).toBeUndefined();
    expect(_getRunState("agent-b", "sess-1")?.mailChecked).toBe(true);

    // Seed NON-URGENT mail after check
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(
      filePath,
      makeMessage({ to: "agent-b", status: "unread", urgency: "normal" }),
    );

    // Advance lastUnreadCheckAt to simulate 60s passing
    const state = _getRunState("agent-b", "sess-1");
    if (state) {
      state.lastUnreadCheckAt = Date.now() - 61_000;
    }

    // Non-urgent mail should NOT re-trigger enforcement (deferred to session end)
    const r2 = await hook({ toolName: "write", params: {} }, ctx);
    expect(r2).toBeUndefined();
  });

  it("re-checks after 60s and re-triggers enforcement for urgent mail", async () => {
    const hook = createBeforeToolCallEnforcementHook({
      stateDir: tmpDir,
      config: makeEnforcementConfig("soft"),
    });
    const ctx = toolCtx("agent-b");

    // First call: no mail → mailChecked = true
    const r1 = await hook({ toolName: "write", params: {} }, ctx);
    expect(r1).toBeUndefined();

    // Seed URGENT mail after check
    const filePath = mailboxPath(tmpDir, "agent-b");
    await appendMessage(
      filePath,
      makeMessage({ to: "agent-b", status: "unread", urgency: "urgent" }),
    );

    // Advance lastUnreadCheckAt to simulate 60s passing
    const state = _getRunState("agent-b", "sess-1");
    if (state) {
      state.lastUnreadCheckAt = Date.now() - 61_000;
    }

    // Urgent mail SHOULD re-trigger enforcement
    const r2 = await hook({ toolName: "write", params: {} }, ctx);
    expect(r2?.block).toBe(true);
    expect(r2?.blockReason).toContain("unread message");
  });
});

// ============================================================================
// Side-channel inbox claimed count
// ============================================================================

describe("enforcement — side-channel claimed count", () => {
  beforeEach(() => {
    _resetEnforcementState();
  });

  afterEach(() => {
    _resetEnforcementState();
  });

  it("setLastInboxClaimedCount + consumeLastInboxClaimedCount round-trip", () => {
    setLastInboxClaimedCount("agent-a", "sess-1", 5);
    expect(consumeLastInboxClaimedCount("agent-a", "sess-1")).toBe(5);
    // Second consume returns 0 (consumed)
    expect(consumeLastInboxClaimedCount("agent-a", "sess-1")).toBe(0);
  });

  it("returns 0 for unknown agent/session", () => {
    expect(consumeLastInboxClaimedCount("unknown", "unknown")).toBe(0);
  });

  it("isolates counts between different agent+session pairs", () => {
    setLastInboxClaimedCount("agent-a", "sess-1", 3);
    setLastInboxClaimedCount("agent-b", "sess-1", 7);

    expect(consumeLastInboxClaimedCount("agent-a", "sess-1")).toBe(3);
    expect(consumeLastInboxClaimedCount("agent-b", "sess-1")).toBe(7);
  });
});

import { describe, expect, it } from "vitest";
import type { DiscordExecApprovalConfig } from "../../config/types.discord.js";
import {
  buildExecApprovalCustomId,
  buildApprovalCustomId,
  parseExecApprovalData,
  parseApprovalData,
  type ExecApprovalRequest,
  type ToolApprovalRequested,
  DiscordExecApprovalHandler,
} from "./exec-approvals.js";

describe("buildExecApprovalCustomId", () => {
  it("encodes approval id and action", () => {
    const customId = buildExecApprovalCustomId("abc-123", "allow-once");
    expect(customId).toBe("execapproval:id=abc-123;action=allow-once");
  });

  it("encodes special characters in approval id", () => {
    const customId = buildExecApprovalCustomId("abc=123;test", "deny");
    expect(customId).toBe("execapproval:id=abc%3D123%3Btest;action=deny");
  });
});

describe("parseExecApprovalData", () => {
  it("parses valid data", () => {
    const result = parseExecApprovalData({ id: "abc-123", action: "allow-once" });
    expect(result).toEqual({ approvalId: "abc-123", action: "allow-once" });
  });

  it("parses encoded data", () => {
    const result = parseExecApprovalData({
      id: "abc%3D123%3Btest",
      action: "allow-always",
    });
    expect(result).toEqual({ approvalId: "abc=123;test", action: "allow-always" });
  });

  it("rejects invalid action", () => {
    const result = parseExecApprovalData({ id: "abc-123", action: "invalid" });
    expect(result).toBeNull();
  });

  it("rejects missing id", () => {
    const result = parseExecApprovalData({ action: "deny" });
    expect(result).toBeNull();
  });

  it("rejects missing action", () => {
    const result = parseExecApprovalData({ id: "abc-123" });
    expect(result).toBeNull();
  });

  it("rejects null/undefined input", () => {
    // oxlint-disable-next-line typescript/no-explicit-any
    expect(parseExecApprovalData(null as any)).toBeNull();
    // oxlint-disable-next-line typescript/no-explicit-any
    expect(parseExecApprovalData(undefined as any)).toBeNull();
  });

  it("accepts all valid actions", () => {
    expect(parseExecApprovalData({ id: "x", action: "allow-once" })?.action).toBe("allow-once");
    expect(parseExecApprovalData({ id: "x", action: "allow-always" })?.action).toBe("allow-always");
    expect(parseExecApprovalData({ id: "x", action: "deny" })?.action).toBe("deny");
  });
});

describe("roundtrip encoding", () => {
  it("encodes and decodes correctly", () => {
    const approvalId = "test-approval-with=special;chars&more";
    const action = "allow-always" as const;
    const customId = buildExecApprovalCustomId(approvalId, action);

    // Parse the key=value pairs from the custom ID
    const parts = customId.split(";");
    const data: Record<string, string> = {};
    for (const part of parts) {
      const match = part.match(/^([^:]+:)?([^=]+)=(.+)$/);
      if (match) {
        data[match[2]] = match[3];
      }
    }

    const result = parseExecApprovalData(data);
    expect(result).toEqual({ approvalId, action });
  });
});

// ---------------------------------------------------------------------------
// shouldHandle (legacy exec approval requests)
// ---------------------------------------------------------------------------

describe("DiscordExecApprovalHandler.shouldHandle", () => {
  function createHandler(config: DiscordExecApprovalConfig) {
    return new DiscordExecApprovalHandler({
      token: "test-token",
      accountId: "default",
      config,
      cfg: {},
    });
  }

  function createRequest(
    overrides: Partial<ExecApprovalRequest["request"]> = {},
  ): ExecApprovalRequest {
    return {
      id: "test-id",
      request: {
        command: "echo hello",
        cwd: "/home/user",
        host: "gateway",
        agentId: "test-agent",
        sessionKey: "agent:test-agent:discord:123",
        ...overrides,
      },
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60000,
    };
  }

  it("returns false when disabled", () => {
    const handler = createHandler({ enabled: false, approvers: ["123"] });
    expect(handler.shouldHandle(createRequest())).toBe(false);
  });

  it("returns false when no approvers", () => {
    const handler = createHandler({ enabled: true, approvers: [] });
    expect(handler.shouldHandle(createRequest())).toBe(false);
  });

  it("returns true with minimal config", () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    expect(handler.shouldHandle(createRequest())).toBe(true);
  });

  it("filters by agent ID", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["allowed-agent"],
    });
    expect(handler.shouldHandle(createRequest({ agentId: "allowed-agent" }))).toBe(true);
    expect(handler.shouldHandle(createRequest({ agentId: "other-agent" }))).toBe(false);
    expect(handler.shouldHandle(createRequest({ agentId: null }))).toBe(false);
  });

  it("filters by session key substring", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["discord"],
    });
    expect(handler.shouldHandle(createRequest({ sessionKey: "agent:test:discord:123" }))).toBe(
      true,
    );
    expect(handler.shouldHandle(createRequest({ sessionKey: "agent:test:telegram:123" }))).toBe(
      false,
    );
    expect(handler.shouldHandle(createRequest({ sessionKey: null }))).toBe(false);
  });

  it("filters by session key regex", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["^agent:.*:discord:"],
    });
    expect(handler.shouldHandle(createRequest({ sessionKey: "agent:test:discord:123" }))).toBe(
      true,
    );
    expect(handler.shouldHandle(createRequest({ sessionKey: "other:test:discord:123" }))).toBe(
      false,
    );
  });

  it("combines agent and session filters", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["my-agent"],
      sessionFilter: ["discord"],
    });
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:discord:123",
        }),
      ),
    ).toBe(true);
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "other-agent",
          sessionKey: "agent:other:discord:123",
        }),
      ),
    ).toBe(false);
    expect(
      handler.shouldHandle(
        createRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:telegram:123",
        }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// shouldHandleToolApproval (canonical tool approval requests)
// ---------------------------------------------------------------------------

describe("DiscordExecApprovalHandler.shouldHandleToolApproval", () => {
  function createHandler(config: DiscordExecApprovalConfig) {
    return new DiscordExecApprovalHandler({
      token: "test-token",
      accountId: "default",
      config,
      cfg: {},
    });
  }

  function createToolRequest(
    overrides: Partial<ToolApprovalRequested> = {},
  ): ToolApprovalRequested {
    return {
      id: "test-id",
      toolName: "file-read",
      paramsSummary: "path=/etc/passwd",
      riskClass: "medium",
      requestHash: "abc123hash",
      agentId: "test-agent",
      sessionKey: "agent:test-agent:discord:123",
      createdAtMs: Date.now(),
      expiresAtMs: Date.now() + 60000,
      ...overrides,
    };
  }

  it("returns false when disabled", () => {
    const handler = createHandler({ enabled: false, approvers: ["123"] });
    expect(handler.shouldHandleToolApproval(createToolRequest())).toBe(false);
  });

  it("returns false when no approvers", () => {
    const handler = createHandler({ enabled: true, approvers: [] });
    expect(handler.shouldHandleToolApproval(createToolRequest())).toBe(false);
  });

  it("returns true with minimal config", () => {
    const handler = createHandler({ enabled: true, approvers: ["123"] });
    expect(handler.shouldHandleToolApproval(createToolRequest())).toBe(true);
  });

  it("filters by agent ID", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["allowed-agent"],
    });
    expect(handler.shouldHandleToolApproval(createToolRequest({ agentId: "allowed-agent" }))).toBe(
      true,
    );
    expect(handler.shouldHandleToolApproval(createToolRequest({ agentId: "other-agent" }))).toBe(
      false,
    );
    expect(handler.shouldHandleToolApproval(createToolRequest({ agentId: null }))).toBe(false);
  });

  it("filters by session key substring", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["discord"],
    });
    expect(
      handler.shouldHandleToolApproval(createToolRequest({ sessionKey: "agent:test:discord:123" })),
    ).toBe(true);
    expect(
      handler.shouldHandleToolApproval(
        createToolRequest({ sessionKey: "agent:test:telegram:123" }),
      ),
    ).toBe(false);
    expect(handler.shouldHandleToolApproval(createToolRequest({ sessionKey: null }))).toBe(false);
  });

  it("filters by session key regex", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      sessionFilter: ["^agent:.*:discord:"],
    });
    expect(
      handler.shouldHandleToolApproval(createToolRequest({ sessionKey: "agent:test:discord:123" })),
    ).toBe(true);
    expect(
      handler.shouldHandleToolApproval(createToolRequest({ sessionKey: "other:test:discord:123" })),
    ).toBe(false);
  });

  it("combines agent and session filters", () => {
    const handler = createHandler({
      enabled: true,
      approvers: ["123"],
      agentFilter: ["my-agent"],
      sessionFilter: ["discord"],
    });
    expect(
      handler.shouldHandleToolApproval(
        createToolRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:discord:123",
        }),
      ),
    ).toBe(true);
    expect(
      handler.shouldHandleToolApproval(
        createToolRequest({
          agentId: "other-agent",
          sessionKey: "agent:other:discord:123",
        }),
      ),
    ).toBe(false);
    expect(
      handler.shouldHandleToolApproval(
        createToolRequest({
          agentId: "my-agent",
          sessionKey: "agent:my-agent:telegram:123",
        }),
      ),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Generic aliases (backward-compat: same wire format, clearer naming)
// ---------------------------------------------------------------------------

describe("buildApprovalCustomId / parseApprovalData aliases", () => {
  it("buildApprovalCustomId is the same function as buildExecApprovalCustomId", () => {
    expect(buildApprovalCustomId).toBe(buildExecApprovalCustomId);
    expect(buildApprovalCustomId("id1", "deny")).toBe(buildExecApprovalCustomId("id1", "deny"));
  });

  it("parseApprovalData is the same function as parseExecApprovalData", () => {
    expect(parseApprovalData).toBe(parseExecApprovalData);
    const result = parseApprovalData({ id: "abc", action: "allow-once" });
    expect(result).toEqual({ approvalId: "abc", action: "allow-once" });
  });
});

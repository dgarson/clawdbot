import { describe, it, expect } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { ExecApprovalRequest } from "../../infra/exec-approvals.js";
import {
  extractSlackChannelId,
  buildExecApprovalBlocks,
  buildExecApprovalActionId,
  SlackExecApprovalHandler,
} from "./exec-approvals.js";

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

describe("extractSlackChannelId", () => {
  it("extracts channel ID from a channel session key", () => {
    expect(extractSlackChannelId("agent:main:slack:channel:C1234567890")).toBe("C1234567890");
  });

  it("extracts channel ID from a group session key", () => {
    expect(extractSlackChannelId("agent:main:slack:group:G0987654321")).toBe("G0987654321");
  });

  it("returns null for a DM session key (no channel: or group: prefix)", () => {
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

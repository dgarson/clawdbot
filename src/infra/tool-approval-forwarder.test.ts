import { afterEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../config/config.js";
import { createToolApprovalForwarder } from "./tool-approval-forwarder.js";

const baseRequest = {
  id: "req-1",
  request: {
    toolName: "write",
    paramsSummary: "file=notes.txt",
    agentId: "main",
    sessionKey: "agent:main:main",
    requestHash: "hash-1",
  },
  createdAtMs: 1000,
  expiresAtMs: 6000,
};

afterEach(() => {
  vi.useRealTimers();
});

describe("tool approval forwarder", () => {
  it("skips discord targets when discord exec approvals are enabled", async () => {
    vi.useFakeTimers();
    const deliver = vi.fn().mockResolvedValue([]);
    const cfg = {
      approvals: {
        exec: {
          enabled: true,
          mode: "targets",
          targets: [
            { channel: "discord", to: "U1" },
            { channel: "slack", to: "U2" },
          ],
        },
      },
      channels: {
        discord: {
          execApprovals: { enabled: true, approvers: ["123"] },
        },
      },
    } as OpenClawConfig;

    const forwarder = createToolApprovalForwarder({
      getConfig: () => cfg,
      deliver,
      nowMs: () => 1000,
      resolveSessionTarget: () => null,
    });

    await forwarder.handleRequested(baseRequest);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[0]?.channel).toBe("slack");

    forwarder.stop();
  });

  it("allows discord forwarding when skip flag is disabled", async () => {
    vi.useFakeTimers();
    const deliver = vi.fn().mockResolvedValue([]);
    const cfg = {
      approvals: {
        exec: {
          enabled: true,
          mode: "targets",
          skipDiscordWhenExecApprovalsEnabled: false,
          targets: [{ channel: "discord", to: "U1" }],
        },
      },
      channels: {
        discord: {
          execApprovals: { enabled: true, approvers: ["123"] },
        },
      },
    } as OpenClawConfig;

    const forwarder = createToolApprovalForwarder({
      getConfig: () => cfg,
      deliver,
      nowMs: () => 1000,
      resolveSessionTarget: () => null,
    });

    await forwarder.handleRequested(baseRequest);
    expect(deliver).toHaveBeenCalledTimes(1);
    expect(deliver.mock.calls[0]?.[0]?.channel).toBe("discord");

    forwarder.stop();
  });
});

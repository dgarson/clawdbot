import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OpenClawConfig } from "../../config/config.js";
import type { MsgContext } from "../templating.js";
import { callGateway } from "../../gateway/call.js";
import { buildCommandContext, handleCommands } from "./commands.js";
import { parseInlineDirectives } from "./directive-handling.js";

vi.mock("../../gateway/call.js", () => ({
  callGateway: vi.fn(),
}));

function buildParams(commandBody: string, cfg: OpenClawConfig, ctxOverrides?: Partial<MsgContext>) {
  const ctx = {
    Body: commandBody,
    CommandBody: commandBody,
    CommandSource: "text",
    CommandAuthorized: true,
    Provider: "whatsapp",
    Surface: "whatsapp",
    ...ctxOverrides,
  } as MsgContext;

  const command = buildCommandContext({
    ctx,
    cfg,
    isGroup: false,
    triggerBodyNormalized: commandBody.trim().toLowerCase(),
    commandAuthorized: true,
  });

  return {
    ctx,
    cfg,
    command,
    directives: parseInlineDirectives(commandBody),
    elevated: { enabled: true, allowed: true, failures: [] },
    sessionKey: "agent:main:main",
    workspaceDir: "/tmp",
    defaultGroupActivation: () => "mention",
    resolvedVerboseLevel: "off" as const,
    resolvedReasoningLevel: "off" as const,
    resolveDefaultThinkingLevel: async () => undefined,
    provider: "whatsapp",
    model: "test-model",
    contextTokens: 0,
    isGroup: false,
  };
}

describe("/approve command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects invalid usage", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/approve", cfg);
    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Usage: /approve");
  });

  it("resolves canonical tool approval when found", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, { SenderId: "123" });

    const mockCallGateway = vi.mocked(callGateway);
    const calls: string[] = [];
    // oxlint-disable-next-line typescript/no-explicit-any
    mockCallGateway.mockImplementation(async (opts: any) => {
      calls.push(opts.method);
      if (opts.method === "tool.approvals.get") {
        return { approvals: [{ id: "abc", requestHash: "hash123" }] };
      }
      return { ok: true };
    });

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Tool approval allow-once submitted");
    expect(calls).toContain("tool.approvals.get");
    expect(calls).toContain("tool.approval.resolve");
    expect(mockCallGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "tool.approval.resolve",
        params: { id: "abc", decision: "allow-once", requestHash: "hash123" },
      }),
    );
  });

  it("falls back to legacy exec.approval.resolve when no canonical match", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, { SenderId: "123" });

    const mockCallGateway = vi.mocked(callGateway);
    // oxlint-disable-next-line typescript/no-explicit-any
    mockCallGateway.mockImplementation(async (opts: any) => {
      if (opts.method === "tool.approvals.get") {
        return { approvals: [] };
      }
      return { ok: true };
    });

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Tool approval allow-once submitted");
    expect(mockCallGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "exec.approval.resolve",
        params: { id: "abc", decision: "allow-once" },
      }),
    );
  });

  it("falls back to legacy path when tool.approvals.get fails", async () => {
    const cfg = {
      commands: { text: true },
      channels: { whatsapp: { allowFrom: ["*"] } },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, { SenderId: "123" });

    const mockCallGateway = vi.mocked(callGateway);
    // oxlint-disable-next-line typescript/no-explicit-any
    mockCallGateway.mockImplementation(async (opts: any) => {
      if (opts.method === "tool.approvals.get") {
        throw new Error("gateway unavailable");
      }
      return { ok: true };
    });

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Tool approval allow-once submitted");
    expect(mockCallGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "exec.approval.resolve",
        params: { id: "abc", decision: "allow-once" },
      }),
    );
  });

  it("rejects gateway clients without approvals scope", async () => {
    const cfg = {
      commands: { text: true },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, {
      Provider: "webchat",
      Surface: "webchat",
      GatewayClientScopes: ["operator.write"],
    });

    const mockCallGateway = vi.mocked(callGateway);

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("requires operator.approvals");
    expect(mockCallGateway).not.toHaveBeenCalledWith(
      expect.objectContaining({ method: "tool.approvals.get" }),
    );
  });

  it("allows gateway clients with approvals scope", async () => {
    const cfg = {
      commands: { text: true },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, {
      Provider: "webchat",
      Surface: "webchat",
      GatewayClientScopes: ["operator.approvals"],
    });

    const mockCallGateway = vi.mocked(callGateway);
    // oxlint-disable-next-line typescript/no-explicit-any
    mockCallGateway.mockImplementation(async (opts: any) => {
      if (opts.method === "tool.approvals.get") {
        return { approvals: [{ id: "abc", requestHash: "hash456" }] };
      }
      return { ok: true };
    });

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Tool approval allow-once submitted");
    expect(mockCallGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "tool.approval.resolve",
        params: { id: "abc", decision: "allow-once", requestHash: "hash456" },
      }),
    );
  });

  it("allows gateway clients with admin scope", async () => {
    const cfg = {
      commands: { text: true },
    } as OpenClawConfig;
    const params = buildParams("/approve abc allow-once", cfg, {
      Provider: "webchat",
      Surface: "webchat",
      GatewayClientScopes: ["operator.admin"],
    });

    const mockCallGateway = vi.mocked(callGateway);
    // oxlint-disable-next-line typescript/no-explicit-any
    mockCallGateway.mockImplementation(async (opts: any) => {
      if (opts.method === "tool.approvals.get") {
        return { approvals: [] };
      }
      return { ok: true };
    });

    const result = await handleCommands(params);
    expect(result.shouldContinue).toBe(false);
    expect(result.reply?.text).toContain("Tool approval allow-once submitted");
    expect(mockCallGateway).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "exec.approval.resolve",
        params: { id: "abc", decision: "allow-once" },
      }),
    );
  });
});

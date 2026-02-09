import { describe, expect, it, vi } from "vitest";
import { buildGatewayReloadPlan } from "../config-reload.js";
import { gatewayReloadHandlers } from "./gateway-reload.js";

describe("gateway.reload handler", () => {
  const createMockContext = (opts?: {
    triggerConfigReload?: typeof mockTriggerConfigReload | undefined;
    omitTriggerConfigReload?: boolean;
  }) => ({
    triggerConfigReload: opts?.omitTriggerConfigReload
      ? undefined
      : (opts?.triggerConfigReload ?? mockTriggerConfigReload),
    deps: {} as any,
    cron: {} as any,
    cronStorePath: "/tmp",
    loadGatewayModelCatalog: async () => [],
    getHealthCache: () => null,
    refreshHealthSnapshot: async () => ({}) as any,
    logHealth: { error: () => {} },
    logGateway: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} } as any,
    incrementPresenceVersion: () => 1,
    getHealthVersion: () => 1,
    broadcast: () => {},
    nodeSendToSession: () => {},
    nodeSendToAllSubscribed: () => {},
    nodeSubscribe: () => {},
    nodeUnsubscribe: () => {},
    nodeUnsubscribeAll: () => {},
    hasConnectedMobileNode: () => false,
    nodeRegistry: {} as any,
    agentRunSeq: new Map(),
    chatAbortControllers: new Map(),
    chatAbortedRuns: new Map(),
    chatRunBuffers: new Map(),
    chatDeltaSentAt: new Map(),
    addChatRun: () => {},
    removeChatRun: () => undefined,
    dedupe: new Map(),
    wizardSessions: new Map(),
    findRunningWizard: () => null,
    purgeWizardSession: () => {},
    getRuntimeSnapshot: () => ({}) as any,
    startChannel: async () => {},
    stopChannel: async () => {},
    markChannelLoggedOut: () => {},
    wizardRunner: async () => {},
    broadcastVoiceWakeChanged: () => {},
  });

  const mockTriggerConfigReload = vi.fn().mockResolvedValue({
    mode: "hot" as const,
    plan: buildGatewayReloadPlan([]),
  });

  it("returns error when triggerConfigReload is not available", async () => {
    const respond = vi.fn();
    const context = createMockContext({ omitTriggerConfigReload: true });

    await gatewayReloadHandlers["gateway.reload"]({
      req: { type: "req" as const, id: "1", method: "gateway.reload", params: {} },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "UNAVAILABLE",
        message: expect.stringContaining("not available"),
      }),
    );
  });

  it("calls triggerConfigReload with correct options", async () => {
    const respond = vi.fn();
    const triggerConfigReload = vi.fn().mockResolvedValue({
      mode: "hot" as const,
      plan: buildGatewayReloadPlan(["agents.defaults.model"]),
    });
    const context = createMockContext({ triggerConfigReload });

    await gatewayReloadHandlers["gateway.reload"]({
      req: { type: "req" as const, id: "1", method: "gateway.reload", params: {} },
      params: { forceRestart: true, graceful: true, gracefulTimeoutMs: 5000 },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(triggerConfigReload).toHaveBeenCalledWith({
      forceRestart: true,
      graceful: true,
      gracefulTimeoutMs: 5000,
    });
  });

  it("returns hot reload result correctly", async () => {
    const respond = vi.fn();
    const triggerConfigReload = vi.fn().mockResolvedValue({
      mode: "hot" as const,
      plan: buildGatewayReloadPlan(["agents.defaults.model"]),
    });
    const context = createMockContext({ triggerConfigReload });

    await gatewayReloadHandlers["gateway.reload"]({
      req: { type: "req" as const, id: "1", method: "gateway.reload", params: {} },
      params: {},
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        mode: "hot",
        plan: expect.objectContaining({
          restartGateway: false,
        }),
      }),
      undefined,
    );
  });

  it("returns restart result correctly", async () => {
    const respond = vi.fn();
    const plan = buildGatewayReloadPlan(["gateway.port"]);
    const triggerConfigReload = vi.fn().mockResolvedValue({
      mode: "restart" as const,
      plan,
      restart: {
        scheduled: true,
        reason: "gateway.port",
      },
    });
    const context = createMockContext({ triggerConfigReload });

    await gatewayReloadHandlers["gateway.reload"]({
      req: { type: "req" as const, id: "1", method: "gateway.reload", params: {} },
      params: { forceRestart: true },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(respond).toHaveBeenCalledWith(
      true,
      expect.objectContaining({
        ok: true,
        mode: "restart",
        restart: expect.objectContaining({
          scheduled: true,
        }),
      }),
      undefined,
    );
  });

  it("validates params and rejects invalid input", async () => {
    const respond = vi.fn();
    const context = createMockContext();

    await gatewayReloadHandlers["gateway.reload"]({
      req: { type: "req" as const, id: "1", method: "gateway.reload", params: {} },
      params: { gracefulTimeoutMs: "not-a-number" },
      client: null,
      isWebchatConnect: () => false,
      respond,
      context,
    });

    expect(respond).toHaveBeenCalledWith(
      false,
      undefined,
      expect.objectContaining({
        code: "INVALID_REQUEST",
      }),
    );
  });
});

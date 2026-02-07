import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ChannelPlugin } from "../channels/plugins/types.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { setActivePluginRegistry } from "../plugins/runtime.js";
import { createTestRegistry } from "../test-utils/channel-plugins.js";
import {
  buildGatewayReloadPlan,
  diffConfigPaths,
  resolveGatewayReloadSettings,
} from "./config-reload.js";

describe("diffConfigPaths", () => {
  it("captures nested config changes", () => {
    const prev = { hooks: { gmail: { account: "a" } } };
    const next = { hooks: { gmail: { account: "b" } } };
    const paths = diffConfigPaths(prev, next);
    expect(paths).toContain("hooks.gmail.account");
  });

  it("captures array changes", () => {
    const prev = { messages: { groupChat: { mentionPatterns: ["a"] } } };
    const next = { messages: { groupChat: { mentionPatterns: ["b"] } } };
    const paths = diffConfigPaths(prev, next);
    expect(paths).toContain("messages.groupChat.mentionPatterns");
  });
});

describe("buildGatewayReloadPlan", () => {
  const emptyRegistry = createTestRegistry([]);
  const telegramPlugin: ChannelPlugin = {
    id: "telegram",
    meta: {
      id: "telegram",
      label: "Telegram",
      selectionLabel: "Telegram",
      docsPath: "/channels/telegram",
      blurb: "test",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
    reload: { configPrefixes: ["channels.telegram"] },
  };
  const whatsappPlugin: ChannelPlugin = {
    id: "whatsapp",
    meta: {
      id: "whatsapp",
      label: "WhatsApp",
      selectionLabel: "WhatsApp",
      docsPath: "/channels/whatsapp",
      blurb: "test",
    },
    capabilities: { chatTypes: ["direct"] },
    config: {
      listAccountIds: () => [],
      resolveAccount: () => ({}),
    },
    reload: { configPrefixes: ["web"], noopPrefixes: ["channels.whatsapp"] },
  };
  const registry = createTestRegistry([
    { pluginId: "telegram", plugin: telegramPlugin, source: "test" },
    { pluginId: "whatsapp", plugin: whatsappPlugin, source: "test" },
  ]);

  beforeEach(() => {
    setActivePluginRegistry(registry);
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("marks gateway changes as restart required", () => {
    const plan = buildGatewayReloadPlan(["gateway.port"]);
    expect(plan.restartGateway).toBe(true);
    expect(plan.restartReasons).toContain("gateway.port");
  });

  it("restarts the Gmail watcher for hooks.gmail changes", () => {
    const plan = buildGatewayReloadPlan(["hooks.gmail.account"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.restartGmailWatcher).toBe(true);
    expect(plan.reloadHooks).toBe(true);
  });

  it("restarts providers when provider config prefixes change", () => {
    const changedPaths = ["web.enabled", "channels.telegram.botToken"];
    const plan = buildGatewayReloadPlan(changedPaths);
    expect(plan.restartGateway).toBe(false);
    const expected = new Set(
      listChannelPlugins()
        .filter((plugin) =>
          (plugin.reload?.configPrefixes ?? []).some((prefix) =>
            changedPaths.some((path) => path === prefix || path.startsWith(`${prefix}.`)),
          ),
        )
        .map((plugin) => plugin.id),
    );
    expect(expected.size).toBeGreaterThan(0);
    expect(plan.restartChannels).toEqual(expected);
  });

  it("treats gateway.remote as no-op", () => {
    const plan = buildGatewayReloadPlan(["gateway.remote.url"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("gateway.remote.url");
  });

  it("defaults unknown paths to restart", () => {
    const plan = buildGatewayReloadPlan(["unknownField"]);
    expect(plan.restartGateway).toBe(true);
  });
});

describe("resolveGatewayReloadSettings", () => {
  it("uses defaults when unset", () => {
    const settings = resolveGatewayReloadSettings({});
    expect(settings.mode).toBe("hybrid");
    expect(settings.debounceMs).toBe(300);
  });
});

describe("hot-reload coverage - Tier 1 configs", () => {
  const emptyRegistry = createTestRegistry([]);

  beforeEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("treats agents.defaults.model as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.model"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.model");
  });

  it("treats agents.defaults.imageModel as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.imageModel"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.imageModel");
  });

  it("treats agents.defaults.thinkingDefault as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.thinkingDefault"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.thinkingDefault");
  });

  it("treats agents.defaults.verboseDefault as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.verboseDefault"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.verboseDefault");
  });

  it("treats agents.defaults.maxConcurrent as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.maxConcurrent"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.maxConcurrent");
  });

  it("treats messages.* as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["messages.groupChat.mentionPatterns"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("messages.groupChat.mentionPatterns");
  });

  it("treats session.* as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["session.maxMessages"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("session.maxMessages");
  });
});

describe("hot-reload coverage - Tier 2 configs", () => {
  const emptyRegistry = createTestRegistry([]);

  beforeEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  afterEach(() => {
    setActivePluginRegistry(emptyRegistry);
  });

  it("treats agents.defaults.blockStreamingDefault as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.blockStreamingDefault"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.blockStreamingDefault");
  });

  it("treats agents.defaults.typingMode as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.typingMode"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.typingMode");
  });

  it("treats agents.defaults.contextPruning as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.contextPruning"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.contextPruning");
  });

  it("treats agents.defaults.compaction as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["agents.defaults.compaction"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("agents.defaults.compaction");
  });

  it("treats routing.allowFrom.* as no-op (no restart)", () => {
    const plan = buildGatewayReloadPlan(["routing.allowFrom.channels"]);
    expect(plan.restartGateway).toBe(false);
    expect(plan.noopPaths).toContain("routing.allowFrom.channels");
  });
});

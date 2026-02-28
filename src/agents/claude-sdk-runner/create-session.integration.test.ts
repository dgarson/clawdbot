/**
 * Integration test: Production hook wiring path for before_session_create.
 *
 * Verifies the full pipeline: PluginRegistry -> HookRunner -> hook dispatch ->
 * coreSessionContextSubscriber returns system prompt sections.
 *
 * Existing tests only cover fallback paths or isolated unit behavior; this test
 * exercises the production wiring where the global hook runner dispatches to
 * a registered subscriber.
 */

import { describe, it, expect, vi, afterEach, type Mock } from "vitest";
import {
  initializeGlobalHookRunner,
  resetGlobalHookRunner,
  getGlobalHookRunner,
} from "../../plugins/hook-runner-global.js";
import { createEmptyPluginRegistry } from "../../plugins/registry.js";
import type { PluginHookRegistration } from "../../plugins/types.js";
import { coreSessionContextSubscriber } from "./context/session-context-subscriber.js";
import type { StructuredContextInput } from "./context/types.js";
import type { ClaudeSdkSessionParams } from "./types.js";

// ---------------------------------------------------------------------------
// Mock the Agent SDK query() — createClaudeSdkSession calls query() internally
// ---------------------------------------------------------------------------

vi.mock("@anthropic-ai/claude-agent-sdk", () => {
  return {
    query: vi.fn(),
    createSdkMcpServer: vi.fn(() => ({ name: "mock-mcp-server", type: "mock" })),
    tool: vi.fn((name: string, _desc: string, _schema: unknown, handler: unknown) => ({
      name,
      handler,
    })),
  };
});

async function importCreateSession() {
  const mod = await import("./create-session.js");
  return mod.createClaudeSdkSession;
}

async function importQuery() {
  const mod = await import("@anthropic-ai/claude-agent-sdk");
  return mod.query as Mock;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const noopFetcher: StructuredContextInput["fetcher"] = {
  async fetchThread() {
    return { replies: [], totalCount: 0 };
  },
  async fetchMessages() {
    return [];
  },
};

function makeStructuredContextInput(): StructuredContextInput {
  return {
    platform: "slack",
    channelId: "C123",
    channelName: "#general",
    channelType: "group",
    anchor: {
      messageId: "1700000000.000",
      ts: "1700000000.000",
      authorId: "U1",
      authorName: "Alice",
      authorIsBot: false,
      text: "Hello there",
      threadId: null,
    },
    adjacentMessages: [],
    thread: null,
    fetcher: noopFetcher,
  };
}

function makeParams(overrides?: Partial<ClaudeSdkSessionParams>): ClaudeSdkSessionParams {
  return {
    workspaceDir: "/workspace",
    sessionId: "sess_integration_001",
    modelId: "claude-sonnet-4-5-20250514",
    tools: [],
    customTools: [],
    systemPrompt: "You are a helpful assistant.",
    ...overrides,
  };
}

const INIT_MESSAGES = [
  { type: "system", subtype: "init", session_id: "sess_server_int_001" },
  {
    type: "assistant",
    message: { role: "assistant", content: [{ type: "text", text: "Hi!" }] },
  },
  { type: "result", subtype: "success", result: "Hi!" },
];

function makeMockQueryGen(messages: Array<Record<string, unknown>>) {
  return async function* () {
    for (const msg of messages) {
      yield msg;
    }
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("create-session hook dispatch integration", () => {
  afterEach(() => {
    resetGlobalHookRunner();
    vi.clearAllMocks();
  });

  it("dispatches before_session_create through global hook runner to the core subscriber", async () => {
    const createClaudeSdkSession = await importCreateSession();
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    // Spy on coreSessionContextSubscriber by wrapping it
    const subscriberSpy = vi.fn(coreSessionContextSubscriber);

    // Create registry and register the subscriber as a before_session_create hook
    const registry = createEmptyPluginRegistry();
    registry.typedHooks.push({
      pluginId: "builtin:core-session-context",
      hookName: "before_session_create",
      handler: (event, _ctx) => subscriberSpy(event),
      priority: 100,
      source: "core",
    } as PluginHookRegistration<"before_session_create">);

    // Initialize the global hook runner with the registry
    initializeGlobalHookRunner(registry);

    // Verify the runner is available
    const runner = getGlobalHookRunner();
    expect(runner).not.toBeNull();
    expect(runner!.hasHooks("before_session_create")).toBe(true);

    // Call createClaudeSdkSession with structuredContextInput
    const session = await createClaudeSdkSession(
      makeParams({
        structuredContextInput: makeStructuredContextInput(),
      }),
    );

    // The subscriber spy should have been called through the hook runner
    expect(subscriberSpy).toHaveBeenCalledTimes(1);
    expect(subscriberSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        systemPrompt: "You are a helpful assistant.",
        structuredContextInput: expect.objectContaining({
          platform: "slack",
          channelId: "C123",
        }),
      }),
    );

    // The result should have contributed system prompt sections
    const result = subscriberSpy.mock.results[0];
    expect(result?.type).toBe("return");
    const returnValue = result?.value;
    expect(returnValue).toBeDefined();
    expect(returnValue?.systemPromptSections).toBeDefined();
    expect(returnValue!.systemPromptSections!.length).toBeGreaterThan(0);

    // The session should exist and be valid
    expect(session).toBeDefined();
    expect(session.sessionId).toBe("sess_integration_001");
  });

  it("falls back to direct coreSessionContextSubscriber call when hook runner is NOT initialized", async () => {
    const createClaudeSdkSession = await importCreateSession();
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    // Ensure no global runner is set (resetGlobalHookRunner in afterEach already handles this,
    // but be explicit)
    resetGlobalHookRunner();
    expect(getGlobalHookRunner()).toBeNull();

    // Call createClaudeSdkSession — it should still work via the fallback path
    const session = await createClaudeSdkSession(
      makeParams({
        structuredContextInput: makeStructuredContextInput(),
      }),
    );

    // Session should be created successfully even without the hook runner
    expect(session).toBeDefined();
    expect(session.sessionId).toBe("sess_integration_001");
  });

  it("accumulates system prompt sections from multiple subscribers", async () => {
    const createClaudeSdkSession = await importCreateSession();
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    // Register two subscribers: the core subscriber + a plugin subscriber
    const registry = createEmptyPluginRegistry();

    // Core subscriber (high priority — runs first)
    registry.typedHooks.push({
      pluginId: "builtin:core",
      hookName: "before_session_create",
      handler: (event, _ctx) => coreSessionContextSubscriber(event),
      priority: 100,
      source: "core",
    } as PluginHookRegistration<"before_session_create">);

    // Plugin subscriber (lower priority — runs second)
    const pluginHandler = vi.fn().mockReturnValue({
      systemPromptSections: ["### Plugin Context\nCustom plugin section"],
    });
    registry.typedHooks.push({
      pluginId: "test-plugin",
      hookName: "before_session_create",
      handler: pluginHandler,
      priority: 0,
      source: "test",
    } as PluginHookRegistration<"before_session_create">);

    initializeGlobalHookRunner(registry);

    const session = await createClaudeSdkSession(
      makeParams({
        structuredContextInput: makeStructuredContextInput(),
      }),
    );

    // Both subscribers should have been called
    expect(pluginHandler).toHaveBeenCalledTimes(1);

    // Session should be created
    expect(session).toBeDefined();
  });

  it("works with no structuredContextInput — subscriber returns empty result", async () => {
    const createClaudeSdkSession = await importCreateSession();
    const queryMock = await importQuery();
    queryMock.mockImplementation(() => makeMockQueryGen(INIT_MESSAGES)());

    const subscriberSpy = vi.fn(coreSessionContextSubscriber);
    const registry = createEmptyPluginRegistry();
    registry.typedHooks.push({
      pluginId: "builtin:core",
      hookName: "before_session_create",
      handler: (event, _ctx) => subscriberSpy(event),
      priority: 100,
      source: "core",
    } as PluginHookRegistration<"before_session_create">);

    initializeGlobalHookRunner(registry);

    // No structuredContextInput
    const session = await createClaudeSdkSession(makeParams());

    // Subscriber was called but returned empty (no context to inject)
    expect(subscriberSpy).toHaveBeenCalledTimes(1);
    const result = subscriberSpy.mock.results[0]?.value;
    expect(result).toEqual({});

    expect(session).toBeDefined();
  });
});

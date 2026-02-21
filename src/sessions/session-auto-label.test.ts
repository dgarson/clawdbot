import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock dependencies before importing the service
vi.mock("../config/config.js", () => ({
  loadConfig: vi.fn(),
}));
vi.mock("../infra/agent-events.js", () => ({
  onAgentEvent: vi.fn(),
}));
vi.mock("../agents/model-selection.js", () => ({
  resolveDefaultModelForAgent: vi.fn(),
}));
vi.mock("../agents/models-config.js", () => ({
  ensureOpenClawModelsJson: vi.fn(),
}));
vi.mock("../agents/pi-model-discovery.js", () => ({
  discoverAuthStorage: vi.fn(),
  discoverModels: vi.fn(),
}));
vi.mock("../agents/model-auth.js", () => ({
  getApiKeyForModel: vi.fn(),
  requireApiKey: vi.fn(),
}));
vi.mock("../agents/agent-paths.js", () => ({
  resolveOpenClawAgentDir: vi.fn(),
}));
vi.mock("../config/sessions.js", () => ({
  resolveStorePath: vi.fn(),
  loadSessionStore: vi.fn(),
}));
vi.mock("../config/sessions/store.js", () => ({
  updateSessionStoreEntry: vi.fn(),
}));

import { resolveOpenClawAgentDir } from "../agents/agent-paths.js";
import { getApiKeyForModel, requireApiKey } from "../agents/model-auth.js";
import { resolveDefaultModelForAgent } from "../agents/model-selection.js";
import { discoverAuthStorage, discoverModels } from "../agents/pi-model-discovery.js";
import { loadConfig } from "../config/config.js";
import { resolveStorePath, loadSessionStore } from "../config/sessions.js";
import { updateSessionStoreEntry } from "../config/sessions/store.js";
import { onAgentEvent } from "../infra/agent-events.js";

describe("session-auto-label service", () => {
  let capturedListener: ((evt: unknown) => Promise<void> | void) | undefined;

  beforeEach(() => {
    vi.clearAllMocks();
    capturedListener = undefined;

    // Capture the listener registered by the service
    vi.mocked(onAgentEvent).mockImplementation((fn): (() => boolean) => {
      capturedListener = fn as (evt: unknown) => Promise<void>;
      return () => true;
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  async function loadService() {
    const mod = await import("./session-auto-label.js");
    mod.registerSessionAutoLabel();
    return mod;
  }

  it("does not register listener when sessionLabels.enabled is not set", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: {} },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    // registerSessionAutoLabel checks enabled before subscribing
    // so we fire an input event and expect no label generation
    expect(onAgentEvent).not.toHaveBeenCalled();
  });

  it("skips cron session keys", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();
    expect(onAgentEvent).toHaveBeenCalled();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:cron:abc123:run:xyz",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips subagent session keys", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:subagent:abc",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips events that are not stream=input", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    await capturedListener?.({
      stream: "lifecycle",
      sessionKey: "agent:main:direct",
      data: { phase: "end" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips when session already has a label", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: { sessionLabels: { enabled: true } } },
    } as ReturnType<typeof loadConfig>);
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main:direct": {
        sessionId: "abc",
        updatedAt: Date.now(),
        label: "already set",
      },
    });

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:direct",
      data: { prompt: "hello" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("generates and writes a label for a new session", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        defaults: { sessionLabels: { enabled: true, maxLength: 79 } },
      },
    } as ReturnType<typeof loadConfig>);
    vi.mocked(resolveOpenClawAgentDir).mockReturnValue("/tmp/agentdir");
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main:direct": { sessionId: "abc", updatedAt: Date.now() },
    });
    vi.mocked(resolveDefaultModelForAgent).mockReturnValue({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });

    const fakeAuthStorage = { setRuntimeApiKey: vi.fn() };
    const fakeModel = {
      id: "claude-haiku-4-5",
      provider: "anthropic",
      contextWindow: 200000,
    };
    const fakeRegistry = { find: vi.fn().mockReturnValue(fakeModel) };
    vi.mocked(discoverAuthStorage).mockReturnValue(fakeAuthStorage as never);
    vi.mocked(discoverModels).mockReturnValue(fakeRegistry as never);
    vi.mocked(getApiKeyForModel).mockResolvedValue({
      apiKey: "sk-test",
      source: "env",
      mode: "api-key",
    });
    vi.mocked(requireApiKey).mockReturnValue("sk-test");

    // Mock complete() from @mariozechner/pi-ai
    const completeMock = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Debug session with greetings" }],
    });
    vi.doMock("@mariozechner/pi-ai", () => ({ complete: completeMock }));

    vi.mocked(updateSessionStoreEntry).mockResolvedValue(null);

    await loadService();

    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:direct",
      data: { prompt: "hey what's up" },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });

    // Allow async operations to settle
    await vi.runAllTimersAsync?.().catch(() => {});
    await new Promise((r) => setTimeout(r, 0));

    expect(updateSessionStoreEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:direct",
      }),
    );
  });
});

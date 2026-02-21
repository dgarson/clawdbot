import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@mariozechner/pi-ai", () => ({
  complete: vi.fn(),
}));

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

import { complete } from "@mariozechner/pi-ai";
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

  async function flush() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  function mockConfigEnabled(overrides?: { model?: string; maxLength?: number; prompt?: string }) {
    vi.mocked(loadConfig).mockReturnValue({
      agents: {
        defaults: {
          sessionLabels: {
            enabled: true,
            ...overrides,
          },
        },
      },
    } as ReturnType<typeof loadConfig>);
  }

  function mockHappyPathDeps(opts?: {
    store?: Record<string, { sessionId: string; updatedAt: number; label?: string }>;
    model?: { id: string; provider: string; contextWindow: number };
  }) {
    vi.mocked(resolveOpenClawAgentDir).mockReturnValue("/tmp/agentdir");
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue(
      opts?.store ?? {
        "agent:main:direct": { sessionId: "abc", updatedAt: Date.now() },
      },
    );
    vi.mocked(resolveDefaultModelForAgent).mockReturnValue({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    });

    const fakeAuthStorage = { setRuntimeApiKey: vi.fn() };
    const fakeModel =
      opts?.model ??
      ({
        id: "claude-haiku-4-5",
        provider: "anthropic",
        contextWindow: 200000,
      } as const);
    const fakeRegistry = { find: vi.fn().mockReturnValue(fakeModel) };

    vi.mocked(discoverAuthStorage).mockReturnValue(fakeAuthStorage as never);
    vi.mocked(discoverModels).mockReturnValue(fakeRegistry as never);
    vi.mocked(getApiKeyForModel).mockResolvedValue({
      apiKey: "sk-test",
      source: "env",
      mode: "api-key",
    });
    vi.mocked(requireApiKey).mockReturnValue("sk-test");

    return { fakeRegistry };
  }

  async function emitInput(prompt = "hello") {
    await capturedListener?.({
      stream: "input",
      sessionKey: "agent:main:direct",
      data: { prompt },
      runId: "run1",
      seq: 1,
      ts: Date.now(),
    });
  }

  it("does not register listener when sessionLabels.enabled is not set", async () => {
    vi.mocked(loadConfig).mockReturnValue({
      agents: { defaults: {} },
    } as ReturnType<typeof loadConfig>);

    await loadService();

    expect(onAgentEvent).not.toHaveBeenCalled();
  });

  it("skips cron session keys", async () => {
    mockConfigEnabled();

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
    mockConfigEnabled();

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
    mockConfigEnabled();

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
    mockConfigEnabled();
    vi.mocked(resolveStorePath).mockReturnValue("/tmp/sessions.json");
    vi.mocked(loadSessionStore).mockReturnValue({
      "agent:main:direct": {
        sessionId: "abc",
        updatedAt: Date.now(),
        label: "already set",
      },
    });

    await loadService();
    await emitInput();

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("generates and writes a label for a new session", async () => {
    mockConfigEnabled({ maxLength: 79 });
    mockHappyPathDeps();

    vi.mocked(complete).mockResolvedValue({
      content: [{ type: "text", text: "Debug session with greetings" }],
    } as never);
    vi.mocked(updateSessionStoreEntry).mockResolvedValue(null);

    await loadService();
    await emitInput("hey what's up");
    await flush();

    expect(updateSessionStoreEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionKey: "agent:main:direct",
      }),
    );
  });

  it("skips when sessionLabels.model is not provider/model", async () => {
    mockConfigEnabled({ model: "claude-haiku-4-5" });
    mockHappyPathDeps();

    await loadService();
    await emitInput();
    await flush();

    expect(complete).not.toHaveBeenCalled();
    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips when configured model cannot be found", async () => {
    mockConfigEnabled({ model: "anthropic/missing-model" });
    mockHappyPathDeps();
    vi.mocked(discoverModels).mockReturnValue({ find: vi.fn().mockReturnValue(null) } as never);

    await loadService();
    await emitInput();
    await flush();

    expect(complete).not.toHaveBeenCalled();
    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("handles LLM call failure without writing", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();
    vi.mocked(complete).mockRejectedValue(new Error("provider down"));

    await loadService();
    await emitInput();
    await flush();

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips write when LLM returns no text blocks", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();
    vi.mocked(complete).mockResolvedValue({ content: [{ type: "tool_use", name: "x" }] } as never);

    await loadService();
    await emitInput();
    await flush();

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("skips write when LLM returns empty text", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();
    vi.mocked(complete).mockResolvedValue({
      content: [{ type: "text", text: "    " }],
    } as never);

    await loadService();
    await emitInput();
    await flush();

    expect(updateSessionStoreEntry).not.toHaveBeenCalled();
  });

  it("uses custom prompt and maxLength and truncates prompt + label", async () => {
    const maxLength = 12;
    mockConfigEnabled({ prompt: "Custom title prompt", maxLength });
    mockHappyPathDeps();

    vi.mocked(complete).mockResolvedValue({
      content: [{ type: "text", text: "This label is definitely too long" }],
    } as never);

    let writtenLabel = "";
    vi.mocked(updateSessionStoreEntry).mockImplementation(async (params) => {
      const patch = await params.update({
        sessionId: "abc",
        updatedAt: Date.now(),
      } as never);
      writtenLabel = String(patch?.label ?? "");
      return null;
    });

    await loadService();
    await emitInput("x".repeat(700));
    await flush();

    const completionCall = vi.mocked(complete).mock.calls[0];
    expect(completionCall).toBeTruthy();
    const context = completionCall?.[1] as { messages?: Array<{ content?: string }> };
    const text = context.messages?.[0]?.content ?? "";
    expect(text).toContain("Custom title prompt");
    expect(text).toContain(`Max length: ${maxLength} characters.`);
    expect(text).toContain("Conversation:\n");
    expect(text.endsWith("…")).toBe(true);

    expect(writtenLabel).toBe("This label i");
    expect(writtenLabel.length).toBe(maxLength);
  });

  it("deduplicates concurrent input events per session", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();

    let resolveComplete: (() => void) | undefined;
    vi.mocked(complete).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveComplete = () => resolve({ content: [{ type: "text", text: "Hello" }] } as never);
        }) as never,
    );
    vi.mocked(updateSessionStoreEntry).mockResolvedValue(null);

    await loadService();

    await emitInput("first");
    await emitInput("second");
    expect(complete).toHaveBeenCalledTimes(1);

    resolveComplete?.();
    await flush();

    await emitInput("third");
    await flush();
    expect(complete).toHaveBeenCalledTimes(2);
  });

  it("is idempotent when label appears during locked update", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();

    vi.mocked(complete).mockResolvedValue({
      content: [{ type: "text", text: "Will be ignored" }],
    } as never);

    let patchResult: unknown;
    vi.mocked(updateSessionStoreEntry).mockImplementation(async (params) => {
      patchResult = await params.update({
        sessionId: "abc",
        updatedAt: Date.now(),
        label: "set-by-other-writer",
      } as never);
      return null;
    });

    await loadService();
    await emitInput();
    await flush();

    expect(patchResult).toBeNull();
  });

  it("handles missing entry during final store update", async () => {
    mockConfigEnabled();
    mockHappyPathDeps();

    vi.mocked(complete).mockResolvedValue({
      content: [{ type: "text", text: "Race label" }],
    } as never);
    vi.mocked(updateSessionStoreEntry).mockResolvedValue(null);

    await loadService();
    await emitInput();
    await flush();

    expect(updateSessionStoreEntry).toHaveBeenCalledTimes(1);
  });
});

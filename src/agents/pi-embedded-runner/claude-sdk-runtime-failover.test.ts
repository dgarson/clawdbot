import "./run.overflow-compaction.mocks.shared.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { isProfileInCooldown } from "../auth-profiles.js";
import { getApiKeyForModel } from "../model-auth.js";
import { runEmbeddedPiAgent } from "./run.js";
import { runEmbeddedAttempt } from "./run/attempt.js";

const mockedRunEmbeddedAttempt = vi.mocked(runEmbeddedAttempt);
const mockedGetApiKeyForModel = vi.mocked(getApiKeyForModel);
const mockedIsProfileInCooldown = vi.mocked(isProfileInCooldown);

const successfulAttemptResult = {
  aborted: false,
  promptError: null,
  timedOut: false,
  sessionIdUsed: "test-session",
  assistantTexts: ["Response 1"],
  lastAssistant: {
    usage: { input: 10, output: 5, total: 15 },
    stopReason: "end_turn",
  },
  attemptUsage: { input: 10, output: 5, total: 15 },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

const parityConfig = {
  agents: {
    defaults: {
      model: {
        primary: "zai/GLM-4.7",
        fallbacks: ["minimax/MiniMax-M2.5", "openai-codex/gpt-5-codex"],
      },
    },
  },
};

describe("claude-sdk runtime failover parity flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedIsProfileInCooldown.mockReturnValue(false);
  });

  it("keeps claude-sdk runtime while rotating from claude-pro to zai provider (agent-level config)", async () => {
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(successfulAttemptResult);
    mockedIsProfileInCooldown.mockImplementation(
      (_store, profileId) => profileId === "claude-pro:system-keychain",
    );
    mockedGetApiKeyForModel.mockResolvedValueOnce({
      apiKey: "sk-zai",
      profileId: "zai-profile",
      source: "test",
      mode: "api-key",
    });

    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-sdk-rotate",
      provider: "claude-pro",
      config: {
        ...parityConfig,
        agents: {
          ...parityConfig.agents,
          list: [
            {
              id: "main",
              claudeSdk: {
                provider: "zai",
                supportedProviders: ["claude-pro", "zai"],
              },
            },
          ],
        },
      },
    });

    const firstAuthCall = mockedGetApiKeyForModel.mock.calls[0]?.[0];
    expect(firstAuthCall?.model.provider).toBe("zai");
    const firstAttemptCall = mockedRunEmbeddedAttempt.mock.calls[0]?.[0];
    expect(firstAttemptCall?.runtimeOverride).toBe("claude-sdk");
    expect(firstAttemptCall?.claudeSdkProviderOverride).toBe("zai");
  });

  it("falls back from claude-sdk to pi runtime when all claude-sdk providers are unavailable (defaults config)", async () => {
    mockedRunEmbeddedAttempt.mockResolvedValueOnce(successfulAttemptResult);
    mockedGetApiKeyForModel
      .mockRejectedValueOnce(new Error("claude-pro keychain expired"))
      .mockRejectedValueOnce(new Error("zai unavailable"))
      .mockRejectedValueOnce(new Error("minimax unavailable"))
      .mockResolvedValueOnce({
        apiKey: "sk-pi-fallback",
        profileId: "pi-profile",
        source: "test",
        mode: "api-key",
      });

    await runEmbeddedPiAgent({
      sessionId: "test-session",
      sessionKey: "test-key",
      sessionFile: "/tmp/session.json",
      workspaceDir: "/tmp/workspace",
      prompt: "hello",
      timeoutMs: 30000,
      runId: "run-sdk-to-pi",
      provider: "claude-pro",
      config: {
        ...parityConfig,
        agents: {
          ...parityConfig.agents,
          defaults: {
            ...parityConfig.agents.defaults,
            claudeSdk: {
              provider: "zai",
              supportedProviders: ["zai", "minimax"],
            },
          },
        },
      },
    });

    const providerAttempts = mockedGetApiKeyForModel.mock.calls.map(
      (call) => call[0]?.model.provider,
    );
    expect(providerAttempts).toEqual(["claude-pro", "zai", "minimax", "claude-pro"]);

    const firstAttemptCall = mockedRunEmbeddedAttempt.mock.calls[0]?.[0];
    expect(firstAttemptCall?.runtimeOverride).toBe("pi");
    expect(firstAttemptCall?.claudeSdkProviderOverride).toBeUndefined();
    expect(firstAttemptCall?.resolvedProviderAuth?.apiKey).toBe("sk-pi-fallback");
  });
});

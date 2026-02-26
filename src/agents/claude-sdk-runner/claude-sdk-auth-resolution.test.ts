import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  resolveAuthProfileOrder: vi.fn(),
  upsertAuthProfileWithLock: vi.fn(),
  saveAuthProfileStore: vi.fn(),
}));

vi.mock("../model-auth.js", () => ({
  SYSTEM_KEYCHAIN_PROVIDERS: new Set(["claude-pro"]),
  resolveAuthProfileOrder: mocks.resolveAuthProfileOrder,
}));

vi.mock("../auth-profiles.js", () => ({
  upsertAuthProfileWithLock: mocks.upsertAuthProfileWithLock,
  saveAuthProfileStore: mocks.saveAuthProfileStore,
}));

import { createClaudeSdkAuthResolutionState } from "./claude-sdk-auth-resolution.js";

describe("createClaudeSdkAuthResolutionState", () => {
  beforeEach(() => {
    mocks.resolveAuthProfileOrder.mockReset();
    mocks.upsertAuthProfileWithLock.mockReset();
    mocks.saveAuthProfileStore.mockReset();
    mocks.resolveAuthProfileOrder.mockReturnValue([]);
    mocks.upsertAuthProfileWithLock.mockResolvedValue({
      profiles: {
        "claude-pro:system-keychain": {
          type: "token",
          provider: "claude-pro",
          token: "system-keychain",
        },
      },
    });
  });

  it("creates and persists a synthetic keychain profile for claude-pro", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "claude-pro",
      cfg: {},
      claudeSdkConfig: undefined,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.runtimeOverride).toBe("claude-sdk");
    expect(state.authProvider).toBe("claude-pro");
    expect(state.claudeSdkProviderOverride).toBe("claude-sdk");
    expect(state.profileCandidates[0]?.profileId).toBe("claude-pro:system-keychain");
    expect(mocks.upsertAuthProfileWithLock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "claude-pro:system-keychain" }),
    );
  });

  it("keeps runtime unset when provider is outside claudeSdk.supportedProviders", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "anthropic",
      cfg: {},
      claudeSdkConfig: {
        provider: "zai",
        supportedProviders: ["zai"],
      } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.runtimeOverride).toBeUndefined();
    expect(state.authProvider).toBe("anthropic");
    expect(state.claudeSdkProviderOverride).toBeUndefined();
  });

  it("advances claude-sdk providers then falls back to pi runtime", async () => {
    mocks.resolveAuthProfileOrder.mockImplementation(({ provider }: { provider: string }) => {
      if (provider === "zai") {
        return ["zai-profile"];
      }
      return [];
    });

    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "claude-pro",
      cfg: {},
      claudeSdkConfig: {
        provider: "zai",
        supportedProviders: ["zai", "minimax"],
      } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.authProvider).toBe("claude-pro");

    const moved = await state.moveToNextClaudeSdkProvider();
    expect(moved).toBe(true);
    expect(state.runtimeOverride).toBe("claude-sdk");
    expect(state.authProvider).toBe("zai");
    expect(state.claudeSdkProviderOverride).toBe("zai");
    expect(state.profileCandidates[0]?.profileId).toBe("zai-profile");

    const piFallback = await state.fallBackToPiRuntime();
    expect(piFallback).toBe(true);
    expect(state.runtimeOverride).toBe("pi");
    expect(state.authProvider).toBe("claude-pro");
    expect(state.claudeSdkProviderOverride).toBeUndefined();
  });
});

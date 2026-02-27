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

import { createClaudeSdkAuthResolutionState } from "./auth-resolution.js";

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

  it("normalizes provider IDs when deduping supportedProviders", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "Anthropic",
      cfg: {},
      claudeSdkConfig: {
        provider: "claude-sdk",
        supportedProviders: ["Anthropic", "anthropic"],
      } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.runtimeOverride).toBe("claude-sdk");
    expect(state.authProvider).toBe("anthropic");
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

  it("moveToNextClaudeSdkProvider returns false when provider candidates are exhausted", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "claude-pro",
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

    expect(await state.moveToNextClaudeSdkProvider()).toBe(true);
    expect(await state.moveToNextClaudeSdkProvider()).toBe(false);
    expect(state.authProvider).toBe("zai");
  });

  it("advanceProfileIndex increments until exhaustion for unlocked profiles", async () => {
    mocks.resolveAuthProfileOrder.mockReturnValue(["zai:p1", "zai:p2"]);
    const authStore = {
      profiles: {
        "zai:p1": { type: "token", provider: "zai", token: "one" },
        "zai:p2": { type: "token", provider: "zai", token: "two" },
      },
    } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "zai",
      cfg: {},
      claudeSdkConfig: { provider: "zai", supportedProviders: ["zai"] } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.profileIndex).toBe(0);
    state.advanceProfileIndex();
    expect(state.profileIndex).toBe(1);
    state.advanceProfileIndex();
    expect(state.profileIndex).toBe(2);
  });

  it("uses claudeSdk.custom.authProfileId as locked candidate for custom provider", async () => {
    mocks.upsertAuthProfileWithLock.mockResolvedValue({
      profiles: {
        "claude-pro:system-keychain": {
          type: "token",
          provider: "claude-pro",
          token: "system-keychain",
        },
        "custom-profile": {
          type: "token",
          provider: "zai",
          token: "sk-custom",
        },
      },
    });
    const authStore = {
      profiles: {
        "custom-profile": {
          type: "token",
          provider: "zai",
          token: "sk-custom",
        },
      },
    } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "claude-pro",
      cfg: {},
      claudeSdkConfig: {
        provider: "custom",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
        baseUrl: "https://gateway.example/v1",
        supportedProviders: ["claude-pro"],
      } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    const moved = await state.moveToNextClaudeSdkProvider();
    expect(moved).toBe(true);
    expect(state.runtimeOverride).toBe("claude-sdk");
    expect(state.authProvider).toBe("custom");
    expect(state.claudeSdkProviderOverride).toBe("custom");
    expect(state.lockedProfileId).toBe("custom-profile");
    expect(state.profileCandidates).toEqual([
      { profileId: "custom-profile", resolveProfileId: "custom-profile" },
    ]);
  });

  it("does not advanceProfileIndex for a locked profile candidate", async () => {
    const authStore = {
      profiles: {
        "custom-profile": {
          type: "token",
          provider: "zai",
          token: "sk-custom",
        },
      },
    } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "custom",
      cfg: {},
      claudeSdkConfig: {
        provider: "custom",
        authProfileId: "custom-profile",
        anthropicDefaultHaikuModel: "custom-haiku",
        anthropicDefaultSonnetModel: "custom-sonnet",
        anthropicDefaultOpusModel: "custom-opus",
        baseUrl: "https://gateway.example/v1",
      } as never,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.profileIndex).toBe(0);
    state.advanceProfileIndex();
    expect(state.profileIndex).toBe(0);
  });

  it("surfaces synthetic keychain profile creation failure", async () => {
    mocks.upsertAuthProfileWithLock.mockRejectedValueOnce(new Error("lock failed"));
    const authStore = { profiles: {} } as never;

    await expect(
      createClaudeSdkAuthResolutionState({
        provider: "claude-pro",
        cfg: {},
        claudeSdkConfig: undefined,
        authStore,
        agentDir: "/tmp/agent",
        preferredProfileId: undefined,
        authProfileIdSource: undefined,
      }),
    ).rejects.toThrow("lock failed");
  });
});

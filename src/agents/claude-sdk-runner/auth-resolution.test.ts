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
    expect(state.profileCandidates[0]?.profileId).toBe("claude-pro:system-keychain");
    expect(mocks.upsertAuthProfileWithLock).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "claude-pro:system-keychain" }),
    );
  });

  it("keeps runtime unset for non-system-keychain providers", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "anthropic",
      cfg: {},
      claudeSdkConfig: undefined,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.runtimeOverride).toBeUndefined();
    expect(state.authProvider).toBe("anthropic");
  });

  it("moveToNextClaudeSdkProvider always returns false (single system-keychain candidate)", async () => {
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

    expect(await state.moveToNextClaudeSdkProvider()).toBe(false);
  });

  it("fallBackToPiRuntime switches runtime to pi and restores original provider", async () => {
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
    const fell = await state.fallBackToPiRuntime();
    expect(fell).toBe(true);
    expect(state.runtimeOverride).toBe("pi");
    expect(state.authProvider).toBe("claude-pro");
  });

  it("fallBackToPiRuntime returns false when runtime is not claude-sdk", async () => {
    const authStore = { profiles: {} } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "anthropic",
      cfg: {},
      claudeSdkConfig: undefined,
      authStore,
      agentDir: "/tmp/agent",
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
    });

    expect(state.runtimeOverride).toBeUndefined();
    expect(await state.fallBackToPiRuntime()).toBe(false);
  });

  it("advanceProfileIndex increments for unlocked profiles", async () => {
    mocks.resolveAuthProfileOrder.mockReturnValue(["claude-pro:p1", "claude-pro:p2"]);
    const authStore = {
      profiles: {
        "claude-pro:p1": { type: "token", provider: "claude-pro", token: "one" },
        "claude-pro:p2": { type: "token", provider: "claude-pro", token: "two" },
      },
    } as never;
    const state = await createClaudeSdkAuthResolutionState({
      provider: "claude-pro",
      cfg: {},
      claudeSdkConfig: undefined,
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

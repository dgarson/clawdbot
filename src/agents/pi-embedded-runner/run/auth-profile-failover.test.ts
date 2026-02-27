import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthProfileCandidate } from "../../claude-sdk-runner/auth-resolution.js";
import { FailoverError } from "../../failover-error.js";
import { createRunAuthProfileFailoverController } from "./auth-profile-failover.js";

const mocks = vi.hoisted(() => ({
  createClaudeSdkAuthResolutionState: vi.fn(),
  getApiKeyForModel: vi.fn(),
  isProfileInCooldown: vi.fn(),
  resolveProfilesUnavailableReason: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../../claude-sdk-runner/auth-resolution.js", () => ({
  createClaudeSdkAuthResolutionState: mocks.createClaudeSdkAuthResolutionState,
}));

vi.mock("../../model-auth.js", () => ({
  getApiKeyForModel: mocks.getApiKeyForModel,
}));

vi.mock("../../auth-profiles.js", () => ({
  isProfileInCooldown: mocks.isProfileInCooldown,
  resolveProfilesUnavailableReason: mocks.resolveProfilesUnavailableReason,
}));

vi.mock("../logger.js", () => ({
  log: {
    warn: mocks.logWarn,
  },
}));

type MutableResolutionState = {
  runtimeOverride: "claude-sdk" | "pi" | undefined;
  authProvider: string;
  claudeSdkProviderOverride?: string;
  lockedProfileId?: string;
  profileCandidates: AuthProfileCandidate[];
  profileIndex: number;
  advanceProfileIndex: () => void;
  moveToNextClaudeSdkProvider: () => Promise<boolean>;
  fallBackToPiRuntime: () => Promise<boolean>;
};

function makeResolutionState(params: {
  runtimeOverride: "claude-sdk" | "pi" | undefined;
  authProvider: string;
  profileCandidates: AuthProfileCandidate[];
  lockedProfileId?: string;
}): MutableResolutionState {
  const state: MutableResolutionState = {
    runtimeOverride: params.runtimeOverride,
    authProvider: params.authProvider,
    claudeSdkProviderOverride:
      params.runtimeOverride === "claude-sdk" ? params.authProvider : undefined,
    lockedProfileId: params.lockedProfileId,
    profileCandidates: [...params.profileCandidates],
    profileIndex: 0,
    advanceProfileIndex() {
      if (state.lockedProfileId) {
        return;
      }
      state.profileIndex += 1;
    },
    async moveToNextClaudeSdkProvider() {
      return false;
    },
    async fallBackToPiRuntime() {
      return false;
    },
  };
  return state;
}

function resolvedAuth(profileId: string, apiKey: string) {
  return {
    apiKey,
    profileId,
    source: `profile:${profileId}`,
    mode: "api-key" as const,
  };
}

function baseParams(
  overrides?: Partial<Parameters<typeof createRunAuthProfileFailoverController>[0]>,
) {
  const authStorage = {
    setRuntimeApiKey: vi.fn(),
  };
  return {
    params: {
      provider: "anthropic",
      modelId: "claude-sonnet-4-6",
      model: { provider: "anthropic" } as never,
      cfg: {},
      agentDir: "/tmp/agent",
      authStore: { profiles: {}, usageStats: {} } as never,
      authStorage: authStorage as never,
      fallbackConfigured: true,
      claudeSdkConfig: undefined,
      preferredProfileId: undefined,
      authProfileIdSource: undefined,
      ...overrides,
    },
    authStorage,
  };
}

describe("createRunAuthProfileFailoverController", () => {
  beforeEach(() => {
    mocks.createClaudeSdkAuthResolutionState.mockReset();
    mocks.getApiKeyForModel.mockReset();
    mocks.isProfileInCooldown.mockReset();
    mocks.resolveProfilesUnavailableReason.mockReset();
    mocks.logWarn.mockReset();
    mocks.isProfileInCooldown.mockReturnValue(false);
    mocks.resolveProfilesUnavailableReason.mockReturnValue("rate_limit");
  });

  it("initializes successfully from the first profile candidate", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      profileCandidates: [{ profileId: "anthropic:p1", resolveProfileId: "anthropic:p1" }],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel.mockResolvedValue(resolvedAuth("anthropic:p1", "sk-first"));
    const { params, authStorage } = baseParams();

    const controller = await createRunAuthProfileFailoverController(params);

    expect(authStorage.setRuntimeApiKey).toHaveBeenCalledWith("anthropic", "sk-first");
    expect(controller.lastProfileId).toBe("anthropic:p1");
    expect(mocks.getApiKeyForModel).toHaveBeenCalledWith(
      expect.objectContaining({ profileId: "anthropic:p1" }),
    );
  });

  it("rotates to the next profile when the current one fails", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      profileCandidates: [
        { profileId: "anthropic:p1", resolveProfileId: "anthropic:p1" },
        { profileId: "anthropic:p2", resolveProfileId: "anthropic:p2" },
        { profileId: "anthropic:p3", resolveProfileId: "anthropic:p3" },
      ],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel
      .mockResolvedValueOnce(resolvedAuth("anthropic:p1", "sk-one"))
      .mockRejectedValueOnce(new Error("profile p2 misconfigured"))
      .mockResolvedValueOnce(resolvedAuth("anthropic:p3", "sk-three"));
    const onAuthRotationSuccess = vi.fn();
    const { params, authStorage } = baseParams({ onAuthRotationSuccess });
    const controller = await createRunAuthProfileFailoverController(params);

    const rotated = await controller.advanceAuthProfile();

    expect(rotated).toBe(true);
    expect(onAuthRotationSuccess).toHaveBeenCalledTimes(1);
    expect(authStorage.setRuntimeApiKey).toHaveBeenNthCalledWith(1, "anthropic", "sk-one");
    expect(authStorage.setRuntimeApiKey).toHaveBeenNthCalledWith(2, "anthropic", "sk-three");
    expect(controller.lastProfileId).toBe("anthropic:p3");
  });

  it("fails over Claude SDK provider exhaustion to Pi runtime", async () => {
    const state = makeResolutionState({
      runtimeOverride: "claude-sdk",
      authProvider: "claude-pro",
      profileCandidates: [{ profileId: "claude-pro:system-keychain", resolveProfileId: undefined }],
    });
    state.moveToNextClaudeSdkProvider = vi
      .fn()
      .mockImplementationOnce(async () => {
        state.authProvider = "zai";
        state.claudeSdkProviderOverride = "zai";
        state.profileCandidates = [{ profileId: "zai:p1", resolveProfileId: "zai:p1" }];
        state.profileIndex = 0;
        return true;
      })
      .mockImplementationOnce(async () => false);
    state.fallBackToPiRuntime = vi.fn(async () => {
      state.runtimeOverride = "pi";
      state.authProvider = "claude-pro";
      state.claudeSdkProviderOverride = undefined;
      state.profileCandidates = [{ profileId: "claude-pro:pi", resolveProfileId: "claude-pro:pi" }];
      state.profileIndex = 0;
      return true;
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel
      .mockResolvedValueOnce({
        apiKey: undefined,
        source: "Claude Subscription (system keychain)",
        mode: "system-keychain",
      })
      .mockRejectedValueOnce(new Error("zai auth profile failed"))
      .mockResolvedValueOnce(resolvedAuth("claude-pro:pi", "sk-pi-fallback"));
    const onAuthRotationSuccess = vi.fn();
    const onClaudeSdkToPiFallback = vi.fn();
    const { params, authStorage } = baseParams({
      provider: "claude-pro",
      model: { provider: "claude-pro" } as never,
      onAuthRotationSuccess,
      onClaudeSdkToPiFallback,
    });
    const controller = await createRunAuthProfileFailoverController(params);

    const rotated = await controller.advanceAuthProfile();

    expect(rotated).toBe(true);
    expect(onClaudeSdkToPiFallback).toHaveBeenCalledTimes(1);
    expect(onAuthRotationSuccess).toHaveBeenCalledTimes(1);
    expect(controller.authResolution.runtimeOverride).toBe("pi");
    expect(controller.lastProfileId).toBe("claude-pro:pi");
    expect(authStorage.setRuntimeApiKey).toHaveBeenLastCalledWith("claude-pro", "sk-pi-fallback");
  });

  it("throws cooldown failover when every candidate is unavailable due to cooldown", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      profileCandidates: [
        { profileId: "anthropic:p1", resolveProfileId: "anthropic:p1" },
        { profileId: "anthropic:p2", resolveProfileId: "anthropic:p2" },
      ],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.isProfileInCooldown.mockReturnValue(true);
    const { params } = baseParams();

    await expect(createRunAuthProfileFailoverController(params)).rejects.toMatchObject({
      name: "FailoverError",
      reason: "rate_limit",
    });
  });

  it("surfaces the latest real resolution error instead of cooldown-only messaging", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      profileCandidates: [
        { profileId: "anthropic:p1", resolveProfileId: "anthropic:p1" },
        { profileId: "anthropic:p2", resolveProfileId: "anthropic:p2" },
      ],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel
      .mockRejectedValueOnce(new Error("profile p1 missing token"))
      .mockRejectedValueOnce(new Error("401 invalid key for profile p2"));
    const { params } = baseParams();

    await expect(createRunAuthProfileFailoverController(params)).rejects.toMatchObject({
      name: "FailoverError",
      reason: "auth",
      message: "401 invalid key for profile p2",
    });
  });

  it("warns when Pi fallback succeeds but still cannot initialize a profile", async () => {
    const state = makeResolutionState({
      runtimeOverride: "claude-sdk",
      authProvider: "claude-pro",
      profileCandidates: [{ profileId: "claude-pro:system-keychain", resolveProfileId: undefined }],
    });
    state.moveToNextClaudeSdkProvider = vi.fn(async () => false);
    state.fallBackToPiRuntime = vi.fn(async () => {
      state.runtimeOverride = "pi";
      state.authProvider = "claude-pro";
      state.claudeSdkProviderOverride = undefined;
      state.profileCandidates = [];
      state.profileIndex = 0;
      return true;
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel.mockResolvedValue({
      apiKey: undefined,
      source: "Claude Subscription (system keychain)",
      mode: "system-keychain",
    });
    const onClaudeSdkToPiFallback = vi.fn();
    const { params } = baseParams({
      provider: "claude-pro",
      model: { provider: "claude-pro" } as never,
      fallbackConfigured: false,
      onClaudeSdkToPiFallback,
    });
    const controller = await createRunAuthProfileFailoverController(params);

    const rotated = await controller.advanceAuthProfile();

    expect(rotated).toBe(false);
    expect(onClaudeSdkToPiFallback).toHaveBeenCalledTimes(1);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      expect.stringContaining("switched from Claude SDK to Pi runtime"),
    );
  });

  it("returns false when Claude SDK provider exhaustion cannot fall back to Pi runtime", async () => {
    const state = makeResolutionState({
      runtimeOverride: "claude-sdk",
      authProvider: "claude-pro",
      profileCandidates: [{ profileId: "claude-pro:system-keychain", resolveProfileId: undefined }],
    });
    state.moveToNextClaudeSdkProvider = vi.fn(async () => false);
    state.fallBackToPiRuntime = vi.fn(async () => false);
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel.mockResolvedValue({
      apiKey: undefined,
      source: "Claude Subscription (system keychain)",
      mode: "system-keychain",
    });
    const onClaudeSdkToPiFallback = vi.fn();
    const { params } = baseParams({
      provider: "claude-pro",
      model: { provider: "claude-pro" } as never,
      fallbackConfigured: false,
      onClaudeSdkToPiFallback,
    });
    const controller = await createRunAuthProfileFailoverController(params);

    const rotated = await controller.advanceAuthProfile();

    expect(rotated).toBe(false);
    expect(onClaudeSdkToPiFallback).not.toHaveBeenCalled();
  });

  it("throws through locked-profile initialization errors without advancing", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      lockedProfileId: "anthropic:locked",
      profileCandidates: [{ profileId: "anthropic:locked", resolveProfileId: "anthropic:locked" }],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel.mockRejectedValue(new Error("locked profile invalid"));
    const { params } = baseParams({ fallbackConfigured: false });

    await expect(createRunAuthProfileFailoverController(params)).rejects.toThrow(
      "locked profile invalid",
    );
    expect(state.profileIndex).toBe(0);
  });

  it("keeps FailoverError shape when fallbackConfigured is enabled", async () => {
    const state = makeResolutionState({
      runtimeOverride: "pi",
      authProvider: "anthropic",
      profileCandidates: [{ profileId: "anthropic:p1", resolveProfileId: "anthropic:p1" }],
    });
    mocks.createClaudeSdkAuthResolutionState.mockResolvedValue(state);
    mocks.getApiKeyForModel.mockRejectedValue(new Error("authentication error"));
    const { params } = baseParams({ fallbackConfigured: true });

    await expect(createRunAuthProfileFailoverController(params)).rejects.toBeInstanceOf(
      FailoverError,
    );
  });
});

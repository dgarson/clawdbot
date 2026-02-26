import type { OpenClawConfig } from "../../config/config.js";
import type { ClaudeSdkConfig } from "../../config/zod-schema.agent-runtime.js";
import {
  saveAuthProfileStore,
  upsertAuthProfileWithLock,
  type AuthProfileStore,
} from "../auth-profiles.js";
import { resolveAuthProfileOrder, SYSTEM_KEYCHAIN_PROVIDERS } from "../model-auth.js";
import { normalizeProviderId } from "../model-selection.js";

export type AuthProfileCandidate = {
  profileId?: string;
  resolveProfileId?: string;
};

const SYNTHETIC_SYSTEM_KEYCHAIN_PROFILE_SUFFIX = "system-keychain";

type AuthResolutionRuntime = "pi" | "claude-sdk" | undefined;

function dedupeProviders(providerIds: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const providerId of providerIds) {
    if (typeof providerId !== "string") {
      continue;
    }
    const trimmed = providerId.trim();
    if (!trimmed) {
      continue;
    }
    const normalized = normalizeProviderId(trimmed);
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    deduped.push(trimmed);
  }
  return deduped;
}

function resolveSupportedProviders(claudeSdkConfig: ClaudeSdkConfig | undefined): string[] {
  const configured = dedupeProviders(claudeSdkConfig?.supportedProviders ?? []);
  if (configured.length > 0) {
    return configured;
  }
  return dedupeProviders([...SYSTEM_KEYCHAIN_PROVIDERS]);
}

async function ensureSyntheticSystemKeychainProfile(
  authStore: AuthProfileStore,
  providerId: string,
  agentDir: string | undefined,
): Promise<string> {
  const syntheticProfileId = `${providerId}:${SYNTHETIC_SYSTEM_KEYCHAIN_PROFILE_SUFFIX}`;
  const credential = {
    type: "token" as const,
    provider: providerId,
    token: SYNTHETIC_SYSTEM_KEYCHAIN_PROFILE_SUFFIX,
  };
  if (!authStore.profiles[syntheticProfileId]) {
    authStore.profiles[syntheticProfileId] = credential;
  }
  const lockedStore = await upsertAuthProfileWithLock({
    profileId: syntheticProfileId,
    credential,
    agentDir,
  });
  if (lockedStore?.profiles) {
    authStore.profiles = lockedStore.profiles;
  } else {
    // Best-effort fallback when lock write fails unexpectedly.
    saveAuthProfileStore(authStore, agentDir);
  }
  return syntheticProfileId;
}

async function buildProfileCandidatesForProvider(params: {
  providerId: string;
  authStore: AuthProfileStore;
  cfg: OpenClawConfig | undefined;
  claudeSdkConfig: ClaudeSdkConfig | undefined;
  preferredProfileId: string | undefined;
  authProfileIdSource: string | undefined;
  agentDir: string | undefined;
}): Promise<{ lockedProfileId?: string; candidates: AuthProfileCandidate[] }> {
  const { providerId, authStore, cfg, claudeSdkConfig, preferredProfileId, authProfileIdSource } =
    params;
  if (providerId === "custom" && claudeSdkConfig?.provider === "custom") {
    const customProfileId = claudeSdkConfig.authProfileId.trim();
    if (!authStore.profiles[customProfileId]) {
      throw new Error(
        `Auth profile "${customProfileId}" (claudeSdk.custom.authProfileId) is not configured.`,
      );
    }
    return {
      lockedProfileId: customProfileId,
      candidates: [{ profileId: customProfileId, resolveProfileId: customProfileId }],
    };
  }

  let lockedProfileId = authProfileIdSource === "user" ? preferredProfileId : undefined;
  if (lockedProfileId) {
    const lockedProfile = authStore.profiles[lockedProfileId];
    if (
      !lockedProfile ||
      normalizeProviderId(lockedProfile.provider) !== normalizeProviderId(providerId)
    ) {
      lockedProfileId = undefined;
    }
  }

  const profileOrder = resolveAuthProfileOrder({
    cfg,
    store: authStore,
    provider: providerId,
    preferredProfile: preferredProfileId,
  });

  if (lockedProfileId && !profileOrder.includes(lockedProfileId)) {
    throw new Error(`Auth profile "${lockedProfileId}" is not configured for ${providerId}.`);
  }

  if (lockedProfileId) {
    return {
      lockedProfileId,
      candidates: [{ profileId: lockedProfileId, resolveProfileId: lockedProfileId }],
    };
  }

  if (profileOrder.length > 0) {
    return {
      candidates: profileOrder.map((profileId) => ({
        profileId,
        resolveProfileId: profileId,
      })),
    };
  }

  if (SYSTEM_KEYCHAIN_PROVIDERS.has(providerId)) {
    const syntheticProfileId = await ensureSyntheticSystemKeychainProfile(
      authStore,
      providerId,
      params.agentDir,
    );
    return {
      candidates: [{ profileId: syntheticProfileId, resolveProfileId: undefined }],
    };
  }

  return {
    candidates: [{ profileId: undefined, resolveProfileId: undefined }],
  };
}

function resolveClaudeSdkProviderCandidates(params: {
  provider: string;
  claudeSdkConfig: ClaudeSdkConfig | undefined;
}): string[] {
  const supportedProviders = resolveSupportedProviders(params.claudeSdkConfig);
  const normalizedProvider = normalizeProviderId(params.provider);
  const supportedSet = new Set(supportedProviders.map((entry) => normalizeProviderId(entry)));
  const providerIsSystemKeychain = SYSTEM_KEYCHAIN_PROVIDERS.has(params.provider);
  const providerIsSupported = supportedSet.has(normalizedProvider);
  if (!providerIsSystemKeychain && !providerIsSupported) {
    return [];
  }
  const configuredPrimaryProvider =
    params.claudeSdkConfig && params.claudeSdkConfig.provider !== "claude-sdk"
      ? params.claudeSdkConfig.provider
      : undefined;
  const orderedProviders = providerIsSystemKeychain
    ? [params.provider, configuredPrimaryProvider, ...supportedProviders]
    : [configuredPrimaryProvider, params.provider, ...supportedProviders];
  return dedupeProviders(orderedProviders);
}

function resolveClaudeSdkProviderOverride(
  runtimeOverride: AuthResolutionRuntime,
  providerId: string,
): string | undefined {
  if (runtimeOverride !== "claude-sdk") {
    return undefined;
  }
  if (SYSTEM_KEYCHAIN_PROVIDERS.has(providerId)) {
    return "claude-sdk";
  }
  return providerId;
}

export type ClaudeSdkAuthResolutionState = {
  readonly runtimeOverride: AuthResolutionRuntime;
  readonly authProvider: string;
  readonly claudeSdkProviderOverride?: string;
  readonly lockedProfileId?: string;
  readonly profileCandidates: AuthProfileCandidate[];
  readonly profileIndex: number;
  advanceProfileIndex: () => void;
  moveToNextClaudeSdkProvider: () => Promise<boolean>;
  fallBackToPiRuntime: () => Promise<boolean>;
};

export async function createClaudeSdkAuthResolutionState(params: {
  provider: string;
  cfg: OpenClawConfig | undefined;
  claudeSdkConfig: ClaudeSdkConfig | undefined;
  authStore: AuthProfileStore;
  agentDir: string | undefined;
  preferredProfileId: string | undefined;
  authProfileIdSource: string | undefined;
}): Promise<ClaudeSdkAuthResolutionState> {
  const claudeSdkProviderCandidates = resolveClaudeSdkProviderCandidates({
    provider: params.provider,
    claudeSdkConfig: params.claudeSdkConfig,
  });

  let claudeSdkProviderIndex = claudeSdkProviderCandidates.length > 0 ? 0 : -1;
  let runtimeOverride: AuthResolutionRuntime =
    claudeSdkProviderIndex >= 0 ? "claude-sdk" : undefined;
  let authProvider = claudeSdkProviderIndex >= 0 ? claudeSdkProviderCandidates[0] : params.provider;
  let claudeSdkProviderOverride = resolveClaudeSdkProviderOverride(runtimeOverride, authProvider);
  let lockedProfileId: string | undefined;
  let profileCandidates: AuthProfileCandidate[] = [];
  let profileIndex = 0;

  const setActiveAuthProvider = async (
    providerId: string,
    nextRuntime: AuthResolutionRuntime,
  ): Promise<void> => {
    runtimeOverride = nextRuntime;
    authProvider = providerId;
    claudeSdkProviderOverride = resolveClaudeSdkProviderOverride(runtimeOverride, providerId);
    const profileContext = await buildProfileCandidatesForProvider({
      providerId,
      authStore: params.authStore,
      cfg: params.cfg,
      claudeSdkConfig: params.claudeSdkConfig,
      agentDir: params.agentDir,
      preferredProfileId: params.preferredProfileId,
      authProfileIdSource: params.authProfileIdSource,
    });
    lockedProfileId = profileContext.lockedProfileId;
    profileCandidates = profileContext.candidates;
    profileIndex = 0;
  };

  await setActiveAuthProvider(authProvider, runtimeOverride);

  return {
    get runtimeOverride() {
      return runtimeOverride;
    },
    get authProvider() {
      return authProvider;
    },
    get claudeSdkProviderOverride() {
      return claudeSdkProviderOverride;
    },
    get lockedProfileId() {
      return lockedProfileId;
    },
    get profileCandidates() {
      return profileCandidates;
    },
    get profileIndex() {
      return profileIndex;
    },
    advanceProfileIndex() {
      if (lockedProfileId) {
        return;
      }
      profileIndex += 1;
    },
    async moveToNextClaudeSdkProvider() {
      if (claudeSdkProviderIndex < 0) {
        return false;
      }
      const nextIndex = claudeSdkProviderIndex + 1;
      if (nextIndex >= claudeSdkProviderCandidates.length) {
        return false;
      }
      claudeSdkProviderIndex = nextIndex;
      await setActiveAuthProvider(claudeSdkProviderCandidates[nextIndex], "claude-sdk");
      return true;
    },
    async fallBackToPiRuntime() {
      if (runtimeOverride !== "claude-sdk") {
        return false;
      }
      claudeSdkProviderIndex = -1;
      await setActiveAuthProvider(params.provider, "pi");
      return true;
    },
  };
}

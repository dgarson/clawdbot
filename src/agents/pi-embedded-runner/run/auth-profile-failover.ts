import type { Api, Model } from "@mariozechner/pi-ai";
import type { OpenClawConfig } from "../../../config/config.js";
import type { ClaudeSdkConfig } from "../../../config/zod-schema.agent-runtime.js";
import type { AuthProfileStore } from "../../auth-profiles.js";
import { isProfileInCooldown, resolveProfilesUnavailableReason } from "../../auth-profiles.js";
import {
  createClaudeSdkAuthResolutionState,
  type ClaudeSdkAuthResolutionState,
  type AuthProfileCandidate,
} from "../../claude-sdk-runner/auth-resolution.js";
import { FailoverError, resolveFailoverStatus } from "../../failover-error.js";
import { getApiKeyForModel, type ResolvedProviderAuth } from "../../model-auth.js";
import { classifyFailoverReason, type FailoverReason } from "../../pi-embedded-helpers.js";
import type { AuthStorage } from "../../pi-model-discovery.js";
import { describeUnknownError } from "../utils.js";

type CreateRunAuthProfileFailoverControllerParams = {
  provider: string;
  modelId: string;
  model: Model<Api>;
  cfg: OpenClawConfig | undefined;
  agentDir: string | undefined;
  authStore: AuthProfileStore;
  authStorage: AuthStorage;
  fallbackConfigured: boolean;
  claudeSdkConfig: ClaudeSdkConfig | undefined;
  preferredProfileId: string | undefined;
  authProfileIdSource: "auto" | "user" | undefined;
  onAuthRotationSuccess?: () => void;
  onClaudeSdkToPiFallback?: () => void;
};

export type RunAuthProfileFailoverController = {
  readonly authResolution: ClaudeSdkAuthResolutionState;
  readonly apiKeyInfo: ResolvedProviderAuth | null;
  readonly lastProfileId: string | undefined;
  resolveAuthLookupModel: () => Model<Api>;
  advanceAuthProfile: () => Promise<boolean>;
};

export async function createRunAuthProfileFailoverController(
  params: CreateRunAuthProfileFailoverControllerParams,
): Promise<RunAuthProfileFailoverController> {
  const authResolution = await createClaudeSdkAuthResolutionState({
    provider: params.provider,
    cfg: params.cfg,
    claudeSdkConfig: params.claudeSdkConfig,
    authStore: params.authStore,
    agentDir: params.agentDir,
    preferredProfileId: params.preferredProfileId,
    authProfileIdSource: params.authProfileIdSource,
  });

  let apiKeyInfo: ResolvedProviderAuth | null = null;
  let lastProfileId: string | undefined;

  const resolveAuthLookupModel = () =>
    authResolution.authProvider === params.model.provider
      ? params.model
      : { ...params.model, provider: authResolution.authProvider };

  const resolveAuthProfileFailoverReason = (args: {
    allInCooldown: boolean;
    message: string;
    profileIds?: Array<string | undefined>;
  }): FailoverReason => {
    if (args.allInCooldown) {
      const profileIds = (
        args.profileIds ?? authResolution.profileCandidates.map((candidate) => candidate.profileId)
      ).filter((id): id is string => typeof id === "string" && id.length > 0);
      if (profileIds.length === 0) {
        const classified = classifyFailoverReason(args.message);
        return classified ?? "auth";
      }
      return (
        resolveProfilesUnavailableReason({
          store: params.authStore,
          profileIds,
        }) ?? "rate_limit"
      );
    }
    const classified = classifyFailoverReason(args.message);
    return classified ?? "auth";
  };

  const throwAuthProfileFailover = (args: {
    allInCooldown: boolean;
    message?: string;
    error?: unknown;
  }): never => {
    const fallbackMessage = `No available auth profile for ${authResolution.authProvider} (all in cooldown or unavailable).`;
    const message =
      args.message?.trim() ||
      (args.error ? describeUnknownError(args.error).trim() : "") ||
      fallbackMessage;
    const reason = resolveAuthProfileFailoverReason({
      allInCooldown: args.allInCooldown,
      message,
      profileIds: authResolution.profileCandidates.map((candidate) => candidate.profileId),
    });
    if (params.fallbackConfigured) {
      throw new FailoverError(message, {
        reason,
        provider: authResolution.authProvider,
        model: params.modelId,
        status: resolveFailoverStatus(reason),
        cause: args.error,
      });
    }
    if (args.error instanceof Error) {
      throw args.error;
    }
    throw new Error(message);
  };

  const resolveApiKeyForCandidate = async (candidate?: AuthProfileCandidate) => {
    return getApiKeyForModel({
      model: resolveAuthLookupModel(),
      cfg: params.cfg,
      profileId: candidate?.resolveProfileId,
      store: params.authStore,
      agentDir: params.agentDir,
    });
  };

  const applyApiKeyInfo = async (candidate?: AuthProfileCandidate): Promise<void> => {
    apiKeyInfo = await resolveApiKeyForCandidate(candidate);
    const resolvedProfileId =
      apiKeyInfo.profileId ?? candidate?.profileId ?? candidate?.resolveProfileId;
    if (!apiKeyInfo.apiKey) {
      if (apiKeyInfo.mode !== "aws-sdk" && apiKeyInfo.mode !== "system-keychain") {
        throw new Error(
          `No API key resolved for provider "${authResolution.authProvider}" (auth mode: ${apiKeyInfo.mode}).`,
        );
      }
      lastProfileId = resolvedProfileId;
      return;
    }
    if (authResolution.authProvider === "github-copilot") {
      const { resolveCopilotApiToken } = await import("../../../providers/github-copilot-token.js");
      const copilotToken = await resolveCopilotApiToken({
        githubToken: apiKeyInfo.apiKey,
      });
      params.authStorage.setRuntimeApiKey(authResolution.authProvider, copilotToken.token);
    } else {
      params.authStorage.setRuntimeApiKey(authResolution.authProvider, apiKeyInfo.apiKey);
    }
    lastProfileId = apiKeyInfo.profileId ?? candidate?.profileId;
  };

  const initializeCurrentAuthCandidate = async (): Promise<boolean> => {
    while (authResolution.profileIndex < authResolution.profileCandidates.length) {
      const candidate = authResolution.profileCandidates[authResolution.profileIndex];
      const candidateProfileId = candidate?.profileId;
      if (
        candidateProfileId &&
        candidateProfileId !== authResolution.lockedProfileId &&
        isProfileInCooldown(params.authStore, candidateProfileId)
      ) {
        authResolution.advanceProfileIndex();
        continue;
      }
      try {
        await applyApiKeyInfo(candidate);
        return true;
      } catch (error) {
        if (candidateProfileId && candidateProfileId === authResolution.lockedProfileId) {
          throw error;
        }
        authResolution.advanceProfileIndex();
      }
    }
    return false;
  };

  const advanceAuthProfile = async (): Promise<boolean> => {
    // User-pinned profiles are locked and should never rotate within the run loop.
    if (authResolution.lockedProfileId) {
      return false;
    }
    authResolution.advanceProfileIndex();
    if (await initializeCurrentAuthCandidate()) {
      params.onAuthRotationSuccess?.();
      return true;
    }
    while (authResolution.runtimeOverride === "claude-sdk") {
      if (await authResolution.moveToNextClaudeSdkProvider()) {
        if (await initializeCurrentAuthCandidate()) {
          params.onAuthRotationSuccess?.();
          return true;
        }
        continue;
      }
      if (await authResolution.fallBackToPiRuntime()) {
        params.onClaudeSdkToPiFallback?.();
        if (await initializeCurrentAuthCandidate()) {
          params.onAuthRotationSuccess?.();
          return true;
        }
      }
      break;
    }
    return false;
  };

  try {
    let initialized = await initializeCurrentAuthCandidate();
    while (!initialized && authResolution.runtimeOverride === "claude-sdk") {
      if (await authResolution.moveToNextClaudeSdkProvider()) {
        initialized = await initializeCurrentAuthCandidate();
        continue;
      }
      if (await authResolution.fallBackToPiRuntime()) {
        params.onClaudeSdkToPiFallback?.();
        initialized = await initializeCurrentAuthCandidate();
        break;
      }
      break;
    }
    if (!initialized) {
      throwAuthProfileFailover({ allInCooldown: true });
    }
  } catch (error) {
    if (error instanceof FailoverError) {
      throw error;
    }
    const activeCandidateProfileId =
      authResolution.profileCandidates[authResolution.profileIndex]?.profileId;
    if (activeCandidateProfileId && activeCandidateProfileId === authResolution.lockedProfileId) {
      throwAuthProfileFailover({ allInCooldown: false, error });
    }
    const advanced = await advanceAuthProfile();
    if (!advanced) {
      throwAuthProfileFailover({ allInCooldown: false, error });
    }
  }

  return {
    get authResolution() {
      return authResolution;
    },
    get apiKeyInfo() {
      return apiKeyInfo;
    },
    get lastProfileId() {
      return lastProfileId;
    },
    resolveAuthLookupModel,
    advanceAuthProfile,
  };
}

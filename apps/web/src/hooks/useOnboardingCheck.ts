/**
 * Hook to check if the user has completed onboarding.
 *
 * Checks multiple criteria to determine onboarded status:
 * 1. localStorage flag for onboarding completion
 * 2. At least one model provider API key configured
 * 3. wizard.onboarding.completedAt in config (if implemented)
 */

import { useConfig } from "./queries/useConfig";

/** LocalStorage key for onboarding completion flag */
export const ONBOARDING_COMPLETE_KEY = "clawdbrain:onboarding:completed";

/** LocalStorage key for timestamp when onboarding was completed */
export const ONBOARDING_COMPLETED_AT_KEY = "clawdbrain:onboarding:completedAt";

/**
 * Check if localStorage flag indicates onboarding is complete.
 */
function checkLocalStorageOnboarded(): boolean {
  if (typeof window === "undefined") {return false;}
  return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
}

/**
 * Mark onboarding as complete in localStorage.
 */
export function markOnboardingComplete(): void {
  if (typeof window === "undefined") {return;}
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
  localStorage.setItem(ONBOARDING_COMPLETED_AT_KEY, new Date().toISOString());
}

/**
 * Clear onboarding completion status (for testing/reset).
 */
export function resetOnboardingStatus(): void {
  if (typeof window === "undefined") {return;}
  localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  localStorage.removeItem(ONBOARDING_COMPLETED_AT_KEY);
}

export interface UseOnboardingCheckResult {
  /** Whether the user has completed onboarding */
  isOnboarded: boolean;
  /** Whether we're still loading the check */
  isLoading: boolean;
  /** Any error that occurred during the check */
  error: Error | null;
  /** Force refresh the onboarding status */
  refetch: () => void;
}

/**
 * Hook to check if onboarding has been completed.
 *
 * Considers the user onboarded if ANY of the following are true:
 * - localStorage has the completion flag set
 * - At least one model provider has an API key configured
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnboarded, isLoading } = useOnboardingCheck();
 *
 *   if (isLoading) return <Spinner />;
 *   if (!isOnboarded) return <Redirect to="/onboarding" />;
 *
 *   return <App />;
 * }
 * ```
 */
export function useOnboardingCheck(): UseOnboardingCheckResult {
  const { data: configSnapshot, isLoading, error, refetch } = useConfig();

  // Check localStorage first (synchronous, fast)
  const localStorageOnboarded = checkLocalStorageOnboarded();

  // If localStorage says onboarded, we're done (no need to wait for config)
  if (localStorageOnboarded) {
    return {
      isOnboarded: true,
      isLoading: false,
      error: null,
      refetch,
    };
  }

  // If still loading config, wait
  if (isLoading) {
    return {
      isOnboarded: false,
      isLoading: true,
      error: null,
      refetch,
    };
  }

  // Check if any model provider has an API key configured
  const hasModelProvider = checkHasModelProvider(configSnapshot?.config?.auth);

  // Check wizard completion timestamp in config (if available)
  const hasWizardCompletion = checkWizardCompletion(configSnapshot?.config);

  const isOnboarded = hasModelProvider || hasWizardCompletion;

  // If we detect onboarding is complete via config, also set localStorage
  // so future checks are faster
  if (isOnboarded && !localStorageOnboarded) {
    markOnboardingComplete();
  }

  return {
    isOnboarded,
    isLoading: false,
    error: error instanceof Error ? error : null,
    refetch,
  };
}

/**
 * Check if at least one model provider has an API key.
 */
function checkHasModelProvider(
  auth: Record<string, { apiKey?: string } | undefined> | undefined
): boolean {
  if (!auth) {return false;}

  const providers = ["anthropic", "openai", "google", "xai", "openrouter"];
  return providers.some((provider) => {
    const providerConfig = auth[provider];
    return providerConfig?.apiKey && providerConfig.apiKey.length > 0;
  });
}

/**
 * Check if wizard completion is recorded in config.
 */
function checkWizardCompletion(
  config: Record<string, unknown> | undefined
): boolean {
  if (!config) {return false;}

  // Check for wizard.onboarding.completedAt
  const wizard = config.wizard as { onboarding?: { completedAt?: string } } | undefined;
  return !!wizard?.onboarding?.completedAt;
}

export default useOnboardingCheck;

import { normalizeProviderId } from "../model-selection.js";

export const CLAUDE_SUBSCRIPTION_PROVIDERS = ["claude-personal"] as const;

const CLAUDE_SUBSCRIPTION_PROVIDER_SET = new Set<string>(CLAUDE_SUBSCRIPTION_PROVIDERS);

export const CLAUDE_SDK_POLICY_WARNING_LINES = [
  "Important Anthropic policy notice:",
  "Anthropic has stated that using the Claude Agent SDK for 24/7 autonomous bots is prohibited.",
  "Using a personal Claude subscription (Claude Pro or Max) for business purposes, or for people other than the subscriber, violates Anthropic Terms of Service.",
] as const;

export const CLAUDE_SDK_POLICY_ACKNOWLEDGEMENT_MESSAGE =
  "I understand these Anthropic restrictions and will use this profile in compliance with the Terms.";

export function isClaudeSubscriptionProvider(provider: string | undefined): boolean {
  if (typeof provider !== "string" || provider.trim().length === 0) {
    return false;
  }
  return CLAUDE_SUBSCRIPTION_PROVIDER_SET.has(normalizeProviderId(provider));
}

export function getClaudeSdkPolicyWarningText(): string {
  return CLAUDE_SDK_POLICY_WARNING_LINES.join(" ");
}

export function emitClaudeSdkPolicyWarningLines(params: {
  log: (message: string) => void;
  padding?: boolean;
}): void {
  if (params.padding) {
    params.log("");
  }
  for (const line of CLAUDE_SDK_POLICY_WARNING_LINES) {
    params.log(line);
  }
  if (params.padding) {
    params.log("");
  }
}

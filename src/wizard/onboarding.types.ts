import type { GatewayAuthChoice } from "../commands/onboard-types.js";
import type { OnboardingMode } from "./onboarding-mode.js";

export type WizardFlow = "quickstart" | "advanced";

export type QuickstartGatewayDefaults = {
  hasExisting: boolean;
  port: number;
  bind: "loopback" | "lan" | "auto" | "custom" | "tailnet";
  authMode: GatewayAuthChoice;
  tailscaleMode: "off" | "serve" | "funnel";
  token?: string;
  password?: string;
  customBindHost?: string;
  tailscaleResetOnExit: boolean;
};

export type GatewayWizardSettings = {
  port: number;
  bind: "loopback" | "lan" | "auto" | "custom" | "tailnet";
  customBindHost?: string;
  authMode: GatewayAuthChoice;
  gatewayToken?: string;
  tailscaleMode: "off" | "serve" | "funnel";
  tailscaleResetOnExit: boolean;
};

/** Wizard UX state passed through all phases. */
export type WizardUxState = {
  /** Whether wizard uses Regular or Advanced terminology. */
  onboardingMode: OnboardingMode;
  /** Resolve a label key to the appropriate terminology for the current mode. */
  label: (key: string) => string;
  /** Whether onboarding mode is regular. */
  isRegular: boolean;
};

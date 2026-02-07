/**
 * Regular/Advanced mode management for the onboarding wizard.
 *
 * Regular mode uses human-friendly terminology and hides technical details.
 * Advanced mode exposes all configuration knobs for power users.
 */
import type { WizardPrompter } from "./prompts.js";

export type OnboardingMode = "regular" | "advanced";

/** Human-friendly terminology mapping for Regular mode. */
export const FRIENDLY_LABELS: Record<string, { regular: string; advanced: string }> = {
  // Gateway-related
  "gateway.title": { regular: "Bot Server", advanced: "Gateway" },
  "gateway.port": { regular: "Server port", advanced: "Gateway port" },
  "gateway.bind": { regular: "Who can connect", advanced: "Gateway bind" },
  "gateway.auth": { regular: "How to secure access", advanced: "Gateway auth" },
  "gateway.auth.token": {
    regular: "Access key (auto-generated for you)",
    advanced: "Gateway token (blank to generate)",
  },
  "gateway.auth.password": { regular: "Access password", advanced: "Gateway password" },
  "gateway.install": {
    regular: "Keep bot running in the background",
    advanced: "Install Gateway service (recommended)",
  },
  "gateway.runtime": {
    regular: "Background service engine",
    advanced: "Gateway service runtime",
  },
  "gateway.status": { regular: "Bot server status", advanced: "Gateway status" },

  // Bind mode options
  "bind.loopback": { regular: "This computer only", advanced: "Loopback (127.0.0.1)" },
  "bind.lan": { regular: "Devices on my network", advanced: "LAN (0.0.0.0)" },
  "bind.tailnet": { regular: "My private network (Tailscale)", advanced: "Tailnet (Tailscale IP)" },
  "bind.auto": {
    regular: "Auto (start local, expand if needed)",
    advanced: "Auto (Loopback → LAN)",
  },
  "bind.custom": { regular: "Specific IP address", advanced: "Custom IP" },

  // Auth mode options
  "auth.token": {
    regular: "Access key (recommended)",
    advanced: "Token",
  },
  "auth.password": { regular: "Password", advanced: "Password" },

  // Tailscale
  "tailscale.title": { regular: "Remote access", advanced: "Tailscale exposure" },
  "tailscale.off": { regular: "Off (local only)", advanced: "Off" },
  "tailscale.serve": {
    regular: "My devices only (private)",
    advanced: "Serve",
  },
  "tailscale.funnel": {
    regular: "Anyone with the link (public)",
    advanced: "Funnel",
  },
  "tailscale.reset": {
    regular: "Close remote access when bot stops?",
    advanced: "Reset Tailscale serve/funnel on exit?",
  },

  // Workspace
  "workspace.title": { regular: "Bot's home folder", advanced: "Workspace directory" },

  // Auth/Model
  "auth.title": { regular: "AI brain", advanced: "Model/auth provider" },
  "model.title": { regular: "Which AI model to use", advanced: "Default model" },

  // Channels
  "channels.title": { regular: "Chat apps", advanced: "Channels" },
  "channels.configure": {
    regular: "Connect your chat apps now?",
    advanced: "Configure chat channels now?",
  },
  "channels.select": { regular: "Pick a chat app", advanced: "Select a channel" },
  "channels.select.quickstart": {
    regular: "Which chat app?",
    advanced: "Select channel (QuickStart)",
  },
  "channels.dm": {
    regular: "Who can message your bot?",
    advanced: "Configure DM access policies now? (default: pairing)",
  },

  // Skills
  "skills.title": { regular: "Abilities", advanced: "Skills" },
  "skills.configure": {
    regular: "Set up your bot's abilities? (recommended)",
    advanced: "Configure skills now? (recommended)",
  },
  "skills.nodeManager": {
    regular: "How to install abilities",
    advanced: "Preferred node manager for skill installs",
  },
  "skills.install": {
    regular: "Install missing abilities",
    advanced: "Install missing skill dependencies",
  },

  // Hooks
  "hooks.title": { regular: "Automations", advanced: "Hooks" },
  "hooks.enable": { regular: "Enable automations?", advanced: "Enable hooks?" },

  // Finalization
  "launch.title": { regular: "Go Live", advanced: "Finalization" },
  "launch.hatch": {
    regular: "How do you want to start chatting?",
    advanced: "How do you want to hatch your bot?",
  },
  "launch.tui": {
    regular: "Chat in terminal (recommended)",
    advanced: "Hatch in TUI (recommended)",
  },
  "launch.web": { regular: "Open the web dashboard", advanced: "Open the Web UI" },
  "launch.later": { regular: "I'll do it later", advanced: "Do this later" },

  // Onboarding mode
  "flow.title": { regular: "Setup style", advanced: "Onboarding mode" },
  "flow.quickstart": { regular: "Quick Setup", advanced: "QuickStart" },
  "flow.advanced": { regular: "Full Control", advanced: "Manual" },

  // Security
  "security.title": { regular: "Safety Check", advanced: "Security" },
  "security.confirm": {
    regular: "I understand this bot can take actions on my computer. Continue?",
    advanced: "I understand this is powerful and inherently risky. Continue?",
  },

  // Config handling
  "config.title": { regular: "Existing setup detected", advanced: "Existing config detected" },
  "config.keep": { regular: "Keep my current settings", advanced: "Use existing values" },
  "config.modify": { regular: "Update some settings", advanced: "Update values" },
  "config.reset": { regular: "Start fresh", advanced: "Reset" },

  // Personalize phase
  "personalize.title": { regular: "Personality", advanced: "Personalize" },
  "personalize.name": {
    regular: "What should your bot be called?",
    advanced: "Assistant display name",
  },
  "personalize.avatar": {
    regular: "Pick an emoji for your bot",
    advanced: "Assistant avatar (emoji)",
  },
  "personalize.color": { regular: "Pick a color theme", advanced: "UI accent color (hex)" },
  "personalize.toolProfile": {
    regular: "What should your bot be able to do?",
    advanced: "Tool access profile",
  },
  "personalize.toolProfile.minimal": {
    regular: "Just chat (no file or system access)",
    advanced: "Minimal (conversation only)",
  },
  "personalize.toolProfile.messaging": {
    regular: "Chat + send messages",
    advanced: "Messaging (conversation + outbound messages)",
  },
  "personalize.toolProfile.coding": {
    regular: "Read files and help with code",
    advanced: "Coding (file access + development tools)",
  },
  "personalize.toolProfile.full": {
    regular: "Full assistant (files, web, commands, everything)",
    advanced: "Full (all tools enabled)",
  },

  // Web search
  "webSearch.title": { regular: "Web Search", advanced: "Web search" },
  "webSearch.enable": {
    regular: "Want your bot to search the web?",
    advanced: "Enable web search (requires Brave Search API key)?",
  },
  "webSearch.apiKey": {
    regular: "Paste your Brave Search API key",
    advanced: "Brave Search API key",
  },

  // Configuration phase (Advanced only)
  "configuration.title": { regular: "Fine-Tune", advanced: "Configuration" },
  "configuration.logging.level": {
    regular: "How much detail in logs?",
    advanced: "Log level",
  },
  "configuration.logging.file": {
    regular: "Save logs to a file?",
    advanced: "Log file path",
  },
  "configuration.update.channel": {
    regular: "Want early access to new features?",
    advanced: "Update channel",
  },
  "configuration.modelFallback": {
    regular: "Backup AI model",
    advanced: "Fallback model",
  },

  // Security audit phase
  "securityAudit.title": { regular: "Safety Check", advanced: "Security Audit" },
  "securityAudit.run": {
    regular: "Run a safety check on your setup?",
    advanced: "Run security audit?",
  },
};

export type OnboardingModeState = {
  mode: OnboardingMode;
  /** Get label for the current mode. */
  label: (key: string) => string;
  /** Toggle mode. Returns the new mode. */
  toggle: () => OnboardingMode;
  /** Check if in advanced mode. */
  isAdvanced: () => boolean;
  /** Check if in regular mode. */
  isRegular: () => boolean;
};

export function createModeState(initial: OnboardingMode = "regular"): OnboardingModeState {
  let current = initial;

  const label = (key: string): string => {
    const entry = FRIENDLY_LABELS[key];
    if (!entry) {
      return key;
    }
    return current === "regular" ? entry.regular : entry.advanced;
  };

  return {
    get mode() {
      return current;
    },
    label,
    toggle: () => {
      current = current === "regular" ? "advanced" : "regular";
      return current;
    },
    isAdvanced: () => current === "advanced",
    isRegular: () => current === "regular",
  };
}

/** Prompt the user to choose between Regular and Advanced mode. */
export async function promptOnboardingMode(params: {
  prompter: WizardPrompter;
  initialMode?: OnboardingMode;
}): Promise<OnboardingMode> {
  return await params.prompter.select<OnboardingMode>({
    message: "How much control do you want?",
    options: [
      {
        value: "regular",
        label: "Regular",
        hint: "Simplified setup with smart defaults",
      },
      {
        value: "advanced",
        label: "Advanced",
        hint: "Full control over every setting",
      },
    ],
    initialValue: params.initialMode ?? "regular",
  });
}

/** Prompt for a mid-wizard mode switch. Returns null if user declines. */
export async function promptModeSwitch(params: {
  prompter: WizardPrompter;
  currentMode: OnboardingMode;
}): Promise<OnboardingMode | null> {
  const targetLabel = params.currentMode === "regular" ? "Advanced" : "Regular";
  const wants = await params.prompter.confirm({
    message: `Switch to ${targetLabel} mode?`,
    initialValue: false,
  });
  if (!wants) {
    return null;
  }
  return params.currentMode === "regular" ? "advanced" : "regular";
}

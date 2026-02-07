import type {
  GatewayAuthChoice,
  OnboardMode,
  OnboardOptions,
  ResetScope,
} from "../commands/onboard-types.js";
import type { OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type { QuickstartGatewayDefaults, WizardFlow, WizardUxState } from "./onboarding.types.js";
import { ensureAuthProfileStore } from "../agents/auth-profiles.js";
import { listChannelPlugins } from "../channels/plugins/index.js";
import { formatCliCommand } from "../cli/command-format.js";
import { promptAuthChoiceGrouped } from "../commands/auth-choice-prompt.js";
import {
  applyAuthChoice,
  resolvePreferredProviderForAuthChoice,
  warnIfModelConfigLooksOff,
} from "../commands/auth-choice.js";
import { applyPrimaryModel, promptDefaultModel } from "../commands/model-picker.js";
import { setupChannels } from "../commands/onboard-channels.js";
import {
  applyWizardMetadata,
  DEFAULT_WORKSPACE,
  ensureWorkspaceAndSessions,
  handleReset,
  printWizardHeader,
  probeGatewayReachable,
  summarizeExistingConfig,
} from "../commands/onboard-helpers.js";
import { setupInternalHooks } from "../commands/onboard-hooks.js";
import { promptRemoteGatewayConfig } from "../commands/onboard-remote.js";
import { setupSkills } from "../commands/onboard-skills.js";
import {
  DEFAULT_GATEWAY_PORT,
  readConfigFileSnapshot,
  resolveGatewayPort,
  writeConfigFile,
} from "../config/config.js";
import { logConfigUpdated } from "../config/logging.js";
import { defaultRuntime } from "../runtime.js";
import { resolveUserPath } from "../utils.js";
import { createModeState, promptOnboardingMode } from "./onboarding-mode.js";
import { createStepTracker } from "./onboarding-steps.js";
import {
  renderConfigPreview,
  renderModeBadge,
  renderModeToggleHint,
  renderPhaseBanner,
  renderSecurityWarningAdvanced,
  renderSecurityWarningRegular,
  renderSummaryCard,
} from "./onboarding-style.js";
import { finalizeOnboardingWizard } from "./onboarding.finalize.js";
import { configureGatewayForOnboarding } from "./onboarding.gateway-config.js";
import { WizardCancelledError, type WizardPrompter } from "./prompts.js";

// ── Phase 1: Welcome & Safety ──────────────────────────────────────────────

async function requireRiskAcknowledgement(params: {
  opts: OnboardOptions;
  prompter: WizardPrompter;
  ux: WizardUxState;
}) {
  if (params.opts.acceptRisk === true) {
    return;
  }

  // Improvement #7: Simplified security in Regular mode
  const message = params.ux.isRegular
    ? renderSecurityWarningRegular()
    : renderSecurityWarningAdvanced();

  await params.prompter.note(message, params.ux.label("security.title"));

  const ok = await params.prompter.confirm({
    message: params.ux.label("security.confirm"),
    initialValue: false,
  });
  if (!ok) {
    throw new WizardCancelledError("risk not accepted");
  }
}

// ── Main Wizard ─────────────────────────────────────────────────────────────

export async function runOnboardingWizard(
  opts: OnboardOptions,
  runtime: RuntimeEnv = defaultRuntime,
  prompter: WizardPrompter,
) {
  printWizardHeader(runtime);
  await prompter.intro("OpenClaw onboarding");

  // ── Improvement #2: Regular/Advanced mode toggle ──────────────────────
  // Determine whether the user wants full-control (advanced) or simplified flow.
  const explicitAdvanced = opts.flow === "advanced" || opts.flow === "manual";
  const initialMode = explicitAdvanced ? "advanced" : "regular";
  const modeState = createModeState(initialMode);

  // Only prompt for mode if not explicitly set by CLI flag
  if (!explicitAdvanced && !opts.flow) {
    const chosenMode = await promptOnboardingMode({
      prompter,
      initialMode: "regular",
    });
    if (chosenMode === "advanced") {
      modeState.toggle();
    }
  }

  const ux: WizardUxState = {
    get onboardingMode() {
      return modeState.mode;
    },
    label: modeState.label,
    get isRegular() {
      return modeState.isRegular();
    },
  };

  // Improvement #5: Step tracker with visual progress
  const steps = createStepTracker({ friendly: modeState.isRegular() });

  // ── Phase 1: Welcome ──────────────────────────────────────────────────
  runtime.log(steps.render());

  // Improvement #13: Mode toggle hint visible at phase boundary
  runtime.log(renderModeToggleHint(modeState.mode));
  runtime.log(""); // blank line for spacing

  await requireRiskAcknowledgement({ opts, prompter, ux });

  const snapshot = await readConfigFileSnapshot();
  let baseConfig: OpenClawConfig = snapshot.valid ? snapshot.config : {};

  if (snapshot.exists && !snapshot.valid) {
    await prompter.note(summarizeExistingConfig(baseConfig), "Invalid config");
    if (snapshot.issues.length > 0) {
      await prompter.note(
        [
          ...snapshot.issues.map((iss) => `- ${iss.path}: ${iss.message}`),
          "",
          "Docs: https://docs.openclaw.ai/gateway/configuration",
        ].join("\n"),
        "Config issues",
      );
    }
    await prompter.outro(
      `Config invalid. Run \`${formatCliCommand("openclaw doctor")}\` to repair it, then re-run onboarding.`,
    );
    runtime.exit(1);
    return;
  }

  // ── Flow selection (quickstart vs advanced) ───────────────────────────
  // Improvement #3: Human-friendly terminology
  const quickstartHint = `Smart defaults. Configure details later via ${formatCliCommand("openclaw configure")}.`;
  const manualHint = "Configure port, network, Tailscale, and auth options.";
  const explicitFlowRaw = opts.flow?.trim();
  const normalizedExplicitFlow = explicitFlowRaw === "manual" ? "advanced" : explicitFlowRaw;
  if (
    normalizedExplicitFlow &&
    normalizedExplicitFlow !== "quickstart" &&
    normalizedExplicitFlow !== "advanced"
  ) {
    runtime.error("Invalid --flow (use quickstart, manual, or advanced).");
    runtime.exit(1);
    return;
  }
  const explicitFlow: WizardFlow | undefined =
    normalizedExplicitFlow === "quickstart" || normalizedExplicitFlow === "advanced"
      ? normalizedExplicitFlow
      : undefined;
  let flow: WizardFlow =
    explicitFlow ??
    (await prompter.select({
      message: ux.label("flow.title"),
      options: [
        { value: "quickstart", label: ux.label("flow.quickstart"), hint: quickstartHint },
        { value: "advanced", label: ux.label("flow.advanced"), hint: manualHint },
      ],
      initialValue: "quickstart",
    }));

  if (opts.mode === "remote" && flow === "quickstart") {
    await prompter.note(
      "QuickStart only supports local gateways. Switching to Manual mode.",
      ux.label("flow.quickstart"),
    );
    flow = "advanced";
  }

  // ── Existing config handling ──────────────────────────────────────────
  if (snapshot.exists) {
    await prompter.note(summarizeExistingConfig(baseConfig), ux.label("config.title"));

    const action = await prompter.select({
      message: "Config handling",
      options: [
        { value: "keep", label: ux.label("config.keep") },
        { value: "modify", label: ux.label("config.modify") },
        { value: "reset", label: ux.label("config.reset") },
      ],
    });

    if (action === "reset") {
      const workspaceDefault = baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE;
      const resetScope = (await prompter.select({
        message: "Reset scope",
        options: [
          { value: "config", label: "Config only" },
          {
            value: "config+creds+sessions",
            label: "Config + creds + sessions",
          },
          {
            value: "full",
            label: "Full reset (config + creds + sessions + workspace)",
          },
        ],
      })) as ResetScope;
      await handleReset(resetScope, resolveUserPath(workspaceDefault), runtime);
      baseConfig = {};
    }
  }

  // Improvement #8: Welcome phase summary
  runtime.log(
    renderSummaryCard({
      title: "Welcome",
      entries: [
        { label: "Mode", value: renderModeBadge(modeState.mode) },
        { label: "Flow", value: flow === "quickstart" ? "Quick Setup" : "Full Control" },
      ],
    }),
  );

  // ── Phase 2: Identity (workspace + model) ─────────────────────────────
  // Improvement #1: Step progress
  runtime.log(steps.advance());
  runtime.log(
    renderPhaseBanner({
      title: ux.isRegular ? "Your Bot" : "Identity",
      subtitle: ux.isRegular
        ? "Set up where your bot lives and which AI it uses"
        : "Configure workspace and model",
      stepNumber: steps.currentIndex() + 1,
      totalSteps: steps.total(),
    }),
  );

  const quickstartGateway: QuickstartGatewayDefaults = (() => {
    const hasExisting =
      typeof baseConfig.gateway?.port === "number" ||
      baseConfig.gateway?.bind !== undefined ||
      baseConfig.gateway?.auth?.mode !== undefined ||
      baseConfig.gateway?.auth?.token !== undefined ||
      baseConfig.gateway?.auth?.password !== undefined ||
      baseConfig.gateway?.customBindHost !== undefined ||
      baseConfig.gateway?.tailscale?.mode !== undefined;

    const bindRaw = baseConfig.gateway?.bind;
    const bind =
      bindRaw === "loopback" ||
      bindRaw === "lan" ||
      bindRaw === "auto" ||
      bindRaw === "custom" ||
      bindRaw === "tailnet"
        ? bindRaw
        : "loopback";

    let authMode: GatewayAuthChoice = "token";
    if (
      baseConfig.gateway?.auth?.mode === "token" ||
      baseConfig.gateway?.auth?.mode === "password"
    ) {
      authMode = baseConfig.gateway.auth.mode;
    } else if (baseConfig.gateway?.auth?.token) {
      authMode = "token";
    } else if (baseConfig.gateway?.auth?.password) {
      authMode = "password";
    }

    const tailscaleRaw = baseConfig.gateway?.tailscale?.mode;
    const tailscaleMode =
      tailscaleRaw === "off" || tailscaleRaw === "serve" || tailscaleRaw === "funnel"
        ? tailscaleRaw
        : "off";

    return {
      hasExisting,
      port: resolveGatewayPort(baseConfig),
      bind,
      authMode,
      tailscaleMode,
      token: baseConfig.gateway?.auth?.token,
      password: baseConfig.gateway?.auth?.password,
      customBindHost: baseConfig.gateway?.customBindHost,
      tailscaleResetOnExit: baseConfig.gateway?.tailscale?.resetOnExit ?? false,
    };
  })();

  if (flow === "quickstart") {
    const formatBind = (value: "loopback" | "lan" | "auto" | "custom" | "tailnet") => {
      if (ux.isRegular) {
        return ux.label(`bind.${value}`);
      }
      if (value === "loopback") {
        return "Loopback (127.0.0.1)";
      }
      if (value === "lan") {
        return "LAN";
      }
      if (value === "custom") {
        return "Custom IP";
      }
      if (value === "tailnet") {
        return "Tailnet (Tailscale IP)";
      }
      return "Auto";
    };
    const formatAuth = (value: GatewayAuthChoice) => {
      if (ux.isRegular) {
        return ux.label(`auth.${value}`);
      }
      if (value === "token") {
        return "Token (default)";
      }
      return "Password";
    };
    // Improvement #6: Progressive disclosure - only show quickstart summary
    // in a compact format, offer learn-more for details
    const quickstartLines = quickstartGateway.hasExisting
      ? [
          "Keeping your current server settings:",
          `Port: ${quickstartGateway.port}`,
          `Access: ${formatBind(quickstartGateway.bind)}`,
          `Security: ${formatAuth(quickstartGateway.authMode)}`,
        ]
      : [
          `Port: ${DEFAULT_GATEWAY_PORT}`,
          `Access: ${ux.isRegular ? "This computer only" : "Loopback (127.0.0.1)"}`,
          `Security: ${ux.isRegular ? "Access key (auto-generated)" : "Token (default)"}`,
        ];
    await prompter.note(quickstartLines.join("\n"), ux.label("flow.quickstart"));
  }

  const localPort = resolveGatewayPort(baseConfig);
  const localUrl = `ws://127.0.0.1:${localPort}`;
  const localProbe = await probeGatewayReachable({
    url: localUrl,
    token: baseConfig.gateway?.auth?.token ?? process.env.OPENCLAW_GATEWAY_TOKEN,
    password: baseConfig.gateway?.auth?.password ?? process.env.OPENCLAW_GATEWAY_PASSWORD,
  });
  const remoteUrl = baseConfig.gateway?.remote?.url?.trim() ?? "";
  const remoteProbe = remoteUrl
    ? await probeGatewayReachable({
        url: remoteUrl,
        token: baseConfig.gateway?.remote?.token,
      })
    : null;

  const mode =
    opts.mode ??
    (flow === "quickstart"
      ? "local"
      : ((await prompter.select({
          message: "What do you want to set up?",
          options: [
            {
              value: "local",
              label: ux.isRegular ? "Set up on this computer" : "Local gateway (this machine)",
              hint: localProbe.ok
                ? `${ux.isRegular ? "Server" : "Gateway"} reachable (${localUrl})`
                : `No ${ux.isRegular ? "server" : "gateway"} detected (${localUrl})`,
            },
            {
              value: "remote",
              label: ux.isRegular
                ? "Connect to a bot running elsewhere"
                : "Remote gateway (info-only)",
              hint: !remoteUrl
                ? "No remote URL configured yet"
                : remoteProbe?.ok
                  ? `${ux.isRegular ? "Server" : "Gateway"} reachable (${remoteUrl})`
                  : `Configured but unreachable (${remoteUrl})`,
            },
          ],
        })) as OnboardMode));

  if (mode === "remote") {
    let nextConfig = await promptRemoteGatewayConfig(baseConfig, prompter);
    nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
    await writeConfigFile(nextConfig);
    logConfigUpdated(runtime);
    await prompter.outro("Remote gateway configured.");
    return;
  }

  // Workspace prompt
  const workspaceInput =
    opts.workspace ??
    (flow === "quickstart"
      ? (baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE)
      : await prompter.text({
          message: ux.label("workspace.title"),
          initialValue: baseConfig.agents?.defaults?.workspace ?? DEFAULT_WORKSPACE,
        }));

  const workspaceDir = resolveUserPath(workspaceInput.trim() || DEFAULT_WORKSPACE);

  let nextConfig: OpenClawConfig = {
    ...baseConfig,
    agents: {
      ...baseConfig.agents,
      defaults: {
        ...baseConfig.agents?.defaults,
        workspace: workspaceDir,
      },
    },
    gateway: {
      ...baseConfig.gateway,
      mode: "local",
    },
  };

  // Auth/model selection
  const authStore = ensureAuthProfileStore(undefined, {
    allowKeychainPrompt: false,
  });
  const authChoiceFromPrompt = opts.authChoice === undefined;
  const authChoice =
    opts.authChoice ??
    (await promptAuthChoiceGrouped({
      prompter,
      store: authStore,
      includeSkip: true,
    }));

  const authResult = await applyAuthChoice({
    authChoice,
    config: nextConfig,
    prompter,
    runtime,
    setDefaultModel: true,
    opts: {
      tokenProvider: opts.tokenProvider,
      token: opts.authChoice === "apiKey" && opts.token ? opts.token : undefined,
    },
  });
  nextConfig = authResult.config;

  if (authChoiceFromPrompt) {
    const modelSelection = await promptDefaultModel({
      config: nextConfig,
      prompter,
      allowKeep: true,
      ignoreAllowlist: true,
      preferredProvider: resolvePreferredProviderForAuthChoice(authChoice),
    });
    if (modelSelection.model) {
      nextConfig = applyPrimaryModel(nextConfig, modelSelection.model);
    }
  }

  await warnIfModelConfigLooksOff(nextConfig, prompter);

  // Improvement #8: Identity phase summary
  const primaryModel =
    typeof nextConfig.agents?.defaults?.model === "string"
      ? nextConfig.agents.defaults.model
      : (nextConfig.agents?.defaults?.model?.primary ?? "not set");
  runtime.log(
    renderSummaryCard({
      title: ux.isRegular ? "Your Bot" : "Identity",
      entries: [
        { label: ux.isRegular ? "Home folder" : "Workspace", value: workspaceDir },
        { label: ux.isRegular ? "AI model" : "Model", value: primaryModel },
      ],
    }),
  );

  // ── Phase 3: Connectivity (gateway + channels) ───────────────────────
  runtime.log(steps.advance());
  runtime.log(
    renderPhaseBanner({
      title: ux.isRegular ? "Connections" : "Connectivity",
      subtitle: ux.isRegular
        ? "Configure your bot's server and chat apps"
        : "Gateway and channel configuration",
      stepNumber: steps.currentIndex() + 1,
      totalSteps: steps.total(),
    }),
  );

  // Improvement #14: Mid-wizard mode toggle opportunity
  if (ux.isRegular) {
    const wantsAdvanced = await prompter.confirm({
      message: "Want to see advanced network settings?",
      initialValue: false,
    });
    if (wantsAdvanced) {
      modeState.toggle();
    }
  }

  // Gateway configuration
  const gateway = await configureGatewayForOnboarding({
    flow,
    baseConfig,
    nextConfig,
    localPort,
    quickstartGateway,
    prompter,
    runtime,
    ux,
  });
  nextConfig = gateway.nextConfig;
  const settings = gateway.settings;

  // Channel setup
  if (opts.skipChannels ?? opts.skipProviders) {
    await prompter.note("Skipping channel setup.", ux.label("channels.title"));
  } else {
    const quickstartAllowFromChannels =
      flow === "quickstart"
        ? listChannelPlugins()
            .filter((plugin) => plugin.meta.quickstartAllowFrom)
            .map((plugin) => plugin.id)
        : [];
    nextConfig = await setupChannels(nextConfig, runtime, prompter, {
      allowSignalInstall: true,
      forceAllowFromChannels: quickstartAllowFromChannels,
      skipDmPolicyPrompt: flow === "quickstart",
      skipConfirm: flow === "quickstart",
      quickstartDefaults: flow === "quickstart",
    });
  }

  // Improvement #8: Connectivity phase summary
  const formatBindSummary = (bind: string) => {
    if (!ux.isRegular) {
      return bind;
    }
    return ux.label(`bind.${bind}`);
  };
  runtime.log(
    renderSummaryCard({
      title: ux.isRegular ? "Connections" : "Connectivity",
      entries: [
        { label: "Port", value: String(settings.port) },
        { label: ux.isRegular ? "Access" : "Bind", value: formatBindSummary(settings.bind) },
        {
          label: "Auth",
          value: settings.authMode === "token" ? "Token" : "Password",
        },
      ],
    }),
  );

  await writeConfigFile(nextConfig);
  logConfigUpdated(runtime);
  await ensureWorkspaceAndSessions(workspaceDir, runtime, {
    skipBootstrap: Boolean(nextConfig.agents?.defaults?.skipBootstrap),
  });

  // ── Phase 4: Capabilities (skills + hooks) ────────────────────────────
  runtime.log(steps.advance());
  runtime.log(
    renderPhaseBanner({
      title: ux.isRegular ? "Abilities" : "Capabilities",
      subtitle: ux.isRegular
        ? "Add tools and automations to make your bot smarter"
        : "Skills and hooks configuration",
      stepNumber: steps.currentIndex() + 1,
      totalSteps: steps.total(),
    }),
  );

  if (opts.skipSkills) {
    await prompter.note("Skipping skills setup.", ux.label("skills.title"));
  } else {
    nextConfig = await setupSkills(nextConfig, workspaceDir, runtime, prompter);
  }

  // Setup hooks (session memory on /new)
  nextConfig = await setupInternalHooks(nextConfig, runtime, prompter);

  nextConfig = applyWizardMetadata(nextConfig, { command: "onboard", mode });
  await writeConfigFile(nextConfig);

  // Improvement #8: Capabilities phase summary
  const skillCount = Object.keys(nextConfig.skills?.entries ?? {}).length;
  const hookCount = Object.keys(nextConfig.hooks?.internal?.entries ?? {}).length;
  runtime.log(
    renderSummaryCard({
      title: ux.isRegular ? "Abilities" : "Capabilities",
      entries: [
        { label: ux.isRegular ? "Abilities" : "Skills", value: `${skillCount} configured` },
        { label: ux.isRegular ? "Automations" : "Hooks", value: `${hookCount} enabled` },
      ],
    }),
  );

  // ── Phase 5: Launch ───────────────────────────────────────────────────
  runtime.log(steps.advance());
  runtime.log(
    renderPhaseBanner({
      title: ux.isRegular ? "Go Live" : "Launch",
      subtitle: ux.isRegular ? "Your bot is ready — let's start it up!" : "Finalize and launch",
      stepNumber: steps.currentIndex() + 1,
      totalSteps: steps.total(),
    }),
  );

  // Improvement #9: Configuration preview before finalizing
  const previewSections = [
    {
      title: ux.isRegular ? "Your Bot" : "Identity",
      entries: [
        { label: ux.isRegular ? "Home folder" : "Workspace", value: workspaceDir },
        { label: ux.isRegular ? "AI model" : "Model", value: primaryModel },
      ],
    },
    {
      title: ux.isRegular ? "Server" : "Gateway",
      entries: [
        { label: "Port", value: String(settings.port) },
        { label: ux.isRegular ? "Access" : "Bind", value: formatBindSummary(settings.bind) },
        { label: "Auth", value: settings.authMode },
      ],
    },
    {
      title: ux.isRegular ? "Abilities" : "Capabilities",
      entries: [
        { label: ux.isRegular ? "Abilities" : "Skills", value: `${skillCount} configured` },
        { label: ux.isRegular ? "Automations" : "Hooks", value: `${hookCount} enabled` },
      ],
    },
  ];
  await prompter.note(
    renderConfigPreview(previewSections),
    ux.isRegular ? "Ready!" : "Config Preview",
  );

  const { launchedTui } = await finalizeOnboardingWizard({
    flow,
    opts,
    baseConfig,
    nextConfig,
    workspaceDir,
    settings,
    prompter,
    runtime,
    ux,
  });
  if (launchedTui) {
    return;
  }
}

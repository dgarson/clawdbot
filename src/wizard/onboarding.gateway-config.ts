import type { GatewayAuthChoice } from "../commands/onboard-types.js";
import type { GatewayBindMode, GatewayTailscaleMode, OpenClawConfig } from "../config/config.js";
import type { RuntimeEnv } from "../runtime.js";
import type {
  GatewayWizardSettings,
  QuickstartGatewayDefaults,
  WizardFlow,
  WizardUxState,
} from "./onboarding.types.js";
import type { WizardPrompter } from "./prompts.js";
import { normalizeGatewayTokenInput, randomToken } from "../commands/onboard-helpers.js";
import { findTailscaleBinary } from "../infra/tailscale.js";

type ConfigureGatewayOptions = {
  flow: WizardFlow;
  baseConfig: OpenClawConfig;
  nextConfig: OpenClawConfig;
  localPort: number;
  quickstartGateway: QuickstartGatewayDefaults;
  prompter: WizardPrompter;
  runtime: RuntimeEnv;
  /** UX state for mode-aware labels. */
  ux?: WizardUxState;
};

type ConfigureGatewayResult = {
  nextConfig: OpenClawConfig;
  settings: GatewayWizardSettings;
};

export async function configureGatewayForOnboarding(
  opts: ConfigureGatewayOptions,
): Promise<ConfigureGatewayResult> {
  const { flow, localPort, quickstartGateway, prompter, ux } = opts;
  let { nextConfig } = opts;

  // Helper: resolve label for current mode
  const label = (key: string, fallback: string): string => ux?.label(key) ?? fallback;

  const port =
    flow === "quickstart"
      ? quickstartGateway.port
      : Number.parseInt(
          String(
            await prompter.text({
              message: label("gateway.port", "Gateway port"),
              initialValue: String(localPort),
              validate: (value) => (Number.isFinite(Number(value)) ? undefined : "Invalid port"),
            }),
          ),
          10,
        );

  let bind: GatewayWizardSettings["bind"] =
    flow === "quickstart"
      ? quickstartGateway.bind
      : await prompter.select<GatewayWizardSettings["bind"]>({
          message: label("gateway.bind", "Gateway bind"),
          options: [
            { value: "loopback", label: label("bind.loopback", "Loopback (127.0.0.1)") },
            { value: "lan", label: label("bind.lan", "LAN (0.0.0.0)") },
            { value: "tailnet", label: label("bind.tailnet", "Tailnet (Tailscale IP)") },
            { value: "auto", label: label("bind.auto", "Auto (Loopback → LAN)") },
            { value: "custom", label: label("bind.custom", "Custom IP") },
          ],
        });

  let customBindHost = quickstartGateway.customBindHost;
  if (bind === "custom") {
    const needsPrompt = flow !== "quickstart" || !customBindHost;
    if (needsPrompt) {
      const input = await prompter.text({
        message: "Custom IP address",
        placeholder: "192.168.1.100",
        initialValue: customBindHost ?? "",
        validate: (value) => {
          if (!value) {
            return "IP address is required for custom bind mode";
          }
          const trimmed = value.trim();
          const parts = trimmed.split(".");
          if (parts.length !== 4) {
            return "Invalid IPv4 address (e.g., 192.168.1.100)";
          }
          if (
            parts.every((part) => {
              const n = parseInt(part, 10);
              return !Number.isNaN(n) && n >= 0 && n <= 255 && part === String(n);
            })
          ) {
            return undefined;
          }
          return "Invalid IPv4 address (each octet must be 0-255)";
        },
      });
      customBindHost = typeof input === "string" ? input.trim() : undefined;
    }
  }

  let authMode =
    flow === "quickstart"
      ? quickstartGateway.authMode
      : ((await prompter.select({
          message: label("gateway.auth", "Gateway auth"),
          options: [
            {
              value: "token",
              label: label("auth.token", "Token"),
              hint: "Recommended default (local + remote)",
            },
            { value: "password", label: label("auth.password", "Password") },
          ],
          initialValue: "token",
        })) as GatewayAuthChoice);

  const tailscaleMode: GatewayWizardSettings["tailscaleMode"] =
    flow === "quickstart"
      ? quickstartGateway.tailscaleMode
      : await prompter.select<GatewayWizardSettings["tailscaleMode"]>({
          message: label("tailscale.title", "Tailscale exposure"),
          options: [
            {
              value: "off",
              label: label("tailscale.off", "Off"),
              hint: ux?.isRegular ? "Only this machine" : "No Tailscale exposure",
            },
            {
              value: "serve",
              label: label("tailscale.serve", "Serve"),
              hint: ux?.isRegular
                ? "Your devices on Tailscale can reach the bot"
                : "Private HTTPS for your tailnet (devices on Tailscale)",
            },
            {
              value: "funnel",
              label: label("tailscale.funnel", "Funnel"),
              hint: ux?.isRegular
                ? "Anyone with the link can reach the bot"
                : "Public HTTPS via Tailscale Funnel (internet)",
            },
          ],
        });

  // Detect Tailscale binary before proceeding with serve/funnel setup.
  if (tailscaleMode !== "off") {
    const tailscaleBin = await findTailscaleBinary();
    if (!tailscaleBin) {
      await prompter.note(
        [
          "Tailscale binary not found in PATH or /Applications.",
          "Ensure Tailscale is installed from:",
          "  https://tailscale.com/download/mac",
          "",
          "You can continue setup, but serve/funnel will fail at runtime.",
        ].join("\n"),
        "Tailscale Warning",
      );
    }
  }

  let tailscaleResetOnExit = flow === "quickstart" ? quickstartGateway.tailscaleResetOnExit : false;
  if (tailscaleMode !== "off" && flow !== "quickstart") {
    await prompter.note(
      ["Docs:", "https://docs.openclaw.ai/gateway/tailscale", "https://docs.openclaw.ai/web"].join(
        "\n",
      ),
      ux?.isRegular ? "Remote Access" : "Tailscale",
    );
    tailscaleResetOnExit = Boolean(
      await prompter.confirm({
        message: label("tailscale.reset", "Reset Tailscale serve/funnel on exit?"),
        initialValue: false,
      }),
    );
  }

  // Safety + constraints:
  // - Tailscale wants bind=loopback so we never expose a non-loopback server + tailscale serve/funnel at once.
  // - Funnel requires password auth.
  if (tailscaleMode !== "off" && bind !== "loopback") {
    await prompter.note(
      ux?.isRegular
        ? "Remote access requires local-only binding. Adjusting automatically."
        : "Tailscale requires bind=loopback. Adjusting bind to loopback.",
      "Note",
    );
    bind = "loopback";
    customBindHost = undefined;
  }

  if (tailscaleMode === "funnel" && authMode !== "password") {
    await prompter.note(
      ux?.isRegular
        ? "Public access requires password authentication."
        : "Tailscale funnel requires password auth.",
      "Note",
    );
    authMode = "password";
  }

  let gatewayToken: string | undefined;
  if (authMode === "token") {
    if (flow === "quickstart") {
      gatewayToken = quickstartGateway.token ?? randomToken();
    } else {
      const tokenInput = await prompter.text({
        message: label("gateway.auth.token", "Gateway token (blank to generate)"),
        placeholder: ux?.isRegular
          ? "Leave blank for an auto-generated key"
          : "Needed for multi-machine or non-loopback access",
        initialValue: quickstartGateway.token ?? "",
      });
      gatewayToken = normalizeGatewayTokenInput(tokenInput) || randomToken();
    }
  }

  if (authMode === "password") {
    const password =
      flow === "quickstart" && quickstartGateway.password
        ? quickstartGateway.password
        : await prompter.text({
            message: label("gateway.auth.password", "Gateway password"),
            validate: (value) => (value?.trim() ? undefined : "Required"),
          });
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "password",
          password: String(password).trim(),
        },
      },
    };
  } else if (authMode === "token") {
    nextConfig = {
      ...nextConfig,
      gateway: {
        ...nextConfig.gateway,
        auth: {
          ...nextConfig.gateway?.auth,
          mode: "token",
          token: gatewayToken,
        },
      },
    };
  }

  nextConfig = {
    ...nextConfig,
    gateway: {
      ...nextConfig.gateway,
      port,
      bind: bind as GatewayBindMode,
      ...(bind === "custom" && customBindHost ? { customBindHost } : {}),
      tailscale: {
        ...nextConfig.gateway?.tailscale,
        mode: tailscaleMode as GatewayTailscaleMode,
        resetOnExit: tailscaleResetOnExit,
      },
    },
  };

  return {
    nextConfig,
    settings: {
      port,
      bind: bind as GatewayBindMode,
      customBindHost: bind === "custom" ? customBindHost : undefined,
      authMode,
      gatewayToken,
      tailscaleMode: tailscaleMode as GatewayTailscaleMode,
      tailscaleResetOnExit,
    },
  };
}

/**
 * Styled navigation elements for the onboarding wizard.
 *
 * Provides box-drawing, accent-colored headers, phase banners, and
 * compact summary cards using the lobster palette.
 */
import { isRich, theme } from "../terminal/theme.js";

/** Render a styled phase banner with lightning-accent effect. */
export function renderPhaseBanner(params: {
  title: string;
  subtitle?: string;
  stepNumber: number;
  totalSteps: number;
}): string {
  const rich = isRich();
  const { title, subtitle, stepNumber, totalSteps } = params;

  if (!rich) {
    const lines = [
      "+" + "=".repeat(58) + "+",
      `| [${stepNumber}/${totalSteps}] ${title}${" ".repeat(Math.max(0, 50 - title.length - String(stepNumber).length - String(totalSteps).length))}|`,
    ];
    if (subtitle) {
      lines.push(`|   ${subtitle}${" ".repeat(Math.max(0, 55 - subtitle.length))}|`);
    }
    lines.push("+" + "=".repeat(58) + "+");
    return lines.join("\n");
  }

  const topLeft = theme.accent("╔");
  const topRight = theme.accent("╗");
  const bottomLeft = theme.accent("╚");
  const bottomRight = theme.accent("╝");
  const horizDouble = theme.accent("═");
  const vert = theme.accent("║");

  const width = 58;
  const topBorder = `${topLeft}${horizDouble.repeat(width)}${topRight}`;
  const bottomBorder = `${bottomLeft}${horizDouble.repeat(width)}${bottomRight}`;

  // Lightning-accented title
  const lightning = theme.accentBright("⚡");
  const stepTag = theme.muted(`[${stepNumber}/${totalSteps}]`);
  const titleStyled = theme.heading(title);
  const titleContent = `${lightning} ${stepTag} ${titleStyled}`;
  // Pad right side (accounting for ANSI codes in length calculation)
  const titlePad = Math.max(
    0,
    width - 2 - title.length - `[${stepNumber}/${totalSteps}]`.length - 4,
  );
  const titleLine = `${vert} ${titleContent}${" ".repeat(titlePad)}${vert}`;

  const lines = [topBorder, titleLine];

  if (subtitle) {
    const subtitleStyled = theme.muted(subtitle);
    const subtitlePad = Math.max(0, width - 4 - subtitle.length);
    lines.push(`${vert}   ${subtitleStyled}${" ".repeat(subtitlePad)} ${vert}`);
  }

  lines.push(bottomBorder);
  return lines.join("\n");
}

/** Render a compact summary card for completed configuration. */
export function renderSummaryCard(params: {
  title: string;
  entries: Array<{ label: string; value: string }>;
  status?: "complete" | "skipped";
}): string {
  const rich = isRich();
  const { title, entries, status = "complete" } = params;

  if (!rich) {
    const lines = [`--- ${title} ${status === "complete" ? "[OK]" : "[SKIPPED]"} ---`];
    for (const entry of entries) {
      lines.push(`  ${entry.label}: ${entry.value}`);
    }
    return lines.join("\n");
  }

  const statusIcon = status === "complete" ? theme.success("✓") : theme.muted("○");
  const statusText = status === "complete" ? theme.success("complete") : theme.muted("skipped");
  const header = `${statusIcon} ${theme.accent(title)} ${statusText}`;

  const lines = [header];
  for (const entry of entries) {
    const key = theme.muted(`  ${entry.label}:`);
    lines.push(`${key} ${entry.value}`);
  }

  return lines.join("\n");
}

/** Render a mode indicator badge showing Regular or Advanced. */
export function renderModeBadge(mode: "regular" | "advanced"): string {
  const rich = isRich();

  if (!rich) {
    return mode === "regular" ? "[Regular Mode]" : "[Advanced Mode]";
  }

  if (mode === "regular") {
    return `${theme.success("◉")} ${theme.success("Regular")}`;
  }
  return `${theme.warn("◉")} ${theme.warn("Advanced")}`;
}

/** Render a "learn more" expandable prompt label. */
export function renderLearnMoreHint(topic: string): string {
  const rich = isRich();
  if (!rich) {
    return `Learn more about ${topic}?`;
  }
  return `${theme.info("?")} Learn more about ${theme.accent(topic)}?`;
}

/** Render a mode toggle hint line. */
export function renderModeToggleHint(currentMode: "regular" | "advanced"): string {
  const rich = isRich();
  const targetMode = currentMode === "regular" ? "Advanced" : "Regular";

  if (!rich) {
    return `Tip: You can switch to ${targetMode} mode at any time.`;
  }

  return theme.muted(
    `Tip: Switch to ${targetMode} mode anytime for ${currentMode === "regular" ? "more control" : "simpler options"}.`,
  );
}

/** Render the wizard navigation bar (bottom nav strip). */
export function renderNavBar(params: {
  canGoBack: boolean;
  nextLabel: string;
  modeLabel: string;
}): string {
  const rich = isRich();
  const { canGoBack, nextLabel, modeLabel } = params;

  if (!rich) {
    const parts = [];
    if (canGoBack) {
      parts.push("[Back]");
    }
    parts.push(`[${nextLabel}]`);
    parts.push(`Mode: ${modeLabel}`);
    return parts.join("  ");
  }

  const separator = theme.muted(" │ ");
  const parts: string[] = [];

  if (canGoBack) {
    parts.push(theme.muted("← Back"));
  }

  // Next button with lightning accent
  parts.push(`${theme.accentBright("⚡")} ${theme.accent(nextLabel)} ${theme.accentBright("→")}`);

  // Mode badge
  parts.push(renderModeBadge(params.modeLabel === "Regular" ? "regular" : "advanced"));

  return parts.join(separator);
}

/** Render the simplified security warning for Regular mode. */
export function renderSecurityWarningRegular(): string {
  const rich = isRich();

  const lines = [
    "Your bot can read files and perform actions on your computer.",
    "We recommend these safety measures:",
    "",
    "  1. Only allow trusted contacts to message your bot",
    "  2. Keep sensitive files out of the bot's reach",
    "  3. Use the strongest AI model available",
    "",
    "Run a security check anytime: openclaw security audit",
  ];

  if (!rich) {
    return lines.join("\n");
  }

  return [
    theme.warn(lines[0]),
    lines[1],
    "",
    `  ${theme.accent("1.")} ${lines[3].trim()}`,
    `  ${theme.accent("2.")} ${lines[4].trim()}`,
    `  ${theme.accent("3.")} ${lines[5].trim()}`,
    "",
    theme.muted(lines[7]),
  ].join("\n");
}

/** Render the full security warning for Advanced mode. */
export function renderSecurityWarningAdvanced(): string {
  return [
    "Security warning — please read.",
    "",
    "OpenClaw is a hobby project and still in beta. Expect sharp edges.",
    "This bot can read files and run actions if tools are enabled.",
    "A bad prompt can trick it into doing unsafe things.",
    "",
    "If you're not comfortable with basic security and access control, don't run OpenClaw.",
    "Ask someone experienced to help before enabling tools or exposing it to the internet.",
    "",
    "Recommended baseline:",
    "- Pairing/allowlists + mention gating.",
    "- Sandbox + least-privilege tools.",
    "- Keep secrets out of the agent's reachable filesystem.",
    "- Use the strongest available model for any bot with tools or untrusted inboxes.",
    "",
    "Run regularly:",
    "openclaw security audit --deep",
    "openclaw security audit --fix",
    "",
    "Must read: https://docs.openclaw.ai/gateway/security",
  ].join("\n");
}

/** Render a configuration preview table before finalizing. */
export function renderConfigPreview(
  sections: Array<{
    title: string;
    entries: Array<{ label: string; value: string }>;
  }>,
): string {
  const rich = isRich();
  const lines: string[] = [];

  const headerText = "Configuration Preview";
  if (rich) {
    lines.push(theme.heading(headerText));
    lines.push(theme.accentDim("─".repeat(50)));
  } else {
    lines.push(`=== ${headerText} ===`);
    lines.push("-".repeat(50));
  }

  for (const section of sections) {
    if (rich) {
      lines.push(`\n${theme.accent("▸")} ${theme.accent(section.title)}`);
    } else {
      lines.push(`\n> ${section.title}`);
    }
    for (const entry of section.entries) {
      const key = rich ? theme.muted(`  ${entry.label}:`) : `  ${entry.label}:`;
      lines.push(`${key} ${entry.value}`);
    }
  }

  if (rich) {
    lines.push(`\n${theme.accentDim("─".repeat(50))}`);
  } else {
    lines.push("\n" + "-".repeat(50));
  }

  return lines.join("\n");
}

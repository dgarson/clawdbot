/**
 * Wizard step progress tracker.
 *
 * Provides a visual progress bar and phase tracking for the onboarding wizard.
 * Each phase groups related steps; the tracker renders a compact progress line
 * showing completed, active, and upcoming phases.
 */
import { isRich, theme } from "../terminal/theme.js";

export type WizardPhase = "welcome" | "identity" | "connectivity" | "capabilities" | "launch";

export type WizardPhaseInfo = {
  id: WizardPhase;
  label: string;
  /** Human-friendly label used in Regular mode. */
  friendlyLabel: string;
  icon: string;
};

export const WIZARD_PHASES: WizardPhaseInfo[] = [
  { id: "welcome", label: "Welcome", friendlyLabel: "Welcome", icon: "1" },
  { id: "identity", label: "Identity", friendlyLabel: "Your Bot", icon: "2" },
  { id: "connectivity", label: "Connectivity", friendlyLabel: "Connections", icon: "3" },
  { id: "capabilities", label: "Capabilities", friendlyLabel: "Abilities", icon: "4" },
  { id: "launch", label: "Launch", friendlyLabel: "Go Live", icon: "5" },
];

export type WizardStepTracker = {
  /** Move to the next phase and render the progress bar. */
  advance: () => string;
  /** Render the current progress bar without advancing. */
  render: () => string;
  /** Get the current phase. */
  current: () => WizardPhaseInfo;
  /** Get the current phase index (0-based). */
  currentIndex: () => number;
  /** Get total phase count. */
  total: () => number;
  /** Render a compact summary card for the completed phase. */
  renderPhaseSummary: (entries: Array<{ label: string; value: string }>) => string;
};

export function createStepTracker(options?: { friendly?: boolean }): WizardStepTracker {
  const friendly = options?.friendly ?? false;
  let index = 0;

  const renderBar = (): string => {
    const rich = isRich();
    const parts: string[] = [];

    for (let i = 0; i < WIZARD_PHASES.length; i++) {
      const phase = WIZARD_PHASES[i];
      const label = friendly ? phase.friendlyLabel : phase.label;

      if (i < index) {
        // Completed
        const check = rich ? theme.success("●") : "●";
        const text = rich ? theme.muted(label) : label;
        parts.push(`${check} ${text}`);
      } else if (i === index) {
        // Active - lightning accent
        const marker = rich ? theme.accent(`◆`) : `◆`;
        const text = rich ? theme.accentBright(label) : label;
        parts.push(`${marker} ${text}`);
      } else {
        // Upcoming
        const dot = rich ? theme.muted("○") : "○";
        const text = rich ? theme.muted(label) : label;
        parts.push(`${dot} ${text}`);
      }
    }

    const separator = rich ? theme.muted(" ─── ") : " --- ";
    return parts.join(separator);
  };

  const renderHeader = (): string => {
    const rich = isRich();
    const phase = WIZARD_PHASES[index];
    const label = friendly ? phase.friendlyLabel : phase.label;
    const stepLabel = `Step ${index + 1} of ${WIZARD_PHASES.length}`;

    const bar = renderBar();

    // Build the styled header with box-drawing characters
    const topBorder = rich
      ? theme.accentDim("┌" + "─".repeat(60) + "┐")
      : "+" + "-".repeat(60) + "+";
    const bottomBorder = rich
      ? theme.accentDim("└" + "─".repeat(60) + "┘")
      : "+" + "-".repeat(60) + "+";
    const pipe = rich ? theme.accentDim("│") : "|";

    // Phase title with lightning effect
    const titleLine = rich
      ? `${pipe} ${theme.accent("⚡")} ${theme.heading(label)}${" ".repeat(Math.max(0, 56 - label.length))}${pipe}`
      : `${pipe} > ${label}${" ".repeat(Math.max(0, 56 - label.length))}${pipe}`;

    const stepLine = rich
      ? `${pipe}   ${theme.muted(stepLabel)}${" ".repeat(Math.max(0, 56 - stepLabel.length))}${pipe}`
      : `${pipe}   ${stepLabel}${" ".repeat(Math.max(0, 56 - stepLabel.length))}${pipe}`;

    return [topBorder, titleLine, stepLine, bottomBorder, "", bar, ""].join("\n");
  };

  return {
    advance: () => {
      if (index < WIZARD_PHASES.length - 1) {
        index++;
      }
      return renderHeader();
    },
    render: () => renderHeader(),
    current: () => WIZARD_PHASES[index],
    currentIndex: () => index,
    total: () => WIZARD_PHASES.length,
    renderPhaseSummary: (entries) => {
      const rich = isRich();
      const phase = WIZARD_PHASES[index];
      const label = friendly ? phase.friendlyLabel : phase.label;

      const lines: string[] = [];
      const border = rich ? theme.success("─".repeat(40)) : "-".repeat(40);
      const header = rich
        ? `${theme.success("✓")} ${theme.success(label)} complete`
        : `[OK] ${label} complete`;

      lines.push(border);
      lines.push(header);
      for (const entry of entries) {
        const key = rich ? theme.muted(entry.label + ":") : entry.label + ":";
        lines.push(`  ${key} ${entry.value}`);
      }
      lines.push(border);

      return lines.join("\n");
    },
  };
}

/**
 * Wizard step progress tracker.
 *
 * Provides a visual progress bar and phase tracking for the onboarding wizard.
 * Each phase groups related steps; the tracker renders a compact progress line
 * showing completed, active, and upcoming phases.
 *
 * The phase list is dynamic: Regular track has fewer phases while Advanced
 * adds extra configuration phases (Personalize, Configuration, Security).
 */
import { isRich, theme } from "../terminal/theme.js";

export type WizardPhase =
  | "welcome"
  | "identity"
  | "personalize"
  | "connectivity"
  | "capabilities"
  | "configuration"
  | "security"
  | "launch";

export type WizardPhaseInfo = {
  id: WizardPhase;
  label: string;
  /** Human-friendly label used in Regular mode. */
  friendlyLabel: string;
  icon: string;
};

/** All available phases. Tracks select a subset of these. */
const ALL_PHASES: Record<WizardPhase, WizardPhaseInfo> = {
  welcome: { id: "welcome", label: "Welcome", friendlyLabel: "Welcome", icon: "1" },
  identity: { id: "identity", label: "Identity", friendlyLabel: "Your Bot", icon: "2" },
  personalize: { id: "personalize", label: "Personalize", friendlyLabel: "Personality", icon: "3" },
  connectivity: {
    id: "connectivity",
    label: "Connectivity",
    friendlyLabel: "Connections",
    icon: "4",
  },
  capabilities: {
    id: "capabilities",
    label: "Capabilities",
    friendlyLabel: "Abilities",
    icon: "5",
  },
  configuration: {
    id: "configuration",
    label: "Configuration",
    friendlyLabel: "Fine-Tune",
    icon: "6",
  },
  security: { id: "security", label: "Security Audit", friendlyLabel: "Safety Check", icon: "7" },
  launch: { id: "launch", label: "Launch", friendlyLabel: "Go Live", icon: "8" },
};

/** Regular track: streamlined 6-step flow. */
export const REGULAR_PHASES: WizardPhaseInfo[] = [
  ALL_PHASES.welcome,
  ALL_PHASES.identity,
  ALL_PHASES.personalize,
  ALL_PHASES.connectivity,
  ALL_PHASES.capabilities,
  ALL_PHASES.launch,
];

/** Advanced track: full 8-step flow with configuration + security audit. */
export const ADVANCED_PHASES: WizardPhaseInfo[] = [
  ALL_PHASES.welcome,
  ALL_PHASES.identity,
  ALL_PHASES.personalize,
  ALL_PHASES.connectivity,
  ALL_PHASES.capabilities,
  ALL_PHASES.configuration,
  ALL_PHASES.security,
  ALL_PHASES.launch,
];

/** @deprecated Use REGULAR_PHASES or ADVANCED_PHASES instead. */
export const WIZARD_PHASES = REGULAR_PHASES;

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
  /** Check if a phase exists in this tracker's phase list. */
  hasPhase: (id: WizardPhase) => boolean;
  /** Render a compact summary card for the completed phase. */
  renderPhaseSummary: (entries: Array<{ label: string; value: string }>) => string;
};

export function createStepTracker(options?: {
  friendly?: boolean;
  /** Phase list to use. Defaults based on friendly flag. */
  phases?: WizardPhaseInfo[];
}): WizardStepTracker {
  const friendly = options?.friendly ?? false;
  const phases = options?.phases ?? (friendly ? REGULAR_PHASES : ADVANCED_PHASES);
  let index = 0;

  const phaseIds = new Set(phases.map((p) => p.id));

  const renderBar = (): string => {
    const rich = isRich();
    const parts: string[] = [];

    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      const label = friendly ? phase.friendlyLabel : phase.label;

      if (i < index) {
        // Completed
        const check = rich ? theme.success("●") : "●";
        const text = rich ? theme.muted(label) : label;
        parts.push(`${check} ${text}`);
      } else if (i === index) {
        // Active - lightning accent
        const marker = rich ? theme.accent("◆") : "◆";
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
    const phase = phases[index];
    const label = friendly ? phase.friendlyLabel : phase.label;
    const stepLabel = `Step ${index + 1} of ${phases.length}`;

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

    return [topBorder, titleLine, stepLine, bottomBorder, "", renderBar(), ""].join("\n");
  };

  return {
    advance: () => {
      if (index < phases.length - 1) {
        index++;
      }
      return renderHeader();
    },
    render: () => renderHeader(),
    current: () => phases[index],
    currentIndex: () => index,
    total: () => phases.length,
    hasPhase: (id) => phaseIds.has(id),
    renderPhaseSummary: (entries) => {
      const rich = isRich();
      const phase = phases[index];
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

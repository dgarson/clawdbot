import type { SharedAlertSeverity } from "./alertSeverityTheme";

type Rgb = { r: number; g: number; b: number };

const SEVERITY_BADGE_RGB: Record<SharedAlertSeverity, { fg: Rgb; bg: Rgb }> = {
  critical: { fg: { r: 251, g: 113, b: 133 }, bg: { r: 24, g: 10, b: 14 } },
  high: { fg: { r: 251, g: 146, b: 60 }, bg: { r: 24, g: 16, b: 10 } },
  medium: { fg: { r: 251, g: 191, b: 36 }, bg: { r: 24, g: 20, b: 10 } },
  low: { fg: { r: 96, g: 165, b: 250 }, bg: { r: 10, g: 16, b: 24 } },
  info: { fg: { r: 161, g: 161, b: 170 }, bg: { r: 19, g: 24, b: 36 } },
};

function channelToLinear(value: number): number {
  const channel = value / 255;
  if (channel <= 0.03928) {return channel / 12.92;}
  return ((channel + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: Rgb): number {
  return (0.2126 * channelToLinear(rgb.r)) + (0.7152 * channelToLinear(rgb.g)) + (0.0722 * channelToLinear(rgb.b));
}

function contrastRatio(a: Rgb, b: Rgb): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export function validateSeverityBadgeContrast(minRatio = 4.5): string[] {
  const failures: string[] = [];

  for (const [severity, pair] of Object.entries(SEVERITY_BADGE_RGB) as Array<[SharedAlertSeverity, { fg: Rgb; bg: Rgb }]>) {
    const ratio = contrastRatio(pair.fg, pair.bg);
    if (ratio < minRatio) {
      failures.push(`${severity}:${ratio.toFixed(2)}`);
    }
  }

  return failures;
}

export function warnOnSeverityContrastIssues(): void {
  if (typeof window === "undefined") {return;}
  const failures = validateSeverityBadgeContrast();
  if (failures.length > 0) {
    console.warn(`[alerts] Severity badge contrast below WCAG AA: ${failures.join(", ")}`);
  }
}


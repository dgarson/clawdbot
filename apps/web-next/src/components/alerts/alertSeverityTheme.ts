export type SharedAlertSeverity = "critical" | "high" | "medium" | "low" | "info";

export const ALERT_SEVERITY_ORDER: SharedAlertSeverity[] = ["critical", "high", "medium", "low", "info"];

export const ALERT_SEVERITY_LABELS: Record<SharedAlertSeverity, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
  info: "Info",
};

export const ALERT_SEVERITY_BADGE_CLASS: Record<SharedAlertSeverity, string> = {
  critical: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-orange-400 bg-orange-400/10 border-orange-400/20",
  medium: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  low: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  info: "text-fg-secondary bg-[var(--color-surface-3)]/10 border-[var(--color-surface-3)]/20",
};

export interface AlertSeverityGroupStyle {
  summaryPill: string;
  count: string;
  groupBorder: string;
  groupSurface: string;
  dot: string;
  badgeSurface: string;
}

export const ALERT_SEVERITY_GROUP_STYLES: Record<SharedAlertSeverity, AlertSeverityGroupStyle> = {
  critical: {
    summaryPill: "border-rose-500/40 bg-rose-500/10 text-rose-300",
    count: "text-rose-300",
    groupBorder: "border-rose-500/30",
    groupSurface: "bg-rose-500/5",
    dot: "bg-rose-400",
    badgeSurface: "bg-rose-500/15",
  },
  high: {
    summaryPill: "border-orange-500/40 bg-orange-500/10 text-orange-300",
    count: "text-orange-300",
    groupBorder: "border-orange-500/30",
    groupSurface: "bg-orange-500/5",
    dot: "bg-orange-400",
    badgeSurface: "bg-orange-500/15",
  },
  medium: {
    summaryPill: "border-amber-500/40 bg-amber-500/10 text-amber-300",
    count: "text-amber-300",
    groupBorder: "border-amber-500/30",
    groupSurface: "bg-amber-500/5",
    dot: "bg-amber-400",
    badgeSurface: "bg-amber-500/15",
  },
  low: {
    summaryPill: "border-sky-500/40 bg-sky-500/10 text-sky-300",
    count: "text-sky-300",
    groupBorder: "border-sky-500/30",
    groupSurface: "bg-sky-500/5",
    dot: "bg-sky-400",
    badgeSurface: "bg-sky-500/15",
  },
  info: {
    summaryPill: "border-tok-border bg-surface-2 text-fg-secondary",
    count: "text-fg-secondary",
    groupBorder: "border-tok-border",
    groupSurface: "bg-surface-1",
    dot: "bg-fg-muted",
    badgeSurface: "bg-surface-2",
  },
};

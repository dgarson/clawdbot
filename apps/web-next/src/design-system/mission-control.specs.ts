export type WidgetPriority = "critical" | "high" | "medium";

export interface MissionControlWidgetSpec {
  id: string;
  title: string;
  description: string;
  priority: WidgetPriority;
  minW: number;
  minH: number;
  defaultSpan: {
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  updateCadenceMs: number;
  states: string[];
}

/**
 * 12-column grid spec for responsive Mission Control dashboard layouts.
 */
export const missionControlGridSpec = {
  columns: 12,
  gutters: {
    sm: 12,
    md: 16,
    lg: 20,
  },
  margins: {
    sm: 12,
    md: 20,
    lg: 24,
  },
  rowHeights: {
    compact: 72,
    standard: 96,
    expanded: 132,
  },
  breakpoints: {
    sm: {
      minWidth: 0,
      maxWidth: 767,
      columns: 4,
      strategy: "single-priority-stack",
    },
    md: {
      minWidth: 768,
      maxWidth: 1023,
      columns: 8,
      strategy: "two-column-balanced",
    },
    lg: {
      minWidth: 1024,
      maxWidth: 1439,
      columns: 12,
      strategy: "operator-triad",
    },
    xl: {
      minWidth: 1440,
      maxWidth: Number.POSITIVE_INFINITY,
      columns: 12,
      strategy: "operator-triad-with-secondary-rail",
    },
  },
} as const;

/**
 * Component-level specs for the core Mission Control cards.
 *
 * Matches structure in the in-review MissionControlDashboard:
 * - Live status bar
 * - Active sessions panel
 * - Tool calls panel
 * - Pending approvals panel
 * - Alert feed
 */
export const missionControlWidgetSpecs: MissionControlWidgetSpec[] = [
  {
    id: "live-kpi-bar",
    title: "Live KPI Bar",
    description: "At-a-glance health metrics: sessions, agents, token throughput, gateway state.",
    priority: "critical",
    minW: 2,
    minH: 1,
    defaultSpan: { sm: 4, md: 8, lg: 12, xl: 12 },
    updateCadenceMs: 3000,
    states: ["live", "degraded", "offline"],
  },
  {
    id: "active-sessions",
    title: "Active Sessions",
    description: "Primary operational table for running/waiting/error sessions and current tool activity.",
    priority: "critical",
    minW: 2,
    minH: 3,
    defaultSpan: { sm: 4, md: 8, lg: 6, xl: 6 },
    updateCadenceMs: 2000,
    states: ["healthy", "elevated-latency", "errors-present", "empty"],
  },
  {
    id: "tool-calls",
    title: "Tool Calls In Flight",
    description: "Queue of active and recently completed tool calls with execution state and elapsed time.",
    priority: "high",
    minW: 2,
    minH: 3,
    defaultSpan: { sm: 4, md: 4, lg: 3, xl: 3 },
    updateCadenceMs: 1000,
    states: ["active", "idle", "error-spike"],
  },
  {
    id: "pending-approvals",
    title: "Pending Approvals",
    description: "Risk-scored approvals with fast approve/deny actions and aging indicators.",
    priority: "high",
    minW: 2,
    minH: 3,
    defaultSpan: { sm: 4, md: 4, lg: 3, xl: 3 },
    updateCadenceMs: 1000,
    states: ["needs-attention", "clear", "stale"],
  },
  {
    id: "alert-feed",
    title: "Alert Feed",
    description: "Time-ordered event stream with severity filters and sticky critical-state treatment.",
    priority: "critical",
    minW: 2,
    minH: 3,
    defaultSpan: { sm: 4, md: 8, lg: 12, xl: 9 },
    updateCadenceMs: 1000,
    states: ["quiet", "warning", "critical-burst"],
  },
] as const;

export const missionControlVisualizationPatterns = {
  sparkline: {
    useFor: "short-window (5-30m) trend context on cards",
    samplingIntervalSec: 5,
    maxPoints: 120,
  },
  segmentedHealthBar: {
    useFor: "capacity and token budget utilization",
    thresholds: [0.7, 0.85, 1.0],
  },
  eventTimeline: {
    useFor: "alert chronology and operator handoff context",
    densityModes: ["expanded", "compressed"],
  },
  statusPill: {
    useFor: "session, tool, and approval statuses",
    variants: ["success", "warning", "error", "info", "neutral"],
  },
  realtimePulse: {
    useFor: "live websocket/sse connectivity state",
    refreshIntervalMs: 1000,
    reducedMotionFallback: "static-dot",
  },
} as const;

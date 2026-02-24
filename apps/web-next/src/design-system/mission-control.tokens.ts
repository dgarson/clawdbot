export type MissionControlMode = "dark" | "light";

/**
 * Mission Control visual tokens.
 *
 * Aligned to the in-review MissionControlDashboard (origin/quinn/horizon-m1-mission-control)
 * so implementation teams can keep existing information architecture while standardizing style.
 */
export const missionControlTokens = {
  color: {
    dark: {
      canvas: "#09090B",
      surfaceBase: "#111318",
      surfaceElevated: "#171A22",
      surfaceHover: "#1E2230",
      borderSubtle: "#242938",
      borderStrong: "#343B4F",
      textPrimary: "#F4F6FB",
      textSecondary: "#A3ADC2",
      textMuted: "#78839B",
      focusRing: "#7C89FF",
      overlay: "rgba(5, 8, 16, 0.72)",

      status: {
        success: "#34D399",
        warning: "#FBBF24",
        error: "#F87171",
        info: "#60A5FA",
        neutral: "#94A3B8",
      },

      realtime: {
        pulse: "#22C55E",
        stream: "#A78BFA",
        queue: "#38BDF8",
      },
    },

    light: {
      canvas: "#F7F8FC",
      surfaceBase: "#FFFFFF",
      surfaceElevated: "#EEF1F8",
      surfaceHover: "#E6EBF5",
      borderSubtle: "#D8DEEA",
      borderStrong: "#BFC9DC",
      textPrimary: "#121722",
      textSecondary: "#4E5970",
      textMuted: "#6E7992",
      focusRing: "#5360F7",
      overlay: "rgba(11, 16, 32, 0.42)",

      status: {
        success: "#059669",
        warning: "#B45309",
        error: "#DC2626",
        info: "#2563EB",
        neutral: "#64748B",
      },

      realtime: {
        pulse: "#16A34A",
        stream: "#7C3AED",
        queue: "#0284C7",
      },
    },
  },

  typography: {
    family: {
      ui: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif",
      mono: "JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace",
    },
    size: {
      xs: "12px",
      sm: "13px",
      md: "14px",
      lg: "16px",
      xl: "20px",
      "2xl": "24px",
    },
    lineHeight: {
      tight: 1.2,
      normal: 1.45,
      loose: 1.6,
    },
    weight: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    1: "4px",
    2: "8px",
    3: "12px",
    4: "16px",
    5: "20px",
    6: "24px",
    8: "32px",
    10: "40px",
    12: "48px",
  },

  radius: {
    sm: "8px",
    md: "12px",
    lg: "16px",
    xl: "20px",
    pill: "999px",
  },

  shadow: {
    card: "0 8px 24px rgba(2, 6, 23, 0.24)",
    modal: "0 18px 44px rgba(2, 6, 23, 0.36)",
    glowRealtime: "0 0 0 1px rgba(124, 137, 255, 0.45), 0 0 20px rgba(124, 137, 255, 0.24)",
  },

  motion: {
    fast: "120ms",
    base: "200ms",
    slow: "320ms",
    easingStandard: "cubic-bezier(0.2, 0, 0, 1)",
    easingEntrance: "cubic-bezier(0.16, 1, 0.3, 1)",
  },

  breakpoint: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
  },

  dataViz: {
    categorical: ["#60A5FA", "#A78BFA", "#34D399", "#FBBF24", "#F87171", "#22D3EE", "#FB7185"],
    sequential: ["#1D4ED8", "#2563EB", "#3B82F6", "#60A5FA", "#93C5FD"],
    diverging: ["#059669", "#10B981", "#E5E7EB", "#FCA5A5", "#DC2626"],
    thresholds: {
      good: "#34D399",
      warn: "#FBBF24",
      bad: "#F87171",
    },
  },
} as const;

export type MissionControlTokens = typeof missionControlTokens;

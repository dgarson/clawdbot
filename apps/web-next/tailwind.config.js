/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // ---- Backward-compat shadcn-style (now CSS-var backed for theming) ----
        border:     "var(--color-border-ui)",
        input:      "var(--color-input-ui)",
        ring:       "var(--color-accent)",
        background: "var(--color-background)",
        foreground: "var(--color-foreground)",
        primary: {
          DEFAULT:    "var(--color-accent)",
          foreground: "hsl(0 0% 98%)",
        },
        secondary: {
          DEFAULT:    "var(--color-secondary)",
          foreground: "var(--color-secondary-fg)",
        },
        muted: {
          DEFAULT:    "var(--color-muted)",
          foreground: "var(--color-muted-fg)",
        },
        accent: {
          DEFAULT:    "var(--color-accent-ui)",
          foreground: "var(--color-accent-ui-fg)",
        },
        card: {
          DEFAULT:    "var(--color-card)",
          foreground: "var(--color-card-fg)",
        },
        destructive: {
          DEFAULT:    "var(--color-error)",
          foreground: "hsl(0 0% 98%)",
        },

        // ---- New Horizon token utilities ----
        // Usage: bg-surface-0, bg-surface-1, bg-surface-2, bg-surface-3
        "surface-0": "var(--color-surface-0)",
        "surface-1": "var(--color-surface-1)",
        "surface-2": "var(--color-surface-2)",
        "surface-3": "var(--color-surface-3)",

        // Usage: text-fg-primary, text-fg-secondary, text-fg-muted
        fg: {
          primary:   "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          muted:     "var(--color-text-muted)",
        },

        // Usage: border-tok-border, bg-tok-accent, text-tok-success, etc.
        tok: {
          border:  "var(--color-border)",
          accent:  "var(--color-accent)",
          success: "var(--color-success)",
          warning: "var(--color-warning)",
          error:   "var(--color-error)",
          info:    "var(--color-info)",
        },
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.25rem",
      },
      keyframes: {
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%":       { opacity: "0.7" },
        },
        "slide-in": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        "slide-in":   "slide-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};

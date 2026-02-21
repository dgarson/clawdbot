"use client";
import * as React from "react";
import { Sun, Moon, Monitor, Check } from "lucide-react";

type ThemeOption = "light" | "dark" | "system";

function MiniPreview({ theme }: { theme: "light" | "dark" }) {
  const isDark = theme === "dark";
  const bg = isDark ? "#0f0f14" : "#ffffff";
  const card = isDark ? "#1a1a24" : "#f8f8fc";
  const border = isDark ? "#2a2a3a" : "#e5e5ec";
  const primary = "#8b5cf6"; // OpenClaw violet
  const text = isDark ? "#e5e5f0" : "#1a1a24";
  const muted = isDark ? "#6b6b80" : "#9b9bac";
  const sidebar = isDark ? "#14141e" : "#f0f0f8";

  return (
    <svg
      viewBox="0 0 200 140"
      className="w-full rounded-lg overflow-hidden"
      style={{ background: bg }}
    >
      {/* Sidebar */}
      <rect x="0" y="0" width="40" height="140" fill={sidebar} />
      <rect x="0" y="0" width="40" height="140" stroke={border} strokeWidth="1" fill="none" />

      {/* Sidebar items */}
      <rect x="8" y="12" width="24" height="4" rx="2" fill={primary} opacity="0.2" />
      <circle cx="14" cy="28" r="3" fill={primary} opacity="0.6" />
      <rect x="20" y="26" width="14" height="3" rx="1.5" fill={muted} opacity="0.5" />
      <circle cx="14" cy="40" r="3" fill={muted} opacity="0.3" />
      <rect x="20" y="38" width="12" height="3" rx="1.5" fill={muted} opacity="0.3" />
      <circle cx="14" cy="52" r="3" fill={muted} opacity="0.3" />
      <rect x="20" y="50" width="16" height="3" rx="1.5" fill={muted} opacity="0.3" />

      {/* Topbar */}
      <rect x="40" y="0" width="160" height="20" fill={card} />
      <line x1="40" y1="20" x2="200" y2="20" stroke={border} strokeWidth="0.5" />
      <rect x="50" y="7" width="40" height="6" rx="3" fill={muted} opacity="0.3" />

      {/* Content cards */}
      <rect x="50" y="30" width="60" height="40" rx="4" fill={card} stroke={border} strokeWidth="0.5" />
      <rect x="56" y="38" width="30" height="4" rx="2" fill={text} opacity="0.7" />
      <rect x="56" y="46" width="48" height="3" rx="1.5" fill={muted} opacity="0.4" />
      <rect x="56" y="53" width="20" height="8" rx="4" fill={primary} />

      <rect x="120" y="30" width="60" height="40" rx="4" fill={card} stroke={border} strokeWidth="0.5" />
      <rect x="126" y="38" width="35" height="4" rx="2" fill={text} opacity="0.7" />
      <rect x="126" y="46" width="42" height="3" rx="1.5" fill={muted} opacity="0.4" />
      <rect x="126" y="53" width="20" height="8" rx="4" fill={primary} opacity="0.3" />

      {/* Bottom card */}
      <rect x="50" y="80" width="130" height="45" rx="4" fill={card} stroke={border} strokeWidth="0.5" />
      <rect x="56" y="88" width="50" height="4" rx="2" fill={text} opacity="0.7" />
      <rect x="56" y="96" width="100" height="3" rx="1.5" fill={muted} opacity="0.3" />
      <rect x="56" y="103" width="80" height="3" rx="1.5" fill={muted} opacity="0.3" />
      <rect x="56" y="110" width="60" height="3" rx="1.5" fill={muted} opacity="0.3" />
    </svg>
  );
}

export function ThemePreviewCards({
  current,
  onChange,
}: {
  current: ThemeOption;
  onChange: (theme: ThemeOption) => void;
}) {
  const options: { value: ThemeOption; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  // Detect system preference for "system" preview
  const [systemPrefers, setSystemPrefers] = React.useState<"light" | "dark">("dark");
  React.useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPrefers(mq.matches ? "dark" : "light");
    const handler = (e: MediaQueryListEvent) => setSystemPrefers(e.matches ? "dark" : "light");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <div className="grid grid-cols-3 gap-4">
      {options.map(({ value, label, icon: Icon }) => {
        const isActive = current === value;
        const previewTheme = value === "system" ? systemPrefers : value;

        return (
          <button
            key={value}
            onClick={() => onChange(value)}
            className={`relative group rounded-xl border-2 p-3 transition-all ${
              isActive
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border hover:border-primary/30 hover:shadow-sm"
            }`}
          >
            {/* Preview */}
            <div className="mb-3 rounded-lg overflow-hidden border border-border shadow-sm">
              <MiniPreview theme={previewTheme} />
            </div>

            {/* Label */}
            <div className="flex items-center justify-center gap-2">
              <Icon className={`h-4 w-4 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-sm font-medium ${isActive ? "text-primary" : ""}`}>
                {label}
              </span>
            </div>

            {/* Active Indicator */}
            {isActive && (
              <div className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-primary rounded-full flex items-center justify-center shadow-sm">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}

            {value === "system" && (
              <p className="text-[10px] text-muted-foreground mt-1">
                Currently: {systemPrefers}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

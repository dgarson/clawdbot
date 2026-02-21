"use client";
import * as React from "react";
import { cn } from "@/lib/utils/cn";
import { useGatewayStore } from "@/lib/stores/gateway";
import { useProficiencyStore } from "@/lib/stores/proficiency";
import { useUiStore } from "@/lib/stores/ui";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  Moon,
  Monitor,
  Wifi,
  WifiOff,
  Search,
  Menu,
  Gauge,
  Sparkles,
  Shield,
} from "lucide-react";

const PROFICIENCY_LABELS = {
  beginner: { label: "Simple", icon: Sparkles },
  standard: { label: "Standard", icon: Gauge },
  expert: { label: "Expert", icon: Shield },
} as const;

export function Topbar() {
  const connected = useGatewayStore((s) => s.connected);
  const connecting = useGatewayStore((s) => s.connecting);
  const snapshot = useGatewayStore((s) => s.snapshot);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const setCommandPaletteOpen = useUiStore((s) => s.setCommandPaletteOpen);
  const setSidebarMobileOpen = useUiStore((s) => s.setSidebarMobileOpen);
  const profLevel = useProficiencyStore((s) => s.level);
  const setProfLevel = useProficiencyStore((s) => s.setLevel);

  const cycleTheme = () => {
    const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
    setTheme(next);
  };

  const cycleProficiency = () => {
    const levels = ["beginner", "standard", "expert"] as const;
    const idx = levels.indexOf(profLevel);
    setProfLevel(levels[(idx + 1) % 3]);
  };

  const ThemeIcon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const ProfInfo = PROFICIENCY_LABELS[profLevel];

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 gap-4">
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          onClick={() => setSidebarMobileOpen(true)}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        <Button
          variant="outline"
          size="sm"
          className="hidden sm:flex items-center gap-2 text-muted-foreground w-64"
          onClick={() => setCommandPaletteOpen(true)}
        >
          <Search className="h-4 w-4" />
          <span className="text-xs">Search or run command...</span>
          <kbd className="ml-auto text-[10px] bg-muted px-1.5 py-0.5 rounded">⌘K</kbd>
        </Button>
      </div>

      {/* Right: status indicators + actions */}
      <div className="flex items-center gap-2">
        {/* Connection status */}
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Badge variant="success" className="gap-1 text-[10px]">
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Connected</span>
            </Badge>
          ) : connecting ? (
            <Badge variant="warning" className="gap-1 text-[10px]">
              <Wifi className="h-3 w-3 animate-pulse" />
              <span className="hidden sm:inline">Connecting...</span>
            </Badge>
          ) : (
            <Badge variant="destructive" className="gap-1 text-[10px]">
              <WifiOff className="h-3 w-3" />
              <span className="hidden sm:inline">Disconnected</span>
            </Badge>
          )}
        </div>

        {/* Version */}
        {snapshot?.updateAvailable && (
          <Badge variant="outline" className="text-[10px]">
            Update: {snapshot.updateAvailable.latestVersion}
          </Badge>
        )}

        {/* Proficiency toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={cycleProficiency}
          className="gap-1.5 text-xs text-muted-foreground"
          title={`Interface mode: ${ProfInfo.label}. Click to cycle.`}
        >
          <ProfInfo.icon className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{ProfInfo.label}</span>
        </Button>

        {/* Theme toggle */}
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={cycleTheme}
          aria-label={`Theme: ${theme}`}
        >
          <ThemeIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}

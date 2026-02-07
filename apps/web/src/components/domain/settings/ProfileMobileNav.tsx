"use client";

import * as React from "react";
import {
  User,
  MessageSquare,
  Palette,
  Bell,
  Accessibility,
  Clock,
  Shield,
  Activity,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores/useUIStore";
import type { ProfileSection } from "./ProfileNav";

interface NavItem {
  id: ProfileSection;
  label: string;
  icon: LucideIcon;
  expertOnly?: boolean;
}

interface ProfileMobileNavProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
  className?: string;
}

const navItems: NavItem[] = [
  { id: "profile", label: "Profile", icon: User },
  { id: "interaction-style", label: "Interaction", icon: MessageSquare },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "accessibility", label: "Accessibility", icon: Accessibility },
  { id: "availability", label: "Availability", icon: Clock },
  { id: "privacy", label: "Privacy", icon: Shield },
  { id: "activity", label: "Activity", icon: Activity, expertOnly: true },
];

export function ProfileMobileNav({
  activeSection,
  onSectionChange,
  className,
}: ProfileMobileNavProps) {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);
  const powerUserMode = useUIStore((state) => state.powerUserMode);

  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  const visibleItems = navItems.filter(
    (item) => !item.expertOnly || powerUserMode
  );

  return (
    <nav
      className={cn("relative", className)}
      role="navigation"
      aria-label="Profile sections"
    >
      <div
        className={cn(
          "flex gap-2 pb-2 px-1 overflow-x-auto",
          "scrollbar-thin"
        )}
        role="tablist"
        aria-orientation="horizontal"
      >
        {visibleItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`profile-panel-${item.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onSectionChange(item.id)}
              className={cn(
                "flex items-center gap-2 shrink-0",
                "min-h-[44px] px-4 py-2 rounded-full",
                "text-sm font-medium whitespace-nowrap",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                prefersReducedMotion ? "" : "transition-colors duration-150",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted/80"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default ProfileMobileNav;

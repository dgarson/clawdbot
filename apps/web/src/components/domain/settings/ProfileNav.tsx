"use client";

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

export type ProfileSection =
  | "profile"
  | "interaction-style"
  | "appearance"
  | "notifications"
  | "accessibility"
  | "availability"
  | "privacy"
  | "activity";

interface NavItem {
  id: ProfileSection;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  expertOnly?: boolean;
}

interface ProfileNavProps {
  activeSection: ProfileSection;
  onSectionChange: (section: ProfileSection) => void;
  className?: string;
}

const navGroups: NavGroup[] = [
  {
    label: "About You",
    items: [
      { id: "profile", label: "Profile", icon: User },
      { id: "interaction-style", label: "Interaction Style", icon: MessageSquare },
    ],
  },
  {
    label: "Preferences",
    items: [
      { id: "appearance", label: "Appearance", icon: Palette },
      { id: "notifications", label: "Notifications", icon: Bell },
      { id: "accessibility", label: "Accessibility", icon: Accessibility },
    ],
  },
  {
    label: "Availability",
    items: [{ id: "availability", label: "Availability & Quiet Hours", icon: Clock }],
  },
  {
    label: "Privacy & Data",
    items: [{ id: "privacy", label: "Privacy & Data", icon: Shield }],
  },
  {
    label: "Activity",
    items: [{ id: "activity", label: "Activity & Sessions", icon: Activity }],
    expertOnly: true,
  },
];

export function ProfileNav({
  activeSection,
  onSectionChange,
  className,
}: ProfileNavProps) {
  const powerUserMode = useUIStore((state) => state.powerUserMode);

  const visibleGroups = navGroups.filter(
    (group) => !group.expertOnly || powerUserMode
  );

  return (
    <nav className={cn("space-y-6", className)}>
      {visibleGroups.map((group) => (
        <div key={group.label} className="space-y-1">
          <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {group.label}
          </h4>
          {group.items.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSectionChange(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default ProfileNav;

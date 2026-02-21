
import {
  Zap,
  Plug,
  CreditCard,
  Brain,
  Server,
  MessageSquare,
  Bot,
  Activity,
  Wrench,
  BookOpen,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ConfigSection =
  | "health"
  | "ai-provider"
  | "gateway"
  | "channels"
  | "agents"
  | "guidance"
  | "toolsets"
  | "advanced"
  | "connections"
  | "usage";

interface NavItem {
  id: ConfigSection;
  label: string;
  icon: typeof Activity;
  group: "system" | "power";
}

interface SettingsConfigNavProps {
  activeSection: ConfigSection;
  onSectionChange: (section: ConfigSection) => void;
  className?: string;
}

const navItems: NavItem[] = [
  // System config
  { id: "health", label: "System Health", icon: Activity, group: "system" },
  { id: "ai-provider", label: "Model & Provider", icon: Brain, group: "system" },
  { id: "gateway", label: "Gateway", icon: Server, group: "system" },
  { id: "channels", label: "Channels", icon: MessageSquare, group: "system" },
  { id: "agents", label: "Agents", icon: Bot, group: "system" },
  { id: "guidance", label: "Guidance Packs", icon: BookOpen, group: "system" },
  { id: "toolsets", label: "Toolsets", icon: Wrench, group: "system" },
  // Power user
  { id: "advanced", label: "Advanced", icon: Zap, group: "power" },
  { id: "connections", label: "Connections", icon: Plug, group: "power" },
  { id: "usage", label: "Usage & Billing", icon: CreditCard, group: "power" },
];

const groupLabels: Record<string, string> = {
  system: "Configuration",
  power: "Advanced",
};

export function SettingsConfigNav({
  activeSection,
  onSectionChange,
  className,
}: SettingsConfigNavProps) {
  // Group items by their group
  const groups = navItems.reduce(
    (acc, item) => {
      const group = item.group;
      if (!acc[group]) {acc[group] = [];}
      acc[group].push(item);
      return acc;
    },
    {} as Record<string, NavItem[]>
  );

  const groupOrder = ["system", "power"] as const;

  return (
    <nav className={cn("space-y-6", className)}>
      {groupOrder.map((groupKey) => {
        const items = groups[groupKey];
        if (!items?.length) {return null;}

        return (
          <div key={groupKey} className="space-y-1">
            <h4 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              {groupLabels[groupKey]}
            </h4>
            {items.map((item) => {
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
        );
      })}
    </nav>
  );
}

export default SettingsConfigNav;

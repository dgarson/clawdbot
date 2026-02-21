"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/lib/stores/ui";
import { useProficiency } from "@/lib/stores/proficiency";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Clock,
  Zap,
  Link2,
  Smartphone,
  BarChart3,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  ScrollText,
  LayoutTemplate,
  Store,
} from "lucide-react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  minLevel?: "beginner" | "standard" | "expert";
};

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Automations", href: "/cron", icon: Clock, minLevel: "standard" },
  { label: "Skills", href: "/skills", icon: Zap, minLevel: "standard" },
  { label: "Marketplace", href: "/marketplace", icon: Store, minLevel: "standard" },
  { label: "Channels", href: "/channels", icon: Link2, minLevel: "standard" },
  { label: "Nodes", href: "/nodes", icon: Smartphone, minLevel: "standard" },
  { label: "Sessions", href: "/sessions", icon: BarChart3, minLevel: "expert" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, minLevel: "standard" },
  { label: "Logs", href: "/logs", icon: ScrollText, minLevel: "expert" },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const { isAtLeast } = useProficiency();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.minLevel || isAtLeast(item.minLevel)
  );

  return (
    <aside
      className={cn(
        "flex flex-col border-r border-border bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className={cn("flex items-center h-14 px-4 border-b border-border", collapsed && "justify-center")}>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            OC
          </div>
          {!collapsed && (
            <span className="font-semibold text-base tracking-tight">OpenClaw</span>
          )}
        </div>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {visibleItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? item.label : undefined}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>
    </aside>
  );
}

"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useProficiency } from "@/lib/stores/proficiency";
import {
  LayoutDashboard,
  Bot,
  MessageSquare,
  Zap,
  Settings,
  MoreHorizontal,
} from "lucide-react";

type TabItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
};

const PRIMARY_TABS: TabItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Skills", href: "/skills", icon: Zap },
  { label: "Settings", href: "/settings", icon: Settings },
];

// Beginner sees fewer tabs
const BEGINNER_TABS: TabItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Agents", href: "/agents", icon: Bot },
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileTabBar() {
  const pathname = usePathname();
  const { level } = useProficiency();

  const tabs = level === "beginner" ? BEGINNER_TABS : PRIMARY_TABS;

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg supports-[backdrop-filter]:bg-card/80 safe-bottom">
      <div className="flex items-center justify-around h-14 px-2">
        {tabs.map((tab) => {
          const isActive = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 flex-1 h-full rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <tab.icon
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )}
              />
              <span
                className={cn(
                  "text-[10px] font-medium leading-none",
                  isActive && "font-semibold"
                )}
              >
                {tab.label}
              </span>
              {isActive && (
                <div className="absolute bottom-1 h-0.5 w-5 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

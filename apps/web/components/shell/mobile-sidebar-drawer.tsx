"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useUiStore } from "@/lib/stores/ui";
import { useProficiency } from "@/lib/stores/proficiency";
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
  X,
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
  { label: "Chat", href: "/chat", icon: MessageSquare },
  { label: "Automations", href: "/cron", icon: Clock, minLevel: "standard" },
  { label: "Skills", href: "/skills", icon: Zap, minLevel: "standard" },
  { label: "Channels", href: "/channels", icon: Link2, minLevel: "standard" },
  { label: "Nodes", href: "/nodes", icon: Smartphone, minLevel: "standard" },
  { label: "Sessions", href: "/sessions", icon: BarChart3, minLevel: "expert" },
  { label: "Analytics", href: "/analytics", icon: BarChart3, minLevel: "standard" },
  { label: "Settings", href: "/settings", icon: Settings },
];

export function MobileSidebarDrawer() {
  const pathname = usePathname();
  const open = useUiStore((s) => s.sidebarMobileOpen);
  const setOpen = useUiStore((s) => s.setSidebarMobileOpen);
  const { isAtLeast } = useProficiency();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.minLevel || isAtLeast(item.minLevel)
  );

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed inset-y-0 left-0 z-50 w-72 bg-sidebar border-r border-border shadow-xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left duration-300"
        >
          <Dialog.Title className="sr-only">Navigation menu</Dialog.Title>

          {/* Header */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
                OC
              </div>
              <span className="font-semibold text-base tracking-tight text-sidebar-foreground">
                OpenClaw
              </span>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Navigation */}
          <nav className="flex flex-col gap-1 p-3 overflow-y-auto max-h-[calc(100vh-3.5rem)]">
            {visibleItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-sidebar-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

"use client";
import * as React from "react";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { CommandPalette } from "@/components/shell/command-palette";
import { MobileTabBar } from "@/components/shell/mobile-tab-bar";
import { MobileSidebarDrawer } from "@/components/shell/mobile-sidebar-drawer";
import { KeyboardShortcutsDialog } from "@/components/shell/keyboard-shortcuts-dialog";
import { ApprovalBar } from "@/components/shell/approval-bar";
import { Breadcrumbs } from "@/components/shell/breadcrumbs";
import { ConnectionBanner } from "@/components/shell/connection-banner";
import { useKeyboardShortcuts } from "@/lib/hooks/use-keyboard-shortcuts";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useKeyboardShortcuts();
  const [shortcutsOpen, setShortcutsOpen] = React.useState(false);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar — hidden on mobile */}
      <div className="hidden lg:flex">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <ConnectionBanner />
        <ApprovalBar />
        <Breadcrumbs />
        <main className="flex-1 overflow-auto pb-16 lg:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile bottom tab bar */}
      <MobileTabBar />

      {/* Mobile sidebar drawer (hamburger) */}
      <MobileSidebarDrawer />

      {/* Command Palette (⌘K) */}
      <CommandPalette />

      {/* Keyboard Shortcuts (?) */}
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
    </div>
  );
}

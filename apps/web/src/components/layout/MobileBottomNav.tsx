import * as React from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  Home,
  MessageCircle,
  Bot,
  Settings,
  Menu,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Sidebar } from "./Sidebar";

interface NavTabProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isActive: boolean;
}

function NavTab({ href, icon: Icon, label, isActive }: NavTabProps) {
  return (
    <Link
      to={href}
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs transition-colors",
        isActive
          ? "text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5", isActive && "text-primary")} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export function MobileBottomNav() {
  const location = useLocation();
  const pathname = location.pathname;
  const [menuOpen, setMenuOpen] = React.useState(false);

  // Don't show on fullscreen pages
  if (pathname.startsWith("/onboarding") || pathname.startsWith("/unlock")) {
    return null;
  }

  const isActive = (path: string) => {
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 safe-bottom">
      <NavTab
        href="/"
        icon={Home}
        label="Home"
        isActive={isActive("/")}
      />
      <NavTab
        href="/conversations"
        icon={MessageCircle}
        label="Chat"
        isActive={isActive("/conversations")}
      />
      <NavTab
        href="/agents"
        icon={Bot}
        label="Agents"
        isActive={isActive("/agents")}
      />
      <NavTab
        href="/settings"
        icon={Settings}
        label="Settings"
        isActive={isActive("/settings")}
      />

      {/* More menu - opens sidebar as sheet */}
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <button
            type="button"
            className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 w-[280px]">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <Sidebar className="border-r-0" />
        </SheetContent>
      </Sheet>
    </nav>
  );
}

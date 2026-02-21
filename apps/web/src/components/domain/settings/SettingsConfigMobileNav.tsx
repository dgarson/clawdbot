
import * as React from "react";
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
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConfigSection } from "./SettingsConfigNav";

interface NavItem {
  id: ConfigSection;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
}

interface SettingsConfigMobileNavProps {
  activeSection: ConfigSection;
  onSectionChange: (section: ConfigSection) => void;
  className?: string;
}

const navItems: NavItem[] = [
  { id: "health", label: "System Health", shortLabel: "Health", icon: Activity },
  { id: "ai-provider", label: "Model & Provider", shortLabel: "Model", icon: Brain },
  { id: "gateway", label: "Gateway", shortLabel: "Gateway", icon: Server },
  { id: "channels", label: "Channels", shortLabel: "Channels", icon: MessageSquare },
  { id: "agents", label: "Agents", shortLabel: "Agents", icon: Bot },
  { id: "guidance", label: "Guidance Packs", shortLabel: "Guidance", icon: BookOpen },
  { id: "toolsets", label: "Toolsets", shortLabel: "Toolsets", icon: Wrench },
  { id: "advanced", label: "Advanced", shortLabel: "Advanced", icon: Zap },
  { id: "connections", label: "Connections", shortLabel: "Connect", icon: Plug },
  { id: "usage", label: "Usage & Billing", shortLabel: "Usage", icon: CreditCard },
];

export function SettingsConfigMobileNav({
  activeSection,
  onSectionChange,
  className,
}: SettingsConfigMobileNavProps) {
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);
  const activeButtonRef = React.useRef<HTMLButtonElement>(null);
  const [showLeftFade, setShowLeftFade] = React.useState(false);
  const [showRightFade, setShowRightFade] = React.useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false);

  // Check for reduced motion preference
  React.useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  // Update scroll fade indicators
  const updateScrollFades = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) {return;}

    const { scrollLeft, scrollWidth, clientWidth } = container;
    const threshold = 10;

    setShowLeftFade(scrollLeft > threshold);
    setShowRightFade(scrollLeft < scrollWidth - clientWidth - threshold);
  }, []);

  // Initialize and listen for scroll
  React.useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) {return;}

    updateScrollFades();

    container.addEventListener("scroll", updateScrollFades, { passive: true });
    window.addEventListener("resize", updateScrollFades);

    return () => {
      container.removeEventListener("scroll", updateScrollFades);
      window.removeEventListener("resize", updateScrollFades);
    };
  }, [updateScrollFades]);

  // Scroll active item into view when it changes
  React.useEffect(() => {
    const button = activeButtonRef.current;
    const container = scrollContainerRef.current;
    if (!button || !container) {return;}

    const containerRect = container.getBoundingClientRect();
    const buttonRect = button.getBoundingClientRect();

    const isOutsideLeft = buttonRect.left < containerRect.left + 20;
    const isOutsideRight = buttonRect.right > containerRect.right - 20;

    if (isOutsideLeft || isOutsideRight) {
      button.scrollIntoView({
        behavior: prefersReducedMotion ? "auto" : "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [activeSection, prefersReducedMotion]);

  return (
    <nav
      className={cn("relative", className)}
      role="navigation"
      aria-label="Settings sections"
    >
      {/* Left fade indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none",
          "bg-gradient-to-r from-background to-transparent",
          "transition-opacity duration-200",
          showLeftFade ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Right fade indicator */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none",
          "bg-gradient-to-l from-background to-transparent",
          "transition-opacity duration-200",
          showRightFade ? "opacity-100" : "opacity-0"
        )}
        aria-hidden="true"
      />

      {/* Scrollable container */}
      <div
        ref={scrollContainerRef}
        className={cn(
          "flex gap-2 overflow-x-auto pb-2 px-1",
          "scrollbar-thin",
          "[-webkit-overflow-scrolling:touch]",
          "[&::-webkit-scrollbar]:h-0 [&::-webkit-scrollbar]:w-0"
        )}
        role="tablist"
        aria-orientation="horizontal"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;

          return (
            <button
              key={item.id}
              ref={isActive ? activeButtonRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${item.id}`}
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
              <span className="xs:hidden">{item.shortLabel}</span>
              <span className="hidden xs:inline">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default SettingsConfigMobileNav;

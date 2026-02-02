import { Link, useRouterState } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface NavItemProps {
  /** The route path to navigate to */
  href: string;
  /** Optional search params to append to the URL */
  search?: Record<string, string>;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Label text for the navigation item */
  label: string;
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Optional badge count to display */
  badge?: number;
  /** Click handler (used for non-navigation items) */
  onClick?: () => void;
  /** Whether to require exact match including search params for active state */
  exactMatch?: boolean;
  /** Search params that should exclude this item from being active */
  inactiveWhenSearch?: Record<string, string>;
}

export function NavItem({
  href,
  search,
  icon: Icon,
  label,
  collapsed = false,
  badge,
  onClick,
  exactMatch = false,
  inactiveWhenSearch,
}: NavItemProps) {
  // Check if we should force inactive state based on current search params
  const routerState = useRouterState();
  const currentSearch = routerState.location.search as Record<string, unknown> | string;
  const pathname = routerState.location.pathname ?? "";

  const readSearchValue = (value: unknown): string | null => {
    if (value == null) {return null;}
    if (Array.isArray(value)) {
      const first = value[0];
      return first == null ? null : String(first);
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    return null;
  };

  const readSearchParam = (key: string): string | null => {
    if (typeof currentSearch === "string") {
      const params = new URLSearchParams(currentSearch.startsWith("?") ? currentSearch : `?${currentSearch}`);
      return params.get(key);
    }
    return readSearchValue((currentSearch as Record<string, unknown>)[key]);
  };

  const shouldBeInactive = Boolean(
    inactiveWhenSearch &&
      Object.entries(inactiveWhenSearch).some(([key, value]) => readSearchParam(key) === value)
  );

  const pathMatches = exactMatch
    ? pathname === href
    : href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const searchMatches = !search
    ? true
    : Object.entries(search).every(([key, value]) => readSearchParam(key) === value);

  const isActive = pathMatches && searchMatches && !shouldBeInactive;

  const content = (
    <>
      <Icon className="size-5 shrink-0" />
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "auto" }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden whitespace-nowrap"
          >
            {label}
          </motion.span>
        )}
      </AnimatePresence>
      {badge !== undefined && badge > 0 && !collapsed && (
        <span className="ml-auto rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </>
  );

  const baseClasses = cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
    "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
    "[&.active]:bg-accent [&.active]:text-accent-foreground",
    collapsed && "justify-center px-2"
  );

  if (onClick) {
    const button = (
      <button type="button" onClick={onClick} className={cn(baseClasses, "w-full text-left")}>
        {content}
      </button>
    );

    if (!collapsed) {return button;}

    return (
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="right" align="center">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  const link = (
    <Link
      to={href}
      search={search}
      className={cn(baseClasses, isActive && "active")}
    >
      {content}
    </Link>
  );

  if (!collapsed) {return link;}

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" align="center">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";

// ─── Route Label Map ─────────────────────────────────────
const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  agents: "Agents",
  new: "New Agent",
  chat: "Chat",
  cron: "Automations",
  sessions: "Sessions",
  channels: "Channels",
  nodes: "Nodes",
  skills: "Skills",
  analytics: "Analytics",
  logs: "Logs",
  marketplace: "Marketplace",
  settings: "Settings",
  templates: "Templates",
  onboarding: "Setup",
};

function getLabel(segment: string): string {
  return ROUTE_LABELS[segment] ?? segment;
}

// ─── Main Component ──────────────────────────────────────
export function Breadcrumbs() {
  const pathname = usePathname();

  const segments = pathname
    .split("/")
    .filter(Boolean);

  // Don't show breadcrumbs for top-level pages
  if (segments.length <= 1) {return null;}

  const crumbs = segments.map((segment, idx) => {
    const href = "/" + segments.slice(0, idx + 1).join("/");
    const label = getLabel(segment);
    const isLast = idx === segments.length - 1;
    const isAgentId = idx > 0 && segments[idx - 1] === "agents" && segment !== "new";

    return {
      label: isAgentId ? segment : label,
      href,
      isLast,
      isId: isAgentId,
    };
  });

  return (
    <nav className="flex items-center gap-1 text-xs text-muted-foreground px-6 py-2 border-b border-border/50 bg-muted/30">
      <Link
        href="/dashboard"
        className="hover:text-foreground transition-colors flex items-center gap-1"
      >
        <Home className="h-3 w-3" />
      </Link>
      {crumbs.map((crumb) => (
        <React.Fragment key={crumb.href}>
          <ChevronRight className="h-3 w-3 opacity-50" />
          {crumb.isLast ? (
            <span className={`font-medium text-foreground ${crumb.isId ? "font-mono" : ""}`}>
              {crumb.label}
            </span>
          ) : (
            <Link
              href={crumb.href}
              className={`hover:text-foreground transition-colors ${crumb.isId ? "font-mono" : ""}`}
            >
              {crumb.label}
            </Link>
          )}
        </React.Fragment>
      ))}
    </nav>
  );
}

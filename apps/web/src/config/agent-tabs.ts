import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, Briefcase, Activity, MessageSquare, Settings } from "lucide-react";

export type AgentDetailTab = "overview" | "work" | "activity" | "chat" | "configure";

export interface TabConfig {
  id: AgentDetailTab;
  label: string;
  icon: LucideIcon;
  description: string;
  order: number;
}

export const AGENT_TABS: TabConfig[] = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    description: "Agent summary, stats, and personality",
    order: 0,
  },
  {
    id: "work",
    label: "Work",
    icon: Briefcase,
    description: "Workstreams and scheduled rituals",
    order: 1,
  },
  {
    id: "activity",
    label: "Activity",
    icon: Activity,
    description: "Recent activity and execution logs",
    order: 2,
  },
  {
    id: "chat",
    label: "Chat",
    icon: MessageSquare,
    description: "Conversation sessions",
    order: 3,
  },
  {
    id: "configure",
    label: "Configure",
    icon: Settings,
    description: "Agent settings, tools, and personality",
    order: 4,
  },
];

export const DEFAULT_TAB: AgentDetailTab = "overview";

export function isValidTab(tab: string): tab is AgentDetailTab {
  return AGENT_TABS.some((t) => t.id === tab);
}

/** Maps old tab URL values to the new tab system for backwards compatibility. */
export const TAB_REDIRECTS: Record<string, AgentDetailTab> = {
  overview: "overview",
  workstreams: "work",
  rituals: "work",
  tools: "configure",
  soul: "configure",
  activity: "activity",
};

/**
 * Resolves a raw URL tab param (which may be from old or new naming) to a
 * valid AgentDetailTab, falling back to the default tab.
 */
export function resolveTab(tab: string | undefined): AgentDetailTab {
  if (!tab) {return DEFAULT_TAB;}
  if (isValidTab(tab)) {return tab;}
  return TAB_REDIRECTS[tab] ?? DEFAULT_TAB;
}


import { cn } from "@/lib/utils";
import { AGENT_TABS, type AgentDetailTab } from "@/config/agent-tabs";

interface MobileTabNavProps {
  activeTab: AgentDetailTab;
  onTabChange: (tab: AgentDetailTab) => void;
  className?: string;
}

export function MobileTabNav({ activeTab, onTabChange, className }: MobileTabNavProps) {
  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 border-t border-border/50 bg-background/95 backdrop-blur-sm sm:hidden",
        className
      )}
    >
      <div className="grid grid-cols-5 h-16 px-1">
        {AGENT_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileTabNav;

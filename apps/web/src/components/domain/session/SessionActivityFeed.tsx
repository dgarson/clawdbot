
import * as React from "react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Code,
  Zap,
  RefreshCw,
} from "lucide-react";

export type ActivityType =
  | "message"
  | "task_complete"
  | "task_start"
  | "task_live"
  | "error"
  | "search"
  | "code"
  | "ritual";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  timestamp: string;
  progress?: number;
}

export interface SessionActivityFeedProps {
  /** Activities to display */
  activities: Activity[];
  /** Maximum number of activities to show */
  maxItems?: number;
  /** Additional CSS classes */
  className?: string;
}

const activityConfig: Record<
  ActivityType,
  { icon: React.ElementType; color: string; bgColor: string; label: string }
> = {
  message: {
    icon: MessageSquare,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    label: "Message",
  },
  task_complete: {
    icon: CheckCircle2,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    label: "Completed",
  },
  task_start: {
    icon: Zap,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    label: "Started",
  },
  task_live: {
    icon: Loader2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
    label: "Live",
  },
  error: {
    icon: AlertCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
    label: "Error",
  },
  search: {
    icon: Search,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    label: "Search",
  },
  code: {
    icon: Code,
    color: "text-orange-500",
    bgColor: "bg-orange-500/10",
    label: "Code",
  },
  ritual: {
    icon: RefreshCw,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
    label: "Ritual",
  },
};

/**
 * Format relative time from ISO timestamp
 */
function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);

  if (diffMins < 1) {return "Now";}
  if (diffMins < 60) {return `${diffMins}m`;}
  if (diffHours < 24) {return `${diffHours}h`;}
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function SessionActivityFeed({
  activities,
  maxItems = 10,
  className,
}: SessionActivityFeedProps) {
  const displayActivities = activities.slice(0, maxItems);
  const liveActivities = displayActivities.filter((a) => a.type === "task_live");
  const pastActivities = displayActivities.filter((a) => a.type !== "task_live");

  if (displayActivities.length === 0) {
    return (
      <div className={cn("flex flex-col items-center justify-center py-8 text-center", className)}>
        <div className="rounded-full bg-muted p-3 mb-3">
          <Zap className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">No activity yet</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full", className)}>
      <div className="space-y-4 p-4">
        {/* Live activities section */}
        {liveActivities.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-emerald-500">Live</span>
              <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            {liveActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Past activities */}
        {pastActivities.length > 0 && (
          <div className="space-y-2">
            {liveActivities.length > 0 && (
              <span className="text-xs font-medium text-muted-foreground">Recent</span>
            )}
            {pastActivities.map((activity) => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}

interface ActivityItemProps {
  activity: Activity;
}

function ActivityItem({ activity }: ActivityItemProps) {
  const config = activityConfig[activity.type];
  const Icon = config.icon;
  const isLive = activity.type === "task_live";

  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card/50 p-3 transition-colors",
        isLive && "border-emerald-500/20 bg-emerald-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
            config.bgColor
          )}
        >
          <Icon
            className={cn(
              "h-3.5 w-3.5",
              config.color,
              isLive && "animate-spin"
            )}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-medium truncate">{activity.title}</h4>
            <span className="text-[10px] text-muted-foreground shrink-0">
              {formatRelativeTime(activity.timestamp)}
            </span>
          </div>

          {activity.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {activity.description}
            </p>
          )}

          {/* Progress bar for live tasks */}
          {isLive && typeof activity.progress === "number" && (
            <div className="mt-2 space-y-1">
              <Progress value={Math.max(0, Math.min(100, activity.progress))} className="h-1" />
              <div className="flex justify-end">
                <span className="text-[10px] text-muted-foreground font-mono">
                  {Math.round(activity.progress)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SessionActivityFeed;

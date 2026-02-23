
import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Activity,
  ArrowRight,
  Loader2,
  MessageCircle,
  Wrench,
  CheckCircle2,
  XCircle,
  Play,
  GitBranch,
  FileEdit,
} from "lucide-react";
import { useAgentActivity, type ActivityType } from "@/hooks/queries/useAgentActivity";

interface AgentActivityFeedProps {
  maxItems?: number;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const activityConfig: Record<
  ActivityType,
  { icon: typeof Activity; color: string; bgColor: string }
> = {
  session_started: {
    icon: Play,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
  message_sent: {
    icon: MessageCircle,
    color: "text-indigo-500",
    bgColor: "bg-indigo-500/10",
  },
  tool_called: {
    icon: Wrench,
    color: "text-amber-500",
    bgColor: "bg-amber-500/10",
  },
  task_completed: {
    icon: CheckCircle2,
    color: "text-emerald-500",
    bgColor: "bg-emerald-500/10",
  },
  task_failed: {
    icon: XCircle,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  agent_spawned: {
    icon: GitBranch,
    color: "text-violet-500",
    bgColor: "bg-violet-500/10",
  },
  file_edited: {
    icon: FileEdit,
    color: "text-cyan-500",
    bgColor: "bg-cyan-500/10",
  },
};

function formatRelativeTime(dateString: string): string {
  const diff = Date.now() - new Date(dateString).getTime();
  const mins = Math.floor(diff / 60_000);

  if (mins < 1) {return "now";}
  if (mins < 60) {return `${mins}m`;}
  const hours = Math.floor(mins / 60);
  if (hours < 24) {return `${hours}h`;}
  return `${Math.floor(hours / 24)}d`;
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Agent name → consistent avatar color
const agentColors: Record<string, string> = {
  xavier: "bg-orange-600",
  luis: "bg-blue-600",
  stephan: "bg-green-600",
  julia: "bg-purple-600",
  tim: "bg-pink-600",
};

export function AgentActivityFeed({
  maxItems = 8,
  className,
}: AgentActivityFeedProps) {
  const { data: activities, isLoading, isFetching } = useAgentActivity(maxItems);

  return (
    <Card className={cn("overflow-hidden border-border/50", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base font-semibold">
          <Activity className="h-4 w-4 text-primary" aria-hidden="true" />
          Agent Activity
          {/* Live indicator — subtle pulse when auto-refreshing */}
          {isFetching && (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/50 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          )}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="text-xs">
          <Link to="/logs">
            View all
            <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>

      <CardContent className="px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !activities || activities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Activity className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No recent activity
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Agent activity will appear here as they work
            </p>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-1"
            role="feed"
            aria-label="Agent activity feed"
          >
            {activities.map((activity) => {
              const config = activityConfig[activity.type];
              const Icon = config.icon;

              return (
                <motion.div
                  key={activity.id}
                  variants={itemVariants}
                  className="group flex items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/50"
                  role="article"
                  aria-label={`${activity.agentName}: ${activity.description}`}
                >
                  {/* Agent Avatar */}
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback
                      className={cn(
                        "text-[10px] font-medium text-white",
                        agentColors[activity.agentId.toLowerCase()] || "bg-gray-600"
                      )}
                    >
                      {getInitials(activity.agentName)}
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-foreground">
                        {activity.agentName}
                      </span>
                      <div
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded",
                          config.bgColor
                        )}
                      >
                        <Icon className={cn("h-2.5 w-2.5", config.color)} aria-hidden="true" />
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {activity.description}
                    </p>
                  </div>

                  {/* Timestamp */}
                  <time
                    dateTime={activity.timestamp}
                    className="shrink-0 text-[10px] text-muted-foreground pt-0.5"
                  >
                    {formatRelativeTime(activity.timestamp)}
                  </time>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}

export default AgentActivityFeed;


import * as React from "react";
import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRituals } from "@/hooks/queries";
import { RefreshCw, ArrowRight, Loader2, Clock, Bot } from "lucide-react";

interface UpcomingRitualsPanelProps {
  maxRituals?: number;
  className?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

function formatNextRun(nextRun?: string): string {
  if (!nextRun) {return "Not scheduled";}

  const date = new Date(nextRun);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (diff < 0) {return "Overdue";}
  if (hours < 1) {return "Less than an hour";}
  if (hours < 24) {return `In ${hours}h`;}
  if (days < 7) {return `In ${days}d`;}

  return date.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

const frequencyColors: Record<string, string> = {
  hourly: "bg-blue-500/20 text-blue-600",
  daily: "bg-green-500/20 text-green-600",
  weekly: "bg-purple-500/20 text-purple-600",
  monthly: "bg-orange-500/20 text-orange-600",
  custom: "bg-gray-500/20 text-gray-600 dark:text-gray-400",
};

export function UpcomingRitualsPanel({
  maxRituals = 4,
  className,
}: UpcomingRitualsPanelProps) {
  const { data: rituals, isLoading, error } = useRituals();

  // Filter active rituals and sort by next run
  const upcomingRituals = React.useMemo(() => {
    if (!rituals) {return [];}
    return rituals
      .filter((r) => r.status === "active" && r.nextRun)
      .toSorted((a, b) => {
        const aTime = a.nextRun ? new Date(a.nextRun).getTime() : Infinity;
        const bTime = b.nextRun ? new Date(b.nextRun).getTime() : Infinity;
        return aTime - bTime;
      })
      .slice(0, maxRituals);
  }, [rituals, maxRituals]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut", delay: 0.2 }}
      className={cn("", className)}
    >
      <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
              <RefreshCw className="h-4 w-4 text-blue-500" />
            </div>
            <CardTitle className="text-lg">Upcoming Rituals</CardTitle>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/rituals">
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>

        <CardContent className="pt-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Failed to load rituals
            </div>
          ) : upcomingRituals.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No upcoming rituals
            </div>
          ) : (
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="space-y-3"
            >
              {upcomingRituals.map((ritual) => (
                <motion.div
                  key={ritual.id}
                  variants={itemVariants}
                  className="group flex items-center gap-3 rounded-lg border border-border/50 bg-secondary/30 p-3 transition-all duration-200 hover:border-primary/30 hover:bg-secondary/50"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                    <RefreshCw className="h-5 w-5 text-blue-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="truncate text-sm font-medium text-foreground group-hover:text-primary transition-colors">
                      {ritual.name}
                    </h4>
                    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatNextRun(ritual.nextRun)}</span>
                      {ritual.agentId && (
                        <>
                          <span className="text-border">|</span>
                          <Bot className="h-3 w-3" />
                          <span>Agent {ritual.agentId}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 text-xs capitalize",
                      frequencyColors[ritual.frequency] || frequencyColors.custom
                    )}
                  >
                    {ritual.frequency}
                  </Badge>
                </motion.div>
              ))}
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default UpcomingRitualsPanel;

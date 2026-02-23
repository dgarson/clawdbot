import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type IconType =
  | React.ElementType
  | React.FunctionComponent<React.SVGProps<SVGSVGElement>>;

export interface ActivityItem {
  id: string;
  icon: IconType;
  message: React.ReactNode;
  timestamp: string;
  iconColorClass?: string;
}

export interface RecentActivityFeedProps {
  activities: ActivityItem[];
  cardTitle?: string;
  className?: string;
}

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  cardTitle = "Recent Activity",
  className,
}) => {
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" as const },
    },
    exit: { opacity: 0, x: -20, transition: { duration: 0.2, ease: "easeIn" as const } },
  };

  return (
    <Card className={cn("h-full", className)}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold text-foreground">
          {cardTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {activities.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-sm">
            No recent activity to display.
          </div>
        ) : (
          <motion.div layout className="divide-y divide-border">
            <AnimatePresence initial={false}>
              {activities.map((activity) => (
                <motion.div
                  key={activity.id}
                  variants={itemVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  layout
                  className="flex items-start gap-3 p-4 hover:bg-muted/30 transition-colors duration-200"
                >
                  <div
                    className={cn(
                      "flex-shrink-0 p-1 rounded-full",
                      activity.iconColorClass ||
                        "text-muted-foreground bg-muted"
                    )}
                  >
                    <activity.icon className="h-4 w-4" aria-hidden="true" />
                  </div>

                  <div className="flex-grow flex flex-col">
                    <p className="text-sm font-medium text-foreground leading-tight">
                      {activity.message}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {activity.timestamp}
                    </p>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

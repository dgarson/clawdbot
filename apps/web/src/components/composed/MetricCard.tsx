"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: {
    value: number;
    trend: "up" | "down" | "neutral";
  };
  icon?: React.ReactNode;
  className?: string;
}

const trendConfig = {
  up: {
    icon: TrendingUp,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
  },
  down: {
    icon: TrendingDown,
    color: "text-red-500",
    bgColor: "bg-red-500/10",
  },
  neutral: {
    icon: Minus,
    color: "text-muted-foreground",
    bgColor: "bg-muted/50",
  },
};

export function MetricCard({
  label,
  value,
  change,
  icon,
  className,
}: MetricCardProps) {
  const trend = change ? trendConfig[change.trend] : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("group", className)}
    >
      <Card className="overflow-hidden border-border/50 bg-card/80 backdrop-blur-sm transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            {/* Label and value */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                {label}
              </p>
              <motion.p
                key={String(value)}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="text-3xl font-bold tracking-tight text-foreground"
              >
                {value}
              </motion.p>
            </div>

            {/* Icon */}
            {icon && (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors duration-300 group-hover:bg-primary/20">
                {icon}
              </div>
            )}
          </div>

          {/* Trend indicator */}
          {change && trend && (
            <div className="mt-4 flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full px-2 py-0.5",
                  trend.bgColor
                )}
              >
                <trend.icon className={cn("h-3 w-3", trend.color)} />
                <span className={cn("text-xs font-medium", trend.color)}>
                  {change.value > 0 ? "+" : ""}
                  {change.value}%
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                vs last period
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default MetricCard;

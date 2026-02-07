"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Calendar, RefreshCw, Check } from "lucide-react";
import type { RitualFrequency } from "./RitualCard";

interface RitualSchedulerProps {
  initialTime?: string;
  initialFrequency?: RitualFrequency;
  variant?: "card" | "inline";
  onSchedule?: (time: string, frequency: RitualFrequency) => void;
  onCancel?: () => void;
  className?: string;
}

const frequencyOptions: { value: RitualFrequency; label: string; description: string }[] = [
  { value: "daily", label: "Daily", description: "Every day" },
  { value: "weekly", label: "Weekly", description: "Once a week" },
  { value: "monthly", label: "Monthly", description: "Once a month" },
  { value: "custom", label: "Custom", description: "Set your own" },
];

const quickTimeOptions = [
  { label: "Morning", time: "09:00", icon: "sun" },
  { label: "Noon", time: "12:00", icon: "sun" },
  { label: "Afternoon", time: "15:00", icon: "cloud" },
  { label: "Evening", time: "18:00", icon: "moon" },
];

export function RitualScheduler({
  initialTime = "09:00",
  initialFrequency = "daily",
  variant = "card",
  onSchedule,
  onCancel,
  className,
}: RitualSchedulerProps) {
  const [time, setTime] = useState(initialTime);
  const [frequency, setFrequency] = useState<RitualFrequency>(initialFrequency);

  const handleSchedule = () => {
    onSchedule?.(time, frequency);
  };

  const content = (
    <div className={cn(variant === "inline" ? "rounded-xl border border-border/50 bg-secondary/10 p-4" : "")}>
      {/* Header */}
      <div className={cn("flex items-center gap-3", variant === "inline" ? "mb-4" : "mb-6")}>
        <div className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          variant === "inline" ? "bg-secondary/60" : "bg-primary/10"
        )}>
          <Calendar className={cn("h-5 w-5", variant === "inline" ? "text-foreground" : "text-primary")} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-foreground">Schedule Ritual</h3>
          <p className="text-sm text-muted-foreground">Set when this ritual runs</p>
        </div>
      </div>

      {/* Time picker */}
      <div className={cn(variant === "inline" ? "mb-4" : "mb-6")}>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Clock className="h-4 w-4 text-muted-foreground" />
          Time
        </label>

        {/* Native time input with custom styling */}
        <div className="relative mb-3">
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-full rounded-xl border border-border bg-secondary/50 px-4 py-3 text-lg font-medium text-foreground transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Quick time options */}
        <div className="grid grid-cols-4 gap-2">
          {quickTimeOptions.map((option) => (
            <button
              key={option.time}
              onClick={() => setTime(option.time)}
              className={cn(
                "rounded-lg border px-2 py-2 text-center transition-all",
                time === option.time
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 bg-secondary/30 text-muted-foreground hover:border-primary/40 hover:bg-secondary/70 hover:text-foreground"
              )}
            >
              <span className="block text-xs font-medium">{option.label}</span>
              <span className="block text-[10px] text-muted-foreground/80">{option.time}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Frequency picker */}
      <div className={cn(variant === "inline" ? "mb-4" : "mb-6")}>
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
          Frequency
        </label>

        <div className="grid grid-cols-2 gap-2">
          {frequencyOptions.map((option) => (
            <motion.button
              key={option.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setFrequency(option.value)}
              className={cn(
                "group relative rounded-xl border p-3 text-left transition-all",
                frequency === option.value
                  ? "border-primary bg-primary/10"
                  : "border-border/50 bg-secondary/30 hover:border-primary/40 hover:bg-secondary/70"
              )}
            >
              {frequency === option.value && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-2 right-2"
                >
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                </motion.div>
              )}
              <span className={cn(
                "block text-sm font-medium transition-colors",
                frequency === option.value ? "text-primary" : "text-foreground/90 group-hover:text-foreground"
              )}>
                {option.label}
              </span>
              <span className="block text-xs text-muted-foreground/80 transition-colors group-hover:text-muted-foreground">
                {option.description}
              </span>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className={cn(variant === "inline" ? "mb-4" : "mb-6", "rounded-xl bg-secondary/50 p-4")}>
        <p className="text-sm text-muted-foreground">
          This ritual will run{" "}
          <Badge variant="secondary" className="mx-1">
            {frequencyOptions.find((f) => f.value === frequency)?.label.toLowerCase()}
          </Badge>
          at{" "}
          <Badge variant="secondary" className="mx-1">
            {time}
          </Badge>
        </p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {onCancel && (
          <Button
            variant="ghost"
            onClick={onCancel}
            className="flex-1 h-11 rounded-xl"
          >
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSchedule}
          className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Check className="mr-2 h-4 w-4" />
          Schedule
        </Button>
      </div>
    </div>
  );

  if (variant === "inline") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 8 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className={cn("w-full", className)}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("w-full max-w-md", className)}
    >
      <Card className="relative overflow-hidden rounded-2xl border-border/50 bg-gradient-to-br from-card via-card to-card/80 backdrop-blur-sm">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary via-accent to-primary opacity-60" />
        <CardContent className="p-6">{content}</CardContent>
      </Card>
    </motion.div>
  );
}

export default RitualScheduler;
